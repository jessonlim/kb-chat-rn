// "Find friends from your phone contacts" — WeChat-style discovery.
//
// Flow:
//   1. User taps the entry on NewFriends → arrives here.
//   2. We ask for the OS contacts permission.
//   3. Read all contacts that have at least one phone number.
//   4. Normalise + hash phones client-side and POST them to
//      /api/contacts/match-phones — only the (already-trimmed) numbers
//      go to the server, never names or other PII.
//   5. Show matches: contacts who already have a KB Chat account.
//      Each row has an "Add" button → contactService.sendRequest.
//
// Privacy stance: we send phone numbers (the user owns them), nothing
// else. The server hashes them in-memory, queries the index, and
// returns only the users who happen to share a phone hash.

import React, { useMemo, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
// IMPORTANT: expo-contacts is a NATIVE module. If we eagerly
// `import * as Contacts from 'expo-contacts'` at the top, EVERY build
// that loads this JS bundle will try to resolve the native module at
// startup. On builds that don't have the module installed (e.g. older
// preview APKs predating the contacts feature), the require fails and
// the entire app crashes on launch — there's no chance for the OTA
// update system to recover because the JS that fetches updates is the
// same JS that just crashed.
//
// Workaround: lazy-load via require() inside loadContactsModule, which
// is only called AFTER this screen actually mounts. So users on older
// builds get a clean error instead of an app-killing crash.
type ContactsModule = typeof import('expo-contacts');
let _contactsModule: ContactsModule | null = null;
const loadContactsModule = (): ContactsModule | null => {
  if (_contactsModule) return _contactsModule;
  try {
    _contactsModule = require('expo-contacts');
    return _contactsModule;
  } catch (err) {
    console.warn('[FindFromContacts] expo-contacts not available:', err);
    return null;
  }
};
import contactService from '../../services/contactService';
import Avatar from '../../components/common/Avatar';
import { useT } from '../../i18n/I18nContext';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';

interface Props {
  navigation: any;
}

interface MatchedUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  phoneHashHex: string;
  // The address-book entry that matched (so we can show "John (your contact)")
  contactName?: string;
}

type Status = 'idle' | 'loading' | 'denied' | 'noContacts' | 'noPhone' | 'matched' | 'unsupported';

const FindFromContactsScreen = ({ navigation }: Props) => {
  const { t } = useT();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [status, setStatus] = useState<Status>('idle');
  const [matches, setMatches] = useState<MatchedUser[]>([]);
  const [totalScanned, setTotalScanned] = useState(0);
  // Per-user "request sent" state so the Add button can flip to "Sent"
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const runMatch = useCallback(async () => {
    setStatus('loading');

    // Step 0: load the native module lazily. On builds that don't have
    // expo-contacts installed (older APKs) this returns null and we
    // surface a friendly "rebuild required" message instead of crashing.
    const Contacts = loadContactsModule();
    if (!Contacts) {
      setStatus('unsupported');
      return;
    }

    try {
      // Step 1: ask permission
      const { status: permStatus } = await Contacts.requestPermissionsAsync();
      if (permStatus !== 'granted') {
        setStatus('denied');
        return;
      }

      // Step 2: read contacts with phone numbers
      const { data: rawContacts } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });

      if (!rawContacts || rawContacts.length === 0) {
        setStatus('noContacts');
        return;
      }

      // Step 3: flatten into a list of { phone, contactName } pairs
      // (a contact can have multiple numbers — landline + mobile etc.)
      const phoneList: string[] = [];
      const phoneToName = new Map<string, string>();

      for (const c of rawContacts) {
        const name = c.name || '';
        if (!c.phoneNumbers) continue;
        for (const p of c.phoneNumbers) {
          if (!p.number) continue;
          phoneList.push(p.number);
          // Track the most "human-readable" name for each phone so we can
          // show e.g. "John Doe" alongside the matched KB Chat user.
          // Client-side normalisation matches the server's.
          const normalised = normalisePhone(p.number);
          if (normalised && !phoneToName.has(normalised)) {
            phoneToName.set(normalised, name);
          }
        }
      }

      setTotalScanned(phoneList.length);

      if (phoneList.length === 0) {
        setStatus('noPhone');
        return;
      }

      // Step 4: send to backend
      const { matches: rawMatches } = await contactService.matchPhones(phoneList);

      // Step 5: enrich each match with the contact-book name it came from.
      // The server returns phoneHashHex; we hash each of our local phones
      // to build a hash → name map, then look up.
      const hashToName = await buildHashToNameMap(phoneToName);
      const enriched: MatchedUser[] = rawMatches.map((m) => ({
        ...m,
        contactName: hashToName.get(m.phoneHashHex) || undefined,
      }));

      setMatches(enriched);
      setStatus('matched');
    } catch (err) {
      console.warn('[findContacts] error:', err);
      Toast.show({
        type: 'error',
        text1: t('common.failed'),
        text2: (err as Error)?.message,
      });
      setStatus('idle');
    }
  }, [t]);

  // Kick off the match on mount — the permission prompt is the gate.
  useEffect(() => {
    runMatch();
  }, [runMatch]);

  const handleAdd = useCallback(
    async (m: MatchedUser) => {
      try {
        await contactService.sendRequest(m.id);
        setSentIds((prev) => new Set(prev).add(m.id));
        Toast.show({ type: 'success', text1: t('requests.sent') });
      } catch (err: any) {
        Toast.show({
          type: 'error',
          text1: err?.response?.data?.message || t('common.failed'),
        });
      }
    },
    [t]
  );

  const renderMatch = ({ item }: { item: MatchedUser }) => {
    const isSent = sentIds.has(item.id);
    return (
      <View style={styles.row}>
        <Avatar
          name={item.displayName || item.username}
          src={item.avatar}
          size={44}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {item.displayName || item.username}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {item.contactName
              ? t('findContacts.savedAs', { name: item.contactName })
              : `@${item.username}`}
          </Text>
        </View>
        {isSent ? (
          <View style={[styles.btn, styles.btnSent]}>
            <Text style={styles.btnSentText}>{t('contact.pending')}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.btn}
            activeOpacity={0.7}
            onPress={() => handleAdd(item)}
          >
            <Text style={styles.btnText}>{t('contact.add')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────
  if (status === 'loading' || status === 'idle') {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.centerText}>{t('findContacts.scanning')}</Text>
      </View>
    );
  }

  if (status === 'denied') {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="lock-closed-outline" size={48} color={colors.textMuted} />
        <Text style={styles.centerText}>{t('findContacts.permissionDenied')}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          activeOpacity={0.7}
          onPress={() => Linking.openSettings()}
        >
          <Text style={styles.retryText}>{t('findContacts.openSettings')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (status === 'unsupported') {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="construct-outline" size={48} color={colors.textMuted} />
        <Text style={styles.centerText}>
          This feature needs the next app update. Reinstall the latest APK from your
          tester invite to enable contact discovery.
        </Text>
      </View>
    );
  }

  if (status === 'noContacts' || status === 'noPhone') {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="people-outline" size={48} color={colors.textMuted} />
        <Text style={styles.centerText}>{t('findContacts.noContacts')}</Text>
      </View>
    );
  }

  // status === 'matched'
  if (matches.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="search-outline" size={48} color={colors.textMuted} />
        <Text style={styles.centerText}>
          {t('findContacts.noMatches', { n: totalScanned })}
        </Text>
        <Text style={styles.hint}>{t('findContacts.shareAppHint')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {t('findContacts.foundMatches', { n: matches.length, total: totalScanned })}
        </Text>
      </View>
      <FlatList
        data={matches}
        keyExtractor={(m) => m.id}
        renderItem={renderMatch}
      />
    </View>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────

/** Normalise client-side — must match server's logic. */
const normalisePhone = (raw: string): string => {
  if (!raw) return '';
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^0-9]/g, '');
  return hasPlus ? `+${digits}` : digits;
};

/**
 * Build a phoneHashHex → contactName map from the raw {phone: name} pairs.
 * Uses Web Crypto API (available in React Native via JSI) for SHA-256.
 * The hash must match the server's algorithm — see normalisePhoneServer /
 * hashPhoneServer in contactController.ts.
 */
async function buildHashToNameMap(
  phoneToName: Map<string, string>
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const encoder = new TextEncoder();

  for (const [normalised, name] of phoneToName.entries()) {
    if (!normalised) continue;
    try {
      const data = encoder.encode(normalised);
      // Web Crypto polyfilled by React Native's runtime (or react-native-quick-crypto)
      // Falls back gracefully if subtle isn't available.
      const sub = (globalThis as any).crypto?.subtle;
      if (!sub) continue;
      const hashBuf = await sub.digest('SHA-256', data);
      const hex = Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      out.set(hex, name);
    } catch {
      // Skip entries we couldn't hash — name correlation degrades gracefully
    }
  }
  return out;
}

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDark },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    centerText: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    hint: {
      fontSize: fontSize.sm,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.xs,
    },
    retryBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      marginTop: spacing.md,
    },
    retryText: { color: '#fff', fontSize: fontSize.md, fontWeight: '600' },
    summary: {
      padding: spacing.md,
      backgroundColor: colors.bgCard,
    },
    summaryText: {
      fontSize: fontSize.sm,
      color: colors.textMuted,
      textAlign: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    name: { fontSize: fontSize.md, color: colors.textPrimary, fontWeight: '500' },
    sub: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
    btn: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.md,
    },
    btnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: '600' },
    btnSent: {
      backgroundColor: colors.bgInput,
    },
    btnSentText: { color: colors.textMuted, fontSize: fontSize.sm },
  });

export default FindFromContactsScreen;
