// Tiny pub/sub for auth-lifecycle events that originate from the
// non-React layer (axios interceptors, socket handlers) and need to
// reach React state (the auth store) without creating import cycles
// between the two.
//
// We deliberately don't use a full event-emitter library — the API
// surface is small enough that a plain Set of listeners is clearer
// and avoids one more dependency.
//
// Current events:
//   session_expired
//     Fired when the axios refresh-token flow gives up. The auth
//     store reacts by logging the user out + showing the "session
//     expired" toast. Wiring this avoids the audit-flagged failure
//     mode where the refresh interceptor cleared tokens but the
//     auth state still believed the user was logged in, leaving them
//     on a half-broken shell where every subsequent request 401'd.

type AuthEvent = 'session_expired';
type Listener = () => void;

const listeners: Record<AuthEvent, Set<Listener>> = {
  session_expired: new Set(),
};

export const authEvents = {
  on(event: AuthEvent, fn: Listener): () => void {
    listeners[event].add(fn);
    return () => listeners[event].delete(fn);
  },
  emit(event: AuthEvent) {
    listeners[event].forEach((fn) => {
      try {
        fn();
      } catch (err) {
        // One bad listener shouldn't block the others
        console.warn('[authEvents] listener for', event, 'threw', err);
      }
    });
  },
};
