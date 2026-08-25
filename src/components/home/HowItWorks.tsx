import { Search, CalendarCheck, Trophy } from "lucide-react"

export function HowItWorks() {
  const steps = [
    {
      icon: Search,
      title: "1. Buscá tu cancha",
      description: "Encontrá complejos por zona, fecha, o filtrá por el tipo de superficie que prefieras."
    },
    {
      icon: CalendarCheck,
      title: "2. Elegí horario y pagá",
      description: "Seleccioná tu turno y aseguralo al instante abonando la seña con Mercado Pago."
    },
    {
      icon: Trophy,
      title: "3. ¡A jugar!",
      description: "Juntá a tu equipo, andá al complejo a la hora acordada y disfrutá del partido."
    }
  ]

  return (
    <section className="py-20 bg-muted/30">
      <div className="container px-4 md:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">¿Cómo funciona?</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Reservar tu cancha nunca fue tan fácil y rápido.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <div key={index} className="flex flex-col items-center text-center space-y-4">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-bold">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
