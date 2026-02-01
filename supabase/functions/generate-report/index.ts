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

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

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
            .gte('reading_date', oneYearAgo.toISOString())
            .order('reading_date', { ascending: false });

        if (dbError) throw new Error("Database Error: " + dbError.message);

        let reportText = `REPORTE ANUAL DE DOSIMETRIA\n`;
        reportText += `Usuario: ${user.email}\n`;
        reportText += `Fecha de Emisión: ${new Date().toLocaleDateString()}\n`;
        reportText += `Periodo: Últimos 12 meses\n`;
        reportText += `------------------------------------------------------------\n`;
        reportText += `PERIODO       DOSIMETRO   Hp(10)  Hp(0.07)  FECHA\n`;
        reportText += `------------------------------------------------------------\n`;

        if (!readings || readings.length === 0) {
            reportText += "No se encontraron lecturas en este periodo.\n";
        } else {
            readings.forEach((r: any) => {
                const period = (r.assignments?.period || "N/A").padEnd(12, ' ');
                const code = (r.assignments?.dosimeters?.code || "N/A").padEnd(10, ' ');
                const hp10 = (r.hp10_msv?.toFixed(2) || "0.00").padStart(6, ' ');
                const hp007 = (r.hp007_msv?.toFixed(2) || "0.00").padStart(8, ' ');
                const date = r.reading_date ? new Date(r.reading_date).toLocaleDateString() : "-";
                reportText += `${period}  ${code}  ${hp10}  ${hp007}  ${date}\n`;
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
