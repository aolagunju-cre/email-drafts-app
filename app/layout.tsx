import Link from 'next/link'
import './globals.css'

export const metadata = {
  title: 'Email Drafts',
  description: 'Daily cold email drafts for Abdul',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
