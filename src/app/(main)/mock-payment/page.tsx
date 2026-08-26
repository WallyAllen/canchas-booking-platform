/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { CheckCircle2, XCircle } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function MockPaymentPage({
  searchParams,
}: {
  searchParams: { booking_id?: string; court_id?: string; price?: string }
}) {
  const { booking_id, court_id, price } = searchParams

  if (!booking_id || !court_id) {
    redirect("/")
  }

  // Define Server Action to approve payment
  async function approvePayment() {
    "use server"
    const supabase = await createClient()
    
    await (supabase.from("bookings") as any)
      .update({ status: 'confirmed', payment_status: 'paid' })
      .eq('id', booking_id as string)
      
    redirect(`/booking/${court_id}/success?booking_id=${booking_id}`)
  }

  // Define Server Action to reject payment
  async function rejectPayment() {
    "use server"
    redirect(`/booking/${court_id}?error=payment_failed`)
  }

  return (
    <div className="container max-w-md mx-auto py-20">
      <Card className="border-border/50">
        <CardHeader className="text-center bg-muted/30">
          <CardTitle className="text-2xl text-blue-500">Mercado Pago (MOCK)</CardTitle>
          <CardDescription>Entorno de Pruebas Local</CardDescription>
        </CardHeader>
        <CardContent className="p-8 space-y-6 text-center">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Monto a pagar</p>
            <p className="text-4xl font-bold">${price}</p>
          </div>
          
          <div className="bg-blue-500/10 text-blue-600 p-4 rounded-xl text-sm">
            Estás viendo esta pantalla porque no hay credenciales válidas de Mercado Pago configuradas. Úsala para probar el flujo.
          </div>

          <div className="space-y-3 pt-4">
            <form action={approvePayment}>
              <Button type="submit" className="w-full bg-green-500 hover:bg-green-600 text-white h-12">
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Simular Pago Aprobado
              </Button>
            </form>
            
            <form action={rejectPayment}>
              <Button type="submit" variant="outline" className="w-full h-12 border-red-200 text-red-500 hover:bg-red-50">
                <XCircle className="w-5 h-5 mr-2" />
                Simular Pago Rechazado
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
