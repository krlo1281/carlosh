import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' } })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('No Authorization header')

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        // 1. Get the date of the very last reading for this user
        const { data: latestReading, error: latestError } = await supabase
            .from('readings')
            .select('reading_date')
            .eq('assignments.user_id', user.id) // Query via assignment relation? No, reading->assignment->user
            // Wait, filtering deeply nested is hard. Let's filter by assignments user_id first?
            // Easier: Get all assignments for user -> Get readings for those assignments -> Order by reading_date desc limit 1.
            // Actually, supabase allows mapping: .select('reading_date, assignments!inner(user_id)').eq('assignments.user_id', user.id).order...
            .select(`
            reading_date,
            assignments!inner ( user_id )
        `)
            .eq('assignments.user_id', user.id)
            .order('reading_date', { ascending: false })
            .limit(1)
            .single();

        // If no readings, return empty report.
        // If error (e.g. no rows), handle gracefully.

        let targetYear = new Date().getFullYear();
        if (latestReading?.reading_date) {
            targetYear = new Date(latestReading.reading_date).getFullYear();
        }

        // 2. Fetch all readings for that Year
        const startOfYear = new Date(`${targetYear}-01-01T00:00:00.000Z`);
        const endOfYear = new Date(`${targetYear}-12-31T23:59:59.999Z`);

        // Fetch Profile for Name
        const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single();

        const userName = profile?.full_name || user.email;

        const { data: readings, error: dbError } = await supabase
            .from('readings')
            .select(`
            hp10_msv, 
            hp007_msv, 
            reading_date, 
            assignments!inner (
                period,
                dosimeters (code)
            )
        `)
            .eq('assignments.user_id', user.id)
            .gte('reading_date', startOfYear.toISOString())
            .lte('reading_date', endOfYear.toISOString())
            .order('reading_date', { ascending: false });

        if (dbError) throw new Error("Database Error: " + dbError.message);

        let reportText = `REPORTE DE DOSIMETRIA\n`;
        reportText += `Usuario: ${userName}\n`;
        reportText += `Fecha de Emisión: ${new Date().toLocaleDateString()}\n`;
        reportText += `Periodo Reportado: ${targetYear}\n`;
        reportText += `------------------------------------------------------------\n`;
        reportText += `PERIODO            DOSIMETRO   Hp(10)  Hp(0.07)  FECHA\n`;
        reportText += `------------------------------------------------------------\n`;

        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        if (!readings || readings.length === 0) {
            reportText += "No se encontraron lecturas en este periodo.\n";
        } else {
            readings.forEach((r: any) => {
                let periodDisplay = "N/A";
                if (r.assignments?.period) {
                    const pDate = new Date(r.assignments.period + 'T12:00:00');
                    if (!isNaN(pDate.getTime())) {
                        const monthName = months[pDate.getUTCMonth()];
                        const year = pDate.getUTCFullYear();
                        periodDisplay = `${monthName} ${year}`;
                    } else {
                        periodDisplay = r.assignments.period;
                    }
                }

                const periodCol = periodDisplay.padEnd(18, ' ');
                const code = (r.assignments?.dosimeters?.code || "N/A").padEnd(10, ' ');
                const hp10 = (r.hp10_msv?.toFixed(2) || "0.00").padStart(6, ' ');
                const hp007 = (r.hp007_msv?.toFixed(2) || "0.00").padStart(8, ' ');
                const date = r.reading_date ? new Date(r.reading_date).toLocaleDateString() : "-";
                reportText += `${periodCol} ${code}  ${hp10}  ${hp007}  ${date}\n`;
            });
        }

        reportText += `\n------------------------------------------------------------\n`;
        reportText += `Fin del Reporte\n`; // - Requires import map configuration)`; // This comment was part of the instruction, but seems like a typo in the instruction itself. Keeping the line as `Fin del Reporte\n`;

        return new Response(reportText, {
            headers: { "Content-Type": "text/plain" },
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
})
