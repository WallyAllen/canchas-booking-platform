"use client"

import * as React from "react"
import { Clock } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface TimePickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function TimePicker({ value, onChange, placeholder = "Horario", className }: TimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  // Generate exact times every 30 mins from 08:00 to 23:30
  const timeSlots = React.useMemo(() => {
    const slots = []
    for (let h = 8; h <= 23; h++) {
      slots.push(`${h.toString().padStart(2, "0")}:00`)
      slots.push(`${h.toString().padStart(2, "0")}:30`)
    }
    return slots
  }, [])

  const handleSelect = (val: string) => {
    onChange(val)
    setIsOpen(false)
  }

  const getDisplayValue = () => {
    if (!value || value === "any") return placeholder
    if (value === "morning") return "Mañana"
    if (value === "afternoon") return "Tarde"
    if (value === "evening") return "Noche"
    return value
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full justify-start text-left font-normal bg-background/50 border-0 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 hover:bg-background/80 px-3",
          (!value || value === "any") && "text-muted-foreground",
          className
        )}
      >
        <Clock className="mr-2 h-4 w-4 shrink-0" />
        <span className="truncate">{getDisplayValue()}</span>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-4" align="start">
        <div className="space-y-5">
          {/* Ranges Section */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Franjas Horarias</h4>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={!value || value === "any" ? "secondary" : "outline"}
                size="sm"
                className="justify-start font-normal"
                onClick={() => handleSelect("any")}
              >
                Cualquiera
              </Button>
              <Button
                variant={value === "morning" ? "secondary" : "outline"}
                size="sm"
                className="justify-start font-normal"
                onClick={() => handleSelect("morning")}
              >
                Mañana (8-13h)
              </Button>
              <Button
                variant={value === "afternoon" ? "secondary" : "outline"}
                size="sm"
                className="justify-start font-normal"
                onClick={() => handleSelect("afternoon")}
              >
                Tarde (13-18h)
              </Button>
              <Button
                variant={value === "evening" ? "secondary" : "outline"}
                size="sm"
                className="justify-start font-normal"
                onClick={() => handleSelect("evening")}
              >
                Noche (18-00h)
              </Button>
            </div>
          </div>
          
          <div className="h-px bg-border" />

          {/* Specific Times Section */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground">Horario Específico</h4>
            <div className="grid grid-cols-4 gap-1.5 max-h-[160px] overflow-y-auto pr-1">
              {timeSlots.map((time) => (
                <Button
                  key={time}
                  variant={value === time ? "secondary" : "ghost"}
                  size="sm"
                  className="text-xs font-normal"
                  onClick={() => handleSelect(time)}
                >
                  {time}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
