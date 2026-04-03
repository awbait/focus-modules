import * as React from 'react'

const { useState, useEffect, useRef, useCallback, useMemo } = React

import { registerWidget, usePermission } from '@focus-dashboard/sdk-types'
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  SkipForward,
  X,
} from 'lucide-react'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Checkbox } from './components/ui/checkbox'
import { Progress } from './components/ui/progress'
import { ScrollArea } from './components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select'
import { Separator } from './components/ui/separator'
import { cn } from './lib/utils'
import type {
  DoseEntry,
  FocusInstance,
  Patient,
  TodayResponse,
  WidgetProps,
  WidgetSettings,
} from './types'

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useTranslation(focus: FocusInstance) {
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      return focus.t(key, vars)
    },
    [focus],
  )
}

// ---------------------------------------------------------------------------
// Day helpers
// ---------------------------------------------------------------------------

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

function getWeekDays(baseDate: Date): Date[] {
  const d = new Date(baseDate)
  const dayOfWeek = d.getDay() // 0=Sun..6=Sat
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(d)
  monday.setDate(d.getDate() + mondayOffset)

  const days: Date[] = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    days.push(day)
  }
  return days
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function formatDateParam(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ---------------------------------------------------------------------------
// Time-of-day filter
// ---------------------------------------------------------------------------

type TimeFilter = 'all' | 'morning' | 'afternoon' | 'evening'

function getHour(plannedAt: string): number {
  const m = plannedAt.match(/T(\d{2}):/)
  return m ? parseInt(m[1], 10) : 0
}

function matchesTimeFilter(dose: DoseEntry, filter: TimeFilter): boolean {
  if (filter === 'all') return true
  const h = getHour(dose.planned_at)
  if (filter === 'morning') return h < 12
  if (filter === 'afternoon') return h >= 12 && h < 18
  return h >= 18
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

function statusIcon(status: string) {
  switch (status) {
    case 'given':
      return <Check className="size-3.5" />
    case 'skipped':
      return <SkipForward className="size-3.5" />
    case 'overdue':
      return <AlertTriangle className="size-3.5" />
    default:
      return <Clock className="size-3.5" />
  }
}

function statusColor(status: string) {
  switch (status) {
    case 'given':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'skipped':
      return 'text-muted-foreground'
    case 'overdue':
      return 'text-destructive'
    default:
      return 'text-primary'
  }
}

function statusDotColor(status: string) {
  switch (status) {
    case 'given':
      return 'bg-emerald-500'
    case 'skipped':
      return 'bg-muted-foreground/50'
    case 'overdue':
      return 'bg-destructive'
    default:
      return 'bg-primary'
  }
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

function PillCalendar({ focus }: WidgetProps) {
  const t = useTranslation(focus)
  const canWrite = usePermission(focus, 'write')

  // State
  const [patients, setPatients] = useState<Patient[]>([])
  const [selectedPatientId, setSelectedPatientId] = useState<string>('')
  const [doses, setDoses] = useState<DoseEntry[]>([])
  const [given, setGiven] = useState(0)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [weekBase, setWeekBase] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [skipId, setSkipId] = useState<string | null>(null)
  const [skipReason, setSkipReason] = useState('')
  const [containerWidth, setContainerWidth] = useState(400)

  const containerRef = useRef<HTMLDivElement>(null)
  const firstPendingRef = useRef<HTMLDivElement>(null)
  const today = useMemo(() => new Date(), [])
  const weekDays = useMemo(() => getWeekDays(weekBase), [weekBase])

  // Observe container width for responsive
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const showFilters = containerWidth >= 350

  // Load patients
  useEffect(() => {
    focus.api<Patient[]>('GET', '/patients').then((res) => {
      setPatients(res)
      focus.getSettings<WidgetSettings>().then((s) => {
        if (s?.patient_id && res.some((p) => p.id === s.patient_id)) {
          setSelectedPatientId(s.patient_id)
        } else if (res.length > 0) {
          setSelectedPatientId(res[0].id)
        }
        setLoading(false)
      })
    })
  }, [focus])

  // Load doses when patient or date changes
  const loadDoses = useCallback(() => {
    if (!selectedPatientId) return
    const dateParam = formatDateParam(selectedDate)
    focus
      .api<TodayResponse>('GET', `/today?patient=${selectedPatientId}&date=${dateParam}`)
      .then((res) => {
        setDoses(res.doses)
        setGiven(res.given)
        setTotal(res.total)
      })
  }, [focus, selectedPatientId, selectedDate])

  useEffect(() => {
    loadDoses()
  }, [loadDoses])

  // Auto-scroll to first pending
  useEffect(() => {
    if (firstPendingRef.current) {
      firstPendingRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [doses])

  // Save patient selection
  useEffect(() => {
    if (selectedPatientId) {
      focus.api('PUT', `/widget-settings/${focus.getWidgetId()}`, { patient_id: selectedPatientId })
    }
  }, [focus, selectedPatientId])

  // WebSocket events
  useEffect(() => {
    const events = ['dose.given', 'dose.skipped', 'dose.overdue']
    const unsubs = events.map((evt) => focus.on(evt, () => loadDoses()))
    return () => {
      for (const u of unsubs) u()
    }
  }, [focus, loadDoses])

  // Actions
  const handleGive = useCallback(
    (id: string) => {
      focus.api('POST', `/doses/${id}/give`).then(() => loadDoses())
    },
    [focus, loadDoses],
  )

  const handleSkip = useCallback(
    (id: string, reason: string) => {
      focus.api('POST', `/doses/${id}/skip`, { reason }).then(() => {
        setSkipId(null)
        setSkipReason('')
        loadDoses()
      })
    },
    [focus, loadDoses],
  )

  // Navigation
  const prevWeek = () => {
    const d = new Date(weekBase)
    d.setDate(d.getDate() - 7)
    setWeekBase(d)
  }
  const nextWeek = () => {
    const d = new Date(weekBase)
    d.setDate(d.getDate() + 7)
    setWeekBase(d)
  }

  // Filtered doses
  const filteredDoses = useMemo(
    () => doses.filter((d) => matchesTimeFilter(d, timeFilter)),
    [doses, timeFilter],
  )

  const selectedPatient = patients.find((p) => p.id === selectedPatientId)
  const pct = total > 0 ? Math.round((given / total) * 100) : 0
  let firstPendingFound = false

  if (loading) {
    return (
      <div
        ref={containerRef}
        className="flex h-full items-center justify-center text-muted-foreground text-sm"
      >
        <Clock className="size-4 animate-spin mr-2" />
        {t('widget.today.title')}
      </div>
    )
  }

  if (patients.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex h-full items-center justify-center text-muted-foreground text-sm p-4 text-center"
      >
        {t('widget.today.noPatients')}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="flex h-full flex-col gap-2 p-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {patients.length > 1 ? (
            <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
              <SelectTrigger className="h-7 text-xs px-2 w-auto max-w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="mr-1">{p.avatar}</span> {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm font-medium truncate">
              {selectedPatient?.avatar} {selectedPatient?.name}
            </span>
          )}
        </div>
        <Badge variant={pct === 100 ? 'success' : 'outline'} className="shrink-0">
          {given}/{total}
        </Badge>
      </div>

      {/* Day Strip */}
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon-xs" onClick={prevWeek} className="shrink-0">
          <ChevronLeft className="size-3.5" />
        </Button>
        <div className="flex flex-1 gap-0.5 justify-center">
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, today)
            const isSelected = isSameDay(day, selectedDate)
            return (
              <button
                type="button"
                key={i}
                onClick={() => setSelectedDate(day)}
                className={cn(
                  'flex flex-col items-center rounded-lg px-1.5 py-1 text-xs transition-colors min-w-[32px]',
                  isSelected && isToday && 'bg-primary text-primary-foreground',
                  isSelected && !isToday && 'bg-muted text-foreground ring-1 ring-border',
                  !isSelected && isToday && 'text-primary font-semibold',
                  !isSelected && !isToday && 'text-muted-foreground hover:bg-muted/50',
                )}
              >
                <span className="text-[10px] uppercase leading-tight">
                  {t(`days.${DAY_KEYS[i]}`)}
                </span>
                <span className="font-medium leading-tight">{day.getDate()}</span>
              </button>
            )
          })}
        </div>
        <Button variant="ghost" size="icon-xs" onClick={nextWeek} className="shrink-0">
          <ChevronRight className="size-3.5" />
        </Button>
      </div>

      {/* Time Filters */}
      {showFilters && (
        <div className="flex gap-1 shrink-0">
          {(['all', 'morning', 'afternoon', 'evening'] as TimeFilter[]).map((f) => (
            <button
              type="button"
              key={f}
              onClick={() => setTimeFilter(f)}
              className={cn(
                'flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors',
                timeFilter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/50',
              )}
            >
              {t(`widget.today.filter.${f}`)}
            </button>
          ))}
        </div>
      )}

      <Separator />

      {/* Dose List */}
      <ScrollArea className="flex-1 -mx-1">
        <div className="flex flex-col gap-1 px-1">
          {filteredDoses.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-xs">
              {total === 0 ? t('widget.today.noDoses') : t('widget.today.allDone')}
            </div>
          ) : (
            filteredDoses.map((dose) => {
              const isPending = dose.status === 'pending' || dose.status === 'overdue'
              const isGiven = dose.status === 'given'
              const isSkipped = dose.status === 'skipped'
              const isFirstPending = isPending && !firstPendingFound
              if (isFirstPending) firstPendingFound = true
              const isSkipping = skipId === dose.id

              return (
                <div
                  key={dose.id}
                  ref={isFirstPending ? firstPendingRef : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors',
                    dose.status === 'overdue' && 'bg-destructive/5',
                    isGiven && 'opacity-60',
                  )}
                >
                  {/* Checkbox / Status */}
                  {canWrite && isPending ? (
                    <Checkbox
                      checked={false}
                      onCheckedChange={() => handleGive(dose.id)}
                      className="shrink-0"
                    />
                  ) : (
                    <span className={cn('shrink-0', statusColor(dose.status))}>
                      {statusIcon(dose.status)}
                    </span>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        'font-medium text-sm truncate',
                        isGiven && 'line-through',
                        isSkipped && 'line-through text-muted-foreground',
                      )}
                    >
                      {dose.medication_name}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{dose.dosage}</span>
                      <span
                        className={cn('size-1 rounded-full shrink-0', statusDotColor(dose.status))}
                      />
                      <span>{dose.planned_at.slice(11, 16)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {canWrite && isPending && !isSkipping && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setSkipId(dose.id)}
                      className="shrink-0 text-muted-foreground"
                      title={t('widget.today.skip')}
                    >
                      <X className="size-3" />
                    </Button>
                  )}

                  {/* Skip reason input */}
                  {isSkipping && (
                    <div className="flex items-center gap-1">
                      <input
                        className="h-6 w-20 rounded border border-input bg-input/30 px-1.5 text-xs outline-none"
                        placeholder={t('widget.today.skipReason')}
                        value={skipReason}
                        onChange={(e) => setSkipReason(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSkip(dose.id, skipReason)}
                      />
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => handleSkip(dose.id, skipReason)}
                      >
                        <Check className="size-3" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        onClick={() => {
                          setSkipId(null)
                          setSkipReason('')
                        }}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  )}

                  {/* Given info */}
                  {isGiven && dose.given_by_name && (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {t('widget.today.givenBy', { name: dose.given_by_name })}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>

      {/* Progress */}
      {total > 0 && (
        <div className="shrink-0 flex flex-col gap-1">
          <Progress value={pct} className="h-1.5" />
          <div className="text-[10px] text-muted-foreground text-center">
            {pct}% · {given}/{total} {t('widget.today.done')}
          </div>
        </div>
      )}
    </div>
  )
}

registerWidget('pill-tracker-calendar-widget', PillCalendar)
