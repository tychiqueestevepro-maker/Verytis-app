import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyOrg() {
    console.log('--- Verifying Organization Connection ---');

    // 1. Check Profiles
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, full_name, email, organization_id, role');

    if (pError) {
        console.error('Error fetching profiles:', pError);
    } else {
        console.log('Profiles found:', profiles.length);
        profiles.forEach(p => {
            console.log(`- ${p.full_name} (${p.email}): OrgID=${p.organization_id}, Role=${p.role}`);
        });
    }

    // 2. Check Organizations
    const { data: orgs, error: oError } = await supabase
        .from('organizations')
        .select('*');

    if (oError) {
        console.error('Error fetching organizations:', oError);
    } else {
        console.log('Organizations found:', orgs.length);
        orgs.forEach(o => {
            console.log(`- ${o.name} (${o.id})`);
        });
    }

    // 3. Check Monitored Resources
    const { data: resources, error: rError } = await supabase
        .from('monitored_resources')
        .select('id, name, integration_id');

    if (rError) {
        console.error('Error fetching monitored_resources:', rError);
    } else {
        console.log('Monitored Resources found:', resources.length);
    }

    // 4. Check Integrations
    const { data: integrations, error: iError } = await supabase
        .from('integrations')
        .select('id, provider, organization_id');

    if (iError) {
        console.error('Error fetching integrations:', iError);
    } else {
        console.log('Integrations found:', integrations.length);
        integrations.forEach(i => {
            console.log(`- ${i.provider} (${i.id}): OrgID=${i.organization_id}`);
        });
    }
}

verifyOrg();
