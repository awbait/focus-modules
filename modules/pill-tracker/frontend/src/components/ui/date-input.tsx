import { format, parse } from 'date-fns'
import { ru } from 'date-fns/locale'
import { CalendarIcon, X } from 'lucide-react'
import * as React from 'react'
import { cn } from '../../lib/utils'
import { Button } from './button'
import { Calendar } from './calendar'
import { Popover, PopoverContent, PopoverTrigger } from './popover'

interface DateInputProps {
  value: string // YYYY-MM-DD or ""
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  clearable?: boolean
  /** date-fns display format, e.g. "dd.MM.yyyy". Defaults to "dd.MM.yyyy". */
  displayFormat?: string
}

/** Format Date → YYYY-MM-DD string */
function toISODate(d: Date | null | undefined): string {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse YYYY-MM-DD → Date */
function parseDate(s: string): Date | undefined {
  if (!s) return undefined
  return parse(s, 'yyyy-MM-dd', new Date())
}

function DateInput({
  value,
  onChange,
  placeholder,
  className,
  clearable,
  displayFormat = 'dd.MM.yyyy',
}: DateInputProps) {
  const [open, setOpen] = React.useState(false)
  const selected = parseDate(value)

  return (
    <div className="flex gap-1.5 items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal h-9',
              !value && 'text-muted-foreground',
              className,
            )}
          >
            <CalendarIcon className="size-4 mr-2 shrink-0" />
            {selected ? format(selected, displayFormat) : placeholder || 'дд.мм.гггг'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => {
              onChange(toISODate(date))
              setOpen(false)
            }}
            locale={ru}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      {clearable && value && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => onChange('')}
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  )
}

export { DateInput }
