'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode
} from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@supabase/supabase-js'
import {
  getUser,
  getUserDetails,
  getSubscription
} from '@/app/utils/supabase/queries'

// Define types for your data
interface UserDetails {
  id: string
  // ... add other user detail fields
}

interface Subscription {
  id: string
  status: string
  // ... add other subscription fields
}

interface AuthContextData {
  user: User | null
  userDetails: UserDetails | null
  subscription: Subscription | null
  isLoading: boolean
  refreshAuth: () => Promise<void>
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const AuthContext = createContext<AuthContextData | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadAuthData = async () => {
    try {
      setIsLoading(true)
      const { user: currentUser } = await getUser(supabase)

      if (currentUser) {
        const [details, subs] = await Promise.all([
          getUserDetails(supabase),
          getSubscription(supabase)
        ])

        setUser(currentUser)
        setUserDetails(details.data as UserDetails | null)
        setSubscription(subs)
      } else {
        setUser(null)
        setUserDetails(null)
        setSubscription(null)
      }
    } catch (error) {
      console.error('Error loading auth data:', error)
      setUser(null)
      setUserDetails(null)
      setSubscription(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAuthData()

    const {
      data: { subscription: authListener }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user)
        await loadAuthData()
      } else {
        setUser(null)
        setUserDetails(null)
        setSubscription(null)
      }
    })

    return () => {
      authListener.unsubscribe()
    }
  }, [])

  const value = {
    user,
    userDetails,
    subscription,
    isLoading,
    refreshAuth: loadAuthData
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
