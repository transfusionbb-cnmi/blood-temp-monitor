const WEB_APP_URL = "SUPABASE_LOCAL";
window.CNMI_TEMP_MONITOR_VERSION = "1.8.22-resend-bem-chat-alert";
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
  const pages = ["dashboardPage","formPage","historyPage","chartPage","helpPage","fridgeStatusPage","alarmTestPage","alarmTestHistoryPage","incidentHubPage","incidentPage","updateIncidentPage","incidentHistoryPage","adminUsersPage","adminMenuSettingsPage","adminAuditPage"];
  pages.forEach(id => { const el = document.getElementById(id); if (!el) return; if (id === "dashboardPage") el.classList.remove("hidden"); else el.classList.add("hidden"); });
  document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"));
  const firstBtn = document.querySelector(".menu-btn[data-menu-key='dashboard']"); if (firstBtn) firstBtn.classList.add("active");
  try { loadFridgeList(); } catch (e) { console.error("loadFridgeList error:", e); }
  try { setToday(); } catch (e) { console.error("setToday error:", e); }
  try { setDefaultHistoryDateRange(true); } catch (e) { console.error("setDefaultHistoryDateRange error:", e); }
  try { setDefaultChartDateRange(true); } catch (e) { console.error("setDefaultChartDateRange error:", e); }
  try { syncLoginIdentityFields(); resetFormState(); } catch (e) { console.error("resetFormState error:", e); }
  try { validateForm(); } catch (e) { console.error("validateForm error:", e); }
  try { const d = document.getElementById("dashboardDate"); if (d && !d.value) d.value = getTodayYMD(); } catch (e) { console.error("dashboardDate default error:", e); }
  try { await loadDashboard(); } catch (e) { console.error("loadDashboard error:", e); }
  try { await refreshBEMMenuCounts(); } catch (e) { console.error("refreshBEMMenuCounts error:", e); }
  try { handleIncidentDeepLink(); } catch (e) { console.error("handleIncidentDeepLink error:", e); }
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

  if (pageId === "updateIncidentPage" && typeof loadOpenIncidentList === "function") {
    setTimeout(() => { syncLoginIdentityFields(); loadOpenIncidentList(); }, 0);
  }

  if (typeof syncMobileNavWithPage === "function") {
    syncMobileNavWithPage(pageId);
  }

  const mainScroller = document.querySelector(".main-content");
  if (mainScroller) mainScroller.scrollTo({ top: 0, behavior: "smooth" });

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
      closedToday: data.closedIncidentCount ?? data.closedToday ?? 0,
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
    
    const cardMorningRecorded = document.getElementById("cardMorningRecorded");
    const cardMorningMissing = document.getElementById("cardMorningMissing");
    const cardEveningRecorded = document.getElementById("cardEveningRecorded");
    const cardEveningMissing = document.getElementById("cardEveningMissing");

    if (cardActiveFridges) cardActiveFridges.innerText = summary.activeFridges;
    if (cardOpenIncidents) cardOpenIncidents.innerText = summary.openIncidents;
    if (cardClosedToday) cardClosedToday.innerText = summary.closedToday;
    
    if (cardMorningRecorded) cardMorningRecorded.innerText = data.morningRecorded ?? 0;
    if (cardMorningMissing) cardMorningMissing.innerText = data.morningMissing ?? 0;
    if (cardEveningRecorded) cardEveningRecorded.innerText = data.eveningRecorded ?? 0;
    if (cardEveningMissing) cardEveningMissing.innerText = data.eveningMissing ?? 0;


    showResult(
      resultBox,
      true,
      `โหลดภาพรวมสำเร็จ | วันที่ ${selectedDate}`
    );

  } catch (error) {
    showResult(resultBox, false, "โหลดภาพรวมไม่สำเร็จ: " + error);
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
    titleText = "Incident ที่อยู่ระหว่างติดตาม";
    showResult(resultBox, true, "กรุณาดูรายละเอียดที่เมนู ติดตาม Incident");
    if (title) title.innerText = titleText;
    showPage("incidentPage", document.querySelector("button[onclick*='incidentPage']"));
    return;

  } else if (group === "closedToday") {
    titleText = "เหตุที่ปิดแล้วทั้งหมด";
    showResult(resultBox, true, "ดูรายละเอียดเคสปิดแล้วได้ที่เมนู ติดตาม Incident");
    if (title) title.innerText = titleText;
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
        <div><strong>ช่วงควบคุม:</strong> ${item.minTemp} ถึง ${item.maxTemp} °C</div>
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

function setBEMQuickStatus(status) {
  const incidentId = document.getElementById("updateIncidentId")?.value?.trim() || "";
  if (!incidentId) {
    showResult(document.getElementById("updateIncidentResult"), false, "กรุณาเลือก Incident ก่อนกดปุ่มสถานะ");
    return;
  }

  const statusEl = document.getElementById("updateCaseStatus");
  const actionEl = document.getElementById("updateActionText");
  const fixEl = document.getElementById("updateFixResult");

  if (statusEl) statusEl.value = status;

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
  const fixResult = document.getElementById("updateFixResult")?.value?.trim() || "";
  const updatedBy = owner;
  const resultBox = document.getElementById("updateIncidentResult");

  if (!incidentId || !caseStatus) {
    showResult(resultBox, false, "กรุณาเลือก Incident ID และสถานะเคส");
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

      clearForm();
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

function clearForm() {
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
      `พบข้อมูล ${records.length} รายการ\nตู้: ${data.fridgeName || "-"}\nช่วงวันที่: ${startDate} ถึง ${endDate}\nช่วงอุณหภูมิ: ${data.minTemp} ถึง ${data.maxTemp} °C`
    );

    scrollToResult("historyResult");

  } catch (error) {
    showResult(resultBox, false, "โหลดข้อมูลไม่ได้: " + error);
    scrollToResult("historyResult");
  }
}

function renderHistoryTable(records) {
  const tbody = document.getElementById("historyTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!records || records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">ไม่พบข้อมูลในช่วงวันที่นี้</td></tr>';
    return;
  }

  records.forEach(r => {
    const statusClass = r.status === "ปกติ" ? "status-green" : (r.status === "ผิดปกติ" ? "status-red" : "status-orange");
    const actionText = r.recordType === "NO_TEMP"
      ? `${r.noTempReason || "ไม่สามารถวัดอุณหภูมิได้"}${r.noTempDetail ? " | " + r.noTempDetail : ""}`
      : (r.action || "");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.date || "")}</td>
      <td>${escapeHtml(r.time || "")}</td>
      <td>${escapeHtml(r.round || "")}</td>
      <td>${escapeHtml(r.tempDisplay ?? r.temp ?? "")}</td>
      <td><span class="status-badge ${statusClass}">${escapeHtml(r.status || "")}</span></td>
      <td>${escapeHtml(actionText)}</td>
      <td>${escapeHtml(staffNameForUI(r.recorderName) || "")}</td>
    `;
    tbody.appendChild(tr);
  });
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
      `พบข้อมูล ${records.length} รายการ\nใช้พล็อตกราฟ ${graphRecords.length} รายการ\nตู้: ${data.fridgeName || "-"}\nช่วงอุณหภูมิ: ${data.minTemp} ถึง ${data.maxTemp} °C${noteText}`
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
  const ctx = document.getElementById('tempChart').getContext('2d');

  if (tempChart) {
    tempChart.destroy();
  }

  const graphRecords = records.filter(r => {
  return r.recordType !== "NO_TEMP" &&
         r.isValidForGraph !== false &&
         r.temp !== null &&
         r.temp !== "" &&
         !isNaN(Number(r.temp));
});

const labels = buildSmartLabels(graphRecords);
const values = graphRecords.map(r => Number(r.temp));

  tempChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: `อุณหภูมิ ${fridgeId}`,
          data: values,
          tension: 0.25,
          borderWidth: 3,
          fill: false
        },
        {
          label: 'ต่ำสุด',
          data: labels.map(() => Number(minTemp)),
          borderDash: [6, 6],
          borderWidth: 2,
          fill: false
        },
        {
          label: 'สูงสุด',
          data: labels.map(() => Number(maxTemp)),
          borderDash: [6, 6],
          borderWidth: 2,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top'
        },
        tooltip: {
          callbacks: {
            title: function(context) {
              const index = context[0].dataIndex;
              const r = graphRecords[index];
              return `${r.date} ${r.time || ''}`.trim();
            },
            label: function(context) {
              return `อุณหภูมิ: ${context.raw} °C`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            autoSkip: true,
            maxTicksLimit: 12,
            maxRotation: 0,
            minRotation: 0
          }
        },
        y: {
          beginAtZero: false,
          title: {
            display: true,
            text: 'อุณหภูมิ (°C)'
          }
        }
      }
    }
  });
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

  const headers = ["วันที่", "เวลา", "รอบ", "รหัสตู้", "ชื่อตู้", "ประเภทที่เก็บ", "อุณหภูมิ", "สถานะ", "การดำเนินการ", "สถานที่เก็บ", "ผู้บันทึก"];
  const rows = lastHistoryRecords.map(r => [
    r.date || '',
    r.time || '',
    r.round || '',
    r.fridgeId || '',
    r.fridgeName || '',
    r.productType || '',
    r.tempDisplay ?? r.temp ?? '',
    r.status || '',
    (r.recordType === "NO_TEMP" ? `${r.noTempReason || ''}${r.noTempDetail ? ' | ' + r.noTempDetail : ''}` : (r.action || '')),
    r.storageLocation || '',
    staffNameForUI(r.recorderName) || ''
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
  renderUpdateIncidentSummary(item);
}

function renderUpdateIncidentSummary(item) {
  const box = document.getElementById("updateIncidentSummary");
  if (!box) return;
  if (!item) {
    box.classList.add("hidden");
    box.innerHTML = "";
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
  const caseStatus = document.getElementById("updateCaseStatus")?.value?.trim() || "";
  syncLoginIdentityFields();
  const ownerRaw = AUTH_DISABLED_TEMPORARILY
    ? (document.getElementById("updateOwner")?.value?.trim() || "")
    : (getCurrentActorFullName() || getCurrentActorEmail());
  const owner = await resolveStaffFullNameForUI(ownerRaw);
  const actionText = document.getElementById("updateActionText")?.value?.trim() || "";
  const fixResult = document.getElementById("updateFixResult")?.value?.trim() || "";
  const updatedBy = owner;
  const resultBox = document.getElementById("updateIncidentResult");
  if (!incidentId || !caseStatus) {
    showResult(resultBox, false, "กรุณาเลือก Incident ID และสถานะเคส");
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
  ["dashboard", "ภาพรวม"], ["form", "บันทึกอุณหภูมิ"], ["history", "ดูข้อมูล/Export CSV ย้อนหลัง"], ["chart", "กราฟอุณหภูมิย้อนหลัง"],
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
   V1.8.27 — Mobile incident hub + active Incident defaults
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
  return "จัดการสถานะ Incident";
}

function showBEMStatusPage(statusKey, btn) {
  const dateFilter = document.getElementById("updateIncidentDateFilter");
  const statusFilter = document.getElementById("updateIncidentStatusFilter");
  const title = document.querySelector("#updateIncidentPage .section-title");
  if (dateFilter) dateFilter.value = statusKey === "closed" ? "30days" : "all";
  if (statusFilter) statusFilter.value = statusKey && statusKey !== "all" ? statusKey : "active";
  if (title) title.innerText = "จัดการสถานะ Incident";
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
    showResult(resultBox, true, `พบ ${data.length} รายการ เลือกเคสจากการ์ด`);
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
    data = uniqueIncidentsById(data);
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
    showResult(resultBox, true, `พบ ${data.length} Incident เลือกจากการ์ดเพื่อดู Timeline`);
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

async function handleIncidentDeepLink() {
  const params = new URLSearchParams(window.location.search || "");
  const page = params.get("page") || "";
  const incidentId = params.get("incidentId") || "";
  if (page !== "updateIncident" && page !== "bemIncident" && !incidentId) return;
  const updateBtn = document.querySelector('.menu-btn[data-menu-key="bem_manage"]');
  showPage("updateIncidentPage", updateBtn || null);
  const dateFilter = document.getElementById("updateIncidentDateFilter");
  const statusFilter = document.getElementById("updateIncidentStatusFilter");
  const search = document.getElementById("updateIncidentFridgeSearch");
  if (dateFilter) dateFilter.value = "all";
  if (statusFilter) statusFilter.value = "all";
  if (search) search.value = incidentId || "";
  try {
    await loadOpenIncidentList();
    if (incidentId) selectUpdateIncident(incidentId);
    showResult(document.getElementById("updateIncidentResult"), true, `เปิด Incident ${incidentId} จากลิงก์แจ้งเตือนแล้ว`);
  } catch (error) {
    const input = document.getElementById("updateIncidentId");
    if (input) input.value = incidentId;
    showResult(document.getElementById("updateIncidentResult"), false, "เปิด Incident จากลิงก์ไม่สำเร็จ: " + error);
  }
}
