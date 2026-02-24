const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Automated Partition Maintenance
 * Ensures partitions for activity_logs exist for current and next years.
 */
async function maintenance() {
    const currentYear = new Date().getFullYear();
    const yearsToPrepare = [currentYear, currentYear + 1, currentYear + 2];

    console.log(`🚀 Starting Partition Maintenance for years: ${yearsToPrepare.join(', ')}`);

    for (const year of yearsToPrepare) {
        const tableName = `activity_logs_${year}`;
        const startDate = `${year}-01-01`;
        const endDate = `${year + 1}-01-01`;

        const sql = `
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = '${tableName}') THEN
          CREATE TABLE public.${tableName} PARTITION OF public.activity_logs
          FOR VALUES FROM ('${startDate}') TO ('${endDate}');
          RAISE NOTICE 'Partition created for ${year}';
        END IF;
      END $$;
    `;

        const { error } = await supabase.rpc('execute_sql_internal', { sql_query: sql });

        // Note: If execute_sql_internal RPC is not defined, we'd need to run this via psql or 
        // a different secure management channel. 
        if (error) {
            console.error(`❌ Error creating partition for ${year}:`, error.message);
        } else {
            console.log(`✅ Partition check complete for ${year}`);
        }
    }
}

// In case the RPC doesn't exist, we provide the SQL to be run in the Supabase Dashboard
/*
CREATE OR REPLACE FUNCTION execute_sql_internal(sql_query text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;
*/

maintenance();
