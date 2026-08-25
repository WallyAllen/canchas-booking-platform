/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Shield, Trash2, CheckCircle } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function AdminModerationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: reviews } = await (supabase.from("reviews") as any)
    .select("*, profiles(full_name), venues(name)")
    .order("created_at", { ascending: false })

  const reviewsList = reviews || []

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Moderación</h1>
          <p className="text-muted-foreground">Supervisa el contenido generado por los usuarios (UGC).</p>
        </div>
      </div>

      <div className="space-y-4">
        {reviewsList.map((review: any) => (
          <Card key={review.id}>
            <CardContent className="p-6 flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold">{review.profiles?.full_name}</span>
                  <span className="text-muted-foreground text-sm">calificó a</span>
                  <span className="font-bold text-primary">{review.venues?.name}</span>
                  <span className="bg-yellow-100 text-yellow-800 text-xs font-bold px-2 py-0.5 rounded-full ml-2">
                    {review.rating} ⭐
                  </span>
                </div>
                <p className="text-sm border-l-2 pl-4 py-1 border-muted italic">
                  {review.comment || '(Sin comentario escrito)'}
                </p>
                <div className="text-xs text-muted-foreground mt-2">
                  ID: {review.id} • {new Date(review.created_at).toLocaleString('es-AR')}
                </div>
              </div>
              
              <div className="flex items-start gap-2 border-t pt-4 md:border-t-0 md:pt-0 md:border-l md:pl-6">
                <Button variant="outline" size="sm" className="text-green-600 hover:text-green-700 hover:bg-green-50">
                  <CheckCircle className="h-4 w-4 mr-2" /> Aprobar
                </Button>
                <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                  <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {reviewsList.length === 0 && (
          <div className="py-12 text-center bg-muted/20 border rounded-xl border-dashed">
            <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium mb-1">Nada por moderar</h3>
            <p className="text-muted-foreground">Todo el contenido está en orden.</p>
          </div>
        )}
      </div>
    </div>
  )
}
