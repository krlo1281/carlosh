import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, signOut } from '../lib/supabase'
import { LogOut, FileText, Activity, Calendar, Download } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Dashboard() {
    const [user, setUser] = useState(null)
    const [profile, setProfile] = useState(null)
    const [readings, setReadings] = useState([])
    const [loading, setLoading] = useState(true)
    const [downloading, setDownloading] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                navigate('/')
                return
            }
            setUser(user)

            // Get Profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()

            setProfile(profile)

            // Get Readings
            const { data: readingsData, error } = await supabase
                .from('readings')
                .select(`
          id,
          hp10_msv,
          hp007_msv,
          reading_date,
          notes,
          assignments (
            period,
            dosimeters (code)
          )
        `)
                // Sort by assignment period descending effectively
                .order('reading_date', { ascending: false })

            if (error) throw error
            setReadings(readingsData || [])

        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = async () => {
        await signOut()
        navigate('/')
    }

    const handleDownloadReport = async (period) => {
        setDownloading(period)
        try {
            // Invoke Edge Function
            const { data, error } = await supabase.functions.invoke('generate-report', {
                body: { period },
            })

            if (error) {
                // Fallback for demo if function is not deployed: Alert user
                alert('El servicio de reporte PDF no está disponible en esta demostración. (Error: Function not found)')
                console.error(error)
                return
            }

            // Assuming function returns base64 or blob. Standard is defined in logic.
            // If we receive a blob directly:
            // const blob = data; 

            // Since we haven't implemented the function yet, this is a placeholder behavior.
            console.log('Report generated', data)

        } catch (err) {
            console.error('Download error:', err)
        } finally {
            setDownloading(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-brand-accent">
                <Activity className="w-10 h-10 animate-spin" />
            </div>
        )
    }

    return (
        <div className="min-h-screen">
            {/* Navbar */}
            <nav className="glass-panel rounded-none border-x-0 border-t-0 px-6 py-4 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-brand-primary/20 rounded-lg text-brand-accent">
                            <Activity className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg leading-tight">Dosimetría</h1>
                            <p className="text-xs text-slate-400">Panel de Usuario</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:block text-right">
                            <p className="text-sm font-medium text-white">{profile?.full_name || 'Usuario'}</p>
                            <p className="text-xs text-slate-400">{profile?.dni}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-300 hover:text-white"
                            title="Cerrar Sesión"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
                {/* Welcome Section */}
                <div className="glass-panel p-6 animate-fade-in">
                    <h2 className="text-2xl font-semibold mb-2">Historial de Lecturas</h2>
                    <p className="text-slate-400">
                        A continuación se detallan las lecturas dosimétricas registradas.
                    </p>
                </div>

                {/* Readings Table */}
                <div className="glass-panel overflow-hidden animate-slide-up">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 bg-white/5 text-xs text-slate-400 uppercase tracking-wider">
                                    <th className="p-4 font-semibold">Periodo</th>
                                    <th className="p-4 font-semibold">Dosímetro</th>
                                    <th className="p-4 font-semibold text-right">Hp(10) <span className="text-xs normal-case opacity-70">mSv</span></th>
                                    <th className="p-4 font-semibold text-right">Hp(0.07) <span className="text-xs normal-case opacity-70">mSv</span></th>
                                    <th className="p-4 font-semibold">Fecha Lectura</th>
                                    <th className="p-4 font-semibold text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10 text-sm">
                                {readings.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-400">
                                            No hay lecturas registradas en el sistema.
                                        </td>
                                    </tr>
                                ) : (
                                    readings.map((reading) => (
                                        <tr key={reading.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 font-medium text-white flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-brand-primary" />
                                                {reading.assignments?.period}
                                            </td>
                                            <td className="p-4 text-slate-300">
                                                <span className="bg-slate-800 px-2 py-1 rounded text-xs font-mono">
                                                    {reading.assignments?.dosimeters?.code}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right font-mono text-brand-accent">
                                                {reading.hp10_msv?.toFixed(2)}
                                            </td>
                                            <td className="p-4 text-right font-mono text-slate-300">
                                                {reading.hp007_msv?.toFixed(2)}
                                            </td>
                                            <td className="p-4 text-slate-400">
                                                {reading.reading_date ? format(new Date(reading.reading_date), 'dd/MM/yyyy') : '-'}
                                            </td>
                                            <td className="p-4 text-center">
                                                <button
                                                    onClick={() => handleDownloadReport(reading.assignments?.period)}
                                                    disabled={downloading === reading.assignments?.period}
                                                    className="p-2 hover:bg-brand-primary/20 text-brand-primary rounded-lg transition-colors disabled:opacity-50"
                                                    title="Descargar Informe PDF"
                                                >
                                                    {downloading === reading.assignments?.period ? (
                                                        <Activity className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <FileText className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    )
}
