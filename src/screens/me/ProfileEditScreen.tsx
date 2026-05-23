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
import { useAuth } from '../../stores/authStore';
import userService from '../../services/userService';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';

interface Props {
  navigation: any;
}

const ProfileEditScreen = ({ navigation }: Props) => {
  const { user, updateUser } = useAuth();
  const { t } = useT();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [about, setAbout] = useState(user?.about || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarFileName, setAvatarFileName] = useState('');
  const [avatarMimeType, setAvatarMimeType] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setAvatarUri(asset.uri);
      setAvatarFileName(asset.fileName || 'avatar.jpg');
      setAvatarMimeType(asset.mimeType || 'image/jpeg');
    }
  };

  const handleSave = async () => {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      Alert.alert(t('common.failed'), t('profile.displayNameRequired'));
      return;
    }

    setSaving(true);
    try {
      let result;
      if (avatarUri) {
        result = await userService.updateProfileWithAvatar(
          avatarUri,
          avatarFileName,
          avatarMimeType,
          { displayName: trimmedName, about: about.trim() }
        );
      } else {
        result = await userService.updateProfile({
          displayName: trimmedName,
          about: about.trim(),
        });
      }

      // Update auth store so the change is reflected everywhere immediately
      updateUser(result.user);
      navigation.goBack();
    } catch (err) {
      console.warn('Failed to update profile:', err);
      Alert.alert(t('common.failed'), t('profile.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    displayName.trim() !== (user?.displayName || '') ||
    about.trim() !== (user?.about || '') ||
    avatarUri !== null;

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
        >
          <Avatar
            name={displayName || user?.username || '?'}
            src={avatarUri || user?.avatar}
            size={100}
          />
          <View style={styles.cameraIcon}>
            <Ionicons name="camera" size={18} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={styles.changeAvatarText}>{t('profile.clickAvatar')}</Text>

        {/* Display Name */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('profile.displayNameLabel')}</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder={t('profile.displayNameLabel')}
            placeholderTextColor={colors.textMuted}
            maxLength={50}
            autoCapitalize="words"
          />
        </View>

        {/* About */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('profile.aboutLabel')}</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={about}
            onChangeText={setAbout}
            placeholder={t('profile.aboutPlaceholder')}
            placeholderTextColor={colors.textMuted}
            maxLength={200}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{about.length}/200</Text>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
          activeOpacity={0.7}
          onPress={handleSave}
          disabled={saving || !hasChanges}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{t('common.save')}</Text>
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
  changeAvatarText: {
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
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
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
  charCount: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  saveButton: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    minHeight: 48,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
});

export default ProfileEditScreen;
