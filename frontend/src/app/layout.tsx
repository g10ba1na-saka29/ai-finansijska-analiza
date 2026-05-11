import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Bilansia',
  description: 'AI platforma za finansijsku analizu kompanija — KPI, risk scoring, AI izvještaji',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bs">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  )
}
