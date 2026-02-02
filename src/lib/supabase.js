import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://pozaayfqgijdqkrzfadj.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvemFheWZxZ2lqZHFrcnpmYWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MTA2NDgsImV4cCI6MjA4NTQ4NjY0OH0.2yqX1AEKsLSHFyAXIEL8bhzSsTxDqvK5mxuzgjJLl58'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Helper for DNI-only login strategy
export const signInWithDNI = async (dni) => {
    const email = `${dni}@dosimetria.local`
    const password = dni // Using DNI as password for simplified "passwordless" experience

    return await supabase.auth.signInWithPassword({
        email,
        password,
    })
}

// Helper to sign out
export const signOut = async () => {
    return await supabase.auth.signOut()
}
