// Attachment menu — bottom sheet that appears when tapping the "+" button.
// Options: Photo Library, Camera, Video, Document.

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../i18n/I18nContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import { compressImage } from '../../utils/imageCompression';
import { uploadFile, type UploadResult } from '../../services/uploadService';
import type { Attachment } from '../../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAttachmentReady: (
    type: 'image' | 'video' | 'audio' | 'file',
    attachments: Attachment[]
  ) => void;
  // New: requests that the parent open the location picker (because this
  // sheet doesn't know which chat it's sending to)
  onPickLocation?: () => void;
  onPickContact?: () => void;
  onPickSticker?: () => void;
  onPickGif?: () => void;
  // Group voice/video call — shown only in group chats (moved here from the
  // header so the call icons don't crowd the group name, WeChat-style).
  isGroup?: boolean;
  onGroupCall?: (type: 'voice' | 'video') => void;
}

interface MenuOption {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const AttachmentMenu = ({
  visible,
  onClose,
  onAttachmentReady,
  onPickLocation,
  onPickContact,
  onPickSticker,
  onPickGif,
  isGroup,
  onGroupCall,
}: Props) => {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const OPTIONS: MenuOption[] = [
    ...(isGroup && onGroupCall
      ? [{
          key: 'groupcall',
          label: t('groupCall.title'),
          icon: 'call-outline' as keyof typeof Ionicons.glyphMap,
          color: '#f43f5e',
        }]
      : []),
    { key: 'gallery', label: t('attach.photosVideos'), icon: 'images-outline', color: '#a78bfa' },
    { key: 'camera', label: t('attach.camera'), icon: 'camera-outline', color: '#22c55e' },
    { key: 'video', label: t('camera.video'), icon: 'videocam-outline', color: '#f59e0b' },
    { key: 'document', label: t('attach.document'), icon: 'document-outline', color: '#3b82f6' },
    { key: 'location', label: t('location.title'), icon: 'location-outline', color: '#ef4444' },
    { key: 'contact', label: t('contactCard.preview'), icon: 'person-outline', color: '#06b6d4' },
    { key: 'sticker', label: t('sticker.title'), icon: 'happy-outline', color: '#ec4899' },
    { key: 'gif', label: t('gif.title'), icon: 'film-outline', color: '#10b981' },
  ];
  const requestPermission = async (
    type: 'camera' | 'library'
  ): Promise<boolean> => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is required to take photos.');
        return false;
      }
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Photo library access is required.');
        return false;
      }
    }
    return true;
  };

  const handleUploadAndSend = async (
    fileUri: string,
    fileName: string,
    mimeType: string,
    msgType: 'image' | 'video' | 'audio' | 'file'
  ) => {
    try {
      const result: UploadResult = await uploadFile(fileUri, fileName, mimeType);
      const attachment: Attachment = {
        url: result.url,
        type: result.type || mimeType,
        name: result.name || fileName,
        size: result.size || 0,
      };
      onAttachmentReady(msgType, [attachment]);
    } catch (err: any) {
      Alert.alert('Upload failed', err.message || 'Could not upload file.');
    }
  };

  const handleGallery = async () => {
    onClose();
    const ok = await requestPermission('library');
    if (!ok) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit: 10,
    });

    if (result.canceled || result.assets.length === 0) return;

    // Process each selected image
    for (const asset of result.assets) {
      const compressed = await compressImage(asset.uri);
      const fileName = asset.fileName || `photo_${Date.now()}.jpg`;
      await handleUploadAndSend(compressed.uri, fileName, 'image/jpeg', 'image');
    }
  };

  const handleCamera = async () => {
    onClose();
    const ok = await requestPermission('camera');
    if (!ok) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 1,
    });

    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    const compressed = await compressImage(asset.uri);
    const fileName = `camera_${Date.now()}.jpg`;
    await handleUploadAndSend(compressed.uri, fileName, 'image/jpeg', 'image');
  };

  const handleVideo = async () => {
    onClose();
    const ok = await requestPermission('library');
    if (!ok) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 0.7,
      videoMaxDuration: 120, // 2 min limit
    });

    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    const fileName = asset.fileName || `video_${Date.now()}.mp4`;
    const mimeType = asset.mimeType || 'video/mp4';
    await handleUploadAndSend(asset.uri, fileName, mimeType, 'video');
  };

  const handleDocument = async () => {
    onClose();

    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) return;

    const asset = result.assets[0];
    const fileName = asset.name || `file_${Date.now()}`;
    const mimeType = asset.mimeType || 'application/octet-stream';
    await handleUploadAndSend(asset.uri, fileName, mimeType, 'file');
  };

  const handleOptionPress = (key: string) => {
    switch (key) {
      case 'groupcall':
        onClose();
        Alert.alert(t('groupCall.title'), undefined, [
          { text: t('chat.voiceCall'), onPress: () => onGroupCall?.('voice') },
          { text: t('chat.videoCall'), onPress: () => onGroupCall?.('video') },
          { text: t('common.cancel'), style: 'cancel' },
        ]);
        break;
      case 'gallery':
        handleGallery();
        break;
      case 'camera':
        handleCamera();
        break;
      case 'video':
        handleVideo();
        break;
      case 'document':
        handleDocument();
        break;
      case 'location':
        onClose();
        onPickLocation?.();
        break;
      case 'contact':
        onClose();
        onPickContact?.();
        break;
      case 'sticker':
        onClose();
        onPickSticker?.();
        break;
      case 'gif':
        onClose();
        onPickGif?.();
        break;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.grid}>
            {OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={styles.option}
                activeOpacity={0.7}
                onPress={() => handleOptionPress(opt.key)}
              >
                <View style={[styles.iconCircle, { backgroundColor: opt.color }]}>
                  <Ionicons name={opt.icon} size={26} color="#fff" />
                </View>
                <Text style={styles.optionLabel}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cancel */}
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 34 : spacing.xxl,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    rowGap: spacing.lg,
  },
  option: {
    alignItems: 'center',
    gap: spacing.sm,
    width: '25%', // 4 per row
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cancelText: {
    fontSize: fontSize.md,
    color: colors.textMuted,
  },
});

export default AttachmentMenu;
