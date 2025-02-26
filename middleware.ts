import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/app/utils/supabase/middleware';

export async function middleware(request: NextRequest) {
  // First, handle the session update
  const response = await updateSession(request);

  // Paths that should redirect to pricing if no subscription flow started
  const protectedAuthPaths = ['/signin', '/signup', '/auth/callback'];

  // Check if the current path is a protected auth path
  if (protectedAuthPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    // Get subscription flow status from URL params
    const hasStartedSubscription = request.nextUrl.searchParams.get('subscription_started') === 'true';

    // If no subscription flow started, redirect to pricing
    if (!hasStartedSubscription) {
      const redirectUrl = new URL('/pricing', request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
     * - /pricing (pricing page)
     */
    '/((?!_next/static|_next/image|favicon.ico|pricing|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ]
};

//import { type NextRequest } from 'next/server';
//import { updateSession } from '@/app/utils/supabase/middleware';

//export async function middleware(request: NextRequest) {
//  return await updateSession(request);
//}

//export const config = {
//  matcher: [
//    /*
//     * Match all request paths except:
//     * - _next/static (static files)
//     * - _next/image (image optimization files)
//     * - favicon.ico (favicon file)
//     * - images - .svg, .png, .jpg, .jpeg, .gif, .webp
//     * Feel free to modify this pattern to include more paths.
//     */
//    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
//  ]
//};
