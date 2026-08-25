"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, User as UserIcon } from "lucide-react"

import { useUser } from "@/hooks/useUser"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function Header() {
  const pathname = usePathname()
  const { user, profile, isLoading, signOut } = useUser()
  const [isOpen, setIsOpen] = React.useState(false)

  const navItems = [
    { name: "Inicio", href: "/" },
    { name: "Buscar Canchas", href: "/search" },
  ]

  if (user) {
    navItems.push({ name: "Mis Reservas", href: "/bookings" })
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-8">
        <div className="flex gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl">⚽</span>
            <span className="inline-block font-bold text-primary">ReservaYa</span>
          </Link>
          <nav className="hidden gap-6 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center text-sm font-medium transition-colors hover:text-foreground/80",
                  pathname === item.href ? "text-foreground" : "text-foreground/60"
                )}
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url || ""} alt={profile?.full_name || "User"} />
                    <AvatarFallback><UserIcon className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                </Button>
              } />
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profile?.full_name || user.email}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/profile" />}>
                  Mi Perfil
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/bookings" />}>
                  Mis Reservas
                </DropdownMenuItem>
                {profile?.role === 'venue_admin' && (
                  <DropdownMenuItem render={<Link href="/dashboard" />}>
                    Panel de Cancha
                  </DropdownMenuItem>
                )}
                {profile?.role === 'platform_admin' && (
                  <DropdownMenuItem render={<Link href="/admin" />}>
                    Panel Admin
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-destructive focus:bg-destructive focus:text-destructive-foreground">
                  Cerrar Sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden md:flex gap-2">
              <Button variant="ghost" render={<Link href="/login" />}>
                Iniciar Sesión
              </Button>
              <Button render={<Link href="/register" />}>
                Registrarse
              </Button>
            </div>
          )}

          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger render={
              <Button
                variant="ghost"
                className="px-0 text-base hover:bg-transparent focus-visible:bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 md:hidden"
              >
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            } />
            <SheetContent side="right" className="pr-0">
              <SheetTitle className="text-left mb-4">Menú</SheetTitle>
              <div className="flex flex-col space-y-3">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "text-foreground/70 transition-colors hover:text-foreground",
                      pathname === item.href && "text-foreground font-semibold"
                    )}
                  >
                    {item.name}
                  </Link>
                ))}
                {!user && (
                  <>
                    <div className="my-4 h-px bg-muted" />
                    <Link href="/login" onClick={() => setIsOpen(false)} className="text-foreground/70 hover:text-foreground">
                      Iniciar Sesión
                    </Link>
                    <Link href="/register" onClick={() => setIsOpen(false)} className="text-foreground/70 hover:text-foreground">
                      Registrarse
                    </Link>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
