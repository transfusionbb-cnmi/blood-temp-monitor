const WEB_APP_URL = "SUPABASE_LOCAL";
window.CNMI_TEMP_MONITOR_VERSION = "1.8.69-incident-all-pages-bem-status-ui";
console.log("CNMI Temp Monitor version", window.CNMI_TEMP_MONITOR_VERSION);
const AUTH_DISABLED_TEMPORARILY = true;

    let html5QrCode = null;
    let scannerOpen = false;

    let historyHtml5QrCode = null;
    let historyScannerOpen = false;

    let chartHtml5QrCode = null;
    let chartScannerOpen = false;
    let qrApplyInProgress = false;

    let tempChart = null;
    let lastHistoryRecords = [];
    let kpiMetricExamplesCache = [];
    let lastHistoryFridgeId = '';

    let fridgeMasterList = [];
    let currentDuplicateStatus = false;
    let fridgeStatusListCache = [];
    let updateIncidentListCache = [];
    let updateIncidentLoadSeq = 0;
    let incidentHistoryListCache = [];
    let historyAutoLoadTimer = null;
    let chartAutoLoadTimer = null;

    let dashboardRowsCache = [];
    let dashboardSummaryCache = {};
    let alarmHistoryCache = [];

    let dashboardListsCache = {
      morningRecorded: [],
      morningMissing: [],
      eveningRecorded: [],
      eveningMissing: []
    };


function normalizeNumericText(value) {
  return String(value ?? "")
    .trim()
    .replace(/[−–—]/g, "-")
    .replace(/,/g, ".")
    .replace(/[๐-๙]/g, ch => "๐๑๒๓๔๕๖๗๘๙".indexOf(ch))
    .replace(/[０-９]/g, ch => String(ch.charCodeAt(0) - 0xFF10));
}

function parseNullableNumber(value) {
  const text = normalizeNumericText(value);
  if (!text || text === "-" || text === "." || text === "-." || text === "+") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function getFridgeTempRange(fridgeInfo) {
  const minTemp = parseNullableNumber(fridgeInfo?.minTemp);
  const maxTemp = parseNullableNumber(fridgeInfo?.maxTemp);
  if (minTemp === null || maxTemp === null) return null;
  return { minTemp, maxTemp };
}

function isTemperatureAbnormal(tempValue, fridgeInfo) {
  const tempNum = parseNullableNumber(tempValue);
  const range = getFridgeTempRange(fridgeInfo);
  if (tempNum === null || !range) return false;
  return tempNum < range.minTemp || tempNum > range.maxTemp;
}

function normalizeTempInputValue() {
  const tempEl = document.getElementById("temp");
  if (!tempEl) return "";
  const normalized = normalizeNumericText(tempEl.value);
  if (tempEl.value !== normalized) tempEl.value = normalized;
  return normalized;
}

function toggleTempMinus(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const tempEl = document.getElementById("temp");
  if (!tempEl || tempEl.disabled) return false;
  let value = normalizeNumericText(tempEl.value || "");
  if (value.startsWith("-")) {
    value = value.slice(1);
  } else {
    value = "-" + value;
  }
  tempEl.value = value;
  tempEl.dispatchEvent(new Event("input", { bubbles: true }));
  setTimeout(() => {
    try {
      tempEl.focus({ preventScroll: true });
      const end = tempEl.value.length;
      tempEl.setSelectionRange(end, end);
    } catch (e) {}
  }, 0);
  validateForm();
  return false;
}

// iOS Safari บางครั้ง onclick ของปุ่มข้างช่อง input ไม่ทำงานเมื่อคีย์บอร์ดเปิดอยู่
// จึง bind touch/pointer ซ้ำหลัง DOM พร้อม เพื่อให้ปุ่ม - กดได้แน่นอน
(function bindTempMinusButtonForMobile() {
  const bind = () => {
    const btn = document.getElementById("tempMinusBtn");
    if (!btn || btn.dataset.bound === "1") return;
    btn.dataset.bound = "1";
    ["pointerdown", "mousedown", "touchstart"].forEach((eventName) => {
      btn.addEventListener(eventName, toggleTempMinus, { passive: false });
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();


const ADMIN_EMAIL = "parichat.ink@mahidol.ac.th";
const ALLOWED_EMAIL_DOMAINS = ["@rfs.co.th", "@mahidol.ac.th"];
let currentUserProfile = null;
let menuSettingsCache = {};

function getSupabaseClientSafe() {
  if (!window.CNMI_SUPABASE_BACKEND || !window.CNMI_SUPABASE_BACKEND.getClient) throw new Error("ยังโหลด Supabase backend ไม่สำเร็จ");
  return window.CNMI_SUPABASE_BACKEND.getClient();
}
function isAllowedEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  return ALLOWED_EMAIL_DOMAINS.some(domain => e.endsWith(domain));
}
function isAdminEmail(email) {
  return String(email || "").trim().toLowerCase() === ADMIN_EMAIL;
}
function showAuthTab(tab) {
  ["login", "register", "forgot", "reset"].forEach(name => {
    document.getElementById(name + "Panel")?.classList.toggle("hidden", name !== tab);
    const tabId = name === "login" ? "authLoginTab" : name === "register" ? "authRegisterTab" : name === "forgot" ? "authForgotTab" : "authForgotTab";
    document.getElementById(tabId)?.classList.toggle("active", name === tab);
  });
  const result = document.getElementById("authResult");
  if (result) { result.style.display = "none"; result.innerText = ""; result.className = "result"; }
}
function showAuthResult(ok, text) {
  const el = document.getElementById("authResult");
  if (!el) return;
  el.style.display = "block";
  el.className = ok ? "result success" : "result error";
  el.innerText = text;
}
async function registerUser() {
  const sb = getSupabaseClientSafe();
  const username = document.getElementById("regUsername")?.value.trim().toLowerCase() || "";
  const employeeId = document.getElementById("regEmployeeId")?.value.trim() || "";
  const firstName = document.getElementById("regFirstName")?.value.trim() || "";
  const lastName = document.getElementById("regLastName")?.value.trim() || "";
  const department = document.getElementById("regDepartment")?.value.trim() || "";
  const email = document.getElementById("regEmail")?.value.trim().toLowerCase() || "";
  const password = document.getElementById("regPassword")?.value || "";
  const confirm = document.getElementById("regConfirmPassword")?.value || "";
  if (!username || !firstName || !lastName || !department || !employeeId || !email || !password || !confirm) { showAuthResult(false, "กรุณากรอกข้อมูลสมัครสมาชิกให้ครบ"); return; }
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) { showAuthResult(false, "Username ใช้ได้เฉพาะ a-z, 0-9, จุด, ขีดกลาง, ขีดล่าง และต้องยาว 3-30 ตัว"); return; }
  if (!isAllowedEmail(email)) { showAuthResult(false, "สมัครได้เฉพาะอีเมล @rfs.co.th หรือ @mahidol.ac.th เท่านั้น"); return; }
  if (password.length < 6) { showAuthResult(false, "รหัสผ่านควรยาวอย่างน้อย 6 ตัวอักษร"); return; }
  if (password !== confirm) { showAuthResult(false, "รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน"); return; }
  showAuthResult(true, "กำลังสมัครสมาชิก...");
  const { error } = await sb.auth.signUp({
    email, password,
    options: { data: { username, first_name: firstName, last_name: lastName, department, employee_id: employeeId }, emailRedirectTo: window.location.origin + window.location.pathname }
  });
  if (error) { showAuthResult(false, "สมัครไม่สำเร็จ: " + error.message); return; }
  showAuthTab("login");
  showAuthResult(true, "สมัครสมาชิกสำเร็จ ถ้าระบบเปิดยืนยันอีเมล ให้ไปกดยืนยันในอีเมลก่อนเข้าสู่ระบบ");
}
async function resolveLoginEmail(identifier) {
  const text = String(identifier || "").trim().toLowerCase();
  if (!text) return "";
  if (text.includes("@")) return text;
  const sb = getSupabaseClientSafe();
  const { data, error } = await sb.rpc("lookup_login_email", { p_username: text });
  if (error) throw error;
  if (!data) throw new Error("ไม่พบ username นี้ในระบบ หรือบัญชีถูกปิดใช้งาน");
  return String(data).toLowerCase();
}
async function loginUser() {
  const sb = getSupabaseClientSafe();
  const identifier = document.getElementById("loginIdentifier")?.value.trim() || "";
  const password = document.getElementById("loginPassword")?.value || "";
  if (!identifier || !password) { showAuthResult(false, "กรุณากรอก Username/Email และรหัสผ่าน"); return; }
  try {
    showAuthResult(true, "กำลังเข้าสู่ระบบ...");
    const email = await resolveLoginEmail(identifier);
    if (!isAllowedEmail(email)) throw new Error("อีเมลนี้ไม่ได้อยู่ใน domain ที่อนุญาต");
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await loadCurrentUserProfile();
    await showAuthenticatedApp();
  } catch (error) { showAuthResult(false, "เข้าสู่ระบบไม่สำเร็จ: " + (error.message || error)); }
}
async function sendPasswordReset() {
  const sb = getSupabaseClientSafe();
  const email = document.getElementById("forgotEmail")?.value.trim().toLowerCase() || "";
  if (!email || !isAllowedEmail(email)) { showAuthResult(false, "กรุณากรอกอีเมล @rfs.co.th หรือ @mahidol.ac.th"); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
  if (error) showAuthResult(false, "ส่งลิงก์ไม่สำเร็จ: " + error.message);
  else showAuthResult(true, "ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลแล้ว");
}

async function completePasswordReset() {
  const sb = getSupabaseClientSafe();
  const password = document.getElementById("resetPassword")?.value || "";
  const confirm = document.getElementById("resetConfirmPassword")?.value || "";
  if (password.length < 6) { showAuthResult(false, "รหัสผ่านใหม่ควรยาวอย่างน้อย 6 ตัวอักษร"); return; }
  if (password !== confirm) { showAuthResult(false, "รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน"); return; }
  const { error } = await sb.auth.updateUser({ password });
  if (error) { showAuthResult(false, "ตั้งรหัสผ่านใหม่ไม่สำเร็จ: " + error.message); return; }
  showAuthResult(true, "ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง");
  await sb.auth.signOut({ scope: "local" });
  showAuthTab("login");
}

function isPasswordRecoveryUrl() {
  const text = `${window.location.hash || ""} ${window.location.search || ""}`;
  return text.includes("type=recovery") || text.includes("access_token=");
}

async function forceLogout() {
  try { await getSupabaseClientSafe().auth.signOut({ scope: "local" }); } catch (e) { console.warn("force logout signOut warning", e); }
  localStorage.clear(); sessionStorage.clear();
  location.href = window.location.origin + window.location.pathname;
}
async function logoutApp() { await forceLogout(); }
async function loadCurrentUserProfile() {
  const sb = getSupabaseClientSafe();
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData?.user) throw new Error("ยังไม่ได้เข้าสู่ระบบ");
  const user = userData.user;
  const email = String(user.email || "").toLowerCase();
  let { data, error } = await sb.from("user_profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) throw error;
  if (!data) {
    const md = user.user_metadata || {};
    const fallback = { id: user.id, email, username: (md.username || email.split("@")[0]).toLowerCase(), first_name: md.first_name || "", last_name: md.last_name || "", department: md.department || "", employee_id: md.employee_id || "", role: isAdminEmail(email) ? "admin" : "staff", is_active: true };
    const ins = await sb.from("user_profiles").upsert(fallback, { onConflict: "id" }).select("*").single();
    if (ins.error) throw ins.error;
    data = ins.data;
  }
  data = await hydrateProfileNameFromStaffAlias(data, email);
  if (isAdminEmail(email) && data.role !== "admin") { await sb.from("user_profiles").update({ role: "admin", is_active: true }).eq("id", user.id); data.role = "admin"; data.is_active = true; }
  if (data.is_active === false) throw new Error("บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อ Admin");
  currentUserProfile = data;
  return data;
}
function roleDisplay(role) { return role === "admin" ? "Admin" : role === "bem" ? "BEM" : "Staff"; }

function normalizeStaffAliasKeyForUI(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function staffNameForUI(input) {
  const name = String(input || "").trim().replace(/\s+/g, " ");
  if (!name) return "";
  try {
    const backend = window.CNMI_SUPABASE_BACKEND;
    return backend?.resolveStaffFullNameCached?.(name)
      || backend?.resolveStaffAliasCached?.(name)
      || name;
  } catch (e) {
    return name;
  }
}

async function resolveStaffFullNameForUI(input) {
  const name = String(input || "").trim().replace(/\s+/g, " ");
  if (!name) return "";
  try {
    await window.CNMI_SUPABASE_BACKEND?.loadStaffDirectory?.(false);
    return staffNameForUI(name);
  } catch (e) {
    console.warn("resolveStaffFullNameForUI warning", e);
    return name;
  }
}

// ชื่อเดิมเก็บไว้เพื่อ compatibility แต่ V1.8.20 คืนชื่อ-นามสกุล
async function resolveStaffAliasForUI(input) {
  return resolveStaffFullNameForUI(input);
}

async function hydrateProfileNameFromStaffAlias(profile, email) {
  if (!profile) return profile;
  const currentName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
  const aliasCandidate = currentName || profile.username || String(email || "").split("@")[0] || "";
  const resolved = await resolveStaffFullNameForUI(aliasCandidate);
  if (resolved && normalizeStaffAliasKeyForUI(resolved) !== normalizeStaffAliasKeyForUI(aliasCandidate)) {
    profile.first_name = resolved;
    profile.last_name = "";
  }
  return profile;
}


function normalizeFridgeUsageStatusForUI(status) {
  const text = String(status || "").trim();
  if (!text) return "";
  return text === "ใช้งาน" ? "ใช้งาน" : "เลิกใช้งาน";
}

function getCurrentActorFullName() {
  if (AUTH_DISABLED_TEMPORARILY) return "";
  const p = currentUserProfile || {};
  const fullName = `${p.first_name || ""} ${p.last_name || ""}`.trim();
  return fullName || p.username || p.email || "";
}
function getCurrentActorEmail() {
  if (AUTH_DISABLED_TEMPORARILY) return "";
  return String(currentUserProfile?.email || "").trim().toLowerCase();
}
function getCurrentActorId() {
  if (AUTH_DISABLED_TEMPORARILY) return "";
  return String(currentUserProfile?.id || "").trim();
}
function getCurrentActorRole() {
  if (AUTH_DISABLED_TEMPORARILY) return "staff";
  return String(currentUserProfile?.role || "staff").trim();
}
function syncLoginIdentityFields() {
  const ids = ["recorderName", "alarmTester", "updateOwner", "statusUpdatedBy"];
  if (AUTH_DISABLED_TEMPORARILY) {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.readOnly = false;
      el.removeAttribute("readonly");
      el.title = "กรอกชื่อผู้ปฏิบัติงาน";
    });
    return;
  }
  const fullName = getCurrentActorFullName();
  const meta = getCurrentActorEmail();
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = fullName || meta || "";
    el.readOnly = true;
    el.setAttribute("readonly", "readonly");
    el.title = meta ? `ดึงจาก Login: ${meta}` : "ดึงจากบัญชีที่เข้าสู่ระบบ";
  });
}
function appendActorParams(params) {
  if (AUTH_DISABLED_TEMPORARILY) return;
  params.set("actorUserId", getCurrentActorId());
  params.set("actorEmail", getCurrentActorEmail());
  params.set("actorFullName", getCurrentActorFullName());
  params.set("actorRole", getCurrentActorRole());
}
function applyUserToUI() {
  const p = currentUserProfile || {};
  const fullName = `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email || "-";
  document.getElementById("currentUserBox")?.classList.remove("hidden");
  const nameEl = document.getElementById("currentUserName"); if (nameEl) nameEl.innerText = fullName;
  const roleEl = document.getElementById("currentUserRole"); if (roleEl) roleEl.innerText = `${roleDisplay(p.role)} | ${p.department || "-"}`;
  syncLoginIdentityFields();
  document.querySelectorAll(".admin-only").forEach(el => el.classList.toggle("hidden", p.role !== "admin"));
  if (p.role === "bem") document.getElementById("bemMenuGroup")?.classList.remove("collapsed");
}
async function loadMenuSettingsAndApply() {
  try {
    const res = await fetch(`${WEB_APP_URL}?action=menu_settings`);
    const data = await res.json();
    if (Array.isArray(data)) menuSettingsCache = Object.fromEntries(data.map(x => [x.menuKey, x]));
  } catch (e) { console.warn("load menu settings skipped", e); }
  document.querySelectorAll("[data-menu-key]").forEach(el => {
    const key = el.getAttribute("data-menu-key");
    const cfg = menuSettingsCache[key];
    if (!AUTH_DISABLED_TEMPORARILY && cfg && cfg.isEnabled === false && currentUserProfile?.role !== "admin") el.classList.add("hidden"); else el.classList.remove("hidden");
  });
}
async function showAuthenticatedApp() {
  document.getElementById("authPage")?.classList.add("hidden");
  document.querySelector(".app")?.classList.remove("auth-hidden");
  document.querySelector(".mobile-topbar")?.classList.remove("auth-hidden");
  document.querySelector(".mobile-float-menu")?.classList.remove("auth-hidden");
  applyUserToUI(); await loadMenuSettingsAndApply(); await initializeMainApp();
}
async function initAuthAndApp() {
  if (AUTH_DISABLED_TEMPORARILY) {
    document.getElementById("authPage")?.classList.add("hidden");
    document.querySelector(".app")?.classList.remove("auth-hidden");
    document.querySelector(".mobile-topbar")?.classList.remove("auth-hidden");
    document.querySelector(".mobile-float-menu")?.classList.remove("auth-hidden");
    currentUserProfile = null;
    await initializeMainApp();
    return;
  }
  document.querySelector(".app")?.classList.add("auth-hidden");
  document.querySelector(".mobile-topbar")?.classList.add("auth-hidden");
  document.querySelector(".mobile-float-menu")?.classList.add("auth-hidden");
  try {
    const sb = getSupabaseClientSafe();
    const { data } = await sb.auth.getSession();
    if (isPasswordRecoveryUrl() && data?.session) {
      document.getElementById("authPage")?.classList.remove("hidden");
      showAuthTab("reset");
      showAuthResult(true, "กรุณาตั้งรหัสผ่านใหม่");
      return;
    }
    if (data?.session) { await loadCurrentUserProfile(); await showAuthenticatedApp(); }
    else document.getElementById("authPage")?.classList.remove("hidden");
  } catch (e) {
    console.error("init auth error", e);
    document.getElementById("authPage")?.classList.remove("hidden");
    showAuthResult(false, "ยังตั้งค่า Login ไม่ครบ หรือยังไม่ได้รัน SQL v1.7: " + (e.message || e));
  }
}
async function initializeMainApp() {
  const pages = ["dashboardPage","kpiPage","formPage","historyPage","chartPage","notificationPage","helpPage","fridgeStatusPage","alarmTestPage","alarmTestHistoryPage","incidentHubPage","incidentPage","updateIncidentPage","incidentHistoryPage","adminUsersPage","adminMenuSettingsPage","adminAuditPage"];
  pages.forEach(id => { const el = document.getElementById(id); if (!el) return; if (id === "dashboardPage") el.classList.remove("hidden"); else el.classList.add("hidden"); });
  document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"));
  const firstBtn = document.querySelector(".menu-btn[data-menu-key='dashboard']"); if (firstBtn) firstBtn.classList.add("active");
  // V1.8.33: ลดงานหนักตอนเปิดหน้า โดยให้รายการตู้โหลดคู่กับ Dashboard
  // และไม่ดึง Incident ทั้งหมดซ้ำ เพราะ Dashboard มีจำนวนเคสเปิดอยู่แล้ว
  let fridgeLoadPromise = Promise.resolve();
  try { fridgeLoadPromise = loadFridgeList(); } catch (e) { console.error("loadFridgeList error:", e); }
  try { setToday(); } catch (e) { console.error("setToday error:", e); }
  try { setDefaultHistoryDateRange(true); } catch (e) { console.error("setDefaultHistoryDateRange error:", e); }
  try { setDefaultChartDateRange(true); } catch (e) { console.error("setDefaultChartDateRange error:", e); }
  try { syncLoginIdentityFields(); resetFormState(); } catch (e) { console.error("resetFormState error:", e); }
  try { validateForm(); } catch (e) { console.error("validateForm error:", e); }
  try { const d = document.getElementById("dashboardDate"); if (d && !d.value) d.value = getTodayYMD(); } catch (e) { console.error("dashboardDate default error:", e); }
  try { const m = document.getElementById("kpiMonth"); if (m && !m.value) m.value = getTodayYMD().slice(0, 7); } catch (e) { console.error("kpiMonth default error:", e); }
  try { await loadDashboard(); } catch (e) { console.error("loadDashboard error:", e); }
  try { await fridgeLoadPromise; } catch (e) { console.error("loadFridgeList async error:", e); }
  try { await handleIncidentDeepLink(); } catch (e) { console.error("handleIncidentDeepLink error:", e); }
  try { await refreshPushReminderBanner(); } catch (e) { console.warn("push reminder banner skipped:", e); }
  try { await syncPushSubscriptionIfPresent(); } catch (e) { console.warn("push subscription sync skipped:", e); }
  try { if (navigator.clearAppBadge) await navigator.clearAppBadge(); } catch (e) {}
  try { setupAlarmTestValidation(); } catch (e) { console.error("setupAlarmTestValidation:", e); }
}
function toggleMenuGroup(groupId) { const el = document.getElementById(groupId); if (el) el.classList.toggle("collapsed"); }

function showPage(pageId, btn) {
  const pages = document.querySelectorAll(".main-content > section.card");

  pages.forEach(page => {
    page.classList.add("hidden");
  });

  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.remove("hidden");
  }

  document.querySelectorAll(".menu-btn").forEach(button => {
    button.classList.remove("active");
  });

  if (btn) {
    btn.classList.add("active");
  }

  if (typeof syncLoginIdentityFields === "function") syncLoginIdentityFields();

  if (pageId === "formPage" && typeof autoSelectRoundByCurrentTime === "function") {
    setTimeout(() => { syncLoginIdentityFields(); autoSelectRoundByCurrentTime({ force: false }); validateForm(); }, 0);
  }

  if (pageId === "historyPage") {
    setTimeout(() => {
      if (typeof setDefaultHistoryDateRange === "function") setDefaultHistoryDateRange(false);
      if (typeof autoLoadHistoryIfReady === "function") autoLoadHistoryIfReady();
    }, 0);
  }

  if (pageId === "chartPage") {
    setTimeout(() => {
      if (typeof setDefaultChartDateRange === "function") setDefaultChartDateRange(false);
      if (typeof autoLoadChartIfReady === "function") autoLoadChartIfReady();
    }, 0);
  }

  if (pageId === "notificationPage" && typeof loadPushNotificationPage === "function") {
    setTimeout(() => loadPushNotificationPage(), 0);
  }

  if (pageId === "updateIncidentPage" && typeof loadOpenIncidentList === "function") {
    setTimeout(() => { syncLoginIdentityFields(); loadOpenIncidentList(); }, 0);
  }

  if (typeof syncMobileNavWithPage === "function") {
    syncMobileNavWithPage(pageId);
  }

  // V1.8.70: the document is the single vertical scroller on desktop/mobile.
  // Keep a defensive reset for old cached layouts, then move the page itself to the top.
  const mainScroller = document.querySelector(".main-content");
  if (mainScroller) mainScroller.scrollTop = 0;
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (typeof closeMobileMenu === "function") {
    closeMobileMenu();
  }
}
function setMobileNavActive(button) {
  document.querySelectorAll(".mobile-nav-item").forEach(item => item.classList.remove("active"));
  if (button) button.classList.add("active");
}

function syncMobileNavWithPage(pageId) {
  const incidentPages = ["incidentHubPage", "incidentPage", "updateIncidentPage", "incidentHistoryPage"];
  if (incidentPages.includes(pageId)) {
    const incidentNav = document.querySelector('.mobile-nav-item[data-mobile-page="incidentHubPage"]');
    if (incidentNav) setMobileNavActive(incidentNav);
    return;
  }
  const direct = document.querySelector(`.mobile-nav-item[data-mobile-page="${pageId}"]`);
  if (direct) setMobileNavActive(direct);
}

function isMobileIncidentHubMode() {
  return window.matchMedia && window.matchMedia("(max-width: 768px)").matches;
}

function openIncidentHubFromMobile(button) {
  const sidebarButton = document.querySelector('.menu-btn[data-menu-key="incident_all"]');
  showPage("incidentHubPage", sidebarButton || null);
  setMobileNavActive(button || document.querySelector('.mobile-nav-item[data-mobile-page="incidentHubPage"]'));
}

function handleBemMenuGroupClick() {
  if (isMobileIncidentHubMode()) {
    openIncidentHubFromMobile(document.querySelector('.mobile-nav-item[data-mobile-page="incidentHubPage"]'));
    closeMobileMenu();
    return;
  }
  toggleMenuGroup("bemMenuGroup");
}

async function navigateFromIncidentHub(pageId, menuKey, loaderName) {
  const sidebarButton = document.querySelector(`.menu-btn[data-menu-key="${menuKey}"]`);
  showPage(pageId, sidebarButton || null);
  if (loaderName && typeof window[loaderName] === "function") {
    try { await window[loaderName](); } catch (error) { console.warn(loaderName + " failed", error); }
  }
}

async function navigateFromMobile(pageId, menuKey, button, loaderName) {
  const sidebarButton = document.querySelector(`.menu-btn[data-menu-key="${menuKey}"]`);
  showPage(pageId, sidebarButton || null);
  setMobileNavActive(button);
  if (loaderName && typeof window[loaderName] === "function") {
    try { await window[loaderName](); } catch (error) { console.warn(loaderName + " failed", error); }
  }
}

function openMobileMenu() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("mobileOverlay");

  if (sidebar) sidebar.classList.add("open");
  if (overlay) overlay.classList.add("show");

  document.body.classList.add("menu-open");
}

function closeMobileMenu() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("mobileOverlay");

  if (sidebar) sidebar.classList.remove("open");
  if (overlay) overlay.classList.remove("show");

  document.body.classList.remove("menu-open");
}
    
async function loadIncidentTracking() {
  const dateFilter = document.getElementById("incidentDateFilter")?.value || "today";
  const statusFilter = document.getElementById("incidentStatusFilter")?.value || "active";
  const backendStatusFilter = backendIncidentStatusFilter(statusFilter);
  const startDate = document.getElementById("incidentStartDate")?.value || "";
  const endDate = document.getElementById("incidentEndDate")?.value || "";
  const fridgeSearch = document.getElementById("incidentFridgeSearch")?.value?.trim() || "";

  const resultBox = document.getElementById("incidentResult");
  const tbody = document.getElementById("incidentTableBody");

  if (!tbody) return;

  tbody.innerHTML = "";

  try {
    const url =
      `${WEB_APP_URL}?action=incident_list`
      + `&dateFilter=${encodeURIComponent(dateFilter)}`
      + `&statusFilter=${encodeURIComponent(statusFilter)}`
      + `&startDate=${encodeURIComponent(startDate)}`
      + `&endDate=${encodeURIComponent(endDate)}`
      + `&fridgeSearch=${encodeURIComponent(fridgeSearch)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      showResult(resultBox, true, "ไม่พบรายการ Incident");
      scrollToResult("incidentResult");
      return;
    }

    showResult(resultBox, true, `พบ ${data.length} รายการ`);
    scrollToResult("incidentResult");

    data.forEach(item => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${item.incidentId || ""}</td>
        <td>${item.foundDate || ""}</td>
        <td>${item.foundTime || ""}</td>
        <td>${item.room || ""}</td>
        <td>${item.fridgeId || ""}</td>
        <td>${item.temp ?? ""}</td>
        <td>${staffNameForUI(item.reporter) || ""}</td>
        <td><span class="status-badge ${getIncidentStatusClass(item.caseStatus)}">${item.caseStatus || ""}</span></td>
        <td>${staffNameForUI(item.owner) || ""}</td>
        <td>${item.actionText || ""}</td>
        <td>${item.fixResult || ""}</td>
        <td>${item.updatedDate || ""}</td>
        <td>${item.round || ""}</td>
        <td>${item.logNote || ""}</td>
      `;

      tbody.appendChild(tr);
    });

  } catch (error) {
    showResult(resultBox, false, "โหลด Incident ไม่สำเร็จ: " + error);
    scrollToResult("incidentResult");
  }
}


function getIncidentStatusClass(status) {
  if (!status) return "";
  if (status === "รอ BEM รับเรื่อง") return "status-red";
  if (status === "BEM รับเรื่องแล้ว" || status === "กำลังตรวจสอบ" || status === "ย้ายเลือดแล้ว / รอติดตาม") return "status-orange";
  if (status === "ส่งซ่อมภายนอก" || status === "รออะไหล่ต่างประเทศ") return "status-purple";
  if (status === "ปิดเคส" || status === "ปิดงาน") return "status-green";
  if (status === "ยกเลิกเคส") return "status-gray";
  return "";
}

function uniqueIncidentsById(items) {
  const seen = new Set();
  return (Array.isArray(items) ? items : []).filter(item => {
    const key = String(item?.incidentId || '').trim();
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
    
    
function clearIncidentTracking() {
  const filter = document.getElementById("incidentQuickFilter");
  const tbody = document.getElementById("incidentTableBody");
  const resultBox = document.getElementById("incidentResult");

  if (filter) filter.value = "all";
  if (tbody) tbody.innerHTML = "";

  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }
}

async function loadOpenIncidentList() {
  const select = document.getElementById("updateIncidentSelect");
  const resultBox = document.getElementById("updateIncidentResult");
  const cardList = document.getElementById("updateIncidentCardList");
  if (!select) return;

  const loadSeq = ++updateIncidentLoadSeq;
  const dateFilter = document.getElementById("updateIncidentDateFilter")?.value || "all";
  const statusFilter = document.getElementById("updateIncidentStatusFilter")?.value || "waiting_bem";
  const startDate = document.getElementById("updateIncidentStartDate")?.value || "";
  const endDate = document.getElementById("updateIncidentEndDate")?.value || "";
  const fridgeSearch = document.getElementById("updateIncidentFridgeSearch")?.value?.trim() || "";

  const resetIncidentPicker = () => {
    select.innerHTML = '<option value="">-- เลือก Incident ID --</option>';
    if (cardList) cardList.innerHTML = "";
    updateIncidentListCache = [];
  };

  resetIncidentPicker();

  try {
    const url = `${WEB_APP_URL}?action=incident_list&dateFilter=${encodeURIComponent(dateFilter)}&statusFilter=${encodeURIComponent(backendStatusFilter)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&fridgeSearch=${encodeURIComponent(fridgeSearch)}`;
    const response = await fetch(url);
    let data = await response.json();
    data = uniqueIncidentsById(data);

    // กันการเรียกซ้อนจาก showPage/sidebar/ลิงก์เก่า ทำให้การ์ด Incident เดียวกันขึ้นซ้ำ
    if (loadSeq !== updateIncidentLoadSeq) return;

    // ล้างอีกครั้งหลัง fetch ก่อน render เพื่อให้เหลือผลลัพธ์จาก request ล่าสุดเท่านั้น
    resetIncidentPicker();

    if (!Array.isArray(data) || data.length === 0) {
      showResult(resultBox, true, "ไม่พบ Incident ตามตัวกรอง");
      syncLoginIdentityFields();
      renderUpdateIncidentSummary(null);
      return;
    }

    updateIncidentListCache = data;

    const optionFragment = document.createDocumentFragment();
    data.forEach(item => {
      const option = document.createElement("option");
      option.value = item.incidentId;
      option.textContent = `${item.incidentId} | ${item.bemJobNo || "ยังไม่มีเลข BEM"} | ${item.foundDate || "-"} ${item.foundTime || "-"} | ${item.fridgeId || "-"} | ${item.caseStatus || "-"}`;
      optionFragment.appendChild(option);
    });
    select.appendChild(optionFragment);

    const renderList = data.slice(0, 30);
    if (cardList) {
      const cardFragment = document.createDocumentFragment();
      renderList.forEach(item => {
        const div = document.createElement("div");
        div.className = "bem-incident-card";
        div.onclick = () => selectUpdateIncident(item.incidentId);
        div.innerHTML = `
          <div class="bem-incident-card-head">
            <strong>${escapeHtml(item.incidentId || "-")}</strong>
            <span class="status-badge ${getIncidentStatusClass(item.caseStatus)}">${escapeHtml(item.caseStatus || "-")}</span>
          </div>
          <div class="bem-incident-card-body">
            <div><strong>เลขงาน BEM:</strong> ${escapeHtml(item.bemJobNo || "ยังไม่ได้กรอก")}</div>
            <div><strong>ตู้:</strong> ${escapeHtml(item.fridgeId || "-")} | ${escapeHtml(item.room || "-")}</div>
            <div><strong>วันเวลา:</strong> ${escapeHtml(item.foundDate || "-")} ${escapeHtml(item.foundTime || "-")} | รอบ ${escapeHtml(item.round || "-")}</div>
            <div><strong>อุณหภูมิ:</strong> ${item.temp === null || item.temp === undefined ? "-" : escapeHtml(item.temp)} °C</div>
          </div>
          <button type="button" class="btn-primary bem-card-select-btn">เลือกเคสนี้</button>
        `;
        cardFragment.appendChild(div);
      });
      cardList.appendChild(cardFragment);
    }

    const msg = data.length > renderList.length
      ? `พบ ${data.length} รายการ แสดงการ์ด ${renderList.length} รายการล่าสุด ถ้าต้องการเจาะจงให้ค้นหาด้วย Incident ID / รหัสตู้ / เลขงาน BEM`
      : `พบ ${data.length} รายการ เลือกการ์ดหรือเลือกจาก Dropdown เพื่ออัปเดตสถานะ`;
    showResult(resultBox, true, msg);
  } catch (error) {
    if (loadSeq !== updateIncidentLoadSeq) return;
    showResult(resultBox, false, "โหลด Incident ไม่สำเร็จ: " + error);
  }
}

async function loadIncidentHistoryPage() {
  const select = document.getElementById("incidentHistorySelect");
  const resultBox = document.getElementById("incidentHistoryResult");
  const tbody = document.getElementById("incidentHistoryTableBody");
  const timeline = document.getElementById("incidentTimeline");

  if (!select) return;

  const dateFilter = document.getElementById("incidentHistoryDateFilter")?.value || "all";
  const statusFilter = document.getElementById("incidentHistoryStatusFilter")?.value || "all";
  const startDate = document.getElementById("incidentHistoryStartDate")?.value || "";
  const endDate = document.getElementById("incidentHistoryEndDate")?.value || "";
  const fridgeSearch = document.getElementById("incidentHistoryFridgeSearch")?.value?.trim() || "";

  select.innerHTML = '<option value="">-- เลือก Incident ID --</option>';
  if (tbody) tbody.innerHTML = "";
  if (timeline) timeline.innerHTML = "";
  incidentHistoryListCache = [];

  try {
    const url =
      `${WEB_APP_URL}?action=incident_all_list`
      + `&dateFilter=${encodeURIComponent(dateFilter)}`
      + `&statusFilter=${encodeURIComponent(statusFilter)}`
      + `&startDate=${encodeURIComponent(startDate)}`
      + `&endDate=${encodeURIComponent(endDate)}`
      + `&fridgeSearch=${encodeURIComponent(fridgeSearch)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      showResult(resultBox, true, "ไม่พบ Incident ตามตัวกรอง");
      return;
    }

    incidentHistoryListCache = data;

    data.forEach(item => {
      const option = document.createElement("option");
      option.value = item.incidentId;
      option.textContent =
        `${item.incidentId} | ${item.foundDate || "-"} ${item.foundTime || "-"} | ${item.fridgeId || "-"} | ${item.caseStatus || "-"}`;
      select.appendChild(option);
    });

    showResult(resultBox, true, `พบ ${data.length} Incident กรุณาเลือก Incident เพื่อดู Timeline`);

    if (data.length === 1) {
      select.value = data[0].incidentId;
      await loadIncidentHistory();
    }

  } catch (error) {
    showResult(resultBox, false, "โหลดรายการ Incident ไม่สำเร็จ: " + error);
  }
}

async function loadIncidentHistory() {
  const incidentId = document.getElementById("incidentHistorySelect")?.value || "";
  const resultBox = document.getElementById("incidentHistoryResult");
  const tbody = document.getElementById("incidentHistoryTableBody");
  const timeline = document.getElementById("incidentTimeline");

  if (!incidentId) {
    showResult(resultBox, false, "กรุณาเลือก Incident");
    return;
  }

  tbody.innerHTML = "";
  timeline.innerHTML = "";

  try {
    const response = await fetch(`${WEB_APP_URL}?action=incident_history&incidentId=${encodeURIComponent(incidentId)}`);
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      showResult(resultBox, true, "ไม่พบประวัติการอัปเดต");
      return;
    }

    showResult(resultBox, true, `พบ ${data.length} รายการ`);

    data.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.incidentId || ""}</td>
        <td>${item.updatedAt || ""}</td>
        <td><span class="status-badge ${getIncidentStatusClass(item.caseStatus)}">${item.caseStatus || ""}</span></td>
        <td>${staffNameForUI(item.owner) || ""}</td>
        <td>${item.actionText || "-"}</td>
        <td>${item.fixResult || "-"}</td>
        <td>${staffNameForUI(item.updatedBy) || ""}</td>
      `;
      tbody.appendChild(tr);

      const div = document.createElement("div");
      div.className = "timeline-item";
      div.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-time">${item.updatedAt || ""}</div>
        <div class="timeline-status">${item.caseStatus || ""}</div>
        <div class="timeline-body">
          <div><strong>ผู้ดำเนินการ:</strong> ${staffNameForUI(item.owner) || "-"}</div>
          <div><strong>รายละเอียด:</strong> ${item.actionText || "-"}</div>
          <div><strong>ผลการแก้ไข:</strong> ${item.fixResult || "-"}</div>
          <div><strong>ผู้อัปเดต:</strong> ${staffNameForUI(item.updatedBy) || "-"}</div>
        </div>
      `;
      timeline.appendChild(div);
    });

  } catch (error) {
    showResult(resultBox, false, "โหลดประวัติการอัปเดตไม่สำเร็จ: " + error);
  }
}

function clearIncidentHistory() {
  const select = document.getElementById("incidentHistorySelect");
  const resultBox = document.getElementById("incidentHistoryResult");
  const tbody = document.getElementById("incidentHistoryTableBody");
  const timeline = document.getElementById("incidentTimeline");

  if (select) select.value = "";
  if (tbody) tbody.innerHTML = "";
  if (timeline) timeline.innerHTML = "";

  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }
}

  async function loadFridgeStatusList() {
  const select = document.getElementById("statusFridgeSelect");
  const resultBox = document.getElementById("fridgeStatusResult");

  if (!select) return;

  select.innerHTML = `<option value="">-- เลือกตู้ --</option>`;

  try {
    const response = await fetch(`${WEB_APP_URL}?action=all_fridge_list`);
    const data = await response.json();

    fridgeStatusListCache = Array.isArray(data) ? data : [];

    fridgeStatusListCache.forEach(item => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.id} | ${item.name || "-"} | ${item.room || "-"} | สถานะ: ${item.status || "-"}`;
      select.appendChild(option);
    });

    showResult(resultBox, true, "โหลดรายการตู้สำเร็จ");

  } catch (error) {
    showResult(resultBox, false, "โหลดรายการตู้ไม่สำเร็จ: " + error);
  }
}

    function onStatusFridgeChange() {
  const fridgeId = document.getElementById("statusFridgeSelect")?.value || "";
  const infoBox = document.getElementById("statusFridgeInfo");

  if (!infoBox) return;

  const item = fridgeStatusListCache.find(x => x.id === fridgeId);

  if (!item) {
    infoBox.innerHTML = "กรุณาเลือกตู้";
    return;
  }

  infoBox.innerHTML = `
    <strong>รหัสตู้:</strong> ${item.id || "-"}<br>
    <strong>ชื่อตู้:</strong> ${item.name || "-"}<br>
    <strong>ประเภท:</strong> ${item.type || "-"}<br>
    <strong>สถานที่:</strong> ${item.room || "-"}<br>
    <strong>สถานะปัจจุบัน:</strong> ${normalizeFridgeUsageStatusForUI(item.status) || "-"}<br>
    <strong>เหตุผลล่าสุด:</strong> ${item.inactiveReason || "-"}<br>
    <strong>วันที่เริ่มเลิกใช้งาน:</strong> ${item.inactiveStartDate || "-"}<br>
    <strong>ผู้ปรับสถานะล่าสุด:</strong> ${staffNameForUI(item.statusUpdatedBy) || "-"}<br>
    <strong>วันที่อัปเดตล่าสุด:</strong> ${item.statusUpdatedAt || "-"}<br>
    <strong>ช่วงอุณหภูมิ:</strong> ${item.minTemp ?? "-"} ถึง ${item.maxTemp ?? "-"} °C
  `;
}

    function onNewFridgeStatusChange() {
  const status = document.getElementById("newFridgeStatus")?.value || "";
  const reasonBox = document.getElementById("statusReasonBox");
  const reasonSelect = document.getElementById("statusReason");

  if (!reasonBox || !reasonSelect) return;

  if (status === "ใช้งาน") {
    reasonBox.classList.add("hidden");
    reasonSelect.value = "";
  } else {
    reasonBox.classList.remove("hidden");
  }
}

    async function submitFridgeStatusUpdate() {
  const resultBox = document.getElementById("fridgeStatusResult");

  const fridgeId = document.getElementById("statusFridgeSelect")?.value || "";
  const status = document.getElementById("newFridgeStatus")?.value || "";
  const reason = document.getElementById("statusReason")?.value || "";
  const detail = document.getElementById("statusDetail")?.value?.trim() || "";
  syncLoginIdentityFields();
  const updatedByRaw = AUTH_DISABLED_TEMPORARILY
    ? (document.getElementById("statusUpdatedBy")?.value?.trim() || "")
    : (getCurrentActorFullName() || getCurrentActorEmail());
  const updatedBy = await resolveStaffFullNameForUI(updatedByRaw);

  if (!fridgeId) {
    showResult(resultBox, false, "กรุณาเลือกตู้");
    return;
  }

  if (!status) {
    showResult(resultBox, false, "กรุณาเลือกสถานะใหม่");
    return;
  }

  if (!updatedBy) {
    showResult(resultBox, false, "กรุณากรอกชื่อผู้ปรับสถานะ");
    return;
  }

  if (status !== "ใช้งาน" && !reason) {
    showResult(resultBox, false, "กรุณาเลือกเหตุผล");
    return;
  }

  const url =
    `${WEB_APP_URL}?action=update_fridge_status` +
    `&fridgeId=${encodeURIComponent(fridgeId)}` +
    `&status=${encodeURIComponent(status)}` +
    `&reason=${encodeURIComponent(reason)}` +
    `&detail=${encodeURIComponent(detail)}` +
    `&updatedBy=${encodeURIComponent(updatedBy)}` +
    `&actorUserId=${encodeURIComponent(getCurrentActorId())}` +
    `&actorEmail=${encodeURIComponent(getCurrentActorEmail())}` +
    `&actorFullName=${encodeURIComponent(getCurrentActorFullName())}` +
    `&actorRole=${encodeURIComponent(getCurrentActorRole())}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.ok) {
      showResult(resultBox, true, data.message || "อัปเดตสถานะตู้เรียบร้อย");

      if (typeof showAppPopup === "function") {
        showAppPopup(
          true,
          "อัปเดตสถานะสำเร็จ",
          `${data.fridgeId || ""}\nสถานะใหม่: ${data.newStatus || status}`
        );
      }

      clearFridgeStatusForm();
      loadFridgeStatusList();

      if (typeof loadDashboard === "function") {
        loadDashboard();
      }

    } else {
      showResult(resultBox, false, data.message || "อัปเดตสถานะตู้ไม่สำเร็จ");

      if (typeof showAppPopup === "function") {
        showAppPopup(false, "อัปเดตไม่สำเร็จ", data.message || "กรุณาตรวจสอบข้อมูล");
      }
    }

  } catch (error) {
    showResult(resultBox, false, "อัปเดตสถานะตู้ไม่สำเร็จ: " + error);
  }
}

function clearFridgeStatusForm() {
  const statusFridgeSelect = document.getElementById("statusFridgeSelect");
  const statusFridgeInfo = document.getElementById("statusFridgeInfo");
  const newFridgeStatus = document.getElementById("newFridgeStatus");
  const statusReason = document.getElementById("statusReason");
  const statusDetail = document.getElementById("statusDetail");
  const statusUpdatedBy = document.getElementById("statusUpdatedBy");
  const resultBox = document.getElementById("fridgeStatusResult");

  if (statusFridgeSelect) statusFridgeSelect.value = "";
  if (statusFridgeInfo) statusFridgeInfo.innerHTML = "กรุณาเลือกตู้";
  if (newFridgeStatus) newFridgeStatus.value = "";
  if (statusReason) statusReason.value = "";
  if (statusDetail) statusDetail.value = "";
  if (statusUpdatedBy) statusUpdatedBy.value = getCurrentActorFullName() || getCurrentActorEmail() || "";

  syncLoginIdentityFields();
  onNewFridgeStatusChange();

  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }
}
    
    
function fillUpdateIncidentId() {
  const select = document.getElementById("updateIncidentSelect");
  const value = select?.value || "";
  selectUpdateIncident(value);
}

function selectUpdateIncident(incidentId) {
  const select = document.getElementById("updateIncidentSelect");
  const input = document.getElementById("updateIncidentId");

  if (select && incidentId) select.value = incidentId;
  if (input) input.value = incidentId || "";

  const item = updateIncidentListCache.find(x => x.incidentId === incidentId) || null;
  renderUpdateIncidentSummary(item);
}

function renderUpdateIncidentSummary(item) {
  const box = document.getElementById("updateIncidentSummary");
  if (!box) return;

  if (!item) {
    box.classList.add("hidden");
    box.innerHTML = "";
    setCurrentIncidentStatusLabel("");
    return;
  }

  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="incident-summary-title">เคสที่เลือก: ${escapeHtml(item.incidentId || "-")}</div>
    <div class="incident-summary-grid">
      <div><strong>ตู้:</strong> ${escapeHtml(item.fridgeId || "-")}</div>
      <div><strong>สถานที่:</strong> ${escapeHtml(item.room || "-")}</div>
      <div><strong>วันเวลาเกิดเหตุ:</strong> ${escapeHtml(item.foundDate || "-")} ${escapeHtml(item.foundTime || "-")}</div>
      <div><strong>รอบ:</strong> ${escapeHtml(item.round || "-")}</div>
      <div><strong>อุณหภูมิ:</strong> ${item.temp === null || item.temp === undefined ? "-" : escapeHtml(item.temp)} °C</div>
      <div><strong>ผู้รายงาน:</strong> ${escapeHtml(staffNameForUI(item.reporter) || "-")}</div>
      <div class="full"><strong>รายละเอียดเดิม:</strong> ${escapeHtml(item.logNote || item.actionText || "-")}</div>
    </div>
  `;
}

async function loadDashboard() {
  const resultBox = document.getElementById("dashboardResult");
  const cardContainer = document.getElementById("dashboardCardContainer");
  const title = document.getElementById("dashboardDrillTitle");

  if (!cardContainer) return;
  cardContainer.innerHTML = "";

  try {
    const dashboardDateInput = document.getElementById("dashboardDate");

    if (dashboardDateInput) {
      if (!dashboardDateInput.value || !/^\d{4}-\d{2}-\d{2}$/.test(dashboardDateInput.value)) {
        dashboardDateInput.value = getTodayYMD();
      }
    }

    const selectedDate =
      dashboardDateInput && /^\d{4}-\d{2}-\d{2}$/.test(dashboardDateInput.value)
        ? dashboardDateInput.value
        : getTodayYMD();
    const response = await fetch(
      `${WEB_APP_URL}?action=dashboard_summary&date=${encodeURIComponent(selectedDate)}`
    );
    const data = await response.json();

    if (!data.ok) {
      showResult(resultBox, false, data.message || "โหลดภาพรวมไม่สำเร็จ");
      return;
    }

    // ===== ใช้ข้อมูลจาก Apps Script รูปแบบใหม่ =====
    const summary = {
      activeFridges: data.totalActive ?? data.totalFridges ?? data.totalRequired ?? 0,
      openIncidents: data.openIncidentCount ?? data.abnormalOpenCount ?? 0,
      closedAll: data.closedIncidentCount ?? data.closedTotal ?? data.closedToday ?? 0,
      missingToday: data.currentMissing ?? data.missingToday ?? data.missingCount ?? 0,
      recordedToday: data.currentRecorded ?? data.recordedToday ?? data.loggedCount ?? 0,
      currentRound: data.currentRound ?? data.targetRound ?? "-"
    };

    // ===== เก็บ list แยก เช้า/เย็น จาก Apps Script =====
    dashboardListsCache = {
      morningRecorded: Array.isArray(data.morningRecordedList) ? data.morningRecordedList : [],
      morningMissing: Array.isArray(data.morningMissingList) ? data.morningMissingList : [],
      eveningRecorded: Array.isArray(data.eveningRecordedList) ? data.eveningRecordedList : [],
      eveningMissing: Array.isArray(data.eveningMissingList) ? data.eveningMissingList : []
    };

    // ===== list เดิมของรอบปัจจุบัน เอาไว้กันฟังก์ชันเดิมพัง =====
    dashboardRowsCache = Array.isArray(data.missingList)
      ? data.missingList.map(item => ({
          ...item,
          dashboardStatus: item.dashboardStatus || "missing",
          currentRound: summary.currentRound,
          latestStamp: item.latestStamp || "-",
          latestRound: item.latestRound || summary.currentRound,
          latestTemp: item.latestTemp ?? "",
          latestAction: item.latestAction || ""
        }))
      : [];

    dashboardSummaryCache = summary;

    const cardActiveFridges = document.getElementById("cardActiveFridges");
    const cardOpenIncidents = document.getElementById("cardOpenIncidents");
    const cardClosedToday = document.getElementById("cardClosedToday");
    const cardMonthlyKpi = document.getElementById("cardMonthlyKpi");
    const cardMonthlyKpiLabel = document.getElementById("cardMonthlyKpiLabel");
    
    const cardMorningRecorded = document.getElementById("cardMorningRecorded");
    const cardMorningMissing = document.getElementById("cardMorningMissing");
    const cardEveningRecorded = document.getElementById("cardEveningRecorded");
    const cardEveningMissing = document.getElementById("cardEveningMissing");

    if (cardActiveFridges) cardActiveFridges.innerText = summary.activeFridges;
    if (cardOpenIncidents) cardOpenIncidents.innerText = summary.openIncidents;
    if (cardClosedToday) cardClosedToday.innerText = summary.closedAll;

    // V1.8.34: หน้า Dashboard ไม่คำนวณ KPI รวมทุกแผนก
    // ผู้ใช้ต้องเลือกแผนกก่อน เพื่อป้องกัน Safari/iPhone ค้างจากการดึงข้อมูลทั้งเดือนจำนวนมาก
    if (cardMonthlyKpi) cardMonthlyKpi.innerText = "ดู";
    if (cardMonthlyKpiLabel) cardMonthlyKpiLabel.innerText = `${formatKpiMonthLabel(selectedDate.slice(0, 7))} • เลือกแผนกก่อนคำนวณ`;

    // ใช้จำนวนเคสเปิดจาก Dashboard แทนการดึง Incident ทั้งหมดซ้ำตอนเริ่มแอป
    const bemCountActive = document.getElementById("bemCountActive");
    const mobileIncidentActiveCount = document.getElementById("mobileIncidentActiveCount");
    if (bemCountActive) bemCountActive.innerText = String(summary.openIncidents);
    if (mobileIncidentActiveCount) mobileIncidentActiveCount.innerText = String(summary.openIncidents);
    
    if (cardMorningRecorded) cardMorningRecorded.innerText = data.morningRecorded ?? 0;
    if (cardMorningMissing) cardMorningMissing.innerText = data.morningMissing ?? 0;
    if (cardEveningRecorded) cardEveningRecorded.innerText = data.eveningRecorded ?? 0;
    if (cardEveningMissing) cardEveningMissing.innerText = data.eveningMissing ?? 0;

    showResult(
      resultBox,
      true,
      `โหลดภาพรวมสำเร็จ | วันที่ ${selectedDate}`
    );

    // V1.8.33: KPI จะคำนวณเมื่อผู้ใช้เปิดหน้า KPI เท่านั้น
    // ไม่เริ่มงานเบื้องหลังจากหน้า Dashboard เพื่อป้องกัน Safari WebContent crash

  } catch (error) {
    showResult(resultBox, false, "โหลดภาพรวมไม่สำเร็จ: " + error);
  }
}


let dashboardKpiMonth = "";
let kpiDepartmentsCache = [];

const KPI_METRIC_DEFINITIONS = Object.freeze({
  temperature_completeness: {
    title: "1. ร้อยละความครบถ้วนของการบันทึกอุณหภูมิ",
    definition: "เป้าหมาย 100% • 1 รายการ = 1 ตู้ × 1 รอบ ระบบไม่นับตู้เสีย ตู้งดใช้งาน หรือรายการที่ได้รับการยกเว้นตามเกณฑ์",
    target: 100,
    automatic: true
  },
  incident_timeline: {
    title: "2. ร้อยละ Incident ที่มีสถานะและ Timeline ครบถ้วน",
    definition: "เป้าหมาย 100% • เคสที่ยังดำเนินการต้องมีข้อมูลเปิดเหตุการณ์ สถานะ และ Timeline ล่าสุด ส่วนเคสปิดแล้วต้องมีผลการดำเนินการและเวลาปิดเคส",
    target: 100,
    automatic: true
  },
  paper_reduction: {
    title: "3. จำนวนกระดาษที่ลดลง",
    definition: "ประมาณการจากจำนวนตู้ที่ต้องบันทึก โดยเทียบฐานเดิม 1 ใบต่อตู้ต่อเดือนกับการบันทึกผ่านแอป",
    automatic: true
  },
  search_time: {
    title: "4. ระยะเวลาที่ใช้ค้นหาข้อมูลย้อนหลัง",
    definition: "ทดสอบตัวแทนทั้ง 3 แผนก แผนกละ 5 คน รวม 15 คน ด้วยโจทย์เดียวกัน จับเวลาแฟ้มกระดาษเทียบกับแอป แล้วให้ระบบคำนวณผลแยกแผนกและภาพรวมอัตโนมัติ",
    automatic: false
  }
});

const KPI_SEARCH_STORAGE_KEY = "cnmi_temp_kpi_search_time_v1848";
let selectedKpiMetric = "temperature_completeness";
let kpiMetricRequestToken = 0;
const KPI_ALL_DEPARTMENTS_VALUE = "__ALL__";
const KPI_TREND_START_MONTH = "2026-05";
let kpiTrendChart = null;
let kpiMissingTrendChart = null;
let kpiTrendRequestToken = 0;
let kpiTrendAbortController = null;
let lastKpiTrendData = null;
let kpiViewMode = "month";
let kpiTrendTab = "overview";

function getSelectedKpiMetric() {
  const value = document.getElementById("kpiMetricSelector")?.value || selectedKpiMetric;
  return KPI_METRIC_DEFINITIONS[value] ? value : "temperature_completeness";
}

function getKpiTargetClass(percent, target = 100) {
  const value = Number(percent || 0);
  if (value >= target) return "good";
  if (value >= 95) return "warn";
  return "danger";
}

function updateKpiTargetBadge(metric = getSelectedKpiMetric()) {
  const badge = document.getElementById("kpiTargetBadge");
  if (!badge) return;
  const target = Number(KPI_METRIC_DEFINITIONS[metric]?.target || 0);
  badge.classList.toggle("hidden", !target);
  if (target) badge.textContent = `เป้าหมาย ${target}%`;
}

function cancelKpiRequest() {
  kpiPageRequestToken += 1;
  kpiMetricRequestToken += 1;
  kpiTrendRequestToken += 1;
  if (kpiPageAbortController) {
    try { kpiPageAbortController.abort(); } catch (e) {}
    kpiPageAbortController = null;
  }
  if (kpiTrendAbortController) {
    try { kpiTrendAbortController.abort(); } catch (e) {}
    kpiTrendAbortController = null;
  }
}

function updateKpiMetricDefinition(metric = getSelectedKpiMetric()) {
  const definition = KPI_METRIC_DEFINITIONS[metric] || KPI_METRIC_DEFINITIONS.temperature_completeness;
  const selectorNote = document.getElementById("kpiMetricDefinition");
  const definitionText = document.getElementById("kpiMetricDefinitionText");
  if (selectorNote) selectorNote.innerText = definition.definition;
  if (definitionText) definitionText.innerText = definition.definition;
  updateKpiTargetBadge(metric);
}

function setKpiMetricVisibility(metric = getSelectedKpiMetric()) {
  const autoFilter = document.getElementById("kpiAutoFilterPanel");
  const temperatureOutput = document.getElementById("kpiTemperatureOutput");
  const metricOutput = document.getElementById("kpiMetricOutput");
  const manualOutput = document.getElementById("kpiManualSearchOutput");
  const definitionTitle = document.getElementById("kpiMetricTitle");
  const isManual = metric === "search_time";
  const isTemperature = metric === "temperature_completeness";

  if (autoFilter) autoFilter.classList.toggle("hidden", isManual);
  if (temperatureOutput) temperatureOutput.classList.toggle("hidden", !isTemperature);
  if (metricOutput) metricOutput.classList.add("hidden");
  if (manualOutput) manualOutput.classList.toggle("hidden", !isManual);
  if (definitionTitle) definitionTitle.innerText = KPI_METRIC_DEFINITIONS[metric]?.title || "-";
  updateKpiMetricDefinition(metric);
  if (isManual) loadKpiSearchInputs();
  setKpiShowButtonState();
}

function formatKpiMonthLabel(monthValue) {
  const text = String(monthValue || "").trim();
  const match = text.match(/^(\d{4})-(\d{2})$/);
  if (!match) return text || "-";
  const monthNames = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${monthNames[Number(match[2]) - 1] || match[2]} ${Number(match[1]) + 543}`;
}

const DASHBOARD_KPI_CACHE_PREFIX = "cnmi_dashboard_kpi_v1836_";
const DASHBOARD_KPI_CACHE_MS = 15 * 60 * 1000;
let dashboardKpiRequestToken = 0;
let kpiPageRequestToken = 0;
let kpiPageAbortController = null;

function readDashboardKpiCache(month) {
  try {
    const raw = window.sessionStorage?.getItem(DASHBOARD_KPI_CACHE_PREFIX + month);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - Number(parsed.savedAt || 0) > DASHBOARD_KPI_CACHE_MS) return null;
    return parsed.data || null;
  } catch (error) {
    return null;
  }
}

function writeDashboardKpiCache(month, data) {
  try {
    window.sessionStorage?.setItem(DASHBOARD_KPI_CACHE_PREFIX + month, JSON.stringify({ savedAt: Date.now(), data }));
  } catch (error) {}
}

function fetchJsonWithTimeout(url, timeoutMs = 20000) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
  return fetch(url, controller ? { signal: controller.signal } : undefined)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .finally(() => { if (timer) window.clearTimeout(timer); });
}

function applyDashboardKpi(data, month, valueEl, labelEl) {
  const percent = Number(data?.summary?.percentage ?? 0);
  if (valueEl) valueEl.innerText = `${percent.toFixed(1)}%`;
  if (labelEl) labelEl.innerText = `${formatKpiMonthLabel(month)} • ไม่ครบ ${Number(data?.summary?.incompleteRounds ?? 0)} รอบ`;
}

async function loadDashboardKpi(monthValue) {
  dashboardKpiMonth = monthValue || getTodayYMD().slice(0, 7);
  const valueEl = document.getElementById("cardMonthlyKpi");
  const labelEl = document.getElementById("cardMonthlyKpiLabel");
  if (valueEl) valueEl.innerText = "ดู";
  if (labelEl) labelEl.innerText = `${formatKpiMonthLabel(dashboardKpiMonth)} • เลือกแผนกก่อนคำนวณ`;
}

function openKpiFromDashboard() {
  const month = dashboardKpiMonth || document.getElementById("dashboardDate")?.value?.slice(0, 7) || getTodayYMD().slice(0, 7);
  const monthInput = document.getElementById("kpiMonth");
  if (monthInput) monthInput.value = month;
  const menuButton = document.querySelector('.menu-btn[data-menu-key="kpi"]');
  showPage("kpiPage", menuButton || null);
  initKpiPage();
}

function setKpiOutputVisible(visible) {
  const output = document.getElementById("kpiTemperatureOutput");
  if (!output) return;
  output.classList.toggle("hidden", !visible);
}

function setKpiShowButtonState() {
  const button = document.getElementById("kpiShowButton");
  const metric = getSelectedKpiMetric();
  const department = document.getElementById("kpiDepartment")?.value || "";
  if (button) {
    button.classList.toggle("hidden", metric === "search_time");
    button.disabled = metric === "search_time" || !department;
  }
}

function resetKpiResultCards() {
  resetKpiTrendOutput();
  setKpiText("kpiTotalRounds", 0);
  setKpiText("kpiCompleteRounds", 0);
  setKpiText("kpiIncompleteRounds", 0);
  setKpiText("kpiPercentage", "0%");
  renderKpiDepartments([]);
  renderKpiMissingList([]);
  setKpiOutputVisible(false);
  resetKpiMetricOutput();
}

function resetKpiMetricOutput() {
  setKpiText("kpiMetricValueTotal", 0);
  setKpiText("kpiMetricValueComplete", 0);
  setKpiText("kpiMetricValueIncomplete", 0);
  setKpiText("kpiMetricValuePercent", "0%");
  setKpiText("kpiMetricLabelTotal", "รายการที่ประเมิน");
  setKpiText("kpiMetricLabelComplete", "ครบถ้วน");
  setKpiText("kpiMetricLabelIncomplete", "ไม่ครบถ้วน");
  setKpiText("kpiMetricLabelPercent", "ความครบถ้วน");
  const extra = document.getElementById("kpiMetricExtra");
  const examples = document.getElementById("kpiMetricExamples");
  const exampleList = document.getElementById("kpiMetricExampleList");
  if (extra) extra.innerHTML = "";
  if (examples) examples.classList.add("hidden");
  if (exampleList) exampleList.innerHTML = "";
  const metricOutput = document.getElementById("kpiMetricOutput");
  if (metricOutput) metricOutput.classList.add("hidden");
}

function clearKpiFilters() {
  if (getSelectedKpiMetric() === "search_time") {
    clearKpiSearchInputs();
    return;
  }
  const month = document.getElementById("kpiMonth");
  const department = document.getElementById("kpiDepartment");
  if (month) month.value = getTodayYMD().slice(0, 7);
  if (department) department.value = getSelectedKpiMetric() === "temperature_completeness" ? KPI_ALL_DEPARTMENTS_VALUE : "";
  resetKpiResultCards();
  setKpiShowButtonState();
  showResult(document.getElementById("kpiResult"), true, "เลือกเดือนและแผนก แล้วกด “แสดงผล”");
}

function setKpiText(id, value) {
  const el = document.getElementById(id);
  if (el) el.innerText = value;
}

function destroyKpiTrendCharts() {
  try { if (kpiTrendChart) kpiTrendChart.destroy(); } catch (e) {}
  try { if (kpiMissingTrendChart) kpiMissingTrendChart.destroy(); } catch (e) {}
  kpiTrendChart = null;
  kpiMissingTrendChart = null;
}

function resetKpiTrendOutput() {
  destroyKpiTrendCharts();
  lastKpiTrendData = null;
  const section = document.getElementById("kpiTrendSection");
  if (section) section.classList.add("hidden");
  setKpiText("kpiTrendTotalRounds", 0);
  setKpiText("kpiTrendCompleteRounds", 0);
  setKpiText("kpiTrendIncompleteRounds", 0);
  setKpiText("kpiTrendPercentage", "0%");
  const period = document.getElementById("kpiTrendPeriod");
  if (period) period.innerText = "ตั้งแต่ พ.ค. 2569";
  const status = document.getElementById("kpiTrendStatus");
  if (status) status.innerText = "-";
  const dept = document.getElementById("kpiTrendDepartmentSummary");
  if (dept) dept.innerHTML = "";
  const head = document.getElementById("kpiTrendTableHead");
  const body = document.getElementById("kpiTrendTableBody");
  if (head) head.innerHTML = "";
  if (body) body.innerHTML = "";
}

function renderKpiTrendError(message) {
  const section = document.getElementById("kpiTrendSection");
  if (!section) return;
  section.classList.remove("hidden");
  const status = document.getElementById("kpiTrendStatus");
  if (status) status.innerText = "กราฟโหลดไม่สำเร็จ";
  const dept = document.getElementById("kpiTrendDepartmentSummary");
  if (dept) dept.innerHTML = `<div class="empty-friendly-card">${escapeHtml(message || "โหลดกราฟ KPI ไม่สำเร็จ")}</div>`;
  destroyKpiTrendCharts();
}

function safeExportFilePart(value, fallback = "export") {
  const text = String(value || fallback).trim();
  return text.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_").slice(0, 80) || fallback;
}

function downloadTextFile(content, fileName, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function exportKpiTableCSV() {
  const data = lastKpiTrendData;
  const months = Array.isArray(data?.months) ? data.months : [];
  const departments = Array.isArray(data?.departments) ? data.departments : [];
  if (!months.length) {
    alert("ยังไม่มีตาราง KPI สำหรับ Export กรุณากดแสดงผลก่อน");
    return;
  }
  const headers = [
    "เดือน",
    "รวม-รอบที่ประเมิน", "รวม-บันทึกครบ", "รวม-บันทึกไม่ครบ", "รวม-ความครบถ้วน (%)", "รวม-รายการตู้ที่ขาด", "รวม-รายการยกเว้น"
  ];
  departments.forEach(name => {
    headers.push(`${name}-รอบที่ประเมิน`, `${name}-บันทึกครบ`, `${name}-บันทึกไม่ครบ`, `${name}-ความครบถ้วน (%)`, `${name}-รายการตู้ที่ขาด`, `${name}-รายการยกเว้น`);
  });
  const rows = months.map(item => {
    const combined = item.combined || {};
    const byDept = new Map((item.departments || []).map(row => [String(row.department || ""), row]));
    const row = [
      formatKpiMonthLabel(item.month),
      Number(combined.totalRounds || 0), Number(combined.completeRounds || 0), Number(combined.incompleteRounds || 0), Number(combined.percentage || 0).toFixed(1), Number(combined.missingRecordCount || 0), Number(combined.exemptRecordCount || 0)
    ];
    departments.forEach(name => {
      const d = byDept.get(name) || {};
      row.push(Number(d.totalRounds || 0), Number(d.completeRounds || 0), Number(d.incompleteRounds || 0), Number(d.percentage || 0).toFixed(1), Number(d.missingRecordCount || 0), Number(d.exemptRecordCount || 0));
    });
    return row;
  });
  const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const start = data?.startMonth || KPI_TREND_START_MONTH;
  const end = data?.endMonth || getTodayYMD().slice(0, 7);
  downloadTextFile("\ufeff" + csv, `KPI_temperature_${safeExportFilePart(start)}_to_${safeExportFilePart(end)}.csv`, "text/csv;charset=utf-8");
}

function canvasWithWhiteBackground(sourceCanvas, title = "") {
  const padding = 24;
  const titleHeight = title ? 48 : 0;
  const out = document.createElement("canvas");
  out.width = Math.max(1, sourceCanvas.width + padding * 2);
  out.height = Math.max(1, sourceCanvas.height + padding * 2 + titleHeight);
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  if (title) {
    ctx.fillStyle = "#0f172a";
    ctx.font = "700 22px Arial, sans-serif";
    ctx.fillText(title, padding, 32);
  }
  ctx.drawImage(sourceCanvas, padding, padding + titleHeight);
  return out;
}

function downloadCanvasPNG(canvas, fileName) {
  if (!canvas || !canvas.width || !canvas.height) return false;
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png", 1);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}

function drawKpiExportHeading(ctx, x, y, title, subtitle = "") {
  ctx.fillStyle = "#0f172a";
  ctx.font = '700 22px "Noto Sans Thai", Tahoma, Arial, sans-serif';
  ctx.fillText(String(title || ""), x, y + 26);
  if (subtitle) {
    ctx.fillStyle = "#64748b";
    ctx.font = '400 15px "Noto Sans Thai", Tahoma, Arial, sans-serif';
    ctx.fillText(String(subtitle), x, y + 50);
  }
}

function exportKpiChartsPNG() {
  const chart1 = document.getElementById("kpiTrendChart");
  const chart2 = document.getElementById("kpiMissingTrendChart");
  if (!lastKpiTrendData || !chart1?.width || !chart2?.width) {
    alert("ยังไม่มีกราฟ KPI สำหรับ Export กรุณากดแสดงผลก่อน");
    return;
  }
  const gap = 34;
  const padding = 30;
  const mainHeaderHeight = 80;
  const chartHeaderHeight = 64;
  const width = Math.max(chart1.width, chart2.width) + padding * 2;
  const height = padding * 2 + mainHeaderHeight + chartHeaderHeight + chart1.height + gap + chartHeaderHeight + chart2.height;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#0f172a";
  ctx.font = '700 26px "Noto Sans Thai", Tahoma, Arial, sans-serif';
  ctx.fillText("KPI การบันทึกอุณหภูมิย้อนหลัง", padding, padding + 28);
  ctx.font = '400 16px "Noto Sans Thai", Tahoma, Arial, sans-serif';
  ctx.fillStyle = "#64748b";
  const period = `${formatKpiMonthLabel(lastKpiTrendData.startMonth || KPI_TREND_START_MONTH)} – ${formatKpiMonthLabel(lastKpiTrendData.endMonth || getTodayYMD().slice(0, 7))}`;
  ctx.fillText(period, padding, padding + 55);

  let y = padding + mainHeaderHeight;
  drawKpiExportHeading(ctx, padding, y, "แนวโน้มความครบถ้วนรายเดือน", "คำนวณตามรายการจริง: 1 ตู้ × 1 รอบ (%)");
  y += chartHeaderHeight;
  ctx.drawImage(chart1, padding, y);
  y += chart1.height + gap;
  drawKpiExportHeading(ctx, padding, y, "รายการที่บันทึกไม่ครบรายเดือน", "แยกจำนวนรายการตู้ × รอบตามแผนก");
  y += chartHeaderHeight;
  ctx.drawImage(chart2, padding, y);

  const end = lastKpiTrendData?.endMonth || getTodayYMD().slice(0, 7);
  downloadCanvasPNG(out, `KPI_temperature_graph_${safeExportFilePart(end)}.png`);
}

function exportTemperatureChartPNG() {
  const canvas = document.getElementById("tempChart");
  if (!tempChart || !canvas?.width || !canvas?.height) {
    alert("ยังไม่มีกราฟอุณหภูมิสำหรับ Export กรุณาแสดงกราฟก่อน");
    return;
  }
  const fridgeId = document.getElementById("chartFridgeId")?.value?.trim() || "fridge";
  const startDate = document.getElementById("chartStartDate")?.value || "start";
  const endDate = document.getElementById("chartEndDate")?.value || "end";
  const titled = canvasWithWhiteBackground(canvas, `Temperature ${fridgeId} ${startDate} - ${endDate}`);
  downloadCanvasPNG(titled, `temperature_${safeExportFilePart(fridgeId)}_${safeExportFilePart(startDate)}_${safeExportFilePart(endDate)}.png`);
}

function renderKpiTrendDepartmentSummary(rows) {
  const container = document.getElementById("kpiTrendDepartmentSummary");
  if (!container) return;
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    container.innerHTML = '<div class="empty-friendly-card">ยังไม่มีข้อมูลรายแผนกในช่วงนี้</div>';
    return;
  }
  container.innerHTML = list.map(row => {
    const percent = Number(row.percentage || 0);
    return `<article class="kpi-department-card kpi-trend-department-card">
      <div class="kpi-department-head">
        <div>
          <div class="kpi-department-name">${escapeHtml(row.department || "-")}</div>
          <div class="kpi-department-meta">ประเมิน ${Number(row.totalRounds || 0)} รอบ • ขาด ${Number(row.incompleteRounds || 0)} รอบ</div>
        </div>
        <div class="kpi-percent-badge ${getKpiTargetClass(percent, 100)}">${percent.toFixed(1)}%</div>
      </div>
      <div class="kpi-progress"><span style="width:${Math.max(0, Math.min(100, percent))}%"></span></div>
    </article>`;
  }).join("");
}

function renderKpiTrendTable(data) {
  const head = document.getElementById("kpiTrendTableHead");
  const body = document.getElementById("kpiTrendTableBody");
  if (!head || !body) return;
  const departments = Array.isArray(data?.departments) ? data.departments : [];
  const months = Array.isArray(data?.months) ? data.months : [];
  head.innerHTML = `<tr><th>เดือน</th><th>รวมทุกแผนก</th>${departments.map(name => `<th>${escapeHtml(name)}</th>`).join("")}<th>ขาดรวม</th></tr>`;
  if (!months.length) {
    body.innerHTML = '<tr><td colspan="99">ยังไม่มีข้อมูลในช่วงที่เลือก</td></tr>';
    return;
  }
  body.innerHTML = months.map(item => {
    const byDept = new Map((item.departments || []).map(row => [String(row.department || ""), row]));
    return `<tr>
      <td><strong>${escapeHtml(formatKpiMonthLabel(item.month))}</strong></td>
      <td>${Number(item.combined?.percentage || 0).toFixed(1)}% <span class="kpi-table-sub">(ขาด ${Number(item.combined?.incompleteRounds || 0)})</span></td>
      ${departments.map(name => {
        const row = byDept.get(name) || {};
        return `<td>${Number(row.percentage || 0).toFixed(1)}% <span class="kpi-table-sub">(ขาด ${Number(row.incompleteRounds || 0)})</span></td>`;
      }).join("")}
      <td>${Number(item.combined?.incompleteRounds || 0)}</td>
    </tr>`;
  }).join("");
}

function renderKpiTrendCharts(data) {
  destroyKpiTrendCharts();
  if (typeof Chart === "undefined") return;
  const months = Array.isArray(data?.months) ? data.months : [];
  const departments = Array.isArray(data?.departments) ? data.departments : [];
  if (!months.length) return;

  const labels = months.map(item => formatKpiMonthLabel(item.month));
  const palette = ["#2563eb", "#059669", "#d97706", "#7c3aed", "#0891b2", "#dc2626"];
  const combinedColor = "#111827";

  const lineCanvas = document.getElementById("kpiTrendChart");
  if (lineCanvas) {
    const datasets = [{
      label: "รวมทุกแผนก",
      data: months.map(item => Number(item.combined?.percentage || 0)),
      borderColor: combinedColor,
      backgroundColor: combinedColor,
      borderWidth: 3,
      pointRadius: 3,
      tension: 0,
      fill: false
    }];
    departments.forEach((department, index) => {
      datasets.push({
        label: department,
        data: months.map(item => {
          const row = (item.departments || []).find(x => String(x.department || "") === department);
          return Number(row?.percentage || 0);
        }),
        borderColor: palette[index % palette.length],
        backgroundColor: palette[index % palette.length],
        borderWidth: 2,
        pointRadius: 2.5,
        tension: 0,
        fill: false
      });
    });
    kpiTrendChart = new Chart(lineCanvas.getContext("2d"), {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          y: { min: 0, max: 100, ticks: { callback: value => `${value}%` } }
        },
        plugins: {
          legend: { position: "bottom" },
          tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${Number(ctx.parsed.y || 0).toFixed(1)}%` } }
        }
      }
    });
  }

  const missingCanvas = document.getElementById("kpiMissingTrendChart");
  if (missingCanvas) {
    const datasets = departments.map((department, index) => ({
      label: department,
      data: months.map(item => {
        const row = (item.departments || []).find(x => String(x.department || "") === department);
        return Number(row?.incompleteRounds || 0);
      }),
      backgroundColor: palette[index % palette.length],
      borderColor: palette[index % palette.length],
      borderWidth: 1,
      stack: "missing"
    }));
    kpiMissingTrendChart = new Chart(missingCanvas.getContext("2d"), {
      type: "bar",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
        },
        plugins: { legend: { position: "bottom" } }
      }
    });
  }
}

function renderKpiTrendData(data) {
  lastKpiTrendData = data || null;
  const section = document.getElementById("kpiTrendSection");
  if (!section) return;
  section.classList.remove("hidden");
  const summary = data?.rangeSummary || {};
  setKpiText("kpiTrendTotalRounds", Number(summary.totalRounds || 0));
  setKpiText("kpiTrendCompleteRounds", Number(summary.completeRounds || 0));
  setKpiText("kpiTrendIncompleteRounds", Number(summary.incompleteRounds || 0));
  setKpiText("kpiTrendPercentage", `${Number(summary.percentage || 0).toFixed(1)}%`);
  const period = document.getElementById("kpiTrendPeriod");
  if (period) period.innerText = `${formatKpiMonthLabel(data?.startMonth || KPI_TREND_START_MONTH)} – ${formatKpiMonthLabel(data?.endMonth || getTodayYMD().slice(0, 7))}`;
  const status = document.getElementById("kpiTrendStatus");
  if (status) status.innerText = `${Number(data?.departments?.length || 0)} แผนก • ${Number(data?.months?.length || 0)} เดือน`;
  renderKpiTrendDepartmentSummary(data?.departmentSummary || []);
  renderKpiTrendTable(data);
  requestAnimationFrame(() => renderKpiTrendCharts(data));
}

async function fetchKpiTrendData(endMonth, signal = null, startMonth = KPI_TREND_START_MONTH) {
  const response = await fetch(
    `${WEB_APP_URL}?action=kpi_trend&startMonth=${encodeURIComponent(startMonth || KPI_TREND_START_MONTH)}&endMonth=${encodeURIComponent(endMonth || getTodayYMD().slice(0, 7))}`,
    signal ? { signal } : undefined
  );
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  if (!data?.ok) throw new Error(data?.message || "โหลดกราฟ KPI ไม่สำเร็จ");
  return data;
}

async function loadKpiRecordingTrend(endMonth) {
  const token = ++kpiTrendRequestToken;
  if (kpiTrendAbortController) {
    try { kpiTrendAbortController.abort(); } catch (e) {}
  }
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  kpiTrendAbortController = controller;
  try {
    const data = await fetchKpiTrendData(endMonth, controller?.signal || null);
    if (token !== kpiTrendRequestToken) return null;
    renderKpiTrendData(data);
    return data;
  } catch (error) {
    if (token !== kpiTrendRequestToken || error?.name === "AbortError") return null;
    renderKpiTrendError(error?.message || String(error));
    return null;
  } finally {
    if (token === kpiTrendRequestToken) kpiTrendAbortController = null;
  }
}

function renderKpiAllDepartmentsCurrent(trendData, month) {
  const monthRow = (trendData?.months || []).find(item => String(item.month || "") === month) || null;
  const summary = monthRow?.combined || {};
  setKpiText("kpiTotalRounds", Number(summary.totalRounds || 0));
  setKpiText("kpiCompleteRounds", Number(summary.completeRounds || 0));
  setKpiText("kpiIncompleteRounds", Number(summary.incompleteRounds || 0));
  setKpiText("kpiPercentage", `${Number(summary.percentage || 0).toFixed(1)}%`);
  renderKpiDepartments(monthRow?.departments || []);
  const missing = document.getElementById("kpiMissingList");
  if (missing) missing.innerHTML = '<div class="empty-friendly-card">ภาพรวมทุกแผนกจะแสดงจำนวนรอบที่ขาดในกราฟและตารางด้านล่าง หากต้องการดูวันที่/รอบ/ตู้ที่ขาด ให้เลือกแผนกใดแผนกหนึ่งด้านบน</div>';
  setKpiOutputVisible(true);
}

function getKpiSearchInputs() {
  const before = [];
  const after = [];
  for (let i = 1; i <= 5; i += 1) {
    const beforeValue = Number(document.getElementById(`kpiSearchBefore${i}`)?.value || NaN);
    const afterValue = Number(document.getElementById(`kpiSearchAfter${i}`)?.value || NaN);
    before.push(beforeValue);
    after.push(afterValue);
  }
  return { before, after };
}

function medianKpiValues(values) {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!sorted.length) return NaN;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function loadKpiSearchInputs() {
  let saved = null;
  try { saved = JSON.parse(window.localStorage?.getItem(KPI_SEARCH_STORAGE_KEY) || "null"); } catch (e) {}
  if (saved && Array.isArray(saved.before) && Array.isArray(saved.after)) {
    for (let i = 1; i <= 5; i += 1) {
      const before = document.getElementById(`kpiSearchBefore${i}`);
      const after = document.getElementById(`kpiSearchAfter${i}`);
      if (before && saved.before[i - 1] !== undefined) before.value = saved.before[i - 1];
      if (after && saved.after[i - 1] !== undefined) after.value = saved.after[i - 1];
    }
  }
  calculateKpiSearchTime(false);
}

function clearKpiSearchInputs() {
  for (let i = 1; i <= 5; i += 1) {
    const before = document.getElementById(`kpiSearchBefore${i}`);
    const after = document.getElementById(`kpiSearchAfter${i}`);
    if (before) before.value = "";
    if (after) after.value = "";
  }
  try { window.localStorage?.removeItem(KPI_SEARCH_STORAGE_KEY); } catch (e) {}
  const result = document.getElementById("kpiSearchResult");
  if (result) {
    result.className = "kpi-search-result";
    result.innerHTML = "ยังไม่ได้กรอกผลการจับเวลา";
  }
}

function calculateKpiSearchTime(showMessage = true) {
  const { before, after } = getKpiSearchInputs();
  const result = document.getElementById("kpiSearchResult");
  if (!result) return;
  const complete = before.length === 5 && after.length === 5
    && before.every(value => Number.isFinite(value) && value > 0)
    && after.every(value => Number.isFinite(value) && value >= 0);
  if (!complete) {
    result.className = "kpi-search-result";
    result.innerHTML = showMessage ? "กรุณากรอกเวลาของผู้ทดสอบทั้ง 5 คนให้ครบ" : "ยังไม่ได้กรอกผลการจับเวลา";
    return;
  }
  const beforeCenter = medianKpiValues(before);
  const afterCenter = medianKpiValues(after);
  const reduction = ((beforeCenter - afterCenter) / beforeCenter) * 100;
  const status = reduction >= 0 ? "good" : "warn";
  result.className = `kpi-search-result ${status}`;
  result.innerHTML = `<strong>ลดเวลาค้นข้อมูล ${reduction.toFixed(1)}%</strong><span>ก่อนใช้แอป ${beforeCenter.toFixed(1)} นาที → หลังใช้แอป ${afterCenter.toFixed(1)} นาที • ผู้ทดสอบ 5 คน</span>`;
  try {
    window.localStorage?.setItem(KPI_SEARCH_STORAGE_KEY, JSON.stringify({
      before,
      after,
      beforeCenter: Number(beforeCenter.toFixed(2)),
      afterCenter: Number(afterCenter.toFixed(2)),
      reductionPercent: Number(reduction.toFixed(1)),
      savedAt: new Date().toISOString()
    }));
  } catch (e) {}
}

function renderKpiMetricExamples(examples) {
  const wrapper = document.getElementById("kpiMetricExamples");
  const listEl = document.getElementById("kpiMetricExampleList");
  const rows = Array.isArray(examples) ? examples : [];
  kpiMetricExamplesCache = rows;
  if (!wrapper || !listEl) return;
  if (!rows.length) { wrapper.classList.add("hidden"); listEl.innerHTML = ""; return; }
  wrapper.classList.remove("hidden");
  listEl.innerHTML = rows.map(item => {
    const missing = Array.isArray(item.missingFields) ? item.missingFields.join(", ") : (item.missingFields || "-");
    const requirement = item.incidentRequirementReason || "";
    const diagnosis = item.incidentDiagnosis || "";
    const matchedIncident = item.matchedIncidentId ? `${item.matchedIncidentId}${item.matchedIncidentStatus ? ` • ${item.matchedIncidentStatus}` : ""}` : "";
    const matchedRelation = item.matchedIncidentRelation === "delayed_incident" ? `เชื่อมกับ Incident ที่เปิดภายหลัง ${Number(item.matchedIncidentDaysAfterLog || 0)} วัน` : (item.matchedIncidentRelation === "incident_window" ? "Incident ครอบคลุมวันที่บันทึก" : "");
    const originalDetail = [item.noTempReason, item.noTempDetail].filter(Boolean).join(" — ");
    const correctionText = item.hasCorrection ? `แก้ไขอุณหภูมิแล้ว${item.correctedTemp !== null && item.correctedTemp !== undefined ? ` → ${item.correctedTemp} °C` : ""}${item.correctionReason ? ` (${item.correctionReason})` : ""}` : "";
    const detailRows = [
      requirement ? `<div><strong>เหตุที่ต้องตรวจ Incident:</strong> ${escapeHtml(requirement)}</div>` : "",
      diagnosis ? `<div><strong>สาเหตุที่ไม่ครบ:</strong> ${escapeHtml(diagnosis)}</div>` : `<div><strong>ขาด:</strong> ${escapeHtml(missing)}</div>`,
      matchedIncident ? `<div><strong>Incident ที่ระบบพบ:</strong> ${escapeHtml(matchedIncident)}</div>` : "",
      matchedRelation ? `<div><strong>วิธีเชื่อม:</strong> ${escapeHtml(matchedRelation)}</div>` : "",
      originalDetail ? `<div><strong>เหตุผล/รายละเอียดที่บันทึก:</strong> ${escapeHtml(originalDetail)}</div>` : "",
      correctionText ? `<div><strong>การแก้ไขข้อมูล:</strong> ${escapeHtml(correctionText)}</div>` : ""
    ].filter(Boolean).join("");
    const reviewButton = item.logId ? `<button type="button" class="mini-action-btn" onclick="openKpiReviewModal('${encodeURIComponent(item.logId)}')">ตรวจสอบ/จัดประเภท</button>` : "";
    return `<div class="kpi-metric-example-item"><div><strong>${escapeHtml(item.incidentId || item.logId || "รายการ")}</strong><span>${escapeHtml(item.dateDisplay || item.date || "-")} ${escapeHtml(item.round || "")} ${escapeHtml(item.fridgeId || "")}</span>${reviewButton}</div><div class="kpi-metric-example-missing">${detailRows}</div></div>`;
  }).join("");
}

function openKpiReviewModal(encodedLogId) {
  const logId = decodeURIComponent(String(encodedLogId || ""));
  const item = kpiMetricExamplesCache.find(row => String(row?.logId || "") === logId) || null;
  const modal = document.getElementById("kpiReviewModal");
  if (!modal || !item) return;
  document.getElementById("kpiReviewLogId").value = logId;
  document.getElementById("kpiReviewInfo").innerHTML = `<strong>${escapeHtml(logId)}</strong><br>${escapeHtml(item.dateDisplay || item.date || "-")} • ${escapeHtml(item.round || "-")} • ${escapeHtml(item.fridgeId || "-")}<br>${escapeHtml(item.incidentRequirementReason || item.incidentDiagnosis || "")}`;
  document.getElementById("kpiReviewClassification").value = "";
  document.getElementById("kpiReviewReason").value = "";
  document.getElementById("kpiReviewBy").value = getCurrentActorFullName() || "";
  const result = document.getElementById("kpiReviewResult"); if (result) { result.style.display = "none"; result.innerText = ""; result.className = "result"; }
  modal.classList.remove("hidden"); document.body.classList.add("guide-modal-open");
}
function closeKpiReviewModal() { document.getElementById("kpiReviewModal")?.classList.add("hidden"); document.body.classList.remove("guide-modal-open"); }
async function submitKpiReview() {
  const logId = document.getElementById("kpiReviewLogId")?.value?.trim() || "";
  const classification = document.getElementById("kpiReviewClassification")?.value || "";
  const reason = document.getElementById("kpiReviewReason")?.value?.trim() || "";
  const reviewedBy = document.getElementById("kpiReviewBy")?.value?.trim() || "";
  const result = document.getElementById("kpiReviewResult");
  if (!logId || !classification || !reason || !reviewedBy) { showResult(result, false, "กรุณาเลือกประเภท และกรอกเหตุผล/ผู้ตรวจสอบให้ครบ"); return; }
  try {
    showResult(result, true, "กำลังบันทึกผลการทบทวน...");
    const params = new URLSearchParams({ action: "review_kpi_log", logId, classification, reason, reviewedBy });
    const response = await fetch(`${WEB_APP_URL}?${params.toString()}`); const data = await response.json();
    if (!data.ok) throw new Error(data.message || "บันทึกผลการทบทวนไม่สำเร็จ");
    showAppPopup(true, "บันทึกการทบทวนแล้ว", classification === "test_data" || classification === "entry_error" ? "ระบบเก็บ LOG เดิมไว้เพื่อ Audit และตัดรายการนี้ออกจาก KPI" : "ระบบเก็บผลการจัดประเภทไว้และจะคำนวณ KPI ตามประเภทที่ยืนยัน");
    closeKpiReviewModal();
    if (getSelectedKpiMetric() === "temperature_completeness") await loadKpiPage();
  } catch (error) { showResult(result, false, "บันทึกผลการทบทวนไม่สำเร็จ: " + (error?.message || error)); }
}

function renderKpiMetricResult(metric, data) {
  const summary = data?.summary || {};
  const labels = {
    total: "รายการที่ประเมิน",
    complete: "ครบถ้วน",
    incomplete: "ไม่ครบถ้วน",
    percent: "ความครบถ้วน"
  };
  let values = {
    total: Number(summary.totalItems || 0),
    complete: Number(summary.completeItems || 0),
    incomplete: Number(summary.incompleteItems || 0),
    percent: `${Number(summary.percentage || 0).toFixed(1)}%`
  };
  let extraHtml = "";

  if (metric === "incident_timeline") {
    extraHtml = `<div class="kpi-inline-stat-grid">
      <div><span>เคสที่ยังดำเนินการ</span><strong>${Number(summary.activeItems || 0)}</strong></div>
      <div><span>เคสปิด/ยกเลิก</span><strong>${Number(summary.closedItems || 0)}</strong></div>
      <div><span>เคสที่ Timeline ไม่ครบ</span><strong>${Number(summary.timelineIncompleteItems || 0)}</strong></div>
    </div><div class="kpi-metric-note">เกณฑ์ปิดเคส: ต้องมีผลการดำเนินการ/ผลซ่อม และวันเวลาปิดเคสเพิ่มเติม</div>`;
  } else if (metric === "paper_reduction") {
    labels.total = "แบบบันทึกเดิมต่อปี";
    labels.complete = "ประมาณการลดลงต่อปี";
    labels.incomplete = "แบบบันทึกหลังใช้ระบบต่อปี";
    labels.percent = "ประมาณการลดลง";
    values = {
      total: Number(summary.baselineAnnualSheets || 0),
      complete: Number(summary.estimatedReducedAnnualSheets || 0),
      incomplete: Number(summary.estimatedAfterAnnualSheets || 0),
      percent: `${Number(summary.estimatedReductionPercent || 0).toFixed(1)}%`
    };
    extraHtml = `<div class="kpi-inline-stat-grid">
      <div><span>ตู้ที่ต้องบันทึก</span><strong>${Number(summary.activeFridgeCount || 0)}</strong></div>
      <div><span>ฐานเดิมต่อเดือน</span><strong>${Number(summary.baselineMonthlySheets || 0)} แผ่น</strong></div>
      <div><span>ประมาณการลดลงเดือนนี้</span><strong>${Number(summary.estimatedReducedMonthlySheets || 0)} แผ่น</strong></div>
    </div><div class="kpi-metric-note">เป็นประมาณการจากการบันทึกผ่านแอป ยังไม่หักแบบฟอร์มที่หน่วยงานอาจพิมพ์ใช้จริง หากยังใช้กระดาษบางพื้นที่ ให้หักยอดพิมพ์จริงตอนสรุป CQI</div>`;
  }

  setKpiText("kpiMetricLabelTotal", labels.total);
  setKpiText("kpiMetricLabelComplete", labels.complete);
  setKpiText("kpiMetricLabelIncomplete", labels.incomplete);
  setKpiText("kpiMetricLabelPercent", labels.percent);
  setKpiText("kpiMetricValueTotal", values.total);
  setKpiText("kpiMetricValueComplete", values.complete);
  setKpiText("kpiMetricValueIncomplete", values.incomplete);
  setKpiText("kpiMetricValuePercent", values.percent);
  const extra = document.getElementById("kpiMetricExtra");
  if (extra) extra.innerHTML = extraHtml;
  renderKpiMetricExamples(data?.incompleteExamples || []);
  const output = document.getElementById("kpiMetricOutput");
  if (output) output.classList.remove("hidden");
}

function onKpiMetricChanged() {
  selectedKpiMetric = getSelectedKpiMetric();
  cancelKpiRequest();
  resetKpiResultCards();
  setKpiMetricVisibility(selectedKpiMetric);
  const resultBox = document.getElementById("kpiResult");
  if (selectedKpiMetric === "search_time") {
    showResult(resultBox, true, "กรอกผลการจับเวลาจากแฟ้มเทียบกับแอป แล้วกด “คำนวณผล CQI”");
    return;
  }
  showResult(resultBox, true, "เลือกเดือนและแผนก แล้วกด “แสดงผล”");
  void loadKpiDepartmentList(false);
}

function renderKpiDepartmentOptions(departments, selectedValue = "") {
  const select = document.getElementById("kpiDepartment");
  if (!select) return;
  const list = Array.isArray(departments)
    ? departments.map(name => String(name || "").trim()).filter(Boolean)
    : [];
  kpiDepartmentsCache = list.slice();
  const includeAll = getSelectedKpiMetric() === "temperature_completeness";
  const allOption = includeAll ? '<option value="__ALL__">รวมทุกแผนก</option>' : '';
  select.innerHTML = '<option value="">กรุณาเลือกแผนก</option>' + allOption +
    list.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  if (includeAll && (selectedValue === KPI_ALL_DEPARTMENTS_VALUE || !list.includes(selectedValue))) {
    select.value = KPI_ALL_DEPARTMENTS_VALUE;
  } else {
    select.value = list.includes(selectedValue) ? selectedValue : "";
  }
  setKpiShowButtonState();
}

let kpiDepartmentLoadPromise = null;
let kpiDepartmentListLoaded = false;

async function loadKpiDepartmentList(force = false) {
  if (!force && kpiDepartmentListLoaded && kpiDepartmentsCache.length) {
    renderKpiDepartmentOptions(kpiDepartmentsCache, document.getElementById("kpiDepartment")?.value || (getSelectedKpiMetric() === "temperature_completeness" ? KPI_ALL_DEPARTMENTS_VALUE : ""));
    return kpiDepartmentsCache;
  }
  if (kpiDepartmentLoadPromise) return kpiDepartmentLoadPromise;

  const resultBox = document.getElementById("kpiResult");
  const select = document.getElementById("kpiDepartment");
  const button = document.getElementById("kpiShowButton");
  if (select) select.innerHTML = '<option value="">กำลังโหลดรายชื่อแผนก...</option>';
  if (button) button.disabled = true;
  showResult(resultBox, true, "กำลังโหลดรายชื่อแผนก...");

  kpiDepartmentLoadPromise = (async () => {
    try {
      const response = await fetchJsonWithTimeout(`${WEB_APP_URL}?action=kpi_departments`, 15000);
      if (!response?.ok) throw new Error(response?.message || "โหลดรายชื่อแผนกไม่สำเร็จ");
      const departments = Array.isArray(response.departments) ? response.departments : [];
      kpiDepartmentListLoaded = true;
      renderKpiDepartmentOptions(departments, getSelectedKpiMetric() === "temperature_completeness" ? KPI_ALL_DEPARTMENTS_VALUE : "");
      showResult(resultBox, true, departments.length
        ? "เลือกเดือนและแผนก แล้วกด “แสดงผล”"
        : "ยังไม่พบแผนกที่มีตู้ใช้งานและกำหนดให้บันทึกทุกวัน");
      return departments;
    } catch (error) {
      kpiDepartmentListLoaded = false;
      if (select) select.innerHTML = '<option value="">โหลดรายชื่อแผนกไม่สำเร็จ</option>';
      showResult(resultBox, false, "โหลดรายชื่อแผนกไม่สำเร็จ: " + (error.message || error));
      return [];
    } finally {
      kpiDepartmentLoadPromise = null;
      setKpiShowButtonState();
    }
  })();

  return kpiDepartmentLoadPromise;
}

async function initKpiPage() {
  const month = document.getElementById("kpiMonth");
  if (month) {
    const currentMonth = getTodayYMD().slice(0, 7);
    month.min = KPI_TREND_START_MONTH;
    month.max = currentMonth;
    if (!month.value || month.value < KPI_TREND_START_MONTH) month.value = currentMonth < KPI_TREND_START_MONTH ? KPI_TREND_START_MONTH : currentMonth;
    if (month.value > currentMonth) month.value = currentMonth;
  }
  const selector = document.getElementById("kpiMetricSelector");
  if (selector) {
    selector.value = KPI_METRIC_DEFINITIONS[selectedKpiMetric] ? selectedKpiMetric : "temperature_completeness";
    selectedKpiMetric = selector.value;
  }
  resetKpiResultCards();
  setKpiMetricVisibility(selectedKpiMetric);
  if (selectedKpiMetric !== "search_time") await loadKpiDepartmentList(false);
}

function onKpiMonthChanged() {
  cancelKpiRequest();
  resetKpiResultCards();
  setKpiShowButtonState();
  const selected = document.getElementById("kpiDepartment")?.value || "";
  showResult(
    document.getElementById("kpiResult"),
    true,
    selected ? "เปลี่ยนเดือนแล้ว กรุณากด “แสดงผล” เพื่อคำนวณใหม่" : "เลือกเดือนและแผนก แล้วกด “แสดงผล”"
  );
}

function onKpiDepartmentChanged() {
  // V1.8.35: การเลือกแผนกมีหน้าที่เปิดปุ่มเท่านั้น ห้ามเริ่มคำนวณหรือสร้างรายการผลลัพธ์
  // เพื่อให้ iPhone ไม่ใช้หน่วยความจำเพิ่มก่อนผู้ใช้กด “แสดงผล”
  cancelKpiRequest();
  setKpiOutputVisible(false);
  resetKpiMetricOutput();
  setKpiShowButtonState();
  const selected = document.getElementById("kpiDepartment")?.value || "";
  showResult(
    document.getElementById("kpiResult"),
    true,
    selected ? `เลือกแผนก ${selected} แล้ว กรุณากด “แสดงผล”` : "กรุณาเลือกแผนกก่อน"
  );
}

function renderKpiDepartments(rows) {
  const container = document.getElementById("kpiDepartmentCards");
  if (!container) return;
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) {
    container.innerHTML = '<div class="empty-friendly-card">ยังไม่มีข้อมูลแผนกในเดือนที่เลือก</div>';
    return;
  }
  container.innerHTML = list.map(row => {
    const percent = Number(row.percentage || 0);
    return `
      <article class="kpi-department-card">
        <div class="kpi-department-head">
          <div>
            <div class="kpi-department-name">${escapeHtml(row.department || "-")}</div>
            <div class="kpi-department-meta">ประเมิน ${Number(row.totalRounds || 0)} รอบ • ยกเว้นตู้เสีย ${Number(row.exemptRecordCount || 0)} รายการ</div>
          </div>
          <div class="kpi-percent-badge ${getKpiTargetClass(percent, 100)}">${percent.toFixed(1)}%</div>
        </div>
        <div class="kpi-progress"><span style="width:${Math.max(0, Math.min(100, percent))}%"></span></div>
        <div class="kpi-department-stats">
          <div><span>บันทึกครบ</span><strong>${Number(row.completeRounds || 0)}</strong></div>
          <div><span>บันทึกไม่ครบ</span><strong>${Number(row.incompleteRounds || 0)}</strong></div>
          <div><span>รายการตู้ที่ขาดรวม</span><strong>${Number(row.missingRecordCount || 0)}</strong></div>
        </div>
      </article>`;
  }).join("");
}

function renderKpiMissingList(events) {
  const container = document.getElementById("kpiMissingList");
  if (!container) return;
  const list = Array.isArray(events) ? events : [];
  if (!list.length) {
    container.innerHTML = '<div class="kpi-all-complete">✅ เดือนนี้แผนกที่เลือกบันทึกครบทุกตู้และทุกรอบที่ถึงกำหนดแล้ว</div>';
    return;
  }
  container.innerHTML = list.map(event => {
    const fridges = Array.isArray(event.missingFridges) ? event.missingFridges : [];
    const fridgeText = fridges.map(item => `${item.fridgeId}${item.fridgeName ? ` — ${item.fridgeName}` : ""}`).join("<br>");
    return `
      <details class="kpi-missing-item">
        <summary>
          <span class="kpi-missing-date">${escapeHtml(event.dateDisplay || event.date || "-")} • รอบ${escapeHtml(event.round || "-")}</span>
          <span class="kpi-missing-department">${escapeHtml(event.department || "-")}</span>
          <span class="kpi-missing-count">ขาด ${Number(event.missingCount || 0)} ตู้</span>
        </summary>
        <div class="kpi-missing-detail">
          <div><strong>ควรบันทึก:</strong> ${Number(event.expectedCount || 0)} ตู้</div>
          <div><strong>บันทึกแล้ว:</strong> ${Number(event.recordedCount || 0)} ตู้</div>
          <div class="full"><strong>ตู้ที่ยังไม่บันทึก:</strong><div class="kpi-fridge-list">${fridgeText || "-"}</div></div>
        </div>
      </details>`;
  }).join("");
}

async function loadTemperatureKpiPage() {
  const resultBox = document.getElementById("kpiResult");
  const monthInput = document.getElementById("kpiMonth");
  const departmentInput = document.getElementById("kpiDepartment");
  const showButton = document.getElementById("kpiShowButton");
  if (!monthInput) return;
  const currentMonth = getTodayYMD().slice(0, 7);
  monthInput.min = KPI_TREND_START_MONTH;
  monthInput.max = currentMonth;
  if (!monthInput.value || monthInput.value < KPI_TREND_START_MONTH) monthInput.value = currentMonth < KPI_TREND_START_MONTH ? KPI_TREND_START_MONTH : currentMonth;
  if (monthInput.value > currentMonth) monthInput.value = currentMonth;
  const month = monthInput.value;
  const selectedDepartment = departmentInput?.value || "";
  if (!selectedDepartment) {
    resetKpiResultCards();
    setKpiShowButtonState();
    showResult(resultBox, false, "กรุณาเลือกแผนก หรือเลือก “รวมทุกแผนก” ก่อน แล้วจึงกด “แสดงผล”");
    return;
  }
  const requestToken = ++kpiPageRequestToken;

  if (kpiPageAbortController) {
    try { kpiPageAbortController.abort(); } catch (e) {}
  }
  const requestController = typeof AbortController !== "undefined" ? new AbortController() : null;
  kpiPageAbortController = requestController;
  const timeoutTimer = requestController
    ? window.setTimeout(() => requestController.abort(), 45000)
    : null;

  try {
    if (showButton) {
      showButton.disabled = true;
      showButton.dataset.loading = "1";
      showButton.innerText = "กำลังคำนวณ...";
    }
    setKpiOutputVisible(false);
    resetKpiTrendOutput();

    if (selectedDepartment === KPI_ALL_DEPARTMENTS_VALUE) {
      showResult(resultBox, true, "กำลังคำนวณ KPI รวมทุกแผนกของเดือนที่เลือก...");
      const currentMonthData = await fetchKpiTrendData(month, requestController?.signal || null, month);
      if (requestToken !== kpiPageRequestToken) return;
      renderKpiDepartmentOptions(currentMonthData.departments || [], KPI_ALL_DEPARTMENTS_VALUE);
      renderKpiAllDepartmentsCurrent(currentMonthData, month);
      showResult(resultBox, true, `${formatKpiMonthLabel(month)} • รวมทุกแผนก • กำลังโหลดตาราง/กราฟย้อนหลัง...`);
      void loadKpiRecordingTrend(month).then(() => {
        if (requestToken === kpiPageRequestToken) showResult(resultBox, true, `${formatKpiMonthLabel(month)} • รวมทุกแผนก • ตารางและกราฟพร้อม Export`);
      });
      return;
    }

    showResult(resultBox, true, `กำลังให้ Supabase คำนวณ KPI ของแผนก ${selectedDepartment}...`);
    const response = await fetch(
      `${WEB_APP_URL}?action=kpi_monthly&month=${encodeURIComponent(month)}&department=${encodeURIComponent(selectedDepartment)}`,
      requestController ? { signal: requestController.signal } : undefined
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (requestToken !== kpiPageRequestToken) return;
    if (!data.ok) throw new Error(data.message || "โหลด KPI ไม่สำเร็จ");

    renderKpiDepartmentOptions(data.departments || [], data.selectedDepartment || selectedDepartment);
    setKpiText("kpiTotalRounds", Number(data.summary?.totalRounds || 0));
    setKpiText("kpiCompleteRounds", Number(data.summary?.completeRounds || 0));
    setKpiText("kpiIncompleteRounds", Number(data.summary?.incompleteRounds || 0));
    setKpiText("kpiPercentage", `${Number(data.summary?.percentage || 0).toFixed(1)}%`);
    renderKpiDepartments(data.departmentResults || []);
    renderKpiMissingList(data.missingEvents || []);
    setKpiOutputVisible(true);
    showResult(resultBox, true, `${formatKpiMonthLabel(month)} • ${data.selectedDepartment} • ไม่นับตู้เสีย/Incident`);

    // โหลดกราฟรวมทุกแผนกแยกจากผลรายแผนก เพื่อให้หน้าหลักใช้งานได้แม้กราฟมีปัญหา
    void loadKpiRecordingTrend(month);
  } catch (error) {
    if (requestToken !== kpiPageRequestToken) return;
    const detail = error?.name === "AbortError"
      ? "ยกเลิกคำขอเดิมหรือใช้เวลาคำนวณนานเกิน 45 วินาที กรุณากดแสดงผลอีกครั้ง"
      : (error.message || error);
    showResult(resultBox, false, "หน้า KPI โหลดไม่สำเร็จ: " + detail);
    resetKpiResultCards();
  } finally {
    if (timeoutTimer) window.clearTimeout(timeoutTimer);
    if (requestToken === kpiPageRequestToken) kpiPageAbortController = null;
    if (showButton) {
      showButton.dataset.loading = "0";
      showButton.innerText = "แสดงผล";
      setKpiShowButtonState();
    }
  }
}

async function loadKpiPage() {
  const metric = getSelectedKpiMetric();
  if (metric === "search_time") {
    calculateKpiSearchTime(true);
    return;
  }
  if (metric === "temperature_completeness") {
    await loadTemperatureKpiPage();
    return;
  }
  await loadAdditionalKpiPage(metric);
}

async function loadAdditionalKpiPage(metric) {
  const resultBox = document.getElementById("kpiResult");
  const monthInput = document.getElementById("kpiMonth");
  const departmentInput = document.getElementById("kpiDepartment");
  const showButton = document.getElementById("kpiShowButton");
  if (!monthInput) return;
  if (!monthInput.value) monthInput.value = getTodayYMD().slice(0, 7);
  const month = monthInput.value;
  const selectedDepartment = departmentInput?.value || "";
  if (!selectedDepartment) {
    resetKpiMetricOutput();
    setKpiShowButtonState();
    showResult(resultBox, false, "กรุณาเลือกแผนกก่อน แล้วจึงกด “แสดงผล”");
    return;
  }

  const requestToken = ++kpiMetricRequestToken;
  if (kpiPageAbortController) {
    try { kpiPageAbortController.abort(); } catch (e) {}
  }
  const requestController = typeof AbortController !== "undefined" ? new AbortController() : null;
  kpiPageAbortController = requestController;
  const timeoutTimer = requestController
    ? window.setTimeout(() => requestController.abort(), 30000)
    : null;

  try {
    if (showButton) {
      showButton.disabled = true;
      showButton.dataset.loading = "1";
      showButton.innerText = "กำลังคำนวณ...";
    }
    setKpiOutputVisible(false);
    resetKpiMetricOutput();
    showResult(resultBox, true, `กำลังคำนวณ ${KPI_METRIC_DEFINITIONS[metric]?.title || "KPI"} ของแผนก ${selectedDepartment}...`);
    const response = await fetch(
      `${WEB_APP_URL}?action=kpi_metrics&metric=${encodeURIComponent(metric)}&month=${encodeURIComponent(month)}&department=${encodeURIComponent(selectedDepartment)}`,
      requestController ? { signal: requestController.signal } : undefined
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (requestToken !== kpiMetricRequestToken) return;
    if (!data.ok) throw new Error(data.message || "โหลด KPI ไม่สำเร็จ");
    renderKpiDepartmentOptions(data.departments || [], data.selectedDepartment || selectedDepartment);
    renderKpiMetricResult(metric, data);
    showResult(resultBox, true, `${formatKpiMonthLabel(month)} • ${data.selectedDepartment || selectedDepartment}`);
  } catch (error) {
    if (requestToken !== kpiMetricRequestToken) return;
    const detail = error?.name === "AbortError"
      ? "ยกเลิกคำขอเดิมหรือใช้เวลาคำนวณนานเกิน 30 วินาที กรุณากดแสดงผลอีกครั้ง"
      : (error.message || error);
    showResult(resultBox, false, "หน้า KPI โหลดไม่สำเร็จ: " + detail);
    resetKpiMetricOutput();
  } finally {
    if (timeoutTimer) window.clearTimeout(timeoutTimer);
    if (requestToken === kpiMetricRequestToken) kpiPageAbortController = null;
    if (showButton) {
      showButton.dataset.loading = "0";
      showButton.innerText = "แสดงผล";
      setKpiShowButtonState();
    }
  }
}

function showDashboardGroup(group) {
  const cardContainer = document.getElementById("dashboardCardContainer");
  const title = document.getElementById("dashboardDrillTitle");
  const resultBox = document.getElementById("dashboardResult");

  if (!cardContainer) return;

  cardContainer.innerHTML = "";

  let rows = [];
  let titleText = "";

  if (group === "all") {
    rows = [
      ...dashboardListsCache.morningRecorded,
      ...dashboardListsCache.morningMissing
    ];
    titleText = "รายการตู้ทั้งหมดที่ต้องติดตาม";

  } else if (group === "missing") {
    rows = dashboardRowsCache;
    titleText = "รายการตู้ที่ยังไม่บันทึกรอบปัจจุบัน";

  } else if (group === "recorded") {
    rows = [];
    titleText = "รายการตู้ที่บันทึกแล้วรอบปัจจุบัน";

  } else if (group === "morningRecorded") {
    rows = dashboardListsCache.morningRecorded;
    titleText = "รอบเช้า: รายการที่บันทึกแล้ว";

  } else if (group === "morningMissing") {
    rows = dashboardListsCache.morningMissing;
    titleText = "รอบเช้า: รายการที่ยังไม่บันทึก";

  } else if (group === "eveningRecorded") {
    rows = dashboardListsCache.eveningRecorded;
    titleText = "รอบเย็น: รายการที่บันทึกแล้ว";

  } else if (group === "eveningMissing") {
    rows = dashboardListsCache.eveningMissing;
    titleText = "รอบเย็น: รายการที่ยังไม่บันทึก";

  } else if (group === "abnormal") {
    titleText = "Incident ที่กำลังดำเนินการ";
    showResult(resultBox, true, "กำลังเปิดรายการ Incident ที่ยังไม่ปิดหรือยกเลิก");
    if (title) title.innerText = titleText;
    const incidentDate = document.getElementById("incidentDateFilter");
    const incidentStatus = document.getElementById("incidentStatusFilter");
    if (incidentDate) incidentDate.value = "all";
    if (incidentStatus) incidentStatus.value = "active";
    showPage("incidentPage", document.querySelector("button[data-menu-key='incident_all']"));
    loadIncidentTracking();
    return;

  } else if (group === "closedToday") {
    titleText = "ปิดเคสแล้วทั้งหมด";
    showResult(resultBox, true, "กำลังเปิด Timeline ของ Incident ที่ปิดเคสแล้ว");
    if (title) title.innerText = titleText;
    const historyDate = document.getElementById("incidentHistoryDateFilter");
    const historyStatus = document.getElementById("incidentHistoryStatusFilter");
    if (historyDate) historyDate.value = "all";
    if (historyStatus) historyStatus.value = "closed";
    showPage("incidentHistoryPage", document.querySelector("button[data-menu-key='incident_timeline']"));
    loadIncidentHistoryPage();
    return;
  }

  rows.sort((a, b) => {
    const aStatus = getDashboardDisplayStatus(a);
    const bStatus = getDashboardDisplayStatus(b);

    if (aStatus.sortPriority !== bStatus.sortPriority) {
      return aStatus.sortPriority - bStatus.sortPriority;
    }

    const roomCompare = (a.room || "").localeCompare(b.room || "", "th");
    if (roomCompare !== 0) return roomCompare;

    return (a.fridgeId || "").localeCompare(b.fridgeId || "", "th");
  });

  if (title) title.innerText = `${titleText} (${rows.length} รายการ)`;

  if (rows.length === 0) {
    showResult(resultBox, true, "ไม่พบรายการในกลุ่มนี้");
    return;
  }

  showResult(resultBox, true, `แสดง ${rows.length} รายการ`);

  rows.forEach(item => {
    renderDashboardCard(item, cardContainer);
  });

scrollToDashboardCards();
}


function renderDashboardCard(item, cardContainer) {
  const displayStatus = getDashboardDisplayStatus(item);
  const cardClass = getDashboardCardClass(item);

  // V1.8.37: แสดงช่วงควบคุมให้ครบ แม้ค่าบางตู้ยังไม่ได้กำหนดในฐานข้อมูล
  const minTemp = item.minTemp !== null && item.minTemp !== undefined && String(item.minTemp).trim() !== ""
    ? item.minTemp
    : "-";
  const maxTemp = item.maxTemp !== null && item.maxTemp !== undefined && String(item.maxTemp).trim() !== ""
    ? item.maxTemp
    : "-";

  const latestStamp = item.latestStamp || "-";
  const latestRound = item.latestRound || "-";
  const latestTemp =
    item.latestTempText
      ? item.latestTempText
      : (
          item.latestTemp !== "" &&
          item.latestTemp !== null &&
          item.latestTemp !== undefined
            ? `${item.latestTemp} °C`
            : "-"
        );

  const latestAction = item.latestAction ? item.latestAction : "-";

  const card = document.createElement("div");
  card.className = `monitor-item-card ${cardClass}`;

  card.innerHTML = `
    <div class="monitor-card-head">
      <div class="monitor-item-top">
        <div>
          <div class="monitor-item-title">${item.fridgeId || "-"}</div>
          <div class="monitor-item-subtitle">${item.fridgeName || "-"} • ${item.room || "-"}</div>
        </div>
        <div class="monitor-status-badge ${displayStatus.className}">
          ${displayStatus.text}
        </div>
      </div>
    </div>

    <div class="monitor-card-body">
      <div class="monitor-item-info">
        <div class="monitor-item-box">
          <div class="monitor-item-label">บันทึกล่าสุด</div>
          <div class="monitor-item-value ${latestStamp === "-" ? "monitor-empty small-text" : "small-text"}">
            ${latestStamp}
          </div>
        </div>

        <div class="monitor-item-box">
          <div class="monitor-item-label">รอบ</div>
          <div class="monitor-item-value ${latestRound === "-" ? "monitor-empty" : ""}">
            ${latestRound}
          </div>
        </div>

        <div class="monitor-item-box">
          <div class="monitor-item-label">อุณหภูมิ</div>
          <div class="monitor-item-value ${latestTemp === "-" ? "monitor-empty" : ""}">
            ${latestTemp}
          </div>
        </div>

        <div class="monitor-item-box">
          <div class="monitor-item-label">หมายเหตุ</div>
          <div class="monitor-item-value ${latestAction === "-" ? "monitor-empty small-text" : "small-text"}">
            ${latestAction}
          </div>
        </div>
      </div>

      <div class="monitor-card-foot">
        <div><strong>ช่วงควบคุม:</strong> ${minTemp} ถึง ${maxTemp} °C</div>
        <div><strong>ต้องบันทึกประจำวัน:</strong> ${item.requireDaily || "-"}</div>
        ${item.relatedIncidentId ? `<div><strong>Incident:</strong> ${item.relatedIncidentId}</div>` : ""}
      </div>
    </div>
  `;

  cardContainer.appendChild(card);
}
    
async function checkDuplicateBeforeSave() {
  const date = document.getElementById("date")?.value || "";
  const round = document.getElementById("round")?.value || "";
  const time = document.getElementById("time")?.value || "";
  const fridgeId = document.getElementById("fridgeId")?.value?.trim() || "";
  const resultBox = document.getElementById("result");
  const submitBtn = document.getElementById("submitBtn");

  if (!date || !round || !fridgeId) return false;

  try {
    const url =
      `${WEB_APP_URL}?action=check_duplicate` +
      `&date=${encodeURIComponent(date)}` +
      `&round=${encodeURIComponent(round)}` +
      `&time=${encodeURIComponent(time)}` +
      `&fridgeId=${encodeURIComponent(fridgeId)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.ok && data.duplicate) {
      const detail = data.data || {};
      const duplicateMessage =
        `เวลา: ${detail.time || time || "-"}\n` +
        `รอบ: ${detail.round || round || "-"}\n` +
        `อุณหภูมิ: ${detail.temp ?? "-"} °C\n` +
        `ผู้บันทึก: ${staffNameForUI(detail.recorderName) || "-"}`;

      showAppPopup(
        false,
        "บันทึกซ้ำไม่ได้",
        duplicateMessage
      );

      showResult(
        resultBox,
        false,
        `${data.message || "รายการนี้ถูกบันทึกแล้ว"}\n${duplicateMessage}`
      );

      if (submitBtn) submitBtn.disabled = true;
      return true;
    }

    return false;
  } catch (error) {
    console.error("checkDuplicateBeforeSave error:", error);
    return false;
  }
}


function onIncidentStatusChange() {
  const statusEl = document.getElementById("updateCaseStatus");
  const actionEl = document.getElementById("updateActionText");

  if (!statusEl) return;

  const status = statusEl.value;

  if (status === "ยกเลิกเคส") {
    const ok = confirm(
      "ยืนยันยกเลิก Incident นี้หรือไม่?\n\nใช้เฉพาะกรณีคีย์ผิด / เลือกตู้ผิด / เปิดเคสผิดเท่านั้น"
    );

    if (!ok) {
      statusEl.value = "";
      return;
    }

    if (actionEl && !actionEl.value.trim()) {
      actionEl.placeholder = "กรุณาระบุเหตุผลการยกเลิก เช่น คีย์ผิด / เลือกตู้ผิด / บันทึกผิดเคส";
      actionEl.focus();
    }
  }
}

function setCurrentIncidentStatusLabel(status) {
  const el = document.getElementById("updateCurrentCaseStatus");
  if (!el) return;
  const text = String(status || "").trim();
  el.textContent = text || "ยังไม่ได้เลือก Incident";
  el.className = `bem-current-status-badge ${text ? getIncidentStatusClass(text) : ""}`.trim();
}

function resetBEMStatusSelection() {
  const statusEl = document.getElementById("updateCaseStatus");
  if (statusEl) statusEl.value = "";
  document.querySelectorAll(".bem-status-choice").forEach(button => {
    button.classList.remove("is-selected");
    button.setAttribute("aria-pressed", "false");
  });
  const selectedText = document.getElementById("updateSelectedStatusText");
  if (selectedText) selectedText.textContent = "ยังไม่ได้เลือกสถานะใหม่";
}

function markBEMStatusSelection(status) {
  const normalized = String(status || "").trim();
  document.querySelectorAll(".bem-status-choice").forEach(button => {
    const selected = String(button.dataset.caseStatus || "").trim() === normalized;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", selected ? "true" : "false");
  });
  const selectedText = document.getElementById("updateSelectedStatusText");
  if (selectedText) {
    selectedText.textContent = normalized
      ? `สถานะใหม่ที่เลือก: ${normalized}`
      : "ยังไม่ได้เลือกสถานะใหม่";
  }
}

function setBEMQuickStatus(status) {
  const incidentId = document.getElementById("updateIncidentId")?.value?.trim() || "";
  if (!incidentId) {
    showResult(document.getElementById("updateIncidentResult"), false, "กรุณาเลือก Incident ก่อนเลือกสถานะใหม่");
    return;
  }

  const statusEl = document.getElementById("updateCaseStatus");
  const actionEl = document.getElementById("updateActionText");
  const fixEl = document.getElementById("updateFixResult");

  if (statusEl) statusEl.value = status;
  markBEMStatusSelection(status);

  const defaultAction = {
    "BEM รับเรื่องแล้ว": "BEM รับเรื่องแล้ว อยู่ระหว่างประเมินหน้างาน",
    "กำลังตรวจสอบ": "กำลังตรวจสอบสาเหตุและสภาพตู้/ระบบแจ้งเตือน",
    "ย้ายเลือดแล้ว / รอติดตาม": "ประสานหน่วยงานและย้ายเลือด/เฝ้าติดตามอุณหภูมิต่อ",
    "ส่งซ่อมภายนอก": "ส่งซ่อมหรือประสานช่างภายนอกแล้ว",
    "ปิดเคส": "ตรวจสอบแล้ว สามารถปิดเคสได้"
  };

  if (actionEl && !actionEl.value.trim()) {
    actionEl.value = defaultAction[status] || "";
  }

  if (fixEl) {
    if (status === "ปิดเคส" && !fixEl.value) fixEl.value = "แก้ไขสำเร็จ";
    if ((status === "กำลังตรวจสอบ" || status === "ย้ายเลือดแล้ว / รอติดตาม") && !fixEl.value) fixEl.value = "ยังแก้ไขไม่ได้";
    if (status === "ส่งซ่อมภายนอก" && !fixEl.value) fixEl.value = "รอช่างภายนอก";
  }

  onIncidentStatusChange();
}

/* V1.8.53 — BEM: "แก้ไขสำเร็จ" closes the Incident automatically. */
function onBEMFixResultChange() {
  const incidentId = document.getElementById("updateIncidentId")?.value?.trim() || "";
  const fixEl = document.getElementById("updateFixResult");
  const statusEl = document.getElementById("updateCaseStatus");
  const actionEl = document.getElementById("updateActionText");
  const selectedText = document.getElementById("updateSelectedStatusText");
  const resultBox = document.getElementById("updateIncidentResult");
  if (!fixEl || !statusEl) return;

  const fixResult = String(fixEl.value || "").trim();
  if (fixResult !== "แก้ไขสำเร็จ") return;

  if (!incidentId) {
    if (resultBox) showResult(resultBox, false, "กรุณาเลือก Incident ก่อนระบุผลการแก้ไข");
    fixEl.value = "";
    return;
  }

  statusEl.value = "ปิดเคส";
  markBEMStatusSelection("ปิดเคส");
  if (actionEl && !actionEl.value.trim()) {
    actionEl.value = "ตรวจสอบแล้ว แก้ไขสำเร็จ สามารถปิดเคสได้";
  }
  if (selectedText) {
    selectedText.textContent = 'ผลการแก้ไข: แก้ไขสำเร็จ → ระบบจะปิดเคสอัตโนมัติเมื่อบันทึก';
  }
  onIncidentStatusChange();
}

function getDashboardDisplayStatus(item) {
  if (item.dashboardStatus === "missing") {
    return {
      text: "ยังไม่บันทึก",
      className: "status-orange",
      sortPriority: 2
    };
  }

  if (item.dashboardStatus === "recorded") {
    return {
      text: "บันทึกแล้ว",
      className: "status-green",
      sortPriority: 3
    };
  }

  if (item.dashboardStatus === "incident_auto") {
    return {
      text: "ตู้เสีย / Incident",
      className: "status-purple",
      sortPriority: 1
    };
  }

  if (item.dashboardStatus === "abnormal") {
    return {
      text: "ผิดปกติ",
      className: "status-red",
      sortPriority: 1
    };
  }

  return {
    text: "ไม่ทราบสถานะ",
    className: "",
    sortPriority: 9
  };
}

    
function getDashboardCardClass(item) {
  if (item.dashboardStatus === "missing") {
    return "monitor-card-orange";
  }

  if (item.dashboardStatus === "recorded") {
    return "monitor-card-green";
  }

  if (item.dashboardStatus === "incident_auto") {
    return "monitor-card-purple";
  }

  if (item.dashboardStatus === "abnormal") {
    return "monitor-card-red";
  }

  return "monitor-card-green";
}
    

function clearDashboard() {
  const resultBox = document.getElementById("dashboardResult");
  const cardContainer = document.getElementById("dashboardCardContainer");
  const title = document.getElementById("dashboardDrillTitle");

  if (cardContainer) cardContainer.innerHTML = "";

  const cardActiveFridges = document.getElementById("cardActiveFridges");
  const cardOpenIncidents = document.getElementById("cardOpenIncidents");
  const cardClosedToday = document.getElementById("cardClosedToday");
  
  const cardMorningRecorded = document.getElementById("cardMorningRecorded");
  const cardMorningMissing = document.getElementById("cardMorningMissing");
  const cardEveningRecorded = document.getElementById("cardEveningRecorded");
  const cardEveningMissing = document.getElementById("cardEveningMissing");

  if (cardActiveFridges) cardActiveFridges.innerText = "0";
  if (cardOpenIncidents) cardOpenIncidents.innerText = "0";
  if (cardClosedToday) cardClosedToday.innerText = "0";
  
  if (cardMorningRecorded) cardMorningRecorded.innerText = "0";
  if (cardMorningMissing) cardMorningMissing.innerText = "0";
  if (cardEveningRecorded) cardEveningRecorded.innerText = "0";
  if (cardEveningMissing) cardEveningMissing.innerText = "0";

  dashboardRowsCache = [];
  dashboardSummaryCache = {};

  if (title) {
    title.innerText = "เลือกการ์ดด้านบนเพื่อดูรายละเอียด";
  }

  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }
}

function getDashboardStatusClass(status) {
  if (status === "ปกติ" || status === "บันทึกแล้ว") return "status-green";
  if (status === "ผิดปกติ") return "status-red";
  if (status === "ยังไม่บันทึก") return "status-orange";
  return "";
}
    
async function legacySubmitIncidentUpdate_v16_UNUSED() {
  const incidentId = document.getElementById("updateIncidentId")?.value?.trim() || "";
  const caseStatus = document.getElementById("updateCaseStatus")?.value?.trim() || "";
  syncLoginIdentityFields();
  const ownerRaw = AUTH_DISABLED_TEMPORARILY
    ? (document.getElementById("updateOwner")?.value?.trim() || "")
    : (getCurrentActorFullName() || getCurrentActorEmail());
  const owner = await resolveStaffFullNameForUI(ownerRaw);
  const actionText = document.getElementById("updateActionText")?.value?.trim() || "";
  const updatedBy = owner;
  const resultBox = document.getElementById("updateIncidentResult");

  if (!incidentId || !caseStatus) {
    showResult(resultBox, false, "กรุณาเลือก Incident และกดเลือกสถานะใหม่");
    return;
  }
  // V1.8.54: ทุกการรับเรื่อง/อัปเดตโดย BEM ต้องมีเลขงาน BEM เพื่อให้ตามงานย้อนหลังได้
  if (!bemJobNo) {
    const bemInput = document.getElementById("updateBEMJobNo");
    if (bemInput) {
      bemInput.focus();
      bemInput.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    showResult(resultBox, false, "กรุณากรอกเลขงาน BEM ก่อนบันทึกการอัปเดต");
    showAppPopup(false, "ยังไม่มีเลขงาน BEM", "กรุณากรอกเลขงาน BEM ก่อนรับเรื่องหรือเปลี่ยนสถานะเคส");
    return;
  }


  const url = `${WEB_APP_URL}?action=incident_update`
    + `&incidentId=${encodeURIComponent(incidentId)}`
    + `&caseStatus=${encodeURIComponent(caseStatus)}`
    + `&owner=${encodeURIComponent(owner)}`
    + `&actionText=${encodeURIComponent(actionText)}`
    + `&fixResult=${encodeURIComponent(fixResult)}`
    + `&updatedBy=${encodeURIComponent(updatedBy)}`
    + `&updatedByEmail=${encodeURIComponent(getCurrentActorEmail())}`
    + `&actorUserId=${encodeURIComponent(getCurrentActorId())}`
    + `&actorEmail=${encodeURIComponent(getCurrentActorEmail())}`
    + `&actorFullName=${encodeURIComponent(getCurrentActorFullName())}`
    + `&actorRole=${encodeURIComponent(getCurrentActorRole())}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.ok) {
      showAppPopup(
        true,
        "บันทึกสำเร็จ",
        `Incident: ${data.incidentId || incidentId}
สถานะ: ${data.caseStatus || caseStatus}`
      );

      showResult(resultBox, true, data.message || "บันทึกสำเร็จ");
      clearIncidentUpdateForm();
      loadOpenIncidentList();
    } else {
      showAppPopup(false, "บันทึกไม่สำเร็จ", data.message || "กรุณาตรวจสอบข้อมูล");
      showResult(resultBox, false, data.message || "บันทึกไม่สำเร็จ");
    }
  } catch (error) {
    showResult(resultBox, false, "อัปเดต Incident ไม่สำเร็จ: " + error);
  }
}


function openMobileMenu() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("mobileOverlay");

  if (sidebar) sidebar.classList.add("open");
  if (overlay) overlay.classList.add("show");
}

function closeMobileMenu() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("mobileOverlay");

  if (sidebar) sidebar.classList.remove("open");
  if (overlay) overlay.classList.remove("show");
}    
    

async function loadTodayLogStatus() {
  const fridgeId = document.getElementById("fridgeId")?.value?.trim() || "";
  const round = document.getElementById("round")?.value?.trim() || "";
  const box = document.getElementById("todayLogStatusBox");
  const submitBtn = document.getElementById("submitBtn");

  currentDuplicateStatus = false;

  if (!box) return;

  if (!fridgeId) {
    box.classList.add("hidden");
    box.innerHTML = "";
    validateForm();
    return;
  }

  try {
    const url =
      `${WEB_APP_URL}?action=today_log_status` +
      `&fridgeId=${encodeURIComponent(fridgeId)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok) {
      box.classList.remove("hidden");
      box.innerHTML = `<div class="today-log-duplicate">โหลดสถานะวันนี้ไม่สำเร็จ</div>`;
      validateForm();
      return;
    }

    const morning = data.data?.morning;
    const evening = data.data?.evening;

    let morningText = "";
    let eveningText = "";

    if (morning) {
      morningText =
        `<div class="today-log-ok">
          รอบเช้า: มีแล้ว | เวลา ${morning.time || "-"} | Temp ${morning.temp ?? "-"} °C | ผู้บันทึก ${staffNameForUI(morning.recorderName) || "-"}
        </div>`;
    } else {
      morningText =
        `<div class="today-log-missing">
          รอบเช้า: ยังไม่มี
        </div>`;
    }

    if (evening) {
      eveningText =
        `<div class="today-log-ok">
          รอบเย็น: มีแล้ว | เวลา ${evening.time || "-"} | Temp ${evening.temp ?? "-"} °C | ผู้บันทึก ${staffNameForUI(evening.recorderName) || "-"}
        </div>`;
    } else {
      eveningText =
        `<div class="today-log-missing">
          รอบเย็น: ยังไม่มี
        </div>`;
    }

    box.classList.remove("hidden");
    box.innerHTML = `
      <div class="today-log-status-title">สถานะการบันทึกวันนี้</div>
      ${morningText}
      ${eveningText}
    `;

    if (round === "เช้า" && morning) {
      currentDuplicateStatus = true;
    }

    if (round === "เย็น" && evening) {
      currentDuplicateStatus = true;
    }

    if (currentDuplicateStatus) {
      box.innerHTML += `
        <div class="today-log-duplicate">
          ⚠️ รอบที่เลือกถูกบันทึกแล้ว ระบบจะไม่อนุญาตให้บันทึกซ้ำ
        </div>
      `;
      if (submitBtn) submitBtn.disabled = true;
    }

    validateForm();

  } catch (error) {
    console.error("loadTodayLogStatus error:", error);
    box.classList.remove("hidden");
    box.innerHTML = `<div class="today-log-duplicate">เชื่อมต่อระบบตรวจสอบข้อมูลวันนี้ไม่ได้</div>`;
  }
}
    
function toggleIncidentHistoryCustomDate() {
  const filter = document.getElementById("incidentHistoryDateFilter")?.value || "";
  const startBox = document.getElementById("incidentHistoryStartDateBox");
  const endBox = document.getElementById("incidentHistoryEndDateBox");

  if (filter === "custom") {
    if (startBox) startBox.classList.remove("hidden");
    if (endBox) endBox.classList.remove("hidden");
  } else {
    if (startBox) startBox.classList.add("hidden");
    if (endBox) endBox.classList.add("hidden");
  }
}

function toggleUpdateIncidentCustomDate() {
  const filter = document.getElementById("updateIncidentDateFilter")?.value || "";
  const startBox = document.getElementById("updateIncidentStartDateBox");
  const endBox = document.getElementById("updateIncidentEndDateBox");

  if (filter === "custom") {
    startBox?.classList.remove("hidden");
    endBox?.classList.remove("hidden");
  } else {
    startBox?.classList.add("hidden");
    endBox?.classList.add("hidden");
  }
}


function clearUpdateIncidentFilter() {
  document.getElementById("updateIncidentDateFilter").value = "today";
  document.getElementById("updateIncidentStatusFilter").value = "waiting_bem";
  document.getElementById("updateIncidentFridgeSearch").value = "";
  document.getElementById("updateIncidentStartDate").value = "";
  document.getElementById("updateIncidentEndDate").value = "";

  toggleUpdateIncidentCustomDate();
  loadOpenIncidentList();
}    


function clearIncidentUpdateForm() {
  const ids = [
    "updateIncidentSelect",
    "updateIncidentId",
    "updateCaseStatus",
    "updateOwner",
    "updateActionText",
    "updateFixResult",
    "updateBy"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = "";
  });

  syncLoginIdentityFields();
  resetBEMStatusSelection();
  setCurrentIncidentStatusLabel("");
  renderUpdateIncidentSummary(null);

  const resultBox = document.getElementById("updateIncidentResult");
  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }

  loadOpenIncidentList();
}
    
function clearHistoryViewOnly() {
  const resultBox = document.getElementById("historyResult");
  const tbody = document.getElementById("historyTableBody");

  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }

  if (tbody) {
    tbody.innerHTML = "";
  }

  lastHistoryRecords = [];
  lastHistoryFridgeId = "";
}

function clearChartOnly() {
  if (tempChart) {
    tempChart.destroy();
    tempChart = null;
  }
}

function clearChartViewOnly() {
  const resultBox = document.getElementById("chartResult");

  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }

  clearChartOnly();
}

    async function loadFridgeList() {
  try {
    const url = `${WEB_APP_URL}?action=list`; // v1.8.9: ใช้ list หลักเหมือน v1.8.2 ก่อน แล้วค่อย fallback all/direct ตอนสแกน QR
    const response = await fetch(url);
    const data = await response.json();

    fridgeMasterList = Array.isArray(data) ? data : [];
    console.log("fridgeMasterList =", fridgeMasterList);

    populateRoomDropdown("roomSelect");
    populateRoomDropdown("historyRoomSelect");
    populateRoomDropdown("chartRoomSelect");
  } catch (error) {
    console.error("โหลดรายการตู้ไม่สำเร็จ", error);
  }
}

function populateRoomDropdown(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const rooms = [...new Set(
    fridgeMasterList
      .map(item => (item.room || "").trim())
      .filter(room => room)
  )].sort();

  select.innerHTML = '<option value="">-- เลือกห้อง --</option>';

  rooms.forEach(room => {
    const option = document.createElement("option");
    option.value = room;
    option.textContent = room;
    select.appendChild(option);
  });
}

function scrollToResult(id) {
  const el = document.getElementById(id);
  if (!el) return;

  setTimeout(() => {
    const yOffset = window.innerWidth <= 768 ? -120 : -20;
    const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;

    window.scrollTo({
      top: y,
      behavior: "smooth"
    });
  }, 200);
}
    
    
function populateFridgeDropdown(selectId, roomValue) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = '<option value="">-- เลือกตู้ --</option>';

  const filtered = fridgeMasterList.filter(item => {
    if (!roomValue) return true;
    return (item.room || "").trim() === roomValue.trim();
  });

  filtered.forEach(item => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.id} - ${item.name}`;
    select.appendChild(option);
  });
}

function normalizeScanText(text) {
  return String(text ?? "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[๐-๙]/g, ch => "๐๑๒๓๔๕๖๗๘๙".indexOf(ch))
    .replace(/[０-９]/g, ch => String(ch.charCodeAt(0) - 0xFF10))
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, "")
    .replace(/-+/g, "-");
}

function normalizeScanKey(text) {
  return normalizeScanText(text).replace(/[^A-Z0-9]/g, "");
}

function normalizeCandidateCode(text) {
  let s = normalizeScanText(text);
  // รองรับ QR/ข้อความแบบ CNB02362 ให้เทียบกับ CN-B-02362 ได้
  s = s.replace(/^CNB(\d{3,8})(-.+)?$/, "CN-B-$1$2");
  return s;
}

function addQrCandidate(list, value) {
  const s = String(value ?? "").trim();
  if (!s) return;
  list.push(s);
  const normalized = normalizeCandidateCode(s);
  if (normalized) list.push(normalized);
  try {
    const decoded = decodeURIComponent(s);
    if (decoded && decoded !== s) {
      list.push(decoded);
      list.push(normalizeCandidateCode(decoded));
    }
  } catch (e) {
    // ignore malformed URI strings from some QR readers
  }
}

function extractFridgeCodeCandidates(scannedText) {
  const candidates = [];
  const raw = String(scannedText ?? "").trim();
  addQrCandidate(candidates, raw);

  const decodedVariants = [];
  try { decodedVariants.push(decodeURIComponent(raw)); } catch (e) {}
  decodedVariants.push(raw);

  // รองรับกรณี QR เป็น URL เช่น ?fridgeId=CN-B-02362 หรือ /CN-B-02362
  decodedVariants.forEach(text => {
    try {
      const url = new URL(text, window.location.origin);
      [
        "fridgeId", "fridge_id", "fridge", "fridgeCode", "fridge_code",
        "id", "code", "qr", "q", "f"
      ].forEach(key => addQrCandidate(candidates, url.searchParams.get(key)));
      url.pathname.split("/").forEach(part => addQrCandidate(candidates, part));
      url.hash.split(/[?#&/=]/).forEach(part => addQrCandidate(candidates, part));
    } catch (e) {
      // ไม่ใช่ URL ก็ไป regex ด้านล่าง
    }

    const codeRegex = /CN\s*[-–—−]?\s*[A-Z]\s*[-–—−]?\s*\d{3,8}(?:\s*[-–—−]?\s*(?:TOP|BOTTOM|UPPER|LOWER))?/gi;
    const cnbRegex = /CNB\s*\d{3,8}(?:\s*[-–—−]?\s*(?:TOP|BOTTOM|UPPER|LOWER))?/gi;
    (text.match(codeRegex) || []).forEach(x => addQrCandidate(candidates, x));
    (text.match(cnbRegex) || []).forEach(x => addQrCandidate(candidates, x));
  });

  const seen = new Set();
  return candidates
    .map(normalizeCandidateCode)
    .filter(Boolean)
    .filter(x => {
      const key = normalizeScanKey(x);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getFridgeSearchCodes(item) {
  if (!item || typeof item !== "object") return [];

  const values = [
    item.id,
    item.fridgeId,
    item.fridge_id,
    item.code,
    item.fridgeCode,
    item.fridge_code,
    item.oldCode,
    item.old_fridge_id,
    item.legacyCode,
    item.legacy_code,
    item.qrCode,
    item.qr_code
  ];

  Object.keys(item).forEach(key => {
    if (/(fridge|code|qr|id)/i.test(key)) values.push(item[key]);
  });

  const seen = new Set();
  return values
    .filter(v => v !== null && v !== undefined && String(v).trim() !== "")
    .map(normalizeCandidateCode)
    .filter(Boolean)
    .filter(v => {
      const key = normalizeScanKey(v);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function scanBaseKey(value) {
  return normalizeScanKey(String(value ?? "").replace(/-(TOP|BOTTOM|UPPER|LOWER)$/i, ""));
}

function findFridgeByFullId(scannedText, list = fridgeMasterList) {
  const items = Array.isArray(list) ? list : [];
  const candidates = extractFridgeCodeCandidates(scannedText);
  const strictKeys = new Set(candidates.map(normalizeScanText));
  const looseKeys = new Set(candidates.map(normalizeScanKey));

  // 1) เทียบ exact/loose ก่อน เพื่อให้พฤติกรรมเหมือน v1.8.2 มากที่สุด แต่ทนช่องว่าง/ขีด/URL เพิ่มขึ้น
  const exactMatch = items.find(item => getFridgeSearchCodes(item).some(code => {
    return strictKeys.has(normalizeScanText(code)) || looseKeys.has(normalizeScanKey(code));
  })) || null;
  if (exactMatch) return exactMatch;

  // 2) ถ้า QR เป็นรหัสฐาน แต่ในระบบมี -TOP/-BOTTOM และพบได้แค่ใบเดียว ให้เลือกให้เลย
  const candidateBaseKeys = new Set(candidates.map(scanBaseKey).filter(Boolean));
  const baseMatches = items.filter(item => getFridgeSearchCodes(item).some(code => {
    const codeBase = scanBaseKey(code);
    return codeBase && candidateBaseKeys.has(codeBase);
  }));

  if (baseMatches.length === 1) return baseMatches[0];
  return null;
}

function rawFridgeRowToUiItem(row) {
  if (!row) return null;
  return {
    id: row.fridge_id || row.id || row.fridgeId || "",
    fridge_id: row.fridge_id || row.id || row.fridgeId || "",
    fridgeId: row.fridge_id || row.id || row.fridgeId || "",
    code: row.code || row.fridge_code || "",
    fridge_code: row.fridge_code || row.code || "",
    name: row.fridge_name || row.name || "",
    type: row.product_type || row.type || "",
    room: row.storage_location || row.room || "",
    oldCode: row.old_fridge_id || row.oldCode || "",
    old_fridge_id: row.old_fridge_id || row.oldCode || "",
    legacyCode: row.legacy_code || row.legacyCode || "",
    legacy_code: row.legacy_code || row.legacyCode || "",
    qr_code: row.qr_code || row.qrCode || "",
    minTemp: row.min_temp ?? row.minTemp ?? "",
    maxTemp: row.max_temp ?? row.maxTemp ?? "",
    status: normalizeFridgeUsageStatusForUI(row.usage_status || row.status || "ใช้งาน"),
    usage_status: row.usage_status || row.status || "",
    morningTime: formatTimeForInput(row.morning_time || row.morningTime || "07:00"),
    eveningTime: formatTimeForInput(row.evening_time || row.eveningTime || "19:00"),
    requireDaily: row.require_daily ?? row.requireDaily ?? true
  };
}

function mergeFridgeList(items) {
  if (!Array.isArray(items) || !items.length) return;
  if (!Array.isArray(fridgeMasterList)) fridgeMasterList = [];

  const existing = new Set(fridgeMasterList.map(x => normalizeScanKey(x?.id || x?.fridge_id || x?.fridgeId)));
  items.forEach(item => {
    if (!item) return;
    const key = normalizeScanKey(item.id || item.fridge_id || item.fridgeId);
    if (!key || existing.has(key)) return;
    fridgeMasterList.push(item);
    existing.add(key);
  });
}

async function loadFridgeListByAction(action) {
  try {
    const response = await fetch(`${WEB_APP_URL}?action=${encodeURIComponent(action)}`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn(`load fridge list failed: ${action}`, e);
    return [];
  }
}

async function lookupFridgeByQrAction(scannedText) {
  try {
    const response = await fetch(`${WEB_APP_URL}?action=qr_lookup&code=${encodeURIComponent(scannedText || "")}`);
    const data = await response.json();
    if (data && data.ok && data.item) {
      return data.item;
    }
    console.warn("qr_lookup did not find fridge", data);
    return null;
  } catch (e) {
    console.warn("qr_lookup failed", e);
    return null;
  }
}

async function findFridgeByFullIdAsync(scannedText) {
  let item = findFridgeByFullId(scannedText);
  if (item) return item;

  // โหลด active list แบบเดียวกับ v1.8.2 อีกครั้งก่อน กันเคสเปิดหน้าแล้ว list ยังมาไม่ทัน
  const activeRows = await loadFridgeListByAction("list");
  if (activeRows.length) {
    fridgeMasterList = activeRows;
    populateRoomDropdown("roomSelect");
    populateRoomDropdown("historyRoomSelect");
    populateRoomDropdown("chartRoomSelect");
    item = findFridgeByFullId(scannedText);
    if (item) return item;
  }

  // ถ้ายังไม่เจอ ค่อยโหลดทุกสถานะ เผื่อ QR อยู่กับตู้ที่เคยถูกซ่อนจาก active list
  const allRows = await loadFridgeListByAction("all_fridge_list");
  if (allRows.length) {
    mergeFridgeList(allRows);
    item = findFridgeByFullId(scannedText);
    if (item) return item;
  }

  // v1.8.12: Fallback แบบยิง Supabase เฉพาะรหัส QR โดยตรง ผ่าน backend wrapper
  const directLookupItem = await lookupFridgeByQrAction(scannedText);
  if (directLookupItem) {
    mergeFridgeList([directLookupItem]);
    item = findFridgeByFullId(scannedText, [directLookupItem]);
    if (item) return item;
    return directLookupItem;
  }

  // Fallback สุดท้าย: อ่าน fridges จาก Supabase ตรง แล้ว filter ใน browser
  try {
    const sb = window.CNMI_SUPABASE_BACKEND?.getClient?.();
    if (sb) {
      const { data, error } = await sb
        .from("temp_fridges")
        .select("*")
        .range(0, 4999);

      if (!error) {
        const rows = (Array.isArray(data) ? data : []).map(rawFridgeRowToUiItem).filter(Boolean);
        mergeFridgeList(rows);
        item = findFridgeByFullId(scannedText, rows);
        if (item) return item;
      } else {
        console.warn("direct Supabase fridge lookup error", error);
      }
    }
  } catch (e) {
    console.warn("direct Supabase QR lookup failed", e);
  }

  return null;
}

function showInvalidFullQrMessage(scannedText) {
  const candidates = extractFridgeCodeCandidates(scannedText);
  const tried = candidates.length ? candidates.join(", ") : "-";
  const masterCount = Array.isArray(fridgeMasterList) ? fridgeMasterList.length : 0;
  const hasSupabaseClient = !!window.CNMI_SUPABASE_BACKEND?.getClient;
  alert(
    `สแกน QR แล้ว แต่จับคู่กับรหัสตู้ในระบบไม่ได้\n\n` +
    `QR ที่อ่านได้: ${scannedText}\n` +
    `รหัสที่ระบบลองหา: ${tried}\n\n` +
    `ข้อมูล debug\n` +
    `- จำนวนตู้ที่หน้าเว็บโหลดได้: ${masterCount}\n` +
    `- Supabase backend ในหน้าเว็บ: ${hasSupabaseClient ? "พร้อมใช้" : "ไม่พร้อมใช้"}\n\n` +
    `ถ้า CN-B-01464 มีจริงใน Supabase แต่จำนวนตู้ที่โหลดได้เป็น 0 หรือไม่มีรหัสนี้ แปลว่าหน้าเว็บกำลังชี้คนละ Supabase project หรือถูก RLS/Policy บล็อกการอ่านตาราง fridges`
  );
}
    
function ensureSelectOption(select, value, text) {
  if (!select || value === null || value === undefined || String(value).trim() === "") return;
  const v = String(value);
  const exists = Array.from(select.options || []).some(opt => String(opt.value) === v);
  if (!exists) {
    const option = document.createElement("option");
    option.value = v;
    option.textContent = text || v;
    select.appendChild(option);
  }
}

async function applyScannedFridgeToForm(scannedText) {
  const item = await findFridgeByFullIdAsync(scannedText);

  if (!item) {
    console.warn("QR not found in fridgeMasterList", { scannedText, fridgeMasterList });
    showInvalidFullQrMessage(scannedText);
    return;
  }

  const roomSelect = document.getElementById("roomSelect");
  const fridgeSelect = document.getElementById("fridgeSelect");
  const fridgeIdInput = document.getElementById("fridgeId");

  if (roomSelect) {
    ensureSelectOption(roomSelect, item.room || "", item.room || "");
    roomSelect.value = item.room || "";
    populateFridgeDropdown("fridgeSelect", item.room || "");
  }

  if (fridgeSelect) {
    ensureSelectOption(fridgeSelect, item.id, `${item.id} - ${item.name || ""}`);
    fridgeSelect.value = item.id;
  }

  if (fridgeIdInput) {
    fridgeIdInput.value = item.id;
  }

  selectedFridgeInfo = item;
  setRoundTimeFromMaster();
  autoSelectRoundByCurrentTime({ force: false });
  validateForm();
}

async function applyScannedFridgeToHistory(scannedText) {
  const item = await findFridgeByFullIdAsync(scannedText);

  if (!item) {
    showInvalidFullQrMessage(scannedText);
    return;
  }

  const roomSelect = document.getElementById("historyRoomSelect");
  const fridgeSelect = document.getElementById("historyFridgeSelect");
  const fridgeIdInput = document.getElementById("historyFridgeId");

  if (roomSelect) {
    roomSelect.value = item.room || "";
    populateFridgeDropdown("historyFridgeSelect", item.room || "");
  }

  if (fridgeSelect) {
    fridgeSelect.value = item.id;
  }

  if (fridgeIdInput) {
    fridgeIdInput.value = item.id;
  }

  setDefaultHistoryDateRange(false);
  autoLoadHistoryIfReady();
}

async function applyScannedFridgeToChart(scannedText) {
  const item = await findFridgeByFullIdAsync(scannedText);

  if (!item) {
    showInvalidFullQrMessage(scannedText);
    return;
  }

  const roomSelect = document.getElementById("chartRoomSelect");
  const fridgeSelect = document.getElementById("chartFridgeSelect");
  const fridgeIdInput = document.getElementById("chartFridgeId");

  if (roomSelect) {
    roomSelect.value = item.room || "";
    populateFridgeDropdown("chartFridgeSelect", item.room || "");
  }

  if (fridgeSelect) {
    fridgeSelect.value = item.id;
  }

  if (fridgeIdInput) {
    fridgeIdInput.value = item.id;
  }

  setDefaultChartDateRange(false);
  autoLoadChartIfReady();
}
    
    
function onRoomChange() {
  const room = document.getElementById("roomSelect").value;
  populateFridgeDropdown("fridgeSelect", room);

  document.getElementById("fridgeSelect").value = "";
  document.getElementById("fridgeId").value = "";
  selectedFridgeInfo = null;

  const round = document.getElementById("round")?.value || "";
  const timeEl = document.getElementById("time");

  if (timeEl) {
    if (round) {
      setRoundTimeFromMaster();
    } else {
      timeEl.value = "";
    }
  }

  validateForm();
}

function onHistoryRoomChange() {
  const room = document.getElementById("historyRoomSelect").value;
  populateFridgeDropdown("historyFridgeSelect", room);

  document.getElementById("historyFridgeSelect").value = "";
  document.getElementById("historyFridgeId").value = "";
}

function onChartRoomChange() {
  const room = document.getElementById("chartRoomSelect").value;
  populateFridgeDropdown("chartFridgeSelect", room);

  document.getElementById("chartFridgeSelect").value = "";
  document.getElementById("chartFridgeId").value = "";
}

function onChartSelectChange() {
  const select = document.getElementById("chartFridgeSelect");
  const input = document.getElementById("chartFridgeId");

  if (select && input) {
    input.value = select.value;
  }

  setDefaultChartDateRange(false);
  autoLoadChartIfReady();
}
    
function onSelectChange() {
  const select = document.getElementById("fridgeSelect");
  const fridgeIdInput = document.getElementById("fridgeId");

  if (select && fridgeIdInput) {
    fridgeIdInput.value = select.value;
    selectedFridgeInfo = fridgeMasterList.find(item => item.id === select.value) || null;
  }

  setRoundTimeFromMaster();
  loadTodayLogStatus();
  validateForm();
}

function onHistorySelectChange() {
  const select = document.getElementById("historyFridgeSelect");
  const input = document.getElementById("historyFridgeId");

  if (select && input) {
    input.value = select.value;
  }

  setDefaultHistoryDateRange(false);
  autoLoadHistoryIfReady();
}

async function toggleHistoryScanner() {
  const reader = document.getElementById("historyReader");

  if (!historyScannerOpen) {
    reader.classList.remove("hidden");

    historyHtml5QrCode = new Html5Qrcode("historyReader");
    historyScannerOpen = true;

    try {
      await historyHtml5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        async (decodedText) => {
          if (qrApplyInProgress) return;
          qrApplyInProgress = true;
          try {
            stopHistoryScanner();
            await applyScannedFridgeToHistory(decodedText.trim());
          } finally {
            qrApplyInProgress = false;
          }
        },
        () => {}
      );
    } catch (err) {
      showResult(document.getElementById("historyResult"), false, "เปิดกล้องไม่ได้: " + err);
      historyScannerOpen = false;
    }
  } else {
    stopHistoryScanner();
  }
}


    
function stopHistoryScanner() {
  const reader = document.getElementById("historyReader");

  if (historyHtml5QrCode && historyScannerOpen) {
    historyHtml5QrCode.stop()
      .then(() => {
        historyHtml5QrCode.clear();
        reader.classList.add("hidden");
        historyScannerOpen = false;
      })
      .catch(() => {
        reader.classList.add("hidden");
        historyScannerOpen = false;
      });
  }
}

async function toggleChartScanner() {
  const reader = document.getElementById("chartReader");

  if (!chartScannerOpen) {
    reader.classList.remove("hidden");

    chartHtml5QrCode = new Html5Qrcode("chartReader");
    chartScannerOpen = true;

    try {
      await chartHtml5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        async (decodedText) => {
          if (qrApplyInProgress) return;
          qrApplyInProgress = true;
          try {
            stopChartScanner();
            await applyScannedFridgeToChart(decodedText.trim());
          } finally {
            qrApplyInProgress = false;
          }
        },
        () => {}
      );
    } catch (err) {
      showResult(document.getElementById("chartResult"), false, "เปิดกล้องไม่ได้: " + err);
      chartScannerOpen = false;
    }
  } else {
    stopChartScanner();
  }
}

function onFridgeIdInput() {
  const fridgeIdInput = document.getElementById("fridgeId");
  const fridgeId = fridgeIdInput?.value?.trim() || "";

  if (!fridgeId) {
    selectedFridgeInfo = null;
    validateForm();
    return;
  }

  const item = findFridgeByFullId(fridgeId);

  if (item) {
    const roomSelect = document.getElementById("roomSelect");
    const fridgeSelect = document.getElementById("fridgeSelect");

    if (roomSelect) {
      roomSelect.value = item.room || "";
      populateFridgeDropdown("fridgeSelect", item.room || "");
    }

    if (fridgeSelect) {
      fridgeSelect.value = item.id;
    }

    if (fridgeIdInput) {
      fridgeIdInput.value = item.id;
    }

    selectedFridgeInfo = item;
    setRoundTimeFromMaster();
  } else {
    selectedFridgeInfo = null;
  }

  loadTodayLogStatus();
  validateForm();
}

function onHistoryFridgeIdInput() {
  const text = document.getElementById("historyFridgeId")?.value?.trim() || "";
  if (!text) return;
  const item = findFridgeByFullId(text);
  if (!item) return;

  const roomSelect = document.getElementById("historyRoomSelect");
  const fridgeSelect = document.getElementById("historyFridgeSelect");

  if (roomSelect) {
    roomSelect.value = item.room || "";
    populateFridgeDropdown("historyFridgeSelect", item.room || "");
  }

  if (fridgeSelect) {
    fridgeSelect.value = item.id;
  }

  document.getElementById("historyFridgeId").value = item.id;
  setDefaultHistoryDateRange(false);
  autoLoadHistoryIfReady();
}

function onChartFridgeIdInput() {
  const text = document.getElementById("chartFridgeId")?.value?.trim() || "";
  if (!text) return;
  const item = findFridgeByFullId(text);
  if (!item) return;

  const roomSelect = document.getElementById("chartRoomSelect");
  const fridgeSelect = document.getElementById("chartFridgeSelect");

  if (roomSelect) {
    roomSelect.value = item.room || "";
    populateFridgeDropdown("chartFridgeSelect", item.room || "");
  }

  if (fridgeSelect) {
    fridgeSelect.value = item.id;
  }

  document.getElementById("chartFridgeId").value = item.id;
  setDefaultChartDateRange(false);
  autoLoadChartIfReady();
}

    
function setRoundTimeFromMaster() {
  setTimeByRound();
}
    
function stopChartScanner() {
  const reader = document.getElementById("chartReader");

  if (chartHtml5QrCode && chartScannerOpen) {
    chartHtml5QrCode.stop()
      .then(() => {
        chartHtml5QrCode.clear();
        reader.classList.add("hidden");
        chartScannerOpen = false;
      })
      .catch(() => {
        reader.classList.add("hidden");
        chartScannerOpen = false;
      });
  }
}
    
    function setToday() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const yyyy2 = twoYearsAgo.getFullYear();
  const mm2 = String(twoYearsAgo.getMonth() + 1).padStart(2, '0');
  const dd2 = String(twoYearsAgo.getDate()).padStart(2, '0');
  const twoYearsAgoStr = `${yyyy2}-${mm2}-${dd2}`;

  const dateEl = document.getElementById("date");
  const startDateEl = document.getElementById("startDate");
  const endDateEl = document.getElementById("endDate");
  const chartStartDateEl = document.getElementById("chartStartDate");
  const chartEndDateEl = document.getElementById("chartEndDate");

  if (dateEl) dateEl.value = todayStr;
  if (startDateEl) startDateEl.value = twoYearsAgoStr;
  if (endDateEl) endDateEl.value = todayStr;
  if (chartStartDateEl) chartStartDateEl.value = todayStr;
  if (chartEndDateEl) chartEndDateEl.value = todayStr;
  setDefaultHistoryDateRange(true);
  setDefaultChartDateRange(true);
  autoSelectRoundByCurrentTime({ force: true });
}

function resetFormState() {
  selectedFridgeInfo = null;

  const roundEl = document.getElementById("round");
  const roomEl = document.getElementById("roomSelect");
  const fridgeSelectEl = document.getElementById("fridgeSelect");
  const fridgeIdEl = document.getElementById("fridgeId");
  const tempEl = document.getElementById("temp");
  const timeEl = document.getElementById("time");
  const recorderEl = document.getElementById("recorderName");
  const noteEl = document.getElementById("note");
  const resultEl = document.getElementById("result");
  const recordTypeEl = document.getElementById("recordType");
  const noTempReasonEl = document.getElementById("noTempReason");
  const noTempDetailEl = document.getElementById("noTempDetail");
  const noTempReasonBox = document.getElementById("noTempReasonBox");
  const noTempDetailBox = document.getElementById("noTempDetailBox");

  if (roundEl) roundEl.value = "";
  if (roomEl) roomEl.value = "";
  if (fridgeSelectEl) fridgeSelectEl.innerHTML = '<option value="">-- เลือกตู้ --</option>';
  if (fridgeIdEl) fridgeIdEl.value = "";
  if (tempEl) tempEl.value = "";
  if (timeEl) timeEl.value = "";
  if (recorderEl) recorderEl.value = getCurrentActorFullName() || getCurrentActorEmail() || "";
  if (noteEl) {
    noteEl.value = "";
    noteEl.placeholder = "ถ้ามี";
    noteEl.classList.remove("required-warning");
  }
  if (recordTypeEl) recordTypeEl.value = "TEMP";
  if (noTempReasonEl) noTempReasonEl.value = "";
  if (noTempDetailEl) noTempDetailEl.value = "";
  if (noTempReasonBox) noTempReasonBox.classList.add("hidden");
  if (noTempDetailBox) noTempDetailBox.classList.add("hidden");
  if (tempEl) {
    tempEl.disabled = false;
    tempEl.placeholder = "เช่น 4.0 หรือ -20.0";
  }

  if (resultEl) {
    resultEl.style.display = "none";
    resultEl.innerText = "";
    resultEl.className = "result";
  }
  syncLoginIdentityFields();
}
    
function resolveFormFridgeId() {
  const selectValue = document.getElementById("fridgeSelect")?.value?.trim() || "";
  const inputValue = document.getElementById("fridgeId")?.value?.trim() || "";
  const selectedId = selectedFridgeInfo?.id ? String(selectedFridgeInfo.id).trim() : "";
  const fridgeId = selectedId || selectValue || inputValue;

  const fridgeIdEl = document.getElementById("fridgeId");
  if (fridgeIdEl && fridgeId && fridgeIdEl.value !== fridgeId) fridgeIdEl.value = fridgeId;

  if (!selectedFridgeInfo && fridgeId) {
    selectedFridgeInfo = findFridgeByFullId(fridgeId) || fridgeMasterList.find(item => item.id === fridgeId) || null;
  }

  return fridgeId;
}

function getMissingFormReasonForSave() {
  const date = document.getElementById("date")?.value?.trim() || "";
  const room = document.getElementById("roomSelect")?.value?.trim() || "";
  const round = document.getElementById("round")?.value?.trim() || "";
  const fridgeId = resolveFormFridgeId();
  const temp = normalizeTempInputValue();
  const time = document.getElementById("time")?.value?.trim() || "";
  const recorderName = AUTH_DISABLED_TEMPORARILY
    ? (document.getElementById("recorderName")?.value?.trim() || "")
    : (getCurrentActorFullName() || getCurrentActorEmail());
  const recordType = document.getElementById("recordType")?.value || "TEMP";
  const noTempReason = document.getElementById("noTempReason")?.value?.trim() || "";
  const noTempDetail = document.getElementById("noTempDetail")?.value?.trim() || "";

  const missing = [];
  if (!date) missing.push("วันที่");
  if (!room) missing.push("ห้อง / สถานที่เก็บ");
  if (!round) missing.push("รอบ");
  if (!fridgeId) missing.push("เลือกตู้");
  if (!time) missing.push("เวลา");
  if (!recorderName) missing.push("ชื่อผู้บันทึก");

  if (recordType === "TEMP" && parseNullableNumber(temp) === null) missing.push("อุณหภูมิ");
  if (recordType === "NO_TEMP") {
    if (!noTempReason) missing.push("เหตุผลที่ไม่สามารถวัดอุณหภูมิได้");
    if (!noTempDetail) missing.push("รายละเอียดเพิ่มเติม");
  }

  return missing;
}


// V1.8.44 — ป้องกันเผลอกดล้างข้อมูล และจัดปุ่ม Action ให้ชัดเจนบนมือถือ
function isTemperatureFormDirty() {
  const room = document.getElementById("roomSelect")?.value?.trim() || "";
  const fridgeSelect = document.getElementById("fridgeSelect")?.value?.trim() || "";
  const fridgeId = document.getElementById("fridgeId")?.value?.trim() || "";
  const recordType = document.getElementById("recordType")?.value || "TEMP";
  const round = document.getElementById("round")?.value?.trim() || "";
  const temp = document.getElementById("temp")?.value?.trim() || "";
  const noTempReason = document.getElementById("noTempReason")?.value?.trim() || "";
  const noTempDetail = document.getElementById("noTempDetail")?.value?.trim() || "";
  const note = document.getElementById("note")?.value?.trim() || "";
  const recorder = document.getElementById("recorderName")?.value?.trim() || "";
  const defaultRecorder = (getCurrentActorFullName() || getCurrentActorEmail() || "").trim();

  return !!(
    room || fridgeSelect || fridgeId || temp || noTempReason || noTempDetail || note ||
    recordType !== "TEMP" || round === "ผิดปกติ" || recorder !== defaultRecorder
  );
}

function updateClearFormButtonState() {
  const clearBtn = document.getElementById("clearFormBtn");
  if (!clearBtn) return;
  clearBtn.disabled = !isTemperatureFormDirty();
}

async function submitForm() {
  const date = document.getElementById("date")?.value || "";
  const round = document.getElementById("round")?.value || "";
  const time = document.getElementById("time")?.value || "";
  const fridgeId = resolveFormFridgeId();
  const temp = normalizeTempInputValue();
  syncLoginIdentityFields();
  const recorderNameRaw = AUTH_DISABLED_TEMPORARILY
    ? (document.getElementById("recorderName")?.value?.trim() || "")
    : (getCurrentActorFullName() || getCurrentActorEmail());
  const recorderName = await resolveStaffFullNameForUI(recorderNameRaw);
  const note = document.getElementById("note")?.value?.trim() || "";
  const resultBox = document.getElementById("result");

  const recordType = document.getElementById("recordType")?.value || "TEMP";
  const noTempReason = document.getElementById("noTempReason")?.value?.trim() || "";
  const noTempDetail = document.getElementById("noTempDetail")?.value?.trim() || "";

  const missingBasic = getMissingFormReasonForSave();
  if (missingBasic.length) {
    const message = `กรุณากรอกข้อมูลให้ครบ\nขาด: ${missingBasic.join(", ")}`;

    showAppPopup(false, "ข้อมูลไม่ครบ", message);
    showResult(resultBox, false, message);
    validateForm();
    return;
  }

  if (recordType === "TEMP" && parseNullableNumber(temp) === null) {
    showAppPopup(false, "ข้อมูลไม่ครบ", "กรุณากรอกอุณหภูมิเป็นตัวเลข เช่น 4.0 หรือ -20.0");
    showResult(resultBox, false, "กรุณากรอกอุณหภูมิเป็นตัวเลข เช่น 4.0 หรือ -20.0");
    validateForm();
    return;
  }

  if (recordType === "NO_TEMP" && (!noTempReason || !noTempDetail)) {
    const missing = [];
    if (!noTempReason) missing.push("เหตุผลที่ไม่สามารถวัดอุณหภูมิได้");
    if (!noTempDetail) missing.push("รายละเอียดเพิ่มเติม");

    const message =
      `กรุณาระบุเหตุผลและรายละเอียดที่ไม่สามารถวัดอุณหภูมิได้\nขาด: ${missing.join(", ")}`;

    showAppPopup(false, "ข้อมูลไม่ครบ", message);
    showResult(resultBox, false, message);
    validateForm();
    return;
  }

  const isDuplicate = await checkDuplicateBeforeSave();
  if (isDuplicate) {
    return;
  }

  let isAbnormal = false;

  if (recordType === "TEMP" && selectedFridgeInfo) {
    isAbnormal = isTemperatureAbnormal(temp, selectedFridgeInfo);
  }

  if (recordType === "TEMP" && (isAbnormal || round === "ผิดปกติ") && !note) {
    showAppPopup(
      false,
      "บันทึกไม่สำเร็จ",
      "รอบผิดปกติหรืออุณหภูมิผิดช่วง กรุณากรอกการดำเนินการ"
    );

    showResult(resultBox, false, "รอบผิดปกติหรืออุณหภูมิผิดช่วง กรุณากรอกการดำเนินการ");
    validateForm();
    return;
  }

  const params = new URLSearchParams();

  params.set("date", date);
  params.set("round", round);
  params.set("time", time);
  params.set("fridgeId", fridgeId);
  params.set("temp", recordType === "NO_TEMP" ? "-" : temp);
  params.set("recorderName", recorderName);
  params.set("note", note);
  params.set("recordType", recordType);
  params.set("noTempReason", noTempReason);
  params.set("noTempDetail", noTempDetail);
  appendActorParams(params);

  try {
    const response = await fetch(`${WEB_APP_URL}?${params.toString()}`);
    const data = await response.json();

    if (data.ok) {
      showAppPopup(
        true,
        "บันทึกสำเร็จ",
        buildTemperaturePopupMessage(data)
      );

      showResult(resultBox, true, data.message || "บันทึกสำเร็จ");

      clearForm(false);
      loadDashboard();

    } else {
      showAppPopup(
        false,
        "บันทึกไม่สำเร็จ",
        data.message || "กรุณาตรวจสอบข้อมูล"
      );

      showResult(resultBox, false, data.message || "บันทึกไม่สำเร็จ");
    }

  } catch (error) {
    showAppPopup(
      false,
      "บันทึกไม่สำเร็จ",
      String(error)
    );

    showResult(resultBox, false, "บันทึกไม่สำเร็จ: " + error);
  }
}

function clearForm(requireConfirmation = true) {
  if (requireConfirmation && isTemperatureFormDirty()) {
    const confirmed = window.confirm(
      "ต้องการล้างข้อมูลที่กรอกทั้งหมดหรือไม่?\nข้อมูลที่ยังไม่ได้บันทึกจะถูกล้าง"
    );
    if (!confirmed) {
      updateClearFormButtonState();
      return false;
    }
  }
  const roomSelect = document.getElementById("roomSelect");
  const fridgeSelect = document.getElementById("fridgeSelect");
  const fridgeId = document.getElementById("fridgeId");
  const temp = document.getElementById("temp");
  const recorderName = document.getElementById("recorderName");
  const note = document.getElementById("note");
  const result = document.getElementById("result");
  const round = document.getElementById("round");
  const time = document.getElementById("time");

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const date = document.getElementById("date");
  if (date) date.value = todayStr;

  if (roomSelect) roomSelect.value = "";
  if (fridgeSelect) fridgeSelect.innerHTML = '<option value="">-- เลือกตู้ --</option>';
  if (fridgeId) fridgeId.value = "";
  if (temp) temp.value = "";
  if (recorderName) recorderName.value = getCurrentActorFullName() || getCurrentActorEmail() || "";
  if (note) note.value = "";

  selectedFridgeInfo = null;

  if (result) {
    result.style.display = "none";
    result.innerText = "";
    result.className = "result";
  }

  if (round) round.value = "";
  if (time) time.value = "";
  syncLoginIdentityFields();

  const todayLogStatusBox = document.getElementById("todayLogStatusBox");

  if (todayLogStatusBox) {
    todayLogStatusBox.classList.add("hidden");
    todayLogStatusBox.innerHTML = "";
  }

  currentDuplicateStatus = false;

  autoSelectRoundByCurrentTime({ force: true });
  validateForm();
  updateClearFormButtonState();
  return true;
}
    
async function loadHistory() {
  const fridgeId = document.getElementById("historyFridgeId")?.value?.trim() || "";
  const startDate = document.getElementById("startDate")?.value || "";
  const endDate = document.getElementById("endDate")?.value || "";
  const resultBox = document.getElementById("historyResult");
  const tbody = document.getElementById("historyTableBody");

  if (!fridgeId || !startDate || !endDate) {
    showResult(resultBox, false, "กรุณาเลือกห้อง/ตู้ หรือสแกน QR ก่อน");
    if (tbody) tbody.innerHTML = "";
    lastHistoryRecords = [];
    lastHistoryFridgeId = "";
    return;
  }

  const url =
    `${WEB_APP_URL}?action=history&fridgeId=${encodeURIComponent(fridgeId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok) {
      showResult(resultBox, false, data.message || "โหลดข้อมูลไม่ได้");
      scrollToResult("historyResult");
      if (tbody) tbody.innerHTML = "";
      lastHistoryRecords = [];
      lastHistoryFridgeId = "";
      return;
    }

    const records = Array.isArray(data.records) ? data.records : [];
    lastHistoryRecords = records;
    lastHistoryFridgeId = fridgeId;
    renderHistoryTable(records);

    showResult(
      resultBox,
      true,
      `พบข้อมูล ${records.length} รายการ\nรายการที่แก้ไขอุณหภูมิ ${records.filter(r => r.hasCorrection).length} รายการ\nตู้: ${data.fridgeName || "-"}\nช่วงวันที่: ${startDate} ถึง ${endDate}\nช่วงอุณหภูมิ: ${data.minTemp} ถึง ${data.maxTemp} °C`
    );

    scrollToResult("historyResult");

  } catch (error) {
    showResult(resultBox, false, "โหลดข้อมูลไม่ได้: " + error);
    scrollToResult("historyResult");
  }
}

function renderHistoryTable(records) {
  const tbody = document.getElementById("historyTableBody"); if (!tbody) return; tbody.innerHTML = "";
  if (!records || records.length === 0) { tbody.innerHTML = '<tr><td colspan="8" class="empty-cell">ไม่พบข้อมูลในช่วงวันที่นี้</td></tr>'; return; }
  records.forEach(r => {
    const statusClass = r.status === "ปกติ" ? "status-green" : (r.status === "ผิดปกติ" ? "status-red" : "status-orange");
    const actionText = r.originalRecordType === "NO_TEMP" ? `${r.noTempReason || "ไม่สามารถวัดอุณหภูมิได้"}${r.noTempDetail ? " | " + r.noTempDetail : ""}` : (r.action || "");
    const correctionInfo = r.hasCorrection ? `<div class="correction-note"><strong>แก้ไขแล้ว:</strong> ${escapeHtml(r.originalTempDisplay ?? "-")} → ${escapeHtml(r.tempDisplay ?? "-")} °C<br><span>${escapeHtml(r.correctionReason || "-")} • ${escapeHtml(r.correctedBy || "-")}</span></div>` : "";
    const tempCell = r.hasCorrection ? `<span class="corrected-temp">${escapeHtml(r.tempDisplay ?? "-")} °C</span><br><span class="original-temp-strike">เดิม ${escapeHtml(r.originalTempDisplay ?? "-")} °C</span>` : escapeHtml(r.tempDisplay ?? r.temp ?? "");
    const correctionButton = r.autoGenerated
      ? '<span class="small-note">ระบบอัตโนมัติ</span>'
      : `<button type="button" class="mini-action-btn" onclick="openTempCorrectionModal('${encodeURIComponent(r.logId || "")}')">${r.hasCorrection ? "แก้ไขอีกครั้ง" : "บันทึกค่าที่ถูกต้อง"}</button>`;
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(r.date || "")}</td><td>${escapeHtml(r.time || "")}</td><td>${escapeHtml(r.round || "")}</td><td>${tempCell}</td><td><span class="status-badge ${statusClass}">${escapeHtml(r.status || "")}${r.hasCorrection ? " (แก้ไข)" : ""}</span></td><td>${escapeHtml(actionText)}${correctionInfo}</td><td>${escapeHtml(staffNameForUI(r.recorderName) || "")}</td><td>${correctionButton}</td>`;
    tbody.appendChild(tr);
  });
}
function openTempCorrectionModal(encodedLogId) {
  const logId = decodeURIComponent(String(encodedLogId || "")); const row = lastHistoryRecords.find(item => String(item?.logId || "") === logId) || null; const modal = document.getElementById("tempCorrectionModal"); if (!modal || !row) return;
  document.getElementById("tempCorrectionLogId").value = logId;
  document.getElementById("tempCorrectionInfo").innerHTML = `<strong>${escapeHtml(logId)}</strong><br>${escapeHtml(row.date || "-")} ${escapeHtml(row.time || "")} • รอบ${escapeHtml(row.round || "-")} • ${escapeHtml(row.fridgeId || "-")}<br>ค่าที่บันทึกเดิม: <strong>${escapeHtml(row.originalTempDisplay ?? row.tempDisplay ?? "-")} °C</strong>${row.relatedIncidentId ? `<br>Incident: ${escapeHtml(row.relatedIncidentId)}` : ""}`;
  document.getElementById("tempCorrectionValue").value = row.hasCorrection && row.correctedTemp !== null && row.correctedTemp !== undefined ? row.correctedTemp : "";
  document.getElementById("tempCorrectionReason").value = row.hasCorrection ? (row.correctionReason || "") : ""; document.getElementById("tempCorrectionBy").value = row.hasCorrection ? (row.correctedBy || "") : (getCurrentActorFullName() || "");
  const result = document.getElementById("tempCorrectionResult"); if (result) { result.style.display = "none"; result.innerText = ""; result.className = "result"; }
  modal.classList.remove("hidden"); document.body.classList.add("guide-modal-open");
}
function closeTempCorrectionModal() { document.getElementById("tempCorrectionModal")?.classList.add("hidden"); document.body.classList.remove("guide-modal-open"); }
async function submitTempCorrection() {
  const logId = document.getElementById("tempCorrectionLogId")?.value?.trim() || ""; const correctedTemp = document.getElementById("tempCorrectionValue")?.value?.trim() || ""; const reason = document.getElementById("tempCorrectionReason")?.value?.trim() || ""; const correctedBy = document.getElementById("tempCorrectionBy")?.value?.trim() || ""; const result = document.getElementById("tempCorrectionResult");
  if (!logId || parseNullableNumber(correctedTemp) === null || !reason || !correctedBy) { showResult(result, false, "กรุณากรอกอุณหภูมิที่ถูกต้อง เหตุผล และชื่อผู้แก้ไขให้ครบ"); return; }
  try { showResult(result, true, "กำลังบันทึกการแก้ไข..."); const params = new URLSearchParams({ action: "temp_correct_log", logId, correctedTemp, reason, correctedBy }); const response = await fetch(`${WEB_APP_URL}?${params.toString()}`); const data = await response.json(); if (!data.ok) throw new Error(data.message || "บันทึกการแก้ไขไม่สำเร็จ"); showAppPopup(true, "บันทึกค่าที่ถูกต้องแล้ว", `เก็บค่าเดิมไว้เพื่อ Audit และใช้ ${correctedTemp} °C เป็นค่าปัจจุบันสำหรับตาราง/กราฟ โดยไม่เปิด Incident ใหม่และไม่เปลี่ยนสถานะเคสเดิม`); closeTempCorrectionModal(); await loadHistory(); }
  catch (error) { showResult(result, false, "บันทึกการแก้ไขไม่สำเร็จ: " + (error?.message || error)); }
}

function clearHistoryForm() {
  const historyRoomSelect = document.getElementById("historyRoomSelect");
  const historyFridgeSelect = document.getElementById("historyFridgeSelect");
  const historyFridgeId = document.getElementById("historyFridgeId");
  const startDate = document.getElementById("startDate");
  const endDate = document.getElementById("endDate");
  const historyResult = document.getElementById("historyResult");
  const historyTableBody = document.getElementById("historyTableBody");
  const historyReader = document.getElementById("historyReader");

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const oneMonthAgoStr = toDateInputValue(oneMonthAgo);

  if (historyRoomSelect) historyRoomSelect.value = "";
  if (historyFridgeSelect) historyFridgeSelect.innerHTML = '<option value="">-- เลือกตู้ --</option>';
  if (historyFridgeId) historyFridgeId.value = "";
  if (startDate) startDate.value = oneMonthAgoStr;
  if (endDate) endDate.value = todayStr;

  if (historyResult) {
    historyResult.style.display = "none";
    historyResult.innerText = "";
    historyResult.className = "result";
  }

  if (historyTableBody) {
    historyTableBody.innerHTML = "";
  }

  if (historyReader) {
    historyReader.classList.add("hidden");
  }

  lastHistoryRecords = [];
  lastHistoryFridgeId = '';
}
    
async function loadChartData() {
  const fridgeId = document.getElementById("chartFridgeId")?.value?.trim() || "";
  const startDate = document.getElementById("chartStartDate")?.value || "";
  const endDate = document.getElementById("chartEndDate")?.value || "";
  const resultBox = document.getElementById("chartResult");

  if (!fridgeId || !startDate || !endDate) {
    showResult(resultBox, false, "กรุณากรอกข้อมูลให้ครบ");
    scrollToResult("chartResult");
    clearChartOnly();
    return;
  }

  const url =
    `${WEB_APP_URL}?action=history` +
    `&fridgeId=${encodeURIComponent(fridgeId)}` +
    `&startDate=${encodeURIComponent(startDate)}` +
    `&endDate=${encodeURIComponent(endDate)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok) {
      showResult(resultBox, false, data.message || "โหลดกราฟไม่ได้");
      scrollToResult("chartResult");
      clearChartOnly();
      return;
    }

    const records = Array.isArray(data.records) ? data.records : [];

    const graphRecords = records.filter(r => {
      return r.recordType !== "NO_TEMP" &&
             r.isValidForGraph !== false &&
             r.temp !== null &&
             r.temp !== "" &&
             !isNaN(Number(r.temp));
    });

    const noPlotRecords = records.filter(r => {
      return r.recordType === "NO_TEMP" ||
             r.isValidForGraph === false ||
             r.temp === null ||
             r.temp === "" ||
             isNaN(Number(r.temp));
    });

    let noteText = "";

    if (noPlotRecords.length > 0) {
      noteText =
        "\n\nหมายเหตุ: มีรายการที่ไม่แสดงบนกราฟ\n" +
        noPlotRecords.map(r => {
          const reason = r.noTempReason || r.action || "-";
          const detail = r.noTempDetail ? ` (${r.noTempDetail})` : "";
          return `- ${r.date || "-"} ${r.time || ""} รอบ${r.round || "-"}: ${reason}${detail}`;
        }).join("\n");
    }

    showResult(
      resultBox,
      true,
      `พบข้อมูล ${records.length} รายการ\nใช้พล็อตกราฟ ${graphRecords.length} รายการ\nรายการที่แก้ไขอุณหภูมิ ${records.filter(r => r.hasCorrection).length} รายการ${records.some(r => r.hasCorrection && r.originalTemp !== null) ? " (ค่าเดิมแสดงเป็นเส้นประ)" : ""}\nตู้: ${data.fridgeName || "-"}\nช่วงอุณหภูมิ: ${data.minTemp} ถึง ${data.maxTemp} °C${noteText}`
    );

    scrollToResult("chartResult");

    if (graphRecords.length === 0) {
      clearChartOnly();
      return;
    }

    drawChart(graphRecords, data.minTemp, data.maxTemp, fridgeId);

  } catch (error) {
    showResult(resultBox, false, "โหลดกราฟไม่ได้: " + error);
    scrollToResult("chartResult");
    clearChartOnly();
  }
}

function clearChartForm() {
  const chartRoomSelect = document.getElementById("chartRoomSelect");
  const chartFridgeSelect = document.getElementById("chartFridgeSelect");
  const chartFridgeId = document.getElementById("chartFridgeId");
  const chartStartDate = document.getElementById("chartStartDate");
  const chartEndDate = document.getElementById("chartEndDate");
  const chartResult = document.getElementById("chartResult");
  const chartReader = document.getElementById("chartReader");

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const oneMonthAgoStr = toDateInputValue(oneMonthAgo);

  if (chartRoomSelect) chartRoomSelect.value = "";
  if (chartFridgeSelect) chartFridgeSelect.innerHTML = '<option value="">-- เลือกตู้ --</option>';
  if (chartFridgeId) chartFridgeId.value = "";
  if (chartStartDate) chartStartDate.value = oneMonthAgoStr;
  if (chartEndDate) chartEndDate.value = todayStr;

  if (chartResult) {
    chartResult.style.display = "none";
    chartResult.innerText = "";
    chartResult.className = "result";
  }

  if (chartReader) {
    chartReader.classList.add("hidden");
  }

  clearChartOnly();
}
    
function onSelectChange() {
  const select = document.getElementById("fridgeSelect");
  const fridgeIdInput = document.getElementById("fridgeId");

  if (select && fridgeIdInput) {
    fridgeIdInput.value = select.value;
    selectedFridgeInfo = fridgeMasterList.find(item => item.id === select.value) || null;
  }

  setRoundTimeFromMaster();
  loadTodayLogStatus();
  validateForm();
}
    
function drawChart(records, minTemp, maxTemp, fridgeId) {
  const ctx = document.getElementById('tempChart').getContext('2d'); if (tempChart) tempChart.destroy();
  const graphRecords = records.filter(r => r.recordType !== "NO_TEMP" && r.isValidForGraph !== false && r.temp !== null && r.temp !== "" && !isNaN(Number(r.temp)));
  const labels = buildSmartLabels(graphRecords);
  const values = graphRecords.map(r => Number(r.temp));
  const hasOriginalWrong = graphRecords.some(r => r.hasCorrection && r.originalTemp !== null && r.originalTemp !== "" && !isNaN(Number(r.originalTemp)));
  // เส้นประ = เส้นข้อมูลที่ถูกบันทึกไว้เดิมทั้งช่วง ก่อนนำ correction มาใช้
  // จุดที่ไม่เคยแก้จะซ้อนกับเส้นหลัก ส่วนจุดที่แก้แล้วจะแยกให้เห็นค่าเดิมชัดเจน
  const originalRecordedValues = graphRecords.map(r => {
    if (r.hasCorrection) {
      if (r.originalTemp === null || r.originalTemp === "" || isNaN(Number(r.originalTemp))) return null;
      return Number(r.originalTemp);
    }
    return Number(r.temp);
  });
  const datasets = [{ label: `อุณหภูมิที่ถูกต้อง/ใช้ปัจจุบัน ${fridgeId}`, data: values, tension: 0.25, borderWidth: 3, fill: false }];
  if (hasOriginalWrong) datasets.push({ label: 'อุณหภูมิที่บันทึกเดิม (เส้นประ)', data: originalRecordedValues, borderDash: [7, 6], borderWidth: 2, pointRadius: 3, pointHoverRadius: 7, spanGaps: false, fill: false, correctionOriginalSeries: true });
  datasets.push({ label: 'ต่ำสุด', data: labels.map(() => Number(minTemp)), borderDash: [6, 6], borderWidth: 2, fill: false }, { label: 'สูงสุด', data: labels.map(() => Number(maxTemp)), borderDash: [6, 6], borderWidth: 2, fill: false });
  tempChart = new Chart(ctx, { type: 'line', data: { labels, datasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, tooltip: { callbacks: {
    title: function(context) { const r = graphRecords[context[0].dataIndex]; return `${r.date} ${r.time || ''}`.trim(); },
    label: function(context) { return `${context.dataset?.label || 'อุณหภูมิ'}: ${context.raw} °C`; },
    afterBody: function(context) { const r = graphRecords[context?.[0]?.dataIndex]; return r?.hasCorrection ? [`เหตุผลแก้ไข: ${r.correctionReason || '-'}`, `ผู้แก้ไข: ${r.correctedBy || '-'}`] : []; }
  } } }, scales: { x: { ticks: { autoSkip: true, maxTicksLimit: 12, maxRotation: 0, minRotation: 0 } }, y: { beginAtZero: false, title: { display: true, text: 'อุณหภูมิ (°C)' } } } } });
}

function buildSmartLabels(records) {
  if (!records || records.length === 0) return [];

  const firstDate = parseDisplayDate(records[0].date);
  const lastDate = parseDisplayDate(records[records.length - 1].date);

  if (!firstDate || !lastDate) {
    return records.map(r => `${r.date} ${r.time || ''}`.trim());
  }

  const diffDays = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24));

  // ≤ 7 วัน => แสดงเวลา
  if (diffDays <= 7) {
    return records.map(r => r.time || '');
  }

  // > 7 วัน ถึง ≤ 31 วัน => แสดงวัน/เดือน
  if (diffDays <= 31) {
    return records.map(r => {
      const d = parseDisplayDate(r.date);
      return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` : r.date;
    });
  }

  // > 31 วัน ถึง < 365 วัน => แสดงวัน/เดือน
  if (diffDays < 365) {
    return records.map(r => {
      const d = parseDisplayDate(r.date);
      return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` : r.date;
    });
  }

  // ≥ 1 ปี => แสดงเดือน/ปี
  return records.map(r => {
    const d = parseDisplayDate(r.date);
    return d ? `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : r.date;
  });
}

function parseDisplayDate(dateStr) {
  if (!dateStr) return null;

  // รองรับ DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('/').map(Number);
    return new Date(y, m - 1, d);
  }

  // รองรับ YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  return null;
}

function clearChartOnly() {
  if (tempChart) {
    tempChart.destroy();
    tempChart = null;
  }
}

function clearChartAndTable() {
  clearChartOnly();
  document.getElementById("historyTableBody").innerHTML = "";
}

function exportCSV() {
  if (!lastHistoryRecords || lastHistoryRecords.length === 0) {
    alert("ยังไม่มีข้อมูลสำหรับ export");
    return;
  }

  const headers = ["วันที่", "เวลา", "รอบ", "รหัสตู้", "ชื่อตู้", "ประเภทที่เก็บ", "อุณหภูมิที่ใช้ปัจจุบัน", "อุณหภูมิเดิม", "สถานะ", "การดำเนินการ", "สถานที่เก็บ", "ผู้บันทึก", "แก้ไขข้อมูล", "เหตุผลการแก้ไข", "ผู้แก้ไข", "เวลาแก้ไข"];
  const rows = lastHistoryRecords.map(r => [
    r.date || '',
    r.time || '',
    r.round || '',
    r.fridgeId || '',
    r.fridgeName || '',
    r.productType || '',
    r.tempDisplay ?? r.temp ?? '',
    r.originalTempDisplay ?? '',
    r.status || '',
    (r.originalRecordType === "NO_TEMP" ? `${r.noTempReason || ''}${r.noTempDetail ? ' | ' + r.noTempDetail : ''}` : (r.action || '')),
    r.storageLocation || '',
    staffNameForUI(r.recorderName) || '',
    r.hasCorrection ? 'แก้ไขแล้ว' : '',
    r.correctionReason || '',
    r.correctedBy || '',
    r.correctedAt || ''
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const fileName = `history_${lastHistoryFridgeId}_${new Date().toISOString().slice(0,10)}.csv`;

  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
}

   
    function showResult(el, ok, text) {
      el.style.display = "block";
      el.className = ok ? "result success" : "result error";
      el.innerText = text;
    }

    function getCurrentTime() {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }

    async function toggleScanner() {
  const popup = document.getElementById("scannerPopup");
  const reader = document.getElementById("reader");

  if (!popup || !reader) {
    alert("ไม่พบพื้นที่สำหรับเปิดกล้อง");
    return;
  }

  if (scannerOpen) {
    closeScannerPopup();
    return;
  }

  popup.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  try {
    html5QrCode = new Html5Qrcode("reader");
    scannerOpen = true;

    await html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 220 },
      async (decodedText) => {
        if (qrApplyInProgress) return;
        qrApplyInProgress = true;
        try {
          closeScannerPopup();
          await applyScannedFridgeToForm(decodedText.trim());
          onFridgeIdInput();
          validateForm();
        } finally {
          qrApplyInProgress = false;
        }
      },
      () => {}
    );

  } catch (err) {
    scannerOpen = false;
    popup.classList.add("hidden");
    document.body.style.overflow = "auto";

    showAppPopup(
      false,
      "เปิดกล้องไม่ได้",
      String(err)
    );
  }
}


function toggleIncidentCustomDate() {
  const filter = document.getElementById("incidentDateFilter")?.value || "";
  const startBox = document.getElementById("incidentStartDateBox");
  const endBox = document.getElementById("incidentEndDateBox");

  if (filter === "custom") {
    if (startBox) startBox.classList.remove("hidden");
    if (endBox) endBox.classList.remove("hidden");
  } else {
    if (startBox) startBox.classList.add("hidden");
    if (endBox) endBox.classList.add("hidden");
  }
}    

    
function getCurrentTimeHHMM() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatTimeForInput(value) {
  if (!value) return "";

  if (value instanceof Date) {
    const hh = String(value.getHours()).padStart(2, "0");
    const mm = String(value.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  const text = String(value).trim();

  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2]}`;
  }

  return text;
}

function setTimeByRound() {
  const round = document.getElementById("round")?.value || "";
  const timeInput = document.getElementById("time");

  if (!timeInput) return;

  if (round === "เช้า") {
    timeInput.value = formatTimeForInput(selectedFridgeInfo?.morningTime || "07:00");
  } else if (round === "เย็น") {
    timeInput.value = formatTimeForInput(selectedFridgeInfo?.eveningTime || "19:00");
  } else if (round === "ผิดปกติ") {
    const now = new Date();
    timeInput.value =
      String(now.getHours()).padStart(2, "0") + ":" +
      String(now.getMinutes()).padStart(2, "0");
  } else {
    timeInput.value = "";
  }

  loadTodayLogStatus();
  validateForm();
}

function toDateInputValue(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function setLastMonthDateRange(startId, endId, force = false) {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);

  const startEl = document.getElementById(startId);
  const endEl = document.getElementById(endId);

  if (startEl && (force || !startEl.value)) startEl.value = toDateInputValue(start);
  if (endEl && (force || !endEl.value)) endEl.value = toDateInputValue(end);
}

function setDefaultHistoryDateRange(force = false) {
  setLastMonthDateRange("startDate", "endDate", force);
}

function setDefaultChartDateRange(force = false) {
  setLastMonthDateRange("chartStartDate", "chartEndDate", force);
}

function autoLoadHistoryIfReady() {
  window.clearTimeout(historyAutoLoadTimer);
  historyAutoLoadTimer = window.setTimeout(() => {
    const fridgeId = document.getElementById("historyFridgeId")?.value?.trim() || "";
    const startDate = document.getElementById("startDate")?.value || "";
    const endDate = document.getElementById("endDate")?.value || "";

    if (fridgeId && startDate && endDate) {
      loadHistory();
    }
  }, 250);
}

function autoLoadChartIfReady() {
  window.clearTimeout(chartAutoLoadTimer);
  chartAutoLoadTimer = window.setTimeout(() => {
    const fridgeId = document.getElementById("chartFridgeId")?.value?.trim() || "";
    const startDate = document.getElementById("chartStartDate")?.value || "";
    const endDate = document.getElementById("chartEndDate")?.value || "";

    if (fridgeId && startDate && endDate) {
      loadChartData();
    }
  }, 250);
}

function isMorningAutoWindow(d = new Date()) {
  const minutes = d.getHours() * 60 + d.getMinutes();
  return minutes >= 6 * 60 && minutes <= 12 * 60;
}

function isEveningAutoWindow(d = new Date()) {
  const minutes = d.getHours() * 60 + d.getMinutes();
  return minutes >= 14 * 60 && minutes <= 21 * 60;
}

function autoSelectRoundByCurrentTime({ force = false } = {}) {
  const roundEl = document.getElementById("round");
  const recordType = document.getElementById("recordType")?.value || "TEMP";

  if (!roundEl || recordType !== "TEMP") return;
  if (!force && roundEl.value) return;

  if (isMorningAutoWindow()) {
    roundEl.value = "เช้า";
    setTimeByRound();
  } else if (isEveningAutoWindow()) {
    roundEl.value = "เย็น";
    setTimeByRound();
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
    
function validateForm() {
  const date = document.getElementById("date")?.value?.trim() || "";
  const round = document.getElementById("round")?.value?.trim() || "";
  const fridgeId = resolveFormFridgeId();
  const temp = normalizeTempInputValue();
  const time = document.getElementById("time")?.value?.trim() || "";
  syncLoginIdentityFields();
  const recorderName = AUTH_DISABLED_TEMPORARILY
    ? (document.getElementById("recorderName")?.value?.trim() || "")
    : (getCurrentActorFullName() || getCurrentActorEmail());
  const actionText = document.getElementById("note")?.value?.trim() || "";
  const submitBtn = document.getElementById("submitBtn");
  const noteEl = document.getElementById("note");
  const recordType = document.getElementById("recordType")?.value || "TEMP";
  const noTempReason = document.getElementById("noTempReason")?.value?.trim() || "";
  const noTempDetail = document.getElementById("noTempDetail")?.value?.trim() || "";

  let isAbnormal = false;

  if (selectedFridgeInfo && temp !== "") {
    isAbnormal = isTemperatureAbnormal(temp, selectedFridgeInfo);
  }

  const specialRound =
    round === "ตรวจซ้ำ" || round === "ผิดปกติ" || round === "อื่นๆ";

  const room = document.getElementById("roomSelect")?.value?.trim() || "";
  const tempValid = recordType === "NO_TEMP" ? true : parseNullableNumber(temp) !== null;
  const noTempValid = recordType === "NO_TEMP" ? !!(noTempReason && noTempDetail) : true;

  const basicValid = !!(date && room && round && fridgeId && tempValid && time && recorderName && noTempValid);

  const actionValid = recordType === "NO_TEMP"
    ? noTempValid
    : ((isAbnormal || specialRound) ? !!actionText : true);

    if (submitBtn) {
      // เปิดปุ่มเมื่อข้อมูลหลักครบก่อน เพื่อให้กดแล้วเห็น popup ว่าขาด "การดำเนินการ" แทนการเจอปุ่มจางแบบไม่รู้สาเหตุ
      submitBtn.disabled = !basicValid || currentDuplicateStatus;
    }

    updateClearFormButtonState();

    if (noteEl) {
    if (recordType !== "NO_TEMP" && (isAbnormal || specialRound) && !actionText) {
      noteEl.classList.add("required-warning");
      noteEl.placeholder = "กรุณากรอกการดำเนินการ";
    } else {
      noteEl.classList.remove("required-warning");
      noteEl.placeholder = "ถ้ามี";
    }
  }
}

function getTodayYMD() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
    
   function stopScanner() {
  closeScannerPopup();
}


async function handleIncidentDeepLink() {
  const params = new URLSearchParams(window.location.search || '');
  const page = params.get('page') || '';
  const incidentId = params.get('incidentId') || '';

  // Backward compatible: every old Google Chat link using ?page=updateIncident&incidentId=...
  // must open the new BEM Incident update screen, not the fridge-status screen.
  if (page !== 'updateIncident' && page !== 'bemIncident' && !incidentId) return;

  const updateBtn = document.querySelector("button[onclick*='updateIncidentPage']");
  showPage('updateIncidentPage', updateBtn);
  const title = document.querySelector('#updateIncidentPage .section-title');
  if (title) title.innerText = 'BEM รับเรื่อง / อัปเดตสถานะงาน';

  const dateFilter = document.getElementById('updateIncidentDateFilter');
  const statusFilter = document.getElementById('updateIncidentStatusFilter');
  const fridgeSearch = document.getElementById('updateIncidentFridgeSearch');
  const incidentInput = document.getElementById('updateIncidentId');
  const resultBox = document.getElementById('updateIncidentResult');

  if (dateFilter) dateFilter.value = 'all';
  if (statusFilter) statusFilter.value = 'all';
  if (fridgeSearch) fridgeSearch.value = '';

  try {
    if (typeof loadOpenIncidentList === 'function') {
      await loadOpenIncidentList();
    }

    const select = document.getElementById('updateIncidentSelect');
    if (incidentId) {
      if (select) {
        const existing = Array.from(select.options).some(opt => opt.value === incidentId);
        if (!existing) {
          const option = document.createElement('option');
          option.value = incidentId;
          option.textContent = `${incidentId} | เปิดจาก Google Chat`;
          select.appendChild(option);
        }
        select.value = incidentId;
      }
      if (incidentInput) incidentInput.value = incidentId;
      showResult(resultBox, true, `เปิด Incident ${incidentId} จากลิงก์แจ้งเตือนแล้ว`);
    }

    setTimeout(() => {
      const el = document.getElementById('updateIncidentPage');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  } catch (error) {
    if (incidentInput && incidentId) incidentInput.value = incidentId;
    showResult(resultBox, false, 'เปิด Incident จากลิงก์ไม่สำเร็จ: ' + error);
  }
}



// ===== V1.8.45 Web Push reminder =====
const PUSH_PREFS_KEY_V1845 = 'cnmi_temp_push_prefs_v1845';
const PUSH_TEST_TOKEN_KEY_V1845 = 'cnmi_temp_push_test_token_v1845';
const PUSH_BEM_INCIDENT_MARKER_V1862 = '__CNMI_BEM_INCIDENT__';
let pushConfigCacheV1845 = null;
let pushDepartmentsCacheV1845 = [];

function getPushSupabaseClientV1845() {
  if (!window.CNMI_SUPABASE_BACKEND || typeof window.CNMI_SUPABASE_BACKEND.getClient !== 'function') {
    throw new Error('ยังโหลด Supabase backend ไม่สำเร็จ');
  }
  return window.CNMI_SUPABASE_BACKEND.getClient();
}

function isIosDeviceV1845() {
  return /iPad|iPhone|iPod/i.test(navigator.userAgent || '') && !window.MSStream;
}

function isStandalonePwaV1845() {
  return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
}

function hasPushSupportV1845() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function readPushPrefsV1845() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PUSH_PREFS_KEY_V1845) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) { return {}; }
}

function writePushPrefsV1845(value) {
  try { localStorage.setItem(PUSH_PREFS_KEY_V1845, JSON.stringify(value || {})); } catch (e) {}
}

function getPushTestTokenV1845() {
  try { return localStorage.getItem(PUSH_TEST_TOKEN_KEY_V1845) || ''; } catch (e) { return ''; }
}

function setPushTestTokenV1845(value) {
  try {
    if (value) localStorage.setItem(PUSH_TEST_TOKEN_KEY_V1845, value);
    else localStorage.removeItem(PUSH_TEST_TOKEN_KEY_V1845);
  } catch (e) {}
}

function randomTokenV1845(bytes = 24) {
  const raw = new Uint8Array(bytes);
  crypto.getRandomValues(raw);
  let binary = '';
  raw.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function urlBase64ToUint8ArrayV1845(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function getSelectedPushDepartmentsV1845() {
  return Array.from(document.querySelectorAll('#pushDepartmentList input[type="checkbox"]:checked'))
    .map(el => String(el.value || '').trim()).filter(Boolean);
}

function getSelectedPushRoundsV1845() {
  const rounds = [];
  if (document.getElementById('pushRoundMorning')?.checked) rounds.push('เช้า');
  if (document.getElementById('pushRoundEvening')?.checked) rounds.push('เย็น');
  return rounds;
}

function pushResultV1845(ok, message) {
  const box = document.getElementById('pushSettingsResult');
  if (box) showResult(box, !!ok, message || '');
}

function renderPushDepartmentListV1845(items, selectedDepartments = []) {
  const box = document.getElementById('pushDepartmentList');
  if (!box) return;
  const selected = new Set((selectedDepartments || []).map(String));
  if (!Array.isArray(items) || !items.length) {
    box.innerHTML = '<div class="small-note">ยังไม่พบพื้นที่ที่มีตู้ต้องบันทึกประจำวัน</div>';
    return;
  }
  box.innerHTML = items.map((item) => {
    const department = String(item?.department || '').trim();
    const count = Number(item?.fridgeCount || 0);
    return `<label class="push-check-card push-department-card">
      <input type="checkbox" value="${escapeHtml(department)}" ${selected.has(department) ? 'checked' : ''}>
      <span><strong>${escapeHtml(department)}</strong><small>${count} ตู้ที่ต้องติดตามประจำวัน</small></span>
    </label>`;
  }).join('');
}

async function getPushSubscriptionV1845() {
  if (!hasPushSupportV1845()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

async function loadPushPublicConfigV1845() {
  const sb = getPushSupabaseClientV1845();
  const [{ data: dbConfig, error: configError }, { data: departments, error: depError }] = await Promise.all([
    sb.rpc('temp_push_public_config_v1845'),
    sb.rpc('temp_push_departments_v1845')
  ]);
  if (configError) throw configError;
  if (depError) throw depError;

  // V1.8.68: use the public key from the same Edge Function that signs Push messages.
  // This prevents VapidPkHashMismatch when the DB public key and Edge Function Secrets drift apart.
  let edgeConfig = null;
  try {
    const edgeUrl = getPushEdgeFunctionUrlV1845();
    if (edgeUrl) {
      const response = await fetch(edgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'config' })
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload?.ok && payload?.vapidPublicKey) edgeConfig = payload;
    }
  } catch (error) {
    console.warn('V1.8.68 edge push config fallback to DB:', error);
  }

  pushConfigCacheV1845 = {
    ...(dbConfig || {}),
    ...(edgeConfig || {}),
    vapidPublicKey: String(edgeConfig?.vapidPublicKey || dbConfig?.vapidPublicKey || '').trim()
  };
  pushDepartmentsCacheV1845 = Array.isArray(departments) ? departments : [];
  return { config: pushConfigCacheV1845, departments: pushDepartmentsCacheV1845 };
}

function pushKeyBytesEqualV1868(a, b) {
  try {
    const aa = a instanceof Uint8Array ? a : new Uint8Array(a || []);
    const bb = b instanceof Uint8Array ? b : new Uint8Array(b || []);
    if (aa.length !== bb.length) return false;
    for (let i = 0; i < aa.length; i += 1) if (aa[i] !== bb[i]) return false;
    return true;
  } catch (e) { return false; }
}

function pushSubscriptionMatchesCurrentKeyV1868(subscription, vapidPublicKey) {
  if (!subscription || !vapidPublicKey) return false;
  const existingKey = subscription?.options?.applicationServerKey;
  if (!existingKey) return null; // Browser does not expose it; keep subscription unless a send test proves mismatch.
  return pushKeyBytesEqualV1868(existingKey, urlBase64ToUint8ArrayV1845(vapidPublicKey));
}

async function disableRegisteredPushBeforeRotateV1868(subscription) {
  const token = getPushTestTokenV1845();
  if (!subscription || !token) return;
  try {
    const sb = getPushSupabaseClientV1845();
    await sb.rpc('temp_push_disable_v1845', {
      p_endpoint: subscription.endpoint,
      p_test_token: token
    });
  } catch (error) {
    console.warn('V1.8.68 disable old push subscription skipped:', error);
  }
}

async function ensureCurrentPushSubscriptionV1868(registration, { forceRotate = false } = {}) {
  if (!pushConfigCacheV1845?.vapidPublicKey) await loadPushPublicConfigV1845();
  const vapidPublicKey = String(pushConfigCacheV1845?.vapidPublicKey || '').trim();
  if (!vapidPublicKey) throw new Error('ยังไม่ได้ตั้งค่า VAPID Public Key');

  let subscription = await registration.pushManager.getSubscription();
  const keyMatch = subscription ? pushSubscriptionMatchesCurrentKeyV1868(subscription, vapidPublicKey) : false;
  const mustRotate = !!subscription && (forceRotate || keyMatch === false);

  if (mustRotate) {
    await disableRegisteredPushBeforeRotateV1868(subscription);
    try { await subscription.unsubscribe(); } catch (error) { console.warn('V1.8.68 unsubscribe old push failed:', error); }
    setPushTestTokenV1845('');
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8ArrayV1845(vapidPublicKey)
    });
  }
  return { subscription, rotated: mustRotate };
}

async function getRegisteredPushStatusV1845(subscription) {
  const token = getPushTestTokenV1845();
  if (!subscription || !token) return { registered: false, enabled: false };
  const sb = getPushSupabaseClientV1845();
  const { data, error } = await sb.rpc('temp_push_status_v1845', {
    p_endpoint: subscription.endpoint,
    p_test_token: token
  });
  if (error) throw error;
  return data || { registered: false, enabled: false };
}

function updatePushStatusCardV1845({ subscription, serverStatus, error } = {}) {
  const title = document.getElementById('pushStatusTitle');
  const text = document.getElementById('pushStatusText');
  const box = document.getElementById('pushSupportBox');
  if (!title || !text || !box) return;
  box.classList.remove('is-good', 'is-warn', 'is-error');

  if (error) {
    title.textContent = 'ยังตั้งค่าการแจ้งเตือนไม่สำเร็จ';
    text.textContent = String(error?.message || error);
    box.classList.add('is-error');
    return;
  }
  if (!hasPushSupportV1845()) {
    title.textContent = 'เบราว์เซอร์นี้ยังไม่รองรับ Push Notification';
    text.textContent = 'แนะนำให้ใช้ Safari บน iPhone/iPad หรือ Chrome บน Android แล้วติดตั้ง CNMI Temp เป็นแอป';
    box.classList.add('is-error');
    return;
  }
  if (isIosDeviceV1845() && !isStandalonePwaV1845()) {
    title.textContent = 'iPhone ต้องเพิ่ม CNMI Temp ไปยังหน้าจอโฮมก่อน';
    text.textContent = 'Safari → Share → เพิ่มไปยังหน้าจอโฮม → เปิดจากไอคอน CNMI Temp แล้วกลับมาหน้านี้';
    box.classList.add('is-warn');
    return;
  }
  if (Notification.permission === 'denied') {
    title.textContent = 'เครื่องนี้ปิดสิทธิ์การแจ้งเตือนอยู่';
    text.textContent = 'เปิด Settings → Notifications → CNMI Temp แล้วอนุญาต Notifications จากนั้นกลับมาหน้านี้';
    box.classList.add('is-error');
    return;
  }
  if (subscription && serverStatus?.registered && serverStatus?.enabled) {
    const rawDeps = Array.isArray(serverStatus.departments) ? serverStatus.departments.map(String) : [];
    const incidentEnabled = rawDeps.includes(PUSH_BEM_INCIDENT_MARKER_V1862);
    const realDeps = rawDeps.filter(x => x !== PUSH_BEM_INCIDENT_MARKER_V1862);
    const tempEnabled = realDeps.length > 0;
    title.textContent = incidentEnabled && !tempEnabled ? 'เปิดแจ้งเตือน Incident + ติดตามงาน BEM แล้ว ✓' : 'เปิดการแจ้งเตือนแล้ว ✓';
    const parts = [];
    if (tempEnabled) parts.push(`อุณหภูมิ: ${realDeps.join(', ')}`);
    if (incidentEnabled) parts.push('Incident BEM + ติดตามเคสค้าง: เปิด');
    text.textContent = parts.join(' • ') || 'เครื่องนี้ลงทะเบียนรับแจ้งเตือนแล้ว';
    box.classList.add('is-good');
    return;
  }
  if (subscription) {
    title.textContent = 'โทรศัพท์อนุญาตแล้ว แต่ยังต้องบันทึกประเภทการแจ้งเตือน';
    text.textContent = 'เลือกประเภทที่ต้องการด้านล่าง แล้วกด “เปิด / บันทึกการแจ้งเตือน” อีกครั้ง';
    box.classList.add('is-warn');
    return;
  }
  title.textContent = 'ยังไม่ได้เปิดการแจ้งเตือนบนเครื่องนี้';
  text.textContent = 'เลือกประเภทการแจ้งเตือน แล้วกดปุ่มเปิดการแจ้งเตือน';
  box.classList.add('is-warn');
}

function syncPushTypeUIV1862() {
  const tempEnabled = document.getElementById('pushTempReminderEnabled')?.checked !== false;
  const area = document.getElementById('pushTemperatureAreaBlock');
  const round = document.getElementById('pushTemperatureRoundBlock');
  [area, round].forEach(el => el?.classList.toggle('push-block-disabled', !tempEnabled));
  document.querySelectorAll('#pushTemperatureAreaBlock input, #pushTemperatureRoundBlock input').forEach(el => { el.disabled = !tempEnabled; });
}

async function loadPushNotificationPage() {
  const prefs = readPushPrefsV1845();
  const deviceLabel = document.getElementById('pushDeviceLabel');
  if (deviceLabel && !deviceLabel.value) deviceLabel.value = prefs.deviceLabel || '';
  const morning = document.getElementById('pushRoundMorning');
  const evening = document.getElementById('pushRoundEvening');
  const tempToggle = document.getElementById('pushTempReminderEnabled');
  const incidentToggle = document.getElementById('pushIncidentEnabled');
  if (morning) morning.checked = !Array.isArray(prefs.rounds) || prefs.rounds.includes('เช้า');
  if (evening) evening.checked = !Array.isArray(prefs.rounds) || prefs.rounds.includes('เย็น');
  if (tempToggle) tempToggle.checked = prefs.receiveTempReminders !== false;
  if (incidentToggle) incidentToggle.checked = prefs.receiveIncidentAlerts === true;

  try {
    const { config, departments } = await loadPushPublicConfigV1845();
    document.getElementById('pushMorningSchedule').textContent = `เตือน ${config?.morningFirst || '10:30'} และ ${config?.morningFinal || '11:30'} น.`;
    document.getElementById('pushEveningSchedule').textContent = `เตือน ${config?.eveningFirst || '19:30'} และ ${config?.eveningFinal || '20:30'} น.`;

    const subscription = await getPushSubscriptionV1845();
    let serverStatus = { registered: false, enabled: false };
    try { serverStatus = await getRegisteredPushStatusV1845(subscription); } catch (e) { console.warn('push status lookup failed', e); }
    const serverDeps = serverStatus?.registered && Array.isArray(serverStatus.departments) ? serverStatus.departments.map(String) : null;
    const selectedDepartments = serverDeps
      ? serverDeps.filter(x => x !== PUSH_BEM_INCIDENT_MARKER_V1862)
      : (Array.isArray(prefs.departments) ? prefs.departments : []);
    renderPushDepartmentListV1845(departments, selectedDepartments);
    if (serverStatus?.registered) {
      const hasIncident = Array.isArray(serverDeps) && serverDeps.includes(PUSH_BEM_INCIDENT_MARKER_V1862);
      const hasTemp = Array.isArray(serverDeps) && serverDeps.some(x => x !== PUSH_BEM_INCIDENT_MARKER_V1862);
      if (tempToggle) tempToggle.checked = hasTemp;
      if (incidentToggle) incidentToggle.checked = hasIncident;
      if (Array.isArray(serverStatus.rounds)) {
        if (morning) morning.checked = serverStatus.rounds.includes('เช้า');
        if (evening) evening.checked = serverStatus.rounds.includes('เย็น');
      }
      if (deviceLabel && serverStatus.deviceLabel) deviceLabel.value = serverStatus.deviceLabel;
    }
    syncPushTypeUIV1862();
    updatePushStatusCardV1845({ subscription, serverStatus });
  } catch (error) {
    renderPushDepartmentListV1845([], []);
    syncPushTypeUIV1862();
    updatePushStatusCardV1845({ error });
    pushResultV1845(false, 'โหลดการตั้งค่าแจ้งเตือนไม่สำเร็จ: ' + (error?.message || error));
  }
}

async function registerPushSubscriptionV1845(subscription, token) {
  const json = subscription.toJSON ? subscription.toJSON() : {};
  const keys = json.keys || {};
  if (!keys.p256dh || !keys.auth) throw new Error('อ่าน Push key จากเครื่องไม่ได้ กรุณาปิดและเปิดการแจ้งเตือนใหม่');

  const receiveTempReminders = document.getElementById('pushTempReminderEnabled')?.checked !== false;
  const receiveIncidentAlerts = document.getElementById('pushIncidentEnabled')?.checked === true;
  const selectedDepartments = getSelectedPushDepartmentsV1845();
  const rounds = getSelectedPushRoundsV1845();
  if (!receiveTempReminders && !receiveIncidentAlerts) throw new Error('กรุณาเลือกประเภทการแจ้งเตือนอย่างน้อย 1 รายการ');
  if (receiveTempReminders && !selectedDepartments.length) throw new Error('กรุณาเลือกพื้นที่สำหรับแจ้งเตือนอุณหภูมิอย่างน้อย 1 แห่ง');
  if (receiveTempReminders && !rounds.length) throw new Error('กรุณาเลือกรอบเช้าหรือรอบเย็นอย่างน้อย 1 รอบ');

  const departments = receiveTempReminders ? [...selectedDepartments] : [];
  if (receiveIncidentAlerts) departments.push(PUSH_BEM_INCIDENT_MARKER_V1862);
  const savedRounds = receiveTempReminders ? rounds : ['เช้า','เย็น'];
  const deviceLabel = document.getElementById('pushDeviceLabel')?.value?.trim() || '';
  const sb = getPushSupabaseClientV1845();
  const { data, error } = await sb.rpc('temp_push_register_v1845', {
    p_endpoint: subscription.endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_departments: departments,
    p_rounds: savedRounds,
    p_device_label: deviceLabel,
    p_user_agent: navigator.userAgent || '',
    p_test_token: token
  });
  if (error) throw error;
  writePushPrefsV1845({
    departments: selectedDepartments,
    rounds,
    deviceLabel,
    receiveTempReminders,
    receiveIncidentAlerts
  });
  return data;
}

async function enablePushNotifications() {
  pushResultV1845(true, 'กำลังเปิดการแจ้งเตือน...');
  try {
    if (!hasPushSupportV1845()) throw new Error('เครื่อง/เบราว์เซอร์นี้ยังไม่รองรับ Push Notification');
    if (isIosDeviceV1845() && !isStandalonePwaV1845()) {
      throw new Error('iPhone/iPad ต้องเพิ่ม CNMI Temp ไปยังหน้าจอโฮม แล้วเปิดจากไอคอนแอปก่อนจึงจะเปิด Push Notification ได้');
    }
    const tempEnabled = document.getElementById('pushTempReminderEnabled')?.checked !== false;
    const incidentEnabled = document.getElementById('pushIncidentEnabled')?.checked === true;
    if (!tempEnabled && !incidentEnabled) throw new Error('กรุณาเลือกประเภทการแจ้งเตือนอย่างน้อย 1 รายการ');
    if (tempEnabled && !getSelectedPushDepartmentsV1845().length) throw new Error('กรุณาเลือกพื้นที่สำหรับแจ้งเตือนอุณหภูมิอย่างน้อย 1 แห่ง');
    if (tempEnabled && !getSelectedPushRoundsV1845().length) throw new Error('กรุณาเลือกรอบที่ต้องการรับแจ้งเตือนอย่างน้อย 1 รอบ');

    // Permission request must stay close to the user's button tap, especially on iPhone/iPad.
    let permission = Notification.permission;
    if (permission !== 'granted') permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('ยังไม่ได้อนุญาต Notification บนโทรศัพท์เครื่องนี้');

    if (!pushConfigCacheV1845?.vapidPublicKey) await loadPushPublicConfigV1845();
    if (!pushConfigCacheV1845?.enabled) throw new Error('ระบบแจ้งเตือนส่วนกลางถูกปิดอยู่');
    if (!pushConfigCacheV1845?.vapidPublicKey) throw new Error('ยังไม่ได้ตั้งค่า VAPID Public Key');

    const registration = await navigator.serviceWorker.ready;
    const ensured = await ensureCurrentPushSubscriptionV1868(registration);
    const subscription = ensured.subscription;

    let token = getPushTestTokenV1845();
    if (!token) { token = randomTokenV1845(); setPushTestTokenV1845(token); }
    await registerPushSubscriptionV1845(subscription, token);
    const serverStatus = await getRegisteredPushStatusV1845(subscription);
    updatePushStatusCardV1845({ subscription, serverStatus });
    pushResultV1845(true, 'บันทึกการแจ้งเตือนแล้ว ✓ เครื่องนี้จะรับเฉพาะประเภทที่เลือกไว้');
    await refreshPushReminderBanner();
  } catch (error) {
    updatePushStatusCardV1845({ error });
    pushResultV1845(false, error?.message || String(error));
  }
}

async function disablePushNotifications() {
  if (!confirm('ต้องการปิดการแจ้งเตือนทั้งหมดบนโทรศัพท์เครื่องนี้หรือไม่?')) return;
  try {
    const subscription = await getPushSubscriptionV1845();
    const token = getPushTestTokenV1845();
    if (subscription && token) {
      const sb = getPushSupabaseClientV1845();
      const { error } = await sb.rpc('temp_push_disable_v1845', {
        p_endpoint: subscription.endpoint,
        p_test_token: token
      });
      if (error) throw error;
    }
    if (subscription) await subscription.unsubscribe();
    setPushTestTokenV1845('');
    try { localStorage.removeItem(PUSH_PREFS_KEY_V1845); } catch (e) {}
    updatePushStatusCardV1845({ subscription: null, serverStatus: { registered: false, enabled: false } });
    pushResultV1845(true, 'ปิดการแจ้งเตือนบนเครื่องนี้แล้ว');
    await refreshPushReminderBanner();
  } catch (error) {
    pushResultV1845(false, 'ปิดการแจ้งเตือนไม่สำเร็จ: ' + (error?.message || error));
  }
}

function getPushEdgeFunctionUrlV1845() {
  const base = String(window.CNMI_SUPABASE_CONFIG?.SUPABASE_URL || '').replace(/\/+$/, '');
  return base ? `${base}/functions/v1/temp-push-reminder` : '';
}

async function sendPushTestOnceV1868(subscription, token) {
  const url = getPushEdgeFunctionUrlV1845();
  if (!url) throw new Error('ไม่พบ Supabase URL ใน supabase-config.js');
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'test', endpoint: subscription.endpoint, testToken: token })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    const error = new Error(data.message || `Edge Function ตอบกลับ ${response.status}`);
    error.code = data.code || '';
    throw error;
  }
  return data;
}

function isVapidSubscriptionMismatchV1868(error) {
  const text = `${String(error?.code || '')} ${String(error?.message || error || '')}`.toLowerCase();
  return text.includes('vapid_subscription_mismatch') || text.includes('vapidpkhashmismatch') || text.includes('vapid pk hash');
}

async function testPushNotification() {
  pushResultV1845(true, 'กำลังตรวจและทดสอบการแจ้งเตือน...');
  try {
    if (!hasPushSupportV1845()) throw new Error('เครื่อง/เบราว์เซอร์นี้ยังไม่รองรับ Push Notification');
    if (!pushConfigCacheV1845?.vapidPublicKey) await loadPushPublicConfigV1845();
    const registration = await navigator.serviceWorker.ready;
    let ensured = await ensureCurrentPushSubscriptionV1868(registration);
    let subscription = ensured.subscription;
    let token = getPushTestTokenV1845();
    if (!token) { token = randomTokenV1845(); setPushTestTokenV1845(token); }
    await registerPushSubscriptionV1845(subscription, token);

    try {
      await sendPushTestOnceV1868(subscription, token);
    } catch (firstError) {
      if (!isVapidSubscriptionMismatchV1868(firstError)) throw firstError;

      // Existing iPhone/Android subscription was created with an older VAPID key.
      // Rotate it automatically, register the new endpoint, then retry once.
      ensured = await ensureCurrentPushSubscriptionV1868(registration, { forceRotate: true });
      subscription = ensured.subscription;
      token = randomTokenV1845();
      setPushTestTokenV1845(token);
      await registerPushSubscriptionV1845(subscription, token);
      await sendPushTestOnceV1868(subscription, token);
    }

    const serverStatus = await getRegisteredPushStatusV1845(subscription).catch(() => ({ registered: true, enabled: true }));
    updatePushStatusCardV1845({ subscription, serverStatus });
    pushResultV1845(true, 'ทดสอบสำเร็จ ✓ เครื่องนี้พร้อมรับการแจ้งเตือนแล้ว');
    await refreshPushReminderBanner();
  } catch (error) {
    const message = error?.message || String(error);
    if (isVapidSubscriptionMismatchV1868(error)) {
      pushResultV1845(false, 'ยังซ่อม Push subscription ไม่สำเร็จ กรุณากด “เปิด / บันทึกการแจ้งเตือน” อีกครั้ง แล้วทดสอบใหม่');
    } else {
      pushResultV1845(false, 'ทดสอบไม่สำเร็จ: ' + message);
    }
  }
}

async function syncPushSubscriptionIfPresent() {
  if (!hasPushSupportV1845() || Notification.permission !== 'granted') return;
  if (isIosDeviceV1845() && !isStandalonePwaV1845()) return;
  let subscription = await getPushSubscriptionV1845();
  let token = getPushTestTokenV1845();
  const prefs = readPushPrefsV1845();
  const receiveTempReminders = prefs.receiveTempReminders !== false;
  const receiveIncidentAlerts = prefs.receiveIncidentAlerts === true;
  const storedDepartments = Array.isArray(prefs.departments) ? prefs.departments : [];
  if (!subscription || !token) return;
  if (!receiveTempReminders && !receiveIncidentAlerts) return;
  if (receiveTempReminders && !storedDepartments.length) return;
  if (!pushConfigCacheV1845?.vapidPublicKey) await loadPushPublicConfigV1845();
  const registration = await navigator.serviceWorker.ready;
  const keyMatch = subscription ? pushSubscriptionMatchesCurrentKeyV1868(subscription, pushConfigCacheV1845.vapidPublicKey) : false;
  if (subscription && keyMatch === false) {
    const ensured = await ensureCurrentPushSubscriptionV1868(registration, { forceRotate: true });
    subscription = ensured.subscription;
    token = randomTokenV1845();
    setPushTestTokenV1845(token);
  }

  const page = document.getElementById('notificationPage');
  const visible = page && !page.classList.contains('hidden');
  if (visible) {
    await registerPushSubscriptionV1845(subscription, token);
    return;
  }
  const json = subscription.toJSON ? subscription.toJSON() : {};
  const keys = json.keys || {};
  if (!keys.p256dh || !keys.auth) return;
  const departments = receiveTempReminders ? [...storedDepartments] : [];
  if (receiveIncidentAlerts) departments.push(PUSH_BEM_INCIDENT_MARKER_V1862);
  const rounds = receiveTempReminders && Array.isArray(prefs.rounds) && prefs.rounds.length ? prefs.rounds : ['เช้า','เย็น'];
  const sb = getPushSupabaseClientV1845();
  await sb.rpc('temp_push_register_v1845', {
    p_endpoint: subscription.endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_departments: departments,
    p_rounds: rounds,
    p_device_label: prefs.deviceLabel || '',
    p_user_agent: navigator.userAgent || '',
    p_test_token: token
  });
}

async function refreshPushReminderBanner() {
  const banner = document.getElementById('pushReminderBanner');
  if (!banner) return;
  if (!hasPushSupportV1845()) { banner.classList.add('hidden'); return; }
  if (isIosDeviceV1845() && !isStandalonePwaV1845()) {
    banner.classList.remove('hidden');
    return;
  }
  try {
    const subscription = await getPushSubscriptionV1845();
    const token = getPushTestTokenV1845();
    if (subscription && token) {
      const status = await getRegisteredPushStatusV1845(subscription);
      banner.classList.toggle('hidden', !!(status?.registered && status?.enabled));
    } else {
      banner.classList.remove('hidden');
    }
  } catch (e) {
    banner.classList.remove('hidden');
  }
}

function openPushNotificationSettings() {
  const btn = document.querySelector('.menu-btn[data-menu-key="notifications"]');
  showPage('notificationPage', btn || null);
  loadPushNotificationPage();
}
// ===== End V1.8.45 Web Push reminder =====

function openUserGuideModal(source) {
  const modal = document.getElementById("userGuideModal");
  if (!modal) return;
  modal.classList.remove("hidden");
  document.body.classList.add("guide-modal-open");
  setTimeout(() => {
    const card = modal.querySelector(".guide-modal-card");
    if (card) card.scrollTop = 0;
  }, 0);
}

function closeUserGuideModal() {
  const modal = document.getElementById("userGuideModal");
  if (modal) modal.classList.add("hidden");
  document.body.classList.remove("guide-modal-open");
}

document.addEventListener("keydown", function(event) {
  if (event.key === "Escape") {
    closeUserGuideModal();
    closeResendBemAlertModal();
  }
});

window.onload = initAuthAndApp;

function scrollToDashboardCards() {
  const cardContainer = document.getElementById("dashboardCardContainer");

  if (!cardContainer) return;

  setTimeout(() => {
    cardContainer.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 150);
}

    
function showAppPopup(success, title, message) {
  const popup = document.getElementById("appPopup");
  const icon = document.getElementById("appPopupIcon");
  const titleBox = document.getElementById("appPopupTitle");
  const messageBox = document.getElementById("appPopupMessage");

  if (!popup || !icon || !titleBox || !messageBox) {
    alert(message || title || "");
    return;
  }

  icon.classList.toggle("error", !success);
  icon.innerText = success ? "✓" : "!";
  titleBox.innerText = title || (success ? "สำเร็จ" : "ไม่สำเร็จ");
  messageBox.innerText = message || "";

  popup.classList.remove("hidden");
}

function buildTemperaturePopupMessage(data) {
  const date = document.getElementById("date")?.value || "-";
  const round = document.getElementById("round")?.value || "-";
  const fridgeId = document.getElementById("fridgeId")?.value?.trim() || "-";
  const recorderName = data?.recorderName || (AUTH_DISABLED_TEMPORARILY
    ? (document.getElementById("recorderName")?.value?.trim() || "-")
    : (getCurrentActorFullName() || getCurrentActorEmail() || "-"));
  const recordType = document.getElementById("recordType")?.value || "TEMP";
  const temp = data?.temp ?? document.getElementById("temp")?.value ?? "-";

  let message = "";
  message += `วันที่: ${date}\n`;
  message += `รอบ: ${round}\n`;
  message += `รหัสตู้: ${fridgeId}\n`;

  if (recordType === "NO_TEMP") {
    const noTempReason = document.getElementById("noTempReason")?.value || "-";
    const noTempDetail = document.getElementById("noTempDetail")?.value || "-";

    message += `อุณหภูมิ: -\n`;
    message += `สถานะ: ไม่สามารถวัดอุณหภูมิได้\n`;
    message += `เหตุผล: ${noTempReason}\n`;
    message += `รายละเอียด: ${noTempDetail}\n`;
  } else {
    message += `อุณหภูมิ: ${temp} °C\n`;
    message += `สถานะ: ${data?.status || "-"}\n`;
  }

  message += `ผู้บันทึก: ${recorderName}`;

  if (data?.abnormalRoundAlert || data?.bemAlertRequested) {
    message += `
Incident ID: ${data?.incidentId || "ผูกกับ Incident เดิม"}`;
  }

  if (data?.bemAlertRequested) {
    message += `
แจ้งเตือน BEM: ส่งคำขอแจ้งเตือนแล้ว`;
  } else if (data?.bemAlertWarning) {
    message += `
แจ้งเตือน BEM: ${data.bemAlertWarning}`;
  }

  if (data?.recorderNameWarning) {
    message += `
หมายเหตุชื่อผู้บันทึก: ${data.recorderNameWarning}`;
  }

  return message;
}

function closeAppPopup() {
  const popup = document.getElementById("appPopup");
  if (popup) {
    popup.classList.add("hidden");
  }
}

function unlockScrollAfterScanner() {
  document.body.style.overflow = "auto";
  document.documentElement.style.overflow = "auto";

  const reader = document.getElementById("reader");
  if (reader) {
    reader.classList.add("hidden");
  }

  const formPage = document.getElementById("formPage");

  if (formPage) {
    setTimeout(() => {
      formPage.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 300);
  }
} 


    let alarmDueItemsCache = [];

async function loadAlarmTestDueList() {
  const select = document.getElementById("alarmFridgeSelect");
  const summary = document.getElementById("alarmDueSummary");
  const resultBox = document.getElementById("alarmTestResult");

  if (!select) return;

  select.innerHTML = `<option value="">-- เลือกตู้ --</option>`;

  try {
    const response = await fetch(`${WEB_APP_URL}?action=alarm_due_list`);
    const data = await response.json();

    if (!data.ok) {
      if (summary) summary.innerText = data.message || "โหลดรายการไม่สำเร็จ";
      showResult(resultBox, false, data.message || "โหลดรายการไม่สำเร็จ");
      return;
    }

    alarmDueItemsCache = Array.isArray(data.dueItems) ? data.dueItems : [];

    if (summary) {
      summary.innerText = `วันนี้ครบกำหนด ${data.dueCount || 0} ตู้ จากทั้งหมด ${data.totalActiveFridges || 0} ตู้`;
    }

    alarmDueItemsCache.forEach(item => {
      const option = document.createElement("option");
      option.value = item.fridgeId;
      option.textContent = `${item.fridgeId} | ${item.fridgeName || "-"} | ${item.room || "-"} | ${item.dueStatus || "-"}`;
      select.appendChild(option);
    });

    setAlarmTestDefaultDateTime();

    showResult(resultBox, true, "โหลดรายการ Alarm Test สำเร็จ");

  } catch (error) {
    if (summary) summary.innerText = "โหลดรายการไม่สำเร็จ";
    showResult(resultBox, false, "โหลดรายการ Alarm Test ไม่สำเร็จ: " + error);
  }
}

function setAlarmTestDefaultDateTime() {
  const dateInput = document.getElementById("alarmTestDate");
  const timeInput = document.getElementById("alarmTestTime");

  if (dateInput && !dateInput.value) {
    dateInput.value = getTodayYMD();
  }

  if (timeInput && !timeInput.value) {
    timeInput.value = getCurrentTimeHHMM();
  }
}

function onAlarmFridgeChange() {
  const fridgeId = document.getElementById("alarmFridgeSelect")?.value || "";
  const infoBox = document.getElementById("alarmFridgeInfo");

  if (!infoBox) return;

  const item = alarmDueItemsCache.find(x => x.fridgeId === fridgeId);

  if (!item) {
    infoBox.innerHTML = "กรุณาเลือกตู้";
    return;
  }

  infoBox.innerHTML = `
    <strong>รหัสตู้:</strong> ${item.fridgeId || "-"}<br>
    <strong>ชื่อตู้:</strong> ${item.fridgeName || "-"}<br>
    <strong>ประเภท:</strong> ${item.productType || "-"}<br>
    <strong>สถานที่:</strong> ${item.room || "-"}<br>
    <strong>ทำล่าสุด:</strong> ${item.lastTestDate || "-"}<br>
    <strong>ครบกำหนด:</strong> ${item.nextDueDate || "-"}<br>
    <strong>สถานะ:</strong> ${item.dueStatus || "-"}<br>
    <strong>ผลครั้งล่าสุด:</strong> ${item.lastResult || "-"}<br>
    <strong>ผู้ทดสอบล่าสุด:</strong> ${staffNameForUI(item.lastTester) || "-"}
  `;

  applyAlarmFrontRule();
  validateAlarmTestForm();
  }

    async function submitAlarmTest() {
  const resultBox = document.getElementById("alarmTestResult");

  const testDate = document.getElementById("alarmTestDate")?.value || "";
  const testTime = document.getElementById("alarmTestTime")?.value || "";
  const fridgeId = document.getElementById("alarmFridgeSelect")?.value || "";
  const probeId = document.getElementById("alarmProbeId")?.value?.trim() || "";
  syncLoginIdentityFields();
  const testerRaw = AUTH_DISABLED_TEMPORARILY
    ? (document.getElementById("alarmTester")?.value?.trim() || "")
    : (getCurrentActorFullName() || getCurrentActorEmail());
  const tester = await resolveStaffFullNameForUI(testerRaw);

  if (!testDate || !testTime || !fridgeId) {
    showResult(resultBox, false, "กรุณากรอกวันที่ เวลา และเลือกตู้");
    return;
  }

  const params = new URLSearchParams();

  const frontRule = getAlarmFrontRule();

function alarmValue(id, fallback = "") {
  return document.getElementById(id)?.value || fallback;
}

function frontValue(id) {
  if (
    frontRule === "ffp_sound_only" &&
    [
      "frontHighAlarmTemp",
      "frontHighAlarmSound",
      "frontHighAlarmStatus",
      "frontLowAlarmTemp",
      "frontLowAlarmSound",
      "frontLowAlarmStatus"
    ].includes(id)
  ) {
    return "N/A";
  }

  return alarmValue(id);
}
      
  params.set("action", "submit_alarm_test");
  params.set("testDate", testDate);
  params.set("testTime", testTime);
  params.set("fridgeId", fridgeId);
  params.set("probeId", probeId);
  params.set("tester", tester);
  appendActorParams(params);

  params.set("batteryPercent", document.getElementById("batteryPercent")?.value || "");
  params.set("batteryStatus", document.getElementById("batteryStatus")?.value || "");

  params.set("signalPercent", document.getElementById("signalPercent")?.value || "");
  params.set("signalStatus", document.getElementById("signalStatus")?.value || "");

  params.set("datalogInterval", document.getElementById("datalogInterval")?.value || "");
  params.set("datalogStatus", document.getElementById("datalogStatus")?.value || "");

  params.set("highRemoteTime", document.getElementById("highRemoteTime")?.value || "");
  params.set("highLocalAlert", document.getElementById("highLocalAlert")?.value || "");
  params.set("highAlertResult", document.getElementById("highAlertResult")?.value || "");

  params.set("lowRemoteTime", document.getElementById("lowRemoteTime")?.value || "");
  params.set("lowLocalAlert", document.getElementById("lowLocalAlert")?.value || "");
  params.set("lowAlertResult", document.getElementById("lowAlertResult")?.value || "");

  params.set("wirelessRemoteTime", document.getElementById("wirelessRemoteTime")?.value || "");
  params.set("wirelessLocalAlert", document.getElementById("wirelessLocalAlert")?.value || "");
  params.set("wirelessAlertResult", document.getElementById("wirelessAlertResult")?.value || "");

  params.set("sensorRemoteTime", document.getElementById("sensorRemoteTime")?.value || "");
  params.set("sensorLocalAlert", document.getElementById("sensorLocalAlert")?.value || "");
  params.set("sensorAlertResult", document.getElementById("sensorAlertResult")?.value || "");

  params.set("frontHighAlarmTemp", frontValue("frontHighAlarmTemp"));
  params.set("frontHighAlarmSound", frontValue("frontHighAlarmSound"));
  params.set("frontHighAlarmStatus", frontValue("frontHighAlarmStatus"));

  params.set("frontLowAlarmTemp", frontValue("frontLowAlarmTemp"));
  params.set("frontLowAlarmSound", frontValue("frontLowAlarmSound"));
  params.set("frontLowAlarmStatus", frontValue("frontLowAlarmStatus"));

  params.set("frontDisplayStatus", frontValue("frontDisplayStatus"));
  params.set("frontOverallStatus", frontValue("frontOverallStatus"));

  params.set("actionWhenAbnormal", document.getElementById("alarmActionWhenAbnormal")?.value || "");
  params.set("note", document.getElementById("alarmNote")?.value?.trim() || "");
  params.set("bemChecker", document.getElementById("bemChecker")?.value?.trim() || "");

  try {
    const response = await fetch(`${WEB_APP_URL}?${params.toString()}`);
    const data = await response.json();

    if (data.ok) {
      showResult(resultBox, true, data.message || "บันทึก Alarm Test สำเร็จ");

      if (typeof showAppPopup === "function") {
        showAppPopup(
          true,
          "บันทึก Alarm Test สำเร็จ",
          `${data.fridgeId || ""}\nผลรวม: ${data.overallResult || "-"}`
        );
      }

      clearAlarmTestForm();
      loadAlarmTestDueList();

    } else {
      showResult(resultBox, false, data.message || "บันทึก Alarm Test ไม่สำเร็จ");

      if (typeof showAppPopup === "function") {
        showAppPopup(false, "บันทึกไม่สำเร็จ", data.message || "กรุณาตรวจสอบข้อมูล");
      }
    }

  } catch (error) {
    showResult(resultBox, false, "บันทึก Alarm Test ไม่สำเร็จ: " + error);
  }
}

    function clearAlarmTestForm() {
  const ids = [
    "alarmFridgeSelect",
    "alarmProbeId",
    "batteryPercent",
    "signalPercent",
    "datalogInterval",
    "highRemoteTime",
    "lowRemoteTime",
    "wirelessRemoteTime",
    "sensorRemoteTime",
    "frontHighAlarmTemp",
    "frontLowAlarmTemp",
    "alarmActionWhenAbnormal",
    "alarmNote",
    "bemChecker"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const alarmFridgeInfo = document.getElementById("alarmFridgeInfo");
  if (alarmFridgeInfo) alarmFridgeInfo.innerHTML = "กรุณาเลือกตู้";

  const resultBox = document.getElementById("alarmTestResult");
  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }

  setAlarmTestDefaultDateTime();
  syncLoginIdentityFields();
  applyAlarmFrontRule();
  validateAlarmTestForm();
}

function getSelectedAlarmFridgeItem() {
  const fridgeId = document.getElementById("alarmFridgeSelect")?.value || "";
  return alarmDueItemsCache.find(x => x.fridgeId === fridgeId) || null;
}

function getAlarmFrontRule() {
  const item = getSelectedAlarmFridgeItem();
  const productType = String(item?.productType || "").trim();

  const isFfp = productType === "FFP" || productType.includes("FFP");

  if (isFfp) {
    return "ffp_sound_only";
  }

  return "full_front_test";
}

function setFieldVisible(fieldId, visible) {
  const el = document.getElementById(fieldId);
  if (!el) return;

  const box = el.closest("div");
  if (!box) return;

  if (visible) {
    box.classList.remove("hidden");
  } else {
    box.classList.add("hidden");
    el.value = "";
  }
}

function applyAlarmFrontRule() {
  const rule = getAlarmFrontRule();

  const highLowFields = [
    "frontHighAlarmTemp",
    "frontHighAlarmSound",
    "frontHighAlarmStatus",
    "frontLowAlarmTemp",
    "frontLowAlarmSound",
    "frontLowAlarmStatus"
  ];

  const frontGeneralFields = [
    "frontDisplayStatus",
    "frontOverallStatus"
  ];

  if (rule === "full_front_test") {
    highLowFields.forEach(id => setFieldVisible(id, true));
    frontGeneralFields.forEach(id => setFieldVisible(id, true));
  }

  if (rule === "ffp_sound_only") {
    // FFP ไม่ต้องทำ High/Low แยก
    highLowFields.forEach(id => setFieldVisible(id, false));

    // ให้ทำเฉพาะ Front Test ว่าส่งเสียง/ภาพรวม
    frontGeneralFields.forEach(id => setFieldVisible(id, true));
  }

  updateAlarmFrontNote(rule);
  validateAlarmTestForm();
}

function updateAlarmFrontNote(rule) {
  let noteBox = document.getElementById("alarmFrontRuleNote");

  if (!noteBox) {
    const frontTitle = Array.from(document.querySelectorAll(".sub-section-title"))
      .find(el => el.innerText.includes("Front Test"));

    if (!frontTitle) return;

    noteBox = document.createElement("div");
    noteBox.id = "alarmFrontRuleNote";
    noteBox.className = "info-box";
    noteBox.style.marginBottom = "14px";

    frontTitle.insertAdjacentElement("afterend", noteBox);
  }

  if (rule === "full_front_test") {
    noteBox.innerHTML = "ตู้ประเภทนี้ต้องทำ Front Test ครบทั้ง High Alarm, Low Alarm และหน้าจอ/ปุ่มกด";
  }

  if (rule === "ffp_sound_only") {
    noteBox.innerHTML = "ตู้ FFP: ไม่ต้องทำ Front Test แยก High Alarm / Low Alarm ให้ทดสอบเฉพาะเสียง/ภาพรวมหน้าตู้";
  }
}

    function getValue(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function validateAlarmTestForm() {
  const submitBtn = document.getElementById("alarmSubmitBtn");
  if (!submitBtn) return;

  const rule = getAlarmFrontRule();

  const requiredFields = [
    "alarmFridgeSelect",
    "alarmTestDate",
    "alarmTestTime",

    "batteryPercent",
    "batteryStatus",
    "signalPercent",
    "signalStatus",
    "datalogInterval",
    "datalogStatus",

    "highRemoteTime",
    "highLocalAlert",
    "highAlertResult",

    "lowRemoteTime",
    "lowLocalAlert",
    "lowAlertResult",

    "wirelessRemoteTime",
    "wirelessLocalAlert",
    "wirelessAlertResult",

    "sensorRemoteTime",
    "sensorLocalAlert",
    "sensorAlertResult"
  ];

  if (rule === "full_front_test") {
  requiredFields.push(
    "frontHighAlarmTemp",
    "frontHighAlarmSound",
    "frontHighAlarmStatus",
    "frontLowAlarmTemp",
    "frontLowAlarmSound",
    "frontLowAlarmStatus",
    "frontDisplayStatus",
    "frontOverallStatus"
  );
}

if (rule === "ffp_sound_only") {
  requiredFields.push(
    "frontDisplayStatus",
    "frontOverallStatus"
  );
}

  const hasMissingRequired = requiredFields.some(id => !getValue(id));

  const failFields = [
    "batteryStatus",
    "signalStatus",
    "datalogStatus",
    "highAlertResult",
    "lowAlertResult",
    "wirelessAlertResult",
    "sensorAlertResult",
    "frontHighAlarmStatus",
    "frontLowAlarmStatus",
    "frontDisplayStatus",
    "frontOverallStatus"
  ];

  const hasFail = failFields.some(id => {
    const value = getValue(id);
    return value === "ผิดปกติ" || value === "ไม่ผ่าน" || value === "ไม่พร้อมใช้งาน";
  });

  const actionWhenAbnormal = getValue("alarmActionWhenAbnormal");
  const missingActionForFail = hasFail && !actionWhenAbnormal;

  submitBtn.disabled = hasMissingRequired || missingActionForFail;
}

    function setupAlarmTestValidation() {
  const alarmPage = document.getElementById("alarmTestPage");
  if (!alarmPage) return;

  const fields = alarmPage.querySelectorAll("input, select, textarea");

  fields.forEach(field => {
    field.addEventListener("input", validateAlarmTestForm);
    field.addEventListener("change", validateAlarmTestForm);
  });

  validateAlarmTestForm();
}

async function loadAlarmTestHistory() {
  const resultBox = document.getElementById("alarmHistoryResultBox");
  const tbody = document.getElementById("alarmHistoryTableBody");
  const detailBox = document.getElementById("alarmHistoryDetailBox");

  if (!tbody) return;

  const fridgeId = document.getElementById("alarmHistoryFridgeId")?.value?.trim() || "";
  const result = document.getElementById("alarmHistoryResult")?.value || "all";
  const startDate = document.getElementById("alarmHistoryStartDate")?.value || "";
  const endDate = document.getElementById("alarmHistoryEndDate")?.value || "";

  tbody.innerHTML = `<tr><td colspan="8">กำลังโหลดข้อมูล...</td></tr>`;
  if (detailBox) detailBox.classList.add("hidden");

  const params = new URLSearchParams();
  params.set("action", "alarm_test_history");
  params.set("fridgeId", fridgeId);
  params.set("result", result);
  params.set("startDate", startDate);
  params.set("endDate", endDate);

  try {
    const response = await fetch(`${WEB_APP_URL}?${params.toString()}`);
    const data = await response.json();

    if (!data.ok) {
      tbody.innerHTML = `<tr><td colspan="8">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
      showResult(resultBox, false, data.message || "โหลดประวัติ Alarm Test ไม่สำเร็จ");
      return;
    }

    alarmHistoryCache = Array.isArray(data.records) ? data.records : [];

    if (alarmHistoryCache.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8">ไม่พบข้อมูล</td></tr>`;
      showResult(resultBox, true, "ไม่พบข้อมูลตามเงื่อนไขที่ค้นหา");
      return;
    }

    tbody.innerHTML = "";

    alarmHistoryCache.forEach((item, index) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${item.testDate || "-"}</td>
        <td>${item.testTime || "-"}</td>
        <td>${item.fridgeId || "-"}</td>
        <td>${item.fridgeName || "-"}</td>
        <td>${item.room || "-"}</td>
        <td>
          <span class="${item.overallResult === "ผ่าน" ? "status-green" : "status-red"}">
            ${item.overallResult || "-"}
          </span>
        </td>
        <td>${staffNameForUI(item.tester) || "-"}</td>
        <td>
          <button type="button" class="btn-secondary small-btn" onclick="showAlarmTestDetail(${index})">
            ดูรายละเอียด
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    showResult(resultBox, true, `พบประวัติ Alarm Test ${alarmHistoryCache.length} รายการ`);

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
    showResult(resultBox, false, "โหลดประวัติ Alarm Test ไม่สำเร็จ: " + error);
  }
}

function showAlarmTestDetail(index) {
  const detailBox = document.getElementById("alarmHistoryDetailBox");
  if (!detailBox) return;

  const item = alarmHistoryCache[index];
  if (!item) return;

  detailBox.classList.remove("hidden");

  detailBox.innerHTML = `
    <h3>รายละเอียด Alarm Test: ${item.fridgeId || "-"}</h3>

    <div class="alarm-detail-grid">
      <div class="alarm-detail-item"><strong>วันที่/เวลา:</strong> ${item.testDate || "-"} ${item.testTime || "-"}</div>
      <div class="alarm-detail-item"><strong>ผลรวม:</strong> ${item.overallResult || "-"}</div>
      <div class="alarm-detail-item"><strong>Probe:</strong> ${item.probeId || "-"}</div>
      <div class="alarm-detail-item"><strong>ผู้ทดสอบ:</strong> ${staffNameForUI(item.tester) || "-"}</div>

      <div class="alarm-detail-item"><strong>Battery:</strong> ${item.batteryPercent || "-"}% / ${item.batteryStatus || "-"}</div>
      <div class="alarm-detail-item"><strong>Signal:</strong> ${item.signalPercent || "-"}% / ${item.signalStatus || "-"}</div>
      <div class="alarm-detail-item"><strong>Datalogging:</strong> Interval ${item.datalogInterval || "-"} นาที / ${item.datalogStatus || "-"}</div>

      <div class="alarm-detail-item"><strong>High Alert:</strong> ${item.highAlertResult || "-"} / Remote ${item.highRemoteTime || "-"} นาที / Local ${item.highLocalAlert || "-"}</div>
      <div class="alarm-detail-item"><strong>Low Alert:</strong> ${item.lowAlertResult || "-"} / Remote ${item.lowRemoteTime || "-"} นาที / Local ${item.lowLocalAlert || "-"}</div>
      <div class="alarm-detail-item"><strong>Wireless Alert:</strong> ${item.wirelessAlertResult || "-"} / Remote ${item.wirelessRemoteTime || "-"} นาที / Local ${item.wirelessLocalAlert || "-"}</div>
      <div class="alarm-detail-item"><strong>Sensor Alert:</strong> ${item.sensorAlertResult || "-"} / Remote ${item.sensorRemoteTime || "-"} นาที / Local ${item.sensorLocalAlert || "-"}</div>

      <div class="alarm-detail-item"><strong>Front High:</strong> ${item.frontHighAlarmTemp || "-"} °C / ${item.frontHighAlarmSound || "-"} / ${item.frontHighAlarmStatus || "-"}</div>
      <div class="alarm-detail-item"><strong>Front Low:</strong> ${item.frontLowAlarmTemp || "-"} °C / ${item.frontLowAlarmSound || "-"} / ${item.frontLowAlarmStatus || "-"}</div>
      <div class="alarm-detail-item"><strong>Front Display:</strong> ${item.frontDisplayStatus || "-"}</div>
      <div class="alarm-detail-item"><strong>Front Overall:</strong> ${item.frontOverallStatus || "-"}</div>

      <div class="alarm-detail-item"><strong>การดำเนินการ:</strong> ${item.actionWhenAbnormal || "-"}</div>
      <div class="alarm-detail-item"><strong>BEM:</strong> ${staffNameForUI(item.bemChecker) || "-"}</div>
      <div class="alarm-detail-item"><strong>หมายเหตุ:</strong> ${item.note || "-"}</div>
      <div class="alarm-detail-item"><strong>ผู้บันทึก:</strong> ${staffNameForUI(item.savedBy) || "-"}</div>
    </div>
  `;

  setTimeout(() => {
    detailBox.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 100);
}

function clearAlarmTestHistory() {
  const ids = [
    "alarmHistoryFridgeId",
    "alarmHistoryStartDate",
    "alarmHistoryEndDate"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const resultSelect = document.getElementById("alarmHistoryResult");
  if (resultSelect) resultSelect.value = "all";

  const tbody = document.getElementById("alarmHistoryTableBody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8">ยังไม่มีข้อมูล</td></tr>`;
  }

  const detailBox = document.getElementById("alarmHistoryDetailBox");
  if (detailBox) {
    detailBox.classList.add("hidden");
    detailBox.innerHTML = "";
  }

  const resultBox = document.getElementById("alarmHistoryResultBox");
  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }

  alarmHistoryCache = [];
}

function closeScannerPopup() {
  const popup = document.getElementById("scannerPopup");

  if (html5QrCode && scannerOpen) {
    html5QrCode.stop()
      .then(() => {
        html5QrCode.clear();
        html5QrCode = null;
        scannerOpen = false;
        if (popup) popup.classList.add("hidden");
        document.body.style.overflow = "auto";
      })
      .catch((err) => {
        console.warn("หยุดกล้องไม่ได้:", err);
        html5QrCode = null;
        scannerOpen = false;
        if (popup) popup.classList.add("hidden");
        document.body.style.overflow = "auto";
      });
  } else {
    scannerOpen = false;
    if (popup) popup.classList.add("hidden");
    document.body.style.overflow = "auto";
  }
}

function toggleDesktopSidebar() {
  document.body.classList.toggle("desktop-sidebar-collapsed");

  const isCollapsed = document.body.classList.contains("desktop-sidebar-collapsed");
  localStorage.setItem("desktopSidebarCollapsed", isCollapsed ? "yes" : "no");
}

document.addEventListener("DOMContentLoaded",function () {
  const savedState = localStorage.getItem("desktopSidebarCollapsed");

  if (savedState === "yes") {
    document.body.classList.add("desktop-sidebar-collapsed");
  }
});

function onRecordTypeChange() {
  const recordType = document.getElementById("recordType")?.value || "TEMP";
  const tempEl = document.getElementById("temp");
  const noteEl = document.getElementById("note");

  const noTempReasonBox = document.getElementById("noTempReasonBox");
  const noTempDetailBox = document.getElementById("noTempDetailBox");
  const noTempReason = document.getElementById("noTempReason");
  const noTempDetail = document.getElementById("noTempDetail");

  if (recordType === "NO_TEMP") {
    if (tempEl) {
      tempEl.value = "-";
      tempEl.disabled = true;
      tempEl.placeholder = "ไม่สามารถวัดได้";
    }

    if (noteEl) {
      noteEl.value = "";
      noteEl.disabled = true;
      noteEl.placeholder = "ระบบจะใช้เหตุผลที่ไม่สามารถวัดอุณหภูมิได้แทน";
      noteEl.classList.remove("required-warning");
    }

    if (noTempReasonBox) noTempReasonBox.classList.remove("hidden");
    if (noTempDetailBox) noTempDetailBox.classList.remove("hidden");
  } else {
    if (tempEl) {
      tempEl.value = "";
      tempEl.disabled = false;
      tempEl.placeholder = "เช่น 4.0 หรือ -20.0";
    }

    if (noteEl) {
      noteEl.disabled = false;
      noteEl.placeholder = "ถ้ามี";
    }

    if (noTempReasonBox) noTempReasonBox.classList.add("hidden");
    if (noTempDetailBox) noTempDetailBox.classList.add("hidden");

    if (noTempReason) noTempReason.value = "";
    if (noTempDetail) noTempDetail.value = "";
  }

  autoSelectRoundByCurrentTime({ force: false });
  validateForm();
}

/* ===== v1.7 Login / BEM workflow overrides ===== */
function incidentStatusKeyToTitle(statusKey) {
  const map = {
    waiting_bem: "รอ BEM รับเรื่อง",
    checking_only: "กำลังตรวจสอบ",
    follow: "ย้ายเลือดแล้ว / รอติดตาม",
    repair: "ส่งซ่อม",
    closed: "ปิดเคส"
  };
  return map[statusKey] || "BEM รับเรื่อง / อัปเดตสถานะงาน";
}

function showBEMStatusPage(statusKey, btn) {
  const dateFilter = document.getElementById("updateIncidentDateFilter");
  const statusFilter = document.getElementById("updateIncidentStatusFilter");
  const title = document.querySelector("#updateIncidentPage .section-title");
  if (dateFilter) dateFilter.value = statusKey === "closed" ? "30days" : "all";
  if (statusFilter) statusFilter.value = statusKey || "waiting_bem";
  if (title) title.innerText = incidentStatusKeyToTitle(statusKey);
  showPage("updateIncidentPage", btn);
}

async function refreshBEMMenuCounts() {
  try {
    const res = await fetch(`${WEB_APP_URL}?action=incident_all_list&dateFilter=all&statusFilter=all`);
    let data = await res.json();
    data = uniqueIncidentsById(data);
    if (!Array.isArray(data)) return;
    const count = (fn) => data.filter(fn).length;
    const set = (id, n) => { const el = document.getElementById(id); if (el) el.innerText = String(n); };
    set("bemCountWaiting", count(x => x.caseStatus === "รอ BEM รับเรื่อง"));
    set("bemCountChecking", count(x => x.caseStatus === "กำลังตรวจสอบ" || x.caseStatus === "BEM รับเรื่องแล้ว"));
    set("bemCountFollow", count(x => x.caseStatus === "ย้ายเลือดแล้ว / รอติดตาม"));
    set("bemCountRepair", count(x => x.caseStatus === "ส่งซ่อมภายนอก" || x.caseStatus === "รออะไหล่ต่างประเทศ"));
    set("bemCountClosed", count(x => x.caseStatus === "ปิดเคส"));
  } catch (e) {
    console.warn("refreshBEMMenuCounts failed", e);
  }
}

function canResendIncidentStatus(status) {
  const value = String(status || "").trim();
  return !!value && !["ปิดเคส", "ยกเลิกเคส", "ยกเลิก"].includes(value);
}

async function openIncidentFromTracking(incidentId) {
  const sidebarButton = document.querySelector('.menu-btn[data-menu-key="bem_waiting"]');
  showPage("updateIncidentPage", sidebarButton || null);
  await loadOpenIncidentList();
  if (incidentId) selectUpdateIncident(incidentId);
  const page = document.getElementById("updateIncidentPage");
  if (page) page.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadIncidentTracking() {
  const dateFilter = document.getElementById("incidentDateFilter")?.value || "today";
  const statusFilter = document.getElementById("incidentStatusFilter")?.value || "all";
  const startDate = document.getElementById("incidentStartDate")?.value || "";
  const endDate = document.getElementById("incidentEndDate")?.value || "";
  const fridgeSearch = document.getElementById("incidentFridgeSearch")?.value?.trim() || "";
  const resultBox = document.getElementById("incidentResult");
  const tbody = document.getElementById("incidentTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  try {
    const url = `${WEB_APP_URL}?action=incident_list&dateFilter=${encodeURIComponent(dateFilter)}&statusFilter=${encodeURIComponent(backendStatusFilter)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&fridgeSearch=${encodeURIComponent(fridgeSearch)}`;
    const response = await fetch(url);
    let data = await response.json();
    data = uniqueIncidentsById(data);
    data = filterIncidentRowsByUiStatus(data, statusFilter);
    if (!Array.isArray(data) || data.length === 0) {
      showResult(resultBox, true, "ไม่พบรายการ Incident");
      return;
    }
    data.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td data-label="Incident ID" class="incident-id-cell">${escapeHtml(item.incidentId || "")}</td>
        <td data-label="วันที่พบ">${escapeHtml(item.foundDate || "")}</td>
        <td data-label="เวลา">${escapeHtml(item.foundTime || "")}</td>
        <td data-label="สถานที่">${escapeHtml(item.room || "")}</td>
        <td data-label="รหัสตู้" class="incident-fridge-cell">${escapeHtml(item.fridgeId || "")}</td>
        <td data-label="อุณหภูมิ">${item.temp === null || item.temp === undefined ? "-" : escapeHtml(item.temp) + " °C"}</td>
        <td data-label="ผู้รายงาน">${escapeHtml(staffNameForUI(item.reporter) || "")}</td>
        <td data-label="สถานะเคส"><span class="status-badge ${getIncidentStatusClass(item.caseStatus)}">${escapeHtml(item.caseStatus || "")}</span></td>
        <td data-label="ผู้ดำเนินการ">${escapeHtml(staffNameForUI(item.owner) || "")}</td>
        <td data-label="เลขงาน BEM">${escapeHtml(item.bemJobNo || "-")}</td>
        <td data-label="การดำเนินการ">${escapeHtml(item.actionText || "")}</td>
        <td data-label="ผลการแก้ไข">${escapeHtml(item.fixResult || "")}</td>
        <td data-label="อัปเดตล่าสุด">${escapeHtml(item.updatedDate || "")}</td>
        <td data-label="รอบ">${escapeHtml(item.round || "")}</td>
        <td data-label="หมายเหตุ">${escapeHtml(item.logNote || "")}</td>
        <td data-label="จัดการ" class="incident-action-cell"><div class="incident-card-actions"><button type="button" class="btn-primary incident-open-btn" onclick='openIncidentFromTracking(${JSON.stringify(item.incidentId || "")})'>เปิดจัดการเคส</button>${canResendIncidentStatus(item.caseStatus) ? `<button type="button" class="btn-secondary incident-resend-btn" onclick='openResendBemAlertModal(${JSON.stringify(item.incidentId || "")})'>📨 ส่งซ้ำ</button>` : ""}</div></td>
      `;
      tbody.appendChild(tr);
    });
    showResult(resultBox, true, `พบ ${data.length} รายการ`);
  } catch (error) {
    showResult(resultBox, false, "โหลด Incident ไม่สำเร็จ: " + error);
  }
}

async function loadOpenIncidentList() {
  const select = document.getElementById("updateIncidentSelect");
  const resultBox = document.getElementById("updateIncidentResult");
  const cardList = document.getElementById("updateIncidentCardList");
  if (!select) return;

  const loadSeq = ++updateIncidentLoadSeq;
  const dateFilter = document.getElementById("updateIncidentDateFilter")?.value || "all";
  const statusFilter = document.getElementById("updateIncidentStatusFilter")?.value || "waiting_bem";
  const startDate = document.getElementById("updateIncidentStartDate")?.value || "";
  const endDate = document.getElementById("updateIncidentEndDate")?.value || "";
  const fridgeSearch = document.getElementById("updateIncidentFridgeSearch")?.value?.trim() || "";

  const resetIncidentPicker = () => {
    select.innerHTML = '<option value="">-- เลือก Incident ID --</option>';
    if (cardList) cardList.innerHTML = "";
    updateIncidentListCache = [];
  };

  resetIncidentPicker();

  try {
    const url = `${WEB_APP_URL}?action=incident_list&dateFilter=${encodeURIComponent(dateFilter)}&statusFilter=${encodeURIComponent(statusFilter)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&fridgeSearch=${encodeURIComponent(fridgeSearch)}`;
    const response = await fetch(url);
    let data = await response.json();
    data = uniqueIncidentsById(data);

    // กันการเรียกซ้อนจาก showPage/sidebar/ลิงก์เก่า ทำให้การ์ด Incident เดียวกันขึ้นซ้ำ
    if (loadSeq !== updateIncidentLoadSeq) return;

    // ล้างอีกครั้งหลัง fetch ก่อน render เพื่อให้เหลือผลลัพธ์จาก request ล่าสุดเท่านั้น
    resetIncidentPicker();

    if (!Array.isArray(data) || data.length === 0) {
      showResult(resultBox, true, "ไม่พบ Incident ตามตัวกรอง");
      syncLoginIdentityFields();
      renderUpdateIncidentSummary(null);
      return;
    }

    updateIncidentListCache = data;

    const optionFragment = document.createDocumentFragment();
    data.forEach(item => {
      const option = document.createElement("option");
      option.value = item.incidentId;
      option.textContent = `${item.incidentId} | ${item.bemJobNo || "ยังไม่มีเลข BEM"} | ${item.foundDate || "-"} ${item.foundTime || "-"} | ${item.fridgeId || "-"} | ${item.caseStatus || "-"}`;
      optionFragment.appendChild(option);
    });
    select.appendChild(optionFragment);

    const renderList = data.slice(0, 30);
    if (cardList) {
      const cardFragment = document.createDocumentFragment();
      renderList.forEach(item => {
        const div = document.createElement("div");
        div.className = "bem-incident-card";
        div.onclick = () => selectUpdateIncident(item.incidentId);
        div.innerHTML = `
          <div class="bem-incident-card-head">
            <strong>${escapeHtml(item.incidentId || "-")}</strong>
            <span class="status-badge ${getIncidentStatusClass(item.caseStatus)}">${escapeHtml(item.caseStatus || "-")}</span>
          </div>
          <div class="bem-incident-card-body">
            <div><strong>เลขงาน BEM:</strong> ${escapeHtml(item.bemJobNo || "ยังไม่ได้กรอก")}</div>
            <div><strong>ตู้:</strong> ${escapeHtml(item.fridgeId || "-")} | ${escapeHtml(item.room || "-")}</div>
            <div><strong>วันเวลา:</strong> ${escapeHtml(item.foundDate || "-")} ${escapeHtml(item.foundTime || "-")} | รอบ ${escapeHtml(item.round || "-")}</div>
            <div><strong>อุณหภูมิ:</strong> ${item.temp === null || item.temp === undefined ? "-" : escapeHtml(item.temp)} °C</div>
          </div>
          <button type="button" class="btn-primary bem-card-select-btn">เลือกเคสนี้</button>
        `;
        cardFragment.appendChild(div);
      });
      cardList.appendChild(cardFragment);
    }

    const msg = data.length > renderList.length
      ? `พบ ${data.length} รายการ แสดงการ์ด ${renderList.length} รายการล่าสุด ถ้าต้องการเจาะจงให้ค้นหาด้วย Incident ID / รหัสตู้ / เลขงาน BEM`
      : `พบ ${data.length} รายการ เลือกการ์ดหรือเลือกจาก Dropdown เพื่ออัปเดตสถานะ`;
    showResult(resultBox, true, msg);
  } catch (error) {
    if (loadSeq !== updateIncidentLoadSeq) return;
    showResult(resultBox, false, "โหลด Incident ไม่สำเร็จ: " + error);
  }
}

function selectUpdateIncident(incidentId) {
  const select = document.getElementById("updateIncidentSelect");
  const input = document.getElementById("updateIncidentId");
  if (select && incidentId) select.value = incidentId;
  if (input) input.value = incidentId || "";
  const item = updateIncidentListCache.find(x => x.incidentId === incidentId) || null;
  const bemJobNo = document.getElementById("updateBEMJobNo");
  if (bemJobNo) bemJobNo.value = item?.bemJobNo || "";
  const resendBtn = document.getElementById("resendSelectedIncidentBtn");
  if (resendBtn) resendBtn.disabled = !incidentId || !canResendIncidentStatus(item?.caseStatus);
  resetBEMStatusSelection();
  setCurrentIncidentStatusLabel(item?.caseStatus || "");
  renderUpdateIncidentSummary(item);
}

function renderUpdateIncidentSummary(item) {
  const box = document.getElementById("updateIncidentSummary");
  if (!box) return;
  if (!item) {
    box.classList.add("hidden");
    box.innerHTML = "";
    setCurrentIncidentStatusLabel("");
    return;
  }
  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="incident-summary-title">เคสที่เลือก: ${escapeHtml(item.incidentId || "-")}</div>
    <div class="incident-summary-grid">
      <div><strong>เลขงาน BEM:</strong> ${escapeHtml(item.bemJobNo || "ยังไม่ได้กรอก")}</div>
      <div><strong>ตู้:</strong> ${escapeHtml(item.fridgeId || "-")}</div>
      <div><strong>สถานที่:</strong> ${escapeHtml(item.room || "-")}</div>
      <div><strong>วันเวลาเกิดเหตุ:</strong> ${escapeHtml(item.foundDate || "-")} ${escapeHtml(item.foundTime || "-")}</div>
      <div><strong>รอบ:</strong> ${escapeHtml(item.round || "-")}</div>
      <div><strong>อุณหภูมิ:</strong> ${item.temp === null || item.temp === undefined ? "-" : escapeHtml(item.temp)} °C</div>
      <div><strong>ผู้รายงาน:</strong> ${escapeHtml(staffNameForUI(item.reporter) || "-")}</div>
      <div><strong>สถานะล่าสุด:</strong> ${escapeHtml(item.caseStatus || "-")}</div>
      <div class="full"><strong>รายละเอียดเดิม:</strong> ${escapeHtml(item.logNote || item.actionText || "-")}</div>
    </div>
  `;
}

function clearIncidentUpdateForm() {
  ["updateIncidentSelect","updateIncidentId","updateBEMJobNo","updateCaseStatus","updateOwner","updateActionText","updateFixResult","updateBy"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  syncLoginIdentityFields();
  resetBEMStatusSelection();
  setCurrentIncidentStatusLabel("");
  renderUpdateIncidentSummary(null);
  const resendBtn = document.getElementById("resendSelectedIncidentBtn");
  if (resendBtn) resendBtn.disabled = true;
  const resultBox = document.getElementById("updateIncidentResult");
  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }
  loadOpenIncidentList();
}


function findIncidentForResend(incidentId) {
  const id = String(incidentId || "").trim();
  if (!id) return null;
  return (Array.isArray(updateIncidentListCache) ? updateIncidentListCache : []).find(item => item.incidentId === id) || null;
}

function openResendBemAlertModal(incidentId) {
  const id = String(incidentId || document.getElementById("updateIncidentId")?.value || "").trim();
  if (!id) {
    showAppPopup(false, "ยังไม่ได้เลือก Incident", "กรุณาเลือก Incident ที่ต้องการส่งแจ้งเตือน BEM ซ้ำ");
    return;
  }

  const item = findIncidentForResend(id);
  if (item && !canResendIncidentStatus(item.caseStatus)) {
    showAppPopup(false, "ไม่สามารถส่งซ้ำได้", `Incident ${id} อยู่ในสถานะ ${item.caseStatus}`);
    return;
  }

  const modal = document.getElementById("resendBemAlertModal");
  const idInput = document.getElementById("resendBemIncidentId");
  const senderInput = document.getElementById("resendBemRequestedBy");
  const noteInput = document.getElementById("resendBemNote");
  const resultBox = document.getElementById("resendBemAlertResult");
  if (!modal || !idInput || !senderInput || !noteInput) return;

  idInput.value = id;
  senderInput.value = AUTH_DISABLED_TEMPORARILY
    ? (document.getElementById("updateOwner")?.value?.trim() || "")
    : (getCurrentActorFullName() || getCurrentActorEmail() || "");
  noteInput.value = "แจ้งย้อนหลัง เนื่องจากข้อความครั้งแรกไม่เข้า Google Chat";
  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }
  modal.classList.remove("hidden");
  document.body.classList.add("guide-modal-open");
  setTimeout(() => senderInput.focus(), 50);
}

function closeResendBemAlertModal() {
  const modal = document.getElementById("resendBemAlertModal");
  if (modal) modal.classList.add("hidden");
  document.body.classList.remove("guide-modal-open");
}

async function confirmResendBemAlert() {
  const incidentId = document.getElementById("resendBemIncidentId")?.value?.trim() || "";
  const requestedByRaw = document.getElementById("resendBemRequestedBy")?.value?.trim() || "";
  const note = document.getElementById("resendBemNote")?.value?.trim() || "";
  const resultBox = document.getElementById("resendBemAlertResult");
  const btn = document.getElementById("confirmResendBemAlertBtn");

  if (!incidentId) {
    showResult(resultBox, false, "ไม่พบ Incident ID");
    return;
  }
  if (!requestedByRaw) {
    showResult(resultBox, false, "กรุณากรอกชื่อผู้กดส่งแจ้งเตือน");
    return;
  }

  const requestedBy = await resolveStaffFullNameForUI(requestedByRaw);
  const actorQuery = AUTH_DISABLED_TEMPORARILY ? "" : `&actorUserId=${encodeURIComponent(getCurrentActorId())}&actorEmail=${encodeURIComponent(getCurrentActorEmail())}&actorFullName=${encodeURIComponent(getCurrentActorFullName())}&actorRole=${encodeURIComponent(getCurrentActorRole())}`;
  const url = `${WEB_APP_URL}?action=incident_resend_alert&incidentId=${encodeURIComponent(incidentId)}&requestedBy=${encodeURIComponent(requestedBy)}&note=${encodeURIComponent(note)}${actorQuery}`;

  if (btn) {
    btn.disabled = true;
    btn.innerText = "กำลังส่ง...";
  }
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || "ส่งแจ้งเตือนไม่สำเร็จ");

    showResult(resultBox, true, data.message || "ส่งคำขอแจ้งเตือน BEM ซ้ำแล้ว");
    showAppPopup(true, "ส่งแจ้งเตือนแล้ว", `Incident: ${data.incidentId || incidentId}\nผู้ส่ง: ${data.requestedBy || requestedBy}\nระบบบันทึกการส่งไว้ใน Timeline แล้ว`);
    closeResendBemAlertModal();
    await refreshBEMMenuCounts();
  } catch (error) {
    const message = error?.message || String(error);
    showResult(resultBox, false, message);
    showAppPopup(false, "ส่งแจ้งเตือนไม่สำเร็จ", message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = "ยืนยันส่ง Google Chat";
    }
  }
}

async function submitIncidentUpdate() {
  const incidentId = document.getElementById("updateIncidentId")?.value?.trim() || "";
  const bemJobNo = document.getElementById("updateBEMJobNo")?.value?.trim() || "";
  const requestedCaseStatus = document.getElementById("updateCaseStatus")?.value?.trim() || "";
  const fixResult = document.getElementById("updateFixResult")?.value?.trim() || "";
  // V1.8.53: ถ้า BEM ระบุว่าแก้ไขสำเร็จ ให้ปิดเคสในคำสั่งบันทึกทันที
  const caseStatus = fixResult === "แก้ไขสำเร็จ" ? "ปิดเคส" : requestedCaseStatus;
  if (caseStatus === "ปิดเคส") {
    const statusEl = document.getElementById("updateCaseStatus");
    if (statusEl) statusEl.value = "ปิดเคส";
    markBEMStatusSelection("ปิดเคส");
  }
  syncLoginIdentityFields();
  const ownerRaw = AUTH_DISABLED_TEMPORARILY
    ? (document.getElementById("updateOwner")?.value?.trim() || "")
    : (getCurrentActorFullName() || getCurrentActorEmail());
  const owner = await resolveStaffFullNameForUI(ownerRaw);
  const actionText = document.getElementById("updateActionText")?.value?.trim() || "";
  const updatedBy = owner;
  const resultBox = document.getElementById("updateIncidentResult");
  if (!incidentId || !caseStatus) {
    showResult(resultBox, false, "กรุณาเลือก Incident และกดเลือกสถานะใหม่");
    return;
  }
  const actorQuery = AUTH_DISABLED_TEMPORARILY ? "" : `&actorUserId=${encodeURIComponent(getCurrentActorId())}&actorEmail=${encodeURIComponent(getCurrentActorEmail())}&actorFullName=${encodeURIComponent(getCurrentActorFullName())}&actorRole=${encodeURIComponent(getCurrentActorRole())}`;
  const url = `${WEB_APP_URL}?action=incident_update&incidentId=${encodeURIComponent(incidentId)}&bemJobNo=${encodeURIComponent(bemJobNo)}&caseStatus=${encodeURIComponent(caseStatus)}&owner=${encodeURIComponent(owner)}&actionText=${encodeURIComponent(actionText)}&fixResult=${encodeURIComponent(fixResult)}&updatedBy=${encodeURIComponent(updatedBy)}&updatedByEmail=${encodeURIComponent(getCurrentActorEmail())}${actorQuery}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.ok) {
      showAppPopup(true, "บันทึกสำเร็จ", `Incident: ${data.incidentId || incidentId}\nเลขงาน BEM: ${data.bemJobNo || bemJobNo || "-"}\nสถานะ: ${data.caseStatus || caseStatus}`);
      showResult(resultBox, true, data.message || "บันทึกสำเร็จ");
      clearIncidentUpdateForm();
      await refreshBEMMenuCounts();
    } else {
      showAppPopup(false, "บันทึกไม่สำเร็จ", data.message || "กรุณาตรวจสอบข้อมูล");
      showResult(resultBox, false, data.message || "บันทึกไม่สำเร็จ");
    }
  } catch (error) {
    showResult(resultBox, false, "อัปเดต Incident ไม่สำเร็จ: " + error);
  }
}

async function loadAdminUsers() {
  const resultBox = document.getElementById("adminUsersResult");
  const tbody = document.getElementById("adminUsersTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  try {
    const res = await fetch(`${WEB_APP_URL}?action=user_list`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error(data.message || "โหลดรายชื่อผู้ใช้ไม่สำเร็จ");
    data.forEach(user => {
      const tr = document.createElement("tr");
      const disabledAdmin = String(user.email || "").toLowerCase() === ADMIN_EMAIL;
      tr.innerHTML = `
        <td>${escapeHtml(user.email || "")}</td>
        <td>${escapeHtml(user.username || "")}</td>
        <td>${escapeHtml(((user.firstName || "") + " " + (user.lastName || "")).trim())}</td>
        <td>${escapeHtml(user.department || "")}</td>
        <td>${escapeHtml(user.employeeId || "")}</td>
        <td>
          <select data-user-role="${escapeHtml(user.id)}" ${disabledAdmin ? "disabled" : ""}>
            <option value="staff" ${user.role === "staff" ? "selected" : ""}>staff</option>
            <option value="bem" ${user.role === "bem" ? "selected" : ""}>bem</option>
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>admin</option>
          </select>
        </td>
        <td>
          <select data-user-active="${escapeHtml(user.id)}" ${disabledAdmin ? "disabled" : ""}>
            <option value="true" ${user.isActive !== false ? "selected" : ""}>ใช้งาน</option>
            <option value="false" ${user.isActive === false ? "selected" : ""}>ปิดใช้งาน</option>
          </select>
        </td>
        <td><button type="button" class="btn-primary" onclick="saveUserRole('${escapeHtml(user.id)}')" ${disabledAdmin ? "disabled" : ""}>บันทึก</button></td>
      `;
      tbody.appendChild(tr);
    });
    showResult(resultBox, true, `พบผู้ใช้ ${data.length} คน`);
  } catch (error) {
    showResult(resultBox, false, "โหลดผู้ใช้ไม่สำเร็จ: " + (error.message || error));
  }
}

async function saveUserRole(userId) {
  const role = document.querySelector(`[data-user-role="${CSS.escape(userId)}"]`)?.value || "staff";
  const isActive = document.querySelector(`[data-user-active="${CSS.escape(userId)}"]`)?.value !== "false";
  const resultBox = document.getElementById("adminUsersResult");
  try {
    const res = await fetch(`${WEB_APP_URL}?action=user_update&id=${encodeURIComponent(userId)}&role=${encodeURIComponent(role)}&isActive=${encodeURIComponent(isActive)}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || "บันทึกไม่สำเร็จ");
    showResult(resultBox, true, "บันทึกสิทธิ์ผู้ใช้สำเร็จ");
    await loadAdminUsers();
  } catch (error) {
    showResult(resultBox, false, "บันทึกสิทธิ์ผู้ใช้ไม่สำเร็จ: " + (error.message || error));
  }
}

const DEFAULT_MENU_ITEMS = [
  ["dashboard", "ภาพรวม"], ["kpi", "KPI การบันทึกอุณหภูมิ"], ["form", "บันทึกอุณหภูมิ"], ["history", "ดูข้อมูล/Export CSV ย้อนหลัง"], ["chart", "กราฟอุณหภูมิย้อนหลัง"],
  ["incident_all", "ติดตาม Incident"], ["bem_manage", "จัดการสถานะ Incident"], ["incident_timeline", "Timeline Incident"],
  ["fridge_status", "อัปเดตสถานะตู้"], ["alarm_test", "บันทึก Alarm Test"], ["alarm_history", "ประวัติ Alarm Test"],
  ["admin_users", "จัดการผู้ใช้"], ["admin_menus", "ตั้งค่าเมนู"], ["admin_audit", "Audit Log"]
];

async function loadAdminMenuSettings() {
  const box = document.getElementById("adminMenuSettingsBox");
  const resultBox = document.getElementById("adminMenuSettingsResult");
  if (!box) return;
  box.innerHTML = "";
  try {
    const res = await fetch(`${WEB_APP_URL}?action=menu_settings`);
    const data = await res.json();
    const map = Array.isArray(data) ? Object.fromEntries(data.map(x => [x.menuKey, x])) : {};
    DEFAULT_MENU_ITEMS.forEach(([key, label]) => {
      const cfg = map[key] || { isEnabled: true };
      const row = document.createElement("label");
      row.className = "menu-setting-item";
      row.innerHTML = `<input type="checkbox" data-menu-setting="${escapeHtml(key)}" ${cfg.isEnabled !== false ? "checked" : ""}> <span>${escapeHtml(label)}</span>`;
      box.appendChild(row);
    });
    showResult(resultBox, true, "โหลดการตั้งค่าเมนูแล้ว");
  } catch (error) {
    showResult(resultBox, false, "โหลดการตั้งค่าเมนูไม่สำเร็จ: " + (error.message || error));
  }
}

async function saveAdminMenuSettings() {
  const resultBox = document.getElementById("adminMenuSettingsResult");
  const items = Array.from(document.querySelectorAll("[data-menu-setting]")).map(el => ({ menuKey: el.getAttribute("data-menu-setting"), isEnabled: el.checked }));
  try {
    const res = await fetch(`${WEB_APP_URL}?action=menu_settings_save&items=${encodeURIComponent(JSON.stringify(items))}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || "บันทึกไม่สำเร็จ");
    showResult(resultBox, true, "บันทึกการตั้งค่าเมนูสำเร็จ");
    await loadMenuSettingsAndApply();
  } catch (error) {
    showResult(resultBox, false, "บันทึกการตั้งค่าเมนูไม่สำเร็จ: " + (error.message || error));
  }
}

async function loadAuditLogs() {
  const resultBox = document.getElementById("adminAuditResult");
  const tbody = document.getElementById("adminAuditTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  try {
    const res = await fetch(`${WEB_APP_URL}?action=audit_logs`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error(data.message || "โหลด Audit ไม่สำเร็จ");
    data.forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHtml(row.createdAt || "")}</td><td>${escapeHtml(row.email || "")}</td><td>${escapeHtml(row.action || "")}</td><td>${escapeHtml(row.detail || "")}</td>`;
      tbody.appendChild(tr);
    });
    showResult(resultBox, true, `พบ Audit ${data.length} รายการล่าสุด`);
  } catch (error) {
    showResult(resultBox, false, "โหลด Audit ไม่สำเร็จ: " + (error.message || error));
  }
}


/* =========================================================
   V1.8.29 — Dashboard Incident totals aligned with active workflow
   ========================================================= */
function isFinishedIncident(itemOrStatus) {
  const raw = typeof itemOrStatus === "object" ? itemOrStatus?.caseStatus : itemOrStatus;
  const status = String(raw || "").trim().toLowerCase();
  return ["ปิดเคส", "ยกเลิกเคส", "ยกเลิก", "closed", "cancelled", "canceled"].includes(status);
}

function filterIncidentRowsByUiStatus(rows, uiStatusFilter) {
  const list = Array.isArray(rows) ? rows : [];
  return uiStatusFilter === "active" ? list.filter(item => !isFinishedIncident(item)) : list;
}

function backendIncidentStatusFilter(uiStatusFilter) {
  return uiStatusFilter === "active" ? "all" : (uiStatusFilter || "all");
}

/* =========================================================
   V1.8.26 — Simplified Incident UX
   - Incident overview uses cards only
   - BEM selects Incident from cards only
   - Timeline uses cards + timeline only (no duplicate table)
   - Sidebar consolidated to 3 Incident menus
   ========================================================= */

function incidentStatusKeyToTitle(statusKey) {
  return "BEM Inbox";
}

function showBEMStatusPage(statusKey, btn) {
  const dateFilter = document.getElementById("updateIncidentDateFilter");
  const statusFilter = document.getElementById("updateIncidentStatusFilter");
  const title = document.querySelector("#updateIncidentPage .section-title");
  if (dateFilter) dateFilter.value = statusKey === "closed" ? "30days" : "all";
  if (statusFilter) statusFilter.value = statusKey && statusKey !== "all" ? statusKey : "active";
  if (title) title.innerText = "BEM Inbox";
  showPage("updateIncidentPage", btn);
}

async function refreshBEMMenuCounts() {
  try {
    const res = await fetch(`${WEB_APP_URL}?action=incident_all_list&dateFilter=all&statusFilter=all`);
    let data = await res.json();
    data = uniqueIncidentsById(data);
    if (!Array.isArray(data)) return;
    const active = data.filter(x => !["ปิดเคส", "ยกเลิกเคส", "ยกเลิก"].includes(String(x.caseStatus || "").trim())).length;
    const el = document.getElementById("bemCountActive");
    if (el) el.innerText = String(active);
    const mobileEl = document.getElementById("mobileIncidentActiveCount");
    if (mobileEl) mobileEl.innerText = String(active);
  } catch (e) {
    console.warn("refreshBEMMenuCounts failed", e);
  }
}

function clearIncidentTracking() {
  const dateFilter = document.getElementById("incidentDateFilter");
  const statusFilter = document.getElementById("incidentStatusFilter");
  const search = document.getElementById("incidentFridgeSearch");
  const start = document.getElementById("incidentStartDate");
  const end = document.getElementById("incidentEndDate");
  const list = document.getElementById("incidentCardList");
  const resultBox = document.getElementById("incidentResult");
  if (dateFilter) dateFilter.value = "all";
  if (statusFilter) statusFilter.value = "active";
  if (search) search.value = "";
  if (start) start.value = "";
  if (end) end.value = "";
  toggleIncidentCustomDate();
  if (list) list.innerHTML = "";
  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }
}

function incidentTempText(item) {
  return item?.temp === null || item?.temp === undefined || item?.temp === "" ? "-" : `${escapeHtml(item.temp)} °C`;
}

async function openIncidentFromTracking(incidentId) {
  const sidebarButton = document.querySelector('.menu-btn[data-menu-key="bem_manage"]');
  showPage("updateIncidentPage", sidebarButton || null);
  const dateFilter = document.getElementById("updateIncidentDateFilter");
  const statusFilter = document.getElementById("updateIncidentStatusFilter");
  const search = document.getElementById("updateIncidentFridgeSearch");
  if (dateFilter) dateFilter.value = "all";
  if (statusFilter) statusFilter.value = "active";
  if (search) search.value = incidentId || "";
  await loadOpenIncidentList();
  if (incidentId) selectUpdateIncident(incidentId);
  document.getElementById("updateIncidentSummary")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function openTimelineFromTracking(incidentId) {
  const sidebarButton = document.querySelector('.menu-btn[data-menu-key="incident_timeline"]');
  showPage("incidentHistoryPage", sidebarButton || null);
  const dateFilter = document.getElementById("incidentHistoryDateFilter");
  const statusFilter = document.getElementById("incidentHistoryStatusFilter");
  const search = document.getElementById("incidentHistoryFridgeSearch");
  if (dateFilter) dateFilter.value = "all";
  if (statusFilter) statusFilter.value = "all";
  if (search) search.value = incidentId || "";
  await loadIncidentHistoryPage();
  if (incidentId) await selectIncidentHistory(incidentId);
}

async function loadIncidentTracking() {
  const dateFilter = document.getElementById("incidentDateFilter")?.value || "all";
  const statusFilter = document.getElementById("incidentStatusFilter")?.value || "active";
  const backendStatusFilter = backendIncidentStatusFilter(statusFilter);
  const startDate = document.getElementById("incidentStartDate")?.value || "";
  const endDate = document.getElementById("incidentEndDate")?.value || "";
  const fridgeSearch = document.getElementById("incidentFridgeSearch")?.value?.trim() || "";
  const resultBox = document.getElementById("incidentResult");
  const list = document.getElementById("incidentCardList");
  if (!list) return;
  list.innerHTML = "";
  try {
    const url = `${WEB_APP_URL}?action=incident_list&dateFilter=${encodeURIComponent(dateFilter)}&statusFilter=${encodeURIComponent(backendStatusFilter)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&fridgeSearch=${encodeURIComponent(fridgeSearch)}`;
    const response = await fetch(url);
    let data = await response.json();
    data = uniqueIncidentsById(data);
    data = filterIncidentRowsByUiStatus(data, statusFilter);
    if (!Array.isArray(data) || data.length === 0) {
      showResult(resultBox, true, "ไม่พบรายการ Incident");
      return;
    }

    const fragment = document.createDocumentFragment();
    data.forEach(item => {
      const card = document.createElement("article");
      card.className = "incident-overview-card";
      card.innerHTML = `
        <div class="incident-overview-head">
          <div>
            <div class="incident-overview-id">${escapeHtml(item.incidentId || "-")}</div>
            <div class="incident-overview-sub">${escapeHtml(item.foundDate || "-")} ${escapeHtml(item.foundTime || "-")} · รอบ ${escapeHtml(item.round || "-")}</div>
          </div>
          <span class="status-badge ${getIncidentStatusClass(item.caseStatus)}">${escapeHtml(item.caseStatus || "-")}</span>
        </div>
        <div class="incident-overview-grid">
          <div><span>ตู้</span><strong>${escapeHtml(item.fridgeId || "-")}</strong></div>
          <div><span>สถานที่</span><strong>${escapeHtml(item.room || "-")}</strong></div>
          <div><span>อุณหภูมิ</span><strong>${incidentTempText(item)}</strong></div>
          <div><span>เลขงาน BEM</span><strong>${escapeHtml(item.bemJobNo || "ยังไม่ได้กรอก")}</strong></div>
          <div><span>ผู้รายงาน</span><strong>${escapeHtml(staffNameForUI(item.reporter) || "-")}</strong></div>
          <div><span>ผู้รับผิดชอบ</span><strong>${escapeHtml(staffNameForUI(item.owner) || "-")}</strong></div>
        </div>
        <div class="incident-overview-actions">
          <button type="button" class="btn-secondary" onclick='openTimelineFromTracking(${JSON.stringify(item.incidentId || "")})'>ดู Timeline</button>
          <button type="button" class="btn-primary" onclick='openIncidentFromTracking(${JSON.stringify(item.incidentId || "")})'>เปิดจัดการเคส</button>
        </div>`;
      fragment.appendChild(card);
    });
    list.appendChild(fragment);
    showResult(resultBox, true, `พบ ${data.length} รายการ`);
  } catch (error) {
    showResult(resultBox, false, "โหลด Incident ไม่สำเร็จ: " + error);
  }
}

async function loadOpenIncidentList() {
  const select = document.getElementById("updateIncidentSelect");
  const resultBox = document.getElementById("updateIncidentResult");
  const cardList = document.getElementById("updateIncidentCardList");
  if (!select || !cardList) return;

  const loadSeq = ++updateIncidentLoadSeq;
  const dateFilter = document.getElementById("updateIncidentDateFilter")?.value || "all";
  const statusFilter = document.getElementById("updateIncidentStatusFilter")?.value || "active";
  const backendStatusFilter = backendIncidentStatusFilter(statusFilter);
  const startDate = document.getElementById("updateIncidentStartDate")?.value || "";
  const endDate = document.getElementById("updateIncidentEndDate")?.value || "";
  const fridgeSearch = document.getElementById("updateIncidentFridgeSearch")?.value?.trim() || "";

  select.innerHTML = '<option value="">-- เลือก Incident ID --</option>';
  cardList.innerHTML = "";
  updateIncidentListCache = [];

  try {
    const url = `${WEB_APP_URL}?action=incident_list&dateFilter=${encodeURIComponent(dateFilter)}&statusFilter=${encodeURIComponent(backendStatusFilter)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&fridgeSearch=${encodeURIComponent(fridgeSearch)}`;
    const response = await fetch(url);
    let data = await response.json();
    data = uniqueIncidentsById(data);
    data = filterIncidentRowsByUiStatus(data, statusFilter);
    data = v1862SortBemInbox(data);
    v1862RenderBemInboxCounts(data);
    if (loadSeq !== updateIncidentLoadSeq) return;

    if (!Array.isArray(data) || data.length === 0) {
      showResult(resultBox, true, "ไม่พบ Incident ตามตัวกรอง");
      renderUpdateIncidentSummary(null);
      return;
    }

    updateIncidentListCache = data;
    const optionFragment = document.createDocumentFragment();
    const cardFragment = document.createDocumentFragment();
    data.slice(0, 50).forEach(item => {
      const option = document.createElement("option");
      option.value = item.incidentId;
      option.textContent = item.incidentId;
      optionFragment.appendChild(option);

      const card = document.createElement("button");
      card.type = "button";
      card.className = "bem-incident-card";
      card.dataset.incidentId = item.incidentId || "";
      card.onclick = () => selectUpdateIncident(item.incidentId);
      card.innerHTML = `
        <div class="bem-incident-card-head">
          <strong>${escapeHtml(item.incidentId || "-")}</strong>
          <span class="status-badge ${getIncidentStatusClass(item.caseStatus)}">${escapeHtml(item.caseStatus || "-")}</span>
        </div>
        <div class="bem-incident-card-body">
          <div><span>ตู้</span><strong>${escapeHtml(item.fridgeId || "-")}</strong></div>
          <div><span>สถานที่</span><strong>${escapeHtml(item.room || "-")}</strong></div>
          <div><span>วันเวลา</span><strong>${escapeHtml(item.foundDate || "-")} ${escapeHtml(item.foundTime || "-")}</strong></div>
          <div><span>เลขงาน BEM</span><strong>${escapeHtml(item.bemJobNo || "ยังไม่ได้กรอก")}</strong></div>
        </div>
        <div class="bem-card-select-label">เลือกเคสนี้</div>`;
      cardFragment.appendChild(card);
    });
    select.appendChild(optionFragment);
    cardList.appendChild(cardFragment);
    showResult(resultBox, true, `พบ ${data.length} เคสที่ยังไม่ปิด • เลือกการ์ดเพื่ออัปเดต`);
  } catch (error) {
    if (loadSeq !== updateIncidentLoadSeq) return;
    showResult(resultBox, false, "โหลด Incident ไม่สำเร็จ: " + error);
  }
}

function selectUpdateIncident(incidentId) {
  const select = document.getElementById("updateIncidentSelect");
  const input = document.getElementById("updateIncidentId");
  if (select && incidentId) select.value = incidentId;
  if (input) input.value = incidentId || "";
  const item = updateIncidentListCache.find(x => x.incidentId === incidentId) || null;
  const bemJobNo = document.getElementById("updateBEMJobNo");
  if (bemJobNo) bemJobNo.value = item?.bemJobNo || "";
  const resendBtn = document.getElementById("resendSelectedIncidentBtn");
  if (resendBtn) resendBtn.disabled = !incidentId || !canResendIncidentStatus(item?.caseStatus);
  document.querySelectorAll("#updateIncidentCardList .bem-incident-card").forEach(card => {
    card.classList.toggle("selected", card.dataset.incidentId === incidentId);
  });
  resetBEMStatusSelection();
  setCurrentIncidentStatusLabel(item?.caseStatus || "");
  renderUpdateIncidentSummary(item);
}

function clearUpdateIncidentFilter() {
  const date = document.getElementById("updateIncidentDateFilter");
  const status = document.getElementById("updateIncidentStatusFilter");
  const search = document.getElementById("updateIncidentFridgeSearch");
  const start = document.getElementById("updateIncidentStartDate");
  const end = document.getElementById("updateIncidentEndDate");
  if (date) date.value = "all";
  if (status) status.value = "active";
  if (search) search.value = "";
  if (start) start.value = "";
  if (end) end.value = "";
  toggleUpdateIncidentCustomDate();
  loadOpenIncidentList();
}

async function loadIncidentHistoryPage() {
  const select = document.getElementById("incidentHistorySelect");
  const resultBox = document.getElementById("incidentHistoryResult");
  const cardList = document.getElementById("incidentHistoryCardList");
  const timeline = document.getElementById("incidentTimeline");
  const selectedLabel = document.getElementById("timelineSelectedIncident");
  if (!select || !cardList) return;

  const dateFilter = document.getElementById("incidentHistoryDateFilter")?.value || "all";
  const statusFilter = document.getElementById("incidentHistoryStatusFilter")?.value || "all";
  const startDate = document.getElementById("incidentHistoryStartDate")?.value || "";
  const endDate = document.getElementById("incidentHistoryEndDate")?.value || "";
  const fridgeSearch = document.getElementById("incidentHistoryFridgeSearch")?.value?.trim() || "";

  select.innerHTML = '<option value="">-- เลือก Incident ID --</option>';
  cardList.innerHTML = "";
  if (timeline) timeline.innerHTML = "";
  if (selectedLabel) selectedLabel.innerHTML = "";
  incidentHistoryListCache = [];

  try {
    const url = `${WEB_APP_URL}?action=incident_all_list&dateFilter=${encodeURIComponent(dateFilter)}&statusFilter=${encodeURIComponent(statusFilter)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&fridgeSearch=${encodeURIComponent(fridgeSearch)}`;
    const response = await fetch(url);
    let data = await response.json();
    data = v1857PrioritizeOpenTimelineIncidents(uniqueIncidentsById(data));
    if (!Array.isArray(data) || data.length === 0) {
      showResult(resultBox, true, "ไม่พบ Incident ตามตัวกรอง");
      return;
    }

    incidentHistoryListCache = data;
    const options = document.createDocumentFragment();
    const cards = document.createDocumentFragment();
    data.slice(0, 50).forEach(item => {
      const option = document.createElement("option");
      option.value = item.incidentId;
      option.textContent = item.incidentId;
      options.appendChild(option);

      const card = document.createElement("button");
      card.type = "button";
      card.className = "timeline-incident-card";
      card.dataset.incidentId = item.incidentId || "";
      card.onclick = () => selectIncidentHistory(item.incidentId);
      card.innerHTML = `
        <div class="timeline-card-main">
          <strong>${escapeHtml(item.incidentId || "-")}</strong>
          <span>${escapeHtml(item.fridgeId || "-")} · ${escapeHtml(item.room || "-")}</span>
          <small>${escapeHtml(item.foundDate || "-")} ${escapeHtml(item.foundTime || "-")}</small>
        </div>
        <span class="status-badge ${getIncidentStatusClass(item.caseStatus)}">${escapeHtml(item.caseStatus || "-")}</span>`;
      cards.appendChild(card);
    });
    select.appendChild(options);
    cardList.appendChild(cards);
    const activeTimelineCount = data.filter(item => !isFinishedIncident(item)).length;
    const finishedTimelineCount = data.length - activeTimelineCount;
    showResult(
      resultBox,
      true,
      statusFilter === "all"
        ? `พบ ${data.length} Incident • ยังไม่ปิด ${activeTimelineCount} เคส (แสดงก่อน) • ปิด/ยกเลิก ${finishedTimelineCount} เคส`
        : `พบ ${data.length} Incident เลือกจากการ์ดเพื่อดู Timeline`
    );
    if (data.length === 1) await selectIncidentHistory(data[0].incidentId);
  } catch (error) {
    showResult(resultBox, false, "โหลดรายการ Incident ไม่สำเร็จ: " + error);
  }
}

async function selectIncidentHistory(incidentId) {
  const select = document.getElementById("incidentHistorySelect");
  if (select) select.value = incidentId || "";
  document.querySelectorAll("#incidentHistoryCardList .timeline-incident-card").forEach(card => {
    card.classList.toggle("selected", card.dataset.incidentId === incidentId);
  });
  await loadIncidentHistory(incidentId);
}

async function loadIncidentHistory(explicitIncidentId) {
  const incidentId = explicitIncidentId || document.getElementById("incidentHistorySelect")?.value || "";
  const resultBox = document.getElementById("incidentHistoryResult");
  const timeline = document.getElementById("incidentTimeline");
  const selectedLabel = document.getElementById("timelineSelectedIncident");
  if (!incidentId) {
    showResult(resultBox, false, "กรุณาเลือก Incident จากการ์ด");
    return;
  }
  if (timeline) timeline.innerHTML = "";
  if (selectedLabel) selectedLabel.innerHTML = `กำลังแสดง: <strong>${escapeHtml(incidentId)}</strong>`;

  try {
    const response = await fetch(`${WEB_APP_URL}?action=incident_history&incidentId=${encodeURIComponent(incidentId)}`);
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      showResult(resultBox, true, "ไม่พบประวัติการอัปเดต");
      return;
    }
    showResult(resultBox, true, `พบ ${data.length} เหตุการณ์`);
    const fragment = document.createDocumentFragment();
    data.forEach(item => {
      const div = document.createElement("article");
      div.className = "timeline-item";
      div.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-time">${escapeHtml(item.updatedAt || "-")}</div>
        <div class="timeline-status"><span class="status-badge ${getIncidentStatusClass(item.caseStatus)}">${escapeHtml(item.caseStatus || "-")}</span></div>
        <div class="timeline-body">
          <div><strong>ผู้ดำเนินการ</strong><span>${escapeHtml(staffNameForUI(item.owner) || "-")}</span></div>
          <div><strong>การดำเนินการ</strong><span>${escapeHtml(item.actionText || "-")}</span></div>
          <div><strong>ผลการแก้ไข</strong><span>${escapeHtml(item.fixResult || "-")}</span></div>
          <div><strong>ผู้อัปเดต</strong><span>${escapeHtml(staffNameForUI(item.updatedBy) || "-")}</span></div>
        </div>`;
      fragment.appendChild(div);
    });
    if (timeline) timeline.appendChild(fragment);
  } catch (error) {
    showResult(resultBox, false, "โหลดประวัติการอัปเดตไม่สำเร็จ: " + error);
  }
}

function clearIncidentHistory() {
  const date = document.getElementById("incidentHistoryDateFilter");
  const status = document.getElementById("incidentHistoryStatusFilter");
  const search = document.getElementById("incidentHistoryFridgeSearch");
  const start = document.getElementById("incidentHistoryStartDate");
  const end = document.getElementById("incidentHistoryEndDate");
  const list = document.getElementById("incidentHistoryCardList");
  const timeline = document.getElementById("incidentTimeline");
  const selectedLabel = document.getElementById("timelineSelectedIncident");
  if (date) date.value = "all";
  if (status) status.value = "all";
  if (search) search.value = "";
  if (start) start.value = "";
  if (end) end.value = "";
  toggleIncidentHistoryCustomDate();
  if (list) list.innerHTML = "";
  if (timeline) timeline.innerHTML = "";
  if (selectedLabel) selectedLabel.innerHTML = "";
  const select = document.getElementById("incidentHistorySelect");
  if (select) select.innerHTML = '<option value="">-- เลือก Incident ID --</option>';
  const resultBox = document.getElementById("incidentHistoryResult");
  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }
}

let pendingPwaLaunchUrl = '';
let mainAppInitializedForDeepLink = false;

function parseCnmiDeepLink(targetUrl) {
  let url;
  try {
    url = targetUrl instanceof URL
      ? targetUrl
      : new URL(String(targetUrl || window.location.href), window.location.origin);
  } catch (error) {
    url = new URL(window.location.href);
  }

  const params = url.searchParams;
  let page = String(params.get('page') || '').trim();
  let incidentId = String(params.get('incidentId') || params.get('incident') || '').trim();

  // รองรับลิงก์รูปแบบ hash เช่น #/incident/INC-xxxx
  const hashMatch = String(url.hash || '').match(/(?:incident|bem)[\/=]?(INC-[A-Za-z0-9-]+)/i);
  if (!incidentId && hashMatch) incidentId = hashMatch[1];
  if (!page && incidentId) page = 'updateIncident';

  return {
    url,
    page,
    incidentId,
    source: String(params.get('source') || '').trim(),
    date: String(params.get('date') || '').trim(),
    round: String(params.get('round') || '').trim(),
    fridgeId: String(params.get('fridgeId') || '').trim()
  };
}

async function openIncidentDeepLink(deepLink) {
  const incidentId = deepLink.incidentId;
  const updateBtn = document.querySelector('.menu-btn[data-menu-key="bem_manage"]');
  showPage('updateIncidentPage', updateBtn || null);
  setMobileNavActive(document.querySelector('.mobile-nav-item[data-mobile-page="incidentHubPage"]'));

  const dateFilter = document.getElementById('updateIncidentDateFilter');
  const statusFilter = document.getElementById('updateIncidentStatusFilter');
  const search = document.getElementById('updateIncidentFridgeSearch');
  if (dateFilter) dateFilter.value = 'all';
  // ลิงก์ตรงต้องค้นได้แม้สถานะของเคสเปลี่ยนไปแล้ว
  if (statusFilter) statusFilter.value = 'all';
  if (search) search.value = incidentId || '';

  const resultBox = document.getElementById('updateIncidentResult');
  try {
    await loadOpenIncidentList();
    if (incidentId) selectUpdateIncident(incidentId);
    showResult(resultBox, true, `เปิด Incident ${incidentId} จาก Google Chat แล้ว`);
    setTimeout(() => {
      const selected = document.querySelector('#updateIncidentCardList .bem-incident-card.selected')
        || document.getElementById('updateIncidentSummary')
        || document.getElementById('updateIncidentPage');
      if (selected) selected.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 180);
  } catch (error) {
    const input = document.getElementById('updateIncidentId');
    if (input) input.value = incidentId;
    showResult(resultBox, false, 'เปิด Incident จากลิงก์ไม่สำเร็จ: ' + error);
  }
}

async function openTemperatureFormDeepLink(deepLink) {
  const formBtn = document.querySelector('.menu-btn[data-menu-key="form"]');
  showPage('formPage', formBtn || null);
  setMobileNavActive(document.querySelector('.mobile-nav-item[data-mobile-page="formPage"]'));

  const dateEl = document.getElementById('date');
  const roundEl = document.getElementById('round');
  if (dateEl && deepLink.date) dateEl.value = deepLink.date;

  if (deepLink.fridgeId) {
    try {
      await applyScannedFridgeToForm(deepLink.fridgeId);
    } catch (error) {
      console.warn('Apply fridge from deep link failed:', error);
      const fridgeIdEl = document.getElementById('fridgeId');
      if (fridgeIdEl) fridgeIdEl.value = deepLink.fridgeId;
    }
  }

  if (roundEl && deepLink.round) {
    roundEl.value = deepLink.round;
    setTimeByRound();
  }
  validateForm();

  setTimeout(() => {
    const form = document.getElementById('formPage');
    if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 120);
}

async function handleAppDeepLink(targetUrl) {
  const deepLink = parseCnmiDeepLink(targetUrl);
  const page = deepLink.page.toLowerCase();

  if (page === 'notifications' || page === 'notification' || page === 'push') {
    const notificationBtn = document.querySelector('.menu-btn[data-menu-key="notifications"]');
    showPage('notificationPage', notificationBtn || null);
    await loadPushNotificationPage();
    return true;
  }

  if ((page === 'updateincident' || page === 'bemincident') && deepLink.incidentId) {
    await openIncidentDeepLink(deepLink);
    return true;
  }

  if (page === 'recordtemperature' || page === 'form' || page === 'temperature') {
    await openTemperatureFormDeepLink(deepLink);
    return true;
  }

  if (page === 'incident' || page === 'incidenthub') {
    const bemBtn = document.querySelector('.menu-btn[data-menu-key="bem_manage"]');
    showBEMStatusPage('all', bemBtn || null);
    await loadOpenIncidentList();
    return true;
  }

  if (page === 'dashboard' && deepLink.date) {
    const dashboardBtn = document.querySelector('.menu-btn[data-menu-key="dashboard"]');
    showPage('dashboardPage', dashboardBtn || null);
    const dashboardDate = document.getElementById('dashboardDate');
    if (dashboardDate) dashboardDate.value = deepLink.date;
    await loadDashboard();
    return true;
  }

  return false;
}

async function handleIncidentDeepLink() {
  mainAppInitializedForDeepLink = true;
  const target = pendingPwaLaunchUrl || window.location.href;
  pendingPwaLaunchUrl = '';
  return handleAppDeepLink(target);
}

// Chrome/Edge PWA: เมื่อลิงก์ถูกส่งเข้าหน้าต่างแอปเดิม ให้เปลี่ยนหน้าไปยัง
// Incident ที่ระบุทันที โดยไม่ต้องเปิด PWA ซ้ำอีกหน้าต่าง
if ('launchQueue' in window && window.launchQueue && typeof window.launchQueue.setConsumer === 'function') {
  window.launchQueue.setConsumer(async (launchParams) => {
    const targetUrl = launchParams && launchParams.targetURL ? launchParams.targetURL : window.location.href;
    if (!mainAppInitializedForDeepLink) {
      pendingPwaLaunchUrl = targetUrl;
      return;
    }
    try {
      const target = new URL(targetUrl, window.location.origin);
      window.history.replaceState({}, '', target.pathname + target.search + target.hash);
      await handleAppDeepLink(target);
    } catch (error) {
      console.error('PWA launch deep link error:', error);
    }
  });
}


/* ===== V1.8.48 KPI compact view + fridge x round weighting + chart refresh ===== */
function kpiSummaryNumber(summary, explicitKey, compatKey) {
  const value = summary?.[explicitKey];
  return Number(value ?? summary?.[compatKey] ?? 0);
}

function shiftKpiMonth(monthValue, delta) {
  const match = String(monthValue || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return KPI_TREND_START_MONTH;
  const d = new Date(Number(match[1]), Number(match[2]) - 1 + Number(delta || 0), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function clampKpiMonth(value) {
  const current = getTodayYMD().slice(0, 7);
  let out = /^\d{4}-\d{2}$/.test(String(value || '')) ? String(value) : current;
  if (out < KPI_TREND_START_MONTH) out = KPI_TREND_START_MONTH;
  if (out > current) out = current;
  return out;
}

function updateKpiViewModeUI() {
  const metric = getSelectedKpiMetric();
  const isTemperature = metric === 'temperature_completeness';
  const controls = document.getElementById('kpiTemperatureViewControls');
  const monthBox = document.getElementById('kpiSingleMonthFilter');
  const historyBox = document.getElementById('kpiHistoryRangeFilter');
  const monthBtn = document.getElementById('kpiViewMonthBtn');
  const historyBtn = document.getElementById('kpiViewHistoryBtn');
  if (controls) controls.classList.toggle('hidden', !isTemperature);
  if (!isTemperature) kpiViewMode = 'month';
  if (monthBox) monthBox.classList.toggle('hidden', isTemperature && kpiViewMode === 'history');
  if (historyBox) historyBox.classList.toggle('hidden', !isTemperature || kpiViewMode !== 'history');
  monthBtn?.classList.toggle('active', kpiViewMode === 'month');
  historyBtn?.classList.toggle('active', kpiViewMode === 'history');
  toggleKpiHistoryCustomRange();
}

function setKpiViewMode(mode) {
  if (!['month', 'history'].includes(mode)) return;
  kpiViewMode = mode;
  cancelKpiRequest();
  resetKpiResultCards();
  updateKpiViewModeUI();
  if (mode === 'history') {
    const end = document.getElementById('kpiHistoryEndMonth');
    if (end && !end.value) end.value = getTodayYMD().slice(0, 7);
    const start = document.getElementById('kpiHistoryStartMonth');
    if (start && !start.value) start.value = KPI_TREND_START_MONTH;
    showResult(document.getElementById('kpiResult'), true, 'เลือกช่วงย้อนหลังและแผนก แล้วกด “แสดงผล”');
  } else {
    showResult(document.getElementById('kpiResult'), true, 'เลือกเดือนและแผนก แล้วกด “แสดงผล”');
  }
  setKpiShowButtonState();
}

function toggleKpiHistoryCustomRange() {
  const preset = document.getElementById('kpiHistoryPreset')?.value || 'all';
  document.getElementById('kpiHistoryStartBox')?.classList.toggle('hidden', preset !== 'custom');
}

function onKpiHistoryPresetChanged() {
  toggleKpiHistoryCustomRange();
  cancelKpiRequest();
  resetKpiResultCards();
  setKpiShowButtonState();
  showResult(document.getElementById('kpiResult'), true, 'เปลี่ยนช่วงย้อนหลังแล้ว กรุณากด “แสดงผล”');
}

function onKpiHistoryRangeChanged() {
  cancelKpiRequest();
  resetKpiResultCards();
  setKpiShowButtonState();
  showResult(document.getElementById('kpiResult'), true, 'เปลี่ยนช่วงย้อนหลังแล้ว กรุณากด “แสดงผล”');
}

function getKpiHistoryRange() {
  const current = getTodayYMD().slice(0, 7);
  const preset = document.getElementById('kpiHistoryPreset')?.value || 'all';
  let end = clampKpiMonth(document.getElementById('kpiHistoryEndMonth')?.value || current);
  let start = KPI_TREND_START_MONTH;
  if (preset === 'custom') {
    start = clampKpiMonth(document.getElementById('kpiHistoryStartMonth')?.value || KPI_TREND_START_MONTH);
  } else if (/^\d+$/.test(preset)) {
    start = shiftKpiMonth(end, -(Math.max(1, Number(preset)) - 1));
    if (start < KPI_TREND_START_MONTH) start = KPI_TREND_START_MONTH;
  }
  if (start > end) [start, end] = [end, start];
  return { start, end, preset };
}

function setKpiTrendTab(tab) {
  if (!['overview', 'charts', 'table'].includes(tab)) return;
  kpiTrendTab = tab;
  ['overview', 'charts', 'table'].forEach(name => {
    const cap = name.charAt(0).toUpperCase() + name.slice(1);
    document.getElementById(`kpiTrendTab${cap}`)?.classList.toggle('active', name === tab);
    document.getElementById(`kpiTrendPanel${cap}`)?.classList.toggle('hidden', name !== tab);
  });
  if (tab === 'charts') {
    requestAnimationFrame(() => {
      try { kpiTrendChart?.resize(); } catch (e) {}
      try { kpiMissingTrendChart?.resize(); } catch (e) {}
    });
  }
}

function filterKpiTrendDataForDepartment(data, department) {
  if (!data || department === KPI_ALL_DEPARTMENTS_VALUE || !department) return data;
  const months = (data.months || []).map(item => {
    const row = (item.departments || []).find(x => String(x.department || '') === department) || {
      department, totalRounds: 0, completeRounds: 0, incompleteRounds: 0, totalItems: 0, completeItems: 0, incompleteItems: 0, percentage: 0, fridgeCount: 0, exemptRecordCount: 0
    };
    return { month: item.month, combined: { ...row }, departments: [{ ...row }] };
  });
  const deptSummary = (data.departmentSummary || []).find(x => String(x.department || '') === department) || { department, totalRounds: 0, completeRounds: 0, incompleteRounds: 0, percentage: 0, fridgeCount: 0 };
  return { ...data, departments: [department], months, departmentSummary: [deptSummary], rangeSummary: { ...deptSummary } };
}

function setKpiMetricVisibility(metric = getSelectedKpiMetric()) {
  const autoFilter = document.getElementById('kpiAutoFilterPanel');
  const temperatureOutput = document.getElementById('kpiTemperatureOutput');
  const metricOutput = document.getElementById('kpiMetricOutput');
  const manualOutput = document.getElementById('kpiManualSearchOutput');
  const definitionTitle = document.getElementById('kpiMetricTitle');
  const isManual = metric === 'search_time';
  const isTemperature = metric === 'temperature_completeness';
  if (autoFilter) autoFilter.classList.toggle('hidden', isManual);
  if (temperatureOutput) temperatureOutput.classList.toggle('hidden', true);
  if (metricOutput) metricOutput.classList.add('hidden');
  if (manualOutput) manualOutput.classList.toggle('hidden', !isManual);
  if (definitionTitle) definitionTitle.innerText = KPI_METRIC_DEFINITIONS[metric]?.title || '-';
  updateKpiMetricDefinition(metric);
  updateKpiViewModeUI();
  if (isManual) loadKpiSearchInputs();
  if (!isTemperature) resetKpiTrendOutput();
  setKpiShowButtonState();
}

function setKpiShowButtonState() {
  const button = document.getElementById('kpiShowButton');
  const metric = getSelectedKpiMetric();
  const department = document.getElementById('kpiDepartment')?.value || '';
  let ready = metric !== 'search_time' && !!department;
  if (metric === 'temperature_completeness' && kpiViewMode === 'history') {
    const range = getKpiHistoryRange();
    ready = ready && !!range.start && !!range.end && range.start <= range.end;
  }
  if (button) {
    button.classList.toggle('hidden', metric === 'search_time');
    button.disabled = !ready;
  }
}

function clearKpiFilters() {
  if (getSelectedKpiMetric() === 'search_time') { clearKpiSearchInputs(); return; }
  const current = getTodayYMD().slice(0, 7);
  const month = document.getElementById('kpiMonth');
  const department = document.getElementById('kpiDepartment');
  const hEnd = document.getElementById('kpiHistoryEndMonth');
  const hStart = document.getElementById('kpiHistoryStartMonth');
  const preset = document.getElementById('kpiHistoryPreset');
  if (month) month.value = current;
  if (hEnd) hEnd.value = current;
  if (hStart) hStart.value = KPI_TREND_START_MONTH;
  if (preset) preset.value = 'all';
  if (department) department.value = getSelectedKpiMetric() === 'temperature_completeness' ? KPI_ALL_DEPARTMENTS_VALUE : '';
  resetKpiResultCards();
  updateKpiViewModeUI();
  setKpiShowButtonState();
  showResult(document.getElementById('kpiResult'), true, kpiViewMode === 'history' ? 'เลือกช่วงย้อนหลังและแผนก แล้วกด “แสดงผล”' : 'เลือกเดือนและแผนก แล้วกด “แสดงผล”');
}

async function initKpiPage() {
  const currentMonth = getTodayYMD().slice(0, 7);
  const month = document.getElementById('kpiMonth');
  const hStart = document.getElementById('kpiHistoryStartMonth');
  const hEnd = document.getElementById('kpiHistoryEndMonth');
  [month, hStart, hEnd].forEach(el => { if (el) { el.min = KPI_TREND_START_MONTH; el.max = currentMonth; } });
  if (month && (!month.value || month.value < KPI_TREND_START_MONTH || month.value > currentMonth)) month.value = currentMonth;
  if (hStart && !hStart.value) hStart.value = KPI_TREND_START_MONTH;
  if (hEnd && !hEnd.value) hEnd.value = currentMonth;
  const selector = document.getElementById('kpiMetricSelector');
  if (selector) {
    selector.value = KPI_METRIC_DEFINITIONS[selectedKpiMetric] ? selectedKpiMetric : 'temperature_completeness';
    selectedKpiMetric = selector.value;
  }
  resetKpiResultCards();
  setKpiMetricVisibility(selectedKpiMetric);
  if (selectedKpiMetric !== 'search_time') await loadKpiDepartmentList(false);
}

function onKpiMonthChanged() {
  cancelKpiRequest(); resetKpiResultCards(); setKpiShowButtonState();
  showResult(document.getElementById('kpiResult'), true, 'เปลี่ยนเดือนแล้ว กรุณากด “แสดงผล” เพื่อคำนวณใหม่');
}

function onKpiDepartmentChanged() {
  cancelKpiRequest();
  setKpiOutputVisible(false); resetKpiMetricOutput(); resetKpiTrendOutput(); setKpiShowButtonState();
  const selected = document.getElementById('kpiDepartment')?.value || '';
  showResult(document.getElementById('kpiResult'), true, selected ? `เลือก ${selected === KPI_ALL_DEPARTMENTS_VALUE ? 'รวมทุกแผนก' : selected} แล้ว กรุณากด “แสดงผล”` : 'กรุณาเลือกแผนกก่อน');
}

function renderKpiDepartments(rows) {
  const container = document.getElementById('kpiDepartmentCards');
  if (!container) return;
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) { container.innerHTML = '<div class="empty-friendly-card">ยังไม่มีข้อมูลแผนกในเดือนที่เลือก</div>'; return; }
  container.innerHTML = list.map(row => {
    const percent = Number(row.percentage || 0);
    const total = kpiSummaryNumber(row, 'totalItems', 'totalRounds');
    const complete = kpiSummaryNumber(row, 'completeItems', 'completeRounds');
    const missing = kpiSummaryNumber(row, 'incompleteItems', 'incompleteRounds');
    const fridgeCount = Number(row.fridgeCount || 0);
    return `<article class="kpi-department-card">
      <div class="kpi-department-head"><div>
        <div class="kpi-department-name">${escapeHtml(row.department || '-')}</div>
        <div class="kpi-department-meta">${fridgeCount ? `${fridgeCount} ตู้ • ` : ''}ต้องบันทึก ${total.toLocaleString('th-TH')} รายการ • ยกเว้น ${Number(row.exemptRecordCount || 0).toLocaleString('th-TH')} รายการ</div>
      </div><div class="kpi-percent-badge ${getKpiTargetClass(percent, 100)}">${percent.toFixed(2)}%</div></div>
      <div class="kpi-progress"><span style="width:${Math.max(0, Math.min(100, percent))}%"></span></div>
      <div class="kpi-department-stats">
        <div><span>บันทึกครบ</span><strong>${complete.toLocaleString('th-TH')}</strong></div>
        <div><span>บันทึกไม่ครบ</span><strong>${missing.toLocaleString('th-TH')}</strong></div>
        <div><span>หน่วย KPI</span><strong class="kpi-unit-value">ตู้ × รอบ</strong></div>
      </div></article>`;
  }).join('');
}

function renderKpiTrendDepartmentSummary(rows) {
  const container = document.getElementById('kpiTrendDepartmentSummary');
  if (!container) return;
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) { container.innerHTML = '<div class="empty-friendly-card">ยังไม่มีข้อมูลรายแผนกในช่วงนี้</div>'; return; }
  container.innerHTML = list.map(row => {
    const percent = Number(row.percentage || 0);
    const total = kpiSummaryNumber(row, 'totalItems', 'totalRounds');
    const missing = kpiSummaryNumber(row, 'incompleteItems', 'incompleteRounds');
    const fridgeCount = Number(row.fridgeCount || 0);
    return `<article class="kpi-department-card kpi-trend-department-card"><div class="kpi-department-head"><div>
      <div class="kpi-department-name">${escapeHtml(row.department || '-')}</div>
      <div class="kpi-department-meta">${fridgeCount ? `${fridgeCount} ตู้ • ` : ''}ประเมิน ${total.toLocaleString('th-TH')} รายการ • ขาด ${missing.toLocaleString('th-TH')} รายการ</div>
      </div><div class="kpi-percent-badge ${getKpiTargetClass(percent, 100)}">${percent.toFixed(2)}%</div></div>
      <div class="kpi-progress"><span style="width:${Math.max(0, Math.min(100, percent))}%"></span></div></article>`;
  }).join('');
}

function renderKpiTrendTable(data) {
  const head = document.getElementById('kpiTrendTableHead');
  const body = document.getElementById('kpiTrendTableBody');
  if (!head || !body) return;
  const departments = Array.isArray(data?.departments) ? data.departments : [];
  const months = Array.isArray(data?.months) ? data.months : [];
  head.innerHTML = `<tr><th>เดือน</th><th>รวมทุกแผนก</th>${departments.map(name => `<th>${escapeHtml(name)}</th>`).join('')}<th>ขาดรวม</th></tr>`;
  if (!months.length) { body.innerHTML = '<tr><td colspan="99">ยังไม่มีข้อมูลในช่วงที่เลือก</td></tr>'; return; }
  body.innerHTML = months.map(item => {
    const byDept = new Map((item.departments || []).map(row => [String(row.department || ''), row]));
    const combinedMissing = kpiSummaryNumber(item.combined, 'incompleteItems', 'incompleteRounds');
    return `<tr><td><strong>${escapeHtml(formatKpiMonthLabel(item.month))}</strong></td>
      <td>${Number(item.combined?.percentage || 0).toFixed(2)}% <span class="kpi-table-sub">(ขาด ${combinedMissing.toLocaleString('th-TH')} รายการ)</span></td>
      ${departments.map(name => { const row = byDept.get(name) || {}; const missing = kpiSummaryNumber(row, 'incompleteItems', 'incompleteRounds'); return `<td>${Number(row.percentage || 0).toFixed(2)}% <span class="kpi-table-sub">(ขาด ${missing.toLocaleString('th-TH')})</span></td>`; }).join('')}
      <td>${combinedMissing.toLocaleString('th-TH')}</td></tr>`;
  }).join('');
}

function renderKpiTrendCharts(data) {
  destroyKpiTrendCharts();
  if (typeof Chart === 'undefined') return;
  const months = Array.isArray(data?.months) ? data.months : [];
  const departments = Array.isArray(data?.departments) ? data.departments : [];
  if (!months.length) return;
  const labels = months.map(item => formatKpiMonthLabel(item.month));
  const palette = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#dc2626'];
  const lineCanvas = document.getElementById('kpiTrendChart');
  if (lineCanvas) {
    const datasets = [
      { label:'เป้าหมาย 100%', data:months.map(()=>100), borderColor:'#94a3b8', backgroundColor:'#94a3b8', borderWidth:1.5, borderDash:[6,5], pointRadius:0, pointHoverRadius:0, tension:0, fill:false },
      { label:'รวมทุกแผนก', data:months.map(item=>Number(item.combined?.percentage||0)), borderColor:'#172554', backgroundColor:'#172554', borderWidth:3.5, pointRadius:4, pointHoverRadius:7, pointBorderWidth:2, pointBackgroundColor:'#fff', pointBorderColor:'#172554', tension:0.18, fill:false }
    ];
    departments.forEach((department,index)=>datasets.push({ label:department, data:months.map(item=>Number((item.departments||[]).find(x=>String(x.department||'')===department)?.percentage||0)), borderColor:palette[index%palette.length], backgroundColor:palette[index%palette.length], borderWidth:2.4, pointRadius:3.5, pointHoverRadius:6, tension:0.18, fill:false }));
    kpiTrendChart = new Chart(lineCanvas.getContext('2d'), { type:'line', data:{labels,datasets}, options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}, layout:{padding:{top:8,right:8,bottom:0,left:2}}, scales:{ x:{grid:{display:false},ticks:{maxRotation:0,color:'#64748b'}}, y:{min:0,max:100,grid:{color:'rgba(148,163,184,.18)'},ticks:{callback:v=>`${v}%`,color:'#64748b'}} }, plugins:{ legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8,padding:18}}, tooltip:{backgroundColor:'rgba(15,23,42,.94)',padding:12,callbacks:{label:ctx=>`${ctx.dataset.label}: ${Number(ctx.parsed.y||0).toFixed(2)}%`}} } } });
  }
  const missingCanvas = document.getElementById('kpiMissingTrendChart');
  if (missingCanvas) {
    const datasets = departments.map((department,index)=>({label:department,data:months.map(item=>kpiSummaryNumber((item.departments||[]).find(x=>String(x.department||'')===department)||{},'incompleteItems','incompleteRounds')),backgroundColor:palette[index%palette.length],borderRadius:7,borderSkipped:false,stack:'missing'}));
    kpiMissingTrendChart = new Chart(missingCanvas.getContext('2d'), {type:'bar',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},layout:{padding:{top:8,right:8}},scales:{x:{stacked:true,grid:{display:false},ticks:{maxRotation:0,color:'#64748b'}},y:{stacked:true,beginAtZero:true,grid:{color:'rgba(148,163,184,.18)'},ticks:{precision:0,color:'#64748b'}}},plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8,padding:18}},tooltip:{backgroundColor:'rgba(15,23,42,.94)',padding:12,callbacks:{label:ctx=>`${ctx.dataset.label}: ${Number(ctx.parsed.y||0).toLocaleString('th-TH')} รายการ`}}}}});
  }
}

function renderKpiTrendData(data) {
  lastKpiTrendData = data || null;
  const section = document.getElementById('kpiTrendSection');
  if (!section) return;
  section.classList.remove('hidden');
  const summary = data?.rangeSummary || {};
  setKpiText('kpiTrendTotalRounds', kpiSummaryNumber(summary,'totalItems','totalRounds').toLocaleString('th-TH'));
  setKpiText('kpiTrendCompleteRounds', kpiSummaryNumber(summary,'completeItems','completeRounds').toLocaleString('th-TH'));
  setKpiText('kpiTrendIncompleteRounds', kpiSummaryNumber(summary,'incompleteItems','incompleteRounds').toLocaleString('th-TH'));
  setKpiText('kpiTrendPercentage', `${Number(summary.percentage || 0).toFixed(2)}%`);
  const period = document.getElementById('kpiTrendPeriod');
  if (period) period.innerText = `${formatKpiMonthLabel(data?.startMonth || KPI_TREND_START_MONTH)} – ${formatKpiMonthLabel(data?.endMonth || getTodayYMD().slice(0,7))}`;
  const status = document.getElementById('kpiTrendStatus');
  if (status) status.innerText = `${Number(data?.departments?.length||0)} แผนก • ${Number(data?.months?.length||0)} เดือน`;
  renderKpiTrendDepartmentSummary(data?.departmentSummary || []);
  renderKpiTrendTable(data);
  setKpiTrendTab(kpiTrendTab || 'charts');
  requestAnimationFrame(()=>renderKpiTrendCharts(data));
}

function renderKpiAllDepartmentsCurrent(trendData, month) {
  const monthRow = (trendData?.months || []).find(item=>String(item.month||'')===month) || null;
  const summary = monthRow?.combined || {};
  setKpiText('kpiTotalRounds', kpiSummaryNumber(summary,'totalItems','totalRounds').toLocaleString('th-TH'));
  setKpiText('kpiCompleteRounds', kpiSummaryNumber(summary,'completeItems','completeRounds').toLocaleString('th-TH'));
  setKpiText('kpiIncompleteRounds', kpiSummaryNumber(summary,'incompleteItems','incompleteRounds').toLocaleString('th-TH'));
  setKpiText('kpiPercentage', `${Number(summary.percentage || 0).toFixed(2)}%`);
  renderKpiDepartments(monthRow?.departments || []);
  const missing = document.getElementById('kpiMissingList');
  if (missing) missing.innerHTML = '<div class="empty-friendly-card">ภาพรวมทุกแผนกคำนวณตามจำนวนรายการจริง (ตู้ × รอบ) หากต้องการดูว่า “วันไหน รอบไหน ตู้ไหนขาด” ให้เลือกแผนกใดแผนกหนึ่งด้านบน</div>';
  setKpiOutputVisible(true);
}

async function loadTemperatureKpiPage() {
  const resultBox = document.getElementById('kpiResult');
  const departmentInput = document.getElementById('kpiDepartment');
  const showButton = document.getElementById('kpiShowButton');
  const selectedDepartment = departmentInput?.value || '';
  if (!selectedDepartment) { resetKpiResultCards(); showResult(resultBox,false,'กรุณาเลือกแผนก หรือ “รวมทุกแผนก” ก่อน'); return; }
  const requestToken = ++kpiPageRequestToken;
  if (kpiPageAbortController) { try{kpiPageAbortController.abort();}catch(e){} }
  const requestController = typeof AbortController !== 'undefined' ? new AbortController() : null;
  kpiPageAbortController = requestController;
  const timeoutTimer = requestController ? window.setTimeout(()=>requestController.abort(),60000) : null;
  try {
    if (showButton) { showButton.disabled=true; showButton.dataset.loading='1'; showButton.innerText='กำลังคำนวณ...'; }
    setKpiOutputVisible(false); resetKpiTrendOutput();
    if (kpiViewMode === 'history') {
      const range = getKpiHistoryRange();
      showResult(resultBox,true,`กำลังโหลด KPI ${formatKpiMonthLabel(range.start)} – ${formatKpiMonthLabel(range.end)}...`);
      const raw = await fetchKpiTrendData(range.end, requestController?.signal || null, range.start);
      if (requestToken !== kpiPageRequestToken) return;
      const data = filterKpiTrendDataForDepartment(raw, selectedDepartment);
      renderKpiTrendData(data);
      showResult(resultBox,true,`${formatKpiMonthLabel(range.start)} – ${formatKpiMonthLabel(range.end)} • ${selectedDepartment === KPI_ALL_DEPARTMENTS_VALUE ? 'รวมทุกแผนก' : selectedDepartment} • กราฟและตารางพร้อม Export`);
      return;
    }
    const monthInput = document.getElementById('kpiMonth');
    const month = clampKpiMonth(monthInput?.value || getTodayYMD().slice(0,7));
    if (monthInput) monthInput.value = month;
    if (selectedDepartment === KPI_ALL_DEPARTMENTS_VALUE) {
      showResult(resultBox,true,'กำลังคำนวณ KPI รวมทุกแผนกตามจำนวนตู้ × รอบ...');
      const currentMonthData = await fetchKpiTrendData(month, requestController?.signal || null, month);
      if (requestToken !== kpiPageRequestToken) return;
      renderKpiDepartmentOptions(currentMonthData.departments || [], KPI_ALL_DEPARTMENTS_VALUE);
      renderKpiAllDepartmentsCurrent(currentMonthData, month);
      showResult(resultBox,true,`${formatKpiMonthLabel(month)} • รวมทุกแผนก • คำนวณแบบถ่วงตามภาระงานตู้ × รอบ`);
      return;
    }
    showResult(resultBox,true,`กำลังคำนวณ KPI ของ ${selectedDepartment} ตามจำนวนตู้ × รอบ...`);
    const response = await fetch(`${WEB_APP_URL}?action=kpi_monthly&month=${encodeURIComponent(month)}&department=${encodeURIComponent(selectedDepartment)}`,requestController?{signal:requestController.signal}:undefined);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (requestToken !== kpiPageRequestToken) return;
    if (!data.ok) throw new Error(data.message || 'โหลด KPI ไม่สำเร็จ');
    renderKpiDepartmentOptions(data.departments || [], data.selectedDepartment || selectedDepartment);
    setKpiText('kpiTotalRounds', kpiSummaryNumber(data.summary,'totalItems','totalRounds').toLocaleString('th-TH'));
    setKpiText('kpiCompleteRounds', kpiSummaryNumber(data.summary,'completeItems','completeRounds').toLocaleString('th-TH'));
    setKpiText('kpiIncompleteRounds', kpiSummaryNumber(data.summary,'incompleteItems','incompleteRounds').toLocaleString('th-TH'));
    setKpiText('kpiPercentage', `${Number(data.summary?.percentage||0).toFixed(2)}%`);
    renderKpiDepartments(data.departmentResults || []); renderKpiMissingList(data.missingEvents || []); setKpiOutputVisible(true);
    showResult(resultBox,true,`${formatKpiMonthLabel(month)} • ${data.selectedDepartment} • ${Number(data.summary?.fridgeCount||0)} ตู้ • หน่วย KPI = ตู้ × รอบ`);
  } catch(error) {
    if (requestToken !== kpiPageRequestToken) return;
    const detail = error?.name === 'AbortError' ? 'คำขอใช้เวลานานเกิน 60 วินาที กรุณาลองอีกครั้ง' : (error.message || error);
    showResult(resultBox,false,'หน้า KPI โหลดไม่สำเร็จ: '+detail); resetKpiResultCards();
  } finally {
    if (timeoutTimer) window.clearTimeout(timeoutTimer);
    if (requestToken===kpiPageRequestToken) kpiPageAbortController=null;
    if (showButton) { showButton.dataset.loading='0'; showButton.innerText='แสดงผล'; setKpiShowButtonState(); }
  }
}

function exportKpiTableCSV() {
  const data = lastKpiTrendData;
  const months = Array.isArray(data?.months) ? data.months : [];
  const departments = Array.isArray(data?.departments) ? data.departments : [];
  if (!months.length) { alert('ยังไม่มีตาราง KPI สำหรับ Export กรุณากดแสดงผลก่อน'); return; }
  const headers = ['เดือน','รวม-รายการที่ต้องบันทึก(ตู้×รอบ)','รวม-บันทึกครบ','รวม-บันทึกไม่ครบ','รวม-ความครบถ้วน(%)','รวม-รายการยกเว้น'];
  departments.forEach(name=>headers.push(`${name}-รายการที่ต้องบันทึก(ตู้×รอบ)`,`${name}-บันทึกครบ`,`${name}-บันทึกไม่ครบ`,`${name}-ความครบถ้วน(%)`,`${name}-รายการยกเว้น`));
  const rows = months.map(item=>{
    const combined=item.combined||{}; const byDept=new Map((item.departments||[]).map(row=>[String(row.department||''),row]));
    const row=[formatKpiMonthLabel(item.month),kpiSummaryNumber(combined,'totalItems','totalRounds'),kpiSummaryNumber(combined,'completeItems','completeRounds'),kpiSummaryNumber(combined,'incompleteItems','incompleteRounds'),Number(combined.percentage||0).toFixed(2),Number(combined.exemptRecordCount||0)];
    departments.forEach(name=>{const d=byDept.get(name)||{};row.push(kpiSummaryNumber(d,'totalItems','totalRounds'),kpiSummaryNumber(d,'completeItems','completeRounds'),kpiSummaryNumber(d,'incompleteItems','incompleteRounds'),Number(d.percentage||0).toFixed(2),Number(d.exemptRecordCount||0));});
    return row;
  });
  const csv=[headers,...rows].map(row=>row.map(cell=>`"${String(cell??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  downloadTextFile('\ufeff'+csv,`KPI_temperature_${safeExportFilePart(data?.startMonth||KPI_TREND_START_MONTH)}_to_${safeExportFilePart(data?.endMonth||getTodayYMD().slice(0,7))}.csv`,'text/csv;charset=utf-8');
}

function resetTemperatureChartStats() {
  const box=document.getElementById('temperatureChartStats'); if(box) box.classList.add('hidden');
  ['chartStatCount','chartStatLatest','chartStatMin','chartStatMax'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerText=id==='chartStatCount'?'0':'-';});
}

function renderTemperatureChartStats(records) {
  const values=(records||[]).map(r=>Number(r.temp)).filter(Number.isFinite);
  const box=document.getElementById('temperatureChartStats');
  if(!box||!values.length){resetTemperatureChartStats();return;}
  box.classList.remove('hidden');
  const latest=values[values.length-1];
  setKpiText('chartStatCount',values.length.toLocaleString('th-TH'));
  setKpiText('chartStatLatest',`${latest.toFixed(1)} °C`);
  setKpiText('chartStatMin',`${Math.min(...values).toFixed(1)} °C`);
  setKpiText('chartStatMax',`${Math.max(...values).toFixed(1)} °C`);
}

function setChartRangeActive(mode) {
  [['7d','chartRange7d'],['30d','chartRange30d'],['month','chartRangeMonth'],['custom','chartRangeCustom']].forEach(([key,id])=>document.getElementById(id)?.classList.toggle('active',key===mode));
}

function setChartQuickRange(mode) {
  const endEl=document.getElementById('chartEndDate'); const startEl=document.getElementById('chartStartDate');
  if(!endEl||!startEl)return;
  if(mode==='custom'){setChartRangeActive('custom');return;}
  const end=new Date(); const start=new Date(end.getFullYear(),end.getMonth(),end.getDate());
  if(mode==='7d') start.setDate(start.getDate()-6);
  else if(mode==='30d') start.setDate(start.getDate()-29);
  else if(mode==='month') start.setDate(1);
  endEl.value=toDateInputValue(end); startEl.value=toDateInputValue(start); setChartRangeActive(mode); autoLoadChartIfReady();
}

function onChartCustomDateChanged(){setChartRangeActive('custom');autoLoadChartIfReady();}

async function loadChartData() {
  const fridgeId=document.getElementById('chartFridgeId')?.value?.trim()||''; const startDate=document.getElementById('chartStartDate')?.value||''; const endDate=document.getElementById('chartEndDate')?.value||''; const resultBox=document.getElementById('chartResult');
  if(!fridgeId||!startDate||!endDate){showResult(resultBox,false,'กรุณากรอกข้อมูลให้ครบ');clearChartOnly();return;}
  try{
    const response=await fetch(`${WEB_APP_URL}?action=history&fridgeId=${encodeURIComponent(fridgeId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`); const data=await response.json();
    if(!data.ok){showResult(resultBox,false,data.message||'โหลดกราฟไม่ได้');clearChartOnly();return;}
    const records=Array.isArray(data.records)?data.records:[];
    const graphRecords=records.filter(r=>r.recordType!=='NO_TEMP'&&r.isValidForGraph!==false&&r.temp!==null&&r.temp!==''&&!isNaN(Number(r.temp)));
    const noPlotRecords=records.filter(r=>r.recordType==='NO_TEMP'||r.isValidForGraph===false||r.temp===null||r.temp===''||isNaN(Number(r.temp)));
    renderTemperatureChartStats(graphRecords);
    const correctionCount=records.filter(r=>r.hasCorrection).length;
    showResult(resultBox,true,`พบ ${records.length.toLocaleString('th-TH')} รายการ • พล็อตกราฟ ${graphRecords.length.toLocaleString('th-TH')} รายการ${correctionCount?` • แก้ไขย้อนหลัง ${correctionCount} รายการ`:''}${noPlotRecords.length?` • ไม่พล็อต ${noPlotRecords.length} รายการ`:''}\n${data.fridgeName||fridgeId} • ช่วงมาตรฐาน ${data.minTemp} ถึง ${data.maxTemp} °C`);
    if(!graphRecords.length){clearChartOnly();return;} drawChart(graphRecords,data.minTemp,data.maxTemp,fridgeId);
  }catch(error){showResult(resultBox,false,'โหลดกราฟไม่ได้: '+error);clearChartOnly();}
}

function drawChart(records,minTemp,maxTemp,fridgeId){
  const canvas=document.getElementById('tempChart'); if(!canvas)return; const ctx=canvas.getContext('2d'); if(tempChart)tempChart.destroy();
  const graphRecords=records.filter(r=>r.recordType!=='NO_TEMP'&&r.isValidForGraph!==false&&r.temp!==null&&r.temp!==''&&!isNaN(Number(r.temp)));
  const labels=buildSmartLabels(graphRecords); const values=graphRecords.map(r=>Number(r.temp)); const min=Number(minTemp),max=Number(maxTemp);
  const hasOriginalWrong=graphRecords.some(r=>r.hasCorrection&&r.originalTemp!==null&&r.originalTemp!==''&&!isNaN(Number(r.originalTemp)));
  const originalRecordedValues=graphRecords.map(r=>r.hasCorrection?(r.originalTemp===null||r.originalTemp===''||isNaN(Number(r.originalTemp))?null:Number(r.originalTemp)):Number(r.temp));
  const rangeBandPlugin={id:'cnmiTempRangeBand',beforeDatasetsDraw(chart){const y=chart.scales?.y;const area=chart.chartArea;if(!y||!area||!Number.isFinite(min)||!Number.isFinite(max))return;const top=y.getPixelForValue(max),bottom=y.getPixelForValue(min);const c=chart.ctx;c.save();c.fillStyle='rgba(16,185,129,0.08)';c.fillRect(area.left,Math.min(top,bottom),area.right-area.left,Math.abs(bottom-top));c.restore();}};
  const datasets=[{label:`อุณหภูมิที่ใช้ปัจจุบัน ${fridgeId}`,data:values,borderColor:'#2563eb',backgroundColor:'#2563eb',borderWidth:3,pointRadius:ctx=>{const v=Number(ctx.raw);return Number.isFinite(v)&&(v<min||v>max)?5:3;},pointHoverRadius:7,pointBackgroundColor:ctx=>{const v=Number(ctx.raw);return Number.isFinite(v)&&(v<min||v>max)?'#dc2626':'#2563eb';},tension:.16,fill:false}];
  if(hasOriginalWrong)datasets.push({label:'ค่าที่บันทึกเดิม (แก้ไขแล้ว)',data:originalRecordedValues,borderColor:'#94a3b8',backgroundColor:'#94a3b8',borderDash:[7,6],borderWidth:2,pointRadius:2.5,pointHoverRadius:6,spanGaps:false,fill:false});
  datasets.push({label:'ค่าต่ำสุดที่กำหนด',data:labels.map(()=>min),borderColor:'#059669',backgroundColor:'#059669',borderDash:[5,5],borderWidth:1.5,pointRadius:0,fill:false},{label:'ค่าสูงสุดที่กำหนด',data:labels.map(()=>max),borderColor:'#059669',backgroundColor:'#059669',borderDash:[5,5],borderWidth:1.5,pointRadius:0,fill:false});
  const all=[...values,min,max].filter(Number.isFinite);const low=Math.min(...all),high=Math.max(...all),pad=Math.max(1,(high-low)*.12);
  tempChart=new Chart(ctx,{type:'line',data:{labels,datasets},plugins:[rangeBandPlugin],options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},layout:{padding:{top:10,right:10,left:4,bottom:0}},scales:{x:{grid:{display:false},ticks:{autoSkip:true,maxTicksLimit:10,maxRotation:0,minRotation:0,color:'#64748b'}},y:{suggestedMin:low-pad,suggestedMax:high+pad,grid:{color:'rgba(148,163,184,.18)'},ticks:{color:'#64748b'},title:{display:true,text:'อุณหภูมิ (°C)',color:'#475569'}}},plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8,padding:18}},tooltip:{backgroundColor:'rgba(15,23,42,.94)',padding:12,callbacks:{title(context){const r=graphRecords[context[0].dataIndex];return `${r.date} ${r.time||''} • รอบ${r.round||'-'}`.trim();},label(context){return `${context.dataset?.label||'อุณหภูมิ'}: ${context.raw} °C`;},afterBody(context){const r=graphRecords[context?.[0]?.dataIndex];return r?.hasCorrection?[`เหตุผลแก้ไข: ${r.correctionReason||'-'}`,`ผู้แก้ไข: ${r.correctedBy||'-'}`]:[];}}}}}});
}

function clearChartOnly(){if(tempChart){tempChart.destroy();tempChart=null;}resetTemperatureChartStats();}


/* =========================================================
   V1.8.50 — Unified Fridge Finder & Compact Workflow UI
   UI/UX only: no database/schema changes.
   ========================================================= */
const CNMI_WORKFLOW_FINDERS = {
  form:    { room:'roomSelect', fridge:'fridgeSelect', id:'fridgeId', summary:'formFridgeSummary' },
  history: { room:'historyRoomSelect', fridge:'historyFridgeSelect', id:'historyFridgeId', summary:'historyFridgeSummary' },
  chart:   { room:'chartRoomSelect', fridge:'chartFridgeSelect', id:'chartFridgeId', summary:'chartFridgeSummary' }
};

function getWorkflowFinderConfig(context){ return CNMI_WORKFLOW_FINDERS[String(context||'')] || null; }

function setFridgeFinderMode(context, mode){
  const prefix = context === 'form' ? 'form' : context;
  ['select','type','qr'].forEach(key=>{
    document.getElementById(`${prefix}Finder${key[0].toUpperCase()+key.slice(1)}Btn`)?.classList.toggle('active', key===mode);
    document.getElementById(`${prefix}Finder${key[0].toUpperCase()+key.slice(1)}Panel`)?.classList.toggle('hidden', key!==mode);
  });
  if(mode !== 'qr'){
    if(context==='history' && historyScannerOpen) stopHistoryScanner();
    if(context==='chart' && chartScannerOpen) stopChartScanner();
  }
}

function getFridgeItemForContext(context){
  const cfg=getWorkflowFinderConfig(context); if(!cfg) return null;
  const id=document.getElementById(cfg.id)?.value?.trim()||'';
  return id ? (findFridgeByFullId(id) || fridgeMasterList.find(x=>String(x?.id||'')===id) || null) : null;
}

function renderFridgeSelectionSummary(context, item){
  const cfg=getWorkflowFinderConfig(context); const box=cfg ? document.getElementById(cfg.summary) : null; if(!box) return;
  if(!item){ box.classList.add('hidden'); box.innerHTML=''; return; }
  const min=item.minTemp ?? item.min_temp ?? '';
  const max=item.maxTemp ?? item.max_temp ?? '';
  const range=(min!=='' && max!=='') ? `${escapeHtml(min)} ถึง ${escapeHtml(max)} °C` : 'ไม่ระบุช่วงอุณหภูมิ';
  box.innerHTML=`<div class="fridge-summary-icon">🧊</div><div class="fridge-summary-main"><strong>${escapeHtml(item.id||item.fridge_id||'-')}</strong><span>${escapeHtml(item.name||item.fridge_name||'')}</span></div><div class="fridge-summary-meta"><span>${escapeHtml(item.room||item.storage_location||'-')}</span><span>${range}</span></div><div class="fridge-summary-ok">✓ พร้อมใช้งาน</div>`;
  box.classList.remove('hidden');
}

function applyFridgeToWorkflowContext(context, item){
  const cfg=getWorkflowFinderConfig(context); if(!cfg || !item) return false;
  const room=document.getElementById(cfg.room), select=document.getElementById(cfg.fridge), input=document.getElementById(cfg.id);
  if(room){ ensureSelectOption(room,item.room||'',item.room||''); room.value=item.room||''; populateFridgeDropdown(cfg.fridge,item.room||''); }
  if(select){ ensureSelectOption(select,item.id,`${item.id} - ${item.name||''}`); select.value=item.id; }
  if(input) input.value=item.id;
  if(context==='form'){
    selectedFridgeInfo=item; setRoundTimeFromMaster(); autoSelectRoundByCurrentTime({force:false}); loadTodayLogStatus(); validateForm();
  }
  renderFridgeSelectionSummary(context,item);
  return true;
}

async function lookupTypedFridge(context){
  const cfg=getWorkflowFinderConfig(context); if(!cfg) return;
  const input=document.getElementById(cfg.id); const raw=input?.value?.trim()||'';
  if(!raw){ renderFridgeSelectionSummary(context,null); input?.focus(); return; }
  const item=await findFridgeByFullIdAsync(raw);
  if(!item){ renderFridgeSelectionSummary(context,null); showAppPopup(false,'ไม่พบรหัสตู้นี้',`ตรวจสอบรหัส ${raw} แล้วลองอีกครั้ง หรือเลือกจากรายการ/สแกน QR`); return; }
  applyFridgeToWorkflowContext(context,item);
}

function restoreFridgeFinderModes(){
  ['form','history','chart'].forEach(context=>{
    setFridgeFinderMode(context,'select');
    renderFridgeSelectionSummary(context,getFridgeItemForContext(context));
  });
}

// Override selection handlers: V1.8.50 intentionally waits for the main action button.
function onRoomChange(){
  const room=document.getElementById('roomSelect')?.value||''; populateFridgeDropdown('fridgeSelect',room);
  const select=document.getElementById('fridgeSelect'), input=document.getElementById('fridgeId'); if(select)select.value=''; if(input)input.value='';
  selectedFridgeInfo=null; renderFridgeSelectionSummary('form',null); validateForm();
}
function onHistoryRoomChange(){
  const room=document.getElementById('historyRoomSelect')?.value||''; populateFridgeDropdown('historyFridgeSelect',room);
  const select=document.getElementById('historyFridgeSelect'), input=document.getElementById('historyFridgeId'); if(select)select.value=''; if(input)input.value='';
  renderFridgeSelectionSummary('history',null); hideWorkflowResultActions('history');
}
function onChartRoomChange(){
  const room=document.getElementById('chartRoomSelect')?.value||''; populateFridgeDropdown('chartFridgeSelect',room);
  const select=document.getElementById('chartFridgeSelect'), input=document.getElementById('chartFridgeId'); if(select)select.value=''; if(input)input.value='';
  renderFridgeSelectionSummary('chart',null); hideWorkflowResultActions('chart'); clearChartOnly();
}
function onSelectChange(){
  const id=document.getElementById('fridgeSelect')?.value||''; const item=fridgeMasterList.find(x=>String(x?.id||'')===id)||null;
  if(item) applyFridgeToWorkflowContext('form',item); else { document.getElementById('fridgeId').value=''; selectedFridgeInfo=null; renderFridgeSelectionSummary('form',null); validateForm(); }
}
function onHistorySelectChange(){
  const id=document.getElementById('historyFridgeSelect')?.value||''; const item=fridgeMasterList.find(x=>String(x?.id||'')===id)||null;
  if(item) applyFridgeToWorkflowContext('history',item); else { document.getElementById('historyFridgeId').value=''; renderFridgeSelectionSummary('history',null); }
  hideWorkflowResultActions('history');
}
function onChartSelectChange(){
  const id=document.getElementById('chartFridgeSelect')?.value||''; const item=fridgeMasterList.find(x=>String(x?.id||'')===id)||null;
  if(item) applyFridgeToWorkflowContext('chart',item); else { document.getElementById('chartFridgeId').value=''; renderFridgeSelectionSummary('chart',null); }
  hideWorkflowResultActions('chart'); clearChartOnly();
}
function onFridgeIdInput(){
  const raw=document.getElementById('fridgeId')?.value?.trim()||''; const item=raw?findFridgeByFullId(raw):null;
  if(item) applyFridgeToWorkflowContext('form',item); else { selectedFridgeInfo=null; renderFridgeSelectionSummary('form',null); validateForm(); }
}
function onHistoryFridgeIdInput(){
  const raw=document.getElementById('historyFridgeId')?.value?.trim()||''; const item=raw?findFridgeByFullId(raw):null;
  if(item) applyFridgeToWorkflowContext('history',item); else renderFridgeSelectionSummary('history',null);
  hideWorkflowResultActions('history');
}
function onChartFridgeIdInput(){
  const raw=document.getElementById('chartFridgeId')?.value?.trim()||''; const item=raw?findFridgeByFullId(raw):null;
  if(item) applyFridgeToWorkflowContext('chart',item); else renderFridgeSelectionSummary('chart',null);
  hideWorkflowResultActions('chart'); clearChartOnly();
}

async function applyScannedFridgeToForm(scannedText){
  const item=await findFridgeByFullIdAsync(scannedText); if(!item){showInvalidFullQrMessage(scannedText);return;}
  setFridgeFinderMode('form','qr'); applyFridgeToWorkflowContext('form',item);
}
async function applyScannedFridgeToHistory(scannedText){
  const item=await findFridgeByFullIdAsync(scannedText); if(!item){showInvalidFullQrMessage(scannedText);return;}
  setFridgeFinderMode('history','qr'); applyFridgeToWorkflowContext('history',item); setDefaultHistoryDateRange(false); hideWorkflowResultActions('history');
}
async function applyScannedFridgeToChart(scannedText){
  const item=await findFridgeByFullIdAsync(scannedText); if(!item){showInvalidFullQrMessage(scannedText);return;}
  setFridgeFinderMode('chart','qr'); applyFridgeToWorkflowContext('chart',item); setDefaultChartDateRange(false); hideWorkflowResultActions('chart'); clearChartOnly();
}

function setHistoryRangeActive(mode){
  [['7d','historyRange7d'],['30d','historyRange30d'],['month','historyRangeMonth'],['custom','historyRangeCustom']].forEach(([key,id])=>document.getElementById(id)?.classList.toggle('active',key===mode));
}
function setHistoryQuickRange(mode){
  const endEl=document.getElementById('endDate'), startEl=document.getElementById('startDate'); if(!endEl||!startEl)return;
  if(mode==='custom'){setHistoryRangeActive('custom');return;}
  const end=new Date(), start=new Date(end.getFullYear(),end.getMonth(),end.getDate());
  if(mode==='7d')start.setDate(start.getDate()-6); else if(mode==='30d')start.setDate(start.getDate()-29); else if(mode==='month')start.setDate(1);
  endEl.value=toDateInputValue(end); startEl.value=toDateInputValue(start); setHistoryRangeActive(mode); hideWorkflowResultActions('history');
}
function onHistoryCustomDateChanged(){ setHistoryRangeActive('custom'); hideWorkflowResultActions('history'); }

// V1.8.50: quick-range selection no longer fires an automatic query.
function setChartQuickRange(mode){
  const endEl=document.getElementById('chartEndDate'), startEl=document.getElementById('chartStartDate'); if(!endEl||!startEl)return;
  if(mode==='custom'){setChartRangeActive('custom');return;}
  const end=new Date(), start=new Date(end.getFullYear(),end.getMonth(),end.getDate());
  if(mode==='7d')start.setDate(start.getDate()-6); else if(mode==='30d')start.setDate(start.getDate()-29); else if(mode==='month')start.setDate(1);
  endEl.value=toDateInputValue(end); startEl.value=toDateInputValue(start); setChartRangeActive(mode); hideWorkflowResultActions('chart'); clearChartOnly();
}
function onChartCustomDateChanged(){ setChartRangeActive('custom'); hideWorkflowResultActions('chart'); clearChartOnly(); }
function autoLoadHistoryIfReady(){ /* V1.8.50: explicit Search button only */ }
function autoLoadChartIfReady(){ /* V1.8.50: explicit Show chart button only */ }

function hideWorkflowResultActions(context){
  const id=context==='history'?'historyExportActions':'chartExportActions'; document.getElementById(id)?.classList.add('hidden');
}
function showWorkflowResultActions(context){
  const id=context==='history'?'historyExportActions':'chartExportActions'; document.getElementById(id)?.classList.remove('hidden');
}

// Wrap existing loaders to expose export only after a successful result.
const loadHistoryV1849 = loadHistory;
loadHistory = async function(){
  hideWorkflowResultActions('history');
  await loadHistoryV1849();
  if(Array.isArray(lastHistoryRecords) && lastHistoryRecords.length) showWorkflowResultActions('history');
};
const loadChartDataV1849 = loadChartData;
loadChartData = async function(){
  hideWorkflowResultActions('chart');
  await loadChartDataV1849();
  if(tempChart) showWorkflowResultActions('chart');
};

const clearHistoryFormV1849 = clearHistoryForm;
clearHistoryForm = function(){
  clearHistoryFormV1849(); setFridgeFinderMode('history','select'); renderFridgeSelectionSummary('history',null); setHistoryQuickRange('30d'); hideWorkflowResultActions('history');
};
const clearChartFormV1849 = clearChartForm;
clearChartForm = function(){
  clearChartFormV1849(); setFridgeFinderMode('chart','select'); renderFridgeSelectionSummary('chart',null); setChartQuickRange('30d'); hideWorkflowResultActions('chart');
};
const clearFormV1849 = clearForm;
clearForm = function(options){
  const result=clearFormV1849(options); if(result!==false){ setFridgeFinderMode('form','select'); renderFridgeSelectionSummary('form',null); } return result;
};

function initializeUnifiedWorkflowUI(){
  restoreFridgeFinderModes();
  setHistoryRangeActive('30d'); setChartRangeActive('30d');
  hideWorkflowResultActions('history'); hideWorkflowResultActions('chart');
}
document.addEventListener('DOMContentLoaded',()=>setTimeout(initializeUnifiedWorkflowUI,0));


/* ============================================================
   V1.8.51 — compact BEM workflow / Timeline rendering
   ============================================================ */
function v1851IsAutoTimelineItem(item){
  const action = String(item?.actionText || '').trim();
  const owner = String(item?.owner || '').trim();
  const updater = String(item?.updatedBy || '').trim();
  return action.startsWith('[ระบบอัตโนมัติ]') || owner === 'ระบบอัตโนมัติ' || updater === 'ระบบอัตโนมัติ';
}

function v1851ShortText(value, maxLen){
  const text = String(value || '').replace(/\s+/g,' ').trim();
  const limit = Number(maxLen || 90);
  return text.length > limit ? text.slice(0, limit - 1) + '…' : (text || '-');
}

function v1851GroupTimelineRows(rows){
  const grouped = [];
  let autoGroup = null;
  (Array.isArray(rows) ? rows : []).forEach(item => {
    if (v1851IsAutoTimelineItem(item)) {
      const key = String(item?.caseStatus || '-').trim();
      if (!autoGroup || autoGroup.status !== key) {
        autoGroup = { type:'auto', status:key, count:0, first:item.updatedAt || '', last:item.updatedAt || '' };
        grouped.push(autoGroup);
      }
      autoGroup.count += 1;
      if (!autoGroup.first) autoGroup.first = item.updatedAt || '';
      autoGroup.last = item.updatedAt || autoGroup.last;
      return;
    }
    autoGroup = null;
    grouped.push({ type:'manual', item });
  });
  return grouped;
}

function v1851RenderTimeline(rows, timeline){
  if (!timeline) return;
  timeline.innerHTML = '';
  const grouped = v1851GroupTimelineRows(rows);
  const fragment = document.createDocumentFragment();
  grouped.forEach((entry, index) => {
    if (entry.type === 'auto') {
      const box = document.createElement('div');
      box.className = 'timeline-auto-group';
      const range = entry.first && entry.last && entry.first !== entry.last
        ? `${escapeHtml(entry.first)} – ${escapeHtml(entry.last)}`
        : escapeHtml(entry.first || entry.last || '-');
      box.innerHTML = `<strong>ระบบบันทึกสถานะตู้ระหว่าง Incident อัตโนมัติ ${entry.count} ครั้ง</strong><span class="status-badge ${getIncidentStatusClass(entry.status)}">${escapeHtml(entry.status || '-')}</span><small>${range} • รายการอัตโนมัติถูกรวมเพื่อให้ Timeline อ่านง่าย</small>`;
      fragment.appendChild(box);
      return;
    }
    const item = entry.item || {};
    const details = document.createElement('details');
    details.className = 'timeline-compact-item';
    if (index === grouped.length - 1) details.open = true;
    details.innerHTML = `
      <summary>
        <span class="timeline-compact-time">${escapeHtml(item.updatedAt || '-')}</span>
        <span class="status-badge ${getIncidentStatusClass(item.caseStatus)}">${escapeHtml(item.caseStatus || '-')}</span>
        <span class="timeline-compact-action">${escapeHtml(v1851ShortText(item.actionText || item.fixResult || '-', 105))}</span>
      </summary>
      <div class="timeline-compact-detail">
        <div><strong>ผู้ดำเนินการ</strong><span>${escapeHtml(staffNameForUI(item.owner) || '-')}</span></div>
        <div><strong>การดำเนินการ</strong><span>${escapeHtml(item.actionText || '-')}</span></div>
        <div><strong>ผลการแก้ไข</strong><span>${escapeHtml(item.fixResult || '-')}</span></div>
        <div><strong>ผู้อัปเดต</strong><span>${escapeHtml(staffNameForUI(item.updatedBy) || '-')}</span></div>
      </div>`;
    fragment.appendChild(details);
  });
  timeline.appendChild(fragment);
}

// Replace only the display layer: old records remain untouched for audit.
loadIncidentHistory = async function(explicitIncidentId) {
  const incidentId = explicitIncidentId || document.getElementById('incidentHistorySelect')?.value || '';
  const resultBox = document.getElementById('incidentHistoryResult');
  const timeline = document.getElementById('incidentTimeline');
  const selectedLabel = document.getElementById('timelineSelectedIncident');
  if (!incidentId) { showResult(resultBox, false, 'กรุณาเลือก Incident จากการ์ด'); return; }
  if (timeline) timeline.innerHTML = '';
  if (selectedLabel) selectedLabel.innerHTML = `กำลังแสดง: <strong>${escapeHtml(incidentId)}</strong>`;
  try {
    const response = await fetch(`${WEB_APP_URL}?action=incident_history&incidentId=${encodeURIComponent(incidentId)}`);
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) { showResult(resultBox, true, 'ไม่พบประวัติการอัปเดต'); return; }
    const manualCount = data.filter(x => !v1851IsAutoTimelineItem(x)).length;
    const autoCount = data.length - manualCount;
    showResult(resultBox, true, autoCount > 0 ? `พบ ${manualCount} การอัปเดตจากเจ้าหน้าที่ • รวมรายการอัตโนมัติ ${autoCount} ครั้ง` : `พบ ${manualCount} การอัปเดต`);
    v1851RenderTimeline(data, timeline);
  } catch (error) {
    showResult(resultBox, false, 'โหลดประวัติการอัปเดตไม่สำเร็จ: ' + error);
  }
};

const v1851SelectUpdateIncidentBase = selectUpdateIncident;
selectUpdateIncident = function(incidentId){
  v1851SelectUpdateIncidentBase(incidentId);
  const panel = document.getElementById('bemSelectedCasePanel');
  if (panel && incidentId) panel.classList.remove('hidden');
};

const v1851ClearIncidentUpdateFormBase = clearIncidentUpdateForm;
clearIncidentUpdateForm = function(){
  v1851ClearIncidentUpdateFormBase();
  const panel = document.getElementById('bemSelectedCasePanel');
  if (panel) panel.classList.add('hidden');
};


/* ============================================================
   V1.8.52 — Timeline Noise Filter
   Keep every original audit row in the database, but keep the
   operational timeline focused on meaningful staff/BEM updates.
   ============================================================ */
function v1852TimelineBlob(item){
  return [item?.actionText, item?.fixResult, item?.owner, item?.updatedBy]
    .map(v => String(v || '').replace(/\s+/g,' ').trim())
    .filter(Boolean)
    .join(' | ');
}

function v1852IsLegacyTimelineNoise(item){
  const blob = v1852TimelineBlob(item);
  const lower = blob.toLowerCase();
  if (typeof v1851IsAutoTimelineItem === 'function' && v1851IsAutoTimelineItem(item)) return true;

  // Historical rows created automatically while the app was being developed.
  // These rows are repetitive round-level bookkeeping, not new BEM decisions.
  return (
    blob.includes('พบการบันทึกเหตุผิดปกติซ้ำในตู้เดิม') ||
    blob.includes('บันทึกสถานะตู้เสีย/อยู่ระหว่าง Incident') ||
    blob.includes('สร้าง temp_logs แบบ NO_TEMP') ||
    blob.includes('โดยไม่สร้าง Incident ใหม่') ||
    blob.includes('ขณะ Incident เดิมยังไม่ปิดเคส') ||
    lower.includes('[ระบบอัตโนมัติ]') ||
    lower.includes('auto no_temp')
  );
}

function v1852GroupNoiseRows(rows){
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach(item => {
    const status = String(item?.caseStatus || 'ไม่ระบุสถานะ').trim() || 'ไม่ระบุสถานะ';
    if (!map.has(status)) map.set(status, {status, count:0, first:'', last:''});
    const g = map.get(status);
    g.count += 1;
    const at = String(item?.updatedAt || '').trim();
    if (at && !g.first) g.first = at;
    if (at) g.last = at;
  });
  return Array.from(map.values());
}

function v1852RenderMeaningfulTimeline(rows, timeline){
  if (!timeline) return;
  timeline.innerHTML = '';
  const allRows = Array.isArray(rows) ? rows : [];
  const meaningful = allRows.filter(x => !v1852IsLegacyTimelineNoise(x));
  const noise = allRows.filter(v1852IsLegacyTimelineNoise);
  const fragment = document.createDocumentFragment();

  meaningful.forEach((item, index) => {
    const details = document.createElement('details');
    details.className = 'timeline-compact-item timeline-meaningful-item';
    if (index === meaningful.length - 1) details.open = true;
    details.innerHTML = `
      <summary>
        <span class="timeline-compact-time">${escapeHtml(item.updatedAt || '-')}</span>
        <span class="status-badge ${getIncidentStatusClass(item.caseStatus)}">${escapeHtml(item.caseStatus || '-')}</span>
        <span class="timeline-compact-action">${escapeHtml(v1851ShortText(item.actionText || item.fixResult || '-', 105))}</span>
      </summary>
      <div class="timeline-compact-detail">
        <div><strong>ผู้ดำเนินการ</strong><span>${escapeHtml(staffNameForUI(item.owner) || '-')}</span></div>
        <div><strong>การดำเนินการ</strong><span>${escapeHtml(item.actionText || '-')}</span></div>
        <div><strong>ผลการแก้ไข</strong><span>${escapeHtml(item.fixResult || '-')}</span></div>
        <div><strong>ผู้อัปเดต</strong><span>${escapeHtml(staffNameForUI(item.updatedBy) || '-')}</span></div>
      </div>`;
    fragment.appendChild(details);
  });

  if (meaningful.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'timeline-meaningful-empty';
    empty.textContent = 'ไม่พบการอัปเดตสำคัญจากเจ้าหน้าที่ในเคสนี้';
    fragment.appendChild(empty);
  }

  if (noise.length > 0) {
    const audit = document.createElement('details');
    audit.className = 'timeline-noise-audit';
    const grouped = v1852GroupNoiseRows(noise);
    const summaryRows = grouped.map(g => {
      const range = g.first && g.last && g.first !== g.last ? `${g.first} – ${g.last}` : (g.first || g.last || '-');
      return `<div class="timeline-noise-summary-row"><span class="status-badge ${getIncidentStatusClass(g.status)}">${escapeHtml(g.status)}</span><strong>${g.count} ครั้ง</strong><small>${escapeHtml(range)}</small></div>`;
    }).join('');
    audit.innerHTML = `
      <summary>
        <span>รายการระบบ/รายการซ้ำย้อนหลัง</span>
        <strong>${noise.length} รายการ</strong>
        <small>ซ่อนไว้เพื่อให้ Timeline อ่านง่าย</small>
      </summary>
      <div class="timeline-noise-audit-body">
        <p>เป็นรายการอัตโนมัติหรือรายการซ้ำจากช่วงพัฒนาระบบ ข้อมูลต้นฉบับยังคงอยู่ในฐานข้อมูล Audit และไม่ได้ถูกลบ</p>
        <div class="timeline-noise-summary-list">${summaryRows}</div>
      </div>`;
    fragment.appendChild(audit);
  }

  timeline.appendChild(fragment);
}

// Display-only replacement. No audit data is deleted or edited.
loadIncidentHistory = async function(explicitIncidentId) {
  const incidentId = explicitIncidentId || document.getElementById('incidentHistorySelect')?.value || '';
  const resultBox = document.getElementById('incidentHistoryResult');
  const timeline = document.getElementById('incidentTimeline');
  const selectedLabel = document.getElementById('timelineSelectedIncident');
  if (!incidentId) { showResult(resultBox, false, 'กรุณาเลือก Incident จากการ์ด'); return; }
  if (timeline) timeline.innerHTML = '';
  if (selectedLabel) selectedLabel.innerHTML = `กำลังแสดง: <strong>${escapeHtml(incidentId)}</strong>`;
  try {
    const response = await fetch(`${WEB_APP_URL}?action=incident_history&incidentId=${encodeURIComponent(incidentId)}`);
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) { showResult(resultBox, true, 'ไม่พบประวัติการอัปเดต'); return; }
    const noiseCount = data.filter(v1852IsLegacyTimelineNoise).length;
    const meaningfulCount = data.length - noiseCount;
    showResult(
      resultBox,
      true,
      noiseCount > 0
        ? `พบ ${meaningfulCount} การอัปเดตสำคัญ • ซ่อนรายการระบบ/รายการซ้ำ ${noiseCount} รายการ`
        : `พบ ${meaningfulCount} การอัปเดตสำคัญ`
    );
    v1852RenderMeaningfulTimeline(data, timeline);
  } catch (error) {
    showResult(resultBox, false, 'โหลดประวัติการอัปเดตไม่สำเร็จ: ' + error);
  }
};


/* ============================================================
   V1.8.55 — Mobile form polish + export chart + KPI history restore
   UI/display only. No database/schema changes.
   ============================================================ */
function v1855ApplyKpiModeVisibility(){
  const output=document.getElementById('kpiTemperatureOutput');
  if(!output) return;
  const isHistory=getSelectedKpiMetric()==='temperature_completeness' && kpiViewMode==='history';
  output.querySelectorAll('.kpi-current-only').forEach(el=>el.classList.toggle('hidden',isHistory));
  const trend=document.getElementById('kpiTrendSection');
  if(trend && !lastKpiTrendData) trend.classList.add('hidden');
}

const v1855SetKpiOutputVisibleBase=setKpiOutputVisible;
setKpiOutputVisible=function(visible){
  v1855SetKpiOutputVisibleBase(visible);
  if(visible) v1855ApplyKpiModeVisibility();
};

const v1855SetKpiViewModeBase=setKpiViewMode;
setKpiViewMode=function(mode){
  v1855SetKpiViewModeBase(mode);
  v1855ApplyKpiModeVisibility();
};

const v1855RenderKpiTrendDataBase=renderKpiTrendData;
renderKpiTrendData=function(data){
  // V1.8.48 accidentally unhid the child trend section while its parent
  // kpiTemperatureOutput stayed hidden. Always reveal the parent first.
  v1855SetKpiOutputVisibleBase(true);
  lastKpiTrendData=data||null;
  v1855ApplyKpiModeVisibility();
  v1855RenderKpiTrendDataBase(data);
  setKpiTrendTab('overview');
  requestAnimationFrame(()=>{
    try{kpiTrendChart?.resize();}catch(e){}
    try{kpiMissingTrendChart?.resize();}catch(e){}
  });
};

const v1855ResetKpiResultCardsBase=resetKpiResultCards;
resetKpiResultCards=function(){
  v1855ResetKpiResultCardsBase();
  v1855ApplyKpiModeVisibility();
};

function v1855CloneTemperatureDatasets(){
  if(!tempChart?.data?.datasets) return [];
  return tempChart.data.datasets.map((ds,index)=>({
    ...ds,
    data:Array.isArray(ds.data)?[...ds.data]:[],
    pointRadius:index===0?2.5:0,
    pointHoverRadius:index===0?2.5:0,
    borderWidth:index===0?3:1.8,
    tension:index===0 ? .12 : 0
  }));
}

// Export at a fixed landscape size instead of exporting the current mobile canvas.
// This avoids the square/crowded legend seen when PNG is created from an iPhone view.
exportTemperatureChartPNG=function(){
  const source=document.getElementById('tempChart');
  if(!tempChart||!source?.width||!source?.height){
    alert('ยังไม่มีกราฟอุณหภูมิสำหรับ Export กรุณาแสดงกราฟก่อน');
    return;
  }
  const fridgeId=document.getElementById('chartFridgeId')?.value?.trim()||'fridge';
  const startDate=document.getElementById('chartStartDate')?.value||'start';
  const endDate=document.getElementById('chartEndDate')?.value||'end';
  const out=document.createElement('canvas');
  out.width=1600; out.height=1000;
  const ctx=out.getContext('2d');
  ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,out.width,out.height);
  ctx.fillStyle='#0f3153'; ctx.font='700 38px Arial, sans-serif';
  ctx.fillText('CNMI Temperature Monitor',60,62);
  ctx.fillStyle='#244b70'; ctx.font='700 27px Arial, sans-serif';
  ctx.fillText(`Temperature ${fridgeId}`,60,105);
  ctx.fillStyle='#64748b'; ctx.font='20px Arial, sans-serif';
  ctx.fillText(`${startDate} - ${endDate}`,60,140);

  const chartCanvas=document.createElement('canvas');
  chartCanvas.width=1480; chartCanvas.height=780;
  const exportChart=new Chart(chartCanvas.getContext('2d'),{
    type:'line',
    data:{labels:[...(tempChart.data.labels||[])],datasets:v1855CloneTemperatureDatasets()},
    options:{
      responsive:false,maintainAspectRatio:false,animation:false,
      layout:{padding:{top:12,right:20,left:8,bottom:8}},
      interaction:{mode:'index',intersect:false},
      scales:{
        x:{grid:{display:false},ticks:{autoSkip:true,maxTicksLimit:14,maxRotation:0,minRotation:0,color:'#64748b',font:{size:15}}},
        y:{grid:{color:'rgba(148,163,184,.20)'},ticks:{color:'#64748b',font:{size:15}},title:{display:true,text:'Temperature (°C)',color:'#475569',font:{size:16,weight:'bold'}}}
      },
      plugins:{
        legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:10,padding:24,font:{size:16}}},
        tooltip:{enabled:false}
      }
    }
  });
  exportChart.update('none');
  ctx.drawImage(chartCanvas,60,170,1480,780);
  exportChart.destroy();
  downloadCanvasPNG(out,`temperature_${safeExportFilePart(fridgeId)}_${safeExportFilePart(startDate)}_${safeExportFilePart(endDate)}.png`);
};

function v1855BuildTimelineDetails(item,open=false){
  const details=document.createElement('details');
  details.className='timeline-compact-item timeline-meaningful-item';
  details.open=!!open;
  details.innerHTML=`
    <summary>
      <span class="timeline-compact-time">${escapeHtml(item?.updatedAt||'-')}</span>
      <span class="status-badge ${getIncidentStatusClass(item?.caseStatus)}">${escapeHtml(item?.caseStatus||'-')}</span>
      <span class="timeline-compact-action">${escapeHtml(v1851ShortText(item?.actionText||item?.fixResult||'-',105))}</span>
    </summary>
    <div class="timeline-compact-detail">
      <div><strong>ผู้ดำเนินการ</strong><span>${escapeHtml(staffNameForUI(item?.owner)||'-')}</span></div>
      <div><strong>การดำเนินการ</strong><span>${escapeHtml(item?.actionText||'-')}</span></div>
      <div><strong>ผลการแก้ไข</strong><span>${escapeHtml(item?.fixResult||'-')}</span></div>
      <div><strong>ผู้อัปเดต</strong><span>${escapeHtml(staffNameForUI(item?.updatedBy)||'-')}</span></div>
    </div>`;
  return details;
}

// On phones keep the operational timeline short: opening event + latest 5 updates.
// Older meaningful updates stay available under one collapsed section; audit/noise stays collapsed too.
v1852RenderMeaningfulTimeline=function(rows,timeline){
  if(!timeline)return;
  timeline.innerHTML='';
  const allRows=Array.isArray(rows)?rows:[];
  const meaningful=allRows.filter(x=>!v1852IsLegacyTimelineNoise(x));
  const noise=allRows.filter(v1852IsLegacyTimelineNoise);
  const isMobile=window.matchMedia?.('(max-width:760px)').matches===true;
  const fragment=document.createDocumentFragment();

  let visible=meaningful;
  let middle=[];
  if(isMobile && meaningful.length>6){
    visible=[meaningful[0],...meaningful.slice(-5)];
    middle=meaningful.slice(1,-5);
  }

  visible.forEach((item,index)=>{
    const shouldOpen=!isMobile && index===visible.length-1;
    fragment.appendChild(v1855BuildTimelineDetails(item,shouldOpen));
    if(isMobile && index===0 && middle.length){
      const older=document.createElement('details');
      older.className='timeline-mobile-older-group';
      older.innerHTML=`<summary><span>เหตุการณ์ก่อนหน้าเพิ่มเติม</span><strong>${middle.length} รายการ</strong><small>แตะเพื่อดู</small></summary><div class="timeline-mobile-older-body"></div>`;
      const body=older.querySelector('.timeline-mobile-older-body');
      middle.forEach(row=>body.appendChild(v1855BuildTimelineDetails(row,false)));
      fragment.appendChild(older);
    }
  });

  if(!meaningful.length){
    const empty=document.createElement('div'); empty.className='timeline-meaningful-empty'; empty.textContent='ไม่พบการอัปเดตสำคัญจากเจ้าหน้าที่ในเคสนี้'; fragment.appendChild(empty);
  }

  if(noise.length){
    const audit=document.createElement('details'); audit.className='timeline-noise-audit';
    const grouped=v1852GroupNoiseRows(noise);
    const summaryRows=grouped.map(g=>{const range=g.first&&g.last&&g.first!==g.last?`${g.first} – ${g.last}`:(g.first||g.last||'-');return `<div class="timeline-noise-summary-row"><span class="status-badge ${getIncidentStatusClass(g.status)}">${escapeHtml(g.status)}</span><strong>${g.count} ครั้ง</strong><small>${escapeHtml(range)}</small></div>`;}).join('');
    audit.innerHTML=`<summary><span>รายการระบบ/รายการซ้ำย้อนหลัง</span><strong>${noise.length} รายการ</strong><small>ซ่อนไว้เพื่อให้ Timeline อ่านง่าย</small></summary><div class="timeline-noise-audit-body"><p>รายการอัตโนมัติ/รายการซ้ำจากช่วงพัฒนาระบบยังเก็บไว้ใน Audit แต่ไม่แสดงยาวใน Timeline หลัก</p><div class="timeline-noise-summary-list">${summaryRows}</div></div>`;
    fragment.appendChild(audit);
  }
  timeline.appendChild(fragment);
};


/* ===== V1.8.56 KPI all automatic metrics: all departments + range; CQI 3 departments x 5 ===== */
const KPI_SEARCH_STORAGE_KEY_V1856 = "cnmi_temp_kpi_search_time_v1856";
const KPI_CQI_DEPARTMENTS = Object.freeze(["คลังเลือด (1B6)", "ห้องคลอด (4F)", "ห้องผ่าตัด (4B)"]);
let kpiSearchChart = null;
let kpiMetricTrendChart1 = null;
let kpiMetricTrendChart2 = null;
let kpiMetricTrendTab = "overview";
let lastAdditionalKpiTrendData = null;

function isAutomaticKpiMetric(metric = getSelectedKpiMetric()) {
  return metric !== "search_time";
}

function renderKpiDepartmentOptions(departments, selectedValue = "") {
  const select = document.getElementById("kpiDepartment");
  if (!select) return;
  const list = Array.isArray(departments) ? departments.map(x => String(x || "").trim()).filter(Boolean) : [];
  kpiDepartmentsCache = list.slice();
  const includeAll = isAutomaticKpiMetric();
  select.innerHTML = '<option value="">กรุณาเลือกแผนก</option>'
    + (includeAll ? '<option value="__ALL__">รวมทุกแผนก</option>' : '')
    + list.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  if (includeAll && (selectedValue === KPI_ALL_DEPARTMENTS_VALUE || !list.includes(selectedValue))) select.value = KPI_ALL_DEPARTMENTS_VALUE;
  else select.value = list.includes(selectedValue) ? selectedValue : "";
  setKpiShowButtonState();
}

function updateKpiViewModeUI() {
  const metric = getSelectedKpiMetric();
  const isAuto = isAutomaticKpiMetric(metric);
  const controls = document.getElementById('kpiTemperatureViewControls');
  const monthBox = document.getElementById('kpiSingleMonthFilter');
  const historyBox = document.getElementById('kpiHistoryRangeFilter');
  const monthBtn = document.getElementById('kpiViewMonthBtn');
  const historyBtn = document.getElementById('kpiViewHistoryBtn');
  if (controls) controls.classList.toggle('hidden', !isAuto);
  if (!isAuto) kpiViewMode = 'month';
  if (monthBox) monthBox.classList.toggle('hidden', isAuto && kpiViewMode === 'history');
  if (historyBox) historyBox.classList.toggle('hidden', !isAuto || kpiViewMode !== 'history');
  monthBtn?.classList.toggle('active', kpiViewMode === 'month');
  historyBtn?.classList.toggle('active', kpiViewMode === 'history');
  toggleKpiHistoryCustomRange();
}

function setKpiShowButtonState() {
  const button = document.getElementById('kpiShowButton');
  const metric = getSelectedKpiMetric();
  const department = document.getElementById('kpiDepartment')?.value || '';
  let ready = metric !== 'search_time' && !!department;
  if (metric !== 'search_time' && kpiViewMode === 'history') {
    const range = getKpiHistoryRange();
    ready = ready && !!range.start && !!range.end && range.start <= range.end;
  }
  if (button) {
    button.classList.toggle('hidden', metric === 'search_time');
    button.disabled = !ready;
  }
}

function resetAdditionalKpiTrendOutput() {
  lastAdditionalKpiTrendData = null;
  document.getElementById('kpiMetricTrendSection')?.classList.add('hidden');
  destroyAdditionalKpiTrendCharts();
  const head = document.getElementById('kpiMetricTrendTableHead');
  const body = document.getElementById('kpiMetricTrendTableBody');
  if (head) head.innerHTML = '';
  if (body) body.innerHTML = '';
  const dept = document.getElementById('kpiMetricTrendDepartmentSummary');
  if (dept) dept.innerHTML = '';
}

function destroyAdditionalKpiTrendCharts() {
  try { kpiMetricTrendChart1?.destroy(); } catch (e) {}
  try { kpiMetricTrendChart2?.destroy(); } catch (e) {}
  kpiMetricTrendChart1 = null; kpiMetricTrendChart2 = null;
}

function setAdditionalKpiTrendTab(tab) {
  if (!['overview','charts','table'].includes(tab)) return;
  kpiMetricTrendTab = tab;
  for (const name of ['overview','charts','table']) {
    const cap = name.charAt(0).toUpperCase()+name.slice(1);
    document.getElementById(`kpiMetricTrendTab${cap}`)?.classList.toggle('active', name===tab);
    document.getElementById(`kpiMetricTrendPanel${cap}`)?.classList.toggle('hidden', name!==tab);
  }
  if (tab === 'charts' && lastAdditionalKpiTrendData) {
    requestAnimationFrame(() => {
      renderAdditionalKpiTrendCharts(lastAdditionalKpiTrendData);
      try { kpiMetricTrendChart1?.resize(); } catch (e) {}
      try { kpiMetricTrendChart2?.resize(); } catch (e) {}
    });
  }
}

function setKpiMetricVisibility(metric = getSelectedKpiMetric()) {
  const autoFilter = document.getElementById('kpiAutoFilterPanel');
  const temperatureOutput = document.getElementById('kpiTemperatureOutput');
  const metricOutput = document.getElementById('kpiMetricOutput');
  const manualOutput = document.getElementById('kpiManualSearchOutput');
  const definitionTitle = document.getElementById('kpiMetricTitle');
  const isManual = metric === 'search_time';
  const isTemperature = metric === 'temperature_completeness';
  if (autoFilter) autoFilter.classList.toggle('hidden', isManual);
  if (temperatureOutput) temperatureOutput.classList.add('hidden');
  if (metricOutput) metricOutput.classList.add('hidden');
  if (manualOutput) manualOutput.classList.toggle('hidden', !isManual);
  if (definitionTitle) definitionTitle.innerText = KPI_METRIC_DEFINITIONS[metric]?.title || '-';
  updateKpiMetricDefinition(metric);
  updateKpiViewModeUI();
  resetAdditionalKpiTrendOutput();
  if (isManual) loadKpiSearchInputs();
  if (!isTemperature) resetKpiTrendOutput();
  setKpiShowButtonState();
}

async function onKpiMetricChanged() {
  selectedKpiMetric = getSelectedKpiMetric();
  cancelKpiRequest(); resetKpiResultCards(); resetAdditionalKpiTrendOutput();
  setKpiMetricVisibility(selectedKpiMetric);
  const resultBox = document.getElementById('kpiResult');
  if (selectedKpiMetric === 'search_time') {
    showResult(resultBox, true, 'กรอกผลการจับเวลาของตัวแทนทั้ง 3 แผนก แผนกละ 5 คน แล้วกด “คำนวณผล CQI”');
    return;
  }
  const depts = await loadKpiDepartmentList(false);
  renderKpiDepartmentOptions(depts, KPI_ALL_DEPARTMENTS_VALUE);
  showResult(resultBox, true, kpiViewMode === 'history' ? 'เลือกช่วงย้อนหลังและแผนก แล้วกด “แสดงผล”' : 'เลือกเดือนและแผนก แล้วกด “แสดงผล”');
}

function setKpiViewMode(mode) {
  if (!['month','history'].includes(mode)) return;
  kpiViewMode = mode; cancelKpiRequest(); resetKpiResultCards(); resetAdditionalKpiTrendOutput(); updateKpiViewModeUI();
  if (mode === 'history') {
    const end=document.getElementById('kpiHistoryEndMonth'); if(end&&!end.value)end.value=getTodayYMD().slice(0,7);
    const start=document.getElementById('kpiHistoryStartMonth'); if(start&&!start.value)start.value=KPI_TREND_START_MONTH;
  }
  showResult(document.getElementById('kpiResult'), true, mode==='history'?'เลือกช่วงย้อนหลังและแผนก แล้วกด “แสดงผล”':'เลือกเดือนและแผนก แล้วกด “แสดงผล”');
  setKpiShowButtonState();
}

function clearKpiFilters() {
  if (getSelectedKpiMetric()==='search_time') { clearKpiSearchInputs(); return; }
  const current=getTodayYMD().slice(0,7);
  const month=document.getElementById('kpiMonth'), department=document.getElementById('kpiDepartment');
  const hEnd=document.getElementById('kpiHistoryEndMonth'), hStart=document.getElementById('kpiHistoryStartMonth'), preset=document.getElementById('kpiHistoryPreset');
  if(month)month.value=current; if(hEnd)hEnd.value=current; if(hStart)hStart.value=KPI_TREND_START_MONTH; if(preset)preset.value='all'; if(department)department.value=KPI_ALL_DEPARTMENTS_VALUE;
  resetKpiResultCards(); resetAdditionalKpiTrendOutput(); updateKpiViewModeUI(); setKpiShowButtonState();
  showResult(document.getElementById('kpiResult'),true,kpiViewMode==='history'?'เลือกช่วงย้อนหลังและแผนก แล้วกด “แสดงผล”':'เลือกเดือนและแผนก แล้วกด “แสดงผล”');
}

function listMonthsInclusive(start, end) {
  const out=[]; let cursor=String(start||''); let guard=0;
  while (/^\d{4}-\d{2}$/.test(cursor) && cursor<=end && guard<60) { out.push(cursor); cursor=shiftKpiMonth(cursor,1); guard+=1; }
  return out;
}

async function fetchMetricKpiOne(metric, month, department, signal=null) {
  const response=await fetch(`${WEB_APP_URL}?action=kpi_metrics&metric=${encodeURIComponent(metric)}&month=${encodeURIComponent(month)}&department=${encodeURIComponent(department)}`, signal?{signal}:undefined);
  if(!response.ok) throw new Error(`HTTP ${response.status}`);
  const data=await response.json(); if(!data?.ok) throw new Error(data?.message||'โหลด KPI ไม่สำเร็จ'); return data;
}

function aggregateIncidentRows(rows) {
  const total=rows.reduce((s,r)=>s+Number(r?.summary?.totalItems||0),0);
  const complete=rows.reduce((s,r)=>s+Number(r?.summary?.completeItems||0),0);
  const incomplete=rows.reduce((s,r)=>s+Number(r?.summary?.incompleteItems||0),0);
  const active=rows.reduce((s,r)=>s+Number(r?.summary?.activeItems||0),0);
  const closed=rows.reduce((s,r)=>s+Number(r?.summary?.closedItems||0),0);
  const timelineIncomplete=rows.reduce((s,r)=>s+Number(r?.summary?.timelineIncompleteItems||0),0);
  return {totalItems:total,completeItems:complete,incompleteItems:incomplete,percentage:total?Number((complete/total*100).toFixed(2)):0,activeItems:active,closedItems:closed,timelineIncompleteItems:timelineIncomplete};
}

function aggregatePaperRows(rows) {
  const baseline=rows.reduce((s,r)=>s+Number(r?.summary?.baselineMonthlySheets||0),0);
  const reduced=rows.reduce((s,r)=>s+Number(r?.summary?.estimatedReducedMonthlySheets||0),0);
  const after=rows.reduce((s,r)=>s+Number(r?.summary?.estimatedAfterMonthlySheets||0),0);
  const fridge=rows.reduce((s,r)=>s+Number(r?.summary?.activeFridgeCount||0),0);
  return {activeFridgeCount:fridge,baselineMonthlySheets:baseline,estimatedReducedMonthlySheets:reduced,estimatedAfterMonthlySheets:after,estimatedReductionPercent:baseline?Number((reduced/baseline*100).toFixed(2)):0};
}

async function fetchAdditionalKpiTrendData(metric,start,end,selectedDepartment,signal=null,onProgress=null) {
  const months=listMonthsInclusive(start,end);
  const departments=selectedDepartment===KPI_ALL_DEPARTMENTS_VALUE ? kpiDepartmentsCache.slice() : [selectedDepartment];
  const tasks=[]; for(const month of months)for(const department of departments)tasks.push({month,department});
  const results=[]; let cursor=0,done=0; const workers=Math.min(4,Math.max(1,tasks.length));
  async function worker(){while(cursor<tasks.length){const idx=cursor++;const task=tasks[idx];const data=await fetchMetricKpiOne(metric,task.month,task.department,signal);results.push({...task,data});done++;onProgress?.(done,tasks.length);}}
  await Promise.all(Array.from({length:workers},()=>worker()));
  const agg=metric==='incident_timeline'?aggregateIncidentRows:aggregatePaperRows;
  const monthRows=months.map(month=>{const rows=results.filter(x=>x.month===month);const deptRows=departments.map(department=>{const found=rows.find(x=>x.department===department);return {department,summary:found?.data?.summary||{}};});return {month,combined:agg(rows.map(x=>x.data)),departments:deptRows};});
  const departmentSummary=departments.map(department=>{
    const deptResults=results.filter(x=>x.department===department);
    const summary=agg(deptResults.map(x=>x.data));
    if(metric==='paper_reduction') summary.activeFridgeCount=Math.max(0,...deptResults.map(x=>Number(x.data?.summary?.activeFridgeCount||0)));
    return {department,summary};
  });
  const rangeSummary=agg(results.map(x=>x.data));
  if(metric==='paper_reduction') rangeSummary.activeFridgeCount=Math.max(0,...monthRows.map(x=>Number(x.combined?.activeFridgeCount||0)));
  return {ok:true,metric,startMonth:start,endMonth:end,departments,months:monthRows,departmentSummary,rangeSummary};
}

function renderAdditionalKpiSummary(metric, summary) {
  if(metric==='incident_timeline'){
    setKpiText('kpiMetricLabelTotal','Incident ที่ประเมิน');setKpiText('kpiMetricLabelComplete','ครบถ้วน');setKpiText('kpiMetricLabelIncomplete','ไม่ครบถ้วน');setKpiText('kpiMetricLabelPercent','ความครบถ้วน • เป้าหมาย 100%');
    setKpiText('kpiMetricValueTotal',Number(summary.totalItems||0).toLocaleString('th-TH'));setKpiText('kpiMetricValueComplete',Number(summary.completeItems||0).toLocaleString('th-TH'));setKpiText('kpiMetricValueIncomplete',Number(summary.incompleteItems||0).toLocaleString('th-TH'));setKpiText('kpiMetricValuePercent',`${Number(summary.percentage||0).toFixed(2)}%`);
    const extra=document.getElementById('kpiMetricExtra');if(extra)extra.innerHTML=`<div class="kpi-inline-stat-grid"><div><span>กำลังดำเนินการ</span><strong>${Number(summary.activeItems||0)}</strong></div><div><span>ปิด/ยกเลิก</span><strong>${Number(summary.closedItems||0)}</strong></div><div><span>Timeline ไม่ครบ</span><strong>${Number(summary.timelineIncompleteItems||0)}</strong></div></div>`;
  }else{
    setKpiText('kpiMetricLabelTotal','แบบบันทึกเดิมในช่วง');setKpiText('kpiMetricLabelComplete','กระดาษที่ลดลง');setKpiText('kpiMetricLabelIncomplete','หลังใช้ระบบ');setKpiText('kpiMetricLabelPercent','ลดลง');
    setKpiText('kpiMetricValueTotal',Number(summary.baselineMonthlySheets||0).toLocaleString('th-TH'));setKpiText('kpiMetricValueComplete',Number(summary.estimatedReducedMonthlySheets||0).toLocaleString('th-TH'));setKpiText('kpiMetricValueIncomplete',Number(summary.estimatedAfterMonthlySheets||0).toLocaleString('th-TH'));setKpiText('kpiMetricValuePercent',`${Number(summary.estimatedReductionPercent||0).toFixed(2)}%`);
    const extra=document.getElementById('kpiMetricExtra');if(extra)extra.innerHTML=`<div class="kpi-inline-stat-grid"><div><span>ตู้ที่ใช้เป็นฐาน</span><strong>${Number(summary.activeFridgeCount||0)}</strong></div><div><span>ฐานเดิม</span><strong>${Number(summary.baselineMonthlySheets||0)} แผ่น</strong></div><div><span>ลดลง</span><strong>${Number(summary.estimatedReducedMonthlySheets||0)} แผ่น</strong></div></div>`;
  }
  document.getElementById('kpiMetricExamples')?.classList.add('hidden');
  document.getElementById('kpiMetricOutput')?.classList.remove('hidden');
}

function renderAdditionalKpiDepartmentSummary(data){
  const box=document.getElementById('kpiMetricTrendDepartmentSummary');if(!box)return;
  const metric=data?.metric;const rows=data?.departmentSummary||[];
  box.innerHTML=rows.map(r=>{const s=r.summary||{};if(metric==='incident_timeline'){return `<article class="kpi-department-card"><div class="kpi-department-head"><div><div class="kpi-department-name">${escapeHtml(r.department)}</div><div class="kpi-department-meta">ประเมิน ${Number(s.totalItems||0).toLocaleString('th-TH')} Incident • ไม่ครบ ${Number(s.incompleteItems||0).toLocaleString('th-TH')}</div></div><div class="kpi-percent-badge ${getKpiTargetClass(Number(s.percentage||0), 100)}">${Number(s.percentage||0).toFixed(2)}%</div></div><div class="kpi-progress"><span style="width:${Math.max(0,Math.min(100,Number(s.percentage||0)))}%"></span></div></article>`;}return `<article class="kpi-department-card"><div class="kpi-department-head"><div><div class="kpi-department-name">${escapeHtml(r.department)}</div><div class="kpi-department-meta">ลดกระดาษ ${Number(s.estimatedReducedMonthlySheets||0).toLocaleString('th-TH')} แผ่น ในช่วงที่เลือก</div></div><div class="kpi-percent-badge good">${Number(s.estimatedReductionPercent||0).toFixed(2)}%</div></div><div class="kpi-progress"><span style="width:${Math.max(0,Math.min(100,Number(s.estimatedReductionPercent||0)))}%"></span></div></article>`;}).join('')||'<div class="empty-friendly-card">ยังไม่มีข้อมูลในช่วงที่เลือก</div>';
}

function renderAdditionalKpiTrendTable(data){
  const head=document.getElementById('kpiMetricTrendTableHead'),body=document.getElementById('kpiMetricTrendTableBody');if(!head||!body)return;const deps=data?.departments||[];
  if(data.metric==='incident_timeline'){
    head.innerHTML=`<tr><th>เดือน</th><th>รวมทุกแผนก</th>${deps.map(x=>`<th>${escapeHtml(x)}</th>`).join('')}<th>ไม่ครบรวม</th></tr>`;
    body.innerHTML=(data.months||[]).map(m=>{const map=new Map((m.departments||[]).map(x=>[x.department,x.summary||{}]));return `<tr><td><strong>${formatKpiMonthLabel(m.month)}</strong></td><td>${Number(m.combined?.percentage||0).toFixed(2)}% <span class="kpi-table-sub">(ไม่ครบ ${Number(m.combined?.incompleteItems||0)})</span></td>${deps.map(d=>{const s=map.get(d)||{};return `<td>${Number(s.percentage||0).toFixed(2)}% <span class="kpi-table-sub">(ไม่ครบ ${Number(s.incompleteItems||0)})</span></td>`;}).join('')}<td>${Number(m.combined?.incompleteItems||0)}</td></tr>`;}).join('');
  } else {
    head.innerHTML=`<tr><th>เดือน</th><th>ฐานเดิมรวม</th><th>ลดลงรวม</th>${deps.map(x=>`<th>${escapeHtml(x)} ลดลง</th>`).join('')}</tr>`;
    body.innerHTML=(data.months||[]).map(m=>{const map=new Map((m.departments||[]).map(x=>[x.department,x.summary||{}]));return `<tr><td><strong>${formatKpiMonthLabel(m.month)}</strong></td><td>${Number(m.combined?.baselineMonthlySheets||0)}</td><td>${Number(m.combined?.estimatedReducedMonthlySheets||0)}</td>${deps.map(d=>`<td>${Number((map.get(d)||{}).estimatedReducedMonthlySheets||0)}</td>`).join('')}</tr>`;}).join('');
  }
}

function renderAdditionalKpiTrendCharts(data){
  destroyAdditionalKpiTrendCharts(); if(typeof Chart==='undefined'||!(data?.months||[]).length)return;
  const labels=data.months.map(x=>formatKpiMonthLabel(x.month)),deps=data.departments||[],palette=['#2563eb','#059669','#d97706','#7c3aed','#0891b2','#dc2626'];
  const c1=document.getElementById('kpiMetricTrendChart1'),c2=document.getElementById('kpiMetricTrendChart2');
  if(data.metric==='incident_timeline'){
    setKpiText('kpiMetricTrendChart1Title','แนวโน้มความครบถ้วน Incident');setKpiText('kpiMetricTrendChart1Subtitle','ร้อยละ Incident ที่มีสถานะและ Timeline ครบถ้วน');setKpiText('kpiMetricTrendChart2Title','Incident ที่ยังไม่ครบรายเดือน');setKpiText('kpiMetricTrendChart2Subtitle','แยกตามแผนก');
    if(c1){const ds=[{label:'เป้าหมาย 100%',data:data.months.map(()=>100),borderColor:'#94a3b8',backgroundColor:'#94a3b8',borderWidth:1.5,borderDash:[6,5],pointRadius:0,tension:0},{label:'รวมทุกแผนก',data:data.months.map(x=>Number(x.combined?.percentage||0)),borderColor:'#172554',backgroundColor:'#172554',borderWidth:3,pointRadius:4,tension:.18}];deps.forEach((d,i)=>ds.push({label:d,data:data.months.map(x=>Number(((x.departments||[]).find(r=>r.department===d)?.summary||{}).percentage||0)),borderColor:palette[i%palette.length],backgroundColor:palette[i%palette.length],borderWidth:2,pointRadius:3,tension:.18}));kpiMetricTrendChart1=new Chart(c1.getContext('2d'),{type:'line',data:{labels,datasets:ds},options:{responsive:true,maintainAspectRatio:false,scales:{y:{min:0,max:100,ticks:{callback:v=>`${v}%`}},x:{grid:{display:false}}},plugins:{legend:{position:'bottom'}}}});}
    if(c2){const ds=deps.map((d,i)=>({label:d,data:data.months.map(x=>Number(((x.departments||[]).find(r=>r.department===d)?.summary||{}).incompleteItems||0)),backgroundColor:palette[i%palette.length],stack:'x',borderRadius:6}));kpiMetricTrendChart2=new Chart(c2.getContext('2d'),{type:'bar',data:{labels,datasets:ds},options:{responsive:true,maintainAspectRatio:false,scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,beginAtZero:true,ticks:{precision:0}}},plugins:{legend:{position:'bottom'}}}});}
  }else{
    setKpiText('kpiMetricTrendChart1Title','กระดาษที่ลดลงรายเดือน');setKpiText('kpiMetricTrendChart1Subtitle','จำนวนแบบบันทึกที่ลดลง แยกตามแผนก');setKpiText('kpiMetricTrendChart2Title','กระดาษที่ลดลงสะสม');setKpiText('kpiMetricTrendChart2Subtitle','ยอดสะสมตั้งแต่ต้นช่วงที่เลือก');
    if(c1){const ds=deps.map((d,i)=>({label:d,data:data.months.map(x=>Number(((x.departments||[]).find(r=>r.department===d)?.summary||{}).estimatedReducedMonthlySheets||0)),backgroundColor:palette[i%palette.length],stack:'x',borderRadius:6}));kpiMetricTrendChart1=new Chart(c1.getContext('2d'),{type:'bar',data:{labels,datasets:ds},options:{responsive:true,maintainAspectRatio:false,scales:{x:{stacked:true,grid:{display:false}},y:{stacked:true,beginAtZero:true,ticks:{precision:0}}},plugins:{legend:{position:'bottom'}}}});}
    if(c2){let running=0;const vals=data.months.map(x=>(running+=Number(x.combined?.estimatedReducedMonthlySheets||0)));kpiMetricTrendChart2=new Chart(c2.getContext('2d'),{type:'line',data:{labels,datasets:[{label:'ลดกระดาษสะสม',data:vals,borderColor:'#0f766e',backgroundColor:'#0f766e',borderWidth:3,pointRadius:4,tension:.18,fill:false}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{precision:0}}},plugins:{legend:{position:'bottom'}}}});}
  }
}

function renderAdditionalKpiTrendData(data){
  lastAdditionalKpiTrendData=data; const sec=document.getElementById('kpiMetricTrendSection');if(!sec)return;sec.classList.remove('hidden');
  setKpiText('kpiMetricTrendTitle',data.metric==='incident_timeline'?'KPI Incident / Timeline ย้อนหลัง':'KPI การลดกระดาษย้อนหลัง');setKpiText('kpiMetricTrendPeriod',`${formatKpiMonthLabel(data.startMonth)} – ${formatKpiMonthLabel(data.endMonth)}`);setKpiText('kpiMetricTrendStatus',`${data.departments.length} แผนก • ${data.months.length} เดือน`);
  renderAdditionalKpiSummary(data.metric,data.rangeSummary||{});renderAdditionalKpiDepartmentSummary(data);renderAdditionalKpiTrendTable(data);setAdditionalKpiTrendTab(kpiMetricTrendTab||'overview');
}

async function loadAdditionalKpiPage(metric){
  const resultBox=document.getElementById('kpiResult'),depEl=document.getElementById('kpiDepartment'),btn=document.getElementById('kpiShowButton');const selected=depEl?.value||'';if(!selected){showResult(resultBox,false,'กรุณาเลือกแผนกหรือ “รวมทุกแผนก” ก่อน');return;}
  const token=++kpiMetricRequestToken;if(kpiPageAbortController){try{kpiPageAbortController.abort();}catch(e){}}const controller=typeof AbortController!=='undefined'?new AbortController():null;kpiPageAbortController=controller;
  try{if(btn){btn.disabled=true;btn.innerText='กำลังคำนวณ...';}resetKpiMetricOutput();resetAdditionalKpiTrendOutput();
    if(kpiViewMode==='history'){
      const range=getKpiHistoryRange();showResult(resultBox,true,`กำลังโหลด ${formatKpiMonthLabel(range.start)} – ${formatKpiMonthLabel(range.end)}...`);
      const data=await fetchAdditionalKpiTrendData(metric,range.start,range.end,selected,controller?.signal||null,(done,total)=>showResult(resultBox,true,`กำลังโหลดข้อมูล ${done}/${total}...`));if(token!==kpiMetricRequestToken)return;renderAdditionalKpiTrendData(data);showResult(resultBox,true,`${formatKpiMonthLabel(range.start)} – ${formatKpiMonthLabel(range.end)} • ${selected===KPI_ALL_DEPARTMENTS_VALUE?'รวมทุกแผนก':selected} • กราฟและตารางพร้อม Export`);return;
    }
    const month=clampKpiMonth(document.getElementById('kpiMonth')?.value||getTodayYMD().slice(0,7));
    const deps=selected===KPI_ALL_DEPARTMENTS_VALUE?kpiDepartmentsCache.slice():[selected];showResult(resultBox,true,`กำลังคำนวณ ${KPI_METRIC_DEFINITIONS[metric]?.title||'KPI'}...`);
    const rows=await Promise.all(deps.map(d=>fetchMetricKpiOne(metric,month,d,controller?.signal||null)));if(token!==kpiMetricRequestToken)return;const summary=metric==='incident_timeline'?aggregateIncidentRows(rows):aggregatePaperRows(rows);renderAdditionalKpiSummary(metric,summary);
    if(metric==='incident_timeline'){const examples=rows.flatMap(r=>r.incompleteExamples||[]).slice(0,30);renderKpiMetricExamples(examples);}else document.getElementById('kpiMetricExamples')?.classList.add('hidden');
    showResult(resultBox,true,`${formatKpiMonthLabel(month)} • ${selected===KPI_ALL_DEPARTMENTS_VALUE?'รวมทุกแผนก':selected}`);
  }catch(error){if(token!==kpiMetricRequestToken)return;showResult(resultBox,false,'หน้า KPI โหลดไม่สำเร็จ: '+(error?.message||error));resetKpiMetricOutput();resetAdditionalKpiTrendOutput();}finally{if(token===kpiMetricRequestToken)kpiPageAbortController=null;if(btn){btn.innerText='แสดงผล';setKpiShowButtonState();}}
}

function renderKpiTrendData(data) {
  lastKpiTrendData=data||null;const section=document.getElementById('kpiTrendSection');if(!section)return;
  setKpiOutputVisible(true); /* V1.8.49: parent must be visible before chart resize/render */
  section.classList.remove('hidden');const summary=data?.rangeSummary||{};
  setKpiText('kpiTrendTotalRounds',kpiSummaryNumber(summary,'totalItems','totalRounds').toLocaleString('th-TH'));setKpiText('kpiTrendCompleteRounds',kpiSummaryNumber(summary,'completeItems','completeRounds').toLocaleString('th-TH'));setKpiText('kpiTrendIncompleteRounds',kpiSummaryNumber(summary,'incompleteItems','incompleteRounds').toLocaleString('th-TH'));setKpiText('kpiTrendPercentage',`${Number(summary.percentage||0).toFixed(2)}%`);
  const period=document.getElementById('kpiTrendPeriod');if(period)period.innerText=`${formatKpiMonthLabel(data?.startMonth||KPI_TREND_START_MONTH)} – ${formatKpiMonthLabel(data?.endMonth||getTodayYMD().slice(0,7))}`;const status=document.getElementById('kpiTrendStatus');if(status)status.innerText=`${Number(data?.departments?.length||0)} แผนก • ${Number(data?.months?.length||0)} เดือน`;
  renderKpiTrendDepartmentSummary(data?.departmentSummary||[]);renderKpiTrendTable(data);setKpiTrendTab(kpiTrendTab||'charts');requestAnimationFrame(()=>{renderKpiTrendCharts(data);try{kpiTrendChart?.resize();kpiMissingTrendChart?.resize();}catch(e){}});
}

function exportAdditionalKpiTableCSV(){
  const d=lastAdditionalKpiTrendData;if(!d?.months?.length){alert('ยังไม่มีตาราง KPI สำหรับ Export');return;}let headers=[],rows=[];
  if(d.metric==='incident_timeline'){headers=['เดือน','รวม-ประเมิน','รวม-ครบ','รวม-ไม่ครบ','รวม-%',...d.departments.flatMap(x=>[`${x}-ประเมิน`,`${x}-ครบ`,`${x}-ไม่ครบ`,`${x}-%`])];rows=d.months.map(m=>{const map=new Map((m.departments||[]).map(x=>[x.department,x.summary||{}]));const a=m.combined||{};const r=[formatKpiMonthLabel(m.month),a.totalItems||0,a.completeItems||0,a.incompleteItems||0,Number(a.percentage||0).toFixed(2)];d.departments.forEach(x=>{const s=map.get(x)||{};r.push(s.totalItems||0,s.completeItems||0,s.incompleteItems||0,Number(s.percentage||0).toFixed(2));});return r;});}
  else{headers=['เดือน','ฐานเดิมรวม','ลดลงรวม','หลังใช้ระบบรวม',...d.departments.flatMap(x=>[`${x}-ฐานเดิม`,`${x}-ลดลง`])];rows=d.months.map(m=>{const map=new Map((m.departments||[]).map(x=>[x.department,x.summary||{}]));const a=m.combined||{};const r=[formatKpiMonthLabel(m.month),a.baselineMonthlySheets||0,a.estimatedReducedMonthlySheets||0,a.estimatedAfterMonthlySheets||0];d.departments.forEach(x=>{const s=map.get(x)||{};r.push(s.baselineMonthlySheets||0,s.estimatedReducedMonthlySheets||0);});return r;});}
  const csv=[headers,...rows].map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');downloadTextFile('\ufeff'+csv,`KPI_${d.metric}_${safeExportFilePart(d.startMonth)}_to_${safeExportFilePart(d.endMonth)}.csv`,'text/csv;charset=utf-8');
}

function exportAdditionalKpiChartsPNG(){
  const c1=document.getElementById('kpiMetricTrendChart1'),c2=document.getElementById('kpiMetricTrendChart2');
  if((!c1?.width||!c1?.height)&&(!c2?.width||!c2?.height)){alert('ยังไม่มีกราฟสำหรับ Export');return;}
  const canvases=[c1,c2].filter(c=>c&&c.width&&c.height);
  const padding=30,gap=34,mainHeaderHeight=80,chartHeaderHeight=64;
  const width=Math.max(...canvases.map(c=>c.width))+padding*2;
  const height=padding*2+mainHeaderHeight+canvases.reduce((sum,c)=>sum+chartHeaderHeight+c.height,0)+gap*Math.max(0,canvases.length-1);
  const out=document.createElement('canvas');out.width=width;out.height=height;
  const ctx=out.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);

  const mainTitle=document.getElementById('kpiMetricTrendTitle')?.textContent?.trim()||'KPI ย้อนหลัง';
  const period=document.getElementById('kpiMetricTrendPeriod')?.textContent?.trim()||'';
  ctx.fillStyle='#0f172a';ctx.font='700 26px "Noto Sans Thai", Tahoma, Arial, sans-serif';ctx.fillText(mainTitle,padding,padding+28);
  if(period){ctx.fillStyle='#64748b';ctx.font='400 16px "Noto Sans Thai", Tahoma, Arial, sans-serif';ctx.fillText(period,padding,padding+55);}

  const headings=[
    [document.getElementById('kpiMetricTrendChart1Title')?.textContent?.trim()||'แนวโน้มรายเดือน',document.getElementById('kpiMetricTrendChart1Subtitle')?.textContent?.trim()||''],
    [document.getElementById('kpiMetricTrendChart2Title')?.textContent?.trim()||'สรุปรายเดือน',document.getElementById('kpiMetricTrendChart2Subtitle')?.textContent?.trim()||'']
  ];
  let y=padding+mainHeaderHeight;
  canvases.forEach((c,i)=>{
    drawKpiExportHeading(ctx,padding,y,headings[i]?.[0]||'',headings[i]?.[1]||'');
    y+=chartHeaderHeight;
    ctx.drawImage(c,padding,y);
    y+=c.height+gap;
  });
  downloadCanvasPNG(out,`KPI_${lastAdditionalKpiTrendData?.metric||'metric'}_${lastAdditionalKpiTrendData?.startMonth||''}_to_${lastAdditionalKpiTrendData?.endMonth||''}.png`);
}

function cqiFieldId(kind,deptIndex,personIndex){return `kpiSearch${kind}_${deptIndex}_${personIndex}`;}
const KPI_CQI_EVALUATION_CYCLE = 'CQI 2569';
let kpiSearchSavedRows = new Map();
let kpiSearchLoading = false;

function cqiRowKey(department, personNo){return `${department}::${personNo}`;}
function cqiRowStatusId(deptIndex,personIndex){return `kpiSearchStatus_${deptIndex}_${personIndex}`;}
function cqiRowSaveId(deptIndex,personIndex){return `kpiSearchSave_${deptIndex}_${personIndex}`;}
function cqiDeptProgressId(deptIndex){return `kpiSearchDeptProgress_${deptIndex}`;}
function readCqiInput(kind,deptIndex,personIndex){
  const raw=String(document.getElementById(cqiFieldId(kind,deptIndex,personIndex))?.value??'').trim();
  if(raw==='')return NaN;
  return Number(raw);
}
function isValidCqiPair(before,after){return Number.isFinite(before)&&before>0&&Number.isFinite(after)&&after>=0;}
function formatCqiSavedTime(value){
  if(!value)return '';
  const d=new Date(value); if(Number.isNaN(d.getTime()))return '';
  return d.toLocaleString('th-TH',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'});
}
function renderKpiSearchDepartmentInputs(){
  const box=document.getElementById('kpiSearchDepartments');if(!box)return;
  box.innerHTML=KPI_CQI_DEPARTMENTS.map((department,di)=>`<section class="kpi-cqi-department-card">
    <div class="kpi-cqi-department-head">
      <div><strong>${escapeHtml(department)}</strong><span id="${cqiDeptProgressId(di)}">บันทึกแล้ว 0/5 คน</span></div>
      <span class="kpi-cqi-chip" id="${cqiDeptProgressId(di)}_chip">0/5</span>
    </div>
    <div class="kpi-search-table-wrap"><table class="kpi-search-table kpi-cqi-person-table">
      <thead><tr><th>ผู้ทดสอบ</th><th>ก่อนใช้แอป (นาที)</th><th>หลังใช้แอป (นาที)</th><th>สถานะ / บันทึก</th></tr></thead>
      <tbody>${Array.from({length:5},(_,pi)=>`<tr id="kpiSearchRow_${di}_${pi}">
        <td><strong>คนที่ ${pi+1}</strong></td>
        <td><input type="number" id="${cqiFieldId('Before',di,pi)}" min="0" step="0.1" inputmode="decimal" oninput="markKpiSearchRowDirty(${di},${pi})" /></td>
        <td><input type="number" id="${cqiFieldId('After',di,pi)}" min="0" step="0.1" inputmode="decimal" oninput="markKpiSearchRowDirty(${di},${pi})" /></td>
        <td class="cqi-row-action-cell"><span id="${cqiRowStatusId(di,pi)}" class="cqi-row-state pending">ยังไม่บันทึก</span><button type="button" id="${cqiRowSaveId(di,pi)}" class="cqi-row-save-btn" onclick="saveKpiSearchPerson(${di},${pi})" disabled>บันทึกคนนี้</button></td>
      </tr>`).join('')}</tbody>
    </table></div>
  </section>`).join('');
}
function getKpiSearchInputs(){
  return KPI_CQI_DEPARTMENTS.map((department,di)=>({department,before:Array.from({length:5},(_,pi)=>readCqiInput('Before',di,pi)),after:Array.from({length:5},(_,pi)=>readCqiInput('After',di,pi))}));
}
function averageKpiValues(values){const arr=values.filter(Number.isFinite);return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:NaN;}
function normalizeCqiServerRow(row){
  return {
    evaluationCycle:String(row?.evaluationCycle||KPI_CQI_EVALUATION_CYCLE),
    department:String(row?.department||''),
    personNo:Number(row?.personNo),
    beforeMinutes:Number(row?.beforeMinutes),
    afterMinutes:Number(row?.afterMinutes),
    savedBy:String(row?.savedBy||''),
    createdAt:row?.createdAt||'',
    updatedAt:row?.updatedAt||''
  };
}
function applyCqiSavedRows(rows){
  kpiSearchSavedRows=new Map();
  (Array.isArray(rows)?rows:[]).forEach(raw=>{
    const row=normalizeCqiServerRow(raw);
    if(!KPI_CQI_DEPARTMENTS.includes(row.department)||!Number.isInteger(row.personNo)||row.personNo<1||row.personNo>5||!isValidCqiPair(row.beforeMinutes,row.afterMinutes))return;
    kpiSearchSavedRows.set(cqiRowKey(row.department,row.personNo),row);
    const di=KPI_CQI_DEPARTMENTS.indexOf(row.department),pi=row.personNo-1;
    const before=document.getElementById(cqiFieldId('Before',di,pi));
    const after=document.getElementById(cqiFieldId('After',di,pi));
    if(before)before.value=String(row.beforeMinutes);
    if(after)after.value=String(row.afterMinutes);
  });
}
function restoreLegacyCqiDraftIfEmpty(){
  if(kpiSearchSavedRows.size)return false;
  let saved=null;try{saved=JSON.parse(localStorage?.getItem(KPI_SEARCH_STORAGE_KEY_V1856)||'null');}catch(e){}
  if(!saved?.departments)return false;
  let restored=false;
  KPI_CQI_DEPARTMENTS.forEach((department,di)=>{
    const row=saved.departments.find(x=>x.department===department)||{};
    for(let pi=0;pi<5;pi++){
      const bv=Number(row.before?.[pi]),av=Number(row.after?.[pi]);
      if(!isValidCqiPair(bv,av))continue;
      const b=document.getElementById(cqiFieldId('Before',di,pi)),a=document.getElementById(cqiFieldId('After',di,pi));
      if(b)b.value=String(bv);if(a)a.value=String(av);restored=true;
    }
  });
  return restored;
}
function updateKpiSearchProgress(){
  let total=0;
  KPI_CQI_DEPARTMENTS.forEach((department,di)=>{
    let count=0;for(let personNo=1;personNo<=5;personNo++)if(kpiSearchSavedRows.has(cqiRowKey(department,personNo)))count++;
    total+=count;
    const text=document.getElementById(cqiDeptProgressId(di));if(text)text.textContent=`บันทึกแล้ว ${count}/5 คน`;
    const chip=document.getElementById(`${cqiDeptProgressId(di)}_chip`);if(chip)chip.textContent=`${count}/5`;
  });
  const overall=document.getElementById('kpiSearchProgressOverall');if(overall)overall.textContent=`บันทึกแล้ว ${total}/15 คน • ${KPI_CQI_EVALUATION_CYCLE}`;
  return total;
}
function updateKpiSearchRowUI(deptIndex,personIndex,mode='auto'){
  const department=KPI_CQI_DEPARTMENTS[deptIndex],personNo=personIndex+1,key=cqiRowKey(department,personNo);
  const saved=kpiSearchSavedRows.get(key);
  const before=readCqiInput('Before',deptIndex,personIndex),after=readCqiInput('After',deptIndex,personIndex);
  const valid=isValidCqiPair(before,after);
  const unchanged=!!saved&&Number(saved.beforeMinutes)===before&&Number(saved.afterMinutes)===after;
  const status=document.getElementById(cqiRowStatusId(deptIndex,personIndex));
  const button=document.getElementById(cqiRowSaveId(deptIndex,personIndex));
  if(!status||!button)return;
  button.disabled=!valid||kpiSearchLoading;
  if(mode==='saving'){
    status.className='cqi-row-state saving';status.textContent='กำลังบันทึก...';button.textContent='กำลังบันทึก';button.disabled=true;return;
  }
  if(mode==='error'){
    status.className='cqi-row-state error';status.textContent='บันทึกไม่สำเร็จ';button.textContent=saved?'ลองอัปเดตอีกครั้ง':'ลองบันทึกอีกครั้ง';return;
  }
  if(saved&&unchanged){
    const time=formatCqiSavedTime(saved.updatedAt);
    status.className='cqi-row-state saved';status.textContent=time?`บันทึกแล้ว • ${time}`:'บันทึกแล้ว';button.textContent='อัปเดต';
  }else if(saved){
    status.className='cqi-row-state dirty';status.textContent='แก้ไขแล้ว ยังไม่บันทึก';button.textContent='บันทึกการแก้ไข';
  }else{
    status.className='cqi-row-state pending';status.textContent=valid?'พร้อมบันทึก':'ยังไม่บันทึก';button.textContent='บันทึกคนนี้';
  }
}
function refreshAllKpiSearchRowUI(){KPI_CQI_DEPARTMENTS.forEach((_,di)=>{for(let pi=0;pi<5;pi++)updateKpiSearchRowUI(di,pi);});updateKpiSearchProgress();}
function markKpiSearchRowDirty(deptIndex,personIndex){updateKpiSearchRowUI(deptIndex,personIndex);}
async function loadKpiSearchInputs(){
  if(kpiSearchLoading)return;
  renderKpiSearchDepartmentInputs();
  kpiSearchLoading=true;
  const result=document.getElementById('kpiSearchResult');if(result){result.className='kpi-search-result';result.innerHTML='กำลังโหลดข้อมูล CQI จากฐานข้อมูล...';}
  try{
    const response=await fetch(`${WEB_APP_URL}?action=cqi_search_list&cycle=${encodeURIComponent(KPI_CQI_EVALUATION_CYCLE)}`);
    const data=await response.json();
    if(!data?.ok)throw new Error(data?.message||'โหลดข้อมูล CQI ไม่สำเร็จ');
    applyCqiSavedRows(data.rows||[]);
    const restored=restoreLegacyCqiDraftIfEmpty();
    kpiSearchLoading=false;
    refreshAllKpiSearchRowUI();
    calculateKpiSearchTime(false);
    if(restored&&kpiSearchSavedRows.size===0&&result){result.className='kpi-search-result warn';result.innerHTML='<strong>พบข้อมูลเดิมในเครื่อง</strong><span>ข้อมูลนี้ยังไม่ได้อยู่ใน Supabase กรุณากด “บันทึกคนนี้” ทีละรายการที่ต้องการเก็บ</span>';}
  }catch(error){
    kpiSearchLoading=false;kpiSearchSavedRows=new Map();refreshAllKpiSearchRowUI();destroyKpiSearchChart();document.getElementById('kpiSearchSummary')?.classList.add('hidden');
    if(result){result.className='kpi-search-result warn';result.innerHTML=`<strong>โหลดข้อมูล CQI ไม่สำเร็จ</strong><span>${escapeHtml(error?.message||String(error))}</span>`;}
  }
}
async function saveKpiSearchPerson(deptIndex,personIndex){
  const department=KPI_CQI_DEPARTMENTS[deptIndex],personNo=personIndex+1;
  const before=readCqiInput('Before',deptIndex,personIndex),after=readCqiInput('After',deptIndex,personIndex);
  if(!isValidCqiPair(before,after)){alert('กรุณากรอกเวลาก่อนใช้แอปให้มากกว่า 0 นาที และเวลาหลังใช้แอปตั้งแต่ 0 นาทีขึ้นไป');return;}
  updateKpiSearchRowUI(deptIndex,personIndex,'saving');
  try{
    const params=new URLSearchParams({action:'cqi_search_save',cycle:KPI_CQI_EVALUATION_CYCLE,department,personNo:String(personNo),beforeMinutes:String(before),afterMinutes:String(after),actorFullName:getCurrentActorFullName?.()||''});
    const response=await fetch(`${WEB_APP_URL}?${params.toString()}`);const data=await response.json();
    if(!data?.ok)throw new Error(data?.message||'บันทึกไม่สำเร็จ');
    const row=normalizeCqiServerRow(data.row||{evaluationCycle:KPI_CQI_EVALUATION_CYCLE,department,personNo,beforeMinutes:before,afterMinutes:after,updatedAt:new Date().toISOString()});
    kpiSearchSavedRows.set(cqiRowKey(department,personNo),row);
    updateKpiSearchRowUI(deptIndex,personIndex);updateKpiSearchProgress();calculateKpiSearchTime(false);
  }catch(error){
    updateKpiSearchRowUI(deptIndex,personIndex,'error');
    alert(error?.message||'บันทึกข้อมูล CQI ไม่สำเร็จ');
  }
}
function clearKpiSearchInputs(){
  if(!confirm('ล้างเฉพาะค่าที่แก้ไขแต่ยังไม่ได้บันทึก และคืนค่าที่บันทึกไว้จาก Supabase ใช่หรือไม่?'))return;
  KPI_CQI_DEPARTMENTS.forEach((department,di)=>{for(let pi=0;pi<5;pi++){
    const saved=kpiSearchSavedRows.get(cqiRowKey(department,pi+1));
    const b=document.getElementById(cqiFieldId('Before',di,pi)),a=document.getElementById(cqiFieldId('After',di,pi));
    if(b)b.value=saved?String(saved.beforeMinutes):'';if(a)a.value=saved?String(saved.afterMinutes):'';
  }});
  refreshAllKpiSearchRowUI();
}
function destroyKpiSearchChart(){try{kpiSearchChart?.destroy();}catch(e){}kpiSearchChart=null;}
function getSavedCqiRows(){return Array.from(kpiSearchSavedRows.values()).sort((a,b)=>KPI_CQI_DEPARTMENTS.indexOf(a.department)-KPI_CQI_DEPARTMENTS.indexOf(b.department)||a.personNo-b.personNo);}
function calculateKpiSearchTime(showMessage=true){
  const savedRows=getSavedCqiRows(),result=document.getElementById('kpiSearchResult');if(!result)return;
  const savedCount=savedRows.length;updateKpiSearchProgress();
  if(!savedCount){destroyKpiSearchChart();document.getElementById('kpiSearchSummary')?.classList.add('hidden');result.className='kpi-search-result';result.innerHTML=showMessage?'ยังไม่มีผลที่บันทึกในฐานข้อมูล กรุณากรอกและกด “บันทึกคนนี้”':'ยังไม่มีผลที่บันทึกในฐานข้อมูล';return;}
  const deptResults=KPI_CQI_DEPARTMENTS.map(department=>{
    const rows=savedRows.filter(x=>x.department===department),before=rows.map(x=>x.beforeMinutes),after=rows.map(x=>x.afterMinutes),beforeAvg=averageKpiValues(before),afterAvg=averageKpiValues(after),reduction=Number.isFinite(beforeAvg)&&beforeAvg>0?(beforeAvg-afterAvg)/beforeAvg*100:NaN;
    return {department,count:rows.length,beforeAvg,afterAvg,reduction};
  });
  const beforeAvg=averageKpiValues(savedRows.map(x=>x.beforeMinutes)),afterAvg=averageKpiValues(savedRows.map(x=>x.afterMinutes)),reduction=(beforeAvg-afterAvg)/beforeAvg*100;
  const isComplete=savedCount===15;
  result.className=`kpi-search-result ${reduction>=0?'good':'warn'}`;
  result.innerHTML=`<strong>${isComplete?'เก็บข้อมูลครบ 15/15 คน':'ผลชั่วคราว '+savedCount+'/15 คน'} • ลดเวลาค้นข้อมูล ${reduction.toFixed(1)}%</strong><span>เวลาเฉลี่ยจากข้อมูลที่บันทึกแล้ว: ก่อนใช้แอป ${beforeAvg.toFixed(1)} นาที → หลังใช้แอป ${afterAvg.toFixed(1)} นาที${isComplete?'':' • ผลจะอัปเดตอัตโนมัติทุกครั้งที่บันทึกเพิ่ม'}</span>`;
  setKpiText('kpiSearchOverallCount',`${savedCount}/15`);setKpiText('kpiSearchOverallBefore',`${beforeAvg.toFixed(1)} นาที`);setKpiText('kpiSearchOverallAfter',`${afterAvg.toFixed(1)} นาที`);setKpiText('kpiSearchOverallReduction',`${reduction.toFixed(1)}%`);document.getElementById('kpiSearchSummary')?.classList.remove('hidden');
  const deptBox=document.getElementById('kpiSearchDepartmentSummary');if(deptBox)deptBox.innerHTML=deptResults.map(d=>{
    if(!d.count)return `<article class="kpi-department-card"><div class="kpi-department-head"><div><div class="kpi-department-name">${escapeHtml(d.department)}</div><div class="kpi-department-meta">ยังไม่มีข้อมูลที่บันทึก</div></div><div class="kpi-percent-badge">0/5</div></div></article>`;
    return `<article class="kpi-department-card"><div class="kpi-department-head"><div><div class="kpi-department-name">${escapeHtml(d.department)}</div><div class="kpi-department-meta">${d.count}/5 คน • ก่อน ${d.beforeAvg.toFixed(1)} นาที → หลัง ${d.afterAvg.toFixed(1)} นาที</div></div><div class="kpi-percent-badge ${d.reduction>=0?'good':'danger'}">${d.reduction.toFixed(1)}%</div></div><div class="kpi-progress"><span style="width:${Math.max(0,Math.min(100,d.reduction))}%"></span></div></article>`;
  }).join('');
  renderKpiSearchChart(deptResults.filter(x=>x.count>0),{beforeAvg,afterAvg,reduction,count:savedCount});
}
function renderKpiSearchChart(deptResults,overall){
  destroyKpiSearchChart();if(typeof Chart==='undefined')return;const canvas=document.getElementById('kpiSearchChart');if(!canvas)return;
  const labels=[...deptResults.map(x=>`${x.department} (${x.count}/5)`),`รวม (${overall.count}/15)`];
  const before=[...deptResults.map(x=>Number(x.beforeAvg.toFixed(2))),Number(overall.beforeAvg.toFixed(2))],after=[...deptResults.map(x=>Number(x.afterAvg.toFixed(2))),Number(overall.afterAvg.toFixed(2))];
  kpiSearchChart=new Chart(canvas.getContext('2d'),{type:'bar',data:{labels,datasets:[{label:'ก่อนใช้แอป',data:before,backgroundColor:'#94a3b8',borderRadius:8},{label:'หลังใช้แอป',data:after,backgroundColor:'#2563eb',borderRadius:8}]},options:{responsive:true,maintainAspectRatio:false,scales:{x:{grid:{display:false}},y:{beginAtZero:true,title:{display:true,text:'เวลา (นาที)'}}},plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(1)} นาที`}}}}});
}
function exportKpiSearchCSV(){
  const rows=getSavedCqiRows();if(!rows.length){alert('ยังไม่มีข้อมูล CQI ที่บันทึกไว้สำหรับ Export');return;}
  const out=[['รอบประเมิน','แผนก','ผู้ทดสอบ','ก่อนใช้แอป (นาที)','หลังใช้แอป (นาที)','ลดเวลา (%)','ผู้บันทึก','อัปเดตล่าสุด']];
  rows.forEach(r=>out.push([KPI_CQI_EVALUATION_CYCLE,r.department,`คนที่ ${r.personNo}`,r.beforeMinutes,r.afterMinutes,r.beforeMinutes>0?(((r.beforeMinutes-r.afterMinutes)/r.beforeMinutes)*100).toFixed(1):'',r.savedBy||'',r.updatedAt||'']));
  const csv=out.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');downloadTextFile('\ufeff'+csv,`CQI_search_time_${rows.length}_of_15.csv`,'text/csv;charset=utf-8');
}
function exportKpiSearchChartPNG(){const c=document.getElementById('kpiSearchChart');if(!kpiSearchChart||!c?.width){alert('ยังไม่มีข้อมูลที่บันทึกสำหรับ Export กราฟ');return;}const a=document.createElement('a');a.href=c.toDataURL('image/png');a.download=`CQI_search_time_${kpiSearchSavedRows.size}_of_15.png`;a.click();}



/* ============================================================
   V1.8.57 — Timeline Incident: open cases first
   When Timeline status = all, unfinished incidents are always
   displayed before closed/cancelled incidents while preserving
   the backend order inside each group. Display-only; no DB change.
   ============================================================ */
function v1857PrioritizeOpenTimelineIncidents(rows){
  const list = Array.isArray(rows) ? rows : [];
  const active = [];
  const finished = [];
  list.forEach(item => {
    if (isFinishedIncident(item)) finished.push(item);
    else active.push(item);
  });
  return active.concat(finished);
}


/* ============================================================
   V1.8.62 — BEM Inbox + Incident Push UX
   ============================================================ */
function v1862BemPriority(status) {
  const text = String(status || '').trim();
  if (text === 'รอ BEM รับเรื่อง') return 0;
  if (text === 'BEM รับเรื่องแล้ว' || text === 'กำลังตรวจสอบ' || text === 'ย้ายเลือดแล้ว / รอติดตาม') return 1;
  if (text === 'ส่งซ่อมภายนอก' || text === 'รออะไหล่ต่างประเทศ') return 2;
  return 3;
}

function v1862SortBemInbox(rows) {
  return (Array.isArray(rows) ? [...rows] : []).sort((a, b) => {
    const p = v1862BemPriority(a?.caseStatus) - v1862BemPriority(b?.caseStatus);
    if (p) return p;
    const ad = `${a?.foundDate || ''} ${a?.foundTime || ''}`;
    const bd = `${b?.foundDate || ''} ${b?.foundTime || ''}`;
    return bd.localeCompare(ad);
  });
}

function v1862RenderBemInboxCounts(rows) {
  const list = Array.isArray(rows) ? rows : [];
  let waiting = 0, working = 0, repair = 0;
  list.forEach(item => {
    const status = String(item?.caseStatus || '').trim();
    if (status === 'รอ BEM รับเรื่อง') waiting += 1;
    else if (status === 'ส่งซ่อมภายนอก' || status === 'รออะไหล่ต่างประเทศ') repair += 1;
    else if (!isFinishedIncident(item)) working += 1;
  });
  const put = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = String(n); };
  put('bemInboxWaitingCount', waiting);
  put('bemInboxWorkingCount', working);
  put('bemInboxRepairCount', repair);
}

async function loadBemInlineTimelineV1862(incidentId) {
  const box = document.getElementById('bemInlineTimeline');
  if (!box) return;
  if (!incidentId) { box.innerHTML = '<div class="small-note">เลือกเคสเพื่อดู Timeline</div>'; return; }
  box.innerHTML = '<div class="small-note">กำลังโหลด Timeline...</div>';
  try {
    const response = await fetch(`${WEB_APP_URL}?action=incident_history&incidentId=${encodeURIComponent(incidentId)}`);
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) { box.innerHTML = '<div class="small-note">ยังไม่มีการอัปเดตเพิ่มเติม</div>'; return; }
    const meaningful = rows.filter(item => {
      const text = `${item?.actionText || ''} ${item?.fixResult || ''}`;
      return !text.includes('พบการบันทึกเหตุผิดปกติซ้ำในตู้เดิม') && !text.includes('โดยไม่สร้าง Incident ใหม่');
    });
    const view = (meaningful.length ? meaningful : rows).slice(-4).reverse();
    box.innerHTML = view.map(item => `
      <div class="bem-inline-timeline-item">
        <div class="bem-inline-timeline-meta"><span>${escapeHtml(item.updatedAt || '-')}</span><span class="status-badge ${getIncidentStatusClass(item.caseStatus)}">${escapeHtml(item.caseStatus || '-')}</span></div>
        <div class="bem-inline-timeline-action">${escapeHtml(item.actionText || item.fixResult || '-')}</div>
        <small>${escapeHtml(staffNameForUI(item.updatedBy || item.owner) || '-')}</small>
      </div>`).join('');
  } catch (error) {
    box.innerHTML = `<div class="small-note">โหลด Timeline ไม่สำเร็จ: ${escapeHtml(error?.message || String(error))}</div>`;
  }
}

function openSelectedBemFullTimelineV1862() {
  const incidentId = document.getElementById('updateIncidentId')?.value?.trim() || '';
  if (!incidentId) { showAppPopup(false, 'ยังไม่ได้เลือก Incident', 'กรุณาเลือกเคสก่อนเปิด Timeline'); return; }
  openTimelineFromTracking(incidentId);
}

const v1862SelectUpdateIncidentBase = selectUpdateIncident;
selectUpdateIncident = function(incidentId) {
  v1862SelectUpdateIncidentBase(incidentId);
  loadBemInlineTimelineV1862(incidentId);
  const panel = document.getElementById('bemSelectedCasePanel');
  if (panel && incidentId) {
    panel.classList.remove('hidden');
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }
};

const v1862ClearIncidentUpdateFormBase = clearIncidentUpdateForm;
clearIncidentUpdateForm = function() {
  v1862ClearIncidentUpdateFormBase();
  const box = document.getElementById('bemInlineTimeline');
  if (box) box.innerHTML = '<div class="small-note">เลือกเคสเพื่อดู Timeline</div>';
};


/* ============================================================
   V1.8.63 — BEM Simple Workflow + follow-up UX
   - One clear outcome selector drives status automatically.
   - "รับงาน" can acknowledge a case before a BEM job number exists.
   - Normal updates require BEM job no + owner + outcome + detail.
   - Successful repair closes the case in the same save.
   - Mobile opens selected case as a full-screen sheet instead of scrolling far down.
   - Long BEM notes are collapsed for readability.
   ============================================================ */
function v1863NormalizeBemStatusForUI(status) {
  const text = String(status || '').trim();
  if (text === 'BEM รับเรื่องแล้ว') return 'กำลังตรวจสอบ';
  if (text === 'ย้ายเลือดแล้ว / รอติดตาม') return 'กำลังตรวจสอบ / ติดตาม';
  return text || '-';
}

function v1863SeemsResolved(item) {
  if (!item || isFinishedIncident(item)) return false;
  const text = `${item.fixResult || ''} ${item.actionText || ''} ${item.logNote || ''}`.toLowerCase();
  if (String(item.fixResult || '').trim() === 'แก้ไขสำเร็จ') return true;
  const patterns = [
    'แก้ไขสำเร็จ', 'แก้ไขเรียบร้อย', 'แก้ได้แล้ว', 'ใช้งานได้ปกติ', 'สามารถใช้งานได้ปกติ',
    'กลับมาใช้งานได้', 'ใช้งานได้ตามปกติ', 'ทดสอบแล้วปกติ', 'เคลียร์ alarm', 'เคลียร์alarm'
  ];
  return patterns.some(token => text.includes(token));
}

function v1863BemPriority(item) {
  const status = String(item?.caseStatus || '').trim();
  if (status === 'รอ BEM รับเรื่อง') return 0;
  if (v1863SeemsResolved(item)) return 1;
  if (!String(item?.bemJobNo || '').trim()) return 2;
  if (status === 'กำลังตรวจสอบ' || status === 'BEM รับเรื่องแล้ว' || status === 'ย้ายเลือดแล้ว / รอติดตาม') return 3;
  if (status === 'ส่งซ่อมภายนอก' || status === 'รออะไหล่ต่างประเทศ') return 4;
  return 5;
}

function v1863SortBemInbox(rows) {
  return (Array.isArray(rows) ? [...rows] : []).sort((a, b) => {
    const p = v1863BemPriority(a) - v1863BemPriority(b);
    if (p) return p;
    const ad = `${a?.foundDate || ''} ${a?.foundTime || ''}`;
    const bd = `${b?.foundDate || ''} ${b?.foundTime || ''}`;
    return bd.localeCompare(ad);
  });
}

function v1863RenderBemInboxCounts(rows) {
  const list = Array.isArray(rows) ? rows : [];
  let waiting = 0, working = 0, review = 0;
  list.forEach(item => {
    if (isFinishedIncident(item)) return;
    const status = String(item?.caseStatus || '').trim();
    if (status === 'รอ BEM รับเรื่อง') waiting += 1;
    else working += 1;
    if (v1863SeemsResolved(item)) review += 1;
  });
  const put = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = String(n); };
  put('bemInboxWaitingCount', waiting);
  put('bemInboxWorkingCount', working);
  put('bemInboxReviewCount', review);
}

function v1863CardAlert(item) {
  if (v1863SeemsResolved(item)) return '<div class="bem-card-alert is-close">✅ รายละเอียดดูเหมือนแก้แล้ว • ตรวจและปิดเคส</div>';
  if (!String(item?.bemJobNo || '').trim() && String(item?.caseStatus || '').trim() !== 'รอ BEM รับเรื่อง') {
    return '<div class="bem-card-alert is-missing">⚠️ ยังไม่มีเลขงาน BEM</div>';
  }
  return '';
}

loadOpenIncidentList = async function() {
  const select = document.getElementById('updateIncidentSelect');
  const resultBox = document.getElementById('updateIncidentResult');
  const cardList = document.getElementById('updateIncidentCardList');
  if (!select || !cardList) return;

  const loadSeq = ++updateIncidentLoadSeq;
  const dateFilter = document.getElementById('updateIncidentDateFilter')?.value || 'all';
  const statusFilter = document.getElementById('updateIncidentStatusFilter')?.value || 'active';
  const backendStatusFilter = backendIncidentStatusFilter(statusFilter);
  const startDate = document.getElementById('updateIncidentStartDate')?.value || '';
  const endDate = document.getElementById('updateIncidentEndDate')?.value || '';
  const fridgeSearch = document.getElementById('updateIncidentFridgeSearch')?.value?.trim() || '';

  select.innerHTML = '<option value="">-- เลือก Incident ID --</option>';
  cardList.innerHTML = '';
  updateIncidentListCache = [];
  try {
    const url = `${WEB_APP_URL}?action=incident_list&dateFilter=${encodeURIComponent(dateFilter)}&statusFilter=${encodeURIComponent(backendStatusFilter)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&fridgeSearch=${encodeURIComponent(fridgeSearch)}`;
    const response = await fetch(url);
    let data = await response.json();
    data = uniqueIncidentsById(data);
    data = filterIncidentRowsByUiStatus(data, statusFilter);
    data = v1863SortBemInbox(data);
    v1863RenderBemInboxCounts(data);
    if (loadSeq !== updateIncidentLoadSeq) return;
    if (!Array.isArray(data) || !data.length) {
      showResult(resultBox, true, 'ไม่พบ Incident ตามตัวกรอง');
      renderUpdateIncidentSummary(null);
      return;
    }
    updateIncidentListCache = data;
    const options = document.createDocumentFragment();
    const cards = document.createDocumentFragment();
    data.slice(0, 50).forEach(item => {
      const option = document.createElement('option');
      option.value = item.incidentId;
      option.textContent = item.incidentId;
      options.appendChild(option);

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'bem-incident-card';
      card.dataset.incidentId = item.incidentId || '';
      card.onclick = () => selectUpdateIncident(item.incidentId);
      card.innerHTML = `
        <div class="bem-incident-card-head">
          <strong>${escapeHtml(item.incidentId || '-')}</strong>
          <span class="status-badge ${getIncidentStatusClass(item.caseStatus)}">${escapeHtml(v1863NormalizeBemStatusForUI(item.caseStatus))}</span>
        </div>
        <div class="bem-incident-card-body">
          <div><span>ตู้</span><strong>${escapeHtml(item.fridgeId || '-')}</strong></div>
          <div><span>สถานที่</span><strong>${escapeHtml(item.room || '-')}</strong></div>
          <div><span>วันเวลา</span><strong>${escapeHtml(item.foundDate || '-')} ${escapeHtml(item.foundTime || '-')}</strong></div>
          <div><span>เลขงาน BEM</span><strong>${escapeHtml(item.bemJobNo || 'ยังไม่ได้กรอก')}</strong></div>
        </div>
        ${v1863CardAlert(item)}
        <div class="bem-card-select-label">เปิดเคส</div>`;
      cards.appendChild(card);
    });
    select.appendChild(options);
    cardList.appendChild(cards);
    const reviewCount = data.filter(v1863SeemsResolved).length;
    const missingJob = data.filter(item => !isFinishedIncident(item) && !String(item.bemJobNo || '').trim()).length;
    const extra = [reviewCount ? `ควรตรวจปิด ${reviewCount}` : '', missingJob ? `ยังไม่มีเลขงาน ${missingJob}` : ''].filter(Boolean).join(' • ');
    showResult(resultBox, true, `พบ ${data.length} เคสที่ยังไม่ปิด${extra ? ` • ${extra}` : ''}`);
  } catch (error) {
    if (loadSeq !== updateIncidentLoadSeq) return;
    showResult(resultBox, false, 'โหลด Incident ไม่สำเร็จ: ' + (error?.message || error));
  }
};

renderUpdateIncidentSummary = function(item) {
  const box = document.getElementById('updateIncidentSummary');
  if (!box) return;
  if (!item) {
    box.classList.add('hidden');
    box.innerHTML = '';
    setCurrentIncidentStatusLabel('');
    return;
  }
  const original = String(item.logNote || item.actionText || '').trim();
  const closeHint = v1863SeemsResolved(item)
    ? '<div class="bem-summary-close-hint">✅ ข้อความเดิมมีลักษณะว่าแก้ไขแล้ว แต่เคสยังเปิดอยู่ กรุณาตรวจสอบ ถ้าจบงานแล้วเลือก “แก้ไขเรียบร้อย” และบันทึกเพื่อปิดเคส</div>'
    : '';
  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="incident-summary-title">${escapeHtml(item.incidentId || '-')}</div>
    ${closeHint}
    <div class="incident-summary-grid bem-summary-grid-v1863">
      <div><strong>ตู้:</strong> ${escapeHtml(item.fridgeId || '-')}</div>
      <div><strong>สถานที่:</strong> ${escapeHtml(item.room || '-')}</div>
      <div><strong>เกิดเหตุ:</strong> ${escapeHtml(item.foundDate || '-')} ${escapeHtml(item.foundTime || '-')}</div>
      <div><strong>อุณหภูมิ:</strong> ${item.temp === null || item.temp === undefined ? '-' : escapeHtml(item.temp)} °C</div>
      <div><strong>เลขงาน BEM:</strong> ${escapeHtml(item.bemJobNo || 'ยังไม่ได้กรอก')}</div>
      <div><strong>ผู้รายงาน:</strong> ${escapeHtml(staffNameForUI(item.reporter) || '-')}</div>
    </div>
    ${original ? `<details class="bem-original-detail"><summary>ดูรายละเอียดตอนเปิดเคส</summary><div>${escapeHtml(original)}</div></details>` : ''}`;
  setCurrentIncidentStatusLabel(v1863NormalizeBemStatusForUI(item.caseStatus));
};

function v1863ResetBemFieldErrors() {
  ['updateBEMJobNo','updateOwner','updateFixResult','updateActionText'].forEach(id => {
    const el = document.getElementById(id);
    el?.classList.remove('bem-field-invalid');
    el?.removeAttribute('aria-invalid');
  });
  document.querySelectorAll('.bem-required-field.is-invalid').forEach(el => el.classList.remove('is-invalid'));
}

function v1863MarkInvalid(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('bem-field-invalid');
  el.setAttribute('aria-invalid','true');
  el.closest('.bem-required-field')?.classList.add('is-invalid');
}

function v1863ValidateBemUpdate() {
  v1863ResetBemFieldErrors();
  const missing = [];
  const checks = [
    ['updateBEMJobNo','เลขงาน BEM'],
    ['updateOwner','ผู้ดำเนินการ / ผู้รับผิดชอบ'],
    ['updateFixResult','ผลการดำเนินงาน'],
    ['updateActionText','สรุปการดำเนินงาน']
  ];
  checks.forEach(([id,label]) => {
    const el = document.getElementById(id);
    if (!String(el?.value || '').trim()) { missing.push(label); v1863MarkInvalid(id); }
  });
  if (missing.length) {
    const first = document.querySelector('.bem-field-invalid');
    first?.focus();
    first?.scrollIntoView({behavior:'smooth', block:'center'});
    showAppPopup(false, 'ข้อมูลยังไม่ครบ', `กรุณากรอกให้ครบก่อนบันทึก:\n• ${missing.join('\n• ')}`);
    showResult(document.getElementById('updateIncidentResult'), false, `ข้อมูลยังไม่ครบ: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

onBEMFixResultChange = function() {
  const fixResult = document.getElementById('updateFixResult')?.value?.trim() || '';
  const statusEl = document.getElementById('updateCaseStatus');
  const help = document.getElementById('bemOutcomeHelp');
  if (!statusEl) return;
  if (fixResult === 'แก้ไขสำเร็จ') {
    statusEl.value = 'ปิดเคส';
    if (help) help.textContent = 'บันทึกครั้งนี้แล้วเคสจะปิดทันที ถือว่าจบงาน ไม่ต้องปิดซ้ำ';
  } else if (fixResult === 'รอช่างภายนอก') {
    statusEl.value = 'ส่งซ่อมภายนอก';
    if (help) help.textContent = 'ระบบจะคงเคสไว้ใน BEM Inbox เพื่อให้ติดตามต่อ';
  } else if (fixResult === 'ยังแก้ไขไม่ได้') {
    statusEl.value = 'กำลังตรวจสอบ';
    if (help) help.textContent = 'ระบบจะคงเคสไว้ใน BEM Inbox เพื่อให้ติดตามต่อ';
  } else {
    statusEl.value = '';
    if (help) help.textContent = 'เลือกผลให้ตรงกับงานจริง ระบบจะกำหนดสถานะให้เอง';
  }
};

async function loadBemInlineTimelineV1863(incidentId) {
  const box = document.getElementById('bemInlineTimeline');
  if (!box) return;
  if (!incidentId) { box.innerHTML = '<div class="small-note">เลือกเคสเพื่อดู Timeline</div>'; return; }
  box.innerHTML = '<div class="small-note">กำลังโหลด Timeline...</div>';
  try {
    const response = await fetch(`${WEB_APP_URL}?action=incident_history&incidentId=${encodeURIComponent(incidentId)}`);
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) { box.innerHTML = '<div class="small-note">ยังไม่มีการอัปเดตเพิ่มเติม</div>'; return; }
    const meaningful = rows.filter(item => {
      const text = `${item?.actionText || ''} ${item?.fixResult || ''}`;
      return !text.includes('พบการบันทึกเหตุผิดปกติซ้ำในตู้เดิม') && !text.includes('โดยไม่สร้าง Incident ใหม่');
    });
    const view = (meaningful.length ? meaningful : rows).slice(-4).reverse();
    box.innerHTML = view.map((item, index) => {
      const detail = String(item.actionText || item.fixResult || '-').trim();
      const isLong = detail.length > 160;
      const shortText = isLong ? `${detail.slice(0, 160).trim()}…` : detail;
      return `
        <div class="bem-inline-timeline-item">
          <div class="bem-inline-timeline-meta"><span>${escapeHtml(item.updatedAt || '-')}</span><span class="status-badge ${getIncidentStatusClass(item.caseStatus)}">${escapeHtml(v1863NormalizeBemStatusForUI(item.caseStatus))}</span></div>
          <div class="bem-inline-timeline-action">${escapeHtml(shortText)}</div>
          ${isLong ? `<details class="bem-timeline-more"><summary>อ่านรายละเอียดทั้งหมด</summary><div>${escapeHtml(detail)}</div></details>` : ''}
          <small>${escapeHtml(staffNameForUI(item.updatedBy || item.owner) || '-')}</small>
        </div>`;
    }).join('');
  } catch (error) {
    box.innerHTML = `<div class="small-note">โหลด Timeline ไม่สำเร็จ: ${escapeHtml(error?.message || String(error))}</div>`;
  }
}

selectUpdateIncident = function(incidentId) {
  const item = (Array.isArray(updateIncidentListCache) ? updateIncidentListCache : []).find(x => x.incidentId === incidentId) || null;
  const select = document.getElementById('updateIncidentSelect');
  const input = document.getElementById('updateIncidentId');
  if (select && incidentId) select.value = incidentId;
  if (input) input.value = incidentId || '';
  document.querySelectorAll('#updateIncidentCardList .bem-incident-card').forEach(card => card.classList.toggle('selected', card.dataset.incidentId === incidentId));

  v1863ResetBemFieldErrors();
  const bemJob = document.getElementById('updateBEMJobNo');
  const owner = document.getElementById('updateOwner');
  const fix = document.getElementById('updateFixResult');
  const action = document.getElementById('updateActionText');
  const status = document.getElementById('updateCaseStatus');
  if (bemJob) bemJob.value = item?.bemJobNo || '';
  if (owner) owner.value = staffNameForUI(item?.owner) || owner.value || '';
  if (fix) fix.value = '';
  if (action) action.value = '';
  if (status) status.value = '';
  syncLoginIdentityFields();
  renderUpdateIncidentSummary(item);
  loadBemInlineTimelineV1863(incidentId);

  const resendBtn = document.getElementById('resendSelectedIncidentBtn');
  if (resendBtn) resendBtn.disabled = !incidentId || !canResendIncidentStatus(item?.caseStatus);
  const acceptBtn = document.getElementById('bemAcceptBtn');
  const acceptHelp = document.getElementById('bemAcceptHelp');
  const waiting = String(item?.caseStatus || '').trim() === 'รอ BEM รับเรื่อง';
  if (acceptBtn) {
    acceptBtn.disabled = !waiting;
    acceptBtn.textContent = waiting ? 'รับงาน / เริ่มตรวจสอบ' : 'รับงานแล้ว ✓';
  }
  if (acceptHelp) acceptHelp.textContent = waiting
    ? 'กรอกชื่อผู้รับผิดชอบด้านล่างแล้วกดรับงานได้ก่อน แม้ยังไม่มีเลขงาน BEM เพื่อให้ทุกคนเห็นว่ามี BEM เริ่มดูเคสแล้ว'
    : 'เคสนี้มี BEM รับงานแล้ว ให้บันทึกผลด้านล่างเมื่อมีความคืบหน้า';

  const panel = document.getElementById('bemSelectedCasePanel');
  if (panel && incidentId) panel.classList.remove('hidden');
  document.body.classList.toggle('bem-case-open', !!incidentId && window.matchMedia('(max-width: 720px)').matches);
  if (window.matchMedia('(min-width: 721px)').matches) setTimeout(() => panel?.scrollIntoView({behavior:'smooth',block:'start'}), 80);
};

function closeBemSelectedCasePanelV1863() {
  const panel = document.getElementById('bemSelectedCasePanel');
  if (panel) panel.classList.add('hidden');
  document.body.classList.remove('bem-case-open');
  document.querySelectorAll('#updateIncidentCardList .bem-incident-card.selected').forEach(card => card.classList.remove('selected'));
  ['updateIncidentSelect','updateIncidentId','updateBEMJobNo','updateCaseStatus','updateOwner','updateActionText','updateFixResult','updateBy'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  v1863ResetBemFieldErrors();
  renderUpdateIncidentSummary(null);
  const box = document.getElementById('bemInlineTimeline');
  if (box) box.innerHTML = '<div class="small-note">เลือกเคสเพื่อดู Timeline</div>';
}

clearIncidentUpdateForm = closeBemSelectedCasePanelV1863;

async function acceptBemIncidentV1863() {
  const incidentId = document.getElementById('updateIncidentId')?.value?.trim() || '';
  const ownerInput = document.getElementById('updateOwner');
  let ownerRaw = ownerInput?.value?.trim() || '';
  if (!incidentId) { showAppPopup(false,'ยังไม่ได้เลือก Incident','กรุณาเลือกเคสก่อน'); return; }
  if (!ownerRaw) {
    syncLoginIdentityFields();
    ownerRaw = ownerInput?.value?.trim() || getCurrentActorFullName() || '';
  }
  if (!ownerRaw) {
    v1863MarkInvalid('updateOwner');
    ownerInput?.focus();
    showAppPopup(false,'กรุณากรอกผู้รับผิดชอบ','การกดรับงานต้องระบุว่าใครเป็นผู้รับผิดชอบเคสนี้');
    return;
  }
  const owner = await resolveStaffFullNameForUI(ownerRaw);
  const actorQuery = AUTH_DISABLED_TEMPORARILY ? '' : `&actorUserId=${encodeURIComponent(getCurrentActorId())}&actorEmail=${encodeURIComponent(getCurrentActorEmail())}&actorFullName=${encodeURIComponent(getCurrentActorFullName())}&actorRole=${encodeURIComponent(getCurrentActorRole())}`;
  const url = `${WEB_APP_URL}?action=incident_update&incidentId=${encodeURIComponent(incidentId)}&bemJobNo=${encodeURIComponent(document.getElementById('updateBEMJobNo')?.value?.trim() || '')}&caseStatus=${encodeURIComponent('กำลังตรวจสอบ')}&owner=${encodeURIComponent(owner)}&actionText=${encodeURIComponent('BEM รับงานแล้ว เริ่มตรวจสอบ')}&fixResult=&updatedBy=${encodeURIComponent(owner)}&updatedByEmail=${encodeURIComponent(getCurrentActorEmail())}&acceptOnly=1${actorQuery}`;
  const btn = document.getElementById('bemAcceptBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'กำลังรับงาน...'; }
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || 'รับงานไม่สำเร็จ');
    showAppPopup(true,'รับงานแล้ว','สถานะเปลี่ยนเป็น “กำลังตรวจสอบ” แล้ว\nเมื่อมีผล ให้กรอกข้อมูลด้านล่างและกดบันทึก');
    await loadOpenIncidentList();
    if ((updateIncidentListCache || []).some(item => item.incidentId === incidentId)) selectUpdateIncident(incidentId);
    else closeBemSelectedCasePanelV1863();
  } catch (error) {
    showAppPopup(false,'รับงานไม่สำเร็จ',error?.message || String(error));
    if (btn) { btn.disabled = false; btn.textContent = 'รับงาน / เริ่มตรวจสอบ'; }
  }
}

submitIncidentUpdate = async function() {
  const incidentId = document.getElementById('updateIncidentId')?.value?.trim() || '';
  if (!incidentId) { showAppPopup(false,'ยังไม่ได้เลือก Incident','กรุณาเลือกเคสก่อนบันทึก'); return; }
  if (!v1863ValidateBemUpdate()) return;

  const bemJobNo = document.getElementById('updateBEMJobNo')?.value?.trim() || '';
  const fixResult = document.getElementById('updateFixResult')?.value?.trim() || '';
  const actionText = document.getElementById('updateActionText')?.value?.trim() || '';
  let caseStatus = 'กำลังตรวจสอบ';
  if (fixResult === 'รอช่างภายนอก') caseStatus = 'ส่งซ่อมภายนอก';
  if (fixResult === 'แก้ไขสำเร็จ') caseStatus = 'ปิดเคส';
  const statusEl = document.getElementById('updateCaseStatus');
  if (statusEl) statusEl.value = caseStatus;
  syncLoginIdentityFields();
  const ownerRaw = AUTH_DISABLED_TEMPORARILY
    ? (document.getElementById('updateOwner')?.value?.trim() || '')
    : (getCurrentActorFullName() || document.getElementById('updateOwner')?.value?.trim() || '');
  const owner = await resolveStaffFullNameForUI(ownerRaw);
  const updatedBy = owner;
  const resultBox = document.getElementById('updateIncidentResult');
  const actorQuery = AUTH_DISABLED_TEMPORARILY ? '' : `&actorUserId=${encodeURIComponent(getCurrentActorId())}&actorEmail=${encodeURIComponent(getCurrentActorEmail())}&actorFullName=${encodeURIComponent(getCurrentActorFullName())}&actorRole=${encodeURIComponent(getCurrentActorRole())}`;
  const url = `${WEB_APP_URL}?action=incident_update&incidentId=${encodeURIComponent(incidentId)}&bemJobNo=${encodeURIComponent(bemJobNo)}&caseStatus=${encodeURIComponent(caseStatus)}&owner=${encodeURIComponent(owner)}&actionText=${encodeURIComponent(actionText)}&fixResult=${encodeURIComponent(fixResult)}&updatedBy=${encodeURIComponent(updatedBy)}&updatedByEmail=${encodeURIComponent(getCurrentActorEmail())}${actorQuery}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || 'บันทึกไม่สำเร็จ');
    const closed = String(data.caseStatus || caseStatus).trim() === 'ปิดเคส';
    showAppPopup(true, closed ? 'บันทึกแล้ว • ปิดเคสเรียบร้อย' : 'บันทึกความคืบหน้าแล้ว', closed
      ? `Incident: ${data.incidentId || incidentId}\nเลขงาน BEM: ${data.bemJobNo || bemJobNo}\nเคสนี้จบงานแล้ว ไม่ต้องกลับมาปิดซ้ำ`
      : `Incident: ${data.incidentId || incidentId}\nสถานะ: ${v1863NormalizeBemStatusForUI(data.caseStatus || caseStatus)}\nระบบจะคงเคสไว้ใน BEM Inbox เพื่อให้ติดตามต่อ`);
    showResult(resultBox, true, closed ? 'ปิดเคสเรียบร้อย' : 'บันทึกความคืบหน้าเรียบร้อย');
    closeBemSelectedCasePanelV1863();
    await loadOpenIncidentList();
    await refreshBEMMenuCounts();
  } catch (error) {
    const msg = error?.message || String(error);
    showResult(resultBox, false, msg);
    showAppPopup(false,'บันทึกไม่สำเร็จ',msg);
  }
};

['updateBEMJobNo','updateOwner','updateFixResult','updateActionText'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    const clear = () => {
      if (String(el.value || '').trim()) {
        el.classList.remove('bem-field-invalid'); el.removeAttribute('aria-invalid');
        el.closest('.bem-required-field')?.classList.remove('is-invalid');
      }
    };
    el.addEventListener('input', clear); el.addEventListener('change', clear);
  }
});


/* ============================================================
   V1.8.64 — BEM Visual UI
   UI-only: reduce reading load, use visual status/actions, keep v1.8.63 workflow.
   ============================================================ */
function v1864OutcomeButtonsSync(value) {
  const current = String(value || '').trim();
  document.querySelectorAll('.bem-v64-outcome-btn').forEach(btn => {
    const active = btn.dataset.value === current;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  const note = document.getElementById('bemV64CloseNote');
  if (note) note.classList.toggle('hidden', current !== 'แก้ไขสำเร็จ');
}

function v1864SelectBemOutcome(value) {
  const select = document.getElementById('updateFixResult');
  if (!select) return;
  select.value = value || '';
  select.dispatchEvent(new Event('change', { bubbles: true }));
  select.classList.remove('bem-field-invalid');
  select.closest('.bem-required-field')?.classList.remove('is-invalid');
  v1864OutcomeButtonsSync(value);
}

onBEMFixResultChange = function() {
  const fixResult = document.getElementById('updateFixResult')?.value?.trim() || '';
  const statusEl = document.getElementById('updateCaseStatus');
  const help = document.getElementById('bemOutcomeHelp');
  if (!statusEl) return;
  if (fixResult === 'แก้ไขสำเร็จ') {
    statusEl.value = 'ปิดเคส';
    if (help) help.textContent = 'บันทึกแล้วปิดเคส';
  } else if (fixResult === 'รอช่างภายนอก') {
    statusEl.value = 'ส่งซ่อมภายนอก';
    if (help) help.textContent = 'เคสยังอยู่ใน Inbox';
  } else if (fixResult === 'ยังแก้ไขไม่ได้') {
    statusEl.value = 'กำลังตรวจสอบ';
    if (help) help.textContent = 'เคสยังอยู่ใน Inbox';
  } else {
    statusEl.value = '';
    if (help) help.textContent = 'เลือกสถานะงาน';
  }
  v1864OutcomeButtonsSync(fixResult);
};

function v1864CardAlert(item) {
  if (v1863SeemsResolved(item)) return '<span class="bem-v64-chip is-close">✅ ตรวจปิด</span>';
  if (!String(item?.bemJobNo || '').trim() && String(item?.caseStatus || '').trim() !== 'รอ BEM รับเรื่อง') {
    return '<span class="bem-v64-chip is-missing">⚠️ ไม่มีเลขงาน</span>';
  }
  return '';
}

loadOpenIncidentList = async function() {
  const select = document.getElementById('updateIncidentSelect');
  const resultBox = document.getElementById('updateIncidentResult');
  const cardList = document.getElementById('updateIncidentCardList');
  if (!select || !cardList) return;

  const loadSeq = ++updateIncidentLoadSeq;
  const dateFilter = document.getElementById('updateIncidentDateFilter')?.value || 'all';
  const statusFilter = document.getElementById('updateIncidentStatusFilter')?.value || 'active';
  const backendStatusFilter = backendIncidentStatusFilter(statusFilter);
  const startDate = document.getElementById('updateIncidentStartDate')?.value || '';
  const endDate = document.getElementById('updateIncidentEndDate')?.value || '';
  const fridgeSearch = document.getElementById('updateIncidentFridgeSearch')?.value?.trim() || '';

  select.innerHTML = '<option value="">-- เลือก Incident ID --</option>';
  cardList.innerHTML = '';
  updateIncidentListCache = [];
  try {
    const url = `${WEB_APP_URL}?action=incident_list&dateFilter=${encodeURIComponent(dateFilter)}&statusFilter=${encodeURIComponent(backendStatusFilter)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&fridgeSearch=${encodeURIComponent(fridgeSearch)}`;
    const response = await fetch(url);
    let data = await response.json();
    data = uniqueIncidentsById(data);
    data = filterIncidentRowsByUiStatus(data, statusFilter);
    data = v1863SortBemInbox(data);
    v1863RenderBemInboxCounts(data);
    if (loadSeq !== updateIncidentLoadSeq) return;
    if (!Array.isArray(data) || !data.length) {
      showResult(resultBox, true, 'ไม่พบเคส');
      renderUpdateIncidentSummary(null);
      return;
    }
    updateIncidentListCache = data;
    const options = document.createDocumentFragment();
    const cards = document.createDocumentFragment();
    data.slice(0, 50).forEach(item => {
      const option = document.createElement('option');
      option.value = item.incidentId;
      option.textContent = item.incidentId;
      options.appendChild(option);

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'bem-incident-card bem-v64-card';
      card.dataset.incidentId = item.incidentId || '';
      card.onclick = () => selectUpdateIncident(item.incidentId);
      const job = String(item.bemJobNo || '').trim();
      card.innerHTML = `
        <div class="bem-v64-card-top">
          <span class="bem-v64-id">${escapeHtml(item.incidentId || '-')}</span>
          <span class="status-badge ${getIncidentStatusClass(item.caseStatus)}">${escapeHtml(v1863NormalizeBemStatusForUI(item.caseStatus))}</span>
        </div>
        <div class="bem-v64-card-main">
          <strong>${escapeHtml(item.fridgeId || '-')}</strong>
          <span>${escapeHtml(item.room || '-')}</span>
        </div>
        <div class="bem-v64-card-meta">
          <span>🕒 ${escapeHtml(item.foundDate || '-')} ${escapeHtml(item.foundTime || '')}</span>
          ${job ? `<span>🔧 ${escapeHtml(job)}</span>` : ''}
        </div>
        <div class="bem-v64-card-foot">
          <div>${v1864CardAlert(item)}</div>
          <span class="bem-v64-open">เปิด ›</span>
        </div>`;
      cards.appendChild(card);
    });
    select.appendChild(options);
    cardList.appendChild(cards);
    const reviewCount = data.filter(v1863SeemsResolved).length;
    const missingJob = data.filter(item => !isFinishedIncident(item) && !String(item.bemJobNo || '').trim()).length;
    const bits = [`${data.length} เคส`];
    if (reviewCount) bits.push(`ตรวจปิด ${reviewCount}`);
    if (missingJob) bits.push(`ไม่มีเลขงาน ${missingJob}`);
    showResult(resultBox, true, bits.join(' • '));
  } catch (error) {
    if (loadSeq !== updateIncidentLoadSeq) return;
    showResult(resultBox, false, 'โหลด Incident ไม่สำเร็จ: ' + (error?.message || error));
  }
};

renderUpdateIncidentSummary = function(item) {
  const box = document.getElementById('updateIncidentSummary');
  const title = document.getElementById('bemV64CaseTitle');
  if (!box) return;
  if (!item) {
    box.classList.add('hidden');
    box.innerHTML = '';
    if (title) title.textContent = 'Incident';
    setCurrentIncidentStatusLabel('');
    return;
  }
  if (title) title.textContent = item.fridgeId ? `${item.fridgeId} · ${item.room || ''}` : (item.incidentId || 'Incident');
  const original = String(item.logNote || item.actionText || '').trim();
  const closeHint = v1863SeemsResolved(item)
    ? '<div class="bem-v64-resolved-hint">✅ ดูเหมือนแก้แล้ว — ถ้าจบงาน เลือก <b>จบงาน</b></div>'
    : '';
  const temp = item.temp === null || item.temp === undefined ? '-' : `${escapeHtml(item.temp)} °C`;
  box.classList.remove('hidden');
  box.innerHTML = `
    <div class="bem-v64-summary-top">
      <span class="bem-v64-incident-id">${escapeHtml(item.incidentId || '-')}</span>
      ${closeHint}
    </div>
    <div class="bem-v64-facts">
      <span>🕒 ${escapeHtml(item.foundDate || '-')} ${escapeHtml(item.foundTime || '')}</span>
      <span>🌡️ ${temp}</span>
      <span>👤 ${escapeHtml(staffNameForUI(item.reporter) || '-')}</span>
      ${item.bemJobNo ? `<span>🔧 ${escapeHtml(item.bemJobNo)}</span>` : ''}
    </div>
    ${original ? `<details class="bem-original-detail bem-v64-original"><summary>อาการที่แจ้ง</summary><div>${escapeHtml(original)}</div></details>` : ''}`;
  setCurrentIncidentStatusLabel(v1863NormalizeBemStatusForUI(item.caseStatus));
};

loadBemInlineTimelineV1863 = async function(incidentId) {
  const box = document.getElementById('bemInlineTimeline');
  if (!box) return;
  if (!incidentId) { box.innerHTML = '<div class="small-note">ยังไม่ได้เลือกเคส</div>'; return; }
  box.innerHTML = '<div class="small-note">กำลังโหลด...</div>';
  try {
    const response = await fetch(`${WEB_APP_URL}?action=incident_history&incidentId=${encodeURIComponent(incidentId)}`);
    const rows = await response.json();
    if (!Array.isArray(rows) || !rows.length) { box.innerHTML = '<div class="small-note">ยังไม่มีการอัปเดต</div>'; return; }
    const meaningful = rows.filter(item => {
      const text = `${item?.actionText || ''} ${item?.fixResult || ''}`;
      return !text.includes('พบการบันทึกเหตุผิดปกติซ้ำในตู้เดิม') && !text.includes('โดยไม่สร้าง Incident ใหม่');
    });
    const view = (meaningful.length ? meaningful : rows).slice(-2).reverse();
    box.innerHTML = view.map(item => {
      const detail = String(item.actionText || item.fixResult || '-').trim();
      const isLong = detail.length > 105;
      const shortText = isLong ? `${detail.slice(0, 105).trim()}…` : detail;
      return `
        <div class="bem-inline-timeline-item bem-v64-timeline-item">
          <div class="bem-inline-timeline-meta"><span>${escapeHtml(item.updatedAt || '-')}</span><span class="status-badge ${getIncidentStatusClass(item.caseStatus)}">${escapeHtml(v1863NormalizeBemStatusForUI(item.caseStatus))}</span></div>
          <div class="bem-inline-timeline-action">${escapeHtml(shortText)}</div>
          ${isLong ? `<details class="bem-timeline-more"><summary>อ่านต่อ</summary><div>${escapeHtml(detail)}</div></details>` : ''}
          <small>${escapeHtml(staffNameForUI(item.updatedBy || item.owner) || '-')}</small>
        </div>`;
    }).join('');
  } catch (error) {
    box.innerHTML = `<div class="small-note">โหลดไม่สำเร็จ: ${escapeHtml(error?.message || String(error))}</div>`;
  }
};

selectUpdateIncident = function(incidentId) {
  const item = (Array.isArray(updateIncidentListCache) ? updateIncidentListCache : []).find(x => x.incidentId === incidentId) || null;
  const select = document.getElementById('updateIncidentSelect');
  const input = document.getElementById('updateIncidentId');
  if (select && incidentId) select.value = incidentId;
  if (input) input.value = incidentId || '';
  document.querySelectorAll('#updateIncidentCardList .bem-incident-card').forEach(card => card.classList.toggle('selected', card.dataset.incidentId === incidentId));

  v1863ResetBemFieldErrors();
  const bemJob = document.getElementById('updateBEMJobNo');
  const owner = document.getElementById('updateOwner');
  const fix = document.getElementById('updateFixResult');
  const action = document.getElementById('updateActionText');
  const status = document.getElementById('updateCaseStatus');
  if (bemJob) bemJob.value = item?.bemJobNo || '';
  if (owner) owner.value = staffNameForUI(item?.owner) || owner.value || '';
  if (fix) fix.value = '';
  if (action) action.value = '';
  if (status) status.value = '';
  v1864OutcomeButtonsSync('');
  syncLoginIdentityFields();
  renderUpdateIncidentSummary(item);
  loadBemInlineTimelineV1863(incidentId);

  const history = document.getElementById('bemV64HistoryBox');
  if (history) history.open = false;
  const acceptBtn = document.getElementById('bemAcceptBtn');
  const acceptHelp = document.getElementById('bemAcceptHelp');
  const waiting = String(item?.caseStatus || '').trim() === 'รอ BEM รับเรื่อง';
  if (acceptBtn) {
    acceptBtn.disabled = !waiting;
    acceptBtn.textContent = waiting ? 'รับงาน' : 'รับแล้ว ✓';
  }
  if (acceptHelp) acceptHelp.textContent = waiting ? 'กดรับงานก่อนเริ่ม' : '';

  const panel = document.getElementById('bemSelectedCasePanel');
  if (panel && incidentId) panel.classList.remove('hidden');
  document.body.classList.toggle('bem-case-open', !!incidentId && window.matchMedia('(max-width: 720px)').matches);
  if (window.matchMedia('(min-width: 721px)').matches) setTimeout(() => panel?.scrollIntoView({behavior:'smooth',block:'start'}), 60);
};

const v1864CloseBemBase = closeBemSelectedCasePanelV1863;
closeBemSelectedCasePanelV1863 = function() {
  v1864CloseBemBase();
  v1864OutcomeButtonsSync('');
  const note = document.getElementById('bemV64CloseNote');
  if (note) note.classList.add('hidden');
  const title = document.getElementById('bemV64CaseTitle');
  if (title) title.textContent = 'Incident';
};
clearIncidentUpdateForm = closeBemSelectedCasePanelV1863;

// V1.8.64 clarity: summary counts are mutually exclusive.
v1863RenderBemInboxCounts = function(rows) {
  const list = Array.isArray(rows) ? rows : [];
  let waiting = 0, working = 0, review = 0;
  list.forEach(item => {
    if (isFinishedIncident(item)) return;
    const status = String(item?.caseStatus || '').trim();
    if (status === 'รอ BEM รับเรื่อง') waiting += 1;
    else if (v1863SeemsResolved(item)) review += 1;
    else working += 1;
  });
  const put = (id, n) => { const el = document.getElementById(id); if (el) el.textContent = String(n); };
  put('bemInboxWaitingCount', waiting);
  put('bemInboxWorkingCount', working);
  put('bemInboxReviewCount', review);
};

v1863ValidateBemUpdate = function() {
  v1863ResetBemFieldErrors();
  const missing = [];
  const checks = [
    ['updateBEMJobNo','เลขงาน BEM'],
    ['updateOwner','ผู้รับผิดชอบ'],
    ['updateFixResult','ผลการดำเนินงาน'],
    ['updateActionText','สรุปสิ่งที่ทำ']
  ];
  checks.forEach(([id,label]) => {
    const el = document.getElementById(id);
    if (!String(el?.value || '').trim()) { missing.push(label); v1863MarkInvalid(id); }
  });
  if (missing.length) {
    const visibleInvalid = document.querySelector('.bem-required-field.is-invalid input:not(.bem-v64-hidden-select), .bem-required-field.is-invalid textarea, .bem-required-field.is-invalid .bem-v64-outcome-grid');
    visibleInvalid?.scrollIntoView({behavior:'smooth', block:'center'});
    if (visibleInvalid && typeof visibleInvalid.focus === 'function') visibleInvalid.focus();
    showAppPopup(false, 'กรอกอีกนิด', missing.join(' • '));
    showResult(document.getElementById('updateIncidentResult'), false, `ยังขาด: ${missing.join(' • ')}`);
    return false;
  }
  return true;
};


/* ============================================================
   V1.8.65 — Global UI Cleanup enhancements
   Keep data logic intact; improve first-load experience only.
   ============================================================ */
let kpiAutoLoadedV1865 = false;
const initKpiPageBeforeV1865 = initKpiPage;
initKpiPage = async function initKpiPageV1865(){
  await initKpiPageBeforeV1865();
  if (kpiAutoLoadedV1865) return;
  const metric = getSelectedKpiMetric();
  const department = document.getElementById('kpiDepartment')?.value || '';
  if (metric !== 'search_time' && department) {
    kpiAutoLoadedV1865 = true;
    try { await loadKpiPage(); } catch (e) { /* existing KPI UI handles errors */ }
  }
};


/* ============================================================
   V1.8.67 — BEM Timeline pagination + aligned workflow status
   - Timeline status labels follow BEM Inbox: ใหม่ / กำลังทำ / ตรวจปิด
   - Closed and cancelled remain archive states.
   - Default view = last 30 days, 9 cards desktop / 6 cards mobile.
   - Pagination prevents the page from growing indefinitely.
   - Display-only mapping; no database status migration.
   ============================================================ */
let v1867TimelinePage = 1;
let v1867TimelineRows = [];

function v1867TimelinePageSize(){
  return window.matchMedia && window.matchMedia('(max-width: 768px)').matches ? 6 : 9;
}

function v1867ResetTimelinePage(){
  v1867TimelinePage = 1;
}

function v1867BemWorkflowGroup(item){
  const raw = String(item?.caseStatus || '').trim();
  const low = raw.toLowerCase();
  if (["ยกเลิกเคส","ยกเลิก","cancelled","canceled"].includes(low)) return 'cancelled';
  if (["ปิดเคส","closed"].includes(low)) return 'closed';
  if (raw === 'รอ BEM รับเรื่อง') return 'bem_new';
  if (typeof v1863SeemsResolved === 'function' && v1863SeemsResolved(item)) return 'bem_review';
  return 'bem_working';
}

function v1867BemWorkflowLabel(item){
  const group = v1867BemWorkflowGroup(item);
  if (group === 'bem_new') return 'ใหม่';
  if (group === 'bem_review') return 'ตรวจปิด';
  if (group === 'closed') return 'ปิดแล้ว';
  if (group === 'cancelled') return 'ยกเลิก';
  return 'กำลังทำ';
}

function v1867BemWorkflowClass(item){
  return `bem-history-status-${v1867BemWorkflowGroup(item).replace('bem_','')}`;
}

function v1867FilterTimelineRows(rows, filter){
  const list = Array.isArray(rows) ? rows : [];
  const f = String(filter || 'all');
  if (f === 'all') return list;
  return list.filter(item => v1867BemWorkflowGroup(item) === f);
}

function v1867SetTimelineStatus(value, button){
  const select = document.getElementById('incidentHistoryStatusFilter');
  if (select) select.value = value || 'all';
  document.querySelectorAll('#bemHistoryStatusTabs button').forEach(btn => btn.classList.toggle('is-active', btn === button));
  v1867ResetTimelinePage();
  loadIncidentHistoryPage();
}

function v1867SyncTimelineStatusTabs(){
  const value = document.getElementById('incidentHistoryStatusFilter')?.value || 'all';
  document.querySelectorAll('#bemHistoryStatusTabs button').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.status === value);
  });
}

function v1869UpdateTimelineStatusCounts(rows){
  const counts = {bem_new:0,bem_working:0,bem_review:0,closed:0,cancelled:0};
  const list = Array.isArray(rows) ? rows : [];
  list.forEach(item => {
    const group = v1867BemWorkflowGroup(item);
    if (group in counts) counts[group] += 1;
  });
  const map = {
    bemStatusCountAll: list.length,
    bemStatusCountNew: counts.bem_new,
    bemStatusCountWorking: counts.bem_working,
    bemStatusCountReview: counts.bem_review,
    bemStatusCountClosed: counts.closed,
    bemStatusCountCancelled: counts.cancelled
  };
  Object.entries(map).forEach(([id,value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  });
}

function v1867RenderTimelinePage(){
  const cardList = document.getElementById('incidentHistoryCardList');
  const select = document.getElementById('incidentHistorySelect');
  const pager = document.getElementById('incidentHistoryPagination');
  const prev = document.getElementById('incidentHistoryPrevBtn');
  const next = document.getElementById('incidentHistoryNextBtn');
  const pageLabel = document.getElementById('incidentHistoryPageLabel');
  const rangeLabel = document.getElementById('incidentHistoryRangeLabel');
  if (!cardList || !select) return;

  const total = v1867TimelineRows.length;
  const perPage = v1867TimelinePageSize();
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  v1867TimelinePage = Math.min(Math.max(1, v1867TimelinePage), totalPages);
  const start = (v1867TimelinePage - 1) * perPage;
  const end = Math.min(start + perPage, total);
  const pageRows = v1867TimelineRows.slice(start, end);

  cardList.innerHTML = '';
  select.innerHTML = '<option value="">-- เลือก Incident ID --</option>';
  const cards = document.createDocumentFragment();
  const options = document.createDocumentFragment();
  pageRows.forEach(item => {
    const option = document.createElement('option');
    option.value = item.incidentId || '';
    option.textContent = item.incidentId || '';
    options.appendChild(option);

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'timeline-incident-card bem-history-card-v1867';
    card.dataset.incidentId = item.incidentId || '';
    card.onclick = () => selectIncidentHistory(item.incidentId);
    card.innerHTML = `
      <div class="timeline-card-main">
        <strong>${escapeHtml(item.incidentId || '-')}</strong>
        <span>${escapeHtml(item.fridgeId || '-')} · ${escapeHtml(item.room || '-')}</span>
        <small>${escapeHtml(item.foundDate || '-')} ${escapeHtml(item.foundTime || '-')}</small>
      </div>
      <span class="status-badge bem-history-status-badge ${v1867BemWorkflowClass(item)}">${escapeHtml(v1867BemWorkflowLabel(item))}</span>`;
    cards.appendChild(card);
  });
  select.appendChild(options);
  cardList.appendChild(cards);

  if (rangeLabel) rangeLabel.textContent = total ? `แสดง ${start + 1}–${end} จาก ${total} เคส` : 'ไม่พบเคส';
  if (pageLabel) pageLabel.textContent = `หน้า ${v1867TimelinePage} / ${totalPages}`;
  if (prev) prev.disabled = v1867TimelinePage <= 1;
  if (next) next.disabled = v1867TimelinePage >= totalPages;
  if (pager) pager.classList.toggle('hidden', total <= perPage);
}

function v1867ChangeTimelinePage(delta){
  const perPage = v1867TimelinePageSize();
  const totalPages = Math.max(1, Math.ceil(v1867TimelineRows.length / perPage));
  const nextPage = Math.min(Math.max(1, v1867TimelinePage + Number(delta || 0)), totalPages);
  if (nextPage === v1867TimelinePage) return;
  v1867TimelinePage = nextPage;
  v1867RenderTimelinePage();
  const heading = document.querySelector('#incidentHistoryPage .bem-history-list-heading');
  if (heading) heading.scrollIntoView({behavior:'smooth', block:'start'});
}

loadIncidentHistoryPage = async function(){
  const select = document.getElementById('incidentHistorySelect');
  const resultBox = document.getElementById('incidentHistoryResult');
  const cardList = document.getElementById('incidentHistoryCardList');
  const timeline = document.getElementById('incidentTimeline');
  const selectedLabel = document.getElementById('timelineSelectedIncident');
  if (!select || !cardList) return;

  const dateFilter = document.getElementById('incidentHistoryDateFilter')?.value || 'all';
  const statusFilter = document.getElementById('incidentHistoryStatusFilter')?.value || 'all';
  const startDate = document.getElementById('incidentHistoryStartDate')?.value || '';
  const endDate = document.getElementById('incidentHistoryEndDate')?.value || '';
  const fridgeSearch = document.getElementById('incidentHistoryFridgeSearch')?.value?.trim() || '';

  cardList.innerHTML = '';
  if (timeline) timeline.innerHTML = '<div class="small-note">กำลังโหลดรายการ...</div>';
  if (selectedLabel) selectedLabel.textContent = 'เลือกการ์ดด้านบนเพื่อดูรายละเอียด';
  incidentHistoryListCache = [];
  v1867TimelineRows = [];
  v1867SyncTimelineStatusTabs();

  try {
    // BEM workflow groups are display categories, so fetch by date/search then group client-side.
    const url = `${WEB_APP_URL}?action=incident_all_list&dateFilter=${encodeURIComponent(dateFilter)}&statusFilter=all&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&fridgeSearch=${encodeURIComponent(fridgeSearch)}`;
    const response = await fetch(url);
    let data = await response.json();
    if (!Array.isArray(data)) throw new Error(data?.message || 'ข้อมูล Incident ไม่ถูกต้อง');
    data = v1857PrioritizeOpenTimelineIncidents(uniqueIncidentsById(data));
    const allTimelineRowsV1869 = data.slice();
    v1869UpdateTimelineStatusCounts(allTimelineRowsV1869);
    data = v1867FilterTimelineRows(allTimelineRowsV1869, statusFilter);
    incidentHistoryListCache = data;
    v1867TimelineRows = data;

    if (!data.length) {
      v1867RenderTimelinePage();
      if (timeline) timeline.innerHTML = '<div class="small-note">ยังไม่ได้เลือก Incident</div>';
      showResult(resultBox, true, 'ไม่พบ Incident ตามตัวกรอง');
      return;
    }

    v1867RenderTimelinePage();
    const counts = {bem_new:0,bem_working:0,bem_review:0,closed:0,cancelled:0};
    data.forEach(item => { const g=v1867BemWorkflowGroup(item); if (g in counts) counts[g] += 1; });
    const parts = [];
    if (statusFilter === 'all') {
      if (counts.bem_new) parts.push(`ใหม่ ${counts.bem_new}`);
      if (counts.bem_working) parts.push(`กำลังทำ ${counts.bem_working}`);
      if (counts.bem_review) parts.push(`ตรวจปิด ${counts.bem_review}`);
      if (counts.closed) parts.push(`ปิดแล้ว ${counts.closed}`);
      if (counts.cancelled) parts.push(`ยกเลิก ${counts.cancelled}`);
    }
    showResult(resultBox, true, `พบ ${data.length} เคส${parts.length ? ' • ' + parts.join(' • ') : ''}`);
    if (timeline) timeline.innerHTML = '<div class="small-note">เลือกการ์ดด้านบนเพื่อดู Timeline</div>';
    if (data.length === 1) await selectIncidentHistory(data[0].incidentId);
  } catch(error) {
    showResult(resultBox, false, 'โหลดรายการ Incident ไม่สำเร็จ: ' + (error?.message || error));
    if (timeline) timeline.innerHTML = '<div class="small-note">โหลดข้อมูลไม่สำเร็จ</div>';
  }
};

const v1867SelectIncidentHistoryBase = selectIncidentHistory;
selectIncidentHistory = async function(incidentId){
  await v1867SelectIncidentHistoryBase(incidentId);
  document.querySelectorAll('#incidentHistoryCardList .timeline-incident-card').forEach(card => {
    card.classList.toggle('selected', card.dataset.incidentId === incidentId);
  });
  if (window.matchMedia && window.matchMedia('(max-width: 768px)').matches) {
    setTimeout(() => document.getElementById('incidentHistoryTimelinePanel')?.scrollIntoView({behavior:'smooth', block:'start'}), 80);
  }
};

const v1867LoadIncidentHistoryBase = loadIncidentHistory;
loadIncidentHistory = async function(explicitIncidentId){
  const incidentId = explicitIncidentId || document.getElementById('incidentHistorySelect')?.value || '';
  const resultBox = document.getElementById('incidentHistoryResult');
  const timeline = document.getElementById('incidentTimeline');
  const selectedLabel = document.getElementById('timelineSelectedIncident');
  if (!incidentId) {
    showResult(resultBox, false, 'กรุณาเลือก Incident จากการ์ด');
    return;
  }
  if (timeline) timeline.innerHTML = '<div class="small-note">กำลังโหลด Timeline...</div>';
  if (selectedLabel) selectedLabel.innerHTML = `กำลังแสดง: <strong>${escapeHtml(incidentId)}</strong>`;
  try {
    const response = await fetch(`${WEB_APP_URL}?action=incident_history&incidentId=${encodeURIComponent(incidentId)}`);
    const data = await response.json();
    if (!Array.isArray(data) || !data.length) {
      showResult(resultBox, true, 'ไม่พบประวัติการอัปเดต');
      if (timeline) timeline.innerHTML = '<div class="small-note">ยังไม่มี Timeline</div>';
      return;
    }
    showResult(resultBox, true, `พบ ${data.length} เหตุการณ์ในเคสนี้`);
    const fragment = document.createDocumentFragment();
    data.forEach(item => {
      const div = document.createElement('article');
      div.className = 'timeline-item';
      div.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-time">${escapeHtml(item.updatedAt || '-')}</div>
        <div class="timeline-status"><span class="status-badge bem-history-status-badge ${v1867BemWorkflowClass(item)}">${escapeHtml(v1867BemWorkflowLabel(item))}</span></div>
        <div class="timeline-body">
          <div><strong>ผู้ดำเนินการ</strong><span>${escapeHtml(staffNameForUI(item.owner) || '-')}</span></div>
          <div><strong>การดำเนินการ</strong><span>${escapeHtml(item.actionText || '-')}</span></div>
          <div><strong>ผลการแก้ไข</strong><span>${escapeHtml(item.fixResult || '-')}</span></div>
          <div><strong>ผู้อัปเดต</strong><span>${escapeHtml(staffNameForUI(item.updatedBy) || '-')}</span></div>
        </div>`;
      fragment.appendChild(div);
    });
    if (timeline) { timeline.innerHTML=''; timeline.appendChild(fragment); }
  } catch(error) {
    showResult(resultBox, false, 'โหลดประวัติการอัปเดตไม่สำเร็จ: ' + (error?.message || error));
    if (timeline) timeline.innerHTML = '<div class="small-note">โหลด Timeline ไม่สำเร็จ</div>';
  }
};

clearIncidentHistory = function(){
  const date = document.getElementById('incidentHistoryDateFilter');
  const status = document.getElementById('incidentHistoryStatusFilter');
  const search = document.getElementById('incidentHistoryFridgeSearch');
  const start = document.getElementById('incidentHistoryStartDate');
  const end = document.getElementById('incidentHistoryEndDate');
  if (date) date.value = 'all';
  if (status) status.value = 'all';
  if (search) search.value = '';
  if (start) start.value = '';
  if (end) end.value = '';
  toggleIncidentHistoryCustomDate();
  v1867SyncTimelineStatusTabs();
  v1867ResetTimelinePage();
  const timeline = document.getElementById('incidentTimeline');
  const selectedLabel = document.getElementById('timelineSelectedIncident');
  if (timeline) timeline.innerHTML = '<div class="small-note">ยังไม่ได้เลือก Incident</div>';
  if (selectedLabel) selectedLabel.textContent = 'เลือกการ์ดด้านบนเพื่อดูรายละเอียด';
  loadIncidentHistoryPage();
};

/* ============================================================
   V1.8.69 — Full Incident archive paging + cleaner BEM status bar
   - Timeline opens with all Incident history, paged instead of truncated by date.
   - Desktop BEM status uses one compact six-segment bar with live counts.
   - Mobile keeps a 3 x 2 touch-friendly status grid.
   ============================================================ */

window.addEventListener('resize', () => {
  if (!document.getElementById('incidentHistoryPage')?.classList.contains('hidden') && v1867TimelineRows.length) {
    v1867RenderTimelinePage();
  }
});
