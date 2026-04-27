import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  console.log('Middleware hit:', pathname)
  const { response, user } = await updateSession(request)

  // public routes — no auth required
  const excluded = ['/auth', '/auth/callback', '/api/push/', '/share']
  if (excluded.some(path => pathname.startsWith(path))) return response

  // Unauthenticated → redirect to /auth
  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth'
    return NextResponse.redirect(url)
  }

  const role = user.user_metadata?.role as string | undefined

  // Role-based protection
  if (pathname.startsWith('/admin')) {
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  if (pathname.startsWith('/dashboard') || pathname.startsWith('/incoming') || pathname.startsWith('/history') || pathname.startsWith('/active') || pathname.startsWith('/ride-done')) {
    if (role !== 'puller' && role !== 'admin') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  if (pathname === '/' || pathname === '/ride-complete') {
    if (role === 'puller') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    if (role === 'admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url))
    }
  }


  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
