'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/utils/supabase/client'
import {
  crearPeriodo,
  crearCurso,
  crearUsuario,
  actualizarUsuario,
  restablecerClaveUsuario,
  eliminarUsuario,
  crearMateria,
  eliminarMateria,
  matricularEstudiante,
  cambiarCursoMatricula,
  eliminarMatricula,
} from './actions'
import {
  LayoutGrid,
  Calendar,
  Layers,
  Users,
  BookOpen,
  GraduationCap,
  History,
  Search,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  LogOut,
  ShieldCheck,
  ChevronRight,
  School,
  BadgeCheck,
  FileSpreadsheet,
  Printer,
  Pencil,
  Trash2,
  KeyRound,
  Award,
  Building2,
  UserCheck,
  Phone,
  Contact,
  AlertTriangle,
} from 'lucide-react'

interface AdminPanelProps {
  adminNombre: string
  adminEmail: string
  periodos: any[]
  cursos: any[]
  profesores: any[]
  estudiantes: any[]
  materias: any[]
  matriculas: any[]
  bitacora: any[]
}

interface ConfigInstitucion {
  nombreInstitucion: string
  codigoAmie: string
  ciudadEmision: string
  cargoFirma: string
}

interface ConfirmacionPendiente {
  titulo: string
  descripcion: string
  textoBoton: string
  accion: () => Promise<{ success?: string; error?: string }>
}

type VistaId = 'resumen' | 'cursos' | 'usuarios' | 'materias' | 'matriculas' | 'periodos' | 'auditoria'

const STORAGE_KEY_INST = 'portal_directivo_config_institucion_v1'

const CONFIG_POR_DEFECTO: ConfigInstitucion = {
  nombreInstitucion: 'Unidad Educativa Institucional',
  codigoAmie: '09H00000',
  ciudadEmision: 'Guayaquil',
  cargoFirma: 'Dirección Académica',
}

const CARD_GRADIENTS = [
  'from-violet-600 via-indigo-600 to-blue-600',
  'from-fuchsia-600 via-pink-600 to-rose-600',
  'from-cyan-600 via-sky-600 to-blue-600',
  'from-emerald-600 via-teal-600 to-cyan-600',
  'from-amber-600 via-orange-600 to-rose-600',
]

function obtenerIniciales(nombres?: string, apellidos?: string) {
  const n = (nombres || '').trim()[0] || ''
  const a = (apellidos || '').trim()[0] || ''
  return (a + n).toUpperCase() || 'US'
}

function generarFolioCertificado(mat: any) {
  const base = String(mat?.id || mat?.perfiles?.cedula || 'CERT')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6)
    .toUpperCase()
  return `CERT-2026-${base.padStart(6, '0')}`
}

function descargarNominaCurso(
  curso: any,
  alumnos: any[],
  periodoNombre?: string,
  nombreInstitucion?: string
) {
  const encabezados = [
    'Nro',
    'Institucion',
    'Apellidos y Nombres',
    'Cedula',
    'Representante',
    'Telefono Representante',
    'Curso',
    'Paralelo',
    'Periodo Lectivo',
  ]
  const filas = alumnos.map((mat: any, i: number) => [
    i + 1,
    `"${nombreInstitucion || 'Unidad Educativa'}"`,
    `"${(mat.perfiles?.apellidos || '')} ${(mat.perfiles?.nombres || '')}"`.trim(),
    `'${mat.perfiles?.cedula || ''}`,
    `"${mat.perfiles?.representante_nombre || 'No registrado'}"`,
    `'${mat.perfiles?.representante_telefono || 'N/A'}`,
    `"${curso.nombre || ''}"`,
    `"${curso.paralelo || ''}"`,
    `"${periodoNombre || curso.periodos_lectivos?.nombre || ''}"`,
  ])

  const contenido = [encabezados.join(';'), ...filas.map((f) => f.join(';'))].join('\n')
  const blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `Nomina_${curso.nombre}_${curso.paralelo}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function AdminPanelClient({
  adminNombre,
  adminEmail,
  periodos,
  cursos,
  profesores,
  estudiantes,
  materias,
  matriculas,
  bitacora,
}: AdminPanelProps) {
  const router = useRouter()
  const supabase = createClient()

  const [vista, setVista] = useState<VistaId>('resumen')
  const [drawerAbierto, setDrawerAbierto] = useState<
    null | 'periodo' | 'curso' | 'usuario' | 'editarUsuario' | 'claveUsuario' | 'materia' | 'matricula' | 'institucion'
  >(null)
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<any>(null)
  const [fichaEstudiante, setFichaEstudiante] = useState<any>(null)
  const [certificadoSeleccionado, setCertificadoSeleccionado] = useState<any>(null)
  const [confirmacionPendiente, setConfirmacionPendiente] = useState<ConfirmacionPendiente | null>(null)
  const [cursoDestinoMatricula, setCursoDestinoMatricula] = useState('')
  const [estudianteDestinoMatricula, setEstudianteDestinoMatricula] = useState('')
  const [configInst, setConfigInst] = useState<ConfigInstitucion>(CONFIG_POR_DEFECTO)
  const [busqueda, setBusqueda] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState<'todos' | 'profesor' | 'estudiante'>('todos')
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null)
  const [cargando, setCargando] = useState(false)

  useEffect(() => {
    try {
      const guardado = window.localStorage.getItem(STORAGE_KEY_INST)
      if (guardado) {
        const parsed = JSON.parse(guardado)
        setConfigInst({ ...CONFIG_POR_DEFECTO, ...parsed })
      }
    } catch {
      // Ignorar errores de acceso a localStorage
    }
  }, [])

  const guardarConfigInstitucion = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const nuevaConfig: ConfigInstitucion = {
      nombreInstitucion: String(fd.get('nombreInstitucion') || '').trim() || CONFIG_POR_DEFECTO.nombreInstitucion,
      codigoAmie: String(fd.get('codigoAmie') || '').trim() || CONFIG_POR_DEFECTO.codigoAmie,
      ciudadEmision: String(fd.get('ciudadEmision') || '').trim() || CONFIG_POR_DEFECTO.ciudadEmision,
      cargoFirma: String(fd.get('cargoFirma') || '').trim() || CONFIG_POR_DEFECTO.cargoFirma,
    }
    setConfigInst(nuevaConfig)
    try {
      window.localStorage.setItem(STORAGE_KEY_INST, JSON.stringify(nuevaConfig))
    } catch {
      // Ignorar errores de almacenamiento
    }
    setMensaje({ tipo: 'ok', texto: 'Identidad institucional actualizada para certificados y nóminas.' })
    setDrawerAbierto(null)
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const ejecutarAccion = async (
    accion: (fd: FormData) => Promise<{ success?: string; error?: string }>,
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault()
    setCargando(true)
    setMensaje(null)
    const form = e.currentTarget
    const fd = new FormData(form)
    const res = await accion(fd)

    if (res.error) {
      setMensaje({ tipo: 'err', texto: res.error })
    } else if (res.success) {
      setMensaje({ tipo: 'ok', texto: res.success })
      form.reset()
      setCursoDestinoMatricula('')
      setEstudianteDestinoMatricula('')
      setDrawerAbierto(null)
      setUsuarioSeleccionado(null)
    }
    setCargando(false)
  }

  const ejecutarAccionDirecta = async (
    promesa: Promise<{ success?: string; error?: string }>
  ) => {
    setCargando(true)
    setMensaje(null)
    const res = await promesa
    if (res.error) {
      setMensaje({ tipo: 'err', texto: res.error })
    } else if (res.success) {
      setMensaje({ tipo: 'ok', texto: res.success })
    }
    setCargando(false)
    setConfirmacionPendiente(null)
  }

  const solicitarConfirmacion = (
    titulo: string,
    descripcion: string,
    textoBoton: string,
    accion: () => Promise<{ success?: string; error?: string }>
  ) => {
    setConfirmacionPendiente({ titulo, descripcion, textoBoton, accion })
  }

  const periodoActivo = periodos.find((p) => p.activo)
  const q = busqueda.trim().toLowerCase()

  const cursosEnriquecidos = useMemo(() => {
    return cursos
      .map((c, idx) => {
        const alumnosCurso = matriculas.filter((m) => m.curso_id === c.id)
        const materiasCurso = materias.filter((m) => m.curso_id === c.id)
        const cupoMax = c.cupo_maximo || 35
        const cuposDisponibles = Math.max(0, cupoMax - alumnosCurso.length)
        const ocupacionPct = Math.min(100, Math.round((alumnosCurso.length / cupoMax) * 100))
        return {
          ...c,
          alumnos: alumnosCurso,
          materias: materiasCurso,
          cupoMax,
          cuposDisponibles,
          ocupacionPct,
          banner: CARD_GRADIENTS[idx % CARD_GRADIENTS.length],
        }
      })
      .filter(
        (c) =>
          !q ||
          c.nombre?.toLowerCase().includes(q) ||
          c.paralelo?.toLowerCase().includes(q) ||
          c.periodos_lectivos?.nombre?.toLowerCase().includes(q)
      )
  }, [cursos, matriculas, materias, q])

  const comunidadFiltrada = useMemo(() => {
    const lista = [
      ...profesores.map((p) => ({ ...p, rolLabel: 'Docente' })),
      ...estudiantes.map((e) => ({ ...e, rolLabel: 'Estudiante' })),
    ]
    return lista.filter((u) => {
      const matchRol = filtroUsuario === 'todos' || u.rol === filtroUsuario
      const matchQ =
        !q ||
        `${u.nombres} ${u.apellidos}`.toLowerCase().includes(q) ||
        u.cedula?.toLowerCase().includes(q) ||
        u.representante_nombre?.toLowerCase().includes(q)
      return matchRol && matchQ
    })
  }, [profesores, estudiantes, filtroUsuario, q])

  const materiasFiltradas = useMemo(
    () =>
      materias.filter(
        (m) =>
          !q ||
          m.nombre?.toLowerCase().includes(q) ||
          m.cursos?.nombre?.toLowerCase().includes(q) ||
          `${m.perfiles?.nombres ?? ''} ${m.perfiles?.apellidos ?? ''}`.toLowerCase().includes(q)
      ),
    [materias, q]
  )

  const matriculasFiltradas = useMemo(
    () =>
      matriculas.filter(
        (mat) =>
          !q ||
          `${mat.perfiles?.nombres ?? ''} ${mat.perfiles?.apellidos ?? ''}`.toLowerCase().includes(q) ||
          mat.cursos?.nombre?.toLowerCase().includes(q) ||
          mat.perfiles?.cedula?.toLowerCase().includes(q)
      ),
    [matriculas, q]
  )

  const cursoSeleccionadoMatricula = useMemo(
    () => cursosEnriquecidos.find((c) => c.id === cursoDestinoMatricula),
    [cursosEnriquecidos, cursoDestinoMatricula]
  )

  const matriculaExistenteEstudiante = useMemo(() => {
    if (!estudianteDestinoMatricula) return null
    return matriculas.find((m) => m.estudiante_id === estudianteDestinoMatricula) || null
  }, [matriculas, estudianteDestinoMatricula])

  const menuLateral: { id: VistaId; label: string; icon: any; badge?: number | string }[] = [
    { id: 'resumen', label: 'Centro de Mando', icon: LayoutGrid },
    { id: 'cursos', label: 'Cursos y Paralelos', icon: Layers, badge: cursos.length },
    { id: 'usuarios', label: 'Gestión de Usuarios', icon: Users, badge: profesores.length + estudiantes.length },
    { id: 'materias', label: 'Carga Académica', icon: BookOpen, badge: materias.length },
    { id: 'matriculas', label: 'Matrículas', icon: GraduationCap, badge: matriculas.length },
    { id: 'periodos', label: 'Periodos Lectivos', icon: Calendar, badge: periodos.length },
    { id: 'auditoria', label: 'Auditoría', icon: History, badge: bitacora.length },
  ]

  const accionRapidaActual = () => {
    if (vista === 'periodos') setDrawerAbierto('periodo')
    else if (vista === 'cursos' || vista === 'resumen') setDrawerAbierto('curso')
    else if (vista === 'usuarios') setDrawerAbierto('usuario')
    else if (vista === 'materias') setDrawerAbierto('materia')
    else if (vista === 'matriculas') setDrawerAbierto('matricula')
    else setDrawerAbierto('curso')
  }

  const textoBotonCrear: Record<VistaId, string> = {
    resumen: 'Nuevo Curso',
    cursos: 'Crear Curso',
    usuarios: 'Registrar Usuario',
    materias: 'Asignar Materia',
    matriculas: 'Nueva Matrícula',
    periodos: 'Nuevo Periodo',
    auditoria: 'Nuevo Curso',
  }

  const inputCls =
    'w-full px-3.5 py-2.5 rounded-xl bg-violet-950/40 border border-violet-500/30 text-slate-100 placeholder:text-violet-300/40 text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 transition'
  const labelCls = 'block text-[11px] font-semibold uppercase tracking-wider text-violet-300/80 mb-1.5'
  const btnCls =
    'w-full py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 hover:brightness-110 active:scale-[0.99] text-white font-bold text-sm shadow-lg shadow-violet-950/70 transition cursor-pointer disabled:opacity-50'

  const fechaEmisionHoy = new Date().toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f0c1b] via-[#15102a] to-[#0a1128] text-slate-100 flex">
      <style jsx global>{`
        html,
        body {
          background-color: #0f0c1b;
          color: #f1f5f9;
          scrollbar-width: thin;
          scrollbar-color: rgba(168, 85, 247, 0.45) #0d091e;
        }
        ::-webkit-scrollbar {
          width: 7px;
          height: 7px;
        }
        ::-webkit-scrollbar-track {
          background: #0d091e;
        }
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, #7c3aed 0%, #c026d3 100%);
          border-radius: 9999px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(180deg, #8b5cf6 0%, #e879f9 100%);
        }
        @media print {
          body * {
            visibility: hidden;
          }
          #certificado-impresion,
          #certificado-impresion * {
            visibility: visible;
          }
          #certificado-impresion {
            position: fixed;
            inset: 0;
            width: 100%;
            height: 100%;
            background: #ffffff !important;
            color: #1e1b4b !important;
            padding: 48px !important;
            z-index: 99999;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-[#120e26]/95 backdrop-blur-xl border-r border-violet-500/20 z-30 shadow-2xl">
        <div className="h-16 px-5 flex items-center justify-between gap-2 border-b border-violet-500/20 bg-[#0d091e]/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-950/80 shrink-0">
              <School className="w-5 h-5 text-white font-extrabold" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-white tracking-tight truncate">
                {configInst.nombreInstitucion}
              </p>
              <p className="text-[11px] text-violet-200/70 truncate">
                AMIE {configInst.codigoAmie} · Portal Directivo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDrawerAbierto('institucion')}
            title="Configurar datos de la institución"
            className="p-2 rounded-xl bg-violet-950/80 hover:bg-violet-900 border border-violet-500/30 text-violet-200 transition cursor-pointer shrink-0"
          >
            <Building2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-4 pt-4">
          <div className="rounded-2xl bg-gradient-to-r from-violet-600/20 via-fuchsia-600/10 to-indigo-600/20 border border-violet-500/30 px-4 py-3 flex items-center justify-between shadow-inner">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-violet-300 font-bold">
                Periodo Lectivo
              </p>
              <p className="text-xs font-bold text-white mt-0.5">
                {periodoActivo ? periodoActivo.nombre : 'No asignado'}
              </p>
            </div>
            <span className="w-3 h-3 rounded-full bg-fuchsia-400 shadow-[0_0_12px_#e879f9] animate-pulse" />
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-violet-300/60">
            Módulos del Sistema
          </p>
          {menuLateral.map((item) => {
            const Icon = item.icon
            const active = vista === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setVista(item.id)
                  setMensaje(null)
                }}
                className={`relative w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition cursor-pointer ${
                  active
                    ? 'text-white font-semibold'
                    : 'text-violet-200/70 hover:text-white hover:bg-violet-500/15'
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="teamsSidebarActive"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-600/40 via-indigo-600/30 to-fuchsia-600/20 border border-violet-400/50 shadow-md"
                  />
                )}
                <span className="relative z-10 flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${active ? 'text-fuchsia-300' : 'text-violet-400/70'}`} />
                  <span>{item.label}</span>
                </span>
                {item.badge !== undefined && (
                  <span
                    className={`relative z-10 text-xs px-2.5 py-0.5 rounded-full tabular-nums ${
                      active
                        ? 'bg-fuchsia-500/30 text-fuchsia-100 font-bold border border-fuchsia-400/30'
                        : 'bg-violet-950/60 text-violet-300/80 border border-violet-500/20'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}

          <div className="pt-6">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-violet-300/60">
              Operaciones
            </p>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => setDrawerAbierto('matricula')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs text-violet-200/90 hover:bg-violet-500/15 transition cursor-pointer font-medium"
              >
                <span>Matricular estudiante</span>
                <ChevronRight className="w-3.5 h-3.5 text-fuchsia-400" />
              </button>
              <button
                type="button"
                onClick={() => setDrawerAbierto('materia')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs text-violet-200/90 hover:bg-violet-500/15 transition cursor-pointer font-medium"
              >
                <span>Asignar carga docente</span>
                <ChevronRight className="w-3.5 h-3.5 text-fuchsia-400" />
              </button>
              <button
                type="button"
                onClick={() => setDrawerAbierto('institucion')}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs text-violet-200/90 hover:bg-violet-500/15 transition cursor-pointer font-medium"
              >
                <span>Datos de la institución</span>
                <ChevronRight className="w-3.5 h-3.5 text-fuchsia-400" />
              </button>
            </div>
          </div>
        </nav>

        <div className="p-3 border-t border-violet-500/20 bg-[#0d091e]/90">
          <div className="flex items-center gap-3 p-2 rounded-2xl bg-violet-950/50 border border-violet-500/30">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow">
              {obtenerIniciales(adminNombre)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{adminNombre}</p>
              <p className="text-[11px] text-violet-300/70 truncate">{adminEmail}</p>
            </div>
            <button
              type="button"
              onClick={cerrarSesion}
              title="Cerrar sesión"
              className="p-2 rounded-xl text-rose-300 hover:bg-rose-500/20 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 lg:pl-72 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-[#0f0c1b]/85 backdrop-blur-xl border-b border-violet-500/20 px-4 sm:px-8 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 text-violet-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar registros, estudiantes, representantes o cursos..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-violet-950/40 border border-violet-500/30 text-sm text-slate-100 placeholder:text-violet-300/40 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/30 transition shadow-inner"
            />
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setDrawerAbierto('institucion')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-violet-950/70 hover:bg-violet-900 border border-violet-500/30 text-violet-200 text-xs font-bold transition cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-fuchsia-300" />
              <span>Institución</span>
            </button>
            <button
              type="button"
              onClick={accionRapidaActual}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 hover:brightness-110 text-white text-xs sm:text-sm font-bold shadow-lg shadow-violet-950/70 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>{textoBotonCrear[vista]}</span>
            </button>
            <button
              type="button"
              onClick={cerrarSesion}
              className="lg:hidden p-2 rounded-xl bg-violet-950 border border-violet-500/30 text-rose-300"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="lg:hidden flex gap-1.5 overflow-x-auto px-4 py-3 border-b border-violet-500/20 bg-[#120e26]">
          {menuLateral.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setVista(m.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                vista === m.id ? 'bg-violet-600 text-white shadow-md' : 'bg-violet-950/60 text-violet-200 hover:bg-violet-900'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6">
          <AnimatePresence>
            {mensaje && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-sm shadow-xl ${
                  mensaje.tipo === 'ok'
                    ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-200'
                    : 'bg-rose-950/90 border-rose-500/40 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {mensaje.tipo === 'ok' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                  <span className="font-medium">{mensaje.texto}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMensaje(null)}
                  className="text-xs font-bold uppercase tracking-wider opacity-80 hover:opacity-100 cursor-pointer"
                >
                  Cerrar
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {vista === 'resumen' && (
            <div className="space-y-7">
              <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-violet-950 via-indigo-950 to-purple-900 border border-violet-500/40 relative overflow-hidden shadow-2xl">
                <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-fuchsia-500/15 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-violet-500/30 border border-violet-400/50 text-violet-200 mb-3 shadow-sm">
                      {configInst.nombreInstitucion} · AMIE {configInst.codigoAmie}
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                      Estimado(a) {adminNombre}
                    </h1>
                    <p className="text-violet-200/90 text-sm mt-1.5 max-w-xl leading-relaxed">
                      Plataforma institucional habilitada para la administración de periodos, oferta académica y control de matrículas correspondientes al periodo <strong className="text-fuchsia-300">{periodoActivo?.nombre || 'vigente'}</strong>.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setDrawerAbierto('matricula')}
                      className="px-5 py-3 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white font-bold text-xs sm:text-sm hover:brightness-110 shadow-lg shadow-fuchsia-950/60 transition cursor-pointer"
                    >
                      Matricular Alumno
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawerAbierto('usuario')}
                      className="px-5 py-3 rounded-xl bg-violet-900/60 border border-violet-400/30 text-violet-200 font-bold text-xs sm:text-sm hover:bg-violet-900 transition cursor-pointer shadow-lg"
                    >
                      Registrar Usuario
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Cursos Habilitados', val: cursos.length, sub: 'Paralelos activos', to: 'cursos' as VistaId, color: 'from-violet-600/30 to-indigo-600/10 border-violet-500/40 text-violet-200' },
                  { label: 'Cuerpo Docente', val: profesores.length, sub: 'Profesores registrados', to: 'usuarios' as VistaId, color: 'from-fuchsia-600/30 to-pink-600/10 border-fuchsia-500/40 text-fuchsia-200' },
                  { label: 'Estudiantes', val: estudiantes.length, sub: `${matriculas.length} matriculados`, to: 'matriculas' as VistaId, color: 'from-cyan-600/30 to-blue-600/10 border-cyan-500/40 text-cyan-200' },
                  { label: 'Carga Académica', val: materias.length, sub: 'Materias asignadas', to: 'materias' as VistaId, color: 'from-emerald-600/30 to-teal-600/10 border-emerald-500/40 text-emerald-200' },
                ].map((stat) => (
                  <button
                    key={stat.label}
                    type="button"
                    onClick={() => setVista(stat.to)}
                    className={`text-left rounded-2xl bg-gradient-to-br ${stat.color} border p-5 transition cursor-pointer group shadow-xl backdrop-blur-md hover:scale-[1.02]`}
                  >
                    <p className="text-xs text-violet-200/80 font-bold tracking-wide">{stat.label}</p>
                    <p className="text-3xl font-extrabold text-white mt-2 tabular-nums group-hover:text-fuchsia-300 transition-colors">
                      {stat.val}
                    </p>
                    <p className="text-xs text-violet-300/60 mt-1.5 font-medium">{stat.sub}</p>
                  </button>
                ))}
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white tracking-wide">Estructura de Cursos y Paralelos</h2>
                    <p className="text-xs text-violet-300/70">
                      Visualización de cursos configurados, cupos disponibles y alumnado matriculado
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerAbierto('curso')}
                    className="text-xs font-bold text-fuchsia-300 hover:text-fuchsia-200 underline cursor-pointer"
                  >
                    Crear nuevo curso
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {cursosEnriquecidos.map((curso) => (
                    <div
                      key={curso.id}
                      className="rounded-2xl bg-[#130f28]/90 border border-violet-500/25 hover:border-violet-400/60 overflow-hidden flex flex-col justify-between transition group shadow-xl"
                    >
                      <div>
                        <div className={`h-24 bg-gradient-to-r ${curso.banner} p-4 flex items-start justify-between shadow-inner`}>
                          <span className="px-3 py-1 rounded-xl bg-black/40 backdrop-blur-md text-white text-xs font-bold border border-white/20">
                            Paralelo "{curso.paralelo}"
                          </span>
                          <span className="text-[11px] font-bold text-white bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10">
                            {curso.periodos_lectivos?.nombre}
                          </span>
                        </div>

                        <div className="p-5">
                          <h3 className="text-base font-extrabold text-white">{curso.nombre}</h3>
                          <p className="text-xs text-violet-300/70 mt-1 font-medium">
                            {curso.materias.length} materias · Cupos: {curso.alumnos.length} / {curso.cupoMax} ({curso.cuposDisponibles} libres)
                          </p>

                          <div className="mt-2.5 w-full h-1.5 rounded-full bg-violet-950 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 transition-all"
                              style={{ width: `${curso.ocupacionPct}%` }}
                            />
                          </div>

                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {curso.materias.slice(0, 3).map((m: any) => (
                              <span
                                key={m.id}
                                className="text-[11px] px-3 py-1 rounded-xl bg-violet-500/15 text-violet-200 border border-violet-400/30 font-medium"
                              >
                                {m.nombre}
                              </span>
                            ))}
                            {curso.materias.length === 0 && (
                              <span className="text-[11px] text-violet-400/50 italic">
                                Sin materias registradas
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="px-5 py-3.5 bg-violet-950/40 border-t border-violet-500/20 flex items-center justify-between gap-2">
                        <div className="flex -space-x-2">
                          {curso.alumnos.slice(0, 4).map((al: any) => (
                            <div
                              key={al.id}
                              title={`${al.perfiles?.apellidos} ${al.perfiles?.nombres}`}
                              className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 border-2 border-[#130f28] flex items-center justify-center text-[10px] font-extrabold text-white shadow"
                            >
                              {obtenerIniciales(al.perfiles?.nombres, al.perfiles?.apellidos)}
                            </div>
                          ))}
                          {curso.alumnos.length === 0 && (
                            <span className="text-[11px] text-violet-400/50">Sin matrícula</span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              descargarNominaCurso(
                                curso,
                                curso.alumnos,
                                periodoActivo?.nombre,
                                configInst.nombreInstitucion
                              )
                            }
                            className="inline-flex items-center gap-1 text-xs font-bold text-cyan-300 hover:text-cyan-200 cursor-pointer"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Nómina</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDrawerAbierto('matricula')}
                            className="text-xs font-bold text-fuchsia-300 hover:text-fuchsia-200 cursor-pointer"
                          >
                            Matricular
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {vista === 'cursos' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {cursosEnriquecidos.map((curso) => (
                <div
                  key={curso.id}
                  className="rounded-2xl bg-[#130f28]/90 border border-violet-500/25 overflow-hidden shadow-xl flex flex-col justify-between"
                >
                  <div>
                    <div className={`h-16 bg-gradient-to-r ${curso.banner} px-5 flex items-center justify-between`}>
                      <span className="font-extrabold text-white text-sm">
                        {curso.nombre} "{curso.paralelo}"
                      </span>
                      <span className="text-xs font-bold bg-black/40 px-3 py-1 rounded-full text-white border border-white/10">
                        {curso.periodos_lectivos?.nombre}
                      </span>
                    </div>
                    <div className="p-5 space-y-3">
                      <div className="flex justify-between text-xs text-violet-200/90 font-medium">
                        <span>Ocupación de cupos</span>
                        <span className="text-fuchsia-300 font-bold">
                          {curso.alumnos.length} / {curso.cupoMax} ({curso.ocupacionPct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-violet-950 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-400"
                          style={{ width: `${curso.ocupacionPct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-violet-200/90 font-medium pt-1">
                        <span>Cupos disponibles</span>
                        <span className="text-cyan-300 font-bold">{curso.cuposDisponibles}</span>
                      </div>
                      <div className="flex justify-between text-xs text-violet-200/90 font-medium">
                        <span>Total materias asignadas</span>
                        <span className="text-fuchsia-300 font-bold">{curso.materias.length}</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-5 py-3 bg-violet-950/40 border-t border-violet-500/20 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        descargarNominaCurso(
                          curso,
                          curso.alumnos,
                          periodoActivo?.nombre,
                          configInst.nombreInstitucion
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-200 text-xs font-bold hover:bg-cyan-500/25 transition cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Exportar Nómina CSV</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {vista === 'usuarios' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex p-1.5 rounded-2xl bg-[#130f28] border border-violet-500/25 shadow-xl">
                  {(
                    [
                      { id: 'todos', label: `Todos (${profesores.length + estudiantes.length})` },
                      { id: 'profesor', label: `Docentes (${profesores.length})` },
                      { id: 'estudiante', label: `Estudiantes (${estudiantes.length})` },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFiltroUsuario(f.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                        filtroUsuario === f.id
                          ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md'
                          : 'text-violet-300/70 hover:text-white'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {comunidadFiltrada.map((u) => {
                  const matriculaUsuario = matriculas.find((m) => m.estudiante_id === u.id)
                  return (
                    <div
                      key={u.id}
                      className="rounded-2xl bg-[#130f28]/90 border border-violet-500/25 p-4 flex items-start justify-between gap-3 hover:border-violet-400/60 transition shadow-xl"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center font-extrabold text-sm text-white shrink-0 shadow ${
                            u.rol === 'profesor'
                              ? 'bg-gradient-to-br from-indigo-500 to-blue-600'
                              : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                          }`}
                        >
                          {obtenerIniciales(u.nombres, u.apellidos)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">
                            {u.apellidos} {u.nombres}
                          </p>
                          <p className="text-xs text-violet-300/80 font-mono font-medium">CI: {u.cedula}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span
                              className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                                u.rol === 'profesor'
                                  ? 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/40'
                                  : 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
                              }`}
                            >
                              {u.rolLabel}
                            </span>
                            {u.rol === 'estudiante' && (
                              <button
                                type="button"
                                onClick={() => setFichaEstudiante({ perfil: u, matricula: matriculaUsuario })}
                                className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-fuchsia-500/20 hover:bg-fuchsia-500/35 text-fuchsia-200 border border-fuchsia-400/30 cursor-pointer transition"
                              >
                                Ver ficha
                              </button>
                            )}
                          </div>
                          {u.representante_nombre && (
                            <p className="text-[11px] text-violet-300/70 mt-1.5 truncate">
                              Rep.: {u.representante_nombre} {u.representante_telefono ? `(${u.representante_telefono})` : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={cargando}
                            onClick={() => {
                              setUsuarioSeleccionado(u)
                              setDrawerAbierto('editarUsuario')
                            }}
                            title="Editar datos"
                            className="p-2 rounded-xl bg-violet-500/15 hover:bg-violet-500/30 text-violet-200 border border-violet-400/30 transition cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={cargando}
                            onClick={() => {
                              setUsuarioSeleccionado(u)
                              setDrawerAbierto('claveUsuario')
                            }}
                            title="Restablecer contraseña"
                            className="p-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/30 text-amber-200 border border-amber-400/30 transition cursor-pointer"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={cargando}
                            onClick={() =>
                              solicitarConfirmacion(
                                'Eliminar cuenta de usuario',
                                `¿Desea eliminar permanentemente a ${u.apellidos} ${u.nombres} (CI: ${u.cedula})? Esta acción no se puede deshacer.`,
                                'Eliminar usuario',
                                () => eliminarUsuario(u.id)
                              )
                            }
                            title="Eliminar usuario"
                            className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-400/30 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {vista === 'materias' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {materiasFiltradas.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl bg-[#130f28]/90 border border-violet-500/25 p-5 flex items-center justify-between gap-4 shadow-xl"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-fuchsia-500/25 to-pink-500/25 border border-fuchsia-400/40 flex items-center justify-center text-fuchsia-300 shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">{m.nombre}</p>
                      <p className="text-xs text-violet-300/70 truncate mt-0.5">
                        Docente asignado:{' '}
                        <span className="text-fuchsia-200 font-medium">
                          {m.perfiles ? `${m.perfiles.apellidos} ${m.perfiles.nombres}` : 'No asignado'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="px-3 py-1.5 rounded-xl bg-violet-600/20 border border-violet-400/30 text-violet-200 text-xs font-bold">
                      {m.cursos?.nombre} "{m.cursos?.paralelo}"
                    </span>
                    <button
                      type="button"
                      disabled={cargando}
                      onClick={() =>
                        solicitarConfirmacion(
                          'Retirar asignatura',
                          `¿Desea retirar la asignatura "${m.nombre}" del curso ${m.cursos?.nombre} "${m.cursos?.paralelo}"?`,
                          'Retirar asignatura',
                          () => eliminarMateria(m.id)
                        )
                      }
                      title="Quitar asignatura"
                      className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-400/30 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {vista === 'matriculas' && (
            <div className="rounded-2xl bg-[#130f28]/90 border border-violet-500/25 overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-violet-500/25 flex items-center justify-between bg-[#0d091e]/80">
                <h3 className="text-sm font-bold text-white">Registro de Estudiantes Matriculados</h3>
                <span className="text-xs font-semibold text-fuchsia-300">{matriculasFiltradas.length} registros</span>
              </div>
              <div className="divide-y divide-violet-500/15">
                {matriculasFiltradas.map((mat) => (
                  <div
                    key={mat.id}
                    className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-violet-500/10 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-500 text-white flex items-center justify-center text-xs font-extrabold shadow shrink-0">
                        {obtenerIniciales(mat.perfiles?.nombres, mat.perfiles?.apellidos)}
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={() => setFichaEstudiante({ perfil: mat.perfiles, matricula: mat })}
                          className="text-sm font-bold text-white hover:text-fuchsia-300 transition text-left cursor-pointer"
                        >
                          {mat.perfiles?.apellidos} {mat.perfiles?.nombres}
                        </button>
                        {mat.perfiles?.cedula && (
                          <p className="text-xs text-violet-300/80 font-mono font-medium">CI: {mat.perfiles.cedula}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-fuchsia-500/20 border border-fuchsia-400/30 text-fuchsia-200 text-xs font-bold">
                        <BadgeCheck className="w-4 h-4" />
                        {mat.cursos?.nombre} "{mat.cursos?.paralelo}"
                      </span>

                      <select
                        value={mat.curso_id}
                        disabled={cargando}
                        onChange={(e) => {
                          const nuevoCursoId = e.target.value
                          const destino = cursos.find((c) => c.id === nuevoCursoId)
                          solicitarConfirmacion(
                            'Trasladar estudiante de paralelo',
                            `¿Confirma trasladar a ${mat.perfiles?.apellidos} ${mat.perfiles?.nombres} a ${destino?.nombre || ''} "${destino?.paralelo || ''}"?`,
                            'Confirmar traslado',
                            () => cambiarCursoMatricula(mat.id, nuevoCursoId)
                          )
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-violet-950/70 border border-violet-500/30 text-xs text-violet-100 focus:outline-none focus:border-violet-400 cursor-pointer"
                      >
                        {cursos.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre} "{c.paralelo}"
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => setCertificadoSeleccionado(mat)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/35 border border-indigo-400/35 text-indigo-200 text-xs font-bold transition cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Certificado</span>
                      </button>

                      <button
                        type="button"
                        disabled={cargando}
                        onClick={() =>
                          solicitarConfirmacion(
                            'Anular matrícula',
                            `¿Desea anular la matrícula de ${mat.perfiles?.apellidos} ${mat.perfiles?.nombres} en ${mat.cursos?.nombre || ''} "${mat.cursos?.paralelo || ''}"?`,
                            'Anular matrícula',
                            () => eliminarMatricula(mat.id)
                          )
                        }
                        title="Anular matrícula"
                        className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 border border-rose-400/30 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {vista === 'periodos' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {periodos.map((p) => (
                <div
                  key={p.id}
                  className="rounded-2xl bg-[#130f28]/90 border border-violet-500/25 p-5 flex items-center justify-between shadow-xl"
                >
                  <div>
                    <p className="text-base font-bold text-white">{p.nombre}</p>
                    <p className="text-xs text-violet-300/70 mt-0.5 font-medium">Periodo lectivo institucional</p>
                  </div>
                  {p.activo ? (
                    <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 text-xs font-bold shadow-sm">
                      Vigente
                    </span>
                  ) : (
                    <span className="px-3.5 py-1.5 rounded-full bg-violet-950 text-violet-300/60 text-xs font-medium border border-violet-800/50">
                      Concluido
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {vista === 'auditoria' && (
            <div className="rounded-2xl bg-[#130f28]/90 border border-violet-500/25 overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-violet-500/25 flex items-center justify-between bg-[#0d091e]/80">
                <h3 className="text-sm font-bold text-white">Bitácora Institucional de Movimientos</h3>
                <span className="text-xs font-semibold text-fuchsia-300">{bitacora.length} eventos</span>
              </div>
              <div className="divide-y divide-violet-500/15">
                {bitacora.map((b) => (
                  <div key={b.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-fuchsia-300 uppercase tracking-wider">
                        {b.accion}
                      </span>
                      <p className="text-sm text-white mt-0.5">{b.detalle}</p>
                    </div>
                    <span className="text-xs text-violet-300/70 shrink-0">
                      {new Date(b.creado_en).toLocaleString('es-EC')}
                    </span>
                  </div>
                ))}
                {bitacora.length === 0 && (
                  <div className="px-6 py-8 text-center text-sm text-violet-300/60">
                    No existen movimientos registrados en la bitácora.
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal de Ficha del Estudiante y Representante */}
      <AnimatePresence>
        {fichaEstudiante && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFichaEstudiante(null)}
              className="no-print fixed inset-0 bg-[#070510]/80 backdrop-blur-md z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-lg rounded-3xl bg-[#130f28] border border-violet-500/35 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-violet-500/20 bg-[#0d091e]/90">
                  <div className="flex items-center gap-2 text-fuchsia-300 text-xs font-bold uppercase tracking-wider">
                    <UserCheck className="w-4 h-4" />
                    <span>Ficha Estudiantil y Representante</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFichaEstudiante(null)}
                    className="p-2 rounded-xl bg-violet-950 hover:bg-violet-900 text-violet-200 cursor-pointer transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-6 space-y-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 flex items-center justify-center text-base font-extrabold text-white shadow">
                      {obtenerIniciales(fichaEstudiante.perfil?.nombres, fichaEstudiante.perfil?.apellidos)}
                    </div>
                    <div>
                      <h3 className="text-lg font-extrabold text-white">
                        {fichaEstudiante.perfil?.apellidos} {fichaEstudiante.perfil?.nombres}
                      </h3>
                      <p className="text-xs text-violet-300/80 font-mono">
                        CI: {fichaEstudiante.perfil?.cedula || 'S/N'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-violet-950/40 border border-violet-500/25 p-4 space-y-2 text-xs">
                    <p className="font-bold uppercase tracking-wider text-fuchsia-300 text-[10px]">
                      Estado de Matrícula
                    </p>
                    <p className="text-violet-100">
                      <strong>Curso actual:</strong>{' '}
                      {fichaEstudiante.matricula?.cursos
                        ? `${fichaEstudiante.matricula.cursos.nombre} Paralelo "${fichaEstudiante.matricula.cursos.paralelo}"`
                        : 'Sin matrícula registrada'}
                    </p>
                    <p className="text-violet-200/80">
                      <strong>Periodo lectivo:</strong> {periodoActivo?.nombre || 'Vigente'}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-violet-950/40 border border-violet-500/25 p-4 space-y-2.5 text-xs">
                    <p className="font-bold uppercase tracking-wider text-cyan-300 text-[10px]">
                      Datos del Representante Legal
                    </p>
                    <div className="flex items-center gap-2 text-violet-100">
                      <Users className="w-3.5 h-3.5 text-violet-300 shrink-0" />
                      <span>{fichaEstudiante.perfil?.representante_nombre || 'No registrado'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-violet-200/80">
                      <Contact className="w-3.5 h-3.5 text-violet-300 shrink-0" />
                      <span>Cédula: {fichaEstudiante.perfil?.representante_cedula || 'No registrada'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-violet-200/80">
                      <Phone className="w-3.5 h-3.5 text-violet-300 shrink-0" />
                      <span>Teléfono: {fichaEstudiante.perfil?.representante_telefono || 'No registrado'}</span>
                    </div>
                    {fichaEstudiante.perfil?.parentesco && (
                      <p className="text-violet-300/80">
                        <strong>Parentesco:</strong> {fichaEstudiante.perfil.parentesco}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-1">
                    {fichaEstudiante.matricula && (
                      <button
                        type="button"
                        onClick={() => {
                          const mat = fichaEstudiante.matricula
                          setFichaEstudiante(null)
                          setCertificadoSeleccionado(mat)
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/40 border border-indigo-400/40 text-indigo-200 text-xs font-bold transition cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Emitir Certificado</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setFichaEstudiante(null)}
                      className="px-4 py-2 rounded-xl bg-violet-950 hover:bg-violet-900 border border-violet-500/30 text-xs font-bold text-violet-200 transition cursor-pointer"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal de Confirmación Institucional */}
      <AnimatePresence>
        {confirmacionPendiente && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !cargando && setConfirmacionPendiente(null)}
              className="no-print fixed inset-0 bg-[#070510]/85 backdrop-blur-md z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-md rounded-3xl bg-[#130f28] border border-violet-500/35 p-6 shadow-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-extrabold text-white">{confirmacionPendiente.titulo}</h3>
                </div>
                <p className="text-sm text-violet-200/85 leading-relaxed">
                  {confirmacionPendiente.descripcion}
                </p>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    disabled={cargando}
                    onClick={() => setConfirmacionPendiente(null)}
                    className="px-4 py-2 rounded-xl bg-violet-950/70 hover:bg-violet-900 border border-violet-500/30 text-xs font-bold text-violet-200 transition cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={cargando}
                    onClick={() => ejecutarAccionDirecta(confirmacionPendiente.accion())}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-fuchsia-600 hover:brightness-110 text-white text-xs font-bold shadow-lg transition cursor-pointer disabled:opacity-50"
                  >
                    {cargando ? 'Procesando...' : confirmacionPendiente.textoBoton}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal de Certificado de Matrícula */}
      <AnimatePresence>
        {certificadoSeleccionado && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCertificadoSeleccionado(null)}
              className="no-print fixed inset-0 bg-[#070510]/80 backdrop-blur-md z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-2xl rounded-3xl bg-[#130f28] border border-violet-500/35 shadow-2xl overflow-hidden">
                <div className="no-print flex items-center justify-between px-6 py-4 border-b border-violet-500/20 bg-[#0d091e]/90">
                  <div className="flex items-center gap-2 text-fuchsia-300 text-xs font-bold uppercase tracking-wider">
                    <Award className="w-4 h-4" />
                    <span>Certificado de Matrícula · {generarFolioCertificado(certificadoSeleccionado)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCertificadoSeleccionado(null)}
                    className="p-2 rounded-xl bg-violet-950 hover:bg-violet-900 text-violet-200 cursor-pointer transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div
                  id="certificado-impresion"
                  className="p-8 bg-white text-[#1e1b4b] space-y-5"
                  style={{ fontFamily: 'Georgia, serif', lineHeight: 1.7 }}
                >
                  <div className="text-center border-b-2 border-[#4c1d95] pb-4 mb-6">
                    <h2 className="text-xl font-bold m-0 uppercase">{configInst.nombreInstitucion}</h2>
                    <p className="text-xs m-0 mt-1">
                      CÓDIGO AMIE: {configInst.codigoAmie} · CERTIFICACIÓN OFICIAL DE SECRETARÍA Y DIRECCIÓN
                    </p>
                    <p className="text-[11px] m-0 mt-1 text-[#4c1d95] font-semibold">
                      Folio de Verificación: {generarFolioCertificado(certificadoSeleccionado)}
                    </p>
                  </div>

                  <h3 className="text-xl font-bold uppercase tracking-wider text-center mt-4">
                    Certificado de Matrícula
                  </h3>

                  <p className="text-sm text-justify mt-4">
                    La Dirección de <strong>{configInst.nombreInstitucion}</strong> certifica que el/la
                    estudiante{' '}
                    <strong>
                      {`${certificadoSeleccionado.perfiles?.apellidos || ''} ${certificadoSeleccionado.perfiles?.nombres || ''}`.trim()}
                    </strong>
                    , portador(a) de la cédula de ciudadanía N.º{' '}
                    <strong>{certificadoSeleccionado.perfiles?.cedula || 'S/N'}</strong>, se encuentra
                    legalmente matriculado(a) en{' '}
                    <strong>
                      {certificadoSeleccionado.cursos?.nombre || ''} Paralelo "
                      {certificadoSeleccionado.cursos?.paralelo || ''}"
                    </strong>
                    , correspondiente al periodo lectivo{' '}
                    <strong>
                      {periodoActivo?.nombre ||
                        certificadoSeleccionado.cursos?.periodos_lectivos?.nombre ||
                        'vigente'}
                    </strong>
                    .
                  </p>

                  {certificadoSeleccionado.perfiles?.representante_nombre && (
                    <p className="text-xs text-[#312e81]">
                      <strong>Representante Legal:</strong>{' '}
                      {certificadoSeleccionado.perfiles.representante_nombre}
                      {certificadoSeleccionado.perfiles.representante_cedula
                        ? ` (CI: ${certificadoSeleccionado.perfiles.representante_cedula})`
                        : ''}
                      {certificadoSeleccionado.perfiles.representante_telefono
                        ? ` · Tel: ${certificadoSeleccionado.perfiles.representante_telefono}`
                        : ''}
                    </p>
                  )}

                  <p className="text-sm text-justify">
                    Es todo cuanto puedo certificar en honor a la verdad, pudiendo el interesado hacer
                    uso del presente documento para los fines académicos o legales pertinentes.
                  </p>

                  <p className="text-sm mt-6">
                    {configInst.ciudadEmision}, {fechaEmisionHoy}.
                  </p>

                  <div className="mt-16 text-center">
                    <div className="w-64 border-t border-[#1e1b4b] mx-auto mb-2" />
                    <strong>{adminNombre}</strong>
                    <br />
                    <span className="text-xs">{configInst.cargoFirma}</span>
                  </div>
                </div>

                <div className="no-print flex items-center justify-end gap-3 px-6 py-4 border-t border-violet-500/20 bg-[#0d091e]/90">
                  <button
                    type="button"
                    onClick={() => setCertificadoSeleccionado(null)}
                    className="px-4 py-2 rounded-xl bg-violet-950/70 hover:bg-violet-900 border border-violet-500/30 text-xs font-bold text-violet-200 transition cursor-pointer"
                  >
                    Cerrar
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-fuchsia-600 hover:brightness-110 text-white text-xs font-bold shadow-lg transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir / Guardar PDF</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {drawerAbierto && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setDrawerAbierto(null)
                setUsuarioSeleccionado(null)
              }}
              className="fixed inset-0 bg-[#070510]/80 backdrop-blur-md z-40"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              className="fixed inset-y-0 right-0 w-full max-w-md bg-[#130f28] border-l border-violet-500/30 z-50 p-6 flex flex-col justify-between overflow-y-auto shadow-2xl"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-violet-500/20">
                  <div className="flex items-center gap-2 text-fuchsia-300 text-xs font-bold uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Módulo Directivo</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerAbierto(null)
                      setUsuarioSeleccionado(null)
                    }}
                    className="p-2 rounded-xl bg-violet-950 hover:bg-violet-900 text-violet-200 cursor-pointer transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {drawerAbierto === 'institucion' && (
                  <form onSubmit={guardarConfigInstitucion} className="mt-6 space-y-4">
                    <h3 className="text-xl font-extrabold text-white">Identidad Institucional</h3>
                    <p className="text-xs text-violet-200/80">
                      Estos datos aparecen en los certificados oficiales, nóminas y encabezados del panel.
                    </p>
                    <div>
                      <label className={labelCls}>Nombre de la Institución</label>
                      <input
                        name="nombreInstitucion"
                        required
                        defaultValue={configInst.nombreInstitucion}
                        placeholder="Ej. Unidad Educativa Martin Lutero"
                        className={inputCls}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className={labelCls}>Código AMIE</label>
                        <input
                          name="codigoAmie"
                          required
                          defaultValue={configInst.codigoAmie}
                          placeholder="09H00000"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Ciudad de Emisión</label>
                        <input
                          name="ciudadEmision"
                          required
                          defaultValue={configInst.ciudadEmision}
                          placeholder="Guayaquil"
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Cargo de Quien Certifica</label>
                      <input
                        name="cargoFirma"
                        required
                        defaultValue={configInst.cargoFirma}
                        placeholder="Dirección Académica / Rectorado"
                        className={inputCls}
                      />
                    </div>
                    <button type="submit" className={btnCls}>
                      Guardar Identidad Institucional
                    </button>
                  </form>
                )}

                {drawerAbierto === 'periodo' && (
                  <form onSubmit={(e) => ejecutarAccion(crearPeriodo, e)} className="mt-6 space-y-4">
                    <h3 className="text-xl font-extrabold text-white">Apertura de Periodo Lectivo</h3>
                    <div>
                      <label className={labelCls}>Nombre del Periodo</label>
                      <input name="nombre" required placeholder="" className={inputCls} />
                    </div>
                    <label className="flex items-center gap-2.5 text-sm text-violet-200 cursor-pointer font-medium">
                      <input type="checkbox" name="activo" defaultChecked className="w-4 h-4 accent-fuchsia-500 rounded" />
                      <span>Definir como periodo activo institucional</span>
                    </label>
                    <button disabled={cargando} className={btnCls}>
                      {cargando ? 'Procesando...' : 'Registrar Periodo'}
                    </button>
                  </form>
                )}

                {drawerAbierto === 'curso' && (
                  <form onSubmit={(e) => ejecutarAccion(crearCurso, e)} className="mt-6 space-y-4">
                    <h3 className="text-xl font-extrabold text-white">Creación de Curso y Paralelo</h3>
                    <div>
                      <label className={labelCls}>Periodo Lectivo</label>
                      <select name="periodo_id" required className={inputCls}>
                        <option value="">Seleccione el periodo...</option>
                        {periodos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} {p.activo ? '(Vigente)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Denominación del Curso</label>
                      <input name="nombre" required placeholder="" className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className={labelCls}>Paralelo</label>
                        <input name="paralelo" required maxLength={5} placeholder="" className={`${inputCls} uppercase`} />
                      </div>
                      <div>
                        <label className={labelCls}>Cupo Máximo</label>
                        <input type="number" name="cupo_maximo" required min={1} max={100} defaultValue={35} className={inputCls} />
                      </div>
                    </div>
                    <button disabled={cargando} className={btnCls}>
                      {cargando ? 'Procesando...' : 'Guardar Curso'}
                    </button>
                  </form>
                )}

                {drawerAbierto === 'usuario' && (
                  <form onSubmit={(e) => ejecutarAccion(crearUsuario, e)} className="mt-6 space-y-3.5">
                    <h3 className="text-xl font-extrabold text-white">Registro de Personal Académico o Alumnado</h3>
                    <div>
                      <label className={labelCls}>Rol Institucional</label>
                      <select name="rol" required className={inputCls}>
                        <option value="estudiante">Estudiante</option>
                        <option value="profesor">Docente</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Número de Cédula</label>
                      <input name="cedula" required maxLength={10} placeholder="" className={inputCls} />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className={labelCls}>Nombres</label>
                        <input name="nombres" required placeholder="" className={inputCls} />
                      </div>
                      <div>
                        <label className={labelCls}>Apellidos</label>
                        <input name="apellidos" required placeholder="" className={inputCls} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Correo Electrónico Institucional</label>
                      <input type="email" name="email" required placeholder="usuario@colegio.edu.ec" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Contraseña Temporal</label>
                      <input type="text" name="password" required minLength={6} placeholder="Mínimo 6 caracteres" className={inputCls} />
                    </div>
                    <div className="pt-2 border-t border-violet-500/20 space-y-2.5">
                      <p className="text-xs font-bold text-fuchsia-300 uppercase tracking-wider">
                        Datos del Representante Legal
                      </p>
                      <input name="representante_nombre" placeholder="Nombres y apellidos" className={inputCls} />
                      <div className="grid grid-cols-2 gap-2.5">
                        <input name="representante_cedula" maxLength={10} placeholder="Número de cédula" className={inputCls} />
                        <input name="representante_telefono" placeholder="Teléfono de contacto" className={inputCls} />
                      </div>
                      <input name="parentesco" placeholder="Parentesco" className={inputCls} />
                    </div>
                    <button disabled={cargando} className={btnCls}>
                      {cargando ? 'Procesando...' : 'Crear Cuenta'}
                    </button>
                  </form>
                )}

                {drawerAbierto === 'editarUsuario' && usuarioSeleccionado && (
                  <form onSubmit={(e) => ejecutarAccion(actualizarUsuario, e)} className="mt-6 space-y-3.5">
                    <h3 className="text-xl font-extrabold text-white">Actualizar Datos de Usuario</h3>
                    <input type="hidden" name="id" value={usuarioSeleccionado.id} />
                    <div>
                      <label className={labelCls}>Número de Cédula</label>
                      <input
                        name="cedula"
                        required
                        maxLength={10}
                        defaultValue={usuarioSeleccionado.cedula}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Nombres</label>
                      <input
                        name="nombres"
                        required
                        defaultValue={usuarioSeleccionado.nombres}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Apellidos</label>
                      <input
                        name="apellidos"
                        required
                        defaultValue={usuarioSeleccionado.apellidos}
                        className={inputCls}
                      />
                    </div>
                    <div className="pt-2 border-t border-violet-500/20 space-y-2.5">
                      <p className="text-xs font-bold text-fuchsia-300 uppercase tracking-wider">
                        Datos del Representante Legal
                      </p>
                      <input
                        name="representante_nombre"
                        defaultValue={usuarioSeleccionado.representante_nombre || ''}
                        placeholder="Nombres y apellidos"
                        className={inputCls}
                      />
                      <div className="grid grid-cols-2 gap-2.5">
                        <input
                          name="representante_cedula"
                          maxLength={10}
                          defaultValue={usuarioSeleccionado.representante_cedula || ''}
                          placeholder="Número de cédula"
                          className={inputCls}
                        />
                        <input
                          name="representante_telefono"
                          defaultValue={usuarioSeleccionado.representante_telefono || ''}
                          placeholder="Teléfono de contacto"
                          className={inputCls}
                        />
                      </div>
                      <input
                        name="parentesco"
                        defaultValue={usuarioSeleccionado.parentesco || ''}
                        placeholder="Parentesco"
                        className={inputCls}
                      />
                    </div>
                    <button disabled={cargando} className={btnCls}>
                      {cargando ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                  </form>
                )}

                {drawerAbierto === 'claveUsuario' && usuarioSeleccionado && (
                  <form onSubmit={(e) => ejecutarAccion(restablecerClaveUsuario, e)} className="mt-6 space-y-4">
                    <h3 className="text-xl font-extrabold text-white">Restablecer Contraseña</h3>
                    <p className="text-xs text-violet-200/80">
                      Usuario: <strong>{usuarioSeleccionado.apellidos} {usuarioSeleccionado.nombres}</strong>
                    </p>
                    <input type="hidden" name="id" value={usuarioSeleccionado.id} />
                    <div>
                      <label className={labelCls}>Nueva Contraseña</label>
                      <input
                        type="text"
                        name="nueva_clave"
                        required
                        minLength={6}
                        placeholder="Mínimo 6 caracteres"
                        className={inputCls}
                      />
                    </div>
                    <button disabled={cargando} className={btnCls}>
                      {cargando ? 'Actualizando...' : 'Actualizar Contraseña'}
                    </button>
                  </form>
                )}

                {drawerAbierto === 'materia' && (
                  <form onSubmit={(e) => ejecutarAccion(crearMateria, e)} className="mt-6 space-y-4">
                    <h3 className="text-xl font-extrabold text-white">Asignación de Carga Académica</h3>
                    <div>
                      <label className={labelCls}>Asignatura</label>
                      <input name="nombre" required placeholder="" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Curso Destino</label>
                      <select name="curso_id" required className={inputCls}>
                        <option value="">Seleccione el curso...</option>
                        {cursos.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre} "{c.paralelo}"
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Docente Responsable</label>
                      <select name="profesor_id" required className={inputCls}>
                        <option value="">Seleccione el docente...</option>
                        {profesores.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.apellidos} {p.nombres}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button disabled={cargando} className={btnCls}>
                      {cargando ? 'Procesando...' : 'Confirmar Asignación'}
                    </button>
                  </form>
                )}

                {drawerAbierto === 'matricula' && (
                  <form onSubmit={(e) => ejecutarAccion(matricularEstudiante, e)} className="mt-6 space-y-4">
                    <h3 className="text-xl font-extrabold text-white">Proceso de Matriculación</h3>
                    <div>
                      <label className={labelCls}>Estudiante</label>
                      <select
                        name="estudiante_id"
                        required
                        value={estudianteDestinoMatricula}
                        onChange={(e) => setEstudianteDestinoMatricula(e.target.value)}
                        className={inputCls}
                      >
                        <option value="">Seleccione el estudiante...</option>
                        {estudiantes.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.apellidos} {e.nombres} ({e.cedula})
                          </option>
                        ))}
                      </select>
                    </div>

                    {matriculaExistenteEstudiante && (
                      <div className="rounded-xl bg-amber-950/60 border border-amber-400/40 p-3 text-xs text-amber-200">
                        Este estudiante ya consta matriculado en{' '}
                        <strong>
                          {matriculaExistenteEstudiante.cursos?.nombre || ''} "
                          {matriculaExistenteEstudiante.cursos?.paralelo || ''}"
                        </strong>
                        .
                      </div>
                    )}

                    <div>
                      <label className={labelCls}>Curso de Destino</label>
                      <select
                        name="curso_id"
                        required
                        value={cursoDestinoMatricula}
                        onChange={(e) => setCursoDestinoMatricula(e.target.value)}
                        className={inputCls}
                      >
                        <option value="">Seleccione el curso...</option>
                        {cursosEnriquecidos.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre} "{c.paralelo}" ({c.cuposDisponibles} cupos libres)
                          </option>
                        ))}
                      </select>
                    </div>

                    {cursoSeleccionadoMatricula && (
                      <div className="rounded-xl bg-violet-950/60 border border-violet-400/30 p-3 text-xs text-violet-200 flex items-center justify-between">
                        <span>Ocupación del paralelo:</span>
                        <strong className="text-cyan-300">
                          {cursoSeleccionadoMatricula.alumnos.length} / {cursoSeleccionadoMatricula.cupoMax} ({cursoSeleccionadoMatricula.cuposDisponibles} libres)
                        </strong>
                      </div>
                    )}

                    <button disabled={cargando} className={btnCls}>
                      {cargando ? 'Procesando...' : 'Efectivizar Matrícula'}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}