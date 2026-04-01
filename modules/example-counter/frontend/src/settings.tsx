import type { FocusInstance } from '@focus-dashboard/sdk-types'
import { baseStyles, registerWidget, usePermission } from '@focus-dashboard/sdk-types'
import React, { useEffect, useState } from 'react'
import type { Styles, WidgetSettings } from './types'

function SettingsApp({ focus }: { focus: FocusInstance }) {
  const [step, setStep] = useState(1)
  const [saved, setSaved] = useState(false)
  const canAdmin = usePermission(focus, 'admin')

  useEffect(() => {
    focus
      .api<WidgetSettings>('GET', '/settings')
      .then((s) => {
        if (s?.step > 0) setStep(s.step)
      })
      .catch(() => {})
  }, [focus])

  const save = () => {
    focus
      .api('PUT', '/settings', { step })
      .then(() => {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      })
      .catch((err) => console.error('example-counter: save settings', err))
  }

  return (
    <div style={styles.container}>
      <div style={styles.field}>
        <label htmlFor="ec-step" style={styles.label}>
          {focus.t('settings.step')}
        </label>
        <p style={styles.description}>{focus.t('settings.stepDescription')}</p>
        <input
          id="ec-step"
          type="number"
          min={1}
          max={100}
          value={step}
          onChange={(e) => setStep(Math.max(1, Number(e.target.value)))}
          style={styles.input}
        />
      </div>
      <button
        type="button"
        onClick={save}
        style={{ ...styles.saveBtn, ...(!canAdmin ? styles.disabled : {}) }}
        disabled={!canAdmin}
      >
        {focus.t('settings.save')}
      </button>
      {saved && <span style={styles.savedMsg}>{focus.t('settings.saved')}</span>}
    </div>
  )
}

const styles: Styles = {
  container: {
    ...baseStyles.widget,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '8px 0',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  description: {
    fontSize: '0.75rem',
    color: 'var(--muted-foreground)',
    margin: 0,
  },
  input: {
    marginTop: '4px',
    padding: '8px 12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius, 0.625rem)',
    background: 'transparent',
    color: 'var(--foreground)',
    fontSize: '0.875rem',
    width: '100px',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  saveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    height: '36px',
    padding: '0 16px',
    border: '1px solid transparent',
    borderRadius: 'var(--radius, 0.625rem)',
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
    fontSize: '0.875rem',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'opacity 0.15s, transform 0.1s',
  },
  savedMsg: {
    fontSize: '0.75rem',
    color: 'var(--primary)',
  },
  disabled: baseStyles.disabled,
}

registerWidget('example-counter-settings', SettingsApp)
