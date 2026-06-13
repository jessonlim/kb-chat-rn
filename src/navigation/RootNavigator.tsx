import React, { useMemo } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuth } from '../stores/authStore';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import { useTheme } from '../context/ThemeContext';

const RootNavigator = () => {
  const { user, loading, addingAccount } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // While adding an account, show the auth stack even though another account is
  // still signed in — logging in there switches to the new account (Phase 3).
  return user && !addingAccount ? <MainTabs /> : <AuthStack />;
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  loader: {
    flex: 1,
    backgroundColor: colors.bgDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RootNavigator;
