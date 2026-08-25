/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const { data: users } = await (supabase.from("profiles") as any)
    .select("*")
    .order("created_at", { ascending: false })

  const usersList = users || []

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-muted-foreground">Directorio y gestión de permisos de cuentas.</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">Usuario</th>
                  <th className="px-6 py-4 font-medium">Rol</th>
                  <th className="px-6 py-4 font-medium">Créditos</th>
                  <th className="px-6 py-4 font-medium">Registro</th>
                  <th className="px-6 py-4 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {usersList.map((profile: any) => (
                  <tr key={profile.id} className="hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div className="font-bold">{profile.full_name || 'Sin Nombre'}</div>
                      <div className="text-xs text-muted-foreground">{profile.email || profile.id}</div>
                      <div className="text-xs text-muted-foreground">{profile.phone}</div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={
                        profile.role === 'platform_admin' ? 'destructive' :
                        profile.role === 'venue_admin' ? 'default' : 'secondary'
                      } className="capitalize">
                        {profile.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 font-medium">
                      ${profile.credits?.toLocaleString('es-AR') || 0}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {new Date(profile.created_at).toLocaleDateString('es-AR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {profile.role === 'player' && (
                        <Button variant="outline" size="sm" className="mr-2">Hacer Venue Admin</Button>
                      )}
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">Ban</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
