import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSize } from '../../utils/theme';

const ContactsScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Contacts</Text>
      <Text style={styles.subtext}>Contacts will be built in Phase 5</Text>
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

export default ContactsScreen;
