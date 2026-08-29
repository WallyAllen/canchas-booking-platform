import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const text = await request.text()
    const { bookingId } = JSON.parse(text)

    if (!bookingId) {
      return NextResponse.json({ success: false }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()

    if (!userData?.user) {
      return NextResponse.json({ success: false }, { status: 401 })
    }

    await supabase
      .from("bookings")
      .delete()
      .eq("id", bookingId)
      .eq("user_id", userData.user.id)
      .eq("payment_status", "pending")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error cancelling booking via beacon:', error)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
