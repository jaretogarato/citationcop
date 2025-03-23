'use client'

import Link from 'next/link'
import { SignOut } from '@/app/utils/auth-helpers/server'
import { handleRequest } from '@/app/utils/auth-helpers/client'
import { usePathname, useRouter } from 'next/navigation'
import { getRedirectMethod } from '@/app/utils/auth-helpers/settings'
import Image from 'next/image'
import s from './Navbar.module.css'
import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function Navlinks() {
  const router = getRedirectMethod() === 'client' ? useRouter() : null
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClientComponentClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      console.log('Current session:', data.session)
    })
  }, [])

  useEffect(() => {
    // Check auth status on mount and auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user || null)
        setLoading(false)
      }
    )

    // Initial auth check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      setLoading(false)
    })

    return () => {
      // Clean up subscription when component unmounts
      authListener?.subscription.unsubscribe()
    }
  }, [supabase.auth])

  // Show a simplified nav while loading auth state
  if (loading) {
    return (
      <div className="relative flex flex-row justify-between py-4 align-center md:py-6">
        <div className="flex items-center flex-1">
          <Link href="/" className={s.logo} aria-label="Logo">
            <Image
              src="/source-verify-logo-d.png"
              alt="SourceVerify Logo"
              width={70}
              height={70}
              priority
            />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex flex-row justify-between py-4 align-center md:py-6">
      <div className="flex items-center flex-1">
        <Link href="/" className={s.logo} aria-label="Logo">
          <Image
            src="/source-verify-logo-d.png"
            alt="SourceVerify Logo"
            width={70}
            height={70}
            priority
          />
        </Link>
      </div>
      <div className="flex justify-end space-x-4 items-center">
        {user ? (
          <>
            <Link href="/dashboard" className={s.link}>
              Dashboard
            </Link>
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100">
                <span className="text-sm font-medium truncate max-w-[100px]">
                  {user.email.split('@')[0]}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              <div className="absolute right-0 z-10 w-48 py-1 mt-2 origin-top-right bg-white rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 invisible group-hover:visible">
                <Link
                  href="/account"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  Account Settings
                </Link>
                <form onSubmit={(e) => handleRequest(e, SignOut, router)}>
                  <input type="hidden" name="pathName" value={pathname} />
                  <button
                    type="submit"
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          </>
        ) : (
          <>
            <Link href="/signin" className={s.link}>
              Sign In
            </Link>
            <Link href="/pricing">
              <button className="relative px-8 py-3 text-lg font-semibold rounded-xl shadow-lg shadow-blue-500/20 transform transition-all duration-200 group bg-gradient-to-b from-sky-600 to-indigo-600 hover:from-blue-500 hover:to-teal-500 text-white">
                <span className="flex items-center gap-2">
                  Sign Up
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                    className="w-5 h-5 transition-transform group-hover:translate-x-1"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5l6 6m0 0l-6 6m6-6H3"
                    />
                  </svg>
                </span>
              </button>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

//'use client'

//import Link from 'next/link'
//import { SignOut } from '@/app/utils/auth-helpers/server'
//import { handleRequest } from '@/app/utils/auth-helpers/client'
//import { usePathname, useRouter } from 'next/navigation'
//import { getRedirectMethod } from '@/app/utils/auth-helpers/settings'
//import Image from 'next/image'
//import s from './Navbar.module.css'

//interface NavlinksProps {
//  user?: any
//}

//export default function Navlinks({ user }: NavlinksProps) {
//  const router = getRedirectMethod() === 'client' ? useRouter() : null

//  return (
//    <div className="relative flex flex-row justify-between py-4 align-center md:py-6">
//      <div className="flex items-center flex-1">
//        <Link href="/" className={s.logo} aria-label="Logo">
//          <Image
//            src="/source-verify-logo-d.png"
//            alt="SourceVerify Logo"
//            width={70}
//            height={70}
//            priority
//          />
//        </Link>
//      </div>
//      <div className="flex justify-end space-x-4">
//        {user ? (
//          <form onSubmit={(e) => handleRequest(e, SignOut, router)}>
//            <input type="hidden" name="pathName" value={usePathname()} />
//            <button type="submit" className={s.link}>
//              Sign out
//            </button>
//          </form>
//        ) : (
//          <>
//            <Link href="/signin" className={s.link}>
//              Sign In
//            </Link>
//            <Link href="/pricing">
//              <button className="relative px-8 py-3 text-lg font-semibold rounded-xl shadow-lg shadow-blue-500/20 transform transition-all duration-200 group bg-gradient-to-b from-sky-600 to-indigo-600 hover:from-blue-500 hover:to-teal-500 text-white">
//                <span className="flex items-center gap-2">
//                  Sign Up
//                  <svg
//                    xmlns="http://www.w3.org/2000/svg"
//                    fill="none"
//                    viewBox="0 0 24 24"
//                    strokeWidth="2"
//                    stroke="currentColor"
//                    className="w-5 h-5 transition-transform group-hover:translate-x-1"
//                  >
//                    <path
//                      strokeLinecap="round"
//                      strokeLinejoin="round"
//                      d="M13.5 4.5l6 6m0 0l-6 6m6-6H3"
//                    />
//                  </svg>
//                </span>
//              </button>
//            </Link>
//          </>
//        )}
//      </div>
//    </div>
//  )
//}
