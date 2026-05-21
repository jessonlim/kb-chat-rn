import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import channelService from '../../services/channelService';
import { uploadFile } from '../../services/uploadService';
import { compressImage } from '../../utils/imageCompression';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';
import type { ChannelPostAttachment } from '../../types';

const MAX_PHOTOS = 9;

interface PendingPhoto {
  id: number;
  localUri: string;
  uploaded?: ChannelPostAttachment;
  uploading: boolean;
}

interface Props {
  navigation: any;
  route: { params: { channelId: string } };
}

let nextPhotoId = 0;

const ComposePostScreen = ({ navigation, route }: Props) => {
  const { channelId } = route.params;
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addPhotos = async () => {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      Alert.alert('Limit', `Maximum ${MAX_PHOTOS} photos per post`);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.8,
    });

    if (result.canceled) return;

    for (const asset of result.assets) {
      const id = ++nextPhotoId;
      setPhotos((prev) => [
        ...prev,
        { id, localUri: asset.uri, uploading: true },
      ]);

      // Upload in background
      (async () => {
        try {
          let fileUri = asset.uri;
          const fileName = asset.fileName || `photo-${id}.jpg`;
          const mimeType = asset.mimeType || 'image/jpeg';
          try {
            const compressed = await compressImage(fileUri);
            fileUri = compressed.uri;
          } catch {
            // Use original
          }
          const uploaded = await uploadFile(fileUri, fileName, mimeType);
          setPhotos((prev) =>
            prev.map((p) =>
              p.id === id
                ? {
                    ...p,
                    uploading: false,
                    uploaded: { url: uploaded.url, type: 'image' },
                  }
                : p
            )
          );
        } catch (err) {
          console.warn('Photo upload failed:', err);
          setPhotos((prev) => prev.filter((p) => p.id !== id));
          Alert.alert('Error', 'Failed to upload photo');
        }
      })();
    }
  };

  const removePhoto = (id: number) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handlePost = async () => {
    const trimmed = text.trim();
    const allUploaded = photos.every((p) => !p.uploading);

    if (!allUploaded) {
      Alert.alert('Wait', 'Some photos are still uploading...');
      return;
    }

    const attachments = photos
      .map((p) => p.uploaded)
      .filter((a): a is ChannelPostAttachment => !!a);

    if (!trimmed && attachments.length === 0) {
      Alert.alert('Error', 'Write something or add a photo');
      return;
    }

    setSubmitting(true);
    try {
      await channelService.createPost(channelId, {
        content: trimmed,
        attachments,
      });
      navigation.goBack();
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.response?.data?.message || 'Failed to create post'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const anyUploading = photos.some((p) => p.uploading);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Text input */}
        <TextInput
          style={styles.textInput}
          value={text}
          onChangeText={setText}
          placeholder="What's on your mind?"
          placeholderTextColor={colors.textMuted}
          maxLength={4000}
          multiline
          textAlignVertical="top"
          autoFocus
        />

        {/* Photo grid */}
        {photos.length > 0 && (
          <View style={styles.photoGrid}>
            {photos.map((p) => (
              <View key={p.id} style={styles.photoItem}>
                <Image
                  source={{ uri: p.localUri }}
                  style={styles.photoImage}
                  resizeMode="cover"
                />
                {p.uploading && (
                  <View style={styles.photoOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                )}
                <TouchableOpacity
                  style={styles.photoRemove}
                  onPress={() => removePhoto(p.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.addPhotoBtn}
          onPress={addPhotos}
          disabled={photos.length >= MAX_PHOTOS}
          activeOpacity={0.7}
        >
          <Ionicons
            name="image-outline"
            size={22}
            color={
              photos.length >= MAX_PHOTOS ? colors.textMuted : colors.primary
            }
          />
          <Text
            style={[
              styles.addPhotoText,
              photos.length >= MAX_PHOTOS && { color: colors.textMuted },
            ]}
          >
            {photos.length}/{MAX_PHOTOS}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.postButton,
            (submitting || anyUploading) && styles.postButtonDisabled,
          ]}
          onPress={handlePost}
          disabled={submitting || anyUploading}
          activeOpacity={0.7}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  textInput: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    minHeight: 120,
    lineHeight: 22,
  },
  // Photo grid
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.lg,
  },
  photoItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.bgHeader,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addPhotoText: {
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  postButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: 10,
    minWidth: 80,
    alignItems: 'center',
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});

export default ComposePostScreen;
