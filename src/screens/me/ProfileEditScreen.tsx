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
import * as ImageManipulator from 'expo-image-manipulator';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../stores/authStore';
import userService from '../../services/userService';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';

interface Props {
  navigation: any;
}

const ProfileEditScreen = ({ navigation }: Props) => {
  const { user, updateUser } = useAuth();
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [about, setAbout] = useState(user?.about || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarFileName, setAvatarFileName] = useState('');
  const [avatarMimeType, setAvatarMimeType] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePickAvatar = async () => {
    try {
      // Modern Android (API 33+) uses the system Photo Picker which doesn't
      // require READ_MEDIA_IMAGES permission. Skipping the explicit
      // permission request avoids a class of "permission denied" failures
      // on devices where the runtime permission flow is flaky.
      // No built-in crop — Samsung's native editor doesn't return the image.
      // We crop in JS via expo-image-manipulator below.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
      });
      if (result.canceled || !result.assets || !result.assets[0]) {
        return;
      }

      const asset = result.assets[0];
      const w = asset.width || 0;
      const h = asset.height || 0;

      // If we have dimensions, center-crop to a square and downsize.
      // If not (some pickers don't return them), just use the picked image.
      let finalUri = asset.uri;
      if (w > 0 && h > 0) {
        const size = Math.min(w, h);
        const originX = Math.max(0, (w - size) / 2);
        const originY = Math.max(0, (h - size) / 2);
        try {
          const manipulated = await ImageManipulator.manipulateAsync(
            asset.uri,
            [
              { crop: { originX, originY, width: size, height: size } },
              { resize: { width: 512, height: 512 } },
            ],
            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
          );
          finalUri = manipulated.uri;
        } catch (cropErr) {
          // Cropping failed — keep the original. Not a fatal error.
          console.warn('[avatar] crop failed, using original:', cropErr);
        }
      }

      setAvatarUri(finalUri);
      setAvatarFileName('avatar.jpg');
      setAvatarMimeType('image/jpeg');
    } catch (err: any) {
      console.warn('[avatar] picker failed:', err);
      Toast.show({
        type: 'error',
        text1: 'Could not load photo',
        text2: String(err?.message || err?.code || err || 'Unknown error').slice(0, 80),
        visibilityTime: 8000,
      });
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
      // Trim phone but allow empty string (= clear phone)
      const trimmedPhone = phone.trim();
      let result;
      if (avatarUri) {
        result = await userService.updateProfileWithAvatar(
          avatarUri,
          avatarFileName,
          avatarMimeType,
          { displayName: trimmedName, about: about.trim(), phone: trimmedPhone }
        );
      } else {
        result = await userService.updateProfile({
          displayName: trimmedName,
          about: about.trim(),
          phone: trimmedPhone,
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
    phone.trim() !== (user?.phone || '') ||
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

        {/* Phone — optional. Used so friends who have your number in
            their address book can find you via "Find from Contacts". */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('profile.phoneLabel')}</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder={t('profile.phonePlaceholder')}
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            maxLength={30}
          />
          <Text style={styles.charCount}>{t('profile.phoneHelp')}</Text>
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

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
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
