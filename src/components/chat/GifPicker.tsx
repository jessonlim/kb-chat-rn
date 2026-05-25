// Tenor-backed GIF picker. Shows trending GIFs by default, with a search
// bar that hits Tenor's free v2 API. Picking a GIF returns its `tinygif`
// URL (smaller, plays inline as a regular image source).
//
// API key: Tenor offers a free Google API key with generous quota. We
// route the request through the backend `/api/gifs?q=...` proxy so we
// don't have to ship the key in the app. If the proxy isn't available
// the picker shows an error state but doesn't crash the chat.

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../i18n/I18nContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';

interface GifResult {
  id: string;
  url: string;      // tinygif URL — playable directly in <Image>
  width: number;
  height: number;
  preview?: string; // smaller preview, optional
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (gif: GifResult) => void;
}

const GifPicker = ({ visible, onClose, onPick }: Props) => {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGifs = useCallback(
    async (q: string) => {
      setLoading(true);
      setError(null);
      try {
        const path = q.trim()
          ? `/api/gifs?q=${encodeURIComponent(q.trim())}&limit=24`
          : `/api/gifs?trending=1&limit=24`;
        const res = await fetch(`${API_URL}${path}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setResults(data.results || []);
      } catch (err: any) {
        setError(t('gif.loadError'));
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  // Initial load when opened — trending GIFs
  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      return;
    }
    fetchGifs('');
  }, [visible, fetchGifs]);

  // Debounce search
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => fetchGifs(query), 350);
    return () => clearTimeout(id);
  }, [query, visible, fetchGifs]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{t('gif.title')}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={t('gif.searchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ paddingVertical: spacing.xl }} />
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(g) => g.id}
              numColumns={2}
              contentContainerStyle={styles.grid}
              ListEmptyComponent={<Text style={styles.empty}>{t('gif.noResults')}</Text>}
              ListHeaderComponent={
                !query.trim() ? <Text style={styles.sectionLabel}>{t('gif.trending')}</Text> : null
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.cell}
                  activeOpacity={0.7}
                  onPress={() => {
                    onPick(item);
                    onClose();
                  }}
                >
                  <Image
                    source={{ uri: item.url }}
                    style={[styles.gif, { aspectRatio: item.width / item.height || 1 }]}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
      maxHeight: '75%',
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
    },
    title: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.bgInput,
      borderRadius: borderRadius.md,
      height: 40,
    },
    searchInput: {
      flex: 1,
      fontSize: fontSize.md,
      color: colors.textPrimary,
      height: '100%',
    },
    grid: {
      padding: spacing.sm,
    },
    sectionLabel: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSize.xs,
      color: colors.textMuted,
      textTransform: 'uppercase',
    },
    cell: {
      flex: 1 / 2,
      padding: spacing.xs,
    },
    gif: {
      width: '100%',
      borderRadius: borderRadius.sm,
      backgroundColor: colors.bgInput,
    },
    empty: {
      textAlign: 'center',
      color: colors.textMuted,
      paddingVertical: spacing.lg,
    },
    error: {
      textAlign: 'center',
      color: colors.danger,
      paddingVertical: spacing.lg,
    },
  });

export default GifPicker;
