import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TABLES_TO_WIPE = [
    'report_deliveries',
    'monthly_reports',
    'daily_team_reports',
    'weekly_team_reports',
    'decisions',
    'activity_logs',
    'monitored_resources',
    'integrations',
    'user_permissions',
    'team_members',
    'teams',
    'connections',
    'ai_agents'
];

async function resetDatabase() {
    console.log('--- STARTING FULL DATABASE WIPE ---');

    // 1. Wipe all relational tables
    for (const table of TABLES_TO_WIPE) {
        console.log(`Wiping table: ${table}...`);
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete everything
        if (error) console.error(`Error wiping ${table}:`, error.message);
    }

    // 2. Identify the primary admin to save them
    const ADMIN_EMAIL = 'tychiqueesteve2005@gmail.com';
    console.log(`Identifying admin profile: ${ADMIN_EMAIL}...`);
    const { data: adminProfile } = await supabase.from('profiles').select('id, organization_id').eq('email', ADMIN_EMAIL).single();

    // 3. Delete all other profiles
    console.log('Deleting other profiles...');
    if (adminProfile) {
        const { error: pDeleteErr } = await supabase.from('profiles').delete().neq('id', adminProfile.id);
        if (pDeleteErr) console.error('Error deleting profiles:', pDeleteErr.message);
    } else {
        const { error: pDeleteErr } = await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (pDeleteErr) console.error('Error deleting profiles:', pDeleteErr.message);
    }

    // 4. Wipe Organizations
    console.log('Wiping organizations...');
    const { error: orgDeleteErr } = await supabase.from('organizations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (orgDeleteErr) console.error('Error wiping organizations:', orgDeleteErr.message);

    // 5. Create Fresh Organization
    console.log('Creating fresh organization: Verytis...');
    const { data: newOrg, error: newOrgErr } = await supabase.from('organizations').insert({
        name: 'Verytis',
        slug: 'verytis',
        domain: 'verytis.com'
    }).select().single();

    if (newOrgErr) {
        console.error('Failed to create new organization:', newOrgErr.message);
        return;
    }

    // 6. Link Admin to New Organization
    if (adminProfile) {
        console.log(`Linking admin ${ADMIN_EMAIL} to new organization...`);
        const { error: linkErr } = await supabase.from('profiles').update({
            organization_id: newOrg.id,
            role: 'admin',
            status: 'active',
            full_name: 'Admin Verytis'
        }).eq('id', adminProfile.id);

        if (linkErr) console.error('Error linking admin:', linkErr.message);
        else console.log('Admin linked successfully.');
    } else {
        console.log('Admin profile not found. Please log in to create a new profile.');
    }

    console.log('--- RESET COMPLETE ---');
    console.log(`New Organization ID: ${newOrg.id}`);
}

resetDatabase().catch(console.error);
