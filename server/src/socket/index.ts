import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '../db';

export function setupSocketIO(io: SocketIOServer) {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Join POS session room
    socket.on('join-session', (sessionId: string = 'main-pos') => {
      socket.join(sessionId);
      console.log(`[Socket.IO] Client ${socket.id} joined session: ${sessionId}`);

      // Notify other clients in the room that a scanner or terminal connected
      socket.to(sessionId).emit('peer-joined', { socketId: socket.id });
    });

    // Handle barcode scanned from mobile camera
    socket.on('scan-barcode', async (data: { barcode: string; sessionId?: string }, callback) => {
      try {
        const { barcode, sessionId = 'main-pos' } = data;
        const cleanBarcode = barcode?.trim();

        if (!cleanBarcode) {
          if (callback) callback({ success: false, error: 'Empty barcode' });
          return;
        }

        console.log(`[Socket.IO] Barcode scanned: "${cleanBarcode}" for session: ${sessionId}`);

        // Look up product in MySQL via Prisma
        const product = await prisma.product.findUnique({
          where: { barcode: cleanBarcode },
        });

        if (product) {
          // Send to all clients in the session room (including the laptop billing terminal)
          io.to(sessionId).emit('barcode-received', {
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
          // Product not found in database
          io.to(sessionId).emit('barcode-received', {
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
    });

    // Sync active cart summary from laptop to mobile scanner
    socket.on('update-cart-summary', (data: { count: number; total: number; sessionId?: string }) => {
      const { sessionId = 'main-pos' } = data;
      socket.to(sessionId).emit('cart-summary-updated', data);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });
}
