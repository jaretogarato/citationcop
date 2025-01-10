// Navbar.tsx
'use client'

import { useAuth } from '@/app/contexts/auth-contexts'
import s from './Navbar.module.css'
import Navlinks from './Navlinks'

export default function Navbar() {
  // Removed async
  const { user, isLoading } = useAuth()

  return (
    <nav className={s.root}>
      <a href="#skip" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <div className="max-w-6xl px-6 mx-auto">
        {isLoading ? (
          <div className="h-16 animate-pulse bg-gray-100 rounded" />
        ) : (
          <Navlinks user={user} />
        )}
      </div>
    </nav>
  )
}
