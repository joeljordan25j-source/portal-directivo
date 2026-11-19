import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import AdminPanelClient from './AdminPanelClient'

export default async function AdminDashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('nombres, apellidos, rol')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol !== 'admin') redirect('/')

  const [
    { data: periodos },
    { data: cursos },
    { data: profesores },
    { data: estudiantes },
    { data: materias },
    { data: matriculas },
    { data: bitacora },
  ] = await Promise.all([
    supabase.from('periodos_lectivos').select('*').order('nombre', { ascending: false }),
    supabase.from('cursos').select('*, periodos_lectivos(nombre)').order('nombre'),
    supabase.from('perfiles').select('*').eq('rol', 'profesor').order('apellidos'),
    supabase.from('perfiles').select('*').eq('rol', 'estudiante').order('apellidos'),
    supabase.from('materias').select('*, cursos(nombre, paralelo), perfiles(nombres, apellidos)').order('nombre'),
    supabase.from('matriculas').select('*, cursos(nombre, paralelo), perfiles(nombres, apellidos, cedula)'),
    supabase.from('bitacora_auditoria').select('*').order('creado_en', { ascending: false }).limit(50),
  ])

  return (
    <AdminPanelClient
      adminNombre={`${perfil.nombres} ${perfil.apellidos}`}
      adminEmail={user.email || 'direccion@colegio.edu.ec'}
      periodos={periodos || []}
      cursos={cursos || []}
      profesores={profesores || []}
      estudiantes={estudiantes || []}
      materias={materias || []}
      matriculas={matriculas || []}
      bitacora={bitacora || []}
    />
  )
}