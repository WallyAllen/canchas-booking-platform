/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Wallet, Clock } from "lucide-react"

export function CreditsList({ userId }: { userId: string }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [credits, setCredits] = useState<any[]>([])
  const [availableCredits, setAvailableCredits] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    const fetchCredits = async () => {
      const { data } = await supabase.from("credits")
        .select("*, bookings(courts(name, venues(name)))")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
      
      if (data) {
        setCredits(data)
        const total = data
          .filter((c: import("@/types/domain").Credit) => c.status === 'available')
          .reduce((acc: number, curr: import("@/types/domain").Credit) => acc + curr.amount, 0)
        setAvailableCredits(total)
      }
    }
    
    if (userId) {
      fetchCredits()
    }
  }, [userId, supabase])

  return (
    <Card className="bg-primary/5 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Wallet className="h-5 w-5 text-primary" />
          Mis Créditos
        </CardTitle>
        <CardDescription>Saldo disponible en plataforma</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold text-primary mb-4">
          ${availableCredits.toLocaleString('es-AR')}
        </div>
        
        <div className="space-y-4 mt-6 max-h-[400px] overflow-y-auto pr-2">
          {credits.length > 0 ? (
            Object.entries(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              credits.reduce((acc: any, credit: import("@/types/domain").Credit) => {
                // @ts-expect-error fix inference
                const venueName = credit.bookings?.courts?.venues?.name || "Complejo Desconocido"
                if (!acc[venueName]) acc[venueName] = { available: 0, list: [] }
                if (credit.status === 'available') {
                  acc[venueName].available += credit.amount
                }
                acc[venueName].list.push(credit)
                return acc
              }, {})
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ).map(([venueName, data]: any) => (
              <div key={venueName} className="border rounded-lg p-4 bg-background">
                <div className="flex justify-between items-center mb-3 border-b pb-2">
                  <h4 className="font-semibold">{venueName}</h4>
                  <span className="font-bold text-green-600">${data.available.toLocaleString('es-AR')}</span>
                </div>
                <div className="space-y-2">
                  {data.list.map((credit: import("@/types/domain").Credit) => {
                    const isAvailable = credit.status === 'available'
                    const isUsed = credit.status === 'used'
                    
                    return (
                      <div key={credit.id} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant={isAvailable ? 'default' : 'secondary'} className={`text-[10px] px-1 py-0 ${isAvailable ? 'bg-green-500 hover:bg-green-600' : ''}`}>
                            {isAvailable ? 'Disponible' : isUsed ? 'Usado' : 'Vencido'}
                          </Badge>
                          <span className="text-muted-foreground text-xs">
                            {isAvailable ? `Vence: ${new Date(credit.expires_at).toLocaleDateString('es-AR')}` : ''}
                          </span>
                        </div>
                        <span className={isAvailable ? 'font-medium' : 'text-muted-foreground line-through'}>
                          ${credit.amount.toLocaleString('es-AR')}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No tienes saldo a favor en ningún complejo.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
