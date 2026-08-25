import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export interface PricingRule {
  id: string
  court_name: string
  day_of_week: number
  start_time: string
  end_time: string
  price: number
  promo_price: number | null
  is_promo_active: boolean
}

interface PricingTableProps {
  pricingRules: PricingRule[]
}

export function PricingTable({ pricingRules }: PricingTableProps) {
  if (!pricingRules || pricingRules.length === 0) return null

  // Helper para el nombre del día
  const getDayName = (day: number) => {
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
    return days[day]
  }

  // Format time HH:MM
  const formatTime = (time: string) => time.substring(0, 5)

  // Sort by day then by start_time
  const sortedRules = [...pricingRules].sort((a, b) => {
    if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week
    return a.start_time.localeCompare(b.start_time)
  })

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">Tarifas</h3>
      <div className="rounded-md border border-border/50 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Cancha</TableHead>
              <TableHead>Día</TableHead>
              <TableHead>Horario</TableHead>
              <TableHead className="text-right">Precio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="font-medium">{rule.court_name}</TableCell>
                <TableCell>{getDayName(rule.day_of_week)}</TableCell>
                <TableCell>{formatTime(rule.start_time)} - {formatTime(rule.end_time)}</TableCell>
                <TableCell className="text-right">
                  {rule.is_promo_active && rule.promo_price ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground line-through">
                        ${rule.price.toLocaleString('es-AR')}
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-none hover:bg-red-500/20 px-1.5 h-5 text-[10px]">
                          Promo
                        </Badge>
                        <span className="font-bold text-primary">
                          ${rule.promo_price.toLocaleString('es-AR')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <span className="font-medium">${rule.price.toLocaleString('es-AR')}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
