'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { useAuthStore } from '@/store/auth'
import { ToastProvider } from '@/components/ui/Toast'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { accessToken } = useAuthStore()

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

  if (!accessToken) return null

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-slate-50/60">
        {children}
      </main>
      <ToastProvider />
    </div>
  )
}
