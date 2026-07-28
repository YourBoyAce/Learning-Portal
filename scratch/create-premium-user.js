// One-off script to create premium@gmail.com in Supabase
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://rqeqcwlchxfboqtghkko.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxZXFjd2xjaHhmYm9xdGdoa2tvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjQxMjkwMSwiZXhwIjoyMDkxOTg4OTAxfQ.r_xSaO_xgu9wmZPFGNhmlL2H1U7I2tejbb3pldBt8qI";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function main() {
    const email = "premium@gmail.com";
    const password = "123";

    // 1. Create user in auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
    });

    if (authError) {
        console.error("Auth Error:", authError.message);
        process.exit(1);
    }

    console.log("✅ Auth user created:", authData.user.id);

    // 2. Create profile
    const { error: profileError } = await supabase
        .from("profiles")
        .upsert({
            id: authData.user.id,
            email: email,
            full_name: "Premium User",
            role: "user",
            created_at: new Date().toISOString(),
        });

    if (profileError) {
        console.error("Profile Error:", profileError.message);
        process.exit(1);
    }

    console.log("✅ Profile created for premium@gmail.com");
    console.log("🎉 Done! User can now log in.");
}

main();