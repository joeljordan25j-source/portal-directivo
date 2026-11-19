'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { GraduationCap, Lock, Mail, AlertCircle, Loader2, ShieldCheck } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError('Credenciales incorrectas. Verifique su correo y contraseña.')
        setLoading(false)
        return
      }

      if (authData.user) {
        const { data: perfil, error: perfilError } = await supabase
          .from('perfiles')
          .select('rol')
          .eq('id', authData.user.id)
          .single()

        if (perfilError || !perfil) {
          setError('Su usuario no cuenta con un rol asignado en el sistema.')
          await supabase.auth.signOut()
          setLoading(false)
          return
        }

        if (perfil.rol !== 'admin') {
          await supabase.auth.signOut()
          setError('Acceso restringido: esta aplicación es exclusiva para la Dirección.')
          setLoading(false)
          return
        }

        router.push('/admin')
        router.refresh()
        return
      }
    } catch {
      setError('Ocurrió un error inesperado al procesar la autenticación.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f0c1b] via-[#15102a] to-[#0a1128] text-slate-100 p-4 relative overflow-hidden">
      <div className="pointer-events-none fixed -top-40 left-1/3 w-[500px] h-[500px] rounded-full bg-violet-600/20 blur-[140px]" />
      <div className="pointer-events-none fixed bottom-0 right-1/4 w-[440px] h-[440px] rounded-full bg-fuchsia-600/15 blur-[140px]" />

      <div className="relative z-10 w-full max-w-md rounded-3xl bg-[#130f28]/95 backdrop-blur-xl border border-violet-500/30 shadow-[0_25px_70px_rgba(0,0,0,0.75)] overflow-hidden">
        <div className="p-8 text-center bg-gradient-to-b from-violet-900/40 via-indigo-950/20 to-transparent border-b border-violet-500/20">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 border border-violet-400/40 flex items-center justify-center mb-4 shadow-lg shadow-violet-950/80">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-violet-500/20 border border-violet-400/40 text-violet-200 mb-2">
            <ShieldCheck className="w-4 h-4" />
            Acceso Institucional Autorizado
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">Portal Directivo</h1>
          <p className="text-violet-200/70 text-sm mt-1">
            Gestión de matrículas, cursos, asignaturas y personal
          </p>
        </div>

        <form onSubmit={handleLogin} className="p-8 space-y-5">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 text-sm text-rose-200 bg-rose-950/90 border border-rose-500/40 rounded-2xl shadow-lg">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-violet-300/80 mb-1.5">
              Correo Institucional
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-violet-400/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="direccion@colegio.edu.ec"
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-violet-950/40 border border-violet-500/30 text-slate-100 placeholder:text-violet-300/30 text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 transition shadow-inner"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-violet-300/80 mb-1.5">
              Contraseña de Acceso
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-violet-400/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-violet-950/40 border border-violet-500/30 text-slate-100 placeholder:text-violet-300/30 text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 transition shadow-inner"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 hover:brightness-110 active:scale-[0.99] disabled:opacity-50 text-white font-extrabold text-sm shadow-xl shadow-violet-950/70 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Verificando credenciales...</span>
              </>
            ) : (
              'Iniciar Sesión'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}