"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

/**
 * Cierra una entrada de la cola de reconciliación.
 *
 * El chequeo de rol va acá adentro y no alcanza con `admin/layout.tsx`: una
 * Server Action es un endpoint POST propio, y los layouts solo gobiernan el
 * render de las páginas. Sin esto, cualquier usuario autenticado podría cerrar
 * pagos huérfanos ajenos.
 */
async function assertPlatformAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  const role = (profileRow as { role: string } | null)?.role
  if (role !== "platform_admin") {
    throw new Error("No autorizado")
  }

  return user.id
}

/**
 * Estados con los que se puede cerrar una entrada.
 *
 * 'pending' queda deliberadamente afuera: esta acción cierra, no reabre.
 * Reabrir a mano borraría el rastro de quién la resolvió y cuándo.
 */
type ResolvedStatus = 'refunded' | 'dismissed'

function isResolvedStatus(value: unknown): value is ResolvedStatus {
  return value === 'refunded' || value === 'dismissed'
}

export async function resolveReconciliation(formData: FormData) {
  const supabase = await createClient()
  const adminId = await assertPlatformAdmin(supabase)

  const id = formData.get("id")
  const rawStatus = formData.get("status")
  const notes = formData.get("notes")

  if (typeof id !== "string" || !id) {
    throw new Error("Falta el id de la entrada")
  }

  // Hace falta un type guard, no un `!==`: `formData.get` devuelve
  // `File | string | null`, y restarle dos literales a `string` sigue dando
  // `string`. Con `string` el payload no matchea la columna y el tipo del
  // update colapsa a `never`.
  if (!isResolvedStatus(rawStatus)) {
    throw new Error("Estado inválido")
  }
  const status = rawStatus

  const { error } = await supabase
    .from("payment_reconciliations")
    .update({
      status,
      resolved_by: adminId,
      resolved_at: new Date().toISOString(),
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null
    })
    .eq("id", id)

  if (error) {
    throw new Error("No se pudo actualizar la entrada: " + error.message)
  }

  revalidatePath("/admin/reconciliation")
}
