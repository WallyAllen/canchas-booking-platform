import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { HeroSearch } from "@/components/home/HeroSearch"
import { PromoCarousel, PromoItem } from "@/components/home/PromoCarousel"
import { VenueCard } from "@/components/venue/VenueCard"
import { HowItWorks } from "@/components/home/HowItWorks"
import { Button } from "@/components/ui/button"

export const revalidate = 3600 // revalidate at most every hour

export default async function HomePage() {
  const supabase = await createClient()

  // 1. Fetch Promos
  // Note: we fetch today's day of week or just active promos. For simplicity, we just fetch active promos.
  const { data: promoData } = await supabase
    .from("pricing_rules")
    .select(`
      id,
      price,
      promo_price,
      start_time,
      end_time,
      courts!inner (
        id,
        name,
        venues!inner (
          id,
          name
        )
      )
    `)
    .eq("is_promo_active", true)
    .limit(10)

  // Map to PromoItem format
  const promos: PromoItem[] = (promoData || []).map((p: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
    // Generate a valid date for "hoy"
    const today = new Date().toISOString().split("T")[0]
    return {
      id: p.id,
      venue_id: p.courts.venues.id,
      venue_name: p.courts.venues.name,
      court_name: p.courts.name,
      original_price: p.price,
      promo_price: p.promo_price || p.price,
      start_time: p.start_time,
      end_time: p.end_time,
      date: today
    }
  })

  // 2. Fetch Featured Venues
  const { data: venuesData } = await supabase
    .from("venues")
    .select(`
      id,
      name,
      address,
      city,
      avg_rating,
      review_count,
      photos,
      courts (
        type,
        pricing_rules (
          price
        )
      )
    `)
    .eq("is_active", true)
    .order("avg_rating", { ascending: false })
    .limit(6)

  return (
    <div className="flex flex-col min-h-screen">
      {/* a) Hero Section */}
      <section className="relative w-full overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-black/60 z-10" />
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center" 
          style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1518605368461-1e12522c5443?q=80&w=2000&auto=format&fit=crop")' }}
        />
        
        <div className="relative z-20 container mx-auto px-4 py-24 md:py-32 lg:py-40 flex flex-col items-center text-center">
          <div className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-6 backdrop-blur-sm">
            <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
            La plataforma líder en reservas de La Plata
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white mb-6 drop-shadow-lg max-w-4xl">
            Reservá tu cancha en La Plata
          </h1>
          <p className="text-lg md:text-xl text-zinc-300 mb-10 max-w-2xl drop-shadow-md">
            Encontrá, reservá y pagá la seña de tu turno en segundos. Sin llamados ni mensajes de texto.
          </p>
          
          {/* Buscador */}
          <HeroSearch />
        </div>
      </section>

      {/* b) Turnos en Oferta */}
      {promos.length > 0 && (
        <section className="py-12 md:py-16 container px-4 md:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Ofertas de último momento</h2>
              <p className="text-muted-foreground mt-1">Turnos con descuento para hoy.</p>
            </div>
            <div className="hidden md:block">
              {/* Espacio para botones de carrusel (están en el componente) */}
            </div>
          </div>
          <PromoCarousel promos={promos} />
        </section>
      )}

      {/* c) Canchas Destacadas */}
      <section className="py-12 md:py-16 bg-muted/20">
        <div className="container px-4 md:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Complejos Destacados</h2>
              <p className="text-muted-foreground mt-1">Las canchas mejor valoradas por los jugadores.</p>
            </div>
            <Button render={<Link href="/search" />} variant="ghost" className="hidden md:flex">
              Ver todas &rarr;
            </Button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {venuesData?.map((venue: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
              // Extraer tipos de canchas únicos
              const typesSet = new Set<string>()
              let minPrice = Infinity
              
              venue.courts?.forEach((court: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
                if (court.type) typesSet.add(court.type)
                court.pricing_rules?.forEach((rule: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
                  if (rule.price < minPrice) minPrice = rule.price
                })
              })
              
              if (minPrice === Infinity) minPrice = 0

              const courtTypes = Array.from(typesSet)

              const venueProps = {
                id: venue.id,
                name: venue.name,
                address: venue.address,
                city: venue.city,
                avg_rating: venue.avg_rating,
                review_count: venue.review_count,
                featured_image: venue.photos?.[0] || null
              }

              return (
                <VenueCard 
                  key={venue.id}
                  venue={venueProps}
                  minPrice={minPrice}
                  courtTypes={courtTypes}
                />
              )
            })}
          </div>
          
          <div className="mt-8 flex justify-center md:hidden">
            <Button render={<Link href="/search" />} variant="outline" className="w-full">
              Ver todas las canchas
            </Button>
          </div>
        </div>
      </section>

      {/* d) ¿Cómo Funciona? */}
      <HowItWorks />

      {/* e) CTA para Dueños */}
      <section className="py-16 md:py-24 container px-4 md:px-8">
        <div className="bg-primary/10 rounded-3xl border border-primary/20 p-8 md:p-12 lg:p-16 text-center md:text-left relative overflow-hidden">
          {/* Adornos visuales */}
          <div className="absolute -right-20 -top-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-60 h-60 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4 max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">¿Tenés un predio?</h2>
              <p className="text-lg text-muted-foreground">
                Sumá tus canchas gratis a ReservaYa. Digitalizá tu agenda, cobrá señas online de forma segura y aumentá la ocupación de tus turnos vacíos con ofertas de último momento.
              </p>
            </div>
            <div className="shrink-0 w-full md:w-auto">
              <Button render={<Link href="/dashboard" />} size="lg" className="w-full md:w-auto h-14 px-8 text-base font-semibold">
                Registrar mi predio
              </Button>
            </div>
          </div>
        </div>
      </section>
      
      {/* f) Stats (Hardcoded para diseño) */}
      <section className="border-t border-border/50 bg-card py-12">
        <div className="container px-4 flex flex-wrap justify-center md:justify-around gap-8 text-center">
          <div className="space-y-2">
            <p className="text-4xl font-black text-primary">+50</p>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Canchas</p>
          </div>
          <div className="space-y-2">
            <p className="text-4xl font-black text-primary">+10k</p>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Reservas</p>
          </div>
          <div className="space-y-2">
            <p className="text-4xl font-black text-primary">24/7</p>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Disponibilidad</p>
          </div>
        </div>
      </section>
    </div>
  )
}
