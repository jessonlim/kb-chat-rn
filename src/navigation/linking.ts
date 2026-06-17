// Deep-link configuration for React Navigation.
//
// We support TWO link formats that resolve to the same screen:
//   kbchat://user/<userId>?u=<username>   — custom scheme, app-only
//   https://kb-chat.com/u/<userId>?u=<username>  — web-friendly, falls
//     back to the browser when the app isn't installed
//
// Both route to ContactsTab → UserProfile. The friend tapping a link
// from WhatsApp / Telegram / SMS will see "Open with KB Chat?" the first
// time (because the backend doesn't host an `assetlinks.json` yet —
// once that lands, Android will auto-route without prompting).

import type { LinkingOptions } from '@react-navigation/native';

export const PREFIXES = [
  'kbchat://',
  'https://kb-chat.com',
  'https://www.kb-chat.com',
];

export const linking: LinkingOptions<any> = {
  prefixes: PREFIXES,
  config: {
    screens: {
      // The user is logged in → MainTabs render. Match /u/:userId to the
      // UserProfile screen inside the Contacts tab.
      ContactsTab: {
        screens: {
          UserProfile: 'u/:userId',
        },
      },
      // Group invite link → join + open the group (GroupJoin self-joins then
      // replaces itself with the chat). Also handles kbchat://group/<chatId>.
      ChatsTab: {
        screens: {
          GroupJoin: 'g/:chatId',
        },
      },
    },
  },
};
