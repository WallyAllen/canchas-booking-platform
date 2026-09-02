// Route segment config solo es válido en un Server Component: la lógica de
// perfil vive en un Client Component aparte (createClient() y useUser()
// crean el cliente de Supabase en el cuerpo del componente, y esta página
// muestra estado de sesión, así que no debe prerenderse en build).
export const dynamic = 'force-dynamic'

import { ProfilePageClient } from "@/components/profile/profile-page-client"

export default function ProfilePage() {
  return <ProfilePageClient />
}
