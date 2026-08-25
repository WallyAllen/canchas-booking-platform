"use client"
import Link from 'next/link'

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser } from "@/hooks/useUser"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/toast"
import { Loader2 } from "lucide-react"

import { Suspense } from "react"
// ... (rest of imports)

function LoginForm() {
  const { user, isLoading, signInWithGoogle, signInWithFacebook } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [isFacebookLoading, setIsFacebookLoading] = useState(false)
  const nextUrl = searchParams.get("next") || "/"
  const errorParam = searchParams.get("error")

  useEffect(() => {
    if (errorParam) {
      toast.add({
        type: "error",
        title: "Error de autenticación",
        description: "No se pudo iniciar sesión. Por favor, intentá nuevamente.",
      })
    }
  }, [errorParam])

  useEffect(() => {
    if (!isLoading && user) {
      router.push(nextUrl)
    }
  }, [user, isLoading, router, nextUrl])

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true)
    try {
      await signInWithGoogle(nextUrl)
    } catch {
      toast.add({
        type: "error",
        title: "Error",
        description: "Ocurrió un error al intentar iniciar sesión con Google.",
      })
      setIsGoogleLoading(false)
    }
  }

  const handleFacebookLogin = async () => {
    setIsFacebookLoading(true)
    try {
      await signInWithFacebook(nextUrl)
    } catch {
      toast.add({
        type: "error",
        title: "Error",
        description: "Ocurrió un error al intentar iniciar sesión con Facebook.",
      })
      setIsFacebookLoading(false)
    }
  }

  if (isLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      
      <Card className="w-full max-w-md relative z-10 border-border bg-card/50 backdrop-blur-sm">
        <CardHeader className="space-y-4 text-center">
          <div className="flex justify-center">
            <span className="text-4xl">⚽</span>
          </div>
          <div>
            <CardTitle className="text-3xl font-bold tracking-tight">ReservaYa</CardTitle>
            <CardDescription className="mt-2 text-base">
              Iniciá sesión para reservar tu cancha
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            variant="outline" 
            className="w-full h-12 text-base font-normal flex items-center justify-center gap-3" 
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading || isFacebookLoading}
          >
            {isGoogleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            Continuar con Google
          </Button>

          <Button 
            variant="outline" 
            className="w-full h-12 text-base font-normal flex items-center justify-center gap-3 bg-[#1877F2] text-white hover:bg-[#1877F2]/90 hover:text-white border-transparent"
            onClick={handleFacebookLogin}
            disabled={isGoogleLoading || isFacebookLoading}
          >
            {isFacebookLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            )}
            Continuar con Facebook
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-border/50 pt-6">
          <p className="text-center text-xs text-muted-foreground px-6">
            Al continuar, aceptás los{" "}
            <Link href="/terminos" className="underline hover:text-foreground transition-colors">Términos y Condiciones</Link>
            {" "}y la{" "}
            <Link href="/terminos" className="underline hover:text-foreground transition-colors">Política de Privacidad</Link>
            .
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <LoginForm />
    </Suspense>
  )
}
