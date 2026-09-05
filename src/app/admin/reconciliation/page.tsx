import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Wallet, XCircle } from "lucide-react"
import { resolveReconciliation } from "./actions"
import type { PaymentReconciliationReason } from "@/types/database"

export const dynamic = 'force-dynamic'

interface ReconciliationRow {
  id: string
  mp_payment_id: string
  booking_id: string | null
  reason: PaymentReconciliationReason
  amount: number | null
  payer_email: string | null
  status: 'pending' | 'refunded' | 'dismissed'
  resolved_at: string | null
  notes: string | null
  created_at: string
}

/** Qué pasó, en castellano, para que no haya que leer la migración 032. */
const MOTIVOS: Record<PaymentReconciliationReason, string> = {
  reserva_inexistente: 'La reserva ya no existía cuando llegó el pago',
  cancelada_a_proposito: 'Alguien canceló la reserva y el pago llegó después',
  turno_ya_vencido: 'El turno ya había pasado cuando llegó el pago',
  turno_reasignado: 'Otro usuario tomó el turno mientras esta estaba cancelada'
}

function formatARS(amount: number | null) {
  if (amount === null) return 'monto desconocido'
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount)
}

export default async function AdminReconciliationPage() {
  // El rol lo valida `admin/layout.tsx`; acá solo se lee.
  const supabase = await createClient()

  const { data } = await supabase
    .from("payment_reconciliations")
    .select("*")
    .order("created_at", { ascending: false })

  const rows = (data ?? []) as unknown as ReconciliationRow[]
  const pending = rows.filter((r) => r.status === 'pending')
  const closed = rows.filter((r) => r.status !== 'pending')

  const totalPendiente = pending.reduce((acc, r) => acc + (r.amount ?? 0), 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reconciliación de pagos</h1>
        <p className="text-muted-foreground">
          Pagos aprobados en Mercado Pago que quedaron sin reserva. Cada uno es plata
          cobrada que hay que devolver o justificar.
        </p>
      </div>

      {pending.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Wallet className="h-5 w-5 text-destructive" />
            <span className="text-sm">
              <strong>{pending.length}</strong>{' '}
              {pending.length === 1 ? 'pago pendiente' : 'pagos pendientes'} de resolver,
              por un total de <strong>{formatARS(totalPendiente)}</strong>.
            </span>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {pending.map((row) => (
          <Card key={row.id}>
            <CardContent className="p-6 flex flex-col lg:flex-row gap-6">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-lg">{formatARS(row.amount)}</span>
                  <Badge variant="destructive">{MOTIVOS[row.reason]}</Badge>
                </div>
                <p className="text-sm">
                  Pagador: <span className="font-medium">{row.payer_email ?? 'sin email registrado'}</span>
                </p>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>Pago MP: <code>{row.mp_payment_id}</code></div>
                  <div>Reserva: <code>{row.booking_id ?? '—'}</code></div>
                  <div>Detectado: {new Date(row.created_at).toLocaleString('es-AR')}</div>
                </div>
              </div>

              <form
                action={resolveReconciliation}
                className="flex flex-col gap-2 border-t pt-4 lg:border-t-0 lg:pt-0 lg:border-l lg:pl-6 lg:w-72"
              >
                <input type="hidden" name="id" value={row.id} />
                <label htmlFor={`notes-${row.id}`} className="text-xs text-muted-foreground">
                  Nota (opcional)
                </label>
                <input
                  id={`notes-${row.id}`}
                  name="notes"
                  type="text"
                  placeholder="Nº de reembolso, contacto con el usuario…"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    name="status"
                    value="refunded"
                    size="sm"
                    className="flex-1"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Reembolsado
                  </Button>
                  <Button
                    type="submit"
                    name="status"
                    value="dismissed"
                    size="sm"
                    variant="outline"
                    className="flex-1"
                  >
                    <XCircle className="h-4 w-4 mr-2" /> Descartar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ))}

        {pending.length === 0 && (
          <div className="py-12 text-center bg-muted/20 border rounded-xl border-dashed">
            <CheckCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-medium mb-1">No hay pagos por reconciliar</h3>
            <p className="text-muted-foreground">Todo pago aprobado tiene su reserva.</p>
          </div>
        )}
      </div>

      {closed.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold tracking-tight pt-4">Resueltos</h2>
          {closed.map((row) => (
            <Card key={row.id} className="opacity-70">
              <CardContent className="p-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <Badge variant="secondary">
                  {row.status === 'refunded' ? 'Reembolsado' : 'Descartado'}
                </Badge>
                <span className="font-medium">{formatARS(row.amount)}</span>
                <span className="text-muted-foreground">{row.payer_email ?? '—'}</span>
                <code className="text-xs text-muted-foreground">{row.mp_payment_id}</code>
                {row.notes && <span className="text-muted-foreground italic">“{row.notes}”</span>}
                {row.resolved_at && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(row.resolved_at).toLocaleString('es-AR')}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
