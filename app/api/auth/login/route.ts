import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const password = formData.get('password')

  if (password === process.env.AUTH_PASSWORD) {
    const response = NextResponse.redirect(new URL('/dashboard', request.url))
    response.cookies.set('auth', 'ok', {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    })
    return response
  }

  return NextResponse.redirect(new URL('/login?error=1', request.url))
}
