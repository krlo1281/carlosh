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

            let filteredReadings = readingsData || []

            // Filter by Latest Year logic
            if (filteredReadings.length > 0) {
                // Find latest reading date
                // Since it's ordered desc, the first one is the latest
                const latestDateStr = filteredReadings[0].reading_date
                if (latestDateStr) {
                    const latestYear = new Date(latestDateStr).getFullYear()

                    filteredReadings = filteredReadings.filter(r => {
                        if (!r.reading_date) return false
                        return new Date(r.reading_date).getFullYear() === latestYear
                    })
                }
            }

            setReadings(filteredReadings)

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
            // Invoke Edge Function for Annual Report
            const { data, error } = await supabase.functions.invoke('generate-report', {
                body: {}, // No specific period needed, it defaults to annual logic
            })

            if (error) {
                // Show real error
                const msg = error.message || error.toString() || 'Error desconocido';
                alert(`Error al generar reporte: ${msg}`);
                console.error(error)
                return
            }

            // Create a Blob from the data
            // Note: Since data is string (text/plain) from our simplified function, we treat it as text.
            // If it were a real PDF, we would need responseType: 'blob' in invoke options.
            const blob = new Blob([data], { type: 'text/plain' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `reporte-anual-${format(new Date(), 'yyyy')}.txt`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

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
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10 text-sm">
                                {readings.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-400">
                                            No hay lecturas registradas en el sistema.
                                        </td>
                                    </tr>
                                ) : (
                                    readings.map((reading) => (
                                        <tr key={reading.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 font-medium text-white flex items-center gap-2 capitalize">
                                                <Calendar className="w-4 h-4 text-brand-primary" />
                                                {reading.assignments?.period
                                                    ? format(new Date(reading.assignments.period), 'MMMM yyyy', { locale: es })
                                                    : 'N/A'}
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
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Global Actions */}
                <div className="flex justify-end animate-slide-up" style={{ animationDelay: '100ms' }}>
                    <button
                        onClick={() => handleDownloadReport()}
                        disabled={downloading}
                        className="btn-primary flex items-center gap-2 px-6 py-3 shadow-lg shadow-brand-primary/20 hover:shadow-brand-primary/40 transition-all"
                    >
                        {downloading ? (
                            <Activity className="w-5 h-5 animate-spin" />
                        ) : (
                            <Download className="w-5 h-5" />
                        )}
                        <span>Descargar Reporte Anual</span>
                    </button>
                </div>
            </main>
        </div>
    )
}
