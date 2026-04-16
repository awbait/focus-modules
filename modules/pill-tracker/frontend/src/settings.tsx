import * as React from 'react'

const { useState, useEffect, useCallback } = React

import type { FocusInstance } from '@focus-dashboard/sdk-types'
import { usePermission } from '@focus-dashboard/sdk-types'
import {
  Add01Icon,
  ArrowLeft02Icon,
  ArrowRight02Icon,
  Bone01Icon,
  Clock01Icon,
  Delete02Icon,
  DropletIcon,
  GlobeIcon,
  InjectionIcon,
  MedicineBottleIcon,
  PillIcon,
  User02Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { format, parseISO } from 'date-fns'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './components/ui/alert-dialog'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { DateInput } from './components/ui/date-input'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog'
import { Input } from './components/ui/input'
import { Label } from './components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { formatTime, getDateFnsFormat, getDateFnsShortFormat } from './lib/format-utils'
import { cn } from './lib/utils'
import type {
  FocusPublicUser,
  FrequencyType,
  MealRelation,
  Medication,
  Patient,
  Prescription,
  Schedule,
} from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function todayLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Section = 'patients' | 'medications'
type TFn = (key: string, vars?: Record<string, string | number>) => string

const NAV_ITEMS: { id: Section; icon: typeof UserGroupIcon }[] = [
  { id: 'patients', icon: UserGroupIcon },
  { id: 'medications', icon: PillIcon },
]

const ALL_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

const MEAL_OPTIONS: MealRelation[] = ['none', 'before', 'during', 'after']
const MEAL_MINUTES_OPTIONS = [15, 30, 45, 60, 90, 120]

const FREQUENCY_OPTIONS: FrequencyType[] = [
  'daily',
  'every_other_day',
  'every_n_hours',
  'every_n_days',
  'weekly',
  'biweekly',
  'monthly',
  'prn',
  'course',
]

const FORM_OPTIONS: { value: string; icon: typeof PillIcon }[] = [
  { value: 'tablet', icon: PillIcon },
  { value: 'drops', icon: DropletIcon },
  { value: 'injection', icon: InjectionIcon },
  { value: 'ointment', icon: MedicineBottleIcon },
]

const TARGET_TYPE_OPTIONS: { value: string; icon: typeof User02Icon }[] = [
  { value: 'human', icon: User02Icon },
  { value: 'animal', icon: Bone01Icon },
  { value: 'universal', icon: GlobeIcon },
]

function useTranslation(focus: FocusInstance): TFn {
  return useCallback((key, vars) => focus.t(key, vars), [focus])
}

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

function SectionHeader({
  title,
  count,
  action,
}: {
  title: string
  count: number
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between pb-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {count > 0 && (
          <span className="text-[11px] text-muted-foreground tabular-nums">{count}</span>
        )}
      </div>
      {action}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-10 text-center text-[13px] text-muted-foreground">{text}</p>
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={onClick}>
      <HugeiconsIcon icon={Add01Icon} size={14} /> {label}
    </Button>
  )
}

function DeleteButton({ onConfirm, t }: { onConfirm: () => void; t: TFn }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className={cn(
            'size-7 rounded-md flex items-center justify-center shrink-0 cursor-pointer',
            'text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors',
          )}
        >
          <HugeiconsIcon icon={Delete02Icon} size={14} />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('settings.delete')}</AlertDialogTitle>
          <AlertDialogDescription>{t('settings.confirmDelete')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('settings.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/80"
          >
            {t('settings.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function PatientTypeIcon({ type, className }: { type: string; className?: string }) {
  return (
    <HugeiconsIcon
      icon={type === 'animal' ? Bone01Icon : User02Icon}
      size={18}
      className={className}
    />
  )
}

function DayToggle({
  days,
  onChange,
  t,
}: {
  days: string[]
  onChange: (d: string[]) => void
  t: TFn
}) {
  const toggle = (d: string) =>
    onChange(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])

  return (
    <div className="flex gap-1">
      {ALL_DAYS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => toggle(d)}
          className={cn(
            'h-7 min-w-8 rounded-md px-1.5 text-xs font-medium transition-colors cursor-pointer',
            days.includes(d)
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted/60 text-muted-foreground hover:bg-muted',
          )}
        >
          {t(`days.${d}`)}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Item rows
// ---------------------------------------------------------------------------

function isEmoji(s: string) {
  return s.length <= 4 && !/[/.]/.test(s)
}

function AvatarCircle({
  src,
  type,
  className,
}: {
  src?: string
  type?: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  if (src && !isEmoji(src) && !failed) {
    return (
      <img
        src={src}
        alt=""
        onError={() => setFailed(true)}
        className={cn('rounded-full object-cover shrink-0', className)}
      />
    )
  }
  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-full bg-muted text-muted-foreground shrink-0',
        className,
      )}
    >
      <PatientTypeIcon type={type || 'human'} />
    </span>
  )
}

function SubSectionLabel({ text }: { text: string }) {
  return <p className="text-xs font-medium text-muted-foreground pb-2">{text}</p>
}

function UserCard({ user, onAdd }: { user: FocusPublicUser; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <AvatarCircle src={user.avatar} type="human" className="size-9" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate">{user.display_name || user.name}</div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="size-7 rounded-full flex items-center justify-center shrink-0 cursor-pointer text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
      >
        <HugeiconsIcon icon={Add01Icon} size={16} />
      </button>
    </div>
  )
}

function PatientCard({
  p,
  t,
  onDelete,
  onClick,
}: {
  p: Patient
  t: TFn
  onDelete: () => void
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-3 rounded-xl border p-3 cursor-pointer hover:border-primary/30 transition-colors w-full text-left"
      onClick={onClick}
    >
      <AvatarCircle src={p.avatar} type={p.type} className="size-9" />
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate">{p.name}</div>
        <div className="text-xs text-muted-foreground">{t(`types.${p.type}`)}</div>
      </div>
      <span onClickCapture={(e) => e.stopPropagation()}>
        <DeleteButton onConfirm={onDelete} t={t} />
      </span>
    </button>
  )
}

function MedicationCard({ m, t, onDelete }: { m: Medication; t: TFn; onDelete: () => void }) {
  const formIcon = FORM_OPTIONS.find((f) => f.value === m.form)?.icon ?? PillIcon
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <span
        className={cn(
          'flex items-center justify-center rounded-full bg-primary/8 text-primary shrink-0 size-9',
        )}
      >
        <HugeiconsIcon icon={formIcon} size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium truncate">
          {m.name}
          {m.default_dosage && (
            <span className="text-muted-foreground font-normal"> · {m.default_dosage}</span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {t(`forms.${m.form}`)} · {t(`targetTypes.${m.target_type}`)}
        </div>
      </div>
      <DeleteButton onConfirm={onDelete} t={t} />
    </div>
  )
}

function mealRelationLabel(p: Prescription, t: TFn): string {
  if (p.meal_relation === 'none') return ''
  const rel = t(`meal.${p.meal_relation}`)
  if (p.meal_relation === 'during') return rel
  return `${rel} (${t('meal.minutes', { n: p.meal_minutes })})`
}

function frequencyLabel(s: Schedule, t: TFn): string {
  const ft = s.frequency_type
  const base = t(`frequency.${ft}`)

  switch (ft) {
    case 'every_n_hours':
      return `${base.replace('N', String(s.frequency_value))}`
    case 'every_n_days':
      return `${base.replace('N', String(s.frequency_value))}`
    case 'course':
      return `${base}: ${s.frequency_value}/${s.course_off_days}`
    case 'daily':
      if (s.days.length === 0) return t('settings.everyday')
      return s.days.map((d) => t(`days.${d}`)).join(', ')
    case 'weekly':
    case 'biweekly':
      if (s.days.length > 0) return `${base} · ${s.days.map((d) => t(`days.${d}`)).join(', ')}`
      return base
    case 'monthly':
      if (s.frequency_value > 0) return `${base} · ${s.frequency_value}`
      return base
    default:
      return base
  }
}

// ---------------------------------------------------------------------------
// Patient Detail View (inline prescriptions + schedules)
// ---------------------------------------------------------------------------

function PatientDetailView({
  patient,
  focus,
  t,
  onBack,
}: {
  patient: Patient
  focus: FocusInstance
  t: TFn
  onBack: () => void
}) {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([])
  const [schedulesByPrescription, setSchedulesByPrescription] = useState<
    Record<string, Schedule[]>
  >({})
  const [medications, setMedications] = useState<Medication[]>([])
  const [showAddPrescription, setShowAddPrescription] = useState(false)
  const [addScheduleForPrescription, setAddScheduleForPrescription] = useState('')

  const loadPrescriptions = useCallback(
    () =>
      focus
        .api<Prescription[]>('GET', `/prescriptions?patient_id=${patient.id}`)
        .then(setPrescriptions),
    [focus, patient.id],
  )

  const loadMedications = useCallback(
    () => focus.api<Medication[]>('GET', '/medications').then(setMedications),
    [focus],
  )

  const loadSchedules = useCallback(
    (prescriptionId: string) =>
      focus
        .api<Schedule[]>('GET', `/schedules?prescription_id=${prescriptionId}`)
        .then((scheds) => {
          setSchedulesByPrescription((prev) => ({ ...prev, [prescriptionId]: scheds }))
        }),
    [focus],
  )

  useEffect(() => {
    loadPrescriptions()
  }, [loadPrescriptions])
  useEffect(() => {
    loadMedications()
  }, [loadMedications])
  useEffect(() => {
    for (const p of prescriptions) loadSchedules(p.id)
  }, [prescriptions, loadSchedules])

  const deletePrescription = (id: string) =>
    focus.api('DELETE', `/prescriptions/${id}`).then(loadPrescriptions)

  const deleteSchedule = (prescriptionId: string, scheduleId: string) =>
    focus.api('DELETE', `/schedules/${scheduleId}`).then(() => loadSchedules(prescriptionId))

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2 pb-4">
        <button
          type="button"
          onClick={onBack}
          className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} size={18} />
        </button>
        <AvatarCircle src={patient.avatar} type={patient.type} className="size-8" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold truncate">{patient.name}</h2>
          <div className="text-xs text-muted-foreground">{t(`types.${patient.type}`)}</div>
        </div>
      </div>

      {/* Prescriptions */}
      <div>
        <SectionHeader
          title={t('settings.prescriptionsCount', { count: prescriptions.length })}
          count={0}
          action={
            <AddButton
              label={t('settings.addPrescription')}
              onClick={() => setShowAddPrescription(true)}
            />
          }
        />
      </div>

      {prescriptions.length === 0 ? (
        <EmptyState text={t('settings.noItems')} />
      ) : (
        <div className="max-h-100 overflow-y-auto overflow-x-hidden pr-1 styled-scroll">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {prescriptions.map((p) => {
              const med = medications.find((m) => m.id === p.medication_id)
              const scheds = schedulesByPrescription[p.id] || []

              return (
                <div key={p.id} className="rounded-xl border p-3 space-y-2">
                  {/* Prescription row */}
                  <div className="flex items-start gap-2">
                    <div className="size-7 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 mt-0.5">
                      <HugeiconsIcon
                        icon={FORM_OPTIONS.find((f) => f.value === med?.form)?.icon ?? PillIcon}
                        size={16}
                        className="text-primary"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">
                        {med?.name ?? '?'}
                        {p.dosage && <span className="text-muted-foreground"> · </span>}
                        {p.dosage}
                      </div>
                      {p.meal_relation !== 'none' && (
                        <div className="text-xs text-muted-foreground">
                          {mealRelationLabel(p, t)}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <Badge
                          variant={
                            p.status === 'active'
                              ? 'success'
                              : p.status === 'paused'
                                ? 'outline'
                                : 'secondary'
                          }
                          className="text-[10px] h-4"
                        >
                          {t(`settings.${p.status}`)}
                        </Badge>
                        <span className="inline-flex items-center gap-1">
                          {format(
                            parseISO(p.start_date),
                            getDateFnsShortFormat(focus.getDashboardConfig().dateFormat),
                          )}
                          {p.end_date && (
                            <>
                              <HugeiconsIcon
                                icon={ArrowRight02Icon}
                                size={12}
                                className="text-muted-foreground"
                              />
                              {format(
                                parseISO(p.end_date),
                                getDateFnsShortFormat(focus.getDashboardConfig().dateFormat),
                              )}
                            </>
                          )}
                        </span>
                        {p.duration_days && (
                          <span>({t('settings.durationDaysShort', { n: p.duration_days })})</span>
                        )}
                      </div>
                    </div>
                    <DeleteButton onConfirm={() => deletePrescription(p.id)} t={t} />
                  </div>

                  {/* Schedules for this prescription */}
                  <div className="pl-6 space-y-1">
                    {scheds.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 text-xs group">
                        <HugeiconsIcon
                          icon={Clock01Icon}
                          size={12}
                          className="text-muted-foreground shrink-0"
                        />
                        <span className="font-medium">{formatTime(s.time, focus)}</span>
                        <span className="text-muted-foreground truncate">
                          {frequencyLabel(s, t)}
                        </span>
                        <Badge
                          variant={s.active ? 'success' : 'outline'}
                          className="text-[10px] h-4 shrink-0"
                        >
                          {s.active ? t('settings.active') : t('settings.paused')}
                        </Badge>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <DeleteButton onConfirm={() => deleteSchedule(p.id, s.id)} t={t} />
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAddScheduleForPrescription(p.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer pt-1"
                    >
                      <HugeiconsIcon icon={Add01Icon} size={12} />
                      {t('settings.addSchedule')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <AddPrescriptionDialog
        open={showAddPrescription}
        onOpenChange={setShowAddPrescription}
        focus={focus}
        t={t}
        patientId={patient.id}
        patientType={patient.type}
        medications={medications}
        onCreated={loadPrescriptions}
      />

      <AddScheduleDialog
        open={!!addScheduleForPrescription}
        onOpenChange={(v) => {
          if (!v) setAddScheduleForPrescription('')
        }}
        focus={focus}
        t={t}
        prescriptionId={addScheduleForPrescription}
        onCreated={() => {
          if (addScheduleForPrescription) loadSchedules(addScheduleForPrescription)
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings App
// ---------------------------------------------------------------------------

function SettingsApp({ focus }: { focus: FocusInstance }) {
  const t = useTranslation(focus)
  const canAdmin = usePermission(focus, 'admin')

  const [section, setSection] = useState<Section>('patients')
  const [showAdd, setShowAdd] = useState(false)

  // Data
  const [patients, setPatients] = useState<Patient[]>([])
  const [medications, setMedications] = useState<Medication[]>([])
  const [platformUsers, setPlatformUsers] = useState<FocusPublicUser[]>([])

  // Detail view
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)

  // Loaders
  const loadPatients = useCallback(
    () => focus.api<Patient[]>('GET', '/patients').then(setPatients),
    [focus],
  )
  const loadMedications = useCallback(
    () => focus.api<Medication[]>('GET', '/medications').then(setMedications),
    [focus],
  )

  useEffect(() => {
    loadPatients()
  }, [loadPatients])
  useEffect(() => {
    loadMedications()
  }, [loadMedications])
  useEffect(() => {
    ;(focus as any).getUsers?.()?.then?.(setPlatformUsers)
  }, [focus])

  // CRUD
  const deletePatient = (id: string) =>
    focus.api('DELETE', `/patients/${id}`).then(() => {
      loadPatients()
      if (selectedPatient?.id === id) setSelectedPatient(null)
    })
  const deleteMedication = (id: string) =>
    focus.api('DELETE', `/medications/${id}`).then(loadMedications)

  const switchSection = (s: string) => {
    setSection(s as Section)
    setShowAdd(false)
    setSelectedPatient(null)
  }

  if (!canAdmin) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-4">
        Admin access required
      </div>
    )
  }

  const counts: Record<Section, number> = {
    patients: patients.length,
    medications: medications.length,
  }

  return (
    <Tabs value={section} onValueChange={switchSection} className="flex flex-col h-full gap-0">
      <div className="shrink-0 pb-2">
        <TabsList className="w-full">
          {NAV_ITEMS.map(({ id, icon: Icon }) => (
            <TabsTrigger
              key={id}
              value={id}
              className="flex-1 gap-1.5 data-active:bg-primary data-active:text-primary-foreground dark:data-active:bg-primary dark:data-active:text-primary-foreground dark:data-active:border-transparent"
            >
              <HugeiconsIcon icon={Icon} size={14} />
              <span className="hidden sm:inline">{t(`settings.${id}`)}</span>
              {counts[id] > 0 && (
                <span className="text-[10px] tabular-nums opacity-50 hidden sm:inline">
                  {counts[id]}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto pt-2">
        <TabsContent value="patients" className="mt-0">
          {selectedPatient ? (
            <PatientDetailView
              patient={selectedPatient}
              focus={focus}
              t={t}
              onBack={() => setSelectedPatient(null)}
            />
          ) : (
            <>
              <SectionHeader
                title={t('settings.patients')}
                count={patients.length}
                action={
                  <AddButton label={t('settings.addPatient')} onClick={() => setShowAdd(true)} />
                }
              />

              {(() => {
                const linkedIds = new Set(
                  patients.filter((p) => p.linked_user_id).map((p) => p.linked_user_id),
                )
                const available = platformUsers.filter((u) => !linkedIds.has(u.id))

                const addFromUser = (user: FocusPublicUser) => {
                  focus
                    .api('POST', '/patients', {
                      name: user.display_name || user.name,
                      type: 'human',
                      avatar: user.avatar || '',
                      linked_user_id: user.id,
                    })
                    .then(loadPatients)
                }

                return (
                  <>
                    {available.length > 0 && (
                      <div className="pb-4">
                        <SubSectionLabel text={t('settings.availableUsers')} />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {available.map((u) => (
                            <UserCard key={u.id} user={u} onAdd={() => addFromUser(u)} />
                          ))}
                        </div>
                      </div>
                    )}

                    {patients.length > 0 && (
                      <div>
                        {available.length > 0 && (
                          <SubSectionLabel text={t('settings.myPatients')} />
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {patients.map((p) => (
                            <PatientCard
                              key={p.id}
                              p={p}
                              t={t}
                              onDelete={() => deletePatient(p.id)}
                              onClick={() => setSelectedPatient(p)}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {patients.length === 0 && available.length === 0 && (
                      <EmptyState text={t('settings.noItems')} />
                    )}
                  </>
                )
              })()}

              <AddPatientDialog
                open={showAdd}
                onOpenChange={setShowAdd}
                focus={focus}
                t={t}
                onCreated={loadPatients}
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="medications" className="mt-0">
          <SectionHeader
            title={t('settings.medications')}
            count={medications.length}
            action={
              <AddButton label={t('settings.addMedication')} onClick={() => setShowAdd(true)} />
            }
          />
          {medications.length === 0 ? (
            <EmptyState text={t('settings.noItems')} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {medications.map((m) => (
                <MedicationCard key={m.id} m={m} t={t} onDelete={() => deleteMedication(m.id)} />
              ))}
            </div>
          )}
          <AddMedicationDialog
            open={showAdd}
            onOpenChange={setShowAdd}
            focus={focus}
            t={t}
            onCreated={loadMedications}
          />
        </TabsContent>
      </div>
    </Tabs>
  )
}

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

function TypeCard({
  type,
  selected,
  label,
  onClick,
}: {
  type: string
  selected: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-xl border p-3 cursor-pointer transition-colors',
        selected ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted',
      )}
    >
      <PatientTypeIcon type={type} />
      <span className="text-xs font-medium">{label}</span>
    </button>
  )
}

function FormCard({
  selected,
  label,
  icon,
  onClick,
}: {
  selected: boolean
  label: string
  icon: typeof PillIcon
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-xl border p-2.5 cursor-pointer transition-colors',
        selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'hover:bg-muted text-muted-foreground',
      )}
    >
      <HugeiconsIcon icon={icon} size={20} />
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  )
}

function MealRelationSelector({
  value,
  minutes,
  onValueChange,
  onMinutesChange,
  t,
}: {
  value: MealRelation
  minutes: number
  onValueChange: (v: MealRelation) => void
  onMinutesChange: (v: number) => void
  t: TFn
}) {
  return (
    <div className="space-y-2">
      <Label className="text-[13px] font-medium">{t('settings.mealRelation')}</Label>
      <Select value={value} onValueChange={(v) => onValueChange(v as MealRelation)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MEAL_OPTIONS.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {t(`meal.${opt}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {(value === 'before' || value === 'after') && (
        <Select value={String(minutes)} onValueChange={(v) => onMinutesChange(Number(v))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEAL_MINUTES_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {t('meal.minutes', { n })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}

function FrequencyTypeSelector({
  value,
  freqValue,
  courseOffDays,
  days,
  onValueChange,
  onFreqValueChange,
  onCourseOffDaysChange,
  onDaysChange,
  t,
}: {
  value: FrequencyType
  freqValue: number
  courseOffDays: number
  days: string[]
  onValueChange: (v: FrequencyType) => void
  onFreqValueChange: (v: number) => void
  onCourseOffDaysChange: (v: number) => void
  onDaysChange: (d: string[]) => void
  t: TFn
}) {
  return (
    <div className="space-y-3">
      <Field label={t('settings.frequencyType')}>
        <Select value={value} onValueChange={(v) => onValueChange(v as FrequencyType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FREQUENCY_OPTIONS.map((ft) => (
              <SelectItem key={ft} value={ft}>
                {t(`frequency.${ft}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {/* Contextual fields based on frequency type */}
      {(value === 'daily' || value === 'weekly' || value === 'biweekly') && (
        <Field label={t('settings.days')}>
          <DayToggle days={days} onChange={onDaysChange} t={t} />
          {value === 'daily' && (
            <p className="text-xs text-muted-foreground mt-1">{t('settings.everydayHint')}</p>
          )}
        </Field>
      )}

      {value === 'every_n_hours' && (
        <Field label={t('settings.frequencyValue')}>
          <div className="flex flex-wrap gap-1.5">
            {[4, 6, 8, 12].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onFreqValueChange(n)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                  freqValue === n ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted',
                )}
              >
                {t('meal.hours', { n })}
              </button>
            ))}
          </div>
        </Field>
      )}

      {value === 'every_n_days' && (
        <Field label={t('settings.frequencyValue')}>
          <Input
            type="number"
            min={2}
            max={30}
            value={freqValue || ''}
            onChange={(e) => onFreqValueChange(Number(e.target.value))}
            placeholder="3"
          />
        </Field>
      )}

      {value === 'monthly' && (
        <Field label={t('settings.monthDay')}>
          <Input
            type="number"
            min={1}
            max={31}
            value={freqValue || ''}
            onChange={(e) => onFreqValueChange(Number(e.target.value))}
            placeholder="1"
          />
        </Field>
      )}

      {value === 'course' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('settings.courseOnDays')}>
            <Input
              type="number"
              min={1}
              value={freqValue || ''}
              onChange={(e) => onFreqValueChange(Number(e.target.value))}
              placeholder="5"
            />
          </Field>
          <Field label={t('settings.courseOffDays')}>
            <Input
              type="number"
              min={1}
              value={courseOffDays || ''}
              onChange={(e) => onCourseOffDaysChange(Number(e.target.value))}
              placeholder="2"
            />
          </Field>
        </div>
      )}
    </div>
  )
}

function AddPatientDialog({
  open,
  onOpenChange,
  focus,
  t,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  focus: FocusInstance
  t: TFn
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState('human')
  const [error, setError] = useState('')

  const reset = () => {
    setName('')
    setType('human')
    setError('')
  }

  const submit = () => {
    if (!name.trim()) {
      setError(t('settings.required'))
      return
    }
    focus
      .api('POST', '/patients', {
        name: name.trim(),
        type,
        avatar: '',
        linked_user_id: null,
      })
      .then(() => {
        onCreated()
        onOpenChange(false)
        reset()
      })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) reset()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settings.addPatient')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t('settings.patientName')} error={error}>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              placeholder={t('settings.patientName')}
              autoFocus
            />
          </Field>
          <Field label={t('settings.type')}>
            <div className="grid grid-cols-2 gap-2">
              <TypeCard
                type="human"
                selected={type === 'human'}
                label={t('types.human')}
                onClick={() => setType('human')}
              />
              <TypeCard
                type="animal"
                selected={type === 'animal'}
                label={t('types.animal')}
                onClick={() => setType('animal')}
              />
            </div>
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('settings.cancel')}</Button>
          </DialogClose>
          <Button onClick={submit}>{t('settings.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddMedicationDialog({
  open,
  onOpenChange,
  focus,
  t,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  focus: FocusInstance
  t: TFn
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [targetType, setTargetType] = useState('universal')
  const [dosage, setDosage] = useState('')
  const [form, setForm] = useState('tablet')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const reset = () => {
    setName('')
    setTargetType('universal')
    setDosage('')
    setForm('tablet')
    setNotes('')
    setError('')
  }

  const submit = () => {
    if (!name.trim()) {
      setError(t('settings.required'))
      return
    }
    focus
      .api('POST', '/medications', {
        name: name.trim(),
        target_type: targetType,
        default_dosage: dosage,
        form,
        notes,
      })
      .then(() => {
        onCreated()
        onOpenChange(false)
        reset()
      })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) reset()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('settings.addMedication')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t('settings.medicationName')} error={error}>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              placeholder={t('settings.medicationName')}
              autoFocus
            />
          </Field>
          <Field label={t('settings.targetType')}>
            <div className="grid grid-cols-3 gap-2">
              {TARGET_TYPE_OPTIONS.map((o) => (
                <FormCard
                  key={o.value}
                  icon={o.icon}
                  selected={targetType === o.value}
                  label={t(`targetTypes.${o.value}`)}
                  onClick={() => setTargetType(o.value)}
                />
              ))}
            </div>
          </Field>
          <Field label={t('settings.form')}>
            <div className="grid grid-cols-4 gap-2">
              {FORM_OPTIONS.map((f) => (
                <FormCard
                  key={f.value}
                  icon={f.icon}
                  selected={form === f.value}
                  label={t(`forms.${f.value}`)}
                  onClick={() => setForm(f.value)}
                />
              ))}
            </div>
          </Field>
          <Field label={t('settings.dosage')}>
            <Input
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder={t('settings.dosagePlaceholder')}
            />
          </Field>
          <Field label={t('settings.notes')}>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('settings.notes')}
            />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('settings.cancel')}</Button>
          </DialogClose>
          <Button onClick={submit}>{t('settings.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddPrescriptionDialog({
  open,
  onOpenChange,
  focus,
  t,
  patientId,
  patientType,
  medications,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  focus: FocusInstance
  t: TFn
  patientId: string
  patientType: string
  medications: Medication[]
  onCreated: () => void
}) {
  const [step, setStep] = useState<1 | 2>(1)
  const [medicationId, setMedicationId] = useState('')
  const [search, setSearch] = useState('')
  const [dosage, setDosage] = useState('')
  const [startDate, setStartDate] = useState(() => todayLocal())
  const [endDate, setEndDate] = useState('')
  const [mealRelation, setMealRelation] = useState<MealRelation>('none')
  const [mealMinutes, setMealMinutes] = useState(30)
  const [durationDays, setDurationDays] = useState<string>('')

  const reset = () => {
    setStep(1)
    setMedicationId('')
    setSearch('')
    setDosage('')
    setStartDate(todayLocal())
    setEndDate('')
    setMealRelation('none')
    setMealMinutes(30)
    setDurationDays('')
  }

  const filteredMeds = medications.filter(
    (m) => m.target_type === patientType || m.target_type === 'universal',
  )
  const searchedMeds = filteredMeds.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()),
  )
  const selectedMed = medications.find((m) => m.id === medicationId)

  const pickMedication = (id: string) => {
    setMedicationId(id)
    const med = medications.find((m) => m.id === id)
    setDosage(med?.default_dosage || '')
    setMealRelation('none')
    setMealMinutes(30)
    setDurationDays('')
    setStartDate(todayLocal())
    setEndDate('')
    setStep(2)
  }

  const submit = () => {
    if (!medicationId) return
    const durDays = durationDays ? Number(durationDays) : null
    focus
      .api('POST', '/prescriptions', {
        patient_id: patientId,
        medication_id: medicationId,
        dosage,
        start_date: startDate,
        end_date: endDate || null,
        meal_relation: mealRelation,
        meal_minutes: mealMinutes,
        duration_days: durDays,
      })
      .then(() => {
        onCreated()
        onOpenChange(false)
        reset()
      })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) reset()
      }}
    >
      <DialogContent className={cn('max-h-[85vh] overflow-y-auto', step === 1 && 'sm:max-w-xl')}>
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? t('settings.medication') : t('settings.addPrescription')}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          /* ── Step 1: Pick medication ── */
          <div className="space-y-3">
            {filteredMeds.length > 4 && (
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('settings.searchMedication')}
                autoFocus
              />
            )}
            {searchedMeds.length === 0 ? (
              <EmptyState text={t('settings.noMedicationsForType')} />
            ) : (
              <div
                className={cn(
                  'grid grid-cols-1 sm:grid-cols-2 gap-2',
                  filteredMeds.length > 6 && 'max-h-80 overflow-y-auto pr-1',
                )}
              >
                {searchedMeds.map((m) => {
                  const formIcon = FORM_OPTIONS.find((f) => f.value === m.form)?.icon ?? PillIcon
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => pickMedication(m.id)}
                      className="flex items-center gap-3 rounded-xl border p-3 text-left cursor-pointer hover:border-primary/30 transition-colors"
                    >
                      <span className="flex items-center justify-center rounded-full bg-primary/8 text-primary shrink-0 size-9">
                        <HugeiconsIcon icon={formIcon} size={18} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate">
                          {m.name}
                          {m.default_dosage && (
                            <span className="text-muted-foreground font-normal">
                              {' '}
                              · {m.default_dosage}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t(`forms.${m.form}`)} · {t(`targetTypes.${m.target_type}`)}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{t('settings.cancel')}</Button>
              </DialogClose>
            </DialogFooter>
          </div>
        ) : (
          /* ── Step 2: Configure prescription ── */
          <div className="space-y-4">
            {/* Selected medication chip */}
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-left cursor-pointer hover:bg-primary/10 transition-colors"
            >
              <span className="flex items-center justify-center rounded-full bg-primary/15 text-primary shrink-0 size-8">
                <HugeiconsIcon
                  icon={FORM_OPTIONS.find((f) => f.value === selectedMed?.form)?.icon ?? PillIcon}
                  size={16}
                />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium truncate">{selectedMed?.name}</div>
                <div className="text-[11px] text-muted-foreground">{t('settings.edit')}</div>
              </div>
              <HugeiconsIcon icon={ArrowLeft02Icon} size={14} className="text-muted-foreground" />
            </button>

            <Field label={t('settings.dosage')}>
              <Input
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder={t('settings.dosagePlaceholder')}
                autoFocus
              />
            </Field>

            <MealRelationSelector
              value={mealRelation}
              minutes={mealMinutes}
              onValueChange={setMealRelation}
              onMinutesChange={setMealMinutes}
              t={t}
            />

            {/* Course period */}
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {t('settings.coursePeriod')}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('settings.startDate')}>
                  <DateInput
                    value={startDate}
                    onChange={setStartDate}
                    displayFormat={getDateFnsFormat(focus.getDashboardConfig().dateFormat)}
                  />
                </Field>
                <Field label={t('settings.endDate')}>
                  <DateInput
                    value={endDate}
                    onChange={setEndDate}
                    clearable
                    displayFormat={getDateFnsFormat(focus.getDashboardConfig().dateFormat)}
                  />
                </Field>
              </div>
              <Field label={t('settings.durationDays')}>
                <Input
                  type="number"
                  min={1}
                  value={durationDays}
                  onChange={(e) => setDurationDays(e.target.value)}
                  placeholder={t('settings.durationPlaceholder')}
                />
                <p className="text-xs text-muted-foreground mt-1">{t('settings.courseHint')}</p>
              </Field>
            </div>

            <p className="text-xs text-muted-foreground">{t('settings.scheduleHint')}</p>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>
                {t('settings.back')}
              </Button>
              <Button onClick={submit}>{t('settings.save')}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AddScheduleDialog({
  open,
  onOpenChange,
  focus,
  t,
  prescriptionId,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  focus: FocusInstance
  t: TFn
  prescriptionId: string
  onCreated: () => void
}) {
  const [time, setTime] = useState('08:00')
  const [days, setDays] = useState<string[]>([])
  const [frequencyType, setFrequencyType] = useState<FrequencyType>('daily')
  const [frequencyValue, setFrequencyValue] = useState(0)
  const [courseOffDays, setCourseOffDays] = useState(0)
  const [error, setError] = useState('')

  const reset = () => {
    setTime('08:00')
    setDays([])
    setFrequencyType('daily')
    setFrequencyValue(0)
    setCourseOffDays(0)
    setError('')
  }

  const submit = () => {
    if (!time) {
      setError(t('settings.required'))
      return
    }
    focus
      .api('POST', '/schedules', {
        prescription_id: prescriptionId,
        time,
        days,
        frequency_type: frequencyType,
        frequency_value: frequencyValue,
        course_off_days: courseOffDays,
      })
      .then(() => {
        onCreated()
        onOpenChange(false)
        reset()
      })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) reset()
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('settings.addSchedule')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={t('settings.time')} error={error}>
            <div className="flex gap-2">
              <Select
                value={time.split(':')[0]}
                onValueChange={(h) => {
                  setTime(`${h}:${time.split(':')[1] || '00'}`)
                  setError('')
                }}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="flex items-center text-muted-foreground font-medium">:</span>
              <Select
                value={time.split(':')[1] || '00'}
                onValueChange={(m) => {
                  setTime(`${time.split(':')[0]}:${m}`)
                  setError('')
                }}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Field>

          <FrequencyTypeSelector
            value={frequencyType}
            freqValue={frequencyValue}
            courseOffDays={courseOffDays}
            days={days}
            onValueChange={setFrequencyType}
            onFreqValueChange={setFrequencyValue}
            onCourseOffDaysChange={setCourseOffDays}
            onDaysChange={setDays}
            t={t}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t('settings.cancel')}</Button>
          </DialogClose>
          <Button onClick={submit}>{t('settings.save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default SettingsApp
