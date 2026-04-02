import type { FocusInstance, FocusPublicUser } from '@focus-dashboard/sdk-types'
import { baseStyles, registerWidget, usePermission } from '@focus-dashboard/sdk-types'
import React, { useEffect, useState } from 'react'
import type { Medication, Patient, Prescription, Schedule, Styles } from './types'

// ---------------------------------------------------------------------------
// Emoji presets for avatar picker
// ---------------------------------------------------------------------------

const HUMAN_EMOJIS = [
  '\u{1F9D1}',
  '\u{1F468}',
  '\u{1F469}',
  '\u{1F474}',
  '\u{1F475}',
  '\u{1F466}',
  '\u{1F467}',
  '\u{1F476}',
]
const ANIMAL_EMOJIS = [
  '\u{1F415}',
  '\u{1F408}',
  '\u{1F439}',
  '\u{1F430}',
  '\u{1F426}',
  '\u{1F40D}',
  '\u{1F420}',
  '\u{1F422}',
]

// ---------------------------------------------------------------------------
// Main settings component
// ---------------------------------------------------------------------------

function SettingsApp({ focus }: { focus: FocusInstance }) {
  const canAdmin = usePermission(focus, 'admin')

  const [patients, setPatients] = useState<Patient[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [platformUsers, setPlatformUsers] = useState<FocusPublicUser[]>([])

  // Forms
  const [showAddPatient, setShowAddPatient] = useState(false)
  const [showAddMed, setShowAddMed] = useState(false)
  const [showAddPrescript, setShowAddPrescript] = useState(false)
  const [showAddSchedule, setShowAddSchedule] = useState(false)

  // Plain functions for event handlers (reused after CRUD operations)
  const loadPatients = () => {
    focus
      .api<Patient[]>('GET', '/patients')
      .then(setPatients)
      .catch(() => {})
  }

  const loadMedications = () => {
    focus
      .api<Medication[]>('GET', '/medications')
      .then(setMedications)
      .catch(() => {})
  }

  const loadPrescriptions = (patientId: string) => {
    focus
      .api<Prescription[]>('GET', `/prescriptions?patient_id=${patientId}`)
      .then(setPrescriptions)
      .catch(() => {})
  }

  const loadSchedules = (prescriptionId: string) => {
    focus
      .api<Schedule[]>('GET', `/schedules?prescription_id=${prescriptionId}`)
      .then(setSchedules)
      .catch(() => {})
  }

  // Initial data load — inline to avoid dependency chain issues
  useEffect(() => {
    focus
      .api<Patient[]>('GET', '/patients')
      .then(setPatients)
      .catch(() => {})
    focus
      .api<Medication[]>('GET', '/medications')
      .then(setMedications)
      .catch(() => {})
    focus
      .getUsers()
      .then(setPlatformUsers)
      .catch(() => {})
  }, [focus])

  // Primitive dependency: react only to ID changes, not object reference
  const selectedPatientId = selectedPatient?.id ?? null
  useEffect(() => {
    if (selectedPatientId) {
      focus
        .api<Prescription[]>('GET', `/prescriptions?patient_id=${selectedPatientId}`)
        .then(setPrescriptions)
        .catch(() => {})
    } else {
      setPrescriptions([])
    }
  }, [selectedPatientId, focus])

  const selectedPrescriptionId = selectedPrescription?.id ?? null
  useEffect(() => {
    if (selectedPrescriptionId) {
      focus
        .api<Schedule[]>('GET', `/schedules?prescription_id=${selectedPrescriptionId}`)
        .then(setSchedules)
        .catch(() => {})
    } else {
      setSchedules([])
    }
  }, [selectedPrescriptionId, focus])

  const confirmDelete = (action: () => void) => {
    if (window.confirm(focus.t('settings.confirmDelete'))) {
      action()
    }
  }

  return (
    <div style={styles.root}>
      {/* ---------- Patients ---------- */}
      <Section title={focus.t('settings.patients')}>
        {patients.map((p) => (
          <ListItem
            key={p.id}
            label={`${p.avatar || ''} ${p.name}`}
            sublabel={focus.t(`types.${p.type}`)}
            selected={selectedPatient?.id === p.id}
            onClick={() => {
              setSelectedPatient(p)
              setSelectedPrescription(null)
            }}
            onDelete={
              canAdmin
                ? () => {
                    confirmDelete(() => {
                      focus
                        .api('DELETE', `/patients/${p.id}`)
                        .then(loadPatients)
                        .catch(() => {})
                    })
                  }
                : undefined
            }
          />
        ))}
        {canAdmin && (
          <AddButton
            label={focus.t('settings.addPatient')}
            onClick={() => setShowAddPatient(true)}
          />
        )}
        {showAddPatient && (
          <AddPatientForm
            focus={focus}
            platformUsers={platformUsers}
            onDone={() => {
              setShowAddPatient(false)
              loadPatients()
            }}
          />
        )}
      </Section>

      {/* ---------- Medications (catalog) ---------- */}
      <Section title={focus.t('settings.medications')}>
        {medications.map((m) => (
          <ListItem
            key={m.id}
            label={m.name}
            sublabel={`${focus.t(`forms.${m.form}`)} \u00B7 ${focus.t(`targetTypes.${m.target_type}`)}`}
            onDelete={
              canAdmin
                ? () => {
                    confirmDelete(() => {
                      focus
                        .api('DELETE', `/medications/${m.id}`)
                        .then(loadMedications)
                        .catch(() => {})
                    })
                  }
                : undefined
            }
          />
        ))}
        {canAdmin && (
          <AddButton
            label={focus.t('settings.addMedication')}
            onClick={() => setShowAddMed(true)}
          />
        )}
        {showAddMed && (
          <AddMedicationForm
            focus={focus}
            onDone={() => {
              setShowAddMed(false)
              loadMedications()
            }}
          />
        )}
      </Section>

      {/* ---------- Prescriptions ---------- */}
      <Section title={focus.t('settings.prescriptions')}>
        {!selectedPatient ? (
          <EmptyHint text={focus.t('settings.selectPatient')} />
        ) : (
          <>
            {prescriptions.map((pr) => {
              const med = medications.find((m) => m.id === pr.medication_id)
              return (
                <ListItem
                  key={pr.id}
                  label={med?.name ?? pr.medication_id}
                  sublabel={`${pr.dosage} \u00B7 ${focus.t(`settings.${pr.status}`)}`}
                  selected={selectedPrescription?.id === pr.id}
                  onClick={() => setSelectedPrescription(pr)}
                  onDelete={
                    canAdmin
                      ? () => {
                          confirmDelete(() => {
                            focus
                              .api('DELETE', `/prescriptions/${pr.id}`)
                              .then(() => loadPrescriptions(selectedPatient.id))
                              .catch(() => {})
                          })
                        }
                      : undefined
                  }
                />
              )
            })}
            {canAdmin && (
              <AddButton
                label={focus.t('settings.addPrescription')}
                onClick={() => setShowAddPrescript(true)}
              />
            )}
            {showAddPrescript && (
              <AddPrescriptionForm
                focus={focus}
                patientId={selectedPatient.id}
                medications={medications}
                patientType={selectedPatient.type}
                onDone={() => {
                  setShowAddPrescript(false)
                  loadPrescriptions(selectedPatient.id)
                }}
              />
            )}
          </>
        )}
      </Section>

      {/* ---------- Schedules ---------- */}
      <Section title={focus.t('settings.schedules')}>
        {!selectedPrescription ? (
          <EmptyHint text={focus.t('settings.selectPrescription')} />
        ) : (
          <>
            {schedules.map((s) => (
              <ListItem
                key={s.id}
                label={s.time}
                sublabel={
                  s.days.length === 0
                    ? focus.t('settings.everyday')
                    : s.days.map((d) => focus.t(`days.${d}`)).join(', ')
                }
                onDelete={
                  canAdmin
                    ? () => {
                        confirmDelete(() => {
                          focus
                            .api('DELETE', `/schedules/${s.id}`)
                            .then(() => loadSchedules(selectedPrescription.id))
                            .catch(() => {})
                        })
                      }
                    : undefined
                }
              />
            ))}
            {canAdmin && (
              <AddButton
                label={focus.t('settings.addSchedule')}
                onClick={() => setShowAddSchedule(true)}
              />
            )}
            {showAddSchedule && (
              <AddScheduleForm
                focus={focus}
                prescriptionId={selectedPrescription.id}
                onDone={() => {
                  setShowAddSchedule(false)
                  loadSchedules(selectedPrescription.id)
                }}
              />
            )}
          </>
        )}
      </Section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      <div style={styles.sectionBody}>{children}</div>
    </div>
  )
}

function ListItem({
  label,
  sublabel,
  selected,
  onClick,
  onDelete,
}: {
  label: string
  sublabel?: string
  selected?: boolean
  onClick?: () => void
  onDelete?: () => void
}) {
  const content = (
    <>
      <div style={styles.listItemContent}>
        <span style={styles.listItemLabel}>{label}</span>
        {sublabel && <span style={styles.listItemSub}>{sublabel}</span>}
      </div>
      {onDelete && (
        <button
          type="button"
          style={styles.deleteBtn}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          \u2715
        </button>
      )}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        style={{
          ...styles.listItem,
          ...(selected ? styles.listItemSelected : {}),
          cursor: 'pointer',
          textAlign: 'left' as const,
        }}
        onClick={onClick}
      >
        {content}
      </button>
    )
  }

  return <div style={styles.listItem}>{content}</div>
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" style={styles.addBtn} onClick={onClick}>
      + {label}
    </button>
  )
}

function EmptyHint({ text }: { text: string }) {
  return <div style={styles.emptyHint}>{text}</div>
}

// ---------------------------------------------------------------------------
// Emoji Picker
// ---------------------------------------------------------------------------

function EmojiPicker({
  value,
  onChange,
  type,
}: {
  value: string
  onChange: (v: string) => void
  type: 'human' | 'animal'
}) {
  const emojis = type === 'human' ? HUMAN_EMOJIS : ANIMAL_EMOJIS

  return (
    <div style={styles.emojiPicker}>
      <div style={styles.emojiGrid}>
        {emojis.map((e) => (
          <button
            key={e}
            type="button"
            style={{
              ...styles.emojiBtn,
              ...(value === e ? styles.emojiBtnActive : {}),
            }}
            onClick={() => onChange(e)}
          >
            {e}
          </button>
        ))}
      </div>
      <input
        style={{ ...styles.input, width: '60px', textAlign: 'center' }}
        placeholder="\u{1F4DD}"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={4}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

function FieldError({ message }: { message: string }) {
  return <div style={styles.fieldError}>{message}</div>
}

// ---------------------------------------------------------------------------
// Add forms
// ---------------------------------------------------------------------------

function AddPatientForm({
  focus,
  platformUsers,
  onDone,
}: {
  focus: FocusInstance
  platformUsers: FocusPublicUser[]
  onDone: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'human' | 'animal'>('human')
  const [avatar, setAvatar] = useState('')
  const [linkedUserId, setLinkedUserId] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleLinkUser = (userId: string) => {
    setLinkedUserId(userId)
    if (userId) {
      const user = platformUsers.find((u) => u.id === userId)
      if (user) {
        setName(user.name)
        if (user.avatar) setAvatar(user.avatar)
      }
    }
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = focus.t('settings.required')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const submit = () => {
    if (!validate()) return
    focus
      .api('POST', '/patients', {
        name: name.trim(),
        type,
        avatar,
        linked_user_id: linkedUserId || null,
      })
      .then(onDone)
      .catch((err) => console.error('pill-tracker: add patient', err))
  }

  return (
    <div style={styles.form}>
      <span style={styles.fieldLabel}>{focus.t('settings.type')}</span>
      <select
        style={styles.input}
        value={type}
        onChange={(e) => {
          const newType = e.target.value as 'human' | 'animal'
          setType(newType)
          setAvatar('')
          if (newType === 'animal') setLinkedUserId('')
        }}
      >
        <option value="human">{focus.t('types.human')}</option>
        <option value="animal">{focus.t('types.animal')}</option>
      </select>

      {type === 'human' && platformUsers.length > 0 && (
        <>
          <span style={styles.fieldLabel}>{focus.t('settings.linkedUser')}</span>
          <select
            style={styles.input}
            value={linkedUserId}
            onChange={(e) => handleLinkUser(e.target.value)}
          >
            <option value="">{focus.t('settings.standalonePatient')}</option>
            {platformUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.avatar ? `${u.avatar} ` : ''}
                {u.name}
              </option>
            ))}
          </select>
        </>
      )}

      <span style={styles.fieldLabel}>{focus.t('settings.patientName')}</span>
      <input
        style={{
          ...styles.input,
          ...(errors.name ? styles.inputError : {}),
        }}
        placeholder={focus.t('settings.patientName')}
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          if (errors.name) setErrors((prev) => ({ ...prev, name: '' }))
        }}
      />
      {errors.name && <FieldError message={errors.name} />}

      <span style={styles.fieldLabel}>{focus.t('settings.avatar')}</span>
      <EmojiPicker value={avatar} onChange={setAvatar} type={type} />

      <div style={styles.formActions}>
        <button type="button" style={styles.saveBtn} onClick={submit}>
          {focus.t('settings.save')}
        </button>
        <button type="button" style={styles.cancelFormBtn} onClick={onDone}>
          {focus.t('settings.cancel')}
        </button>
      </div>
    </div>
  )
}

function AddMedicationForm({ focus, onDone }: { focus: FocusInstance; onDone: () => void }) {
  const [name, setName] = useState('')
  const [targetType, setTargetType] = useState('universal')
  const [defaultDosage, setDefaultDosage] = useState('')
  const [form, setForm] = useState('tablet')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = focus.t('settings.required')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const submit = () => {
    if (!validate()) return
    focus
      .api('POST', '/medications', {
        name: name.trim(),
        target_type: targetType,
        default_dosage: defaultDosage,
        form,
      })
      .then(onDone)
      .catch((err) => console.error('pill-tracker: add med', err))
  }

  return (
    <div style={styles.form}>
      <span style={styles.fieldLabel}>{focus.t('settings.medicationName')}</span>
      <input
        style={{
          ...styles.input,
          ...(errors.name ? styles.inputError : {}),
        }}
        placeholder={focus.t('settings.medicationName')}
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          if (errors.name) setErrors((prev) => ({ ...prev, name: '' }))
        }}
      />
      {errors.name && <FieldError message={errors.name} />}

      <span style={styles.fieldLabel}>{focus.t('settings.targetType')}</span>
      <select
        style={styles.input}
        value={targetType}
        onChange={(e) => setTargetType(e.target.value)}
      >
        <option value="universal">{focus.t('targetTypes.universal')}</option>
        <option value="human">{focus.t('targetTypes.human')}</option>
        <option value="animal">{focus.t('targetTypes.animal')}</option>
      </select>

      <span style={styles.fieldLabel}>{focus.t('settings.dosage')}</span>
      <input
        style={styles.input}
        placeholder={focus.t('settings.dosagePlaceholder')}
        value={defaultDosage}
        onChange={(e) => setDefaultDosage(e.target.value)}
      />

      <span style={styles.fieldLabel}>{focus.t('settings.form')}</span>
      <select style={styles.input} value={form} onChange={(e) => setForm(e.target.value)}>
        <option value="tablet">{focus.t('forms.tablet')}</option>
        <option value="drops">{focus.t('forms.drops')}</option>
        <option value="injection">{focus.t('forms.injection')}</option>
        <option value="ointment">{focus.t('forms.ointment')}</option>
      </select>

      <div style={styles.formActions}>
        <button type="button" style={styles.saveBtn} onClick={submit}>
          {focus.t('settings.save')}
        </button>
        <button type="button" style={styles.cancelFormBtn} onClick={onDone}>
          {focus.t('settings.cancel')}
        </button>
      </div>
    </div>
  )
}

function AddPrescriptionForm({
  focus,
  patientId,
  medications,
  patientType,
  onDone,
}: {
  focus: FocusInstance
  patientId: string
  medications: Medication[]
  patientType: string
  onDone: () => void
}) {
  const filtered = medications.filter(
    (m) => m.target_type === 'universal' || m.target_type === patientType,
  )
  const [medId, setMedId] = useState(filtered[0]?.id ?? '')
  const [dosage, setDosage] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Auto-fill dosage from selected medication
  useEffect(() => {
    const med = medications.find((m) => m.id === medId)
    if (med?.default_dosage) setDosage(med.default_dosage)
  }, [medId, medications])

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!medId) errs.medId = focus.t('settings.required')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const submit = () => {
    if (!validate()) return
    focus
      .api('POST', '/prescriptions', {
        patient_id: patientId,
        medication_id: medId,
        dosage,
        start_date: startDate,
        end_date: endDate || null,
      })
      .then(onDone)
      .catch((err) => console.error('pill-tracker: add prescription', err))
  }

  if (filtered.length === 0) {
    return (
      <div style={styles.form}>
        <EmptyHint text={focus.t('settings.noMedicationsForType')} />
        <button type="button" style={styles.cancelFormBtn} onClick={onDone}>
          {focus.t('settings.cancel')}
        </button>
      </div>
    )
  }

  return (
    <div style={styles.form}>
      <span style={styles.fieldLabel}>{focus.t('settings.medication')}</span>
      <select
        style={{
          ...styles.input,
          ...(errors.medId ? styles.inputError : {}),
        }}
        value={medId}
        onChange={(e) => {
          setMedId(e.target.value)
          if (errors.medId) setErrors((prev) => ({ ...prev, medId: '' }))
        }}
      >
        {filtered.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {errors.medId && <FieldError message={errors.medId} />}

      <span style={styles.fieldLabel}>{focus.t('settings.dosage')}</span>
      <input
        style={styles.input}
        placeholder={focus.t('settings.dosagePlaceholder')}
        value={dosage}
        onChange={(e) => setDosage(e.target.value)}
      />

      <span style={styles.fieldLabel}>{focus.t('settings.startDate')}</span>
      <input
        style={styles.input}
        type="date"
        value={startDate}
        onChange={(e) => setStartDate(e.target.value)}
      />

      <span style={styles.fieldLabel}>{focus.t('settings.endDate')}</span>
      <input
        style={styles.input}
        type="date"
        value={endDate}
        onChange={(e) => setEndDate(e.target.value)}
      />
      {!endDate && <div style={styles.formHint}>{focus.t('settings.indefinite')}</div>}

      <div style={styles.formActions}>
        <button type="button" style={styles.saveBtn} onClick={submit}>
          {focus.t('settings.save')}
        </button>
        <button type="button" style={styles.cancelFormBtn} onClick={onDone}>
          {focus.t('settings.cancel')}
        </button>
      </div>
    </div>
  )
}

function AddScheduleForm({
  focus,
  prescriptionId,
  onDone,
}: {
  focus: FocusInstance
  prescriptionId: string
  onDone: () => void
}) {
  const [time, setTime] = useState('08:00')
  const [days, setDays] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const allDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

  const toggleDay = (d: string) => {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!time) errs.time = focus.t('settings.required')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const submit = () => {
    if (!validate()) return
    focus
      .api('POST', '/schedules', { prescription_id: prescriptionId, time, days })
      .then(onDone)
      .catch((err) => console.error('pill-tracker: add schedule', err))
  }

  return (
    <div style={styles.form}>
      <span style={styles.fieldLabel}>{focus.t('settings.time')}</span>
      <input
        style={{
          ...styles.input,
          ...(errors.time ? styles.inputError : {}),
        }}
        type="time"
        value={time}
        onChange={(e) => {
          setTime(e.target.value)
          if (errors.time) setErrors((prev) => ({ ...prev, time: '' }))
        }}
      />
      {errors.time && <FieldError message={errors.time} />}

      <span style={styles.fieldLabel}>{focus.t('settings.days')}</span>
      <div style={styles.daysRow}>
        {allDays.map((d) => (
          <button
            key={d}
            type="button"
            style={{
              ...styles.dayBtn,
              ...(days.includes(d) ? styles.dayBtnActive : {}),
            }}
            onClick={() => toggleDay(d)}
          >
            {focus.t(`days.${d}`)}
          </button>
        ))}
      </div>
      {days.length === 0 && <div style={styles.formHint}>{focus.t('settings.everydayHint')}</div>}

      <div style={styles.formActions}>
        <button type="button" style={styles.saveBtn} onClick={submit}>
          {focus.t('settings.save')}
        </button>
        <button type="button" style={styles.cancelFormBtn} onClick={onDone}>
          {focus.t('settings.cancel')}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles: Styles = {
  root: {
    ...baseStyles.widget,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
    padding: '8px 0',
    height: '100%',
    overflow: 'auto',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionTitle: {
    fontSize: '0.8125rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: 'var(--muted-foreground)',
  },
  sectionBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 8px',
    borderRadius: 'var(--radius, 0.625rem)',
    border: '1px solid transparent',
    gap: '8px',
  },
  listItemSelected: {
    background: 'color-mix(in oklch, var(--primary) 15%, transparent)',
    borderColor: 'var(--primary)',
  },
  listItemContent: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  listItemLabel: {
    fontSize: '0.8125rem',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  listItemSub: {
    fontSize: '0.6875rem',
    color: 'var(--muted-foreground)',
  },
  deleteBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    border: 'none',
    background: 'transparent',
    color: 'var(--muted-foreground)',
    cursor: 'pointer',
    fontSize: '0.75rem',
    flexShrink: 0,
    borderRadius: '4px',
  },
  addBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    border: '1px dashed var(--border)',
    borderRadius: 'var(--radius, 0.625rem)',
    background: 'transparent',
    color: 'var(--muted-foreground)',
    fontSize: '0.75rem',
    cursor: 'pointer',
  },
  emptyHint: {
    fontSize: '0.75rem',
    color: 'var(--muted-foreground)',
    padding: '8px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '8px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius, 0.625rem)',
    background: 'color-mix(in oklch, var(--muted) 30%, transparent)',
  },
  fieldLabel: {
    fontSize: '0.6875rem',
    fontWeight: 500,
    color: 'var(--muted-foreground)',
    marginTop: '2px',
  },
  input: {
    padding: '6px 10px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius, 0.625rem)',
    background: 'transparent',
    color: 'var(--foreground)',
    fontSize: '0.8125rem',
    outline: 'none',
  },
  inputError: {
    borderColor: 'var(--destructive, #ef4444)',
  },
  fieldError: {
    fontSize: '0.6875rem',
    color: 'var(--destructive, #ef4444)',
    marginTop: '-2px',
  },
  formActions: {
    display: 'flex',
    gap: '6px',
    marginTop: '4px',
  },
  saveBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '32px',
    padding: '0 14px',
    border: '1px solid transparent',
    borderRadius: 'var(--radius, 0.625rem)',
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
    fontSize: '0.8125rem',
    fontWeight: 500,
    cursor: 'pointer',
  },
  cancelFormBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '32px',
    padding: '0 14px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius, 0.625rem)',
    background: 'transparent',
    color: 'var(--foreground)',
    fontSize: '0.8125rem',
    cursor: 'pointer',
  },
  daysRow: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
  },
  dayBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '28px',
    padding: '0 8px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius, 0.625rem)',
    background: 'transparent',
    color: 'var(--foreground)',
    fontSize: '0.6875rem',
    cursor: 'pointer',
  },
  dayBtnActive: {
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
    borderColor: 'transparent',
  },
  formHint: {
    fontSize: '0.6875rem',
    color: 'var(--muted-foreground)',
  },
  emojiPicker: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  emojiGrid: {
    display: 'flex',
    gap: '4px',
    flexWrap: 'wrap',
  },
  emojiBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius, 0.625rem)',
    background: 'transparent',
    fontSize: '1.125rem',
    cursor: 'pointer',
    padding: 0,
  },
  emojiBtnActive: {
    borderColor: 'var(--primary)',
    background: 'color-mix(in oklch, var(--primary) 15%, transparent)',
  },
  disabled: baseStyles.disabled,
}

registerWidget('pill-tracker-settings', SettingsApp)
