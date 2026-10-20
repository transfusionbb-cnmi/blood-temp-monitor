/* CNMI Staff Planner v650 — versioned monthly plans confirmed by Admin publication.
 * Requires roster_plan_snapshots SQL migration; never stores authoritative baselines
 * in localStorage. Existing published months without snapshots remain LEGACY estimates.
 * Trades/OT continue to use live roster_assignments; only fairness baselines use snapshots.
 */
(function () {
  'use strict';
  const API = window.cnmiV336ContinuousBalance;
  const mod = API && API._test;
  if (!mod || typeof mod.reconstructBaseline !== 'function' || window.__CNMI_V648_PUBLISHED_PLANS__) return;
  window.__CNMI_V648_PUBLISHED_PLANS__ = true;
  const previousReconstruct = mod.reconstructBaseline;
  const published = new Map();
  let loaded = false, loading = null, lastError = '';
  const norm = v => String(v == null ? '' : v);
  const month = v => norm(v).slice(0, 7);
  const S = () => { try { return state || window.state || {}; } catch (_) { return window.state || {}; } };
  const DB = () => { try { return sb || window.sb || null; } catch (_) { return window.sb || null; } };
  const isAdmin = () => norm(S()?.profile?.role).toLowerCase() === 'admin';
  function invalidate() {
    try { window.cnmiV644Balance?.clear?.(); } catch (_) {}
    try { API.invalidate?.(); } catch (_) {}
  }
  function alertUser(message) {
    try { (window.showToast || showToast)(message); }
    catch (_) { console.warn('[v648]', message); }
  }
  async function load(force = false) {
    if (loading) {
      if (!force) return loading;
      // A forced read after saving must never reuse an in-flight *older*
      // read; otherwise successful re-publication displays the old snapshot.
      await loading;
    }
    if (loaded && !force) return published;
    const db = DB();
    if (!db || !S()?.profile) return published;
    loading = (async () => {
      try {
        const found = new Map();
        // A month is a single row. Paging protects installations with >1000 months.
        for (let offset = 0; offset < 3000; offset += 500) {
          const res = await db.from('roster_plan_snapshots')
            .select('month_key,assignments,published_at').order('month_key').range(offset, offset + 499);
          if (res.error) throw res.error;
          const list = Array.isArray(res.data) ? res.data : [];
          list.forEach(row => {
            if (/^\d{4}-\d{2}$/.test(norm(row.month_key)) && Array.isArray(row.assignments)) {
              found.set(row.month_key, row);
            }
          });
          if (list.length < 500) break;
        }
        published.clear();
        for (const [k,v] of found) published.set(k,v);
        loaded = true;
        lastError = '';
        window.cnmiV644Balance?.clear?.();
        try { window.renderPage?.(); } catch (_) {}
      } catch (error) {
        lastError = norm(error?.message || error);
        console.warn('[v648] Published-plan snapshot load failed:', error);
        // No write, and no fabricated snapshot, when the SQL migration is missing.
      } finally { loading = null; }
      return published;
    })();
    return loading;
  }
  function planRows(row) {
    return (row?.assignments || []).filter(a => a && /^\d{4}-\d{2}-\d{2}$/.test(norm(a.duty_date)))
      .map(a => ({ id:a.id || null, duty_date:a.duty_date, duty_code:a.duty_code, staff_id:a.staff_id || null }));
  }
  // v652: Keep the holiday-calendar used for the published plan in the same
  // JSONB snapshot. Metadata rows intentionally have no duty_date: the
  // assignment ledger ignores them, so no SQL migration is required.
  const CALENDAR_KIND = 'cnmi_published_holiday_calendar_v652';
  function calendarFor(row) {
    const meta = (row?.assignments || []).find(x => x && x._cnmi_meta === CALENDAR_KIND);
    return Array.isArray(meta?.dates) ? new Set(meta.dates.filter(x => /^\d{4}-\d{2}-\d{2}$/.test(norm(x)))) : null;
  }
  function isWeekendLocal(day) {
    const parts = norm(day).split('-').map(Number);
    if (parts.length !== 3 || !parts.every(Number.isFinite)) return false;
    const dayOfWeek = new Date(parts[0],parts[1]-1,parts[2],12).getDay();
    return dayOfWeek === 0 || dayOfWeek === 6;
  }
  function countDaysOff(staffId,key,rows,calendar) {
    const [y,m] = key.split('-').map(Number);
    const last = new Date(y,m,0).getDate();
    const hasShift = new Set((rows||[]).filter(a => norm(a?.staff_id) === norm(staffId)).map(a => norm(a?.duty_date).slice(0,10)));
    let days=0;
    for (let d=1; d<=last;d++) {
      const date=`${key}-${String(d).padStart(2,'0')}`;
      if ((isWeekendLocal(date)||calendar.has(date))&&!hasShift.has(date)) days++;
    }
    return days;
  }
  // Null for old snapshots: their holiday calendar was not preserved.
  function publishedDaysOff(staffId,key,rows) {
    const row=published.get(key), calendar=calendarFor(row);
    return !calendar ? null : countDaysOff(staffId,key,rows,calendar);
  }
  let lastPublication = null;
  function summarizeDaysOff(key,former,current) {
    const oldCal=calendarFor(former),newCal=calendarFor(current);
    if (!newCal) return null;
    const people=(S()?.staff||[]).filter(p => p && norm(p.staff_type).trim() !== 'แพทย์' && p.is_active !== false);
    let changed=0;
    for (const p of people) {
      const prev=oldCal ? countDaysOff(p.id,key,planRows(former),oldCal) : null;
      const next=countDaysOff(p.id,key,planRows(current),newCal);
      if (prev!==null && prev!==next) changed++;
    }
    return {month:key, holidayChangedCount:oldCal?changed:null, publishedAt:current?.published_at||null};
  }
  function isFairnessMonth(key) {
    if (published.has(key)) return true;
    const [y,m] = key.split('-').map(Number);
    const record = (S()?.rosterMonths || []).find(r => Number(r.year) === y && Number(r.month) === m);
    return !record || ['published','locked'].includes(norm(record.status)); // Legacy records remain estimates.
  }
  function baseline(assignments, trades) {
    const old = previousReconstruct.apply(this, arguments);
    if (!published.size) return old;
    const status = new Map((S()?.rosterMonths || []).map(r => [`${r.year}-${String(r.month).padStart(2,'0')}`, norm(r.status)]));
    const legacy = old.filter(a => !published.has(month(a.duty_date)) && !['draft','unpublished'].includes(status.get(month(a.duty_date))));
    for (const row of published.values()) legacy.push(...planRows(row));
    return legacy;
  }
  mod.reconstructBaseline = baseline;
  // V644 reads mod.reconstructBaseline at runtime, and V340 accesses this same function.
  // The original reconstructed plans serve as estimates only for pre-v648 months.
  async function takeSnapshot(key, options = {}) {
    const replace = options?.replace === true;
    const db = DB();
    if (!db || !isAdmin() || !/^\d{4}-\d{2}$/.test(key)) return false;
    await load();
    if (lastError) throw new Error('ยังไม่ได้ติดตั้ง SQL_v650_PUBLISHED_PLAN_SNAPSHOTS.sql ใน Supabase');
    if (published.has(key) && !replace) return true; // Do not overwrite by accident / trades.
    const y = Number(key.slice(0,4)), m = Number(key.slice(5,7));
    const last=`${key}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
    const [monthRes, assignedRes, holidayRes] = await Promise.all([
      db.from('roster_months').select('id,status').eq('year',y).eq('month',m).maybeSingle(),
      db.from('roster_assignments').select('id,duty_date,duty_code,staff_id')
        .gte('duty_date',`${key}-01`).lte('duty_date',last).order('duty_date'),
      db.from('public_holidays').select('holiday_date')
        .gte('holiday_date',`${key}-01`).lte('holiday_date',last)
    ]);
    if (monthRes.error) throw monthRes.error;
    if (assignedRes.error) throw assignedRes.error;
    if (holidayRes.error) throw new Error('อ่านวันหยุดราชการที่ใช้ประกาศไม่สำเร็จ: '+norm(holidayRes.error.message||holidayRes.error));
    if (!['published','locked'].includes(norm(monthRes.data?.status))) throw new Error('ตารางเดือนนี้ยังไม่ประกาศ');
    const rows = (assignedRes.data || []).filter(r => r.duty_date && r.duty_code).map(r => ({
      id:r.id, duty_date:r.duty_date, duty_code:r.duty_code, staff_id:r.staff_id || null
    }));
    if (!rows.length) throw new Error('ไม่พบข้อมูลตารางเวรหลังประกาศ จึงยังไม่บันทึกฐานของหัวหน้า');
    let planned = rows;
    // When Admin explicitly publishes a revised plan, undo completed whole
    // sales. A staff trade must never become the new planning baseline.
    if (replace || !published.has(key)) {
      const ids = rows.map(r => r.id).filter(Boolean);
      if (ids.length) {
        const tradeRes = await db.from('roster_trade_requests')
          .select('id,status,from_assignment_id,requester_id,receiver_id,note,updated_at,confirmed_at,created_at')
          .eq('status','completed').in('from_assignment_id',ids);
        if (tradeRes.error) throw tradeRes.error;
        // Rewind completed sales only while the current assignee is still
        // their receiver. If a manager manually assigned another person on
        // the same slot, honour that explicit new roster edit at re-publication.
        // Reverse chronological order supports chained completed whole sales.
        planned = rows.map(r => ({...r}));
        const trades = (tradeRes.data || []).slice().sort((a,b) =>
          norm(b.updated_at || b.confirmed_at || b.created_at)
            .localeCompare(norm(a.updated_at || a.confirmed_at || a.created_at)));
        for (const trade of trades) {
          const current = planned.find(r => norm(r.id) === norm(trade.from_assignment_id));
          if (!current || !trade.requester_id || !trade.receiver_id ||
              norm(current.staff_id) !== norm(trade.receiver_id)) continue;
          // v336 reconstructBaseline retains its existing whole-vs-partial
          // trade rules. Never rewind a sold partial shift into the plan.
          planned = previousReconstruct(planned, [trade]);
        }
      }
    }
    const oldSnapshot=published.get(key);
    const dates=[...new Set((holidayRes.data||[]).map(h=>norm(h?.holiday_date).slice(0,10))
      .filter(d=>d.startsWith(key+'-') && /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
    const payload = {month_key:key, assignments:[...planned,{_cnmi_meta:CALENDAR_KIND,dates}]};
    if (replace) payload.published_at = new Date().toISOString();
    const {error} = await db.from('roster_plan_snapshots').upsert(payload,
      {onConflict:'month_key', ignoreDuplicates:!replace});
    if (error) throw error;
    await load(true);
    if (lastError) throw new Error('บันทึกฐานประกาศแล้ว แต่โหลดฉบับใหม่ไม่สำเร็จ: '+lastError);
    const saved=published.get(key);
    // A successful HTTP upsert alone does not prove that the value shown to
    // users is the published version. Verify the persisted roster and calendar.
    const sig = rows => JSON.stringify(rows.map(a=>[
      norm(a.id),norm(a.duty_date),norm(a.duty_code),norm(a.staff_id)
    ]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
    const actualDates=calendarFor(saved);
    if (!saved || sig(planRows(saved)) !== sig(planned) ||
        !actualDates || JSON.stringify([...actualDates].sort()) !== JSON.stringify(dates) ||
        (replace && new Date(saved.published_at).getTime() !== new Date(payload.published_at).getTime())) {
      throw new Error('ตรวจสอบฐานประกาศล่าสุดไม่ผ่าน: ฐานข้อมูลยังส่งข้อมูลฉบับเดิม กรุณาลองประกาศใหม่');
    }
    lastPublication=summarizeDaysOff(key,oldSnapshot,saved);
    invalidate();
    return true;
  }
  // v651: The UI's successful save-and-publish handler triggers the replacement
  // immediately *after* its own DB writes finish. Avoid a window-level click
  // poller: the status is already 'published' on a revised publication, so a
  // status poll races the roster edits and incorrectly retains the first plan.
  // Display clear provenance labels without changing operational calculations.
  function renameHeaders(root = document) {
    root.querySelectorAll('.v340-baseline-columns thead th').forEach(th => {
      const names = {
        'เวรตั้งต้น':'เวรตามหัวหน้าประกาศ',
        'วันหยุดตั้งต้น':'วันหยุดตามหัวหน้าประกาศ',
        'ส่วนต่างเวรเดือนนี้':'ส่วนต่างเวรตามแผน',
        'เวรยกมา':'เวรคงค้างยกมา',
        'เวรสะสม':'เวรคงค้างสะสม',
        'วันหยุดยกมา':'วันหยุดคงค้างยกมา',
        'วันหยุดสะสม':'วันหยุดคงค้างสะสม',
        'วันหยุดปัจจุบัน':'วันหยุดตามตารางล่าสุด'
      };
      const old = th.textContent.trim();
      if (names[old]) th.textContent = names[old];
    });
  }
  const priorRender = window.renderBalanceDashboard;
  if (typeof priorRender === 'function') {
    const render = function(...args) {
      if (!loaded && !lastError) {
        load();
        return '<div class="notice soft-notice">กำลังโหลดแผนเวรที่หัวหน้าประกาศ…</div>';
      }
      const html = priorRender.apply(this,args);
      if (lastError && isAdmin()) return '<div class="notice danger-notice">ต้องติดตั้ง SQL ของ v650 เพื่อเก็บยอดตามแผนประกาศอย่างถาวร (ระบบยังแสดงยอดย้อนหลังแบบประมาณอยู่)</div>' + html;
      const key = norm(args[2] || S()?.monthKey).slice(0,7);
      if (!isFairnessMonth(key)) return '<div class="notice soft-notice">เดือนนี้ยังไม่กดบันทึกและประกาศ จึงยังไม่เพิ่มยอดสะสมตามแผนของหัวหน้า</div>' + html;
      if (isAdmin() && !published.has(key)) return '<div class="notice soft-notice">ยอดตามหัวหน้าจัดของเดือนนี้เป็นการประมาณย้อนหลัง เพราะยังไม่มีภาพบันทึก ณ วันที่ประกาศจริง</div>' + html;
      return html;
    };
    window.renderBalanceDashboard = render;
    try { renderBalanceDashboard = render; } catch (_) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      new MutationObserver(() => renameHeaders()).observe(document.getElementById('pageContent') || document.body, {childList:true,subtree:true});
      load();
    }, {once:true});
  } else {
    new MutationObserver(() => renameHeaders()).observe(document.getElementById('pageContent') || document.body, {childList:true,subtree:true});
    load();
  }
  window.cnmiV648PublishedPlan = {
    load,takeSnapshot,baseline,isFairnessMonth,published,publishedDaysOff,
    get lastPublication() { return lastPublication; },
    _test:{planRows,baseline,calendarFor,countDaysOff}
  };
  console.info('[v648] Published plan snapshot ledger enabled');
})();
