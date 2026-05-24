// QuickActionMenu — a small dropdown menu that appears under the "+" button
// in the chat list header. WeChat-style: 4 actions in one bubble.
//
// Usage:
//   <QuickActionMenu
//     visible={showMenu}
//     onClose={() => setShowMenu(false)}
//     actions={[...]}
//   />

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';

export interface QuickAction {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  actions: QuickAction[];
}

const QuickActionMenu = ({ visible, onClose, actions }: Props) => {
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);

  // Position the bubble so its arrow points roughly at the "+" header button.
  // The status bar height varies between Android and iOS — offset accordingly.
  const topOffset = (Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44) + 50;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          {/* Stop touches inside the menu from closing it */}
          <TouchableWithoutFeedback>
            <View style={[styles.menu, { top: topOffset }]}>
              {/* Arrow pointing up toward the "+" button */}
              <View style={styles.arrow} />
              {actions.map((action, i) => (
                <TouchableOpacity
                  key={action.key}
                  style={[
                    styles.row,
                    i < actions.length - 1 && styles.rowBorder,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    onClose();
                    // Wait a tick so the menu closes before the action runs
                    setTimeout(action.onPress, 50);
                  }}
                >
                  <Ionicons name={action.icon} size={20} color={colors.textPrimary} />
                  <Text style={styles.label}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menu: {
    position: 'absolute',
    right: 12,
    width: 180,
    backgroundColor: colors.bgCard,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    // Subtle elevation/shadow so it pops above the header
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  arrow: {
    position: 'absolute',
    top: -8,
    right: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.bgCard,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
});

export default QuickActionMenu;
