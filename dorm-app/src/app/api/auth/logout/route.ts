import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true });
  
  res.cookies.set('auth_token', '', {
    expires: new Date(0), // Expire immediately
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return res;
}
