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
- **expo-camera** (QR scanner)
- **expo-location** (location sharing)
- **react-native-svg + react-native-qrcode-svg** (QR generation)
- babel-preset-expo@~54.0.10 (MUST match SDK version)

## What works today

### Auth
- Email/password register + login + logout
- JWT access + refresh tokens, auto-refresh on 401
- Persistent session (MMKV)

### Chats
- Real-time 1-on-1 messaging (text, image, video, voice, file)
- Group chat with admin controls
- Reply / Edit / Delete / Star / Forward / **Multi-react** (👍 ❤️ 😂 😮 😢 🙏 quick chips)
- Typing indicator
- Read receipts (single + double check)
- Unread badges that actually clear (and stay cleared) on reload
- Image viewer (fullscreen)
- Voice recorder + audio player
- In-chat search (replaces "Coming soon" placeholder)
- Shared media gallery (per chat)
- Long-press chat row → Mark unread/read, Sticky on Top, Hide, Delete
- Chat list quick action menu (+ icon → New Chat / Add Contacts / **Scan QR** / Money)
- Chat opens straight to latest message (no flicker)
- **Multi-select messages** — long-press → "Multi-select" → checkbox-tap to add → batch Forward / Delete / Star / Copy
- **Sticker picker** — built-in "KB Chat Pack" of 30 expressive OpenMoji stickers
- **Location sharing** — captures current GPS + reverse-geocoded address, tap bubble to open in maps
- **Contact card sharing** — pick a friend → sends a tappable card → recipient taps to view profile
- **Message info modal** — long-press → "Info" → per-participant delivery + read receipt list
- **Link previews** — first URL in any text message auto-fetches OG metadata (title/image/site)
- **Translation** — long-press → "Translate" — auto-detects Chinese↔English direction
- **Voice-to-text** — long-press a voice message → "Convert to text" → Whisper-style transcription
- **GIF picker (Tenor)** — search + trending grid via backend `/api/gifs` proxy

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
- **Tags** — create custom tags, group contacts (local-only, MMKV-backed)
- Friend request policy (Anyone / Friends of friends / Nobody)
- **Friend remarks** — rename a contact for yourself (local-only) — overrides display name in chats + contacts list + sorting

### Discover
- Channels (text-based posts + comments)
- Moments (social feed) with image upload

### Me
- Profile (avatar + display name + about + username)
- Profile editing (display name, about, avatar upload with center-crop)
- **My QR Code** — generates `https://kb-chat.com/u/<userId>` QR + copy-link action
- Settings — Display (language + theme + **font size**), Notifications, Privacy, Chats (incl. **Hidden chats**), Calls, Storage
- Starred Messages (empty state)
- Account Security (change password, delete account, blocked users)
- About (app info, version, support / privacy / terms links)
- Sign out

### Global features
- **Global search** — search-icon in chat list header → unified screen searching contacts + chats + channels + moments
- **QR scanner** — quick action `+ → Scan` → camera viewfinder with reticle → friend QR auto-opens their profile

### App polish
- Default language: Chinese · toggle to English
- Theme: Auto / Light / Dark (full migration of every screen)
- **Font size: Small / Medium / Large / Extra large** (currently affects message bubble text)
- KB Chat brand icons (white speech bubble on red)
- Notifications use white silhouette icon

## Multi-device sync

Web app + RN app hit the same backend. Both connect to the same Socket.IO server, join the same chat rooms, and receive the same broadcast events. Read receipts, typing, message events, profile changes — all propagate to both devices in real time. No client-side work needed.

## Backend touchpoints expected (graceful degradation if missing)

The RN client now expects (and falls back gracefully from) these endpoints:

| Endpoint | Used by | Fallback |
|---|---|---|
| `POST /api/chats/messages/:id/translate` | Translate action | Toast "translation failed" |
| `POST /api/chats/messages/:id/transcribe` | Voice-to-text action | Toast "transcription failed" |
| `GET /api/chats/messages/:id/info` | Message info modal | Empty receipt lists |
| `GET /api/og?url=...` | Link previews | No card, just plain text URL |
| `GET /api/gifs?q=&trending=&limit=` | GIF picker | Toast "load error" |
| `GET /api/chats/hidden` | Hidden chats screen | Empty state |
| `POST /api/chats/:id/unhide` | Hidden chats unhide btn | Toast error |

## What's left

🚀 **Release**
- Production-signed APK with new native deps (build in progress — Build #15)
- Play Store listing

🟡 Optional polish
- Apply font scaling globally (currently only message bubble text)
- Backend endpoints listed above (translate / transcribe / og / gifs / hidden)
- Embedded map view in location messages (would need react-native-maps + Google Maps API key)
- Multi-pack sticker library (only one pack today)
- Cross-device sync of remarks + tags (currently local-only)

## Latest builds + OTA updates

**Native builds** (require new APK install — bumps native deps or app shell)
- **🆕 Build #20 (preview profile, in progress)** — adds `expo-contacts` for FindFromContactsScreen
  - Triggered 2026-05-28 after the find-friends-from-contacts crash on Build #15
- **Build #15 (preview profile)** — https://expo.dev/artifacts/eas/caswxnjbK9SDYYPScedCwY.apk
  - All 17 WeChat parity features + native deps: expo-camera, expo-location, react-native-svg
  - Built 2026-05-25, ~8m30s, ~$1.50 build credits
- Build #14 (superseded) — https://expo.dev/artifacts/eas/daBWRrttTJrAEeF8hLaVRS.apk · 145 MB
- Dev APK #13 (development profile, needs Metro tunnel): https://expo.dev/artifacts/eas/aiyqhusQYgWsVwLsSVU3EM.apk · 197 MB

**EAS Updates** (OTA hot patches on top of Build #15+, free, ~30 sec ship)

| Update ID | Date | What |
|---|---|---|
| `019e6fc0` | 2026-05-29 | **Quick-wins audit batch** — Sentry PII scrub, ack timeouts, null-socket UX, push-tap guard, ChatScreen goBack on load fail |
| `019e6ef2` | 2026-05-28 | Sentry crash reporting wired in (DSN + auth token via EAS env vars) |
| `019e6013` | 2026-05-28 | Font size visual button refactor + misc UX |
| earlier `0xxx` IDs | — | ~25 prior OTA fixes during the WeChat parity push and post-release polish |

## Production-readiness audit (2026-05-28)

A full two-track audit was run before going live. **17 mobile findings + 14 backend findings.**

See:
- `AUDIT_MOBILE.md` (this folder) — RN client findings
- `AUDIT_BACKEND.md` (in `../MekaMessage/`) — Express/Mongo/Socket.IO findings

**🔴 Blockers before public launch (still pending):**
- M1 — JWT tokens stored unencrypted in MMKV (token migration needed)
- M4 — Multiple eager native-module imports could brick existing APKs on future OTA updates (lazy-require pattern needed in CallContext, GroupCallContext, CallScreen, GroupCallScreen, callkeepService, notificationService, LocationPicker, ScanQRScreen)
- M8 — Refresh-token loop on permanent failure (auth interceptor needs to give up gracefully)
- **Legal docs missing** — Privacy Policy + Terms of Service URLs in About screen point to `kb-chat.com/privacy` and `/terms` which redirect to the blank app shell. Both stores will reject the app at review without these. Need to ship 2 static pages on the web app before submitting.
- B1–B5 backend blockers — see AUDIT_BACKEND.md

**🟢 Shipped this session (via Update `019e6fc0`):**
- M2 — Sentry `sendDefaultPii: false` + `beforeBreadcrumb` drops auth-route XHR/fetch entirely + scrubs Authorization/Cookie headers and bodies elsewhere
- M3 — Sentry `beforeSend` recursive scrub of `password|refreshToken|accessToken|token|phone` + drops `event.user.email` (GDPR/PDPA)
- M5 — 15s ack timeouts on `handleSendAttachment` + `handleSendStructured` (text already had it)
- M6 — All four send paths now drop a `status:'failed'` bubble + toast "no connection" when socket is null at send time
- M7 — ChatScreen toasts + goBack on load failure (chat deleted on other device, kicked from group, etc.)
- M9 — Push-tap navigation wrapped in try/catch, falls back to ChatsTab root

## EAS account
- Plan: **Starter** (upgraded 2026-05-25 from Free tier when monthly quota hit)
- Build credits: ~$45 → ~20-25 Android builds remaining
- Dashboard: https://expo.dev/accounts/meka-games/projects/kb-chat-rn

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
9. **Remarks + Tags are local-only** (MMKV) — if user reinstalls or switches device they're gone. Migrate to backend if cross-device parity matters.
10. **Translation / transcription / OG previews / GIF / hidden-chats** all hit backend endpoints that may not yet exist — clients degrade gracefully (silent or toast error) but features won't be useful until backend implements them.
