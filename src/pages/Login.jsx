import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInWithDNI } from '../lib/supabase'
import { Activity, Lock } from 'lucide-react'

export default function Login() {
    const [dni, setDni] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const navigate = useNavigate()

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const { data, error } = await signInWithDNI(dni)

            if (error) throw error

            if (data.user) {
                navigate('/dashboard')
            }
        } catch (err) {
            console.error(err)
            setError('No se encontró un usuario activo con este DNI.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative">
            {/* Decorative background elements already in body/index.css */}

            <div className="glass-panel w-full max-w-md p-8 animate-slide-up relative z-10">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-primary/20 text-brand-accent mb-4">
                        <Activity className="w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">Dosimetría</h1>
                    <p className="text-slate-400">Portal de Consulta de Lecturas</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label htmlFor="dni" className="text-sm font-medium text-slate-300 ml-1">
                            Documento de Identidad (DNI)
                        </label>
                        <div className="relative">
                            <input
                                id="dni"
                                type="text"
                                value={dni}
                                onChange={(e) => setDni(e.target.value)}
                                placeholder="Ingrese su DNI"
                                className="input-primary pl-10"
                                required
                                maxLength={20}
                            />
                            <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-3.5" />
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200 text-sm text-center animate-fade-in">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Verificando...</span>
                            </>
                        ) : (
                            <span>Ingresar al Sistema</span>
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center text-xs text-slate-500">
                    Acceso exclusivo para personal autorizado
                </div>
            </div>
        </div>
    )
}
