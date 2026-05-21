import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize } from '../../utils/theme';

const DiscoverScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Discover</Text>
      <Text style={styles.subtext}>Channels & Moments will be built in Phase 6</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subtext: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    marginTop: 8,
  },
});

export default DiscoverScreen;
