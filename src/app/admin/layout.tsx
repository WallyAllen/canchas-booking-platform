import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/layout/Header"
import { LayoutDashboard, Users, Building, Shield } from "lucide-react"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = (await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()) as { data: { role: string } | null }

  if (profile?.role !== 'platform_admin') {
    redirect('/')
  }

  return (
    <div className="relative flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="w-full md:w-64">
          <nav className="flex flex-col gap-2 p-4 md:w-64 border-r min-h-[calc(100vh-4rem)] bg-muted/20">
            <div className="mb-4 px-2">
              <h2 className="text-lg font-semibold tracking-tight">Admin Global</h2>
              <p className="text-sm text-muted-foreground">Plataforma</p>
            </div>
            <Link href="/admin" className="flex items-center gap-3 rounded-lg px-3 py-2 transition-all text-muted-foreground hover:bg-muted hover:text-primary">
              <LayoutDashboard className="h-4 w-4" />
              <span className="text-sm font-medium">Dashboard</span>
            </Link>
            <Link href="/admin/users" className="flex items-center gap-3 rounded-lg px-3 py-2 transition-all text-muted-foreground hover:bg-muted hover:text-primary">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">Usuarios</span>
            </Link>
            <Link href="/admin/venues" className="flex items-center gap-3 rounded-lg px-3 py-2 transition-all text-muted-foreground hover:bg-muted hover:text-primary">
              <Building className="h-4 w-4" />
              <span className="text-sm font-medium">Complejos</span>
            </Link>
            <Link href="/admin/moderation" className="flex items-center gap-3 rounded-lg px-3 py-2 transition-all text-muted-foreground hover:bg-muted hover:text-primary">
              <Shield className="h-4 w-4" />
              <span className="text-sm font-medium">Moderación</span>
            </Link>
          </nav>
        </aside>
        <main className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
