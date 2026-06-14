// CNMI Temperature Monitor - Supabase connection
// วิธีใช้:
// 1) ไปที่ Supabase > Project Settings > API
// 2) คัดลอก Project URL มาใส่ที่ SUPABASE_URL
// 3) คัดลอก anon public key มาใส่ที่ SUPABASE_ANON_KEY
// 4) Save แล้วอัปโหลดไฟล์ทั้งหมดขึ้น GitHub Pages / Web hosting

window.CNMI_SUPABASE_CONFIG = {
  SUPABASE_URL: "https://jynwsdtoqjsjkkefrhyt.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5bndzZHRvcWpzamtrZWZyaHl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0MTQ3NTMsImV4cCI6MjA5Njk5MDc1M30.0Wfh47c8G5yTV1q6Skrn1RlQFDljPkieuNmVF2Kj6Hk",
  TIMEZONE: "Asia/Bangkok",
  APP_MODE: "supabase"
};
