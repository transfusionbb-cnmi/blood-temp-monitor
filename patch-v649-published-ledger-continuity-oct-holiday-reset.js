/* CNMI Staff Planner v649 — published-plan ledger: month N ending = month N+1 opening.
 * No mutation of rosters, trades, payroll or staff records.
 * Management decision: 2026-10-01 starts a NEW HOLIDAY ledger for ALL staff;
 * DUTY ledger is unchanged. Historical published months without an immutable
 * snapshot remain estimates and must never silently become certified records.
 */
(function () {
  'use strict';
  const api = window.cnmiV336ContinuousBalance;
  const mod = api?._test;
  if (!mod || typeof mod.buildBalanceData !== 'function' || window.__CNMI_V649_PUBLISHED_LEDGER__) return;
  window.__CNMI_V649_PUBLISHED_LEDGER__ = true;
  const previous = mod.buildBalanceData;
  const HOLIDAY_START = '2026-10';
  const LEGACY_THROUGH = '2026-10';
  const norm = v => String(v == null ? '' : v);
  const month = v => norm(v).slice(0, 7);
  const numeric = v => Number.isFinite(+v) ? +v : 0;
  const whole = n => { const v = numeric(n); return Math.sign(v) * Math.floor(Math.abs(v) + 0.500000001) || 0; };
  // Median of the published-plan figures, not an arithmetic mean of the group.
  const median = values => {
    const sorted = values.map(numeric).sort((a,b) => a-b);
    const mid = Math.floor(sorted.length/2);
    return !sorted.length ? 0 : sorted.length % 2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
  };
  const groupOf = p => norm(p?.staff_type).trim() === 'เคิก' ? 'เคิก' : 'MT';
  const validMonth = key => /^\d{4}-(0[1-9]|1[0-2])$/.test(key);
  const stateOf = () => { try { return state || window.state || {}; } catch (_) { return window.state || {}; } };
  const publishedApi = () => window.cnmiV648PublishedPlan;
  const monthEnd = key => `${key}-${String(new Date(+key.slice(0,4), +key.slice(5,7), 0).getDate()).padStart(2,'0')}`;
  const nextMonth = key => { const d = new Date(+key.slice(0,4), +key.slice(5,7), 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
  const firstDate = (p, field) => month(p?.[field]);
  function isExcluded(person) {
    try { return !!isLongTermLeaveStaff(person); }
    catch (_) { return person?.is_long_term_leave === true || person?.maternity_status === true; }
  }
  function statusOf(key) {
    const rosterMonths = stateOf()?.rosterMonths || [];
    const [year, mon] = key.split('-').map(Number);
    const record = rosterMonths.find(r => +r.year === year && +r.month === mon);
    return record ? norm(record.status).toLowerCase() : '';
  }
  function isCreditedMonth(key) {
    const pub = publishedApi();
    if (pub?.published?.has(key)) return true;
    const status = statusOf(key);
    if (status && !['published','locked'].includes(status)) return false;
    // v648+ months without an immutable snapshot cannot be certified. Never
    // accrue from an unpublished month, even if its roster has assignments.
    return key <= LEGACY_THROUGH && (!status || status === 'published' || status === 'locked');
  }
  function completedBaseline(assignments, trades) {
    const pub = publishedApi();
    if (typeof pub?.baseline === 'function') return pub.baseline(assignments, trades);
    return mod.reconstructBaseline(assignments, trades);
  }
  function rosterHistoryFor(key, selected) {
    const h = mod.history || {};
    const saved = (h.assignments || []).filter(r => month(r?.duty_date) <= key);
    // Preserve DB rows if the visible month has not finished lazy loading.
    const hasSelected = (selected || []).some(r => month(r?.duty_date) === key);
    if (!hasSelected) return saved;
    const ids = new Map(saved.filter(r => month(r?.duty_date) !== key)
      .map(r => [norm(r?.id) || `${r?.duty_date}|${r?.duty_code}|${r?.staff_id}`,r]));
    (selected || []).filter(r => month(r?.duty_date) === key).forEach(r =>
      ids.set(norm(r?.id) || `${r?.duty_date}|${r?.duty_code}|${r?.staff_id}`,r));
    return [...ids.values()];
  }
  function getStats(rows) {
    try { return calcFairness((rows || []).filter(r => r?.staff_id)) || {}; }
    catch (_) { return {}; }
  }
  function offDays(id, key, rows) {
    try {
      const stored=publishedApi()?.publishedDaysOff?.(id,key,rows);
      return stored == null ? numeric(calculateDaysOff(id,key,rows)) : numeric(stored);
    } catch (_) { return 0; }
  }
  // Pure ledger builder: every month is computed from that month's published
  // baseline. Unpublished months contribute zero, while carrying forward
  // balances unchanged. Each MONTHLY delta is quantised once to whole units,
  // so displayed ending and next opening are literally identical integers.
  function ledger(people, assignments, trades, key, opts = {}) {
    const eligibleRows = completedBaseline(assignments, trades).filter(r =>
      r?.staff_id && validMonth(month(r.duty_date)) && month(r.duty_date) <= key);
    const grouped = new Map();
    const first = new Map();
    eligibleRows.forEach(r => {
      const k = month(r.duty_date), id = norm(r.staff_id);
      if (!grouped.has(k)) grouped.set(k, []);
      grouped.get(k).push(r);
      if (!first.has(id) || first.get(id) > k) first.set(id,k);
    });
    const credited = opts.isCreditedMonth || isCreditedMonth;
    const dayFn = opts.offDays || offDays;
    const statFn = opts.getStats || getStats;
    const starts = [...grouped.keys()].filter(k => credited(k)).sort();
    let cursor = starts[0] || key;
    const openings = new Map();
    people.forEach(p => openings.set(norm(p.id), {duty:0,holiday:0}));
    const results = new Map();
    for (let i = 0; i < 240 && cursor <= key; i++,cursor=nextMonth(cursor)) {
      const rows = credited(cursor) ? grouped.get(cursor) || [] : [];
      const active = !!rows.length && credited(cursor);
      const stats = active ? statFn(rows) : {};
      const perGroup = new Map();
      for (const label of ['MT','เคิก']) {
        // Historical membership is anchored to first planned assignment,
        // not to the month currently viewed or who buys/sells a shift.
        const team = active ? people.filter(p => groupOf(p) === label &&
          !isExcluded(p) && first.has(norm(p.id)) && first.get(norm(p.id)) <= cursor) : [];
        const dutyValues = team.map(p => numeric(stats[norm(p.id)]?.units));
        const holidayValues = team.map(p => dayFn(p.id,cursor,rows));
        perGroup.set(label,{units:median(dutyValues),days:median(holidayValues),
          team: new Set(team.map(p => norm(p.id)))});
      }
      const perPerson = new Map();
      for (const p of people) {
        const id = norm(p.id), average = perGroup.get(groupOf(p));
        const resetDuty = firstDate(p,'balance_reset_at');
        const resetHoliday = firstDate(p,'holiday_balance_reset_at');
        const holidayStart = resetHoliday > HOLIDAY_START ? resetHoliday : HOLIDAY_START;
        const starting = openings.get(id) || {duty:0,holiday:0};
        // A reset applies at the beginning of its target month, never after
        // counting that month's published schedule.
        const dutyCarry = resetDuty === cursor ? 0 : starting.duty;
        const holidayCarry = cursor === HOLIDAY_START || resetHoliday === cursor ? 0 : starting.holiday;
        const member = active && average.team.has(id) && !isExcluded(p);
        const dutyDelta = member && (!resetDuty || cursor >= resetDuty)
          ? whole(numeric(stats[id]?.units) - average.units) : 0;
        const holidayDelta = member && cursor >= holidayStart
          ? whole(dayFn(p.id,cursor,rows) - average.days) : 0;
        // Historic initial months before the group member's first roster
        // have no delta; never assign debt merely because a month has holidays.
        const duty = dutyCarry + dutyDelta;
        const holiday = holidayCarry + holidayDelta;
        openings.set(id,{duty,holiday});
        perPerson.set(id,{carry:dutyCarry,gap:dutyDelta,cumulative:duty,
          holidayCarry,holidayGap:holidayDelta,holidayCumulative:holiday});
      }
      results.set(cursor,{people:perPerson, averages:perGroup, active});
    }
    return results;
  }
  function corrected(staffList, assignments, key) {
    const original = previous.apply(this, arguments);
    if (!original?.groups?.length || !validMonth(key)) return original;
    const h = mod.history || {};
    if (!h.ready || h.loadedThrough < monthEnd(key)) return original;
    const people = original.groups.flatMap(g => g.rows.map(r => r.person)).filter(Boolean);
    if (!people.length) return original;
    const all = rosterHistoryFor(key,assignments);
    // Legacy trades are only used to reconstruct pre-v648 estimates; immutable
    // snapshots, when present, always replace those estimates.
    const result = ledger(people,all,h.trades || [],key).get(key);
    if (!result) return original;
    return {...original, groups:original.groups.map(group => ({
      ...group, average:result.averages.get(group.label)?.units ?? group.average,
      rows:group.rows.map(row => {
        const values = result.people.get(norm(row.person?.id));
        if (!values) return row;
        const resetDuty = firstDate(row.person,'balance_reset_at');
        const status = isExcluded(row.person) ? 'ลาระยะยาว / ไม่คิดหนี้เวร'
          : resetDuty === key && values.cumulative === 0 ? 'เริ่มนับเวรใหม่เดือนนี้'
          : values.cumulative > 0 ? 'เวรสะสมมากกว่าค่ากลาง'
          : values.cumulative < 0 ? 'เวรสะสมน้อยกว่าค่ากลาง' : 'สมดุลสะสม';
        const tone = isExcluded(row.person) ? 'black' : values.cumulative > 0 ? 'orange'
          : values.cumulative < 0 ? 'blue' : 'green';
        return {...row, fixed:{...row.fixed,...values,status,tone}};
      })
    }))};
  }
  mod.buildBalanceData = corrected;
  window.cnmiV649PublishedLedger = {
    version:'v649', HOLIDAY_START, isCreditedMonth, ledger,
    _test:{whole,median,ledger,rosterHistoryFor,isCreditedMonth}
  };
  // Explain the reset and legacy provenance without ever writing or re-publishing
  // a historical roster. In contrast with the per-person DB resets, this is
  // an explicit global fairness-ledger policy applied to everyone at once.
  const priorRender = window.renderBalanceDashboard;
  if (typeof priorRender === 'function') {
    const shown = function(...args) {
      let html = priorRender.apply(this,args);
      const key = month(args[2] || stateOf()?.monthKey);
      if (!validMonth(key)) return html;
      const note = [];
      if (key === HOLIDAY_START) note.push(
        'เริ่มนับยอดวันหยุดยกมาใหม่สำหรับทุกคนตั้งแต่ 1 ต.ค. 2569 = 0 วัน (ไม่กระทบยอดเวร)');
      if (key === nextMonth(HOLIDAY_START)) note.push(
        'ยอดยกมา พ.ย. ต้องเท่ากับยอดสะสม ต.ค. ของแต่ละคน (แยกเวร/วันหยุด และไม่รวมซื้อขาย)');
      if (!isCreditedMonth(key) && key > LEGACY_THROUGH) {
        // A draft (or a post-v648 published month missing its snapshot)
        // cannot truthfully claim an Admin-confirmed baseline. Do not turn
        // zeros/live assignments into a misleading "confirmed" duty plan.
        html = html.replace(/<td class="v340-baseline-cell"><b>[^<]*<\/b><\/td>/g,
          '<td class="v340-baseline-cell" title="ยังไม่มีข้อมูลแผน ณ วันประกาศ"><b>—</b></td>');
        const status = statusOf(key);
        note.push(['published','locked'].includes(status)
          ? 'ตารางนี้ประกาศแล้วแต่ไม่พบภาพแผน ณ วันที่ประกาศในฐานข้อมูล จึงยังไม่นำยอดเดือนนี้ไปคิดสะสม (ตรวจ SQL และสิทธิ์บันทึกก่อน)'
          : 'เดือนนี้ยังไม่กดบันทึกและประกาศ: ยอดยกมาแสดงตามเดือนก่อน แต่ยังไม่เพิ่มผลต่างของเดือนนี้');
      }
      return (note.length ? `<div class="notice soft-notice v649-ledger-note">${note.join(' • ')}</div>` : '') + html;
    };
    window.renderBalanceDashboard = shown;
    try { renderBalanceDashboard = shown; } catch (_) {}
  }
  console.info('[v649] Published monthly whole-number ledger with October holiday restart');
})();
