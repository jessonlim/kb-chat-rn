import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useMediaUrl } from '../../hooks/useMediaUrl';

interface Props {
  name: string;
  src?: string;
  size?: number;
  online?: boolean;
}

// Generate a consistent color from a name string
const getColor = (name: string): string => {
  const palette = [
    '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#14b8a6',
    '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#06b6d4',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
};

const Avatar = ({ name, src, size = 48, online }: Props) => {
  const { colors } = useTheme();
  // useMediaUrl handles every URL flavour the backend can throw at us:
  //   - http(s):// — use directly
  //   - s3://      — async fetch a signed S3 URL (memoised)
  //   - /uploads/  — prefix with API_URL
  //   - file:// / content:// / data: / ph:// — pass through to Image
  const { uri: resolvedUri } = useMediaUrl(src);
  const uri = resolvedUri || '';
  const initials = (name || '?')[0].toUpperCase();
  const bg = getColor(name || '?');
  // If the resolved image URL fails to load (404, network, etc.), fall back
  // to the coloured-initial bubble.
  const [imageFailed, setImageFailed] = useState(false);
  // Reset failure when the URI changes (user picked a new avatar / it loaded)
  useEffect(() => { setImageFailed(false); }, [uri]);

  const showImage = !!uri && !imageFailed;

  return (
    <View style={{ width: size, height: size }}>
      {showImage ? (
        // key={uri} mounts a fresh Image on each URI change so a stale
        // onError from the previous source can't flip imageFailed.
        <Image
          key={uri}
          source={{ uri }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
          <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials}</Text>
        </View>
      )}
      {online !== undefined && (
        <View
          style={[
            styles.dot,
            {
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: size * 0.14,
              backgroundColor: online ? colors.online : colors.offline,
              borderWidth: 2,
              borderColor: colors.bgDark,
              right: 0,
              bottom: 0,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '700',
  },
  dot: {
    position: 'absolute',
  },
});

export default Avatar;
