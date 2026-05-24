import React from 'react';
import { TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import ChatListScreen from '../screens/chats/ChatListScreen';
import ChatScreen from '../screens/chats/ChatScreen';
import NewChatScreen from '../screens/chats/NewChatScreen';
import CreateGroupScreen from '../screens/chats/CreateGroupScreen';
import ContactsScreen from '../screens/contacts/ContactsScreen';
import NewFriendsScreen from '../screens/contacts/NewFriendsScreen';
import UserProfileScreen from '../screens/contacts/UserProfileScreen';
import DiscoverScreen from '../screens/discover/DiscoverScreen';
import ChannelsScreen from '../screens/discover/ChannelsScreen';
import ChannelDetailScreen from '../screens/discover/ChannelDetailScreen';
import CreateChannelScreen from '../screens/discover/CreateChannelScreen';
import ComposePostScreen from '../screens/discover/ComposePostScreen';
import MomentsScreen from '../screens/discover/MomentsScreen';
import ComposeMomentScreen from '../screens/discover/ComposeMomentScreen';
import MeScreen from '../screens/me/MeScreen';
import ProfileEditScreen from '../screens/me/ProfileEditScreen';
import SettingsScreen from '../screens/me/SettingsScreen';
import StarredMessagesScreen from '../screens/me/StarredMessagesScreen';
import AccountSecurityScreen from '../screens/me/AccountSecurityScreen';
import AboutScreen from '../screens/me/AboutScreen';
import BlockedUsersScreen from '../screens/me/BlockedUsersScreen';
import { useT } from '../i18n/I18nContext';
import { useTheme } from '../context/ThemeContext';
import { fontSize } from '../utils/theme';

const useStackScreenOptions = () => {
  const { colors } = useTheme();
  return {
    headerStyle: { backgroundColor: colors.bgHeader },
    headerTintColor: colors.textPrimary,
    headerBackButtonDisplayMode: 'minimal' as const,
  };
};

// ── Chats tab stack ──────────────────────────────────────────────────
const ChatsStack = createStackNavigator();
const ChatsStackScreen = () => {
  const { t } = useT();
  const { colors } = useTheme();
  const stackScreenOptions = useStackScreenOptions();
  return (
    <ChatsStack.Navigator screenOptions={stackScreenOptions}>
      <ChatsStack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={({ navigation }) => ({
          title: t('chats.title'),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('NewChat')}
              activeOpacity={0.7}
              style={{ paddingRight: 16 }}
            >
              <Ionicons name="create-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          ),
        })}
      />
      <ChatsStack.Screen
        name="ChatScreen"
        component={ChatScreen as any}
        options={{ title: t('tab.chats') }}
      />
      <ChatsStack.Screen
        name="NewChat"
        component={NewChatScreen as any}
        options={{ title: t('chats.newChat') }}
      />
      <ChatsStack.Screen
        name="CreateGroup"
        component={CreateGroupScreen as any}
        options={{ title: t('group.newGroup') }}
      />
    </ChatsStack.Navigator>
  );
};

// ── Contacts tab stack ───────────────────────────────────────────────
const ContactsStack = createStackNavigator();
const ContactsStackScreen = () => {
  const { t } = useT();
  const stackScreenOptions = useStackScreenOptions();
  return (
    <ContactsStack.Navigator screenOptions={stackScreenOptions}>
      <ContactsStack.Screen
        name="ContactsList"
        component={ContactsScreen as any}
        options={{ title: t('contacts.title') }}
      />
      <ContactsStack.Screen
        name="NewFriends"
        component={NewFriendsScreen}
        options={{ title: t('contacts.newFriends') }}
      />
      <ContactsStack.Screen
        name="UserProfile"
        component={UserProfileScreen as any}
        options={{ title: t('profile.title') }}
      />
    </ContactsStack.Navigator>
  );
};

// ── Discover tab stack ──────────────────────────────────────────────
const DiscoverStack = createStackNavigator();
const DiscoverStackScreen = () => {
  const { t } = useT();
  const { colors } = useTheme();
  const stackScreenOptions = useStackScreenOptions();
  return (
    <DiscoverStack.Navigator screenOptions={stackScreenOptions}>
      <DiscoverStack.Screen
        name="DiscoverMenu"
        component={DiscoverScreen as any}
        options={{ title: t('discover.title') }}
      />
      <DiscoverStack.Screen
        name="Channels"
        component={ChannelsScreen as any}
        options={({ navigation }) => ({
          title: t('channels.title'),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('CreateChannel')}
              activeOpacity={0.7}
              style={{ paddingRight: 16 }}
            >
              <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          ),
        })}
      />
      <DiscoverStack.Screen
        name="ChannelDetail"
        component={ChannelDetailScreen as any}
        options={{ title: t('channels.info') }}
      />
      <DiscoverStack.Screen
        name="CreateChannel"
        component={CreateChannelScreen as any}
        options={{ title: t('channels.create.title') }}
      />
      <DiscoverStack.Screen
        name="ComposePost"
        component={ComposePostScreen as any}
        options={{ title: t('channels.compose') }}
      />
      <DiscoverStack.Screen
        name="Moments"
        component={MomentsScreen as any}
        options={({ navigation }) => ({
          title: t('moments.title'),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate('ComposeMoment')}
              activeOpacity={0.7}
              style={{ paddingRight: 16 }}
            >
              <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          ),
        })}
      />
      <DiscoverStack.Screen
        name="ComposeMoment"
        component={ComposeMomentScreen as any}
        options={{ title: t('moments.compose') }}
      />
    </DiscoverStack.Navigator>
  );
};

// ── Me tab stack ─────────────────────────────────────────────────────
const MeStack = createStackNavigator();
const MeStackScreen = () => {
  const { t } = useT();
  const stackScreenOptions = useStackScreenOptions();
  return (
    <MeStack.Navigator screenOptions={stackScreenOptions}>
      <MeStack.Screen
        name="MeMain"
        component={MeScreen as any}
        options={{ title: t('tab.me') }}
      />
      <MeStack.Screen
        name="ProfileEdit"
        component={ProfileEditScreen as any}
        options={{ title: t('settings.section.profile') }}
      />
      <MeStack.Screen
        name="Settings"
        component={SettingsScreen as any}
        options={{ title: t('settings.title') }}
      />
      <MeStack.Screen
        name="StarredMessages"
        component={StarredMessagesScreen as any}
        options={{ title: t('me.starredMessages') }}
      />
      <MeStack.Screen
        name="AccountSecurity"
        component={AccountSecurityScreen as any}
        options={{ title: t('settings.section.security') }}
      />
      <MeStack.Screen
        name="About"
        component={AboutScreen as any}
        options={{ title: t('settings.section.about') }}
      />
      <MeStack.Screen
        name="BlockedUsers"
        component={BlockedUsersScreen as any}
        options={{ title: t('privacy.blocked.title') }}
      />
    </MeStack.Navigator>
  );
};

// ── Bottom tabs ──────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  const { t } = useT();
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.bgHeader },
        headerTintColor: colors.textPrimary,
        tabBarStyle: {
          backgroundColor: colors.bgHeader,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: fontSize.xs },
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'chatbubbles';
          if (route.name === 'ChatsTab') iconName = 'chatbubbles';
          else if (route.name === 'ContactsTab') iconName = 'people';
          else if (route.name === 'DiscoverTab') iconName = 'compass';
          else if (route.name === 'MeTab') iconName = 'person-circle';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="ChatsTab"
        component={ChatsStackScreen}
        options={{ headerShown: false, tabBarLabel: t('tab.chats') }}
      />
      <Tab.Screen
        name="ContactsTab"
        component={ContactsStackScreen}
        options={{ headerShown: false, tabBarLabel: t('tab.contacts') }}
      />
      <Tab.Screen
        name="DiscoverTab"
        component={DiscoverStackScreen}
        options={{ headerShown: false, tabBarLabel: t('tab.discover') }}
      />
      <Tab.Screen
        name="MeTab"
        component={MeStackScreen}
        options={{ headerShown: false, tabBarLabel: t('tab.me') }}
      />
    </Tab.Navigator>
  );
};

export default MainTabs;
