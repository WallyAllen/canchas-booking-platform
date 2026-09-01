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

  const { data: venuesData, error } = await query

  if (error) {
    console.error("Error fetching search results:", error)
  }

  // Filtrado post-query para relaciones complejas (tipos de canchas, precios, superficies)
  const filteredVenues: SearchVenueItem[] = []

  if (venuesData) {
    venuesData.forEach((venue: unknown ) => {
      // Collect all court types and surfaces, and find min price
      const typesSet = new Set<string>()
      const surfacesSet = new Set<string>()
      let venueMinPrice = Infinity
      let venueMaxPrice = 0

      // @ts-expect-error fix inference
      venue.courts?.forEach((court: unknown ) => {
        // @ts-expect-error fix inference
        if (court.type) typesSet.add(court.type)
        // @ts-expect-error fix inference
        if (court.surface) surfacesSet.add(court.surface)
        
        // @ts-expect-error fix inference
        court.pricing_rules?.forEach((rule: unknown ) => {
          // @ts-expect-error fix inference
          if (rule.price < venueMinPrice) venueMinPrice = rule.price
          // @ts-expect-error fix inference
          if (rule.price > venueMaxPrice) venueMaxPrice = rule.price
        })
      })

      if (venueMinPrice === Infinity) venueMinPrice = 0

      const requireDepositFilter = searchParams.requireDeposit === 'true' ? true : searchParams.requireDeposit === 'false' ? false : null

      const hasMatchingType = !type || typesSet.has(type)
      const hasMatchingSurface = !surface || surfacesSet.has(surface)
      const hasMatchingPrice = 
        (!minPrice || venueMaxPrice >= minPrice) && 
        (maxPrice === Infinity || venueMinPrice <= maxPrice)
      // @ts-expect-error fix inference
      const hasMatchingDeposit = requireDepositFilter === null || venue.require_deposit === requireDepositFilter

      if (hasMatchingType && hasMatchingSurface && hasMatchingPrice && hasMatchingDeposit) {
        filteredVenues.push({
          // @ts-expect-error fix inference
          id: venue.id,
          // @ts-expect-error fix inference
          name: venue.name,
          // @ts-expect-error fix inference
          address: venue.address,
          // @ts-expect-error fix inference
          city: venue.city,
          // @ts-expect-error fix inference
          avg_rating: venue.avg_rating,
          // @ts-expect-error fix inference
          review_count: venue.review_count,
          // @ts-expect-error fix inference
          featured_image: venue.photos?.[0] || null,
          // @ts-expect-error fix inference
          latitude: venue.latitude,
          // @ts-expect-error fix inference
          longitude: venue.longitude,
          min_price: venueMinPrice,
          court_types: Array.from(typesSet),
          // @ts-expect-error fix inference
          require_deposit: venue.require_deposit
        })
      }
    })
  }

  // Sorting logic based on sort param
  const sortParam = typeof searchParams.sort === 'string' ? searchParams.sort : 'rating'
  
  filteredVenues.sort((a, b) => {
    if (sortParam === 'price_asc') {
      return a.min_price - b.min_price
    } else if (sortParam === 'price_desc') {
      return b.min_price - a.min_price
    }
    // default to rating
    return b.avg_rating - a.avg_rating
  })

  return <SearchLayout venues={filteredVenues} />
}
