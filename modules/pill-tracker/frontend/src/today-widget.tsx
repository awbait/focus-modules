import { baseStyles, registerWidget, usePermission } from '@focus-dashboard/sdk-types'
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import React, { useEffect, useRef, useState } from 'react'
import type {
  DoseEntry,
  Patient,
  Styles,
  TodayResponse,
  WidgetProps,
  WidgetSettings,
} from './types'

function TodayApp({ focus }: WidgetProps) {
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [doses, setDoses] = useState<DoseEntry[]>([])
  const [given, setGiven] = useState(0)
  const [total, setTotal] = useState(0)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [skipId, setSkipId] = useState<string | null>(null)
  const [skipReason, setSkipReason] = useState('')
  const [loading, setLoading] = useState(true)
  const canWrite = usePermission(focus, 'write')

  const selectedPatient = patients[selectedIdx] ?? null
  const selectedPatientId = selectedPatient?.id ?? null

  // Ref to track current patient ID for WS event handlers
  const selectedPatientIdRef = useRef(selectedPatientId)
  selectedPatientIdRef.current = selectedPatientId

  const loadDoses = (patientId: string) => {
    focus
      .api<TodayResponse>('GET', `/today?patient=${patientId}`)
      .then((data) => {
        setDoses(data.doses)
        setGiven(data.given)
        setTotal(data.total)
      })
      .catch((err) => console.error('pill-tracker: load doses', err))
  }

  // Init: load patients, saved selection, subscribe to WS events
  useEffect(() => {
    Promise.all([focus.api<Patient[]>('GET', '/patients'), focus.getSettings<WidgetSettings>()])
      .then(([pts, settings]) => {
        setPatients(pts)
        if (pts.length > 0) {
          let idx = 0
          if (settings?.patient_id) {
            const found = pts.findIndex((p) => p.id === settings.patient_id)
            if (found >= 0) idx = found
          }
          setSelectedIdx(idx)
          loadDoses(pts[idx].id)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error('pill-tracker: init', err)
        setLoading(false)
      })

    // Subscribe to dose events — use ref to always read current patient
    const reloadCurrent = () => {
      const id = selectedPatientIdRef.current
      if (id) loadDoses(id)
    }
    const unsub1 = focus.on('dose.given', reloadCurrent)
    const unsub2 = focus.on('dose.skipped', reloadCurrent)
    const unsub3 = focus.on('dose.overdue', reloadCurrent)

    focus.ready()
    return () => {
      unsub1()
      unsub2()
      unsub3()
    }
  }, [focus])

  const switchPatient = (dir: number) => {
    if (patients.length === 0) return
    const next = (selectedIdx + dir + patients.length) % patients.length
    setSelectedIdx(next)
    loadDoses(patients[next].id)
    focus
      .api('PUT', `/widget-settings/${focus.getWidgetId()}`, { patient_id: patients[next].id })
      .catch(() => {})
  }

  const giveDose = (id: string) => {
    focus
      .api('POST', `/doses/${id}/give`)
      .then(() => {
        if (selectedPatientId) loadDoses(selectedPatientId)
        setConfirmId(null)
      })
      .catch((err) => console.error('pill-tracker: give', err))
  }

  const skipDose = (id: string) => {
    focus
      .api('POST', `/doses/${id}/skip`, { reason: skipReason })
      .then(() => {
        if (selectedPatientId) loadDoses(selectedPatientId)
        setSkipId(null)
        setSkipReason('')
      })
      .catch((err) => console.error('pill-tracker: skip', err))
  }

  if (loading) {
    return <div style={styles.container}>...</div>
  }

  if (patients.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>{focus.t('widget.today.noPatients')}</div>
      </div>
    )
  }

  const progressPct = total > 0 ? Math.round((given / total) * 100) : 0

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        {patients.length > 1 && (
          <button type="button" style={styles.navBtn} onClick={() => switchPatient(-1)}>
            <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
          </button>
        )}
        <div style={styles.patientInfo}>
          {selectedPatient?.avatar && <span style={styles.avatar}>{selectedPatient.avatar}</span>}
          <span style={styles.patientName}>{selectedPatient?.name}</span>
        </div>
        {patients.length > 1 && (
          <button type="button" style={styles.navBtn} onClick={() => switchPatient(1)}>
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
          </button>
        )}
        <span style={styles.counter}>
          {given}/{total}
        </span>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressBar, width: `${progressPct}%` }} />
        </div>
      )}

      {/* Dose list */}
      <div style={styles.doseList}>
        {doses.length === 0 ? (
          <div style={styles.empty}>
            {focus.t(total === 0 ? 'widget.today.noDoses' : 'widget.today.allDone')}
          </div>
        ) : (
          doses.map((dose) => (
            <div key={dose.id} style={styles.doseRow}>
              {/* Confirm give overlay */}
              {confirmId === dose.id ? (
                <div style={styles.confirmRow}>
                  <span style={styles.confirmText}>{focus.t('widget.today.confirmGive')}</span>
                  <button type="button" style={styles.confirmBtn} onClick={() => giveDose(dose.id)}>
                    <HugeiconsIcon icon={Tick02Icon} size={16} />
                  </button>
                  <button type="button" style={styles.cancelBtn} onClick={() => setConfirmId(null)}>
                    <HugeiconsIcon icon={Cancel01Icon} size={16} />
                  </button>
                </div>
              ) : skipId === dose.id ? (
                <div style={styles.confirmRow}>
                  <input
                    type="text"
                    placeholder={focus.t('widget.today.skipReason')}
                    value={skipReason}
                    onChange={(e) => setSkipReason(e.target.value)}
                    style={styles.skipInput}
                  />
                  <button type="button" style={styles.confirmBtn} onClick={() => skipDose(dose.id)}>
                    <HugeiconsIcon icon={Tick02Icon} size={16} />
                  </button>
                  <button
                    type="button"
                    style={styles.cancelBtn}
                    onClick={() => {
                      setSkipId(null)
                      setSkipReason('')
                    }}
                  >
                    <HugeiconsIcon icon={Cancel01Icon} size={16} />
                  </button>
                </div>
              ) : (
                <>
                  <div style={styles.doseInfo}>
                    <span style={{ ...styles.statusDot, background: statusColor(dose.status) }} />
                    <div style={styles.doseDetails}>
                      <span style={styles.doseName}>{dose.medication_name}</span>
                      <span style={styles.doseMeta}>
                        {dose.dosage} · {formatTime(dose.planned_at)}
                      </span>
                    </div>
                  </div>
                  <div style={styles.doseActions}>
                    {dose.status === 'given' ? (
                      <span style={styles.givenLabel}>
                        {focus.t('widget.today.given')}
                        {dose.given_by_name && (
                          <span style={styles.givenBy}> · {dose.given_by_name}</span>
                        )}
                      </span>
                    ) : dose.status === 'skipped' ? (
                      <span style={styles.skippedLabel}>{focus.t('widget.today.skipped')}</span>
                    ) : canWrite ? (
                      <>
                        <button
                          type="button"
                          style={styles.giveBtn}
                          onClick={() => setConfirmId(dose.id)}
                        >
                          {focus.t('widget.today.give')}
                        </button>
                        <button
                          type="button"
                          style={styles.skipBtn}
                          onClick={() => setSkipId(dose.id)}
                        >
                          {focus.t('widget.today.skip')}
                        </button>
                      </>
                    ) : (
                      <span style={{ ...styles.statusLabel, color: statusColor(dose.status) }}>
                        {focus.t(`widget.today.${dose.status}`)}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(status: string): string {
  switch (status) {
    case 'given':
      return 'var(--chart-2, #22c55e)'
    case 'skipped':
      return 'var(--muted-foreground, #a1a1aa)'
    case 'overdue':
      return 'var(--destructive, #ef4444)'
    default:
      return 'var(--primary, #3b82f6)'
  }
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Styles = {
  container: {
    ...baseStyles.widget,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    gap: '8px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexShrink: 0,
  },
  navBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius, 0.625rem)',
    background: 'transparent',
    color: 'var(--foreground)',
    cursor: 'pointer',
    fontSize: '1rem',
    flexShrink: 0,
  },
  patientInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    minWidth: 0,
    flex: 1,
  },
  avatar: { fontSize: '1.1rem', flexShrink: 0 },
  patientName: {
    fontSize: '0.875rem',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  counter: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--muted-foreground)',
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  },
  progressTrack: {
    height: '4px',
    borderRadius: '2px',
    background: 'var(--muted, #27272a)',
    overflow: 'hidden',
    flexShrink: 0,
  },
  progressBar: {
    height: '100%',
    borderRadius: '2px',
    background: 'var(--primary)',
    transition: 'width 0.3s ease',
  },
  doseList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    flex: 1,
    overflow: 'auto',
  },
  doseRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 0',
    gap: '8px',
    borderBottom: '1px solid color-mix(in oklch, var(--border) 50%, transparent)',
    minHeight: '36px',
  },
  doseInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
    flex: 1,
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  doseDetails: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  doseName: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  doseMeta: {
    fontSize: '0.6875rem',
    color: 'var(--muted-foreground)',
  },
  doseActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  },
  giveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '26px',
    padding: '0 10px',
    border: '1px solid transparent',
    borderRadius: 'var(--radius, 0.625rem)',
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
    fontSize: '0.6875rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  skipBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '26px',
    padding: '0 8px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius, 0.625rem)',
    background: 'transparent',
    color: 'var(--muted-foreground)',
    fontSize: '0.6875rem',
    cursor: 'pointer',
  },
  confirmRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    width: '100%',
  },
  confirmText: {
    fontSize: '0.75rem',
    flex: 1,
  },
  confirmBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    border: '1px solid transparent',
    borderRadius: 'var(--radius, 0.625rem)',
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  cancelBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius, 0.625rem)',
    background: 'transparent',
    color: 'var(--muted-foreground)',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  skipInput: {
    flex: 1,
    padding: '4px 8px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius, 0.625rem)',
    background: 'transparent',
    color: 'var(--foreground)',
    fontSize: '0.75rem',
    outline: 'none',
  },
  givenLabel: {
    fontSize: '0.6875rem',
    color: 'var(--chart-2, #22c55e)',
    fontWeight: 500,
  },
  givenBy: {
    fontWeight: 400,
    color: 'var(--muted-foreground)',
  },
  skippedLabel: {
    fontSize: '0.6875rem',
    color: 'var(--muted-foreground)',
    fontWeight: 500,
  },
  statusLabel: {
    fontSize: '0.6875rem',
    fontWeight: 500,
  },
  empty: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: '0.8125rem',
    color: 'var(--muted-foreground)',
  },
  disabled: baseStyles.disabled,
}

registerWidget('pill-tracker-today-widget', TodayApp)
