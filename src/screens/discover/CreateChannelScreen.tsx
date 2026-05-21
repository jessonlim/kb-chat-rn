import React, { useState } from 'react';
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
import channelService from '../../services/channelService';
import { uploadFile } from '../../services/uploadService';
import { compressImage } from '../../utils/imageCompression';
import Avatar from '../../components/common/Avatar';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';

interface Props {
  navigation: any;
}

const CreateChannelScreen = ({ navigation }: Props) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
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
        // Compress first
        let fileUri = asset.uri;
        let fileName = asset.fileName || 'channel-avatar.jpg';
        let mimeType = asset.mimeType || 'image/jpeg';
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
        Alert.alert('Error', 'Failed to upload avatar');
        setAvatarLocalUri(null);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      Alert.alert('Error', 'Channel name must be at least 3 characters');
      return;
    }
    if (uploading) {
      Alert.alert('Wait', 'Avatar is still uploading...');
      return;
    }

    setSubmitting(true);
    try {
      const { channel } = await channelService.create({
        name: trimmed,
        description: description.trim(),
        avatar: avatarUrl || undefined,
      });
      // Navigate to the new channel
      navigation.replace('ChannelDetail', { channelId: channel._id });
    } catch (err: any) {
      Alert.alert(
        'Error',
        err?.response?.data?.message || 'Failed to create channel'
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
            src={avatarLocalUri || undefined}
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
        <Text style={styles.avatarHint}>Tap to add a channel photo</Text>

        {/* Name */}
        <View style={styles.field}>
          <Text style={styles.label}>CHANNEL NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter channel name"
            placeholderTextColor={colors.textMuted}
            maxLength={50}
            autoCapitalize="words"
          />
          <Text style={styles.hint}>3-50 characters</Text>
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>DESCRIPTION</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="What is this channel about?"
            placeholderTextColor={colors.textMuted}
            maxLength={500}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{description.length}/500</Text>
        </View>

        {/* Create button */}
        <TouchableOpacity
          style={[
            styles.createButton,
            (submitting || uploading || name.trim().length < 3) &&
              styles.createButtonDisabled,
          ]}
          activeOpacity={0.7}
          onPress={handleCreate}
          disabled={submitting || uploading || name.trim().length < 3}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>Create Channel</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 32,
    paddingBottom: 40,
  },
  avatarWrapper: {
    position: 'relative',
  },
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
  avatarHint: {
    fontSize: fontSize.sm,
    color: colors.primary,
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
  },
  field: {
    width: '100%',
    marginBottom: spacing.xl,
  },
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
  inputMultiline: {
    minHeight: 80,
    paddingTop: 14,
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  charCount: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
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
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
});

export default CreateChannelScreen;
