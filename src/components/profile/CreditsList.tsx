/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Wallet, Clock } from "lucide-react"

export function CreditsList({ userId }: { userId: string }) {
  const [credits, setCredits] = useState<any[]>([])
  const [availableCredits, setAvailableCredits] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    const fetchCredits = async () => {
      const { data } = await (supabase.from("credits") as any)
        .select("*, bookings(courts(name, venues(name)))")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
      
      if (data) {
        setCredits(data)
        const total = data
          .filter((c: any) => c.status === 'available')
          .reduce((acc: number, curr: any) => acc + curr.amount, 0)
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
        
        <div className="space-y-3 mt-6 max-h-[250px] overflow-y-auto pr-2">
          {credits.length > 0 ? credits.map((credit: any) => {
            const isAvailable = credit.status === 'available'
            const isUsed = credit.status === 'used'
            
            return (
              <div key={credit.id} className={`p-3 rounded-md border ${isAvailable ? 'bg-background' : 'bg-muted/50'}`}>
                <div className="flex justify-between items-start mb-1">
                  <div className="font-bold">${credit.amount.toLocaleString('es-AR')}</div>
                  <Badge variant={isAvailable ? 'default' : 'secondary'} className={isAvailable ? 'bg-green-500 hover:bg-green-600 text-white' : ''}>
                    {isAvailable ? 'Disponible' : isUsed ? 'Usado' : 'Expirado'}
                  </Badge>
                </div>
                
                {credit.bookings?.courts?.name && (
                  <div className="text-xs text-muted-foreground line-clamp-1 mb-1">
                    Por cancelación en {credit.bookings.courts.venues?.name}
                  </div>
                )}
                
                <div className="flex items-center text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  {isAvailable ? (
                    <span>Vence el {new Date(credit.expires_at).toLocaleDateString('es-AR')}</span>
                  ) : (
                    <span>{isUsed ? 'Usado' : 'Expirado'} el {new Date(credit.expires_at).toLocaleDateString('es-AR')}</span>
                  )}
                </div>
              </div>
            )
          }) : (
            <p className="text-sm text-muted-foreground text-center py-4">No tienes historial de créditos.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
