// Call service — ICE server fetch with 5-min cache.
// Uses the same endpoint as the Capacitor app.

import api from './api';

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

// ── Fallback STUN servers (free Google STUN) ───────────────────────
const FALLBACK_ICE: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

// ── 5-minute cache ──────────────────────────────────────────────────
let cachedServers: IceServer[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const callService = {
  /**
   * Fetch ICE/TURN servers from backend, with 5-min cache.
   * Falls back to free Google STUN if fetch fails.
   */
  async getIceServers(): Promise<IceServer[]> {
    const now = Date.now();
    if (cachedServers && now - cacheTimestamp < CACHE_TTL) {
      return cachedServers;
    }

    try {
      const { data } = await api.get('/api/agora-calls/ice-servers');
      const servers: IceServer[] = data.iceServers || data.servers || [];
      if (servers.length > 0) {
        cachedServers = servers;
        cacheTimestamp = now;
        return servers;
      }
    } catch (err) {
      console.warn('[call] Failed to fetch ICE servers, using fallback:', err);
    }

    cachedServers = FALLBACK_ICE;
    cacheTimestamp = now;
    return FALLBACK_ICE;
  },

  /** Clear cached servers (useful on logout) */
  clearCache() {
    cachedServers = null;
    cacheTimestamp = 0;
  },
};

export default callService;
