const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient('https://rqeqcwlchxfboqtghkko.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZXFjd2xjaHhmYm9xdGdoa2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQxMjkwMSwiZXhwIjoyMDkxOTg4OTAxfQ.r_xSaO_xgu9wmZPFGNhmlL2H1U7I2tejbb3pldBt8qI');
  try {
    // 1. Inspect batches columns
    const { data: batchSample, error: batchError } = await supabase.from('batches').select('*').limit(1);
    console.log('Batch columns:', batchSample ? Object.keys(batchSample[0] || {}) : null, batchError);

    // 2. See if pg_proc exists as a postgrest table/view
    const { data: pgData, error: pgError } = await supabase.from('pg_proc').select('*').limit(1);
    console.log('pg_proc query:', pgData, pgError);
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
