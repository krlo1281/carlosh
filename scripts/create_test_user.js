// Script to create test user using Supabase Admin API
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pozaayfqgijdqkrzfadj.supabase.co'
// NOTE: This requires the SERVICE_ROLE_KEY (admin key), not the anon key
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseServiceKey) {
    console.error('ERROR: SUPABASE_SERVICE_KEY environment variable is required')
    console.log('Usage: SUPABASE_SERVICE_KEY=your_service_role_key node scripts/create_test_user.js')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function createTestUser() {
    const dni = '12345678'
    const email = `${dni}@dosimetria.local`
    const password = dni
    const fullName = 'Guillermo Yaya Castañeda'

    try {
        // 1. Create auth user
        console.log('Creating auth user...')
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName
            }
        })

        if (authError) throw authError

        console.log('✓ Auth user created:', authData.user.id)

        // 2. Create profile
        console.log('Creating profile...')
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: authData.user.id,
                dni: dni,
                full_name: fullName
            })

        if (profileError) throw profileError

        console.log('✓ Profile created')

        // 3. Create dosimeters
        console.log('Creating dosimeters...')
        const dosimeters = [
            { code: 'DOS-TEST-001', status: 'active' },
            { code: 'DOS-TEST-002', status: 'active' },
            { code: 'DOS-TEST-003', status: 'active' },
            { code: 'DOS-TEST-004', status: 'active' },
            { code: 'DOS-TEST-005', status: 'active' }
        ]

        const { data: dosimeterData, error: dosimeterError } = await supabase
            .from('dosimeters')
            .insert(dosimeters)
            .select()

        if (dosimeterError) {
            // Check if it's a duplicate error
            if (dosimeterError.code === '23505') {
                console.log('⚠ Dosimeters already exist, fetching existing ones...')
                const { data: existing } = await supabase
                    .from('dosimeters')
                    .select('*')
                    .in('code', dosimeters.map(d => d.code))
                    .order('id')

                dosimeterData = existing
            } else {
                throw dosimeterError
            }
        }

        console.log('✓ Dosimeters ready:', dosimeterData.length)

        // 4. Create assignments (8 months)
        console.log('Creating assignments...')
        const assignments = [
            { period: '2025-06-01', dosimeter_id: dosimeterData[0].id, user_id: authData.user.id },
            { period: '2025-07-01', dosimeter_id: dosimeterData[1].id, user_id: authData.user.id },
            { period: '2025-08-01', dosimeter_id: dosimeterData[2].id, user_id: authData.user.id },
            { period: '2025-09-01', dosimeter_id: dosimeterData[0].id, user_id: authData.user.id }, // Repeat
            { period: '2025-10-01', dosimeter_id: dosimeterData[3].id, user_id: authData.user.id },
            { period: '2025-11-01', dosimeter_id: dosimeterData[1].id, user_id: authData.user.id }, // Repeat
            { period: '2025-12-01', dosimeter_id: dosimeterData[4].id, user_id: authData.user.id },
            { period: '2026-01-01', dosimeter_id: dosimeterData[2].id, user_id: authData.user.id }  // Repeat
        ]

        const { data: assignmentData, error: assignmentError } = await supabase
            .from('assignments')
            .insert(assignments)
            .select()

        if (assignmentError) throw assignmentError

        console.log('✓ Assignments created:', assignmentData.length)

        // 5. Create readings
        console.log('Creating readings...')
        const readings = assignmentData.map((assignment, idx) => {
            const date = new Date(assignment.period)
            date.setDate(15) // 15th of each month

            return {
                assignment_id: assignment.id,
                hp10_msv: (Math.random() * 2.45 + 0.05).toFixed(4),
                hp007_msv: (Math.random() * 1.77 + 0.03).toFixed(4),
                reading_date: date.toISOString().split('T')[0],
                notes: 'Lectura de prueba - Usuario test'
            }
        })

        const { data: readingData, error: readingError } = await supabase
            .from('readings')
            .insert(readings)
            .select()

        if (readingError) throw readingError

        console.log('✓ Readings created:', readingData.length)

        console.log('\n✅ Test user created successfully!')
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        console.log('📧 EMAIL:', email)
        console.log('🔑 DNI:', dni)
        console.log('🔐 PASSWORD:', password)
        console.log('👤 NAME:', fullName)
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    } catch (error) {
        console.error('❌ Error creating test user:', error)
        process.exit(1)
    }
}

createTestUser()
