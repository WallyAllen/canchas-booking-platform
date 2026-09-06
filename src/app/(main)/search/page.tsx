import { createClient } from "@/lib/supabase/server"
import { SearchLayout } from "@/components/search/search-layout"
import { SearchVenueItem } from "@/components/search/venue-list"

export const dynamic = 'force-dynamic'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const supabase = await createClient()

  // Parse params
  const q = typeof searchParams.q === 'string' ? searchParams.q.toLowerCase() : ''
  const type = typeof searchParams.type === 'string' ? searchParams.type : ''
  const surface = typeof searchParams.surface === 'string' ? searchParams.surface : ''
  const minPrice = typeof searchParams.minPrice === 'string' ? parseInt(searchParams.minPrice) : 0
  const maxPrice = typeof searchParams.maxPrice === 'string' ? parseInt(searchParams.maxPrice) : Infinity
  const minRating = typeof searchParams.minRating === 'string' ? parseFloat(searchParams.minRating) : 0

  // Note: For a real app, date/time filtering for availability requires a complex query 
  // checking the bookings table to ensure the slot is free.
  // For this MVP, we will filter by venue properties first.

  let query = supabase
    .from("venues")
    .select(`
      id,
      name,
      address,
      city,
      avg_rating,
      review_count,
      photos,
      latitude,
      longitude,
      require_deposit,
      courts (
        type,
        surface,
        pricing_rules (
          price
        )
      )
    `)
    .eq("is_active", true)

  if (minRating > 0) {
    query = query.gte("avg_rating", minRating)
  }

  // Si hay búsqueda por nombre o ciudad (zona)
  if (q) {
    // `.or()` interpola el string directamente en el filtro de PostgREST:
    // una coma o un paréntesis sin escapar en `q` puede inyectar cláusulas
    // adicionales. Se despoja lo que tiene significado sintáctico para
    // PostgREST antes de interpolar.
    const safeQ = q.replace(/[,().%*]/g, '').trim()
    if (safeQ) {
      query = query.or(`name.ilike.%${safeQ}%,city.ilike.%${safeQ}%,address.ilike.%${safeQ}%`)
    }
  }

  const { data: venuesDataRaw, error } = await query

  if (error) {
    console.error("Error fetching search results:", error)
  }

  // Filtrado post-query para relaciones complejas (tipos de canchas, precios, superficies)
  const filteredVenues: SearchVenueItem[] = []

  interface SearchVenueData {
    id: string
    name: string
    address: string
    city: string
    avg_rating: number
    review_count: number
    photos: string[] | null
    latitude: number | null
    longitude: number | null
    require_deposit: boolean | null
    courts: {
      type: string
      surface: string
      pricing_rules: {
        price: number
      }[]
    }[]
  }

  const venuesData = venuesDataRaw as unknown as SearchVenueData[] | null

  if (venuesData) {
    venuesData.forEach((venue) => {
      // Collect all court types and surfaces, and find min price
      const typesSet = new Set<string>()
      const surfacesSet = new Set<string>()
      let venueMinPrice = Infinity
      let venueMaxPrice = 0

      venue.courts?.forEach((court) => {
        if (court.type) typesSet.add(court.type)
        if (court.surface) surfacesSet.add(court.surface)
        
        court.pricing_rules?.forEach((rule) => {
          if (rule.price < venueMinPrice) venueMinPrice = rule.price
          if (rule.price > venueMaxPrice) venueMaxPrice = rule.price
        })
      })

      // No se coerciona a 0: con Infinity/0 los complejos sin tarifas quedan
      // fuera de los filtros de precio por sí solos, que es lo correcto. Y la
      // tarjeta recibe null para mostrar "Consultar" en vez de "Desde $0".
      const venueMinPriceDisplay = venueMinPrice === Infinity ? null : venueMinPrice

      const requireDepositFilter = searchParams.requireDeposit === 'true' ? true : searchParams.requireDeposit === 'false' ? false : null

      const hasMatchingType = !type || typesSet.has(type)
      const hasMatchingSurface = !surface || surfacesSet.has(surface)
      const hasMatchingPrice = 
        (!minPrice || venueMaxPrice >= minPrice) && 
        (maxPrice === Infinity || venueMinPrice <= maxPrice)
      const hasMatchingDeposit = requireDepositFilter === null || venue.require_deposit === requireDepositFilter

      if (hasMatchingType && hasMatchingSurface && hasMatchingPrice && hasMatchingDeposit) {
        filteredVenues.push({
          id: venue.id,
          name: venue.name,
          address: venue.address,
          city: venue.city,
          avg_rating: venue.avg_rating,
          review_count: venue.review_count,
          featured_image: venue.photos?.[0] || null,
          latitude: venue.latitude,
          longitude: venue.longitude,
          min_price: venueMinPriceDisplay,
          court_types: Array.from(typesSet),
          require_deposit: venue.require_deposit ?? undefined
        })
      }
    })
  }

  // Sorting logic based on sort param
  const sortParam = typeof searchParams.sort === 'string' ? searchParams.sort : 'rating'
  
  filteredVenues.sort((a, b) => {
    if (sortParam === 'price_asc' || sortParam === 'price_desc') {
      // Un complejo sin tarifas cargadas no tiene con qué compararse: va al
      // final en los dos sentidos. Antes valía 0 y encabezaba "más barato".
      if (a.min_price === null && b.min_price === null) return 0
      if (a.min_price === null) return 1
      if (b.min_price === null) return -1
      return sortParam === 'price_asc'
        ? a.min_price - b.min_price
        : b.min_price - a.min_price
    }
    // default to rating
    return b.avg_rating - a.avg_rating
  })

  return <SearchLayout venues={filteredVenues} />
}
