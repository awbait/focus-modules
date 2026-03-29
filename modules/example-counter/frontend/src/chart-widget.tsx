import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import type { WidgetProps, HistoryEntry, Styles } from './types'
import { ReactWidgetElement } from './types'

function ChartApp({ focus }: WidgetProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([])

  const loadHistory = useCallback(() => {
    focus
      .api<HistoryEntry[]>('GET', '/history?limit=50')
      .then((data) => {
        const items = Array.isArray(data) ? data : []
        setHistory([...items].reverse())
      })
      .catch((err) => console.error('example-counter: load history', err))
  }, [focus])

  useEffect(() => {
    loadHistory()
    const unsub = focus.on('value.changed', loadHistory)
    focus.ready()
    return unsub
  }, [focus, loadHistory])

  return (
    <div style={styles.container}>
      <div style={styles.header}>{focus.t('widget.chart.title')}</div>
      <div style={styles.chartContainer}>
        {history.length === 0 ? (
          <div style={styles.empty}>{focus.t('widget.chart.empty')}</div>
        ) : (
          <LineChart history={history} />
        )}
      </div>
    </div>
  )
}

interface LineChartProps {
  history: HistoryEntry[]
}

const PADDING = { top: 20, right: 16, bottom: 28, left: 40 }
const WIDTH = 400
const HEIGHT = 200
const CHART_W = WIDTH - PADDING.left - PADDING.right
const CHART_H = HEIGHT - PADDING.top - PADDING.bottom

function LineChart({ history }: LineChartProps) {
  const { points, gridLines } = useMemo(() => {
    const values = history.map((e) => e.value)
    const min = Math.min(...values, 0)
    const max = Math.max(...values, 1)
    const range = max - min || 1

    const pts = values.map((v, i) => ({
      x: PADDING.left + (i / Math.max(values.length - 1, 1)) * CHART_W,
      y: PADDING.top + CHART_H - ((v - min) / range) * CHART_H,
    }))

    const lines: { y: number; label: number }[] = []
    for (let i = 0; i <= 4; i++) {
      lines.push({
        y: PADDING.top + (i / 4) * CHART_H,
        label: Math.round(max - (i / 4) * range),
      })
    }

    return { points: pts, gridLines: lines }
  }, [history])

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')

  const areaPath = [
    `M ${points[0].x},${PADDING.top + CHART_H}`,
    ...points.map((p) => `L ${p.x},${p.y}`),
    `L ${points[points.length - 1].x},${PADDING.top + CHART_H}`,
    'Z',
  ].join(' ')

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%' }}
    >
      {gridLines.map((g, i) => (
        <g key={i}>
          <line
            x1={PADDING.left}
            y1={g.y}
            x2={PADDING.left + CHART_W}
            y2={g.y}
            stroke="var(--border, #334155)"
            strokeWidth={0.5}
            strokeDasharray="4,4"
          />
          <text
            x={PADDING.left - 6}
            y={g.y + 4}
            textAnchor="end"
            fill="var(--muted-foreground, #94a3b8)"
            fontSize={10}
          >
            {g.label}
          </text>
        </g>
      ))}
      <path d={areaPath} fill="var(--primary, #3b82f6)" opacity={0.1} />
      <polyline
        points={polyline}
        fill="none"
        stroke="var(--primary, #3b82f6)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--primary, #3b82f6)" />
      ))}
    </svg>
  )
}

const styles: Styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
    color: 'var(--foreground)',
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

class ExampleCounterChartWidget extends ReactWidgetElement {
  connectedCallback() {
    const focus = window.FocusSDK.create(this)
    this._root = createRoot(this)
    this._root.render(<ChartApp focus={focus} />)
  }
}

customElements.define('example-counter-chart-widget', ExampleCounterChartWidget)
