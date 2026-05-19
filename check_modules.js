const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient('https://rqeqcwlchxfboqtghkko.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZXFjd2xjaHhmYm9xdGdoa2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQxMjkwMSwiZXhwIjoyMDkxOTg4OTAxfQ.r_xSaO_xgu9wmZPFGNhmlL2H1U7I2tejbb3pldBt8qI');
  try {
    const { data, error } = await supabase
      .from('coursemodules')
      .select('*')
      .limit(3);
      
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    console.log('Fetched Modules (all columns):');
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
