/**
 * domovoy-control widget — React component compiled to a Web Component.
 *
 * Build:   bun run build  (inside frontend/)
 * Output:  ../dist/widget.js  (self-contained ES module)
 *
 * The widget fetches its status from the focus-dashboard proxy:
 *   GET  /api/modules/domovoy-control/api/status
 *   POST /api/modules/domovoy-control/api/command
 * which focus-dashboard reverse-proxies to domovoy-control backend (:8090).
 */

import { useState, useEffect, useCallback } from 'react'
import { createRoot } from 'react-dom/client'

const API = '/api/modules/domovoy-control/api'

// ── types ────────────────────────────────────────────────────────
interface Status {
  running: boolean
  state: string
  since?: string
}

// ── styles (inline — no Tailwind / CSS files in widget bundle) ───
const css: Record<string, React.CSSProperties> = {
  root: {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    background: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)',
    borderRadius: 16,
    border: '1px solid rgba(120,120,200,0.2)',
    color: '#c0c0e0',
    fontFamily: 'system-ui,sans-serif',
    boxSizing: 'border-box',
    padding: 16,
    userSelect: 'none',
  },
  icon: { fontSize: '2.2rem', lineHeight: 1 },
  name: { fontWeight: 600, fontSize: 14 },
  status: { fontSize: 11, opacity: 0.55, textAlign: 'center' },
  btn: {
    marginTop: 4,
    padding: '6px 18px',
    background: 'rgba(120,120,220,0.15)',
    border: '1px solid rgba(120,120,220,0.3)',
    borderRadius: 20,
    color: '#a0a0e8',
    fontSize: 11,
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  btnActive: {
    background: 'rgba(120,120,220,0.35)',
    color: '#d0d0ff',
  },
}

// ── React component ──────────────────────────────────────────────
function DomovoyWidget() {
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/status`, { credentials: 'include' })
      if (res.ok) setStatus(await res.json())
    } catch { /* service offline */ }
  }, [])

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, 4000)
    return () => clearInterval(id)
  }, [fetchStatus])

  const sendCommand = async () => {
    setBusy(true)
    try {
      await fetch(`${API}/command`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'listen' }),
      })
      await fetchStatus()
    } finally {
      setBusy(false)
    }
  }

  const stateLabel =
    status === null  ? 'подключение…' :
    !status.running  ? 'офлайн' :
    status.state === 'listening' ? '🎙 слушаю…' :
    status.state

  const isListening = status?.state === 'listening'

  return (
    <div style={css.root}>
      <div style={css.icon}>🏠</div>
      <div style={css.name}>Домовой</div>
      <div style={css.status}>{stateLabel}</div>
      <button
        style={{ ...css.btn, ...(isListening || busy ? css.btnActive : {}) }}
        onClick={sendCommand}
        disabled={busy || isListening}
      >
        {isListening ? '…' : '🎤 Слушать'}
      </button>
    </div>
  )
}

// ── Web Component wrapper ────────────────────────────────────────
class DomovoyControlElement extends HTMLElement {
  private reactRoot: ReturnType<typeof createRoot> | null = null

  connectedCallback() {
    const container = document.createElement('div')
    container.style.cssText = 'width:100%;height:100%;display:contents'
    this.appendChild(container)
    this.reactRoot = createRoot(container)
    this.reactRoot.render(<DomovoyWidget />)
  }

  disconnectedCallback() {
    this.reactRoot?.unmount()
    this.reactRoot = null
  }
}

if (!customElements.get('domovoy-control-widget')) {
  customElements.define('domovoy-control-widget', DomovoyControlElement)
}
