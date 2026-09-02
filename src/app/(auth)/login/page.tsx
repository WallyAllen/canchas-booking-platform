// Route segment config solo es válido en un Server Component: la lógica de
// login vive en un Client Component aparte (useUser() crea el cliente de
// Supabase en el cuerpo del hook, y esta página depende de estado de sesión,
// así que no debe prerenderse en build).
export const dynamic = 'force-dynamic'

import { LoginPageClient } from "@/components/auth/login-form"

export default function LoginPage() {
  return <LoginPageClient />
}
