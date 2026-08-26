import { createClient } from "@/lib/supabase/server"
import { SearchLayout } from "@/components/search/SearchLayout"
import { SearchVenueItem } from "@/components/search/VenueList"

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
    query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%,address.ilike.%${q}%`)
  }

  const { data: venuesData, error } = await query

  if (error) {
    console.error("Error fetching search results:", error)
  }

  // Filtrado post-query para relaciones complejas (tipos de canchas, precios, superficies)
  const filteredVenues: SearchVenueItem[] = []

  if (venuesData) {
    venuesData.forEach((venue: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
      // Collect all court types and surfaces, and find min price
      const typesSet = new Set<string>()
      const surfacesSet = new Set<string>()
      let venueMinPrice = Infinity
      let venueMaxPrice = 0

      venue.courts?.forEach((court: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
        if (court.type) typesSet.add(court.type)
        if (court.surface) surfacesSet.add(court.surface)
        
        court.pricing_rules?.forEach((rule: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => {
          if (rule.price < venueMinPrice) venueMinPrice = rule.price
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
          min_price: venueMinPrice,
          court_types: Array.from(typesSet),
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
