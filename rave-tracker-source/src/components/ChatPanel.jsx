import { useState, useRef, useEffect } from 'react'

// Group chat. Messages live at groups/{code}/messages and are passed in already
// sorted oldest -> newest. `myId` identifies which messages are ours.
export default function ChatPanel({ messages, myId, myColor, onSend }) {
  const [draft, setDraft] = useState('')
  const endRef = useRef(null)

  // Keep the latest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submit = (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    onSend(text)
    setDraft('')
  }

  return (
    <div style={{ width: '100%', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          height: '55vh',
          overflowY: 'auto',
          padding: '8px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 14, lineHeight: 1.7 }}>
            No messages yet.
            <br />
            Say hi to your crew 👋
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.id === myId
            return (
              <div key={m.key} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                <div style={{ fontSize: 11, color: m.color || 'rgba(255,255,255,0.5)', fontWeight: 700, marginBottom: 3, letterSpacing: '0.02em' }}>
                  {m.emoji} {mine ? 'You' : m.name}
                </div>
                <div
                  style={{
                    maxWidth: '78%',
                    padding: '9px 13px',
                    borderRadius: 14,
                    background: mine ? `${m.color || '#FF2D78'}22` : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${mine ? (m.color || '#FF2D78') + '55' : 'rgba(255,255,255,0.1)'}`,
                    color: '#fff',
                    fontSize: 14,
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                  }}
                >
                  {m.text}
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={submit}
        style={{
          display: 'flex',
          gap: 8,
          padding: '12px 20px',
          borderTop: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message your crew…"
          maxLength={500}
          style={{
            flex: 1,
            padding: '12px 16px',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 12,
            color: '#fff',
            fontSize: 15,
            fontFamily: "'Space Grotesk', sans-serif",
            outline: 'none',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '0 18px',
            background: `linear-gradient(135deg, ${myColor}, ${myColor}bb)`,
            border: 'none',
            borderRadius: 12,
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          Send
        </button>
      </form>
    </div>
  )
}
