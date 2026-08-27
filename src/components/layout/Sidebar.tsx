"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { 
  LayoutDashboard, 
  MapPin, 
  CalendarDays, 
  Calendar, 
  Star, 
  Settings,
  MessageCircle
} from "lucide-react"

const sidebarItems = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Mis Canchas", href: "/dashboard/courts", icon: MapPin },
  { name: "Reservas", href: "/dashboard/bookings", icon: CalendarDays },
  { name: "Calendario", href: "/dashboard/schedule", icon: Calendar },
  { name: "Mensajes", href: "/dashboard/inbox", icon: MessageCircle },
  { name: "Reseñas", href: "/dashboard/reviews", icon: Star },
  { name: "Perfil del Predio", href: "/dashboard/venue", icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-2 p-4 md:w-64 border-r min-h-[calc(100vh-4rem)] bg-muted/20">
      <div className="mb-4 px-2">
        <h2 className="text-lg font-semibold tracking-tight">Panel de Cancha</h2>
        <p className="text-sm text-muted-foreground">Gestión de complejo</p>
      </div>
      {sidebarItems.map((item) => {
        const Icon = item.icon
        // Para rutas hijas como /dashboard/courts/new
        const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
        
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-all hover:text-primary",
              isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="text-sm font-medium">{item.name}</span>
          </Link>
        )
      })}
    </nav>
  )
}
