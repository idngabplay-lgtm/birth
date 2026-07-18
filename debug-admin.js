require('dotenv').config();
const { supabase } = require('./src/config/database');

async function debugAdmin() {
  console.log('🔍 DEBUG ADMIN\n');
  
  const myNumber = '6282114499617';
  console.log(`📱 Nomor yang dicek: ${myNumber}`);
  console.log(`📱 Panjang: ${myNumber.length}\n`);
  
  // 1. Cek langsung ke database
  console.log('1️⃣ Cek di database:');
  const { data, error } = await supabase
    .from('admins')
    .select('*')
    .eq('number', myNumber);
  
  if (error) {
    console.log('❌ Error:', error.message);
  } else {
    console.log(`✅ Data ditemukan: ${data.length} record`);
    console.log('📊 Data:', data);
  }
  
  // 2. Cek semua admin
  console.log('\n2️⃣ Semua admin:');
  const { data: allAdmins } = await supabase
    .from('admins')
    .select('*');
  console.log('📊 All admins:', allAdmins);
  
  // 3. Cek dengan service admin
  console.log('\n3️⃣ Test dengan adminService:');
  const adminService = require('./src/services/adminService');
  const isAdmin = await adminService.isAdmin(myNumber);
  console.log(`✅ isAdmin(): ${isAdmin}`);
  
  // 4. Cek raw query
  console.log('\n4️⃣ Raw query test:');
  const { data: rawData } = await supabase
    .from('admins')
    .select('number')
    .eq('number', myNumber)
    .single();
  console.log('📊 Raw result:', rawData);
}

debugAdmin().catch(console.error);