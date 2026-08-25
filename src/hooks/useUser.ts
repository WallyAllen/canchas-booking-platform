"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'

type Profile = Database['public']['Tables']['profiles']['Row']

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    async function getUserAndProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          if (mounted) setUser(session.user)
          
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
            
          if (mounted && profileData) {
            setProfile(profileData)
          }
        } else {
          if (mounted) {
            setUser(null)
            setProfile(null)
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    getUserAndProfile()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        setIsLoading(true)
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          
        if (profileData) {
          setProfile(profileData)
        }
        setIsLoading(false)
      } else {
        setUser(null)
        setProfile(null)
        setIsLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])

  const signInWithGoogle = async (next = '/') => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/callback?next=${next}`,
      },
    })
  }

  const signInWithFacebook = async (next = '/') => {
    await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: `${window.location.origin}/callback?next=${next}`,
      },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return {
    user,
    profile,
    isLoading,
    signInWithGoogle,
    signInWithFacebook,
    signOut
  }
}
