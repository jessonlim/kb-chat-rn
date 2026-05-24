// SharedMediaScreen — grid of all photos + videos in a chat.
// Accessed from ChatInfo → "Photos and Videos".
//
// Backend returns Message objects (type 'image' or 'video') with
// attachments[]. We extract the first attachment of each and lay them
// out in a 3-column grid. Tap → open ImageViewer.

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import chatService from '../../services/chatService';
import ImageViewer from '../../components/chat/ImageViewer';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize } from '../../utils/theme';
import type { Message } from '../../types';

interface Props {
  route: { params: { chatId: string } };
}

const COLS = 3;
const GUTTER = 2;
const TILE = (Dimensions.get('window').width - GUTTER * (COLS + 1)) / COLS;

const SharedMediaScreen = ({ route }: Props) => {
  const { chatId } = route.params;
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [items, setItems] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { messages } = await chatService.listMediaInChat(chatId, { limit: 100 });
      setItems(messages);
    } catch (err) {
      console.warn('Failed to load shared media:', err);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="images-outline" size={64} color={colors.textMuted} />
        <Text style={styles.emptyText}>{t('media.empty')}</Text>
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={styles.container}
        data={items}
        keyExtractor={(m) => m._id}
        numColumns={COLS}
        contentContainerStyle={{ padding: GUTTER }}
        columnWrapperStyle={{ gap: GUTTER }}
        ItemSeparatorComponent={() => <View style={{ height: GUTTER }} />}
        renderItem={({ item }) => {
          const att = item.attachments?.[0];
          if (!att) return null;
          const isVideo = item.type === 'video';
          return (
            <TouchableOpacity
              style={styles.tile}
              activeOpacity={0.7}
              onPress={() => {
                if (!isVideo) setViewerUri(att.url);
                // For video, ideally open a video player. Skip for now.
              }}
            >
              <Image source={{ uri: att.url }} style={styles.thumb} />
              {isVideo && (
                <View style={styles.videoOverlay}>
                  <Ionicons name="play-circle" size={28} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      <ImageViewer
        visible={!!viewerUri}
        uri={viewerUri}
        onClose={() => setViewerUri(null)}
      />
    </>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  center: { alignItems: 'center', justifyContent: 'center' },
  tile: {
    width: TILE,
    height: TILE,
    backgroundColor: colors.bgCard,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
    marginTop: spacing.lg,
  },
});

export default SharedMediaScreen;
