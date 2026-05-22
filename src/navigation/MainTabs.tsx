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
import { colors, fontSize } from '../utils/theme';

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.bgHeader },
  headerTintColor: colors.textPrimary,
  headerBackButtonDisplayMode: 'minimal' as const,
};

// ── Chats tab stack ──────────────────────────────────────────────────
const ChatsStack = createStackNavigator();
const ChatsStackScreen = () => (
  <ChatsStack.Navigator screenOptions={stackScreenOptions}>
    <ChatsStack.Screen
      name="ChatList"
      component={ChatListScreen}
      options={({ navigation }) => ({
        title: 'Chats',
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
      options={{ title: 'Chat' }}
    />
    <ChatsStack.Screen
      name="NewChat"
      component={NewChatScreen as any}
      options={{ title: 'New Chat' }}
    />
    <ChatsStack.Screen
      name="CreateGroup"
      component={CreateGroupScreen as any}
      options={{ title: 'New Group' }}
    />
  </ChatsStack.Navigator>
);

// ── Contacts tab stack ───────────────────────────────────────────────
const ContactsStack = createStackNavigator();
const ContactsStackScreen = () => (
  <ContactsStack.Navigator screenOptions={stackScreenOptions}>
    <ContactsStack.Screen
      name="ContactsList"
      component={ContactsScreen as any}
      options={{ title: 'Contacts' }}
    />
    <ContactsStack.Screen
      name="NewFriends"
      component={NewFriendsScreen}
      options={{ title: 'New Friends' }}
    />
    <ContactsStack.Screen
      name="UserProfile"
      component={UserProfileScreen as any}
      options={{ title: 'Profile' }}
    />
  </ContactsStack.Navigator>
);

// ── Discover tab stack ──────────────────────────────────────────────
const DiscoverStack = createStackNavigator();
const DiscoverStackScreen = () => (
  <DiscoverStack.Navigator screenOptions={stackScreenOptions}>
    <DiscoverStack.Screen
      name="DiscoverMenu"
      component={DiscoverScreen as any}
      options={{ title: 'Discover' }}
    />
    <DiscoverStack.Screen
      name="Channels"
      component={ChannelsScreen as any}
      options={({ navigation }) => ({
        title: 'Channels',
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
      options={{ title: 'Channel' }}
    />
    <DiscoverStack.Screen
      name="CreateChannel"
      component={CreateChannelScreen as any}
      options={{ title: 'New Channel' }}
    />
    <DiscoverStack.Screen
      name="ComposePost"
      component={ComposePostScreen as any}
      options={{ title: 'New Post' }}
    />
    <DiscoverStack.Screen
      name="Moments"
      component={MomentsScreen as any}
      options={({ navigation }) => ({
        title: 'Moments',
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
      options={{ title: 'New Moment' }}
    />
  </DiscoverStack.Navigator>
);

// ── Me tab stack ─────────────────────────────────────────────────────
const MeStack = createStackNavigator();
const MeStackScreen = () => (
  <MeStack.Navigator screenOptions={stackScreenOptions}>
    <MeStack.Screen
      name="MeMain"
      component={MeScreen as any}
      options={{ title: 'Me' }}
    />
    <MeStack.Screen
      name="ProfileEdit"
      component={ProfileEditScreen as any}
      options={{ title: 'Edit Profile' }}
    />
    <MeStack.Screen
      name="Settings"
      component={SettingsScreen as any}
      options={{ title: 'Settings' }}
    />
    <MeStack.Screen
      name="StarredMessages"
      component={StarredMessagesScreen as any}
      options={{ title: 'Starred Messages' }}
    />
    <MeStack.Screen
      name="AccountSecurity"
      component={AccountSecurityScreen as any}
      options={{ title: 'Account Security' }}
    />
    <MeStack.Screen
      name="About"
      component={AboutScreen as any}
      options={{ title: 'About' }}
    />
    <MeStack.Screen
      name="BlockedUsers"
      component={BlockedUsersScreen as any}
      options={{ title: 'Blocked Users' }}
    />
  </MeStack.Navigator>
);

// ── Bottom tabs ──────────────────────────────────────────────────────
const Tab = createBottomTabNavigator();

const MainTabs = () => (
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
      options={{ headerShown: false, tabBarLabel: 'Chats' }}
    />
    <Tab.Screen
      name="ContactsTab"
      component={ContactsStackScreen}
      options={{ headerShown: false, tabBarLabel: 'Contacts' }}
    />
    <Tab.Screen
      name="DiscoverTab"
      component={DiscoverStackScreen}
      options={{ headerShown: false, tabBarLabel: 'Discover' }}
    />
    <Tab.Screen
      name="MeTab"
      component={MeStackScreen}
      options={{ headerShown: false, tabBarLabel: 'Me' }}
    />
  </Tab.Navigator>
);

export default MainTabs;
