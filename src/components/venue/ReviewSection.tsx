/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState } from "react"
import { Star, MessageSquare } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useUser } from "@/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import { toast } from "@/components/ui/toast"

export interface ReviewItem {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reply: string | null
  profiles: {
    full_name: string
    avatar_url: string | null
  }
}

interface ReviewSectionProps {
  venueId: string
  avgRating: number
  reviewCount: number
  reviews: ReviewItem[]
}

export function ReviewSection({ venueId, avgRating, reviewCount, reviews }: ReviewSectionProps) {
  const { user } = useUser()
  const [isOpen, setIsOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Calcular distribución
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<number, number>
  reviews.forEach(r => {
    const rounded = Math.round(r.rating)
    if (rounded >= 1 && rounded <= 5) {
      distribution[rounded]++
    }
  })

  const handleSubmit = async () => {
    if (!user) return
    setIsSubmitting(true)
    
    try {
      const supabase = createClient()
      const { error } = await (supabase.from('reviews') as any).insert({
        venue_id: venueId,
        user_id: user.id,
        rating,
        comment: comment.trim() || null
      })

      if (error) throw error

      toast.add({
        title: "Reseña publicada",
        description: "Gracias por compartir tu experiencia.",
      })
      
      setIsOpen(false)
      setComment("")
      // IDEALMENTE refetch data o agregar optimistic update
    } catch (error: any) {
      toast.add({
        type: "error",
        title: "Error",
        description: error.message || "No se pudo publicar la reseña.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Reseñas de Jugadores
        </h3>
        {user && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger render={
              <Button variant="outline">
                Escribir Reseña
              </Button>
            } />
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Dejá tu reseña</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex flex-col items-center gap-2">
                  <span className="text-sm font-medium">¿Cómo estuvo la cancha?</span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className="p-1 focus:outline-hidden"
                      >
                        <Star className={`h-8 w-8 transition-colors ${rating >= star ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="comment" className="text-sm font-medium">Comentario (opcional)</label>
                  <Textarea
                    id="comment"
                    placeholder="El césped está en muy buen estado..."
                    value={comment}
                    onChange={(e: any) => setComment(e.target.value)}
                    rows={4}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full">
                  {isSubmitting ? "Publicando..." : "Publicar reseña"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {reviewCount > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Resumen */}
          <div className="md:col-span-4 flex flex-col items-center justify-center bg-muted/30 rounded-xl p-6 border border-border/50">
            <div className="text-5xl font-black">{avgRating.toFixed(1)}</div>
            <div className="flex items-center gap-1 my-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star 
                  key={star} 
                  className={`h-5 w-5 ${Math.round(avgRating) >= star ? 'fill-yellow-400 text-yellow-400' : 'fill-muted text-muted'}`} 
                />
              ))}
            </div>
            <div className="text-sm text-muted-foreground">{reviewCount} calificaciones</div>
          </div>

          {/* Barras de distribución */}
          <div className="md:col-span-8 space-y-3 flex flex-col justify-center">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = distribution[stars] || 0
              const percentage = reviewCount > 0 ? (count / reviewCount) * 100 : 0
              return (
                <div key={stars} className="flex items-center gap-3 text-sm">
                  <div className="flex items-center gap-1 w-12 font-medium">
                    <span>{stars}</span>
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  </div>
                  <Progress value={percentage} className="h-2 flex-1" />
                  <div className="w-8 text-right text-muted-foreground">{count}</div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 bg-muted/20 rounded-xl border border-border/50">
          <p className="text-muted-foreground">Esta cancha aún no tiene reseñas.</p>
        </div>
      )}

      {/* Lista de reseñas */}
      <div className="space-y-6">
        {reviews.map((review) => (
          <div key={review.id} className="border-b border-border/50 pb-6 last:border-0">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarImage src={review.profiles.avatar_url || ""} />
                  <AvatarFallback>{review.profiles.full_name?.charAt(0) || "U"}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{review.profiles.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={`h-4 w-4 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'fill-muted text-muted'}`} 
                  />
                ))}
              </div>
            </div>
            
            {review.comment && (
              <p className="mt-3 text-sm">{review.comment}</p>
            )}

            {review.reply && (
              <div className="mt-3 ml-10 p-3 bg-muted/50 rounded-lg text-sm border-l-2 border-primary">
                <p className="font-medium text-xs text-primary mb-1">Respuesta del complejo:</p>
                <p>{review.reply}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
