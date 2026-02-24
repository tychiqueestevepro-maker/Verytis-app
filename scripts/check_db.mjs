import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
    console.log('--- DB DIAGNOSTIC ---');

    // Check enum values
    const { data: enumValues, error: eErr } = await supabase.rpc('exec_sql', {
        sql_query: "SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'connection_provider';"
    });

    if (eErr) {
        // If exec_sql fails, try another way or just try to insert and catch error
        console.log('exec_sql not available, testing via dummy insert...');
        const testProviders = ['slack', 'github', 'trello', 'teams', 'microsoft_teams'];
        for (const p of testProviders) {
            const { error } = await supabase.from('integrations').insert({
                organization_id: '00000000-0000-0000-0000-000000000000', // Dummy
                provider: p,
                name: 'test'
            }).select();
            console.log(`Provider "${p}": ${error ? 'FAIL: ' + error.message : 'SUCCESS'}`);
        }
    } else {
        console.log('Allowed connection_providers:', enumValues.map(v => v.enumlabel).join(', '));
    }
}

checkSchema().catch(console.error);
