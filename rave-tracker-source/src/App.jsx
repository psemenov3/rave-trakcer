import { useState, useRef, useEffect, useCallback } from 'react'
import { ref, set, onValue, remove, onDisconnect, push } from 'firebase/database'
import { db } from './firebase.js'
import { generateCode } from './geo.js'
import { COLORS, EMOJIS, primaryButton, secondaryButton, styles } from './styles.js'
import { useCompass, isCalibrated } from './useCompass.js'
import FriendCard from './components/FriendCard.jsx'
import CalibrationOverlay from './components/CalibrationOverlay.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import { useWakeLock } from './useWakeLock.js'
import { startLocationWatch } from './locationService.js'

// Bump this on each release; it shows on the home screen.
const VERSION = 'v4.6.0'

// Drop members from the radar if we haven't seen an update in this long.
const FRESH_MS = 3 * 60 * 1000

// Load the saved profile (name/emoji/color) from previous visits.
function loadProfile() {
  try {
    return {
      name: localStorage.getItem('rt_name') || '',
      emoji: localStorage.getItem('rt_emoji') || EMOJIS[0],
      color: localStorage.getItem('rt_color') || COLORS[0],
    }
  } catch {
    return { name: '', emoji: EMOJIS[0], color: COLORS[0] }
  }
}

// Style for the Radar / Chat toggle buttons.
const tabStyle = (active) => ({
  flex: 1,
  padding: '8px',
  background: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
  border: active ? '1px solid rgba(255,255,255,0.25)' : '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  color: active ? '#fff' : 'rgba(255,255,255,0.5)',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: "'Space Grotesk', sans-serif",
  letterSpacing: '0.04em',
})

export default function App() {
  const [screen, setScreen] = useState('home')   // 'home' | 'setup' | 'tracker'
  const [mode, setMode] = useState('create')      // 'create' | 'join'
  const [name, setName] = useState(() => loadProfile().name)
  const [emoji, setEmoji] = useState(() => loadProfile().emoji)
  const [color, setColor] = useState(() => loadProfile().color)
  const [code, setCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [myPos, setMyPos] = useState(null)
  const [friends, setFriends] = useState([])
  const [gpsStatus, setGpsStatus] = useState('idle')
  const [error, setError] = useState('')
  const [radarAngle, setRadarAngle] = useState(0)
  const [showCalibration, setShowCalibration] = useState(false)
  const [copied, setCopied] = useState(false)
  const [view, setView] = useState('radar') // 'radar' | 'chat'
  const [messages, setMessages] = useState([])
  const [unread, setUnread] = useState(0)
  const [codeCopied, setCodeCopied] = useState(false)

  const { heading, working, accuracy, requestPermission } = useCompass()
  useWakeLock(screen === 'tracker') // keep the screen awake while tracking
  // compassWorking now means "is the compass actually calibrated".
  const compassWorking = isCalibrated(working, accuracy)

  const myId = useRef(crypto.randomUUID())
  const stopWatch = useRef(null) // function to stop the location watch
  const unsubscribe = useRef(null)
  const messagesUnsub = useRef(null)
  const lastSeenMsgs = useRef(0)
  const armedRef = useRef(null) // 'me' | 'group'

  // Spinning radar sweep — only runs while the empty "scanning" state is on
  // screen, so it doesn't re-render the whole app when friends are present.
  const radarActive = screen === 'tracker' && view === 'radar' && friends.length === 0
  useEffect(() => {
    if (!radarActive) return
    const id = setInterval(() => setRadarAngle((a) => (a + 1.5) % 360), 30)
    return () => clearInterval(id)
  }, [radarActive])

  // Remember the profile across visits.
  useEffect(() => {
    try {
      localStorage.setItem('rt_name', name)
      localStorage.setItem('rt_emoji', emoji)
      localStorage.setItem('rt_color', color)
    } catch {}
  }, [name, emoji, color])

  // Track unread chat messages while the radar view is showing.
  useEffect(() => {
    if (view === 'chat') {
      lastSeenMsgs.current = messages.length
      setUnread(0)
    } else {
      setUnread(Math.max(0, messages.length - lastSeenMsgs.current))
    }
  }, [messages, view])

  // Write my latest position into the group.
  const pushLocation = useCallback(
    async (location, groupCode) => {
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

      const meRef = ref(db, `groups/${groupCode}/members/${myId.current}`)
      const groupRef = ref(db, `groups/${groupCode}`)
      // Default: if we disconnect, remove just our own member record.
      onDisconnect(meRef).remove()
      armedRef.current = 'me'

      startLocationWatch(
        (loc) => pushLocation(loc, groupCode),
        () => {
          setError('Location access denied. Allow location and reload.')
          setGpsStatus('error')
        }
      ).then((stop) => {
        stopWatch.current = stop
      })

      unsubscribe.current = onValue(ref(db, `groups/${groupCode}/members`), (snap) => {
        const val = snap.val()
        // Exclude ourselves and any "ghost" members not seen in a while, so
        // stale records don't haunt the list (or keep the group alive).
        const others = val
          ? Object.values(val).filter(
              (m) => m.id !== myId.current && Date.now() - (m.lastSeen || 0) < FRESH_MS
            )
          : []
        setFriends(others)
        // If we're the LAST member, re-arm our disconnect to wipe the whole
        // group. Only re-register when this actually changes — not every tick.
        const desired = others.length === 0 ? 'group' : 'me'
        if (armedRef.current !== desired) {
          if (desired === 'group') {
            onDisconnect(meRef).cancel()
            onDisconnect(groupRef).remove()
          } else {
            onDisconnect(groupRef).cancel()
            onDisconnect(meRef).remove()
          }
          armedRef.current = desired
        }
      })

      messagesUnsub.current = onValue(ref(db, `groups/${groupCode}/messages`), (snap) => {
        const val = snap.val()
        const list = val
          ? Object.entries(val)
              .map(([key, m]) => ({ key, ...m }))
              .sort((a, b) => a.ts - b.ts)
              .slice(-100)
          : []
        setMessages(list)
      })

      setScreen('tracker')
    },
    [pushLocation]
  )

  const sendMessage = (text) => {
    if (!code) return
    push(ref(db, `groups/${code}/messages`), {
      id: myId.current,
      name,
      emoji,
      color,
      text,
      ts: Date.now(),
    }).catch((e) => console.warn('Message send failed', e))
  }

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
    if (stopWatch.current) { stopWatch.current(); stopWatch.current = null }
    const meRef = ref(db, `groups/${code}/members/${myId.current}`)
    const groupRef = ref(db, `groups/${code}`)
    onDisconnect(meRef).cancel().catch(() => {})
    onDisconnect(groupRef).cancel().catch(() => {})
    // Last one out removes the whole group (members + messages).
    if (friends.length === 0) {
      remove(groupRef).catch(() => {})
    } else {
      remove(meRef).catch(() => {})
    }
    if (unsubscribe.current) unsubscribe.current()
    if (messagesUnsub.current) messagesUnsub.current()
    setFriends([])
    setMessages([])
    setMyPos(null)
    setGpsStatus('idle')
    setCode('')
    setView('radar')
    armedRef.current = null
    setScreen('home')
  }

  // Share the group code via the native share sheet, with a clipboard fallback.
  const shareCode = async () => {
    const url = window.location.origin
    const text = `Find your crew 📡 Join my group on ${url} with code ${code}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Find Your Crew', text, url })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      /* user cancelled or share failed — ignore */
    }
  }

  // Copy just the group code (tap the code in the header).
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 1500)
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  // ---- TRACKER SCREEN -----------------------------------------------------
  if (screen === 'tracker') {
    return (
      <div style={{ ...styles.page, paddingBottom: 40 }}>
        {showCalibration && (
          <CalibrationOverlay calibrated={compassWorking} accuracy={accuracy} onDone={() => setShowCalibration(false)} />
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
            <div
              onClick={copyCode}
              title="Tap to copy"
              style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: '#00FFD4', letterSpacing: '0.15em', textShadow: '0 0 12px #00FFD466', cursor: 'pointer' }}
            >
              {code}{' '}
              <span style={{ fontSize: 12, color: codeCopied ? '#00FF88' : 'rgba(255,255,255,0.35)' }}>
                {codeCopied ? '✓ copied' : '⧉'}
              </span>
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
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: gpsStatus === 'active' ? '#00FF88' : gpsStatus === 'error' ? '#FF3D3D' : '#FFE600', boxShadow: `0 0 6px ${gpsStatus === 'active' ? '#00FF88' : gpsStatus === 'error' ? '#FF3D3D' : '#FFE600'}` }} />
          <span style={{ fontSize: 11, color: gpsStatus === 'error' ? 'rgba(255,61,61,0.85)' : 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>
            {gpsStatus === 'active' ? 'GPS ACTIVE' : gpsStatus === 'error' ? 'LOCATION BLOCKED' : 'GETTING LOCATION…'}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginLeft: 8 }}>·</span>
          <span style={{ fontSize: 11, color: compassWorking ? 'rgba(0,255,136,0.5)' : 'rgba(255,230,0,0.5)', letterSpacing: '0.04em' }}>
            {compassWorking ? `COMPASS ${Math.round(heading)}°${accuracy != null && accuracy >= 0 ? ` ±${Math.round(accuracy)}°` : ''}` : 'COMPASS NOT CALIBRATED'}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>
            {friends.length} {friends.length === 1 ? 'friend' : 'friends'}
          </span>
        </div>

        {gpsStatus === 'error' && error && (
          <div style={{ margin: '0 20px 8px', padding: '10px 14px', background: 'rgba(255,61,61,0.1)', border: '1px solid rgba(255,61,61,0.3)', borderRadius: 12, fontSize: 12, color: '#FF6B6B', lineHeight: 1.4, zIndex: 1, width: 'calc(100% - 40px)' }}>
            {error}
          </div>
        )}

        {/* Radar / Chat toggle */}
        <div style={{ display: 'flex', gap: 8, padding: '8px 20px 4px', width: '100%', zIndex: 1 }}>
          <button onClick={() => setView('radar')} style={tabStyle(view === 'radar')}>📡 Radar</button>
          <button onClick={() => setView('chat')} style={tabStyle(view === 'chat')}>
            💬 Chat{unread > 0 ? ` (${unread})` : ''}
          </button>
        </div>

        <div style={{ padding: '0 20px 6px', fontSize: 11, color: 'rgba(255,255,255,0.28)', textAlign: 'center', lineHeight: 1.4, zIndex: 1 }}>
          📱 Keep this screen open to stay on your crew&apos;s map
        </div>

        {view === 'radar' && (
          <>
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
          <button
            onClick={shareCode}
            style={{
              marginTop: 10,
              width: '100%',
              padding: '10px',
              background: 'rgba(0,255,212,0.12)',
              border: '1px solid rgba(0,255,212,0.3)',
              borderRadius: 10,
              color: '#00FFD4',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '0.05em',
            }}
          >
            {copied ? '✓ Copied to clipboard' : '📤 Share Code'}
          </button>
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

          </>
        )}

        {view === 'chat' && (
          <ChatPanel messages={messages} myId={myId.current} myColor={color} onSend={sendMessage} />
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

        <div style={{ marginTop: 16, color: 'rgba(255,255,255,0.18)', fontSize: 11, fontFamily: "'Space Mono', monospace", letterSpacing: '0.1em' }}>
          {VERSION}
        </div>
      </div>
    </div>
  )
}
