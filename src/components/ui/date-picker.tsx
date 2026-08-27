"use client"

import * as React from "react"
import { format, addDays, parseISO, isValid } from "date-fns"
import { es } from "date-fns/locale"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  formatStr?: string
}

export function DatePicker({ value, onChange, placeholder = "Seleccionar fecha", className, formatStr = "d MMM" }: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const dateValue = React.useMemo(() => {
    if (!value) return undefined
    const parsed = parseISO(value)
    return isValid(parsed) ? parsed : undefined
  }, [value])

  const handleSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      onChange(format(selectedDate, "yyyy-MM-dd"))
    } else {
      onChange("")
    }
    setIsOpen(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full justify-start text-left font-normal bg-background/50 border-0 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 hover:bg-background/80 px-3",
          !dateValue && "text-muted-foreground",
          className
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
        <span className="truncate">
          {dateValue ? format(dateValue, formatStr, { locale: es }) : placeholder}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x border-border">
          <div className="p-3 space-y-2 flex flex-row sm:flex-col gap-2 sm:gap-0 min-w-[120px]">
            <Button
              variant="ghost"
              className="w-full justify-start font-normal text-sm"
              onClick={() => handleSelect(new Date())}
            >
              Hoy
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start font-normal text-sm"
              onClick={() => handleSelect(addDays(new Date(), 1))}
            >
              Mañana
            </Button>
            <div className="hidden sm:block pt-4 text-xs text-muted-foreground">
              Seleccioná un día rápido o buscá en el calendario.
            </div>
          </div>
          <Calendar
            mode="single"
            selected={dateValue}
            onSelect={handleSelect}
            disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
            locale={es}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
