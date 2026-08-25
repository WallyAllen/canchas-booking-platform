import Link from "next/link"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="w-full border-t bg-background">
      <div className="container px-4 md:px-8 py-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="flex flex-col space-y-4">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-xl">⚽</span>
              <span className="inline-block font-bold text-primary">ReservaYa</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              La plataforma líder para reservar canchas de fútbol 5 en La Plata. Encontrá tu horario, reservá y jugá.
            </p>
          </div>
          <div className="flex flex-col space-y-4">
            <h3 className="font-semibold text-foreground">Links Útiles</h3>
            <nav className="flex flex-col space-y-2 text-sm text-muted-foreground">
              <Link href="/search" className="hover:text-primary transition-colors">Buscar Canchas</Link>
              <Link href="/faq" className="hover:text-primary transition-colors">Preguntas Frecuentes</Link>
              <Link href="/contacto" className="hover:text-primary transition-colors">Contacto</Link>
            </nav>
          </div>
          <div className="flex flex-col space-y-4">
            <h3 className="font-semibold text-foreground">Suma tu Complejo</h3>
            <p className="text-sm text-muted-foreground">
              Gestioná tus reservas, pagos y clientes desde un solo lugar.
            </p>
            <Link href="/unite" className="text-sm font-medium text-primary hover:underline">
              ¿Tenés una cancha? Sumala gratis &rarr;
            </Link>
          </div>
        </div>
        <div className="mt-10 flex flex-col md:flex-row items-center justify-between border-t pt-6 text-xs text-muted-foreground">
          <p>© {currentYear} ReservaYa. Todos los derechos reservados.</p>
          <div className="flex space-x-4 mt-4 md:mt-0">
            <Link href="#" className="hover:text-foreground transition-colors">Términos y Condiciones</Link>
            <Link href="#" className="hover:text-foreground transition-colors">Privacidad</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
