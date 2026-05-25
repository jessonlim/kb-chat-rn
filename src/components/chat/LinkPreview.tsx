// Inline Open-Graph card rendered below text messages that contain a URL.
//
// We extract the first http(s) URL from the message content, then fetch
// `{API_URL}/api/og?url=...` which is expected to return `{title, description, image, siteName}`.
// If that backend endpoint isn't ready (404/500) we silently render the bare URL
// as a fallback — no error UI clutters the chat.
//
// Results are cached in MMKV for 24h so the preview is instant on re-render.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL, storage } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';

interface OG {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url: string;
}

// Match a single http(s) URL — first match wins.
const URL_RE = /\bhttps?:\/\/[^\s<>"']+/i;

export const extractUrl = (text: string | undefined | null): string | null => {
  if (!text) return null;
  const m = text.match(URL_RE);
  return m ? m[0] : null;
};

const CACHE_KEY = 'cache.openGraph.v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry = { data: OG | null; expiresAt: number };
let mem: Record<string, CacheEntry> | null = null;

const loadCache = () => {
  if (mem) return mem;
  try {
    const raw = storage.getString(CACHE_KEY);
    mem = raw ? (JSON.parse(raw) as Record<string, CacheEntry>) : {};
  } catch {
    mem = {};
  }
  return mem!;
};

const writeCache = (url: string, entry: CacheEntry) => {
  const cache = loadCache();
  cache[url] = entry;
  try {
    storage.set(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
};

interface Props {
  url: string;
  isOwn: boolean;
}

const LinkPreview = ({ url, isOwn }: Props) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isOwn), [colors, isOwn]);
  const [og, setOg] = useState<OG | null>(null);

  useEffect(() => {
    let alive = true;

    const cache = loadCache();
    const cached = cache[url];
    if (cached && cached.expiresAt > Date.now()) {
      setOg(cached.data);
      return;
    }

    // Fire-and-forget — backend may not have /api/og yet, that's OK.
    fetch(`${API_URL}/api/og?url=${encodeURIComponent(url)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: OG | null) => {
        if (!alive) return;
        const normalised = data ? { ...data, url } : null;
        setOg(normalised);
        writeCache(url, { data: normalised, expiresAt: Date.now() + CACHE_TTL_MS });
      })
      .catch(() => {
        if (alive) {
          setOg(null);
          writeCache(url, { data: null, expiresAt: Date.now() + CACHE_TTL_MS });
        }
      });

    return () => {
      alive = false;
    };
  }, [url]);

  if (!og || (!og.title && !og.description && !og.image)) {
    // Nothing pretty to show — leave the bare URL in the bubble text.
    return null;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => Linking.openURL(url)}
      style={styles.wrap}
    >
      {og.image && (
        <Image source={{ uri: og.image }} style={styles.image} resizeMode="cover" />
      )}
      <View style={styles.textWrap}>
        {og.siteName && (
          <Text style={styles.site} numberOfLines={1}>
            {og.siteName}
          </Text>
        )}
        {og.title && (
          <Text style={styles.title} numberOfLines={2}>
            {og.title}
          </Text>
        )}
        {og.description && (
          <Text style={styles.desc} numberOfLines={2}>
            {og.description}
          </Text>
        )}
      </View>
      <View style={styles.openIcon}>
        <Ionicons name="open-outline" size={14} color={isOwn ? '#fff' : colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors'], isOwn: boolean) =>
  StyleSheet.create({
    wrap: {
      marginTop: spacing.xs,
      borderRadius: borderRadius.sm,
      overflow: 'hidden',
      backgroundColor: isOwn ? 'rgba(255,255,255,0.12)' : colors.bgInput,
      maxWidth: 260,
    },
    image: {
      width: '100%',
      height: 120,
      backgroundColor: 'rgba(0,0,0,0.2)',
    },
    textWrap: {
      padding: spacing.sm,
    },
    site: {
      fontSize: 10,
      color: isOwn ? 'rgba(255,255,255,0.7)' : colors.textMuted,
      marginBottom: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    title: {
      fontSize: fontSize.sm,
      fontWeight: '700',
      color: isOwn ? '#fff' : colors.textPrimary,
    },
    desc: {
      fontSize: fontSize.xs,
      color: isOwn ? 'rgba(255,255,255,0.85)' : colors.textSecondary,
      marginTop: 2,
    },
    openIcon: {
      position: 'absolute',
      right: 6,
      top: 6,
      backgroundColor: 'rgba(0,0,0,0.35)',
      borderRadius: 10,
      padding: 4,
    },
  });

export default LinkPreview;
