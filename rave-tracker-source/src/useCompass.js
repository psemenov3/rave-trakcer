import { useState, useRef, useCallback, useEffect } from 'react'

// Current screen rotation in degrees (0 portrait, 90/270 landscape).
// Needed so the arrow stays correct when the phone is held sideways.
function screenAngle() {
  if (typeof screen !== 'undefined' && screen.orientation && typeof screen.orientation.angle === 'number') {
    return screen.orientation.angle
  }
  if (typeof window !== 'undefined' && typeof window.orientation === 'number') {
    return window.orientation
  }
  return 0
}

// Turn a DeviceOrientationEvent into a compass heading: degrees clockwise from
// north for the direction the TOP of the screen is pointing.
function readHeading(e) {
  // iOS gives a ready-made, true-north compass heading (already clockwise).
  if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
    return (e.webkitCompassHeading + screenAngle() + 360) % 360
  }
  // Standards/Android: alpha is counter-clockwise from north -> flip it.
  if (e.alpha != null) {
    return (360 - e.alpha + screenAngle() + 360) % 360
  }
  return null
}

// Compass hook. Returns:
//   heading          smoothed heading in degrees (0 = north, clockwise)
//   working          true once we're receiving orientation readings
//   accuracy         iOS only: heading uncertainty in degrees (-1 = uncalibrated),
//                    or null when the platform doesn't report it (Android/desktop)
//   requestPermission iOS 13+ gesture-triggered permission request
//
// Why the old version pointed the wrong way:
//   * it only listened to "deviceorientation", whose `alpha` on Android is
//     relative to where the phone booted up, NOT true north;
//   * it never compensated for screen rotation;
//   * it averaged 12 raw samples, which lagged badly when you turned.
// This version prefers the absolute (true-north) event, compensates for screen
// angle, and uses light circular smoothing so it's responsive but stable.
export function useCompass() {
  const [heading, setHeading] = useState(0)
  const [working, setWorking] = useState(false)
  const [accuracy, setAccuracy] = useState(null)
  const smooth = useRef(null)        // running {s, c} unit-vector average
  const haveAbsolute = useRef(false) // have we received a true-north reading?

  const onEvent = useCallback((e) => {
    const absolute = e.absolute === true || typeof e.webkitCompassHeading === 'number'
    // Once we have true-north data, ignore the relative fallback entirely.
    if (absolute) haveAbsolute.current = true
    else if (haveAbsolute.current) return

    // iOS exposes a real heading-uncertainty figure; use it to know whether the
    // compass is actually calibrated (negative or large = needs calibration).
    if (typeof e.webkitCompassAccuracy === 'number') {
      setAccuracy(e.webkitCompassAccuracy)
    }

    const h = readHeading(e)
    if (h == null) return

    const rad = (h * Math.PI) / 180
    const s = Math.sin(rad)
    const c = Math.cos(rad)
    const k = 0.25 // smoothing: higher = snappier, lower = smoother
    if (smooth.current == null) {
      smooth.current = { s, c }
    } else {
      smooth.current.s += (s - smooth.current.s) * k
      smooth.current.c += (c - smooth.current.c) * k
    }
    const avg = (Math.atan2(smooth.current.s, smooth.current.c) * 180) / Math.PI
    setHeading((avg + 360) % 360)
    setWorking(true)
  }, [])

  useEffect(() => {
    window.addEventListener('deviceorientationabsolute', onEvent, true)
    window.addEventListener('deviceorientation', onEvent, true)
    return () => {
      window.removeEventListener('deviceorientationabsolute', onEvent, true)
      window.removeEventListener('deviceorientation', onEvent, true)
    }
  }, [onEvent])

  const requestPermission = useCallback(async () => {
    try {
      const DOE = typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : null
      if (DOE && typeof DOE.requestPermission === 'function') {
        await DOE.requestPermission()
      }
    } catch (err) {
      console.warn('Compass permission denied', err)
    }
  }, [])

  return { heading, working, accuracy, requestPermission }
}

// Good-enough heading uncertainty (degrees) to call the compass "calibrated".
export const GOOD_ACCURACY = 20

// Derive a single "calibrated" boolean from working + accuracy.
// On iOS we trust the real accuracy value; elsewhere (accuracy == null) we
// fall back to "are we receiving readings at all".
export function isCalibrated(working, accuracy) {
  if (accuracy == null) return working
  return accuracy >= 0 && accuracy <= GOOD_ACCURACY
}
