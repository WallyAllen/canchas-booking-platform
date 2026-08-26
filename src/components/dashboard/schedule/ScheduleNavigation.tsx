/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/label-has-associated-control */
"use client"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"

export function ScheduleNavigation({ currentDate }: { currentDate: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const navigateDays = (days: number) => {
    const date = new Date(currentDate + "T12:00:00")
    date.setDate(date.getDate() + days)
    const newDateStr = date.toISOString().split('T')[0]
    
    const params = new URLSearchParams(searchParams.toString())
    params.set('date', newDateStr)
    router.push(`${pathname}?${params.toString()}`)
  }

  const goToday = () => {
    const today = new Date().toISOString().split('T')[0]
    const params = new URLSearchParams(searchParams.toString())
    params.set('date', today)
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => navigateDays(-1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="outline" className="min-w-[140px] justify-center" onClick={goToday}>
        <CalendarIcon className="mr-2 h-4 w-4" />
        {currentDate}
      </Button>
      <Button variant="outline" size="icon" onClick={() => navigateDays(1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
