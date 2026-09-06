import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Términos y Condiciones | El Potrero",
}

/**
 * Marcador de posición.
 *
 * El formulario de registro dice "aceptás los Términos y Condiciones" y enlaza
 * acá; hasta ahora ese link daba 404. El texto legal tiene que escribirlo el
 * equipo (idealmente con asesoramiento): esta página existe para que el enlace
 * no rompa, no para hacerle creer a nadie que hay un contrato publicado.
 */
export default function TerminosPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Términos y Condiciones</h1>
      <p className="mt-4 text-muted-foreground">
        Estamos terminando de redactar este documento. Mientras tanto, si tenés dudas
        sobre cómo funcionan las reservas, las señas o las cancelaciones, escribinos y
        te las respondemos.
      </p>
    </main>
  )
}
