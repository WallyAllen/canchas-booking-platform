"use client"

import { usePathname } from "next/navigation"
import { Footer } from "./Footer"

export function ConditionalFooter() {
  const pathname = usePathname()
  
  // No mostrar el footer en la página de búsqueda (pantalla completa)
  if (pathname === "/search") {
    return null
  }
  
  return <Footer />
}
