import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../stores/authStore';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';

interface Props {
  navigation: any;
}

const LoginScreen = ({ navigation }: Props) => {
  const { login, verifyTwoFa, addingAccount, cancelAddAccount } = useAuth();
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // 2FA step (Phase 4): when login returns a challenge instead of tokens, we
  // hold the challenge token and switch the form to a 6-digit code prompt.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Toast.show({ type: 'error', text1: t('auth.fillAllFields') });
      return;
    }
    setLoading(true);
    try {
      const result = await login(email.trim().toLowerCase(), password);
      if (result.twoFaRequired && result.challengeToken) {
        // New device + 2FA on → ask for the authenticator code.
        setChallengeToken(result.challengeToken);
        setCode('');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('auth.loginFailed');
      Toast.show({ type: 'error', text1: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (code.trim().length < 6) {
      Toast.show({ type: 'error', text1: t('twofa.enterCode') });
      return;
    }
    if (!challengeToken) return;
    setLoading(true);
    try {
      await verifyTwoFa(challengeToken, code.trim());
      // success → auth state flips and the navigator swaps to the app
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('twofa.invalidCode');
      Toast.show({ type: 'error', text1: msg });
    } finally {
      setLoading(false);
    }
  };

  const cancelTwoFa = () => {
    setChallengeToken(null);
    setCode('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        {/* Logo / Title */}
        <View style={styles.header}>
          <Image
            source={require('../../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>{t('about.appName')}</Text>
          <Text style={styles.subtitle}>
            {challengeToken
              ? t('twofa.enterCodePrompt')
              : addingAccount
              ? t('account.addTitle')
              : t('auth.signInToContinue')}
          </Text>
        </View>

        {challengeToken ? (
          /* 2FA code step (Phase 4) */
          <>
            <View style={styles.form}>
              <TextInput
                style={[styles.input, styles.codeInput]}
                placeholder={t('twofa.codePlaceholder')}
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                autoFocus
                maxLength={6}
                value={code}
                onChangeText={setCode}
                onSubmitEditing={handleVerify}
              />
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleVerify}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{t('twofa.verify')}</Text>
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={cancelTwoFa} style={styles.linkRow}>
              <Text style={styles.linkBold}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {/* Form */}
            <View style={styles.form}>
              <TextInput
                style={styles.input}
                placeholder={t('auth.email')}
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
              <TextInput
                style={styles.input}
                placeholder={t('auth.password')}
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
              />

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>{t('auth.signIn')}</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Register link */}
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              style={styles.linkRow}
            >
              <Text style={styles.linkText}>
                {t('auth.dontHaveAccount')}{' '}
                <Text style={styles.linkBold}>{t('auth.createOne')}</Text>
              </Text>
            </TouchableOpacity>

            {/* Cancel adding an account → back to the current account (Phase 3) */}
            {addingAccount && (
              <TouchableOpacity onPress={cancelAddAccount} style={styles.linkRow}>
                <Text style={styles.linkBold}>{t('account.cancelAdd')}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 20,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  form: {
    gap: spacing.md,
  },
  input: {
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeInput: {
    textAlign: 'center',
    fontSize: fontSize.title,
    letterSpacing: 8,
    fontWeight: '700',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  linkRow: {
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  linkText: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
  },
  linkBold: {
    color: colors.primary,
    fontWeight: '600',
  },
});

export default LoginScreen;
