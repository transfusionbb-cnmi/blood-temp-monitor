/* CNMI Staff Planner v650: operational totals are separate from the published
 * planning ledger. Includes an explicit, administrator-confirmed plan revision.
 * No OT claim, staff pay, or shift-trade record is edited by this patch.
 */
(function () {
  'use strict';
  if (window.__CNMI_V650_PUBLISHED_MEDIAN_TRADE_LEDGER__) return;
  const partial = window.cnmiV338PartialTradeBalance?._test;
  const api = window.cnmiV648PublishedPlan;
  if (!partial || typeof partial.correctedData !== 'function' || !api) return;
  window.__CNMI_V650_PUBLISHED_MEDIAN_TRADE_LEDGER__ = true;
  const original = partial.correctedData;
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const norm = v => String(v == null ? '' : v);
  const S = () => { try { return state || window.state || {}; } catch (_) { return window.state || {}; } };
  const month = value => norm(value).slice(0,7);
  const isAdmin = () => norm(S()?.profile?.role).toLowerCase() === 'admin';
  function changeCurrentOnly(staffList,assignments,key) {
    const data = original.apply(this,arguments);
    for (const group of data?.groups || []) for (const row of group.rows || []) {
      const current = row.current || {};
      // These four operational columns are based on the *effective* roster
      // after whole and partial sales (calculated by v338), never on a snapshot.
      const rate = norm(row.person?.staff_type).trim() === 'เคิก' ? 90 : 130;
      current.hours = Math.round(number(current.units) * 8 * 100) / 100;
      current.pay = Math.round(current.hours * rate * 100) / 100;
    }
    return data;
  }
  partial.correctedData = changeCurrentOnly;
  const previousRender = window.renderBalanceDashboard;
  if (typeof previousRender === 'function') {
    const render = function (...args) {
      const html = previousRender.apply(this,args);
      if (!isAdmin() || S()?.page !== 'scheduler') return html;
      const key = month(args[2] || S()?.monthKey);
      const [year, mon] = key.split('-').map(Number);
      const entry = (S()?.rosterMonths || []).find(r => Number(r.year) === year && Number(r.month) === mon);
      if (!['published','locked'].includes(norm(entry?.status).toLowerCase())) return html;
      const hasPlan = api.published?.has(key);
      const message = hasPlan
        ? 'ยอดตามหัวหน้าอ้างอิงประกาศล่าสุด • กด “บันทึกและประกาศ” เพื่อแทนประกาศเดิม • การซื้อขายเวรไม่เปลี่ยนยอดตามแผน'
        : 'เดือนนี้ยังไม่มีภาพแผนที่ยืนยันในฐานข้อมูล • หากเป็นประกาศเดิมให้ตรวจตารางก่อนยืนยันย้อนหลัง';
      return `<div class="notice soft-notice v650-published-plan-actions"><span>${message}</span>${hasPlan?'':` <button type="button" class="tiny-btn soft" data-v650-republish="${key}">ยืนยันตารางประกาศย้อนหลัง</button>`}</div>` + html;
    };
    window.renderBalanceDashboard = render;
    try { renderBalanceDashboard = render; } catch (_) {}
  }
  document.addEventListener('click', async event => {
    const button = event.target?.closest?.('[data-v650-republish]');
    if (!button || !isAdmin() || button.disabled) return;
    const key = norm(button.getAttribute('data-v650-republish'));
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(key)) return;
    const sameMonth = (S()?.rosterMonths || []).some(r =>
      `${r.year}-${String(r.month).padStart(2,'0')}` === key &&
      ['published','locked'].includes(norm(r.status).toLowerCase()));
    if (!sameMonth) return;
    const confirmMessage = api.published?.has(key)
      ? `ยืนยันว่าหัวหน้าได้แก้และประกาศตารางเดือน ${key} ฉบับใหม่จริงหรือไม่?\n\nระบบจะใช้แผนใหม่นี้แทนฉบับเดิมสำหรับส่วนต่างและยอดสะสมตั้งแต่เดือนนี้ไป (การขายเวรยังไม่เปลี่ยนแผน)`
      : `ต้องตรวจเทียบตารางเดือน ${key} กับฉบับที่หัวหน้าประกาศจริงแล้วเท่านั้น\n\nยืนยันบันทึกภาพแผนที่กำลังแสดงอยู่ใช่หรือไม่?`;
    if (!window.confirm(confirmMessage)) return;
    button.disabled = true;
    try {
      if (!await api.takeSnapshot(key,{replace:true})) throw new Error('ไม่พบภาพแผนที่บันทึกแล้ว');
      try { window.showToast?.(`บันทึกแผนประกาศเดือน ${key} แล้ว ยอดสะสมใช้แผนล่าสุด`); } catch (_) {}
      try { window.renderPage?.(); } catch (_) {}
    } catch (error) {
      const msg = norm(error?.message || error);
      window.alert(`บันทึกแผนประกาศไม่สำเร็จ: ${msg}\nตรวจว่าติดตั้ง SQL v650 และเข้าสู่ระบบสิทธิ์ Admin แล้ว`);
    } finally { button.disabled = false; }
  },true);
  const style = document.createElement('style');
  style.textContent = '.v650-published-plan-actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px}.v650-published-plan-actions .tiny-btn{white-space:normal}';
  document.head.appendChild(style);
  window.cnmiV650PublishedMedianLedger = {_test:{changeCurrentOnly}, version:'v650'};
  console.info('[v650] Published median ledger / operational hours and pay / manual plan revision');
})();
