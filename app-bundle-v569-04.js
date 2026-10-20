
/* Original source: patch-v273-manual-management-tool.js */
try {
/* CNMI Staff Planner V273 - Manual Management Tool
   เปลี่ยนหน้าจัดเวรและจัดตำแหน่งกลางวันเป็น Manual Spreadsheet 100%
   ระบบรับค่าจาก Admin โดยตรง บันทึกแบบ autosave และคำนวณสถิติเท่านั้น
*/
(function(){
  'use strict';

/* v651: invoke ONLY after the roster-month publication write succeeded. */
async function v651PublishCurrentPlan(key){
  const api=window.cnmiV648PublishedPlan;
  if(!api?.takeSnapshot)throw new Error('ไม่พบระบบเก็บตารางตามหัวหน้าประกาศ (v651)');
  const ok=await api.takeSnapshot(key,{replace:true});
  if(!ok)throw new Error('ระบบไม่สามารถยืนยันข้อมูลประกาศฉบับล่าสุดได้');
  const diff=api.lastPublication;
  if(diff?.month===key && diff.holidayChangedCount!==null){
    const count=diff.holidayChangedCount;
    const note=count ? `วันหยุดตามหัวหน้าเปลี่ยน ${count} คน` : 'จำนวนวันหยุดตามหัวหน้ายังเท่าเดิม (ตรวจวันเสาร์/อาทิตย์/นักขัตและเวรของแต่ละคน)';
    try{window.showToast?.(note);}catch(_){}
  }
  return true;
}

  const VERSION = 'V273_MANUAL_MANAGEMENT_TOOL';
  if (window.__CNMI_V273_MANUAL_MANAGEMENT_TOOL__) return;
  window.__CNMI_V273_MANUAL_MANAGEMENT_TOOL__ = true;

  const DUTIES = ['ชบด1','ชบด2','ชบด3','ช4A','ช4B','ช3A','ช3B','ช9-เคิก','ช9-MT'];
  const DUTY_TITLES = {
    'ชบด1':'ชบด1','ชบด2':'ชบด2','ชบด3':'ชบด3',
    'ช4A':'ช4 ช่อง 1','ช4B':'ช4 ช่อง 2','ช3A':'ช3A','ช3B':'ช3B',
    'ช9-เคิก':'ช9 เคิก','ช9-MT':'ช9 MT'
  };
  const SLOT_TABLE = 'manual_day_slot_settings';
  const DIRECTORY_TABLE = 'manual_trainee_directory';
  const loadedSlotMonths = new Set();
  const loadingSlotMonths = new Map();
  const fiscalPositionCache = new Map();
  const fiscalPositionLoading = new Map();
  const rosterSaveTimers = new Map();
  const positionSaveTimers = new Map();
  let renderBusy = false;

  function st(){ try { return state || window.state || null; } catch (_) { return window.state || null; } }
  function db(){ try { return sb || window.sb || null; } catch (_) { return window.sb || null; } }
  function esc(value){
    try { return escapeHtml(value == null ? '' : String(value)); }
    catch (_) { return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  }
  function friendly(error){
    try { return friendlyDbError(error); }
    catch (_) { return error?.message || error?.details || error?.hint || String(error || 'บันทึกไม่สำเร็จ'); }
  }
  function toast(message,tone){
    try { showToast(message,tone ? { tone } : undefined); }
    catch (_) { console.info(message); }
  }
  function assignGlobal(name,value){
    try { window[name] = value; } catch (_) {}
    try { (0,eval)(`${name}=window[${JSON.stringify(name)}]`); } catch (_) {}
  }
  function normId(value){ return String(value == null ? '' : value); }
  function normDate(value){
    try { return normalizeDateKey(value); }
    catch (_) { return String(value || '').slice(0,10); }
  }
  function currentStaff(){
    try { return currentStaffId(); }
    catch (_) { return st()?.profile?.id || null; }
  }
  function isAdminSafe(){
    try { return !!isAdmin(); }
    catch (_) { return String(st()?.profile?.role || '').toLowerCase() === 'admin'; }
  }
  function staffName(personOrId){
    const person = typeof personOrId === 'object' ? personOrId : (st()?.staff || []).find(x => normId(x?.id) === normId(personOrId));
    return person ? (person.nickname || person.full_name || person.email || '-') : '-';
  }
  function activeStaff(){
    const rows = (st()?.staff || []).filter(person => person && person.is_active !== false);
    try { return orderedStaff(rows); }
    catch (_) { return rows.slice().sort((a,b) => staffName(a).localeCompare(staffName(b),'th')); }
  }
  function rosterStaff(){
    // Manual mode: ใช้เจ้าหน้าที่ที่ยัง Active ทุกคน ไม่กรองด้วยสิทธิ์เวรเดิม
    return activeStaff();
  }
  function activeTraineeStaffIds(){
    const ids = new Set();
    const key = st()?.positionMonthKey || st()?.positionMonthViewKey || st()?.monthKey || new Date().toISOString().slice(0,7);
    const first = `${key}-01`;
    const last = monthDates(key).slice(-1)[0];
    (st()?.traineeDirectoryV273 || []).filter(row => row && row.active !== false && row.trainee_staff_id).forEach(row => ids.add(normId(row.trainee_staff_id)));
    (st()?.trainingAssignmentsV271 || []).filter(row => row && row.active !== false && row.trainee_staff_id && normDate(row.start_date) <= last && normDate(row.end_date) >= first).forEach(row => ids.add(normId(row.trainee_staff_id)));
    return ids;
  }
  function positionStaff(){
    // Manual mode: ไม่กรองสิทธิ์ตำแหน่งเดิม แต่แยกผู้ฝึกออกจาก Slot หลัก
    const traineeIds = activeTraineeStaffIds();
    return activeStaff().filter(person => !traineeIds.has(normId(person.id)));
  }
  function monthDates(key){
    const safe = /^\d{4}-\d{2}$/.test(String(key || '')) ? String(key) : new Date().toISOString().slice(0,7);
    const y = Number(safe.slice(0,4));
    const m = Number(safe.slice(5,7));
    const last = new Date(y,m,0).getDate();
    return Array.from({length:last},(_,i)=>`${safe}-${String(i+1).padStart(2,'0')}`);
  }
  function thaiDow(date){
    try { return parseDate(date).toLocaleDateString('th-TH',{weekday:'short'}); }
    catch (_) { return ''; }
  }
  function offDay(date){
    try { return isWeekend(date) || isHolidayDate(date); }
    catch (_) { const d = new Date(`${date}T00:00:00`); return d.getDay() === 0 || d.getDay() === 6; }
  }
  function holidayText(date){
    try { return isHolidayDate(date) ? holidayName(date) : ''; }
    catch (_) { return ''; }
  }
  function staffColorSafe(person){
    try { return staffColor(person); }
    catch (_) { return '#e2e8f0'; }
  }
  function textColorSafe(color){
    try { return textColorFor(color); }
    catch (_) { return '#0f172a'; }
  }
  function datalistOptions(rows){
    return (rows || []).map(person => `<option value="${esc(staffName(person))}">${esc(person.full_name || person.email || '')}</option>`).join('');
  }
  function resolveStaff(text,source){
    const q = String(text || '').trim().toLowerCase();
    if (!q) return null;
    const rows = source || activeStaff();
    const exact = rows.find(person => [person.nickname,person.full_name,person.email,person.login_name].filter(Boolean).some(v => String(v).trim().toLowerCase() === q));
    if (exact) return exact;
    const partial = rows.filter(person => [person.nickname,person.full_name,person.email,person.login_name].filter(Boolean).some(v => String(v).trim().toLowerCase().includes(q)));
    return partial.length === 1 ? partial[0] : null;
  }
  function setInlineStatus(element,text,tone='saving'){
    if (!element) return;
    const root = element.closest('[data-v273-cell]') || element.closest('[data-v273-slot-setting]') || element.parentElement;
    const status = root?.querySelector?.('[data-v273-status]');
    if (!status) return;
    status.textContent = text;
    status.dataset.tone = tone;
  }
  function safeRender(snapshot){
    if (renderBusy) return;
    renderBusy = true;
    try { renderPage(); }
    catch (error) { console.warn(`${VERSION}: render failed`,error); }
    finally {
      setTimeout(() => {
        try {
          if (snapshot) {
            window.scrollTo(snapshot.x || 0,snapshot.y || 0);
            const wrap = document.querySelector(snapshot.selector || '');
            if (wrap) { wrap.scrollLeft = snapshot.left || 0; wrap.scrollTop = snapshot.top || 0; }
          }
        } catch (_) {}
        renderBusy = false;
      },30);
    }
  }
  function scrollSnapshot(selector){
    const wrap = document.querySelector(selector);
    return { x:window.scrollX,y:window.scrollY,left:wrap?.scrollLeft || 0,top:wrap?.scrollTop || 0,selector };
  }

  /* ---------------- Navigation ---------------- */
  try {
    const scheduler = NAV_ITEMS.find(item => item.id === 'scheduler');
    if (scheduler) { scheduler.title = 'จัดตารางเวรแบบ Manual'; scheduler.subtitle = 'ลากชื่อหรือพิมพ์ชื่อในช่อง แล้วดูสถิติสมดุลทันที'; }
    const position = NAV_ITEMS.find(item => item.id === 'positionMonth');
    if (position) { position.title = 'จัดตำแหน่งกลางวันแบบ Manual'; position.subtitle = 'กำหนด Slot เอง ลากชื่อ และบันทึกอัตโนมัติ'; }
    const view = NAV_ITEMS.find(item => item.id === 'positionMonthView');
    if (view) { view.title = 'ตารางตำแหน่งกลางวัน รายเดือน'; view.subtitle = 'ดูตำแหน่งและเพื่อนร่วมงาน พร้อมรายละเอียดหน้าที่'; }
    const eligibilityIndex = NAV_ITEMS.findIndex(item => item.id === 'eligibility');
    if (eligibilityIndex >= 0) NAV_ITEMS.splice(eligibilityIndex,1);
    if (!NAV_ITEMS.some(item => item.id === 'internManagement')) {
      const insertAt = Math.max(0,NAV_ITEMS.findIndex(item => item.id === 'profileRequests'));
      NAV_ITEMS.splice(insertAt,0,{ id:'internManagement',icon:'🎓',title:'จัดการน้องใหม่ / Intern',subtitle:'เพิ่มช่วงฝึก พี่เลี้ยง และตรวจประวัติ',group:'admin' });
    }
  } catch (error) { console.warn(`${VERSION}: nav update skipped`,error); }

  /* ---------------- Manual rules: no business-rule block ---------------- */
  assignGlobal('canStaffWorkSlot',function(){ return true; });
  assignGlobal('positionCandidateOk',function(){ return true; });
  assignGlobal('autoAssignRoster',function(){ toast('V273 ปิด Auto Assign แล้ว กรุณาจัดด้วย Manual Spreadsheet'); });
  assignGlobal('allowedDutyCodesForDate',function(){ return DUTIES.slice(); });
  assignGlobal('generateEmptyAssignments',function(key){
    const safe = /^\d{4}-\d{2}$/.test(String(key || '')) ? String(key) : (st()?.monthKey || new Date().toISOString().slice(0,7));
    return monthDates(safe).flatMap(date => DUTIES.map(code => ({_temp_id:`v273|${date}|${code}`,duty_date:date,duty_code:code,required_role:'',staff_id:null,is_locked:false})));
  });
  assignGlobal('getAssignmentsForMonth',function(key){
    const safe = /^\d{4}-\d{2}$/.test(String(key || '')) ? String(key) : (st()?.monthKey || new Date().toISOString().slice(0,7));
    if (st()?.rosterDraft?.monthKey === safe && Array.isArray(st().rosterDraft.assignments)) return st().rosterDraft.assignments;
    return (st()?.rosterAssignments || []).filter(row => normDate(row?.duty_date).startsWith(safe));
  });

  /* ---------------- Roster manual spreadsheet ---------------- */
  function existingRosterRows(key){
    const draft = st()?.rosterDraft;
    const source = draft?.monthKey === key && Array.isArray(draft.assignments)
      ? draft.assignments
      : (st()?.rosterAssignments || []).filter(row => normDate(row?.duty_date).startsWith(key));
    const byKey = new Map();
    source.forEach(row => {
      if (!row?.duty_date || !row?.duty_code) return;
      byKey.set(`${normDate(row.duty_date)}|${row.duty_code}`,{...row,duty_date:normDate(row.duty_date)});
    });
    const rows = [];
    monthDates(key).forEach(date => DUTIES.forEach(code => {
      const found = byKey.get(`${date}|${code}`);
      rows.push(found || { _temp_id:`v273|${date}|${code}`,duty_date:date,duty_code:code,required_role:'',staff_id:null,is_locked:false });
    }));
    if (st()) st().rosterDraft = { monthKey:key,assignments:rows };
    return rows;
  }
  function rosterCell(rows,date,code){ return rows.find(row => normDate(row.duty_date) === date && row.duty_code === code); }
  function rosterStats(rows){
    const people = rosterStaff();
    const assigned = rows.filter(row => row.staff_id);
    const data = people.map(person => {
      const own = assigned.filter(row => normId(row.staff_id) === normId(person.id));
      const count = code => own.filter(row => row.duty_code === code).length;
      const countGroup = prefix => own.filter(row => String(row.duty_code).startsWith(prefix)).length;
      let hours = 0;
      own.forEach(row => { try { hours += Number(dutyMetrics(row,person.id)?.hours || 0); } catch (_) {} });
      return { person,total:own.length,hours,chbd1:count('ชบด1'),chbd2:count('ชบด2'),chbd3:count('ชบด3'),ch3a:count('ช3A'),ch3b:count('ช3B'),ch4:countGroup('ช4'),ch9:countGroup('ช9') };
    });
    const avg = data.length ? data.reduce((sum,row)=>sum+row.total,0)/data.length : 0;
    data.forEach(row => row.balance = row.total > avg + 1 ? 'มากกว่าค่าเฉลี่ย' : row.total < avg - 1 ? 'น้อยกว่าค่าเฉลี่ย' : 'ใกล้ค่าเฉลี่ย');
    return { rows:data,avg };
  }
  function rosterSummaryHtml(rows){
    const stats = rosterStats(rows);
    return `<aside class="v273-summary-panel"><div class="v273-summary-head"><div><h3>สถิติสรุปรายเดือน</h3><small>ข้อมูลเพื่อช่วยตัดสินใจ ไม่ใช้บล็อกการจัด</small></div><span class="badge blue">เฉลี่ย ${stats.avg.toFixed(1)} เวร</span></div><div class="v273-summary-scroll"><table><thead><tr><th>คน</th><th>รวม</th><th>ชม.</th><th>ชบด1</th><th>ชบด2</th><th>ชบด3</th><th>ช3A</th><th>ช3B</th><th>ช4</th><th>ช9</th><th>เทียบเฉลี่ย</th></tr></thead><tbody>${stats.rows.map(row => `<tr><td><b>${esc(staffName(row.person))}</b></td><td>${row.total}</td><td>${row.hours.toFixed(0)}</td><td>${row.chbd1}</td><td>${row.chbd2}</td><td>${row.chbd3}</td><td>${row.ch3a}</td><td>${row.ch3b}</td><td>${row.ch4}</td><td>${row.ch9}</td><td><span class="v273-stat-label ${row.balance === 'มากกว่าค่าเฉลี่ย' ? 'high' : row.balance === 'น้อยกว่าค่าเฉลี่ย' ? 'low' : 'even'}">${esc(row.balance)}</span></td></tr>`).join('')}</tbody></table></div></aside>`;
  }
  function refreshRosterStatistics(){
    if (st()?.page !== 'scheduler') return;
    const key = st()?.monthKey || new Date().toISOString().slice(0,7);
    const panel = document.querySelector('.v273-workspace > .v273-summary-panel');
    if (panel) panel.outerHTML = rosterSummaryHtml(existingRosterRows(key));
  }
  function rosterSpreadsheetHtml(rows,key){
    const dates = monthDates(key);
    const staff = rosterStaff();
    return `<div class="v273-sheet-wrap v273-roster-sheet-wrap"><table class="v273-sheet v273-roster-sheet"><thead><tr><th class="v273-sticky-left">ประเภทเวร</th>${dates.map(date => `<th class="${offDay(date)?'offday':''}"><b>${Number(date.slice(8))}</b><small>${esc(thaiDow(date))}</small>${holidayText(date)?`<em>${esc(holidayText(date))}</em>`:''}</th>`).join('')}</tr></thead><tbody>${DUTIES.map(code => `<tr><th class="v273-sticky-left"><b>${esc(DUTY_TITLES[code] || code)}</b></th>${dates.map(date => {
      const slot = rosterCell(rows,date,code);
      const person = slot?.staff_id ? staff.find(x => normId(x.id) === normId(slot.staff_id)) : null;
      const value = person ? staffName(person) : '';
      return `<td class="${offDay(date)?'offday':''}"><div class="v273-manual-cell" data-v273-cell data-v273-roster-cell data-date="${esc(date)}" data-code="${esc(code)}"><input type="text" list="v273RosterStaffList" value="${esc(value)}" placeholder="ว่าง" data-v273-roster-input autocomplete="off"><button type="button" title="ล้าง" data-v273-clear-roster>×</button><small data-v273-status></small></div></td>`;
    }).join('')}</tr>`).join('')}</tbody></table><datalist id="v273RosterStaffList">${datalistOptions(staff)}</datalist></div>`;
  }
  function renderSchedulerPageV273(){
    if (!isAdminSafe()) { try { return noPermission(); } catch (_) { return '<div class="card">ไม่มีสิทธิ์</div>'; } }
    const key = st()?.monthKey || new Date().toISOString().slice(0,7);
    const rows = existingRosterRows(key);
    return `<div class="v273-manual-page"><div class="card v273-manual-toolbar"><div class="section-title"><div><h2>จัดตารางเวรแบบ Manual</h2><p>ลากชื่อหรือพิมพ์ชื่อในช่องได้ทันที ระบบไม่ตรวจสิทธิ์ ไม่บล็อกเวรติดกัน และไม่ Auto Assign</p></div><span class="badge green">Manual 100%</span></div><div class="toolbar"><label>เดือน <input type="month" id="rosterMonthInput" value="${esc(key)}"></label><button class="primary-btn" type="button" data-save-roster>บันทึกทั้งเดือน</button><button class="soft-btn" type="button" data-publish-roster>บันทึกและประกาศ</button><button class="ghost-btn danger" type="button" data-clear-roster-month>ล้างข้อมูลเดือนนี้</button></div><div class="v273-pool"><b>รายชื่อเจ้าหน้าที่</b>${rosterStaff().map(person => { const color=staffColorSafe(person); return `<span class="v273-drag-chip" draggable="true" data-v273-drag-staff="${esc(person.id)}" style="--chip-bg:${esc(color)};--chip-fg:${esc(textColorSafe(color))}">${esc(staffName(person))}</span>`; }).join('')}</div></div><div class="v273-workspace">${rosterSpreadsheetHtml(rows,key)}${rosterSummaryHtml(rows)}</div></div>`;
  }
  assignGlobal('renderSchedulerPage',renderSchedulerPageV273);

  async function ensureRosterMonth(key){
    const client = db();
    if (!client) throw new Error('ไม่พบ Supabase client');
    const y = Number(key.slice(0,4));
    const m = Number(key.slice(5,7));
    let month = (st()?.rosterMonths || []).find(row => Number(row.year) === y && Number(row.month) === m);
    if (!month) {
      const found = await client.from('roster_months').select('*').eq('year',y).eq('month',m).maybeSingle();
      if (found.error) throw found.error;
      month = found.data;
    }
    if (!month) {
      const inserted = await client.from('roster_months').insert({year:y,month:m,status:'draft',created_by:currentStaff(),updated_by:currentStaff()}).select('*').single();
      if (inserted.error) throw inserted.error;
      month = inserted.data;
      if (st()) st().rosterMonths = [...(st().rosterMonths || []),month];
    }
    return month;
  }
  function patchLocalRoster(date,code,staffId,rowFromServer){
    const key = date.slice(0,7);
    const replace = rows => {
      const copy = (rows || []).filter(row => !(normDate(row.duty_date) === date && row.duty_code === code));
      copy.push(rowFromServer || {duty_date:date,duty_code:code,required_role:'',staff_id:staffId || null,is_locked:false});
      return copy;
    };
    if (st()) {
      st().rosterAssignments = replace(st().rosterAssignments);
      if (st().rosterDraft?.monthKey === key) st().rosterDraft.assignments = replace(st().rosterDraft.assignments);
    }
  }
  async function persistRosterCell(cell,staffId){
    const date = normDate(cell?.dataset?.date);
    const code = String(cell?.dataset?.code || '');
    if (!date || !code) return;
    const input = cell.querySelector('[data-v273-roster-input]');
    setInlineStatus(input,'กำลังบันทึก…','saving');
    try {
      const month = await ensureRosterMonth(date.slice(0,7));
      const payload = {roster_month_id:month.id,duty_date:date,duty_code:code,required_role:'',staff_id:staffId || null,is_locked:false,updated_by:currentStaff()};
      const result = await db().from('roster_assignments').upsert(payload,{onConflict:'roster_month_id,duty_date,duty_code'}).select('*').single();
      if (result.error) throw result.error;
      patchLocalRoster(date,code,staffId,result.data);
      setInlineStatus(input,'บันทึกแล้ว','saved');
      refreshRosterStatistics();
    } catch (error) {
      setInlineStatus(input,`บันทึกไม่สำเร็จ: ${friendly(error)}`,'error');
    }
  }
  function queueRosterCell(cell,staffId){
    const key = `${cell.dataset.date}|${cell.dataset.code}`;
    clearTimeout(rosterSaveTimers.get(key));
    rosterSaveTimers.set(key,setTimeout(() => persistRosterCell(cell,staffId),250));
  }

  async function saveAllRosterFromGrid(status='draft'){
    const key = st()?.monthKey || new Date().toISOString().slice(0,7);
    const rows = existingRosterRows(key);
    const byKey = new Map(rows.map(row => [`${normDate(row.duty_date)}|${row.duty_code}`,row]));
    let unresolved = 0;
    document.querySelectorAll('[data-v273-roster-cell]').forEach(cell => {
      const input = cell.querySelector('[data-v273-roster-input]');
      const person = resolveStaff(input?.value || '',rosterStaff());
      if ((input?.value || '').trim() && !person) { unresolved++; setInlineStatus(input,'ไม่พบชื่อที่ตรงกัน','error'); return; }
      const row = byKey.get(`${cell.dataset.date}|${cell.dataset.code}`);
      if (row) row.staff_id = person?.id || null;
    });
    if (unresolved) return toast(`ยังมี ${unresolved} ช่องที่ชื่อไม่ตรงกับรายชื่อเจ้าหน้าที่`,'error');
    try {
      const month = await ensureRosterMonth(key);
      const payload = rows.map(row => ({
        roster_month_id:month.id,
        duty_date:normDate(row.duty_date),
        duty_code:row.duty_code,
        required_role:'',
        staff_id:row.staff_id || null,
        is_locked:false,
        updated_by:currentStaff()
      }));
      const up = await db().from('roster_assignments').upsert(payload,{onConflict:'roster_month_id,duty_date,duty_code'}).select('*');
      if (up.error) throw up.error;
      const monthUpdate = await db().from('roster_months').update({status,updated_by:currentStaff()}).eq('id',month.id).select('*').single();
      if (monthUpdate.error) throw monthUpdate.error;
      if (st()) {
        st().rosterAssignments = (st().rosterAssignments || []).filter(row => !normDate(row.duty_date).startsWith(key)).concat(up.data || []);
        st().rosterDraft = {monthKey:key,assignments:up.data || rows};
        st().rosterMonths = (st().rosterMonths || []).filter(row => row.id !== month.id).concat(monthUpdate.data || month);
      }
      if(status==='published') {
        try { await v651PublishCurrentPlan(key); }
        catch(error) { toast('ตารางประกาศแล้ว แต่ฐานยอดตามแผนยังไม่อัปเดต: '+friendly(error),'error'); return; }
      }
      toast(status === 'published' ? 'บันทึกและประกาศฉบับล่าสุดแล้ว • ยอดสะสมอัปเดตแล้ว' : 'บันทึกตารางทั้งเดือนแล้ว • ไม่เปลี่ยนยอดตามประกาศ');
      safeRender(scrollSnapshot('.v273-roster-sheet-wrap'));
    } catch (error) { toast(`บันทึกไม่สำเร็จ: ${friendly(error)}`,'error'); }
  }

  /* ---------------- Position manual spreadsheet ---------------- */
  function positionMasters(){
    let rows = Array.isArray(st()?.positionMasters) ? st().positionMasters.filter(row => row && row.is_active !== false && !row.deleted_at) : [];
    if (!rows.length) {
      const sample = (() => { try { return positionTemplateForDate(`${st()?.positionMonthKey || st()?.monthKey || new Date().toISOString().slice(0,7)}-01`) || []; } catch (_) { return []; } })();
      rows = sample;
    }
    const seen = new Set();
    return rows.filter(row => {
      const code = String(row.code || row.position_code || '').trim();
      if (!code || seen.has(code)) return false;
      seen.add(code); return true;
    }).sort((a,b) => Number(a.sort_order || 999)-Number(b.sort_order || 999) || String(a.zone || '').localeCompare(String(b.zone || ''),'th') || String(a.code || a.position_code || '').localeCompare(String(b.code || b.position_code || ''),'th'));
  }
  function masterCode(master){ return String(master?.code || master?.position_code || '').trim(); }
  function operationalPositionRows(rows){
    try { return window.cnmiV272?.operationalRows?.(rows) || rows || []; }
    catch (_) { return rows || []; }
  }
  function trainingRows(){ return Array.isArray(st()?.trainingAssignmentsV271) ? st().trainingAssignmentsV271 : []; }
  function directoryRows(){ return Array.isArray(st()?.traineeDirectoryV273) ? st().traineeDirectoryV273 : []; }
  async function loadTraineeDirectory(force=false){
    if (!db()) return [];
    if (st()?.traineeDirectoryLoadedV273 && !force) return directoryRows();
    const result = await db().from(DIRECTORY_TABLE).select('*').order('created_at',{ascending:false});
    if (result.error) {
      if (st()) st().traineeDirectoryErrorV273 = friendly(result.error);
      return [];
    }
    if (st()) {
      st().traineeDirectoryV273 = result.data || [];
      st().traineeDirectoryLoadedV273 = true;
      st().traineeDirectoryErrorV273 = '';
    }
    return result.data || [];
  }
  function scheduleDirectoryLoad(){
    if (st()?.traineeDirectoryLoadedV273 || st()?.traineeDirectoryLoadingV273) return;
    if (st()) st().traineeDirectoryLoadingV273 = true;
    loadTraineeDirectory().finally(() => {
      if (st()) st().traineeDirectoryLoadingV273 = false;
      if (['positionMonth','internManagement'].includes(st()?.page)) safeRender(scrollSnapshot('.v273-position-sheet-wrap'));
    });
  }
  function trainingActive(row,date){
    const d = normDate(date);
    return row && row.active !== false && normDate(row.start_date) <= d && d <= normDate(row.end_date);
  }
  function traineeLabel(row){ return row?.trainee_staff_id ? staffName(row.trainee_staff_id) : (row?.trainee_name || '-'); }
  function traineeType(row){ return row?.trainee_type === 'intern' ? 'Intern' : 'น้องใหม่'; }
  function traineesForMentor(mentorId,date){ return trainingRows().filter(row => normId(row.mentor_staff_id) === normId(mentorId) && trainingActive(row,date)); }
  function trainingIdentitiesForMonth(key){
    const map = new Map();
    directoryRows().filter(row => row.active !== false).forEach(row => {
      const identity = row.trainee_staff_id ? `staff:${row.trainee_staff_id}` : `name:${String(row.trainee_name || '').trim().toLowerCase()}`;
      if (!identity || identity === 'name:') return;
      map.set(identity,{identity,row,label:row.trainee_staff_id ? staffName(row.trainee_staff_id) : (row.trainee_name || '-'),type:row.trainee_type || 'intern'});
    });
    const first = `${key}-01`, last = monthDates(key).slice(-1)[0];
    trainingRows().forEach(row => {
      if (row.active === false || normDate(row.start_date) > last || normDate(row.end_date) < first) return;
      const identity = row.trainee_staff_id ? `staff:${row.trainee_staff_id}` : `name:${String(row.trainee_name || '').trim().toLowerCase()}`;
      if (!identity || identity === 'name:' || map.has(identity)) return;
      map.set(identity,{identity,row,label:traineeLabel(row),type:row.trainee_type || 'intern'});
    });
    return Array.from(map.values());
  }
  function positionRowsForMonth(key){ return operationalPositionRows((st()?.positions || []).filter(row => normDate(row?.work_date).startsWith(key))); }
  function positionRowFor(rows,date,code){ return rows.find(row => normDate(row.work_date) === date && String(row.position_code || row.code || '') === code) || null; }
  function slotSetting(date){ return (st()?.manualDaySlotSettingsV273 || []).find(row => normDate(row.work_date) === normDate(date)) || null; }
  async function loadSlotSettings(key,force=false){
    if (!db()) return [];
    if (loadedSlotMonths.has(key) && !force) return st()?.manualDaySlotSettingsV273 || [];
    if (loadingSlotMonths.has(key)) return loadingSlotMonths.get(key);
    const promise = (async()=>{
      const result = await db().from(SLOT_TABLE).select('*').eq('month_key',key).order('work_date',{ascending:true});
      if (result.error) {
        if (st()) st().manualSlotSettingsErrorV273 = friendly(result.error);
        return [];
      }
      const rest = (st()?.manualDaySlotSettingsV273 || []).filter(row => !normDate(row.work_date).startsWith(key));
      if (st()) { st().manualDaySlotSettingsV273 = rest.concat(result.data || []); st().manualSlotSettingsErrorV273 = ''; }
      loadedSlotMonths.add(key);
      return result.data || [];
    })();
    loadingSlotMonths.set(key,promise);
    try { return await promise; }
    finally { loadingSlotMonths.delete(key); }
  }
  function scheduleSlotLoad(key){
    if (loadedSlotMonths.has(key) || loadingSlotMonths.has(key)) return;
    loadSlotSettings(key).then(() => {
      if (['positionMonth','positionMonthView'].includes(st()?.page)) safeRender(scrollSnapshot('.v273-position-sheet-wrap'));
    });
  }
  async function saveSlotSetting(input){
    const date = normDate(input?.dataset?.date);
    const target = input.value === '' ? null : Number(input.value);
    if (!date) return;
    setInlineStatus(input,'กำลังบันทึก…','saving');
    try {
      const payload = {work_date:date,month_key:date.slice(0,7),target_slots:Number.isFinite(target)?target:null,updated_by:currentStaff(),updated_at:new Date().toISOString()};
      const result = await db().from(SLOT_TABLE).upsert(payload,{onConflict:'work_date'}).select('*').single();
      if (result.error) throw result.error;
      const rest = (st()?.manualDaySlotSettingsV273 || []).filter(row => normDate(row.work_date) !== date);
      if (st()) st().manualDaySlotSettingsV273 = rest.concat(result.data || payload);
      setInlineStatus(input,'บันทึกแล้ว','saved');
      refreshPositionStatistics();
    } catch (error) { setInlineStatus(input,`กรุณารัน SQL V273: ${friendly(error)}`,'error'); }
  }
  function positionCounts(rows,key){
    const monthRows = rows.filter(row => row.staff_id);
    const actualByDate = new Map();
    monthDates(key).forEach(date => actualByDate.set(date,new Set(monthRows.filter(row => normDate(row.work_date) === date).map(row => normId(row.staff_id))).size));
    return actualByDate;
  }
  function fiscalBounds(key){
    const y = Number(key.slice(0,4));
    const m = Number(key.slice(5,7));
    const startYear = m >= 10 ? y : y-1;
    return {cacheKey:String(startYear),start:`${startYear}-10-01`,end:`${startYear+1}-09-30`,label:`ปีงบประมาณ ${startYear+1+543}`};
  }
  async function loadFiscalPositionRows(key,force=false){
    const bounds = fiscalBounds(key);
    if (fiscalPositionCache.has(bounds.cacheKey) && !force) return fiscalPositionCache.get(bounds.cacheKey);
    if (fiscalPositionLoading.has(bounds.cacheKey)) return fiscalPositionLoading.get(bounds.cacheKey);
    const promise = (async()=>{
      if (!db()) return [];
      const result = await db().from('daily_positions').select('*').gte('work_date',bounds.start).lte('work_date',bounds.end).order('work_date');
      if (result.error) {
        if (st()) st().fiscalPositionErrorV273 = friendly(result.error);
        return [];
      }
      const rows = operationalPositionRows(result.data || []);
      fiscalPositionCache.set(bounds.cacheKey,rows);
      if (st()) st().fiscalPositionErrorV273 = '';
      return rows;
    })();
    fiscalPositionLoading.set(bounds.cacheKey,promise);
    try { return await promise; }
    finally { fiscalPositionLoading.delete(bounds.cacheKey); }
  }
  function scheduleFiscalPositionLoad(key){
    const bounds = fiscalBounds(key);
    if (fiscalPositionCache.has(bounds.cacheKey) || fiscalPositionLoading.has(bounds.cacheKey)) return;
    loadFiscalPositionRows(key).then(()=>refreshPositionStatistics());
  }
  function patchFiscalPositionCache(date,code,saved){
    const bounds = fiscalBounds(date.slice(0,7));
    if (!fiscalPositionCache.has(bounds.cacheKey)) return;
    const rows = fiscalPositionCache.get(bounds.cacheKey).filter(row => !(normDate(row.work_date) === date && String(row.position_code || '') === code));
    if (saved) rows.push(saved);
    fiscalPositionCache.set(bounds.cacheKey,rows);
  }
  function zoneBucket(row){
    const zone = String(row?.zone || '').toLowerCase();
    if (zone.includes('ออกหน่วย')) return 'outing';
    if (zone.includes('donor') || zone.includes('บริจาค')) return 'donor';
    return 'bb';
  }
  function positionSummaryHtml(monthRows,key){
    const people = positionStaff();
    const bounds = fiscalBounds(key);
    const fallbackYearRows = operationalPositionRows((st()?.positions || []).filter(row => row.staff_id && normDate(row.work_date) >= bounds.start && normDate(row.work_date) <= bounds.end));
    const yearRows = fiscalPositionCache.get(bounds.cacheKey) || fallbackYearRows;
    const fiscalLoading = !fiscalPositionCache.has(bounds.cacheKey) && fiscalPositionLoading.has(bounds.cacheKey);
    const data = people.map(person => {
      const own = monthRows.filter(row => normId(row.staff_id) === normId(person.id));
      const yearOwn = yearRows.filter(row => normId(row.staff_id) === normId(person.id));
      const counts = {bb:0,donor:0,outing:0};
      own.forEach(row => counts[zoneBucket(row)]++);
      const positions = {};
      own.forEach(row => { const code=String(row.position_code || '-'); positions[code]=(positions[code]||0)+1; });
      const top = Object.entries(positions).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([code,n])=>`${code} ${n}`).join(', ');
      return {person,total:own.length,yearTotal:yearOwn.length,...counts,top};
    });
    const avg = data.length ? data.reduce((sum,row)=>sum+row.total,0)/data.length : 0;
    return `<aside class="v273-summary-panel"><div class="v273-summary-head"><div><h3>สถิติตำแหน่ง</h3><small>${esc(bounds.label)} • ${fiscalLoading?'กำลังโหลดข้อมูลสะสม…':'คำนวณจากข้อมูลที่บันทึกใน Supabase'}</small></div><span class="badge blue">เฉลี่ยเดือนนี้ ${avg.toFixed(1)}</span></div><div class="v273-summary-scroll"><table><thead><tr><th>คน</th><th>เดือนนี้</th><th>BB</th><th>Donor</th><th>ออกหน่วย</th><th>ตำแหน่งที่ทำบ่อย</th><th>สะสมปีงบ</th><th>เทียบเฉลี่ย</th></tr></thead><tbody>${data.map(row => { const label=row.total>avg+1?'มากกว่าค่าเฉลี่ย':row.total<avg-1?'น้อยกว่าค่าเฉลี่ย':'ใกล้ค่าเฉลี่ย'; return `<tr><td><b>${esc(staffName(row.person))}</b></td><td>${row.total}</td><td>${row.bb}</td><td>${row.donor}</td><td>${row.outing}</td><td>${esc(row.top || '-')}</td><td>${row.yearTotal}</td><td><span class="v273-stat-label ${label==='มากกว่าค่าเฉลี่ย'?'high':label==='น้อยกว่าค่าเฉลี่ย'?'low':'even'}">${esc(label)}</span></td></tr>`; }).join('')}</tbody></table></div></aside>`;
  }
  function refreshPositionStatistics(){
    if (st()?.page !== 'positionMonth') return;
    const key = st()?.positionMonthKey || st()?.monthKey || new Date().toISOString().slice(0,7);
    const rows = positionRowsForMonth(key);
    const panel = document.querySelector('.v273-workspace > .v273-summary-panel');
    if (panel) panel.outerHTML = positionSummaryHtml(rows,key);
    const actual = positionCounts(rows,key);
    document.querySelectorAll('[data-v273-slot-input]').forEach(input => {
      const em = input.closest('th')?.querySelector('.v273-slot-target em');
      if (em) em.textContent = `${actual.get(normDate(input.dataset.date)) || 0} คน`;
    });
  }
  function trainingBadges(mentorId,date){
    const trainees = traineesForMentor(mentorId,date);
    return trainees.length ? `<div class="v273-trainee-pairs">${trainees.map(row => `<span>${esc(traineeLabel(row))} · ${esc(traineeType(row))} · ไม่นับ Slot</span>`).join('')}</div>` : '';
  }
  function positionSpreadsheetHtml(rows,key,editable){
    const dates = monthDates(key);
    const masters = positionMasters();
    const staff = positionStaff();
    const actual = positionCounts(rows,key);
    return `<div class="v273-sheet-wrap v273-position-sheet-wrap"><table class="v273-sheet v273-position-sheet"><thead><tr><th class="v273-sticky-left">ตำแหน่ง</th>${dates.map(date => { const setting=slotSetting(date); return `<th class="${offDay(date)?'offday':''}"><b>${Number(date.slice(8))}</b><small>${esc(thaiDow(date))}</small>${editable?`<div class="v273-slot-target" data-v273-slot-setting><label>Slot <input type="number" min="0" max="30" step="1" value="${setting?.target_slots ?? ''}" placeholder="-" data-v273-slot-input data-date="${esc(date)}"></label><em>${actual.get(date) || 0} คน</em><small data-v273-status></small></div>`:`<em>${actual.get(date) || 0} คน</em>`}</th>`; }).join('')}</tr></thead><tbody>${masters.map(master => { const code=masterCode(master); return `<tr><th class="v273-sticky-left"><button type="button" class="v273-position-label" data-v273-job-code="${esc(code)}"><b>${esc(code)}</b><small>${esc(master.zone || '')}</small></button></th>${dates.map(date => {
      const row = positionRowFor(rows,date,code);
      const person = row?.staff_id ? staff.find(x => normId(x.id) === normId(row.staff_id)) : null;
      const value = person ? staffName(person) : '';
      const pair = row?.staff_id ? trainingBadges(row.staff_id,date) : '';
      if (!editable) return `<td class="${offDay(date)?'offday':''}"><div class="v273-readonly-position-cell">${value?`<b>${esc(value)}</b>${pair}`:'<span>-</span>'}</div></td>`;
      return `<td class="${offDay(date)?'offday':''}"><div class="v273-manual-cell v273-position-cell" data-v273-cell data-v273-position-cell data-date="${esc(date)}" data-code="${esc(code)}"><input type="text" list="v273PositionStaffList" value="${esc(value)}" placeholder="ว่าง" data-v273-position-input autocomplete="off"><button type="button" title="ล้าง" data-v273-clear-position>×</button>${pair}<small data-v273-status></small></div></td>`;
    }).join('')}</tr>`; }).join('')}</tbody></table><datalist id="v273PositionStaffList">${datalistOptions(staff)}</datalist></div>`;
  }
  function renderPositionMonthPageV273(){
    if (!isAdminSafe()) { try { return noPermission(); } catch (_) { return '<div class="card">ไม่มีสิทธิ์</div>'; } }
    const key = st()?.positionMonthKey || st()?.monthKey || new Date().toISOString().slice(0,7);
    scheduleSlotLoad(key);
    scheduleFiscalPositionLoad(key);
    scheduleDirectoryLoad();
    const rows = positionRowsForMonth(key);
    const trainees = trainingIdentitiesForMonth(key);
    const schemaNotice = st()?.manualSlotSettingsErrorV273 ? `<div class="notice error-notice"><b>ช่องกำหนด Slot ยังบันทึกไม่ได้</b><br>ให้รันไฟล์ <code>supabase_v273_manual_management.sql</code> ใน Supabase ก่อน</div>` : '';
    return `<div class="v273-manual-page"><div class="card v273-manual-toolbar"><div class="section-title"><div><h2>จัดตำแหน่งกลางวันแบบ Manual</h2><p>Admin กำหนด Slot เอง แล้วลากหรือพิมพ์ชื่อคนลงตำแหน่ง ระบบไม่ตรวจสิทธิ์รายบุคคล</p></div><span class="badge green">Autosave</span></div><div class="toolbar"><label>เดือน <input type="month" id="positionMonthInput" value="${esc(key)}"></label><button type="button" class="ghost-btn" data-v273-refresh-positions>รีเฟรชข้อมูลล่าสุด</button><button type="button" class="ghost-btn danger" data-clear-month-positions>ล้างข้อมูลเดือนนี้</button></div>${schemaNotice}<div class="v273-pool"><b>เจ้าหน้าที่</b>${positionStaff().map(person => { const color=staffColorSafe(person); return `<span class="v273-drag-chip" draggable="true" data-v273-drag-staff="${esc(person.id)}" style="--chip-bg:${esc(color)};--chip-fg:${esc(textColorSafe(color))}">${esc(staffName(person))}</span>`; }).join('')}</div><div class="v273-pool v273-trainee-pool"><b>น้องใหม่ / Intern</b>${trainees.length?trainees.map(item => `<span class="v273-drag-chip trainee" draggable="true" data-v273-drag-trainee="${esc(item.identity)}" data-trainee-type="${esc(item.type)}">${esc(item.label)} · ${esc(item.type==='intern'?'Intern':'น้องใหม่')}</span>`).join(''):'<span class="muted">เพิ่มรายชื่อที่เมนู “จัดการน้องใหม่ / Intern”</span>'}</div></div><div class="v273-workspace">${positionSpreadsheetHtml(rows,key,true)}${positionSummaryHtml(rows,key)}</div></div>`;
  }
  assignGlobal('renderPositionMonthPage',renderPositionMonthPageV273);

  function renderPositionMonthViewPageV273(){
    const key = st()?.positionMonthViewKey || st()?.monthKey || new Date().toISOString().slice(0,7);
    const rows = positionRowsForMonth(key);
    return `<div class="card v273-readonly-page"><div class="section-title"><div><h2>ตารางตำแหน่งกลางวัน รายเดือน</h2><p>แสดงเฉพาะตำแหน่งและชื่อผู้ร่วมงาน คลิกชื่อตำแหน่งเพื่อดูหน้าที่</p></div></div><div class="toolbar"><label>เดือน <input type="month" id="positionMonthViewInput" value="${esc(key)}"></label></div>${positionSpreadsheetHtml(rows,key,false)}</div>`;
  }
  assignGlobal('renderPositionMonthViewPage',renderPositionMonthViewPageV273);

  async function persistPositionCell(cell,staffId){
    const date = normDate(cell?.dataset?.date);
    const code = String(cell?.dataset?.code || '');
    const input = cell.querySelector('[data-v273-position-input]');
    if (!date || !code) return;
    setInlineStatus(input,'กำลังบันทึก…','saving');
    try {
      const master = positionMasters().find(row => masterCode(row) === code) || {};
      const del = await db().from('daily_positions').delete().eq('work_date',date).eq('position_code',code);
      if (del.error) throw del.error;
      let saved = null;
      if (staffId) {
        const payload = {work_date:date,position_code:code,zone:master.zone || '',break_time:master.break_time || '-',main_rule:master.main_rule || '',job_desc:master.job_desc || '',staff_id:staffId,updated_by:currentStaff()};
        const ins = await db().from('daily_positions').insert(payload).select('*').single();
        if (ins.error) throw ins.error;
        saved = ins.data;
      }
      await db().from('daily_position_day_status').upsert({work_date:date,month_key:date.slice(0,7),status:'draft',updated_by:currentStaff()},{onConflict:'work_date'});
      if (st()) {
        st().positions = (st().positions || []).filter(row => !(normDate(row.work_date) === date && String(row.position_code || '') === code));
        if (saved) st().positions.push(saved);
      }
      patchFiscalPositionCache(date,code,saved);
      setInlineStatus(input,'บันทึกแล้ว','saved');
      refreshPositionStatistics();
    } catch (error) { setInlineStatus(input,`บันทึกไม่สำเร็จ: ${friendly(error)}`,'error'); }
  }
  function queuePositionCell(cell,staffId){
    const key = `${cell.dataset.date}|${cell.dataset.code}`;
    clearTimeout(positionSaveTimers.get(key));
    positionSaveTimers.set(key,setTimeout(() => persistPositionCell(cell,staffId),250));
  }
  async function pairTraineeToPosition(cell,identity,type){
    const date = normDate(cell?.dataset?.date);
    const code = String(cell?.dataset?.code || '');
    const row = positionRowFor(positionRowsForMonth(date.slice(0,7)),date,code);
    if (!row?.staff_id) return setInlineStatus(cell.querySelector('input'),'ใส่ชื่อพี่เลี้ยงในช่องนี้ก่อน','error');
    if (!window.cnmiV272?.replaceRange) return setInlineStatus(cell.querySelector('input'),'ไม่พบระบบน้องใหม่/Intern V272','error');
    setInlineStatus(cell.querySelector('input'),'กำลังจับคู่…','saving');
    try {
      const args = {traineeType:type || 'intern',startDate:date,endDate:date,mentorStaffId:row.staff_id,note:`ลากลงตำแหน่ง ${code} ผ่าน V273`};
      if (String(identity).startsWith('staff:')) args.traineeStaffId = String(identity).slice(6);
      else args.traineeName = trainingIdentitiesForMonth(date.slice(0,7)).find(item => item.identity === identity)?.label || String(identity).replace(/^name:/,'');
      await window.cnmiV272.replaceRange(args);
      await window.cnmiV271?.loadTrainingAssignments?.({force:true});
      setInlineStatus(cell.querySelector('input'),'จับคู่แล้ว','saved');
      safeRender(scrollSnapshot('.v273-position-sheet-wrap'));
    } catch (error) { setInlineStatus(cell.querySelector('input'),friendly(error),'error'); }
  }

  /* ---------------- Intern management ---------------- */
  function ensureTrainingLoaded(){
    if (st()?.trainingAssignmentsLoadedAtV271) return;
    if (window.cnmiV271?.loadTrainingAssignments && !st()?.trainingLoadRequestedV273) {
      if (st()) st().trainingLoadRequestedV273 = true;
      window.cnmiV271.loadTrainingAssignments({force:true}).then(() => { if (st()) st().trainingLoadRequestedV273 = false; if (st()?.page === 'internManagement') safeRender(); });
    }
  }
  function renderInternManagementPage(){
    ensureTrainingLoaded();
    scheduleDirectoryLoad();
    const assignments = trainingRows().slice().sort((a,b)=>String(b.start_date || '').localeCompare(String(a.start_date || '')));
    const directory = directoryRows().slice().sort((a,b)=>String(b.created_at || '').localeCompare(String(a.created_at || '')));
    const people = activeStaff();
    const directoryOptions = directory.filter(row => row.active !== false).map(row => {
      const identity = row.trainee_staff_id ? `staff:${row.trainee_staff_id}` : `name:${String(row.trainee_name || '').trim().toLowerCase()}`;
      const label = row.trainee_staff_id ? staffName(row.trainee_staff_id) : row.trainee_name;
      return `<option value="${esc(identity)}">${esc(label)} · ${esc(row.trainee_type === 'intern' ? 'Intern' : 'น้องใหม่')}</option>`;
    }).join('');
    const sqlNotice = st()?.traineeDirectoryErrorV273 ? `<div class="notice error-notice"><b>ยังโหลดทะเบียนผู้ฝึกไม่ได้</b><br>ให้รันไฟล์ <code>supabase_v273_manual_management.sql</code> ใน Supabase ก่อน</div>` : '';
    return `<div class="v273-intern-page">${sqlNotice}<div class="grid grid-2"><div class="card"><div class="section-title"><div><h2>1. เพิ่มรายชื่อผู้ฝึก</h2><p>เพิ่มชื่อไว้ก่อนโดยยังไม่ต้องเลือกพี่เลี้ยง จากนั้นลากชื่อลงตารางตำแหน่งได้</p></div></div><form id="v273TraineeDirectoryForm" class="form-grid"><label>รายชื่อในระบบ<select name="trainee_staff_id"><option value="">ผู้ฝึกภายนอก / พิมพ์ชื่อเอง</option>${people.map(person => `<option value="${esc(person.id)}">${esc(staffName(person))}</option>`).join('')}</select></label><label>ชื่อผู้ฝึกภายนอก<input name="trainee_name" placeholder="เว้นว่างเมื่อเลือกคนในระบบ"></label><label>ประเภท<select name="trainee_type"><option value="new_staff">น้องใหม่</option><option value="intern">Intern (เด็กฝึกงาน)</option></select></label><label class="wide">หมายเหตุ<input name="note" placeholder="เช่น นักศึกษาฝึกงาน รุ่นเดือนกรกฎาคม"></label><button class="primary-btn wide" type="submit">เพิ่มรายชื่อ</button></form></div><div class="card"><div class="section-title"><div><h2>2. กำหนดช่วงพี่เลี้ยง</h2><p>ใช้เมื่อทราบช่วงฝึกแล้ว หรือจะลากชื่อผู้ฝึกลงช่องตำแหน่งเพื่อกำหนดเฉพาะวันก็ได้</p></div></div><form id="v273TrainingRangeForm" class="form-grid"><label class="wide">ผู้ฝึก<select name="trainee_identity" required><option value="">เลือกจากทะเบียนผู้ฝึก</option>${directoryOptions}</select></label><label>พี่เลี้ยง<select name="mentor_staff_id" required><option value="">เลือกพี่เลี้ยง</option>${people.map(person => `<option value="${esc(person.id)}">${esc(staffName(person))}</option>`).join('')}</select></label><label>วันที่เริ่ม<input type="date" name="start_date" required value="${esc((st()?.positionMonthKey || st()?.monthKey || new Date().toISOString().slice(0,7))+'-01')}"></label><label>วันที่สิ้นสุด<input type="date" name="end_date" required value="${esc((st()?.positionMonthKey || st()?.monthKey || new Date().toISOString().slice(0,7))+'-01')}"></label><label class="wide">หมายเหตุ<input name="note" placeholder="เช่น ฝึก Blood Bank สัปดาห์แรก"></label><button class="primary-btn wide" type="submit">บันทึกช่วงพี่เลี้ยง</button></form></div></div><div class="grid grid-2"><div class="card"><div class="section-title"><div><h2>ทะเบียนน้องใหม่ / Intern</h2><p>รายชื่อในส่วนนี้จะปรากฏในแถบลากวางของหน้าจัดตำแหน่ง</p></div><span class="badge blue">${directory.length} รายชื่อ</span></div><div class="table-wrap"><table><thead><tr><th>ผู้ฝึก</th><th>ประเภท</th><th>หมายเหตุ</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${directory.length?directory.map(row => `<tr><td><b>${esc(row.trainee_staff_id ? staffName(row.trainee_staff_id) : row.trainee_name)}</b></td><td>${esc(row.trainee_type === 'intern' ? 'Intern' : 'น้องใหม่')}</td><td>${esc(row.note || '-')}</td><td><span class="badge ${row.active===false?'black':'green'}">${row.active===false?'ปิดใช้งาน':'ใช้งาน'}</span></td><td>${row.active===false?'-':`<button type="button" class="tiny-btn danger" data-v273-deactivate-directory="${esc(row.id)}">ปิดใช้งาน</button>`}</td></tr>`).join(''):'<tr><td colspan="5">ยังไม่มีรายชื่อ</td></tr>'}</tbody></table></div></div><div class="card"><div class="section-title"><div><h2>ประวัติช่วงพี่เลี้ยง</h2><p>ปิดใช้งานได้โดยไม่ลบประวัติเดิม</p></div><span class="badge blue">${assignments.length} รายการ</span></div><div class="table-wrap"><table><thead><tr><th>ผู้ฝึก</th><th>ประเภท</th><th>พี่เลี้ยง</th><th>ช่วงวันที่</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${assignments.length?assignments.map(row => `<tr><td><b>${esc(traineeLabel(row))}</b><br><small>${esc(row.note || '')}</small></td><td>${esc(traineeType(row))}</td><td>${esc(staffName(row.mentor_staff_id))}</td><td>${esc(normDate(row.start_date))}<br>ถึง ${esc(normDate(row.end_date))}</td><td><span class="badge ${row.active===false?'black':'green'}">${row.active===false?'ปิดใช้งาน':'ใช้งาน'}</span></td><td>${row.active===false?'-':`<button type="button" class="tiny-btn danger" data-v273-deactivate-training="${esc(row.id)}">ปิดใช้งาน</button>`}</td></tr>`).join(''):'<tr><td colspan="6">ยังไม่มีข้อมูล</td></tr>'}</tbody></table></div></div></div></div>`;
  }
  async function submitDirectoryForm(form){
    const fd = new FormData(form);
    const traineeStaffId = String(fd.get('trainee_staff_id') || '').trim();
    const traineeName = String(fd.get('trainee_name') || '').trim();
    if (!traineeStaffId && !traineeName) return toast('กรุณาเลือกคนในระบบหรือกรอกชื่อผู้ฝึกภายนอก','error');
    try {
      const payload = {trainee_staff_id:traineeStaffId || null,trainee_name:traineeStaffId ? null : traineeName,trainee_type:String(fd.get('trainee_type') || 'new_staff'),active:true,note:String(fd.get('note') || ''),created_by:currentStaff(),updated_by:currentStaff(),updated_at:new Date().toISOString()};
      const result = await db().from(DIRECTORY_TABLE).insert(payload).select('*').single();
      if (result.error) throw result.error;
      await loadTraineeDirectory(true);
      toast('เพิ่มรายชื่อผู้ฝึกแล้ว'); safeRender();
    } catch (error) { toast(`เพิ่มรายชื่อไม่สำเร็จ: ${friendly(error)}`,'error'); }
  }
  async function submitTrainingRangeForm(form){
    const fd = new FormData(form);
    const identity = String(fd.get('trainee_identity') || '');
    const item = trainingIdentitiesForMonth(st()?.positionMonthKey || st()?.monthKey || new Date().toISOString().slice(0,7)).find(row => row.identity === identity);
    if (!item) return toast('กรุณาเลือกผู้ฝึกจากทะเบียน','error');
    try {
      const args = {traineeType:item.type || 'new_staff',startDate:String(fd.get('start_date') || ''),endDate:String(fd.get('end_date') || ''),mentorStaffId:String(fd.get('mentor_staff_id') || ''),note:String(fd.get('note') || '')};
      if (identity.startsWith('staff:')) args.traineeStaffId = identity.slice(6); else args.traineeName = item.label;
      await window.cnmiV272.replaceRange(args);
      await window.cnmiV271?.loadTrainingAssignments?.({force:true});
      toast('บันทึกช่วงพี่เลี้ยงแล้ว'); safeRender();
    } catch (error) { toast(friendly(error),'error'); }
  }
  async function deactivateDirectory(id){
    try {
      const directoryRow=directoryRows().find(row=>normId(row?.id)===normId(id));
      if(!directoryRow) throw new Error('ไม่พบทะเบียนน้องใหม่ / Intern ที่เลือก');
      const now=new Date().toISOString();
      const result=await db().from(DIRECTORY_TABLE).update({active:false,updated_by:currentStaff(),updated_at:now}).eq('id',id);
      if(result.error) throw result.error;

      let trainingUpdate=db().from('staff_training_assignments').update({active:false,updated_by:currentStaff(),updated_at:now}).eq('active',true);
      if(directoryRow.trainee_staff_id) trainingUpdate=trainingUpdate.eq('trainee_staff_id',directoryRow.trainee_staff_id);
      else trainingUpdate=trainingUpdate.eq('trainee_name',directoryRow.trainee_name||'');
      const trainingResult=await trainingUpdate;
      if(trainingResult.error) throw trainingResult.error;

      if(directoryRow.trainee_staff_id){
        const isIntern=String(directoryRow.trainee_type||'').toLowerCase()==='intern';
        const profilePatch=isIntern
          ? {daily_position_enabled:false,position_training_status:'งดจัดชั่วคราว'}
          : {daily_position_enabled:true,position_training_status:'ใช้งานปกติ'};
        const profileResult=await db().from('staff_profiles').update(profilePatch).eq('id',directoryRow.trainee_staff_id);
        if(profileResult.error) throw profileResult.error;
        const localPerson=(st()?.staff||[]).find(person=>normId(person?.id)===normId(directoryRow.trainee_staff_id));
        if(localPerson) Object.assign(localPerson,profilePatch);
      }

      await Promise.all([
        loadTraineeDirectory(true),
        window.cnmiV271?.loadTrainingAssignments?.({force:true}),
        typeof loadAllData==='function'?loadAllData():Promise.resolve()
      ]);
      const isIntern=String(directoryRow.trainee_type||'').toLowerCase()==='intern';
      toast(isIntern?'ปิดใช้งาน Intern แล้ว รายชื่อถูกนำออกจากตารางทันที':'สิ้นสุดสถานะน้องใหม่แล้ว ระบบนับเป็นเจ้าหน้าที่ปกติ 1 คนทันที');
      safeRender();
    } catch (error) { toast(friendly(error),'error'); }
  }
  async function deactivateTraining(id){
    try {
      const result = await db().from('staff_training_assignments').update({active:false,updated_by:currentStaff(),updated_at:new Date().toISOString()}).eq('id',id);
      if (result.error) throw result.error;
      await window.cnmiV271?.loadTrainingAssignments?.({force:true});
      toast('ปิดใช้งานแล้ว'); safeRender();
    } catch (error) { toast(friendly(error),'error'); }
  }

  /* ---------------- Job description ---------------- */
  function showJob(code){
    const master = positionMasters().find(row => masterCode(row) === code) || {};
    const html = `<div class="v273-job-modal"><h2>${esc(code)}</h2><div class="profile-info-list"><div><span>โซน</span><b>${esc(master.zone || '-')}</b></div><div><span>เวลาพัก</span><b>${esc(master.break_time || '-')}</b></div><div><span>ข้อมูลสื่อสาร/Tag เดิม</span><b>${esc(master.main_rule || '-')}</b></div></div><h3>หน้าที่งาน</h3><p>${esc(master.job_desc || 'ยังไม่ได้ระบุรายละเอียดหน้าที่')}</p></div>`;
    try { showModal(html); } catch (_) {}
  }

  /* ---------------- Render-page extension ---------------- */
  try {
    const previousRender = window.renderPage || (typeof renderPage === 'function' ? renderPage : null);
    const wrapped = function renderPageV273(){
      if (st()?.page === 'internManagement') {
        try {
          document.getElementById('pageTitle').textContent = 'จัดการน้องใหม่ / Intern';
          document.getElementById('pageSubtitle').textContent = 'เพิ่มช่วงฝึก พี่เลี้ยง และตรวจประวัติ';
          renderNav();
          document.getElementById('pageContent').innerHTML = renderInternManagementPage();
          return;
        } catch (error) { console.warn(`${VERSION}: intern page failed`,error); }
      }
      return previousRender ? previousRender.apply(this,arguments) : undefined;
    };
    wrapped.__v273Manual = true;
    assignGlobal('renderPage',wrapped);
  } catch (error) { console.warn(`${VERSION}: render wrapper skipped`,error); }

  /* ---------------- Event interception ---------------- */
  document.addEventListener('dragstart',function(event){
    const trainee = event.target?.closest?.('[data-v273-drag-trainee]');
    if (trainee) {
      event.dataTransfer.setData('v273Trainee',trainee.dataset.v273DragTrainee || '');
      event.dataTransfer.setData('v273TraineeType',trainee.dataset.traineeType || 'intern');
      event.dataTransfer.effectAllowed='copy';
      event.stopImmediatePropagation(); return;
    }
    const chip = event.target?.closest?.('[data-v273-drag-staff]');
    if (chip) {
      event.dataTransfer.setData('v273StaffId',chip.dataset.v273DragStaff || '');
      event.dataTransfer.setData('staffId',chip.dataset.v273DragStaff || '');
      event.dataTransfer.effectAllowed='copy';
      event.stopImmediatePropagation();
    }
  },true);
  document.addEventListener('dragover',function(event){
    const cell = event.target?.closest?.('[data-v273-roster-cell],[data-v273-position-cell]');
    if (!cell) return;
    event.preventDefault(); cell.classList.add('drag-over'); event.stopImmediatePropagation();
  },true);
  document.addEventListener('dragleave',function(event){
    const cell = event.target?.closest?.('[data-v273-roster-cell],[data-v273-position-cell]');
    if (cell) cell.classList.remove('drag-over');
  },true);
  document.addEventListener('drop',function(event){
    const cell = event.target?.closest?.('[data-v273-roster-cell],[data-v273-position-cell]');
    if (!cell) return;
    event.preventDefault(); event.stopImmediatePropagation(); cell.classList.remove('drag-over');
    const trainee = event.dataTransfer?.getData('v273Trainee');
    if (trainee && cell.matches('[data-v273-position-cell]')) { pairTraineeToPosition(cell,trainee,event.dataTransfer?.getData('v273TraineeType') || 'intern'); return; }
    const staffId = event.dataTransfer?.getData('v273StaffId') || event.dataTransfer?.getData('staffId');
    const person = activeStaff().find(x => normId(x.id) === normId(staffId));
    if (!person) return;
    const input = cell.querySelector('input[type="text"]');
    if (input) input.value = staffName(person);
    if (cell.matches('[data-v273-roster-cell]')) queueRosterCell(cell,person.id);
    else queuePositionCell(cell,person.id);
  },true);
  document.addEventListener('change',function(event){
    const rosterInput = event.target?.closest?.('[data-v273-roster-input]');
    if (rosterInput) {
      event.stopImmediatePropagation();
      const person = resolveStaff(rosterInput.value,rosterStaff());
      if (rosterInput.value.trim() && !person) return setInlineStatus(rosterInput,'ไม่พบชื่อที่ตรงกัน กรุณาเลือกจากรายการ','error');
      queueRosterCell(rosterInput.closest('[data-v273-roster-cell]'),person?.id || null); return;
    }
    const positionInput = event.target?.closest?.('[data-v273-position-input]');
    if (positionInput) {
      event.stopImmediatePropagation();
      const person = resolveStaff(positionInput.value,positionStaff());
      if (positionInput.value.trim() && !person) return setInlineStatus(positionInput,'ไม่พบชื่อที่ตรงกัน กรุณาเลือกจากรายการ','error');
      queuePositionCell(positionInput.closest('[data-v273-position-cell]'),person?.id || null); return;
    }
    const slotInput = event.target?.closest?.('[data-v273-slot-input]');
    if (slotInput) { event.stopImmediatePropagation(); saveSlotSetting(slotInput); }
  },true);
  document.addEventListener('click',function(event){
    const saveRoster = event.target?.closest?.('[data-save-roster]');
    if (saveRoster && document.querySelector('.v273-roster-sheet')) { event.preventDefault(); event.stopImmediatePropagation(); saveAllRosterFromGrid('draft'); return; }
    const publishRoster = event.target?.closest?.('[data-publish-roster]');
    if (publishRoster && document.querySelector('.v273-roster-sheet')) { event.preventDefault(); event.stopImmediatePropagation(); saveAllRosterFromGrid('published'); return; }
    const clearRoster = event.target?.closest?.('[data-v273-clear-roster]');
    if (clearRoster) { event.preventDefault(); event.stopImmediatePropagation(); const cell=clearRoster.closest('[data-v273-roster-cell]'); const input=cell.querySelector('input'); input.value=''; queueRosterCell(cell,null); return; }
    const clearPosition = event.target?.closest?.('[data-v273-clear-position]');
    if (clearPosition) { event.preventDefault(); event.stopImmediatePropagation(); const cell=clearPosition.closest('[data-v273-position-cell]'); const input=cell.querySelector('input'); input.value=''; queuePositionCell(cell,null); return; }
    const job = event.target?.closest?.('[data-v273-job-code]');
    if (job) { event.preventDefault(); event.stopImmediatePropagation(); showJob(job.dataset.v273JobCode); return; }
    if (event.target?.closest?.('[data-v273-refresh-positions]')) {
      event.preventDefault(); event.stopImmediatePropagation();
      Promise.all([loadAllData(),loadSlotSettings(st()?.positionMonthKey || st()?.monthKey,true),window.cnmiV271?.loadTrainingAssignments?.({force:true})]).then(()=>safeRender()); return;
    }
    const deactivateDirectoryButton = event.target?.closest?.('[data-v273-deactivate-directory]');
    if (deactivateDirectoryButton) { event.preventDefault(); event.stopImmediatePropagation(); deactivateDirectory(deactivateDirectoryButton.dataset.v273DeactivateDirectory); return; }
    const deactivate = event.target?.closest?.('[data-v273-deactivate-training]');
    if (deactivate) { event.preventDefault(); event.stopImmediatePropagation(); deactivateTraining(deactivate.dataset.v273DeactivateTraining); }
  },true);
  document.addEventListener('submit',function(event){
    if (event.target?.id === 'v273TraineeDirectoryForm') {
      event.preventDefault(); event.stopImmediatePropagation(); submitDirectoryForm(event.target); return;
    }
    if (event.target?.id === 'v273TrainingRangeForm') {
      event.preventDefault(); event.stopImmediatePropagation(); submitTrainingRangeForm(event.target);
    }
  },true);

  /* ---------------- Styles ---------------- */
  const style = document.createElement('style');
  style.id = 'cnmi-v273-manual-style';
  style.textContent = `
    .v273-manual-page{display:grid;gap:12px}.v273-manual-toolbar{position:relative}.v273-manual-toolbar .section-title p{margin:4px 0 0;color:#64748b}.v273-pool{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:9px;padding:8px;border:1px solid #dbeafe;border-radius:12px;background:#f8fbff}.v273-trainee-pool{border-color:#fed7aa;background:#fffaf5}.v273-drag-chip{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;background:var(--chip-bg,#e2e8f0);color:var(--chip-fg,#0f172a);font-size:11px;font-weight:800;cursor:grab;box-shadow:0 1px 2px rgba(15,23,42,.12)}.v273-drag-chip.trainee{background:#fff7ed;color:#9a3412;border:1px solid #fdba74}.v273-workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(330px,390px);gap:12px;align-items:start}.v273-sheet-wrap{overflow:auto;max-height:72vh;border:1px solid #dbe3ef;border-radius:13px;background:white;box-shadow:0 5px 18px rgba(15,23,42,.05)}.v273-sheet{border-collapse:separate;border-spacing:0;min-width:max-content;width:100%;font-size:10px}.v273-sheet th,.v273-sheet td{border-right:1px solid #e5eaf1;border-bottom:1px solid #e5eaf1;padding:4px;min-width:104px;vertical-align:top;background:#fff}.v273-sheet thead th{position:sticky;top:0;z-index:5;background:#f8fafc;text-align:center}.v273-sheet thead th small{display:block;font-size:9px;color:#64748b}.v273-sheet thead th em{display:block;font-style:normal;font-size:9px;color:#2563eb}.v273-sheet .v273-sticky-left{position:sticky;left:0;z-index:6;min-width:130px;max-width:160px;background:#f8fafc}.v273-sheet thead .v273-sticky-left{z-index:8}.v273-sheet .offday{background:#f1f5f9}.v273-sheet thead .offday{background:#e2e8f0}.v273-sheet thead th em{max-width:100px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.v273-manual-cell{position:relative;display:grid;grid-template-columns:minmax(74px,1fr) 20px;gap:2px;align-items:start;min-height:42px;border:1px solid transparent;border-radius:8px;padding:2px}.v273-manual-cell.drag-over{border-color:#2563eb;background:#dbeafe}.v273-manual-cell input[type=text]{width:100%;min-width:72px;border:1px solid #cbd5e1;border-radius:7px;padding:6px 5px;font:inherit;background:#fff}.v273-manual-cell>button{width:20px;height:26px;border:0;background:#f1f5f9;border-radius:6px;cursor:pointer;color:#64748b}.v273-manual-cell>[data-v273-status]{grid-column:1/-1;min-height:10px;font-size:8px;line-height:1.2}.v273-manual-cell>[data-v273-status][data-tone=saving]{color:#2563eb}.v273-manual-cell>[data-v273-status][data-tone=saved]{color:#15803d}.v273-manual-cell>[data-v273-status][data-tone=error]{color:#b91c1c}.v273-summary-panel{position:sticky;top:10px;max-height:78vh;overflow:hidden;border:1px solid #dbe3ef;border-radius:14px;background:#fff;box-shadow:0 6px 20px rgba(15,23,42,.06)}.v273-summary-head{display:flex;justify-content:space-between;gap:8px;align-items:flex-start;padding:11px;border-bottom:1px solid #e5e7eb;background:#f8fafc}.v273-summary-head h3{margin:0}.v273-summary-head small{display:block;margin-top:3px;color:#64748b}.v273-summary-scroll{overflow:auto;max-height:68vh}.v273-summary-panel table{border-collapse:collapse;min-width:740px;width:100%;font-size:10px}.v273-summary-panel th,.v273-summary-panel td{padding:6px;border-bottom:1px solid #edf0f4;text-align:center;white-space:nowrap}.v273-summary-panel th{position:sticky;top:0;background:#fff;z-index:2}.v273-stat-label{display:inline-block;padding:3px 6px;border-radius:999px;font-size:9px;font-weight:800}.v273-stat-label.high{background:#fff7ed;color:#c2410c}.v273-stat-label.low{background:#eff6ff;color:#1d4ed8}.v273-stat-label.even{background:#ecfdf5;color:#15803d}.v273-slot-target{margin-top:3px;padding-top:3px;border-top:1px dashed #cbd5e1}.v273-slot-target label{display:flex;justify-content:center;align-items:center;gap:2px;font-size:8px}.v273-slot-target input{width:40px;height:21px;padding:1px 3px;font-size:9px}.v273-slot-target>[data-v273-status]{display:block;min-height:9px;font-size:7px}.v273-position-label{display:flex;flex-direction:column;align-items:flex-start;width:100%;padding:2px;border:0;background:transparent;text-align:left;cursor:pointer;color:#0f172a}.v273-position-label small{color:#64748b;font-size:9px}.v273-position-label:hover b{text-decoration:underline;color:#2563eb}.v273-trainee-pairs{grid-column:1/-1;display:flex;flex-direction:column;gap:2px;margin-top:2px}.v273-trainee-pairs span{padding:2px 4px;border-radius:5px;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;font-size:8px}.v273-readonly-position-cell{display:flex;flex-direction:column;gap:2px;min-height:34px;align-items:center;justify-content:center}.v273-readonly-page .v273-sheet-wrap{max-height:76vh}.v273-intern-page .table-wrap{max-height:68vh}.v273-job-modal p{white-space:pre-wrap;line-height:1.7}.v273-job-modal{width:min(700px,90vw)}
    @media(max-width:1180px){.v273-workspace{grid-template-columns:1fr}.v273-summary-panel{position:relative;top:auto;max-height:none}.v273-summary-scroll{max-height:440px}}
    @media(max-width:820px){.v273-sheet-wrap{max-height:68vh}.v273-sheet th,.v273-sheet td{min-width:92px}.v273-sheet .v273-sticky-left{min-width:112px}.v273-pool{max-height:130px;overflow:auto}.v273-summary-panel table{min-width:700px}}
  `;
  document.head.appendChild(style);

  window.cnmiV273 = { renderSchedulerPageV273,renderPositionMonthPageV273,renderPositionMonthViewPageV273,loadSlotSettings,persistRosterCell,persistPositionCell,renderInternManagementPage };
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v273-manual-management-tool.js", error); }
;

/* Original source: patch-v274-person-matrix-manual-fix.js */
try {
/* CNMI Staff Planner V274
   - คืนตารางตำแหน่งกลางวันเป็นรายชื่อเจ้าหน้าที่ x วันที่ พร้อมคอลัมน์สรุป
   - ตารางเวร Admin เป็นรายชื่อเจ้าหน้าที่ x วันที่ เหมือนมุมมอง Staff
   - จัดพี่เลี้ยงน้องใหม่/Intern โดยเลือกในช่องวันที่ ไม่สร้างคอลัมน์พี่เลี้ยงซ้ำ
   - เพิ่มการตั้งวันหยุดราชการจากหน้าจัดตารางเวร
*/
(function(){
  'use strict';

/* v651: invoke ONLY after the roster-month publication write succeeded. */
async function v651PublishCurrentPlan(key){
  const api=window.cnmiV648PublishedPlan;
  if(!api?.takeSnapshot)throw new Error('ไม่พบระบบเก็บตารางตามหัวหน้าประกาศ (v651)');
  const ok=await api.takeSnapshot(key,{replace:true});
  if(!ok)throw new Error('ระบบไม่สามารถยืนยันข้อมูลประกาศฉบับล่าสุดได้');
  const diff=api.lastPublication;
  if(diff?.month===key && diff.holidayChangedCount!==null){
    const count=diff.holidayChangedCount;
    const note=count ? `วันหยุดตามหัวหน้าเปลี่ยน ${count} คน` : 'จำนวนวันหยุดตามหัวหน้ายังเท่าเดิม (ตรวจวันเสาร์/อาทิตย์/นักขัตและเวรของแต่ละคน)';
    try{window.showToast?.(note);}catch(_){}
  }
  return true;
}

  const VERSION = 'V274_PERSON_MATRIX_MANUAL_FIX';
  if (window.__CNMI_V274_PERSON_MATRIX_MANUAL_FIX__) return;
  window.__CNMI_V274_PERSON_MATRIX_MANUAL_FIX__ = true;

  const DUTIES = [
    { code:'ชบด1', label:'ชบด1' },
    { code:'ชบด2', label:'ชบด2' },
    { code:'ชบด3', label:'ชบด3' },
    { code:'ช4A', label:'ช4 ช่อง 1' },
    { code:'ช4B', label:'ช4 ช่อง 2' },
    { code:'ช3A', label:'ช3A' },
    { code:'ช3B', label:'ช3B' },
    { code:'ช9-เคิก', label:'ช9 เคิก' },
    { code:'ช9-MT', label:'ช9 MT' }
  ];
  const rosterTimers = new Map();
  let rosterPendingWrites = 0;
  let rosterWriteError = '';
  let rosterPublishing = false;
  async function waitRosterSaved(){
    for(let i=0;i<120&&(rosterTimers.size||rosterPendingWrites);i++)await new Promise(resolve=>setTimeout(resolve,100));
    if(rosterTimers.size||rosterPendingWrites)throw new Error('ยังบันทึกเวรไม่เสร็จ กรุณาประกาศใหม่');
    if(rosterWriteError)throw new Error('มีเวรบันทึกไม่สำเร็จ: '+rosterWriteError);
  }
  const positionTimers = new Map();
  const mentorTimers = new Map();
  const fiscalCache = new Map();
  const fiscalLoading = new Map();
  const slotLoadedMonths = new Set();
  const slotLoadingMonths = new Set();
  let rendering = false;

  function S(){ try { return state || window.state || null; } catch (_) { return window.state || null; } }
  function DB(){ try { return sb || window.sb || null; } catch (_) { return window.sb || null; } }
  function esc(v){
    try { return escapeHtml(v == null ? '' : String(v)); }
    catch (_) { return String(v == null ? '' : v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  }
  function normId(v){ return String(v == null ? '' : v); }
  function normDate(v){
    try { return normalizeDateKey(v); }
    catch (_) { return String(v || '').slice(0,10); }
  }
  function friendly(error){
    try { return friendlyDbError(error); }
    catch (_) { return error?.message || error?.details || String(error || 'เกิดข้อผิดพลาด'); }
  }
  function toast(message,tone){
    try { showToast(message,tone ? { tone } : undefined); }
    catch (_) { console.info(message); }
  }
  function currentStaff(){
    try { return currentStaffId(); }
    catch (_) { return S()?.profile?.id || null; }
  }
  function isAdminSafe(){
    try { return !!isAdmin(); }
    catch (_) { return String(S()?.profile?.role || '').toLowerCase() === 'admin'; }
  }
  function assignGlobal(name,value){
    try { window[name] = value; } catch (_) {}
    try { (0,eval)(`${name}=window[${JSON.stringify(name)}]`); } catch (_) {}
  }
  function monthDates(key){
    const safe = /^\d{4}-\d{2}$/.test(String(key || '')) ? String(key) : new Date().toISOString().slice(0,7);
    const y = Number(safe.slice(0,4)), m = Number(safe.slice(5,7));
    const last = new Date(y,m,0).getDate();
    return Array.from({length:last},(_,i)=>`${safe}-${String(i+1).padStart(2,'0')}`);
  }
  function thaiDow(date){
    try { return parseDate(date).toLocaleDateString('th-TH',{weekday:'short'}); }
    catch (_) { return new Date(`${date}T00:00:00`).toLocaleDateString('th-TH',{weekday:'short'}); }
  }
  function isWeekendSafe(date){
    try { return isWeekend(date); }
    catch (_) { const d=new Date(`${date}T00:00:00`); return d.getDay()===0 || d.getDay()===6; }
  }
  function isHolidaySafe(date){ try { return isHolidayDate(date); } catch (_) { return false; } }
  function holidayTitle(date){
    try { return holidayName(date) || 'วันหยุดราชการ'; }
    catch (_) {
      const row=(S()?.holidays || []).find(x=>normDate(x?.holiday_date)===normDate(date));
      return visibleHolidayTitle(row?.title || row?.name || row?.holiday_name || 'วันหยุดราชการ');
    }
  }
  function visibleHolidayTitle(title){ return String(title || 'วันหยุดราชการ').split(':::')[0].trim(); }
  function holidayRuleSuffix(title){ const raw=String(title || ''); const at=raw.indexOf(':::'); return at>=0 ? raw.slice(at) : ''; }
  function activeStaff(){
    const rows=(S()?.staff || []).filter(x=>x && x.is_active !== false && x.active !== false);
    try { return orderedStaff(rows); }
    catch (_) { return rows.slice().sort((a,b)=>staffName(a).localeCompare(staffName(b),'th')); }
  }
  function staffName(personOrId){
    const p=typeof personOrId==='object' ? personOrId : activeStaff().find(x=>normId(x.id)===normId(personOrId));
    return p ? (p.nickname || p.full_name || p.email || '-') : '-';
  }
  function staffColorSafe(person){ try { return staffColor(person); } catch (_) { return '#e2e8f0'; } }
  function textColorSafe(color){ try { return textColorFor(color); } catch (_) { return '#0f172a'; } }
  function dutyLabel(code){ return DUTIES.find(x=>x.code===code)?.label || String(code || ''); }
  function positionCode(row){ return String(row?.code || row?.position_code || '').trim(); }
  function positionMasters(){
    let rows=Array.isArray(S()?.positionMasters) ? S().positionMasters.filter(x=>x && x.is_active!==false && !x.deleted_at) : [];
    if (!rows.length) {
      try { rows=positionTemplateForDate(`${S()?.positionMonthKey || S()?.monthKey || new Date().toISOString().slice(0,7)}-01`) || []; }
      catch (_) { rows=[]; }
    }
    const seen=new Set();
    return rows.filter(row=>{
      const code=positionCode(row);
      if (!code || seen.has(code)) return false;
      seen.add(code); return true;
    }).sort((a,b)=>Number(a.sort_order||999)-Number(b.sort_order||999) || String(a.zone||'').localeCompare(String(b.zone||''),'th') || positionCode(a).localeCompare(positionCode(b),'th'));
  }
  function positionByCode(code){ return positionMasters().find(x=>positionCode(x)===String(code || '')) || null; }
  function positionRows(key){
    let rows=(S()?.positions || []).filter(row=>normDate(row?.work_date).startsWith(key));
    try { rows=window.cnmiV272?.operationalRows?.(rows) || rows; } catch (_) {}
    return rows;
  }
  function positionRowForStaff(rows,staffId,date){
    return rows.find(row=>normId(row?.staff_id)===normId(staffId) && normDate(row?.work_date)===normDate(date)) || null;
  }
  function leaveEffective(row){
    try { return isLeaveEffective(row); }
    catch (_) { return !/(cancelled|canceled|rejected|deleted|ไม่อนุมัติ|ยกเลิกแล้ว)/i.test(String(row?.status || '')); }
  }
  function leaveText(row){
    try { return leaveDisplayType(row); }
    catch (_) { return String(row?.type || row?.leave_type || 'ลาอื่นๆ').split(':::')[0].trim(); }
  }
  function isNoDuty(row){
    try { return isNoDutyLeaveType(row); }
    catch (_) { return leaveText(row)==='ไม่รับเวร'; }
  }
  function leaveOn(staffId,date,{hideNoDuty=false}={}){
    const row=(S()?.leaves || []).find(item=>normId(item?.staff_id)===normId(staffId) && leaveEffective(item) && normDate(item?.start_date)<=normDate(date) && normDate(item?.end_date || item?.start_date)>=normDate(date));
    if (!row) return null;
    if (hideNoDuty && isNoDuty(row)) return null;
    return row;
  }
  function leaveClass(row){
    try { return leaveCellClass(row); }
    catch (_) {
      const t=leaveText(row);
      if (t==='ลากิจ') return 'leave-personal';
      if (t==='ลาป่วย') return 'leave-sick';
      if (/พัก/.test(t)) return 'leave-vacation';
      if (t==='ลาคลอด') return 'leave-maternity';
      if (t==='ไม่รับเวร') return 'leave-no-duty';
      return 'leave-other';
    }
  }
  function statusText(el,text,tone='saving'){
    const status=el?.closest?.('[data-v274-cell],[data-v274-slot-wrap]')?.querySelector?.('[data-v274-status]');
    if (!status) return;
    status.textContent=text || ''; status.dataset.tone=tone;
  }
  function snapshot(selector){
    const wrap=document.querySelector(selector);
    return {x:window.scrollX,y:window.scrollY,left:wrap?.scrollLeft||0,top:wrap?.scrollTop||0,selector};
  }
  function rerender(snap){
    if (rendering) return;
    rendering=true;
    try { renderPage(); }
    catch (error) { console.warn(`${VERSION}: render failed`,error); }
    setTimeout(()=>{
      try {
        window.scrollTo(snap?.x||0,snap?.y||0);
        const wrap=document.querySelector(snap?.selector || '');
        if (wrap) { wrap.scrollLeft=snap?.left||0; wrap.scrollTop=snap?.top||0; }
      } catch (_) {}
      rendering=false;
    },35);
  }

  /* ---------- Training identities ---------- */
  function trainingRows(){ return Array.isArray(S()?.trainingAssignmentsV271) ? S().trainingAssignmentsV271 : []; }
  function directoryRows(){ return Array.isArray(S()?.traineeDirectoryV273) ? S().traineeDirectoryV273 : []; }
  function identityOf(row){
    return row?.trainee_staff_id ? `staff:${normId(row.trainee_staff_id)}` : `name:${String(row?.trainee_name || '').trim().toLowerCase()}`;
  }
  function traineeLabel(row){ return row?.trainee_staff_id ? staffName(row.trainee_staff_id) : (row?.trainee_name || '-'); }
  function traineeType(row){ return row?.trainee_type==='intern' ? 'Intern' : 'น้องใหม่'; }
  function activeTraining(row,date){ return row && row.active!==false && normDate(row.start_date)<=normDate(date) && normDate(row.end_date)>=normDate(date); }
  function assignmentForIdentity(identity,date){ return trainingRows().find(row=>identityOf(row)===identity && activeTraining(row,date)) || null; }
  function traineeRowsForMonth(key){
    const first=`${key}-01`, last=monthDates(key).slice(-1)[0];
    const map=new Map();
    directoryRows().filter(row=>row.active!==false).forEach(row=>{
      const identity=identityOf(row); if (!identity || identity==='name:') return;
      map.set(identity,{identity,label:traineeLabel(row),type:row.trainee_type || 'intern',staffId:row.trainee_staff_id || null,row});
    });
    trainingRows().filter(row=>row.active!==false && normDate(row.start_date)<=last && normDate(row.end_date)>=first).forEach(row=>{
      const identity=identityOf(row); if (!identity || identity==='name:' || map.has(identity)) return;
      map.set(identity,{identity,label:traineeLabel(row),type:row.trainee_type || 'intern',staffId:row.trainee_staff_id || null,row});
    });
    return Array.from(map.values()).sort((a,b)=>a.label.localeCompare(b.label,'th'));
  }
  function regularPositionStaff(key){
    const traineeIds=new Set(traineeRowsForMonth(key).map(x=>normId(x.staffId)).filter(Boolean));
    return activeStaff().filter(person=>!traineeIds.has(normId(person.id)));
  }
  function mentorPosition(rows,mentorId,date){ return positionRowForStaff(rows,mentorId,date); }

  /* ---------- Position statistics ---------- */
  function zoneBucket(row){
    const zone=String(row?.zone || '').toLowerCase();
    if (zone.includes('ออกหน่วย')) return 'outing';
    if (zone.includes('donor') || zone.includes('บริจาค')) return 'donor';
    return 'bb';
  }
  function fiscalBounds(key){
    const y=Number(key.slice(0,4)), m=Number(key.slice(5,7));
    const startYear=m>=10 ? y : y-1;
    return {cacheKey:String(startYear),start:`${startYear}-10-01`,end:`${startYear+1}-09-30`,label:`ปีงบประมาณ ${startYear+1+543}`};
  }
  async function loadFiscal(key,force=false){
    const bounds=fiscalBounds(key);
    if (fiscalCache.has(bounds.cacheKey) && !force) return fiscalCache.get(bounds.cacheKey);
    if (fiscalLoading.has(bounds.cacheKey)) return fiscalLoading.get(bounds.cacheKey);
    const p=(async()=>{
      if (!DB()) return [];
      const res=await DB().from('daily_positions').select('*').gte('work_date',bounds.start).lte('work_date',bounds.end).order('work_date');
      if (res.error) { console.warn(`${VERSION}: fiscal load`,res.error); return []; }
      let rows=res.data || [];
      try { rows=window.cnmiV272?.operationalRows?.(rows) || rows; } catch (_) {}
      fiscalCache.set(bounds.cacheKey,rows);
      return rows;
    })();
    fiscalLoading.set(bounds.cacheKey,p);
    try { return await p; } finally { fiscalLoading.delete(bounds.cacheKey); }
  }
  function scheduleFiscal(key){
    const bounds=fiscalBounds(key);
    if (fiscalCache.has(bounds.cacheKey) || fiscalLoading.has(bounds.cacheKey)) return;
    loadFiscal(key).then(()=>{
      if (['positionMonth','positionMonthView'].includes(S()?.page)) rerender(snapshot('.v274-position-wrap'));
    });
  }
  function positionSummaryFor(person,monthRows,yearRows){
    const own=monthRows.filter(row=>normId(row.staff_id)===normId(person.id));
    const year=yearRows.filter(row=>normId(row.staff_id)===normId(person.id));
    const out={total:own.length,bb:0,donor:0,outing:0,yearTotal:year.length,positions:{}};
    own.forEach(row=>{
      out[zoneBucket(row)]++;
      const code=String(row.position_code || '-'); out.positions[code]=(out.positions[code]||0)+1;
    });
    out.top=Object.entries(out.positions).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([code,n])=>`${code} ${n}`).join(' · ');
    return out;
  }
  function summaryColumnHtml(person,monthRows,yearRows){
    const s=positionSummaryFor(person,monthRows,yearRows);
    return `<button type="button" class="v274-summary-cell" data-v274-show-position-summary="${esc(person.id)}"><b>BB ${s.bb} · Donor ${s.donor}</b><span>ออกหน่วย ${s.outing} · ปีงบ ${s.yearTotal}</span><small>${esc(s.top || 'ยังไม่มีตำแหน่ง')}</small></button>`;
  }
  function positionStatsHtml(key,monthRows){
    const people=regularPositionStaff(key);
    const bounds=fiscalBounds(key);
    const fallback=(S()?.positions || []).filter(row=>normDate(row?.work_date)>=bounds.start && normDate(row?.work_date)<=bounds.end);
    const yearRows=fiscalCache.get(bounds.cacheKey) || fallback;
    const data=people.map(person=>({person,...positionSummaryFor(person,monthRows,yearRows)}));
    const avg=data.length ? data.reduce((sum,row)=>sum+row.total,0)/data.length : 0;
    return `<div class="card v274-position-stats"><div class="section-title"><div><h3>สถิติตำแหน่ง</h3><p class="hint">BB / Donor / ออกหน่วย และยอดสะสม ${esc(bounds.label)}</p></div><span class="badge blue">เฉลี่ย ${avg.toFixed(1)} วัน</span></div><div class="table-wrap"><table><thead><tr><th>เจ้าหน้าที่</th><th>เดือนนี้</th><th>BB</th><th>Donor</th><th>ออกหน่วย</th><th>ตำแหน่งที่ทำ</th><th>สะสมปีงบ</th></tr></thead><tbody>${data.map(row=>`<tr><td><b>${esc(staffName(row.person))}</b></td><td>${row.total}</td><td>${row.bb}</td><td>${row.donor}</td><td>${row.outing}</td><td>${esc(row.top || '-')}</td><td><b>${row.yearTotal}</b></td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function showPositionSummary(staffId,key){
    const person=activeStaff().find(x=>normId(x.id)===normId(staffId)); if (!person) return;
    const monthRows=positionRows(key);
    const bounds=fiscalBounds(key);
    const yearRows=fiscalCache.get(bounds.cacheKey) || (S()?.positions || []).filter(row=>normDate(row?.work_date)>=bounds.start && normDate(row?.work_date)<=bounds.end);
    const s=positionSummaryFor(person,monthRows,yearRows);
    const detail=Object.entries(s.positions).sort((a,b)=>b[1]-a[1]);
    const html=`<h2>สรุปตำแหน่งของ ${esc(staffName(person))}</h2><div class="grid grid-4 modal-stat-grid"><div class="stat-card"><span>เดือนนี้</span><b>${s.total}</b></div><div class="stat-card"><span>BB</span><b>${s.bb}</b></div><div class="stat-card"><span>Donor</span><b>${s.donor}</b></div><div class="stat-card"><span>ออกหน่วย</span><b>${s.outing}</b></div></div><div class="card-lite"><h3>แยกตามตำแหน่ง</h3>${detail.length?`<table><tbody>${detail.map(([code,n])=>`<tr><td><button type="button" class="link-btn" data-v274-job-code="${esc(code)}">${esc(code)}</button></td><td>${n} วัน</td></tr>`).join('')}</tbody></table>`:'ยังไม่มีข้อมูล'}</div><p class="hint">ยอดสะสม ${esc(bounds.label)}: ${s.yearTotal} ตำแหน่ง</p>`;
    try { showModal(html); } catch (_) {}
  }

  /* ---------- Position person matrix ---------- */
  function slotSetting(date){ return (S()?.manualDaySlotSettingsV273 || []).find(row=>normDate(row?.work_date)===normDate(date)) || null; }
  function actualPositionCount(rows,date){ return new Set(rows.filter(row=>normDate(row?.work_date)===normDate(date) && row.staff_id).map(row=>normId(row.staff_id))).size; }
  function positionOptions(selected){
    return `<option value="">ว่าง</option>${positionMasters().map(master=>{const code=positionCode(master);return `<option value="${esc(code)}" ${String(selected||'')===code?'selected':''}>${esc(code)}</option>`;}).join('')}`;
  }
  function mentorOptions(selected,excludeId){
    return `<option value="">ยังไม่กำหนดพี่เลี้ยง</option>${activeStaff().filter(p=>normId(p.id)!==normId(excludeId)).map(p=>`<option value="${esc(p.id)}" ${normId(selected)===normId(p.id)?'selected':''}>${esc(staffName(p))}</option>`).join('')}`;
  }
  function headerDate(date,rows,editable){
    const holiday=isHolidaySafe(date), weekend=isWeekendSafe(date), actual=actualPositionCount(rows,date), target=slotSetting(date)?.target_slots;
    return `<th class="v274-date-head ${holiday?'holiday-head':weekend?'weekend-head':''}"><b>${Number(date.slice(8))}</b><small>${esc(thaiDow(date))}</small>${holiday?`<em>${esc(holidayTitle(date))}</em>`:''}${editable&&!weekend&&!holiday?`<div class="v274-slot-mini" data-v274-slot-wrap><label>เป้า <input type="number" min="0" max="30" value="${target ?? ''}" data-v274-slot-input data-date="${esc(date)}" placeholder="-"></label><span>จริง ${actual}</span><small data-v274-status></small></div>`:`<span class="v274-count-mini">${weekend||holiday?'ไม่จัด':`${actual}/${target ?? '-'} คน`}</span>`}</th>`;
  }
  function regularPositionCell(person,date,rows,editable){
    const weekend=isWeekendSafe(date), holiday=isHolidaySafe(date);
    if (weekend||holiday) return `<td class="v274-day-cell no-position-day"><span>${holiday?'HOLIDAY':'WEEKEND'}</span></td>`;
    const leave=leaveOn(person.id,date,{hideNoDuty:true});
    if (leave) return `<td class="v274-day-cell v274-leave-cell ${esc(leaveClass(leave))}"><span class="mini-status ${esc(leaveClass(leave))}">${esc(leaveText(leave))}</span></td>`;
    const row=positionRowForStaff(rows,person.id,date); const code=row?.position_code || '';
    if (!editable) return `<td class="v274-day-cell">${code?`<button type="button" class="v274-position-pill" data-v274-job-code="${esc(code)}">${esc(code)}</button>`:'<span class="muted">-</span>'}</td>`;
    return `<td class="v274-day-cell"><div class="v274-position-cell" data-v274-cell data-v274-position-cell data-date="${esc(date)}" data-staff-id="${esc(person.id)}"><select data-v274-position-select>${positionOptions(code)}</select>${code?`<button type="button" class="v274-info-btn" data-v274-job-code="${esc(code)}" title="ดูหน้าที่">i</button>`:''}<small data-v274-status></small></div></td>`;
  }
  function traineeSummary(item,key){
    const names=new Set();
    monthDates(key).forEach(date=>{ const row=assignmentForIdentity(item.identity,date); if (row?.mentor_staff_id) names.add(staffName(row.mentor_staff_id)); });
    return `<div class="v274-trainee-summary"><b>${esc(item.type==='intern'?'Intern':'น้องใหม่')} · ไม่นับ Slot</b><span>${names.size?`ติดตาม: ${esc(Array.from(names).join(', '))}`:'ยังไม่กำหนดพี่เลี้ยง'}</span></div>`;
  }
  function traineePositionCell(item,date,rows,editable){
    const weekend=isWeekendSafe(date), holiday=isHolidaySafe(date);
    if (weekend||holiday) return `<td class="v274-day-cell no-position-day"><span>${holiday?'HOLIDAY':'WEEKEND'}</span></td>`;
    const leave=item.staffId ? leaveOn(item.staffId,date,{hideNoDuty:true}) : null;
    if (leave) return `<td class="v274-day-cell v274-leave-cell ${esc(leaveClass(leave))}"><span class="mini-status ${esc(leaveClass(leave))}">${esc(leaveText(leave))}</span></td>`;
    const assignment=assignmentForIdentity(item.identity,date);
    const mentorId=assignment?.mentor_staff_id || '';
    const mentorRow=mentorId ? mentorPosition(rows,mentorId,date) : null;
    const mentorCode=mentorRow?.position_code || '';
    const mentorUnavailable=mentorId && (leaveOn(mentorId,date,{hideNoDuty:true}) || !mentorRow);
    if (!editable) {
      if (!mentorId) return `<td class="v274-day-cell v274-trainee-cell"><span class="muted">ยังไม่กำหนด</span><small>ไม่นับ Slot</small></td>`;
      return `<td class="v274-day-cell v274-trainee-cell ${mentorUnavailable?'needs-mentor':''}"><b>${mentorUnavailable?'กรุณาเลือกพี่เลี้ยงแทน':`ติดตาม: ${esc(staffName(mentorId))}`}</b><span>${mentorCode?`<button type="button" class="v274-position-pill" data-v274-job-code="${esc(mentorCode)}">${esc(mentorCode)}</button>`:'ไม่มีตำแหน่ง'}</span><small>${esc(item.type==='intern'?'Intern':'น้องใหม่')} · ไม่นับ Slot</small></td>`;
    }
    return `<td class="v274-day-cell v274-trainee-cell ${mentorUnavailable?'needs-mentor':''}"><div class="v274-mentor-cell" data-v274-cell data-v274-mentor-cell data-date="${esc(date)}" data-identity="${esc(item.identity)}" data-trainee-type="${esc(item.type)}" data-trainee-label="${esc(item.label)}" data-trainee-staff-id="${esc(item.staffId || '')}"><select data-v274-mentor-select>${mentorOptions(mentorId,item.staffId)}</select><span>${mentorUnavailable?'กรุณาเลือกพี่เลี้ยงแทน':(mentorCode || 'พี่เลี้ยงยังไม่มีตำแหน่ง')}</span><small>ไม่นับ Slot</small><small data-v274-status></small></div></td>`;
  }
  function positionMatrixHtml(key,rows,editable){
    const dates=monthDates(key), regular=regularPositionStaff(key), trainees=traineeRowsForMonth(key);
    const bounds=fiscalBounds(key), yearRows=fiscalCache.get(bounds.cacheKey) || (S()?.positions || []).filter(row=>normDate(row?.work_date)>=bounds.start && normDate(row?.work_date)<=bounds.end);
    const regularRows=regular.map(person=>`<tr><td class="v274-sticky-name" style="--staff-bg:${esc(staffColorSafe(person))};--staff-fg:${esc(textColorSafe(staffColorSafe(person)))}"><div class="v274-name-cell"><b>${esc(staffName(person))}</b><small>${esc(person.staff_type || '')}</small></div></td><td class="v274-sticky-summary">${summaryColumnHtml(person,rows,yearRows)}</td>${dates.map(date=>regularPositionCell(person,date,rows,editable)).join('')}</tr>`).join('');
    const traineeHtml=trainees.map(item=>`<tr class="v274-trainee-row"><td class="v274-sticky-name"><div class="v274-name-cell trainee"><b>${esc(item.label)}</b><small>${esc(item.type==='intern'?'Intern':'น้องใหม่')}</small></div></td><td class="v274-sticky-summary">${traineeSummary(item,key)}</td>${dates.map(date=>traineePositionCell(item,date,rows,editable)).join('')}</tr>`).join('');
    return `<div class="v274-position-wrap"><table class="v274-person-matrix"><thead><tr><th class="v274-sticky-name">เจ้าหน้าที่</th><th class="v274-sticky-summary">สรุปตำแหน่ง</th>${dates.map(date=>headerDate(date,rows,editable)).join('')}</tr></thead><tbody>${regularRows}${traineeHtml}</tbody></table></div>`;
  }
  function schedulePositionLoads(key){
    if (!slotLoadedMonths.has(key) && !slotLoadingMonths.has(key) && window.cnmiV273?.loadSlotSettings) {
      slotLoadingMonths.add(key);
      Promise.resolve(window.cnmiV273.loadSlotSettings(key)).then(()=>{
        slotLoadedMonths.add(key);
        if (['positionMonth','positionMonthView'].includes(S()?.page)) rerender(snapshot('.v274-position-wrap'));
      }).catch(error=>console.warn(`${VERSION}: slot load`,error)).finally(()=>slotLoadingMonths.delete(key));
    }
    scheduleFiscal(key);
    if (!S()?.traineeDirectoryLoadedV273 && DB()) {
      DB().from('manual_trainee_directory').select('*').order('created_at',{ascending:false}).then(res=>{
        if (!res.error && S()) { S().traineeDirectoryV273=res.data||[]; S().traineeDirectoryLoadedV273=true; if (['positionMonth','positionMonthView'].includes(S()?.page)) rerender(snapshot('.v274-position-wrap')); }
      });
    }
    if (!S()?.trainingAssignmentsLoadedAtV271) window.cnmiV271?.loadTrainingAssignments?.({force:true}).then(()=>{ if (['positionMonth','positionMonthView'].includes(S()?.page)) rerender(snapshot('.v274-position-wrap')); });
  }
  function renderPositionMonthPageV274(){
    if (!isAdminSafe()) { try { return noPermission(); } catch (_) { return '<div class="card">ไม่มีสิทธิ์</div>'; } }
    const key=S()?.positionMonthKey || S()?.monthKey || new Date().toISOString().slice(0,7);
    schedulePositionLoads(key);
    const rows=positionRows(key);
    return `<div class="v274-page"><div class="card"><div class="section-title"><div><h2>จัดตารางตำแหน่งกลางวัน รายเดือน</h2><p class="hint">รายชื่ออยู่คอลัมน์แรก เลือกตำแหน่งลงช่องได้เอง และเลือกพี่เลี้ยงของน้องใหม่/Intern ในช่องวันที่โดยตรง</p></div><span class="badge green">Manual</span></div><div class="toolbar"><label>เดือน <input type="month" id="positionMonthInput" value="${esc(key)}"></label><button type="button" class="ghost-btn" data-v274-refresh-position>รีเฟรชข้อมูลล่าสุด</button><button type="button" class="ghost-btn danger" data-clear-month-positions>ล้างข้อมูลเดือนนี้</button></div></div>${positionMatrixHtml(key,rows,true)}${positionStatsHtml(key,rows)}</div>`;
  }
  function renderPositionMonthViewPageV274(){
    const key=S()?.positionMonthViewKey || S()?.monthKey || new Date().toISOString().slice(0,7);
    schedulePositionLoads(key);
    const rows=positionRows(key);
    return `<div class="v274-page"><div class="card"><div class="section-title"><div><h2>ตารางตำแหน่งกลางวัน รายเดือน</h2><p class="hint">คอลัมน์เจ้าหน้าที่และสรุปถูกตรึงไว้ คลิกชื่อตำแหน่งเพื่อดูหน้าที่</p></div></div><div class="toolbar"><label>เดือน <input type="month" id="positionMonthViewInput" value="${esc(key)}"></label><span class="badge blue">อ่านอย่างเดียว</span></div></div>${positionMatrixHtml(key,rows,false)}${positionStatsHtml(key,rows)}</div>`;
  }

  async function saveSlot(input){
    const date=normDate(input?.dataset?.date); if (!date || !DB()) return;
    statusText(input,'กำลังบันทึก…','saving');
    const raw=input.value, target=raw===''?null:Number(raw);
    try {
      const payload={work_date:date,month_key:date.slice(0,7),target_slots:Number.isFinite(target)?target:null,updated_by:currentStaff(),updated_at:new Date().toISOString()};
      const res=await DB().from('manual_day_slot_settings').upsert(payload,{onConflict:'work_date'}).select('*').single();
      if (res.error) throw res.error;
      if (S()) S().manualDaySlotSettingsV273=(S().manualDaySlotSettingsV273||[]).filter(x=>normDate(x.work_date)!==date).concat(res.data||payload);
      statusText(input,'บันทึกแล้ว','saved');
    } catch (error) { statusText(input,friendly(error),'error'); }
  }
  async function savePositionCell(cell,code){
    const date=normDate(cell?.dataset?.date), staffId=normId(cell?.dataset?.staffId); const select=cell?.querySelector('[data-v274-position-select]');
    if (!date || !staffId || !DB()) return;
    statusText(select,'กำลังบันทึก…','saving');
    try {
      const delStaff=await DB().from('daily_positions').delete().eq('work_date',date).eq('staff_id',staffId); if (delStaff.error) throw delStaff.error;
      if (code) { const delCode=await DB().from('daily_positions').delete().eq('work_date',date).eq('position_code',code); if (delCode.error) throw delCode.error; }
      let saved=null;
      if (code) {
        const master=positionByCode(code) || {};
        const payload={work_date:date,position_code:code,zone:master.zone||'',break_time:master.break_time||'-',main_rule:master.main_rule||'',job_desc:master.job_desc||'',staff_id:staffId,updated_by:currentStaff()};
        const ins=await DB().from('daily_positions').insert(payload).select('*').single(); if (ins.error) throw ins.error; saved=ins.data;
      }
      await DB().from('daily_position_day_status').upsert({work_date:date,month_key:date.slice(0,7),status:'draft',updated_by:currentStaff()},{onConflict:'work_date'});
      if (S()) {
        S().positions=(S().positions||[]).filter(row=>!(normDate(row.work_date)===date && (normId(row.staff_id)===staffId || (code && String(row.position_code||'')===code))));
        if (saved) S().positions.push(saved);
      }
      fiscalCache.delete(fiscalBounds(date.slice(0,7)).cacheKey);
      statusText(select,'บันทึกแล้ว','saved');
      rerender(snapshot('.v274-position-wrap'));
    } catch (error) { statusText(select,`บันทึกไม่สำเร็จ: ${friendly(error)}`,'error'); }
  }
  function queuePosition(cell,code){
    const key=`${cell?.dataset?.staffId}|${cell?.dataset?.date}`; clearTimeout(positionTimers.get(key)); positionTimers.set(key,setTimeout(()=>savePositionCell(cell,code),220));
  }
  async function saveMentorCell(cell,mentorId){
    const date=normDate(cell?.dataset?.date), identity=String(cell?.dataset?.identity||''), type=String(cell?.dataset?.traineeType||'intern'), label=String(cell?.dataset?.traineeLabel||''), traineeStaffId=String(cell?.dataset?.traineeStaffId||'');
    const select=cell?.querySelector('[data-v274-mentor-select]');
    if (!date || !identity || !window.cnmiV272?.replaceRange) return statusText(select,'ไม่พบระบบพี่เลี้ยง V272','error');
    statusText(select,'กำลังบันทึก…','saving');
    try {
      const args={traineeType:type,startDate:date,endDate:date,mentorStaffId:mentorId||null,note:'กำหนดจากตารางตำแหน่งกลางวัน V274'};
      if (identity.startsWith('staff:')) args.traineeStaffId=traineeStaffId || identity.slice(6); else args.traineeName=label;
      await window.cnmiV272.replaceRange(args);
      await window.cnmiV271?.loadTrainingAssignments?.({force:true});
      statusText(select,'บันทึกแล้ว','saved');
      rerender(snapshot('.v274-position-wrap'));
    } catch (error) { statusText(select,friendly(error),'error'); }
  }
  function queueMentor(cell,mentorId){
    const key=`${cell?.dataset?.identity}|${cell?.dataset?.date}`; clearTimeout(mentorTimers.get(key)); mentorTimers.set(key,setTimeout(()=>saveMentorCell(cell,mentorId),220));
  }

  /* ---------- Roster person matrix ---------- */
  function rosterRows(key){
    try { return getAssignmentsForMonth(key) || []; }
    catch (_) { return (S()?.rosterAssignments || []).filter(row=>normDate(row?.duty_date).startsWith(key)); }
  }
  function rosterRowsForPersonDate(rows,staffId,date){ return rows.filter(row=>normId(row?.staff_id)===normId(staffId) && normDate(row?.duty_date)===normDate(date)); }
  function rosterStats(rows){
    const people=activeStaff();
    const data=people.map(person=>{
      const own=rows.filter(row=>normId(row.staff_id)===normId(person.id));
      const count=code=>own.filter(row=>row.duty_code===code).length;
      return {person,total:own.length,chbd1:count('ชบด1'),chbd2:count('ชบด2'),chbd3:count('ชบด3'),ch3a:count('ช3A'),ch3b:count('ช3B'),ch4:own.filter(row=>String(row.duty_code||'').startsWith('ช4')).length,ch9:own.filter(row=>String(row.duty_code||'').startsWith('ช9')).length};
    });
    const avg=data.length?data.reduce((sum,row)=>sum+row.total,0)/data.length:0;
    return {data,avg};
  }
  function rosterStatsHtml(rows){
    const stats=rosterStats(rows);
    return `<aside class="v274-roster-summary"><div class="v274-summary-head"><div><h3>สถิติสรุปรายเดือน</h3><small>คำนวณทันทีจากตาราง Manual</small></div><span class="badge blue">เฉลี่ย ${stats.avg.toFixed(1)}</span></div><div class="table-wrap"><table><thead><tr><th>คน</th><th>รวม</th><th>ชบด1</th><th>ชบด2</th><th>ชบด3</th><th>ช3A</th><th>ช3B</th><th>ช4</th><th>ช9</th></tr></thead><tbody>${stats.data.map(row=>`<tr><td><b>${esc(staffName(row.person))}</b></td><td>${row.total}</td><td>${row.chbd1}</td><td>${row.chbd2}</td><td>${row.chbd3}</td><td>${row.ch3a}</td><td>${row.ch3b}</td><td>${row.ch4}</td><td>${row.ch9}</td></tr>`).join('')}</tbody></table></div></aside>`;
  }
  function dutyOptions(selected){ return `<option value="">ว่าง</option>${DUTIES.map(d=>`<option value="${esc(d.code)}" ${selected===d.code?'selected':''}>${esc(d.label)}</option>`).join('')}`; }
  function rosterCell(person,date,rows){
    const own=rosterRowsForPersonDate(rows,person.id,date); const code=own[0]?.duty_code || ''; const extra=Math.max(0,own.length-1); const leave=leaveOn(person.id,date,{hideNoDuty:false});
    return `<td class="v274-roster-cell ${isWeekendSafe(date)?'weekend-cell':''} ${isHolidaySafe(date)?'holiday-cell':''}"><div class="v274-duty-cell" data-v274-cell data-v274-duty-cell data-date="${esc(date)}" data-staff-id="${esc(person.id)}">${leave?`<span class="mini-status ${esc(leaveClass(leave))}">${esc(leaveText(leave))}</span>`:''}<select data-v274-duty-select>${dutyOptions(code)}</select>${extra?`<small class="v274-extra-duty">มีอีก ${extra} เวร</small>`:''}<small data-v274-status></small></div></td>`;
  }
  function rosterMatrixHtml(key,rows){
    const dates=monthDates(key), people=activeStaff();
    return `<div class="v274-roster-wrap"><table class="v274-roster-matrix"><thead><tr><th class="v274-roster-name">เจ้าหน้าที่</th>${dates.map(date=>`<th class="v274-date-head ${isWeekendSafe(date)?'weekend-head':''} ${isHolidaySafe(date)?'holiday-head':''}"><b>${Number(date.slice(8))}</b><small>${esc(thaiDow(date))}</small>${isHolidaySafe(date)?`<em>${esc(holidayTitle(date))}</em>`:''}</th>`).join('')}</tr></thead><tbody>${people.map(person=>`<tr><td class="v274-roster-name" style="--staff-bg:${esc(staffColorSafe(person))};--staff-fg:${esc(textColorSafe(staffColorSafe(person)))}"><div class="v274-name-cell"><b>${esc(staffName(person))}</b><small>${esc(person.staff_type||'')}</small></div></td>${dates.map(date=>rosterCell(person,date,rows)).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  async function ensureRosterMonth(key){
    const y=Number(key.slice(0,4)),m=Number(key.slice(5,7));
    let month=(S()?.rosterMonths||[]).find(x=>Number(x.year)===y && Number(x.month)===m);
    if (!month) { const res=await DB().from('roster_months').select('*').eq('year',y).eq('month',m).maybeSingle(); if (res.error) throw res.error; month=res.data; }
    if (!month) { const ins=await DB().from('roster_months').insert({year:y,month:m,status:'draft',created_by:currentStaff(),updated_by:currentStaff()}).select('*').single(); if (ins.error) throw ins.error; month=ins.data; if(S())S().rosterMonths=[...(S().rosterMonths||[]),month]; }
    return month;
  }
  async function saveDutyCell(cell,code){
    const date=normDate(cell?.dataset?.date),staffId=normId(cell?.dataset?.staffId),select=cell?.querySelector('[data-v274-duty-select]');
    if (!date||!staffId||!DB()) return;
    rosterPendingWrites++;
    statusText(select,'กำลังบันทึก…','saving');
    try {
      const month=await ensureRosterMonth(date.slice(0,7));
      const del=await DB().from('roster_assignments').delete().eq('roster_month_id',month.id).eq('duty_date',date).eq('staff_id',staffId); if(del.error)throw del.error;
      let saved=null;
      if(code){
        const payload={roster_month_id:month.id,duty_date:date,duty_code:code,required_role:'',staff_id:staffId,is_locked:false,updated_by:currentStaff()};
        const up=await DB().from('roster_assignments').upsert(payload,{onConflict:'roster_month_id,duty_date,duty_code'}).select('*').single(); if(up.error)throw up.error; saved=up.data;
      }
      if(S()){
        S().rosterAssignments=(S().rosterAssignments||[]).filter(row=>!(normDate(row.duty_date)===date && (normId(row.staff_id)===staffId || (code && row.duty_code===code))));
        if(saved)S().rosterAssignments.push(saved);
        if(S().rosterDraft?.monthKey===date.slice(0,7)){
          S().rosterDraft.assignments=(S().rosterDraft.assignments||[]).filter(row=>!(normDate(row.duty_date)===date && (normId(row.staff_id)===staffId || (code && row.duty_code===code))));
          if(saved)S().rosterDraft.assignments.push(saved);
        }
      }
      statusText(select,'บันทึกแล้ว','saved'); rerender(snapshot('.v274-roster-wrap'));
    }catch(error){rosterWriteError=friendly(error);statusText(select,`บันทึกไม่สำเร็จ: ${friendly(error)}`,'error');}
    finally{rosterPendingWrites--;}
  }
  function queueDuty(cell,code){
    const key=`${cell?.dataset?.staffId}|${cell?.dataset?.date}`;
    rosterWriteError='';clearTimeout(rosterTimers.get(key));
    rosterTimers.set(key,setTimeout(()=>{rosterTimers.delete(key);saveDutyCell(cell,code);},220));
  }
  async function updateRosterStatus(status){
    if(rosterPublishing)return;
    rosterPublishing=true;let statusCommitted=false;
    try{
      const key=S()?.monthKey||new Date().toISOString().slice(0,7);
      await waitRosterSaved();
      const month=await ensureRosterMonth(key);
      const res=await DB().from('roster_months').update({status,updated_by:currentStaff()}).eq('id',month.id).select('*').single();
      if(res.error)throw res.error;
      statusCommitted=true;
      if(S())S().rosterMonths=(S().rosterMonths||[]).filter(r=>r.id!==month.id).concat(res.data||{...month,status});
      if(status==='published'){
        await v651PublishCurrentPlan(key);
        toast('บันทึกและประกาศฉบับล่าสุดแล้ว • ยอดสะสมอัปเดตแล้ว');
      }else toast('บันทึกตารางแล้ว • ไม่เปลี่ยนยอดตามประกาศ');
      try{window.renderPage?.();}catch(_){}
    }catch(error){toast((statusCommitted&&status==='published'?'ตารางประกาศแล้ว แต่ยอดตามแผนยังไม่อัปเดต: ':'บันทึกไม่สำเร็จ: ')+friendly(error),'error');}
    finally{rosterPublishing=false;}
  }
  function holidayPanel(key){
    const rows=(S()?.holidays||[]).filter(h=>String(h?.holiday_date||'').startsWith(key)).sort((a,b)=>String(a.holiday_date).localeCompare(String(b.holiday_date)));
    const last=monthDates(key).slice(-1)[0];
    return `<details class="v274-holiday-panel" open><summary>เพิ่ม/แก้ไขวันหยุดราชการของเดือนนี้</summary><form id="v274HolidayForm" class="v274-holiday-form"><label>วันที่<input type="date" name="holiday_date" min="${esc(key+'-01')}" max="${esc(last)}" value="${esc(key+'-01')}" required></label><label>ชื่อวันหยุด<input name="title" placeholder="เช่น วันหยุดราชการ" required></label><button class="soft-btn" type="submit">บันทึกวันหยุด</button><button class="ghost-btn" type="button" data-page="holidayRulesV107">ตั้งค่ากฎเวรนักขัตแบบละเอียด</button></form><div class="v274-holiday-list">${rows.length?rows.map(h=>`<span class="v274-holiday-chip"><b>${esc(normDate(h.holiday_date).slice(8))}</b> ${esc(visibleHolidayTitle(h.title||h.name||h.holiday_name))}<button type="button" data-v274-delete-holiday="${esc(normDate(h.holiday_date))}">×</button></span>`).join(''):'<span class="muted">ยังไม่มีวันหยุดในเดือนนี้</span>'}</div></details>`;
  }
  function renderSchedulerPageV274(){
    if(!isAdminSafe()){try{return noPermission();}catch(_){return '<div class="card">ไม่มีสิทธิ์</div>';}}
    const key=S()?.monthKey||new Date().toISOString().slice(0,7),rows=rosterRows(key);
    return `<div class="v274-page"><div class="card"><div class="section-title"><div><h2>จัดตารางเวรแบบ Manual</h2><p class="hint">รายชื่ออยู่คอลัมน์แรก วันที่เรียงแนวนอนเหมือนแท็บ “ตารางทั้งเดือน” ของ Staff</p></div><span class="badge green">Manual 100%</span></div><div class="toolbar"><label>เดือน <input type="month" id="rosterMonthInput" value="${esc(key)}"></label><button type="button" class="primary-btn" data-v274-save-roster>บันทึก</button><button type="button" class="soft-btn" data-v274-publish-roster>บันทึกและประกาศ</button><button type="button" class="ghost-btn danger" data-clear-roster-month>ล้างข้อมูลเดือนนี้</button></div><div class="v274-duty-pool"><b>ลากเวรไปวางในช่อง</b>${DUTIES.map(d=>`<span draggable="true" class="v274-duty-chip" data-v274-drag-duty="${esc(d.code)}">${esc(d.label)}</span>`).join('')}</div>${holidayPanel(key)}</div><div class="v274-roster-workspace">${rosterMatrixHtml(key,rows)}${rosterStatsHtml(rows)}</div></div>`;
  }
  async function saveHolidayForm(form){
    if(!isAdminSafe()||!DB())return;
    const fd=new FormData(form),date=String(fd.get('holiday_date')||''),title=String(fd.get('title')||'').trim();
    if(!date||!title)return toast('กรุณาเลือกวันที่และกรอกชื่อวันหยุด','error');
    const existing=(S()?.holidays||[]).find(h=>normDate(h.holiday_date)===date);const suffix=holidayRuleSuffix(existing?.title||'');
    try{
      const payload={holiday_date:date,title:suffix?`${title} ${suffix}`:title,updated_by:currentStaff()};
      const res=await DB().from('public_holidays').upsert(payload,{onConflict:'holiday_date'}).select('*').maybeSingle();if(res.error)throw res.error;
      if(S()){S().holidays=(S().holidays||[]).filter(h=>normDate(h.holiday_date)!==date).concat(res.data||payload);S().rosterDraft=null;}
      toast('บันทึกวันหยุดราชการแล้ว');rerender(snapshot('.v274-roster-wrap'));
    }catch(error){toast(`บันทึกวันหยุดไม่สำเร็จ: ${friendly(error)}`,'error');}
  }
  async function deleteHoliday(date){
    if(!isAdminSafe()||!DB())return;
    let ok=true;try{ok=typeof confirmDialog==='function'?await confirmDialog(`ลบวันหยุดวันที่ ${date} หรือไม่?`,'ยืนยันลบวันหยุด'):confirm(`ลบวันหยุดวันที่ ${date} หรือไม่?`);}catch(_){ok=confirm(`ลบวันหยุดวันที่ ${date} หรือไม่?`);}if(!ok)return;
    const res=await DB().from('public_holidays').delete().eq('holiday_date',date);if(res.error)return toast(friendly(res.error),'error');
    if(S()){S().holidays=(S().holidays||[]).filter(h=>normDate(h.holiday_date)!==date);S().rosterDraft=null;}toast('ลบวันหยุดแล้ว');rerender(snapshot('.v274-roster-wrap'));
  }

  /* ---------- Job description ---------- */
  function showJob(code){
    const master=positionByCode(code)||{};
    try { showModal(`<div class="v274-job-modal"><h2>${esc(code)}</h2><p><b>โซน:</b> ${esc(master.zone||'-')}<br><b>เวลาพัก:</b> ${esc(master.break_time||'-')}</p><h3>หน้าที่งาน</h3><p>${esc(master.job_desc||'ยังไม่ได้ระบุรายละเอียดหน้าที่')}</p></div>`); } catch (_) {}
  }

  /* ---------- Overrides ---------- */
  assignGlobal('renderSchedulerPage',renderSchedulerPageV274);
  assignGlobal('renderPositionMonthPage',renderPositionMonthPageV274);
  assignGlobal('renderPositionMonthViewPage',renderPositionMonthViewPageV274);
  try {
    const p=NAV_ITEMS.find(x=>x.id==='positionMonth'); if(p){p.title='จัดตารางตำแหน่งกลางวัน รายเดือน';p.subtitle='รายชื่อ x วันที่ จัดเองและดูสถิติ';}
    const s=NAV_ITEMS.find(x=>x.id==='scheduler'); if(s){s.title='จัดตารางเวรประจำเดือน';s.subtitle='รายชื่อ x วันที่ แบบ Manual';}
  } catch (_) {}

  /* ---------- Events ---------- */
  document.addEventListener('dragstart',event=>{
    const duty=event.target?.closest?.('[data-v274-drag-duty]');
    if(duty){event.dataTransfer.setData('v274Duty',duty.dataset.v274DragDuty||'');event.dataTransfer.effectAllowed='copy';event.stopImmediatePropagation();return;}
    const pos=event.target?.closest?.('[data-v274-drag-position]');
    if(pos){event.dataTransfer.setData('v274Position',pos.dataset.v274DragPosition||'');event.dataTransfer.effectAllowed='copy';event.stopImmediatePropagation();}
  },true);
  document.addEventListener('dragover',event=>{
    const cell=event.target?.closest?.('[data-v274-duty-cell],[data-v274-position-cell]');if(!cell)return;event.preventDefault();cell.classList.add('drag-over');event.stopImmediatePropagation();
  },true);
  document.addEventListener('dragleave',event=>{const cell=event.target?.closest?.('[data-v274-duty-cell],[data-v274-position-cell]');if(cell)cell.classList.remove('drag-over');},true);
  document.addEventListener('drop',event=>{
    const dutyCell=event.target?.closest?.('[data-v274-duty-cell]');
    if(dutyCell){event.preventDefault();event.stopImmediatePropagation();dutyCell.classList.remove('drag-over');const code=event.dataTransfer?.getData('v274Duty');if(code){const sel=dutyCell.querySelector('[data-v274-duty-select]');sel.value=code;queueDuty(dutyCell,code);}return;}
    const posCell=event.target?.closest?.('[data-v274-position-cell]');
    if(posCell){event.preventDefault();event.stopImmediatePropagation();posCell.classList.remove('drag-over');const code=event.dataTransfer?.getData('v274Position');if(code){const sel=posCell.querySelector('[data-v274-position-select]');sel.value=code;queuePosition(posCell,code);}}
  },true);
  document.addEventListener('change',event=>{
    const duty=event.target?.closest?.('[data-v274-duty-select]');if(duty){event.stopImmediatePropagation();queueDuty(duty.closest('[data-v274-duty-cell]'),duty.value);return;}
    const pos=event.target?.closest?.('[data-v274-position-select]');if(pos){event.stopImmediatePropagation();queuePosition(pos.closest('[data-v274-position-cell]'),pos.value);return;}
    const mentor=event.target?.closest?.('[data-v274-mentor-select]');if(mentor){event.stopImmediatePropagation();queueMentor(mentor.closest('[data-v274-mentor-cell]'),mentor.value);return;}
    const slot=event.target?.closest?.('[data-v274-slot-input]');if(slot){event.stopImmediatePropagation();saveSlot(slot);}
  },true);
  document.addEventListener('submit',event=>{
    if(event.target?.id==='v274HolidayForm'){event.preventDefault();event.stopImmediatePropagation();saveHolidayForm(event.target);}
  },true);
  document.addEventListener('click',event=>{
    const job=event.target?.closest?.('[data-v274-job-code]');if(job){event.preventDefault();event.stopImmediatePropagation();showJob(job.dataset.v274JobCode);return;}
    const summary=event.target?.closest?.('[data-v274-show-position-summary]');if(summary){event.preventDefault();event.stopImmediatePropagation();showPositionSummary(summary.dataset.v274ShowPositionSummary,S()?.positionMonthKey||S()?.positionMonthViewKey||S()?.monthKey);return;}
    if(event.target?.closest?.('[data-v274-save-roster]')){event.preventDefault();event.stopImmediatePropagation();updateRosterStatus('draft');return;}
    if(event.target?.closest?.('[data-v274-publish-roster]')){event.preventDefault();event.stopImmediatePropagation();updateRosterStatus('published');return;}
    const del=event.target?.closest?.('[data-v274-delete-holiday]');if(del){event.preventDefault();event.stopImmediatePropagation();deleteHoliday(del.dataset.v274DeleteHoliday);return;}
    if(event.target?.closest?.('[data-v274-refresh-position]')){event.preventDefault();event.stopImmediatePropagation();Promise.all([loadAllData(),window.cnmiV273?.loadSlotSettings?.(S()?.positionMonthKey||S()?.monthKey,true),window.cnmiV271?.loadTrainingAssignments?.({force:true}),loadFiscal(S()?.positionMonthKey||S()?.monthKey,true)]).then(()=>rerender(snapshot('.v274-position-wrap')));}
  },true);

  /* ---------- Styles ---------- */
  const style=document.createElement('style');
  style.id='cnmi-v274-person-matrix-style';
  style.textContent=`
    .v274-page{display:grid;gap:12px}.v274-position-pool,.v274-duty-pool{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:8px;margin-top:8px;border:1px solid #dbeafe;border-radius:12px;background:#f8fbff}.v274-position-chip,.v274-duty-chip{display:inline-flex;padding:5px 9px;border-radius:999px;background:#e0f2fe;color:#075985;font-size:10px;font-weight:800;cursor:grab;border:1px solid #bae6fd}.v274-duty-chip{background:#f5f3ff;color:#5b21b6;border-color:#ddd6fe}
    .v274-position-wrap,.v274-roster-wrap{overflow:auto;max-height:72vh;border:1px solid #dbe3ef;border-radius:14px;background:#fff;box-shadow:0 5px 18px rgba(15,23,42,.05)}.v274-person-matrix,.v274-roster-matrix{border-collapse:separate;border-spacing:0;min-width:max-content;width:100%;font-size:10px}.v274-person-matrix th,.v274-person-matrix td,.v274-roster-matrix th,.v274-roster-matrix td{border-right:1px solid #e5eaf1;border-bottom:1px solid #e5eaf1;padding:4px;min-width:92px;background:#fff;vertical-align:middle}.v274-person-matrix thead th,.v274-roster-matrix thead th{position:sticky;top:0;z-index:8;background:#f8fafc;text-align:center}.v274-date-head b{font-size:12px}.v274-date-head small{display:block;color:#64748b}.v274-date-head em{display:block;max-width:88px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:8px;color:#be123c;font-style:normal}.v274-date-head.weekend-head,.v274-date-head.holiday-head{background:#e2e8f0}.v274-sticky-name,.v274-roster-name{position:sticky!important;left:0;z-index:10!important;min-width:110px!important;max-width:125px!important;background:var(--staff-bg,#f8fafc)!important;color:var(--staff-fg,#0f172a)!important}.v274-person-matrix thead .v274-sticky-name,.v274-roster-matrix thead .v274-roster-name{z-index:14!important;background:#f8fafc!important;color:#0f172a!important}.v274-sticky-summary{position:sticky!important;left:118px;z-index:9!important;min-width:180px!important;max-width:220px!important;background:#fff!important;box-shadow:2px 0 4px rgba(15,23,42,.08)}.v274-person-matrix thead .v274-sticky-summary{z-index:13!important;background:#f8fafc!important}.v274-name-cell{display:flex;flex-direction:column;gap:1px;padding:3px}.v274-name-cell b{font-size:11px}.v274-name-cell small{font-size:8px;opacity:.85}.v274-name-cell.trainee{background:#fff7ed;color:#9a3412;border-radius:8px}.v274-summary-cell{display:flex;flex-direction:column;gap:2px;width:100%;border:0;background:transparent;text-align:left;cursor:pointer;color:#0f172a}.v274-summary-cell b{font-size:9px}.v274-summary-cell span,.v274-summary-cell small{font-size:8px;color:#64748b}.v274-summary-cell:hover b{color:#2563eb;text-decoration:underline}.v274-trainee-summary{display:flex;flex-direction:column;gap:2px;color:#9a3412}.v274-trainee-summary b{font-size:9px}.v274-trainee-summary span{font-size:8px}.v274-day-cell{height:54px;text-align:center}.v274-day-cell.no-position-day{background:#e2e8f0;color:#64748b}.v274-day-cell.no-position-day span{font-size:8px;font-weight:800}.v274-leave-cell{background:#fff7ed}.v274-position-cell{display:grid;grid-template-columns:minmax(68px,1fr) 20px;gap:2px;align-items:center;border:1px solid transparent;border-radius:7px;padding:2px}.v274-position-cell.drag-over,.v274-duty-cell.drag-over{border-color:#2563eb;background:#dbeafe}.v274-position-cell select,.v274-duty-cell select,.v274-mentor-cell select{width:100%;min-width:72px;border:1px solid #cbd5e1;border-radius:7px;padding:5px 3px;font-size:9px;background:#fff}.v274-info-btn{width:20px;height:24px;border:0;border-radius:6px;background:#eff6ff;color:#2563eb;font-weight:900}.v274-position-cell [data-v274-status]{grid-column:1/-1}.v274-position-pill{border:0;border-radius:7px;padding:5px 6px;background:#eff6ff;color:#1d4ed8;font-size:9px;font-weight:800;cursor:pointer}.v274-trainee-cell{background:#fffaf5!important}.v274-trainee-cell.needs-mentor{background:#fff1f2!important}.v274-mentor-cell{display:flex;flex-direction:column;gap:2px}.v274-mentor-cell span{font-size:8px;color:#9a3412}.v274-mentor-cell small{font-size:8px;color:#64748b}.v274-slot-mini{margin-top:3px;border-top:1px dashed #cbd5e1;padding-top:2px}.v274-slot-mini label{display:flex;align-items:center;justify-content:center;gap:2px;font-size:8px}.v274-slot-mini input{width:38px;height:20px;padding:1px;font-size:8px}.v274-slot-mini span,.v274-count-mini{display:block;font-size:8px;color:#2563eb}.v274-position-stats .table-wrap{max-height:45vh}.v274-position-stats table{min-width:760px}
    .v274-roster-workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(330px,390px);gap:12px;align-items:start}.v274-roster-summary{position:sticky;top:10px;max-height:76vh;overflow:auto;border:1px solid #dbe3ef;border-radius:14px;background:#fff}.v274-summary-head{display:flex;justify-content:space-between;gap:8px;padding:10px;border-bottom:1px solid #e5e7eb;background:#f8fafc}.v274-summary-head h3{margin:0}.v274-summary-head small{color:#64748b}.v274-roster-summary table{min-width:650px;font-size:9px}.v274-roster-cell{height:64px}.v274-duty-cell{display:flex;flex-direction:column;gap:2px;border:1px solid transparent;border-radius:7px;padding:2px}.v274-extra-duty{color:#b45309}.v274-holiday-panel{margin-top:10px;border:1px solid #fde68a;border-radius:12px;background:#fffbeb;padding:8px}.v274-holiday-panel summary{cursor:pointer;font-weight:800;color:#92400e}.v274-holiday-form{display:flex;align-items:end;gap:8px;flex-wrap:wrap;margin-top:8px}.v274-holiday-form label{display:flex;flex-direction:column;gap:3px;font-size:10px}.v274-holiday-form input{min-width:170px}.v274-holiday-list{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.v274-holiday-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 7px;border-radius:999px;background:#fef3c7;color:#92400e;font-size:9px}.v274-holiday-chip button{border:0;background:transparent;color:#dc2626;cursor:pointer;font-weight:900}.v274-job-modal p{white-space:pre-wrap;line-height:1.7}
    [data-v274-status]{display:block;min-height:9px;font-size:7px;line-height:1.1}[data-v274-status][data-tone=saving]{color:#2563eb}[data-v274-status][data-tone=saved]{color:#15803d}[data-v274-status][data-tone=error]{color:#b91c1c}
    @media(max-width:1180px){.v274-roster-workspace{grid-template-columns:1fr}.v274-roster-summary{position:relative;top:auto;max-height:none}.v274-position-wrap,.v274-roster-wrap{max-height:68vh}}
    @media(max-width:820px){.v274-sticky-name,.v274-roster-name{min-width:96px!important;max-width:105px!important}.v274-sticky-summary{left:102px;min-width:155px!important;max-width:170px!important}.v274-person-matrix th,.v274-person-matrix td,.v274-roster-matrix th,.v274-roster-matrix td{min-width:84px}.v274-position-pool,.v274-duty-pool{max-height:120px;overflow:auto}.v274-holiday-form{display:grid;grid-template-columns:1fr}.v274-holiday-form input{width:100%;min-width:0}}
  `;
  document.head.appendChild(style);

  window.cnmiV274={renderSchedulerPageV274,renderPositionMonthPageV274,renderPositionMonthViewPageV274,loadFiscal};
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v274-person-matrix-manual-fix.js", error); }
;

/* Original source: patch-v275-admin-manual-ui-corrections.js */
try {
/* CNMI Staff Planner V275
   Admin Manual UI corrections
   - Admin daytime position: manual target row, no weekly mentor column, mentor is selected in trainee day cell
   - Staff daytime position: hide non-normal daily-position staff and remove bottom statistics
   - Admin roster: compact blank drag/tap cells, staff-colored assignments, roster_enabled=false excluded
   - Admin roster summary: same grouped balance format as Staff balance tab
*/
(function(){
  'use strict';

/* v651: invoke ONLY after the roster-month publication write succeeded. */
async function v651PublishCurrentPlan(key){
  const api=window.cnmiV648PublishedPlan;
  if(!api?.takeSnapshot)throw new Error('ไม่พบระบบเก็บตารางตามหัวหน้าประกาศ (v651)');
  const ok=await api.takeSnapshot(key,{replace:true});
  if(!ok)throw new Error('ระบบไม่สามารถยืนยันข้อมูลประกาศฉบับล่าสุดได้');
  const diff=api.lastPublication;
  if(diff?.month===key && diff.holidayChangedCount!==null){
    const count=diff.holidayChangedCount;
    const note=count ? `วันหยุดตามหัวหน้าเปลี่ยน ${count} คน` : 'จำนวนวันหยุดตามหัวหน้ายังเท่าเดิม (ตรวจวันเสาร์/อาทิตย์/นักขัตและเวรของแต่ละคน)';
    try{window.showToast?.(note);}catch(_){}
  }
  return true;
}

  const VERSION = 'V275_ADMIN_MANUAL_UI_CORRECTIONS';
  if (window.__CNMI_V275_ADMIN_MANUAL_UI_CORRECTIONS__) return;
  window.__CNMI_V275_ADMIN_MANUAL_UI_CORRECTIONS__ = true;

  const DUTIES = [
    {code:'ชบด1',label:'ชบด1'}, {code:'ชบด2',label:'ชบด2'}, {code:'ชบด3',label:'ชบด3'},
    {code:'ช4A',label:'ช4 ช่อง 1'}, {code:'ช4B',label:'ช4 ช่อง 2'},
    {code:'ช3A',label:'ช3A'}, {code:'ช3B',label:'ช3B'},
    {code:'ช9-เคิก',label:'ช9 เคิก'}, {code:'ช9-MT',label:'ช9 MT'}
  ];
  const positionTimers = new Map();
  const slotTimers = new Map();
  const mentorTimers = new Map();
  const fiscalCache = new Map();
  const fiscalLoading = new Map();
  const slotLoading = new Set();
  let selectedDutyCode = '';
  let forcingRender = false;

  function S(){ try { return state || window.state || null; } catch (_) { return window.state || null; } }
  function DB(){ try { return sb || window.sb || null; } catch (_) { return window.sb || null; } }
  function esc(v){
    try { return escapeHtml(v == null ? '' : String(v)); }
    catch (_) { return String(v == null ? '' : v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  }
  function assignGlobal(name,value){
    try { window[name]=value; } catch (_) {}
    try { (0,eval)(`${name}=window[${JSON.stringify(name)}]`); } catch (_) {}
  }
  function normId(v){ return String(v == null ? '' : v); }
  function normDate(v){
    try { return normalizeDateKey(v); }
    catch (_) { return String(v || '').slice(0,10); }
  }
  function currentStaff(){
    try { return currentStaffId(); }
    catch (_) { return S()?.profile?.id || null; }
  }
  function isAdminSafe(){
    try { return !!isAdmin(); }
    catch (_) { return String(S()?.profile?.role || '').toLowerCase()==='admin'; }
  }
  function toast(message,tone){
    try { showToast(message,tone ? {tone} : undefined); }
    catch (_) { console.info(message); }
  }
  function friendly(error){
    try { return friendlyDbError(error); }
    catch (_) { return error?.message || error?.details || String(error || 'เกิดข้อผิดพลาด'); }
  }
  function monthDates(key){
    const safe=/^\d{4}-\d{2}$/.test(String(key||''))?String(key):new Date().toISOString().slice(0,7);
    const y=Number(safe.slice(0,4)),m=Number(safe.slice(5,7)),last=new Date(y,m,0).getDate();
    return Array.from({length:last},(_,i)=>`${safe}-${String(i+1).padStart(2,'0')}`);
  }
  function thaiDow(date){
    try { return parseDate(date).toLocaleDateString('th-TH',{weekday:'short'}); }
    catch (_) { return new Date(`${date}T00:00:00`).toLocaleDateString('th-TH',{weekday:'short'}); }
  }
  function isWeekendSafe(date){
    try { return isWeekend(date); }
    catch (_) { const d=new Date(`${date}T00:00:00`);return d.getDay()===0||d.getDay()===6; }
  }
  function isHolidaySafe(date){ try { return isHolidayDate(date); } catch (_) { return false; } }
  function holidayTitle(date){
    try { return holidayName(date)||'วันหยุดราชการ'; }
    catch (_) {
      const row=(S()?.holidays||[]).find(x=>normDate(x?.holiday_date)===normDate(date));
      return String(row?.title||row?.name||row?.holiday_name||'วันหยุดราชการ').split(':::')[0].trim();
    }
  }
  function explicitFalse(v){ return v===false || ['false','0','no','off','ปิด'].includes(String(v??'').trim().toLowerCase()); }
  function isActivePerson(p){
    if (!p) return false;
    const raw=Object.prototype.hasOwnProperty.call(p,'active')?p.active:p.is_active;
    return !explicitFalse(raw) && raw != null;
  }
  function monthBounds(key){
    const safe=/^\d{4}-\d{2}$/.test(String(key||''))?String(key):(S()?.monthKey||new Date().toISOString().slice(0,7));
    return {first:`${safe}-01`,last:monthDates(safe).slice(-1)[0],key:safe};
  }
  function employmentStart(p){ return normDate(p?.employment_start_date||p?.start_date||''); }
  function employmentEnd(p){ return normDate(p?.employment_end_date||''); }
  function employmentOn(p,date){
    const d=normDate(date),start=employmentStart(p),end=employmentEnd(p);
    if(!d) return true;
    if(start&&d<start) return false;
    if(end&&d>end) return false;
    return true;
  }
  function employmentOverlapsMonth(p,key){
    const b=monthBounds(key),start=employmentStart(p),end=employmentEnd(p);
    return (!start||start<=b.last)&&(!end||end>=b.first);
  }
  function dailyPositionStart(p){ return normDate(p?.daily_position_start_date||''); }
  function dailyPositionOn(p,date){ const d=normDate(date),start=dailyPositionStart(p); return employmentOn(p,d)&&(!start||!d||d>=start); }
  function hasRosterRowsInMonth(p,key){ return (S()?.rosterAssignments||[]).some(r=>normId(r?.staff_id)===normId(p?.id)&&normDate(r?.duty_date).startsWith(String(key||''))); }
  function hasPositionRowsInMonth(p,key){ return (S()?.positions||[]).some(r=>normId(r?.staff_id)===normId(p?.id)&&normDate(r?.work_date).startsWith(String(key||''))); }
  function lifecycleLabel(p,date){
    const d=normDate(date),start=employmentStart(p),end=employmentEnd(p),dp=dailyPositionStart(p);
    if(start&&d<start)return 'ยังไม่เริ่มงาน';
    if(end&&d>end)return 'สิ้นสุดการใช้งานแล้ว';
    if(dp&&d<dp)return 'ยังไม่เริ่มเป็นตัวจริง';
    return '';
  }
  function allActiveStaff(){
    const rows=(S()?.staff||[]).filter(p=>isActivePerson(p));
    try { return orderedStaff(rows); }
    catch (_) { return rows.slice().sort((a,b)=>staffName(a).localeCompare(staffName(b),'th')); }
  }
  function staffName(personOrId){
    const p=typeof personOrId==='object'?personOrId:(S()?.staff||[]).find(x=>normId(x.id)===normId(personOrId));
    return p?(p.nickname||p.full_name||p.email||'-'):'-';
  }
  function normName(value){ return String(value || '').trim().toLowerCase().replace(/\s+/g,' '); }
  function findStaffByName(name){
    const key=normName(name);
    if(!key) return null;
    return allActiveStaff().find(person=>normName(person?.nickname)===key || normName(person?.full_name)===key) || null;
  }
  function staffColorSafe(person){ try { return staffColor(person); } catch (_) { return person?.color||'#e2e8f0'; } }
  function textColorSafe(color){ try { return textColorFor(color); } catch (_) { return '#0f172a'; } }
  function linkedStaffForTraineeRow(row){
    if(!row) return null;
    const staffId=normId(row.trainee_staff_id);
    const label=staffId ? staffName(staffId) : (row.trainee_name || '');
    return staffId
      ? ((S()?.staff||[]).find(p=>normId(p?.id)===staffId) || findStaffByName(label))
      : findStaffByName(label);
  }
  function directoryRowAppliesToMonth(row,key){
    if(!row || row.active===false) return false;
    const linked=linkedStaffForTraineeRow(row);
    // External Intern/trainee names have no staff profile, so the directory remains the source of truth.
    if(!linked) return true;
    const b=monthBounds(key),start=dailyPositionStart(linked);
    // A linked new staff member is trainee only before the configured regular-position start date.
    // Once that date is reached, the directory is merely historical registration and must not
    // keep the person in the trainee row forever. Actual mentorship rows still apply by date range.
    if(start){
      if(b.last < start) return true;
      if(b.first >= start) return false;
      return false; // transition inside this month: regular row handles pre-start dates per-cell.
    }
    return String(linked?.position_training_status||'ใช้งานปกติ').trim()!=='ใช้งานปกติ';
  }
  function activeTraineeKeysForMonth(key){
    const monthKey=/^\d{4}-\d{2}$/.test(String(key||''))?String(key):(S()?.positionMonthKey||S()?.positionMonthViewKey||S()?.monthKey||new Date().toISOString().slice(0,7));
    const first=`${monthKey}-01`,last=monthDates(monthKey).slice(-1)[0],ids=new Set(),names=new Set();
    const collect=row=>{
      if(!row || row.active===false) return;
      const staffId=normId(row.trainee_staff_id);
      const label=staffId ? staffName(staffId) : (row.trainee_name || '');
      const linked=linkedStaffForTraineeRow(row);
      if(staffId) ids.add(staffId);
      if(linked?.id) ids.add(normId(linked.id));
      if(label) names.add(normName(label));
      if(linked?.nickname) names.add(normName(linked.nickname));
      if(linked?.full_name) names.add(normName(linked.full_name));
    };
    (Array.isArray(S()?.traineeDirectoryV273)?S().traineeDirectoryV273:[])
      .filter(r=>directoryRowAppliesToMonth(r,monthKey))
      .forEach(collect);
    (Array.isArray(S()?.trainingAssignmentsV271)?S().trainingAssignmentsV271:[])
      .filter(r=>r&&r.active!==false&&normDate(r.start_date)<=last&&normDate(r.end_date)>=first)
      .forEach(collect);
    return { ids, names };
  }
  function normalPositionStaff(key){
    const monthKey=/^\d{4}-\d{2}$/.test(String(key||''))?String(key):(S()?.positionMonthKey||S()?.positionMonthViewKey||S()?.monthKey||new Date().toISOString().slice(0,7));
    const traineeKeys=activeTraineeKeysForMonth(monthKey),source=(S()?.staff||[]);
    const rows=source.filter(p=>{
      if(!p?.id||String(p?.staff_type||'').trim()==='แพทย์'||p?.maternity_status)return false;
      const saved=hasPositionRowsInMonth(p,monthKey);
      if(saved)return true; // ประวัติที่บันทึกแล้วต้องไม่หาย แม้เปลี่ยนสถานะน้องใหม่/Inactive ภายหลัง
      if(!employmentOverlapsMonth(p,monthKey))return false;
      if(!isActivePerson(p)&&!employmentEnd(p))return false; // คนที่กำหนดวันสิ้นสุดยังคงเห็นชื่อในเดือนประวัติเดิม
      const pid=normId(p?.id),nick=normName(p?.nickname),full=normName(p?.full_name);
      if(traineeKeys.ids.has(pid)||(nick&&traineeKeys.names.has(nick))||(full&&traineeKeys.names.has(full)))return false;
      if(explicitFalse(p?.daily_position_enabled))return false;
      if(String(p?.position_training_status||'ใช้งานปกติ').trim()!=='ใช้งานปกติ')return false;
      const start=dailyPositionStart(p),last=monthBounds(monthKey).last;
      if(start&&start>last)return false;
      return true;
    });
    try{return orderedStaff(rows);}catch(_){return rows;}
  }
  function rosterEnabledStaff(key){
    const monthKey=/^\d{4}-\d{2}$/.test(String(key||''))?String(key):(S()?.monthKey||new Date().toISOString().slice(0,7));
    const rows=(S()?.staff||[]).filter(p=>{
      if(!p?.id||String(p?.staff_type||'').trim()==='แพทย์'||p?.maternity_status)return false;
      const saved=hasRosterRowsInMonth(p,monthKey);
      if(saved)return true; // เก็บแถวประวัติเดิมไว้ แม้ปิดบัญชีหลังพ้นเดือนนั้นแล้ว
      if(!isActivePerson(p)||!employmentOverlapsMonth(p,monthKey))return false;
      const value=p?.roster_enabled ?? p?.duty_enabled ?? p?.can_roster ?? p?.is_roster_enabled ?? p?.schedule_enabled ?? p?.is_schedule_enabled ?? p?.['สถานะจัดเวร'];
      return !explicitFalse(value);
    });
    try{return orderedStaff(rows);}catch(_){return rows;}
  }
  function leaveEffective(row){
    try { return isLeaveEffective(row); }
    catch (_) { return !/(cancelled|canceled|rejected|deleted|ไม่อนุมัติ|ยกเลิกแล้ว)/i.test(String(row?.status||'')); }
  }
  function leaveText(row){
    try { return leaveDisplayType(row); }
    catch (_) { return String(row?.type||row?.leave_type||'ลาอื่นๆ').split(':::')[0].trim(); }
  }
  function isNoDuty(row){
    try { return isNoDutyLeaveType(row); }
    catch (_) { return leaveText(row)==='ไม่รับเวร'; }
  }
  function leaveOn(staffId,date,{hideNoDuty=false}={}){
    const row=(S()?.leaves||[]).find(item=>normId(item?.staff_id)===normId(staffId)&&leaveEffective(item)&&normDate(item?.start_date)<=normDate(date)&&normDate(item?.end_date||item?.start_date)>=normDate(date));
    if (!row || (hideNoDuty&&isNoDuty(row))) return null;
    return row;
  }
  function leaveClass(row){
    try { return leaveCellClass(row); }
    catch (_) {
      const t=leaveText(row);
      if(t==='ลากิจ')return 'leave-personal';if(t==='ลาป่วย')return 'leave-sick';if(/พัก/.test(t))return 'leave-vacation';if(t==='ลาคลอด')return 'leave-maternity';if(t==='ไม่รับเวร')return 'leave-no-duty';return 'leave-other';
    }
  }
  function leaveBadge(row){ return row?`<span class="mini-status ${esc(leaveClass(row))}">${esc(leaveText(row))}</span>`:''; }
  function snapshot(selector){ const el=document.querySelector(selector);return {selector,left:el?.scrollLeft||0,top:el?.scrollTop||0,x:window.scrollX,y:window.scrollY}; }
  function restoreSnapshot(snap){
    setTimeout(()=>{try{window.scrollTo(snap?.x||0,snap?.y||0);const el=document.querySelector(snap?.selector||'');if(el){el.scrollLeft=snap?.left||0;el.scrollTop=snap?.top||0;}}catch(_){}},30);
  }
  function rerender(snap){ try { renderPage(); } catch (_) { try { window.renderPage?.(); } catch(__){} } restoreSnapshot(snap); }

  /* ----- position data ----- */
  function positionCode(row){ return String(row?.code||row?.position_code||'').trim(); }
  function positionMasters(){
    let rows=Array.isArray(S()?.positionMasters)?S().positionMasters.filter(x=>x&&x.is_active!==false&&!x.deleted_at):[];
    if(!rows.length){try{rows=positionTemplateForDate(`${S()?.positionMonthKey||S()?.positionMonthViewKey||S()?.monthKey||new Date().toISOString().slice(0,7)}-01`)||[];}catch(_){rows=[];}}
    const seen=new Set();
    return rows.filter(r=>{const c=positionCode(r);if(!c||seen.has(c))return false;seen.add(c);return true;}).sort((a,b)=>Number(a.sort_order||999)-Number(b.sort_order||999)||positionCode(a).localeCompare(positionCode(b),'th'));
  }
  function isOutingDateSafe(date){
    const key=normDate(date);
    try { return !!hasOuting(key); }
    catch (_) {
      return (S()?.activities||[]).some(a=>String(a?.event_type||'').trim()==='ออกหน่วย'&&normDate(a?.start_date)<=key&&normDate(a?.end_date||a?.start_date)>=key);
    }
  }
  function isOutingMaster(row){
    const zone=String(row?.zone||'').trim().toLowerCase();
    return row?.is_outing===true||zone.includes('ออกหน่วย')||String(row?.eligibility_code||'').startsWith('OUTING:');
  }
  function positionByCode(code,date=''){
    const wanted=String(code||'');
    if(date){
      try {
        const configured=window.cnmiV278?.templateRowsForDate?.(normDate(date))?.find(row=>positionCode(row)===wanted);
        if(configured)return configured;
      } catch (_) {}
    }
    const candidates=positionMasters().filter(x=>positionCode(x)===wanted);
    if(!candidates.length)return null;
    if(date){
      const outing=isOutingDateSafe(date);
      const matched=candidates.find(row=>isOutingMaster(row)===outing);
      if(matched)return matched;
    }
    return candidates.find(row=>!isOutingMaster(row))||candidates[0];
  }
  function positionRows(key){
    let rows=(S()?.positions||[]).filter(r=>normDate(r?.work_date).startsWith(key));
    try { rows=window.cnmiV272?.operationalRows?.(rows)||rows; } catch(_){}
    return rows;
  }
  function positionRow(rows,staffId,date){ return rows.find(r=>normId(r?.staff_id)===normId(staffId)&&normDate(r?.work_date)===normDate(date))||null; }
  function positionOptions(selected){ return `<option value="">ว่าง</option>${positionMasters().map(m=>{const c=positionCode(m);return `<option value="${esc(c)}" ${String(selected||'')===c?'selected':''}>${esc(c)}</option>`;}).join('')}`; }
  function zoneBucket(row){
    const date=normDate(row?.work_date),code=String(row?.position_code||row?.code||'').trim().toUpperCase(),z=String(row?.zone||'').trim().toLowerCase();
    if(isOutingDateSafe(date)&&(z.includes('ออกหน่วย')||row?.is_outing===true))return'outing';
    if(code.startsWith('BB-'))return'bb';
    if(code.startsWith('DR-'))return'donor';
    if(z.includes('donor')||z.includes('บริจาค'))return'donor';
    return'bb';
  }
  function fiscalBounds(key){const y=Number(key.slice(0,4)),m=Number(key.slice(5,7)),sy=m>=10?y:y-1;return{cacheKey:String(sy),start:`${sy}-10-01`,end:`${sy+1}-09-30`,label:`ปีงบประมาณ ${sy+1+543}`};}
  async function loadFiscal(key){
    const b=fiscalBounds(key);if(fiscalCache.has(b.cacheKey))return fiscalCache.get(b.cacheKey);if(fiscalLoading.has(b.cacheKey))return fiscalLoading.get(b.cacheKey);
    const p=(async()=>{if(!DB())return[];const res=await DB().from('daily_positions').select('*').gte('work_date',b.start).lte('work_date',b.end).order('work_date');if(res.error){console.warn(VERSION,res.error);return[];}let rows=res.data||[];try{rows=window.cnmiV272?.operationalRows?.(rows)||rows;}catch(_){}fiscalCache.set(b.cacheKey,rows);return rows;})();
    fiscalLoading.set(b.cacheKey,p);try{return await p;}finally{fiscalLoading.delete(b.cacheKey);}
  }
  function scheduleFiscal(key){const b=fiscalBounds(key);if(fiscalCache.has(b.cacheKey)||fiscalLoading.has(b.cacheKey))return;loadFiscal(key).then(()=>{if(['positionMonth','positionMonthView'].includes(S()?.page))rerender(snapshot('.v275-position-wrap'));});}
  function positionSummary(person,monthRows,yearRows){
    const own=monthRows.filter(r=>normId(r.staff_id)===normId(person.id));const year=yearRows.filter(r=>normId(r.staff_id)===normId(person.id));
    const out={total:own.length,bb:0,donor:0,outing:0,yearTotal:year.length,pos:{}};own.forEach(r=>{out[zoneBucket(r)]++;const c=String(r.position_code||'-');out.pos[c]=(out.pos[c]||0)+1;});
    out.top=Object.entries(out.pos).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([c,n])=>`${c} ${n}`).join(' · ');return out;
  }
  function summaryHtml(person,monthRows,yearRows){const s=positionSummary(person,monthRows,yearRows);return `<button type="button" class="v275-summary-cell" data-v275-position-summary="${esc(person.id)}"><b>BB ${s.bb} · Donor ${s.donor}</b><span>ออกหน่วย ${s.outing} · ปีงบ ${s.yearTotal}</span><small>${esc(s.top||'ยังไม่มีตำแหน่ง')}</small></button>`;}

  /* ----- trainee/mentor ----- */
  function trainingRows(){return Array.isArray(S()?.trainingAssignmentsV271)?S().trainingAssignmentsV271:[];}
  function directoryRows(){return Array.isArray(S()?.traineeDirectoryV273)?S().traineeDirectoryV273:[];}
  function identityOf(row){return row?.trainee_staff_id?`staff:${normId(row.trainee_staff_id)}`:`name:${String(row?.trainee_name||'').trim().toLowerCase()}`;}
  function traineeLabel(row){return row?.trainee_staff_id?staffName(row.trainee_staff_id):(row?.trainee_name||'-');}
  function activeTraining(row,date){return row&&row.active!==false&&normDate(row.start_date)<=normDate(date)&&normDate(row.end_date)>=normDate(date);}
  function assignmentFor(identity,date){return trainingRows().find(r=>identityOf(r)===identity&&activeTraining(r,date))||null;}
  function traineeRowsForMonth(key){
    const first=`${key}-01`,last=monthDates(key).slice(-1)[0],map=new Map();
    const upsert=item=>{
      if(!item) return;
      const linked=item.staffId ? ((S()?.staff||[]).find(p=>normId(p?.id)===normId(item.staffId)) || findStaffByName(item.label)) : findStaffByName(item.label);
      if(linked?.id && !item.staffId) item.staffId=linked.id;
      if(linked){
        item.linkedStaffId=linked.id;
        item.label=item.label || staffName(linked);
      }
      const keyPart=item.staffId ? `staff:${normId(item.staffId)}` : `name:${normName(item.label)}`;
      if(!keyPart || keyPart==='name:') return;
      const existing=map.get(keyPart);
      if(existing){
        existing.row = existing.row || item.row;
        existing.staffId = existing.staffId || item.staffId || linked?.id || null;
        existing.linkedStaffId = existing.linkedStaffId || linked?.id || existing.staffId || null;
        existing.label = existing.label || item.label;
        if(existing.type !== 'new_staff' && item.type === 'new_staff') existing.type = item.type;
        return;
      }
      map.set(keyPart,{...item,identity:keyPart,staffId:item.staffId || linked?.id || null,linkedStaffId:linked?.id || item.staffId || null,label:item.label || staffName(linked) || '-'});
    };
    directoryRows().filter(r=>directoryRowAppliesToMonth(r,key)).forEach(r=>upsert({identity:identityOf(r),label:traineeLabel(r),type:r.trainee_type||'intern',staffId:r.trainee_staff_id||null,row:r}));
    trainingRows().filter(r=>r.active!==false&&normDate(r.start_date)<=last&&normDate(r.end_date)>=first).forEach(r=>upsert({identity:identityOf(r),label:traineeLabel(r),type:r.trainee_type||'intern',staffId:r.trainee_staff_id||null,row:r}));
    const all=allActiveStaff();
    return Array.from(map.values()).sort((a,b)=>{
      const aLinked=a.linkedStaffId ? all.findIndex(p=>normId(p.id)===normId(a.linkedStaffId)) : -1;
      const bLinked=b.linkedStaffId ? all.findIndex(p=>normId(p.id)===normId(b.linkedStaffId)) : -1;
      const ar=aLinked>=0 ? aLinked : 10000;
      const br=bLinked>=0 ? bLinked : 10000;
      return ar-br || String(a.label||'').localeCompare(String(b.label||''),'th');
    });
  }
  function mentorOptions(selected,excludeId){return `<option value="">เลือกพี่เลี้ยง</option>${normalPositionStaff().filter(p=>normId(p.id)!==normId(excludeId)).map(p=>`<option value="${esc(p.id)}" ${normId(selected)===normId(p.id)?'selected':''}>${esc(staffName(p))}</option>`).join('')}`;}
  function traineeSummary(item,key){const names=new Set();monthDates(key).forEach(d=>{const a=assignmentFor(item.identity,d);if(a?.mentor_staff_id)names.add(staffName(a.mentor_staff_id));});return `<div class="v275-trainee-summary"><b>${esc(item.type==='intern'?'Intern':'น้องใหม่')} · ไม่นับ Slot</b><span>${names.size?`พี่เลี้ยง: ${esc(Array.from(names).join(', '))}`:'ยังไม่กำหนดพี่เลี้ยง'}</span></div>`;}

  /* ----- slot settings ----- */
  function slotSetting(date){return(S()?.manualDaySlotSettingsV273||[]).find(r=>normDate(r?.work_date)===normDate(date))||null;}
  function actualPositionCount(rows,date){
    const allowed=new Set(normalPositionStaff(date.slice(0,7)).map(p=>normId(p.id)));
    return new Set(rows.filter(r=>normDate(r?.work_date)===normDate(date)&&r.staff_id&&allowed.has(normId(r.staff_id))&&r.position_code).map(r=>normId(r.staff_id))).size;
  }
  function ensureSlotLoad(key){
    if(slotLoading.has(key)||!window.cnmiV273?.loadSlotSettings)return;
    slotLoading.add(key);Promise.resolve(window.cnmiV273.loadSlotSettings(key)).then(()=>{if(['positionMonth','positionMonthView'].includes(S()?.page))rerender(snapshot('.v275-position-wrap'));}).catch(e=>console.warn(VERSION,e)).finally(()=>slotLoading.delete(key));
  }
  async function saveSlot(input){
    const date=normDate(input?.dataset?.date);if(!date||!DB())return;const raw=input.value,target=raw===''?null:Number(raw);input.dataset.state='saving';
    try{const payload={work_date:date,month_key:date.slice(0,7),target_slots:Number.isFinite(target)?target:null,updated_by:currentStaff(),updated_at:new Date().toISOString()};const res=await DB().from('manual_day_slot_settings').upsert(payload,{onConflict:'work_date'}).select('*').single();if(res.error)throw res.error;if(S())S().manualDaySlotSettingsV273=(S().manualDaySlotSettingsV273||[]).filter(x=>normDate(x.work_date)!==date).concat(res.data||payload);input.dataset.state='saved';setTimeout(()=>{input.dataset.state='';},900);}catch(e){input.dataset.state='error';toast(`บันทึกจำนวน Slot ไม่สำเร็จ: ${friendly(e)}`,'error');}
  }
  function queueSlot(input){const key=normDate(input?.dataset?.date);clearTimeout(slotTimers.get(key));slotTimers.set(key,setTimeout(()=>saveSlot(input),350));}

  /* ----- position cells/save ----- */
  function dateHead(date){return `<th class="v275-date-head ${isWeekendSafe(date)?'off':''} ${isHolidaySafe(date)?'holiday':''}"><b>${Number(date.slice(8))}</b><small>${esc(thaiDow(date))}</small>${isHolidaySafe(date)?`<em>${esc(holidayTitle(date))}</em>`:''}</th>`;}
  function countCell(date,rows,editable){
    if(isWeekendSafe(date)||isHolidaySafe(date))return `<td class="v275-meta-day off"><span>ไม่จัด</span></td>`;
    const actual=actualPositionCount(rows,date),target=slotSetting(date)?.target_slots;
    return editable?`<td class="v275-meta-day"><div class="v275-slot-control"><b>${actual}/</b><input type="number" min="0" max="30" value="${target??''}" data-v275-slot data-date="${esc(date)}" placeholder="-"><span>คน</span></div></td>`:`<td class="v275-meta-day"><b>${actual}/${target??'-'} คน</b></td>`;
  }
  function regularPositionCell(person,date,rows,editable){
    if(isWeekendSafe(date)||isHolidaySafe(date))return `<td class="v275-position-day off"></td>`;
    const leave=leaveOn(person.id,date,{hideNoDuty:true});
    const row=positionRow(rows,person.id,date),code=row?.position_code||'';
    const allowed=dailyPositionOn(person,date),life=lifecycleLabel(person,date);
    const leaveType=leave?leaveText(leave):'';
    const leaveClassName=leave?leaveClass(leave):'';
    const leaveAttrs=leave?` data-v291-leave-label="${esc(leaveType)}" title="${esc(`${leaveType} · Admin ยังเลือกตำแหน่งหรือเว้นว่างได้`)}"`:'';
    const cellClass=`v275-position-day${leave?` leave v291-leave-dropdown ${leaveClassName}`:''}${!allowed?' v462-lifecycle-off':''}`;
    if(!allowed&&!code)return `<td class="${esc(cellClass)}"><span class="v462-lifecycle-cell">${esc(life||'ไม่อยู่ในช่วงใช้งาน')}</span></td>`;
    if(!editable)return `<td class="${esc(cellClass)}" data-date="${esc(date)}" data-staff-id="${esc(person.id)}"${leaveAttrs}>${leave?leaveBadge(leave):''}${code?`<button type="button" class="v275-position-pill" data-v275-job="${esc(code)}">${esc(code)}</button>`:''}${!allowed&&code?`<small class="v462-preserved-note">เก็บจากตารางเดิม</small>`:''}</td>`;
    if(!allowed&&code)return `<td class="${esc(cellClass)}" data-date="${esc(date)}" data-staff-id="${esc(person.id)}"${leaveAttrs}>${leave?leaveBadge(leave):''}<button type="button" class="v275-position-pill" data-v275-job="${esc(code)}">${esc(code)}</button><small class="v462-preserved-note">เก็บจากตารางเดิม • ${esc(life||'นอกช่วงใช้งาน')}</small></td>`;
    return `<td class="${esc(cellClass)}"${leaveAttrs}><div class="v275-position-cell" data-v275-position-cell data-date="${esc(date)}" data-staff-id="${esc(person.id)}"><select data-v275-position-select aria-label="เลือกตำแหน่ง ${esc(staffName(person))} วันที่ ${esc(date)}${leave?` (${esc(leaveType)})`:''}">${positionOptions(code)}</select>${code?`<button type="button" class="v275-info" data-v275-job="${esc(code)}">i</button>`:''}<small data-v275-status></small></div></td>`;
  }
  function traineeCell(item,date,rows,editable){
    if(isWeekendSafe(date)||isHolidaySafe(date))return `<td class="v275-position-day off"></td>`;
    const leave=item.staffId?leaveOn(item.staffId,date,{hideNoDuty:true}):null;if(leave)return `<td class="v275-position-day leave">${leaveBadge(leave)}</td>`;
    const a=assignmentFor(item.identity,date),mentorId=a?.mentor_staff_id||'',mrow=mentorId?positionRow(rows,mentorId,date):null,mcode=mrow?.position_code||'',bad=mentorId&&(leaveOn(mentorId,date,{hideNoDuty:true})||!mrow);
    if(!editable){return `<td class="v275-position-day trainee ${bad?'bad':''}" data-date="${esc(date)}">${mentorId?`<b>${bad?'กรุณาเลือกพี่เลี้ยงแทน':`ติดตาม ${esc(staffName(mentorId))}`}</b>${mcode?`<button type="button" class="v275-position-pill" data-v275-job="${esc(mcode)}">${esc(mcode)}</button>`:''}`:'<span class="muted">ยังไม่กำหนดพี่เลี้ยง</span>'}<small>ไม่นับ Slot</small></td>`;}
    return `<td class="v275-position-day trainee ${bad?'bad':''}"><div class="v275-mentor-cell" data-v275-mentor-cell data-date="${esc(date)}" data-identity="${esc(item.identity)}" data-type="${esc(item.type)}" data-label="${esc(item.label)}" data-trainee-staff-id="${esc(item.staffId||'')}"><select data-v275-mentor-select>${mentorOptions(mentorId,item.staffId)}</select><span>${bad?'กรุณาเลือกพี่เลี้ยงแทน':(mcode||'เลือกพี่เลี้ยงแทนตำแหน่ง')}</span><small>ไม่นับ Slot</small><small data-v275-status></small></div></td>`;
  }
  function positionMatrix(key,rows,editable){
    const dates=monthDates(key),regular=normalPositionStaff(key),trainees=traineeRowsForMonth(key),b=fiscalBounds(key),yearRows=fiscalCache.get(b.cacheKey)||(S()?.positions||[]).filter(r=>normDate(r?.work_date)>=b.start&&normDate(r?.work_date)<=b.end);
    const staffOrder=new Map(allActiveStaff().map((p,index)=>[normId(p.id),index]));
    const displayRows=[
      ...regular.map((person,index)=>({kind:'regular',person,rank:staffOrder.get(normId(person.id))??(5000+index),label:staffName(person)})),
      ...trainees.map((item,index)=>{const linkedId=item.linkedStaffId||item.staffId||'';return {kind:'trainee',item,rank:linkedId?(staffOrder.get(normId(linkedId))??(6000+index)):(10000+index),label:item.label||''};})
    ].sort((a,b)=>a.rank-b.rank||String(a.label).localeCompare(String(b.label),'th'));
    const bodyHtml=displayRows.map(entry=>{
      if(entry.kind==='regular'){
        const p=entry.person;
        return `<tr><th class="v275-sticky-name" style="--staff-bg:${esc(staffColorSafe(p))};--staff-fg:${esc(textColorSafe(staffColorSafe(p)))}"><b>${esc(staffName(p))}</b></th><td class="v275-sticky-summary">${summaryHtml(p,rows,yearRows)}</td>${dates.map(d=>regularPositionCell(p,d,rows,editable)).join('')}</tr>`;
      }
      const item=entry.item;
      const linked=item.staffId?(S()?.staff||[]).find(p=>normId(p?.id)===normId(item.staffId)):null;
      const color=linked?staffColorSafe(linked):'';
      const style=linked?` style="--staff-bg:${esc(color)};--staff-fg:${esc(textColorSafe(color))}"`:'';
      return `<tr class="v275-trainee-row"><th class="v275-sticky-name trainee-name"${style}><b>${esc(item.label)}</b><small>${esc(item.type==='intern'?'Intern':'น้องใหม่')}</small></th><td class="v275-sticky-summary">${traineeSummary(item,key)}</td>${dates.map(d=>traineeCell(item,d,rows,editable)).join('')}</tr>`;
    }).join('');
    return `<div class="v275-position-wrap"><table class="v275-position-table"><thead><tr><th class="v275-sticky-name">เจ้าหน้าที่</th><th class="v275-sticky-summary">สรุปตำแหน่ง</th>${dates.map(dateHead).join('')}</tr></thead><tbody><tr class="v275-count-row"><th class="v275-sticky-name">จำนวนคน</th><td class="v275-sticky-summary"><b>คน/Slot</b><small>${editable?'กรอกเป้าหมายเอง':'จำนวนจริง/เป้าหมาย'}</small></td>${dates.map(d=>countCell(d,rows,editable)).join('')}</tr>${bodyHtml}</tbody></table></div>`;
  }
  function positionStatsForAdmin(key,rows){
    const b=fiscalBounds(key),yearRows=fiscalCache.get(b.cacheKey)||(S()?.positions||[]).filter(r=>normDate(r?.work_date)>=b.start&&normDate(r?.work_date)<=b.end),data=normalPositionStaff(key).map(p=>({p,...positionSummary(p,rows,yearRows)}));
    return `<div class="card v275-admin-position-stats"><div class="section-title"><div><h3>สถิติตำแหน่งสำหรับ Admin</h3><p class="hint">Staff จะดูสรุปจากคอลัมน์ที่ 2 จึงไม่แสดงตารางนี้ในหน้า Staff</p></div></div><div class="table-wrap"><table><thead><tr><th>เจ้าหน้าที่</th><th>เดือนนี้</th><th>BB</th><th>Donor</th><th>ออกหน่วย</th><th>ตำแหน่งที่ทำ</th><th>สะสมปีงบ</th></tr></thead><tbody>${data.map(r=>`<tr><td><b>${esc(staffName(r.p))}</b></td><td>${r.total}</td><td>${r.bb}</td><td>${r.donor}</td><td>${r.outing}</td><td>${esc(r.top||'-')}</td><td>${r.yearTotal}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function schedulePositionLoads(key){ensureSlotLoad(key);scheduleFiscal(key);if(!S()?.traineeDirectoryLoadedV273&&DB()){DB().from('manual_trainee_directory').select('*').order('created_at',{ascending:false}).then(res=>{if(!res.error&&S()){S().traineeDirectoryV273=res.data||[];S().traineeDirectoryLoadedV273=true;if(['positionMonth','positionMonthView'].includes(S()?.page))rerender(snapshot('.v275-position-wrap'));}});}if(!S()?.trainingAssignmentsLoadedAtV271)window.cnmiV271?.loadTrainingAssignments?.({force:true}).then(()=>{if(['positionMonth','positionMonthView'].includes(S()?.page))rerender(snapshot('.v275-position-wrap'));});}
  function renderAdminPosition(){
    if(!isAdminSafe()){try{return noPermission();}catch(_){return'<div class="card">ไม่มีสิทธิ์</div>';}}
    const key=S()?.positionMonthKey||S()?.monthKey||new Date().toISOString().slice(0,7);schedulePositionLoads(key);const rows=positionRows(key);
    return `<div class="v275-page"><div class="card"><div class="section-title"><div><h2>จัดตารางตำแหน่งกลางวัน รายเดือน</h2><p class="hint">Admin กำหนดจำนวนคนเองในแถว คน/Slot และเลือกพี่เลี้ยงของน้องใหม่/Intern ในช่องวันที่แทนตำแหน่งงาน</p></div><span class="badge green">Manual</span></div><div class="toolbar"><label>เดือน <input type="month" id="positionMonthInput" value="${esc(key)}"></label><button class="ghost-btn" type="button" data-v275-refresh-position>รีเฟรชข้อมูลล่าสุด</button><button class="ghost-btn danger" type="button" data-clear-month-positions>ล้างข้อมูลเดือนนี้</button></div></div>${positionMatrix(key,rows,true)}${positionStatsForAdmin(key,rows)}</div>`;
  }
  function renderStaffPosition(){
    const key=S()?.positionMonthViewKey||S()?.monthKey||new Date().toISOString().slice(0,7);schedulePositionLoads(key);const rows=positionRows(key);
    return `<div class="v275-page"><div class="card"><div class="section-title"><div><h2>ตารางตำแหน่งกลางวัน รายเดือน</h2><p class="hint">เลื่อนแนวนอนได้โดยคอลัมน์เจ้าหน้าที่และสรุปตำแหน่งจะคงอยู่</p></div><span class="badge blue">อ่านอย่างเดียว</span></div><div class="toolbar"><label>เดือน <input type="month" id="positionMonthViewInput" value="${esc(key)}"></label></div></div>${positionMatrix(key,rows,false)}</div>`;
  }
  async function savePosition(cell,code){
    const date=normDate(cell?.dataset?.date),staffId=normId(cell?.dataset?.staffId),status=cell?.querySelector('[data-v275-status]');if(!date||!staffId||!DB())return;if(status)status.textContent='กำลังบันทึก…';
    try{const d1=await DB().from('daily_positions').delete().eq('work_date',date).eq('staff_id',staffId);if(d1.error)throw d1.error;if(code){const d2=await DB().from('daily_positions').delete().eq('work_date',date).eq('position_code',code);if(d2.error)throw d2.error;}let saved=null;if(code){const m=positionByCode(code,date)||{},payload={work_date:date,position_code:code,zone:m.zone||'',break_time:m.break_time||'-',main_rule:m.main_rule||'',job_desc:m.job_desc||'',staff_id:staffId,updated_by:currentStaff()};const ins=await DB().from('daily_positions').insert(payload).select('*').single();if(ins.error)throw ins.error;saved=ins.data;}await DB().from('daily_position_day_status').upsert({work_date:date,month_key:date.slice(0,7),status:'draft',updated_by:currentStaff()},{onConflict:'work_date'});if(S()){S().positions=(S().positions||[]).filter(r=>!(normDate(r.work_date)===date&&(normId(r.staff_id)===staffId||(code&&String(r.position_code||'')===code))));if(saved)S().positions.push(saved);}fiscalCache.delete(fiscalBounds(date.slice(0,7)).cacheKey);if(status)status.textContent='บันทึกแล้ว';rerender(snapshot('.v275-position-wrap'));}catch(e){if(status)status.textContent='บันทึกไม่สำเร็จ';toast(friendly(e),'error');}
  }
  function queuePosition(cell,code){const k=`${cell?.dataset?.staffId}|${cell?.dataset?.date}`;clearTimeout(positionTimers.get(k));positionTimers.set(k,setTimeout(()=>savePosition(cell,code),220));}
  async function saveMentor(cell,mentorId){
    const date=normDate(cell?.dataset?.date),identity=String(cell?.dataset?.identity||''),type=String(cell?.dataset?.type||'intern'),label=String(cell?.dataset?.label||''),traineeStaffId=String(cell?.dataset?.traineeStaffId||''),status=cell?.querySelector('[data-v275-status]');if(!date||!identity||!window.cnmiV272?.replaceRange){if(status)status.textContent='ไม่พบระบบพี่เลี้ยง';return;}if(status)status.textContent='กำลังบันทึก…';
    try{const args={traineeType:type,startDate:date,endDate:date,mentorStaffId:mentorId||null,note:'กำหนดจากตารางตำแหน่งกลางวัน V275'};if(identity.startsWith('staff:'))args.traineeStaffId=traineeStaffId||identity.slice(6);else args.traineeName=label;await window.cnmiV272.replaceRange(args);await window.cnmiV271?.loadTrainingAssignments?.({force:true});if(status)status.textContent='บันทึกแล้ว';rerender(snapshot('.v275-position-wrap'));}catch(e){if(status)status.textContent='บันทึกไม่สำเร็จ';toast(friendly(e),'error');}
  }
  function queueMentor(cell,id){const k=`${cell?.dataset?.identity}|${cell?.dataset?.date}`;clearTimeout(mentorTimers.get(k));mentorTimers.set(k,setTimeout(()=>saveMentor(cell,id),220));}

  /* ----- roster ----- */
  let rosterPendingWrites=0;
  let rosterLastWriteError='';
  async function waitForRosterWrites(){
    for(let i=0;i<120 && rosterPendingWrites>0;i++)await new Promise(resolve=>setTimeout(resolve,100));
    if(rosterPendingWrites)throw new Error('ยังบันทึกการแก้เวรไม่เสร็จ กรุณารอแล้วประกาศใหม่');
    if(rosterLastWriteError)throw new Error('มีเวรบันทึกไม่สำเร็จ: '+rosterLastWriteError);
  }
  function rosterRows(key){try{return getAssignmentsForMonth(key)||[];}catch(_){return(S()?.rosterAssignments||[]).filter(r=>normDate(r?.duty_date).startsWith(key));}}
  function rowsForPersonDate(rows,staffId,date){return rows.filter(r=>normId(r?.staff_id)===normId(staffId)&&normDate(r?.duty_date)===normDate(date)).sort((a,b)=>String(a.duty_code||'').localeCompare(String(b.duty_code||''),'th'));}
  function dutyLabel(code){return DUTIES.find(d=>d.code===code)?.label||String(code||'');}
  function rosterDateHead(date){return `<th class="v275-roster-date ${isWeekendSafe(date)?'off':''} ${isHolidaySafe(date)?'holiday':''}"><b>${Number(date.slice(8))}</b><small>${esc(thaiDow(date))}</small>${isHolidaySafe(date)?`<em>${esc(holidayTitle(date))}</em>`:''}</th>`;}
  function rosterCell(person,date,rows){
    const own=rowsForPersonDate(rows,person.id,date),leave=leaveOn(person.id,date,{hideNoDuty:false}),bg=staffColorSafe(person),fg=textColorSafe(bg),allowed=employmentOn(person,date),life=lifecycleLabel(person,date);
    if(!allowed&&!own.length)return `<td class="v275-roster-day v462-lifecycle-off"><div class="v462-lifecycle-cell">${esc(life||'ไม่อยู่ในช่วงใช้งาน')}</div></td>`;
    return `<td class="v275-roster-day${!allowed?' v462-lifecycle-off':''}"><div class="v275-roster-drop" ${allowed?'data-v275-roster-cell':''} data-date="${esc(date)}" data-staff-id="${esc(person.id)}" tabindex="0">${leaveBadge(leave)}<div class="v275-duty-list">${own.map(r=>`<span class="v275-duty-pill" draggable="${allowed?'true':'false'}" ${allowed?'data-v275-existing-duty="'+esc(r.duty_code)+'"':''} style="--duty-bg:${esc(bg)};--duty-fg:${esc(fg)}"><b>${esc(dutyLabel(r.duty_code))}</b>${allowed?`<button type="button" data-v275-remove-duty="${esc(r.duty_code)}" aria-label="ลบ">×</button>`:''}</span>`).join('')}</div>${!allowed&&own.length?`<small class="v462-preserved-note">เก็บจากตารางเดิม • ${esc(life||'นอกช่วงใช้งาน')}</small>`:''}</div></td>`;
  }
  function rosterMatrix(key,rows){
    const dates=monthDates(key),people=rosterEnabledStaff(key);
    return `<div class="v275-roster-wrap"><table class="v275-roster-table"><thead><tr><th class="v275-roster-name">เจ้าหน้าที่</th>${dates.map(rosterDateHead).join('')}</tr></thead><tbody>${people.map(p=>`<tr><th class="v275-roster-name" style="--staff-bg:${esc(staffColorSafe(p))};--staff-fg:${esc(textColorSafe(staffColorSafe(p)))}"><b>${esc(staffName(p))}</b></th>${dates.map(d=>rosterCell(p,d,rows)).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function fallbackBalance(key,rows){
    const people=rosterEnabledStaff(key),data=people.map(p=>{const own=rows.filter(r=>normId(r.staff_id)===normId(p.id)),count=c=>own.filter(r=>r.duty_code===c).length;return{p,total:own.length,c1:count('ชบด1'),c2:count('ชบด2'),c3:count('ชบด3'),a:count('ช3A'),b:count('ช3B'),c4:own.filter(r=>String(r.duty_code||'').startsWith('ช4')).length,c9:own.filter(r=>String(r.duty_code||'').startsWith('ช9')).length};});
    return `<div class="card"><h3>สถิติสรุปรายเดือน</h3><div class="table-wrap"><table><thead><tr><th>เจ้าหน้าที่</th><th>เวรรวม</th><th>ชบด1</th><th>ชบด2</th><th>ชบด3</th><th>ช3A</th><th>ช3B</th><th>ช4</th><th>ช9</th></tr></thead><tbody>${data.map(r=>`<tr><td><b>${esc(staffName(r.p))}</b></td><td>${r.total}</td><td>${r.c1}</td><td>${r.c2}</td><td>${r.c3}</td><td>${r.a}</td><td>${r.b}</td><td>${r.c4}</td><td>${r.c9}</td></tr>`).join('')}</tbody></table></div></div>`;
  }
  function balanceSummary(key,rows){try{if(typeof renderBalanceDashboard==='function')return `<div class="card v275-balance-card"><div class="section-title"><h3>สถิติสรุปรายเดือน</h3><span class="badge blue">รูปแบบเดียวกับสรุปสมดุลเวร</span></div>${renderBalanceDashboard(rosterEnabledStaff(key),rows,key)}</div>`;}catch(e){console.warn(VERSION,e);}return fallbackBalance(key,rows);}
  function holidayRuleSuffix(title){const raw=String(title||''),at=raw.indexOf(':::');return at>=0?raw.slice(at):'';}
  function holidayPanel(key){
    const list=(S()?.holidays||[]).filter(h=>String(h?.holiday_date||'').startsWith(key)).sort((a,b)=>String(a.holiday_date).localeCompare(String(b.holiday_date))),last=monthDates(key).slice(-1)[0];
    return `<details class="v275-holiday-panel"><summary>เพิ่ม/แก้ไขวันหยุดราชการของเดือนนี้</summary><form id="v275HolidayForm"><label>วันที่<input type="date" name="holiday_date" min="${esc(key+'-01')}" max="${esc(last)}" value="${esc(key+'-01')}" required></label><label>ชื่อวันหยุด<input name="title" placeholder="เช่น วันหยุดราชการ" required></label><button class="soft-btn" type="submit">บันทึกวันหยุด</button><button class="ghost-btn" type="button" data-page="holidayRulesV107">ตั้งค่ากฎเวรนักขัตแบบละเอียด</button></form><div class="v275-holiday-list">${list.length?list.map(h=>`<span><b>${esc(normDate(h.holiday_date).slice(8))}</b> ${esc(String(h.title||h.name||h.holiday_name||'วันหยุดราชการ').split(':::')[0].trim())}<button type="button" data-v275-delete-holiday="${esc(normDate(h.holiday_date))}">×</button></span>`).join(''):'<small class="muted">ยังไม่มีวันหยุดในเดือนนี้</small>'}</div></details>`;
  }
  function renderScheduler(){
    if(!isAdminSafe()){try{return noPermission();}catch(_){return'<div class="card">ไม่มีสิทธิ์</div>';}}
    const key=S()?.monthKey||new Date().toISOString().slice(0,7),rows=rosterRows(key);
    return `<div class="v275-page"><div class="card"><div class="section-title"><div><h2>จัดตารางเวรประจำเดือน</h2><p class="hint">ช่องตารางเป็นพื้นที่ว่าง ไม่มี Dropdown: ลากเวรลงช่อง หรือแตะเวรด้านบนแล้วแตะช่องบนมือถือ</p></div><span class="badge green">Manual 100%</span></div><div class="toolbar"><label>เดือน <input type="month" id="rosterMonthInput" value="${esc(key)}"></label><button class="primary-btn" type="button" data-v275-save-roster>บันทึก</button><button class="soft-btn" type="button" data-v275-publish-roster>บันทึกและประกาศ</button><button class="ghost-btn danger" type="button" data-clear-roster-month>ล้างข้อมูลเดือนนี้</button></div><div class="v275-duty-pool"><b>ลาก/แตะเวร</b>${DUTIES.map(d=>`<button type="button" draggable="true" data-v275-duty="${esc(d.code)}" class="${selectedDutyCode===d.code?'selected':''}">${esc(d.label)}</button>`).join('')}<span class="v275-selected-duty">${selectedDutyCode?`เลือกอยู่: ${esc(dutyLabel(selectedDutyCode))}`:'ยังไม่ได้เลือกเวร'}</span></div>${holidayPanel(key)}</div>${rosterMatrix(key,rows)}${balanceSummary(key,rows)}</div>`;
  }
  async function ensureRosterMonth(key){
    const y=Number(key.slice(0,4)),m=Number(key.slice(5,7));let month=(S()?.rosterMonths||[]).find(x=>Number(x.year)===y&&Number(x.month)===m);
    if(!month){const r=await DB().from('roster_months').select('*').eq('year',y).eq('month',m).maybeSingle();if(r.error)throw r.error;month=r.data;}
    if(!month){const ins=await DB().from('roster_months').insert({year:y,month:m,status:'draft',created_by:currentStaff(),updated_by:currentStaff()}).select('*').single();if(ins.error)throw ins.error;month=ins.data;if(S())S().rosterMonths=[...(S().rosterMonths||[]),month];}return month;
  }
  async function addDuty(cell,code){
    const date=normDate(cell?.dataset?.date),staffId=normId(cell?.dataset?.staffId);if(!date||!staffId||!code||!DB())return;const snap=snapshot('.v275-roster-wrap');rosterLastWriteError='';rosterPendingWrites++;
    try{const month=await ensureRosterMonth(date.slice(0,7));const del=await DB().from('roster_assignments').delete().eq('roster_month_id',month.id).eq('duty_date',date).eq('duty_code',code);if(del.error)throw del.error;const payload={roster_month_id:month.id,duty_date:date,duty_code:code,required_role:'',staff_id:staffId,is_locked:false,updated_by:currentStaff()};const up=await DB().from('roster_assignments').upsert(payload,{onConflict:'roster_month_id,duty_date,duty_code'}).select('*').single();if(up.error)throw up.error;if(S()){S().rosterAssignments=(S().rosterAssignments||[]).filter(r=>!(normDate(r.duty_date)===date&&r.duty_code===code));S().rosterAssignments.push(up.data);if(S().rosterDraft?.monthKey===date.slice(0,7)){S().rosterDraft.assignments=(S().rosterDraft.assignments||[]).filter(r=>!(normDate(r.duty_date)===date&&r.duty_code===code));S().rosterDraft.assignments.push(up.data);}}rerender(snap);}catch(e){rosterLastWriteError=friendly(e);toast(`บันทึกเวรไม่สำเร็จ: ${friendly(e)}`,'error');}finally{rosterPendingWrites--; }
  }
  async function removeDuty(cell,code){
    const date=normDate(cell?.dataset?.date),staffId=normId(cell?.dataset?.staffId);if(!date||!staffId||!code||!DB())return;const snap=snapshot('.v275-roster-wrap');rosterLastWriteError='';rosterPendingWrites++;
    try{const month=await ensureRosterMonth(date.slice(0,7));const del=await DB().from('roster_assignments').delete().eq('roster_month_id',month.id).eq('duty_date',date).eq('duty_code',code).eq('staff_id',staffId);if(del.error)throw del.error;if(S()){S().rosterAssignments=(S().rosterAssignments||[]).filter(r=>!(normDate(r.duty_date)===date&&r.duty_code===code&&normId(r.staff_id)===staffId));if(S().rosterDraft?.monthKey===date.slice(0,7))S().rosterDraft.assignments=(S().rosterDraft.assignments||[]).filter(r=>!(normDate(r.duty_date)===date&&r.duty_code===code&&normId(r.staff_id)===staffId));}rerender(snap);}catch(e){rosterLastWriteError=friendly(e);toast(`ลบเวรไม่สำเร็จ: ${friendly(e)}`,'error');}finally{rosterPendingWrites--; }
  }
  let rosterPublishing=false;
  async function updateRosterStatus(status){
    if(rosterPublishing)return;
    rosterPublishing=true;
    let statusCommitted=false;
    try{
      const key=S()?.monthKey||new Date().toISOString().slice(0,7);
      await waitForRosterWrites();
      const month=await ensureRosterMonth(key);
      const res=await DB().from('roster_months').update({status,updated_by:currentStaff()}).eq('id',month.id).select('*').single();
      if(res.error)throw res.error;
      statusCommitted=true;
      if(S())S().rosterMonths=(S().rosterMonths||[]).filter(r=>r.id!==month.id).concat(res.data||{...month,status});
      if(status==='published'){
        await v651PublishCurrentPlan(key);
        toast('บันทึกและประกาศฉบับล่าสุดแล้ว • ยอดตามหัวหน้าและยอดสะสมอัปเดตแล้ว');
      }else toast('บันทึกตารางแล้ว • ไม่เปลี่ยนยอดตามประกาศ');
      try{window.renderPage?.();}catch(_){}
    }catch(e){
      toast((statusCommitted&&status==='published'?'ตารางประกาศแล้ว แต่ยอดตามแผนยังไม่อัปเดต: ':'บันทึกไม่สำเร็จ: ')+friendly(e),'error');
    }finally{rosterPublishing=false;}
  }
  async function saveHoliday(form){
    if(!isAdminSafe()||!DB())return;const fd=new FormData(form),date=String(fd.get('holiday_date')||''),title=String(fd.get('title')||'').trim();if(!date||!title)return toast('กรุณาเลือกวันที่และกรอกชื่อวันหยุด','error');
    try{const old=(S()?.holidays||[]).find(h=>normDate(h.holiday_date)===date),payload={holiday_date:date,title:`${title}${holidayRuleSuffix(old?.title||'')}`,updated_by:currentStaff()},res=await DB().from('public_holidays').upsert(payload,{onConflict:'holiday_date'}).select('*').maybeSingle();if(res.error)throw res.error;if(S()){S().holidays=(S().holidays||[]).filter(h=>normDate(h.holiday_date)!==date).concat(res.data||payload);S().rosterDraft=null;}toast('บันทึกวันหยุดราชการแล้ว');rerender(snapshot('.v275-roster-wrap'));}catch(e){toast(friendly(e),'error');}
  }
  async function deleteHoliday(date){if(!isAdminSafe()||!DB())return;const res=await DB().from('public_holidays').delete().eq('holiday_date',date);if(res.error)return toast(friendly(res.error),'error');if(S()){S().holidays=(S().holidays||[]).filter(h=>normDate(h.holiday_date)!==date);S().rosterDraft=null;}rerender(snapshot('.v275-roster-wrap'));}

  /* ----- direct page override ----- */
  function targetHtml(){const page=S()?.page;if(page==='scheduler')return renderScheduler();if(page==='positionMonth')return renderAdminPosition();if(page==='positionMonthView')return renderStaffPosition();return null;}
  assignGlobal('renderSchedulerPage',renderScheduler);
  assignGlobal('renderPositionMonthPage',renderAdminPosition);
  assignGlobal('renderPositionMonthViewPage',renderStaffPosition);
  const previousRender=window.renderPage||(typeof renderPage==='function'?renderPage:null);
  if(previousRender){
    const wrapped=function renderPageV275(){
      if(forcingRender)return previousRender.apply(this,arguments);
      forcingRender=true;let ret;
      try{ret=previousRender.apply(this,arguments);}catch(e){console.warn(`${VERSION}: previous render`,e);}finally{forcingRender=false;}
      const html=targetHtml();if(html!=null){const root=document.getElementById('pageContent');if(root)root.innerHTML=html;}
      return ret;
    };
    wrapped.__v275=true;assignGlobal('renderPage',wrapped);
  }

  /* ----- UI events ----- */
  document.addEventListener('dragstart',e=>{
    const duty=e.target?.closest?.('[data-v275-duty],[data-v275-existing-duty]');if(duty){const code=duty.dataset.v275Duty||duty.dataset.v275ExistingDuty||'';e.dataTransfer?.setData('v275Duty',code);if(e.dataTransfer)e.dataTransfer.effectAllowed='copy';e.stopImmediatePropagation();return;}
    const pos=e.target?.closest?.('[data-v275-drag-position]');if(pos){e.dataTransfer?.setData('v275Position',pos.dataset.v275DragPosition||'');if(e.dataTransfer)e.dataTransfer.effectAllowed='copy';e.stopImmediatePropagation();}
  },true);
  document.addEventListener('dragover',e=>{const cell=e.target?.closest?.('[data-v275-roster-cell],[data-v275-position-cell]');if(!cell)return;e.preventDefault();cell.classList.add('drag-over');e.stopImmediatePropagation();},true);
  document.addEventListener('dragleave',e=>{const cell=e.target?.closest?.('[data-v275-roster-cell],[data-v275-position-cell]');cell?.classList.remove('drag-over');},true);
  document.addEventListener('drop',e=>{
    const roster=e.target?.closest?.('[data-v275-roster-cell]');if(roster){e.preventDefault();e.stopImmediatePropagation();roster.classList.remove('drag-over');const code=e.dataTransfer?.getData('v275Duty');if(code)addDuty(roster,code);return;}
    const pos=e.target?.closest?.('[data-v275-position-cell]');if(pos){e.preventDefault();e.stopImmediatePropagation();pos.classList.remove('drag-over');const code=e.dataTransfer?.getData('v275Position');if(code){const sel=pos.querySelector('[data-v275-position-select]');if(sel)sel.value=code;queuePosition(pos,code);}}
  },true);
  document.addEventListener('change',e=>{
    const pos=e.target?.closest?.('[data-v275-position-select]');if(pos){e.stopImmediatePropagation();queuePosition(pos.closest('[data-v275-position-cell]'),pos.value);return;}
    const mentor=e.target?.closest?.('[data-v275-mentor-select]');if(mentor){e.stopImmediatePropagation();queueMentor(mentor.closest('[data-v275-mentor-cell]'),mentor.value);return;}
    const slot=e.target?.closest?.('[data-v275-slot]');if(slot){e.stopImmediatePropagation();queueSlot(slot);}
  },true);
  document.addEventListener('input',e=>{const slot=e.target?.closest?.('[data-v275-slot]');if(slot)queueSlot(slot);},true);
  document.addEventListener('submit',e=>{if(e.target?.id==='v275HolidayForm'){e.preventDefault();e.stopImmediatePropagation();saveHoliday(e.target);}},true);
  document.addEventListener('click',e=>{
    const duty=e.target?.closest?.('[data-v275-duty]');if(duty){e.preventDefault();e.stopImmediatePropagation();selectedDutyCode=selectedDutyCode===duty.dataset.v275Duty?'':duty.dataset.v275Duty;rerender(snapshot('.v275-roster-wrap'));return;}
    const remove=e.target?.closest?.('[data-v275-remove-duty]');if(remove){e.preventDefault();e.stopImmediatePropagation();removeDuty(remove.closest('[data-v275-roster-cell]'),remove.dataset.v275RemoveDuty);return;}
    const roster=e.target?.closest?.('[data-v275-roster-cell]');if(roster&&selectedDutyCode&&!e.target.closest('button')){e.preventDefault();e.stopImmediatePropagation();addDuty(roster,selectedDutyCode);return;}
    const job=e.target?.closest?.('[data-v275-job]');if(job){e.preventDefault();e.stopImmediatePropagation();const m=positionByCode(job.dataset.v275Job)||{};try{showModal(`<h2>${esc(job.dataset.v275Job)}</h2><p><b>โซน:</b> ${esc(m.zone||'-')}<br><b>เวลาพัก:</b> ${esc(m.break_time||'-')}</p><h3>หน้าที่งาน</h3><p style="white-space:pre-wrap">${esc(m.job_desc||'ยังไม่ได้ระบุรายละเอียดหน้าที่')}</p>`);}catch(_){}return;}
    const summary=e.target?.closest?.('[data-v275-position-summary]');if(summary){e.preventDefault();e.stopImmediatePropagation();const p=(S()?.staff||[]).find(x=>normId(x.id)===normId(summary.dataset.v275PositionSummary)),key=S()?.positionMonthKey||S()?.positionMonthViewKey||S()?.monthKey;if(!p)return;const rows=positionRows(key),b=fiscalBounds(key),year=fiscalCache.get(b.cacheKey)||(S()?.positions||[]).filter(r=>normDate(r?.work_date)>=b.start&&normDate(r?.work_date)<=b.end),s=positionSummary(p,rows,year);try{showModal(`<h2>สรุปตำแหน่งของ ${esc(staffName(p))}</h2><p><b>เดือนนี้:</b> ${s.total} วัน · BB ${s.bb} · Donor ${s.donor} · ออกหน่วย ${s.outing}</p><p><b>สะสมปีงบ:</b> ${s.yearTotal}</p><p>${esc(s.top||'ยังไม่มีตำแหน่ง')}</p>`);}catch(_){}return;}
    if(e.target?.closest?.('[data-v275-save-roster]')){e.preventDefault();e.stopImmediatePropagation();updateRosterStatus('draft');return;}
    if(e.target?.closest?.('[data-v275-publish-roster]')){e.preventDefault();e.stopImmediatePropagation();updateRosterStatus('published');return;}
    const delHoliday=e.target?.closest?.('[data-v275-delete-holiday]');if(delHoliday){e.preventDefault();e.stopImmediatePropagation();deleteHoliday(delHoliday.dataset.v275DeleteHoliday);return;}
    if(e.target?.closest?.('[data-v275-refresh-position]')){e.preventDefault();e.stopImmediatePropagation();Promise.allSettled([typeof loadAllData==='function'?loadAllData():null,window.cnmiV273?.loadSlotSettings?.(S()?.positionMonthKey||S()?.monthKey,true),window.cnmiV271?.loadTrainingAssignments?.({force:true}),loadFiscal(S()?.positionMonthKey||S()?.monthKey)]).then(()=>rerender(snapshot('.v275-position-wrap')));}
  },true);

  const style=document.createElement('style');
  style.id='v275-admin-manual-ui-style';
  style.textContent=`
  .v275-page{display:flex;flex-direction:column;gap:12px}.v275-position-wrap,.v275-roster-wrap{overflow:auto;max-height:72vh;border:1px solid #dbe3ef;border-radius:14px;background:#fff;overscroll-behavior:contain}.v275-position-table,.v275-roster-table{border-collapse:separate;border-spacing:0;min-width:max-content;width:100%;font-size:10px}.v275-position-table th,.v275-position-table td,.v275-roster-table th,.v275-roster-table td{border-right:1px solid #e5eaf1;border-bottom:1px solid #e5eaf1;background:#fff;padding:3px;min-width:82px;vertical-align:middle}.v275-position-table thead th,.v275-roster-table thead th{position:sticky;top:0;z-index:7;background:#f8fafc;text-align:center}.v275-date-head b,.v275-roster-date b{font-size:11px}.v275-date-head small,.v275-roster-date small{display:block;color:#64748b;font-size:8px}.v275-date-head em,.v275-roster-date em{display:block;max-width:78px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#be123c;font-style:normal;font-size:7px}.v275-date-head.off,.v275-date-head.holiday,.v275-roster-date.off,.v275-roster-date.holiday{background:#e9eef5!important}
  .v275-sticky-name,.v275-roster-name{position:sticky!important;left:0;z-index:10!important;min-width:92px!important;max-width:108px!important;background:var(--staff-bg,#f8fafc)!important;color:var(--staff-fg,#0f172a)!important;text-align:left}.v275-position-table thead .v275-sticky-name,.v275-roster-table thead .v275-roster-name{z-index:13!important;background:#f8fafc!important;color:#0f172a!important}.v275-sticky-name b,.v275-roster-name b{display:block;font-size:10px;padding:2px}.v275-sticky-name small{display:block;font-size:8px}.v275-sticky-summary{position:sticky!important;left:98px;z-index:9!important;min-width:165px!important;max-width:190px!important;background:#fff!important;box-shadow:2px 0 4px rgba(15,23,42,.08);text-align:left}.v275-position-table thead .v275-sticky-summary{z-index:12!important;background:#f8fafc!important}.v275-summary-cell{border:0;background:transparent;display:flex;flex-direction:column;gap:1px;width:100%;text-align:left;cursor:pointer}.v275-summary-cell b{font-size:9px}.v275-summary-cell span,.v275-summary-cell small{font-size:7.5px;color:#64748b}.v275-trainee-summary{display:flex;flex-direction:column;font-size:8px;color:#9a3412}.v275-trainee-row .trainee-name{background:#fff7ed!important;color:#9a3412!important}
  .v275-count-row th,.v275-count-row td{background:#fffaf0!important;height:34px}.v275-count-row .v275-sticky-name,.v275-count-row .v275-sticky-summary{z-index:11!important}.v275-sticky-summary small{display:block;color:#64748b;font-size:8px}.v275-meta-day{text-align:center}.v275-meta-day.off{background:#e9eef5!important;color:#64748b}.v275-slot-control{display:flex;align-items:center;justify-content:center;gap:2px}.v275-slot-control input{width:38px;height:24px;padding:1px 3px;border:1px solid #cbd5e1;border-radius:6px;font-size:10px}.v275-slot-control input[data-state=saving]{border-color:#2563eb}.v275-slot-control input[data-state=saved]{border-color:#16a34a}.v275-slot-control input[data-state=error]{border-color:#dc2626}
  .v275-position-day{height:48px;text-align:center}.v275-position-day.off{background:#e9eef5!important}.v275-position-day.leave{background:#fffaf5}.v275-position-cell{display:grid;grid-template-columns:minmax(62px,1fr) 19px;gap:2px;align-items:center}.v275-position-cell select,.v275-mentor-cell select{width:100%;min-width:65px;border:1px solid #cbd5e1;border-radius:7px;padding:4px 2px;background:#fff;font-size:8px}.v275-info{width:19px;height:23px;border:0;border-radius:5px;background:#eff6ff;color:#2563eb}.v275-position-cell.drag-over,.v275-roster-drop.drag-over{outline:2px solid #2563eb;background:#dbeafe}.v275-position-pill{border:0;border-radius:6px;background:#eff6ff;color:#1d4ed8;font-size:8px;font-weight:800;padding:4px 5px}.v275-position-day.trainee{background:#fffaf5}.v275-position-day.trainee.bad{background:#fff1f2}.v275-position-day.trainee>b{display:block;font-size:8px;color:#9a3412}.v275-position-day.trainee>small{display:block;font-size:7px;color:#64748b}.v275-mentor-cell{display:flex;flex-direction:column;gap:1px}.v275-mentor-cell span,.v275-mentor-cell small,[data-v275-status]{font-size:7px;color:#64748b}.v275-position-pool,.v275-duty-pool{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:8px;padding:7px;border:1px solid #dbeafe;border-radius:10px;background:#f8fbff}.v275-position-pool span,.v275-duty-pool button{border:1px solid #c7d2fe;border-radius:999px;background:#fff;color:#3730a3;padding:5px 8px;font-size:9px;font-weight:800;cursor:grab}.v275-duty-pool button.selected{background:#2563eb;color:#fff;border-color:#2563eb}.v275-selected-duty{font-size:9px;color:#64748b;margin-left:auto}
  .v275-roster-table th,.v275-roster-table td{min-width:68px;padding:2px}.v275-roster-name{min-width:82px!important;max-width:92px!important}.v275-roster-day{height:37px;background:#fff!important}.v275-roster-drop{min-height:32px;display:flex;flex-direction:column;justify-content:center;gap:1px;border-radius:5px;padding:1px}.v275-duty-list{display:flex;flex-wrap:wrap;justify-content:center;gap:2px}.v275-duty-pill{display:inline-flex;align-items:center;gap:2px;border-radius:999px;background:var(--duty-bg);color:var(--duty-fg);padding:2px 4px;font-size:7.5px;font-weight:800;white-space:nowrap}.v275-duty-pill button{border:0;background:rgba(255,255,255,.35);color:inherit;border-radius:50%;width:13px;height:13px;padding:0;line-height:12px;cursor:pointer}.v275-roster-drop .mini-status{font-size:7px;padding:1px 3px}.v275-balance-card>.clean-balance-dashboard{margin-top:8px}.v275-admin-position-stats .table-wrap{max-height:42vh}
  .v275-holiday-panel{margin-top:9px;border:1px solid #fde68a;border-radius:10px;background:#fffbeb;padding:7px}.v275-holiday-panel summary{cursor:pointer;font-weight:800;color:#92400e}.v275-holiday-panel form{display:flex;align-items:end;gap:6px;flex-wrap:wrap;margin-top:7px}.v275-holiday-panel label{display:flex;flex-direction:column;gap:2px;font-size:9px}.v275-holiday-panel input{min-width:155px}.v275-holiday-list{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.v275-holiday-list>span{display:inline-flex;align-items:center;gap:4px;background:#fef3c7;color:#92400e;border-radius:999px;padding:3px 6px;font-size:8px}.v275-holiday-list button{border:0;background:transparent;color:#dc2626;font-weight:900}.v275-page .mini-status{white-space:nowrap}
  @media(max-width:820px){.v275-position-wrap,.v275-roster-wrap{max-height:68vh}.v275-sticky-name{min-width:84px!important;max-width:92px!important}.v275-sticky-summary{left:90px;min-width:145px!important;max-width:155px!important}.v275-position-table th,.v275-position-table td{min-width:76px}.v275-roster-table th,.v275-roster-table td{min-width:62px}.v275-roster-name{min-width:76px!important;max-width:82px!important}.v275-holiday-panel form{display:grid;grid-template-columns:1fr}.v275-holiday-panel input{width:100%;min-width:0}.v275-selected-duty{width:100%;margin-left:0}}
  `;
  document.head.appendChild(style);

  try{const p=NAV_ITEMS.find(x=>x.id==='positionMonth');if(p){p.title='จัดตารางตำแหน่งกลางวัน รายเดือน';p.subtitle='กำหนด Slot เองและเลือกพี่เลี้ยงในช่องวันที่';}const r=NAV_ITEMS.find(x=>x.id==='scheduler');if(r){r.title='จัดตารางเวรประจำเดือน';r.subtitle='ตาราง Manual แบบรายชื่อ × วันที่';}}catch(_){}
  setTimeout(()=>{try{if(['scheduler','positionMonth','positionMonthView'].includes(S()?.page))renderPage();}catch(_){}},120);
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v275-admin-manual-ui-corrections.js", error); }
;

/* Original source: patch-v276-sticky-compact-columns.js */
try {
/* CNMI Staff Planner V276
   Sticky and compact monthly matrices
   - Freeze columns 1-2 in Staff/Admin monthly daytime-position tables
   - Show only BB / Donor in the regular staff summary column
   - Freeze column 1 in the Admin monthly roster table
*/
(function(){
  'use strict';
  const VERSION = 'V276_STICKY_COMPACT_COLUMNS';
  if (window.__CNMI_V276_STICKY_COMPACT_COLUMNS__) return;
  window.__CNMI_V276_STICKY_COMPACT_COLUMNS__ = true;

  function updateStickyOffsets(){
    document.querySelectorAll('.v275-position-wrap').forEach((wrap)=>{
      const firstHeader = wrap.querySelector('.v275-position-table thead tr > :first-child');
      if (!firstHeader) return;
      const width = Math.max(72, Math.ceil(firstHeader.getBoundingClientRect().width || firstHeader.offsetWidth || 88));
      wrap.style.setProperty('--v276-position-name-width', `${width}px`);
    });
  }

  let queued = false;
  function queueUpdate(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(()=>{
      queued = false;
      updateStickyOffsets();
    });
  }

  const style = document.createElement('style');
  style.id = 'v276-sticky-compact-columns-style';
  style.textContent = `
    /* Keep sticky cells in their own paint layer. */
    .v275-position-wrap,
    .v275-roster-wrap{
      position:relative!important;
      isolation:isolate;
      -webkit-overflow-scrolling:touch;
    }

    /* Staff + Admin monthly daytime-position matrix: freeze columns 1 and 2. */
    .v275-position-wrap{
      --v276-position-name-width:88px;
    }
    .v275-position-table{
      table-layout:auto;
    }
    .v275-position-table tr > :nth-child(1){
      position:sticky!important;
      left:0!important;
      width:88px!important;
      min-width:88px!important;
      max-width:88px!important;
      z-index:20!important;
      background-clip:padding-box!important;
    }
    .v275-position-table tr > :nth-child(2){
      position:sticky!important;
      left:var(--v276-position-name-width)!important;
      width:118px!important;
      min-width:118px!important;
      max-width:118px!important;
      z-index:19!important;
      background:#fff!important;
      background-clip:padding-box!important;
      box-shadow:3px 0 5px rgba(15,23,42,.12)!important;
    }
    .v275-position-table thead tr > :nth-child(1){
      z-index:32!important;
      background:#f8fafc!important;
      color:#0f172a!important;
    }
    .v275-position-table thead tr > :nth-child(2){
      z-index:31!important;
      background:#f8fafc!important;
    }
    .v275-position-table .v275-count-row > :nth-child(1){
      z-index:27!important;
      background:#fffaf0!important;
    }
    .v275-position-table .v275-count-row > :nth-child(2){
      z-index:26!important;
      background:#fffaf0!important;
    }

    /* Regular summary becomes one compact line: BB x · Donor y. */
    .v275-summary-cell{
      display:block!important;
      min-height:0!important;
      line-height:1.2!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      padding:1px 2px!important;
    }
    .v275-summary-cell > b{
      display:block!important;
      font-size:9px!important;
      line-height:1.2!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }
    .v275-summary-cell > span,
    .v275-summary-cell > small{
      display:none!important;
    }
    .v275-position-table tbody tr:not(.v275-count-row) > th,
    .v275-position-table tbody tr:not(.v275-count-row) > td{
      height:40px!important;
    }
    .v275-position-day{
      height:40px!important;
    }

    /* Admin monthly roster: freeze the staff-name column. */
    .v275-roster-table tr > :first-child{
      position:sticky!important;
      left:0!important;
      width:82px!important;
      min-width:82px!important;
      max-width:82px!important;
      z-index:22!important;
      background-clip:padding-box!important;
      box-shadow:3px 0 5px rgba(15,23,42,.12)!important;
    }
    .v275-roster-table thead tr > :first-child{
      z-index:34!important;
      background:#f8fafc!important;
      color:#0f172a!important;
    }

    @media(max-width:820px){
      .v275-position-wrap{
        --v276-position-name-width:76px;
      }
      .v275-position-table tr > :nth-child(1){
        width:76px!important;
        min-width:76px!important;
        max-width:76px!important;
      }
      .v275-position-table tr > :nth-child(2){
        width:104px!important;
        min-width:104px!important;
        max-width:104px!important;
      }
      .v275-position-table .v275-sticky-name b{
        font-size:9px!important;
      }
      .v275-summary-cell > b{
        font-size:8px!important;
      }
      .v275-roster-table tr > :first-child{
        width:72px!important;
        min-width:72px!important;
        max-width:72px!important;
      }
    }
  `;
  document.head.appendChild(style);

  const observer = new MutationObserver(queueUpdate);
  observer.observe(document.documentElement, {subtree:true, childList:true});
  window.addEventListener('resize', queueUpdate, {passive:true});
  window.addEventListener('orientationchange', queueUpdate, {passive:true});
  setTimeout(queueUpdate, 0);
  setTimeout(queueUpdate, 150);
  setTimeout(queueUpdate, 600);

  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v276-sticky-compact-columns.js", error); }
;

/* Original source: patch-v277-contained-scroll-cumulative-balance.js */
try {
/* CNMI Staff Planner V277
   Contained table scrolling + cumulative roster balance
   - Keep horizontal scrolling inside the monthly tables
   - Freeze position columns 1-2 and roster column 1
   - Move balance reset from Users page to Admin monthly roster summary
   - Add carry-in and cumulative duty balance from previous months
*/
(function(){
  'use strict';
  const VERSION = 'V277_CONTAINED_SCROLL_CUMULATIVE_BALANCE';
  if (window.__CNMI_V277_CONTAINED_SCROLL_CUMULATIVE_BALANCE__) return;
  window.__CNMI_V277_CONTAINED_SCROLL_CUMULATIVE_BALANCE__ = true;

  const fiscalAssignmentCache = new Map();
  const fiscalAssignmentLoading = new Map();
  let cleanupQueued = false;
  let rendering = false;

  function S(){ try { return state || window.state || null; } catch (_) { return window.state || null; } }
  function DB(){ try { return sb || window.sb || null; } catch (_) { return window.sb || null; } }
  function esc(v){
    try { return escapeHtml(v == null ? '' : String(v)); }
    catch (_) { return String(v == null ? '' : v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  }
  function normId(v){ return String(v == null ? '' : v); }
  function normDate(v){
    try { return normalizeDateKey(v); }
    catch (_) { return String(v || '').slice(0,10); }
  }
  function explicitFalse(v){ return v===false || ['false','0','no','off','ปิด'].includes(String(v??'').trim().toLowerCase()); }
  function isAdminSafe(){
    try { return !!isAdmin(); }
    catch (_) { return String(S()?.profile?.role || '').toLowerCase()==='admin'; }
  }
  function toast(message,tone){
    try { showToast(message,tone ? {tone} : undefined); }
    catch (_) { console.info(message); }
  }
  function friendly(error){
    try { return friendlyDbError(error); }
    catch (_) { return error?.message || error?.details || String(error || 'เกิดข้อผิดพลาด'); }
  }
  function staffName(person){ return person?.nickname || person?.full_name || person?.email || '-'; }
  function staffColorSafe(person){ try { return staffColor(person); } catch (_) { return person?.staff_color || person?.color || '#e2e8f0'; } }
  function textColorSafe(color){ try { return textColorFor(color); } catch (_) { return '#0f172a'; } }
  function ordered(rows){ try { return orderedStaff(rows); } catch (_) { return rows.slice().sort((a,b)=>staffName(a).localeCompare(staffName(b),'th')); } }
  function isLongLeave(person){
    try { return isLongTermLeaveStaff(person); }
    catch (_) { return person?.is_long_term_leave===true || person?.maternity_status===true; }
  }
  function isRosterEnabled(person){
    if (!person) return false;
    const active = Object.prototype.hasOwnProperty.call(person,'is_active') ? person.is_active : person.active;
    if (explicitFalse(active) || active == null) return false;
    if (String(person.staff_type||'').trim()==='แพทย์') return false;
    if (person.maternity_status) return false;
    const value = person.roster_enabled ?? person.duty_enabled ?? person.can_roster ?? person.is_roster_enabled ?? person.schedule_enabled ?? person.is_schedule_enabled ?? person['สถานะจัดเวร'];
    return !explicitFalse(value);
  }
  function rosterStaff(){ return ordered((S()?.staff || []).filter(isRosterEnabled)); }
  function groupLabel(person){ return String(person?.staff_type || '').trim()==='เคิก' ? 'เคิก' : 'MT'; }
  function monthKeySafe(key){ return /^\d{4}-\d{2}$/.test(String(key||'')) ? String(key) : new Date().toISOString().slice(0,7); }
  function nextMonth(key){
    const y=Number(key.slice(0,4)),m=Number(key.slice(5,7));
    const d=new Date(y,m,1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  function prevMonth(key){
    const y=Number(key.slice(0,4)),m=Number(key.slice(5,7));
    const d=new Date(y,m-2,1);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  function monthEnd(key){
    const y=Number(key.slice(0,4)),m=Number(key.slice(5,7));
    return `${key}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
  }
  function fiscalBounds(key){
    const safe=monthKeySafe(key),y=Number(safe.slice(0,4)),m=Number(safe.slice(5,7));
    const startYear=m>=10?y:y-1;
    return { start:`${startYear}-10-01`, end:monthEnd(safe), startKey:`${startYear}-10`, selectedKey:safe, cacheKey:`${startYear}-10_${safe}` };
  }
  function monthsBetween(startKey,endKey){
    const out=[]; let cur=startKey; let guard=0;
    while(cur<=endKey && guard<36){ out.push(cur); cur=nextMonth(cur); guard++; }
    return out;
  }
  function resetMonth(person){
    const raw=person?.balance_reset_at;
    return raw ? normDate(raw).slice(0,7) : '';
  }
  function dutyStats(assignments){
    try { return typeof calcFairness==='function' ? (calcFairness((assignments||[]).filter(a=>a?.staff_id)) || {}) : {}; }
    catch (_) {
      const map={};
      (assignments||[]).forEach(a=>{
        if(!a?.staff_id)return;
        const id=normId(a.staff_id); map[id]=map[id]||{total:0,units:0,hours:0,pay:0};
        map[id].total++; map[id].units++; map[id].hours+=8;
      });
      return map;
    }
  }
  function dutyCounts(assignments,staffId){
    const rows=(assignments||[]).filter(a=>normId(a?.staff_id)===normId(staffId));
    const count=fn=>rows.filter(fn).length;
    return {
      total:rows.length,
      chbd1:count(a=>a.duty_code==='ชบด1'),
      chbd2:count(a=>a.duty_code==='ชบด2'),
      chbd3:count(a=>a.duty_code==='ชบด3'),
      ch3a:count(a=>a.duty_code==='ช3A'),
      ch3b:count(a=>a.duty_code==='ช3B'),
      ch4:count(a=>a.duty_code==='ช4A'||a.duty_code==='ช4B'),
      ch9:count(a=>String(a.duty_code||'').startsWith('ช9'))
    };
  }
  function daysOff(staffId,key,assignments){
    try { return Number(calculateDaysOff(staffId,key,assignments)||0); }
    catch (_) { return 0; }
  }
  function assignmentRowsForFiscal(key){
    const b=fiscalBounds(key);
    if(fiscalAssignmentCache.has(b.cacheKey)) return fiscalAssignmentCache.get(b.cacheKey);
    const rows=(S()?.rosterAssignments||[]).filter(a=>{
      const d=normDate(a?.duty_date); return d>=b.start&&d<=b.end&&a?.staff_id;
    });
    ensureFiscalAssignments(key);
    return rows;
  }
  async function ensureFiscalAssignments(key){
    const b=fiscalBounds(key);
    if(fiscalAssignmentCache.has(b.cacheKey)) return fiscalAssignmentCache.get(b.cacheKey);
    if(fiscalAssignmentLoading.has(b.cacheKey)) return fiscalAssignmentLoading.get(b.cacheKey);
    const client=DB();
    if(!client) return [];
    const task=(async()=>{
      try{
        const res=await client.from('roster_assignments').select('*').gte('duty_date',b.start).lte('duty_date',b.end).order('duty_date');
        if(res.error) throw res.error;
        const rows=res.data||[];
        fiscalAssignmentCache.set(b.cacheKey,rows);
        if(S()){
          const outside=(S().rosterAssignments||[]).filter(a=>{const d=normDate(a?.duty_date);return d<b.start||d>b.end;});
          S().rosterAssignments=outside.concat(rows);
        }
        setTimeout(()=>{ try { window.renderPage?.(); } catch (_) {} },0);
        return rows;
      }catch(error){
        console.warn(`${VERSION}: fiscal assignments`,error);
        return [];
      }finally{ fiscalAssignmentLoading.delete(b.cacheKey); }
    })();
    fiscalAssignmentLoading.set(b.cacheKey,task);
    return task;
  }
  function cumulativeBalance(key,currentAssignments){
    const safe=monthKeySafe(key),b=fiscalBounds(safe),staff=rosterStaff(),fiscalRows=assignmentRowsForFiscal(safe);
    const months=monthsBetween(b.startKey,safe);
    const monthly=new Map();
    months.forEach(month=>{
      const rows=month===safe ? (currentAssignments||[]) : fiscalRows.filter(a=>normDate(a?.duty_date).startsWith(month));
      const stats=dutyStats(rows);
      const groups={MT:[],เคิก:[]};
      staff.forEach(person=>{
        const rMonth=resetMonth(person);
        if(isLongLeave(person)) return;
        if(rMonth && month<rMonth) return;
        groups[groupLabel(person)].push(person);
      });
      const avgs={};
      Object.entries(groups).forEach(([label,people])=>{
        const values=people.map(person=>Number(stats[normId(person.id)]?.units||0));
        avgs[label]=values.length?values.reduce((a,c)=>a+c,0)/values.length:0;
      });
      monthly.set(month,{rows,stats,avgs});
    });
    const current=monthly.get(safe)||{rows:currentAssignments||[],stats:{},avgs:{MT:0,เคิก:0}};
    const result=new Map();
    staff.forEach(person=>{
      const id=normId(person.id),rMonth=resetMonth(person),start=(rMonth&&rMonth>b.startKey)?rMonth:b.startKey;
      let carry=0;
      months.filter(m=>m<safe&&m>=start).forEach(month=>{
        const pack=monthly.get(month),units=Number(pack?.stats?.[id]?.units||0),avg=Number(pack?.avgs?.[groupLabel(person)]||0);
        carry += units-avg;
      });
      const units=Number(current.stats?.[id]?.units||0),hours=Number(current.stats?.[id]?.hours||0),pay=Number(current.stats?.[id]?.pay||0),avg=Number(current.avgs?.[groupLabel(person)]||0);
      const gap=isLongLeave(person)?0:units-avg;
      const cumulative=isLongLeave(person)?0:carry+gap;
      result.set(id,{person,units,hours,pay,avg,gap,carry,cumulative,resetMonth:rMonth,counts:dutyCounts(current.rows,id),daysOff:daysOff(id,safe,current.rows)});
    });
    return {rows:[...result.values()],monthly,current,bounds:b};
  }
  function badgeHtml(text,tone){
    try { return badge(text,tone); }
    catch (_) { return `<span class="badge ${esc(tone||'')}">${esc(text)}</span>`; }
  }
  function staffPillHtml(person){
    try { return staffPill(person); }
    catch (_) {
      const bg=staffColorSafe(person),fg=textColorSafe(bg);
      return `<span class="v277-staff-pill" style="--staff-bg:${esc(bg)};--staff-fg:${esc(fg)}">${esc(staffName(person))}</span>`;
    }
  }
  function fmt(n){ const x=Number(n||0); return Math.abs(x)<0.05?'0.0':x.toFixed(1); }
  function statusFor(row,key){
    if(isLongLeave(row.person)) return {text:'ลาระยะยาว / ไม่คิดหนี้เวร',tone:'black'};
    if(row.resetMonth===key && Math.abs(row.cumulative)<=0.5) return {text:'เริ่มนับใหม่เดือนนี้',tone:'blue'};
    if(Math.abs(row.cumulative)<=0.5) return {text:'สมดุลสะสม',tone:'green'};
    return row.cumulative>0 ? {text:'เวรสะสมมากกว่าเฉลี่ย',tone:'orange'} : {text:'เวรสะสมน้อยกว่าเฉลี่ย',tone:'blue'};
  }
  function renderEnhancedBalance(staffList,assignments,key){
    const safe=monthKeySafe(key||S()?.monthKey),calc=cumulativeBalance(safe,assignments||[]);
    const groups=['MT','เคิก'].map(label=>({label,rows:calc.rows.filter(r=>groupLabel(r.person)===label)})).filter(g=>g.rows.length);
    return `<div class="clean-balance-dashboard grouped-balance-dashboard v277-cumulative-dashboard">
      <div class="notice soft-notice"><b>การอ่านค่า:</b> Quota Gap = ส่วนต่างของเดือนนี้ • OT Balance ยกมา = ผลสะสมก่อนเข้าเดือนนี้ • เวรสะสม = OT Balance ยกมา + Quota Gap เดือนนี้ ค่าบวกหมายถึงเคยได้มากกว่าค่าเฉลี่ย ค่าลบหมายถึงเคยได้น้อยกว่าค่าเฉลี่ย</div>
      ${groups.map(group=>{
        const avg=Number(calc.current?.avgs?.[group.label]||0);
        return `<section class="balance-group-section"><div class="section-title balance-group-title"><h3>กลุ่ม ${esc(group.label)}</h3><span>${badgeHtml(`ค่าเฉลี่ยเดือนนี้ ${Number(avg||0).toFixed(1)} หน่วยเวร`,'blue')}</span></div>
          <div class="table-wrap v277-balance-table-wrap"><table class="clean-balance-table v277-balance-table"><thead><tr>
            <th>เจ้าหน้าที่</th><th>เวรรวม</th><th>หน่วยเวร</th><th>ชั่วโมงรวม</th><th>เงินประมาณ</th><th>Quota Gap</th><th>OT Balance ยกมา</th><th>เวรสะสม</th><th>วันหยุดสะสม</th><th>ชบด1</th><th>ชบด2</th><th>ชบด3</th><th>ช3A</th><th>ช3B</th><th>ช4</th><th>ช9</th><th>สถานะ</th><th>จัดการ</th>
          </tr></thead><tbody>${group.rows.map(row=>{
            const status=statusFor(row,safe),isReset=row.resetMonth===safe;
            return `<tr class="${isLongLeave(row.person)?'v277-exempt-row':''}"><td>${staffPillHtml(row.person)}</td><td>${row.counts.total}</td><td>${row.units.toFixed(1)}</td><td>${row.hours.toFixed(1)}</td><td>${Math.round(row.pay).toLocaleString()}</td><td class="${row.gap>0.5?'v277-positive':row.gap<-0.5?'v277-negative':''}">${fmt(row.gap)}</td><td class="${row.carry>0.5?'v277-positive':row.carry<-0.5?'v277-negative':''}">${fmt(row.carry)}</td><td class="v277-cumulative ${row.cumulative>0.5?'v277-positive':row.cumulative<-0.5?'v277-negative':''}">${fmt(row.cumulative)}</td><td>${row.daysOff}</td><td>${row.counts.chbd1}</td><td>${row.counts.chbd2}</td><td>${row.counts.chbd3}</td><td>${row.counts.ch3a}</td><td>${row.counts.ch3b}</td><td>${row.counts.ch4}</td><td>${row.counts.ch9}</td><td>${badgeHtml(status.text,status.tone)}${row.resetMonth?`<small class="v277-reset-note">เริ่มนับใหม่ ${esc(row.resetMonth)}</small>`:''}</td><td><button type="button" class="tiny-btn ${isReset?'danger':'warning'}" data-v277-balance-reset="${esc(row.person.id)}" data-v277-month="${esc(safe)}" data-v277-action="${isReset?'undo':'reset'}">${isReset?'ยกเลิกรีเซ็ตเดือนนี้':'เริ่มนับใหม่เดือนนี้'}</button></td></tr>`;
          }).join('')}</tbody></table></div></section>`;
      }).join('')}
    </div>`;
  }

  const previousBalance=window.renderBalanceDashboard || (typeof renderBalanceDashboard==='function'?renderBalanceDashboard:null);
  if(previousBalance){
    const enhanced=function renderBalanceDashboardV277(staffList,assignments,key){
      if(isAdminSafe() && S()?.page==='scheduler') return renderEnhancedBalance(staffList,assignments,key);
      return previousBalance.apply(this,arguments);
    };
    window.renderBalanceDashboard=enhanced;
    try { renderBalanceDashboard=enhanced; } catch (_) {}
  }

  async function setResetMonth(staffId,key,action){
    const person=(S()?.staff||[]).find(p=>normId(p.id)===normId(staffId));
    if(!person||!DB()) return;
    const reset=action!=='undo';
    const message=reset
      ? `ยืนยันเริ่มนับยอดสะสมของ ${staffName(person)} ใหม่ตั้งแต่เดือน ${key} หรือไม่?\nยอดก่อนเดือนนี้จะไม่นำมาคิด แต่เวรที่จัดในเดือนนี้ยังคำนวณตามปกติ`
      : `ยืนยันยกเลิกการเริ่มนับใหม่ของ ${staffName(person)} ในเดือน ${key} หรือไม่?\nระบบจะนำยอดตั้งแต่ต้นปีงบประมาณกลับมาคำนวณ`;
    if(!(await confirmDialog(message,'ยืนยันยอดสะสม'))) return;
    try{
      try { setBusy?.(true,'กำลังบันทึกยอดสะสม'); } catch (_) {}
      const rpc=await DB().rpc('set_staff_balance_reset_month_v277',{p_staff_id:staffId,p_month_key:key,p_reset:reset});
      if(rpc.error) throw rpc.error;
      person.balance_reset_at=reset?`${key}-01T00:00:00.000Z`:null;
      person.carry_over_balance=0; person.overtime_balance=0; person.ot_balance=0;
      toast(reset?'ตั้งให้เริ่มนับยอดสะสมใหม่ในเดือนนี้แล้ว':'ยกเลิกการเริ่มนับใหม่แล้ว');
      try { window.renderPage?.(); } catch (_) {}
    }catch(error){
      toast(`บันทึกไม่สำเร็จ: ${friendly(error)} — กรุณารัน SQL V277 ก่อน`,'error');
    }finally{ try { setBusy?.(false); } catch (_) {} }
  }

  function removeLegacyResetControls(){
    document.querySelectorAll('.long-leave-admin-actions').forEach(el=>el.remove());
    document.querySelectorAll('[data-v140-reset-balance]').forEach(btn=>{
      const wrap=btn.closest('[data-v140-long-leave-wrap]');
      if(wrap){
        btn.remove();
        wrap.querySelectorAll('small').forEach(s=>{ if(/รีเซ็ตยอดสะสม|พนักงานใหม่|กลับมาทำงาน/.test(s.textContent||'')) s.remove(); });
      }else btn.remove();
    });
  }

  function syncContainedScroll(){
    const page=S()?.page||'';
    const relevant=['positionMonth','positionMonthView','scheduler'].includes(page);
    document.body.classList.toggle('v277-contained-table-page',relevant);
    document.body.classList.toggle('v277-position-page',page==='positionMonth'||page==='positionMonthView');
    document.body.classList.toggle('v277-roster-page',page==='scheduler');
    const root=document.getElementById('pageContent');
    if(root) root.classList.toggle('v277-contained-page-content',relevant);
    document.querySelectorAll('.v275-position-wrap,.v275-roster-wrap').forEach(wrap=>{
      wrap.classList.add('v277-table-scroller');
      wrap.setAttribute('tabindex','0');
      wrap.setAttribute('role','region');
      wrap.setAttribute('aria-label',wrap.classList.contains('v275-roster-wrap')?'ตารางจัดเวรรายเดือน เลื่อนซ้ายขวาภายในตาราง':'ตารางตำแหน่งกลางวันรายเดือน เลื่อนซ้ายขวาภายในตาราง');
      if(wrap.classList.contains('v275-position-wrap')){
        const first=wrap.querySelector('.v275-position-table tr > :first-child');
        const width=Math.max(76,Math.ceil(first?.getBoundingClientRect?.().width||first?.offsetWidth||88));
        wrap.style.setProperty('--v277-first-col-width',`${width}px`);
      }
    });
    removeLegacyResetControls();
  }
  function queueSync(){
    if(cleanupQueued)return; cleanupQueued=true;
    requestAnimationFrame(()=>{cleanupQueued=false;syncContainedScroll();});
  }

  const previousRender=window.renderPage || (typeof renderPage==='function'?renderPage:null);
  if(previousRender){
    const wrapped=function renderPageV277(){
      if(rendering) return previousRender.apply(this,arguments);
      rendering=true; let ret;
      try { ret=previousRender.apply(this,arguments); }
      finally { rendering=false; }
      setTimeout(syncContainedScroll,0);
      setTimeout(syncContainedScroll,80);
      return ret;
    };
    window.renderPage=wrapped;
    try { renderPage=wrapped; } catch (_) {}
  }

  document.addEventListener('click',event=>{
    const btn=event.target?.closest?.('[data-v277-balance-reset]');
    if(!btn)return;
    event.preventDefault(); event.stopImmediatePropagation();
    setResetMonth(btn.dataset.v277BalanceReset,btn.dataset.v277Month,btn.dataset.v277Action);
  },true);

  const style=document.createElement('style');
  style.id='v277-contained-scroll-cumulative-balance-style';
  style.textContent=`
    /* Remove the old reset control from Users and rights. Reset now belongs to the monthly roster summary. */
    .long-leave-admin-actions,[data-v140-reset-balance]{display:none!important}

    /* Do not let the matrix widen the whole page. Horizontal movement belongs to the table scroller. */
    body.v277-contained-table-page{overflow-x:hidden!important}
    body.v277-contained-table-page .app-view,
    body.v277-contained-table-page .main-panel,
    body.v277-contained-table-page .page-content,
    body.v277-contained-table-page #pageContent,
    body.v277-contained-table-page .v275-page,
    body.v277-contained-table-page .v275-page>.card{min-width:0!important;max-width:100%!important;width:100%!important}
    body.v277-contained-table-page .page-content,
    body.v277-contained-table-page #pageContent,
    body.v277-contained-table-page .v275-page{overflow-x:hidden!important}
    .v277-table-scroller{
      display:block!important;
      width:100%!important;
      max-width:100%!important;
      min-width:0!important;
      overflow-x:auto!important;
      overflow-y:auto!important;
      overscroll-behavior-x:contain!important;
      touch-action:pan-x pan-y!important;
      scrollbar-gutter:stable both-edges;
      -webkit-overflow-scrolling:touch;
      position:relative!important;
      isolation:isolate!important;
    }
    .v277-table-scroller>.v275-position-table,
    .v277-table-scroller>.v275-roster-table{
      width:max-content!important;
      min-width:100%!important;
      max-width:none!important;
      margin:0!important;
    }

    /* Position matrix: true sticky columns 1 and 2 inside the table scroller. */
    .v275-position-wrap{--v277-first-col-width:88px}
    .v275-position-table tr>:nth-child(1){
      position:sticky!important;left:0!important;z-index:40!important;
      width:88px!important;min-width:88px!important;max-width:88px!important;
      background-clip:padding-box!important;
    }
    .v275-position-table tr>:nth-child(2){
      position:sticky!important;left:var(--v277-first-col-width)!important;z-index:39!important;
      width:118px!important;min-width:118px!important;max-width:118px!important;
      background:#fff!important;background-clip:padding-box!important;
      box-shadow:4px 0 7px rgba(15,23,42,.15)!important;
    }
    .v275-position-table thead tr>:nth-child(1){z-index:60!important;background:#f8fafc!important;color:#0f172a!important}
    .v275-position-table thead tr>:nth-child(2){z-index:59!important;background:#f8fafc!important;color:#0f172a!important}
    .v275-position-table .v275-count-row>:nth-child(1),
    .v275-position-table .v275-count-row>:nth-child(2){z-index:50!important;background:#fffaf0!important}

    /* Admin roster: true sticky staff column inside its own scroller. */
    .v275-roster-table tr>:first-child{
      position:sticky!important;left:0!important;z-index:42!important;
      width:82px!important;min-width:82px!important;max-width:82px!important;
      background-clip:padding-box!important;box-shadow:4px 0 7px rgba(15,23,42,.15)!important;
    }
    .v275-roster-table thead tr>:first-child{z-index:62!important;background:#f8fafc!important;color:#0f172a!important}

    /* Cumulative balance table. */
    .v277-cumulative-dashboard{display:grid;gap:14px}
    .v277-balance-table-wrap{max-width:100%;overflow:auto}
    .v277-balance-table{min-width:1450px;font-size:11px}
    .v277-balance-table th,.v277-balance-table td{padding:7px 8px;text-align:center;vertical-align:middle;white-space:nowrap}
    .v277-balance-table th:first-child,.v277-balance-table td:first-child{position:sticky;left:0;z-index:3;background:#fff;text-align:left;box-shadow:3px 0 5px rgba(15,23,42,.08)}
    .v277-balance-table thead th:first-child{z-index:5;background:#f6f9fc}
    .v277-positive{color:#b45309;font-weight:900}
    .v277-negative{color:#1d70b7;font-weight:900}
    .v277-cumulative{font-size:12px}
    .v277-reset-note{display:block;margin-top:3px;color:#64748b;font-size:8px}
    .v277-staff-pill{display:inline-flex;border-radius:999px;padding:4px 9px;background:var(--staff-bg);color:var(--staff-fg);font-weight:900}
    .v277-exempt-row{opacity:.72}

    @media(max-width:820px){
      .v275-position-wrap{--v277-first-col-width:76px}
      .v275-position-table tr>:nth-child(1){width:76px!important;min-width:76px!important;max-width:76px!important}
      .v275-position-table tr>:nth-child(2){width:104px!important;min-width:104px!important;max-width:104px!important}
      .v275-roster-table tr>:first-child{width:72px!important;min-width:72px!important;max-width:72px!important}
      .v277-table-scroller{max-height:72dvh!important}
    }
  `;
  document.head.appendChild(style);

  const observer=new MutationObserver(queueSync);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('resize',queueSync,{passive:true});
  window.addEventListener('orientationchange',queueSync,{passive:true});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(syncContainedScroll,150));
  setTimeout(syncContainedScroll,0);
  setTimeout(syncContainedScroll,300);

  window.cnmiV277={
    cumulativeBalance,
    ensureFiscalAssignments,
    syncContainedScroll,
    setResetMonth
  };
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v277-contained-scroll-cumulative-balance.js", error); }
;

/* Original source: patch-v278-slot-stats-holiday-balance-navigation-fix.js */
try {
/* CNMI Staff Planner V278
   Slot-template dropdown + 4 admin position summaries + compact summary popup
   + position-management navigation recovery + separate holiday carry balance reset.
*/
(function(){
  'use strict';
  const VERSION = 'V307_ADMIN_POSITION_STATS_ACTIVE_STAFF_FIX';
  if (window.__CNMI_V278_SLOT_STATS_HOLIDAY_BALANCE_NAVIGATION_FIX__) return;
  window.__CNMI_V278_SLOT_STATS_HOLIDAY_BALANCE_NAVIGATION_FIX__ = true;

  const lifetimePositionCache = { rows:null, loading:null, error:'' };
  let enhanceQueued = false;
  let rendering = false;

  function S(){ try { return state || window.state || null; } catch (_) { return window.state || null; } }
  function DB(){ try { return sb || window.sb || null; } catch (_) { return window.sb || null; } }
  function esc(v){
    try { return escapeHtml(v == null ? '' : String(v)); }
    catch (_) { return String(v == null ? '' : v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  }
  function normId(v){ return String(v == null ? '' : v); }
  function normDate(v){
    try { return normalizeDateKey(v); }
    catch (_) { return String(v || '').slice(0,10); }
  }
  function monthKeySafe(key){ return /^\d{4}-\d{2}$/.test(String(key||'')) ? String(key) : new Date().toISOString().slice(0,7); }
  function explicitFalse(v){ return v===false || ['false','0','no','off','ปิด'].includes(String(v??'').trim().toLowerCase()); }
  function isAdminSafe(){
    try { return !!isAdmin(); }
    catch (_) { return String(S()?.profile?.role || '').toLowerCase()==='admin'; }
  }
  function toast(message,tone){
    try { showToast(message,tone ? {tone} : undefined); }
    catch (_) { console.info(message); }
  }
  function friendly(error){
    try { return friendlyDbError(error); }
    catch (_) { return error?.message || error?.details || error?.hint || String(error || 'เกิดข้อผิดพลาด'); }
  }
  function staffName(personOrId){
    const p=typeof personOrId==='object' ? personOrId : (S()?.staff||[]).find(x=>normId(x.id)===normId(personOrId));
    return p ? (p.nickname || p.full_name || p.email || '-') : '-';
  }
  function staffColorSafe(person){ try { return staffColor(person); } catch (_) { return person?.staff_color || person?.color || '#e2e8f0'; } }
  function textColorSafe(color){ try { return textColorFor(color); } catch (_) { return '#0f172a'; } }
  function staffPillHtml(person){
    try { return staffPill(person); }
    catch (_) { const bg=staffColorSafe(person),fg=textColorSafe(bg);return `<span class="v278-staff-pill" style="--staff-bg:${esc(bg)};--staff-fg:${esc(fg)}">${esc(staffName(person))}</span>`; }
  }
  function badgeHtml(text,tone){
    try { return badge(text,tone); }
    catch (_) { return `<span class="badge ${esc(tone||'')}">${esc(text)}</span>`; }
  }
  function isLongLeave(person){
    try { return !!isLongTermLeaveStaff(person); }
    catch (_) { return person?.is_long_term_leave===true || person?.maternity_status===true; }
  }
  function isActivePerson(person){
    if(!person) return false;
    const active=Object.prototype.hasOwnProperty.call(person,'is_active')?person.is_active:person.active;
    return active != null && !explicitFalse(active);
  }
  function isNormalPositionPerson(person){
    if(!isActivePerson(person) || String(person?.staff_type||'').trim()==='แพทย์' || person?.maternity_status) return false;
    if(explicitFalse(person?.daily_position_enabled)) return false;
    return String(person?.position_training_status||'ใช้งานปกติ').trim()==='ใช้งานปกติ';
  }
  function isRosterEnabled(person){
    if(!isActivePerson(person) || String(person?.staff_type||'').trim()==='แพทย์' || person?.maternity_status) return false;
    const value=person?.roster_enabled ?? person?.duty_enabled ?? person?.can_roster ?? person?.is_roster_enabled ?? person?.schedule_enabled ?? person?.is_schedule_enabled ?? person?.['สถานะจัดเวร'];
    return !explicitFalse(value);
  }
  function ordered(rows){
    try { return orderedStaff(rows); }
    catch (_) { return rows.slice().sort((a,b)=>staffName(a).localeCompare(staffName(b),'th')); }
  }
  // V307: ตารางสถิติเป็นประวัติการทำตำแหน่ง จึงต้องแสดงเจ้าหน้าที่ที่ยัง active ทุกคน
  // แม้ daily_position_enabled หรือ position_training_status ในฐานข้อมูลยังเป็นค่าเดิมจากช่วงน้องใหม่
  // ไม่เช่นนั้นเจ้าหน้าที่ เช่น "บอล" จะหายจากสถิติทั้งที่เป็นบุคลากรปัจจุบัน
  function positionStaff(){
    return ordered((S()?.staff||[]).filter(person=>{
      if(!isActivePerson(person)) return false;
      if(String(person?.staff_type||'').trim()==='แพทย์') return false;
      if(person?.maternity_status) return false;
      return true;
    }));
  }
  function rosterStaff(){ return ordered((S()?.staff||[]).filter(isRosterEnabled)); }
  function groupLabel(person){ return String(person?.staff_type||'').trim()==='เคิก' ? 'เคิก' : 'MT'; }

  /* ------------------------------------------------------------------
     1) Date-specific dropdown options from Position Management templates
     ------------------------------------------------------------------ */
  function slotSetting(date){
    return (S()?.manualDaySlotSettingsV273||[]).find(row=>normDate(row?.work_date)===normDate(date)) || null;
  }
  function targetSlotsForDate(date){
    const input=document.querySelector(`[data-v275-slot][data-date="${CSS.escape(normDate(date))}"]`);
    const raw=input ? input.value : slotSetting(date)?.target_slots;
    const n=Number(raw);
    return Number.isFinite(n) && n>0 ? Math.round(n) : null;
  }
  function isOutingDate(date){
    try { return !!hasOuting(normDate(date)); }
    catch (_) {
      return (S()?.activities||[]).some(a=>String(a?.event_type||'')==='ออกหน่วย' && normDate(a?.start_date)<=normDate(date) && normDate(a?.end_date||a?.start_date)>=normDate(date));
    }
  }
  function activeMasterRows(){
    return (S()?.positionMasters||[]).filter(row=>row && row.is_active!==false && !row.deleted_at && !String(row.code||'').startsWith('__CNMI_SLOT_TEMPLATE'));
  }
  function templateConfigs(){
    try { return window.cnmiV224?.currentConfigs?.() || S()?.slotTemplateV224?.configs || null; }
    catch (_) { return S()?.slotTemplateV224?.configs || null; }
  }
  function normalizeTemplateRows(rows){
    const seen=new Set();
    return (Array.isArray(rows)?rows:[]).map((row,index)=>({
      code:String(row?.code||row?.position_code||'').trim(),
      sort:Number(row?.sort_order||index+1)
    })).filter(row=>row.code && !seen.has(row.code) && seen.add(row.code)).sort((a,b)=>a.sort-b.sort||a.code.localeCompare(b.code,'th'));
  }
  function templateRowsForDate(date){
    const target=targetSlotsForDate(date);
    const cfg=templateConfigs();
    let rows=[];
    if(cfg && target){
      if(isOutingDate(date)){
        const bucket=target<=12?12:(target<=13?13:14);
        rows=cfg.outing_by_count?.[bucket] || cfg.outing_by_count?.[String(bucket)] || cfg.outing || [];
      }else{
        rows=cfg.day?.[target] || cfg.day?.[String(target)] || [];
      }
    }
    if(!rows.length && target && !isOutingDate(date)){
      try { rows=window.cnmiDayPositionSlotsV218?.DAY_POSITION_SLOT_SETS_218?.[target] || window.cnmiDayPositionSlotsV218?.DAY_POSITION_SLOT_SETS?.[target] || []; }
      catch (_) {}
    }
    if(!rows.length){
      rows=activeMasterRows().filter(row=>isOutingDate(date) ? (row.is_outing===true || String(row.zone||'')==='ออกหน่วย') : !(row.is_outing===true || String(row.zone||'')==='ออกหน่วย'));
    }
    return normalizeTemplateRows(rows);
  }
  function applyTemplateDropdowns(){
    if(S()?.page!=='positionMonth' || !isAdminSafe()) return;
    document.querySelectorAll('[data-v275-position-cell]').forEach(cell=>{
      const date=normDate(cell.dataset.date),select=cell.querySelector('[data-v275-position-select]');
      if(!date||!select) return;
      const selected=String(select.value||'');
      const rows=templateRowsForDate(date);
      const allowed=rows.map(row=>row.code);
      if(selected && !allowed.includes(selected)) allowed.push(selected);
      const signature=`${date}|${targetSlotsForDate(date)||''}|${isOutingDate(date)?'outing':'day'}|${allowed.join('¦')}|${selected}`;
      if(select.dataset.v278Signature===signature) return;
      select.innerHTML=`<option value="">ว่าง</option>${allowed.map(code=>`<option value="${esc(code)}" ${code===selected?'selected':''}>${esc(code)}${code===selected&&!rows.some(r=>r.code===code)?' (ตำแหน่งเดิม)':''}</option>`).join('')}`;
      select.value=selected;
      select.dataset.v278Signature=signature;
      const target=targetSlotsForDate(date);
      select.title=target ? `${isOutingDate(date)?'ชุดออกหน่วย':'ชุดวันทำงานปกติ'} ${target} คน` : 'ยังไม่ได้กำหนด Slot ของวันนี้';
    });
  }
  async function ensureTemplateConfigs(){
    try {
      const promise=window.cnmiV224?.loadDbConfigs?.(false);
      if(promise && typeof promise.then==='function') await Promise.race([promise,new Promise(resolve=>setTimeout(resolve,5000))]);
    }catch(error){ console.warn(`${VERSION}: slot config load`,error); }
    applyTemplateDropdowns();
  }

  /* ------------------------------------------------------------------
     2) Four Admin position statistics tables
     ------------------------------------------------------------------ */
  function currentPositionRows(key){
    let rows=(S()?.positions||[]).filter(row=>normDate(row?.work_date).startsWith(key));
    try { rows=window.cnmiV272?.operationalRows?.(rows)||rows; } catch (_) {}
    return dedupePositions(rows);
  }
  function dedupePositions(rows){
    const map=new Map();
    (rows||[]).forEach(row=>{
      if(!row?.staff_id || !row?.position_code || !normDate(row?.work_date)) return;
      const key=`${normDate(row.work_date)}|${normId(row.staff_id)}|${String(row.position_code)}`;
      map.set(key,row);
    });
    return [...map.values()];
  }
  function isOutingDateForSummary(date){
    const key=normDate(date);
    try { return !!hasOuting(key); }
    catch (_) {
      return (S()?.activities||[]).some(a=>String(a?.event_type||'').trim()==='ออกหน่วย'&&normDate(a?.start_date)<=key&&normDate(a?.end_date||a?.start_date)>=key);
    }
  }
  function positionMaster(code,date=''){
    const wanted=String(code||'');
    const rows=activeMasterRows().filter(row=>String(row.code||'')===wanted);
    if(!rows.length)return null;
    if(date){
      const outing=isOutingDateForSummary(date);
      const matched=rows.find(row=>{
        const zone=String(row?.zone||'').trim().toLowerCase();
        const isOuting=row?.is_outing===true||zone.includes('ออกหน่วย')||String(row?.eligibility_code||'').startsWith('OUTING:');
        return isOuting===outing;
      });
      if(matched)return matched;
    }
    return rows.find(row=>{
      const zone=String(row?.zone||'').trim().toLowerCase();
      return row?.is_outing!==true&&!zone.includes('ออกหน่วย')&&!String(row?.eligibility_code||'').startsWith('OUTING:');
    })||rows[0];
  }
  function zoneBucket(row){
    const date=normDate(row?.work_date),master=positionMaster(row?.position_code,date),code=String(row?.position_code||'').trim().toUpperCase(),zone=String(row?.zone||master?.zone||'').trim().toLowerCase();
    if(isOutingDateForSummary(date)&&(zone.includes('ออกหน่วย')||row?.is_outing===true))return'outing';
    if(code.startsWith('BB-'))return'bb';
    if(code.startsWith('DR-'))return'donor';
    if(zone.includes('donor')||zone.includes('บริจาค'))return'donor';
    return'bb';
  }
  function aggregatePositions(rows,people){
    const result=new Map(people.map(person=>[normId(person.id),{person,total:0,bb:0,donor:0,outing:0,positions:{}}]));
    (rows||[]).forEach(row=>{
      const rec=result.get(normId(row?.staff_id));
      if(!rec || !row?.position_code) return;
      rec.total++;
      rec[zoneBucket(row)]++;
      const code=String(row.position_code||'').trim();
      rec.positions[code]=(rec.positions[code]||0)+1;
    });
    return [...result.values()];
  }
  function allPositionCodes(monthRows,lifetimeRows){
    const seen=new Set(),out=[];
    activeMasterRows().sort((a,b)=>Number(a.sort_order||999)-Number(b.sort_order||999)||String(a.code).localeCompare(String(b.code),'th')).forEach(row=>{
      const code=String(row.code||'').trim();if(code&&!seen.has(code)){seen.add(code);out.push(code);}
    });
    [...(monthRows||[]),...(lifetimeRows||[])].forEach(row=>{
      const code=String(row?.position_code||'').trim();if(code&&!seen.has(code)){seen.add(code);out.push(code);}
    });
    return out;
  }
  async function loadLifetimePositions(force=false){
    if(lifetimePositionCache.rows && !force) return lifetimePositionCache.rows;
    if(lifetimePositionCache.loading) return lifetimePositionCache.loading;
    const client=DB();
    if(!client) return [];
    lifetimePositionCache.loading=(async()=>{
      const rows=[],pageSize=1000;
      for(let from=0,guard=0;guard<100;guard++,from+=pageSize){
        const query=client.from('daily_positions').select('id,work_date,staff_id,position_code,zone').order('work_date',{ascending:true}).range(from,from+pageSize-1);
        const res=await query;
        if(res.error) throw res.error;
        const part=res.data||[];rows.push(...part);
        if(part.length<pageSize) break;
      }
      lifetimePositionCache.rows=dedupePositions(rows);
      lifetimePositionCache.error='';
      return lifetimePositionCache.rows;
    })().catch(error=>{
      lifetimePositionCache.error=friendly(error);
      console.warn(`${VERSION}: lifetime positions`,error);
      return [];
    }).finally(()=>{lifetimePositionCache.loading=null;});
    const rows=await lifetimePositionCache.loading;
    refreshAdminPositionStats();
    return rows;
  }
  function zoneTableHtml(title,subtitle,data){
    return `<section class="card v278-position-stat-card"><div class="section-title"><div><h3>${esc(title)}</h3><p class="hint">${esc(subtitle)}</p></div></div><div class="v278-stat-scroll"><table class="v278-stat-table v278-zone-table"><thead><tr><th>เจ้าหน้าที่</th><th>BB</th><th>Donor</th><th>ออกหน่วย</th><th>รวม</th></tr></thead><tbody>${data.map(row=>`<tr><td>${staffPillHtml(row.person)}</td><td>${row.bb}</td><td>${row.donor}</td><td>${row.outing}</td><td><b>${row.total}</b></td></tr>`).join('')}</tbody></table></div></section>`;
  }
  function positionTableHtml(title,subtitle,data,codes){
    return `<section class="card v278-position-stat-card"><div class="section-title"><div><h3>${esc(title)}</h3><p class="hint">${esc(subtitle)}</p></div></div><div class="v278-stat-scroll"><table class="v278-stat-table v278-position-detail-table"><thead><tr><th>เจ้าหน้าที่</th>${codes.map(code=>`<th title="${esc(code)}">${esc(code)}</th>`).join('')}<th>รวม</th></tr></thead><tbody>${data.map(row=>`<tr><td>${staffPillHtml(row.person)}</td>${codes.map(code=>`<td>${row.positions[code]||0}</td>`).join('')}<td><b>${row.total}</b></td></tr>`).join('')}</tbody></table></div></section>`;
  }
  function fourPositionStatsHtml(key){
    const people=positionStaff(),monthRows=currentPositionRows(key),lifeRows=lifetimePositionCache.rows||[],codes=allPositionCodes(monthRows,lifeRows);
    const monthData=aggregatePositions(monthRows,people),lifeData=aggregatePositions(lifeRows,people);
    const loading=!lifetimePositionCache.rows && !lifetimePositionCache.error;
    return `<div class="v278-admin-position-stats">
      <div class="section-title v278-stats-heading"><div><h2>สถิติตำแหน่งสำหรับ Admin</h2><p class="hint">เดือน ${esc(key)} และยอดสะสมทั้งหมดที่มีในฐานข้อมูล</p></div>${loading?'<span class="badge blue">กำลังโหลดข้อมูลสะสม…</span>':lifetimePositionCache.error?`<span class="badge orange">โหลดสะสมไม่สำเร็จ</span>`:`<span class="badge green">ข้อมูลสะสม ${lifeRows.length} รายการ</span>`}</div>
      <div class="v278-stat-grid">
        ${zoneTableHtml('ตารางที่ 1 — ห้องประจำเดือนนี้','แยก BB · Donor · ออกหน่วย',monthData)}
        ${positionTableHtml('ตารางที่ 2 — ตำแหน่งประจำเดือนนี้','แยกทุกตำแหน่งที่ใช้งาน',monthData,codes)}
        ${zoneTableHtml('ตารางที่ 3 — ห้องสะสมทั้งหมด','แยก BB · Donor · ออกหน่วย ตั้งแต่มีข้อมูลในระบบ',lifeData)}
        ${positionTableHtml('ตารางที่ 4 — ตำแหน่งสะสมทั้งหมด','แยกทุกตำแหน่ง ตั้งแต่มีข้อมูลในระบบ',lifeData,codes)}
      </div>
    </div>`;
  }
  function replaceAdminPositionStats(){
    if(S()?.page!=='positionMonth' || !isAdminSafe()) return;
    const target=document.querySelector('.v275-admin-position-stats');
    if(!target) return;
    const key=monthKeySafe(S()?.positionMonthKey||S()?.monthKey);
    target.outerHTML=fourPositionStatsHtml(key);
    if(!lifetimePositionCache.rows && !lifetimePositionCache.loading) loadLifetimePositions(false);
  }
  function refreshAdminPositionStats(){
    if(S()?.page!=='positionMonth') return;
    const target=document.querySelector('.v278-admin-position-stats,.v275-admin-position-stats');
    if(!target) return;
    target.outerHTML=fourPositionStatsHtml(monthKeySafe(S()?.positionMonthKey||S()?.monthKey));
  }

  /* ------------------------------------------------------------------
     3) Compact position summary popup: current month only
     ------------------------------------------------------------------ */
  function monthlyPositionSummary(person,key){
    const rows=currentPositionRows(key).filter(row=>normId(row.staff_id)===normId(person.id));
    const out={total:rows.length,bb:0,donor:0,outing:0,positions:{}};
    rows.forEach(row=>{out[zoneBucket(row)]++;const code=String(row.position_code||'').trim();if(code)out.positions[code]=(out.positions[code]||0)+1;});
    return out;
  }
  function showCompactPositionSummary(staffId){
    const person=(S()?.staff||[]).find(row=>normId(row.id)===normId(staffId));
    if(!person) return;
    const key=monthKeySafe(S()?.positionMonthKey||S()?.positionMonthViewKey||S()?.monthKey),summary=monthlyPositionSummary(person,key);
    const positions=Object.entries(summary.positions).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'th'));
    const positionHtml=positions.length?`<div class="v278-popup-position-list">${positions.map(([code,count])=>`<div><button type="button" class="v275-position-pill" data-v275-job="${esc(code)}">${esc(code)}</button><b>${count} วัน</b></div>`).join('')}</div>`:'<p class="muted">ยังไม่มีตำแหน่งในเดือนนี้</p>';
    try { showModal(`<div class="v278-position-popup"><h2>สรุปตำแหน่งของ ${esc(staffName(person))}</h2><p class="muted">เดือน ${esc(key)}</p><div class="v278-room-summary"><span>BB <b>${summary.bb}</b></span><span>Donor <b>${summary.donor}</b></span><span>ออกหน่วย <b>${summary.outing}</b></span><span>รวม <b>${summary.total}</b></span></div><h3>ตำแหน่งที่อยู่ในเดือนนี้</h3>${positionHtml}</div>`); }
    catch (_) {}
  }

  /* ------------------------------------------------------------------
     4) Position Management navigation recovery
     ------------------------------------------------------------------ */
  function closeSidebar(){
    document.getElementById('sidebar')?.classList.remove('open');
    document.body.classList.remove('sidebar-open');
  }
  function renderPositionManagementImmediately(){
    try { window.renderPage?.(); } catch (error) { console.warn(`${VERSION}: position management render`,error); }
    setTimeout(()=>{
      try { window.cnmiV224?.renderPositionManagementV224?.(); } catch (error) { console.warn(`${VERSION}: slot manager render`,error); }
    },0);
    try {
      const load=window.cnmiV224?.loadDbConfigs?.(false);
      if(load&&typeof load.then==='function') Promise.race([load,new Promise(resolve=>setTimeout(resolve,6000))]).finally(()=>{
        if(S()?.page==='positionManagement') try { window.cnmiV224?.renderPositionManagementV224?.(); } catch (_) {}
      });
    } catch (_) {}
  }
  window.addEventListener('click',event=>{
    const nav=event.target?.closest?.('[data-page]');
    if(!nav) return;
    const target=String(nav.getAttribute('data-page')||'');
    const current=String(S()?.page||'');
    if(target!=='positionManagement' && current!=='positionManagement') return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    if(!target) return;
    if(S()) S().page=target;
    closeSidebar();
    if(target==='positionManagement') renderPositionManagementImmediately();
    else { try { window.renderPage?.(); } catch (error) { console.warn(`${VERSION}: leave position management`,error); } }
  },true);

  /* ------------------------------------------------------------------
     5) Cumulative holiday balance + separate reset action
     ------------------------------------------------------------------ */
  function holidayResetMonth(person){
    const raw=person?.holiday_balance_reset_at;
    return raw ? normDate(raw).slice(0,7) : '';
  }
  function calculateDaysOffSafe(staffId,key,assignments){
    try { return Number(calculateDaysOff(staffId,key,assignments)||0); }
    catch (_) { return 0; }
  }
  function holidayBalanceMap(calc,key){
    const safe=monthKeySafe(key),people=calc.rows.map(row=>row.person),months=[...calc.monthly.keys()].sort(),packs=new Map();
    months.forEach(month=>{
      const pack=calc.monthly.get(month)||{rows:[]},values=new Map();
      people.forEach(person=>values.set(normId(person.id),calculateDaysOffSafe(person.id,month,pack.rows||[])));
      const avgs={MT:0,เคิก:0};
      ['MT','เคิก'].forEach(label=>{
        const eligible=people.filter(person=>groupLabel(person)===label&&!isLongLeave(person)&&(!holidayResetMonth(person)||month>=holidayResetMonth(person)));
        const list=eligible.map(person=>Number(values.get(normId(person.id))||0));
        avgs[label]=list.length?list.reduce((a,c)=>a+c,0)/list.length:0;
      });
      packs.set(month,{values,avgs});
    });
    const result=new Map();
    people.forEach(person=>{
      const id=normId(person.id),reset=holidayResetMonth(person),start=reset&&reset>calc.bounds.startKey?reset:calc.bounds.startKey;
      let carry=0;
      months.filter(month=>month<safe&&month>=start).forEach(month=>{
        const pack=packs.get(month);carry+=Number(pack?.values.get(id)||0)-Number(pack?.avgs?.[groupLabel(person)]||0);
      });
      const current=packs.get(safe),currentDays=Number(current?.values.get(id)||0),currentAvg=Number(current?.avgs?.[groupLabel(person)]||0);
      const currentGap=isLongLeave(person)?0:currentDays-currentAvg;
      result.set(id,{carry,currentDays,currentGap,cumulative:carry+currentGap,resetMonth:reset});
    });
    return result;
  }
  function fmt(n){ const x=Number(n||0);return Math.abs(x)<0.05?'0.0':x.toFixed(1); }
  function dutyStatus(row,key){
    if(isLongLeave(row.person)) return {text:'ลาระยะยาว / ไม่คิดหนี้เวร',tone:'black'};
    if(row.resetMonth===key&&Math.abs(row.cumulative)<=0.5) return {text:'เริ่มนับเวรใหม่เดือนนี้',tone:'blue'};
    if(Math.abs(row.cumulative)<=0.5) return {text:'สมดุลสะสม',tone:'green'};
    return row.cumulative>0?{text:'เวรสะสมมากกว่าเฉลี่ย',tone:'orange'}:{text:'เวรสะสมน้อยกว่าเฉลี่ย',tone:'blue'};
  }
  function renderAdminBalanceV278(assignments,key){
    const safe=monthKeySafe(key||S()?.monthKey),calc=window.cnmiV277?.cumulativeBalance?.(safe,assignments||[]);
    if(!calc) return '<div class="notice error-notice">ยังคำนวณยอดสะสมไม่ได้ กรุณารีเฟรชหน้า</div>';
    const holiday=holidayBalanceMap(calc,safe);
    const groups=['MT','เคิก'].map(label=>({label,rows:calc.rows.filter(row=>groupLabel(row.person)===label)})).filter(group=>group.rows.length);
    return `<div class="clean-balance-dashboard grouped-balance-dashboard v278-cumulative-dashboard">${groups.map(group=>{
      const avg=Number(calc.current?.avgs?.[group.label]||0);
      return `<section class="balance-group-section"><div class="section-title balance-group-title"><h3>กลุ่ม ${esc(group.label)}</h3><span>${badgeHtml(`ค่าเฉลี่ยเดือนนี้ ${avg.toFixed(1)} หน่วยเวร`,'blue')}</span></div><div class="table-wrap v278-balance-table-wrap"><table class="clean-balance-table v278-balance-table"><thead><tr><th>เจ้าหน้าที่</th><th>เวรรวม</th><th>หน่วยเวร</th><th>ชั่วโมงรวม</th><th>เงินประมาณ</th><th>Quota Gap</th><th>OT Balance ยกมา</th><th>เวรสะสม</th><th>วันหยุดเดือนนี้</th><th>วันหยุดสะสม</th><th>ชบด1</th><th>ชบด2</th><th>ชบด3</th><th>ช3A</th><th>ช3B</th><th>ช4</th><th>ช9</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${group.rows.map(row=>{
        const id=normId(row.person.id),h=holiday.get(id)||{carry:0,currentDays:0,resetMonth:''},status=dutyStatus(row,safe),dutyReset=row.resetMonth===safe,holidayReset=h.resetMonth===safe;
        return `<tr class="${isLongLeave(row.person)?'v278-exempt-row':''}"><td>${staffPillHtml(row.person)}</td><td>${row.counts.total}</td><td>${Number(row.units||0).toFixed(1)}</td><td>${Number(row.hours||0).toFixed(1)}</td><td>${Math.round(Number(row.pay||0)).toLocaleString()}</td><td class="${row.gap>0.5?'v278-positive':row.gap<-0.5?'v278-negative':''}">${fmt(row.gap)}</td><td class="${row.carry>0.5?'v278-positive':row.carry<-0.5?'v278-negative':''}">${fmt(row.carry)}</td><td class="${row.cumulative>0.5?'v278-positive':row.cumulative<-0.5?'v278-negative':''}">${fmt(row.cumulative)}</td><td>${h.currentDays}</td><td class="${Number(h.cumulative||0)>0.5?'v278-positive':Number(h.cumulative||0)<-0.5?'v278-negative':''}">${fmt(h.cumulative)}</td><td>${row.counts.chbd1}</td><td>${row.counts.chbd2}</td><td>${row.counts.chbd3}</td><td>${row.counts.ch3a}</td><td>${row.counts.ch3b}</td><td>${row.counts.ch4}</td><td>${row.counts.ch9}</td><td>${badgeHtml(status.text,status.tone)}${row.resetMonth?`<small class="v278-reset-note">เวรเริ่ม ${esc(row.resetMonth)}</small>`:''}${h.resetMonth?`<small class="v278-reset-note">วันหยุดเริ่ม ${esc(h.resetMonth)}</small>`:''}</td><td><div class="v278-action-stack"><button type="button" class="tiny-btn ${dutyReset?'danger':'warning'}" data-v277-balance-reset="${esc(id)}" data-v277-month="${esc(safe)}" data-v277-action="${dutyReset?'undo':'reset'}">${dutyReset?'ยกเลิกรีเซ็ตเวร':'เริ่มนับเวรใหม่เดือนนี้'}</button><button type="button" class="tiny-btn ${holidayReset?'danger':'soft'}" data-v278-holiday-reset="${esc(id)}" data-v278-month="${esc(safe)}" data-v278-action="${holidayReset?'undo':'reset'}">${holidayReset?'ยกเลิกรีเซ็ตวันหยุด':'เริ่มนับวันหยุดใหม่เดือนนี้'}</button></div></td></tr>`;
      }).join('')}</tbody></table></div></section>`;
    }).join('')}</div>`;
  }
  const previousBalance=window.renderBalanceDashboard || (typeof renderBalanceDashboard==='function'?renderBalanceDashboard:null);
  if(previousBalance){
    const enhanced=function renderBalanceDashboardV278(staffList,assignments,key){
      if(isAdminSafe()&&S()?.page==='scheduler') return renderAdminBalanceV278(assignments,key);
      return previousBalance.apply(this,arguments);
    };
    window.renderBalanceDashboard=enhanced;
    try { renderBalanceDashboard=enhanced; } catch (_) {}
  }
  async function setHolidayReset(staffId,key,action){
    const person=(S()?.staff||[]).find(row=>normId(row.id)===normId(staffId));
    if(!person||!DB()) return;
    const reset=action!=='undo';
    const message=reset?`ยืนยันเริ่มนับความสมดุลวันหยุดของ ${staffName(person)} ใหม่ตั้งแต่เดือน ${key} หรือไม่?\nผลต่างวันหยุดก่อนเดือนนี้จะไม่นำมาคิด`:`ยืนยันยกเลิกการเริ่มนับวันหยุดใหม่ของ ${staffName(person)} ในเดือน ${key} หรือไม่?`;
    if(!(await confirmDialog(message,'ยืนยันยอดวันหยุด'))) return;
    try{
      try { setBusy?.(true,'กำลังบันทึกการเริ่มนับวันหยุด'); } catch (_) {}
      const res=await DB().rpc('set_staff_holiday_balance_reset_month_v278',{p_staff_id:staffId,p_month_key:key,p_reset:reset});
      if(res.error) throw res.error;
      person.holiday_balance_reset_at=reset?`${key}-01T00:00:00.000Z`:null;
      toast(reset?'ตั้งให้เริ่มนับวันหยุดใหม่ในเดือนนี้แล้ว':'ยกเลิกการเริ่มนับวันหยุดใหม่แล้ว');
      try { window.renderPage?.(); } catch (_) {}
    }catch(error){ toast(`บันทึกไม่สำเร็จ: ${friendly(error)} — กรุณารัน SQL V278 ก่อน`,'error'); }
    finally { try { setBusy?.(false); } catch (_) {} }
  }

  /* ------------------------------------------------------------------
     Rendering and event integration
     ------------------------------------------------------------------ */
  function enhanceCurrentPage(){
    applyTemplateDropdowns();
    replaceAdminPositionStats();
  }
  function queueEnhance(){
    if(enhanceQueued) return;
    enhanceQueued=true;
    requestAnimationFrame(()=>{enhanceQueued=false;enhanceCurrentPage();});
  }
  const previousRender=window.renderPage || (typeof renderPage==='function'?renderPage:null);
  if(previousRender){
    const wrapped=function renderPageV278(){
      if(rendering) return previousRender.apply(this,arguments);
      rendering=true;let result;
      try { result=previousRender.apply(this,arguments); }
      finally { rendering=false; }
      setTimeout(enhanceCurrentPage,0);
      setTimeout(enhanceCurrentPage,100);
      return result;
    };
    window.renderPage=wrapped;
    try { renderPage=wrapped; } catch (_) {}
  }

  window.addEventListener('click',event=>{
    const summary=event.target?.closest?.('[data-v275-position-summary]');
    if(summary){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();showCompactPositionSummary(summary.dataset.v275PositionSummary);return;}
  },true);
  document.addEventListener('click',event=>{
    const btn=event.target?.closest?.('[data-v278-holiday-reset]');
    if(!btn) return;
    event.preventDefault();event.stopImmediatePropagation();
    setHolidayReset(btn.dataset.v278HolidayReset,btn.dataset.v278Month,btn.dataset.v278Action);
  },true);
  document.addEventListener('input',event=>{
    if(event.target?.matches?.('[data-v275-slot]')) setTimeout(applyTemplateDropdowns,450);
  },true);
  document.addEventListener('change',event=>{
    if(event.target?.matches?.('[data-v275-slot]')) setTimeout(applyTemplateDropdowns,450);
  },true);

  const style=document.createElement('style');
  style.id='v278-slot-stats-holiday-style';
  style.textContent=`
    .v278-admin-position-stats{display:grid;gap:12px;min-width:0}
    .v278-stats-heading{padding:4px 2px}
    .v278-stat-grid{display:grid;grid-template-columns:1fr;gap:12px;min-width:0}
    .v278-position-stat-card{min-width:0;margin:0!important}
    .v278-stat-scroll{display:block;width:100%;max-width:100%;overflow:auto;overscroll-behavior:contain;position:relative}
    .v278-stat-table{border-collapse:separate;border-spacing:0;width:max-content;min-width:100%;font-size:10px}
    .v278-stat-table th,.v278-stat-table td{padding:6px 8px;border-right:1px solid #e5eaf1;border-bottom:1px solid #e5eaf1;text-align:center;white-space:nowrap;background:#fff}
    .v278-stat-table thead th{position:sticky;top:0;z-index:4;background:#f8fafc}
    .v278-stat-table tr>:first-child{position:sticky;left:0;z-index:3;text-align:left;background:#fff;box-shadow:3px 0 5px rgba(15,23,42,.08)}
    .v278-stat-table thead tr>:first-child{z-index:6;background:#f8fafc}
    .v278-position-detail-table th:not(:first-child){max-width:120px;overflow:hidden;text-overflow:ellipsis}
    .v278-staff-pill{display:inline-flex;border-radius:999px;padding:3px 8px;background:var(--staff-bg);color:var(--staff-fg);font-weight:900}
    .v278-room-summary{display:grid;grid-template-columns:repeat(4,minmax(90px,1fr));gap:8px;margin:12px 0}
    .v278-room-summary span{border:1px solid #dbeafe;background:#f8fbff;border-radius:10px;padding:9px;text-align:center}
    .v278-popup-position-list{display:grid;gap:6px}
    .v278-popup-position-list>div{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #eef2f7;padding:6px 0}
    .v278-balance-table-wrap{max-width:100%;overflow:auto}
    .v278-balance-table{min-width:1660px;font-size:10px}
    .v278-balance-table th,.v278-balance-table td{padding:6px 7px;text-align:center;vertical-align:middle;white-space:nowrap}
    .v278-balance-table th:first-child,.v278-balance-table td:first-child{position:sticky;left:0;z-index:3;background:#fff;text-align:left;box-shadow:3px 0 5px rgba(15,23,42,.08)}
    .v278-balance-table thead th:first-child{z-index:5;background:#f6f9fc}
    .v278-positive{color:#b45309;font-weight:900}.v278-negative{color:#1d70b7;font-weight:900}
    .v278-action-stack{display:flex;flex-direction:column;gap:4px;min-width:150px}
    .v278-reset-note{display:block;margin-top:2px;color:#64748b;font-size:8px}
    .v278-exempt-row{opacity:.72}
    @media(min-width:1280px){.v278-stat-grid{grid-template-columns:1fr 1fr}.v278-position-stat-card:nth-child(2),.v278-position-stat-card:nth-child(4){grid-column:1/-1}}
    @media(max-width:820px){.v278-room-summary{grid-template-columns:1fr 1fr}.v278-stat-table{font-size:9px}.v278-action-stack{min-width:132px}}
  `;
  document.head.appendChild(style);

  const observer=new MutationObserver(queueEnhance);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener('DOMContentLoaded',()=>{setTimeout(enhanceCurrentPage,100);setTimeout(ensureTemplateConfigs,180);});
  setTimeout(enhanceCurrentPage,0);
  setTimeout(ensureTemplateConfigs,220);

  window.cnmiV278={
    applyTemplateDropdowns,
    templateRowsForDate,
    loadLifetimePositions,
    refreshAdminPositionStats,
    showCompactPositionSummary,
    holidayBalanceMap,
    setHolidayReset
  };
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v278-slot-stats-holiday-balance-navigation-fix.js", error); }
;

/* Original source: patch-v279-duty-pair-summary.js */
try {
/* CNMI Staff Planner V279
   Admin monthly roster: add "ดูคู่เวร" column and a four-section co-duty popup.
   This patch is read-only. It does not change roster assignments, balances, validators, or database data.
*/
(function(){
  'use strict';

  const VERSION = 'V279_DUTY_PAIR_SUMMARY';
  if (window.__CNMI_V279_DUTY_PAIR_SUMMARY__) return;
  window.__CNMI_V279_DUTY_PAIR_SUMMARY__ = true;

  function S(){
    try { return state || window.state || null; }
    catch (_) { return window.state || null; }
  }
  function esc(value){
    try { return escapeHtml(value == null ? '' : String(value)); }
    catch (_) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
      }[char]));
    }
  }
  function normId(value){ return String(value == null ? '' : value); }
  function normDate(value){
    try { return normalizeDateKey(value); }
    catch (_) { return String(value || '').slice(0,10); }
  }
  function safeMonthKey(value){
    return /^\d{4}-\d{2}$/.test(String(value || ''))
      ? String(value)
      : new Date().toISOString().slice(0,7);
  }
  function explicitFalse(value){
    return value === false || ['false','0','no','off','ปิด'].includes(String(value ?? '').trim().toLowerCase());
  }
  function isAdminSafe(){
    try { return !!isAdmin(); }
    catch (_) { return String(S()?.profile?.role || '').trim().toLowerCase() === 'admin'; }
  }
  function staffName(personOrId){
    const person = typeof personOrId === 'object'
      ? personOrId
      : (S()?.staff || []).find(row => normId(row?.id) === normId(personOrId));
    return person ? (person.nickname || person.full_name || person.email || '-') : '-';
  }
  function isRosterEnabled(person){
    if (!person) return false;
    const active = Object.prototype.hasOwnProperty.call(person,'is_active') ? person.is_active : person.active;
    if (active == null || explicitFalse(active)) return false;
    if (String(person.staff_type || '').trim() === 'แพทย์') return false;
    if (person.maternity_status) return false;
    const value = person.roster_enabled
      ?? person.duty_enabled
      ?? person.can_roster
      ?? person.is_roster_enabled
      ?? person.schedule_enabled
      ?? person.is_schedule_enabled
      ?? person['สถานะจัดเวร'];
    return !explicitFalse(value);
  }
  function ordered(rows){
    try { return orderedStaff(rows); }
    catch (_) { return rows.slice().sort((a,b) => staffName(a).localeCompare(staffName(b),'th')); }
  }
  function rosterStaff(){ return ordered((S()?.staff || []).filter(isRosterEnabled)); }
  function groupLabel(person){ return String(person?.staff_type || '').trim() === 'เคิก' ? 'เคิก' : 'MT'; }

  function currentMonthAssignments(monthKey){
    const key = safeMonthKey(monthKey);
    try {
      const rows = getAssignmentsForMonth(key);
      if (Array.isArray(rows)) return rows.filter(row => row?.staff_id && normDate(row?.duty_date).startsWith(key));
    } catch (_) {}

    const draft = S()?.rosterDraft;
    const source = draft?.monthKey === key && Array.isArray(draft.assignments)
      ? draft.assignments
      : (S()?.rosterAssignments || []);
    return source.filter(row => row?.staff_id && normDate(row?.duty_date).startsWith(key));
  }

  const PAIR_GROUPS = [
    {
      key:'chbd',
      title:'คู่เวร ชบด1-2-3',
      matches: code => ['ชบด1','ชบด2','ชบด3'].includes(String(code || '').trim())
    },
    {
      key:'ch3',
      title:'คู่เวร ช3A-ช3B',
      matches: code => ['ช3A','ช3B'].includes(String(code || '').trim())
    },
    {
      key:'ch4',
      title:'คู่เวร ช4',
      matches: code => String(code || '').trim().startsWith('ช4')
    },
    {
      key:'all',
      title:'คู่เวรภาพรวม',
      matches: code => !!String(code || '').trim()
    }
  ];

  function dateSetFor(rows, staffId, matcher){
    const result = new Set();
    (rows || []).forEach(row => {
      if (normId(row?.staff_id) !== normId(staffId)) return;
      if (!matcher(row?.duty_code)) return;
      const date = normDate(row?.duty_date);
      if (date) result.add(date);
    });
    return result;
  }
  function intersectCount(left,right){
    if (!left?.size || !right?.size) return 0;
    let small = left, large = right;
    if (left.size > right.size) { small = right; large = left; }
    let total = 0;
    small.forEach(value => { if (large.has(value)) total += 1; });
    return total;
  }

  function pairStats(staffId, monthKey, rows){
    const assignments = Array.isArray(rows) ? rows : currentMonthAssignments(monthKey);
    const people = rosterStaff().filter(person => normId(person.id) !== normId(staffId));
    const result = {};

    PAIR_GROUPS.forEach(group => {
      const ownDates = dateSetFor(assignments, staffId, group.matches);
      result[group.key] = people.map(person => ({
        person,
        days: intersectCount(ownDates, dateSetFor(assignments, person.id, group.matches))
      })).sort((a,b) => b.days - a.days || staffName(a.person).localeCompare(staffName(b.person),'th'));
    });
    return result;
  }

  function pairColumnHtml(group, rows){
    const list = rows || [];
    return `<section class="v279-pair-section">
      <div class="v279-pair-section-head">
        <h3>${esc(group.title)}</h3>
      </div>
      <div class="v279-pair-list">
        ${list.length ? list.map(item => `<div class="v279-pair-row">
          <span>${esc(staffName(item.person))}</span>
          <b class="${item.days > 0 ? 'has-days' : 'no-days'}">${item.days} วัน</b>
        </div>`).join('') : '<div class="v279-pair-empty">ไม่มีเจ้าหน้าที่ในกลุ่มนี้</div>'}
      </div>
    </section>`;
  }

  function showDutyPairPopup(staffId, monthKey){
    const person = (S()?.staff || []).find(row => normId(row?.id) === normId(staffId));
    if (!person) return;
    const key = safeMonthKey(monthKey || S()?.monthKey);
    const stats = pairStats(staffId,key);
    const body = `<div class="v279-pair-popup">
      <div class="v279-pair-title">
        <div>
          <h2>ดูคู่เวรของ ${esc(staffName(person))}</h2>
          <p>จำนวนวันที่อยู่เวรวันเดียวกันในเดือน ${esc(key)}</p>
        </div>
      </div>
      <div class="v279-pair-grid">
        ${PAIR_GROUPS.map(group => pairColumnHtml(group,stats[group.key])).join('')}
      </div>
    </div>`;

    try { showModal(body,{large:true}); }
    catch (_) {
      const modal = document.getElementById('modal');
      const modalBody = document.getElementById('modalBody');
      if (modal && modalBody) {
        modalBody.innerHTML = body;
        modal.classList.remove('hidden');
        document.body.classList.add('modal-open');
      }
    }
  }

  function matchPersonFromRow(row, groupPeople, usedIds){
    const cellText = String(row?.cells?.[0]?.textContent || '').trim();
    const exact = groupPeople.find(person => !usedIds.has(normId(person.id)) && staffName(person) === cellText);
    if (exact) return exact;
    const contained = groupPeople.find(person => !usedIds.has(normId(person.id)) && cellText.includes(staffName(person)));
    if (contained) return contained;
    return groupPeople.find(person => !usedIds.has(normId(person.id))) || null;
  }

  function enhanceBalanceHtml(html, monthKey){
    if (!isAdminSafe() || S()?.page !== 'scheduler' || typeof html !== 'string' || !html.includes('v278-balance-table')) return html;

    const holder = document.createElement('div');
    holder.innerHTML = html;
    const sections = holder.querySelectorAll('.balance-group-section');
    const people = rosterStaff();
    const key = safeMonthKey(monthKey || S()?.monthKey);

    sections.forEach(section => {
      const table = section.querySelector('table.v278-balance-table');
      if (!table || table.dataset.v279PairReady === '1') return;
      const labelText = String(section.querySelector('.balance-group-title h3')?.textContent || '');
      const label = labelText.includes('เคิก') ? 'เคิก' : 'MT';
      const groupPeople = people.filter(person => groupLabel(person) === label);
      const headerRow = table.tHead?.rows?.[0];
      if (!headerRow) return;
      const headers = Array.from(headerRow.cells);
      const statusIndex = headers.findIndex(cell => String(cell.textContent || '').trim() === 'สถานะ');
      if (statusIndex < 0) return;

      const th = document.createElement('th');
      th.textContent = 'ดูคู่เวร';
      th.className = 'v279-pair-column';
      headerRow.insertBefore(th,headerRow.cells[statusIndex]);

      const usedIds = new Set();
      Array.from(table.tBodies?.[0]?.rows || []).forEach(row => {
        const person = matchPersonFromRow(row,groupPeople,usedIds);
        if (person) usedIds.add(normId(person.id));
        const td = document.createElement('td');
        td.className = 'v279-pair-column';
        td.innerHTML = person
          ? `<button type="button" class="tiny-btn soft v279-pair-button" data-v279-duty-pair="${esc(person.id)}" data-v279-month="${esc(key)}">ดูคู่เวร</button>`
          : '-';
        row.insertBefore(td,row.cells[statusIndex]);
      });
      table.dataset.v279PairReady = '1';
    });

    return holder.innerHTML;
  }

  const previousBalance = window.renderBalanceDashboard || (typeof renderBalanceDashboard === 'function' ? renderBalanceDashboard : null);
  if (previousBalance) {
    const enhanced = function renderBalanceDashboardV279(staffList,assignments,key){
      const html = previousBalance.apply(this,arguments);
      return enhanceBalanceHtml(html,key);
    };
    window.renderBalanceDashboard = enhanced;
    try { renderBalanceDashboard = enhanced; } catch (_) {}
  }

  document.addEventListener('click',event => {
    const button = event.target?.closest?.('[data-v279-duty-pair]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    showDutyPairPopup(button.dataset.v279DutyPair,button.dataset.v279Month);
  },true);

  const style = document.createElement('style');
  style.id = 'v279-duty-pair-style';
  style.textContent = `
    .v279-pair-column{min-width:82px;text-align:center!important}
    .v279-pair-button{white-space:nowrap;font-weight:800}
    .v279-pair-popup{display:grid;gap:14px;min-width:0}
    .v279-pair-title h2{margin:0 0 4px;font-size:22px}
    .v279-pair-title p{margin:0;color:#64748b}
    .v279-pair-grid{display:grid;grid-template-columns:repeat(4,minmax(190px,1fr));gap:12px;align-items:start}
    .v279-pair-section{border:1px solid #dbe4ef;border-radius:14px;background:#fff;overflow:hidden;min-width:0}
    .v279-pair-section-head{padding:11px 12px;background:#f7fafc;border-bottom:1px solid #e5eaf1}
    .v279-pair-section-head h3{margin:0;font-size:14px;color:#18324a}
    .v279-pair-list{max-height:430px;overflow:auto;overscroll-behavior:contain}
    .v279-pair-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;border-bottom:1px solid #eef2f7;font-size:13px}
    .v279-pair-row:last-child{border-bottom:0}
    .v279-pair-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .v279-pair-row b{flex:0 0 auto;min-width:48px;text-align:center;border-radius:999px;padding:3px 7px}
    .v279-pair-row b.has-days{background:#dff5e9;color:#137047}
    .v279-pair-row b.no-days{background:#f1f5f9;color:#64748b}
    .v279-pair-empty{padding:18px 12px;color:#64748b;text-align:center}
    @media(max-width:960px){.v279-pair-grid{grid-template-columns:repeat(2,minmax(180px,1fr))}}
    @media(max-width:560px){.v279-pair-grid{grid-template-columns:1fr}.v279-pair-list{max-height:260px}}
  `;
  document.head.appendChild(style);

  window.cnmiV279 = {
    pairStats,
    showDutyPairPopup,
    enhanceBalanceHtml
  };

  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v279-duty-pair-summary.js", error); }
;

/* Original source: patch-v281-position-admin-compact-stats-tabs.js */
try {
/* CNMI Staff Planner V281
   Admin monthly daytime-position usability only.
   - Compact person x date matrix to show more staff/days at once.
   - Keep all existing position save, slot, trainee and Supabase logic unchanged.
   - Organize the four Admin statistics tables as one-tab-at-a-time views.
   - Hide all-zero position columns by default, with a view toggle.
*/
(function(){
  'use strict';
  const VERSION='V281_POSITION_ADMIN_COMPACT_STATS_TABS';
  if(window.__CNMI_V281_POSITION_ADMIN_COMPACT_STATS_TABS__) return;
  window.__CNMI_V281_POSITION_ADMIN_COMPACT_STATS_TABS__=true;

  let queued=false;
  let relaxed=false;
  let activeStat=0;
  let showZeroColumns=false;

  function S(){
    try{return state||window.state||null;}catch(_){return window.state||null;}
  }
  function isAdminSafe(){
    try{return !!isAdmin();}catch(_){return String(S()?.profile?.role||'').trim().toLowerCase()==='admin';}
  }
  function isTargetPage(){return S()?.page==='positionMonth'&&isAdminSafe();}

  function addDensityControl(page){
    /* V291: fixed compact table; remove the old expand-density control. */
    page?.querySelectorAll?.('[data-v281-density]').forEach(button=>button.remove());
  }

  function applyMatrixMode(){
    if(!isTargetPage()) return;
    const page=document.querySelector('.v275-page');
    const wrap=page?.querySelector('.v275-position-wrap');
    if(!page||!wrap) return;
    page.classList.add('v281-admin-position-page');
    wrap.classList.add('v281-compact-position-wrap');
    relaxed=false;
    page.classList.remove('v281-relaxed');
    addDensityControl(page);
  }

  function setColumnVisible(table,index,visible){
    if(!table||index<0) return;
    Array.from(table.rows||[]).forEach(row=>{
      const cell=row.cells?.[index];
      if(cell) cell.classList.toggle('v281-hidden-zero-column',!visible);
    });
  }

  function applyZeroColumnFilter(section){
    const table=section?.querySelector('.v278-position-detail-table');
    if(!table) return;
    const header=table.tHead?.rows?.[0];
    if(!header) return;
    const columnCount=header.cells.length;
    for(let index=1;index<columnCount-1;index++){
      let hasValue=false;
      Array.from(table.tBodies?.[0]?.rows||[]).forEach(row=>{
        const raw=String(row.cells?.[index]?.textContent||'').replace(/,/g,'').trim();
        const value=Number(raw);
        if(Number.isFinite(value)&&value!==0) hasValue=true;
      });
      setColumnVisible(table,index,showZeroColumns||hasValue);
    }
  }

  function statTabLabel(index){
    return [
      ['ห้อง · เดือนนี้','BB / Donor / ออกหน่วย'],
      ['ตำแหน่ง · เดือนนี้','เฉพาะตำแหน่งที่มีข้อมูล'],
      ['ห้อง · สะสม','ข้อมูลทั้งหมด'],
      ['ตำแหน่ง · สะสม','ข้อมูลทั้งหมด']
    ][index]||[`ตาราง ${index+1}`,''];
  }

  function buildStatsControls(stats,sections){
    let controls=stats.querySelector('.v281-stat-controls');
    if(!controls){
      controls=document.createElement('div');
      controls.className='v281-stat-controls';
      const heading=stats.querySelector('.v278-stats-heading');
      heading?.insertAdjacentElement('afterend',controls);
    }
    const markup=`<div class="v281-stat-tabs" role="tablist" aria-label="เลือกสถิติตำแหน่ง">
      ${sections.map((_,index)=>{const [title,sub]=statTabLabel(index);return `<button type="button" role="tab" data-v281-stat-tab="${index}" class="${index===activeStat?'active':''}" aria-selected="${index===activeStat?'true':'false'}"><b>${title}</b><small>${sub}</small></button>`;}).join('')}
    </div>
    <label class="v281-zero-toggle" ${activeStat===1||activeStat===3?'':'hidden'}>
      <input type="checkbox" data-v281-show-zero ${showZeroColumns?'checked':''}>
      <span>แสดงตำแหน่งที่เป็น 0 ทุกคอลัมน์</span>
    </label>`;
    const signature=`${sections.length}|${activeStat}|${showZeroColumns?'1':'0'}`;
    if(controls.dataset.v281Signature!==signature){
      controls.innerHTML=markup;
      controls.dataset.v281Signature=signature;
    }
  }

  function applyStatsView(){
    if(!isTargetPage()) return;
    const stats=document.querySelector('.v278-admin-position-stats');
    const grid=stats?.querySelector('.v278-stat-grid');
    if(!stats||!grid) return;
    stats.classList.add('v281-organized-stats');
    const sections=Array.from(grid.querySelectorAll(':scope > .v278-position-stat-card'));
    if(!sections.length) return;
    if(activeStat>=sections.length) activeStat=0;
    buildStatsControls(stats,sections);
    sections.forEach((section,index)=>{
      section.dataset.v281StatIndex=String(index);
      section.hidden=index!==activeStat;
      section.classList.toggle('v281-active-stat',index===activeStat);
      if(index===1||index===3) applyZeroColumnFilter(section);
      const scroll=section.querySelector('.v278-stat-scroll');
      if(scroll) scroll.setAttribute('tabindex','0');
    });
  }

  function enhance(){
    applyMatrixMode();
    applyStatsView();
  }
  function queueEnhance(){
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;enhance();});
  }

  document.addEventListener('click',event=>{
    const density=event.target?.closest?.('[data-v281-density]');
    if(density){
      event.preventDefault();
      density.remove();
      return;
    }
    const tab=event.target?.closest?.('[data-v281-stat-tab]');
    if(tab){
      event.preventDefault();
      activeStat=Math.max(0,Number(tab.dataset.v281StatTab)||0);
      applyStatsView();
    }
  },true);

  document.addEventListener('change',event=>{
    if(!event.target?.matches?.('[data-v281-show-zero]')) return;
    showZeroColumns=!!event.target.checked;
    applyStatsView();
  },true);

  const style=document.createElement('style');
  style.id='v281-position-admin-compact-stats-style';
  style.textContent=`
    /* ---------- Compact Admin person x date matrix ---------- */
    .v281-admin-position-page .v275-position-pool{
      flex-wrap:nowrap!important;
      overflow-x:auto!important;
      overflow-y:hidden!important;
      padding:4px 6px!important;
      gap:4px!important;
      min-height:34px!important;
      scrollbar-width:thin;
    }
    .v281-admin-position-page .v275-position-pool>b{flex:0 0 auto;font-size:9px!important}
    .v281-admin-position-page .v275-position-pool span{
      flex:0 0 auto!important;
      padding:3px 6px!important;
      font-size:7.5px!important;
      line-height:1.15!important;
    }
    .v281-admin-position-page .soft-notice{
      margin-top:6px!important;
      padding:6px 10px!important;
      font-size:9px!important;
      line-height:1.25!important;
    }
    .v281-admin-position-page .v281-compact-position-wrap{
      --v276-position-name-width:70px!important;
      width:100%!important;
      max-width:100%!important;
      max-height:max(500px,calc(100vh - 245px))!important;
      overflow:auto!important;
      scrollbar-width:thin;
    }
    .v281-admin-position-page .v275-position-table{
      font-size:7.5px!important;
      line-height:1.05!important;
    }
    .v281-admin-position-page .v275-position-table th,
    .v281-admin-position-page .v275-position-table td{
      padding:1px!important;
      min-width:54px!important;
      width:54px!important;
      max-width:54px!important;
    }
    .v281-admin-position-page .v275-position-table tr>:nth-child(1){
      width:70px!important;min-width:70px!important;max-width:70px!important;
    }
    .v281-admin-position-page .v275-position-table tr>:nth-child(2){
      left:70px!important;
      width:86px!important;min-width:86px!important;max-width:86px!important;
    }
    .v281-admin-position-page .v275-sticky-name b{font-size:8px!important;padding:1px!important;line-height:1.05!important}
    .v281-admin-position-page .v275-sticky-name small{font-size:6.5px!important;line-height:1!important}
    .v281-admin-position-page .v275-summary-cell{padding:0 2px!important}
    .v281-admin-position-page .v275-summary-cell>b{font-size:7.5px!important;line-height:1.05!important}
    .v281-admin-position-page .v275-date-head b{font-size:8px!important;line-height:1!important}
    .v281-admin-position-page .v275-date-head small{font-size:6.5px!important;line-height:1!important}
    .v281-admin-position-page .v275-date-head em{
      max-width:52px!important;font-size:5.8px!important;line-height:1!important;
    }
    .v281-admin-position-page .v275-position-table tbody tr:not(.v275-count-row)>th,
    .v281-admin-position-page .v275-position-table tbody tr:not(.v275-count-row)>td,
    .v281-admin-position-page .v275-position-day{
      height:29px!important;min-height:29px!important;max-height:29px!important;
    }
    .v281-admin-position-page .v275-count-row>th,
    .v281-admin-position-page .v275-count-row>td{height:31px!important;min-height:31px!important}
    .v281-admin-position-page .v275-count-row input[data-v275-slot]{
      width:25px!important;height:23px!important;padding:1px!important;font-size:8px!important;border-radius:5px!important;
    }
    .v281-admin-position-page .v275-position-cell{
      display:block!important;position:relative!important;width:100%!important;min-width:0!important;
    }
    .v281-admin-position-page .v275-position-cell select,
    .v281-admin-position-page .v275-mentor-cell select{
      display:block!important;width:100%!important;min-width:0!important;height:25px!important;
      padding:1px 14px 1px 2px!important;border-radius:5px!important;font-size:7px!important;
      line-height:1!important;text-overflow:ellipsis!important;
    }
    .v281-admin-position-page .v275-info{
      position:absolute!important;right:1px!important;top:1px!important;width:13px!important;height:13px!important;
      min-width:13px!important;padding:0!important;border-radius:4px!important;font-size:6px!important;line-height:13px!important;
    }
    .v281-admin-position-page .v275-position-day.leave .badge,
    .v281-admin-position-page .v275-position-day.leave span{
      font-size:6.5px!important;padding:2px 4px!important;line-height:1!important;
    }
    .v281-admin-position-page .v275-mentor-cell{gap:0!important;line-height:1!important}
    .v281-admin-position-page .v275-mentor-cell span,
    .v281-admin-position-page .v275-mentor-cell small{font-size:5.8px!important;line-height:1!important}
    .v281-density-btn{white-space:nowrap}

    /* Optional expanded view; no data or save logic changes. */
    .v281-admin-position-page.v281-relaxed .v275-position-table{font-size:9px!important}
    .v281-admin-position-page.v281-relaxed .v275-position-table th,
    .v281-admin-position-page.v281-relaxed .v275-position-table td{min-width:72px!important;width:72px!important;max-width:72px!important;padding:2px!important}
    .v281-admin-position-page.v281-relaxed .v275-position-table tr>:nth-child(1){width:84px!important;min-width:84px!important;max-width:84px!important}
    .v281-admin-position-page.v281-relaxed .v275-position-table tr>:nth-child(2){left:84px!important;width:110px!important;min-width:110px!important;max-width:110px!important}
    .v281-admin-position-page.v281-relaxed .v275-position-table tbody tr:not(.v275-count-row)>th,
    .v281-admin-position-page.v281-relaxed .v275-position-table tbody tr:not(.v275-count-row)>td,
    .v281-admin-position-page.v281-relaxed .v275-position-day{height:38px!important;min-height:38px!important;max-height:38px!important}
    .v281-admin-position-page.v281-relaxed .v275-position-cell select,
    .v281-admin-position-page.v281-relaxed .v275-mentor-cell select{height:31px!important;font-size:8.5px!important}

    /* ---------- Four statistics tables, organized as tabs ---------- */
    .v281-organized-stats{display:grid!important;gap:8px!important;min-width:0!important}
    .v281-organized-stats .v278-stats-heading{margin:0!important;padding:2px 0!important}
    .v281-organized-stats .v278-stats-heading h2{font-size:17px!important;margin:0!important}
    .v281-organized-stats .v278-stats-heading .hint{font-size:9px!important;margin:2px 0 0!important}
    .v281-stat-controls{
      display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;
      padding:7px;border:1px solid #dbeafe;border-radius:12px;background:#f8fbff;
    }
    .v281-stat-tabs{display:flex;gap:5px;flex-wrap:wrap;min-width:0}
    .v281-stat-tabs button{
      border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:9px;padding:5px 9px;
      display:grid;gap:1px;text-align:left;cursor:pointer;min-width:126px;
    }
    .v281-stat-tabs button b{font-size:10px;line-height:1.15}
    .v281-stat-tabs button small{font-size:7.5px;color:#64748b;line-height:1.1}
    .v281-stat-tabs button.active{background:#dbeafe;border-color:#60a5fa;color:#1d4ed8;box-shadow:0 0 0 1px rgba(37,99,235,.08)}
    .v281-zero-toggle{display:flex;align-items:center;gap:5px;font-size:9px;color:#475569;white-space:nowrap}
    .v281-zero-toggle[hidden]{display:none!important}
    .v281-zero-toggle input{width:15px;height:15px}
    .v281-organized-stats .v278-stat-grid{display:block!important;min-width:0!important}
    .v281-organized-stats .v278-position-stat-card{padding:10px!important;border-radius:12px!important}
    .v281-organized-stats .v278-position-stat-card[hidden]{display:none!important}
    .v281-organized-stats .v278-position-stat-card .section-title{margin-bottom:5px!important}
    .v281-organized-stats .v278-position-stat-card h3{font-size:13px!important;margin:0!important}
    .v281-organized-stats .v278-position-stat-card .hint{font-size:8px!important;margin:1px 0 0!important}
    .v281-organized-stats .v278-stat-scroll{
      max-height:min(58vh,560px)!important;overflow:auto!important;border:1px solid #e5eaf1;border-radius:8px;
      scrollbar-width:thin;
    }
    .v281-organized-stats .v278-stat-table{font-size:8px!important;line-height:1.05!important}
    .v281-organized-stats .v278-stat-table th,
    .v281-organized-stats .v278-stat-table td{padding:3px 5px!important;height:24px!important}
    .v281-organized-stats .v278-stat-table th{font-size:7.5px!important}
    .v281-organized-stats .v278-staff-pill{padding:2px 6px!important;font-size:8px!important}
    .v281-hidden-zero-column{display:none!important}

    @media(max-width:820px){
      .v281-admin-position-page .v281-compact-position-wrap{
        --v276-position-name-width:62px!important;
        max-height:max(430px,calc(100vh - 205px))!important;
      }
      .v281-admin-position-page .v275-position-table tr>:nth-child(1){width:62px!important;min-width:62px!important;max-width:62px!important}
      .v281-admin-position-page .v275-position-table tr>:nth-child(2){left:62px!important;width:78px!important;min-width:78px!important;max-width:78px!important}
      .v281-admin-position-page .v275-position-table th,
      .v281-admin-position-page .v275-position-table td{min-width:50px!important;width:50px!important;max-width:50px!important}
      .v281-admin-position-page .v275-position-cell select,
      .v281-admin-position-page .v275-mentor-cell select{font-size:6.5px!important;height:24px!important}
      .v281-stat-tabs{display:grid;grid-template-columns:1fr 1fr;width:100%}
      .v281-stat-tabs button{min-width:0;padding:5px 7px}
      .v281-zero-toggle{width:100%}
      .v281-organized-stats .v278-stat-scroll{max-height:52vh!important}
    }
  `;
  document.head.appendChild(style);

  const observer=new MutationObserver(mutations=>{
    if(!isTargetPage()) return;
    const structural=mutations.some(mutation=>Array.from(mutation.addedNodes||[]).some(node=>{
      if(node?.nodeType!==1) return false;
      return node.matches?.('.v275-page,.v275-position-wrap,.v278-admin-position-stats')||
        !!node.querySelector?.('.v275-position-wrap,.v278-admin-position-stats');
    }));
    if(structural) queueEnhance();
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('resize',queueEnhance,{passive:true});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(enhance,80));
  setTimeout(enhance,0);
  setTimeout(enhance,180);
  setTimeout(enhance,600);

  window.cnmiV281={enhance,applyMatrixMode,applyStatsView};
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v281-position-admin-compact-stats-tabs.js", error); }
;

/* Original source: patch-v282-position-management-interaction-recovery.js */
try {
/* CNMI Staff Planner V282
   Position Management interaction recovery.
   Scope:
   - Keep the existing Slot CRUD / Supabase logic unchanged.
   - Render the Slot page through one stable route instead of stacking legacy tab renderers.
   - Prevent MutationObserver self-rerender loops that can freeze clicks after opening Position Management.
   - Keep navigation and all buttons usable after entering/leaving this page.
*/
(function(){
  'use strict';
  const VERSION='V282_POSITION_MANAGEMENT_INTERACTION_RECOVERY';
  if(window.__CNMI_V282_POSITION_MANAGEMENT_INTERACTION_RECOVERY__) return;
  window.__CNMI_V282_POSITION_MANAGEMENT_INTERACTION_RECOVERY__=true;

  let rendering=false;
  let configLoadStarted=false;
  let recoveryQueued=false;

  function S(){
    try{return state||window.state||null;}
    catch(_){return window.state||null;}
  }
  function isPositionManagement(){return String(S()?.page||'')==='positionManagement';}
  function closeTransientUi(){
    try{
      const modal=document.getElementById('modal');
      if(modal?.classList.contains('hidden')) document.body.classList.remove('modal-open');
      if(window.innerWidth>820){
        document.body.classList.remove('sidebar-open');
        document.getElementById('sidebar')?.classList.remove('open');
      }
    }catch(_){}
  }
  function setHeader(){
    try{
      const title=document.getElementById('pageTitle');
      const subtitle=document.getElementById('pageSubtitle');
      if(title && title.textContent!=='จัดการตำแหน่ง') title.textContent='จัดการตำแหน่ง';
      if(subtitle && subtitle.textContent!=='จัดการชุด Slot ตำแหน่งกลางวัน') subtitle.textContent='จัดการชุด Slot ตำแหน่งกลางวัน';
    }catch(_){}
  }
  function renderNavSafe(){
    try{ if(typeof renderNav==='function') renderNav(); }
    catch(error){ console.warn(`${VERSION}: renderNav skipped`,error); }
  }
  function renderSlotPage(){
    const root=document.getElementById('pageContent');
    if(!root || !isPositionManagement()) return false;
    try{
      if(window.cnmiV224?.renderPositionManagementV224){
        window.cnmiV224.renderPositionManagementV224();
        return true;
      }
    }catch(error){console.warn(`${VERSION}: V224 render skipped`,error);}
    return false;
  }
  function decorateStablePage(){
    if(!isPositionManagement()) return;
    const root=document.getElementById('pageContent');
    if(!root) return;
    root.classList.add('v282-position-management-root');
    root.querySelectorAll('.v244-position-management-page').forEach(wrapper=>{
      const slot=wrapper.querySelector('.v224-position-template-page,.position-management-page');
      if(slot && wrapper.parentNode){
        wrapper.parentNode.replaceChild(slot,wrapper);
      }
    });
    root.querySelectorAll('.v224-position-template-page,.position-management-page').forEach(page=>page.classList.add('v282-position-management-stable'));
    closeTransientUi();
  }
  function loadConfigOnce(){
    if(configLoadStarted || !isPositionManagement()) return;
    const load=window.cnmiV224?.loadDbConfigs;
    if(typeof load!=='function') return;
    configLoadStarted=true;
    Promise.resolve().then(()=>load(false)).catch(error=>{
      console.warn(`${VERSION}: background Slot load skipped`,error);
    }).finally(()=>{
      configLoadStarted=false;
      if(!isPositionManagement()) return;
      renderSlotPage();
      decorateStablePage();
    });
  }
  function renderStablePositionManagement(){
    if(!isPositionManagement() || rendering) return;
    rendering=true;
    try{
      renderNavSafe();
      setHeader();
      if(!renderSlotPage()){
        const root=document.getElementById('pageContent');
        if(root) root.innerHTML='<div class="card"><h3>จัดการตำแหน่ง</h3><p class="hint">กำลังเตรียมหน้าจัดการ Slot…</p></div>';
      }
      decorateStablePage();
      loadConfigOnce();
    }finally{rendering=false;}
  }
  function queueRecovery(){
    if(recoveryQueued || !isPositionManagement()) return;
    recoveryQueued=true;
    requestAnimationFrame(()=>{
      recoveryQueued=false;
      if(!isPositionManagement()) return;
      const root=document.getElementById('pageContent');
      const hasStable=!!root?.querySelector('.v224-position-template-page,.position-management-page');
      const hasLegacyWrapper=!!root?.querySelector('.v244-position-management-page');
      if(!hasStable || hasLegacyWrapper) renderStablePositionManagement();
      else decorateStablePage();
    });
  }

  const previousRender=window.renderPage || (typeof renderPage==='function'?renderPage:null);
  if(previousRender && !previousRender.__v282PositionManagementStable){
    const wrapped=function renderPageV282(){
      if(isPositionManagement()){
        renderStablePositionManagement();
        return;
      }
      return previousRender.apply(this,arguments);
    };
    wrapped.__v282PositionManagementStable=true;
    window.renderPage=wrapped;
    try{renderPage=wrapped;}catch(_){}
  }

  // Recover if a legacy delayed renderer replaces the stable Slot page.
  try{
    const root=document.getElementById('pageContent');
    if(root){
      const observer=new MutationObserver(queueRecovery);
      observer.observe(root,{childList:true,subtree:false});
      window.__CNMI_V282_POSITION_MANAGEMENT_OBSERVER__=observer;
    }
  }catch(_){}

  // Make sure stale responsive overlays never cover the management controls.
  const style=document.createElement('style');
  style.id='v282-position-management-interaction-style';
  style.textContent=`
    .v282-position-management-root,
    .v282-position-management-root .v282-position-management-stable,
    .v282-position-management-root button,
    .v282-position-management-root select,
    .v282-position-management-root input,
    .v282-position-management-root textarea{pointer-events:auto!important}
    .v282-position-management-root{position:relative;z-index:1;isolation:isolate}
    .v282-position-management-root .v224-slot-table{max-height:calc(100dvh - 330px);overflow:auto}
    @media(max-width:820px){
      .v282-position-management-root .v224-slot-table{max-height:58dvh}
    }
  `;
  document.head.appendChild(style);

  document.addEventListener('DOMContentLoaded',()=>setTimeout(queueRecovery,120));
  setTimeout(queueRecovery,0);
  setTimeout(queueRecovery,350);

  window.cnmiV282={renderStablePositionManagement,queueRecovery};
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v282-position-management-interaction-recovery.js", error); }
;

/* Original source: patch-v283-position-matrix-readable-trainee-color.js */
try {
/* CNMI Staff Planner V283
   Targeted Admin monthly daytime-position UI adjustment only.
   - Restore readable date-cell width while keeping rows compact.
   - Keep scrolling inside the existing table container.
   - New staff trainees use their own staff color in the first column.
   - Intern rows keep the trainee/intern neutral orange style.
   No save, slot, mentor, statistics, or Supabase logic is changed.
*/
(function(){
  'use strict';
  const VERSION='V283_POSITION_MATRIX_READABLE_TRAINEE_COLOR';
  if(window.__CNMI_V283_POSITION_MATRIX_READABLE_TRAINEE_COLOR__) return;
  window.__CNMI_V283_POSITION_MATRIX_READABLE_TRAINEE_COLOR__=true;

  let queued=false;

  function S(){
    try{return state||window.state||null;}catch(_){return window.state||null;}
  }
  function isAdminSafe(){
    try{return !!isAdmin();}catch(_){return String(S()?.profile?.role||'').trim().toLowerCase()==='admin';}
  }
  function isTargetPage(){return S()?.page==='positionMonth'&&isAdminSafe();}
  function norm(value){return String(value??'').trim().toLowerCase();}
  function id(value){return String(value??'').trim();}
  function displayName(person){
    if(!person) return '';
    try{if(typeof staffName==='function') return String(staffName(person)||'').trim();}catch(_){}
    return String(person.alias||person.nickname||person.nick_name||person.display_name||person.full_name||person.name||'').trim();
  }
  function staffColor(person){
    try{if(typeof staffColorSafe==='function') return staffColorSafe(person);}catch(_){}
    return person?.color||person?.staff_color||person?.theme_color||'#fff7ed';
  }
  function contrast(color){
    try{if(typeof textColorSafe==='function') return textColorSafe(color);}catch(_){}
    const raw=String(color||'').replace('#','');
    if(!/^[0-9a-f]{6}$/i.test(raw)) return '#0f172a';
    const r=parseInt(raw.slice(0,2),16),g=parseInt(raw.slice(2,4),16),b=parseInt(raw.slice(4,6),16);
    return ((r*299+g*587+b*114)/1000)>155?'#0f172a':'#ffffff';
  }

  function findNewStaff(label){
    const st=S();
    const staff=Array.isArray(st?.staff)?st.staff:[];
    const directory=Array.isArray(st?.traineeDirectoryV273)?st.traineeDirectoryV273:[];
    const labelKey=norm(label);
    const directoryRow=directory.find(row=>{
      const type=norm(row?.trainee_type||row?.type);
      if(type==='intern') return false;
      const rowStaff=staff.find(p=>id(p?.id)===id(row?.trainee_staff_id));
      const rowLabel=rowStaff?displayName(rowStaff):String(row?.trainee_name||'').trim();
      return norm(rowLabel)===labelKey;
    });
    if(directoryRow?.trainee_staff_id){
      const byId=staff.find(p=>id(p?.id)===id(directoryRow.trainee_staff_id));
      if(byId) return byId;
    }
    return staff.find(person=>{
      const candidates=[displayName(person),person?.alias,person?.nickname,person?.nick_name,person?.full_name,person?.name];
      return candidates.some(value=>norm(value)===labelKey);
    })||null;
  }

  function applyTraineeColors(){
    if(!isTargetPage()) return;
    document.querySelectorAll('.v275-trainee-row .v275-sticky-name.trainee-name').forEach(cell=>{
      const typeText=norm(cell.querySelector('small')?.textContent);
      if(typeText.includes('intern')){
        if(cell.dataset.v283ColorApplied!=='intern'){
          cell.style.removeProperty('background');
          cell.style.removeProperty('color');
          cell.dataset.v283ColorApplied='intern';
        }
        return;
      }
      const label=String(cell.querySelector('b')?.textContent||'').trim();
      const person=findNewStaff(label);
      if(!person) return;
      const bg=staffColor(person);
      const fg=contrast(bg);
      const signature=`${id(person.id)}|${bg}|${fg}`;
      if(cell.dataset.v283ColorApplied===signature) return;
      cell.style.setProperty('--staff-bg',bg);
      cell.style.setProperty('--staff-fg',fg);
      cell.style.setProperty('background',bg,'important');
      cell.style.setProperty('color',fg,'important');
      cell.dataset.v283ColorApplied=signature;
      cell.title=`${label} · น้องใหม่`;
    });
  }

  function addReadableTitles(){
    if(!isTargetPage()) return;
    document.querySelectorAll('.v281-admin-position-page .v275-position-cell select, .v281-admin-position-page .v275-mentor-cell select').forEach(select=>{
      const text=String(select.options?.[select.selectedIndex]?.text||select.value||'').trim();
      if(text) select.title=text;
    });
  }

  function enhance(){
    if(!isTargetPage()) return;
    const page=document.querySelector('.v275-page');
    const wrap=page?.querySelector('.v275-position-wrap');
    if(page&&wrap){
      page.classList.add('v283-readable-position-page');
      wrap.classList.add('v283-readable-position-wrap');
    }
    applyTraineeColors();
    addReadableTitles();
  }
  function queueEnhance(){
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;enhance();});
  }

  document.addEventListener('change',event=>{
    const select=event.target?.closest?.('.v275-position-cell select, .v275-mentor-cell select');
    if(!select||!isTargetPage()) return;
    const text=String(select.options?.[select.selectedIndex]?.text||select.value||'').trim();
    select.title=text;
  },true);

  const style=document.createElement('style');
  style.id='v283-position-matrix-readable-trainee-color-style';
  style.textContent=`
    /* Readable width + compact height. Overrides V281 only on Admin monthly position page. */
    .v283-readable-position-page .v283-readable-position-wrap{
      --v276-position-name-width:78px!important;
      width:100%!important;
      max-width:100%!important;
      overflow:auto!important;
      overscroll-behavior:contain!important;
      scrollbar-gutter:stable both-edges;
    }
    .v283-readable-position-page .v275-position-table{
      font-size:8px!important;
      line-height:1!important;
    }
    .v283-readable-position-page .v275-position-table th,
    .v283-readable-position-page .v275-position-table td{
      min-width:76px!important;
      width:76px!important;
      max-width:76px!important;
      padding:1px 2px!important;
    }
    .v283-readable-position-page .v275-position-table tr>:nth-child(1){
      width:78px!important;min-width:78px!important;max-width:78px!important;
    }
    .v283-readable-position-page .v275-position-table tr>:nth-child(2){
      left:78px!important;
      width:92px!important;min-width:92px!important;max-width:92px!important;
    }
    .v283-readable-position-page .v275-position-table tbody tr:not(.v275-count-row)>th,
    .v283-readable-position-page .v275-position-table tbody tr:not(.v275-count-row)>td,
    .v283-readable-position-page .v275-position-day{
      height:27px!important;min-height:27px!important;max-height:27px!important;
    }
    .v283-readable-position-page .v275-count-row>th,
    .v283-readable-position-page .v275-count-row>td{
      height:28px!important;min-height:28px!important;max-height:28px!important;
    }
    .v283-readable-position-page .v275-position-cell{
      display:block!important;
      position:relative!important;
      width:100%!important;
      height:23px!important;
      min-height:23px!important;
    }
    .v283-readable-position-page .v275-position-cell select,
    .v283-readable-position-page .v275-mentor-cell select{
      display:block!important;
      width:100%!important;
      min-width:0!important;
      height:23px!important;
      min-height:23px!important;
      padding:0 17px 0 5px!important;
      border-radius:5px!important;
      font-size:8px!important;
      line-height:21px!important;
      text-overflow:ellipsis!important;
    }
    .v283-readable-position-page .v275-info{
      right:2px!important;top:4px!important;
      width:12px!important;height:12px!important;min-width:12px!important;
      font-size:6px!important;line-height:12px!important;
    }
    .v283-readable-position-page .v275-sticky-name b{
      font-size:8.5px!important;line-height:1!important;padding:0 2px!important;
      white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;
    }
    .v283-readable-position-page .v275-sticky-name small{
      font-size:6.5px!important;line-height:1!important;margin-top:1px!important;
    }
    .v283-readable-position-page .v275-summary-cell>b{
      font-size:7.5px!important;line-height:1!important;white-space:nowrap!important;
    }
    .v283-readable-position-page .v275-date-head b{font-size:8px!important;line-height:1!important}
    .v283-readable-position-page .v275-date-head small{font-size:6.5px!important;line-height:1!important}
    .v283-readable-position-page .v275-date-head em{
      max-width:72px!important;font-size:5.8px!important;line-height:1!important;
    }
    .v283-readable-position-page .v275-count-row input[data-v275-slot]{
      width:26px!important;height:20px!important;min-height:20px!important;
      padding:0 2px!important;font-size:8px!important;
    }
    .v283-readable-position-page .v275-position-day.leave .badge,
    .v283-readable-position-page .v275-position-day.leave span{
      font-size:6.5px!important;padding:1px 4px!important;line-height:1!important;
    }
    .v283-readable-position-page .v275-mentor-cell{
      height:25px!important;min-height:25px!important;gap:0!important;overflow:hidden!important;
    }
    .v283-readable-position-page .v275-mentor-cell span,
    .v283-readable-position-page .v275-mentor-cell small{
      font-size:5.8px!important;line-height:1!important;white-space:nowrap!important;
      overflow:hidden!important;text-overflow:ellipsis!important;
    }
    /* New staff keeps their personal staff color. Intern remains orange. */
    .v283-readable-position-page .v275-trainee-row .trainee-name[data-v283-color-applied]:not([data-v283-color-applied="intern"]){
      border-top:1px solid rgba(255,255,255,.45)!important;
    }

    @media(max-width:820px){
      .v283-readable-position-page .v283-readable-position-wrap{--v276-position-name-width:70px!important}
      .v283-readable-position-page .v275-position-table th,
      .v283-readable-position-page .v275-position-table td{
        min-width:68px!important;width:68px!important;max-width:68px!important;
      }
      .v283-readable-position-page .v275-position-table tr>:nth-child(1){
        width:70px!important;min-width:70px!important;max-width:70px!important;
      }
      .v283-readable-position-page .v275-position-table tr>:nth-child(2){
        left:70px!important;width:86px!important;min-width:86px!important;max-width:86px!important;
      }
      .v283-readable-position-page .v275-position-cell select,
      .v283-readable-position-page .v275-mentor-cell select{font-size:7.5px!important}
    }
  `;
  document.head.appendChild(style);

  const root=document.getElementById('pageContent')||document.documentElement;
  const observer=new MutationObserver(mutations=>{
    if(!isTargetPage()) return;
    const matrixReplaced=mutations.some(mutation=>Array.from(mutation.addedNodes||[]).some(node=>{
      if(node?.nodeType!==1) return false;
      return node.matches?.('.v275-page,.v275-position-wrap,.v275-position-table')||!!node.querySelector?.('.v275-position-wrap');
    }));
    if(matrixReplaced) queueEnhance();
  });
  observer.observe(root,{subtree:true,childList:true});
  window.addEventListener('resize',queueEnhance,{passive:true});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(enhance,80));
  setTimeout(enhance,0);
  setTimeout(enhance,180);
  setTimeout(enhance,600);

  window.cnmiV283={enhance,applyTraineeColors};
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v283-position-matrix-readable-trainee-color.js", error); }
;

/* Original source: patch-v284-daily-position-interaction-and-width-fix.js */
try {
/* CNMI Staff Planner V284 compatibility layer (revised in V286)
   - Keeps the Admin monthly position width improvements.
   - Removes the old synchronous capture handlers on the daily position page.
     Those handlers replaced the date input DOM during the native change event
     and could leave Safari/Chrome in a non-responsive state.
   Daily-page routing and interaction recovery are now owned by V286.
*/
(function(){
  'use strict';
  const VERSION='V284_WIDTH_COMPAT_REVISED_V286';
  if(window.__CNMI_V284_DAILY_POSITION_INTERACTION_AND_WIDTH_FIX__) return;
  window.__CNMI_V284_DAILY_POSITION_INTERACTION_AND_WIDTH_FIX__=true;

  let monthlyQueued=false;
  function S(){try{return state||window.state||null;}catch(_){return window.state||null;}}
  function isAdminSafe(){try{return !!isAdmin();}catch(_){return String(S()?.profile?.role||'').trim().toLowerCase()==='admin';}}
  function isAdminMonthPage(){return String(S()?.page||'')==='positionMonth'&&isAdminSafe();}

  function enhanceMonthlyWidths(){
    if(!isAdminMonthPage()) return;
    const page=document.querySelector('.v275-page');
    const wrap=page?.querySelector('.v275-position-wrap');
    if(!page||!wrap) return;
    page.classList.add('v284-position-width-fix');
    wrap.classList.add('v284-position-width-wrap');
    wrap.querySelectorAll('[data-v275-position-select],[data-v275-mentor-select]').forEach(select=>{
      const option=select.options?.[select.selectedIndex];
      select.title=option?.textContent?.trim()||select.value||'เลือกตำแหน่ง';
    });
  }
  function queueMonthlyEnhance(){
    if(monthlyQueued||!isAdminMonthPage()) return;
    monthlyQueued=true;
    requestAnimationFrame(()=>{monthlyQueued=false;enhanceMonthlyWidths();});
  }

  const style=document.createElement('style');
  style.id='v284-daily-position-interaction-and-width-style';
  style.textContent=`
    #modal.hidden,.modal.hidden{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}
    #modal.hidden *,.modal.hidden *{pointer-events:none!important}

    .v284-position-width-fix .v284-position-width-wrap{--v284-day-width:148px}
    .v284-position-width-fix .v275-position-table tr>th:nth-child(n+3),
    .v284-position-width-fix .v275-position-table tr>td:nth-child(n+3){
      width:var(--v284-day-width)!important;min-width:var(--v284-day-width)!important;max-width:var(--v284-day-width)!important
    }
    .v284-position-width-fix .v275-count-row>td:nth-child(n+3){white-space:nowrap!important;overflow:visible!important;font-size:9px!important;padding:2px 5px!important}
    .v284-position-width-fix .v275-count-row input[data-v275-slot]{width:40px!important;min-width:40px!important;max-width:40px!important;height:23px!important;padding:1px 4px!important;font-size:9px!important}
    .v284-position-width-fix .v275-position-cell select,
    .v284-position-width-fix .v275-mentor-cell select{width:100%!important;min-width:0!important;height:24px!important;min-height:24px!important;padding:1px 22px 1px 6px!important;font-size:9px!important;line-height:22px!important;text-overflow:clip!important;white-space:nowrap!important}
    .v284-position-width-fix .v275-position-table tbody tr:not(.v275-count-row)>th,
    .v284-position-width-fix .v275-position-table tbody tr:not(.v275-count-row)>td,
    .v284-position-width-fix .v275-position-day{height:29px!important;min-height:29px!important;max-height:29px!important}
    .v284-position-width-fix .v275-position-cell{height:25px!important;min-height:25px!important}
    @media(max-width:820px){
      .v284-position-width-fix .v284-position-width-wrap{--v284-day-width:136px}
      .v284-position-width-fix .v275-position-cell select,
      .v284-position-width-fix .v275-mentor-cell select{font-size:8.5px!important}
    }
  `;
  document.head.appendChild(style);

  try{
    const root=document.getElementById('pageContent')||document.documentElement;
    const observer=new MutationObserver(queueMonthlyEnhance);
    observer.observe(root,{childList:true,subtree:true});
    window.__CNMI_V284_OBSERVER__=observer;
  }catch(_){}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(queueMonthlyEnhance,80));
  setTimeout(queueMonthlyEnhance,0);
  setTimeout(queueMonthlyEnhance,400);
  window.cnmiV284={enhanceMonthlyWidths};
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v284-daily-position-interaction-and-width-fix.js", error); }
;

/* Original source: patch-v286-daily-position-stable-route-staff-month-compact.js */
try {
/* CNMI Staff Planner V286 compatibility layer, revised for V287
   - Keeps Staff monthly daytime-position compact styling and trainee colors.
   - Removes the V286 daily-page route/date capture handlers because they could
     render stale state before the selected date was read from Supabase.
   - V287 owns the daily-page heading, route and authoritative date loading.
*/
(function(){
  'use strict';
  const VERSION='V286_STAFF_MONTH_COMPACT_COMPAT_V287';
  if(window.__CNMI_V286_DAILY_POSITION_STABLE_ROUTE_STAFF_MONTH_COMPACT__) return;
  window.__CNMI_V286_DAILY_POSITION_STABLE_ROUTE_STAFF_MONTH_COMPACT__=true;

  let decorateQueued=false;
  function S(){try{return state||window.state||null;}catch(_){return window.state||null;}}
  function isStaffMonth(){return String(S()?.page||'')==='positionMonthView';}
  function norm(value){return String(value??'').trim().toLowerCase();}
  function id(value){return String(value??'').trim();}
  function displayName(person){
    if(!person)return'';
    try{if(typeof staffName==='function')return String(staffName(person)||'').trim();}catch(_){}
    return String(person.alias||person.nickname||person.nick_name||person.display_name||person.full_name||person.name||'').trim();
  }
  function colorOf(person){
    try{if(typeof staffColorSafe==='function')return staffColorSafe(person);}catch(_){}
    try{if(typeof staffColor==='function')return staffColor(person);}catch(_){}
    return person?.color||person?.staff_color||person?.theme_color||'#fff7ed';
  }
  function contrast(color){
    try{if(typeof textColorSafe==='function')return textColorSafe(color);}catch(_){}
    try{if(typeof textColorFor==='function')return textColorFor(color);}catch(_){}
    const raw=String(color||'').replace('#','');
    if(!/^[0-9a-f]{6}$/i.test(raw))return'#0f172a';
    const r=parseInt(raw.slice(0,2),16),g=parseInt(raw.slice(2,4),16),b=parseInt(raw.slice(4,6),16);
    return((r*299+g*587+b*114)/1000)>155?'#0f172a':'#fff';
  }
  function findTraineeStaff(label){
    const st=S();
    const staff=Array.isArray(st?.staff)?st.staff:[];
    const directory=Array.isArray(st?.traineeDirectoryV273)?st.traineeDirectoryV273:[];
    const key=norm(label);
    const row=directory.find(item=>{
      if(norm(item?.trainee_type||item?.type).includes('intern'))return false;
      const person=staff.find(x=>id(x?.id)===id(item?.trainee_staff_id));
      const name=person?displayName(person):String(item?.trainee_name||'').trim();
      return norm(name)===key;
    });
    if(row?.trainee_staff_id){
      const person=staff.find(x=>id(x?.id)===id(row.trainee_staff_id));
      if(person)return person;
    }
    return staff.find(person=>[displayName(person),person?.alias,person?.nickname,person?.nick_name,person?.full_name,person?.name].some(value=>norm(value)===key))||null;
  }
  function applyStaffMonthTraineeColors(){
    if(!isStaffMonth())return;
    document.querySelectorAll('.v286-staff-position-page .v275-trainee-row .v275-sticky-name.trainee-name').forEach(cell=>{
      const type=norm(cell.querySelector('small')?.textContent);
      if(type.includes('intern')){
        cell.style.removeProperty('--staff-bg');
        cell.style.removeProperty('--staff-fg');
        cell.style.removeProperty('background');
        cell.style.removeProperty('color');
        cell.dataset.v286TraineeColor='intern';
        return;
      }
      const label=String(cell.querySelector('b')?.textContent||'').trim();
      const person=findTraineeStaff(label);
      if(!person)return;
      const bg=colorOf(person),fg=contrast(bg),sig=`${id(person.id)}|${bg}|${fg}`;
      if(cell.dataset.v286TraineeColor===sig)return;
      cell.style.setProperty('--staff-bg',bg);
      cell.style.setProperty('--staff-fg',fg);
      cell.style.setProperty('background',bg,'important');
      cell.style.setProperty('color',fg,'important');
      cell.dataset.v286TraineeColor=sig;
      cell.title=`${label} · น้องใหม่`;
    });
  }
  function decorateStaffMonth(){
    if(!isStaffMonth())return;
    const page=document.querySelector('.v275-page');
    const wrap=page?.querySelector('.v275-position-wrap');
    if(page)page.classList.add('v286-staff-position-page');
    if(wrap)wrap.classList.add('v286-staff-position-wrap');
    applyStaffMonthTraineeColors();
  }
  function queueDecorate(){
    if(decorateQueued)return;
    decorateQueued=true;
    requestAnimationFrame(()=>{decorateQueued=false;decorateStaffMonth();});
  }

  const style=document.createElement('style');
  style.id='v286-daily-position-stable-route-staff-month-compact-style';
  style.textContent=`
    #modal.hidden,.modal.hidden{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important}
    .v286-staff-position-page .v286-staff-position-wrap{max-height:68vh!important;overflow:auto!important;overscroll-behavior:contain!important;scrollbar-gutter:stable both-edges}
    .v286-staff-position-page .v275-position-table{font-size:8px!important;line-height:1!important}
    .v286-staff-position-page .v275-position-table th,
    .v286-staff-position-page .v275-position-table td{padding:1px 2px!important}
    .v286-staff-position-page .v275-position-table tbody tr:not(.v275-count-row)>th,
    .v286-staff-position-page .v275-position-table tbody tr:not(.v275-count-row)>td,
    .v286-staff-position-page .v275-position-day{height:29px!important;min-height:29px!important;max-height:29px!important}
    .v286-staff-position-page .v275-count-row>th,
    .v286-staff-position-page .v275-count-row>td{height:28px!important;min-height:28px!important;max-height:28px!important}
    .v286-staff-position-page .v275-sticky-name b{font-size:8.5px!important;line-height:1!important;padding:0 2px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .v286-staff-position-page .v275-sticky-name small{font-size:6.5px!important;line-height:1!important;margin-top:1px!important}
    .v286-staff-position-page .v275-summary-cell{gap:0!important}
    .v286-staff-position-page .v275-summary-cell>b{font-size:7.5px!important;line-height:1!important;white-space:nowrap!important}
    .v286-staff-position-page .v275-summary-cell span,
    .v286-staff-position-page .v275-summary-cell small{font-size:6.5px!important;line-height:1!important}
    .v286-staff-position-page .v275-date-head b{font-size:8px!important;line-height:1!important}
    .v286-staff-position-page .v275-date-head small{font-size:6.5px!important;line-height:1!important}
    .v286-staff-position-page .v275-date-head em{font-size:5.8px!important;line-height:1!important}
    .v286-staff-position-page .v275-position-pill{font-size:7px!important;line-height:1!important;padding:2px 4px!important;white-space:nowrap!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .v286-staff-position-page .v275-position-day.leave .mini-status{font-size:6.5px!important;line-height:1!important;padding:1px 4px!important}
    .v286-staff-position-page .v275-position-day.trainee>b{font-size:6.8px!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .v286-staff-position-page .v275-position-day.trainee>small{font-size:6px!important;line-height:1!important}
    .v286-staff-position-page .v275-trainee-summary{font-size:6.5px!important;line-height:1!important;gap:0!important}
    .v286-staff-position-page .v275-trainee-row .trainee-name[data-v286-trainee-color]:not([data-v286-trainee-color="intern"]){border-top:1px solid rgba(255,255,255,.45)!important}
    @media(max-width:820px){
      .v286-staff-position-page .v286-staff-position-wrap{max-height:66vh!important}
      .v286-staff-position-page .v275-position-table tbody tr:not(.v275-count-row)>th,
      .v286-staff-position-page .v275-position-table tbody tr:not(.v275-count-row)>td,
      .v286-staff-position-page .v275-position-day{height:27px!important;min-height:27px!important;max-height:27px!important}
      .v286-staff-position-page .v275-position-table th,
      .v286-staff-position-page .v275-position-table td{padding:1px!important}
    }
  `;
  document.head.appendChild(style);

  try{
    const root=document.getElementById('pageContent')||document.body;
    const observer=new MutationObserver(()=>{if(isStaffMonth())queueDecorate();});
    observer.observe(root,{childList:true,subtree:true});
    window.__CNMI_V286_OBSERVER__=observer;
  }catch(_){}
  document.addEventListener('DOMContentLoaded',()=>setTimeout(decorateStaffMonth,80));
  setTimeout(decorateStaffMonth,0);
  setTimeout(decorateStaffMonth,400);

  window.cnmiV286={decorateStaffMonth,applyStaffMonthTraineeColors};
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v286-daily-position-stable-route-staff-month-compact.js", error); }
;

/* Original source: patch-v287-daily-position-authoritative-date-loader.js */
try {
/* CNMI Staff Planner V287
   Daily daytime-position page reliability fix for Admin / Incharge / Staff.
   - Header is always "ตารางตำแหน่งกลางวัน รายวัน".
   - A selected date is read directly from Supabase before rendering.
   - Only the selected date is replaced in state; no full loadAllData() loop.
   - Rapid date changes use a request token so an older response cannot overwrite a newer date.
   - Loading is local to the daily card and never places a full-screen click blocker.
   No SQL or schema change is required.
*/
(function(){
  'use strict';
  const VERSION='V287_DAILY_POSITION_AUTHORITATIVE_DATE_LOADER';
  const TITLE='ตารางตำแหน่งกลางวัน รายวัน';
  const SUBTITLE='ดูหรือปรับตำแหน่งประจำวัน';
  if(window.__CNMI_V287_DAILY_POSITION_AUTHORITATIVE_DATE_LOADER__)return;
  window.__CNMI_V287_DAILY_POSITION_AUTHORITATIVE_DATE_LOADER__=true;

  let rendering=false;
  let requestSerial=0;
  let activeDate='';
  let headerQueued=false;

  function S(){try{return state||window.state||null;}catch(_){return window.state||null;}}
  function DB(){
    try{if(typeof sb!=='undefined'&&sb?.from)return sb;}catch(_){}
    return window.sb||window.supabaseClient||null;
  }
  function isDaily(){return String(S()?.page||'')==='positions';}
  function normDate(value){
    try{if(typeof normalizeDateKey==='function')return normalizeDateKey(value);}catch(_){}
    return String(value||'').trim().slice(0,10);
  }
  function esc(value){
    try{return escapeHtml(String(value??''));}
    catch(_){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  }
  function friendly(error){
    try{if(typeof friendlyDbError==='function')return friendlyDbError(error);}catch(_){}
    return error?.message||error?.details||error?.hint||String(error||'เกิดข้อผิดพลาด');
  }
  function toast(message,tone){
    try{if(typeof showToast==='function')showToast(message,tone?{tone}:undefined);else console.info(message);}catch(_){console.info(message);}
  }
  function assignGlobal(name,value){
    try{window[name]=value;}catch(_){}
    try{(0,eval)(`${name}=window[${JSON.stringify(name)}]`);}catch(_){}
  }
  function navItems(){
    try{return window.NAV_ITEMS||(typeof NAV_ITEMS!=='undefined'?NAV_ITEMS:[]);}catch(_){return window.NAV_ITEMS||[];}
  }
  function ensureNavMetadata(){
    const item=(navItems()||[]).find(row=>row?.id==='positions');
    if(item){item.title=TITLE;item.subtitle=SUBTITLE;}
  }
  function setHeading(){
    if(!isDaily())return;
    ensureNavMetadata();
    const title=document.getElementById('pageTitle');
    const subtitle=document.getElementById('pageSubtitle');
    if(title&&title.textContent!==TITLE)title.textContent=TITLE;
    if(subtitle&&subtitle.textContent!==SUBTITLE)subtitle.textContent=SUBTITLE;
  }
  function queueHeading(){
    if(headerQueued)return;
    headerQueued=true;
    queueMicrotask(()=>{headerQueued=false;setHeading();});
  }
  function dailyRenderer(){
    try{
      const fn=window.renderPositionsPage||(typeof renderPositionsPage==='function'?renderPositionsPage:null);
      return typeof fn==='function'?fn:null;
    }catch(_){return typeof window.renderPositionsPage==='function'?window.renderPositionsPage:null;}
  }
  function cleanHiddenModal(){
    const modal=document.getElementById('modal');
    if(modal?.classList.contains('hidden')){
      modal.setAttribute('aria-hidden','true');
      modal.style.setProperty('display','none','important');
      modal.style.setProperty('pointer-events','none','important');
      document.body.classList.remove('modal-open');
    }
    const root=document.getElementById('pageContent');
    if(root){root.removeAttribute('inert');root.style.removeProperty('pointer-events');}
  }
  function renderDailyStable(){
    if(!isDaily()||rendering)return;
    rendering=true;
    try{
      ensureNavMetadata();
      try{if(typeof renderNav==='function')renderNav();else window.renderNav?.();}catch(_){}
      setHeading();
      const root=document.getElementById('pageContent');
      const renderer=dailyRenderer();
      if(!root||!renderer)return;
      root.innerHTML=String(renderer()||'');
      root.dataset.v287Daily='1';
      setHeading();
      cleanHiddenModal();
      const currentDate=normDate(S()?.positionDate||document.getElementById('positionDateInput')?.value);
      if(currentDate&&activeDate!==currentDate){
        setTimeout(()=>{if(isDaily()&&activeDate!==currentDate)loadSelectedDate(currentDate);},0);
      }
    }catch(error){
      console.error(`${VERSION}: render failed`,error);
      const date=normDate(S()?.positionDate)||(new Date()).toISOString().slice(0,10);
      const root=document.getElementById('pageContent');
      if(root)root.innerHTML=`<div class="card v287-daily-error"><div class="toolbar"><label>วันที่ <input type="date" id="positionDateInput" value="${esc(date)}"></label></div><div class="notice error-notice">โหลดตารางตำแหน่งกลางวัน รายวันไม่สำเร็จ: ${esc(friendly(error))}</div></div>`;
      setHeading();
      cleanHiddenModal();
    }finally{rendering=false;}
  }
  function setLocalLoading(active,date){
    if(!isDaily())return;
    const root=document.getElementById('pageContent');
    if(!root)return;
    root.classList.toggle('v287-daily-loading',!!active);
    root.setAttribute('aria-busy',active?'true':'false');
    root.querySelectorAll('.v287-date-loading').forEach(node=>node.remove());
    if(!active)return;
    const toolbar=root.querySelector('.v225-position-toolbar,.v226-positions-page .toolbar,.toolbar');
    if(toolbar){
      const note=document.createElement('span');
      note.className='badge blue v287-date-loading';
      note.textContent=`กำลังโหลดข้อมูล ${date}`;
      toolbar.appendChild(note);
    }
  }
  function replaceDateRows(date,rows,status){
    const st=S();
    if(!st)return;
    const d=normDate(date);
    if(window.cnmiV261?.replaceDateInState){
      window.cnmiV261.replaceDateInState(d,Array.isArray(rows)?rows:[],status||null);
      return;
    }
    st.positions=(Array.isArray(st.positions)?st.positions:[]).filter(row=>normDate(row?.work_date)!==d).concat(Array.isArray(rows)?rows:[]);
    st.positionDayStatus=(Array.isArray(st.positionDayStatus)?st.positionDayStatus:[]).filter(row=>normDate(row?.work_date)!==d).concat(status?[status]:[]);
  }
  function overlap(row,date,startField='start_date',endField='end_date'){
    const start=normDate(row?.[startField]);
    const end=normDate(row?.[endField]||row?.[startField]);
    return !!start&&start<=date&&(!end||end>=date);
  }
  function mergeRowsByIdentity(current,fresh,prefix){
    const map=new Map();
    (Array.isArray(current)?current:[]).forEach((row,index)=>{
      const key=String(row?.id||`${prefix}|${row?.staff_id||''}|${row?.start_date||''}|${row?.end_date||''}|${row?.type||row?.activity_type||''}|${index}`);
      map.set(key,row);
    });
    (Array.isArray(fresh)?fresh:[]).forEach((row,index)=>{
      const key=String(row?.id||`${prefix}|${row?.staff_id||''}|${row?.start_date||''}|${row?.end_date||''}|${row?.type||row?.activity_type||''}|fresh-${index}`);
      map.set(key,row);
    });
    return Array.from(map.values());
  }
  function mergeContext(date,context){
    const st=S();
    if(!st)return;
    const month=date.slice(0,7);
    if(Array.isArray(context.incharges)){
      st.incharges=(Array.isArray(st.incharges)?st.incharges:[]).filter(row=>String(row?.month_key||'').slice(0,7)!==month).concat(context.incharges);
    }
    if(Array.isArray(context.holidays)){
      st.holidays=(Array.isArray(st.holidays)?st.holidays:[]).filter(row=>normDate(row?.holiday_date)!==date).concat(context.holidays);
    }
    /* Leave/activity RLS can differ by role. Merge returned rows without deleting
       cached rows that another role may not be allowed to read. */
    if(Array.isArray(context.leaves))st.leaves=mergeRowsByIdentity(st.leaves,context.leaves,'leave');
    if(Array.isArray(context.activities))st.activities=mergeRowsByIdentity(st.activities,context.activities,'activity');
  }
  async function fetchEssential(date){
    if(window.cnmiV261?.fetchDateFromDatabase)return window.cnmiV261.fetchDateFromDatabase(date);
    const db=DB();
    if(!db)throw new Error('ไม่พบการเชื่อมต่อ Supabase');
    const [positions,status]=await Promise.all([
      db.from('daily_positions').select('*').eq('work_date',date).order('position_code'),
      db.from('daily_position_day_status').select('*').eq('work_date',date).maybeSingle()
    ]);
    if(positions.error)throw positions.error;
    if(status.error)throw status.error;
    return{rows:positions.data||[],status:status.data||null};
  }
  async function fetchContext(date){
    const db=DB();
    if(!db)return{};
    const month=date.slice(0,7);
    const jobs={
      incharges:db.from('monthly_incharges').select('*').eq('month_key',month),
      holidays:db.from('public_holidays').select('*').eq('holiday_date',date),
      leaves:db.from('leave_requests').select('*').lte('start_date',date).gte('end_date',date),
      activities:db.from('activity_events').select('*').lte('start_date',date).gte('end_date',date)
    };
    const entries=Object.entries(jobs);
    const results=await Promise.allSettled(entries.map(([,job])=>job));
    const out={};
    results.forEach((result,index)=>{
      const key=entries[index][0];
      if(result.status==='fulfilled'&&!result.value?.error)out[key]=result.value?.data||[];
      else if(result.status==='fulfilled'&&result.value?.error)console.warn(`${VERSION}: optional ${key} load skipped`,result.value.error);
      else console.warn(`${VERSION}: optional ${key} load skipped`,result.reason);
    });
    return out;
  }
  function withTimeout(promise,ms){
    let timer;
    return Promise.race([
      promise,
      new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('หมดเวลารอข้อมูลจากฐานข้อมูล กรุณาเลือกวันที่อีกครั้ง')),ms);})
    ]).finally(()=>clearTimeout(timer));
  }
  async function loadSelectedDate(date){
    const d=normDate(date);
    if(!d||!isDaily())return false;
    const st=S();
    if(st)st.positionDate=d;
    activeDate=d;
    const serial=++requestSerial;
    setLocalLoading(true,d);
    const contextPromise=fetchContext(d);
    try{
      const fresh=await withTimeout(fetchEssential(d),15000);
      if(serial!==requestSerial||!isDaily()||normDate(S()?.positionDate)!==d)return false;
      replaceDateRows(d,fresh?.rows||[],fresh?.status||null);
      const context=await Promise.race([contextPromise,new Promise(resolve=>setTimeout(()=>resolve({}),2500))]);
      if(serial!==requestSerial||!isDaily()||normDate(S()?.positionDate)!==d)return false;
      mergeContext(d,context||{});
      renderDailyStable();
      console.info(`${VERSION}: selected date loaded`,{date:d,rows:(fresh?.rows||[]).length,status:fresh?.status?.status||null});
      contextPromise.then(late=>{
        if(serial!==requestSerial||!isDaily()||normDate(S()?.positionDate)!==d)return;
        mergeContext(d,late||{});
        renderDailyStable();
      }).catch(()=>{});
      return true;
    }catch(error){
      if(serial!==requestSerial)return false;
      console.error(`${VERSION}: selected date load failed`,error);
      toast(`โหลดข้อมูลวันที่ ${d} ไม่สำเร็จ: ${friendly(error)}`,'error');
      renderDailyStable();
      return false;
    }finally{
      if(serial===requestSerial)setLocalLoading(false,d);
    }
  }

  ensureNavMetadata();

  /* Final route entry: daily page is rendered once, without traversing the long legacy route chain. */
  const previousRender=window.renderPage||(typeof renderPage==='function'?renderPage:null);
  if(previousRender&&!previousRender.__v287DailyStableRoute){
    const wrapped=function renderPageV287(){
      if(isDaily()){
        renderDailyStable();
        return;
      }
      activeDate='';
      requestSerial+=1;
      return previousRender.apply(this,arguments);
    };
    wrapped.__v287DailyStableRoute=true;
    assignGlobal('renderPage',wrapped);
  }

  /* Stop the old immediate render. The DOM is not replaced until the native date event has ended
     and Supabase has returned the authoritative rows for the selected date. */
  window.addEventListener('change',event=>{
    if(!isDaily()||event.target?.id!=='positionDateInput')return;
    const value=normDate(event.target.value);
    if(!value)return;
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const st=S();
    if(st)st.positionDate=value;
    setTimeout(()=>loadSelectedDate(value),0);
  },true);

  /* Correct the header if any delayed legacy callback writes an older page title. */
  try{
    const title=document.getElementById('pageTitle');
    if(title){
      const observer=new MutationObserver(()=>{if(isDaily())queueHeading();});
      observer.observe(title,{childList:true,characterData:true,subtree:true});
      window.__CNMI_V287_HEADER_OBSERVER__=observer;
    }
  }catch(_){}

  const style=document.createElement('style');
  style.id='v287-daily-position-authoritative-date-loader-style';
  style.textContent=`
    #pageContent.v287-daily-loading .v225-positions-page,
    #pageContent.v287-daily-loading .v226-positions-page{outline:2px solid rgba(14,165,233,.16);outline-offset:2px}
    .v287-date-loading{display:inline-flex!important;align-items:center;gap:6px;white-space:nowrap}
    .v287-date-loading::before{content:'';width:12px;height:12px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:v287spin .75s linear infinite}
    @keyframes v287spin{to{transform:rotate(360deg)}}
    .v287-daily-error{max-width:760px}
  `;
  document.head.appendChild(style);

  document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{ensureNavMetadata();if(isDaily()){setHeading();renderDailyStable();}},80));
  setTimeout(()=>{ensureNavMetadata();if(isDaily()){setHeading();renderDailyStable();}},0);
  setTimeout(()=>{if(isDaily())setHeading();},400);

  window.cnmiV287={loadSelectedDate,renderDailyStable,setHeading,fetchEssential,fetchContext};
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v287-daily-position-authoritative-date-loader.js", error); }
;

/* Original source: patch-v288-position-month-save-scroll-lock.js */
try {
/* CNMI Staff Planner V288
   Admin monthly daytime-position scroll lock after autosave.
   - Keeps the same horizontal date and vertical staff row after position/mentor changes.
   - Survives delayed rerenders from Supabase and background loaders.
   - Real user scrolling becomes the new position; programmatic DOM replacement cannot reset it to day 1.
   - Month changes and navigation intentionally clear the saved viewport.
   No SQL or schema change is required.
*/
(function(){
  'use strict';
  const VERSION='V288_POSITION_MONTH_SAVE_SCROLL_LOCK';
  if(window.__CNMI_V288_POSITION_MONTH_SAVE_SCROLL_LOCK__)return;
  window.__CNMI_V288_POSITION_MONTH_SAVE_SCROLL_LOCK__=true;

  const LOCK_MS=3500;
  const RESTORE_DELAYS=[0,24,80,180,420,900,1800,3200];
  let snapshot=null;
  let serial=0;
  let applying=false;
  let userIntentUntil=0;
  let observer=null;
  let timers=[];

  function S(){try{return state||window.state||null;}catch(_){return window.state||null;}}
  function isAdminSafe(){
    try{return !!isAdmin();}
    catch(_){return String(S()?.profile?.role||'').trim().toLowerCase()==='admin';}
  }
  function isTarget(){return String(S()?.page||'')==='positionMonth'&&isAdminSafe();}
  function monthKey(){return String(S()?.positionMonthKey||S()?.monthKey||'').slice(0,7);}
  function scroller(){return document.querySelector('.v275-position-wrap');}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
  function cssEscape(value){
    try{return CSS.escape(String(value??''));}
    catch(_){return String(value??'').replace(/["\\]/g,'\\$&');}
  }
  function cancelTimers(){timers.forEach(clearTimeout);timers=[];}
  function clear(reason){
    snapshot=null;
    serial+=1;
    cancelTimers();
    if(reason)console.info(`${VERSION}: viewport cleared`,reason);
  }
  function anchorFrom(target,wrap){
    const node=target?.closest?.('[data-v275-position-cell],[data-v275-mentor-cell],[data-v275-slot]');
    if(!node||!wrap?.contains(node))return null;
    const holder=node.matches('[data-v275-slot]')?node.closest('td,th'):node;
    const rect=(holder||node).getBoundingClientRect();
    const wrapRect=wrap.getBoundingClientRect();
    return{
      kind:node.hasAttribute('data-v275-position-cell')?'position':node.hasAttribute('data-v275-mentor-cell')?'mentor':'slot',
      date:String(node.dataset?.date||''),
      staffId:String(node.dataset?.staffId||''),
      identity:String(node.dataset?.identity||''),
      offsetX:rect.left-wrapRect.left,
      offsetY:rect.top-wrapRect.top
    };
  }
  function findAnchor(anchor){
    if(!anchor)return null;
    if(anchor.kind==='position'&&anchor.date&&anchor.staffId){
      return document.querySelector(`[data-v275-position-cell][data-date="${cssEscape(anchor.date)}"][data-staff-id="${cssEscape(anchor.staffId)}"]`);
    }
    if(anchor.kind==='mentor'&&anchor.date&&anchor.identity){
      return document.querySelector(`[data-v275-mentor-cell][data-date="${cssEscape(anchor.date)}"][data-identity="${cssEscape(anchor.identity)}"]`);
    }
    if(anchor.kind==='slot'&&anchor.date){
      return document.querySelector(`[data-v275-slot][data-date="${cssEscape(anchor.date)}"]`)?.closest('td,th')||null;
    }
    return null;
  }
  function capture(target,reason,{extend=true}={}){
    if(!isTarget())return null;
    const wrap=scroller();
    if(!wrap)return null;
    const previous=snapshot;
    const anchor=anchorFrom(target,wrap)||previous?.anchor||null;
    snapshot={
      month:monthKey(),
      left:Number(wrap.scrollLeft||0),
      top:Number(wrap.scrollTop||0),
      windowX:Number(window.scrollX||window.pageXOffset||0),
      windowY:Number(window.scrollY||window.pageYOffset||0),
      anchor,
      reason:String(reason||''),
      createdAt:previous?.createdAt||Date.now(),
      expiresAt:Date.now()+(extend?LOCK_MS:Math.max(600,Number(previous?.expiresAt||0)-Date.now()))
    };
    serial+=1;
    return snapshot;
  }
  function valid(snap=snapshot){
    return !!snap&&isTarget()&&snap.month===monthKey()&&Date.now()<=snap.expiresAt;
  }
  function restore(expectedSerial){
    if(expectedSerial!==serial||!valid())return false;
    const wrap=scroller();
    if(!wrap)return false;
    applying=true;
    try{
      const maxLeft=Math.max(0,wrap.scrollWidth-wrap.clientWidth);
      const maxTop=Math.max(0,wrap.scrollHeight-wrap.clientHeight);
      wrap.scrollLeft=clamp(Number(snapshot.left||0),0,maxLeft);
      wrap.scrollTop=clamp(Number(snapshot.top||0),0,maxTop);

      const anchor=findAnchor(snapshot.anchor);
      if(anchor&&wrap.contains(anchor)){
        const anchorRect=anchor.getBoundingClientRect();
        const wrapRect=wrap.getBoundingClientRect();
        const desiredX=Number(snapshot.anchor?.offsetX);
        const desiredY=Number(snapshot.anchor?.offsetY);
        if(Number.isFinite(desiredX)){
          const dx=(anchorRect.left-wrapRect.left)-desiredX;
          if(Math.abs(dx)>1)wrap.scrollLeft=clamp(wrap.scrollLeft+dx,0,Math.max(0,wrap.scrollWidth-wrap.clientWidth));
        }
        if(Number.isFinite(desiredY)){
          const dy=(anchorRect.top-wrapRect.top)-desiredY;
          if(Math.abs(dy)>2)wrap.scrollTop=clamp(wrap.scrollTop+dy,0,Math.max(0,wrap.scrollHeight-wrap.clientHeight));
        }
      }
      window.scrollTo(Number(snapshot.windowX||0),Number(snapshot.windowY||0));
    }catch(error){
      console.warn(`${VERSION}: viewport restore skipped`,error);
    }
    requestAnimationFrame(()=>{applying=false;});
    return true;
  }
  function scheduleRestore(){
    if(!valid())return;
    cancelTimers();
    const expectedSerial=serial;
    RESTORE_DELAYS.forEach(delay=>{
      timers.push(setTimeout(()=>restore(expectedSerial),delay));
    });
  }
  function beginControlLock(target,reason){
    if(!isTarget())return;
    if(!target?.closest?.('.v275-position-wrap [data-v275-position-select],.v275-position-wrap [data-v275-mentor-select],.v275-position-wrap [data-v275-slot],.v275-position-wrap [data-v275-position-cell],.v275-position-wrap [data-v275-mentor-cell]'))return;
    /* V291: capture only. Restore is scheduled only when the table DOM is actually replaced. */
    capture(target,reason);
  }
  function markUserScrollIntent(event){
    if(!isTarget())return;
    const wrap=scroller();
    if(!wrap)return;
    if(event?.target!==wrap&&!event?.target?.closest?.('.v275-position-wrap'))return;
    userIntentUntil=Date.now()+1400;
    cancelTimers();
    requestAnimationFrame(()=>{
      if(!isTarget()||applying)return;
      capture(event.target,'user-scroll-intent');
    });
  }

  /* Capture before V275 queues the Supabase autosave. Window capture runs before document handlers. */
  ['pointerdown','focusin','input','change','drop'].forEach(type=>{
    window.addEventListener(type,event=>{
      if(event.target?.id==='positionMonthInput'){
        clear('month-change');
        return;
      }
      beginControlLock(event.target,type);
    },true);
  });

  /* A deliberate wheel/touch/scrollbar action updates the viewport that must be retained. */
  ['wheel','touchstart','touchmove'].forEach(type=>window.addEventListener(type,markUserScrollIntent,{capture:true,passive:true}));
  window.addEventListener('pointerdown',event=>{
    if(!isTarget())return;
    const wrap=scroller();
    if(!wrap||event.target!==wrap)return;
    userIntentUntil=Date.now()+1400;
    cancelTimers();
  },true);
  document.addEventListener('scroll',event=>{
    if(applying||!isTarget()||Date.now()>userIntentUntil)return;
    const wrap=scroller();
    if(event.target!==wrap)return;
    /* Never write scrollLeft back while the user is actively scrolling. */
    capture(wrap,'trusted-user-scroll');
  },true);
  window.addEventListener('scroll',()=>{
    if(applying||!valid()||Date.now()>userIntentUntil)return;
    snapshot.windowX=Number(window.scrollX||window.pageXOffset||0);
    snapshot.windowY=Number(window.scrollY||window.pageYOffset||0);
  },{passive:true});

  /* Leaving this page intentionally discards the old date viewport. */
  window.addEventListener('click',event=>{
    const nav=event.target?.closest?.('[data-page]');
    if(nav&&String(nav.dataset.page||'')!=='positionMonth')clear('navigation');
  },true);

  /* Run after every save/background rerender. Repeated restores cover delayed Supabase loaders. */
  function connectObserver(){
    const root=document.getElementById('pageContent')||document.body;
    if(!root)return;
    observer?.disconnect?.();
    observer=new MutationObserver(mutations=>{
      if(!valid())return;
      const replaced=mutations.some(m=>Array.from(m.addedNodes||[]).some(node=>{
        if(node?.nodeType!==1)return false;
        return node.matches?.('.v275-page,.v275-position-wrap,.v275-position-table')||!!node.querySelector?.('.v275-position-wrap');
      }));
      if(!replaced)return;
      scheduleRestore();
    });
    observer.observe(root,{childList:true,subtree:true});
  }
  connectObserver();
  document.addEventListener('DOMContentLoaded',connectObserver,{once:true});

  /* V288 is loaded last. This hook restores after the complete legacy render chain returns. */
  const previousRender=window.renderPage||(typeof renderPage==='function'?renderPage:null);
  if(previousRender&&!previousRender.__v288PositionMonthScrollLock){
    const wrapped=function renderPageV288(){
      const beforeValid=valid();
      const expectedMonth=beforeValid?snapshot.month:'';
      const result=previousRender.apply(this,arguments);
      if(beforeValid&&isTarget()&&expectedMonth===monthKey())scheduleRestore();
      return result;
    };
    wrapped.__v288PositionMonthScrollLock=true;
    try{window.renderPage=wrapped;}catch(_){}
    try{(0,eval)('renderPage=window.renderPage');}catch(_){}
  }

  window.cnmiV288={captureViewport:capture,restoreViewport:()=>restore(serial),clearViewport:clear,getViewport:()=>snapshot};
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v288-position-month-save-scroll-lock.js", error); }
;

/* Original source: patch-v289-position-base-bulk-save-timeout.js */
try {
/* CNMI Staff Planner V289
   Reliable Supabase save for Position Management.
   - Replaces the long sequential V224/V226/V260 save chain with bulk requests.
   - Adds a timeout to every Supabase request so the page cannot wait forever.
   - Verifies the records by reading them back before showing success.
   - Saves the visible primary Slot count together with "save all".
   - Does not modify daily_position_eligibility or any personal permission.
   No SQL or schema change is required when the V182/V214 table and policies already exist.
*/
(function(){
  'use strict';
  const VERSION='V289_POSITION_BASE_BULK_SAVE_TIMEOUT';
  if(window.__CNMI_V289_POSITION_BASE_BULK_SAVE_TIMEOUT__)return;
  window.__CNMI_V289_POSITION_BASE_BULK_SAVE_TIMEOUT__=true;

  const CFG_PREFIX='__CNMI_SLOT_TEMPLATE_V224__';
  const BASE_COUNT_KEY='__CNMI_SLOT_BASE_COUNT_V231__';
  const DAY_SETS=[8,9,10,11,12,13,14];
  const OUTING_SETS=[12,13,14];
  const REQUEST_TIMEOUT_MS=18000;
  let saving=false;
  let operationNo=0;

  function S(){try{return state||window.state||null;}catch(_){return window.state||null;}}
  function DB(){try{return sb||window.sb||null;}catch(_){return window.sb||null;}}
  function isAdminSafe(){
    try{return !!isAdmin();}
    catch(_){return String(S()?.profile?.role||'').trim().toLowerCase()==='admin';}
  }
  function userId(){
    try{return currentStaffId();}
    catch(_){return S()?.profile?.id||null;}
  }
  function toast(message,tone){
    try{showToast(message,tone?{tone}:undefined);}
    catch(_){console.info(message);}
  }
  function friendly(error){
    try{return friendlyDbError(error);}
    catch(_){return error?.message||error?.details||error?.hint||String(error||'เกิดข้อผิดพลาด');}
  }
  function clone(value){
    try{return structuredClone(value);}
    catch(_){try{return JSON.parse(JSON.stringify(value));}catch(__){return value;}}
  }
  function cleanCode(value){return String(value||'').replace(/^OUTING:/i,'').trim();}
  function isConfigCode(code){return String(code||'').startsWith(`${CFG_PREFIX}:`)||String(code||'')===BASE_COUNT_KEY;}
  function isOutingRow(row){return row?.is_outing===true||String(row?.eligibility_code||'').startsWith('OUTING:');}
  function rowKey(row){return `${cleanCode(row?.code)}|${isOutingRow(row)?'1':'0'}`;}
  function timeoutError(label){
    const error=new Error(`${label} ใช้เวลานานเกิน ${Math.round(REQUEST_TIMEOUT_MS/1000)} วินาที ระบบยกเลิกการรอแล้ว กรุณาตรวจอินเทอร์เน็ตหรือสิทธิ์ Supabase`);
    error.code='CNMI_SAVE_TIMEOUT';
    return error;
  }
  async function runQuery(label,query,timeoutMs=REQUEST_TIMEOUT_MS){
    let timer;
    try{
      const result=await Promise.race([
        Promise.resolve(query),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(timeoutError(label)),timeoutMs);})
      ]);
      if(result?.error)throw result.error;
      return result;
    }finally{if(timer)clearTimeout(timer);}
  }
  function setStatus(text,tone='working'){
    const el=document.getElementById('syncStatus');
    if(!el)return;
    if(!el.dataset.v289Original)el.dataset.v289Original=el.textContent||'พร้อมใช้งาน';
    el.textContent=text||el.dataset.v289Original;
    el.dataset.v289Tone=tone;
  }
  function setButtonsBusy(busy,label){
    document.querySelectorAll('[data-v260-save-slot-base],[data-v224-save-all],[data-v226-save-all],[data-v224-save-current],[data-v226-save-current],[data-v231-save-base-slot]').forEach(button=>{
      button.disabled=!!busy;
      button.setAttribute('aria-busy',busy?'true':'false');
    });
    if(busy)setStatus(label||'กำลังบันทึก…');
  }
  function rawCurrentConfigs(){
    const st=S();
    try{
      return clone(
        window.cnmiV224?.currentConfigs?.()
        ||window.cnmiV227?.currentConfigs226?.()
        ||window.cnmiV226?.currentConfigs226?.()
        ||st?.slotTemplateV224?.configs
        ||{day:{},outing:[],outing_by_count:{}}
      );
    }catch(_){return clone(st?.slotTemplateV224?.configs||{day:{},outing:[],outing_by_count:{}});}
  }
  function normalizedConfigs(){
    const raw=rawCurrentConfigs();
    try{return window.cnmiV260?.normalizeConfig?window.cnmiV260.normalizeConfig(raw):raw;}
    catch(error){console.warn(`${VERSION}: V260 normalize skipped`,error);return raw;}
  }
  function normalizeRows(rows,outing){
    return (Array.isArray(rows)?rows:[]).map((row,index)=>{
      const code=cleanCode(row?.code||row?.position_code||row?.eligibility_code);
      if(!code)return null;
      const rawZone=String(row?.zone||'').trim();
      const zone=rawZone||(outing?'ออกหน่วย':(/^DR-/i.test(code)?'Donor Room':'Blood Bank'));
      return {
        code,
        eligibility_code:outing?`OUTING:${code}`:(String(row?.eligibility_code||'').replace(/^OUTING:/i,'').trim()||code),
        zone,
        break_time:String(row?.break_time||'').trim()||(outing?'ออกหน่วย':'-'),
        main_rule:String(row?.main_rule||'').trim()||null,
        job_desc:String(row?.job_desc||row?.detail||'').trim()||null,
        is_outing:!!outing,
        is_active:true,
        sort_order:Number(row?.sort_order||row?.order||index+1)||(index+1),
        deleted_at:null,
        updated_by:userId()
      };
    }).filter(Boolean);
  }
  function configEntries(cfg){
    const entries=[];
    DAY_SETS.forEach(count=>entries.push({
      code:`${CFG_PREFIX}:DAY:${count}`,
      rows:normalizeRows(cfg?.day?.[count]||cfg?.day?.[String(count)]||[],false)
    }));
    const outing14=normalizeRows(cfg?.outing_by_count?.[14]||cfg?.outing_by_count?.['14']||cfg?.outing||[],true);
    entries.push({code:`${CFG_PREFIX}:OUTING`,rows:outing14});
    OUTING_SETS.forEach(count=>entries.push({
      code:`${CFG_PREFIX}:OUTING:${count}`,
      rows:normalizeRows(cfg?.outing_by_count?.[count]||cfg?.outing_by_count?.[String(count)]||(count===14?outing14:[])||[],true)
    }));
    return entries;
  }
  function validateConfigEntries(entries){
    const problems=[];
    (entries||[]).forEach(entry=>{
      const day=String(entry?.code||'').match(/:DAY:(\d+)$/);
      const outing=String(entry?.code||'').match(/:OUTING:(\d+)$/);
      const expected=day?Number(day[1]):outing?Number(outing[1]):String(entry?.code||'').endsWith(':OUTING')?14:0;
      const actual=Array.isArray(entry?.rows)?entry.rows.length:0;
      if(expected&&actual!==expected)problems.push(`${entry.code} มี ${actual}/${expected} Slot`);
    });
    if(problems.length)throw new Error(`ข้อมูลชุด Slot ยังไม่ครบ จึงหยุดก่อนบันทึกเพื่อป้องกันฐานข้อมูลเสีย: ${problems.join(' · ')}`);
    return true;
  }
  function configPayload(entry){
    return {
      code:entry.code,
      eligibility_code:null,
      zone:'SYSTEM',
      break_time:'-',
      main_rule:'SLOT_TEMPLATE_CONFIG',
      job_desc:JSON.stringify(entry.rows||[]),
      is_outing:false,
      is_active:false,
      sort_order:99000,
      deleted_at:null,
      updated_by:userId()
    };
  }
  function baseCount(){
    const fromApi=Number(window.cnmiV231?.getBaseSlotCount231?.());
    const fromInput=Number(document.getElementById('slotBaseCountV231')?.value);
    const fromState=Number(S()?.baseSlotCountV231);
    const value=[fromInput,fromApi,fromState,14].find(n=>Number.isFinite(n)&&n>=8&&n<=14);
    return Math.max(8,Math.min(14,Math.round(value||14)));
  }
  function baseCountPayload(){
    const value=baseCount();
    return {
      code:BASE_COUNT_KEY,
      eligibility_code:null,
      zone:'SYSTEM',
      break_time:'-',
      main_rule:'MAIN_DAY_SLOT_COUNT',
      job_desc:JSON.stringify({base_slot_count:value,updated_at:new Date().toISOString()}),
      is_outing:false,
      is_active:false,
      sort_order:99010,
      deleted_at:null,
      updated_by:userId()
    };
  }
  function activeMasterPayloads(cfg){
    const dayMap=new Map();
    [14,13,12,11,10,9,8].forEach(count=>{
      normalizeRows(cfg?.day?.[count]||cfg?.day?.[String(count)]||[],false).forEach(row=>{
        if(row.code&&!dayMap.has(row.code))dayMap.set(row.code,row);
      });
    });
    const outingRows=normalizeRows(cfg?.outing_by_count?.[14]||cfg?.outing_by_count?.['14']||cfg?.outing||[],true);
    const outingMap=new Map();
    outingRows.forEach(row=>{if(row.code&&!outingMap.has(row.code))outingMap.set(row.code,row);});
    return [...dayMap.values(),...outingMap.values()];
  }
  function selectedKind(){
    return String(
      document.getElementById('slotTemplateKindV226')?.value
      ||document.querySelector('[data-v226-kind]')?.value
      ||S()?.slotTemplateV224?.kind
      ||'day'
    ).toLowerCase()==='outing'?'outing':'day';
  }
  function selectedCount(){
    const value=Number(
      document.getElementById('slotTemplateSetV226')?.value
      ||document.querySelector('[data-v226-set]')?.value
      ||S()?.slotTemplateV224?.setNo
      ||14
    );
    return Math.max(8,Math.min(14,Math.round(Number.isFinite(value)?value:14)));
  }
  function selectedConfigPayloads(cfg){
    const kind=selectedKind();
    const count=selectedCount();
    if(kind==='outing'){
      const bucket=count<=12?12:(count<=13?13:14);
      const rows=normalizeRows(cfg?.outing_by_count?.[bucket]||cfg?.outing_by_count?.[String(bucket)]||cfg?.outing||[],true);
      const payloads=[configPayload({code:`${CFG_PREFIX}:OUTING:${bucket}`,rows})];
      if(bucket===14)payloads.push(configPayload({code:`${CFG_PREFIX}:OUTING`,rows}));
      return {payloads,label:`ชุดออกหน่วย ${bucket} คน`,expected:[`${CFG_PREFIX}:OUTING:${bucket}`,...(bucket===14?[`${CFG_PREFIX}:OUTING`]:[])]};
    }
    const rows=normalizeRows(cfg?.day?.[count]||cfg?.day?.[String(count)]||[],false);
    return {payloads:[configPayload({code:`${CFG_PREFIX}:DAY:${count}`,rows})],label:`ชุดวันทำงานปกติ ${count} คน`,expected:[`${CFG_PREFIX}:DAY:${count}`]};
  }
  async function readExisting(){
    const db=DB();
    return runQuery('อ่านฐานตำแหน่งเดิม',db.from('daily_position_masters').select('id,code,eligibility_code,is_outing,is_active,deleted_at'));
  }
  async function bulkUpsert(payloads,label){
    if(!payloads.length)throw new Error('ไม่มีข้อมูล Slot สำหรับบันทึก');
    const db=DB();
    return runQuery(label,db.from('daily_position_masters').upsert(payloads,{onConflict:'code,is_outing'}));
  }
  async function deactivateObsolete(existing,expectedKeys){
    const ids=(existing||[]).filter(row=>{
      if(isConfigCode(row?.code)||row?.is_active===false)return false;
      return !expectedKeys.has(rowKey(row));
    }).map(row=>row.id).filter(Boolean);
    if(!ids.length)return 0;
    const db=DB();
    await runQuery('ปิดตำแหน่งเก่าที่ไม่ได้ใช้งาน',db.from('daily_position_masters').update({
      is_active:false,
      deleted_at:new Date().toISOString(),
      updated_by:userId()
    }).in('id',ids));
    return ids.length;
  }
  async function verifyAll(expectedConfigCodes,expectedMasterKeys){
    const db=DB();
    const result=await runQuery('ตรวจสอบข้อมูลที่บันทึกกลับจาก Supabase',db.from('daily_position_masters').select('*'));
    const rows=result.data||[];
    const missingConfigs=expectedConfigCodes.filter(code=>!rows.some(row=>String(row?.code||'')===code&&row?.is_outing===false));
    const activeKeys=new Set(rows.filter(row=>!isConfigCode(row?.code)&&row?.is_active!==false&&!row?.deleted_at).map(rowKey));
    const missingMasters=[...expectedMasterKeys].filter(key=>!activeKeys.has(key));
    const unexpected=[...activeKeys].filter(key=>!expectedMasterKeys.has(key));
    if(missingConfigs.length||missingMasters.length||unexpected.length){
      const parts=[];
      if(missingConfigs.length)parts.push(`ชุด Slot ขาด ${missingConfigs.length} ชุด`);
      if(missingMasters.length)parts.push(`ตำแหน่งใช้งานขาด ${missingMasters.length} รายการ`);
      if(unexpected.length)parts.push(`ยังมีตำแหน่งเก่าเปิดใช้งาน ${unexpected.length} รายการ`);
      throw new Error(`Supabase ตอบกลับไม่ครบ: ${parts.join(' · ')}`);
    }
    const st=S();
    if(st){
      st.positionMasters=rows;
      st.positionMastersLoaded=true;
      st.positionMasterLoadError='';
      st.baseSlotCountV231=baseCount();
      st.baseSlotCountLoadedV231=true;
    }
    return rows;
  }
  async function verifySelected(expectedCodes){
    const db=DB();
    const result=await runQuery('ตรวจสอบชุด Slot ที่บันทึก',db.from('daily_position_masters').select('code,is_outing,job_desc').in('code',expectedCodes));
    const rows=result.data||[];
    const missing=expectedCodes.filter(code=>!rows.some(row=>String(row?.code||'')===code&&row?.is_outing===false));
    if(missing.length)throw new Error(`อ่านข้อมูลกลับไม่พบ ${missing.join(', ')}`);
    return rows;
  }
  function applyLocal(cfg){
    try{window.cnmiV260?.applySlotConfig?.(cfg);}catch(error){console.warn(`${VERSION}: apply V260 skipped`,error);}
    try{window.cnmiV224?.applyConfigsToRuntime?.();}catch(_){}
    try{localStorage.setItem('cnmi_slot_template_v224_cache',JSON.stringify(cfg));}catch(_){}
  }
  async function confirmSave(message,title){
    try{
      return typeof confirmDialog==='function'?await confirmDialog(message,title):window.confirm(message);
    }catch(_){return window.confirm(message);}
  }
  async function saveAll(){
    if(!isAdminSafe())return toast('เฉพาะ Admin เท่านั้น','error');
    if(saving)return toast('ระบบกำลังบันทึกอยู่ กรุณารอผลรายการเดิม');
    const accepted=await confirmSave('บันทึกชุด Slot 8-14 คน ชุดออกหน่วย 12-14 คน จำนวน Slot หลัก และฐานตำแหน่งที่ใช้งานจริงลง Supabase หรือไม่? การบันทึกนี้จะไม่แตะสิทธิ์เฉพาะบุคคล','ยืนยันบันทึกฐานตำแหน่ง');
    if(!accepted)return;

    const myOperation=++operationNo;
    saving=true;
    setButtonsBusy(true,'กำลังเตรียมข้อมูล Slot…');
    try{
      const db=DB();
      if(!db)throw new Error('ไม่พบ Supabase client');
      const cfg=normalizedConfigs();
      const configs=configEntries(cfg);
      validateConfigEntries(configs);
      const masters=activeMasterPayloads(cfg);
      if(!masters.length)throw new Error('ไม่พบรายการตำแหน่งใช้งาน จึงยังไม่บันทึกเพื่อป้องกันฐานข้อมูลว่าง');
      const configPayloads=configs.map(configPayload);
      const expectedConfigCodes=[...configs.map(x=>x.code),BASE_COUNT_KEY];
      const expectedMasterKeys=new Set(masters.map(rowKey));

      setStatus('กำลังอ่านฐานตำแหน่งเดิม…');
      const existing=(await readExisting()).data||[];

      setStatus(`กำลังบันทึก ${configPayloads.length} ชุด และ ${masters.length} ตำแหน่ง…`);
      await bulkUpsert([...configPayloads,baseCountPayload(),...masters],'บันทึกฐานตำแหน่งแบบกลุ่ม');

      setStatus('กำลังปิดตำแหน่งเก่าที่ไม่อยู่ในชุดปัจจุบัน…');
      await deactivateObsolete(existing,expectedMasterKeys);

      setStatus('กำลังตรวจสอบข้อมูลจาก Supabase…');
      await verifyAll(expectedConfigCodes,expectedMasterKeys);
      if(myOperation!==operationNo)return;

      applyLocal(cfg);
      toast(`บันทึกสำเร็จและตรวจสอบกลับแล้ว: ${configPayloads.length} ชุด Slot · ${masters.length} ตำแหน่ง · Slot หลัก ${baseCount()} คน`);
      setStatus('บันทึก Supabase สำเร็จ','success');
      setTimeout(()=>{if(myOperation===operationNo)setStatus('พร้อมใช้งาน','ready');},2500);
    }catch(error){
      console.error(`${VERSION}: save all failed`,error);
      toast('บันทึกฐานตำแหน่งไม่สำเร็จ: '+friendly(error),'error');
      setStatus('บันทึกไม่สำเร็จ','error');
      setTimeout(()=>{if(myOperation===operationNo)setStatus('พร้อมใช้งาน','ready');},3500);
    }finally{
      if(myOperation===operationNo){saving=false;setButtonsBusy(false);}
    }
  }
  async function saveCurrent(){
    if(!isAdminSafe())return toast('เฉพาะ Admin เท่านั้น','error');
    if(saving)return toast('ระบบกำลังบันทึกอยู่ กรุณารอผลรายการเดิม');
    const myOperation=++operationNo;
    saving=true;
    setButtonsBusy(true,'กำลังบันทึกชุดที่เลือก…');
    try{
      const db=DB();
      if(!db)throw new Error('ไม่พบ Supabase client');
      const cfg=normalizedConfigs();
      const selected=selectedConfigPayloads(cfg);
      await bulkUpsert(selected.payloads,`บันทึก${selected.label}`);
      await verifySelected(selected.expected);
      if(myOperation!==operationNo)return;
      applyLocal(cfg);
      toast(`บันทึก ${selected.label} ลง Supabase และตรวจสอบกลับแล้ว`);
      setStatus('บันทึก Supabase สำเร็จ','success');
      setTimeout(()=>{if(myOperation===operationNo)setStatus('พร้อมใช้งาน','ready');},2200);
    }catch(error){
      console.error(`${VERSION}: save current failed`,error);
      toast('บันทึกชุดนี้ไม่สำเร็จ: '+friendly(error),'error');
      setStatus('บันทึกไม่สำเร็จ','error');
      setTimeout(()=>{if(myOperation===operationNo)setStatus('พร้อมใช้งาน','ready');},3500);
    }finally{
      if(myOperation===operationNo){saving=false;setButtonsBusy(false);}
    }
  }
  async function saveBaseOnly(){
    if(!isAdminSafe())return toast('เฉพาะ Admin เท่านั้น','error');
    if(saving)return toast('ระบบกำลังบันทึกอยู่ กรุณารอผลรายการเดิม');
    const myOperation=++operationNo;
    saving=true;
    setButtonsBusy(true,'กำลังบันทึกจำนวน Slot หลัก…');
    try{
      const db=DB();
      if(!db)throw new Error('ไม่พบ Supabase client');
      await bulkUpsert([baseCountPayload()],'บันทึกจำนวน Slot หลัก');
      await verifySelected([BASE_COUNT_KEY]);
      const st=S();
      if(st){st.baseSlotCountV231=baseCount();st.baseSlotCountLoadedV231=true;}
      toast(`บันทึกจำนวน Slot หลัก ${baseCount()} คนลง Supabase และตรวจสอบกลับแล้ว`);
      setStatus('บันทึก Supabase สำเร็จ','success');
      setTimeout(()=>{if(myOperation===operationNo)setStatus('พร้อมใช้งาน','ready');},2200);
    }catch(error){
      console.error(`${VERSION}: save base count failed`,error);
      toast('บันทึกจำนวน Slot หลักไม่สำเร็จ: '+friendly(error),'error');
      setStatus('บันทึกไม่สำเร็จ','error');
      setTimeout(()=>{if(myOperation===operationNo)setStatus('พร้อมใช้งาน','ready');},3500);
    }finally{
      if(myOperation===operationNo){saving=false;setButtonsBusy(false);}
    }
  }

  /* Window capture runs before the older document-capture listeners in V224/V226/V231/V260. */
  window.addEventListener('click',event=>{
    const all=event.target?.closest?.('[data-v260-save-slot-base],[data-v224-save-all],[data-v226-save-all]');
    const current=event.target?.closest?.('[data-v224-save-current],[data-v226-save-current]');
    const base=event.target?.closest?.('[data-v231-save-base-slot]');
    if(!all&&!current&&!base)return;
    event.preventDefault();
    event.stopPropagation();
    if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();
    if(all){saveAll();return;}
    if(current){saveCurrent();return;}
    if(base)saveBaseOnly();
  },true);

  try{
    window.cnmiV260=window.cnmiV260||{};
    window.cnmiV260.saveAllSlotConfigsAsCurrentBase=saveAll;
    window.cnmiV289={saveAll,saveCurrent,saveBaseOnly,runQuery,normalizedConfigs,activeMasterPayloads};
  }catch(_){}

  const style=document.createElement('style');
  style.id='v289-position-save-status-style';
  style.textContent=`
    #syncStatus[data-v289-tone="working"]{color:#92400e;background:#fef3c7;border-color:#fcd34d}
    #syncStatus[data-v289-tone="success"]{color:#166534;background:#dcfce7;border-color:#86efac}
    #syncStatus[data-v289-tone="error"]{color:#991b1b;background:#fee2e2;border-color:#fca5a5}
    [aria-busy="true"]{cursor:wait!important;opacity:.68!important}
  `;
  document.head.appendChild(style);
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v289-position-base-bulk-save-timeout.js", error); }
;

/* Original source: patch-v290-position-month-ajax-no-rerender.js */
try {
/* CNMI Staff Planner V290
   Monthly daytime-position background save without page rerender.
   - Intercepts Admin position dropdown/drop changes before the legacy V275 handler.
   - Saves through Supabase JS (Fetch/AJAX) without form postback or renderPage().
   - Keeps horizontal/vertical table scroll and the browser viewport unchanged.
   - Updates the affected cells, counters, summaries, and local state in place.
   - Serializes saves per date and adds a request timeout to avoid endless waiting.
   No SQL or schema change is required.
*/
(function(){
  'use strict';
  const VERSION='V290_POSITION_MONTH_AJAX_NO_RERENDER';
  if(window.__CNMI_V290_POSITION_MONTH_AJAX_NO_RERENDER__)return;
  window.__CNMI_V290_POSITION_MONTH_AJAX_NO_RERENDER__=true;

  const REQUEST_TIMEOUT_MS=18000;
  const SAVE_DEBOUNCE_MS=120;
  const cellControllers=new Map();
  const mentorControllers=new Map();
  const dateChains=new Map();

  function S(){try{return state||window.state||null;}catch(_){return window.state||null;}}
  function DB(){try{return sb||window.sb||null;}catch(_){return window.sb||null;}}
  function normId(value){return String(value==null?'':value);}
  function normDate(value){
    try{return normalizeDateKey(value);}
    catch(_){return String(value||'').slice(0,10);}
  }
  function currentStaff(){
    try{return currentStaffId();}
    catch(_){return S()?.profile?.id||null;}
  }
  function isAdminSafe(){
    try{return !!isAdmin();}
    catch(_){return String(S()?.profile?.role||'').trim().toLowerCase()==='admin';}
  }
  function isTargetPage(){return String(S()?.page||'')==='positionMonth'&&isAdminSafe();}
  function friendly(error){
    try{return friendlyDbError(error);}
    catch(_){return error?.message||error?.details||error?.hint||String(error||'เกิดข้อผิดพลาด');}
  }
  function toast(message,tone){
    try{showToast(message,tone?{tone}:undefined);}
    catch(_){console.info(message);}
  }
  function escapeSafe(value){
    try{return escapeHtml(value==null?'':String(value));}
    catch(_){return String(value==null?'':value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  }
  function cssEscape(value){
    try{return CSS.escape(String(value??''));}
    catch(_){return String(value??'').replace(/["\\]/g,'\\$&');}
  }
  function timeoutError(label){
    const error=new Error(`${label} ใช้เวลานานเกิน ${Math.round(REQUEST_TIMEOUT_MS/1000)} วินาที กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่`);
    error.code='CNMI_V290_TIMEOUT';
    return error;
  }
  async function runQuery(label,query){
    let timer;
    try{
      const result=await Promise.race([
        Promise.resolve(query),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(timeoutError(label)),REQUEST_TIMEOUT_MS);})
      ]);
      if(result?.error)throw result.error;
      return result;
    }finally{if(timer)clearTimeout(timer);}
  }
  function positionCode(row){return String(row?.code||row?.position_code||'').trim();}
  function isOutingDateSafe(date){
    const key=normDate(date);
    try{return !!hasOuting(key);}
    catch(_){return (S()?.activities||[]).some(a=>String(a?.event_type||'').trim()==='ออกหน่วย'&&normDate(a?.start_date)<=key&&normDate(a?.end_date||a?.start_date)>=key);}
  }
  function isOutingMaster(row){
    const zone=String(row?.zone||'').trim().toLowerCase();
    return row?.is_outing===true||zone.includes('ออกหน่วย')||String(row?.eligibility_code||'').startsWith('OUTING:');
  }
  function positionMaster(code,date=''){
    const wanted=String(code||'');
    if(date){
      try{
        const configured=window.cnmiV278?.templateRowsForDate?.(normDate(date))?.find(row=>positionCode(row)===wanted);
        if(configured)return configured;
      }catch(_){}
    }
    const candidates=(S()?.positionMasters||[]).filter(row=>positionCode(row)===wanted);
    if(!candidates.length)return null;
    if(date){
      const outing=isOutingDateSafe(date);
      const matched=candidates.find(row=>isOutingMaster(row)===outing);
      if(matched)return matched;
    }
    return candidates.find(row=>!isOutingMaster(row))||candidates[0];
  }
  function positionRow(date,staffId){
    return (S()?.positions||[]).find(row=>normDate(row?.work_date)===date&&normId(row?.staff_id)===normId(staffId))||null;
  }
  function controllerKey(date,staffId){return `${date}|${normId(staffId)}`;}
  function controllerFor(cell,select){
    const date=normDate(cell?.dataset?.date);
    const staffId=normId(cell?.dataset?.staffId);
    const key=controllerKey(date,staffId);
    let controller=cellControllers.get(key);
    if(!controller){
      controller={key,date,staffId,seq:0,timer:null,committedCode:String(positionRow(date,staffId)?.position_code||select?.value||''),desiredCode:String(select?.value||''),cell,select};
      cellControllers.set(key,controller);
    }else{
      controller.cell=cell;
      controller.select=select;
      if(controller.committedCode==null)controller.committedCode=String(positionRow(date,staffId)?.position_code||'');
    }
    return controller;
  }
  function markStatus(cell,text,stateName){
    const status=cell?.querySelector?.('[data-v275-status]');
    if(status)status.textContent=text||'';
    if(cell){
      if(stateName)cell.dataset.v290SaveState=stateName;
      else delete cell.dataset.v290SaveState;
    }
  }
  function syncInfoButton(cell,code){
    if(!cell)return;
    let button=cell.querySelector('[data-v275-job]');
    if(!code){button?.remove();return;}
    if(!button){
      button=document.createElement('button');
      button.type='button';
      button.className='v275-info';
      button.textContent='i';
      const select=cell.querySelector('[data-v275-position-select]');
      select?.insertAdjacentElement('afterend',button);
    }
    button.dataset.v275Job=code;
  }
  function setCellValue(date,staffId,code,message){
    const cell=document.querySelector(`[data-v275-position-cell][data-date="${cssEscape(date)}"][data-staff-id="${cssEscape(staffId)}"]`);
    if(!cell)return;
    const select=cell.querySelector('[data-v275-position-select]');
    if(select)select.value=String(code||'');
    syncInfoButton(cell,String(code||''));
    const controller=controllerFor(cell,select);
    controller.committedCode=String(code||'');
    controller.desiredCode=String(code||'');
    if(message){
      markStatus(cell,message,'saved');
      setTimeout(()=>{if(cell.isConnected&&cell.dataset.v290SaveState==='saved')markStatus(cell,'','');},1300);
    }
  }
  function updateLocalState(date,staffId,code,savedRow){
    const st=S();
    if(!st)return {displacedStaffIds:[],currentYearDelta:0,displacedYearDelta:{}};
    const existing=Array.isArray(st.positions)?st.positions:[];
    const currentHadRow=existing.some(row=>normDate(row?.work_date)===date&&normId(row?.staff_id)===normId(staffId)&&String(row?.position_code||'').trim());
    const displacedStaffIds=[];
    existing.forEach(row=>{
      if(normDate(row?.work_date)!==date)return;
      if(code&&String(row?.position_code||'')===code&&normId(row?.staff_id)!==normId(staffId))displacedStaffIds.push(normId(row.staff_id));
    });
    st.positions=existing.filter(row=>{
      if(normDate(row?.work_date)!==date)return true;
      if(normId(row?.staff_id)===normId(staffId))return false;
      if(code&&String(row?.position_code||'')===code)return false;
      return true;
    });
    if(savedRow)st.positions.push(savedRow);
    const uniqueDisplaced=[...new Set(displacedStaffIds)];
    return {
      displacedStaffIds:uniqueDisplaced,
      currentYearDelta:(code?1:0)-(currentHadRow?1:0),
      displacedYearDelta:Object.fromEntries(uniqueDisplaced.map(id=>[id,-1]))
    };
  }
  function updateDateCount(date){
    const selects=[...document.querySelectorAll(`.v275-position-wrap [data-v275-position-cell][data-date="${cssEscape(date)}"] [data-v275-position-select]`)];
    const actual=new Set(selects.filter(select=>String(select.value||'').trim()).map(select=>normId(select.closest('[data-v275-position-cell]')?.dataset?.staffId)).filter(Boolean)).size;
    const input=document.querySelector(`.v275-position-wrap [data-v275-slot][data-date="${cssEscape(date)}"]`);
    const label=input?.closest('.v275-slot-control')?.querySelector('b');
    if(label)label.textContent=`${actual}/`;
  }
  function staffName(staffId){
    const person=(S()?.staff||[]).find(row=>normId(row?.id)===normId(staffId));
    return String(person?.nickname||person?.full_name||person?.email||'');
  }
  function zoneBucket(row){
    const date=normDate(row?.work_date),master=positionMaster(row?.position_code,date)||{},code=String(row?.position_code||'').trim().toUpperCase(),zone=String(row?.zone||master.zone||'').trim().toLowerCase();
    if(isOutingDateSafe(date)&&(zone.includes('ออกหน่วย')||row?.is_outing===true))return'outing';
    if(code.startsWith('BB-'))return'bb';
    if(code.startsWith('DR-'))return'donor';
    if(zone.includes('donor')||zone.includes('บริจาค'))return'donor';
    return'bb';
  }
  function summaryFor(staffId,monthKey){
    const rows=Array.isArray(S()?.positions)?S().positions:[];
    const own=rows.filter(row=>normId(row?.staff_id)===normId(staffId)&&normDate(row?.work_date).startsWith(monthKey));
    const result={total:own.length,bb:0,donor:0,outing:0,counts:{}};
    own.forEach(row=>{result[zoneBucket(row)]+=1;const code=String(row?.position_code||'-');result.counts[code]=(result.counts[code]||0)+1;});
    result.top=Object.entries(result.counts).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([code,count])=>`${code} ${count}`).join(' · ');
    return result;
  }
  function displayedYearTotal(staffId){
    const button=document.querySelector(`[data-v275-position-summary="${cssEscape(staffId)}"]`);
    const match=String(button?.querySelector('span')?.textContent||'').match(/ปีงบ\s*(\d+)/);
    if(match)return Number(match[1]);
    const name=staffName(staffId);
    let value=null;
    document.querySelectorAll('.v275-admin-position-stats tbody tr').forEach(row=>{
      if(value!=null||String(row.querySelector('td:first-child b')?.textContent||'').trim()!==name.trim())return;
      const cells=row.querySelectorAll('td');
      const parsed=Number(cells[6]?.textContent);
      if(Number.isFinite(parsed))value=parsed;
    });
    return Number.isFinite(value)?value:0;
  }
  function updateStaffSummary(staffId,date,yearDelta=0){
    if(!staffId)return;
    const monthKey=date.slice(0,7),summary=summaryFor(staffId,monthKey);
    const yearTotal=Math.max(0,displayedYearTotal(staffId)+Number(yearDelta||0));
    const button=document.querySelector(`[data-v275-position-summary="${cssEscape(staffId)}"]`);
    if(button){
      button.innerHTML=`<b>BB ${summary.bb} · Donor ${summary.donor}</b><span>ออกหน่วย ${summary.outing} · ปีงบ ${yearTotal}</span><small>${escapeSafe(summary.top||'ยังไม่มีตำแหน่ง')}</small>`;
    }
    const name=staffName(staffId);
    if(name){
      document.querySelectorAll('.v275-admin-position-stats tbody tr').forEach(row=>{
        if(String(row.querySelector('td:first-child b')?.textContent||'').trim()!==name.trim())return;
        const cells=row.querySelectorAll('td');
        if(cells[1])cells[1].textContent=String(summary.total);
        if(cells[2])cells[2].textContent=String(summary.bb);
        if(cells[3])cells[3].textContent=String(summary.donor);
        if(cells[4])cells[4].textContent=String(summary.outing);
        if(cells[5])cells[5].textContent=summary.top||'-';
        if(cells[6])cells[6].textContent=String(yearTotal);
      });
    }
  }
  function enqueueDate(date,task){
    const previous=dateChains.get(date)||Promise.resolve();
    const next=previous.catch(()=>{}).then(task);
    const tracked=next.finally(()=>{if(dateChains.get(date)===tracked)dateChains.delete(date);});
    dateChains.set(date,tracked);
    return next;
  }
  async function persistPosition(controller,requestedCode,operationSeq){
    const {date,staffId}=controller;
    const db=DB();
    if(!db)throw new Error('ไม่พบ Supabase client');
    const code=String(requestedCode||'').trim();
    const cell=controller.cell;
    markStatus(cell,'กำลังบันทึก…','saving');

    await runQuery('ลบตำแหน่งเดิมของเจ้าหน้าที่',db.from('daily_positions').delete().eq('work_date',date).eq('staff_id',staffId));
    if(code){
      await runQuery('ตรวจสอบตำแหน่งซ้ำในวันเดียวกัน',db.from('daily_positions').delete().eq('work_date',date).eq('position_code',code));
    }

    let savedRow=null;
    if(code){
      const master=positionMaster(code,date)||{};
      const payload={
        work_date:date,
        position_code:code,
        zone:master.zone||'',
        break_time:master.break_time||'-',
        main_rule:master.main_rule||'',
        job_desc:master.job_desc||'',
        staff_id:staffId,
        updated_by:currentStaff()
      };
      const inserted=await runQuery('บันทึกตำแหน่งที่เลือก',db.from('daily_positions').insert(payload).select('*').single());
      savedRow=inserted.data||payload;
    }
    await runQuery('บันทึกสถานะร่างของวัน',db.from('daily_position_day_status').upsert({work_date:date,month_key:date.slice(0,7),status:'draft',updated_by:currentStaff()},{onConflict:'work_date'}));

    const {displacedStaffIds,currentYearDelta,displacedYearDelta}=updateLocalState(date,staffId,code,savedRow);
    controller.committedCode=code;
    displacedStaffIds.forEach(id=>setCellValue(date,id,'','ตำแหน่งถูกย้าย'));
    updateDateCount(date);
    updateStaffSummary(staffId,date,currentYearDelta);
    displacedStaffIds.forEach(id=>updateStaffSummary(id,date,displacedYearDelta[id]||0));

    if(controller.seq===operationSeq){
      const liveCell=document.querySelector(`[data-v275-position-cell][data-date="${cssEscape(date)}"][data-staff-id="${cssEscape(staffId)}"]`)||cell;
      const liveSelect=liveCell?.querySelector?.('[data-v275-position-select]');
      if(liveSelect)liveSelect.value=code;
      syncInfoButton(liveCell,code);
      markStatus(liveCell,'บันทึกแล้ว','saved');
      setTimeout(()=>{if(liveCell?.isConnected&&liveCell.dataset.v290SaveState==='saved')markStatus(liveCell,'','');},1300);
    }
    return savedRow;
  }
  function schedulePositionSave(cell,select,code){
    if(!cell||!select)return;
    const controller=controllerFor(cell,select);
    controller.seq+=1;
    controller.desiredCode=String(code||'');
    controller.cell=cell;
    controller.select=select;
    const operationSeq=controller.seq;
    clearTimeout(controller.timer);
    markStatus(cell,'รอบันทึก…','queued');
    controller.timer=setTimeout(()=>{
      controller.timer=null;
      enqueueDate(controller.date,()=>persistPosition(controller,controller.desiredCode,operationSeq)).catch(error=>{
        console.error(`${VERSION}: background save failed`,error);
        if(controller.seq===operationSeq){
          const liveCell=document.querySelector(`[data-v275-position-cell][data-date="${cssEscape(controller.date)}"][data-staff-id="${cssEscape(controller.staffId)}"]`)||controller.cell;
          const liveSelect=liveCell?.querySelector?.('[data-v275-position-select]');
          if(liveSelect)liveSelect.value=controller.committedCode||'';
          syncInfoButton(liveCell,controller.committedCode||'');
          markStatus(liveCell,'บันทึกไม่สำเร็จ','error');
        }
        toast(`บันทึกตำแหน่งไม่สำเร็จ: ${friendly(error)}`,'error');
      });
    },SAVE_DEBOUNCE_MS);
  }
  function captureCommitted(select){
    const cell=select?.closest?.('[data-v275-position-cell]');
    if(!cell)return;
    const controller=controllerFor(cell,select);
    if(!controller.timer&&controller.seq===0)controller.committedCode=String(positionRow(controller.date,controller.staffId)?.position_code||select.value||'');
  }
  function trainingIdentity(row){
    if(row?.trainee_staff_id)return `staff:${normId(row.trainee_staff_id)}`;
    return `name:${String(row?.trainee_name||'').trim().toLowerCase()}`;
  }
  function mentorFor(identity,date){
    return (S()?.trainingAssignmentsV271||[]).find(row=>trainingIdentity(row)===identity&&row?.active!==false&&normDate(row?.start_date)<=date&&normDate(row?.end_date)>=date)?.mentor_staff_id||'';
  }
  function mentorControllerFor(cell,select){
    const date=normDate(cell?.dataset?.date),identity=String(cell?.dataset?.identity||''),key=`${identity}|${date}`;
    let controller=mentorControllers.get(key);
    if(!controller){
      controller={key,date,identity,seq:0,timer:null,committedId:normId(mentorFor(identity,date)||select?.value||''),desiredId:normId(select?.value||''),cell,select};
      mentorControllers.set(key,controller);
    }else{controller.cell=cell;controller.select=select;}
    return controller;
  }
  function updateMentorCell(cell,mentorId){
    if(!cell)return;
    const date=normDate(cell.dataset?.date);
    const mentorPosition=mentorId?positionRow(date,mentorId):null;
    const label=cell.querySelector('span');
    if(label)label.textContent=mentorId?(mentorPosition?.position_code||'กรุณาเลือกพี่เลี้ยงแทน'):'เลือกพี่เลี้ยงแทนตำแหน่ง';
    cell.closest('td')?.classList.toggle('bad',!!mentorId&&!mentorPosition);
  }
  function updateTraineeSummary(cell){
    const row=cell?.closest('tr');
    const summary=row?.querySelector('.v275-trainee-summary');
    if(!summary)return;
    const identity=String(cell.dataset?.identity||'');
    const month=normDate(cell.dataset?.date).slice(0,7);
    const monthEnd=(()=>{const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);})();
    const names=new Set();
    (S()?.trainingAssignmentsV271||[]).forEach(item=>{
      if(trainingIdentity(item)!==identity||item?.active===false)return;
      if(normDate(item?.end_date)<`${month}-01`||normDate(item?.start_date)>monthEnd)return;
      if(item?.mentor_staff_id)names.add(staffName(item.mentor_staff_id));
    });
    const span=summary.querySelector('span');
    if(span)span.textContent=names.size?`พี่เลี้ยง: ${Array.from(names).join(', ')}`:'ยังไม่กำหนดพี่เลี้ยง';
  }
  async function persistMentor(controller,mentorId,operationSeq){
    const cell=controller.cell,date=controller.date,identity=controller.identity;
    if(!window.cnmiV272?.replaceRange)throw new Error('ไม่พบระบบบันทึกพี่เลี้ยง');
    markStatus(cell,'กำลังบันทึก…','saving');
    const args={
      traineeType:String(cell?.dataset?.type||'intern'),
      startDate:date,
      endDate:date,
      mentorStaffId:mentorId||null,
      note:'กำหนดจากตารางตำแหน่งกลางวัน V290'
    };
    if(identity.startsWith('staff:'))args.traineeStaffId=String(cell?.dataset?.traineeStaffId||identity.slice(6));
    else args.traineeName=String(cell?.dataset?.label||'');
    await runQuery('บันทึกพี่เลี้ยง',window.cnmiV272.replaceRange(args));
    if(window.cnmiV271?.loadTrainingAssignments)await runQuery('อ่านข้อมูลพี่เลี้ยงล่าสุด',window.cnmiV271.loadTrainingAssignments({force:true}));
    controller.committedId=normId(mentorId);
    updateMentorCell(cell,mentorId);
    updateTraineeSummary(cell);
    if(controller.seq===operationSeq){
      const select=cell?.querySelector?.('[data-v275-mentor-select]');
      if(select)select.value=normId(mentorId);
      markStatus(cell,'บันทึกแล้ว','saved');
      setTimeout(()=>{if(cell?.isConnected&&cell.dataset.v290SaveState==='saved')markStatus(cell,'','');},1300);
    }
  }
  function scheduleMentorSave(cell,select,mentorId){
    const controller=mentorControllerFor(cell,select);
    controller.seq+=1;
    controller.desiredId=normId(mentorId);
    const operationSeq=controller.seq;
    clearTimeout(controller.timer);
    markStatus(cell,'รอบันทึก…','queued');
    controller.timer=setTimeout(()=>{
      controller.timer=null;
      enqueueDate(`mentor:${controller.key}`,()=>persistMentor(controller,controller.desiredId,operationSeq)).catch(error=>{
        console.error(`${VERSION}: mentor background save failed`,error);
        if(controller.seq===operationSeq){
          select.value=controller.committedId||'';
          updateMentorCell(cell,controller.committedId||'');
          markStatus(cell,'บันทึกไม่สำเร็จ','error');
        }
        toast(`บันทึกพี่เลี้ยงไม่สำเร็จ: ${friendly(error)}`,'error');
      });
    },SAVE_DEBOUNCE_MS);
  }
  function captureMentorCommitted(select){
    const cell=select?.closest?.('[data-v275-mentor-cell]');
    if(!cell)return;
    const controller=mentorControllerFor(cell,select);
    if(!controller.timer&&controller.seq===0)controller.committedId=normId(mentorFor(controller.identity,controller.date)||select.value||'');
  }
  function interceptPositionChange(event){
    if(!isTargetPage())return false;
    const positionSelect=event.target?.closest?.('.v275-position-wrap [data-v275-position-select]');
    const mentorSelect=event.target?.closest?.('.v275-position-wrap [data-v275-mentor-select]');
    if(!positionSelect&&!mentorSelect)return false;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    if(positionSelect){
      const cell=positionSelect.closest('[data-v275-position-cell]');
      if(cell)schedulePositionSave(cell,positionSelect,positionSelect.value);
    }else{
      const cell=mentorSelect.closest('[data-v275-mentor-cell]');
      if(cell)scheduleMentorSave(cell,mentorSelect,mentorSelect.value);
    }
    return true;
  }
  function interceptPositionDrop(event){
    if(!isTargetPage())return false;
    const cell=event.target?.closest?.('.v275-position-wrap [data-v275-position-cell]');
    if(!cell)return false;
    const code=String(event.dataTransfer?.getData('v275Position')||'').trim();
    if(!code)return false;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    cell.classList.remove('drag-over');
    const select=cell.querySelector('[data-v275-position-select]');
    if(!select)return true;
    captureCommitted(select);
    select.value=code;
    schedulePositionSave(cell,select,code);
    return true;
  }

  /* Window capture runs before the legacy document-capture V275 listeners. */
  window.addEventListener('pointerdown',event=>{
    if(!isTargetPage())return;
    const positionSelect=event.target?.closest?.('.v275-position-wrap [data-v275-position-select]');
    const mentorSelect=event.target?.closest?.('.v275-position-wrap [data-v275-mentor-select]');
    if(positionSelect)captureCommitted(positionSelect);
    if(mentorSelect)captureMentorCommitted(mentorSelect);
  },true);
  window.addEventListener('focusin',event=>{
    if(!isTargetPage())return;
    const positionSelect=event.target?.closest?.('.v275-position-wrap [data-v275-position-select]');
    const mentorSelect=event.target?.closest?.('.v275-position-wrap [data-v275-mentor-select]');
    if(positionSelect)captureCommitted(positionSelect);
    if(mentorSelect)captureMentorCommitted(mentorSelect);
  },true);
  window.addEventListener('change',interceptPositionChange,true);
  window.addEventListener('drop',interceptPositionDrop,true);

  /* Safety net: a future form wrapper around this table must never create a browser postback. */
  window.addEventListener('submit',event=>{
    if(!isTargetPage())return;
    const form=event.target;
    if(!form?.querySelector?.('.v275-position-wrap'))return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
  },true);

  const style=document.createElement('style');
  style.id='v290-position-month-ajax-style';
  style.textContent=`
    .v275-position-cell[data-v290-save-state="queued"] select,.v275-mentor-cell[data-v290-save-state="queued"] select{border-color:#60a5fa}
    .v275-position-cell[data-v290-save-state="saving"] select,.v275-mentor-cell[data-v290-save-state="saving"] select{border-color:#2563eb;box-shadow:0 0 0 2px rgba(37,99,235,.12)}
    .v275-position-cell[data-v290-save-state="saved"] select,.v275-mentor-cell[data-v290-save-state="saved"] select{border-color:#16a34a}
    .v275-position-cell[data-v290-save-state="error"] select,.v275-mentor-cell[data-v290-save-state="error"] select{border-color:#dc2626}
  `;
  document.head.appendChild(style);

  window.cnmiV290={savePositionInBackground:(cell,code)=>{const select=cell?.querySelector?.('[data-v275-position-select]');if(select){select.value=String(code||'');schedulePositionSave(cell,select,code);}},version:VERSION};
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v290-position-month-ajax-no-rerender.js", error); }
;

/* Original source: patch-v291-position-month-always-dropdown-smooth-scroll.js */
try {
/* CNMI Staff Planner V291
   Monthly daytime-position rendering and scroll performance.
   - Leave days keep the normal Admin position dropdown; Admin decides whether to assign or leave blank.
   - Removes the old "ขยายช่องตาราง" control and locks the matrix viewport height.
   - Reduces scroll-time layout/paint work and avoids mutation work for tiny save-status changes.
   - V290 background Supabase save remains authoritative; no SQL/schema change.
*/
(function(){
  'use strict';
  const VERSION='V291_POSITION_MONTH_ALWAYS_DROPDOWN_SMOOTH_SCROLL';
  if(window.__CNMI_V291_POSITION_MONTH_ALWAYS_DROPDOWN_SMOOTH_SCROLL__)return;
  window.__CNMI_V291_POSITION_MONTH_ALWAYS_DROPDOWN_SMOOTH_SCROLL__=true;

  let queued=false;
  function S(){try{return state||window.state||null;}catch(_){return window.state||null;}}
  function isAdminSafe(){try{return !!isAdmin();}catch(_){return String(S()?.profile?.role||'').trim().toLowerCase()==='admin';}}
  function isTarget(){return String(S()?.page||'')==='positionMonth'&&isAdminSafe();}

  function apply(){
    if(!isTarget())return;
    const page=document.querySelector('.v275-page');
    const wrap=page?.querySelector('.v275-position-wrap');
    if(!page||!wrap)return;
    page.classList.add('v291-position-month-page');
    page.classList.remove('v281-relaxed');
    wrap.classList.add('v291-position-month-wrap');
    page.querySelectorAll('[data-v281-density]').forEach(button=>button.remove());
  }
  function queue(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;apply();});
  }

  const style=document.createElement('style');
  style.id='v291-position-month-style';
  style.textContent=`
    .v291-position-month-page .v291-position-month-wrap{
      height:420px!important;
      min-height:420px!important;
      max-height:420px!important;
      overflow:auto!important;
      overflow-anchor:none!important;
      overscroll-behavior:contain!important;
      scroll-behavior:auto!important;
      scrollbar-gutter:stable!important;
      touch-action:pan-x pan-y!important;
      will-change:scroll-position;
      isolation:isolate;
    }
    .v291-position-month-page .v275-position-table{
      table-layout:fixed!important;
      border-collapse:separate!important;
      border-spacing:0!important;
    }
    .v291-position-month-page .v275-position-table td,
    .v291-position-month-page .v275-position-table th{
      background-clip:padding-box!important;
    }
    .v291-position-month-page .v275-sticky-summary{
      box-shadow:none!important;
      border-right:2px solid #cbd5e1!important;
    }
    .v291-position-month-page .v275-position-cell,
    .v291-position-month-page .v275-mentor-cell{
      contain:layout style!important;
    }
    .v291-position-month-page .v291-leave-dropdown{
      position:relative!important;
      background:#fff7ed!important;
    }
    .v291-position-month-page .v291-leave-dropdown::after{
      content:attr(data-v291-leave-label);
      position:absolute;
      z-index:3;
      top:1px;
      left:3px;
      max-width:calc(100% - 20px);
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
      pointer-events:none;
      font-size:5.5px;
      line-height:7px;
      font-weight:700;
      color:#9a3412;
      background:rgba(255,247,237,.9);
      border-radius:3px;
      padding:0 2px;
    }
    .v291-position-month-page .v291-leave-dropdown .v275-position-cell select{
      padding-top:6px!important;
      line-height:14px!important;
    }
    .v291-position-month-page .v291-density-btn,
    .v291-position-month-page [data-v281-density]{display:none!important}

    @media(max-width:820px){
      .v291-position-month-page .v291-position-month-wrap{
        height:420px!important;
        min-height:420px!important;
        max-height:420px!important;
      }
    }
  `;
  document.head.appendChild(style);

  const root=document.getElementById('pageContent')||document.body;
  if(root){
    new MutationObserver(mutations=>{
      if(!isTarget())return;
      const structural=mutations.some(m=>Array.from(m.addedNodes||[]).some(node=>node?.nodeType===1&&(node.matches?.('.v275-page,.v275-position-wrap')||node.querySelector?.('.v275-position-wrap'))));
      if(structural)queue();
    }).observe(root,{childList:true,subtree:true});
  }
  document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,50),{once:true});
  setTimeout(apply,0);
  setTimeout(apply,180);

  window.cnmiV291={apply,version:VERSION};
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v291-position-month-always-dropdown-smooth-scroll.js", error); }
;

/* Original source: patch-v292-schedule-image-export.js */
try {
/* V292 Schedule image export
   - Replaces the staff schedule print button with image export.
   - Uses html2canvas with scale:2 and white background.
   - Captures a dedicated schedule wrapper without the page toolbar.
*/
(function(){
  'use strict';
  const VERSION_V292 = 'V341_SCHEDULE_IMAGE_FULL_MONTH_WIDTH_FIX';

  function safeHtml(v){
    try { return escapeHtml(v == null ? '' : String(v)); }
    catch (_) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  }
  function toast(msg, tone){
    try { showToast(msg, tone ? { tone } : undefined); }
    catch (_) { console[(tone === 'error' ? 'error' : 'log')](msg); }
  }
  function activeScheduleMonth(){
    try { return state?.monthKey || new Date().toISOString().slice(0,7); }
    catch (_) { return new Date().toISOString().slice(0,7); }
  }
  function activeScheduleView(){
    try {
      const v = state?.scheduleMobileView;
      return ['day','person','balance','table'].includes(v) ? v : 'table';
    } catch (_) { return 'table'; }
  }
  function fileName(){
    const month = activeScheduleMonth();
    return `schedule_${month}_ตารางทั้งเดือน.png`.replace(/[\/:*?"<>|]+/g, '-');
  }
  function fullMonthTitle(key){
    try {
      const [y,m] = String(key || '').split('-').map(Number);
      if (!y || !m) return key || '';
      const d = new Date(y, m - 1, 1);
      return d.toLocaleDateString('th-TH', { month:'long', year:'numeric' });
    } catch (_) { return key || ''; }
  }
  function renderExportBrandHeader(key){
    const monthLabel = safeHtml(fullMonthTitle(key) || key);
    return `
      <div class="schedule-brand-header">
        <div class="schedule-brand-logo" aria-hidden="true">
          <div class="schedule-brand-logo-circle">
            <span class="schedule-brand-logo-main">BB</span>
            <span class="schedule-brand-logo-sub">CNMI</span>
          </div>
        </div>
        <div class="schedule-brand-copy">
          <p class="schedule-brand-unit">เวชศาสตร์บริการโลหิต</p>
          <h3 class="schedule-export-title">ตารางเวรประจำเดือน</h3>
          <p class="schedule-export-subtitle">เดือน ${monthLabel}</p>
        </div>
      </div>
    `;
  }
  function ensureHtml2Canvas(){
    if (typeof window.html2canvas === 'function') return Promise.resolve(window.html2canvas);
    return Promise.reject(new Error('ไม่พบไลบรารี html2canvas'));
  }
  function expandCloneTree(root){
    if (!root) return;
    const selectors = [
      '.table-wrap', '.clean-grid-wrap', '.desktop-table', '.mobile-table',
      '.clean-schedule-content', '.schedule-capture-area', '.schedule-export-clone'
    ];
    root.querySelectorAll(selectors.join(',')).forEach(el => {
      el.style.overflow = 'visible';
      el.style.maxHeight = 'none';
      el.style.maxWidth = 'none';
      el.style.height = 'auto';
      if (el.classList.contains('table-wrap') || el.classList.contains('clean-grid-wrap')) {
        el.style.width = 'max-content';
      }
    });
    root.querySelectorAll('table').forEach(table => {
      table.style.width = 'max-content';
      table.style.maxWidth = 'none';
    });
  }
  function getScheduleExportDataset(){
    const key = activeScheduleMonth();
    const onlyMine = !!state?.scheduleOnlyMine;
    let staffList = scheduleStaffList();
    let assignments = scheduleAssignmentsForMonth(key);
    if (onlyMine) {
      const sid = (typeof currentSid206 === 'function' ? currentSid206() : (typeof currentStaffId === 'function' ? currentStaffId() : state?.user?.staff_id));
      staffList = staffList.filter(s => String(s.id) === String(sid));
      assignments = assignments.filter(a => String(a.staff_id) === String(sid));
    }
    return { key, staffList, assignments };
  }
  function buildMonthlyGridMarkup(){
    const { key, staffList, assignments } = getScheduleExportDataset();
    if (!staffList.length) return `<div class="empty">ไม่มีรายชื่อเจ้าหน้าที่ที่เปิดใช้งาน</div>`;
    const grid = renderGridView(staffList, assignments, key);
    return `
      <div class="schedule-export-clone schedule-export-sheet">
        ${renderExportBrandHeader(key)}
        <div class="schedule-export-grid-only">${grid}</div>
      </div>
    `;
  }
  function buildCaptureNode(){
    const sandbox = document.createElement('div');
    sandbox.setAttribute('data-v292-export-sandbox', 'true');
    sandbox.style.position = 'fixed';
    sandbox.style.left = '-100000px';
    sandbox.style.top = '0';
    sandbox.style.zIndex = '-1';
    sandbox.style.padding = '0';
    sandbox.style.background = '#ffffff';
    sandbox.style.width = 'max-content';
    sandbox.style.maxWidth = 'none';
    sandbox.style.overflow = 'visible';

    const holder = document.createElement('div');
    holder.innerHTML = buildMonthlyGridMarkup().trim();
    const clone = holder.firstElementChild;
    if (!clone) throw new Error('ไม่พบตารางทั้งเดือนที่ต้องการ Export');

    clone.setAttribute('data-v341-export-target', 'true');
    clone.classList.add('v341-export-fixed-grid');
    clone.style.background = '#ffffff';
    clone.style.color = '#1f2937';
    clone.style.width = 'max-content';
    clone.style.maxWidth = 'none';
    clone.style.overflow = 'visible';
    clone.style.padding = '0';
    clone.style.margin = '0';

    expandCloneTree(clone);
    sandbox.appendChild(clone);
    document.body.appendChild(sandbox);
    return { sandbox, target: clone };
  }
  function nextTwoFrames(){
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }
  function expectedDaysInActiveMonth(){
    const [y, m] = String(activeScheduleMonth() || '').split('-').map(Number);
    if (!y || !m) return 31;
    return new Date(y, m, 0).getDate();
  }
  async function settleFullMonthWidth(target){
    try { if (document.fonts?.ready) await document.fonts.ready; } catch (_) {}
    await nextTwoFrames();

    const table = target.querySelector('#scheduleTable') || target.querySelector('table');
    if (!table) throw new Error('ไม่พบตารางเวรสำหรับ Export');
    const headCells = Array.from(table.querySelectorAll('thead tr:first-child > th'));
    const expectedDays = expectedDaysInActiveMonth();
    if (headCells.length < expectedDays + 1) {
      throw new Error(`ตารางเดือนนี้สร้างได้เพียง ${Math.max(0, headCells.length - 1)} วัน จาก ${expectedDays} วัน กรุณารีเฟรชแล้ว Export ใหม่`);
    }

    const dayWidth = 52;
    const firstCell = headCells[0];
    const firstWidth = Math.max(74, Math.ceil(firstCell?.scrollWidth || firstCell?.getBoundingClientRect?.().width || 74));
    const rows = Array.from(table.rows || []);
    rows.forEach(row => {
      Array.from(row.cells || []).forEach((cell, index) => {
        const px = index === 0 ? firstWidth : dayWidth;
        cell.style.setProperty('width', `${px}px`, 'important');
        cell.style.setProperty('min-width', `${px}px`, 'important');
        cell.style.setProperty('max-width', `${px}px`, 'important');
        cell.style.setProperty('box-sizing', 'border-box', 'important');
      });
    });

    const tableWidth = firstWidth + (expectedDays * dayWidth) + 2;
    table.style.setProperty('width', `${tableWidth}px`, 'important');
    table.style.setProperty('min-width', `${tableWidth}px`, 'important');
    table.style.setProperty('max-width', `${tableWidth}px`, 'important');
    table.style.setProperty('table-layout', 'fixed', 'important');

    target.querySelectorAll('.table-wrap,.clean-grid-wrap,.schedule-export-grid-only').forEach(el => {
      el.style.setProperty('width', `${tableWidth}px`, 'important');
      el.style.setProperty('min-width', `${tableWidth}px`, 'important');
      el.style.setProperty('max-width', `${tableWidth}px`, 'important');
      el.style.setProperty('overflow', 'visible', 'important');
    });
    target.style.setProperty('width', `${tableWidth}px`, 'important');
    target.style.setProperty('min-width', `${tableWidth}px`, 'important');
    target.style.setProperty('max-width', `${tableWidth}px`, 'important');
    const brand = target.querySelector('.schedule-brand-header');
    if (brand) {
      brand.style.setProperty('width', `${tableWidth}px`, 'important');
      brand.style.setProperty('box-sizing', 'border-box', 'important');
    }

    await nextTwoFrames();
    return {
      tableWidth,
      captureWidth: Math.max(tableWidth + 4, target.scrollWidth, target.offsetWidth),
      captureHeight: Math.max(target.scrollHeight, target.offsetHeight, 600)
    };
  }
  async function exportTableToImage(){
    let sandbox = null;
    try {
      const html2canvas = await ensureHtml2Canvas();
      const built = buildCaptureNode();
      sandbox = built.sandbox;
      const target = built.target;
      const layout = await settleFullMonthWidth(target);
      const width = Math.ceil(layout.captureWidth);
      const height = Math.ceil(layout.captureHeight);
      const canvas = await html2canvas(target, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
        width,
        height,
        windowWidth: Math.max(width, 1600),
        windowHeight: Math.max(height, 900),
        scrollX: 0,
        scrollY: 0,
        onclone: clonedDoc => {
          try {
            const clonedTarget = clonedDoc.querySelector('[data-v341-export-target="true"]');
            if (!clonedTarget) return;
            clonedTarget.style.setProperty('width', `${layout.tableWidth}px`, 'important');
            clonedTarget.style.setProperty('min-width', `${layout.tableWidth}px`, 'important');
            clonedTarget.style.setProperty('max-width', `${layout.tableWidth}px`, 'important');
            clonedTarget.style.setProperty('overflow', 'visible', 'important');
            clonedTarget.querySelectorAll('.table-wrap,.clean-grid-wrap,.schedule-export-grid-only,table').forEach(el => {
              el.style.setProperty('width', `${layout.tableWidth}px`, 'important');
              el.style.setProperty('min-width', `${layout.tableWidth}px`, 'important');
              el.style.setProperty('max-width', `${layout.tableWidth}px`, 'important');
              el.style.setProperty('overflow', 'visible', 'important');
            });
          } catch (_) {}
        }
      });
      sandbox.remove();
      sandbox = null;
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = fileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast('Export รูปภาพครบทุกวันของเดือนแล้ว');
    } catch (err) {
      console.error(VERSION_V292, err);
      try {
        if (sandbox?.isConnected) sandbox.remove();
        const oldSandbox = document.querySelector('[data-v292-export-sandbox="true"]');
        if (oldSandbox) oldSandbox.remove();
      } catch(_) {}
      toast(err?.message || 'Export รูปภาพไม่สำเร็จ', 'error');
    }
  }
  window.exportTableToImage = exportTableToImage;

  const previousRenderMonthlySchedulePage = window.renderMonthlySchedulePage || (typeof renderMonthlySchedulePage === 'function' ? renderMonthlySchedulePage : null);
  if (previousRenderMonthlySchedulePage) {
    window.renderMonthlySchedulePage = renderMonthlySchedulePage = function renderMonthlySchedulePageV292(){
      try {
        const key = state.monthKey;
        const onlyMine = !!state.scheduleOnlyMine;
        let staffList = scheduleStaffList();
        let assignments = scheduleAssignmentsForMonth(key);
        if (onlyMine) {
          const sid = (typeof currentSid206 === 'function' ? currentSid206() : (typeof currentStaffId === 'function' ? currentStaffId() : state?.user?.staff_id));
          staffList = staffList.filter(s => String(s.id) === String(sid));
          assignments = assignments.filter(a => String(a.staff_id) === String(sid));
          if (!state.schedulePersonFilter || String(state.schedulePersonFilter) !== String(sid)) state.schedulePersonFilter = sid;
        }
        const active = ['day','person','balance','table'].includes(state.scheduleMobileView) ? state.scheduleMobileView : 'day';
        state.scheduleMobileView = active;
        const content = staffList.length
          ? (active === 'day' ? renderCalendarCardView(staffList, assignments, key)
            : active === 'person' ? renderPersonView(staffList, assignments, key)
            : active === 'balance' ? renderBalanceDashboard(staffList, assignments, key)
            : renderGridView(staffList, assignments, key))
          : empty('ไม่มีรายชื่อเจ้าหน้าที่ที่เปิดใช้งาน');
        return `<div class="card schedule-page-card clean-schedule-page v206-schedule-page">
          <div class="toolbar no-print">
            <label>เดือน <input type="month" id="scheduleMonthInput" value="${safeHtml(key)}"></label>
            <button class="${onlyMine ? 'primary-btn' : 'ghost-btn'}" type="button" data-only-my-schedule>${onlyMine ? 'แสดงทุกคน' : 'ดูเฉพาะเวรของฉัน'}</button>
            <button class="ghost-btn" data-export-schedule-excel>Export Excel</button>
            <button class="ghost-btn" data-export-schedule-image>Export เป็นรูปภาพ (Download Image)</button>
          </div>
          <div id="scheduleCaptureArea" class="schedule-capture-area">
            ${renderScheduleTabs(active)}
            ${renderExportBrandHeader(key)}
            <h3 class="print-only">ตารางเวรประจำเดือน ${safeHtml(key)}</h3>
            <div class="clean-schedule-content">${content}</div>
          </div>
          ${onlyMine ? '' : renderDutyTradePanel(assignments)}
        </div>`;
      } catch (err) {
        console.warn(`${VERSION_V292} schedule override fallback`, err);
        return previousRenderMonthlySchedulePage.apply(this, arguments);
      }
    };
  }

  document.addEventListener('click', function(e){
    const btn = e.target?.closest?.('[data-export-schedule-image]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    exportTableToImage();
  }, true);

  // minimal styles for export header area
  try {
    const style = document.createElement('style');
    style.textContent = `
      .schedule-capture-area{display:block;background:#fff;border-radius:18px;}
      .schedule-brand-header{display:flex;align-items:center;gap:14px;margin:8px 0 16px 0;padding:10px 12px;border:1px solid #d7e5f6;border-radius:18px;background:linear-gradient(180deg,#f8fbff 0%,#ffffff 100%);}
      .schedule-brand-logo{flex:0 0 auto;}
      .schedule-brand-logo-circle{width:74px;height:74px;border-radius:999px;background:linear-gradient(135deg,#8fd0ff 0%,#4aa3ff 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;box-shadow:0 8px 18px rgba(74,163,255,.24);border:3px solid #ffffff;}
      .schedule-brand-logo-main{font-size:24px;line-height:1;font-weight:800;letter-spacing:.5px;}
      .schedule-brand-logo-sub{font-size:10px;line-height:1.1;font-weight:700;letter-spacing:1.2px;margin-top:4px;opacity:.96;}
      .schedule-brand-copy{display:flex;flex-direction:column;gap:3px;min-width:0;}
      .schedule-brand-unit{margin:0;font-size:.95rem;font-weight:700;color:#2563eb;letter-spacing:.2px;}
      .schedule-export-title{margin:0;font-size:1.2rem;font-weight:800;color:#16324f;}
      .schedule-export-subtitle{margin:0;color:#5b6b7f;font-size:.98rem;font-weight:600;}
      .schedule-export-sheet,
      .schedule-export-grid-only{display:block;background:#fff;width:max-content;max-width:none;}
      .schedule-export-clone .table-wrap,
      .schedule-export-clone .clean-grid-wrap{overflow:visible !important;max-width:none !important;width:max-content !important;height:auto !important;}
      .schedule-export-clone table{width:max-content !important;max-width:none !important;table-layout:auto !important;}
      .schedule-export-clone .clean-sticky-col{position:static !important;left:auto !important;z-index:auto !important;}
      .schedule-export-clone .clean-staff-cell button{pointer-events:none !important;}
      .v341-export-fixed-grid .clean-schedule-grid th:not(.clean-sticky-col),
      .v341-export-fixed-grid .clean-schedule-grid td{width:52px!important;min-width:52px!important;max-width:52px!important;box-sizing:border-box!important;}
      .v341-export-fixed-grid .clean-schedule-grid .clean-sticky-col{position:static!important;left:auto!important;z-index:auto!important;white-space:nowrap!important;}
      .v341-export-fixed-grid .schedule-brand-header{margin-left:0!important;margin-right:0!important;}
      @media (max-width: 700px){
        .schedule-brand-header{padding:10px;gap:10px;}
        .schedule-brand-logo-circle{width:62px;height:62px;}
        .schedule-brand-logo-main{font-size:20px;}
        .schedule-brand-logo-sub{font-size:9px;}
        .schedule-brand-unit{font-size:.88rem;}
        .schedule-export-title{font-size:1.08rem;}
        .schedule-export-subtitle{font-size:.9rem;}
      }
    `;
    document.head.appendChild(style);
  } catch(_) {}

  console.info(`[${VERSION_V292}] loaded`);
})();

} catch (error) { console.error("[v569] patch-v292-schedule-image-export.js", error); }
;

/* Original source: patch-v293-position-month-admin-clean-full-summary-fix.js */
try {
/* CNMI Staff Planner V293
   Monthly daytime-position Admin cleanup and full-height matrix.
   - Removes the drag-position pool and old explanatory notice.
   - Removes the matrix's internal vertical viewport; the page shows every staff row.
   - Keeps horizontal scrolling for the long month table.
   - Summary classification is corrected in V275/V278/V290 to use the actual date and code.
*/
(function(){
  'use strict';
  const VERSION='V293_POSITION_MONTH_ADMIN_CLEAN_FULL_SUMMARY_FIX';
  if(window.__CNMI_V293_POSITION_MONTH_ADMIN_CLEAN_FULL_SUMMARY_FIX__)return;
  window.__CNMI_V293_POSITION_MONTH_ADMIN_CLEAN_FULL_SUMMARY_FIX__=true;

  let queued=false;
  function S(){try{return state||window.state||null;}catch(_){return window.state||null;}}
  function isAdminSafe(){try{return !!isAdmin();}catch(_){return String(S()?.profile?.role||'').trim().toLowerCase()==='admin';}}
  function isTarget(){return String(S()?.page||'')==='positionMonth'&&isAdminSafe();}
  function apply(){
    if(!isTarget())return;
    const page=document.querySelector('.v275-page');
    const wrap=page?.querySelector('.v275-position-wrap');
    if(!page||!wrap)return;
    page.classList.add('v293-position-month-admin');
    wrap.classList.add('v293-position-month-full');
    page.querySelectorAll('.v275-position-pool').forEach(node=>node.remove());
    page.querySelectorAll('.notice.soft-notice').forEach(node=>{
      if(String(node.textContent||'').includes('ไม่แสดง')&&String(node.textContent||'').includes('ไม่รับเวร'))node.remove();
    });
  }
  function queue(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;apply();});
  }

  const style=document.createElement('style');
  style.id='v293-position-month-admin-style';
  style.textContent=`
    .v293-position-month-admin .v275-position-pool{display:none!important}
    .v293-position-month-admin .v293-position-month-full,
    .v293-position-month-admin .v291-position-month-wrap,
    .v293-position-month-admin .v281-compact-position-wrap,
    body.v277-contained-table-page .v293-position-month-admin .v277-table-scroller.v275-position-wrap{
      height:auto!important;
      min-height:0!important;
      max-height:none!important;
      overflow-x:auto!important;
      overflow-y:visible!important;
      scrollbar-gutter:auto!important;
      overscroll-behavior-x:contain!important;
      overscroll-behavior-y:auto!important;
      touch-action:pan-x pan-y!important;
      will-change:auto!important;
    }
  `;
  document.head.appendChild(style);

  const root=document.getElementById('pageContent')||document.body;
  new MutationObserver(mutations=>{
    if(!isTarget())return;
    const structural=mutations.some(m=>Array.from(m.addedNodes||[]).some(node=>node?.nodeType===1&&(node.matches?.('.v275-page,.v275-position-wrap,.v275-position-pool,.soft-notice')||node.querySelector?.('.v275-position-wrap,.v275-position-pool,.soft-notice'))));
    if(structural)queue();
  }).observe(root,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',()=>setTimeout(apply,40),{once:true});
  setTimeout(apply,0);setTimeout(apply,160);setTimeout(apply,500);

  window.cnmiV293={apply,version:VERSION};
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v293-position-month-admin-clean-full-summary-fix.js", error); }
;

/* Original source: patch-v301-calendar-leave-approval-interaction-fix.js */
try {
/* V301 Calendar + leave-cancellation interaction recovery
   - Opens full Calendar day details reliably on iPhone/iPad/Android and desktop.
   - Restores Admin approve/reject cancellation buttons.
   - Uses window-capture before the older V296 handler, with a pointer fallback
     for installed PWA/mobile browsers that occasionally suppress synthetic click.
   - Keeps the existing Supabase functions and approval workflow unchanged.
*/
(function(){
  'use strict';

  const VERSION = 'V301_CALENDAR_LEAVE_APPROVAL_INTERACTION_FIX';
  const ACTION_SELECTOR = [
    '[data-day-detail]',
    '[data-approve-cancel-leave]',
    '[data-reject-cancel-leave]'
  ].join(',');

  let lastActionKey = '';
  let lastActionAt = 0;
  const pointerStarts = new Map();

  function esc(value){
    try {
      if (typeof window.escapeHtml === 'function') return window.escapeHtml(value == null ? '' : String(value));
      if (typeof escapeHtml === 'function') return escapeHtml(value == null ? '' : String(value));
    } catch (_) {}
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[ch]));
  }

  function closestAction(target){
    if (!target) return null;
    if (target.nodeType === 3) target = target.parentElement;
    try { return target.closest?.(ACTION_SELECTOR) || null; }
    catch (_) { return null; }
  }

  function stopEvent(event){
    try { event.preventDefault(); } catch (_) {}
    try { event.stopPropagation(); } catch (_) {}
    try { event.stopImmediatePropagation?.(); } catch (_) {}
  }

  function toast(message, tone='error'){
    try {
      const fn = window.showToast || (typeof showToast === 'function' ? showToast : null);
      if (typeof fn === 'function') return fn(message, { tone });
    } catch (_) {}
    console[tone === 'error' ? 'error' : 'log'](`[${VERSION}] ${message}`);
  }

  function forceShowModal(html, opts={}){
    try {
      const fn = window.showModal || (typeof showModal === 'function' ? showModal : null);
      if (typeof fn === 'function') {
        fn(html, opts);
        const modal = document.getElementById('modal');
        if (modal && !modal.classList.contains('hidden')) return true;
      }
    } catch (error) {
      console.warn(`[${VERSION}] normal showModal failed; using DOM fallback`, error);
    }

    try {
      const modal = document.getElementById('modal');
      const body = document.getElementById('modalBody');
      if (!modal || !body) throw new Error('modal container not found');
      body.innerHTML = html;
      modal.classList.remove('hidden', 'modal-closing');
      modal.classList.toggle('modal-sm', !!opts.small);
      modal.classList.toggle('modal-lg', !!opts.large);
      modal.classList.add('modal-ready');
      document.body.classList.add('modal-open');
      const card = modal.querySelector('.modal-card');
      if (card) card.scrollTop = 0;
      return true;
    } catch (error) {
      console.error(`[${VERSION}] modal fallback failed`, error);
      return false;
    }
  }

  function calendarEventsFor(date){
    try {
      const fn = window.collectCalendarEvents || (typeof collectCalendarEvents === 'function' ? collectCalendarEvents : null);
      const rows = typeof fn === 'function' ? fn() : [];
      return (Array.isArray(rows) ? rows : []).filter(row => String(row?.date || '').slice(0,10) === date);
    } catch (error) {
      console.warn(`[${VERSION}] collectCalendarEvents failed`, error);
      return [];
    }
  }

  function renderCalendarRow(row){
    try {
      const fn = window.renderCalendarModalRow || (typeof renderCalendarModalRow === 'function' ? renderCalendarModalRow : null);
      if (typeof fn === 'function') return fn(row);
    } catch (_) {}
    const title = row?.title || row?.name || row?.type || '-';
    return `<div class="calendar-modal-row"><div class="event-title"><b>${esc(title)}</b></div></div>`;
  }

  function thaiDate(date){
    try {
      const fn = window.formatThaiDate || (typeof formatThaiDate === 'function' ? formatThaiDate : null);
      if (typeof fn === 'function') return fn(date);
    } catch (_) {}
    return date;
  }

  function openCalendarDayV301(rawDate){
    const date = String(rawDate || '').slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast('ไม่พบวันที่ที่ต้องการเปิด กรุณารีเฟรชหน้าแล้วลองใหม่');
      return;
    }

    try {
      const events = calendarEventsFor(date);
      const body = events.length
        ? events.map(renderCalendarRow).join('')
        : '<div class="empty-state">ไม่มีรายการในวันนี้</div>';
      const ok = forceShowModal(
        `<h2>${esc(thaiDate(date))}</h2><div class="calendar-modal-list">${body}</div>`,
        { large:false }
      );
      if (!ok) throw new Error('cannot display calendar modal');
    } catch (error) {
      console.error(`[${VERSION}] calendar details failed`, error);
      toast('เปิดรายละเอียด Calendar ไม่สำเร็จ กรุณารีเฟรชหน้าแล้วลองอีกครั้ง');
    }
  }

  async function runLeaveCancellationAction(button, action){
    const attr = action === 'approve' ? 'data-approve-cancel-leave' : 'data-reject-cancel-leave';
    const id = String(button.getAttribute(attr) || '').trim();
    if (!id) return toast('ไม่พบรหัสรายการ กรุณารีเฟรชหน้าแล้วลองใหม่');

    const fnName = action === 'approve' ? 'approveCancelLeave' : 'rejectCancelLeave';
    let fn = null;
    try {
      fn = window[fnName] || (fnName === 'approveCancelLeave'
        ? (typeof approveCancelLeave === 'function' ? approveCancelLeave : null)
        : (typeof rejectCancelLeave === 'function' ? rejectCancelLeave : null));
    } catch (_) {}

    if (typeof fn !== 'function') {
      toast('ระบบอนุมัติยังโหลดไม่สมบูรณ์ กรุณารีเฟรชหน้าแล้วลองใหม่');
      return;
    }

    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      await fn(id);
    } catch (error) {
      console.error(`[${VERSION}] ${fnName} failed`, error);
      toast(error?.message || 'ดำเนินการอนุมัติไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    }
  }

  function actionKey(target){
    if (target.hasAttribute('data-day-detail')) return `calendar:${target.getAttribute('data-day-detail') || ''}`;
    if (target.hasAttribute('data-approve-cancel-leave')) return `approve:${target.getAttribute('data-approve-cancel-leave') || ''}`;
    if (target.hasAttribute('data-reject-cancel-leave')) return `reject:${target.getAttribute('data-reject-cancel-leave') || ''}`;
    return '';
  }

  function handleAction(event, target){
    const key = actionKey(target);
    if (!key) return false;

    const now = Date.now();
    if (key === lastActionKey && now - lastActionAt < 900) {
      stopEvent(event);
      return true;
    }
    lastActionKey = key;
    lastActionAt = now;
    stopEvent(event);

    if (target.hasAttribute('data-day-detail')) {
      openCalendarDayV301(target.getAttribute('data-day-detail'));
      return true;
    }
    if (target.hasAttribute('data-approve-cancel-leave')) {
      void runLeaveCancellationAction(target, 'approve');
      return true;
    }
    if (target.hasAttribute('data-reject-cancel-leave')) {
      void runLeaveCancellationAction(target, 'reject');
      return true;
    }
    return false;
  }

  /* Load this patch immediately before V296. Therefore this window-capture
     handler runs first and avoids the old handler swallowing Calendar taps. */
  window.addEventListener('click', function(event){
    const target = closestAction(event.target);
    if (target) handleAction(event, target);
  }, true);

  /* Mobile/PWA fallback: some iOS WebKit sessions lose the synthetic click
     after a long scroll. A short, non-drag pointer tap still performs the action. */
  window.addEventListener('pointerdown', function(event){
    const target = closestAction(event.target);
    if (!target || event.pointerType === 'mouse') return;
    pointerStarts.set(event.pointerId, {
      x: Number(event.clientX || 0),
      y: Number(event.clientY || 0),
      target
    });
  }, true);

  window.addEventListener('pointerup', function(event){
    if (event.pointerType === 'mouse') return;
    const start = pointerStarts.get(event.pointerId);
    pointerStarts.delete(event.pointerId);
    if (!start) return;
    const dx = Number(event.clientX || 0) - start.x;
    const dy = Number(event.clientY || 0) - start.y;
    if (Math.hypot(dx, dy) > 14) return;
    const target = closestAction(event.target) || start.target;
    if (target) handleAction(event, target);
  }, true);

  window.addEventListener('pointercancel', function(event){
    pointerStarts.delete(event.pointerId);
  }, true);

  console.info(`[${VERSION}] loaded`);
})();

} catch (error) { console.error("[v569] patch-v301-calendar-leave-approval-interaction-fix.js", error); }
;

/* Original source: patch-v296-popup-and-position-details.js */
try {
/* V296 Popup interaction recovery + daily position duty details
   1) Restores Calendar day-detail popup on mobile/desktop.
   2) Restores duty sell-request popup from the monthly roster.
   3) Shows what each daily position is responsible for, with a full-detail popup.
*/
(function(){
  'use strict';

  const VERSION = 'V296_POPUP_AND_POSITION_DETAILS';

  function esc(value){
    try { return escapeHtml(value == null ? '' : String(value)); }
    catch (_) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
      }[ch]));
    }
  }

  function toast(message, tone){
    try { showToast(message, tone ? { tone } : undefined); }
    catch (_) { console[tone === 'error' ? 'error' : 'log'](message); }
  }

  function currentId(){
    try { return String(currentStaffId() || ''); }
    catch (_) { return String(state?.user?.staff_id || state?.profile?.staff_id || ''); }
  }

  function admin(){
    try { return !!isAdmin(); }
    catch (_) { return String(state?.role || state?.currentRole || '').toLowerCase() === 'admin'; }
  }

  /* The old function used strict equality. Supabase IDs can arrive as either
     strings or typed values, so use normalized string comparison. */
  const previousCanRequestTrade = window.canRequestTrade || (typeof canRequestTrade === 'function' ? canRequestTrade : null);
  const canRequestTradeV296 = function(slot){
    if (!slot?.id || !slot?.staff_id) return false;
    if (admin()) return true;
    return String(slot.staff_id) === currentId();
  };
  window.canRequestTrade = canRequestTradeV296;
  try { canRequestTrade = canRequestTradeV296; } catch (_) {}

  function openCalendarDay(date){
    const key = String(date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
    try {
      if (typeof showDayDetail === 'function') {
        showDayDetail(key);
        return;
      }
    } catch (error) {
      console.warn(`${VERSION}: showDayDetail fallback`, error);
    }

    try {
      const events = (typeof collectCalendarEvents === 'function' ? collectCalendarEvents() : [])
        .filter(item => String(item?.date || '').slice(0,10) === key);
      const title = typeof formatThaiDate === 'function' ? formatThaiDate(key) : key;
      const body = events.length
        ? events.map(item => typeof renderCalendarModalRow === 'function'
          ? renderCalendarModalRow(item)
          : `<div class="calendar-modal-row"><b>${esc(item?.title || '-')}</b></div>`).join('')
        : '<div class="empty-state">ไม่มีรายการในวันนี้</div>';
      showModal(`<h2>${esc(title)}</h2><div class="calendar-modal-list">${body}</div>`);
    } catch (error) {
      console.error(`${VERSION}: calendar popup failed`, error);
      toast('เปิดรายละเอียด Calendar ไม่สำเร็จ กรุณากดรีเฟรชแล้วลองอีกครั้ง', 'error');
    }
  }

  function openTrade(assignmentId){
    const id = String(assignmentId || '').trim();
    if (!id) return;
    try {
      const fn = window.showTradeModal || (typeof showTradeModal === 'function' ? showTradeModal : null);
      if (typeof fn !== 'function') throw new Error('ไม่พบฟังก์ชันขายเวร');
      fn(id);
    } catch (error) {
      console.error(`${VERSION}: trade popup failed`, error);
      toast('เปิดหน้าขายเวรไม่สำเร็จ กรุณารีเฟรชข้อมูลแล้วลองอีกครั้ง', 'error');
    }
  }

  function dailyRows(){
    return Array.isArray(window.__CNMI_V226_DAILY_POSITION_ROWS__)
      ? window.__CNMI_V226_DAILY_POSITION_ROWS__
      : Array.isArray(window.__CNMI_V225_DAILY_POSITION_ROWS__)
        ? window.__CNMI_V225_DAILY_POSITION_ROWS__
        : [];
  }

  function positionLabel(row){
    const code = row?.position_code || row?.code || 'ตำแหน่ง';
    try { return labelCode(code); }
    catch (_) { return String(code); }
  }

  function positionZone(row){
    try { return zoneOf(row) || row?.zone || '-'; }
    catch (_) { return row?.zone || '-'; }
  }

  function openPositionDetail(index){
    const row = dailyRows()[Number(index)];
    if (!row) {
      toast('ไม่พบรายละเอียดตำแหน่งนี้ กรุณารีเฟรชหน้า', 'error');
      return;
    }
    const job = String(row.job_desc || row.description || '').trim() || 'ยังไม่ได้ระบุรายละเอียดหน้าที่';
    const rule = String(row.main_rule || '-');
    const breakTime = String(row.break_time || '-');
    showModal(`
      <div class="v296-position-modal">
        <h2>${esc(positionLabel(row))}</h2>
        <div class="v296-position-meta">
          <span class="badge blue">${esc(positionZone(row))}</span>
          <span>พัก ${esc(breakTime)}</span>
        </div>
        <div class="v296-position-section">
          <h3>ผู้ปฏิบัติหลัก / เงื่อนไข</h3>
          <p>${esc(rule)}</p>
        </div>
        <div class="v296-position-section v296-position-job-full">
          <h3>รายละเอียดหน้าที่ที่ต้องทำ</h3>
          <p>${esc(job)}</p>
        </div>
      </div>
    `, { large:false });
  }

  function enhanceDailyPositionDetails(root=document){
    const page = root.querySelector?.('.v225-positions-page, .v226-positions-page');
    if (!page) return;
    const rows = dailyRows();

    page.querySelectorAll('[data-v226-position-detail], [data-v225-position-detail], [data-position-detail-v219]').forEach(button => {
      const rawIndex = button.getAttribute('data-v226-position-detail')
        ?? button.getAttribute('data-v225-position-detail')
        ?? button.getAttribute('data-position-detail-v219');
      const index = Number(rawIndex);
      const row = rows[index];

      button.classList.remove('v265-description-hidden');
      button.style.removeProperty('display');
      if (button.textContent.trim() !== 'ดูรายละเอียดทั้งหมด') button.textContent = 'ดูรายละเอียดทั้งหมด';
      button.setAttribute('data-v296-position-detail', String(index));

      const card = button.closest('.v225-position-card, .v219-position-card, .position-mobile-card');
      if (card && row && !card.querySelector('.v296-position-duty-preview')) {
        const job = String(row.job_desc || row.description || '').trim() || 'ยังไม่ได้ระบุรายละเอียดหน้าที่';
        const preview = document.createElement('div');
        preview.className = 'v296-position-duty-preview';
        preview.innerHTML = `<b>หน้าที่:</b><span>${esc(job)}</span>`;
        const actions = button.closest('.actions');
        if (actions) actions.insertAdjacentElement('beforebegin', preview);
        else card.appendChild(preview);
      }
    });

    page.querySelectorAll('.v225-job-short, .v219-job-short').forEach(node => {
      node.classList.remove('v265-description-hidden');
      node.style.removeProperty('display');
    });
    page.querySelectorAll('.daily-position-table th:last-child, .daily-position-table td:last-child').forEach(node => {
      node.classList.remove('v265-description-hidden');
      node.style.removeProperty('display');
    });
  }

  function resolveTradeTargetFromTable(button){
    if (!button || button.dataset.tradeDuty) return button?.dataset?.tradeDuty || '';
    if (!button.classList.contains('clean-shift-pill')) return '';

    try {
      const row = button.closest('tr');
      const cell = button.closest('td');
      const table = button.closest('table');
      if (!row || !cell || !table) return '';
      const ownerButton = row.querySelector('th [data-staff-stat], th[data-staff-stat]');
      const staffId = ownerButton?.dataset?.staffStat || '';
      const cellIndex = Array.from(row.children).indexOf(cell);
      const key = String(state?.monthKey || '').slice(0,7);
      const dates = typeof scheduleMonthDates === 'function' ? scheduleMonthDates(key) : [];
      const date = dates[cellIndex - 1];
      if (!staffId || !date) return '';

      const assignments = typeof scheduleAssignmentsForMonth === 'function'
        ? scheduleAssignmentsForMonth(key)
        : (state?.rosterAssignments || []).filter(item => String(item?.duty_date || '').startsWith(key));
      const sameCell = assignments.filter(item =>
        String(item?.staff_id || '') === String(staffId) &&
        String(item?.duty_date || '').slice(0,10) === date
      ).sort((a,b) => {
        try { return dutySortIndex(a?.duty_code) - dutySortIndex(b?.duty_code); }
        catch (_) { return String(a?.duty_code || '').localeCompare(String(b?.duty_code || '')); }
      });
      const pillIndex = Array.from(cell.querySelectorAll('.clean-shift-pill')).indexOf(button);
      const assignment = sameCell[pillIndex] || sameCell[0];
      if (!assignment || !canRequestTradeV296(assignment)) return '';
      button.dataset.tradeDuty = String(assignment.id);
      return String(assignment.id);
    } catch (_) {
      return '';
    }
  }

  function enhanceScheduleTargets(root=document){
    const page = root.querySelector?.('.clean-schedule-page');
    if (!page) return;
    page.querySelectorAll('.clean-shift-pill').forEach(button => {
      const id = resolveTradeTargetFromTable(button);
      if (id) {
        button.classList.add('v296-trade-ready');
        button.setAttribute('title', 'แตะเพื่อเปิดขายเวร / เบิก OT ผ่าน HR');
      }
    });
  }

  let queued = false;
  function queueEnhance(){
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      enhanceDailyPositionDetails(document);
      enhanceScheduleTargets(document);
    });
  }

  /* Window capture fires before the older document/body handlers that were
     swallowing these taps on iOS Safari. */
  window.addEventListener('click', function(event){
    const calendarTarget = event.target?.closest?.('[data-day-detail]');
    if (calendarTarget) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      openCalendarDay(calendarTarget.getAttribute('data-day-detail'));
      return;
    }

    const detailTarget = event.target?.closest?.('[data-v296-position-detail], [data-v226-position-detail], [data-v225-position-detail], [data-position-detail-v219]');
    if (detailTarget) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const index = detailTarget.getAttribute('data-v296-position-detail')
        ?? detailTarget.getAttribute('data-v226-position-detail')
        ?? detailTarget.getAttribute('data-v225-position-detail')
        ?? detailTarget.getAttribute('data-position-detail-v219');
      openPositionDetail(index);
      return;
    }

    const directTrade = event.target?.closest?.('[data-trade-duty]');
    if (directTrade) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      openTrade(directTrade.getAttribute('data-trade-duty'));
      return;
    }

    const shiftPill = event.target?.closest?.('.clean-schedule-page .clean-shift-pill');
    if (shiftPill) {
      const assignmentId = resolveTradeTargetFromTable(shiftPill);
      if (assignmentId) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        openTrade(assignmentId);
      }
    }
  }, true);

  const observer = new MutationObserver(queueEnhance);
  observer.observe(document.documentElement, { childList:true, subtree:true });
  document.addEventListener('DOMContentLoaded', queueEnhance, { once:true });
  queueEnhance();

  try {
    const style = document.createElement('style');
    style.id = 'v296-popup-position-detail-style';
    style.textContent = `
      .v226-positions-page .daily-position-table th:last-child,
      .v226-positions-page .daily-position-table td:last-child,
      .v225-positions-page .daily-position-table th:last-child,
      .v225-positions-page .daily-position-table td:last-child{display:table-cell!important;min-width:220px}
      .v226-positions-page [data-v226-position-detail],
      .v225-positions-page [data-v225-position-detail],
      .v219-positions-page [data-position-detail-v219],
      .v225-position-card [data-v226-position-detail],
      .v225-position-card [data-v225-position-detail]{display:inline-flex!important;align-items:center;justify-content:center}
      .v226-positions-page .v225-job-short.v265-description-hidden,
      .v225-positions-page .v225-job-short.v265-description-hidden,
      .v219-job-short.v265-description-hidden{display:inline!important}
      .v296-position-duty-preview{margin-top:12px;padding:11px 12px;border:1px solid #d8e7f7;border-radius:14px;background:#f7fbff;color:#334155;line-height:1.55}
      .v296-position-duty-preview b{display:block;color:#16324f;margin-bottom:3px}
      .v296-position-duty-preview span{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;white-space:pre-line}
      .v296-position-modal h2{margin-bottom:8px}
      .v296-position-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;color:#64748b;margin-bottom:14px}
      .v296-position-section{padding:14px;border:1px solid #dbe7f3;border-radius:16px;background:#f8fbff;margin-top:12px}
      .v296-position-section h3{margin:0 0 7px;color:#16324f}
      .v296-position-section p{margin:0;white-space:pre-wrap;line-height:1.65;color:#334155}
      .v296-position-job-full{background:#ffffff}
      .clean-shift-pill.v296-trade-ready{cursor:pointer;box-shadow:0 0 0 1px rgba(37,99,235,.16)}
      @media (max-width:820px){
        .v226-positions-page .daily-position-table th:last-child,
        .v226-positions-page .daily-position-table td:last-child,
        .v225-positions-page .daily-position-table th:last-child,
        .v225-positions-page .daily-position-table td:last-child{min-width:190px}
        .v296-position-duty-preview span{-webkit-line-clamp:4}
      }
    `;
    document.head.appendChild(style);
  } catch (_) {}

  window.cnmiV296 = {
    openCalendarDay,
    openTrade,
    openPositionDetail,
    enhanceDailyPositionDetails,
    enhanceScheduleTargets
  };
  console.info(`[${VERSION}] loaded`);
})();

} catch (error) { console.error("[v569] patch-v296-popup-and-position-details.js", error); }
;

/* Original source: patch-v297-position-month-image-export-slot-details.js */
try {
/* CNMI Staff Planner V386
   Monthly position export day-count hotfix (no summary col + clone live description)
   - keeps the staff name as the first column of the SAME table
   - preserves each staff member's color bar
   - forces date columns into chronological order (1 -> last day)
   - removes sticky/scroll UI only inside the hidden export layout
   - exports the full month and the position-description table
*/
(function(){
  'use strict';
  const VERSION='V386_POSITION_MONTH_EXPORT_DAY_COUNT_FIX';
  if(window.__CNMI_V297_POSITION_MONTH_IMAGE_EXPORT_SLOT_DETAILS__)return;
  window.__CNMI_V297_POSITION_MONTH_IMAGE_EXPORT_SLOT_DETAILS__=true;

  function S(){try{return state||window.state||null;}catch(_){return window.state||null;}}
  function esc(v){try{return escapeHtml(v==null?'':String(v));}catch(_){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}}
  function normDate(v){try{return normalizeDateKey(v);}catch(_){return String(v||'').slice(0,10);}}
  function toast(msg,tone){try{showToast(msg,tone?{tone}:undefined);}catch(_){console[tone==='error'?'error':'log'](msg);}}
  function activeKey(){const st=S();return st?.page==='positionMonthView'?(st.positionMonthViewKey||st.monthKey):(st?.positionMonthKey||st?.monthKey)||new Date().toISOString().slice(0,7);}
  function thaiMonth(key){try{const [y,m]=String(key).split('-').map(Number);return new Date(y,m-1,1).toLocaleDateString('th-TH',{month:'long',year:'numeric'});}catch(_){return key;}}
  function safeFileName(key){return `position_month_${key}_ตารางตำแหน่งกลางวัน.png`.replace(/[\/:*?"<>|]+/g,'-');}
  function daysInMonth(key){try{const [y,m]=String(key||'').split('-').map(Number);return y&&m?new Date(y,m,0).getDate():31;}catch(_){return 31;}}
  function nextFrames(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}

  function positionMasters(){
    const st=S();
    const rows=[];
    (st?.positionMasters||[]).forEach(r=>rows.push(r));
    try{(window.cnmiV224?.currentMasters?.()||[]).forEach(r=>rows.push(r));}catch(_){/* noop */}
    return rows;
  }
  function positionCode(row){return String(row?.code||row?.position_code||'').trim();}
  function positionDetail(code,key){
    const st=S();
    const master=positionMasters().find(r=>positionCode(r)===code);
    const saved=(st?.positions||[]).find(r=>String(r?.position_code||'').trim()===code&&normDate(r?.work_date).startsWith(key));
    let fallback={};
    try{fallback=(typeof positionByCode==='function'?positionByCode(code):null)||{};}catch(_){/* noop */}
    const src={...fallback,...saved,...master};
    return {
      code,
      zone:src.zone||'-',
      break_time:src.break_time||'-',
      main_rule:src.main_rule||src.required_role||'-',
      job_desc:src.job_desc||src.description||'ยังไม่ได้ระบุรายละเอียดหน้าที่'
    };
  }
  function compactDays(values){
    const nums=[...new Set((values||[]).map(v=>Number(String(v).slice(-2))).filter(Number.isFinite))].sort((a,b)=>a-b);
    if(!nums.length)return '-';
    const out=[];let start=nums[0],prev=nums[0];
    for(let i=1;i<=nums.length;i++){
      const n=nums[i];
      if(n===prev+1){prev=n;continue;}
      out.push(start===prev?String(start):`${start}-${prev}`);
      start=n;prev=n;
    }
    return out.join(', ');
  }
  function usedPositionMap(key){
    const map=new Map();
    const add=(code,date)=>{
      code=String(code||'').trim();date=normDate(date);
      if(!code||!date.startsWith(key))return;
      if(!map.has(code))map.set(code,new Set());
      map.get(code).add(date);
    };
    (S()?.positions||[]).forEach(r=>add(r?.position_code,r?.work_date));
    document.querySelectorAll('.v275-position-wrap [data-v275-position-cell]').forEach(cell=>add(cell.querySelector('[data-v275-position-select]')?.value,cell.dataset.date));
    return map;
  }
  function descriptionMarkup(key){
    const used=usedPositionMap(key);
    const rows=[...used.entries()]
      .map(([code,dates])=>({...positionDetail(code,key),dates:[...dates]}))
      .sort((a,b)=>a.code.localeCompare(b.code,'th'));
    return `<section class="v297-position-description-card" data-v297-position-descriptions>
      <div class="section-title"><div><h3>คำอธิบายตำแหน่งที่ใช้ในตาราง</h3><p class="hint">แสดงรายละเอียดตำแหน่งที่มีการใช้งานในเดือนนี้</p></div></div>
      ${rows.length?`<div class="table-wrap v297-position-description-wrap"><table class="v297-position-description-table"><thead><tr><th>ตำแหน่ง</th><th>วันที่ใช้</th><th>โซน</th><th>เวลาพัก</th><th>ผู้ปฏิบัติหลัก / เงื่อนไข</th><th>รายละเอียดหน้าที่</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${esc(r.code)}</b></td><td>${esc(compactDays(r.dates))}</td><td>${esc(r.zone)}</td><td>${esc(r.break_time)}</td><td>${esc(r.main_rule)}</td><td class="v297-job-cell">${esc(r.job_desc)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state">เดือนนี้ยังไม่มีตำแหน่งในตาราง</div>'}
    </section>`;
  }
  function liveDescriptionSection(){
    const live=document.querySelector('[data-v297-position-descriptions]');
    if(!live)return null;
    const clone=live.cloneNode(true);
    clone.querySelectorAll('button,[role="button"],select,input,textarea').forEach(node=>node.remove());
    clone.querySelectorAll('[style]').forEach(node=>{
      node.style.setProperty('position','static','important');
      node.style.setProperty('left','auto','important');
      node.style.setProperty('right','auto','important');
      node.style.setProperty('top','auto','important');
      node.style.setProperty('bottom','auto','important');
      node.style.setProperty('transform','none','important');
      node.style.setProperty('overflow','visible','important');
      node.style.setProperty('max-height','none','important');
    });
    clone.querySelectorAll('.table-wrap,.v297-position-description-wrap').forEach(node=>{
      node.style.setProperty('overflow','visible','important');
      node.style.setProperty('max-height','none','important');
    });
    return clone;
  }
  function brandHeader(key){
    return `<div class="v297-export-brand-header">
      <div class="v297-export-logo" aria-hidden="true"><b>BB</b><small>CNMI</small></div>
      <div class="v297-export-brand-copy">
        <p>เวชศาสตร์บริการโลหิต</p>
        <h2>ตารางตำแหน่งกลางวัน รายเดือน</h2>
        <span>เดือน ${esc(thaiMonth(key))}</span>
      </div>
    </div>`;
  }

  function parseDayNumber(cell){
    const text=String(cell?.innerText||cell?.textContent||'').trim();
    const match=text.match(/^(\d{1,2})/);
    const day=match?Number(match[1]):NaN;
    return Number.isInteger(day)&&day>=1&&day<=31?day:null;
  }
  function reorderDateColumns(table,key){
    const expected=daysInMonth(key);
    const rows=Array.from(table.rows||[]);
    if(!rows.length)return false;
    const header=rows.reduce((best,row)=>row.cells.length>best.cells.length?row:best,rows[0]);
    const headerCells=Array.from(header.cells||[]);
    if(headerCells.length<expected+2)return false;

    const dayIndex=new Map();
    headerCells.forEach((cell,index)=>{
      if(index<2)return;
      const day=parseDayNumber(cell);
      if(day&&!dayIndex.has(day))dayIndex.set(day,index);
    });
    if(dayIndex.size<expected)return false;

    rows.forEach(row=>{
      const cells=Array.from(row.cells||[]);
      if(cells.length<expected+2)return;
      const ordered=[cells[0],cells[1]];
      for(let day=1;day<=expected;day++)ordered.push(cells[dayIndex.get(day)]);
      ordered.filter(Boolean).forEach(cell=>row.appendChild(cell));
    });
    return true;
  }
  function replaceControls(table){
    table.querySelectorAll('select').forEach(select=>{
      const span=document.createElement('span');
      span.className='v297-export-position-text';
      span.textContent=select.value||'';
      select.replaceWith(span);
    });
    table.querySelectorAll('input').forEach(input=>{
      const span=document.createElement('span');
      span.className='v297-export-input-text';
      span.textContent=input.value||'-';
      input.replaceWith(span);
    });
    table.querySelectorAll('button.v275-info,[data-v275-status]').forEach(node=>node.remove());
    table.querySelectorAll('button').forEach(button=>{
      const span=document.createElement('span');
      span.className=button.className;
      span.textContent=button.textContent;
      button.replaceWith(span);
    });
  }
  function stripSummaryColumn(table){
    Array.from(table.rows||[]).forEach(row=>{
      if((row.cells||[]).length>1)row.deleteCell(1);
    });
  }
  function normalizeLeaveLabelForExport(value){
    const text=String(value||'').trim();
    return text==='ลาพักร้อน'?'ลาพักผ่อน':text;
  }
  function emphasizeLeaveCellsForExport(table){
    table.querySelectorAll('.v275-position-day.leave,.matrix-cell.leave-cell,[data-v291-leave-label]').forEach(cell=>{
      cell.classList.add('v392-export-leave-cell');
      let badge=cell.querySelector('.mini-status');
      if(!badge){
        const label=normalizeLeaveLabelForExport(cell.getAttribute('data-v291-leave-label'));
        if(label){
          badge=document.createElement('span');
          badge.className='mini-status leave-other';
          badge.textContent=label;
          cell.insertBefore(badge,cell.firstChild);
        }
      }
      if(badge){
        badge.textContent=normalizeLeaveLabelForExport(badge.textContent);
        badge.classList.add('v392-export-leave-badge');
      }
      cell.querySelectorAll('.v297-export-position-text,.v275-position-pill').forEach(node=>{
        node.classList.add('v392-export-position-under-leave');
      });
    });
  }
  function exactOutingDaysFromLiveTable(table){
    const days=new Set();
    const head=table?.tHead?.rows?.[0];
    if(!head)return days;
    Array.from(head.cells||[]).forEach(cell=>{
      const day=parseDayNumber(cell);
      if(!day)return;
      const marked=cell.classList.contains('outing-head')||
        cell.classList.contains('v388-outing-color-only')||
        !!cell.querySelector('.v374-outing-label,.v388-outing-label-only')||
        /ออกหน่วย/.test(String(cell.textContent||''));
      if(marked)days.add(day);
    });
    return days;
  }
  function applyExactOutingDaysToExport(table,days){
    table.querySelectorAll('.v388-outing-label-only,.v374-outing-label,.v390-export-outing-label').forEach(node=>node.remove());
    table.querySelectorAll('.v388-outing-color-only,.outing-head,.outing-cell,.v390-export-outing-day').forEach(node=>{
      node.classList.remove('v388-outing-color-only','outing-head','outing-cell','v390-export-outing-day');
    });
    const head=table?.tHead?.rows?.[0];
    if(!head)return;
    Array.from(head.cells||[]).forEach((headCell,columnIndex)=>{
      const day=parseDayNumber(headCell);
      if(!day||!days.has(day))return;
      Array.from(table.rows||[]).forEach(row=>row.cells?.[columnIndex]?.classList.add('v390-export-outing-day'));
      const label=document.createElement('span');
      label.className='v390-export-outing-label';
      label.textContent='ออกหน่วย';
      headCell.appendChild(label);
    });
  }

  function normalizeExportTable(table,key){
    reorderDateColumns(table,key);
    stripSummaryColumn(table);
    replaceControls(table);
    emphasizeLeaveCellsForExport(table);

    table.setAttribute('dir','ltr');
    table.style.setProperty('direction','ltr','important');
    table.querySelectorAll('thead,tbody,tr,th,td').forEach(node=>node.style.setProperty('direction','ltr','important'));

    table.querySelectorAll('.v275-sticky-name').forEach(cell=>{
      cell.classList.remove('v275-sticky-name');
      cell.classList.add('v384-export-name-cell');
    });
    table.querySelectorAll('.v275-sticky-summary').forEach(cell=>{
      cell.classList.remove('v275-sticky-summary');
      cell.classList.add('v384-export-summary-cell');
    });

    table.querySelectorAll('[style]').forEach(node=>{
      node.style.setProperty('position','static','important');
      node.style.setProperty('left','auto','important');
      node.style.setProperty('right','auto','important');
      node.style.setProperty('top','auto','important');
      node.style.setProperty('bottom','auto','important');
      node.style.setProperty('z-index','auto','important');
      node.style.setProperty('transform','none','important');
    });
    table.querySelectorAll('th,td').forEach(cell=>{
      cell.style.setProperty('position','static','important');
      cell.style.setProperty('left','auto','important');
      cell.style.setProperty('right','auto','important');
      cell.style.setProperty('z-index','auto','important');
      cell.style.setProperty('transform','none','important');
    });
  }
  function buildExportNode(){
    const key=activeKey();
    const live=document.querySelector('.v275-position-wrap .v275-position-table');
    if(!live)throw new Error('ไม่พบตารางตำแหน่งกลางวันรายเดือน');

    const sandbox=document.createElement('div');
    sandbox.dataset.v297ExportSandbox='1';
    sandbox.style.cssText='position:fixed;left:-100000px;top:0;z-index:-1;background:#f6f9fc;padding:24px;width:max-content;max-width:none;overflow:visible;';

    const sheet=document.createElement('div');
    sheet.className='v297-export-sheet';
    sheet.innerHTML=brandHeader(key);

    const tableWrap=document.createElement('div');
    tableWrap.className='v297-export-table-wrap';
    const exactOutingDays=exactOutingDaysFromLiveTable(live);
    const table=live.cloneNode(true);
    // The hidden export clone must not look like a live V275 table. Otherwise
    // display-only patches can observe it and recolor adjacent columns again.
    table.classList.remove('v275-position-table');
    table.classList.add('v390-export-position-table');
    normalizeExportTable(table,key);
    applyExactOutingDaysToExport(table,exactOutingDays);
    tableWrap.appendChild(table);
    sheet.appendChild(tableWrap);

    const liveDescriptions=liveDescriptionSection();
    if(liveDescriptions){
      sheet.appendChild(liveDescriptions);
    }else{
      const descriptions=document.createElement('div');
      descriptions.innerHTML=descriptionMarkup(key);
      sheet.appendChild(descriptions.firstElementChild);
    }

    sandbox.appendChild(sheet);
    document.body.appendChild(sandbox);
    return {key,sandbox,target:sheet};
  }
  function maxCellCount(table){return Math.max(0,...Array.from(table.rows||[]).map(row=>Array.from(row.cells||[]).length));}
  async function settleExportLayout(target,key){
    try{if(document.fonts?.ready)await document.fonts.ready;}catch(_){/* noop */}
    await nextFrames();

    const table=target.querySelector('.v297-export-table-wrap table');
    if(!table)throw new Error('ไม่พบตารางสำหรับ Export');
    const expected=daysInMonth(key);
    const colCount=maxCellCount(table);
    // V385 removes the summary column before measuring the export table.
    // The completed table therefore contains 1 staff-name column + every day of the month.
    const actualDays=Math.max(0,colCount-1);
    if(actualDays<expected){
      throw new Error(`ตารางเดือนนี้สร้างได้เพียง ${actualDays} วัน จาก ${expected} วัน กรุณารีเฟรชแล้ว Export ใหม่`);
    }

    const nameWidth=112;
    const dayWidth=64;
    Array.from(table.rows||[]).forEach(row=>{
      Array.from(row.cells||[]).forEach((cell,index)=>{
        const px=index===0?nameWidth:dayWidth;
        cell.style.setProperty('width',`${px}px`,'important');
        cell.style.setProperty('min-width',`${px}px`,'important');
        cell.style.setProperty('max-width',`${px}px`,'important');
        cell.style.setProperty('box-sizing','border-box','important');
      });
    });

    const tableWidth=nameWidth+(expected*dayWidth)+2;
    table.style.setProperty('width',`${tableWidth}px`,'important');
    table.style.setProperty('min-width',`${tableWidth}px`,'important');
    table.style.setProperty('max-width',`${tableWidth}px`,'important');
    table.style.setProperty('table-layout','fixed','important');

    target.querySelectorAll('.v297-export-table-wrap,.v297-position-description-card,.v297-position-description-wrap,.v297-position-description-table').forEach(el=>{
      el.style.setProperty('width',`${tableWidth}px`,'important');
      el.style.setProperty('min-width',`${tableWidth}px`,'important');
      el.style.setProperty('max-width',`${tableWidth}px`,'important');
      el.style.setProperty('overflow','visible','important');
      el.style.setProperty('box-sizing','border-box','important');
    });
    target.style.setProperty('width',`${tableWidth}px`,'important');
    target.style.setProperty('min-width',`${tableWidth}px`,'important');
    target.style.setProperty('max-width',`${tableWidth}px`,'important');

    const brand=target.querySelector('.v297-export-brand-header');
    if(brand){
      brand.style.setProperty('width',`${tableWidth}px`,'important');
      brand.style.setProperty('min-width',`${tableWidth}px`,'important');
      brand.style.setProperty('max-width',`${tableWidth}px`,'important');
      brand.style.setProperty('box-sizing','border-box','important');
    }
    await nextFrames();
    return {
      tableWidth,
      captureWidth:Math.max(tableWidth+4,target.scrollWidth,target.offsetWidth),
      captureHeight:Math.max(target.scrollHeight,target.offsetHeight,900)
    };
  }
  async function exportPositionMonthImage(){
    let sandbox=null;
    try{
      if(typeof window.html2canvas!=='function')throw new Error('ไม่พบไลบรารี html2canvas');
      const built=buildExportNode();
      sandbox=built.sandbox;
      const layout=await settleExportLayout(built.target,built.key);
      const width=Math.ceil(layout.captureWidth);
      const height=Math.ceil(layout.captureHeight);

      const canvas=await window.html2canvas(built.target,{
        backgroundColor:'#ffffff',
        scale:2,
        useCORS:true,
        logging:false,
        width,
        height,
        windowWidth:Math.max(width,1600),
        windowHeight:Math.max(height,900),
        scrollX:0,
        scrollY:0,
        onclone:doc=>{
          try{
            const cloned=doc.querySelector('.v297-export-sheet');
            if(!cloned)return;
            cloned.style.setProperty('width',`${layout.tableWidth}px`,'important');
            cloned.style.setProperty('min-width',`${layout.tableWidth}px`,'important');
            cloned.style.setProperty('max-width',`${layout.tableWidth}px`,'important');
            cloned.querySelectorAll('.v297-export-table-wrap,.v297-position-description-card,.v297-position-description-wrap,.v297-position-description-table,.v297-export-brand-header,table').forEach(el=>{
              el.style.setProperty('width',`${layout.tableWidth}px`,'important');
              el.style.setProperty('min-width',`${layout.tableWidth}px`,'important');
              el.style.setProperty('max-width',`${layout.tableWidth}px`,'important');
              el.style.setProperty('overflow','visible','important');
            });
          }catch(_){/* noop */}
        }
      });

      const link=document.createElement('a');
      link.href=canvas.toDataURL('image/png');
      link.download=safeFileName(built.key);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast('Export ตารางตำแหน่งทั้งเดือนเรียบร้อยแล้ว');
    }catch(error){
      console.error(VERSION,error);
      toast(error?.message||'Export รูปภาพไม่สำเร็จ','error');
    }finally{
      sandbox?.remove();
      document.querySelector('[data-v297-export-sandbox="1"]')?.remove();
    }
  }
  function enhance(){
    const st=S();
    if(!['positionMonth','positionMonthView'].includes(st?.page))return;
    const page=document.querySelector('.v275-page');
    const wrap=page?.querySelector('.v275-position-wrap');
    if(!page||!wrap)return;

    const toolbar=page.querySelector('.card .toolbar');
    if(toolbar&&!toolbar.querySelector('[data-v297-export-position-image]')){
      const button=document.createElement('button');
      button.type='button';
      button.className='ghost-btn';
      button.dataset.v297ExportPositionImage='1';
      button.textContent='Export เป็นรูปภาพ (Download Image)';
      toolbar.appendChild(button);
    }

    const key=activeKey();
    const current=page.querySelector('[data-v297-position-descriptions]');
    const holder=document.createElement('div');
    holder.innerHTML=descriptionMarkup(key);
    const next=holder.firstElementChild;
    if(current)current.replaceWith(next);else wrap.insertAdjacentElement('afterend',next);
  }
  let queued=false;
  function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance();});}

  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('[data-v297-export-position-image]');
    if(!btn)return;
    e.preventDefault();
    e.stopPropagation();
    exportPositionMonthImage();
  },true);
  document.addEventListener('change',e=>{if(e.target?.closest?.('.v275-position-wrap'))setTimeout(queue,500);},true);
  const observer=new MutationObserver(mutations=>{
    if(mutations.some(m=>[...m.addedNodes].some(n=>n?.nodeType===1&&(n.matches?.('.v275-page,.v275-position-wrap')||n.querySelector?.('.v275-page,.v275-position-wrap')))))queue();
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});

  window.exportPositionMonthImageV297=exportPositionMonthImage;
  const style=document.createElement('style');
  style.id='v297-position-image-style';
  style.textContent=`
    .v297-position-description-card{margin-top:16px;padding:18px;border:1px solid var(--line,#dce6f1);border-radius:22px;background:#fff;box-shadow:0 6px 18px rgba(15,23,42,.04)}
    .v297-position-description-card h3{margin:0}
    .v297-position-description-wrap{max-height:420px}
    .v297-position-description-table{min-width:1050px}
    .v297-position-description-table th,.v297-position-description-table td{vertical-align:top}
    .v297-job-cell{white-space:normal;min-width:320px;line-height:1.5}

    .v297-export-sheet{display:block;width:max-content;max-width:none;background:#ffffff;color:#203245;padding:0;margin:0;font-family:Sarabun,Kanit,sans-serif}
    .v297-export-brand-header{display:flex;align-items:center;gap:18px;margin:0 0 16px;padding:14px 18px;border:1px solid #d7e5f6;border-radius:22px;background:linear-gradient(180deg,#f8fbff,#ffffff);box-shadow:0 10px 24px rgba(37,99,235,.08)}
    .v297-export-logo{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#8fd0ff,#4aa3ff);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 10px 22px rgba(74,163,255,.26)}
    .v297-export-logo b{font-size:27px;line-height:1}
    .v297-export-logo small{font-size:10px;letter-spacing:1.2px;margin-top:5px;font-weight:800}
    .v297-export-brand-copy p{margin:0;color:#2563eb;font-weight:800}
    .v297-export-brand-copy h2{margin:2px 0;font-size:22px}
    .v297-export-brand-copy span{color:#5b6b7f;font-weight:700}

    .v297-export-table-wrap{overflow:visible;width:max-content;max-width:none;background:#fff;border:1px solid #dce6f1;border-radius:20px;padding:8px;box-shadow:0 8px 20px rgba(15,23,42,.04)}
    .v297-export-table-wrap table{width:max-content!important;max-width:none!important;table-layout:fixed!important;border-collapse:separate!important;border-spacing:0!important;direction:ltr!important;font-size:10px!important}
    .v297-export-table-wrap thead,.v297-export-table-wrap tbody,.v297-export-table-wrap tr,.v297-export-table-wrap th,.v297-export-table-wrap td{direction:ltr!important}
    .v297-export-table-wrap th,.v297-export-table-wrap td{position:static!important;left:auto!important;right:auto!important;z-index:auto!important;transform:none!important;box-sizing:border-box!important;padding:4px 3px!important;line-height:1.15!important}
    .v297-export-table-wrap .v275-position-day{height:auto!important;min-height:54px!important;vertical-align:middle!important}
    .v297-export-table-wrap .v275-position-cell,.v297-export-table-wrap .v275-mentor-cell{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;min-width:0!important}
    .v297-export-table-wrap th{background:#f4f8fd!important;color:#253a55!important;font-weight:800!important}
    .v297-export-table-wrap td{background:#fff}
    .v297-export-table-wrap .v275-meta-day.off{background:#e9eef5!important;color:#64748b!important}
    .v297-export-table-wrap .v275-count-row th,.v297-export-table-wrap .v275-count-row td{background:#fffaf0!important}

    .v297-export-table-wrap th.v390-export-outing-day{background:#fecdd3!important;color:#9f1239!important;box-shadow:inset 0 -3px 0 #e11d48!important}
    .v297-export-table-wrap td.v390-export-outing-day{background:#fff1f2!important}
    .v390-export-outing-label{display:block;margin-top:1px;color:#be123c;font-size:7px;font-weight:900;line-height:1.05;white-space:nowrap}

    .v297-export-table-wrap .v384-export-name-cell{background:var(--staff-bg,#f8fafc)!important;color:var(--staff-fg,#0f172a)!important;text-align:left!important;border-right:2px solid rgba(148,163,184,.45)!important;padding:5px 7px!important;vertical-align:middle!important}
    .v297-export-table-wrap .v384-export-name-cell b{display:block!important;font-size:10px!important;line-height:1.15!important;padding:0!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important}
    .v297-export-table-wrap .v384-export-name-cell small{display:block!important;font-size:7px!important;line-height:1.1!important;margin-top:2px!important;white-space:normal!important}
    .v297-export-table-wrap .v384-export-summary-cell{background:#fbfdff!important;color:#26384f!important;text-align:left!important;padding:5px 7px!important;box-shadow:none!important;vertical-align:middle!important}
    .v297-export-table-wrap .v384-export-summary-cell b{font-size:8px!important;line-height:1.2!important}
    .v297-export-table-wrap .v384-export-summary-cell span,.v297-export-table-wrap .v384-export-summary-cell small{font-size:6.8px!important;line-height:1.15!important;color:#64748b!important}

    .v297-export-position-text{display:block;width:100%;max-width:100%;padding:4px 3px;border-radius:7px;background:#edf5ff;color:#2563eb;font-size:10.5px!important;font-weight:800;line-height:1.15!important;text-align:center;white-space:normal!important;overflow-wrap:anywhere;word-break:normal;box-sizing:border-box}
    .v297-export-table-wrap td.v392-export-leave-cell{background:#fff8e8!important;box-shadow:inset 0 0 0 2px #f59e0b!important;vertical-align:top!important;padding:3px!important}
    .v297-export-table-wrap .v392-export-leave-badge{display:block!important;width:100%!important;margin:0 0 3px!important;padding:4px 2px!important;border:1px solid currentColor!important;border-radius:7px!important;font-size:9.5px!important;font-weight:900!important;line-height:1.1!important;text-align:center!important;white-space:normal!important;box-sizing:border-box!important}
    .v297-export-table-wrap .v392-export-position-under-leave{display:block!important;margin-top:1px!important;padding:2px 1px!important;background:transparent!important;color:#64748b!important;font-size:7px!important;font-weight:700!important;line-height:1.05!important;opacity:.42!important}
    .v297-export-table-wrap .v275-meta-day,.v297-export-table-wrap .v275-meta-day b,.v297-export-table-wrap .v275-meta-day span{font-size:9px!important;line-height:1.15!important}
    .v297-export-table-wrap .v275-date-head b{font-size:11px!important}
    .v297-export-table-wrap .v275-date-head small{font-size:8px!important}
    .v297-export-input-text{font-size:10px!important;font-weight:800}

    .v297-export-sheet .v297-position-description-card{width:100%;box-sizing:border-box}
    .v297-export-sheet .v297-position-description-wrap{overflow:visible!important;max-height:none!important}
    .v297-export-sheet .v297-position-description-table{width:100%;min-width:0}
  `;
  document.head.appendChild(style);
  queue();
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v297-position-month-image-export-slot-details.js", error); }
;

/* Original source: patch-v298-baseline-balance-after-trade.js */
try {
/* CNMI Staff Planner V298
   Preserve Admin's original duty balance after completed shift sales.
   Current columns remain live; fairness/carry columns use the pre-sale roster.
   This patch is additive and keeps the complete V296/V297 UI intact.
*/
(function(){
  'use strict';
  const VERSION='V298_BASELINE_BALANCE_AFTER_TRADE';
  if(window.__CNMI_V298_BASELINE_BALANCE_AFTER_TRADE__)return;
  window.__CNMI_V298_BASELINE_BALANCE_AFTER_TRADE__=true;

  const fiscalCache=new Map();
  const fiscalLoading=new Map();
  function S(){try{return state||window.state||null;}catch(_){return window.state||null;}}
  function DB(){try{return sb||window.sb||null;}catch(_){return window.sb||null;}}
  function esc(v){try{return escapeHtml(v==null?'':String(v));}catch(_){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}}
  function normId(v){return String(v==null?'':v);}
  function normDate(v){try{return normalizeDateKey(v);}catch(_){return String(v||'').slice(0,10);}}
  function monthKeySafe(v){return /^\d{4}-\d{2}$/.test(String(v||''))?String(v):new Date().toISOString().slice(0,7);}
  function isAdminSafe(){try{return !!isAdmin();}catch(_){return String(S()?.profile?.role||'').toLowerCase()==='admin';}}
  function explicitFalse(v){return v===false||['false','0','no','off','ปิด'].includes(String(v??'').trim().toLowerCase());}
  function isLongLeave(person){try{return !!isLongTermLeaveStaff(person);}catch(_){return person?.maternity_status===true||person?.is_long_term_leave===true;}}
  function isRosterPerson(person){
    if(!person)return false;
    const active=Object.prototype.hasOwnProperty.call(person,'is_active')?person.is_active:person.active;
    if(active==null||explicitFalse(active)||String(person.staff_type||'').trim()==='แพทย์')return false;
    const enabled=person.roster_enabled??person.duty_enabled??person.can_roster??person.is_roster_enabled??person.schedule_enabled??person.is_schedule_enabled;
    return !explicitFalse(enabled);
  }
  function ordered(rows){try{return orderedStaff(rows);}catch(_){return [...rows].sort((a,b)=>String(a?.nickname||a?.full_name||'').localeCompare(String(b?.nickname||b?.full_name||''),'th'));}}
  function groupLabel(person){return String(person?.staff_type||'').trim()==='เคิก'?'เคิก':'MT';}
  function badgeHtml(text,tone){try{return badge(text,tone);}catch(_){return `<span class="badge ${esc(tone||'')}">${esc(text)}</span>`;}}
  function staffPillHtml(person){try{return staffPill(person);}catch(_){return `<b>${esc(person?.nickname||person?.full_name||'-')}</b>`;}}
  function fmt(n){const x=Number(n||0);return Math.abs(x)<0.05?'0.0':x.toFixed(1);}
  function nextMonth(key){const [y,m]=key.split('-').map(Number),d=new Date(y,m,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
  function monthEnd(key){const [y,m]=key.split('-').map(Number);return `${key}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;}
  function fiscalBounds(key){const safe=monthKeySafe(key),y=Number(safe.slice(0,4)),m=Number(safe.slice(5,7)),sy=m>=10?y:y-1;return{start:`${sy}-10-01`,startKey:`${sy}-10`,end:monthEnd(safe),key:`${sy}-10_${safe}`};}
  function monthsBetween(start,end){const out=[];let cur=start,guard=0;while(cur<=end&&guard<24){out.push(cur);cur=nextMonth(cur);guard++;}return out;}
  function resetMonth(person,field){const raw=person?.[field];return raw?normDate(raw).slice(0,7):'';}
  function currentStaffList(staffList){const input=Array.isArray(staffList)&&staffList.length?staffList:(S()?.staff||[]).filter(isRosterPerson);return ordered(input.filter(p=>p&&String(p.staff_type||'').trim()!=='แพทย์'));}
  function calcStats(rows){try{return calcFairness((rows||[]).filter(r=>r?.staff_id))||{};}catch(_){return{};}}
  function countDutyCodes(rows,staffId){
    const own=(rows||[]).filter(r=>normId(r?.staff_id)===normId(staffId));
    const count=fn=>own.filter(fn).length;
    return{total:own.length,chbd1:count(r=>r.duty_code==='ชบด1'),chbd2:count(r=>r.duty_code==='ชบด2'),chbd3:count(r=>r.duty_code==='ชบด3'),ch3a:count(r=>r.duty_code==='ช3A'),ch3b:count(r=>r.duty_code==='ช3B'),ch4:count(r=>String(r.duty_code||'').startsWith('ช4')),ch9:count(r=>String(r.duty_code||'').startsWith('ช9'))};
  }
  function daysOff(staffId,key,rows){try{return Number(calculateDaysOff(staffId,key,rows)||0);}catch(_){return 0;}}
  function tradeTime(row){return row?.updated_at||row?.completed_at||row?.confirmed_at||row?.created_at||'';}
  function isWholeTrade(request,assignment){
    try{const api=window.cnmiTradeSegmentsV217;if(api){const part=api.partFromNote(request?.note,assignment);return api.coversWholeSlot(part,assignment);}}catch(_){}
    return true;
  }
  function completedTrades(rows){return (rows||[]).filter(r=>String(r?.status||'')==='completed'&&r?.from_assignment_id&&r?.requester_id);}
  function reconstructBaseline(assignments,trades){
    const output=(assignments||[]).map(row=>({...row}));
    const byId=new Map(output.filter(r=>r?.id).map(r=>[normId(r.id),r]));
    completedTrades(trades).slice().sort((a,b)=>String(tradeTime(b)).localeCompare(String(tradeTime(a)))).forEach(request=>{
      const assignment=byId.get(normId(request.from_assignment_id));
      if(!assignment||!isWholeTrade(request,assignment))return;
      assignment.staff_id=request.requester_id;
    });
    return output;
  }
  function mergeSelectedMonth(source,selected,key){
    const kept=(source||[]).filter(r=>!normDate(r?.duty_date).startsWith(key));
    return kept.concat((selected||[]).filter(r=>normDate(r?.duty_date).startsWith(key)));
  }
  function availableFiscal(key,selectedAssignments){
    const b=fiscalBounds(key),cached=fiscalCache.get(b.key),stateRows=(S()?.rosterAssignments||[]).filter(r=>{const d=normDate(r?.duty_date);return d>=b.start&&d<=b.end;});
    const current=mergeSelectedMonth(cached?.assignments||stateRows,selectedAssignments,key);
    const trades=cached?.trades||completedTrades(S()?.tradeRequests||[]);
    ensureFiscalData(key);
    return{bounds:b,current,trades,baseline:reconstructBaseline(current,trades)};
  }
  async function ensureFiscalData(key){
    const b=fiscalBounds(key);if(fiscalCache.has(b.key))return fiscalCache.get(b.key);if(fiscalLoading.has(b.key))return fiscalLoading.get(b.key);const client=DB();if(!client)return null;
    const task=(async()=>{
      try{
        const [a,t]=await Promise.all([
          client.from('roster_assignments').select('*').gte('duty_date',b.start).lte('duty_date',b.end).order('duty_date'),
          client.from('roster_trade_requests').select('*').eq('status','completed').order('created_at')
        ]);
        if(a.error)throw a.error;
        const ids=new Set((a.data||[]).map(r=>normId(r.id)));
        const trades=t.error?completedTrades(S()?.tradeRequests||[]):completedTrades(t.data||[]).filter(r=>ids.has(normId(r.from_assignment_id))||ids.has(normId(r.to_assignment_id)));
        const pack={assignments:a.data||[],trades};fiscalCache.set(b.key,pack);
        setTimeout(()=>{try{if(['scheduler','schedule','positionMonth'].includes(S()?.page))window.renderPage?.();}catch(_){}},0);
        return pack;
      }catch(error){console.warn(`${VERSION}: fiscal data`,error);return null;}
      finally{fiscalLoading.delete(b.key);}
    })();fiscalLoading.set(b.key,task);return task;
  }
  function buildBalanceData(staffList,assignments,key){
    const safe=monthKeySafe(key),people=currentStaffList(staffList),fiscal=availableFiscal(safe,assignments),months=monthsBetween(fiscal.bounds.startKey,safe);
    const currentByMonth=new Map(),baseByMonth=new Map();
    months.forEach(month=>{
      const currentRows=fiscal.current.filter(r=>normDate(r?.duty_date).startsWith(month)&&r?.staff_id);
      const baseRows=fiscal.baseline.filter(r=>normDate(r?.duty_date).startsWith(month)&&r?.staff_id);
      currentByMonth.set(month,{rows:currentRows,stats:calcStats(currentRows)});
      baseByMonth.set(month,{rows:baseRows,stats:calcStats(baseRows)});
    });
    const selectedCurrent=currentByMonth.get(safe)||{rows:[],stats:{}},selectedBase=baseByMonth.get(safe)||{rows:[],stats:{}};
    const groupNames=['MT','เคิก'].filter(label=>people.some(p=>groupLabel(p)===label));
    const groupAverages=new Map();
    months.forEach(month=>{
      const pack=baseByMonth.get(month)||{rows:[],stats:{}};const values={};
      groupNames.forEach(label=>{
        const eligible=people.filter(p=>groupLabel(p)===label&&!isLongLeave(p)&&(!resetMonth(p,'balance_reset_at')||month>=resetMonth(p,'balance_reset_at')));
        const units=eligible.map(p=>Number(pack.stats[normId(p.id)]?.units||0));
        const dayValues=eligible.map(p=>daysOff(p.id,month,pack.rows));
        values[label]={units:units.length?units.reduce((a,c)=>a+c,0)/units.length:0,days:dayValues.length?dayValues.reduce((a,c)=>a+c,0)/dayValues.length:0};
      });
      groupAverages.set(month,values);
    });
    const groups=groupNames.map(label=>{
      const groupPeople=people.filter(p=>groupLabel(p)===label),selectedAvg=groupAverages.get(safe)?.[label]||{units:0,days:0};
      const rows=groupPeople.map(person=>{
        const id=normId(person.id),currentStat=selectedCurrent.stats[id]||{},baseStat=selectedBase.stats[id]||{},excluded=isLongLeave(person);
        const dutyReset=resetMonth(person,'balance_reset_at'),holidayReset=resetMonth(person,'holiday_balance_reset_at');
        const dutyStart=dutyReset&&dutyReset>fiscal.bounds.startKey?dutyReset:fiscal.bounds.startKey;
        const holidayStart=holidayReset&&holidayReset>fiscal.bounds.startKey?holidayReset:fiscal.bounds.startKey;
        let carry=0,holidayCarry=0;
        months.filter(month=>month<safe).forEach(month=>{
          const pack=baseByMonth.get(month)||{rows:[],stats:{}};const averages=groupAverages.get(month)?.[label]||{units:0,days:0};
          if(!excluded&&month>=dutyStart)carry+=Number(pack.stats[id]?.units||0)-Number(averages.units||0);
          if(!excluded&&month>=holidayStart)holidayCarry+=daysOff(id,month,pack.rows)-Number(averages.days||0);
        });
        const baseUnits=Number(baseStat.units||0),gap=excluded?0:baseUnits-Number(selectedAvg.units||0),cumulative=excluded?0:carry+gap;
        const baseDays=daysOff(id,safe,selectedBase.rows),holidayGap=excluded?0:baseDays-Number(selectedAvg.days||0),holidayCumulative=excluded?0:holidayCarry+holidayGap;
        const currentDays=excluded?0:daysOff(id,safe,selectedCurrent.rows),counts=countDutyCodes(selectedBase.rows,id);
        let status='สมดุลสะสม',tone='green';
        if(excluded){status='ลาระยะยาว / ไม่คิดหนี้เวร';tone='black';}
        else if(dutyReset===safe&&Math.abs(cumulative)<=0.5){status='เริ่มนับเวรใหม่เดือนนี้';tone='blue';}
        else if(cumulative>0.5){status='เวรสะสมมากกว่าเฉลี่ย';tone='orange';}
        else if(cumulative<-0.5){status='เวรสะสมน้อยกว่าเฉลี่ย';tone='blue';}
        return{person,excluded,current:{total:Number(currentStat.total||0),units:Number(currentStat.units||0),hours:Number(currentStat.hours||0),pay:Number(currentStat.pay||0),days:currentDays},fixed:{gap,carry,cumulative,holidayCumulative,counts,dutyReset,holidayReset,status,tone}};
      });
      return{label,average:Number(selectedAvg.units||0),rows};
    });
    return{key:safe,groups};
  }
  function adminTable(data){
    return `<div class="clean-balance-dashboard grouped-balance-dashboard v278-cumulative-dashboard v298-baseline-balance">${data.groups.map(group=>`<section class="balance-group-section"><div class="section-title balance-group-title"><h3>กลุ่ม ${esc(group.label)}</h3><span>${badgeHtml(`ค่าเฉลี่ยเดือนนี้ ${group.average.toFixed(1)} หน่วยเวร`,'blue')}</span></div><div class="table-wrap v278-balance-table-wrap"><table class="clean-balance-table v278-balance-table"><thead><tr><th>เจ้าหน้าที่</th><th>เวรรวม</th><th>หน่วยเวร</th><th>ชั่วโมงรวม</th><th>เงินประมาณ</th><th>Quota Gap</th><th>OT Balance ยกมา</th><th>เวรสะสม</th><th>วันหยุดเดือนนี้</th><th>วันหยุดสะสม</th><th>ชบด1</th><th>ชบด2</th><th>ชบด3</th><th>ช3A</th><th>ช3B</th><th>ช4</th><th>ช9</th><th class="v279-pair-column">ดูคู่เวร</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${group.rows.map(row=>{
      const f=row.fixed,c=row.current,id=normId(row.person.id),dutyReset=f.dutyReset===data.key,holidayReset=f.holidayReset===data.key;
      return `<tr class="${row.excluded?'v278-exempt-row':''}"><td>${staffPillHtml(row.person)}</td><td>${c.total}</td><td>${c.units.toFixed(1)}</td><td>${c.hours.toFixed(1)}</td><td>${Math.round(c.pay).toLocaleString()}</td><td class="${f.gap>0.5?'v278-positive':f.gap<-0.5?'v278-negative':''}">${fmt(f.gap)}</td><td class="${f.carry>0.5?'v278-positive':f.carry<-0.5?'v278-negative':''}">${fmt(f.carry)}</td><td class="${f.cumulative>0.5?'v278-positive':f.cumulative<-0.5?'v278-negative':''}">${fmt(f.cumulative)}</td><td>${c.days}</td><td class="${f.holidayCumulative>0.5?'v278-positive':f.holidayCumulative<-0.5?'v278-negative':''}">${fmt(f.holidayCumulative)}</td><td>${f.counts.chbd1}</td><td>${f.counts.chbd2}</td><td>${f.counts.chbd3}</td><td>${f.counts.ch3a}</td><td>${f.counts.ch3b}</td><td>${f.counts.ch4}</td><td>${f.counts.ch9}</td><td class="v279-pair-column"><button type="button" class="tiny-btn soft v279-pair-button" data-v279-duty-pair="${esc(id)}" data-v279-month="${esc(data.key)}">ดูคู่เวร</button></td><td>${badgeHtml(f.status,f.tone)}${f.dutyReset?`<small class="v278-reset-note">เวรเริ่ม ${esc(f.dutyReset)}</small>`:''}${f.holidayReset?`<small class="v278-reset-note">วันหยุดเริ่ม ${esc(f.holidayReset)}</small>`:''}</td><td><div class="v278-action-stack"><button type="button" class="tiny-btn ${dutyReset?'danger':'warning'}" data-v277-balance-reset="${esc(id)}" data-v277-month="${esc(data.key)}" data-v277-action="${dutyReset?'undo':'reset'}">${dutyReset?'ยกเลิกรีเซ็ตเวร':'เริ่มนับเวรใหม่เดือนนี้'}</button><button type="button" class="tiny-btn ${holidayReset?'danger':'soft'}" data-v278-holiday-reset="${esc(id)}" data-v278-month="${esc(data.key)}" data-v278-action="${holidayReset?'undo':'reset'}">${holidayReset?'ยกเลิกรีเซ็ตวันหยุด':'เริ่มนับวันหยุดใหม่เดือนนี้'}</button></div></td></tr>`;
    }).join('')}</tbody></table></div></section>`).join('')}</div>`;
  }
  function staffTable(data){
    return `<div class="clean-balance-dashboard grouped-balance-dashboard v265-balance-dashboard v298-baseline-balance">${data.groups.map(group=>`<section class="balance-group-section v265-balance-group"><div class="section-title balance-group-title"><h3>กลุ่ม ${esc(group.label)}</h3><span>${badgeHtml(`ค่าเฉลี่ย ${group.average.toFixed(1)} หน่วยเวร`,'blue')}</span></div><div class="table-wrap v265-balance-wrap"><table class="clean-balance-table v265-balance-table"><thead><tr><th>เจ้าหน้าที่</th><th>เวรรวม</th><th>หน่วยเวร</th><th>ชั่วโมงรวม</th><th>เงินประมาณ</th><th>Quota Gap</th><th>OT Balance</th><th>วันหยุดสะสม</th><th>ชบด1</th><th>ชบด2</th><th>ชบด3</th><th>ช3A</th><th>ช3B</th><th>ช4</th><th>ช9</th><th>สถานะ</th></tr></thead><tbody>${group.rows.map(row=>{const f=row.fixed,c=row.current;return `<tr><td>${staffPillHtml(row.person)}</td><td>${c.total}</td><td>${c.units.toFixed(1)}</td><td>${c.hours.toFixed(1)}</td><td>${Math.round(c.pay).toLocaleString()}</td><td>${fmt(f.gap)}</td><td>${fmt(f.cumulative)}</td><td>${fmt(f.holidayCumulative)}</td><td>${f.counts.chbd1}</td><td>${f.counts.chbd2}</td><td>${f.counts.chbd3}</td><td>${f.counts.ch3a}</td><td>${f.counts.ch3b}</td><td>${f.counts.ch4}</td><td>${f.counts.ch9}</td><td>${badgeHtml(f.status,f.tone)}</td></tr>`;}).join('')}</tbody></table></div></section>`).join('')}</div>`;
  }
  const previousRender=window.renderBalanceDashboard||(typeof renderBalanceDashboard==='function'?renderBalanceDashboard:null);
  const renderV298=function renderBalanceDashboardV298(staffList,assignments,key){
    try{const data=buildBalanceData(staffList,assignments,key||S()?.monthKey);return isAdminSafe()&&S()?.page==='scheduler'?adminTable(data):staffTable(data);}catch(error){console.error(`${VERSION}: render`,error);return previousRender?previousRender.apply(this,arguments):'<div class="empty-state">คำนวณสมดุลเวรไม่สำเร็จ</div>';}
  };
  window.renderBalanceDashboard=renderV298;try{renderBalanceDashboard=renderV298;}catch(_){}

  const showFairnessV298=function(){
    const key=monthKeySafe(S()?.monthKey);let assignments=[];let staffList=[];
    try{assignments=getAssignmentsForMonth(key).filter(r=>r?.staff_id);}catch(_){assignments=(S()?.rosterAssignments||[]).filter(r=>normDate(r?.duty_date).startsWith(key)&&r?.staff_id);}
    try{staffList=scheduleStaffList();}catch(_){staffList=(S()?.staff||[]).filter(isRosterPerson);}
    try{showModal(`<h2>ตรวจสมดุลการกระจายเวร ${esc(key)}</h2>${staffTable(buildBalanceData(staffList,assignments,key))}`,{large:true});}catch(error){console.warn(`${VERSION}: fairness modal`,error);}
  };
  window.showFairness=showFairnessV298;try{showFairness=showFairnessV298;}catch(_){}

  const style=document.createElement('style');style.id='v298-baseline-balance-style';style.textContent=`
    .v298-baseline-balance .v278-balance-table,.v298-baseline-balance .v265-balance-table{font-variant-numeric:tabular-nums}
  `;document.head.appendChild(style);
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v298-baseline-balance-after-trade.js", error); }
;

/* Original source: patch-v300-mobile-daily-position-card-stack-fix.js */
try {
/* V300 Mobile daily-position card layout fix
   - Prevents the duty preview from sharing/overlapping the planned-staff cell.
   - Stacks planned staff, daily adjustment, duty preview, and action on phones.
   - Keeps the existing desktop/tablet rendering and all data logic unchanged.
*/
(function(){
  'use strict';

  const STYLE_ID = 'v300-mobile-daily-position-card-stack-fix-style';

  function injectStyle(){
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* V296 inserts this block as another direct child of the card.
         Give it its own grid row instead of letting the broad V249 selector
         place it on top of the planned-staff block. */
      .position-mobile-card.v225-position-card > .v296-position-duty-preview{
        grid-area:duty !important;
        width:100% !important;
        min-width:0 !important;
        box-sizing:border-box !important;
        margin:0 !important;
      }

      @media (max-width:760px){
        .position-mobile-card.v225-position-card{
          grid-template-columns:minmax(0,1fr) !important;
          grid-template-areas:
            "head"
            "meta"
            "plan"
            "edit"
            "duty"
            "action" !important;
          gap:10px !important;
        }

        /* Planned staff block only. Exclude the newly inserted duty preview. */
        .position-mobile-card.v225-position-card > div:not(.section-title):not(.muted):not(.actions):not(.v296-position-duty-preview){
          grid-area:plan !important;
          width:100% !important;
          min-width:0 !important;
          box-sizing:border-box !important;
        }

        .position-mobile-card.v225-position-card > label{
          grid-area:edit !important;
          width:100% !important;
          min-width:0 !important;
          box-sizing:border-box !important;
        }

        .position-mobile-card.v225-position-card > .v296-position-duty-preview{
          grid-area:duty !important;
          width:100% !important;
          min-width:0 !important;
          box-sizing:border-box !important;
          padding:12px 14px !important;
        }

        .position-mobile-card.v225-position-card > .actions{
          grid-area:action !important;
          width:100% !important;
          justify-content:flex-end !important;
        }

        .position-mobile-card.v225-position-card > .actions .tiny-btn{
          max-width:100% !important;
          white-space:normal !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  injectStyle();
  document.addEventListener('DOMContentLoaded', injectStyle, { once:true });

  console.info('[V300_MOBILE_DAILY_POSITION_CARD_STACK_FIX] loaded');
})();

} catch (error) { console.error("[v569] patch-v300-mobile-daily-position-card-stack-fix.js", error); }
;
