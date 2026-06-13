// Two-Step Verification (TOTP / Google Authenticator) — Batch 3 Phase 4.
//
// Three states:
//   • loading — fetching current on/off status
//   • off     — explainer + "Enable" button → asks the server for a secret,
//               shows a QR + manual key, then a code field to confirm
//   • setup   — QR of the otpauth URI + manual secret + "open in app" + a
//               6-digit confirm field. Confirming flips 2FA on.
//   • on      — enabled state; a code field + "Turn off" disables it.
//
// The TOTP secret is only ever held in component state during setup; it is
// never persisted on the client.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import QRCode from 'react-native-qrcode-svg';
import * as authService from '../../services/authService';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';

type Mode = 'loading' | 'off' | 'setup' | 'on';

const TwoFactorScreen = () => {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [mode, setMode] = useState<Mode>('loading');
  const [secret, setSecret] = useState('');
  const [otpauth, setOtpauth] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const { enabled } = await authService.twoFaStatus();
      setMode(enabled ? 'on' : 'off');
    } catch {
      Toast.show({ type: 'error', text1: t('common.error') });
      setMode('off');
    }
  }, [t]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // off → ask server for a fresh secret + provisioning URI, move to setup.
  const handleBeginSetup = async () => {
    setBusy(true);
    try {
      const { secret: s, otpauth: uri } = await authService.twoFaSetup();
      setSecret(s);
      setOtpauth(uri);
      setCode('');
      setMode('setup');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || t('common.error') });
    } finally {
      setBusy(false);
    }
  };

  // setup → confirm the first code to switch 2FA on.
  const handleConfirmEnable = async () => {
    if (code.trim().length < 6) {
      Toast.show({ type: 'error', text1: t('twofa.enterCode') });
      return;
    }
    setBusy(true);
    try {
      await authService.twoFaEnable(code.trim());
      Toast.show({ type: 'success', text1: t('twofa.enabledToast') });
      setSecret('');
      setOtpauth('');
      setCode('');
      setMode('on');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || t('twofa.invalidCode') });
    } finally {
      setBusy(false);
    }
  };

  // on → require a current code to turn 2FA off.
  const handleDisable = async () => {
    if (code.trim().length < 6) {
      Toast.show({ type: 'error', text1: t('twofa.enterCode') });
      return;
    }
    setBusy(true);
    try {
      await authService.twoFaDisable(code.trim());
      Toast.show({ type: 'success', text1: t('twofa.disabledToast') });
      setCode('');
      setMode('off');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message || t('twofa.invalidCode') });
    } finally {
      setBusy(false);
    }
  };

  const handleCopySecret = async () => {
    if (!secret) return;
    await Clipboard.setStringAsync(secret);
    Toast.show({ type: 'success', text1: t('twofa.keyCopied') });
  };

  const handleOpenApp = async () => {
    if (!otpauth) return;
    try {
      const ok = await Linking.canOpenURL(otpauth);
      if (ok) {
        await Linking.openURL(otpauth);
      } else {
        // No authenticator installed to handle otpauth:// — fall back to copy.
        await handleCopySecret();
        Toast.show({ type: 'info', text1: t('twofa.noAuthApp') });
      }
    } catch {
      await handleCopySecret();
    }
  };

  if (mode === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Intro */}
      <View style={styles.intro}>
        <Ionicons name="shield-checkmark-outline" size={40} color={colors.primary} />
        <Text style={styles.introTitle}>{t('twofa.title')}</Text>
        <Text style={styles.introBody}>{t('twofa.intro')}</Text>
      </View>

      {mode === 'off' && (
        <TouchableOpacity
          style={[styles.primaryBtn, busy && styles.btnDisabled]}
          activeOpacity={0.8}
          onPress={handleBeginSetup}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>{t('twofa.enable')}</Text>
          )}
        </TouchableOpacity>
      )}

      {mode === 'setup' && (
        <>
          <Text style={styles.stepText}>{t('twofa.step1')}</Text>
          <View style={styles.qrCard}>
            {!!otpauth && (
              <View style={styles.qrWrap}>
                <QRCode value={otpauth} size={200} backgroundColor="#ffffff" color="#000000" />
              </View>
            )}
            <Text style={styles.manualLabel}>{t('twofa.manualKey')}</Text>
            <TouchableOpacity onPress={handleCopySecret} activeOpacity={0.7}>
              <Text style={styles.secretText} selectable>{secret}</Text>
              <Text style={styles.copyHint}>{t('twofa.tapToCopy')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.openAppBtn} onPress={handleOpenApp} activeOpacity={0.7}>
              <Ionicons name="open-outline" size={18} color={colors.primary} />
              <Text style={styles.openAppText}>{t('twofa.openApp')}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.stepText}>{t('twofa.step2')}</Text>
          <TextInput
            style={styles.codeInput}
            placeholder={t('twofa.codePlaceholder')}
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
            onSubmitEditing={handleConfirmEnable}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, busy && styles.btnDisabled]}
            activeOpacity={0.8}
            onPress={handleConfirmEnable}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>{t('twofa.confirmEnable')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => setMode('off')}>
            <Text style={styles.linkText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === 'on' && (
        <>
          <View style={styles.onBanner}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
            <Text style={styles.onBannerText}>{t('twofa.isOn')}</Text>
          </View>
          <Text style={styles.stepText}>{t('twofa.disableHint')}</Text>
          <TextInput
            style={styles.codeInput}
            placeholder={t('twofa.codePlaceholder')}
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
            onSubmitEditing={handleDisable}
          />
          <TouchableOpacity
            style={[styles.dangerBtn, busy && styles.btnDisabled]}
            activeOpacity={0.8}
            onPress={handleDisable}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.dangerBtnText}>{t('twofa.disable')}</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDark },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgDark },
    content: { padding: spacing.lg, paddingBottom: 40 },
    intro: { alignItems: 'center', gap: spacing.sm, marginVertical: spacing.lg },
    introTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
    introBody: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: spacing.md,
    },
    stepText: {
      fontSize: fontSize.md,
      color: colors.textPrimary,
      fontWeight: '600',
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    qrCard: {
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      gap: spacing.md,
    },
    qrWrap: { backgroundColor: '#ffffff', padding: spacing.md, borderRadius: borderRadius.md },
    manualLabel: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: spacing.sm },
    secretText: {
      fontSize: fontSize.lg,
      color: colors.textPrimary,
      fontWeight: '700',
      letterSpacing: 2,
      textAlign: 'center',
    },
    copyHint: { fontSize: fontSize.sm, color: colors.primary, textAlign: 'center', marginTop: 2 },
    openAppBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
    openAppText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '500' },
    codeInput: {
      backgroundColor: colors.bgInput,
      borderRadius: borderRadius.md,
      paddingVertical: 14,
      fontSize: fontSize.title,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.border,
      textAlign: 'center',
      letterSpacing: 8,
      fontWeight: '700',
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    primaryBtnText: { color: '#fff', fontSize: fontSize.lg, fontWeight: '600' },
    dangerBtn: {
      backgroundColor: colors.danger,
      borderRadius: borderRadius.md,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    dangerBtnText: { color: '#fff', fontSize: fontSize.lg, fontWeight: '600' },
    btnDisabled: { opacity: 0.6 },
    linkRow: { alignItems: 'center', marginTop: spacing.lg },
    linkText: { color: colors.textSecondary, fontSize: fontSize.md },
    onBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.bgCard,
      borderRadius: borderRadius.lg,
      paddingVertical: 14,
    },
    onBannerText: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: '600' },
  });

export default TwoFactorScreen;
