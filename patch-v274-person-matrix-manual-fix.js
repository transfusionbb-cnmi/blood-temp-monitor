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
