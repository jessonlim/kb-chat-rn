import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { storage } from '../../services/api';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';

interface Props {
  navigation: any;
}

// Settings keys saved in MMKV
const KEY_NOTIFICATIONS = 'pref.notificationsEnabled';
const KEY_SOUNDS = 'pref.soundsEnabled';
const KEY_VIBRATE = 'pref.vibrateEnabled';

const SettingsScreen = ({ navigation }: Props) => {
  const [notifications, setNotifications] = useState(true);
  const [sounds, setSounds] = useState(true);
  const [vibrate, setVibrate] = useState(true);

  // Load saved prefs on mount (default to enabled)
  useEffect(() => {
    setNotifications(storage.getBoolean(KEY_NOTIFICATIONS) ?? true);
    setSounds(storage.getBoolean(KEY_SOUNDS) ?? true);
    setVibrate(storage.getBoolean(KEY_VIBRATE) ?? true);
  }, []);

  const toggle = (key: string, value: boolean, setter: (v: boolean) => void) => {
    storage.set(key, value);
    setter(value);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Notifications section */}
      <Text style={styles.sectionHeader}>Notifications</Text>
      <View style={styles.section}>
        <View style={styles.row}>
          <Ionicons name="notifications-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>Push notifications</Text>
          <Switch
            value={notifications}
            onValueChange={(v) => toggle(KEY_NOTIFICATIONS, v, setNotifications)}
            trackColor={{ false: colors.bgInput, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
        <View style={[styles.row, styles.rowBorder]}>
          <Ionicons name="volume-medium-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>Sound</Text>
          <Switch
            value={sounds}
            onValueChange={(v) => toggle(KEY_SOUNDS, v, setSounds)}
            trackColor={{ false: colors.bgInput, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
        <View style={[styles.row, styles.rowBorder]}>
          <Ionicons name="phone-portrait-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>Vibrate</Text>
          <Switch
            value={vibrate}
            onValueChange={(v) => toggle(KEY_VIBRATE, v, setVibrate)}
            trackColor={{ false: colors.bgInput, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Privacy section */}
      <Text style={styles.sectionHeader}>Privacy</Text>
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('BlockedUsers')}
        >
          <Ionicons name="ban-outline" size={22} color={colors.textSecondary} />
          <Text style={styles.rowLabel}>Blocked users</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    minHeight: 56,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowLabel: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
});

export default SettingsScreen;
