const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase configuration!");
  console.error("Please check .env file has:");
  console.error("SUPABASE_URL=your_url");
  console.error("SUPABASE_ANON_KEY=your_key");
  process.exit(1);
}

// Clean URL - pastikan tidak ada typo
const cleanUrl = supabaseUrl.trim();
console.log("📡 Connecting to Supabase...");
console.log(`📍 URL: ${cleanUrl}`);

// Gunakan ANON KEY dengan konfigurasi yang benar
const supabase = createClient(cleanUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    headers: {
      apikey: supabaseAnonKey,
    },
  },
});

// Test connection dengan query yang tepat
async function testConnection() {
  try {
    // Coba query sederhana dengan select count
    const { data, error, count } = await supabase
      .from("birthdates")
      .select("*", { count: "exact", head: true });

    if (error) {
      console.error("❌ Supabase connection failed:", error.message);
      console.log("💡 Pastikan:");
      console.log("1. URL Supabase benar");
      console.log("2. ANON KEY benar");
      console.log('3. Table "birthdates" sudah dibuat');
      console.log("4. RLS policies sudah di-enable");
      return false;
    }
    console.log(`✅ Supabase connected! (${count || 0} records in birthdates)`);
    return true;
  } catch (error) {
    console.error("❌ Supabase connection error:", error.message);
    return false;
  }
}

// Run test
testConnection();

module.exports = { supabase };
