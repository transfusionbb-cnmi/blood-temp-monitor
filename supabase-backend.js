/*
  CNMI Temperature Monitor - Supabase compatibility layer
  v1.8.18: ซ่อม compatibility ของ public.staff หลังเปลี่ยนเป็น temp_staff + คง RPC/RLS จาก v1.8.17
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
      statusUpdatedBy: resolveStaffAliasCached(row.status_updated_by),
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
      reporter: resolveStaffAliasCached(row.reporter),
      caseStatus: row.case_status || '',
      owner: resolveStaffAliasCached(row.owner),
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
      tester: resolveStaffAliasCached(row.tester),
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
      savedBy: resolveStaffAliasCached(row.saved_by),
      bemChecker: resolveStaffAliasCached(row.bem_checker)
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

  const STAFF_ALIAS_CACHE_KEY = 'cnmi_temp_staff_alias_cache_v1818';
  try { window.localStorage?.removeItem('cnmi_temp_staff_alias_cache_v1816'); } catch (e) {}
  try { window.localStorage?.removeItem('cnmi_temp_staff_alias_cache_v1817'); } catch (e) {}
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

  function resolveStaffAliasCached(input) {
    const name = String(input || '').trim().replace(/\s+/g, ' ');
    if (!name) return '';
    const key = normalizeStaffKey(name);
    const found = getStaffDirectorySync().find(row =>
      normalizeStaffKey(row.alias) === key ||
      normalizeStaffKey(row.full_name) === key
    );
    return found?.alias || name;
  }

  async function getStaffAlias(input) {
    const name = String(input || '').trim().replace(/\s+/g, ' ');
    if (!name) return '';
    await loadStaffDirectory(false);
    return resolveStaffAliasCached(name);
  }

  // เก็บชื่อเดิมไว้เพื่อ compatibility กับโค้ดเก่า แต่ V1.8.16 คืนค่าเป็นชื่อย่อ
  async function getStaffFullName(input) {
    return getStaffAlias(input);
  }

  async function getActorContext(params) {
    const fallback = {
      userId: params?.get('actorUserId') || '',
      email: String(params?.get('actorEmail') || '').toLowerCase(),
      fullName: params?.get('actorFullName') || params?.get('recorderName') || params?.get('tester') || params?.get('owner') || '',
      role: params?.get('actorRole') || ''
    };

    try {
      fallback.fullName = await getStaffAlias(fallback.fullName);
      if (!fallback.userId && !fallback.email) return fallback;
      const sb = getClient();
      const { data: authData } = await sb.auth.getUser();
      const user = authData?.user;
      if (!user) return fallback;

      const { data: profile } = await sb.from('user_profiles').select('*').eq('id', user.id).maybeSingle();
      const profileFullName = `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim();
      const profileNameCandidate = profileFullName || profile?.username || fallback.fullName || user.email || '';
      const resolvedFullName = await getStaffAlias(profileNameCandidate);
      return {
        userId: user.id || fallback.userId,
        email: String(user.email || profile?.email || fallback.email || '').toLowerCase(),
        fullName: resolvedFullName || profileNameCandidate || '',
        role: profile?.role || fallback.role || 'staff'
      };
    } catch (e) {
      if (fallback.fullName) {
        try { fallback.fullName = await getStaffAlias(fallback.fullName); } catch (_) {}
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
      owner: resolveStaffAliasCached(row.owner),
      actionText: row.action_text || '',
      fixResult: row.fix_result || '',
      updatedBy: resolveStaffAliasCached(row.updated_by)
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
      latestTemp: log.temp_display ?? log.temp,
      latestStatus: log.status,
      latestAction: log.action_text || '',
      recorderName: resolveStaffAliasCached(log.recorder_name),
      dashboardStatus: 'recorded'
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
      .select('*')
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

    const { data: incRows, error: iErr } = await sb.from('temp_incidents')
      .select('*')
      .eq('found_date', targetDate);
    if (iErr) throw iErr;
    const incidents = (incRows || []).map(fromIncident);
    const openIncidents = incidents.filter(x => x.caseStatus !== 'ปิดเคส');
    const closedIncidents = incidents.filter(x => x.caseStatus === 'ปิดเคส');
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
      closedToday: closedIncidents.length,
      incidents,
      openIncidents,
      targetRound,
      currentRound: targetRound
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
      data: { round: row.round, time: normalizeTime(row.log_time), temp: row.temp_display ?? row.temp, recorderName: resolveStaffAliasCached(row.recorder_name) }
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

  function buildIncidentUpdateUrl(incidentId) {
    const cfg = getAlertConfig();
    const base = cfg.appBaseUrl || (window.location.origin + window.location.pathname);
    const cleanBase = base.split('?')[0].split('#')[0];
    return `${cleanBase}?page=updateIncident&incidentId=${encodeURIComponent(incidentId)}&v=20260617-v176`;
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

  function shouldOpenIncidentAndAlert({ recordType, isAbnormal, noTempReason, noTempDetail }) {
    if (recordType === 'TEMP') return !!isAbnormal;
    if (recordType === 'NO_TEMP') return isNoTempAlertable(noTempReason, noTempDetail);
    return false;
  }

  function sendIncidentChatAlert(data) {
    try {
      const cfg = getAlertConfig();
      if (!cfg.enabled || !cfg.relayUrl) return;

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
        updateUrl: buildIncidentUpdateUrl(data.incidentId),
        alertChannel: 'BEM'
      };

      // ใช้ no-cors เพื่อไม่ให้ CORS ของ Apps Script มาขวางการบันทึกหน้าเว็บ
      fetch(cfg.relayUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).catch(err => console.warn('Google Chat alert failed:', err));
    } catch (err) {
      console.warn('Google Chat alert error:', err);
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
    const recorderName = actor.fullName || await getStaffAlias(params.get('recorderName') || '');
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
    if (recordType === 'TEMP' && (isAbnormal || round === 'ผิดปกติ') && !note) {
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
      if (/relation [\"']public\.staff[\"'] does not exist/i.test(insertMessage)) {
        return {
          ok: false,
          message: 'ฐานข้อมูลยังขาดตัวเชื่อมชื่อเดิม public.staff กรุณารันไฟล์ 00_RUN_IN_SUPABASE_v1_8_18_RESTORE_PUBLIC_STAFF.sql หนึ่งครั้ง แล้วลองบันทึกใหม่'
        };
      }
      throw insertErr;
    }

    const needIncidentAlert = shouldOpenIncidentAndAlert({
      recordType,
      isAbnormal,
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
        recorderName,
        note: recordType === 'NO_TEMP' ? actionText : note,
        actionText,
        recordType,
        noTempReason,
        noTempDetail,
        alertType: recordType === 'NO_TEMP' ? 'NO_TEMP_ALERT' : 'TEMP_ABNORMAL',
        actor
      });
    }

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
      recorderName
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
    sendIncidentChatAlert({ ...data, incidentId, actionText });

    return incidentId;
  }

  async function updateIncident(params) {
    const sb = getClient();
    const incidentId = params.get('incidentId') || '';
    const caseStatus = params.get('caseStatus') || '';
    const bemJobNo = params.get('bemJobNo') || '';
    const actor = await getActorContext(params);
    const owner = actor.fullName || await getStaffAlias(params.get('owner') || '');
    const actionText = params.get('actionText') || '';
    const fixResult = params.get('fixResult') || '';
    const updatedBy = actor.fullName || await getStaffAlias(params.get('updatedBy') || owner || '');
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
      recorderName: resolveStaffAliasCached(row.recorder_name),
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
      recorderName: resolveStaffAliasCached(row.recorder_name),
      recordType: row.record_type || 'TEMP',
      isValidForGraph: row.is_valid_for_graph !== false && row.record_type !== 'NO_TEMP',
      noTempReason: row.no_temp_reason || '',
      noTempDetail: row.no_temp_detail || ''
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
    const updatedBy = actor.fullName || await getStaffAlias(params.get('updatedBy') || '');
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
        lastTester: l ? resolveStaffAliasCached(l.tester) : '-'
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
    const tester = actor.fullName || await getStaffAlias(params.get('tester') || '');
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
      bem_checker: await getStaffAlias(params.get('bemChecker') || ''),
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
    const displayName = resolveStaffAliasCached(rawName);
    const wasMappedToAlias = !!displayName && normalizeStaffKey(displayName) !== normalizeStaffKey(rawName);
    return {
      id: row.id,
      email: row.email || '',
      username: row.username || '',
      firstName: displayName || row.first_name || '',
      lastName: wasMappedToAlias ? '' : (row.last_name || ''),
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

      // V1.8.17: โหลดรายชื่อย่อผ่าน RPC ครั้งเดียวแล้วใช้ cache ทุกเมนู
      await loadStaffDirectory(false);

      let payload;
      if (action === 'list') payload = await getFridgeList(true);
      else if (action === 'all_fridge_list') payload = await getFridgeList(false);
      else if (action === 'qr_lookup') payload = await getFridgeByQrCode(params);
      else if (action === 'incident_list') payload = await getIncidentList(params, false);
      else if (action === 'incident_open_list') payload = (await getIncidentList(params, false)).filter(x => x.caseStatus !== 'ปิดเคส');
      else if (action === 'incident_all_list') payload = await getIncidentList(params, true);
      else if (action === 'incident_history') payload = await getIncidentHistory(params);
      else if (action === 'incident_update') payload = await updateIncident(params);
      else if (action === 'user_list') payload = await userList(params);
      else if (action === 'user_update') payload = await userUpdate(params);
      else if (action === 'menu_settings') payload = await menuSettings(params);
      else if (action === 'menu_settings_save') payload = await saveMenuSettings(params);
      else if (action === 'audit_logs') payload = await auditLogs(params);
      else if (action === 'dashboard_summary') payload = await dashboardSummary(params);
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
    resolveStaffAliasCached,
    getStaffAlias
  };
})();
