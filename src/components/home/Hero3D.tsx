/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import Script from "next/script"

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'spline-viewer': any;
    }
  }
}

export default function Hero3D() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className="absolute inset-0 z-0 w-full h-full overflow-hidden opacity-60 mix-blend-lighten pointer-events-none">
      <Script 
        type="module" 
        src="https://unpkg.com/@splinetool/viewer@1.9.72/build/spline-viewer.js" 
        strategy="lazyOnload"
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
        </div>
      )}
      <div className="w-[120%] h-[120%] -ml-[10%] -mt-[5%]">
        <spline-viewer url="https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode" />
      </div>
    </div>
  )
}
