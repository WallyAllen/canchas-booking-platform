"use client"
import { createBrowserClient } from '@supabase/ssr'
import { useState } from 'react'

export default function UpgradePage() {
  const [msg, setMsg] = useState('')
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const makeAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return setMsg("Debes iniciar sesión primero")
    
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'platform_admin' })
      .eq('id', user.id)

    if (error) setMsg("Error: " + error.message)
    else setMsg("¡Listo! Eres platform_admin. Ve a /dashboard o /admin.")
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-4 text-center">
      <h1 className="text-2xl font-bold mb-4">Herramienta de Dev</h1>
      <button 
        onClick={makeAdmin}
        className="bg-primary text-primary-foreground px-6 py-3 rounded-lg font-bold hover:opacity-90"
      >
        Darme permisos de Administrador Global
      </button>
      <p className="mt-4 font-mono text-sm">{msg}</p>
    </div>
  )
}
