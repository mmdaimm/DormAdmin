import { NextRequest, NextResponse } from 'next/server';
import { getUserByUsername } from '@/services/sheetService';
import { encrypt } from '@/lib/auth';
import { compare } from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'กรุณากรอก Username และ Password' }, { status: 400 });
    }

    const user = await getUserByUsername(username);

    if (!user) {
      return NextResponse.json({ error: 'ไม่พบผู้ใช้งานนี้ในระบบ' }, { status: 401 });
    }

    const isValidPassword = await compare(password, user.passwordHash);

    if (!isValidPassword) {
      return NextResponse.json({ error: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    // Set expiration to 7 days
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const sessionToken = await encrypt({ username: user.username, role: user.role });

    const res = NextResponse.json({ success: true, role: user.role });
    
    res.cookies.set('auth_token', sessionToken, {
      expires,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return res;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ' }, { status: 500 });
  }
}
