import { io, Socket } from 'socket.io-client';

// In development, Vite proxy routes /socket.io to backend port 5001.
// In mobile or production, we connect to current host origin.
const SOCKET_URL = window.location.origin;

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling'],
});

export interface TerminalSessionInfo {
  sessionId: string;
  authKey: string;
  terminalName: string;
}

// Generates a secure, human-friendly 6-character alphanumeric key (e.g. K8M2P4)
export function generateAuthKey(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const STORAGE_KEY = 'pos_terminal_auth_session';

// Returns or initializes persistent terminal session for this display/browser
export function getTerminalSession(): TerminalSessionInfo {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.sessionId && parsed.authKey) {
        return parsed;
      }
    }
  } catch (e) {
    // Ignore storage parse error
  }

  // Create new session
  const newSession: TerminalSessionInfo = {
    sessionId: 'term_' + Math.random().toString(36).substring(2, 9),
    authKey: generateAuthKey(),
    terminalName: 'Counter 1',
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
  } catch (e) {}

  return newSession;
}

export function saveTerminalSession(session: TerminalSessionInfo) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (e) {}
}

export function regenerateTerminalKey(): TerminalSessionInfo {
  const current = getTerminalSession();
  const updated: TerminalSessionInfo = {
    ...current,
    authKey: generateAuthKey(),
  };
  saveTerminalSession(updated);
  return updated;
}

export function updateTerminalName(name: string): TerminalSessionInfo {
  const current = getTerminalSession();
  const updated: TerminalSessionInfo = {
    ...current,
    terminalName: name.trim() || 'Counter 1',
  };
  saveTerminalSession(updated);
  return updated;
}

// Terminal registers with backend
export function registerTerminalOnServer(
  session: TerminalSessionInfo,
  callback?: (res: { success: boolean; isPaired: boolean; terminalName: string }) => void
) {
  if (socket.connected) {
    socket.emit('register-terminal', session, callback);
  } else {
    socket.once('connect', () => {
      socket.emit('register-terminal', session, callback);
    });
  }
}

// Legacy helper for backward compatibility
export const SESSION_ID = 'main-pos';
export function joinPosSession() {
  const term = getTerminalSession();
  registerTerminalOnServer(term);
}

