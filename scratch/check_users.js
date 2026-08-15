const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: profiles, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(5);
  console.log('Latest profiles:', profiles);
  const { data: users, error: err2 } = await supabase.auth.admin.listUsers();
  console.log('Latest auth users:', users?.users?.slice(0, 5).map(u => ({ id: u.id, email: u.email, created_at: u.created_at })));
}

check();
