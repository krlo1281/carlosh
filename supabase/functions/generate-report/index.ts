import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1'

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

        // Create PDF Document
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        let y = height - 50;
        const fontSize = 12;
        const lineHeight = 18;

        // Title
        page.drawText('REPORTE DE DOSIMETRÍA', { x: 50, y, size: 18, font: fontBold });
        y -= 30;

        // User Info
        page.drawText(`Usuario: ${userName}`, { x: 50, y, size: fontSize, font });
        y -= lineHeight;
        page.drawText(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, { x: 50, y, size: fontSize, font });
        y -= lineHeight;
        page.drawText(`Periodo Reportado: ${targetYear}`, { x: 50, y, size: fontSize, font });
        y -= 25;

        // Divider
        page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1 });
        y -= 20;

        // Table Header
        page.drawText('PERIODO', { x: 50, y, size: 10, font: fontBold });
        page.drawText('DOSÍMETRO', { x: 160, y, size: 10, font: fontBold });
        page.drawText('Hp(10)', { x: 270, y, size: 10, font: fontBold });
        page.drawText('Hp(0.07)', { x: 340, y, size: 10, font: fontBold });
        page.drawText('FECHA', { x: 420, y, size: 10, font: fontBold });
        y -= 18;

        page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 0.5 });
        y -= 20;

        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        if (!readings || readings.length === 0) {
            page.drawText("No se encontraron lecturas en este periodo.", { x: 50, y, size: 10, font });
            y -= 20;
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

                const code = (r.assignments?.dosimeters?.code || "N/A");
                const hp10 = (r.hp10_msv?.toFixed(2) || "0.00");
                const hp007 = (r.hp007_msv?.toFixed(2) || "0.00");
                const date = r.reading_date ? new Date(r.reading_date).toLocaleDateString() : "-";

                page.drawText(periodDisplay, { x: 50, y, size: 10, font });
                page.drawText(code, { x: 160, y, size: 10, font });
                page.drawText(hp10, { x: 270, y, size: 10, font });
                page.drawText(hp007, { x: 340, y, size: 10, font });
                page.drawText(date, { x: 420, y, size: 10, font });
                y -= 18;
            });
        }

        y -= 20;
        page.drawLine({ start: { x: 50, y }, end: { x: width - 50, y }, thickness: 1 });

        // DISCLAIMER WARNING
        y -= 25;
        page.drawText('ADVERTENCIA: ESTE REPORTE NO ES OFICIAL', {
            x: 50,
            y,
            size: 14,
            font: fontBold,
            color: rgb(0.8, 0, 0)
        });
        y -= 18;
        page.drawText('Este documento es solo para fines informativos y no reemplaza el reporte oficial certificado.', {
            x: 50,
            y,
            size: 9,
            font: font,
            color: rgb(0.5, 0, 0)
        });

        const pdfBytes = await pdfDoc.save();

        return new Response(pdfBytes, {
            headers: {
                "Content-Type": "application/pdf",
                "Access-Control-Allow-Origin": "*"
            },
        })
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
})
