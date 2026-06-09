package expo.modules.lockscreen

import android.app.KeyguardManager
import android.content.Context
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoLockScreenModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoLockScreen")

    // Returns true when the device is showing the keyguard (lock screen).
    // Reading KeyguardManager off the UI thread is safe.
    Function("isLocked") {
      val km = appContext.reactContext
        ?.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
      km?.isKeyguardLocked ?: false
    }

    // When (and ONLY when) the device is currently locked, drop the app's task
    // behind the keyguard — like pressing Home, but the keyguard (not the
    // launcher) is revealed because the device is still locked. The Activity is
    // NOT finished (process / socket / JS stay alive), so the next call can ring
    // over the lock screen again.
    //
    // The keyguard check is done HERE, natively, at call-end time — not
    // snapshotted in JS at answer-time — so a user who answered while locked
    // then unlocked mid-call is correctly NOT demoted.
    //
    // setShowWhenLocked(false)+setTurnScreenOn(false) clear the per-instance
    // runtime flags first: without this, OEM keyguards (Samsung) re-surface the
    // activity over the lock screen on the next relayout, popping the app back
    // in front. These APIs are API 27+ (O_MR1); the app's minSdk is 24, so
    // they're version-guarded. The static android:showWhenLocked manifest
    // default is re-read on the next COLD launch, so clearing the runtime flag
    // here is self-resetting and does not break future ringing.
    //
    // NOTE: written WITHOUT an early `return@Function` — a bare return (Unit)
    // confuses the Expo Function overload resolution ("expected Any?, actual
    // Unit"). Plain if-nesting keeps the body a single Unit-typed statement.
    Function("dropBehindKeyguardIfLocked") {
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.runOnUiThread {
          val km = activity.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
          if (km != null && km.isKeyguardLocked) {
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
}
