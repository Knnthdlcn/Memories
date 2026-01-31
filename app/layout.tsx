import './globals.css'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Happy Moments',
  description: 'A curated photo story.'
}

export default function RootLayout({ children }: { children: React.ReactNode }){
  return (
    <html lang="en">
      <body>
        <main className="min-h-screen">
          {children}
        </main>
      </body>
    </html>
  )
}
