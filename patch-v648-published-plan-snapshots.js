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
    if (loaded && !force) return published;
    if (loading) return loading;
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
    const [monthRes, assignedRes] = await Promise.all([
      db.from('roster_months').select('id,status').eq('year',y).eq('month',m).maybeSingle(),
      db.from('roster_assignments').select('id,duty_date,duty_code,staff_id')
        .gte('duty_date',`${key}-01`).lte('duty_date',`${key}-${new Date(y,m,0).getDate()}`)
        .order('duty_date')
    ]);
    if (monthRes.error) throw monthRes.error;
    if (assignedRes.error) throw assignedRes.error;
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
        planned = previousReconstruct(rows, tradeRes.data || []);
      }
    }
    const payload = {month_key:key, assignments:planned};
    if (replace) payload.published_at = new Date().toISOString();
    const {error} = await db.from('roster_plan_snapshots').upsert(payload,
      {onConflict:'month_key', ignoreDuplicates:!replace});
    if (error) throw error;
    await load(true);
    invalidate();
    return published.has(key);
  }
  // First publication from a draft is the ONLY automatic snapshot transition.
  // Months published before v648 cannot be retroactively assumed to be original plans.
  // Window capture runs before older document-capture handlers that stopImmediatePropagation.
  (window.addEventListener ? window : document).addEventListener('click', e => {
    const button = e.target?.closest?.('[data-publish-roster],[data-v273-publish-roster],[data-v274-publish-roster],[data-v275-publish-roster]');
    if (!button || !isAdmin()) return;
    const key = month(S()?.monthKey);
    const [y,m] = key.split('-').map(Number);
    const record = (S()?.rosterMonths || []).find(r => +r.year === y && +r.month === m);
    const before = norm(record?.status || 'draft');
    if (published.has(key) || ['published','locked'].includes(before)) return;
    // Follow the existing page-specific save/publish event. We only snapshot
    // after the DB has recorded publication and its assignments have settled.
    (async () => {
      for (let attempt = 0; attempt < 18; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 650));
        try {
          const db = DB();
          if (!db) break;
          const r = await db.from('roster_months').select('status').eq('year',y).eq('month',m).maybeSingle();
          if (r.error || !['published','locked'].includes(norm(r.data?.status))) continue;
          await new Promise(resolve => setTimeout(resolve, 1200));
          if (await takeSnapshot(key)) {
            alertUser('บันทึกยอดตามที่หัวหน้าประกาศแล้ว • การซื้อขายเวรไม่เปลี่ยนยอดสะสม');
            return;
          }
        } catch (error) {
          if (attempt < 17 && /ตารางเดือนนี้ยังไม่ประกาศ|ไม่พบข้อมูลตารางเวร/.test(norm(error?.message))) continue;
          alertUser('ประกาศตารางแล้ว แต่ยังเก็บยอดตามแผนไม่ได้: ' + norm(error?.message || error));
          return;
        }
      }
      alertUser('ไม่สามารถยืนยันการเก็บยอดตามแผนได้ โปรดตรวจการประกาศและฐานข้อมูล');
    })();
  }, true);
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
  window.cnmiV648PublishedPlan = {load,takeSnapshot,baseline,isFairnessMonth,published,_test:{planRows,baseline}};
  console.info('[v648] Published plan snapshot ledger enabled');
})();
