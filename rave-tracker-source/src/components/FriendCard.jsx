import { useRef } from 'react'
import { bearing, distance, formatDistance } from '../geo.js'

const STALE_MS = 30000

// A single crew member: arrow pointing toward them + distance.
export default function FriendCard({ friend, myPos, compassHeading, compassWorking }) {
  const brng = myPos && friend.location ? bearing(myPos, friend.location) : null
  // Rotation of the up-pointing arrow, clockwise, relative to where the phone
  // is aimed: (bearing to friend) - (compass heading).
  const target = brng !== null ? brng - compassHeading : null
  const dist = myPos && friend.location ? distance(myPos, friend.location) : null
  const stale = friend.lastSeen && Date.now() - friend.lastSeen > STALE_MS

  // Accumulate rotation so the arrow always turns the SHORT way around and
  // never does a full 359deg -> 0deg spin.
  const rot = useRef(0)
  if (target !== null) {
    const delta = (((target - rot.current) % 360) + 540) % 360 - 180
    rot.current += delta
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '20px 16px',
        background: stale ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
        borderRadius: 20,
        border: `1px solid ${stale ? 'rgba(255,255,255,0.08)' : friend.color + '44'}`,
        boxShadow: stale ? 'none' : `0 0 20px ${friend.color}22`,
        flex: '1 1 140px',
        maxWidth: 180,
        transition: 'all 0.3s',
        opacity: stale ? 0.5 : 1,
      }}
    >
      <div style={{ width: 80, height: 80, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid ${friend.color}55`,
            boxShadow: stale ? 'none' : `0 0 16px ${friend.color}33, inset 0 0 16px ${friend.color}11`,
          }}
        />
        {target !== null ? (
          <div
            style={{
              transform: `rotate(${rot.current}deg)`,
              transition: 'transform 0.3s ease-out',
              width: 80,
              height: 80,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: compassWorking ? 1 : 0.4,
            }}
          >
            <svg width="60" height="60" viewBox="0 0 60 60">
              <polygon
                points="30,5 43,45 30,36 17,45"
                fill={friend.color}
                style={{ filter: stale ? 'none' : `drop-shadow(0 0 6px ${friend.color})` }}
              />
              <circle cx="30" cy="30" r="5" fill={friend.color} opacity="0.5" />
            </svg>
          </div>
        ) : (
          <div style={{ fontSize: 28 }}>{friend.emoji}</div>
        )}
        {!compassWorking && target !== null && (
          <div
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#FFE600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              boxShadow: '0 0 6px #FFE60088',
            }}
          >
            !
          </div>
        )}
      </div>

      <div style={{ fontSize: 22 }}>{friend.emoji}</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', textAlign: 'center', letterSpacing: '0.02em' }}>
        {friend.name}
      </div>
      {dist !== null ? (
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: friend.color, fontWeight: 700, letterSpacing: '0.05em' }}>
          {formatDistance(dist)}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          {stale ? 'signal lost' : 'locating…'}
        </div>
      )}
      {stale && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.04em' }}>
          {Math.round((Date.now() - friend.lastSeen) / 1000)}s ago
        </div>
      )}
    </div>
  )
}
