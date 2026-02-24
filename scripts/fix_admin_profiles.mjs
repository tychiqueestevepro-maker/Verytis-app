import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const s = createClient(supabaseUrl, supabaseKey);

async function run() {
    const emails = [
        'tychiqueesteve2005@gmail.com',
        'tychique.ads@gmail.com',
        'tychiquetiktok@gmail.com',
        'tychique.estevepro@gmail.com',
        'tychiqueesteve2005@gmal.com'
    ];

    const { data: org } = await s.from('organizations').select('id').limit(1).single();
    if (!org) {
        console.error('No organization found in DB.');
        return;
    }
    console.log('Target Organization:', org.id);

    const { data: { users } } = await s.auth.admin.listUsers();

    for (const email of emails) {
        const user = users.find(u => u.email === email);
        if (user) {
            console.log(`Working on ${email} (Auth ID: ${user.id})...`);
            const { error } = await s.from('profiles').upsert({
                id: user.id,
                email: email,
                organization_id: org.id,
                full_name: 'Tychique Esteve',
                role: 'admin',
                status: 'active'
            }, { onConflict: 'id' });

            if (error) console.error(`Failed to upsert ${email}:`, error.message);
            else console.log(`Successfully linked ${email}`);
        }
    }
}

run().catch(console.error);
