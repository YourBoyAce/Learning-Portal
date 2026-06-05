const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const dbUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const dbKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const supabase = createClient(dbUrl, dbKey);
async function run() {
  const { data: enrollments } = await supabase.from('course_enrollments').select('user_id, course_id').limit(5);
  console.log("Enrollments:", enrollments);
  if (enrollments && enrollments.length > 0) {
    const { data: modules } = await supabase.from('coursemodules').select('id, duration, maincourse_id').eq('maincourse_id', enrollments[0].course_id);
    console.log("Modules for course", enrollments[0].course_id, ":", modules);
  }
}
run();
