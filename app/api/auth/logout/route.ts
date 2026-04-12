import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.redirect(new URL('/login', 'https://example.com'))
  response.cookies.set('auth', '', { maxAge: 0, path: '/' })
  return response
}
