"use client"

import { useRef } from "react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { ScrollTrigger } from "gsap/dist/ScrollTrigger"

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, useGSAP)
}

interface StaggerGridProps {
  children: React.ReactNode
  className?: string
}

export function StaggerGrid({ children, className }: StaggerGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!containerRef.current) return
    const elements = containerRef.current.children
    
    // Configurar estado inicial manualmente para evitar parpadeos
    gsap.set(elements, { autoAlpha: 0, y: 50 })
    
    gsap.to(elements, { 
      y: 0, 
      autoAlpha: 1, 
      duration: 0.8, 
      ease: "power3.out", 
      stagger: 0.15,
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top 85%",
      }
    })
  }, { scope: containerRef })

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  )
}
