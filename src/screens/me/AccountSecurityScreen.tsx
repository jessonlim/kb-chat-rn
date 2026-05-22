import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as authService from '../../services/authService';
import { useAuth } from '../../stores/authStore';
import { useT } from '../../i18n/I18nContext';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';

interface Props {
  navigation: any;
}

const AccountSecurityScreen = ({ navigation }: Props) => {
  const { logout } = useAuth();
  const { t } = useT();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) return;
    if (newPassword.length < 6) {
      Toast.show({ type: 'error', text1: t('pwd.tooShort') });
      return;
    }
    if (newPassword !== confirmPassword) {
      Toast.show({ type: 'error', text1: t('pwd.mismatch') });
      return;
    }

    setSaving(true);
    try {
      await authService.changePassword({ currentPassword, newPassword });
      Toast.show({ type: 'success', text1: t('pwd.success') });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: err?.response?.data?.message || t('auth.loginFailed'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.prompt(
      t('account.delete.title'),
      t('account.delete.warning'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('account.delete.confirm'),
          style: 'destructive',
          onPress: async (password) => {
            if (!password) return;
            try {
              await authService.deleteAccount(password);
              Toast.show({ type: 'success', text1: t('account.delete.success') });
              await logout();
            } catch (err: any) {
              Toast.show({
                type: 'error',
                text1: err?.response?.data?.message || t('account.delete.failed'),
              });
            }
          },
        },
      ],
      'secure-text'
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Change password */}
      <Text style={styles.sectionHeader}>{t('pwd.title')}</Text>
      <View style={styles.section}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={t('pwd.current')}
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showCurrent}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            autoCapitalize="none"
            autoComplete="current-password"
          />
          <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
            <Ionicons
              name={showCurrent ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>
        <View style={[styles.inputRow, styles.inputBorder]}>
          <TextInput
            style={styles.input}
            placeholder={t('pwd.new')}
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showNew}
            value={newPassword}
            onChangeText={setNewPassword}
            autoCapitalize="none"
            autoComplete="new-password"
          />
          <TouchableOpacity onPress={() => setShowNew(!showNew)}>
            <Ionicons
              name={showNew ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>
        <View style={[styles.inputRow, styles.inputBorder]}>
          <TextInput
            style={styles.input}
            placeholder={t('pwd.confirm')}
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showNew}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
            autoComplete="new-password"
          />
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        activeOpacity={0.7}
        onPress={handleChangePassword}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>{t('pwd.submit')}</Text>
        )}
      </TouchableOpacity>

      {/* Privacy / blocked users */}
      <Text style={styles.sectionHeader}>{t('settings.section.privacy')}</Text>
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.linkRow}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('BlockedUsers')}
        >
          <Ionicons name="ban-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.linkLabel}>{t('privacy.blocked.title')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Danger zone */}
      <Text style={styles.sectionHeader}>{t('account.delete.title')}</Text>
      <TouchableOpacity
        style={styles.dangerButton}
        activeOpacity={0.7}
        onPress={handleDeleteAccount}
      >
        <Ionicons name="trash-outline" size={20} color={colors.danger} />
        <Text style={styles.dangerText}>{t('account.delete.button')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDark },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    marginLeft: spacing.sm,
    letterSpacing: 0.5,
  },
  section: {
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    gap: spacing.md,
  },
  inputBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    paddingVertical: 4,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: '#fff',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  linkLabel: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    gap: spacing.sm,
  },
  dangerText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.danger,
  },
});

export default AccountSecurityScreen;
