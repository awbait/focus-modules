const { createElement: h, useState, useEffect, useCallback, useMemo } = window.React
const { createRoot } = window.ReactDOM

function ChartApp({ focus }) {
  const [history, setHistory] = useState([])

  const loadHistory = useCallback(() => {
    focus.api('GET', '/history?limit=50').then((data) => {
      const items = Array.isArray(data) ? data : []
      // API returns newest first — reverse for chronological order
      setHistory([...items].reverse())
    }).catch((err) => console.error('example-counter: load history', err))
  }, [focus])

  useEffect(() => {
    loadHistory()
    const unsub = focus.on('value.changed', loadHistory)
    focus.ready()
    return unsub
  }, [focus, loadHistory])

  return h('div', { style: styles.container },
    h('div', { style: styles.header }, 'Counter History'),
    h('div', { style: styles.chartContainer },
      history.length === 0
        ? h('div', { style: styles.empty }, 'No data yet')
        : h(LineChart, { history }),
    ),
  )
}

function LineChart({ history }) {
  const padding = { top: 20, right: 16, bottom: 28, left: 40 }
  const width = 400
  const height = 200
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const { points, gridLines } = useMemo(() => {
    const values = history.map((e) => e.value)
    const min = Math.min(...values, 0)
    const max = Math.max(...values, 1)
    const r = max - min || 1

    const pts = values.map((v, i) => ({
      x: padding.left + (i / Math.max(values.length - 1, 1)) * chartW,
      y: padding.top + chartH - ((v - min) / r) * chartH,
      v,
    }))

    const lines = []
    for (let i = 0; i <= 4; i++) {
      lines.push({
        y: padding.top + (i / 4) * chartH,
        label: Math.round(max - (i / 4) * r),
      })
    }

    return { points: pts, gridLines: lines }
  }, [history])

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')

  const areaPath = [
    `M ${points[0].x},${padding.top + chartH}`,
    ...points.map((p) => `L ${p.x},${p.y}`),
    `L ${points[points.length - 1].x},${padding.top + chartH}`,
    'Z',
  ].join(' ')

  return h('svg', {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: 'xMidYMid meet',
    style: { width: '100%', height: '100%' },
  },
    // Grid lines
    ...gridLines.map((g, i) => h('g', { key: `g${i}` },
      h('line', {
        x1: padding.left, y1: g.y,
        x2: padding.left + chartW, y2: g.y,
        stroke: 'var(--border, #334155)',
        strokeWidth: 0.5,
        strokeDasharray: '4,4',
      }),
      h('text', {
        x: padding.left - 6, y: g.y + 4,
        textAnchor: 'end',
        fill: 'var(--muted-foreground, #94a3b8)',
        fontSize: 10,
      }, g.label),
    )),
    // Area fill
    h('path', {
      d: areaPath,
      fill: 'var(--primary, #3b82f6)',
      opacity: 0.1,
    }),
    // Line
    h('polyline', {
      points: polyline,
      fill: 'none',
      stroke: 'var(--primary, #3b82f6)',
      strokeWidth: 2,
      strokeLinejoin: 'round',
    }),
    // Dots
    ...points.map((p, i) => h('circle', {
      key: `d${i}`,
      cx: p.x, cy: p.y, r: 3,
      fill: 'var(--primary, #3b82f6)',
    })),
  )
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: 'var(--foreground, #e2e8f0)',
  },
  header: {
    fontSize: '0.875rem',
    fontWeight: 600,
    padding: '8px 12px 4px',
    opacity: 0.7,
  },
  chartContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 8px 8px',
    minHeight: 0,
  },
  empty: {
    fontSize: '0.8rem',
    opacity: 0.5,
    textAlign: 'center',
  },
}

class ExampleCounterChartWidget extends HTMLElement {
  connectedCallback() {
    const focus = window.FocusSDK.create(this)
    this._root = createRoot(this)
    this._root.render(h(ChartApp, { focus }))
  }

  disconnectedCallback() {
    if (this._root) {
      this._root.unmount()
      this._root = null
    }
  }
}

customElements.define('example-counter-chart-widget', ExampleCounterChartWidget)
