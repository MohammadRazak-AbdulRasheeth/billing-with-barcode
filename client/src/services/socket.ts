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

export const SESSION_ID = 'main-pos';

export function joinPosSession() {
  if (socket.connected) {
    socket.emit('join-session', SESSION_ID);
  } else {
    socket.once('connect', () => {
      socket.emit('join-session', SESSION_ID);
    });
  }
}
