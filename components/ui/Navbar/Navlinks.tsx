'use client';

import Link from 'next/link';
import { SignOut } from '@/utils/auth-helpers/server';
import { handleRequest } from '@/utils/auth-helpers/client';
import { usePathname, useRouter } from 'next/navigation';
import { getRedirectMethod } from '@/utils/auth-helpers/settings';
import Image from 'next/image';
import s from './Navbar.module.css';

interface NavlinksProps {
  user?: any;
}

export default function Navlinks({ user }: NavlinksProps) {
  const router = getRedirectMethod() === 'client' ? useRouter() : null;

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
      <div className="flex justify-end space-x-4">
        {user ? (
          <form onSubmit={(e) => handleRequest(e, SignOut, router)}>
            <input type="hidden" name="pathName" value={usePathname()} />
            <button type="submit" className={s.link}>
              Sign out
            </button>
          </form>
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
  );
}

//'use client';

//import Link from 'next/link';
//import { SignOut } from '@/utils/auth-helpers/server';
//import { handleRequest } from '@/utils/auth-helpers/client';
//import { usePathname, useRouter } from 'next/navigation';
//import { getRedirectMethod } from '@/utils/auth-helpers/settings';
//import Image from 'next/image';
//import s from './Navbar.module.css';

//interface NavlinksProps {
//  user?: any;
//}

//export default function Navlinks({ user }: NavlinksProps) {
//  const router = getRedirectMethod() === 'client' ? useRouter() : null;

//  return (
//    <div className="relative flex flex-row justify-between py-4 align-center md:py-6">
//      <div className="flex items-center flex-1">
//        <Link href="/" className={s.logo} aria-label="Logo">
//          {/* Import and scale the new logo */}
//          <Image
//            src="/source-verify-logo-d.png"
//            alt="SourceVerify Logo"
//            width={70} // Adjust the width
//            height={70} // Adjust the height to keep aspect ratio
//            priority // Optimizes loading for the logo
//          />
//        </Link>
//        {/*<nav className="ml-6 space-x-2 lg:block">
//          <Link href="/" className={s.link}>
//            Pricing
//          </Link>
//          {user && (
//            <Link href="/account" className={s.link}>
//              Account
//            </Link>
//          )}
//        </nav>*/}
//      </div>
//      <div className="flex justify-end space-x-8">
//        {user ? (
//          <form onSubmit={(e) => handleRequest(e, SignOut, router)}>
//            <input type="hidden" name="pathName" value={usePathname()} />
//            <button type="submit" className={s.link}>
//              Sign out
//            </button>
//          </form>
//        ) : (
//          <Link href="/signin" className={s.link}>
//            Sign In
//          </Link>
//        )}
//      </div>
//    </div>
//  );
//}

//'use client';

//import Link from 'next/link';
//import { SignOut } from '@/utils/auth-helpers/server';
//import { handleRequest } from '@/utils/auth-helpers/client';
//import Logo from '@/components/icons/Logo';
//import { usePathname, useRouter } from 'next/navigation';
//import { getRedirectMethod } from '@/utils/auth-helpers/settings';
//import s from './Navbar.module.css';

//interface NavlinksProps {
//  user?: any;
//}

//export default function Navlinks({ user }: NavlinksProps) {
//  const router = getRedirectMethod() === 'client' ? useRouter() : null;

//  return (
//    <div className="relative flex flex-row justify-between py-4 align-center md:py-6">
//      <div className="flex items-center flex-1">
//        <Link href="/" className={s.logo} aria-label="Logo">
//          <Logo />
//        </Link>
//        <nav className="ml-6 space-x-2 lg:block">
//          <Link href="/" className={s.link}>
//            Pricing
//          </Link>
//          {user && (
//            <Link href="/account" className={s.link}>
//              Account
//            </Link>
//          )}
//        </nav>
//      </div>
//      <div className="flex justify-end space-x-8">
//        {user ? (
//          <form onSubmit={(e) => handleRequest(e, SignOut, router)}>
//            <input type="hidden" name="pathName" value={usePathname()} />
//            <button type="submit" className={s.link}>
//              Sign out
//            </button>
//          </form>
//        ) : (
//          <Link href="/signin" className={s.link}>
//            Sign In
//          </Link>
//        )}
//      </div>
//    </div>
//  );
//}
