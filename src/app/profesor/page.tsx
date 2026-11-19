import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import Navbar from '@/components/Navbar'
import { BookOpen, ClipboardCheck } from 'lucide-react'

export default async function ProfesorDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombres, apellidos, rol')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol !== 'profesor') redirect('/')

  const { data: materias } = await supabase
    .from('materias')
    .select('id, nombre, cursos(nombre, paralelo)')
    .eq('profesor_id', user.id)

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        titulo="Portal Docente"
        nombreUsuario={`${perfil.nombres} ${perfil.apellidos}`}
        rol="Profesor"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Mis Materias Asignadas</h2>
          <p className="text-slate-600">Selecciona una materia para ingresar Insumo 1, Insumo 2 y Examen Quimestral.</p>
        </div>

        {!materias || materias.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-900">Aún no tienes materias asignadas</h3>
            <p className="text-sm text-slate-500 mt-1">El administrador del colegio debe asignarte tus cursos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {materias.map((mat: any) => (
              <div key={mat.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-blue-300 transition">
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full">
                    {mat.cursos?.nombre} - &quot;{mat.cursos?.paralelo}&quot;
                  </span>
                  <ClipboardCheck className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{mat.nombre}</h3>
                <p className="text-sm text-slate-500 mt-1">Registro de notas quimestrales</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
