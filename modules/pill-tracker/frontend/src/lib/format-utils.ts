import type { FocusInstance } from '@focus-dashboard/module-sdk'

/** Mapping from SDK dateFormat to date-fns format tokens. */
const DATE_FORMAT_MAP: Record<string, string> = {
  'DD.MM.YYYY': 'dd.MM.yyyy',
  'MM/DD/YYYY': 'MM/dd/yyyy',
  'YYYY-MM-DD': 'yyyy-MM-dd',
}

/** Short variant (without full year). */
const DATE_FORMAT_SHORT_MAP: Record<string, string> = {
  'DD.MM.YYYY': 'dd.MM.yy',
  'MM/DD/YYYY': 'MM/dd/yy',
  'YYYY-MM-DD': 'yy-MM-dd',
}

/** Get date-fns format string from SDK config. */
export function getDateFnsFormat(sdkFormat: string): string {
  return DATE_FORMAT_MAP[sdkFormat] ?? 'dd.MM.yyyy'
}

/** Get short date-fns format string from SDK config. */
export function getDateFnsShortFormat(sdkFormat: string): string {
  return DATE_FORMAT_SHORT_MAP[sdkFormat] ?? 'dd.MM.yy'
}

/**
 * Get "now" in the dashboard timezone as a Date object.
 * Uses Intl to extract date parts in the configured timezone,
 * then constructs a local Date representing that calendar date/time.
 */
export function nowInTimezone(focus: FocusInstance): Date {
  const tz = focus.getDashboardConfig().timezone
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0'
  return new Date(
    Number(get('year')),
    Number(get('month')) - 1,
    Number(get('day')),
    Number(get('hour')),
    Number(get('minute')),
    Number(get('second')),
  )
}

/**
 * Format a time string (HH:MM from ISO) respecting 12h/24h preference.
 * Input: "14:30" or full ISO "2026-04-05T14:30:00Z"
 */
export function formatTime(timeOrIso: string, focus: FocusInstance): string {
  const hhmm = timeOrIso.includes('T') ? timeOrIso.slice(11, 16) : timeOrIso
  const { timeFormat } = focus.getDashboardConfig()

  if (timeFormat === '12h') {
    const [hStr, mStr] = hhmm.split(':')
    let h = Number(hStr)
    const suffix = h >= 12 ? 'PM' : 'AM'
    if (h === 0) h = 12
    else if (h > 12) h -= 12
    return `${h}:${mStr} ${suffix}`
  }

  return hhmm
}
