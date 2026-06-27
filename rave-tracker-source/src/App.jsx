import { useState, useRef, useEffect, useCallback } from 'react'
import { ref, set, onValue, remove } from 'firebase/database'
import { db } from './firebase.js'
import { generateCode } from './geo.js'
import { COLORS, EMOJIS, primaryButton, secondaryButton, styles } from './styles.js'
import { useCompass } from './useCompass.js'
import FriendCard from './components/FriendCard.jsx'
import CalibrationOverlay from './components/CalibrationOverlay.jsx'

export default function App() {
  const [screen, setScreen] = useState('home')   // 'home' | 'setup' | 'tracker'
  const [mode, setMode] = useState('create')      // 'create' | 'join'
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(EMOJIS[0])
  const [color, setColor] = useState(COLORS[0])
  const [code, setCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [myPos, setMyPos] = useState(null)
  const [friends, setFriends] = useState([])
  const [gpsStatus, setGpsStatus] = useState('idle')
  const [error, setError] = useState('')
  const [radarAngle, setRadarAngle] = useState(0)
  const [showCalibration, setShowCalibration] = useState(false)

  const { heading, working: compassWorking, requestPermission } = useCompass()

  const myId = useRef(crypto.randomUUID())
  const watchId = useRef(null)
  const unsubscribe = useRef(null)

  // Spinning radar sweep for the "scanning" empty state.
  useEffect(() => {
    const id = setInterval(() => setRadarAngle((a) => (a + 1.5) % 360), 30)
    return () => clearInterval(id)
  }, [])

  // Write my latest position into the group.
  const pushLocation = useCallback(
    async (position, groupCode) => {
      const location = { lat: position.coords.latitude, lng: position.coords.longitude }
      setMyPos(location)
      setGpsStatus('active')
      try {
        await set(ref(db, `groups/${groupCode}/members/${myId.current}`), {
          id: myId.current,
          name,
          emoji,
          color,
          location,
          lastSeen: Date.now(),
        })
      } catch (err) {
        console.warn('Firebase write failed', err)
      }
    },
    [name, emoji, color]
  )

  // Start watching GPS and subscribe to the group's members.
  const startTracking = useCallback(
    (groupCode) => {
      if (!navigator.geolocation) {
        setError('Geolocation not supported.')
        return
      }
      setGpsStatus('requesting')
      watchId.current = navigator.geolocation.watchPosition(
        (position) => pushLocation(position, groupCode),
        () => {
          setError('Location access denied. Allow location and reload.')
          setGpsStatus('error')
        },
        { enableHighAccuracy: true, maximumAge: 4000 }
      )
      unsubscribe.current = onValue(ref(db, `groups/${groupCode}/members`), (snap) => {
        const val = snap.val()
        if (val) setFriends(Object.values(val).filter((m) => m.id !== myId.current))
      })
      setScreen('tracker')
    },
    [pushLocation]
  )

  const handleCreate = () => {
    if (!name.trim()) {
      setError('Enter your name first')
      return
    }
    const newCode = generateCode()
    setCode(newCode)
    requestPermission().then(() => startTracking(newCode))
  }

  const handleJoin = () => {
    if (!name.trim()) {
      setError('Enter your name first')
      return
    }
    if (!joinCode.trim()) {
      setError('Enter the group code')
      return
    }
    const c = joinCode.toUpperCase().trim()
    setCode(c)
    requestPermission().then(() => startTracking(c))
  }

  const leaveGroup = () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current)
    remove(ref(db, `groups/${code}/members/${myId.current}`)).catch(() => {})
    if (unsubscribe.current) unsubscribe.current()
    setFriends([])
    setMyPos(null)
    setGpsStatus('idle')
    setCode('')
    setScreen('home')
  }

  // ---- TRACKER SCREEN -----------------------------------------------------
  if (screen === 'tracker') {
    return (
      <div style={{ ...styles.page, paddingBottom: 40 }}>
        {showCalibration && (
          <CalibrationOverlay compassWorking={compassWorking} onDone={() => setShowCalibration(false)} />
        )}
        <div style={styles.glow('#FF2D78', 400, 0.12, -150, -150)} />
        <div style={styles.glow('#BF5FFF', 250, 0.09, undefined, undefined, 0, -100)} />
        <div style={styles.glow('#00FFD4', 200, 0.07, '40%', '10%')} />

        <div
          style={{
            width: '100%',
            padding: '16px 24px',
            background: 'rgba(10,0,16,0.88)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <span style={styles.label}>GROUP CODE</span>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: '#00FFD4', letterSpacing: '0.15em', textShadow: '0 0 12px #00FFD466' }}>
              {code}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ fontSize: 13 }}>
              {emoji}
              <span style={{ fontSize: 13, color, fontWeight: 700, marginLeft: 5 }}>{name}</span>
            </div>
            <button
              onClick={() => setShowCalibration(true)}
              style={{
                background: compassWorking ? 'rgba(0,255,136,0.1)' : 'rgba(255,230,0,0.12)',
                border: `1px solid ${compassWorking ? 'rgba(0,255,136,0.3)' : 'rgba(255,230,0,0.4)'}`,
                borderRadius: 8,
                padding: '4px 10px',
                cursor: 'pointer',
                color: compassWorking ? '#00FF88' : '#FFE600',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.07em',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              🧭 {compassWorking ? 'RECALIBRATE' : 'CALIBRATE'}
            </button>
          </div>
        </div>

        <div style={{ padding: '8px 24px', width: '100%', zIndex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: gpsStatus === 'active' ? '#00FF88' : '#FFE600', boxShadow: `0 0 6px ${gpsStatus === 'active' ? '#00FF88' : '#FFE600'}` }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>
            {gpsStatus === 'active' ? 'GPS ACTIVE' : 'GETTING LOCATION…'}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginLeft: 8 }}>·</span>
          <span style={{ fontSize: 11, color: compassWorking ? 'rgba(0,255,136,0.5)' : 'rgba(255,230,0,0.5)', letterSpacing: '0.04em' }}>
            {compassWorking ? `COMPASS ${Math.round(heading)}°` : 'COMPASS NOT CALIBRATED'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
            {friends.length} {friends.length === 1 ? 'friend' : 'friends'}
          </span>
        </div>

        {!compassWorking && friends.length > 0 && (
          <div style={{ margin: '0 20px 12px', padding: '12px 16px', background: 'rgba(255,230,0,0.07)', border: '1px solid rgba(255,230,0,0.25)', borderRadius: 14, zIndex: 1, width: 'calc(100% - 40px)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18 }}>🧭</span>
            <div>
              <div style={{ fontSize: 13, color: '#FFE600', fontWeight: 700, marginBottom: 2 }}>Compass needs calibration</div>
              <div style={{ fontSize: 12, color: 'rgba(255,230,0,0.65)', lineHeight: 1.4 }}>
                Arrows may point wrong. Tap <strong>Calibrate</strong> in the top right.
              </div>
            </div>
          </div>
        )}

        <div style={{ margin: '0 20px 20px', padding: '12px 16px', background: 'rgba(0,255,212,0.05)', border: '1px solid rgba(0,255,212,0.15)', borderRadius: 14, zIndex: 1, width: 'calc(100% - 40px)' }}>
          <div style={{ fontSize: 12, color: 'rgba(0,255,212,0.7)', lineHeight: 1.5 }}>
            📡 Share code <strong style={{ letterSpacing: '0.08em' }}>{code}</strong> — friends tap <em>Join Group</em> on the home screen
          </div>
        </div>

        {friends.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, zIndex: 1, gap: 16 }}>
            <svg width="120" height="120" style={{ overflow: 'visible' }}>
              <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,45,120,0.15)" strokeWidth="1" />
              <circle cx="60" cy="60" r="35" fill="none" stroke="rgba(255,45,120,0.1)" strokeWidth="1" />
              <circle cx="60" cy="60" r="20" fill="none" stroke="rgba(255,45,120,0.07)" strokeWidth="1" />
              <line x1="60" y1="60" x2={60 + 50 * Math.sin((radarAngle * Math.PI) / 180)} y2={60 - 50 * Math.cos((radarAngle * Math.PI) / 180)} stroke="#FF2D78" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 4px #FF2D78)' }} />
              <circle cx="60" cy="60" r="4" fill="#FF2D78" style={{ filter: 'drop-shadow(0 0 6px #FF2D78)' }} />
            </svg>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, textAlign: 'center', lineHeight: 1.7 }}>
              Scanning for your crew…
              <br />
              <span style={{ fontSize: 13, opacity: 0.6 }}>
                Share code <strong style={{ color: '#00FFD4' }}>{code}</strong> so they can join
              </span>
            </div>
          </div>
        ) : (
          <div style={{ padding: '0 20px', zIndex: 1, width: '100%', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
            {friends.map((f) => (
              <FriendCard key={f.id} friend={f} myPos={myPos} compassHeading={heading} compassWorking={compassWorking} />
            ))}
          </div>
        )}

        <div style={{ padding: '28px 24px 0', width: '100%', zIndex: 1, display: 'flex', justifyContent: 'center' }}>
          <button style={secondaryButton} onClick={leaveGroup}>Leave Group</button>
        </div>
      </div>
    )
  }

  // ---- SETUP SCREEN -------------------------------------------------------
  if (screen === 'setup') {
    return (
      <div style={{ ...styles.page, padding: '40px 20px', justifyContent: 'center' }}>
        <div style={styles.glow('#FF2D78', 400, 0.12, -150, -150)} />
        <div style={styles.glow('#BF5FFF', 250, 0.09, undefined, undefined, 0, -100)} />
        <div style={styles.card}>
          <button
            onClick={() => setScreen('home')}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.45)', fontSize: 14, cursor: 'pointer', padding: 0, marginBottom: 24, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.05em' }}
          >
            ← BACK
          </button>
          <div style={{ ...styles.title, fontSize: 28, marginBottom: 28 }}>
            {mode === 'create' ? 'Create Group' : 'Join Group'}
          </div>
          {error && <div style={styles.error}>{error}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div>
              <label style={styles.label}>Your Name</label>
              <input
                style={styles.input}
                placeholder="e.g. Alex"
                value={name}
                onChange={(e) => { setName(e.target.value); setError('') }}
                maxLength={20}
              />
            </div>

            <div>
              <label style={styles.label}>Pick Your Vibe</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {EMOJIS.map((em) => (
                  <button
                    key={em}
                    onClick={() => setEmoji(em)}
                    style={{
                      fontSize: 24,
                      cursor: 'pointer',
                      background: emoji === em ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                      border: emoji === em ? '2px solid rgba(255,255,255,0.4)' : '2px solid transparent',
                      borderRadius: 12,
                      padding: '8px 10px',
                      transition: 'all 0.15s',
                    }}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={styles.label}>Your Color</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: c,
                      cursor: 'pointer',
                      border: color === c ? '3px solid #fff' : '3px solid transparent',
                      boxShadow: color === c ? `0 0 12px ${c}` : 'none',
                      transition: 'all 0.15s',
                    }}
                  />
                ))}
              </div>
            </div>

            {mode === 'join' && (
              <div>
                <label style={styles.label}>Group Code</label>
                <input
                  style={{ ...styles.input, fontFamily: "'Space Mono', monospace", fontSize: 22, letterSpacing: '0.2em', textTransform: 'uppercase' }}
                  placeholder="XXXXXX"
                  value={joinCode}
                  onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setError('') }}
                  maxLength={6}
                />
              </div>
            )}

            <button style={primaryButton(color)} onClick={mode === 'create' ? handleCreate : handleJoin}>
              {mode === 'create' ? '🎉 Create Group' : '🔗 Join Group'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---- HOME SCREEN --------------------------------------------------------
  return (
    <div style={{ ...styles.page, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={styles.glow('#FF2D78', 400, 0.12, -150, -150)} />
      <div style={styles.glow('#BF5FFF', 300, 0.09, undefined, undefined, 0, -100)} />
      <div style={styles.glow('#00FFD4', 200, 0.07, '40%', '10%')} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', zIndex: 1, width: '100%', maxWidth: 420 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #FF2D78, #BF5FFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, marginBottom: 24, boxShadow: '0 0 40px #FF2D7866, 0 0 80px #BF5FFF44' }}>
          📡
        </div>
        <div style={{ ...styles.title, textAlign: 'center', marginBottom: 12 }}>FIND YOUR CREW</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 15, textAlign: 'center', lineHeight: 1.6, marginBottom: 48 }}>
          Real-time location tracking for
          <br />
          when the bass drops and you lose everyone
        </div>

        {/* alignItems:center keeps both buttons centered & equal width */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%' }}>
          <button style={primaryButton('#FF2D78')} onClick={() => { setMode('create'); setScreen('setup'); setError('') }}>
            ✦ Create Group
          </button>
          <button style={secondaryButton} onClick={() => { setMode('join'); setScreen('setup'); setError('') }}>
            Join Group
          </button>
        </div>

        <div style={{ marginTop: 48, color: 'rgba(255,255,255,0.2)', fontSize: 12, textAlign: 'center', lineHeight: 1.6 }}>
          Location shared only within your group
          <br />
          and removed when you leave
        </div>
      </div>
    </div>
  )
}
