const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rqeqcwlchxfboqtghkko.supabase.co';
const supabaseServiceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZXFjd2xjaHhmYm9xdGdoa2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQxMjkwMSwiZXhwIjoyMDkxOTg4OTAxfQ.r_xSaO_xgu9wmZPFGNhmlL2H1U7I2tejbb3pldBt8qI';
const supabaseAnon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZXFjd2xjaHhmYm9xdGdoa2tvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MTI5MDEsImV4cCI6MjA5MTk4ODkwMX0.7SIeFglIf4NkJ1dWMeuhERx3SCTN7EcCAEeA9fgEm6w';

async function run() {
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRole, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const mentorId = '0363d4df-00a5-4448-8f77-1bb1a9078296';
  console.log('Updating password for mentor...');
  const { data: user, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(mentorId, {
    password: 'password123'
  });

  if (updateError) {
    console.error('Error updating password:', updateError);
    return;
  }
  console.log('Password updated successfully.');

  // Now create a client with the anon key and sign in
  const supabaseClient = createClient(supabaseUrl, supabaseAnon, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log('Signing in as mentor...');
  const { data: sessionData, error: signInError } = await supabaseClient.auth.signInWithPassword({
    email: 'mentor1@gmail.com',
    password: 'password123'
  });

  if (signInError) {
    console.error('Error signing in:', signInError);
    return;
  }
  console.log('Signed in successfully! Session user id:', sessionData.user.id);

  // Run the SELECT query on calendar_events
  console.log('Fetching calendar_events...');
  const { data: events, error: fetchError } = await supabaseClient
    .from('calendar_events')
    .select('id, title, description, event_date, event_time, event_type, tag')
    .eq('user_id', sessionData.user.id);

  if (fetchError) {
    console.error('Error fetching calendar_events:', fetchError);
    return;
  }

  console.log('Fetched calendar events count:', events.length);
  console.log('Fetched calendar events:', JSON.stringify(events, null, 2));
}

run();
