import { useState, useRef, useEffect } from 'react'
import { primaryButton, secondaryButton } from '../styles.js'

// Guided figure-8 calibration. Moving the phone in a figure-8 is what actually
// prompts the OS to recalibrate the magnetometer; this just coaches the user
// through it and gives visual feedback.
export default function CalibrationOverlay({ onDone, compassWorking }) {
  const [phase, setPhase] = useState(0) // 0 intro, 1 tracing, 2 done
  const [progress, setProgress] = useState(0)
  const timer = useRef(null)

  const start = () => {
    setPhase(1)
    setProgress(0)
    timer.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer.current)
          setPhase(2)
          return 100
        }
        return p + 2
      })
    }, 80)
  }

  useEffect(() => () => clearInterval(timer.current), [])

  // Position of the dot tracing the figure-8 path.
  const t = (progress / 100) * Math.PI * 4
  const dot = {
    x: 50 + 28 * Math.sin(t),
    y: 50 + 18 * Math.sin(t * 2) * (progress / 100 < 0.5 ? 1 : -1),
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(10,0,16,0.95)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
      }}
    >
      {phase === 0 && (
        <>
          <div style={{ fontSize: 48, marginBottom: 20 }}>🧭</div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              marginBottom: 12,
              textAlign: 'center',
              background: 'linear-gradient(135deg, #FF2D78, #BF5FFF)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Calibrate Compass
          </div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 15, textAlign: 'center', lineHeight: 1.7, marginBottom: 32 }}>
            {compassWorking
              ? 'Your compass may have drifted. Wave your phone in a figure-8 motion to recalibrate it.'
              : 'Compass permission is needed for the arrows to point the right way.'}
            <br />
            <br />
            Hold your phone flat and trace a figure-8 in the air slowly.
          </div>
          <button style={primaryButton('#BF5FFF')} onClick={start}>
            Start Calibration
          </button>
          <button style={{ ...secondaryButton, marginTop: 12 }} onClick={onDone}>
            Skip
          </button>
        </>
      )}

      {phase === 1 && (
        <>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>
            TRACE THIS PATH
          </div>
          <div style={{ position: 'relative', width: 200, height: 200, marginBottom: 24 }}>
            <svg width="200" height="200" viewBox="0 0 100 100">
              <path
                d="M 50 50 C 50 20 78 20 78 50 C 78 80 50 80 50 50 C 50 20 22 20 22 50 C 22 80 50 80 50 50"
                fill="none"
                stroke="rgba(191,95,255,0.2)"
                strokeWidth="2"
                strokeDasharray="4,3"
              />
              <circle cx={dot.x} cy={dot.y} r="5" fill="#BF5FFF" style={{ filter: 'drop-shadow(0 0 6px #BF5FFF)' }} />
              <circle cx={dot.x} cy={dot.y} r="10" fill="none" stroke="#BF5FFF" strokeWidth="1" opacity="0.4" />
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: 28, opacity: 0.3, pointerEvents: 'none' }}>
              📱
            </div>
          </div>
          <div style={{ width: '100%', maxWidth: 300, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, marginBottom: 12 }}>
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                borderRadius: 2,
                background: 'linear-gradient(90deg, #BF5FFF, #FF2D78)',
                boxShadow: '0 0 8px #BF5FFF88',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em' }}>
            Keep going… {Math.round(progress)}%
          </div>
        </>
      )}

      {phase === 2 && (
        <>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 12, color: '#00FF88', textShadow: '0 0 20px #00FF8866' }}>
            Calibrated!
          </div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, textAlign: 'center', lineHeight: 1.6, marginBottom: 32 }}>
            Your compass should now be accurate.
            <br />
            The arrows will update automatically.
          </div>
          <button style={primaryButton('#00FF88')} onClick={onDone}>
            Back to Tracker
          </button>
        </>
      )}
    </div>
  )
}
