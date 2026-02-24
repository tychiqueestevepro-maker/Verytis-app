import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
    const sql = fs.readFileSync('supabase/migrations/20260221124600_fix_rls_visibility.sql', 'utf8');

    console.log('Applying RLS Visibility Fix...');

    // Supabase REST API doesn't support raw SQL easily unless we have an RPC
    // However, for this specific workspace, we might have a helper or we have to ask the user.
    // Let's try to use the 'rpc' if a 'exec_sql' exists, or just tell the user.

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        if (error.message.includes('function "exec_sql" does not exist')) {
            console.warn('❌ RPC "exec_sql" not found. Please apply the migration manually in the Supabase Dashboard:');
            console.log('--- SQL START ---');
            console.log(sql);
            console.log('--- SQL END ---');
        } else {
            console.error('Error applying migration:', error);
        }
    } else {
        console.log('✅ Migration applied successfully!');
    }
}

applyMigration();
