const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Usage: node scripts/import_data.js <type> <file>
// type: 'assignments' | 'readings'

const SUPABASE_URL = 'https://pozaayfqgijdqkrzfadj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Must set env var!

if (!SUPABASE_SERVICE_KEY) {
    console.error("Error: SUPABASE_SERVICE_KEY env var is not set.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const type = process.argv[2];
const filePath = process.argv[3];

if (!type || !filePath) {
    console.log("Usage: node scripts/import_data.js <assignments|readings> <csv_file>");
    process.exit(0);
}

const fileContent = fs.readFileSync(filePath, 'utf-8');
const lines = fileContent.split('\n').filter(l => l.trim() !== '');
const headers = lines[0].split(',').map(h => h.trim());

async function processLine(line) {
    const values = line.split(',').map(v => v.trim());
    const row = headers.reduce((acc, header, index) => {
        acc[header] = values[index];
        return acc;
    }, {});

    if (type === 'assignments') {
        // Expected: period, dni, dosimeter_code
        // 1. Get Dosimeter ID
        const { data: dos } = await supabase.from('dosimeters').select('id').eq('code', row.dosimeter_code).single();
        if (!dos) { console.error(`Dosimeter ${row.dosimeter_code} not found`); return; }

        // 2. Get User ID
        const { data: prof } = await supabase.from('profiles').select('id').eq('dni', row.dni).single();
        if (!prof) { console.error(`User DNI ${row.dni} not found`); return; }

        // 3. Insert
        const { error } = await supabase.from('assignments').insert({
            period: row.period, // Format YYYY-MM-DD
            dosimeter_id: dos.id,
            user_id: prof.id
        });
        if (error) console.error(`Error inserting assignment for ${row.dni}:`, error.message);
        else console.log(`Assigned ${row.dosimeter_code} to ${row.dni} for ${row.period}`);

    } else if (type === 'readings') {
        // Expected: period, dosimeter_code, hp10_msv, hp007_msv, reading_date, notes
        // 1. Get Dosimeter ID
        const { data: dos } = await supabase.from('dosimeters').select('id').eq('code', row.dosimeter_code).single();
        if (!dos) { console.error(`Dosimeter not found`); return; }

        // 2. Find Assignment
        const { data: assign } = await supabase.from('assignments')
            .select('id')
            .eq('period', row.period)
            .eq('dosimeter_id', dos.id)
            .single();

        if (!assign) { console.error(`Assignment not found for ${row.dosimeter_code} in ${row.period}`); return; }

        // 3. Insert Reading
        const { error } = await supabase.from('readings').insert({
            assignment_id: assign.id,
            hp10_msv: parseFloat(row.hp10_msv),
            hp007_msv: parseFloat(row.hp007_msv),
            reading_date: row.reading_date,
            notes: row.notes || ''
        });
        if (error) console.error(`Error inserting reading:`, error.message);
        else console.log(`Reading added for ${row.dosimeter_code}`);
    }
}

async function run() {
    for (let i = 1; i < lines.length; i++) {
        await processLine(lines[i]);
    }
}

run();
