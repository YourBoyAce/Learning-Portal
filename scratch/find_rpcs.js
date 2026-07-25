const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient('https://rqeqcwlchxfboqtghkko.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZXFjd2xjaHhmYm9xdGdoa2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQxMjkwMSwiZXhwIjoyMDkxOTg4OTAxfQ.r_xSaO_xgu9wmZPFGNhmlL2H1U7I2tejbb3pldBt8qI');
  try {
    // List function names from pg_catalog.pg_proc that are exposed to postgrest
    // Normally, postgrest exposes them in the `public` schema. We can query pg_proc by joining with pg_namespace
    // But since we can't query pg_proc directly via from('pg_proc'), let's see if we can do an RPC call to a pg_catalog function or list functions.
    // Let's try to query information_schema.routines
    const { data: routines, error } = await supabase.from('information_schema.routines').select('routine_name').eq('routine_schema', 'public');
    console.log('Routines error:', error);
    console.log('Routine list:', routines);
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
