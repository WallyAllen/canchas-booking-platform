/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Star, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export const dynamic = 'force-dynamic'

export default async function ReviewsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: venues } = await (supabase.from("venues") as any)
    .select("id")
    .eq("owner_id", user.id)

  const venue = venues?.[0]
  if (!venue) redirect("/dashboard")

  const { data: reviewsData } = await (supabase.from("reviews") as any)
    .select("*, profiles(full_name, avatar_url)")
    .eq("venue_id", venue.id)
    .order("created_at", { ascending: false })

  const reviews = reviewsData || []

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reseñas</h1>
        <p className="text-muted-foreground">Lo que opinan los jugadores de tu complejo.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Calificación Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-4xl font-bold">{averageRating}</span>
              <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Reseñas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{reviews.length}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {reviews.length > 0 ? reviews.map((review: any) => (
          <Card key={review.id}>
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {review.profiles?.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={review.profiles.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-semibold text-muted-foreground">{review.profiles?.full_name?.charAt(0) || 'U'}</span>
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{review.profiles?.full_name || 'Usuario'}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString('es-AR')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center bg-yellow-400/10 px-2 py-1 rounded-md text-yellow-600 font-medium text-sm">
                  <Star className="h-3.5 w-3.5 fill-current mr-1" />
                  {review.rating}
                </div>
              </div>
              
              {review.comment && (
                <p className="text-sm mb-4">{review.comment}</p>
              )}
              
              <div className="pt-4 border-t border-border/50 flex justify-end">
                <Button variant="outline" size="sm">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Responder
                </Button>
              </div>
            </CardContent>
          </Card>
        )) : (
          <div className="py-12 text-center bg-muted/20 border rounded-xl border-dashed">
            <Star className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium mb-1">Aún no hay reseñas</h3>
            <p className="text-muted-foreground">Los jugadores podrán dejar reseñas luego de jugar en tu complejo.</p>
          </div>
        )}
      </div>
    </div>
  )
}
