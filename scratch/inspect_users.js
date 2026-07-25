const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient('https://rqeqcwlchxfboqtghkko.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZXFjd2xjaHhmYm9xdGdoa2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQxMjkwMSwiZXhwIjoyMDkxOTg4OTAxfQ.r_xSaO_xgu9wmZPFGNhmlL2H1U7I2tejbb3pldBt8qI');
  try {
    const { data: profiles, error } = await supabase.from('profiles').select('*').in('email', ['demouser@gmail.com', 'user@example.com', 'acespade980@gmail.com']);
    console.log('Error:', error);
    console.log('Profiles:', JSON.stringify(profiles, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
