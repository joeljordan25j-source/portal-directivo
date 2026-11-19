'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { GraduationCap, LogOut } from 'lucide-react'

interface NavbarProps {
  titulo: string
  nombreUsuario: string
  rol: string
}

export default function Navbar({ titulo, nombreUsuario, rol }: NavbarProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 leading-tight">{titulo}</h1>
            <span className="text-xs font-medium uppercase tracking-wider text-blue-600">
              Panel {rol}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600 hidden sm:inline">
            Hola, <strong className="text-slate-900">{nombreUsuario}</strong>
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Salir</span>
          </button>
        </div>
      </div>
    </header>
  )
}
