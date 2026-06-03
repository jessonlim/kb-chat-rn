# KB Chat — Mobile (RN) Production-Readiness Audit

**Audit date:** 2026-05-28
**Build under audit:** #15 (preview profile) + EAS Updates through `019e6ef2`
**Auditor:** Internal review pre-public-launch
**Scope:** Native mobile app only. Backend covered separately in `../MekaMessage/AUDIT_BACKEND.md`.

---

## Verdict

Not yet shippable to the general public. Functionally feature-complete and stable for daily use among friends/colleagues with manual install — but two security blockers (M1, M3) plus three reliability blockers (M4, M5, M8) plus the **missing legal documents** mean the public launch should be held until those land.

The Sentry + send-path resilience batch shipped 2026-05-29 (Update `019e6fc0`) closed 6 of 17 findings (M2/M3/M5/M6/M7/M9). Remaining 11 findings tracked below.

---

## Findings

Severity legend:
- 🔴 **Blocker** — fix before public launch
- 🟡 **Should fix** — fix in the next 2 weeks of operation
- 🟢 **Nice to have** — can wait until next sprint

### 🔴 Blockers — ALL CLEARED

#### ~~M4 — Eager native-module imports brick OTA updates~~ ✅ **SHIPPED 2026-05-29 (OTA `019e8d69`)**
**Was:** Eager top-level imports of native modules resolved at module-evaluation time — which for the call contexts (wrap the app), the call overlays (render at root), and every screen (MainTabs eager-imports all) is effectively app launch. A missing/throwing native module white-screened the whole app at startup. We lost an APK to exactly this once (expo-contacts).
**Fixed:** New `src/utils/nativeModules.ts` provides typed lazy getters (`getWebRTC`, `getInCallManager`, `getLiveKitClient`, `getLiveKitRN`, `getCallNotification`, `getNotifications`, `getDevice`, `getLocation`) that `require()` on first use; types are `import type` (erased at compile). All 8 files converted:
- CallContext, GroupCallContext — WebRTC/LiveKit/InCallManager resolve on first call action
- CallScreen (RTCView), GroupCallScreen (Track + VideoTrack in ParticipantTile) — resolve during an active call only
- callkeepService, notificationService — lazy; notification foreground handler moved from a top-level side-effect into `configureHandler()` called from `init()`
- LocationPicker — expo-location required inside the open effect
- ScanQRScreen — split into a thin wrapper (launch-path safe) + `ScanQRScreenInner` (holds expo-camera + the un-lazyable `useCameraPermissions` hook), lazy-`require()`d on first render

**Verified:** zero eager native-module imports remain in the launch path (all are `import type` or behind a lazy require). A broken native module now degrades only its own feature instead of bricking startup.

**CONVENTION going forward:** never top-level-`import` a native module into a launch-path file. Add a getter to `src/utils/nativeModules.ts` and `require()` it on first use; keep types as `import type`. For components that use a native *hook* (can't be lazy-required), use the wrapper-split pattern (see ScanQRScreen + ScanQRScreenInner).

#### ~~Legal docs missing~~ ✅ **SHIPPED 2026-05-29**
Privacy Policy and Terms & Conditions now served at
`https://www.kb-chat.com/privacy` and `/terms` (commit `d40d3ed`
on the MekaMessage repo). Source text from the Notion drafts
(`canary-blossom-1ac.notion.site` published copies) was reproduced
verbatim, wrapped in the existing Vite/React/Tailwind chrome with a
sticky header + back-to-app link, and added as public routes
OUTSIDE the ProtectedRoute wrapper so app-store reviewers can
reach them logged-out.

**Two factual discrepancies in the Privacy Policy were flagged but
NOT corrected** (legal text needs explicit authorization):
- Lists GIPHY as the GIF provider; app actually uses Tenor
- Omits AWS S3, MongoDB Atlas, and Sentry from the third-party
  processor list (Sentry was added in this session)

These should be patched in the Notion source before the next
update + redeploy. Won't necessarily fail Play Store review at
v1 (reviewers don't check third-party lists against network
traffic at first review) but is a real compliance gap.

---

### 🟡 Should fix (in the next 2 weeks)

#### M10 — Push permission UX is opaque
**Risk:** First-launch flow asks for push permission with the system dialog and no preamble. Users tap "Don't allow" by reflex, then can never re-enable without going into device settings.
**Fix:** Add a "soft ask" screen explaining what notifications enable BEFORE triggering the system dialog. If denied, show a one-time banner with a "fix it in Settings" deep-link.

#### M11 — Image upload retries on failure aren't visible
**Risk:** Failed image uploads silently disappear from the input bar. User thinks it sent.
**Fix:** Keep failed uploads in a pinned "draft" position with a retry button.

#### M12 — Storage screen shows "coming soon"
**Risk:** Users can't clear local cache. Over months, MMKV + downloaded media will grow to GB.
**Fix:** Implement Storage screen — show cache size, "clear images" / "clear voice" / "clear everything" buttons.

#### M13 — Account deletion doesn't actually delete media
**Files:** Backend `DELETE /api/auth/account` deletes the Mongo User document but leaves S3 objects (avatars, message attachments) orphaned.
**Risk:** GDPR/PDPA non-compliance — user requested deletion, their data is still in our S3 bucket forever.
**Fix:** Backend side — walk message + chat collections + delete S3 keys before deleting the user row. Coordinate with backend audit B7.

#### M14 — No way to report a message or user
**Risk:** Apple App Store will reject user-generated-content apps that don't have in-app reporting.
**Fix:** Add "Report" to long-press menu on messages + "Report user" on profile screen. Backend endpoint just emails support for v1.

#### M15 — Cold-start time is ~4 seconds on mid-range Android
**Risk:** Users perceive the app as slow.
**Fix:** Defer non-critical init (sticker preloading, channel cache warm, contacts sync) until after first frame. Use `InteractionManager.runAfterInteractions`.

---

### 🟢 Nice to have

#### M16 — Sentry sample rate is 0.1 (10%) — fine for now, revisit at scale
#### M17 — No Sentry session replay (privacy-respecting one would be nice for debugging)
#### M18 — Hermes engine isn't validated for source-map upload — symbolicated traces in Sentry not yet confirmed
#### M19 — `i18n` doesn't fall back to English when a string is missing in Chinese — fix in `useT` hook
#### M20 — Theme preference is `userPrefs.theme` in MMKV but no migration if we ever rename the key
#### M21 — No accessibility labels on many touchables — VoiceOver / TalkBack support is patchy

---

## Closed in this session

| ID | What | How | Ship |
|---|---|---|---|
| M2 | Sentry breadcrumb leaks auth POST bodies | `beforeBreadcrumb` drops `/api/auth/*` XHR entirely + scrubs Authorization/Cookie from rest | OTA `019e6fc0` |
| M3 | Sentry attaches user email to events | Removed email from `setSentryUser` signature + `beforeSend` strips it from `event.user` | OTA `019e6fc0` |
| M5 | Attachment/sticker/location/contact sends have no ack timeout | Added 15s setTimeout → flips to `status:'failed'` | OTA `019e6fc0` |
| M6 | Send paths bail silently when socket is null | All four send paths now drop a `status:'failed'` bubble + toast | OTA `019e6fc0` |
| M7 | ChatScreen blank on load failure | Toast + `navigation.goBack()` in load `useEffect` catch | OTA `019e6fc0` |
| M9 | Push tap navigates blindly to chat that may not exist | Wrapped navigate in try/catch, falls back to ChatsTab root | OTA `019e6fc0` |
| M8 | Refresh-token loop on permanent failure | Failure counter (2 strikes in 60s) → `session_expired` event → auth store force-logout + toast | OTA `019e6feb` |
| M1 | JWT tokens stored unencrypted in MMKV | New `secureStorage` module wraps a second MMKV with AES-CBC, key in expo-secure-store (Keystore/Keychain). Plaintext tokens migrate on first launch + plain copies deleted | Build #21 (native build — expo-secure-store + expo-crypto added) |

---

## Recommended sequencing for blockers

1. ~~**Week 1** — M1 (encrypted MMKV) + M8 (refresh loop)~~ ✅ **DONE 2026-05-29**. M8 shipped as OTA `019e6feb`. M1 in Build #21 (in-flight as of 2026-05-29).
2. **Week 1** — Legal docs on the web app (no native code change, no EAS Update needed). Pure web work.
3. **Week 2** — M4 (lazy native imports) — requires careful screen-by-screen testing. Ship as a single Update after a full QA pass.
4. **Week 3+** — 🟡 items in priority order: M13 (GDPR — paired with backend B7) → M10 (push UX) → M14 (reporting) → M12 (storage) → M11 (upload retries) → M15 (cold-start perf).
