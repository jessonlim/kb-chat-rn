import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { API_URL } from '../../services/api';

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

const resolveUri = (src: string): string => {
  if (!src) return '';
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  // s3:// paths would need signed URL resolution — skip for now
  if (src.startsWith('s3://')) return '';
  // Local path — prefix with API URL
  return `${API_URL}${src}`;
};

const Avatar = ({ name, src, size = 48, online }: Props) => {
  const { colors } = useTheme();
  const uri = src ? resolveUri(src) : '';
  const initials = (name || '?')[0].toUpperCase();
  const bg = getColor(name || '?');
  // If the image URL 404s (old avatar pointing at a deleted file), fall back
  // to the coloured-initial bubble instead of showing nothing.
  const [imageFailed, setImageFailed] = useState(false);
  // Reset the failure flag when the URL changes (user uploaded a new avatar)
  useEffect(() => { setImageFailed(false); }, [uri]);
  // Debug — log every time we get a new URI so we can see what's coming through
  useEffect(() => {
    if (uri) console.log('[Avatar] uri:', uri);
  }, [uri]);

  const showImage = !!uri && !imageFailed;

  return (
    <View style={{ width: size, height: size }}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
          onError={(e) => {
            console.warn('[Avatar] image failed to load:', uri, e?.nativeEvent);
            setImageFailed(true);
          }}
          onLoad={() => console.log('[Avatar] image loaded:', uri)}
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
