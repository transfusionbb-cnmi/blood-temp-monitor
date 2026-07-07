// CNMI Temperature Monitor - Google Chat Alert Relay config v1.6
// ใช้สำหรับส่ง Incident ไป Google Chat ของ BEM ผ่าน Apps Script Relay
// หมายเหตุ: Webhook จริงต้องเก็บใน Script Properties ของ Apps Script เท่านั้น ห้ามใส่ในไฟล์นี้

window.CNMI_CHAT_ALERT_CONFIG = {
  // URL จาก Apps Script > Deploy > Web app ที่ลงท้ายด้วย /exec
  ALERT_RELAY_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbwP9FDgIr8kid_XKa3yjmVCxJ_SCPPzk9eUbJPC9Md2oQNl8tzTSntuVsbmHc-hczFJ4Q/exec",

  // ลิงก์หน้าเว็บ GitHub Pages ของแอพนี้ เพื่อให้ BEM กดกลับมาอัปเดต Incident ได้ทันที
  // ตัวอย่าง: "https://transfusionbb-cnmi.github.io/blood-temp-monitor/"
  APP_BASE_URL: window.location.origin + window.location.pathname,

  // เปิด/ปิดการแจ้งเตือน Incident เข้า Google Chat BEM
  ENABLE_CHAT_ALERT: true
};
