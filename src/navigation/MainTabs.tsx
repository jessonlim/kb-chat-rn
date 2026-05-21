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
import DiscoverScreen from '../screens/discover/DiscoverScreen';
import MeScreen from '../screens/me/MeScreen';
import { colors, fontSize } from '../utils/theme';

// Chats tab has its own stack (list → chat, new chat, create group)
const ChatsStack = createStackNavigator();
const ChatsStackScreen = () => (
  <ChatsStack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.bgHeader },
      headerTintColor: colors.textPrimary,
      headerBackButtonDisplayMode: 'minimal',
    }}
  >
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
        else if (route.name === 'Contacts') iconName = 'people';
        else if (route.name === 'Discover') iconName = 'compass';
        else if (route.name === 'Me') iconName = 'person-circle';
        return <Ionicons name={iconName} size={size} color={color} />;
      },
    })}
  >
    <Tab.Screen
      name="ChatsTab"
      component={ChatsStackScreen}
      options={{ headerShown: false, tabBarLabel: 'Chats' }}
    />
    <Tab.Screen name="Contacts" component={ContactsScreen} />
    <Tab.Screen name="Discover" component={DiscoverScreen} />
    <Tab.Screen name="Me" component={MeScreen} />
  </Tab.Navigator>
);

export default MainTabs;
