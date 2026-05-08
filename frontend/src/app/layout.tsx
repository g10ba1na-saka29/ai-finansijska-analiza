import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AI Finansijska Analiza',
  description: 'Platforma za AI-powered finansijsku analizu kompanija',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bs">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  )
}
