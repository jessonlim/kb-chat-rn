package expo.modules.lockscreen

import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoLockScreenModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoLockScreen")

    // Synchronous: returns true when the device is showing the keyguard
    // (lock screen). Runs on the JS thread; reading KeyguardManager state
    // off the UI thread is safe. Kept as a diagnostic / convenience helper —
    // the authoritative end-time gate lives inside dropBehindKeyguardIfLocked
    // so the check and the action happen atomically on the UI thread.
    Function("isLocked") {
      val context: Context = appContext.reactContext
        ?: return@Function false
      val keyguardManager =
        context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
          ?: return@Function false
      keyguardManager.isKeyguardLocked
    }

    // Synchronous: when (and ONLY when) the device is currently locked,
    // drop the app's task behind the keyguard — like pressing Home, but the
    // keyguard (not the launcher) is revealed because the device is still
    // locked. The Activity is NOT finished (process / socket / JS stay
    // alive), so the next call can ring over the lock screen again.
    //
    // The keyguard check is done HERE, natively, at call-end time — not
    // snapshotted in JS at answer-time — so a user who answered while locked
    // then unlocked mid-call is correctly NOT demoted.
    //
    // setShowWhenLocked(false)+setTurnScreenOn(false) clear the per-instance
    // runtime flags first: without this, OEM keyguards (Samsung) re-surface
    // the activity over the lock screen on the next relayout, popping the app
    // back in front. These APIs are API 27+, so they're version-guarded; the
    // app's minSdk is 24. The static android:showWhenLocked manifest default
    // is re-read on the next COLD launch of a fresh activity, so clearing the
    // runtime flag here is self-resetting and does not break future ringing.
    //
    // The whole sequence (read keyguard + clear flags + moveTaskToBack) must
    // run on the UI thread, so we hop onto the Activity's main looper.
    Function("dropBehindKeyguardIfLocked") {
      val activity = appContext.currentActivity ?: return@Function
      activity.runOnUiThread {
        val keyguardManager =
          activity.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
        if (keyguardManager != null && keyguardManager.isKeyguardLocked) {
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            activity.setShowWhenLocked(false)
            activity.setTurnScreenOn(false)
          }
          activity.moveTaskToBack(true)
        }
      }
    }
  }
}
