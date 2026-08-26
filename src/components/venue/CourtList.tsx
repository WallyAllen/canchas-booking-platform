"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Sun, CloudRain, Lightbulb, LightbulbOff } from "lucide-react"

export interface CourtItem {
  id: string
  name: string
  type: string
  surface: string
  has_lighting: boolean
  is_covered: boolean
  slot_duration_minutes: number
}

interface CourtListProps {
  courts: CourtItem[]
  onSelectCourt?: (id: string) => void
}

export function CourtList({ courts, onSelectCourt }: CourtListProps) {
  if (!courts || courts.length === 0) return null

  // Scroll to availability grid
  const scrollToGrid = (id: string) => {
    if (onSelectCourt) {
      onSelectCourt(id)
    }
    const element = document.getElementById("availability-grid")
    if (element) {
      element.scrollIntoView({ behavior: "smooth" })
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">Canchas Disponibles ({courts.length})</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courts.map((court) => (
          <Card key={court.id} className="overflow-hidden border-border/50 bg-card/50 hover:bg-card transition-colors">
            <CardContent className="p-5 flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-bold text-lg">{court.name}</h4>
                <Badge variant="default" className="bg-primary/20 text-primary hover:bg-primary/30 border-none">
                  {court.type}
                </Badge>
              </div>
              
              <div className="space-y-3 flex-1 mb-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Superficie</span>
                  <span className="font-medium capitalize">{court.surface}</span>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Iluminación</span>
                  <div className="flex items-center gap-1.5 font-medium">
                    {court.has_lighting ? (
                      <><Lightbulb className="h-4 w-4 text-yellow-500" /> Sí</>
                    ) : (
                      <><LightbulbOff className="h-4 w-4 text-muted-foreground" /> No</>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Techada</span>
                  <div className="flex items-center gap-1.5 font-medium">
                    {court.is_covered ? (
                      <><CloudRain className="h-4 w-4 text-blue-400" /> Sí</>
                    ) : (
                      <><Sun className="h-4 w-4 text-yellow-500" /> Descubierta</>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Turno</span>
                  <span className="font-medium">{court.slot_duration_minutes} min</span>
                </div>
              </div>
              
              <Button onClick={() => scrollToGrid(court.id)} variant="outline" className="w-full mt-auto">
                Ver disponibilidad
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
