import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Política de Privacidad | El Potrero",
}

/**
 * Marcador de posición.
 *
 * El formulario de registro enlaza acá desde "Política de Privacidad", y hasta
 * ahora ese link apuntaba a /terminos (que tampoco existía). El texto legal tiene
 * que escribirlo el equipo: esta página existe para que el enlace no rompa, no
 * para hacerle creer a nadie que hay una política publicada.
 */
export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Política de Privacidad</h1>
      <p className="mt-4 text-muted-foreground">
        Estamos terminando de redactar este documento. Mientras tanto, si tenés dudas
        sobre qué datos guardamos y cómo los usamos, escribinos y te las respondemos.
      </p>
    </main>
  )
}
