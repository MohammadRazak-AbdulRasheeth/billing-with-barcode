import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '../db';

interface TerminalSession {
  sessionId: string;
  authKey: string;
  terminalName: string;
  terminalSocketId: string;
  scannerSocketId: string | null;
  lastActive: number;
}

// In-memory active sessions and reverse lookup maps
const sessions = new Map<string, TerminalSession>();
const socketToRole = new Map<string, { sessionId: string; role: 'terminal' | 'scanner' }>();

export function setupSocketIO(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // 1. Terminal Registers with Unique Session ID & Auth Key
    socket.on(
      'register-terminal',
      (
        data: { sessionId: string; authKey: string; terminalName?: string },
        callback?: (res: { success: boolean; isPaired: boolean; terminalName: string }) => void
      ) => {
        const { sessionId, authKey, terminalName = 'Counter 1' } = data;
        if (!sessionId || !authKey) {
          if (callback) callback({ success: false, isPaired: false, terminalName });
          return;
        }

        const existing = sessions.get(sessionId);
        if (existing) {
          existing.terminalSocketId = socket.id;
          existing.authKey = authKey;
          existing.terminalName = terminalName;
          existing.lastActive = Date.now();
        } else {
          sessions.set(sessionId, {
            sessionId,
            authKey,
            terminalName,
            terminalSocketId: socket.id,
            scannerSocketId: null,
            lastActive: Date.now(),
          });
        }

        socket.join(`session_${sessionId}`);
        socketToRole.set(socket.id, { sessionId, role: 'terminal' });
        console.log(`[Socket.IO] Terminal "${terminalName}" registered [Session: ${sessionId}]`);

        const isPaired = !!sessions.get(sessionId)?.scannerSocketId;
        if (callback) {
          callback({ success: true, isPaired, terminalName });
        }
      }
    );

    // 2. Scanner Pairs using Session ID & Auth Key
    socket.on(
      'pair-scanner',
      (
        data: { sessionId: string; authKey: string; scannerName?: string },
        callback?: (res: { success: boolean; error?: string; terminalName?: string }) => void
      ) => {
        const { sessionId, authKey, scannerName = 'Mobile Phone' } = data;
        const session = sessions.get(sessionId);

        if (!session) {
          if (callback) callback({ success: false, error: 'Billing counter session not found. Please refresh counter QR code.' });
          return;
        }

        if (session.authKey !== authKey) {
          if (callback) callback({ success: false, error: 'Invalid or expired Auth Security Key. Scan QR code again.' });
          return;
        }

        // If another scanner is currently attached, eject it
        if (session.scannerSocketId && session.scannerSocketId !== socket.id) {
          io.to(session.scannerSocketId).emit('force-disconnected', {
            message: 'Another scanner was paired to this counter.',
          });
        }

        session.scannerSocketId = socket.id;
        session.lastActive = Date.now();
        socket.join(`session_${sessionId}`);
        socketToRole.set(socket.id, { sessionId, role: 'scanner' });

        console.log(`[Socket.IO] Scanner "${scannerName}" paired to "${session.terminalName}" [${sessionId}]`);

        // Notify the specific counter terminal
        io.to(session.terminalSocketId).emit('scanner-paired', {
          scannerSocketId: socket.id,
          scannerName,
          sessionId,
        });

        if (callback) {
          callback({ success: true, terminalName: session.terminalName });
        }
      }
    );

    // 3. Scanner Disconnects Voluntarily
    socket.on('unpair-scanner', (data: { sessionId: string }, callback?: (res: { success: boolean }) => void) => {
      const { sessionId } = data;
      const session = sessions.get(sessionId);

      if (session && session.scannerSocketId === socket.id) {
        session.scannerSocketId = null;
        socket.leave(`session_${sessionId}`);
        socketToRole.delete(socket.id);
        console.log(`[Socket.IO] Scanner unpaired from session ${sessionId}`);

        // Notify terminal
        io.to(session.terminalSocketId).emit('scanner-unpaired', { reason: 'scanner_left' });
      }

      if (callback) callback({ success: true });
    });

    // 4. Terminal Kicks / Disconnects Scanner
    socket.on(
      'terminal-kick-scanner',
      (
        data: { sessionId: string; authKey: string; newAuthKey?: string },
        callback?: (res: { success: boolean; newAuthKey?: string }) => void
      ) => {
        const { sessionId, authKey, newAuthKey } = data;
        const session = sessions.get(sessionId);

        if (session && session.authKey === authKey) {
          if (session.scannerSocketId) {
            io.to(session.scannerSocketId).emit('force-disconnected', {
              message: `Disconnected by ${session.terminalName}.`,
            });
            session.scannerSocketId = null;
          }

          if (newAuthKey) {
            session.authKey = newAuthKey;
          }

          socket.emit('scanner-unpaired', { reason: 'terminal_kicked' });
          console.log(`[Socket.IO] Terminal ${session.terminalName} disconnected scanner.`);

          if (callback) callback({ success: true, newAuthKey: session.authKey });
        } else {
          if (callback) callback({ success: false });
        }
      }
    );

    // 5. Secure Barcode Scanning (Protected by Session ID & Auth Key)
    socket.on(
      'scan-barcode',
      async (
        data: { barcode: string; sessionId: string; authKey?: string },
        callback?: (res: { success: boolean; productName?: string; sellingPrice?: any; stock?: number; error?: string; barcode?: string }) => void
      ) => {
        try {
          const { barcode, sessionId, authKey } = data;
          const cleanBarcode = barcode?.trim();

          if (!cleanBarcode) {
            if (callback) callback({ success: false, error: 'Empty barcode' });
            return;
          }

          const session = sessions.get(sessionId);
          // Verify session exists and authKey matches
          if (!session) {
            if (callback) callback({ success: false, error: 'Unrecognized terminal session.' });
            return;
          }

          if (authKey && session.authKey !== authKey) {
            if (callback) callback({ success: false, error: 'Authentication key mismatch.' });
            return;
          }

          console.log(`[Socket.IO] [${session.terminalName}] Barcode scanned: "${cleanBarcode}"`);

          // Look up product in MySQL via Prisma
          const product = await prisma.product.findUnique({
            where: { barcode: cleanBarcode },
          });

          if (product) {
            // Send ONLY to this terminal's socket
            io.to(session.terminalSocketId).emit('barcode-received', {
              found: true,
              barcode: cleanBarcode,
              product,
              timestamp: new Date().toISOString(),
            });

            if (callback) {
              callback({
                success: true,
                productName: product.name,
                sellingPrice: product.sellingPrice,
                stock: product.stockQuantity,
              });
            }
          } else {
            // Product not found in catalog
            io.to(session.terminalSocketId).emit('barcode-received', {
              found: false,
              barcode: cleanBarcode,
              timestamp: new Date().toISOString(),
            });

            if (callback) {
              callback({
                success: false,
                error: 'Product not found in catalog',
                barcode: cleanBarcode,
              });
            }
          }
        } catch (error: any) {
          console.error('[Socket.IO] Error processing scan:', error);
          if (callback) callback({ success: false, error: 'Server error processing scan' });
        }
      }
    );

    // 6. Sync Cart Summary ONLY to paired scanner
    socket.on('update-cart-summary', (data: { count: number; total: number; sessionId: string }) => {
      const { sessionId, count, total } = data;
      const session = sessions.get(sessionId);
      if (session && session.scannerSocketId) {
        io.to(session.scannerSocketId).emit('cart-summary-updated', { count, total });
      }
    });

    // 7. Backward Compatibility: Legacy join-session
    socket.on('join-session', (sessionId: string = 'main-pos') => {
      socket.join(sessionId);
    });

    // 8. Client Disconnect
    socket.on('disconnect', () => {
      const info = socketToRole.get(socket.id);
      if (info) {
        const { sessionId, role } = info;
        const session = sessions.get(sessionId);

        if (session) {
          if (role === 'scanner' && session.scannerSocketId === socket.id) {
            session.scannerSocketId = null;
            io.to(session.terminalSocketId).emit('scanner-unpaired', { reason: 'network_lost' });
            console.log(`[Socket.IO] Scanner disconnected from ${session.terminalName}`);
          } else if (role === 'terminal' && session.terminalSocketId === socket.id) {
            if (session.scannerSocketId) {
              io.to(session.scannerSocketId).emit('terminal-status', { connected: false });
            }
            console.log(`[Socket.IO] Terminal ${session.terminalName} disconnected`);
          }
        }

        socketToRole.delete(socket.id);
      }
    });
  });
}

