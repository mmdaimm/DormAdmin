import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt } from '@/lib/auth';

const publicRoutes = ['/login'];
const adminRestrictedRoutes = ['/settings', '/tenants', '/accounting'];
const adminRestrictedApiRoutes = ['/api/settings', '/api/tenants'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow static files, images, etc.
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next();
  }

  const isPublicRoute = publicRoutes.includes(pathname);
  
  const token = request.cookies.get('auth_token')?.value;
  const session = await decrypt(token);

  // 1. Not logged in
  if (!session) {
    if (!isPublicRoute) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // 2. Logged in, but trying to access login page
  if (isPublicRoute && session) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 3. RBAC checks for Admin
  if (session.role === 'admin') {
    const isRestrictedPage = adminRestrictedRoutes.some(route => pathname.startsWith(route));
    const isRestrictedApi = adminRestrictedApiRoutes.some(route => pathname.startsWith(route));

    if (isRestrictedPage) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    if (isRestrictedApi && request.method !== 'GET') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
