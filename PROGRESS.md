# KB Chat — RN app progress

Native React Native + Expo client. Replaces the Capacitor wrapper. Same backend as the web app (api.kb-chat.com).

## Stack

- Expo SDK 54, RN 0.81, **Old Architecture** (required — WebRTC + LiveKit break on New Arch)
- TypeScript
- React Navigation 7 (stack + bottom tabs)
- Socket.IO (real-time)
- @livekit/react-native-webrtc (only webrtc module — used by both call paths)
- livekit-client + @livekit/react-native (group calls)
- react-native-mmkv@2.12.2 (NOT v3 — v3+ needs New Arch)
- react-native-incall-manager (audio routing)
- expo-notifications + Firebase (push)
- react-native-full-screen-notification-incoming-call (CallKeep lock-screen UI)
- rn-emoji-keyboard
- expo-image-manipulator
- babel-preset-expo@~54.0.10 (MUST match SDK version)

## What works today

### Auth
- Email/password register + login + logout
- JWT access + refresh tokens, auto-refresh on 401
- Persistent session (MMKV)

### Chats
- Real-time 1-on-1 messaging (text, image, video, voice, file)
- Group chat with admin controls
- Reply / Edit / Delete / Star / Forward / 👍 React
- Typing indicator
- Read receipts (single + double check)
- Unread badges that actually clear (and stay cleared) on reload
- Image viewer (fullscreen)
- Voice recorder + audio player
- In-chat search (replaces "Coming soon" placeholder)
- Shared media gallery (per chat)
- Long-press chat row → Mark unread/read, Sticky on Top, Hide, Delete
- Chat list quick action menu (+ icon → New Chat / Add Contacts / Scan / Money)
- Chat opens straight to latest message (no flicker)

### ChatInfo (3-dot menu inside a chat)
- Participant tiles + add-people for groups
- Search history → opens in-chat search
- Photos and Videos → shared media gallery
- Mute Notifications / Sticky on Top toggles (backend-persisted)
- Strong Notifications (local pref)
- Clear Chat History
- Leave Group (group chats only)
- Background / Report — placeholders

### Calls
- 1-on-1 voice + video (WebRTC P2P direct)
- Group voice + video (LiveKit Room)
- Lock-screen incoming call UI (CallKeep)
- Mute / camera / speaker / hang-up controls
- Ringing screen with avatar + caller name

### Contacts
- Friend list (alphabetical, WeChat-style)
- New Friends search (full username only, for privacy) → Add Friend button → friend request
- Pending friend requests with Accept/Reject
- Group Chats listing
- Blocked Users management
- Tags row (placeholder)
- Friend request policy (Anyone / Friends of friends / Nobody)

### Discover
- Channels (text-based posts + comments)
- Moments (social feed) with image upload

### Me
- Profile (avatar + display name + about + username)
- Profile editing (display name, about, avatar upload with center-crop)
- Settings — Display (language + theme), Notifications, Privacy, Chats, Calls, Storage
- Starred Messages (empty state)
- Account Security (change password, delete account, blocked users)
- About (app info, version, support / privacy / terms links)
- Sign out

### App polish
- Default language: Chinese · toggle to English
- Theme: Auto / Light / Dark (full migration of every screen)
- KB Chat brand icons (white speech bubble on red)
- Notifications use white silhouette icon

## What's left (see also the TaskList)

🔴 **High priority for WeChat parity**
- QR code (mine + scanner)
- Multi-select messages
- Friend remarks
- Global search
- Stickers
- Location sharing
- Contact card sharing

🟡 **Medium**
- Message info modal
- Link previews
- Voice-to-text
- GIF picker
- Multi-device sync

🟢 **Smaller**
- Emoji picker for reactions (replace hardcoded 👍)
- Font size scaling
- Contact tags
- Hidden chats manager
- Message translation

🚀 **Release**
- Production-signed APK (currently building only the dev profile, 200MB)
- Play Store listing

## Latest builds
- **Production APK #14** (preview profile, standalone, no Metro): https://expo.dev/artifacts/eas/daBWRrttTJrAEeF8hLaVRS.apk · 145 MB — **use this for distribution**
- Dev APK #13 (development profile, needs Metro tunnel): https://expo.dev/artifacts/eas/aiyqhusQYgWsVwLsSVU3EM.apk · 197 MB
- Tunnel URL when developing: `http://hpl2q0e-limjesson-8081.exp.direct`

## Build profiles in eas.json
- `development` — dev-client + Metro tunnel, source maps, ~200 MB (for active development)
- `preview` — production bundle in APK form, signed, no Metro, ~145 MB (for sharing with testers)
- `production` — AAB format for Play Store upload (untested)

## Key gotchas if you come back to this

1. **react-native-mmkv must stay on v2.x** (v3+ needs New Arch we can't enable)
2. **babel-preset-expo must be ~54.0.10** to match SDK 54
3. **`metro.config.js` disables `unstable_enablePackageExports`** — don't re-enable, it breaks legacy package internal imports
4. **postinstall patch script** (`scripts/patch-reanimated.js`, misnamed) — patches 2 things on every npm install
5. **Avatar URL resolution** — use the `useMediaUrl` hook from `src/hooks/`. Never prefix URIs manually (file:// / content:// / s3:// / data: are all handled)
6. **/api/contacts/requests** (plural) is the pending-requests endpoint, not `/pending`
7. **The Pending friend request endpoint matters** — if you call `Promise.all` with the contacts list and one fails, the whole list blanks. Use `Promise.allSettled`
8. **ObjectId casting in backend** — when writing to subdocument arrays (`readBy.user`, etc.), explicitly cast to `new mongoose.Types.ObjectId(userId)` or the aggregation later won't match it
