import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * `next` llega desde la URL, así que lo controla quien arme el link.
 *
 * Concatenar `${origin}${next}` a mano era explotable: con `next=@evil.com` el
 * string queda `https://reservaya.app@evil.com`, donde `reservaya.app` es el
 * userinfo y el host real es `evil.com` — un open redirect desde un dominio en
 * el que el usuario ya confía y acaba de autenticarse.
 *
 * Resolver contra `origin` con el parser de URL en vez de pegar strings tapa esa
 * familia entera: `//evil.com`, `https://evil.com`, `/\evil.com` y `@evil.com`
 * terminan todos con un origin distinto al nuestro. Solo se devuelve la parte
 * relativa, y ante cualquier cosa rara se cae a la home.
 */
function resolveSafeNext(rawNext: string | null, origin: string): string {
  if (!rawNext) return '/'
  try {
    const target = new URL(rawNext, origin)
    if (target.origin !== origin) return '/'
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return '/'
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = resolveSafeNext(searchParams.get('next'), origin)

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(new URL(next, origin))
    } else {
      console.error('Auth callback error:', error)
    }
  }

  // Redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
