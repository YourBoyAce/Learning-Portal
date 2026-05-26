const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient('https://rqeqcwlchxfboqtghkko.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZXFjd2xjaHhmYm9xdGdoa2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQxMjkwMSwiZXhwIjoyMDkxOTg4OTAxfQ.r_xSaO_xgu9wmZPFGNhmlL2H1U7I2tejbb3pldBt8qI');
  try {
    const { data: tableCols, error } = await supabase
      .rpc('get_columns', { table_name: 'coursemodules' }); // standard rpc might not exist, let's try direct select from a system view or fetch a single row

    // Let's query information_schema if possible, or try checking columns by selecting from pg_attribute
    const { data, error: queryError } = await supabase.from('coursemodules').select('*').limit(1);
    console.log('Sample coursemodule:', data);

    const { data: countData, error: countError } = await supabase.from('coursemodules').select('id', { count: 'exact' });
    console.log('Total modules:', countData?.length, countError);
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
