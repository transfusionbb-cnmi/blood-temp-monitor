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
