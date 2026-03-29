const { createElement: h, useState, useEffect, useCallback } = window.React
const { createRoot } = window.ReactDOM

function CounterApp({ focus }) {
  const [value, setValue] = useState(0)
  const [step, setStep] = useState(1)

  useEffect(() => {
    focus.getSettings().then((s) => {
      if (s && s.step > 0) setStep(s.step)
    }).catch(() => {})

    focus.api('GET', '/value').then((data) => {
      setValue(data.value)
    }).catch((err) => console.error('example-counter: load value', err))

    const unsub = focus.on('value.changed', (payload) => {
      setValue(payload.value)
    })

    focus.ready()
    return unsub
  }, [focus])

  const increment = useCallback(() => {
    focus.api('POST', '/increment', { step }).then((data) => setValue(data.value))
      .catch((err) => console.error('example-counter: increment', err))
  }, [focus, step])

  const decrement = useCallback(() => {
    focus.api('POST', '/decrement', { step }).then((data) => setValue(data.value))
      .catch((err) => console.error('example-counter: decrement', err))
  }, [focus, step])

  const reset = useCallback(() => {
    focus.api('POST', '/reset').then((data) => setValue(data.value))
      .catch((err) => console.error('example-counter: reset', err))
  }, [focus])

  return h('div', { style: styles.container },
    h('div', { style: styles.value }, value),
    h('div', { style: styles.controls },
      h('button', { style: styles.btn, onClick: decrement, title: 'Decrement' }, '\u2212'),
      h('button', { style: { ...styles.btn, ...styles.resetBtn }, onClick: reset }, 'Reset'),
      h('button', { style: styles.btn, onClick: increment, title: 'Increment' }, '+'),
    ),
  )
}

const styles = {
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

class ExampleCounterCounterWidget extends HTMLElement {
  connectedCallback() {
    const focus = window.FocusSDK.create(this)
    this._root = createRoot(this)
    this._root.render(h(CounterApp, { focus }))
  }

  disconnectedCallback() {
    if (this._root) {
      this._root.unmount()
      this._root = null
    }
  }
}

customElements.define('example-counter-counter-widget', ExampleCounterCounterWidget)
