import { useEffect, useRef } from 'react'

// Keep the screen awake while `active` is true (e.g. on the tracker screen) so
// the phone doesn't auto-lock and stop the GPS feed mid-use. The lock is
// released automatically by the browser when the page is hidden, so we
// re-acquire it whenever the page becomes visible again.
export function useWakeLock(active) {
  const lockRef = useRef(null)

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let cancelled = false

    const acquire = async () => {
      try {
        lockRef.current = await navigator.wakeLock.request('screen')
      } catch {
        /* denied / not allowed (e.g. low battery) — ignore */
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !cancelled) acquire()
    }

    acquire()
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      if (lockRef.current) {
        lockRef.current.release().catch(() => {})
        lockRef.current = null
      }
    }
  }, [active])
}
