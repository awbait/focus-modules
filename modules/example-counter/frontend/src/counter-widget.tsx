// biome-ignore lint/correctness/noUnusedImports: React is required for classic JSX transform
import React, { useCallback, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Styles, ValueResponse, WidgetProps, WidgetSettings } from './types'
import { ReactWidgetElement } from './types'

function CounterApp({ focus }: WidgetProps) {
  const [value, setValue] = useState(0)
  const [step, setStep] = useState(1)
  const [canWrite, setCanWrite] = useState(false)

  const checkPermission = useCallback(() => {
    focus
      .can('write')
      .then(setCanWrite)
      .catch(() => setCanWrite(false))
  }, [focus])

  useEffect(() => {
    checkPermission()

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
  }, [focus, checkPermission])

  // Instant disable on logout; re-check on window focus (other tabs).
  useEffect(() => {
    const onLogout = () => setCanWrite(false)
    const onFocus = () => checkPermission()
    window.addEventListener('auth:unauthorized', onLogout)
    window.addEventListener('focus', onFocus)
    return () => {
      window.removeEventListener('auth:unauthorized', onLogout)
      window.removeEventListener('focus', onFocus)
    }
  }, [checkPermission])

  const guardedAction = useCallback((action: () => Promise<void>) => {
    return () => {
      action().catch((err: Error) => {
        if (err.message.includes('403') || err.message.includes('401')) {
          setCanWrite(false)
        }
        console.error('example-counter:', err)
      })
    }
  }, [])

  const increment = guardedAction(() =>
    focus.api<ValueResponse>('POST', '/increment', { step }).then((data) => setValue(data.value)),
  )

  const decrement = guardedAction(() =>
    focus.api<ValueResponse>('POST', '/decrement', { step }).then((data) => setValue(data.value)),
  )

  const reset = guardedAction(() =>
    focus.api<ValueResponse>('POST', '/reset').then((data) => setValue(data.value)),
  )

  return (
    <div style={styles.container}>
      <div style={styles.value}>{value}</div>
      <div style={styles.controls}>
        <button
          type="button"
          style={{ ...styles.btn, ...(!canWrite ? styles.disabled : {}) }}
          onClick={decrement}
          disabled={!canWrite}
          title={focus.t('widget.counter.decrement')}
        >
          &minus;
        </button>
        <button
          type="button"
          style={{ ...styles.btn, ...styles.resetBtn, ...(!canWrite ? styles.disabled : {}) }}
          onClick={reset}
          disabled={!canWrite}
        >
          {focus.t('widget.counter.reset')}
        </button>
        <button
          type="button"
          style={{ ...styles.btn, ...(!canWrite ? styles.disabled : {}) }}
          onClick={increment}
          disabled={!canWrite}
          title={focus.t('widget.counter.increment')}
        >
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
    fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
    color: 'var(--foreground)',
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
    border: '1px solid var(--border)',
    background: 'color-mix(in oklch, var(--input) 30%, transparent)',
    color: 'var(--foreground)',
    borderRadius: 'var(--radius, 0.625rem)',
    cursor: 'pointer',
    fontSize: '1.25rem',
    fontWeight: 500,
    width: '36px',
    height: '36px',
    transition: 'background 0.15s, transform 0.1s',
  },
  resetBtn: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    width: 'auto',
    padding: '0 12px',
    height: '32px',
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
    border: '1px solid transparent',
  },
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
    pointerEvents: 'none' as const,
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
