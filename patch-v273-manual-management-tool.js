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
      const result = await db().from(DIRECTORY_TABLE).update({active:false,updated_by:currentStaff(),updated_at:new Date().toISOString()}).eq('id',id);
      if (result.error) throw result.error;
      await loadTraineeDirectory(true);
      toast('ปิดใช้งานรายชื่อแล้ว'); safeRender();
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
