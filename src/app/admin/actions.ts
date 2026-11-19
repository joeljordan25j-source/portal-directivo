'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

async function verificarAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('No autenticado')

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('rol')
    .eq('id', user.id)
    .single()

  if (!perfil || perfil.rol !== 'admin') {
    throw new Error('No autorizado: se requiere rol de administrador')
  }

  return supabase
}

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

async function registrarBitacora(accion: string, detalle: string) {
  const supabaseAdmin = getAdminClient()
  await supabaseAdmin.from('bitacora_auditoria').insert({
    accion,
    detalle,
  })
}

export async function crearPeriodo(formData: FormData) {
  try {
    const supabase = await verificarAdmin()
    const nombre = (formData.get('nombre') as string)?.trim()
    const activo = formData.get('activo') === 'on'

    if (!nombre) return { error: 'El nombre del periodo es obligatorio.' }

    if (activo) {
      await supabase.from('periodos_lectivos').update({ activo: false }).neq('id', '')
    }

    const { error } = await supabase.from('periodos_lectivos').insert({ nombre, activo })
    if (error) return { error: 'Error al crear periodo: ' + error.message }

    await registrarBitacora('Periodo Lectivo', `Se registró el periodo "${nombre}".`)
    revalidatePath('/admin')
    return { success: `Periodo "${nombre}" creado correctamente.` }
  } catch (err: any) {
    return { error: err.message || 'Error inesperado al crear periodo.' }
  }
}

export async function crearCurso(formData: FormData) {
  try {
    const supabase = await verificarAdmin()
    const periodo_id = formData.get('periodo_id') as string
    const nombre = (formData.get('nombre') as string)?.trim()
    const paralelo = (formData.get('paralelo') as string)?.trim().toUpperCase()
    const cupo_maximo = Number(formData.get('cupo_maximo') || 35)

    if (!periodo_id || !nombre || !paralelo || Number.isNaN(cupo_maximo) || cupo_maximo < 1) {
      return { error: 'Complete todos los campos del curso y un cupo válido.' }
    }

    const { error } = await supabase.from('cursos').insert({
      periodo_id,
      nombre,
      paralelo,
      cupo_maximo,
    })

    if (error) return { error: 'Error al crear curso: ' + error.message }

    await registrarBitacora(
      'Creación de Curso',
      `Se habilitó ${nombre} "${paralelo}" con cupo de ${cupo_maximo} estudiantes.`
    )
    revalidatePath('/admin')
    return { success: `Curso ${nombre} "${paralelo}" creado correctamente.` }
  } catch (err: any) {
    return { error: err.message || 'Error inesperado al crear curso.' }
  }
}

export async function crearUsuario(formData: FormData) {
  try {
    await verificarAdmin()
    const supabaseAdmin = getAdminClient()

    const rol = formData.get('rol') as 'profesor' | 'estudiante'
    const cedula = (formData.get('cedula') as string)?.trim()
    const nombres = (formData.get('nombres') as string)?.trim()
    const apellidos = (formData.get('apellidos') as string)?.trim()
    const email = (formData.get('email') as string)?.trim().toLowerCase()
    const password = formData.get('password') as string
    const representante_nombre = ((formData.get('representante_nombre') as string) || '').trim() || null
    const representante_cedula = ((formData.get('representante_cedula') as string) || '').trim() || null
    const representante_telefono = ((formData.get('representante_telefono') as string) || '').trim() || null
    const parentesco = ((formData.get('parentesco') as string) || '').trim() || null

    if (!rol || !cedula || !nombres || !apellidos || !email || !password) {
      return { error: 'Todos los campos principales son obligatorios.' }
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError || !authData.user) {
      return { error: 'Error al crear cuenta: ' + (authError?.message || 'Error desconocido') }
    }

    const { error: perfilError } = await supabaseAdmin.from('perfiles').insert({
      id: authData.user.id,
      cedula,
      nombres,
      apellidos,
      rol,
      representante_nombre,
      representante_cedula,
      representante_telefono,
      parentesco,
    })

    if (perfilError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return { error: 'Error al guardar perfil: ' + perfilError.message }
    }

    await registrarBitacora(
      'Registro de Usuario',
      `Se registró a ${apellidos} ${nombres} (${rol}) con CI ${cedula}.`
    )
    revalidatePath('/admin')
    return { success: `Usuario ${apellidos} ${nombres} (${rol}) registrado con éxito.` }
  } catch (err: any) {
    return { error: err.message || 'Error inesperado al crear usuario.' }
  }
}

export async function actualizarUsuario(formData: FormData) {
  try {
    await verificarAdmin()
    const supabaseAdmin = getAdminClient()

    const id = formData.get('id') as string
    const cedula = (formData.get('cedula') as string)?.trim()
    const nombres = (formData.get('nombres') as string)?.trim()
    const apellidos = (formData.get('apellidos') as string)?.trim()
    const representante_nombre = ((formData.get('representante_nombre') as string) || '').trim() || null
    const representante_cedula = ((formData.get('representante_cedula') as string) || '').trim() || null
    const representante_telefono = ((formData.get('representante_telefono') as string) || '').trim() || null
    const parentesco = ((formData.get('parentesco') as string) || '').trim() || null

    if (!id || !cedula || !nombres || !apellidos) {
      return { error: 'Complete todos los campos del perfil.' }
    }

    const { error } = await supabaseAdmin
      .from('perfiles')
      .update({
        cedula,
        nombres,
        apellidos,
        representante_nombre,
        representante_cedula,
        representante_telefono,
        parentesco,
      })
      .eq('id', id)

    if (error) return { error: 'Error al actualizar usuario: ' + error.message }

    await registrarBitacora(
      'Actualización de Perfil',
      `Se actualizaron los datos de ${apellidos} ${nombres} (CI ${cedula}).`
    )
    revalidatePath('/admin')
    return { success: 'Datos del usuario actualizados correctamente.' }
  } catch (err: any) {
    return { error: err.message || 'Error inesperado al actualizar.' }
  }
}

export async function restablecerClaveUsuario(formData: FormData) {
  try {
    await verificarAdmin()
    const supabaseAdmin = getAdminClient()

    const id = formData.get('id') as string
    const nuevaClave = (formData.get('nueva_clave') as string) || ''

    if (!id || nuevaClave.length < 6) {
      return { error: 'Ingrese una contraseña de al menos 6 caracteres.' }
    }

    const { data: perfil } = await supabaseAdmin
      .from('perfiles')
      .select('nombres, apellidos, cedula')
      .eq('id', id)
      .single()

    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, {
      password: nuevaClave,
    })

    if (error) return { error: 'No se pudo restablecer la contraseña: ' + error.message }

    await registrarBitacora(
      'Restablecimiento de Clave',
      `Se actualizó la contraseña de ${perfil?.apellidos || ''} ${perfil?.nombres || ''} (CI ${perfil?.cedula || ''}).`
    )
    return { success: 'Contraseña restablecida correctamente.' }
  } catch (err: any) {
    return { error: err.message || 'Error inesperado al restablecer clave.' }
  }
}

export async function eliminarUsuario(id: string) {
  try {
    await verificarAdmin()
    const supabaseAdmin = getAdminClient()

    const { data: perfil } = await supabaseAdmin
      .from('perfiles')
      .select('nombres, apellidos, cedula')
      .eq('id', id)
      .single()

    const { error: perfilError } = await supabaseAdmin.from('perfiles').delete().eq('id', id)
    if (perfilError) {
      return { error: 'No se pudo eliminar el perfil: ' + perfilError.message }
    }

    await supabaseAdmin.auth.admin.deleteUser(id)

    await registrarBitacora(
      'Eliminación de Usuario',
      `Se eliminó el registro de ${perfil?.apellidos || ''} ${perfil?.nombres || ''} (CI ${perfil?.cedula || ''}).`
    )
    revalidatePath('/admin')
    return { success: 'Usuario eliminado del sistema.' }
  } catch (err: any) {
    return { error: err.message || 'Error inesperado al eliminar usuario.' }
  }
}

export async function crearMateria(formData: FormData) {
  try {
    const supabase = await verificarAdmin()
    const nombre = (formData.get('nombre') as string)?.trim()
    const curso_id = formData.get('curso_id') as string
    const profesor_id = formData.get('profesor_id') as string

    if (!nombre || !curso_id || !profesor_id) {
      return { error: 'Selecciona materia, curso y docente.' }
    }

    const { error } = await supabase.from('materias').insert({
      nombre,
      curso_id,
      profesor_id,
    })

    if (error) return { error: 'Error al asignar materia: ' + error.message }

    await registrarBitacora('Carga Académica', `Se asignó la asignatura "${nombre}".`)
    revalidatePath('/admin')
    return { success: `Materia "${nombre}" asignada correctamente.` }
  } catch (err: any) {
    return { error: err.message || 'Error inesperado al crear materia.' }
  }
}

export async function eliminarMateria(materiaId: string) {
  try {
    const supabase = await verificarAdmin()

    const { data: materia } = await supabase
      .from('materias')
      .select('nombre')
      .eq('id', materiaId)
      .single()

    const { error } = await supabase.from('materias').delete().eq('id', materiaId)
    if (error) return { error: 'Error al quitar asignatura: ' + error.message }

    await registrarBitacora(
      'Retiro de Asignatura',
      `Se retiró la asignatura "${materia?.nombre || ''}" de la carga académica.`
    )
    revalidatePath('/admin')
    return { success: 'Asignatura retirada de la carga académica.' }
  } catch (err: any) {
    return { error: err.message || 'Error inesperado al eliminar materia.' }
  }
}

export async function matricularEstudiante(formData: FormData) {
  try {
    const supabase = await verificarAdmin()
    const estudiante_id = formData.get('estudiante_id') as string
    const curso_id = formData.get('curso_id') as string

    if (!estudiante_id || !curso_id) {
      return { error: 'Selecciona un estudiante y un curso destino.' }
    }

    const { data: existente } = await supabase
      .from('matriculas')
      .select('id, cursos(nombre, paralelo)')
      .eq('estudiante_id', estudiante_id)
      .maybeSingle()

    if (existente) {
      const cursoInfo = Array.isArray(existente.cursos)
        ? existente.cursos[0]
        : existente.cursos
      return {
        error: `Este estudiante ya está matriculado en ${cursoInfo?.nombre || 'un curso'} "${cursoInfo?.paralelo || ''}".`,
      }
    }

    const { data: curso } = await supabase
      .from('cursos')
      .select('nombre, paralelo, cupo_maximo')
      .eq('id', curso_id)
      .single()

    const { count } = await supabase
      .from('matriculas')
      .select('*', { count: 'exact', head: true })
      .eq('curso_id', curso_id)

    if (curso && typeof count === 'number' && count >= (curso.cupo_maximo || 35)) {
      return {
        error: `El curso ${curso.nombre} "${curso.paralelo}" ha alcanzado su cupo máximo (${curso.cupo_maximo}).`,
      }
    }

    const { error } = await supabase.from('matriculas').insert({
      estudiante_id,
      curso_id,
    })

    if (error) {
      if (error.code === '23505') {
        return { error: 'Este estudiante ya cuenta con una matrícula activa.' }
      }
      return { error: 'Error al matricular al estudiante: ' + error.message }
    }

    const { data: alumno } = await supabase
      .from('perfiles')
      .select('nombres, apellidos')
      .eq('id', estudiante_id)
      .single()

    await registrarBitacora(
      'Matriculación',
      `Se matriculó a ${alumno?.apellidos || ''} ${alumno?.nombres || ''} en ${curso?.nombre || ''} "${curso?.paralelo || ''}".`
    )
    revalidatePath('/admin')
    return { success: 'Estudiante matriculado con éxito.' }
  } catch (err: any) {
    return { error: err.message || 'Error inesperado al matricular.' }
  }
}

export async function cambiarCursoMatricula(matriculaId: string, nuevoCursoId: string) {
  try {
    const supabase = await verificarAdmin()

    if (!matriculaId || !nuevoCursoId) {
      return { error: 'Seleccione el curso de destino.' }
    }

    const { data: cursoDestino } = await supabase
      .from('cursos')
      .select('nombre, paralelo, cupo_maximo')
      .eq('id', nuevoCursoId)
      .single()

    const { count } = await supabase
      .from('matriculas')
      .select('*', { count: 'exact', head: true })
      .eq('curso_id', nuevoCursoId)

    if (cursoDestino && typeof count === 'number' && count >= (cursoDestino.cupo_maximo || 35)) {
      return {
        error: `El paralelo destino ${cursoDestino.nombre} "${cursoDestino.paralelo}" no tiene cupos disponibles.`,
      }
    }

    const { error } = await supabase
      .from('matriculas')
      .update({ curso_id: nuevoCursoId })
      .eq('id', matriculaId)

    if (error) return { error: 'Error al cambiar de curso: ' + error.message }

    await registrarBitacora(
      'Cambio de Paralelo',
      `Se trasladó matrícula a ${cursoDestino?.nombre || ''} "${cursoDestino?.paralelo || ''}".`
    )
    revalidatePath('/admin')
    return { success: 'Paralelo actualizado correctamente.' }
  } catch (err: any) {
    return { error: err.message || 'Error inesperado al actualizar matrícula.' }
  }
}

export async function eliminarMatricula(matriculaId: string) {
  try {
    const supabase = await verificarAdmin()

    const { data: mat } = await supabase
      .from('matriculas')
      .select('perfiles(nombres, apellidos), cursos(nombre, paralelo)')
      .eq('id', matriculaId)
      .single()

    const { error } = await supabase.from('matriculas').delete().eq('id', matriculaId)
    if (error) return { error: 'Error al anular matrícula: ' + error.message }

    const perfil = Array.isArray(mat?.perfiles) ? mat?.perfiles[0] : mat?.perfiles
    const curso = Array.isArray(mat?.cursos) ? mat?.cursos[0] : mat?.cursos

    await registrarBitacora(
      'Anulación de Matrícula',
      `Se anuló la matrícula de ${perfil?.apellidos || ''} ${perfil?.nombres || ''} en ${curso?.nombre || ''} "${curso?.paralelo || ''}".`
    )
    revalidatePath('/admin')
    return { success: 'Matrícula anulada correctamente.' }
  } catch (err: any) {
    return { error: err.message || 'Error inesperado al anular matrícula.' }
  }
}