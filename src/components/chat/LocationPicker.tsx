// Location picker — bottom sheet that fetches the device's current GPS
// coordinates and (optionally) reverse-geocodes them to a human-readable
// address. The user confirms by tapping "Send Location".
//
// We deliberately keep this lightweight (no embedded map) so we don't
// pull in `react-native-maps`. Once sent, the message bubble renders
// a clickable card that opens the system Maps app via a geo: URL.

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../i18n/I18nContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (lat: number, lng: number, name?: string) => void;
}

const LocationPicker = ({ visible, onClose, onPick }: Props) => {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState('');
  const [labelOverride, setLabelOverride] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      // Reset state when closed so re-opening starts fresh
      setCoords(null);
      setAddress('');
      setLabelOverride('');
      setError(null);
      return;
    }
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        if (!alive) return;
        setError(t('location.permissionDenied'));
        setLoading(false);
        return;
      }
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!alive) return;
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });

        // Best-effort reverse geocode — non-fatal if it fails
        try {
          const places = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (alive && places.length) {
            const p = places[0];
            const human = [
              p.name,
              p.street,
              p.city || p.subregion,
              p.region,
              p.country,
            ]
              .filter(Boolean)
              .join(', ');
            setAddress(human);
          }
        } catch {
          /* ignore */
        }
      } catch (err: any) {
        if (alive) setError(err?.message || t('location.invalid'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible, t]);

  const handleSend = () => {
    if (!coords) return;
    onPick(coords.lat, coords.lng, labelOverride || address);
    Toast.show({ type: 'success', text1: t('location.share') });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{t('location.title')}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.body}>
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.loadingText}>{t('location.fetching')}</Text>
              </View>
            ) : error ? (
              <View style={styles.center}>
                <Ionicons name="warning-outline" size={36} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : coords ? (
              <>
                <View style={styles.coordsCard}>
                  <Ionicons name="location" size={28} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.coordsLabel}>{t('location.current')}</Text>
                    <Text style={styles.coordsText} numberOfLines={2}>
                      {address || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`}
                    </Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>{t('location.title')}</Text>
                <TextInput
                  style={styles.input}
                  value={labelOverride}
                  onChangeText={setLabelOverride}
                  placeholder={address || t('location.current')}
                  placeholderTextColor={colors.textMuted}
                  maxLength={80}
                />
              </>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.sendBtn, !coords && styles.sendBtnDisabled]}
            activeOpacity={coords ? 0.7 : 1}
            disabled={!coords}
            onPress={handleSend}
          >
            <Ionicons name="paper-plane" size={18} color="#fff" />
            <Text style={styles.sendBtnText}>{t('location.share')}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xl,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    title: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    body: {
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.lg,
      minHeight: 180,
    },
    center: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xl,
      gap: spacing.md,
    },
    loadingText: {
      fontSize: fontSize.sm,
      color: colors.textMuted,
    },
    errorText: {
      fontSize: fontSize.md,
      color: colors.danger,
      textAlign: 'center',
    },
    coordsCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.bgInput,
      borderRadius: borderRadius.md,
      marginBottom: spacing.lg,
    },
    coordsLabel: {
      fontSize: fontSize.xs,
      color: colors.textMuted,
    },
    coordsText: {
      fontSize: fontSize.md,
      color: colors.textPrimary,
      marginTop: 2,
    },
    fieldLabel: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    input: {
      backgroundColor: colors.bgInput,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSize.md,
      color: colors.textPrimary,
    },
    sendBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginHorizontal: spacing.lg,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      paddingVertical: 14,
    },
    sendBtnDisabled: {
      opacity: 0.5,
    },
    sendBtnText: {
      color: '#fff',
      fontSize: fontSize.md,
      fontWeight: '600',
    },
  });

export default LocationPicker;
