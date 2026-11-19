import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import Navbar from '@/components/Navbar'
import { BookOpen, Award } from 'lucide-react'

export default async function EstudianteDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombres, apellidos, rol')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol !== 'estudiante') redirect('/')

  const { data: matricula } = await supabase
    .from('matriculas')
    .select('id, curso_id, cursos(nombre, paralelo)')
    .eq('estudiante_id', user.id)
    .single()

  let materiasConNotas: any[] = []

  if (matricula) {
    const { data: materias } = await supabase
      .from('materias')
      .select('id, nombre')
      .eq('curso_id', matricula.curso_id)

    const { data: calificaciones } = await supabase
      .from('calificaciones')
      .select('*')
      .eq('matricula_id', matricula.id)
      .eq('quimestre', 1)

    materiasConNotas = (materias || []).map((mat) => {
      const nota = calificaciones?.find((c) => c.materia_id === mat.id)
      return {
        ...mat,
        insumo_1: nota?.insumo_1 ?? '-',
        insumo_2: nota?.insumo_2 ?? '-',
        examen_quimestral: nota?.examen_quimestral ?? '-',
        promedio_quimestral: nota?.promedio_quimestral ?? '-',
      }
    })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar
        titulo="Portal Estudiantil"
        nombreUsuario={`${perfil.nombres} ${perfil.apellidos}`}
        rol="Estudiante"
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Mis Calificaciones</h2>
            <p className="text-slate-600">
              {matricula
                ? `Curso: ${(matricula.cursos as any)?.nombre} "${(matricula.cursos as any)?.paralelo}" — Quimestre 1`
                : 'Aún no estás matriculado en un curso activo.'}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium">
            <Award className="w-4 h-4" />
            <span>Escala sobre 10.00</span>
          </div>
        </div>

        {!matricula ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-semibold text-slate-900">Sin matrícula registrada</h3>
            <p className="text-sm text-slate-500 mt-1">Acércate a secretaría para que asignen tu grado y paralelo.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-xs uppercase text-slate-600 font-semibold">
                    <th className="py-4 px-6">Materia</th>
                    <th className="py-4 px-4 text-center">Insumo 1</th>
                    <th className="py-4 px-4 text-center">Insumo 2</th>
                    <th className="py-4 px-4 text-center">Examen Quimestral</th>
                    <th className="py-4 px-6 text-center bg-blue-50/60 text-blue-900">Promedio Quimestral</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-sm">
                  {materiasConNotas.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="py-4 px-6 font-medium text-slate-900">{item.nombre}</td>
                      <td className="py-4 px-4 text-center text-slate-700">{item.insumo_1}</td>
                      <td className="py-4 px-4 text-center text-slate-700">{item.insumo_2}</td>
                      <td className="py-4 px-4 text-center text-slate-700">{item.examen_quimestral}</td>
                      <td className="py-4 px-6 text-center font-bold text-blue-700 bg-blue-50/30">
                        {item.promedio_quimestral}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
