import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { storage } from '../../services/api';
import userService from '../../services/userService';
import { useT } from '../../i18n/I18nContext';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';

interface Props {
  navigation: any;
}

// ── Settings keys (saved in MMKV) ─────────────────────────────────────
const KEYS = {
  notifications: 'pref.notificationsEnabled',
  sounds: 'pref.soundsEnabled',
  vibrate: 'pref.vibrateEnabled',
  enterToSend: 'pref.enterToSend',
  messagePreview: 'pref.messagePreview',
  speakerOn: 'pref.defaultSpeakerOn',
  ringtone: 'pref.ringtoneEnabled',
};

type FriendPolicy = 'anyone' | 'friends_of_friends' | 'nobody';

const SettingsScreen = ({ navigation }: Props) => {
  const { lang, setLang, t } = useT();

  // ── Local prefs ─────────────────────────────────────
  const [notifications, setNotifications] = useState(true);
  const [sounds, setSounds] = useState(true);
  const [vibrate, setVibrate] = useState(true);
  const [enterToSend, setEnterToSend] = useState(false);
  const [messagePreview, setMessagePreview] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [ringtone, setRingtone] = useState(true);

  // ── Server prefs ────────────────────────────────────
  const [friendPolicy, setFriendPolicy] = useState<FriendPolicy | null>(null);
  const [savingPolicy, setSavingPolicy] = useState(false);

  // ── Cache ───────────────────────────────────────────
  const [clearingCache, setClearingCache] = useState(false);

  // ── Load all prefs on mount ─────────────────────────
  useEffect(() => {
    setNotifications(storage.getBoolean(KEYS.notifications) ?? true);
    setSounds(storage.getBoolean(KEYS.sounds) ?? true);
    setVibrate(storage.getBoolean(KEYS.vibrate) ?? true);
    setEnterToSend(storage.getBoolean(KEYS.enterToSend) ?? false);
    setMessagePreview(storage.getBoolean(KEYS.messagePreview) ?? true);
    setSpeakerOn(storage.getBoolean(KEYS.speakerOn) ?? false);
    setRingtone(storage.getBoolean(KEYS.ringtone) ?? true);

    // Friend request policy from server
    userService
      .getPrivacy()
      .then((res) => setFriendPolicy(res.friendRequestPolicy))
      .catch(() => setFriendPolicy('anyone'));
  }, []);

  const toggle = (key: string, value: boolean, setter: (v: boolean) => void) => {
    storage.set(key, value);
    setter(value);
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will remove cached media and temporary files. Your messages and account data are safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setClearingCache(true);
            try {
              // Cached images are managed by RN itself; we clear MMKV-stored
              // temporary entries (anything that isn't auth or critical prefs).
              const keepKeys = new Set<string>([
                'accessToken',
                'refreshToken',
                ...Object.values(KEYS),
              ]);
              const allKeys = storage.getAllKeys();
              for (const key of allKeys) {
                if (!keepKeys.has(key)) storage.delete(key);
              }
              Toast.show({ type: 'success', text1: 'Cache cleared' });
            } catch (err: any) {
              Toast.show({ type: 'error', text1: 'Failed to clear cache' });
            } finally {
              setClearingCache(false);
            }
          },
        },
      ],
    );
  };

  const handleChangeFriendPolicy = async (next: FriendPolicy) => {
    if (next === friendPolicy || savingPolicy) return;
    const prev = friendPolicy;
    setFriendPolicy(next); // optimistic
    setSavingPolicy(true);
    try {
      await userService.setPrivacy(next);
      Toast.show({ type: 'success', text1: 'Privacy updated' });
    } catch (err: any) {
      setFriendPolicy(prev);
      Toast.show({
        type: 'error',
        text1: err?.response?.data?.message || 'Failed to update privacy',
      });
    } finally {
      setSavingPolicy(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ─── Display ─── */}
      <Text style={styles.sectionHeader}>{t('settings.section.display')}</Text>
      <View style={styles.section}>
        {/* Language */}
        <View style={styles.policyHeader}>
          <Ionicons name="language-outline" size={22} color={colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.policyTitle}>{t('settings.language')}</Text>
            <Text style={styles.policyDesc}>{t('settings.languageDesc')}</Text>
          </View>
        </View>
        <View style={styles.segmentRow}>
          <TouchableOpacity
            style={[styles.segment, lang === 'zh' && styles.segmentActive]}
            activeOpacity={0.7}
            onPress={() => setLang('zh')}
          >
            <Text style={[styles.segmentText, lang === 'zh' && styles.segmentTextActive]}>
              {t('settings.langZh')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, lang === 'en' && styles.segmentActive]}
            activeOpacity={0.7}
            onPress={() => setLang('en')}
          >
            <Text style={[styles.segmentText, lang === 'en' && styles.segmentTextActive]}>
              {t('settings.langEn')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Theme — placeholder until light theme is implemented */}
        <View style={[styles.policyHeader, styles.bordered]}>
          <Ionicons name="color-palette-outline" size={22} color={colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.policyTitle}>{t('display.theme')}</Text>
            <Text style={styles.policyDesc}>{t('common.soon')}</Text>
          </View>
        </View>

        {/* Font size — placeholder */}
        <View style={[styles.policyHeader, styles.bordered]}>
          <Ionicons name="text-outline" size={22} color={colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.policyTitle}>{t('display.fontSize')}</Text>
            <Text style={styles.policyDesc}>{t('common.soon')}</Text>
          </View>
        </View>
      </View>

      {/* ─── Notifications ─── */}
      <Text style={styles.sectionHeader}>{t('settings.section.notifications')}</Text>
      <View style={styles.section}>
        <ToggleRow
          icon="notifications-outline"
          label={t('settings.notifications')}
          value={notifications}
          onChange={(v) => toggle(KEYS.notifications, v, setNotifications)}
        />
        <ToggleRow
          icon="volume-medium-outline"
          label={t('settings.sound')}
          value={sounds}
          onChange={(v) => toggle(KEYS.sounds, v, setSounds)}
          bordered
        />
        <ToggleRow
          icon="phone-portrait-outline"
          label={t('settings.vibrate')}
          value={vibrate}
          onChange={(v) => toggle(KEYS.vibrate, v, setVibrate)}
          bordered
        />
      </View>

      {/* ─── Privacy ─── */}
      <Text style={styles.sectionHeader}>{t('settings.section.privacy')}</Text>
      <View style={styles.section}>
        <View style={styles.policyHeader}>
          <Ionicons name="people-outline" size={22} color={colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.policyTitle}>{t('privacy.frp.title')}</Text>
            <Text style={styles.policyDesc}>{t('privacy.frp.desc')}</Text>
          </View>
        </View>
        {(['anyone', 'friends_of_friends', 'nobody'] as FriendPolicy[]).map((opt) => {
          const selected = friendPolicy === opt;
          const labelKey =
            opt === 'anyone' ? 'privacy.frp.anyone' :
            opt === 'friends_of_friends' ? 'privacy.frp.fof' :
            'privacy.frp.nobody';
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.policyOption, selected && styles.policyOptionSelected]}
              activeOpacity={0.7}
              onPress={() => handleChangeFriendPolicy(opt)}
              disabled={friendPolicy === null || savingPolicy}
            >
              <Text style={styles.policyOptionText}>{t(labelKey as any)}</Text>
              {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={styles.linkRow}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('BlockedUsers')}
        >
          <Ionicons name="ban-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>{t('privacy.blocked.title')}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* ─── Chats ─── */}
      <Text style={styles.sectionHeader}>{t('settings.section.chats')}</Text>
      <View style={styles.section}>
        <ToggleRow
          icon="return-down-back-outline"
          label={t('chats.enterToSend')}
          subtext={t('chats.enterToSendDesc')}
          value={enterToSend}
          onChange={(v) => toggle(KEYS.enterToSend, v, setEnterToSend)}
        />
        <ToggleRow
          icon="eye-outline"
          label={t('chats.preview')}
          subtext={t('chats.previewDesc')}
          value={messagePreview}
          onChange={(v) => toggle(KEYS.messagePreview, v, setMessagePreview)}
          bordered
        />
      </View>

      {/* ─── Calls ─── */}
      <Text style={styles.sectionHeader}>{t('settings.section.calls')}</Text>
      <View style={styles.section}>
        <ToggleRow
          icon="volume-high-outline"
          label={t('callsSettings.speaker.title')}
          subtext={t('callsSettings.speaker.desc')}
          value={speakerOn}
          onChange={(v) => toggle(KEYS.speakerOn, v, setSpeakerOn)}
        />
        <ToggleRow
          icon="musical-note-outline"
          label={t('callsSettings.ringtone.title')}
          subtext={t('callsSettings.ringtone.desc')}
          value={ringtone}
          onChange={(v) => toggle(KEYS.ringtone, v, setRingtone)}
          bordered
        />
      </View>

      {/* ─── Storage ─── */}
      <Text style={styles.sectionHeader}>{t('settings.section.storage')}</Text>
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.cacheRow}
          activeOpacity={0.7}
          onPress={handleClearCache}
          disabled={clearingCache}
        >
          {clearingCache ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.rowLabel, { color: colors.danger }]}>{t('storage.cache.clear')}</Text>
            <Text style={styles.subText}>{t('storage.cache.desc')}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

// ── Helper component ───────────────────────────────────────────────
interface ToggleRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtext?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  bordered?: boolean;
}
const ToggleRow = ({ icon, label, subtext, value, onChange, bordered }: ToggleRowProps) => (
  <View style={[styles.toggleRow, bordered && styles.bordered]}>
    <Ionicons name={icon} size={22} color={colors.textSecondary} />
    <View style={{ flex: 1 }}>
      <Text style={styles.rowLabel}>{label}</Text>
      {subtext ? <Text style={styles.subText}>{subtext}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: colors.bgInput, true: colors.primary }}
      thumbColor="#fff"
    />
  </View>
);

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
  // Toggle rows
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    minHeight: 56,
  },
  bordered: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowLabel: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  subText: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  // Link rows
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  dangerRow: {},
  // Friend policy
  policyHeader: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  policyTitle: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  policyDesc: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  policyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  policyOptionSelected: {
    backgroundColor: 'rgba(220,38,38,0.10)',
  },
  policyOptionText: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  // Cache row
  cacheRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  // Segmented control (language picker)
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgInput,
    borderRadius: borderRadius.full,
    padding: 4,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default SettingsScreen;
