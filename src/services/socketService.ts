// Socket.IO client — same event contract as the Capacitor app.
// Connects with JWT auth, auto-reconnects, refreshes token on auth error.

import { io, Socket } from 'socket.io-client';
import { API_URL, storage } from './api';

class SocketService {
  private socket: Socket | null = null;

  connect() {
    if (this.socket?.connected) return;

    const token = storage.getString('accessToken');
    if (!token) return;

    this.socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    this.socket.on('connect', () => {
      console.log('[socket] connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected:', reason);
    });

    this.socket.on('connect_error', async (err) => {
      console.warn('[socket] connect error:', err.message);
      // If the token is expired, try refreshing
      if (err.message === 'Invalid token' || err.message === 'Authentication required') {
        try {
          const refreshToken = storage.getString('refreshToken');
          if (!refreshToken) return;
          const res = await fetch(`${API_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          if (res.ok) {
            const data = await res.json();
            storage.set('accessToken', data.accessToken);
            storage.set('refreshToken', data.refreshToken);
            // Reconnect with fresh token
            if (this.socket) {
              this.socket.auth = { token: data.accessToken };
              this.socket.connect();
            }
          }
        } catch {
          console.warn('[socket] token refresh failed');
        }
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  emit(event: string, data?: unknown) {
    this.socket?.emit(event, data);
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback);
  }
}

export default new SocketService();
