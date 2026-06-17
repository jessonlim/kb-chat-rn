// Edit an existing channel — owner-only. Lets the owner change the channel
// avatar + description (the name is fixed at creation, mirroring CreateChannel).
// Calls channelService.update (PUT /channels/:id), which the backend owner-gates.

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import channelService from '../../services/channelService';
import { uploadFile } from '../../services/uploadService';
import { compressImage } from '../../utils/imageCompression';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';

interface Props {
  navigation: any;
  route: { params: { channelId: string; name?: string; description?: string; avatar?: string } };
}

const EditChannelScreen = ({ navigation, route }: Props) => {
  const { channelId, name = '', description: initialDesc = '', avatar: initialAvatar = '' } = route.params;
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [description, setDescription] = useState(initialDesc);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [avatarLocalUri, setAvatarLocalUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setAvatarLocalUri(asset.uri);
      setUploading(true);
      try {
        let fileUri = asset.uri;
        const fileName = asset.fileName || 'channel-avatar.jpg';
        const mimeType = asset.mimeType || 'image/jpeg';
        try {
          const compressed = await compressImage(fileUri);
          fileUri = compressed.uri;
        } catch {
          // Use original if compression fails
        }
        const uploaded = await uploadFile(fileUri, fileName, mimeType);
        setAvatarUrl(uploaded.url);
      } catch (err) {
        console.warn('Avatar upload failed:', err);
        Alert.alert(t('common.failed'), t('attach.uploadFailed'));
        setAvatarLocalUri(null);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleSave = async () => {
    if (uploading) {
      Alert.alert(t('common.failed'), t('attach.waitForUpload'));
      return;
    }
    setSubmitting(true);
    try {
      await channelService.update(channelId, {
        description: description.trim(),
        avatar: avatarUrl || undefined,
      });
      Toast.show({ type: 'success', text1: t('channels.edit.success') });
      navigation.goBack();
    } catch (err: any) {
      Alert.alert(
        t('common.failed'),
        err?.response?.data?.message || t('channels.create.failed')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar */}
        <TouchableOpacity
          style={styles.avatarWrapper}
          activeOpacity={0.7}
          onPress={handlePickAvatar}
          disabled={uploading || submitting}
        >
          <Avatar
            name={name || '?'}
            src={avatarLocalUri || avatarUrl || undefined}
            size={100}
          />
          <View style={styles.cameraIcon}>
            {uploading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="camera" size={18} color="#fff" />
            )}
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>{t('channels.create.avatar')}</Text>

        {/* Name (read-only — can't change after creation) */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('channels.create.nameLabel')}</Text>
          <View style={[styles.input, styles.inputDisabled]}>
            <Text style={styles.disabledText}>{name}</Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('channels.create.descLabel')}</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            placeholder={t('channels.create.descPlaceholder')}
            placeholderTextColor={colors.textMuted}
            maxLength={500}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length}/500</Text>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.createButton, (submitting || uploading) && styles.createButtonDisabled]}
          activeOpacity={0.7}
          onPress={handleSave}
          disabled={submitting || uploading}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>{t('channels.edit.save')}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: 32, paddingBottom: 40 },
  avatarWrapper: { position: 'relative' },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bgDark,
  },
  avatarHint: { fontSize: fontSize.sm, color: colors.primary, marginTop: spacing.sm, marginBottom: spacing.xxl },
  field: { width: '100%', marginBottom: spacing.xl },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputDisabled: { opacity: 0.6 },
  disabledText: { fontSize: fontSize.md, color: colors.textSecondary },
  inputMultiline: { minHeight: 80, paddingTop: 14 },
  charCount: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'right', marginTop: spacing.xs },
  createButton: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 48,
  },
  createButtonDisabled: { opacity: 0.5 },
  createButtonText: { color: '#fff', fontSize: fontSize.lg, fontWeight: '600' },
});

export default EditChannelScreen;
