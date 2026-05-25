// Socket.IO client — same event contract as the Capacitor app.
// Connects with JWT auth, auto-reconnects, refreshes token on auth error.

import { io, Socket } from 'socket.io-client';
import { API_URL, storage } from './api';

class SocketService {
  private socket: Socket | null = null;
  // Multi-call protection: connect() is invoked from multiple authStore
  // entry points. We don't want to abandon a still-connecting socket and
  // open a second one. So we also gate against the connecting state.
  private connecting = false;

  connect() {
    if (this.socket?.connected || this.connecting) return;

    const token = storage.getString('accessToken');
    if (!token) return;

    this.connecting = true;

    // Build #15 regression: some testers report send_message ack never
    // returns. The previous build used `transports: ['websocket']` which
    // is faster but fails silently on networks that block WebSocket (some
    // ISPs, captive portals, corporate VPNs). Allow polling fallback so
    // socket.io can negotiate whichever transport actually works.
    this.socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20_000,
    });

    this.socket.on('connect', () => {
      this.connecting = false;
      console.log('[socket] connected', this.socket?.io.engine.transport.name);
    });

    this.socket.on('disconnect', (reason) => {
      this.connecting = false;
      console.log('[socket] disconnected:', reason);
    });

    this.socket.on('connect_error', async (err) => {
      this.connecting = false;
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
