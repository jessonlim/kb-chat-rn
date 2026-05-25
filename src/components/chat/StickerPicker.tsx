// Bottom sheet sticker picker. Single built-in pack ("KB Chat Pack")
// backed by remote OpenMoji PNGs on jsDelivr — keeps the APK small.
// When the user taps a sticker, the parent receives the URL and sends
// it as a message with type='sticker'.
//
// Adding more packs later: extend the PACKS array and switch the tab bar
// to scroll horizontally between them (WeChat-style).

import React, { useMemo } from 'react';
import {
  View,
  Modal,
  Pressable,
  FlatList,
  Image,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useT } from '../../i18n/I18nContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';

// OpenMoji black-and-white minimalist emoji set — free for any use under
// CC BY-SA 4.0. We bundle a curated set of expressive faces + gestures.
// Codepoints from https://openmoji.org/library/
const KBCHAT_PACK_BASE =
  'https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@15.1.0/color/618x618';

const KBCHAT_PACK_CODEPOINTS = [
  '1F600', // 😀 grinning
  '1F602', // 😂 joy
  '1F60D', // 😍 heart eyes
  '1F970', // 🥰 smiling face with hearts
  '1F61C', // 😜 wink tongue
  '1F914', // 🤔 thinking
  '1F644', // 🙄 eye roll
  '1F62D', // 😭 loud crying
  '1F621', // 😡 pouting
  '1F92F', // 🤯 exploding head
  '1F632', // 😲 astonished
  '1F634', // 😴 sleeping
  '1F60E', // 😎 cool
  '1F973', // 🥳 partying
  '1F44D', // 👍 thumbs up
  '1F44F', // 👏 clap
  '1F64F', // 🙏 folded hands
  '1F4AA', // 💪 muscle
  '1F525', // 🔥 fire
  '2764',  // ❤️ red heart
  '1F389', // 🎉 party popper
  '1F381', // 🎁 gift
  '1F37B', // 🍻 beers
  '1F436', // 🐶 dog face
  '1F431', // 🐱 cat face
  '1F40D', // 🐍 snake
  '1F984', // 🦄 unicorn
  '1F31F', // 🌟 glowing star
  '1F308', // 🌈 rainbow
  '1F4A9', // 💩 poo
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (stickerUrl: string) => void;
}

const StickerPicker = ({ visible, onClose, onPick }: Props) => {
  const { colors } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const stickers = useMemo(
    () =>
      KBCHAT_PACK_CODEPOINTS.map((cp) => ({
        url: `${KBCHAT_PACK_BASE}/${cp}.png`,
        code: cp,
      })),
    []
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>{t('sticker.title')}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>

          <Text style={styles.packName}>{t('sticker.packKB')}</Text>

          <FlatList
            data={stickers}
            keyExtractor={(s) => s.code}
            numColumns={4}
            contentContainerStyle={styles.grid}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.cell}
                activeOpacity={0.7}
                onPress={() => {
                  onPick(item.url);
                  onClose();
                }}
              >
                <Image source={{ uri: item.url }} style={styles.sticker} resizeMode="contain" />
              </TouchableOpacity>
            )}
          />
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
      maxHeight: '65%',
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
    },
    title: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    packName: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
      paddingBottom: spacing.sm,
      fontSize: fontSize.xs,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    grid: {
      paddingHorizontal: spacing.md,
    },
    cell: {
      flex: 1 / 4,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xs,
    },
    sticker: {
      width: '100%',
      height: '100%',
    },
  });

export default StickerPicker;
