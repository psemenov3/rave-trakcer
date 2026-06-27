// Shared palette, button styles and screen styles.

export const COLORS = [
  '#FF2D78', '#00FFD4', '#FFE600', '#FF6B00',
  '#BF5FFF', '#00FF88', '#FF3D3D', '#3DDFFF',
]

export const EMOJIS = ['🦊', '🐺', '🦋', '👽', '🔥', '⚡', '🌙', '💎']

// Primary (filled, glowing) button. `maxWidth` keeps it the same width as the
// secondary button so the two stay centered and aligned.
export const primaryButton = (color = '#FF2D78') => ({
  width: '100%',
  maxWidth: 340,
  padding: '16px',
  background: `linear-gradient(135deg, ${color}, ${color}bb)`,
  border: 'none',
  borderRadius: 14,
  color: '#fff',
  fontSize: 16,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: "'Space Grotesk', sans-serif",
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  boxShadow: `0 0 24px ${color}55`,
  transition: 'all 0.2s',
})

// Secondary (outlined) button.
export const secondaryButton = {
  width: '100%',
  maxWidth: 340,
  padding: '16px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 14,
  color: '#fff',
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: "'Space Grotesk', sans-serif",
  letterSpacing: '0.03em',
}

export const styles = {
  page: {
    minHeight: '100vh',
    background: '#0a0010',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    overflowX: 'hidden',
  },
  glow: (color, size = 300, opacity = 0.13, top, left, bottom, right) => ({
    position: 'fixed',
    width: size,
    height: size,
    borderRadius: '50%',
    filter: 'blur(80px)',
    background: color,
    opacity,
    pointerEvents: 'none',
    zIndex: 0,
    top, left, bottom, right,
  }),
  card: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 24,
    padding: '32px 28px',
    width: '100%',
    maxWidth: 420,
    position: 'relative',
    zIndex: 1,
  },
  input: {
    width: '100%',
    padding: '14px 18px',
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: 14,
    color: '#fff',
    fontSize: 16,
    fontFamily: "'Space Grotesk', sans-serif",
    outline: 'none',
    letterSpacing: '0.02em',
  },
  label: {
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    marginBottom: 8,
    display: 'block',
  },
  title: {
    fontSize: 36,
    fontWeight: 800,
    letterSpacing: '-0.02em',
    background: 'linear-gradient(135deg, #FF2D78, #BF5FFF, #00FFD4)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    lineHeight: 1.1,
  },
  error: {
    background: 'rgba(255,45,120,0.1)',
    border: '1px solid rgba(255,45,120,0.3)',
    borderRadius: 10,
    padding: '10px 14px',
    marginBottom: 20,
    fontSize: 13,
    color: '#FF2D78',
  },
}
