// Location acquisition that works in two environments:
//   • Web / installed PWA  -> navigator.geolocation (foreground only)
//   • Capacitor native app -> @capacitor-community/background-geolocation,
//     which keeps updating with the screen off / app backgrounded.
//
// Native detection goes through Capacitor's runtime global so the WEB bundle
// needs no Capacitor dependency at all — nothing here changes the website.

function nativeCapacitor() {
  const C = typeof window !== 'undefined' ? window.Capacitor : undefined
  return C && C.isNativePlatform && C.isNativePlatform() ? C : null
}

function startWeb(onUpdate, onError) {
  if (!navigator.geolocation) {
    onError(new Error('Geolocation not supported'))
    return () => {}
  }
  const id = navigator.geolocation.watchPosition(
    (pos) => onUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    (err) => onError(err),
    { enableHighAccuracy: true, maximumAge: 4000 }
  )
  return () => navigator.geolocation.clearWatch(id)
}

async function startNative(C, onUpdate, onError) {
  // Registered by name — the native plugin is bundled at build time via
  // `npx cap sync`; on web this branch never runs.
  const BG = C.registerPlugin('BackgroundGeolocation')
  const id = await BG.addWatcher(
    {
      backgroundTitle: 'Find Your Crew',
      backgroundMessage: 'Sharing your location with your crew.',
      requestPermissions: true,
      stale: false,
      distanceFilter: 10, // metres of movement before a new fix (battery-friendly)
    },
    (location, error) => {
      if (error) {
        onError(error)
        return
      }
      if (location) onUpdate({ lat: location.latitude, lng: location.longitude })
    }
  )
  return () => {
    BG.removeWatcher({ id })
  }
}

// Start watching location. Returns a Promise resolving to a stop() function.
// onUpdate receives { lat, lng }; onError receives an Error.
export async function startLocationWatch(onUpdate, onError) {
  const C = nativeCapacitor()
  if (C) {
    try {
      return await startNative(C, onUpdate, onError)
    } catch (e) {
      onError(e)
      return () => {}
    }
  }
  return startWeb(onUpdate, onError)
}
