/*
  CNMI Temperature Monitor - Supabase compatibility layer
  v1.8.32: แก้ KPI ให้โหลดเสถียร ลดข้อมูล และไม่รบกวนหน้าหลัก
  -------------------------------------------------------
  This file intercepts the old Google Apps Script fetch(WEB_APP_URL?...)
  calls and serves the same JSON shape from Supabase instead.
*/
(function () {
  const config = window.CNMI_SUPABASE_CONFIG || {};
  const notConfigured = !config.SUPABASE_URL || !config.SUPABASE_ANON_KEY ||
    String(config.SUPABASE_URL).includes('PASTE_YOUR') ||
    String(config.SUPABASE_ANON_KEY).includes('PASTE_YOUR');

  const originalFetch = window.fetch ? window.fetch.bind(window) : null;
  let client = null;

  function getClient() {
    if (notConfigured) {
      throw new Error('ยังไม่ได้ตั้งค่า Supabase URL / anon key ในไฟล์ supabase-config.js');
    }
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error('โหลด supabase-js ไม่สำเร็จ กรุณาตรวจสอบ Internet หรือ CDN');
    }
    if (!client) {
      client = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    }
    return client;
  }

  function jsonResponse(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  function todayYMD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function nowTimestamp() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${day} ${hh}:${mm}:${ss}`;
  }

  function addDays(ymd, n) {
    const d = new Date(`${ymd}T00:00:00`);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function toYMD(value) {
    if (!value) return '';
    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    return s;
  }

  function formatDateDisplay(ymd) {
    const s = toYMD(ymd);
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return s || '';
    const [y, m, d] = s.split('-');
    return `${d}/${m}/${y}`;
  }

  function normalizeTime(value) {
    if (value === null || value === undefined) return '';
    let s = String(value).trim().replace(/^'/, '');
    if (!s) return '';
    const m = s.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/);
    if (m) return `${String(Number(m[1])).padStart(2, '0')}:${String(Number(m[2])).padStart(2, '0')}`;
    return s;
  }

  function normalizeRoundKey(value) {
    return String(value || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .replace(/\s+/g, '');
  }

  function isAbnormalRound(value) {
    return normalizeRoundKey(value) === 'ผิดปกติ';
  }

  function displayDateTime(value) {
    if (!value) return '';
    const d = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return String(value);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yy} ${hh}:${mi}`;
  }

  function normalizeNumericText(value) {
    return String(value ?? '')
      .trim()
      .replace(/[−–—]/g, '-')
      .replace(/,/g, '.')
      .replace(/[๐-๙]/g, ch => '๐๑๒๓๔๕๖๗๘๙'.indexOf(ch))
      .replace(/[０-９]/g, ch => String(ch.charCodeAt(0) - 0xFF10));
  }

  function toNumOrNull(value) {
    const text = normalizeNumericText(value);
    if (!text || text === '-' || text === '.' || text === '-.' || text === '+') return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
  }

  function getTempRange(row) {
    const minTemp = toNumOrNull(row?.min_temp);
    const maxTemp = toNumOrNull(row?.max_temp);
    if (minTemp === null || maxTemp === null) return null;
    return { minTemp, maxTemp };
  }

  function normalizeFridgeUsageStatus(status) {
    const text = String(status || '').trim();
    if (!text) return '';
    return text === 'ใช้งาน' ? 'ใช้งาน' : 'เลิกใช้งาน';
  }

  function normalizeFridgeInactiveReason(newStatus, originalStatus, reason) {
    const r = String(reason || '').trim();
    if (newStatus === 'ใช้งาน') return null;
    if (r) return r;
    const old = String(originalStatus || '').trim();
    return old && old !== 'ใช้งาน' && old !== 'เลิกใช้งาน' ? old : 'เลิกใช้งาน';
  }

  function normalizeQrText(text) {
    return String(text || '')
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .toUpperCase()
      .replace(/[๐-๙]/g, ch => '๐๑๒๓๔๕๖๗๘๙'.indexOf(ch))
      .replace(/[０-９]/g, ch => String(ch.charCodeAt(0) - 0xFF10))
      .replace(/[–—−]/g, '-')
      .replace(/\s+/g, '')
      .replace(/-+/g, '-');
  }

  function qrLookupCandidates(rawCode) {
    const raw = String(rawCode || '').trim();
    const pool = [];
    const push = v => {
      const text = String(v || '').trim();
      if (!text) return;
      pool.push(text);
      try {
        const decoded = decodeURIComponent(text);
        if (decoded && decoded !== text) pool.push(decoded);
      } catch (e) {}
    };
    push(raw);
    try {
      const u = new URL(raw, window.location.origin);
      ['fridgeId','fridge_id','fridge','fridgeCode','fridge_code','id','code','qr','q','f'].forEach(k => push(u.searchParams.get(k)));
      u.pathname.split('/').forEach(push);
      u.hash.split(/[?#&/=]/).forEach(push);
    } catch (e) {}
    (raw.match(/CN\s*[-–—−]?\s*[A-Z]\s*[-–—−]?\s*\d{3,8}(?:\s*[-–—−]?\s*(?:TOP|BOTTOM|UPPER|LOWER))?/gi) || []).forEach(push);
    (raw.match(/CNB\s*\d{3,8}(?:\s*[-–—−]?\s*(?:TOP|BOTTOM|UPPER|LOWER))?/gi) || []).forEach(push);

    const seen = new Set();
    return pool
      .map(normalizeQrText)
      .map(v => v.replace(/^CNB(\d{3,8})(-.+)?$/, 'CN-B-$1$2'))
      .filter(Boolean)
      .filter(v => {
        const key = v.replace(/[^A-Z0-9]/g, '');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  function fromFridge(row) {
    return {
      id: row.fridge_id,
      fridge_id: row.fridge_id,
      fridgeId: row.fridge_id,
      name: row.fridge_name,
      type: row.product_type,
      room: row.storage_location,
      oldCode: row.old_fridge_id,
      old_fridge_id: row.old_fridge_id,
      fridge_code: row.fridge_code || row.code || '',
      code: row.code || row.fridge_code || '',
      legacy_code: row.legacy_code || '',
      qr_code: row.qr_code || '',
      minTemp: row.min_temp,
      maxTemp: row.max_temp,
      status: normalizeFridgeUsageStatus(row.usage_status),
      morningTime: normalizeTime(row.morning_time || '07:00'),
      eveningTime: normalizeTime(row.evening_time || '19:00'),
      requireDaily: row.require_daily,
      inactiveReason: row.inactive_reason,
      inactiveStartDate: row.inactive_start_date,
      statusUpdatedBy: resolveStaffFullNameCached(row.status_updated_by),
      statusUpdatedAt: row.status_updated_at ? displayDateTime(row.status_updated_at) : ''
    };
  }

  function fromIncident(row) {
    return {
      incidentId: row.incident_id,
      bemJobNo: row.bem_job_no || '',
      foundDate: row.found_date || '',
      foundTime: normalizeTime(row.found_time),
      room: row.room || '',
      fridgeId: row.fridge_id || '',
      temp: row.temp,
      reporter: resolveStaffFullNameCached(row.reporter),
      caseStatus: row.case_status || '',
      owner: resolveStaffFullNameCached(row.owner),
      actionText: row.action_text || '',
      fixResult: row.fix_result || '',
      updatedDate: row.updated_date ? displayDateTime(row.updated_date) : '',
      round: row.round || '',
      logNote: row.log_note || ''
    };
  }

  function fromAlarm(row) {
    return {
      timestamp: row.created_at || '',
      testDate: row.test_date || '',
      testTime: normalizeTime(row.test_time),
      fridgeId: row.fridge_id || '',
      fridgeName: row.fridge_name || '',
      room: row.room || '',
      probeId: row.probe_id || '',
      tester: resolveStaffFullNameCached(row.tester),
      overallResult: row.overall_result || '',
      batteryPercent: row.battery_percent ?? '',
      batteryStatus: row.battery_status || '',
      signalPercent: row.signal_percent ?? '',
      signalStatus: row.signal_status || '',
      datalogInterval: row.datalog_interval ?? '',
      datalogStatus: row.datalog_status || '',
      highRemoteTime: row.high_remote_time ?? '',
      highLocalAlert: row.high_local_alert || '',
      highAlertResult: row.high_alert_result || '',
      lowRemoteTime: row.low_remote_time ?? '',
      lowLocalAlert: row.low_local_alert || '',
      lowAlertResult: row.low_alert_result || '',
      wirelessRemoteTime: row.wireless_remote_time ?? '',
      wirelessLocalAlert: row.wireless_local_alert || '',
      wirelessAlertResult: row.wireless_alert_result || '',
      sensorRemoteTime: row.sensor_remote_time ?? '',
      sensorLocalAlert: row.sensor_local_alert || '',
      sensorAlertResult: row.sensor_alert_result || '',
      frontHighAlarmTemp: row.front_high_alarm_temp ?? '',
      frontHighAlarmSound: row.front_high_alarm_sound || '',
      frontHighAlarmStatus: row.front_high_alarm_status || '',
      frontLowAlarmTemp: row.front_low_alarm_temp ?? '',
      frontLowAlarmSound: row.front_low_alarm_sound || '',
      frontLowAlarmStatus: row.front_low_alarm_status || '',
      frontDisplayStatus: row.front_display_status || '',
      frontOverallStatus: row.front_overall_status || '',
      actionWhenAbnormal: row.action_when_abnormal || '',
      note: row.note || '',
      savedBy: resolveStaffFullNameCached(row.saved_by),
      bemChecker: resolveStaffFullNameCached(row.bem_checker)
    };
  }

  async function selectAll(queryBuilder, pageSize = 1000, limit = 10000) {
    const all = [];
    for (let from = 0; from < limit; from += pageSize) {
      const to = from + pageSize - 1;
      const { data, error } = await queryBuilder.range(from, to);
      if (error) throw error;
      const chunk = data || [];
      all.push(...chunk);
      if (chunk.length < pageSize) break;
    }
    return all;
  }

  const STAFF_ALIAS_CACHE_KEY = 'cnmi_temp_staff_directory_cache_v1821';
  try { window.localStorage?.removeItem('cnmi_temp_staff_alias_cache_v1816'); } catch (e) {}
  try { window.localStorage?.removeItem('cnmi_temp_staff_alias_cache_v1817'); } catch (e) {}
  try { window.localStorage?.removeItem('cnmi_temp_staff_alias_cache_v1818'); } catch (e) {}
  const STAFF_ALIAS_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
  let staffDirectoryCache = null;
  let staffDirectoryLoadedAt = 0;
  let staffDirectoryPromise = null;

  function normalizeStaffKey(value) {
    return String(value || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  function normalizeStaffRows(rows) {
    return (Array.isArray(rows) ? rows : [])
      .map(row => ({
        alias: String(row?.alias || '').trim(),
        full_name: String(row?.full_name || '').trim().replace(/\s+/g, ' '),
        status: String(row?.status || '').trim()
      }))
      .filter(row => row.alias && row.full_name && (!row.status || row.status === 'ใช้งาน'));
  }

  function readStoredStaffDirectory() {
    try {
      const raw = window.localStorage?.getItem(STAFF_ALIAS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const rows = normalizeStaffRows(parsed?.rows);
      if (!rows.length) return null;
      return { rows, savedAt: Number(parsed?.savedAt || 0) };
    } catch (e) {
      return null;
    }
  }

  function writeStoredStaffDirectory(rows, savedAt) {
    try {
      window.localStorage?.setItem(STAFF_ALIAS_CACHE_KEY, JSON.stringify({ rows, savedAt }));
    } catch (e) {}
  }

  function setStaffDirectoryCache(rows, loadedAt = Date.now()) {
    const normalized = normalizeStaffRows(rows);
    if (!normalized.length) return [];
    staffDirectoryCache = normalized;
    staffDirectoryLoadedAt = loadedAt;
    return normalized;
  }

  function getStaffDirectorySync() {
    if (Array.isArray(staffDirectoryCache) && staffDirectoryCache.length) return staffDirectoryCache;
    const stored = readStoredStaffDirectory();
    if (stored?.rows?.length) return setStaffDirectoryCache(stored.rows, stored.savedAt || 0);
    return [];
  }

  async function loadStaffDirectory(force = false) {
    const now = Date.now();
    if (!force && Array.isArray(staffDirectoryCache) && staffDirectoryCache.length && (now - staffDirectoryLoadedAt) < STAFF_ALIAS_CACHE_TTL_MS) {
      return staffDirectoryCache;
    }

    const stored = readStoredStaffDirectory();
    if (!force && stored?.rows?.length && (now - stored.savedAt) < STAFF_ALIAS_CACHE_TTL_MS) {
      return setStaffDirectoryCache(stored.rows, stored.savedAt);
    }

    if (staffDirectoryPromise) return staffDirectoryPromise;
    staffDirectoryPromise = (async () => {
      try {
        const sb = getClient();
        let data = null;
        let error = null;

        // V1.8.17: ใช้ SECURITY DEFINER RPC เพื่ออ่านเฉพาะ alias/full_name
        // จึงยังทำงานได้แม้ temp_staff เปิด RLS และไม่ต้องเปิด SELECT ทั้งตารางให้ anon
        ({ data, error } = await sb.rpc('temp_get_active_staff_aliases_v1817'));

        // รองรับฐานที่ยังไม่ได้รัน SQL V1.8.17 ชั่วคราว
        if (error) {
          console.warn('staff alias RPC unavailable, fallback to table:', error);
          ({ data, error } = await sb.from('temp_staff')
            .select('alias, full_name, status')
            .eq('status', 'ใช้งาน'));
        }

        if (error) throw error;
        const rows = setStaffDirectoryCache(data || [], now);
        if (rows.length) writeStoredStaffDirectory(rows, now);
        return rows;
      } catch (error) {
        console.warn('loadStaffDirectory warning:', error);
        if (stored?.rows?.length) return setStaffDirectoryCache(stored.rows, stored.savedAt || 0);
        return getStaffDirectorySync();
      } finally {
        staffDirectoryPromise = null;
      }
    })();
    return staffDirectoryPromise;
  }

  function resolveStaffFullNameCached(input) {
    const name = String(input || '').trim().replace(/\s+/g, ' ');
    if (!name) return '';
    const key = normalizeStaffKey(name);
    const found = getStaffDirectorySync().find(row =>
      normalizeStaffKey(row.alias) === key ||
      normalizeStaffKey(row.full_name) === key
    );
    // พบชื่อย่อหรือชื่อเต็มใน temp_staff -> แสดงชื่อ-นามสกุล
    // ไม่พบใน temp_staff -> คงข้อความที่ผู้ใช้กรอกไว้ตามเดิม
    return found?.full_name || name;
  }

  async function getStaffFullName(input) {
    const name = String(input || '').trim().replace(/\s+/g, ' ');
    if (!name) return '';
    await loadStaffDirectory(false);
    const cached = resolveStaffFullNameCached(name);
    if (normalizeStaffKey(cached) !== normalizeStaffKey(name) || getStaffDirectorySync().length) {
      return cached || name;
    }

    // V1.8.21: fallback ฝั่งฐานข้อมูล เผื่อ cache/RLS ทำให้ดึง temp_staff ไม่ได้
    try {
      const { data, error } = await getClient().rpc('temp_resolve_staff_full_name_v1821', { p_name: name });
      if (!error && String(data || '').trim()) return String(data).trim().replace(/\s+/g, ' ');
    } catch (e) {
      console.warn('temp_resolve_staff_full_name_v1821 unavailable:', e);
    }
    return cached || name;
  }

  // ชื่อฟังก์ชันเก่าเก็บไว้เพื่อ compatibility กับโค้ดเวอร์ชันก่อน
  function resolveStaffAliasCached(input) {
    return resolveStaffFullNameCached(input);
  }

  async function getStaffAlias(input) {
    return getStaffFullName(input);
  }

  async function getActorContext(params) {
    const fallback = {
      userId: params?.get('actorUserId') || '',
      email: String(params?.get('actorEmail') || '').toLowerCase(),
      fullName: params?.get('actorFullName') || params?.get('recorderName') || params?.get('tester') || params?.get('owner') || '',
      role: params?.get('actorRole') || ''
    };

    try {
      fallback.fullName = await getStaffFullName(fallback.fullName);
      if (!fallback.userId && !fallback.email) return fallback;
      const sb = getClient();
      const { data: authData } = await sb.auth.getUser();
      const user = authData?.user;
      if (!user) return fallback;

      const { data: profile } = await sb.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
      const profileFullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
      const profileNameCandidate = profileFullName || profile?.username || fallback.fullName || user.email || '';
      const resolvedFullName = await getStaffFullName(profileNameCandidate);
      return {
        userId: user.id || fallback.userId,
        email: String(user.email || profile?.email || fallback.email || '').toLowerCase(),
        fullName: resolvedFullName || profileNameCandidate || '',
        role: profile?.role || fallback.role || 'staff'
      };
    } catch (e) {
      if (fallback.fullName) {
        try { fallback.fullName = await getStaffFullName(fallback.fullName); } catch (_) {}
      }
      return fallback;
    }
  }

  function actorColumns(actor) {
    // v1.7.3 ปิด Login ชั่วคราว จึงไม่บังคับ column user_id/user_email/user_full_name/user_role
    // กัน error ในฐานข้อมูลจริงที่ยังไม่ได้รัน SQL login/audit
    return {};
  }

  async function getFridgeList(activeOnly = true) {
    const sb = getClient();
    let q = sb.from('temp_fridges').select('*').order('storage_location', { ascending: true }).order('fridge_id', { ascending: true });
    if (activeOnly) q = q.eq('usage_status', 'ใช้งาน');
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(fromFridge);
  }


  async function getFridgeByQrCode(params) {
    const sb = getClient();
    const code = params.get('code') || '';
    const candidates = qrLookupCandidates(code);
    if (!candidates.length) return { ok: false, item: null, candidates, message: 'ไม่พบรหัสที่ใช้ค้นหา' };

    let data = [];
    let error = null;

    ({ data, error } = await sb.from('temp_fridges').select('*').in('fridge_id', candidates).limit(5));
    if (error) throw error;

    if (!data || !data.length) {
      ({ data, error } = await sb.from('temp_fridges').select('*').in('old_fridge_id', candidates).limit(5));
      if (error) throw error;
    }

    if (!data || !data.length) {
      ({ data, error } = await sb.from('temp_fridges').select('*').in('fridge_code', candidates).limit(5));
      if (error) {
        // บางฐานไม่มี column fridge_code ให้ข้ามได้
        console.warn('qr_lookup fridge_code skipped', error);
        data = [];
      }
    }

    const item = data && data.length ? fromFridge(data[0]) : null;
    return { ok: !!item, item, candidates, count: data ? data.length : 0 };
  }

  function getIncidentDateRange(params) {
    const today = todayYMD();
    const filter = params.get('dateFilter') || 'today';
    let startDate = '';
    let endDate = today;
    if (filter === 'today') startDate = today;
    else if (filter === '7days') startDate = addDays(today, -6);
    else if (filter === '30days') startDate = addDays(today, -29);
    else if (filter === 'custom') {
      startDate = params.get('startDate') || '';
      endDate = params.get('endDate') || '';
    } else if (filter === 'all') {
      startDate = '';
      endDate = '';
    }
    return { startDate, endDate };
  }

  async function getIncidentList(params, includeClosed = false) {
    const sb = getClient();
    const { startDate, endDate } = getIncidentDateRange(params);
    const statusFilter = params.get('statusFilter') || 'all';
    const fridgeSearch = (params.get('fridgeSearch') || '').trim();

    let q = sb.from('temp_incidents').select('*').order('found_date', { ascending: false }).order('found_time', { ascending: false });
    if (startDate) q = q.gte('found_date', startDate);
    if (endDate) q = q.lte('found_date', endDate);
    if (!includeClosed) {
      // Keep all statuses unless a UI filter says otherwise. This preserves the current tracking table behavior.
    }
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'open') q = q.neq('case_status', 'ปิดเคส');
      else if (statusFilter === 'closed') q = q.eq('case_status', 'ปิดเคส');
      else if (statusFilter === 'waiting_bem') q = q.eq('case_status', 'รอ BEM รับเรื่อง');
      else if (statusFilter === 'checking') q = q.in('case_status', ['BEM รับเรื่องแล้ว', 'กำลังตรวจสอบ', 'ย้ายเลือดแล้ว / รอติดตาม']);
      else if (statusFilter === 'checking_only') q = q.in('case_status', ['BEM รับเรื่องแล้ว', 'กำลังตรวจสอบ']);
      else if (statusFilter === 'follow') q = q.eq('case_status', 'ย้ายเลือดแล้ว / รอติดตาม');
      else if (statusFilter === 'repair') q = q.in('case_status', ['ส่งซ่อมภายนอก', 'รออะไหล่ต่างประเทศ']);
      else if (statusFilter === 'cancelled') q = q.eq('case_status', 'ยกเลิกเคส');
      else q = q.eq('case_status', statusFilter);
    }
    if (fridgeSearch) {
      const safe = fridgeSearch.replace(/[,%]/g, '');
      q = q.or(`fridge_id.ilike.%${safe}%,incident_id.ilike.%${safe}%,bem_job_no.ilike.%${safe}%`);
    }
    const data = await selectAll(q, 1000, 5000);

    // v1.7.4: กัน Incident ID ซ้ำก่อนส่งให้หน้าเว็บ
    // ถ้าฐานมีแถวซ้ำหรือ query ดึงซ้ำ จะเหลือ Incident ID ละ 1 ใบเท่านั้น
    const seen = new Set();
    return (data || [])
      .filter(row => {
        const key = row.incident_id || row.id || JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(fromIncident);
  }

  async function getIncidentHistory(params) {
    const incidentId = params.get('incidentId') || '';
    if (!incidentId) return [];
    const sb = getClient();
    const { data, error } = await sb.from('temp_incident_logs')
      .select('*')
      .eq('incident_id', incidentId)
      .order('updated_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(row => ({
      incidentId: row.incident_id,
      updatedAt: row.updated_at ? displayDateTime(row.updated_at) : '',
      caseStatus: row.case_status || '',
      owner: resolveStaffFullNameCached(row.owner),
      actionText: row.action_text || '',
      fixResult: row.fix_result || '',
      updatedBy: resolveStaffFullNameCached(row.updated_by)
    }));
  }

  async function getInactiveSetByDate(targetDate) {
    const sb = getClient();
    const { data, error } = await sb.from('temp_fridge_status_logs')
      .select('fridge_id,start_date,end_date,item_status')
      .lte('start_date', targetDate)
      .or(`end_date.is.null,end_date.gte.${targetDate}`);
    if (error) throw error;
    return new Set((data || []).filter(x => x.item_status !== 'ปิดช่วงแล้ว' || !x.end_date || x.end_date >= targetDate).map(x => x.fridge_id));
  }

  function buildRecordedItem(log, fridge) {
    const isAutoIncident = log.auto_generated === true && !!log.related_incident_id;
    const isNoTemp = String(log.record_type || '').toUpperCase() === 'NO_TEMP';
    return {
      fridgeId: log.fridge_id,
      fridgeName: log.fridge_name || fridge?.fridge_name || '',
      productType: log.product_type || fridge?.product_type || '',
      room: log.storage_location || fridge?.storage_location || '',
      minTemp: fridge?.min_temp ?? '',
      maxTemp: fridge?.max_temp ?? '',
      requireDaily: fridge?.require_daily || '',
      latestStamp: displayDateTime(log.created_at),
      latestRound: log.round,
      latestTime: normalizeTime(log.log_time),
      latestTemp: isNoTemp ? '' : (log.temp_display ?? log.temp),
      latestTempText: isNoTemp ? 'ไม่สามารถวัดได้' : '',
      latestStatus: log.status,
      latestAction: log.action_text || '',
      recorderName: resolveStaffFullNameCached(log.recorder_name),
      recordType: log.record_type || 'TEMP',
      relatedIncidentId: log.related_incident_id || '',
      autoGenerated: log.auto_generated === true,
      dashboardStatus: isAutoIncident ? 'incident_auto' : 'recorded'
    };
  }

  function buildMissingItem(fridge, roundName) {
    return {
      fridgeId: fridge.fridge_id,
      fridgeName: fridge.fridge_name,
      productType: fridge.product_type,
      room: fridge.storage_location,
      minTemp: fridge.min_temp,
      maxTemp: fridge.max_temp,
      expectedRound: roundName,
      expectedTime: roundName === 'เช้า' ? normalizeTime(fridge.morning_time || '07:00') : normalizeTime(fridge.evening_time || '19:00'),
      dashboardStatus: 'missing'
    };
  }

  async function dashboardSummary(params) {
    const sb = getClient();
    const targetDate = params.get('date') || todayYMD();
    const inactiveSet = await getInactiveSetByDate(targetDate);

    const { data: fridgeRows, error: fErr } = await sb.from('temp_fridges')
      .select('fridge_id,fridge_name,product_type,storage_location,require_daily,usage_status,morning_time,evening_time')
      .eq('usage_status', 'ใช้งาน')
      .eq('require_daily', 'ใช่')
      .order('storage_location')
      .order('fridge_id');
    if (fErr) throw fErr;
    const active = (fridgeRows || []).filter(f => !inactiveSet.has(f.fridge_id));
    const activeSet = new Set(active.map(f => f.fridge_id));
    const activeById = new Map(active.map(f => [f.fridge_id, f]));

    const { data: logRows, error: lErr } = await sb.from('temp_logs')
      .select('*')
      .eq('log_date', targetDate)
      .in('round', ['เช้า', 'เย็น'])
      .order('created_at', { ascending: true });
    if (lErr) throw lErr;

    const morningMap = new Map();
    const eveningMap = new Map();
    (logRows || []).forEach(log => {
      if (!activeSet.has(log.fridge_id)) return;
      const fridge = activeById.get(log.fridge_id);
      if (log.round === 'เช้า') morningMap.set(log.fridge_id, buildRecordedItem(log, fridge));
      if (log.round === 'เย็น') eveningMap.set(log.fridge_id, buildRecordedItem(log, fridge));
    });

    const morningRecorded = Array.from(morningMap.values());
    const eveningRecorded = Array.from(eveningMap.values());
    const morningMissing = active.filter(f => !morningMap.has(f.fridge_id)).map(f => buildMissingItem(f, 'เช้า'));
    const eveningMissing = active.filter(f => !eveningMap.has(f.fridge_id)).map(f => buildMissingItem(f, 'เย็น'));

    // Dashboard incident totals must reflect the whole Incident workflow, not only
    // incidents whose found_date matches the date selected for temperature rounds.
    const { data: incRows, error: iErr } = await sb.from('temp_incidents')
      .select('incident_id,case_status,found_date,found_time,updated_at')
      .order('updated_at', { ascending: false });
    if (iErr) throw iErr;

    // Protect the count from legacy duplicate Incident IDs by keeping only the
    // newest row returned for each Incident ID.
    const uniqueIncidentRows = [];
    const seenIncidentIds = new Set();
    (incRows || []).forEach((row, index) => {
      const incidentId = String(row.incident_id || '').trim();
      const key = incidentId || `__row_${index}`;
      if (seenIncidentIds.has(key)) return;
      seenIncidentIds.add(key);
      uniqueIncidentRows.push(row);
    });

    const normalizedStatus = row => String(row?.case_status || '').trim().toLowerCase();
    const isCancelledStatus = row => ['ยกเลิกเคส', 'ยกเลิก', 'cancelled', 'canceled'].includes(normalizedStatus(row));
    const isClosedStatus = row => ['ปิดเคส', 'closed'].includes(normalizedStatus(row));
    const openIncidents = uniqueIncidentRows.filter(row => !isClosedStatus(row) && !isCancelledStatus(row));
    const closedIncidents = uniqueIncidentRows.filter(isClosedStatus);
    const incidents = uniqueIncidentRows;
    const targetRound = new Date().getHours() < 12 ? 'เช้า' : 'เย็น';

    // Keep the same response shape as the old Google Apps Script endpoint.
    // The frontend expects count fields such as morningRecorded to be numbers,
    // and detail rows to be in morningRecordedList / morningMissingList.
    return {
      ok: true,
      date: targetDate,
      totalActive: active.length,
      totalRequired: active.length,
      totalFridges: active.length,

      morningRecorded: morningRecorded.length,
      morningMissing: morningMissing.length,
      eveningRecorded: eveningRecorded.length,
      eveningMissing: eveningMissing.length,

      morningRecordedCount: morningRecorded.length,
      morningMissingCount: morningMissing.length,
      eveningRecordedCount: eveningRecorded.length,
      eveningMissingCount: eveningMissing.length,

      morningRecordedList: morningRecorded,
      morningMissingList: morningMissing,
      eveningRecordedList: eveningRecorded,
      eveningMissingList: eveningMissing,

      currentRecorded: targetRound === 'เช้า' ? morningRecorded.length : eveningRecorded.length,
      currentMissing: targetRound === 'เช้า' ? morningMissing.length : eveningMissing.length,
      missingList: targetRound === 'เช้า' ? morningMissing : eveningMissing,

      incidentCount: incidents.length,
      openIncidentCount: openIncidents.length,
      closedIncidentCount: closedIncidents.length,
      closedTotal: closedIncidents.length,
      // Kept only for compatibility with old front-end builds.
      closedToday: closedIncidents.length,
      incidents,
      openIncidents,
      targetRound,
      currentRound: targetRound
    };
  }


  function kpiIsDailyRequired(value) {
    return ['ใช่', 'true', '1', 'yes', 'y'].includes(String(value ?? '').trim().toLowerCase());
  }

  function kpiMonthBounds(monthValue) {
    const fallback = todayYMD().slice(0, 7);
    const month = /^\d{4}-\d{2}$/.test(String(monthValue || '')) ? String(monthValue) : fallback;
    const [year, monthNumber] = month.split('-').map(Number);
    const startDate = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
    const lastDay = new Date(year, monthNumber, 0).getDate();
    const endDate = `${year}-${String(monthNumber).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const today = todayYMD();
    const cutoffDate = month > today.slice(0, 7) ? '' : (month === today.slice(0, 7) ? today : endDate);
    return { month, startDate, endDate, cutoffDate };
  }

  function kpiDateList(startDate, endDate) {
    if (!startDate || !endDate || startDate > endDate) return [];
    const out = [];
    let current = startDate;
    while (current <= endDate) {
      out.push(current);
      current = addDays(current, 1);
    }
    return out;
  }

  function kpiTimeMinutes(value, fallback = '00:00') {
    const text = normalizeTime(value || fallback) || fallback;
    const match = text.match(/^(\d{1,2}):(\d{2})$/);
    return match ? (Number(match[1]) * 60 + Number(match[2])) : 0;
  }

  function kpiTimestampParts(value) {
    const text = String(value || '').trim();
    if (!text) return { date: '', time: '' };
    const date = toYMD(text);
    const match = text.match(/(?:T|\s)(\d{1,2}):(\d{2})/);
    return { date, time: match ? `${String(Number(match[1])).padStart(2, '0')}:${match[2]}` : '' };
  }

  function kpiNormalizeStatus(value) {
    return String(value || '').trim().toLowerCase();
  }

  function kpiIsCancelledIncident(row) {
    return ['ยกเลิกเคส', 'ยกเลิก', 'cancelled', 'canceled'].includes(kpiNormalizeStatus(row?.case_status));
  }

  function kpiIsClosedIncident(row) {
    return ['ปิดเคส', 'closed'].includes(kpiNormalizeStatus(row?.case_status));
  }

  function kpiIncidentActiveForRound(incident, date, roundName, expectedTime) {
    if (!incident || kpiIsCancelledIncident(incident)) return false;
    const foundDate = toYMD(incident.found_date);
    if (!foundDate || date < foundDate) return false;

    const expectedMinutes = kpiTimeMinutes(expectedTime);
    if (date === foundDate) {
      const incidentRound = normalizeRoundKey(incident.round);
      if (incidentRound === 'เย็น' && roundName !== 'เย็น') return false;
      if (incidentRound !== 'เช้า' && incidentRound !== 'เย็น') {
        const foundMinutes = kpiTimeMinutes(incident.found_time, '00:00');
        if (expectedMinutes < foundMinutes) return false;
      }
    }

    if (!kpiIsClosedIncident(incident)) return true;

    const closed = kpiTimestampParts(incident.updated_date || incident.updated_at);
    if (!closed.date) return false;
    if (date < closed.date) return true;
    if (date > closed.date) return false;
    if (!closed.time) return true;
    return expectedMinutes <= kpiTimeMinutes(closed.time);
  }

  function kpiIsAutoIncidentLog(log) {
    const action = String(log?.action_text || '').toLowerCase();
    const reason = String(log?.no_temp_reason || '').toLowerCase();
    return log?.auto_generated === true ||
      (!!String(log?.related_incident_id || '').trim() && String(log?.record_type || '').toUpperCase() === 'NO_TEMP') ||
      action.includes('ระบบบันทึกอัตโนมัติ: ตู้เสีย') ||
      reason.includes('ตู้เสีย/อยู่ระหว่างซ่อม');
  }

  function kpiIsInactiveOnDate(fridgeId, date, statusRowsByFridge) {
    const rows = statusRowsByFridge.get(fridgeId) || [];
    return rows.some(row => {
      const start = toYMD(row.start_date);
      const end = toYMD(row.end_date);
      return !!start && start <= date && (!end || end >= date);
    });
  }

  function kpiRoundDue(date, expectedTimes) {
    const today = todayYMD();
    if (date < today) return true;
    if (date > today) return false;
    if (!expectedTimes.length) return false;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return nowMinutes >= Math.max(...expectedTimes.map(value => kpiTimeMinutes(value)));
  }

  function kpiDateDisplay(date) {
    const ymd = toYMD(date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
    const [year, month, day] = ymd.split('-');
    return `${day}/${month}/${year}`;
  }

  async function monthlyKpi(params) {
    const sb = getClient();
    const bounds = kpiMonthBounds(params.get('month'));
    const selectedDepartment = String(params.get('department') || 'all').trim() || 'all';

    const { data: fridgeRows, error: fridgeError } = await sb.from('temp_fridges')
      .select('*')
      .eq('usage_status', 'ใช้งาน')
      .order('storage_location')
      .order('fridge_id');
    if (fridgeError) throw fridgeError;

    const fridges = (fridgeRows || []).filter(row => kpiIsDailyRequired(row.require_daily));
    const departments = Array.from(new Set(fridges.map(row => String(row.storage_location || 'ไม่ระบุแผนก').trim() || 'ไม่ระบุแผนก')))
      .sort((a, b) => a.localeCompare(b, 'th'));

    if (!bounds.cutoffDate) {
      return {
        ok: true,
        month: bounds.month,
        selectedDepartment,
        departments,
        summary: { totalRounds: 0, completeRounds: 0, incompleteRounds: 0, percentage: 0, missingRecordCount: 0, exemptRecordCount: 0 },
        departmentResults: [],
        missingEvents: []
      };
    }

    const logQuery = sb.from('temp_logs')
      .select('log_date,round,fridge_id,record_type,auto_generated,related_incident_id,action_text,no_temp_reason')
      .gte('log_date', bounds.startDate)
      .lte('log_date', bounds.cutoffDate)
      .in('round', ['เช้า', 'เย็น'])
      .order('log_date', { ascending: true });
    const logRows = await selectAll(logQuery, 1000, 5000);

    let statusRows = [];
    try {
      const statusResult = await sb.from('temp_fridge_status_logs')
        .select('fridge_id,start_date,end_date,item_status')
        .lte('start_date', bounds.cutoffDate)
        .or(`end_date.is.null,end_date.gte.${bounds.startDate}`);
      if (statusResult.error) throw statusResult.error;
      statusRows = statusResult.data || [];
    } catch (statusError) {
      // ตารางนี้ใช้เพียงยกเว้นช่วงเลิกใช้งานย้อนหลัง หากอ่านไม่ได้ยังคำนวณจาก Master/Incident ต่อได้
      console.warn('KPI status history skipped', statusError);
      statusRows = [];
    }

    const incidentQuery = sb.from('temp_incidents')
      .select('fridge_id,found_date,found_time,round,case_status,updated_date')
      .lte('found_date', bounds.cutoffDate)
      .order('found_date', { ascending: true });
    const incidentRows = await selectAll(incidentQuery, 1000, 2000);

    const logsByKey = new Map();
    (logRows || []).forEach(log => {
      const key = `${toYMD(log.log_date)}|${normalizeRoundKey(log.round)}|${String(log.fridge_id || '').trim()}`;
      if (!logsByKey.has(key)) logsByKey.set(key, []);
      logsByKey.get(key).push(log);
    });

    const statusRowsByFridge = new Map();
    (statusRows || []).forEach(row => {
      const id = String(row.fridge_id || '').trim();
      if (!statusRowsByFridge.has(id)) statusRowsByFridge.set(id, []);
      statusRowsByFridge.get(id).push(row);
    });

    const incidentsByFridge = new Map();
    (incidentRows || []).forEach(row => {
      const id = String(row.fridge_id || '').trim();
      if (!id) return;
      if (!incidentsByFridge.has(id)) incidentsByFridge.set(id, []);
      incidentsByFridge.get(id).push(row);
    });

    const dates = kpiDateList(bounds.startDate, bounds.cutoffDate);
    const results = [];

    for (const department of departments) {
      const departmentFridges = fridges.filter(row => (String(row.storage_location || 'ไม่ระบุแผนก').trim() || 'ไม่ระบุแผนก') === department);
      const missingEvents = [];
      let completeRounds = 0;
      let incompleteRounds = 0;
      let missingRecordCount = 0;
      let exemptRecordCount = 0;

      dates.forEach(date => {
        ['เช้า', 'เย็น'].forEach(roundName => {
          const activeFridges = departmentFridges.filter(fridge => !kpiIsInactiveOnDate(String(fridge.fridge_id || '').trim(), date, statusRowsByFridge));
          const effective = [];
          const expectedTimes = [];

          activeFridges.forEach(fridge => {
            const fridgeId = String(fridge.fridge_id || '').trim();
            const expectedTime = roundName === 'เช้า' ? normalizeTime(fridge.morning_time || '07:00') : normalizeTime(fridge.evening_time || '19:00');
            const key = `${date}|${roundName}|${fridgeId}`;
            const logs = logsByKey.get(key) || [];
            const autoExempt = logs.some(kpiIsAutoIncidentLog);
            const incidentExempt = (incidentsByFridge.get(fridgeId) || []).some(incident => kpiIncidentActiveForRound(incident, date, roundName, expectedTime));
            if (autoExempt || incidentExempt) {
              exemptRecordCount += 1;
              return;
            }
            effective.push({ fridge, fridgeId, expectedTime, logs });
            expectedTimes.push(expectedTime);
          });

          if (!effective.length || !kpiRoundDue(date, expectedTimes)) return;

          const missing = effective.filter(item => !item.logs.length);
          if (missing.length === 0) {
            completeRounds += 1;
          } else {
            incompleteRounds += 1;
            missingRecordCount += missing.length;
            missingEvents.push({
              date,
              dateDisplay: kpiDateDisplay(date),
              round: roundName,
              department,
              expectedCount: effective.length,
              recordedCount: effective.length - missing.length,
              missingCount: missing.length,
              missingFridges: missing.map(item => ({
                fridgeId: item.fridgeId,
                fridgeName: item.fridge.fridge_name || '',
                productType: item.fridge.product_type || ''
              }))
            });
          }
        });
      });

      const totalRounds = completeRounds + incompleteRounds;
      results.push({
        department,
        totalRounds,
        completeRounds,
        incompleteRounds,
        percentage: totalRounds ? (completeRounds / totalRounds) * 100 : 0,
        missingRecordCount,
        exemptRecordCount,
        missingEvents
      });
    }

    const visibleResults = selectedDepartment === 'all'
      ? results
      : results.filter(row => row.department === selectedDepartment);
    const summary = visibleResults.reduce((acc, row) => {
      acc.totalRounds += row.totalRounds;
      acc.completeRounds += row.completeRounds;
      acc.incompleteRounds += row.incompleteRounds;
      acc.missingRecordCount += row.missingRecordCount;
      acc.exemptRecordCount += row.exemptRecordCount;
      return acc;
    }, { totalRounds: 0, completeRounds: 0, incompleteRounds: 0, missingRecordCount: 0, exemptRecordCount: 0 });
    summary.percentage = summary.totalRounds ? (summary.completeRounds / summary.totalRounds) * 100 : 0;

    const missingEvents = visibleResults.flatMap(row => row.missingEvents || [])
      .sort((a, b) => `${b.date}|${b.round}`.localeCompare(`${a.date}|${a.round}`, 'th'));

    return {
      ok: true,
      month: bounds.month,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
      cutoffDate: bounds.cutoffDate,
      selectedDepartment: departments.includes(selectedDepartment) ? selectedDepartment : 'all',
      departments,
      summary,
      departmentResults: visibleResults,
      missingEvents
    };
  }

  async function checkDuplicate(params) {
    const date = params.get('date') || '';
    const round = params.get('round') || '';
    const time = normalizeTime(params.get('time') || '');
    const fridgeId = params.get('fridgeId') || '';
    if (!date || !round || !fridgeId) return { ok: false, duplicate: false, message: 'ข้อมูลไม่ครบ' };

    const sb = getClient();
    let q = sb.from('temp_logs').select('*').eq('log_date', date).eq('fridge_id', fridgeId).limit(1);
    if (round === 'เช้า' || round === 'เย็น') q = q.eq('round', round);
    else if (round === 'ผิดปกติ') q = q.eq('log_time', time);
    else q = q.eq('round', round);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) return { ok: true, duplicate: false, message: 'ยังไม่พบข้อมูลซ้ำ' };
    const row = data[0];
    return {
      ok: true,
      duplicate: true,
      message: round === 'ผิดปกติ'
        ? `มีการบันทึกข้อมูลตู้ ${fridgeId} สำหรับวันที่ ${date} เวลา ${time} ไปแล้ว`
        : `วันนี้รอบ${round} ของตู้ ${fridgeId} ถูกบันทึกแล้ว`,
      data: { round: row.round, time: normalizeTime(row.log_time), temp: row.temp_display ?? row.temp, recorderName: resolveStaffFullNameCached(row.recorder_name) }
    };
  }


  function getAlertConfig() {
    const cfg = window.CNMI_CHAT_ALERT_CONFIG || {};
    return {
      enabled: cfg.ENABLE_CHAT_ALERT !== false,
      relayUrl: String(cfg.ALERT_RELAY_WEB_APP_URL || '').trim(),
      appBaseUrl: String(cfg.APP_BASE_URL || (window.location.origin + window.location.pathname)).trim()
    };
  }

  let alertConfigReloadPromise = null;
  function reloadAlertConfigFromNetwork() {
    if (alertConfigReloadPromise) return alertConfigReloadPromise;
    alertConfigReloadPromise = new Promise((resolve) => {
      try {
        const previous = document.getElementById('cnmi-chat-alert-config-runtime');
        if (previous) previous.remove();
        const script = document.createElement('script');
        script.id = 'cnmi-chat-alert-config-runtime';
        script.async = true;
        script.src = `./chat-alert-config.js?v=20260707-v1823&_=${Date.now()}`;
        script.onload = () => resolve(getAlertConfig());
        script.onerror = () => resolve(getAlertConfig());
        document.head.appendChild(script);
      } catch (error) {
        console.warn('Reload chat alert config failed:', error);
        resolve(getAlertConfig());
      }
    }).finally(() => {
      alertConfigReloadPromise = null;
    });
    return alertConfigReloadPromise;
  }

  function buildIncidentUpdateUrl(incidentId) {
    const cfg = getAlertConfig();
    const configuredBase = cfg.appBaseUrl || 'https://temp.cnmiblood.com/';
    let url;
    try {
      url = new URL(configuredBase, window.location.origin);
    } catch (error) {
      url = new URL('https://temp.cnmiblood.com/');
    }
    // การแจ้งเตือนจริงต้องกลับเข้าชื่อโดเมนที่ติดตั้งเป็น PWA เสมอ
    // แม้ผู้ดูแลกำลังทดสอบผ่าน GitHub Pages โดยตรง
    if (url.hostname !== 'temp.cnmiblood.com') {
      url = new URL('https://temp.cnmiblood.com/');
    }

    // ใช้ URL ที่อยู่ภายใน scope ของ PWA เพื่อให้ระบบปฏิบัติการมีโอกาสเปิด
    // CNMI Temp ที่ติดตั้งไว้ แทนการเปิดเป็นแท็บเว็บใหม่
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    url.searchParams.set('page', 'updateIncident');
    url.searchParams.set('incidentId', String(incidentId || '').trim());
    url.searchParams.set('source', 'google-chat');
    url.searchParams.set('openMode', 'app');
    url.searchParams.set('v', '1831');
    return url.toString();
  }

  function isNoTempAlertable(reason, detail) {
    const r = String(reason || '').trim();
    const d = String(detail || '').trim();
    const combined = `${r} ${d}`.toLowerCase();

    // ไม่แจ้ง Google Chat สำหรับเหตุ routine ที่ไม่ต้องให้ BEM รับเรื่องทันที
    const routineReasons = [
      'ล้างตู้เย็น / ยังไม่ได้เปิดเครื่อง',
      'รออุณหภูมิ stable หลังเปิดเครื่อง'
    ];
    if (routineReasons.includes(r)) return false;

    const directProblemReasons = [
      'Probe / Sensor มีปัญหา',
      'หน้าจอตู้ไม่แสดงผล',
      'ตู้เปิดใช้งานแต่ไม่สามารถอ่านค่าได้'
    ];
    if (directProblemReasons.includes(r)) return true;

    // กรณีเลือก "อื่นๆ" ให้แจ้งเฉพาะเมื่อรายละเอียดบอกชัดว่าต้องตาม BEM/ซ่อม/เสีย/ตรวจสอบ
    return /bem|b\.e\.m|ซ่อม|เสีย|ตรวจสอบ|probe|sensor|หน้าจอ|อ่านค่า|alarm|alert/.test(combined);
  }

  function shouldOpenIncidentAndAlert({ recordType, isAbnormal, round, noTempReason, noTempDetail }) {
    if (recordType === 'TEMP') {
      // รอบผิดปกติหมายถึงผู้ปฏิบัติงานพบเหตุจากการสังเกตหน้างาน
      // จึงต้องเปิด Incident/แจ้ง BEM แม้อุณหภูมิ ณ เวลาบันทึกยังไม่ออกนอกช่วง
      return !!isAbnormal || isAbnormalRound(round);
    }
    if (recordType === 'NO_TEMP') return isNoTempAlertable(noTempReason, noTempDetail);
    return false;
  }

  async function sendIncidentChatAlert(data) {
    try {
      let cfg = getAlertConfig();
      if (!cfg.enabled) return false;

      // V1.8.23: ถ้าเบราว์เซอร์/PWA ค้าง config เก่าที่ URL ว่าง ให้โหลดไฟล์จริงจากเครือข่ายใหม่ทันที
      if (!cfg.relayUrl) {
        cfg = await reloadAlertConfigFromNetwork();
      }
      if (!cfg.enabled || !cfg.relayUrl) return false;

      const payload = {
        incidentId: data.incidentId,
        alertType: data.alertType || 'TEMP_ABNORMAL',
        date: data.date,
        round: data.round,
        time: data.time,
        fridgeId: data.fridgeId,
        fridgeName: data.fridgeName,
        productType: data.productType,
        storageLocation: data.storageLocation,
        temp: data.tempDisplay ?? data.temp ?? '-',
        minTemp: data.minTemp,
        maxTemp: data.maxTemp,
        recorderName: data.recorderName,
        note: data.note || '-',
        actionText: data.actionText || data.note || '-',
        noTempReason: data.noTempReason || '',
        noTempDetail: data.noTempDetail || '',
        observedBeforeOutOfRange: !!data.observedBeforeOutOfRange,
        isFollowUp: !!data.isFollowUp,
        isResend: !!data.isResend,
        resendNote: data.resendNote || '',
        requestedBy: data.requestedBy || '',
        existingCaseStatus: data.existingCaseStatus || '',
        updateUrl: buildIncidentUpdateUrl(data.incidentId),
        alertChannel: 'BEM'
      };

      // ใช้ no-cors เพื่อไม่ให้ CORS ของ Apps Script มาขวางหน้าเว็บ
      await fetch(cfg.relayUrl, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-store',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      return true;
    } catch (err) {
      console.warn('Google Chat alert error:', err);
      return false;
    }
  }

  async function submitTemperature(params) {
    const sb = getClient();
    const date = params.get('date') || '';
    const round = params.get('round') || '';
    const timeText = normalizeTime(params.get('time') || '');
    const fridgeId = params.get('fridgeId') || '';
    const recordType = params.get('recordType') || 'TEMP';
    const temp = toNumOrNull(params.get('temp'));
    const actor = await getActorContext(params);
    const recorderInput = String(params.get('recorderName') || actor.fullName || '').trim().replace(/\s+/g, ' ');
    const recorderName = await getStaffFullName(actor.fullName || recorderInput);
    const note = (params.get('note') || '').trim();
    const noTempReason = (params.get('noTempReason') || '').trim();
    const noTempDetail = (params.get('noTempDetail') || '').trim();

    if (date !== todayYMD()) return { ok: false, message: 'ระบบอนุญาตให้บันทึกได้เฉพาะวันที่ปัจจุบันเท่านั้น' };
    if (!date || !round || !timeText || !fridgeId || !recorderName) return { ok: false, message: 'ข้อมูลไม่ครบ' };
    if (recordType === 'TEMP' && temp === null) return { ok: false, message: 'กรุณากรอกอุณหภูมิ' };
    if (recordType === 'NO_TEMP' && (!noTempReason || !noTempDetail)) return { ok: false, message: 'กรุณาระบุเหตุผลและรายละเอียดที่ไม่สามารถวัดอุณหภูมิได้' };

    const { data: fridgeRows, error: fErr } = await sb.from('temp_fridges')
      .select('*')
      .eq('fridge_id', fridgeId)
      .eq('usage_status', 'ใช้งาน')
      .limit(1);
    const fridge = Array.isArray(fridgeRows) ? fridgeRows[0] : null;
    if (fErr || !fridge) return { ok: false, message: 'ไม่พบรหัสตู้ หรือ ตู้นี้ไม่ได้อยู่ในสถานะใช้งาน' };

    const dup = await checkDuplicate(new URLSearchParams({ date, round, time: timeText, fridgeId }));
    if (dup.duplicate) return { ok: false, message: dup.message };

    let status = 'ปกติ';
    let isAbnormal = false;
    if (recordType === 'TEMP') {
      const range = getTempRange(fridge);
      isAbnormal = !!range && (temp < range.minTemp || temp > range.maxTemp);
      status = isAbnormal ? 'ผิดปกติ' : 'ปกติ';
    } else {
      status = 'ไม่สามารถวัดอุณหภูมิได้';
    }
    if (recordType === 'TEMP' && (isAbnormal || isAbnormalRound(round)) && !note) {
      return { ok: false, message: 'กรุณากรอกการดำเนินการ' };
    }

    const actionText = recordType === 'NO_TEMP' ? `${noTempReason} | ${noTempDetail}` : note;
    const logId = `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    const insertRow = {
      log_date: date,
      round,
      log_time: timeText,
      fridge_id: fridge.fridge_id,
      fridge_name: fridge.fridge_name,
      product_type: fridge.product_type,
      temp: recordType === 'NO_TEMP' ? null : temp,
      temp_display: recordType === 'NO_TEMP' ? '-' : String(temp),
      status,
      action_text: actionText,
      storage_location: fridge.storage_location,
      recorder_name: recorderName,
      recorder_input: recorderInput || recorderName,
      log_id: logId,
      record_type: recordType,
      is_valid_for_graph: recordType === 'TEMP',
      no_temp_reason: noTempReason,
      no_temp_detail: noTempDetail,
      ...actorColumns(actor)
    };

    const { error: insertErr } = await sb.from('temp_logs').insert(insertRow);
    if (insertErr) {
      const insertMessage = String(insertErr.message || insertErr.details || insertErr.hint || insertErr);
      if (insertMessage.includes('duplicate') || insertErr.code === '23505') {
        return { ok: false, message: `มีการบันทึกข้อมูลตู้ ${fridgeId} วันที่ ${date} รอบ${round} ไปแล้ว กรุณาตรวจสอบประวัติก่อนบันทึกซ้ำ` };
      }
      if (/recorder_input/i.test(insertMessage) || insertErr.code === 'PGRST204') {
        return {
          ok: false,
          message: 'กรุณารันไฟล์ 00_RUN_IN_SUPABASE_v1_8_21_NAME_AND_ABNORMAL_ALERT_FIX.sql ก่อนใช้งาน V1.8.21'
        };
      }
      if (/relation [\"']public\.staff[\"'] does not exist/i.test(insertMessage)) {
        return {
          ok: false,
          message: 'ฐานข้อมูลยังขาดตัวเชื่อมชื่อเดิม public.staff กรุณารันไฟล์ 00_RUN_IN_SUPABASE_v1_8_18_RESTORE_PUBLIC_STAFF.sql หนึ่งครั้ง แล้วลองบันทึกใหม่'
        };
      }
      throw insertErr;
    }

    const savedRecorderName = recorderName || recorderInput;

    const needIncidentAlert = shouldOpenIncidentAndAlert({
      recordType,
      isAbnormal,
      round,
      noTempReason,
      noTempDetail
    });

    let incidentId = '';
    if (needIncidentAlert) {
      incidentId = await createIncident({
        date,
        round,
        time: timeText,
        fridgeId: fridge.fridge_id,
        fridgeName: fridge.fridge_name,
        productType: fridge.product_type,
        storageLocation: fridge.storage_location,
        temp: recordType === 'NO_TEMP' ? null : temp,
        tempDisplay: recordType === 'NO_TEMP' ? '-' : String(temp),
        minTemp: fridge.min_temp,
        maxTemp: fridge.max_temp,
        recorderName: savedRecorderName,
        note: recordType === 'NO_TEMP' ? actionText : note,
        actionText,
        recordType,
        noTempReason,
        noTempDetail,
        alertType: recordType === 'NO_TEMP'
          ? 'NO_TEMP_ALERT'
          : (isAbnormalRound(round) && !isAbnormal ? 'OBSERVED_ABNORMAL_ALERT' : 'TEMP_ABNORMAL'),
        observedBeforeOutOfRange: recordType === 'TEMP' && isAbnormalRound(round) && !isAbnormal,
        actor
      });
    }

    const alertConfigState = getAlertConfig();
    const bemAlertRequested = needIncidentAlert && alertConfigState.enabled && !!alertConfigState.relayUrl;

    return {
      ok: true,
      message: 'บันทึกสำเร็จ',
      status,
      fridgeName: fridge.fridge_name,
      productType: fridge.product_type,
      temp: recordType === 'NO_TEMP' ? '-' : temp,
      minTemp: fridge.min_temp,
      maxTemp: fridge.max_temp,
      actionText,
      incidentId,
      recordType,
      noTempReason,
      noTempDetail,
      recorderName: savedRecorderName,
      recorderNameWarning: '',
      bemAlertRequested,
      bemAlertWarning: needIncidentAlert && !bemAlertRequested
        ? 'ยังไม่ได้ตั้งค่า URL ส่ง Google Chat ใน chat-alert-config.js'
        : '',
      abnormalRoundAlert: recordType === 'TEMP' && isAbnormalRound(round)
    };
  }


  async function findOpenIncidentForFridge(fridgeId) {
    const sb = getClient();
    if (!fridgeId) return null;
    const { data, error } = await sb.from('temp_incidents')
      .select('*')
      .eq('fridge_id', fridgeId)
      .not('case_status', 'in', '(ปิดเคส,ยกเลิกเคส)')
      .order('found_date', { ascending: false })
      .order('found_time', { ascending: false })
      .limit(1);
    if (error) { console.warn('findOpenIncidentForFridge warning:', error); return null; }
    return (data && data.length) ? data[0] : null;
  }

  async function appendToExistingIncident(existing, data, actionText) {
    const sb = getClient();
    const incidentId = existing.incident_id || existing.incidentId;
    if (!incidentId) return '';
    const detail = [
      'พบการบันทึกเหตุผิดปกติซ้ำในตู้เดิม ขณะ Incident เดิมยังไม่ปิดเคส',
      `วันที่/เวลา: ${data.date || '-'} ${data.time || '-'}`,
      `รอบ: ${data.round || '-'}`,
      `Temp: ${data.tempDisplay ?? data.temp ?? '-'} °C`,
      `รายละเอียด: ${actionText || '-'}`
    ].join(' | ');
    const now = nowTimestamp();
    await sb.from('temp_incident_logs').insert({
      incident_id: incidentId,
      bem_job_no: existing.bem_job_no || '',
      updated_at: now,
      case_status: existing.case_status || 'รอ BEM รับเรื่อง',
      owner: existing.owner || '',
      action_text: detail,
      fix_result: 'ระบบไม่สร้าง Incident ใหม่ เพราะตู้เดิมมีเคสที่ยังไม่ปิดอยู่',
      updated_by: data.actor?.fullName || data.recorderName || '',
      updated_by_email: data.actor?.email || '',
      ...actorColumns(data.actor)
    }).then(({ error }) => { if (error) console.warn('append existing incident log failed:', error); });
    await sb.from('temp_incidents').update({
      updated_date: now,
      log_note: `${existing.log_note || ''}${existing.log_note ? ' | ' : ''}${detail}`.slice(0, 2000),
      updated_by_email: data.actor?.email || existing.updated_by_email || ''
    }).eq('incident_id', incidentId).then(({ error }) => { if (error) console.warn('update existing incident failed:', error); });
    // V1.8.21: รอบผิดปกติเป็นเหตุใหม่จากการสังเกตหน้างาน จึงแจ้ง BEM ทุกครั้ง
    // แม้ตู้เดิมมี Incident เปิดอยู่แล้ว แต่ยังใช้ Incident เดิมเพื่อไม่สร้างเคสซ้ำ
    if (isAbnormalRound(data.round)) {
      void sendIncidentChatAlert({
        ...data,
        incidentId,
        actionText,
        alertType: data.alertType || 'OBSERVED_ABNORMAL_ALERT',
        observedBeforeOutOfRange: true,
        isFollowUp: true,
        existingCaseStatus: existing.case_status || ''
      });
    }
    return incidentId;
  }

  async function createIncident(data) {
    const sb = getClient();
    const actionText = data.actionText || data.note || '-';

    // v1.7.3: ถ้าตู้เดิมมี Incident ที่ยังไม่ปิดอยู่แล้ว ห้ามเปิดเคสใหม่ซ้ำทุกครั้งที่มีการบันทึกอุณหภูมิ
    // ให้ผูก log เพิ่มกับ Incident เดิมแทน และไม่ส่ง Google Chat ซ้ำ เพื่อไม่ให้ BEM ต้องกดรับเรื่องหลายใบในตู้เดียวกัน
    const existingOpen = await findOpenIncidentForFridge(data.fridgeId);
    if (existingOpen) {
      return await appendToExistingIncident(existingOpen, data, actionText);
    }

    const incidentId = `INC-${data.date.replaceAll('-', '')}-${String(Date.now()).slice(-6)}`;
    const incidentRow = {
      incident_id: incidentId,
      found_date: data.date,
      found_time: data.time,
      room: data.storageLocation,
      fridge_id: data.fridgeId,
      temp: data.temp,
      reporter: data.recorderName,
      case_status: 'รอ BEM รับเรื่อง',
      owner: '',
      action_text: actionText,
      fix_result: '',
      updated_date: nowTimestamp(),
      updated_by_email: data.actor?.email || '',
      round: data.round,
      log_note: data.note || actionText || '',
      ...actorColumns(data.actor)
    };
    const { error: incErr } = await sb.from('temp_incidents').insert(incidentRow);
    if (incErr) throw incErr;

    const { error: logErr } = await sb.from('temp_incident_logs').insert({
      incident_id: incidentId,
      bem_job_no: '',
      updated_at: nowTimestamp(),
      case_status: 'รอ BEM รับเรื่อง',
      owner: '',
      action_text: actionText,
      fix_result: '',
      updated_by: data.actor?.fullName || data.recorderName,
      updated_by_email: data.actor?.email || '',
      ...actorColumns(data.actor)
    });
    if (logErr) console.warn('incident log insert failed:', logErr);

    // ส่ง Google Chat แบบไม่บล็อกการบันทึกหลัก และส่งเฉพาะ incident ที่เข้าเงื่อนไขเท่านั้น
    void sendIncidentChatAlert({ ...data, incidentId, actionText });

    return incidentId;
  }


  async function resendIncidentAlert(params) {
    const sb = getClient();
    const incidentId = String(params.get('incidentId') || '').trim();
    const actor = await getActorContext(params);
    const requestedByInput = String(params.get('requestedBy') || actor.fullName || '').trim();
    const requestedBy = actor.fullName || await getStaffFullName(requestedByInput);
    const resendNote = String(params.get('note') || '').trim();

    if (!incidentId) return { ok: false, message: 'กรุณาระบุ Incident ID' };
    if (!requestedBy) return { ok: false, message: 'กรุณาระบุชื่อผู้กดส่งแจ้งเตือน' };

    const { data: incident, error: incidentError } = await sb.from('temp_incidents')
      .select('*')
      .eq('incident_id', incidentId)
      .maybeSingle();
    if (incidentError) throw incidentError;
    if (!incident) return { ok: false, message: `ไม่พบ Incident ${incidentId}` };

    const status = String(incident.case_status || '').trim();
    if (['ปิดเคส', 'ยกเลิกเคส', 'ยกเลิก'].includes(status)) {
      return { ok: false, message: `Incident ${incidentId} อยู่ในสถานะ ${status} จึงไม่ส่งแจ้งเตือนซ้ำ` };
    }

    // ป้องกันการกดซ้ำรัว ๆ จากมือถือ/คอมหลายครั้งภายใน 60 วินาที
    const { data: recentRows, error: recentError } = await sb.from('temp_incident_logs')
      .select('updated_at,action_text,updated_by')
      .eq('incident_id', incidentId)
      .ilike('action_text', '[แจ้ง Google Chat ซ้ำ]%')
      .order('updated_at', { ascending: false })
      .limit(1);
    if (recentError) console.warn('resend cooldown lookup failed:', recentError);
    const latest = Array.isArray(recentRows) && recentRows.length ? recentRows[0] : null;
    if (latest?.updated_at) {
      const lastMs = new Date(String(latest.updated_at).replace(' ', 'T')).getTime();
      if (Number.isFinite(lastMs) && Date.now() - lastMs < 60 * 1000) {
        return {
          ok: false,
          message: `เพิ่งส่งแจ้งเตือน Incident นี้ไปแล้ว กรุณารอประมาณ 1 นาที ก่อนกดส่งอีกครั้ง`,
          incidentId,
          lastRequestedBy: latest.updated_by || ''
        };
      }
    }

    const { data: fridge, error: fridgeError } = await sb.from('temp_fridges')
      .select('*')
      .eq('fridge_id', incident.fridge_id)
      .maybeSingle();
    if (fridgeError) console.warn('resend fridge lookup failed:', fridgeError);

    const alertRequested = await sendIncidentChatAlert({
      incidentId,
      alertType: 'RESEND_BEM_ALERT',
      date: incident.found_date || '',
      round: incident.round || 'ผิดปกติ',
      time: normalizeTime(incident.found_time),
      fridgeId: incident.fridge_id || '',
      fridgeName: fridge?.fridge_name || '',
      productType: fridge?.product_type || '',
      storageLocation: incident.room || fridge?.storage_location || '',
      temp: incident.temp,
      tempDisplay: incident.temp,
      minTemp: fridge?.min_temp ?? '',
      maxTemp: fridge?.max_temp ?? '',
      recorderName: resolveStaffFullNameCached(incident.reporter),
      note: incident.log_note || incident.action_text || '-',
      actionText: incident.action_text || incident.log_note || '-',
      isResend: true,
      resendNote,
      requestedBy,
      existingCaseStatus: status
    });

    if (!alertRequested) {
      return {
        ok: false,
        message: 'ยังอ่านค่า Google Chat Alert Relay ไม่ได้ กรุณารีเฟรชแอปหลังอัปโหลด V1.8.23 และตรวจว่า chat-alert-config.js มี URL /exec'
      };
    }

    const now = nowTimestamp();
    const logAction = `[แจ้ง Google Chat ซ้ำ] ${resendNote || 'ส่งแจ้งย้อนหลัง/ส่งซ้ำจากหน้า Incident'}`;
    const { error: logError } = await sb.from('temp_incident_logs').insert({
      incident_id: incidentId,
      bem_job_no: incident.bem_job_no || '',
      updated_at: now,
      case_status: status || 'รอ BEM รับเรื่อง',
      owner: incident.owner || '',
      action_text: logAction,
      fix_result: 'ส่งคำขอแจ้งเตือน BEM ซ้ำ โดยไม่สร้าง Incident หรือ Temp Log ใหม่',
      updated_by: requestedBy,
      updated_by_email: actor.email || '',
      ...actorColumns(actor)
    });
    if (logError) throw logError;

    await sb.from('temp_incidents').update({
      updated_date: now,
      updated_at: now,
      updated_by_email: actor.email || incident.updated_by_email || ''
    }).eq('incident_id', incidentId).then(({ error }) => {
      if (error) console.warn('resend incident updated_date failed:', error);
    });

    return {
      ok: true,
      message: 'ส่งคำขอแจ้งเตือน BEM ซ้ำแล้ว และบันทึกใน Timeline เรียบร้อย',
      incidentId,
      requestedBy,
      caseStatus: status
    };
  }

  async function updateIncident(params) {
    const sb = getClient();
    const incidentId = params.get('incidentId') || '';
    const caseStatus = params.get('caseStatus') || '';
    const bemJobNo = params.get('bemJobNo') || '';
    const actor = await getActorContext(params);
    const owner = actor.fullName || await getStaffFullName(params.get('owner') || '');
    const actionText = params.get('actionText') || '';
    const fixResult = params.get('fixResult') || '';
    const updatedBy = actor.fullName || await getStaffFullName(params.get('updatedBy') || owner || '');
    const updatedByEmail = actor.email || params.get('updatedByEmail') || '';
    if (!incidentId || !caseStatus) return { ok: false, message: 'กรุณาระบุ Incident ID และสถานะเคส' };
    const updatedAt = nowTimestamp();
    const { error } = await sb.from('temp_incidents').update({
      case_status: caseStatus,
      bem_job_no: bemJobNo,
      owner,
      action_text: actionText,
      fix_result: fixResult,
      updated_date: updatedAt,
      updated_at: updatedAt,
      updated_by_email: updatedByEmail,
      ...actorColumns(actor)
    }).eq('incident_id', incidentId);
    if (error) throw error;
    await sb.from('temp_incident_logs').insert({
      incident_id: incidentId,
      bem_job_no: bemJobNo,
      updated_at: updatedAt,
      case_status: caseStatus,
      owner,
      action_text: actionText,
      fix_result: fixResult,
      updated_by: updatedBy,
      updated_by_email: updatedByEmail,
      ...actorColumns(actor)
    });
    return { ok: true, message: 'อัปเดต Incident สำเร็จ', incidentId, caseStatus, bemJobNo };
  }

  async function todayLogStatus(params) {
    const sb = getClient();
    const date = params.get('date') || todayYMD();
    const fridgeId = params.get('fridgeId') || '';
    let q = sb.from('temp_logs').select('*').eq('log_date', date).order('created_at', { ascending: false });
    if (fridgeId) q = q.eq('fridge_id', fridgeId);
    const { data, error } = await q;
    if (error) throw error;
    return { ok: true, date, fridgeId, records: (data || []).map(row => ({
      date: row.log_date,
      round: row.round,
      time: normalizeTime(row.log_time),
      fridgeId: row.fridge_id,
      temp: row.temp_display ?? row.temp,
      status: row.status,
      recorderName: resolveStaffFullNameCached(row.recorder_name),
      recordType: row.record_type
    })) };
  }

  async function getHistory(params) {
    const sb = getClient();
    const fridgeId = params.get('fridgeId') || '';
    const startDate = params.get('startDate') || '';
    const endDate = params.get('endDate') || '';
    if (!fridgeId || !startDate || !endDate) return { ok: false, message: 'กรุณาระบุรหัสตู้ วันที่เริ่ม และวันที่สิ้นสุด' };

    const { data: fridge } = await sb.from('temp_fridges').select('*').eq('fridge_id', fridgeId).maybeSingle();
    const { data, error } = await sb.from('temp_logs')
      .select('*')
      .eq('fridge_id', fridgeId)
      .gte('log_date', startDate)
      .lte('log_date', endDate)
      .order('log_date', { ascending: true })
      .order('log_time', { ascending: true });
    if (error) throw error;
    const records = (data || []).map(row => ({
      timestamp: row.created_at || '',
      date: formatDateDisplay(row.log_date),
      round: row.round || '',
      time: normalizeTime(row.log_time),
      fridgeId: row.fridge_id || '',
      fridgeName: row.fridge_name || '',
      productType: row.product_type || '',
      temp: row.record_type === 'NO_TEMP' ? null : row.temp,
      tempDisplay: row.record_type === 'NO_TEMP' ? '-' : (row.temp_display ?? row.temp),
      status: row.status || '',
      action: row.action_text || '',
      storageLocation: row.storage_location || '',
      recorderName: resolveStaffFullNameCached(row.recorder_name),
      recordType: row.record_type || 'TEMP',
      isValidForGraph: row.is_valid_for_graph !== false && row.record_type !== 'NO_TEMP',
      noTempReason: row.no_temp_reason || '',
      noTempDetail: row.no_temp_detail || '',
      relatedIncidentId: row.related_incident_id || '',
      autoGenerated: row.auto_generated === true
    }));
    return { ok: true, fridgeId, fridgeName: fridge?.fridge_name || '', minTemp: fridge?.min_temp ?? null, maxTemp: fridge?.max_temp ?? null, total: records.length, records };
  }

  async function updateFridgeStatus(params) {
    const sb = getClient();
    const fridgeId = params.get('fridgeId') || '';
    const rawStatus = params.get('status') || params.get('newStatus') || '';
    const newStatus = normalizeFridgeUsageStatus(rawStatus);
    const reason = normalizeFridgeInactiveReason(newStatus, rawStatus, params.get('reason') || '');
    const detail = params.get('detail') || '';
    const actor = await getActorContext(params);
    const updatedBy = actor.fullName || await getStaffFullName(params.get('updatedBy') || '');
    const updatedByEmail = actor.email || '';

    if (!fridgeId || !newStatus) return { ok: false, message: 'ข้อมูลไม่ครบ กรุณาเลือกตู้และสถานะ' };
    if (newStatus !== 'ใช้งาน' && !reason) return { ok: false, message: 'กรุณาระบุเหตุผลที่ไม่ได้ใช้งาน' };

    // V1.8.17: ทำ Master + Status Log ใน transaction เดียวผ่าน RPC
    // ป้องกันกรณี Master เปลี่ยนแล้ว แต่ Log insert ถูก RLS ปฏิเสธจนข้อมูลค้างครึ่งทาง
    const { data, error } = await sb.rpc('temp_update_fridge_status_v1817', {
      p_fridge_id: fridgeId,
      p_status: newStatus,
      p_reason: reason || '',
      p_detail: detail || '',
      p_updated_by: updatedBy || '',
      p_updated_by_email: updatedByEmail || ''
    });

    if (error) {
      const message = String(error.message || error.details || error.hint || error);
      if (/temp_update_fridge_status_v1817|function .* does not exist|schema cache|PGRST202/i.test(message)) {
        return {
          ok: false,
          message: 'ฐานข้อมูลยังไม่ได้ติดตั้งตัวแก้ V1.8.17 กรุณารันไฟล์ 00_RUN_IN_SUPABASE_v1_8_17_RLS_STATUS_RPC.sql ก่อนใช้งานเมนูนี้'
        };
      }
      throw error;
    }

    const result = Array.isArray(data) ? data[0] : data;
    return result && typeof result === 'object'
      ? result
      : { ok: true, message: 'อัปเดตสถานะตู้เรียบร้อย', fridgeId, newStatus, reason, detail, updatedBy };
  }

  async function alarmDueList() {
    const sb = getClient();
    const skipIds = ['CN-B-05173', 'CN-B-01464', 'CN-B-01465'];
    const today = todayYMD();
    const { data: fridges, error: fErr } = await sb.from('temp_fridges')
      .select('*')
      .eq('usage_status', 'ใช้งาน')
      .order('storage_location')
      .order('fridge_id');
    if (fErr) throw fErr;
    const { data: alarmRows, error: aErr } = await sb.from('temp_alarm_test_logs')
      .select('fridge_id,test_date,overall_result,tester')
      .order('test_date', { ascending: false });
    if (aErr) throw aErr;
    const latest = new Map();
    (alarmRows || []).forEach(row => { if (!latest.has(row.fridge_id)) latest.set(row.fridge_id, row); });

    const allItems = [];
    (fridges || []).forEach(f => {
      if (!f.fridge_id || skipIds.includes(f.fridge_id)) return;
      const l = latest.get(f.fridge_id);
      let lastTestDate = '';
      let nextDueDate = '';
      let daysSinceLast = null;
      let dueStatus = 'ยังไม่เคยทำ Alarm Test';
      let isDue = true;
      if (l && l.test_date) {
        lastTestDate = l.test_date;
        daysSinceLast = Math.floor((new Date(today) - new Date(l.test_date)) / (1000 * 60 * 60 * 24));
        nextDueDate = addDays(l.test_date, 30);
        isDue = daysSinceLast >= 30;
        dueStatus = isDue ? 'ครบกำหนด 30 วัน' : 'ยังไม่ครบกำหนด';
      }
      allItems.push({
        fridgeId: f.fridge_id,
        fridgeName: f.fridge_name,
        productType: f.product_type,
        room: f.storage_location,
        statusUse: f.usage_status,
        requireDaily: f.require_daily,
        lastTestDate: lastTestDate || '-',
        nextDueDate: nextDueDate || '-',
        daysSinceLast,
        dueStatus,
        isDue,
        lastResult: l ? l.overall_result : '-',
        lastTester: l ? resolveStaffFullNameCached(l.tester) : '-'
      });
    });
    const dueItems = allItems.filter(x => x.isDue).sort((a, b) => (a.room || '').localeCompare(b.room || '', 'th') || (a.fridgeId || '').localeCompare(b.fridgeId || '', 'th'));
    const notDueItems = allItems.filter(x => !x.isDue).sort((a, b) => (b.daysSinceLast ?? -1) - (a.daysSinceLast ?? -1));
    return { ok: true, today, intervalDays: 30, totalActiveFridges: allItems.length, dueCount: dueItems.length, notDueCount: notDueItems.length, dueItems, notDueItems, allItems };
  }

  async function submitAlarmTest(params) {
    const sb = getClient();
    const testDate = params.get('testDate') || '';
    const testTime = normalizeTime(params.get('testTime') || '');
    const fridgeId = params.get('fridgeId') || '';
    const actor = await getActorContext(params);
    const tester = actor.fullName || await getStaffFullName(params.get('tester') || '');
    if (!testDate || !testTime || !fridgeId) return { ok: false, message: 'ข้อมูลไม่ครบ กรุณาระบุวันที่ เวลา และรหัสตู้' };

    const { data: fridge, error: fErr } = await sb.from('temp_fridges').select('*').eq('fridge_id', fridgeId).single();
    if (fErr || !fridge) return { ok: false, message: 'ไม่พบรหัสตู้นี้ใน Master' };

    const failValues = ['batteryStatus','signalStatus','datalogStatus','highAlertResult','lowAlertResult','wirelessAlertResult','sensorAlertResult','frontHighAlarmStatus','frontLowAlarmStatus','frontDisplayStatus','frontOverallStatus'].map(k => params.get(k) || '');
    const hasFail = failValues.some(v => ['ผิดปกติ', 'ไม่ผ่าน', 'ไม่พร้อมใช้งาน'].includes(v));
    const overallResult = hasFail ? 'ไม่ผ่าน' : 'ผ่าน';
    const actionWhenAbnormal = params.get('actionWhenAbnormal') || '';
    if (overallResult === 'ไม่ผ่าน' && !actionWhenAbnormal) return { ok: false, message: 'พบผลทดสอบไม่ผ่าน กรุณาระบุการดำเนินการเมื่อพบความผิดปกติ' };

    const row = {
      test_date: testDate,
      test_time: testTime,
      fridge_id: fridgeId,
      fridge_name: fridge.fridge_name,
      room: fridge.storage_location,
      probe_id: params.get('probeId') || '',
      tester,
      overall_result: overallResult,
      battery_percent: toNumOrNull(params.get('batteryPercent')),
      battery_status: params.get('batteryStatus') || '',
      signal_percent: toNumOrNull(params.get('signalPercent')),
      signal_status: params.get('signalStatus') || '',
      datalog_interval: toNumOrNull(params.get('datalogInterval')),
      datalog_status: params.get('datalogStatus') || '',
      high_remote_time: toNumOrNull(params.get('highRemoteTime')),
      high_local_alert: params.get('highLocalAlert') || '',
      high_alert_result: params.get('highAlertResult') || '',
      low_remote_time: toNumOrNull(params.get('lowRemoteTime')),
      low_local_alert: params.get('lowLocalAlert') || '',
      low_alert_result: params.get('lowAlertResult') || '',
      wireless_remote_time: toNumOrNull(params.get('wirelessRemoteTime')),
      wireless_local_alert: params.get('wirelessLocalAlert') || '',
      wireless_alert_result: params.get('wirelessAlertResult') || '',
      sensor_remote_time: toNumOrNull(params.get('sensorRemoteTime')),
      sensor_local_alert: params.get('sensorLocalAlert') || '',
      sensor_alert_result: params.get('sensorAlertResult') || '',
      front_high_alarm_temp: toNumOrNull(params.get('frontHighAlarmTemp')),
      front_high_alarm_sound: params.get('frontHighAlarmSound') || '',
      front_high_alarm_status: params.get('frontHighAlarmStatus') || '',
      front_low_alarm_temp: toNumOrNull(params.get('frontLowAlarmTemp')),
      front_low_alarm_sound: params.get('frontLowAlarmSound') || '',
      front_low_alarm_status: params.get('frontLowAlarmStatus') || '',
      front_display_status: params.get('frontDisplayStatus') || '',
      front_overall_status: params.get('frontOverallStatus') || '',
      action_when_abnormal: actionWhenAbnormal,
      note: params.get('note') || '',
      saved_by: tester,
      bem_checker: await getStaffFullName(params.get('bemChecker') || ''),
      ...actorColumns(actor)
    };
    const { error } = await sb.from('temp_alarm_test_logs').insert(row);
    if (error) throw error;
    return { ok: true, message: 'บันทึก Alarm Test สำเร็จ', fridgeId, fridgeName: fridge.fridge_name, overallResult, tester };
  }

  async function alarmHistory(params) {
    const sb = getClient();
    const fridgeId = params.get('fridgeId') || '';
    const resultFilter = params.get('result') || 'all';
    const startDate = params.get('startDate') || '';
    const endDate = params.get('endDate') || '';
    let q = sb.from('temp_alarm_test_logs').select('*').order('test_date', { ascending: false }).order('test_time', { ascending: false });
    if (fridgeId) q = q.eq('fridge_id', fridgeId);
    if (startDate) q = q.gte('test_date', startDate);
    if (endDate) q = q.lte('test_date', endDate);
    if (resultFilter !== 'all') q = q.eq('overall_result', resultFilter);
    const data = await selectAll(q, 1000, 5000);
    return { ok: true, total: data.length, records: data.map(fromAlarm) };
  }


  function mapProfile(row) {
    const rawName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.username || '';
    const displayName = resolveStaffFullNameCached(rawName);
    return {
      id: row.id,
      email: row.email || '',
      username: row.username || '',
      firstName: displayName || rawName || '',
      lastName: '',
      department: row.department || '',
      employeeId: row.employee_id || '',
      role: row.role || 'staff',
      isActive: row.is_active !== false,
      createdAt: row.created_at || ''
    };
  }

  async function getCurrentUserEmail() {
    try {
      const { data } = await getClient().auth.getUser();
      return (data?.user?.email || '').toLowerCase();
    } catch (e) {
      return '';
    }
  }

  async function requireAdmin() {
    const email = await getCurrentUserEmail();
    if (email !== 'parichat.ink@mahidol.ac.th') throw new Error('อนุญาตเฉพาะ Admin เท่านั้น');
    return email;
  }

  async function addAudit(action, detail) {
    try {
      const sb = getClient();
      const actor = await getActorContext(new URLSearchParams());
      const email = actor.email || await getCurrentUserEmail();
      await sb.from('temp_user_action_logs').insert({ email, action, detail: typeof detail === 'string' ? detail : JSON.stringify(detail || {}), ...actorColumns(actor) });
    } catch (e) {
      console.warn('audit skipped', e);
    }
  }

  async function userList() {
    await requireAdmin();
    const sb = getClient();
    const { data, error } = await sb.from('user_profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapProfile);
  }

  async function userUpdate(params) {
    await requireAdmin();
    const sb = getClient();
    const id = params.get('id') || '';
    let role = params.get('role') || 'staff';
    const isActive = params.get('isActive') !== 'false';
    if (!['staff', 'bem', 'admin'].includes(role)) role = 'staff';
    if (!id) return { ok: false, message: 'ไม่พบ user id' };
    const { data: current, error: readErr } = await sb.from('user_profiles').select('email').eq('id', id).maybeSingle();
    if (readErr) throw readErr;
    const email = (current?.email || '').toLowerCase();
    if (email === 'parichat.ink@mahidol.ac.th') role = 'admin';
    const { error } = await sb.from('user_profiles').update({ role, is_active: email === 'parichat.ink@mahidol.ac.th' ? true : isActive, updated_at: nowTimestamp() }).eq('id', id);
    if (error) throw error;
    await addAudit('user_update', { id, email, role, isActive });
    return { ok: true, message: 'อัปเดตสิทธิ์ผู้ใช้สำเร็จ' };
  }

  async function menuSettings() {
    const sb = getClient();
    const { data, error } = await sb.from('temp_menu_settings').select('*').order('menu_key', { ascending: true });
    if (error) throw error;
    return (data || []).map(row => ({ menuKey: row.menu_key, label: row.label || '', isEnabled: row.is_enabled !== false }));
  }

  async function saveMenuSettings(params) {
    await requireAdmin();
    const itemsText = params.get('items') || '[]';
    let items = [];
    try { items = JSON.parse(itemsText); } catch (e) { return { ok: false, message: 'รูปแบบข้อมูลเมนูไม่ถูกต้อง' }; }
    const sb = getClient();
    const rows = (items || []).map(x => ({ menu_key: x.menuKey, label: x.menuKey, is_enabled: x.isEnabled !== false, updated_at: nowTimestamp() })).filter(x => x.menu_key);
    if (rows.length) {
      const { error } = await sb.from('temp_menu_settings').upsert(rows, { onConflict: 'menu_key' });
      if (error) throw error;
    }
    await addAudit('menu_settings_save', { count: rows.length });
    return { ok: true, message: 'บันทึกการตั้งค่าเมนูสำเร็จ' };
  }

  async function auditLogs() {
    await requireAdmin();
    const sb = getClient();
    const { data, error } = await sb.from('temp_user_action_logs').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    return (data || []).map(row => ({ createdAt: row.created_at ? displayDateTime(row.created_at) : '', email: row.email || '', action: row.action || '', detail: row.detail || '' }));
  }

  async function dashboardCheckUpdate() {
    return { ok: true, message: 'Supabase mode: dashboard status updates from live logs automatically' };
  }

  async function handleUrl(urlText) {
    try {
      const url = new URL(urlText, window.location.origin);
      const params = url.searchParams;
      const action = params.get('action') || '';

      // V1.8.32: KPI/ภาพรวมไม่ต้องใช้รายชื่อบุคลากร จึงไม่ควรให้การอ่าน temp_staff
      // ทำให้การโหลดข้อมูลหลักล้มตามไปด้วย
      if (!['kpi_monthly', 'dashboard_summary'].includes(action)) {
        await loadStaffDirectory(false);
      }

      let payload;
      if (action === 'list') payload = await getFridgeList(true);
      else if (action === 'all_fridge_list') payload = await getFridgeList(false);
      else if (action === 'qr_lookup') payload = await getFridgeByQrCode(params);
      else if (action === 'incident_list') payload = await getIncidentList(params, false);
      else if (action === 'incident_open_list') payload = (await getIncidentList(params, false)).filter(x => x.caseStatus !== 'ปิดเคส');
      else if (action === 'incident_all_list') payload = await getIncidentList(params, true);
      else if (action === 'incident_history') payload = await getIncidentHistory(params);
      else if (action === 'incident_update') payload = await updateIncident(params);
      else if (action === 'incident_resend_alert') payload = await resendIncidentAlert(params);
      else if (action === 'user_list') payload = await userList(params);
      else if (action === 'user_update') payload = await userUpdate(params);
      else if (action === 'menu_settings') payload = await menuSettings(params);
      else if (action === 'menu_settings_save') payload = await saveMenuSettings(params);
      else if (action === 'audit_logs') payload = await auditLogs(params);
      else if (action === 'dashboard_summary') payload = await dashboardSummary(params);
      else if (action === 'kpi_monthly') payload = await monthlyKpi(params);
      else if (action === 'dashboard_check_update') payload = await dashboardCheckUpdate(params);
      else if (action === 'check_duplicate') payload = await checkDuplicate(params);
      else if (action === 'today_log_status') payload = await todayLogStatus(params);
      else if (action === 'history') payload = await getHistory(params);
      else if (action === 'update_fridge_status') payload = await updateFridgeStatus(params);
      else if (action === 'alarm_due_list') payload = await alarmDueList(params);
      else if (action === 'submit_alarm_test') payload = await submitAlarmTest(params);
      else if (action === 'alarm_test_history') payload = await alarmHistory(params);
      else payload = await submitTemperature(params);

      return jsonResponse(payload);
    } catch (error) {
      console.error('[Supabase backend error]', error);
      return jsonResponse({ ok: false, message: error.message || String(error) }, 200);
    }
  }

  window.fetch = async function patchedFetch(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (String(url).startsWith('SUPABASE_LOCAL')) {
      return handleUrl(url);
    }
    return originalFetch(input, init);
  };

  window.CNMI_SUPABASE_BACKEND = {
    getClient,
    handleUrl,
    loadStaffDirectory,
    resolveStaffFullNameCached,
    getStaffFullName,
    // legacy names for older UI code
    resolveStaffAliasCached,
    getStaffAlias
  };
})();
