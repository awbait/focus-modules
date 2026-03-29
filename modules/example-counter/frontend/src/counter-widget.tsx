import React, { useState, useEffect, useCallback } from 'react'
import { createRoot } from 'react-dom/client'
import type { WidgetProps, ValueResponse, WidgetSettings, Styles } from './types'
import { ReactWidgetElement } from './types'

function CounterApp({ focus }: WidgetProps) {
  const [value, setValue] = useState(0)
  const [step, setStep] = useState(1)

  useEffect(() => {
    focus
      .getSettings<WidgetSettings>()
      .then((s) => {
        if (s?.step > 0) setStep(s.step)
      })
      .catch(() => {})

    focus
      .api<ValueResponse>('GET', '/value')
      .then((data) => setValue(data.value))
      .catch((err) => console.error('example-counter: load value', err))

    const unsub = focus.on('value.changed', (payload) => {
      const p = payload as ValueResponse
      setValue(p.value)
    })

    focus.ready()
    return unsub
  }, [focus])

  const increment = useCallback(() => {
    focus
      .api<ValueResponse>('POST', '/increment', { step })
      .then((data) => setValue(data.value))
      .catch((err) => console.error('example-counter: increment', err))
  }, [focus, step])

  const decrement = useCallback(() => {
    focus
      .api<ValueResponse>('POST', '/decrement', { step })
      .then((data) => setValue(data.value))
      .catch((err) => console.error('example-counter: decrement', err))
  }, [focus, step])

  const reset = useCallback(() => {
    focus
      .api<ValueResponse>('POST', '/reset')
      .then((data) => setValue(data.value))
      .catch((err) => console.error('example-counter: reset', err))
  }, [focus])

  return (
    <div style={styles.container}>
      <div style={styles.value}>{value}</div>
      <div style={styles.controls}>
        <button style={styles.btn} onClick={decrement} title="Decrement">
          &minus;
        </button>
        <button style={{ ...styles.btn, ...styles.resetBtn }} onClick={reset}>
          Reset
        </button>
        <button style={styles.btn} onClick={increment} title="Increment">
          +
        </button>
      </div>
    </div>
  )
}

const styles: Styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '12px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: 'var(--foreground, #e2e8f0)',
  },
  value: {
    fontSize: '3rem',
    fontWeight: 700,
    lineHeight: 1,
    fontVariantNumeric: 'tabular-nums',
  },
  controls: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid var(--border, #334155)',
    background: 'var(--card, #1e293b)',
    color: 'var(--foreground, #e2e8f0)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1.25rem',
    fontWeight: 600,
    width: '40px',
    height: '40px',
  },
  resetBtn: {
    fontSize: '0.75rem',
    width: 'auto',
    padding: '0 12px',
    height: '32px',
  },
}

class ExampleCounterCounterWidget extends ReactWidgetElement {
  connectedCallback() {
    const focus = window.FocusSDK.create(this)
    this._root = createRoot(this)
    this._root.render(<CounterApp focus={focus} />)
  }
}

customElements.define('example-counter-counter-widget', ExampleCounterCounterWidget)
