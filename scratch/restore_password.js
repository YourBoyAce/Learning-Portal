const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rqeqcwlchxfboqtghkko.supabase.co';
const supabaseServiceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZXFjd2xjaHhmYm9xdGdoa2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQxMjkwMSwiZXhwIjoyMDkxOTg4OTAxfQ.r_xSaO_xgu9wmZPFGNhmlL2H1U7I2tejbb3pldBt8qI';

async function run() {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const mentorId = '0363d4df-00a5-4448-8f77-1bb1a9078296';
  console.log('Restoring password for mentor1@gmail.com to Welcome123! ...');
  const { data: user, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(mentorId, {
    password: 'Welcome123!'
  });

  if (updateError) {
    console.error('Error updating password:', updateError);
    return;
  }
  console.log('Password restored successfully.');
}

run();
