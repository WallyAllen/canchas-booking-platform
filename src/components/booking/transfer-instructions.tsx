"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "@/components/ui/toast"
import { reportTransfer } from "@/app/actions/transfer"
import { formatBookingDate, formatTime } from "@/lib/utils/dates"
import { Copy, Check, MessageSquare, AlertCircle, Clock, Banknote } from "lucide-react"

interface PaymentDetails {
  alias: string | null
  cbu: string | null
  holder_name: string | null
  bank_name: string | null
}

interface TransferInstructionsProps {
  bookingId: string
  venueId: string
  venueName: string
  courtName: string
  bookingDate: string
  startTime: string
  depositAmount: number
  paymentStatus: string
  paymentDetails: PaymentDetails | null
}

function CopyableRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.add({ type: "error", title: "No se pudo copiar", description: "Copialo manualmente." })
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-mono font-medium break-all">{value}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={handleCopy} aria-label={`Copiar ${label}`}>
        {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  )
}

export function TransferInstructions({
  bookingId,
  venueId,
  venueName,
  courtName,
  bookingDate,
  startTime,
  depositAmount,
  paymentStatus,
  paymentDetails,
}: TransferInstructionsProps) {
  const router = useRouter()
  const [isReporting, setIsReporting] = useState(false)
  const alreadyReported = paymentStatus === 'awaiting_verification'

  const chatHref = `/venue/${venueId}?chat=1&booking=${bookingId}`

  const handleReport = async () => {
    setIsReporting(true)
    try {
      await reportTransfer(bookingId)
      toast.add({
        title: "Aviso enviado",
        description: "El complejo va a verificar tu comprobante y confirmar la reserva.",
      })
      router.push(chatHref)
    } catch (e: unknown) {
      toast.add({
        type: "error",
        title: "Error",
        description: e instanceof Error ? e.message : "No se pudo registrar el aviso.",
      })
      setIsReporting(false)
    }
  }

  const hasDestination = paymentDetails && (paymentDetails.alias || paymentDetails.cbu)

  return (
    <div className="container mx-auto max-w-2xl py-10 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pagá tu seña por transferencia</h1>
        <p className="text-muted-foreground mt-2">
          {courtName} en {venueName} — {formatBookingDate(bookingDate)} a las {formatTime(startTime.slice(0, 5))}
        </p>
      </div>

      {alreadyReported ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-6 flex items-start gap-3">
            <Clock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Esperando confirmación del complejo</p>
              <p className="text-sm text-muted-foreground mt-1">
                Ya avisaste que transferiste. En cuanto {venueName} verifique el comprobante,
                tu reserva queda confirmada. Podés seguir la conversación en el chat.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-6 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Tu turno está reservado por 3 horas</p>
              <p className="text-sm text-muted-foreground mt-1">
                Transferí la seña y mandá el comprobante por el chat dentro de ese plazo.
                Si no lo hacés, el turno se libera para otros jugadores.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Monto a transferir</span>
            <span className="text-2xl font-bold text-primary">
              ${depositAmount.toLocaleString('es-AR')}
            </span>
          </div>

          <div className="h-px bg-border/50" />

          {hasDestination ? (
            <div>
              <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Datos de {venueName}
              </h2>
              {paymentDetails.alias && <CopyableRow label="Alias" value={paymentDetails.alias} />}
              {paymentDetails.cbu && <CopyableRow label="CBU" value={paymentDetails.cbu} />}
              {paymentDetails.holder_name && (
                <CopyableRow label="Titular" value={paymentDetails.holder_name} />
              )}
              {paymentDetails.bank_name && (
                <div className="py-3">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Banco</p>
                  <p className="font-medium">{paymentDetails.bank_name}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 bg-muted/40 rounded-lg">
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Este complejo todavía no cargó sus datos bancarios</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Escribiles por el chat para coordinar el pago de la seña.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Button
          className="w-full h-12 text-base"
          render={<Link href={chatHref} />}
        >
          <MessageSquare className="h-5 w-5" />
          Ir al chat y enviar comprobante
        </Button>

        {!alreadyReported && (
          <Button
            variant="outline"
            className="w-full"
            onClick={handleReport}
            disabled={isReporting}
          >
            {isReporting ? "Registrando..." : "Ya transferí"}
          </Button>
        )}

        <p className="text-xs text-center text-muted-foreground">
          Podés ver el estado de esta reserva en{" "}
          <Link href="/bookings" className="underline hover:text-foreground">Mis reservas</Link>.
        </p>
      </div>
    </div>
  )
}
