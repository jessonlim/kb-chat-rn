// Socket.IO client — same event contract as the Capacitor app.
// Connects with JWT auth, auto-reconnects, refreshes token on auth error.

import { io, Socket } from 'socket.io-client';
import Toast from 'react-native-toast-message';
import { API_URL, storage } from './api';

// Diagnostic toasts kept off by default. Flip to true if a tester
// reports send_message stuck and you need to see socket lifecycle
// on-device. (Confirmed root cause was network blocking WebSocket;
// polling-first config keeps the connection alive on any network.)
const SHOW_SOCKET_DEBUG = false;
const debugToast = (text1: string, text2?: string, type: 'info' | 'success' | 'error' = 'info') => {
  if (!SHOW_SOCKET_DEBUG) return;
  Toast.show({ type, text1, text2, position: 'top', visibilityTime: 2500 });
};

class SocketService {
  private socket: Socket | null = null;
  // Multi-call protection: connect() is invoked from multiple authStore
  // entry points. We don't want to abandon a still-connecting socket and
  // open a second one. So we also gate against the connecting state.
  private connecting = false;

  connect() {
    if (this.socket?.connected || this.connecting) return;

    const token = storage.getString('accessToken');
    if (!token) {
      debugToast('Socket: no token', 'Skip connect', 'error');
      return;
    }

    this.connecting = true;
    debugToast('Socket: connecting…', `to ${API_URL}`);

    // Use socket.io's default transport negotiation: start with HTTP
    // long-polling (works on essentially every network) and then upgrade
    // to WebSocket if the network allows it. Our previous config of
    // ['websocket', 'polling'] was misleading — that order tries WS
    // first and does NOT actually fall back to polling on failure, which
    // is why testers on certain networks saw the connection hang forever
    // with a "websocket error". Polling-first is the textbook fix.
    this.socket = io(API_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 20_000,
    });

    this.socket.on('connect', () => {
      this.connecting = false;
      const transport = this.socket?.io.engine.transport.name;
      console.log('[socket] connected', transport);
      debugToast('✅ Socket connected', `via ${transport}`, 'success');
    });

    this.socket.on('disconnect', (reason) => {
      this.connecting = false;
      console.log('[socket] disconnected:', reason);
      debugToast('⚠️ Socket disconnected', reason, 'error');
    });

    this.socket.on('connect_error', async (err) => {
      this.connecting = false;
      console.warn('[socket] connect error:', err.message);
      debugToast('❌ Socket error', err.message, 'error');
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
