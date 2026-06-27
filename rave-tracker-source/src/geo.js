// --- Geometry & formatting helpers -----------------------------------------

// Initial bearing (degrees clockwise from north) from point `from` to `to`.
export function bearing(from, to) {
  const dLng = ((to.lng - from.lng) * Math.PI) / 180
  const lat1 = (from.lat * Math.PI) / 180
  const lat2 = (to.lat * Math.PI) / 180
  const y = Math.sin(dLng) * Math.cos(lat2)
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

// Great-circle distance in metres (haversine).
export function distance(from, to) {
  const dLat = ((to.lat - from.lat) * Math.PI) / 180
  const dLng = ((to.lng - from.lng) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return 6371e3 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// "240m" under 1km, "1.3km" above.
export function formatDistance(m) {
  return m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`
}

// Random 6-character uppercase group code.
export function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}
