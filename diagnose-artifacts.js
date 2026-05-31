#!/usr/bin/env node

/**
 * Diagnostic script to check artifact storage issues
 * Run: node diagnose-artifacts.js
 */

const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error("   Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log("🔍 Diagnosing artifact storage issues...\n");

  try {
    // 1. Fetch all artifacts from DB
    console.log("1️⃣ Checking database...");
    const { data: artifacts, error: dbError } = await supabase
      .from("course_artifacts")
      .select("id, name, file_url, file_path, status")
      .eq("status", "Published");

    if (dbError) {
      console.error("   ❌ Database query failed:", dbError.message);
      return;
    }

    if (!artifacts || artifacts.length === 0) {
      console.log("   ⚠️  No published artifacts found in database");
      return;
    }

    console.log(`   ✅ Found ${artifacts.length} published artifacts\n`);

    // 2. Check each artifact URL
    console.log("2️⃣ Checking file URLs...");
    let validCount = 0;
    let invalidCount = 0;

    for (const art of artifacts.slice(0, 5)) {
      // Check first 5
      console.log(`\n   📄 ${art.name}`);
      console.log(`      Path: ${art.file_path}`);
      console.log(`      URL: ${art.file_url}`);

      if (!art.file_url) {
        console.log(`      ❌ No URL stored`);
        invalidCount++;
        continue;
      }

      try {
        const response = await fetch(art.file_url, {
          method: "HEAD",
          headers: { Range: "bytes=0-0" }, // Only request 1 byte to avoid full download
        });

        if (response.ok || response.status === 206) {
          console.log(`      ✅ File accessible (${response.status})`);
          validCount++;
        } else {
          console.log(`      ❌ File not found (${response.status})`);
          invalidCount++;
        }
      } catch (err) {
        console.log(`      ❌ Error checking: ${err.message}`);
        invalidCount++;
      }
    }

    console.log(`\n   Summary: ${validCount} accessible, ${invalidCount} inaccessible`);

    // 3. List bucket contents
    console.log("\n3️⃣ Checking storage buckets...");

    for (const bucketName of ["course-artifacts", "course_artifacts"]) {
      try {
        const { data: files, error } = await supabase.storage
          .from(bucketName)
          .list("artifacts", { limit: 5 });

        if (error) {
          console.log(
            `   ❌ Bucket "${bucketName}": ${error.message || "Not found"}`
          );
        } else {
          console.log(`   ✅ Bucket "${bucketName}" exists`);
          if (files && files.length > 0) {
            console.log(`      Files found: ${files.length}`);
            files.slice(0, 3).forEach((f) => {
              console.log(`        - ${f.name}`);
            });
          } else {
            console.log(`      ⚠️  No files in artifacts/ folder`);
          }
        }
      } catch (err) {
        console.log(`   ❌ Bucket "${bucketName}": Error - ${err.message}`);
      }
    }

    // 4. Recommendations
    console.log("\n📋 Recommendations:");
    if (invalidCount > 0) {
      console.log(
        "   • Check that the 'course-artifacts' bucket exists and is PUBLIC"
      );
      console.log("   • Verify files are actually uploaded to the bucket");
      console.log("   • Check Supabase storage bucket policies");
      console.log("   • Consider re-uploading artifacts through admin panel");
    }
  } catch (err) {
    console.error("❌ Diagnostic failed:", err.message);
  }
}

diagnose();
