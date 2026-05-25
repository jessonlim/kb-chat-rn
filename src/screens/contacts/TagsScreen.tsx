// Tags list screen — shows all user-created tags with member counts.
// Tap a tag to view its members. Tap "+" to create a new tag.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tagsStore, useTagsSnapshot } from '../../stores/tagsStore';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';

interface Props {
  navigation: any;
}

const TagsScreen = ({ navigation }: Props) => {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tagMap = useTagsSnapshot();
  const tags = useMemo(
    () => Object.keys(tagMap).sort((a, b) => a.localeCompare(b)),
    [tagMap]
  );

  const [creating, setCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const handleCreate = () => {
    const trimmed = newTagName.trim();
    if (!trimmed) {
      setCreating(false);
      return;
    }
    tagsStore.createTag(trimmed);
    setNewTagName('');
    setCreating(false);
  };

  const handleDelete = (tag: string) => {
    Alert.alert(t('common.delete'), tag, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => tagsStore.deleteTag(tag),
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={tags}
        keyExtractor={(tag) => tag}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="pricetags-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>{t('tag.empty')}</Text>
          </View>
        }
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.addRow}
            activeOpacity={0.7}
            onPress={() => setCreating(true)}
          >
            <View style={styles.addIcon}>
              <Ionicons name="add" size={22} color={colors.primary} />
            </View>
            <Text style={styles.addText}>{t('tag.add')}</Text>
          </TouchableOpacity>
        }
        renderItem={({ item: tag }) => {
          const count = (tagMap[tag] || []).length;
          return (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              onLongPress={() => handleDelete(tag)}
            >
              <Ionicons name="pricetag" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.tagName} numberOfLines={1}>
                  {tag}
                </Text>
                <Text style={styles.tagCount}>{t('tag.contactsInTag', { n: count })}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          );
        }}
      />

      {/* New tag modal */}
      <Modal visible={creating} transparent animationType="fade" onRequestClose={() => setCreating(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCreating(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{t('tag.add')}</Text>
            <TextInput
              style={styles.modalInput}
              autoFocus
              value={newTagName}
              onChangeText={setNewTagName}
              placeholder={t('tag.placeholder')}
              placeholderTextColor={colors.textMuted}
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setCreating(false)} activeOpacity={0.7}>
                <Text style={styles.modalCancel}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate} activeOpacity={0.7}>
                <Text style={styles.modalSave}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bgDark,
    },
    empty: {
      alignItems: 'center',
      paddingTop: spacing.xxl * 2,
      gap: spacing.md,
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: fontSize.sm,
      textAlign: 'center',
      paddingHorizontal: spacing.xl,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.bgCard,
      marginBottom: spacing.sm,
    },
    addIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.bgInput,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addText: {
      flex: 1,
      fontSize: fontSize.md,
      color: colors.primary,
      fontWeight: '500',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      backgroundColor: colors.bgCard,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    tagName: {
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    tagCount: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
      marginTop: 2,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    modalCard: {
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      width: '100%',
      maxWidth: 400,
      gap: spacing.md,
    },
    modalTitle: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    modalInput: {
      backgroundColor: colors.bgInput,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.lg,
    },
    modalCancel: {
      fontSize: fontSize.md,
      color: colors.textMuted,
    },
    modalSave: {
      fontSize: fontSize.md,
      color: colors.primary,
      fontWeight: '600',
    },
  });

export default TagsScreen;
