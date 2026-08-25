/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextResponse } from 'next/server'
import { cancelBooking } from '@/lib/booking/actions'

export async function POST(request: Request) {
  try {
    const { bookingId } = await request.json()
    
    if (!bookingId) {
      return NextResponse.json({ error: 'Falta bookingId' }, { status: 400 })
    }

    const result = await cancelBooking(bookingId)
    
    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
