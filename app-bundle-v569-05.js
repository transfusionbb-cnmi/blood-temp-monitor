
/* Original source: patch-v305-mobile-app-scroll-and-position-description.js */
try {
/* CNMI Staff Planner V305
   Mobile PWA usability fixes
   1) Position descriptions become compact expandable cards on phones/tablets.
   2) Admin Position Management uses normal page scrolling in installed PWA.
   3) Releases a stale body scroll lock only when no modal is actually open.
*/
(function(){
  'use strict';
  const VERSION='V305_MOBILE_APP_SCROLL_AND_POSITION_DESCRIPTION';
  if(window.__CNMI_V305_MOBILE_APP_SCROLL_AND_POSITION_DESCRIPTION__) return;
  window.__CNMI_V305_MOBILE_APP_SCROLL_AND_POSITION_DESCRIPTION__=true;

  function esc(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }

  function textOf(cell){
    return String(cell?.textContent || '').replace(/\s+/g,' ').trim() || '-';
  }

  function isVisibleModal(node){
    if(!node || node.classList.contains('hidden')) return false;
    const style=window.getComputedStyle?.(node);
    return style ? style.display!=='none' && style.visibility!=='hidden' : true;
  }

  function releaseStaleScrollLock(){
    const appModal=document.getElementById('modal');
    const installModal=document.getElementById('pwaInstallModalV303');
    const openModal=isVisibleModal(appModal) || isVisibleModal(installModal)
      || Array.from(document.querySelectorAll('.modal:not(.hidden),.pwa-install-modal:not(.hidden)')).some(isVisibleModal);
    if(!openModal) document.body.classList.remove('modal-open');
  }

  function buildMobileDescriptionCards(section){
    if(!section || !section.closest('.v275-page')) return;
    const table=section.querySelector('.v297-position-description-table');
    const rows=Array.from(table?.querySelectorAll('tbody tr') || []);
    const signature=rows.map(row=>Array.from(row.cells || []).map(textOf).join('|')).join('||');
    let list=section.querySelector('.v305-position-description-list');
    if(list?.dataset.signature===signature) return;

    if(!list){
      list=document.createElement('div');
      list.className='v305-position-description-list';
      const wrap=section.querySelector('.v297-position-description-wrap');
      if(wrap) wrap.insertAdjacentElement('beforebegin',list);
      else section.appendChild(list);
    }
    list.dataset.signature=signature;

    if(!rows.length){
      list.innerHTML='<div class="empty-state">เดือนนี้ยังไม่มีตำแหน่งในตาราง</div>';
      return;
    }

    list.innerHTML=rows.map((row,index)=>{
      const cells=Array.from(row.cells || []);
      const code=textOf(cells[0]);
      const dates=textOf(cells[1]);
      const zone=textOf(cells[2]);
      const breakTime=textOf(cells[3]);
      const rule=textOf(cells[4]);
      const job=textOf(cells[5]);
      return `<details class="v305-position-description-item" ${index===0?'open':''}>
        <summary>
          <span class="v305-position-code">${esc(code)}</span>
          <span class="v305-position-dates">วันที่ ${esc(dates)}</span>
        </summary>
        <div class="v305-position-description-body">
          <div><small>โซน</small><b>${esc(zone)}</b></div>
          <div><small>เวลาพัก</small><b>${esc(breakTime)}</b></div>
          <div class="v305-wide"><small>ผู้ปฏิบัติหลัก / เงื่อนไข</small><p>${esc(rule)}</p></div>
          <div class="v305-wide"><small>รายละเอียดหน้าที่</small><p>${esc(job)}</p></div>
        </div>
      </details>`;
    }).join('');
  }

  function enhance(root=document){
    root.querySelectorAll?.('.v275-page [data-v297-position-descriptions]').forEach(buildMobileDescriptionCards);
    releaseStaleScrollLock();
  }

  let queued=false;
  function queueEnhance(){
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      enhance(document);
    });
  }

  const style=document.createElement('style');
  style.id='v305-mobile-app-scroll-position-description-style';
  style.textContent=`
    .v305-position-description-list{display:none}
    @media(max-width:820px){
      html,body{min-height:100%!important;height:auto!important;overflow-x:hidden!important}
      body:not(.modal-open){overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior-y:auto!important}
      #appView.app-view:not(.hidden){height:auto!important;min-height:100dvh!important;overflow:visible!important}
      #appView .main-panel,#appView .page-content{height:auto!important;min-height:0!important;max-height:none!important;overflow-y:visible!important}
      #appView .page-content{padding-bottom:max(34px,env(safe-area-inset-bottom))!important}

      .v282-position-management-root,
      .v282-position-management-root .v282-position-management-stable,
      .v282-position-management-root .v224-position-template-page,
      .v282-position-management-root .v224-slot-crud-card{
        height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;
      }
      .v282-position-management-root .v224-slot-table{
        height:auto!important;min-height:0!important;max-height:none!important;
        overflow:visible!important;overscroll-behavior:auto!important;
        -webkit-overflow-scrolling:auto!important;touch-action:pan-y!important;
      }
      .v282-position-management-root .v224-slot-table table,
      .v282-position-management-root .v224-slot-table tbody,
      .v282-position-management-root .v224-slot-table tr{touch-action:pan-y!important}
      .v282-position-management-root button,
      .v282-position-management-root select,
      .v282-position-management-root input,
      .v282-position-management-root textarea{touch-action:manipulation!important}

      .v275-page .v297-position-description-card{padding:14px!important;overflow:visible!important}
      .v275-page .v297-position-description-card .section-title{margin-bottom:10px}
      .v275-page .v297-position-description-wrap{display:none!important}
      .v275-page .v305-position-description-list{display:grid!important;gap:10px}
      .v305-position-description-item{border:1px solid #d8e6f4;border-radius:16px;background:#fff;overflow:hidden;box-shadow:0 4px 14px rgba(15,23,42,.04)}
      .v305-position-description-item summary{list-style:none;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:13px 14px;cursor:pointer;background:#f7fbff;touch-action:manipulation}
      .v305-position-description-item summary::-webkit-details-marker{display:none}
      .v305-position-description-item summary::after{content:'⌄';flex:0 0 auto;color:#2563eb;font-size:20px;font-weight:900;transition:transform .18s ease}
      .v305-position-description-item[open] summary::after{transform:rotate(180deg)}
      .v305-position-code{font-weight:900;color:#17324d;overflow-wrap:anywhere}
      .v305-position-dates{font-size:12px;font-weight:800;color:#2563eb;text-align:right}
      .v305-position-description-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;padding:13px 14px;border-top:1px solid #e6eef7}
      .v305-position-description-body>div{min-width:0;padding:10px;border-radius:12px;background:#f8fafc}
      .v305-position-description-body .v305-wide{grid-column:1/-1}
      .v305-position-description-body small{display:block;margin-bottom:3px;color:#64748b;font-weight:800}
      .v305-position-description-body b,.v305-position-description-body p{margin:0;color:#263b52;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
    }
    @media(max-width:420px){
      .v305-position-description-body{grid-template-columns:1fr}
      .v305-position-description-body .v305-wide{grid-column:auto}
      .v305-position-description-item summary{align-items:flex-start;flex-wrap:wrap}
      .v305-position-dates{width:100%;text-align:left}
    }
  `;
  document.head.appendChild(style);

  const observer=new MutationObserver(queueEnhance);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',queueEnhance,{once:true});
  window.addEventListener('pageshow',queueEnhance);
  window.addEventListener('resize',queueEnhance);
  document.addEventListener('click',event=>{
    if(event.target?.closest?.('.modal-close,.pwa-install-close')) setTimeout(queueEnhance,0);
  },true);
  queueEnhance();

  window.cnmiV305={enhance,buildMobileDescriptionCards,releaseStaleScrollLock};
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v305-mobile-app-scroll-and-position-description.js", error); }
;

/* Original source: patch-v311-mobile-popup-daily-summary-fix.js */
try {
/* CNMI Staff Planner V311
   Final fixes for:
   - Calendar day popup on mobile/PWA and desktop
   - Monthly roster sell-duty popup
   - Monthly daytime-position detail popup
   - Daily position duty text without redundant detail buttons
   - Daily Slot display aligned with the monthly table (e.g. 11/11)
   - Removal of obsolete Ch4 monthly status / SQL warning card
*/
(function(){
  'use strict';

  const VERSION='V323_POPUP_DAILY_DETAIL_STABILITY';
  if(window.__CNMI_V311_MOBILE_POPUP_DAILY_SUMMARY_FIX__) return;
  window.__CNMI_V311_MOBILE_POPUP_DAILY_SUMMARY_FIX__=true;

  const touchStarts=new Map();
  let queued=false;
  let lastAction='';
  let lastActionAt=0;

  function esc(value){
    try{
      const fn=window.escapeHtml || (typeof escapeHtml==='function' ? escapeHtml : null);
      if(typeof fn==='function') return fn(value==null?'':String(value));
    }catch(_){}
    return String(value==null?'':value).replace(/[&<>"']/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }

  function appState(){
    try{return state || window.state || null;}catch(_){return window.state || null;}
  }

  function showToastSafe(message){
    try{
      const fn=window.showToast || (typeof showToast==='function' ? showToast : null);
      if(typeof fn==='function') return fn(message,{tone:'error'});
    }catch(_){}
    console.error(`[${VERSION}] ${message}`);
  }

  function stop(event){
    try{event.preventDefault();}catch(_){}
    try{event.stopPropagation();}catch(_){}
    try{event.stopImmediatePropagation?.();}catch(_){}
  }

  function forceModal(html,opts={}){
    const modal=document.getElementById('modal');
    const body=document.getElementById('modalBody');
    if(!modal || !body) return false;
    if(typeof html==='string') body.innerHTML=html;
    try{
      if(window.__modalCloseTimerV193){
        clearTimeout(window.__modalCloseTimerV193);
        window.__modalCloseTimerV193=null;
      }
    }catch(_){}
    modal.classList.remove('hidden','modal-closing');
    modal.classList.add('modal-ready');
    modal.classList.toggle('modal-lg',!!opts.large);
    modal.classList.toggle('modal-sm',!!opts.small);
    document.body.classList.add('modal-open');
    const card=modal.querySelector('.modal-card');
    if(card) card.scrollTop=0;
    return true;
  }

  function openModalSafe(html,opts={}){
    let called=false;
    try{
      const fn=window.showModal || (typeof showModal==='function' ? showModal : null);
      if(typeof fn==='function'){
        fn(html,opts);
        called=true;
      }
    }catch(error){
      console.warn(`[${VERSION}] showModal failed`,error);
    }
    if(!called) forceModal(html,opts);
    else forceModal(null,opts);
    requestAnimationFrame(()=>forceModal(null,opts));
    setTimeout(()=>forceModal(null,opts),60);
  }

  function formatThaiDateSafe(date){
    try{
      const fn=window.formatThaiDate || (typeof formatThaiDate==='function' ? formatThaiDate : null);
      if(typeof fn==='function') return fn(date);
    }catch(_){}
    return date;
  }

  function openCalendar(date){
    const key=String(date||'').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
    try{
      const collect=window.collectCalendarEvents || (typeof collectCalendarEvents==='function' ? collectCalendarEvents : null);
      const all=typeof collect==='function' ? collect() : [];
      const rows=(Array.isArray(all)?all:[]).filter(row=>String(row?.date||'').slice(0,10)===key);
      const render=window.renderCalendarModalRow || (typeof renderCalendarModalRow==='function' ? renderCalendarModalRow : null);
      const body=rows.length
        ? rows.map(row=>{
            try{if(typeof render==='function') return render(row);}catch(_){}
            return `<div class="calendar-modal-row"><b>${esc(row?.title||'-')}</b></div>`;
          }).join('')
        : '<div class="empty-state">ไม่มีรายการในวันนี้</div>';
      openModalSafe(`<div class="v311-calendar-modal"><h2>${esc(formatThaiDateSafe(key))}</h2><div class="calendar-modal-list">${body}</div></div>`,{large:false});
    }catch(error){
      console.error(`[${VERSION}] calendar popup failed`,error);
      showToastSafe('เปิดรายละเอียด Calendar ไม่สำเร็จ กรุณารีเฟรชแล้วลองใหม่');
    }
  }

  function currentStaffIdSafe(){
    try{
      const fn=window.currentStaffId || (typeof currentStaffId==='function' ? currentStaffId : null);
      if(typeof fn==='function') return String(fn()||'');
    }catch(_){}
    const st=appState();
    return String(st?.profile?.staff_id || st?.user?.staff_id || st?.currentStaffId || '');
  }

  function isAdminSafe(){
    try{
      const fn=window.isAdmin || (typeof isAdmin==='function' ? isAdmin : null);
      if(typeof fn==='function') return !!fn();
    }catch(_){}
    const st=appState();
    return String(st?.role || st?.currentRole || '').toLowerCase()==='admin';
  }

  function scheduleMonthKey(){
    const st=appState();
    return String(document.getElementById('scheduleMonthInput')?.value || st?.monthKey || st?.scheduleMonthKey || '').slice(0,7);
  }

  function monthDates(key){
    try{
      const fn=window.scheduleMonthDates || (typeof scheduleMonthDates==='function' ? scheduleMonthDates : null);
      const rows=typeof fn==='function' ? fn(key) : [];
      if(Array.isArray(rows) && rows.length) return rows.map(x=>String(x).slice(0,10));
    }catch(_){}
    if(!/^\d{4}-\d{2}$/.test(key)) return [];
    const [year,month]=key.split('-').map(Number);
    const last=new Date(year,month,0).getDate();
    return Array.from({length:last},(_,i)=>`${key}-${String(i+1).padStart(2,'0')}`);
  }

  function rosterAssignments(key){
    try{
      const fn=window.scheduleAssignmentsForMonth || (typeof scheduleAssignmentsForMonth==='function' ? scheduleAssignmentsForMonth : null);
      const rows=typeof fn==='function' ? fn(key) : null;
      if(Array.isArray(rows)) return rows;
    }catch(_){}
    return (appState()?.rosterAssignments||[]).filter(row=>String(row?.duty_date||'').slice(0,7)===key);
  }

  function resolveStaffIdFromRow(row){
    const direct=row?.querySelector?.('[data-staff-stat]')?.getAttribute('data-staff-stat')
      || row?.querySelector?.('[data-staff-id]')?.getAttribute('data-staff-id');
    if(direct) return String(direct);
    const name=String(row?.children?.[0]?.textContent||'').replace(/\s+/g,' ').trim();
    if(!name) return '';
    const person=(appState()?.staff||[]).find(item=>{
      const nick=String(item?.nickname||'').trim();
      const full=String(item?.full_name||'').trim();
      return (nick && name.includes(nick)) || (full && name.includes(full));
    });
    return String(person?.id||'');
  }

  function resolveTradeId(button){
    const direct=String(button?.getAttribute?.('data-trade-duty')||'').trim();
    if(direct) return direct;
    const row=button?.closest?.('tr');
    const cell=button?.closest?.('td,th');
    if(!row || !cell) return '';
    const key=scheduleMonthKey();
    const dates=monthDates(key);
    if(!dates.length) return '';
    const children=Array.from(row.children||[]);
    const cellIndex=children.indexOf(cell);
    const frozenCount=Math.max(0,children.length-dates.length);
    const date=dates[cellIndex-frozenCount];
    const staffId=resolveStaffIdFromRow(row);
    if(!date || !staffId) return '';
    if(!isAdminSafe() && staffId!==currentStaffIdSafe()) return '';
    const candidates=rosterAssignments(key).filter(item=>
      String(item?.staff_id||'')===staffId && String(item?.duty_date||'').slice(0,10)===date
    );
    if(!candidates.length) return '';
    const text=String(button.textContent||'').replace(/\s+/g,'').trim();
    let match=candidates.find(item=>{
      let label=String(item?.duty_code||'');
      try{
        const fn=window.dutyDisplayLabel || (typeof dutyDisplayLabel==='function' ? dutyDisplayLabel : null);
        if(typeof fn==='function') label=String(fn(item?.duty_code)||label);
      }catch(_){}
      return label.replace(/\s+/g,'')===text;
    });
    if(!match){
      const pills=Array.from(cell.querySelectorAll('.clean-shift-pill,[data-trade-duty]'));
      const idx=Math.max(0,pills.indexOf(button));
      match=candidates[idx] || candidates[0];
    }
    const id=String(match?.id||'');
    if(id) button.setAttribute('data-trade-duty',id);
    return id;
  }

  function openTrade(button){
    const id=resolveTradeId(button);
    if(!id){
      showToastSafe('ไม่พบรายการเวรของช่องนี้ หรือเวรนี้ไม่ใช่เวรของผู้ใช้งาน');
      return;
    }
    try{
      const fn=window.showTradeModal || (typeof showTradeModal==='function' ? showTradeModal : null);
      if(typeof fn!=='function') throw new Error('ไม่พบฟังก์ชันขายเวร');
      fn(id);
      requestAnimationFrame(()=>forceModal(null,{large:false}));
      setTimeout(()=>forceModal(null,{large:false}),80);
    }catch(error){
      console.error(`[${VERSION}] trade popup failed`,error);
      showToastSafe('เปิดหน้าขายเวรไม่สำเร็จ กรุณารีเฟรชแล้วลองใหม่');
    }
  }

  function findPositionByCode(code, referenceDate=''){
    const value=String(code||'').trim();
    const st=appState();
    if(!value) return {};

    const sameCode=row=>String(row?.code || row?.position_code || '').trim()===value;
    const hasUsefulDetail=row=>!!String(
      row?.job_desc || row?.description || row?.main_rule || row?.break_time || row?.zone || ''
    ).trim();
    const mergeUseful=(fallback,preferred)=>{
      const result={...(fallback||{})};
      Object.entries(preferred||{}).forEach(([key,val])=>{
        if(val!==null && val!==undefined && String(val).trim()!=='') result[key]=val;
      });
      return result;
    };

    /* Monthly cells can point to generated slot codes such as BB-Manual 3.
       daily_positions rows only contain the assignment and must not hide the
       slot template that contains zone, break, rule and job description. */
    let master=null;
    for(const list of [st?.positionMasters,st?.dailyPositionMasters]){
      if(!Array.isArray(list)) continue;
      const found=list.find(sameCode);
      if(found){
        master=master || found;
        if(hasUsefulDetail(found)) break;
      }
    }

    let template=null;
    try{
      const monthKey=String(st?.positionMonthKey || st?.positionMonthViewKey || st?.monthKey || '').slice(0,7);
      const refDate=/^\d{4}-\d{2}-\d{2}$/.test(String(referenceDate||''))
        ? String(referenceDate).slice(0,10)
        : (/^\d{4}-\d{2}$/.test(monthKey) ? `${monthKey}-01` : undefined);
      try{
        if(refDate && window.cnmiV381?.templateFor) template=window.cnmiV381.templateFor(value,refDate)||null;
      }catch(_){}
      if(!template){
        const fn=window.positionTemplateByCode;
        if(typeof fn==='function') template=fn(value,refDate)||null;
      }
    }catch(_){}

    /* Current Slot configuration is authoritative; master is fallback only. */
    if(master || template) return mergeUseful(master,template);

    try{
      const fn=window.positionByCode;
      if(typeof fn==='function'){
        const found=fn(value);
        if(found && hasUsefulDetail(found)) return found;
      }
    }catch(_){}
    try{
      const list=window.DEFAULT_DAILY_POSITIONS || (typeof DEFAULT_DAILY_POSITIONS!=='undefined' ? DEFAULT_DAILY_POSITIONS : []);
      const found=(Array.isArray(list)?list:[]).find(sameCode);
      if(found) return found;
    }catch(_){}

    const assignment=Array.isArray(st?.positions) ? st.positions.find(sameCode) : null;
    return assignment || {};
  }

  function positionMonthKeySafe(){
    const st=appState();
    return String(
      document.getElementById('positionMonthViewInput')?.value
      || document.getElementById('positionMonthInput')?.value
      || st?.positionMonthViewKey
      || st?.positionMonthKey
      || st?.monthKey
      || ''
    ).slice(0,7);
  }

  function dateFromPositionButton(button){
    const direct=button?.closest?.('[data-date]')?.getAttribute?.('data-date');
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(direct||''))) return String(direct).slice(0,10);

    const cell=button?.closest?.('td');
    const row=button?.closest?.('tr');
    const key=positionMonthKeySafe();
    const dates=monthDates(key);
    if(!cell || !row || !dates.length) return '';
    const children=Array.from(row.children||[]);
    const index=children.indexOf(cell);
    const frozenCount=Math.max(0,children.length-dates.length);
    const date=dates[index-frozenCount] || '';
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
  }

  function openPosition(button){
    const code=String(button?.getAttribute?.('data-v275-job') || button?.getAttribute?.('data-v273-job-code') || '').trim();
    if(!code) return;
    const date=dateFromPositionButton(button);
    const row=findPositionByCode(code,date);
    const zone=row?.zone || '-';
    const breakTime=row?.break_time || '-';
    const rule=row?.main_rule || '-';
    const job=row?.job_desc || row?.description || 'ยังไม่ได้ระบุรายละเอียดหน้าที่';
    openModalSafe(`<div class="v311-position-modal"><h2>${esc(code)}</h2><div class="v311-position-meta"><span><small>โซน</small><b>${esc(zone)}</b></span><span><small>เวลาพัก</small><b>${esc(breakTime)}</b></span></div><div class="v311-position-box"><h3>ผู้ปฏิบัติหลัก / เงื่อนไข</h3><p>${esc(rule)}</p></div><div class="v311-position-box"><h3>รายละเอียดหน้าที่</h3><p>${esc(job)}</p></div></div>`,{large:false});
  }

  function actionFor(target){
    if(target?.nodeType===3) target=target.parentElement;
    if(!target?.closest) return null;
    const calendar=target.closest('[data-day-detail]');
    if(calendar) return {type:'calendar',node:calendar,key:`calendar:${calendar.getAttribute('data-day-detail')||''}`};
    const position=target.closest('[data-v275-job],[data-v273-job-code]');
    if(position){
      const code=position.getAttribute('data-v275-job') || position.getAttribute('data-v273-job-code') || '';
      const date=dateFromPositionButton(position);
      return {type:'position',node:position,key:`position:${code}:${date||'-'}`};
    }
    const trade=target.closest('[data-trade-duty],#scheduleTable .clean-shift-pill,.clean-schedule-grid .clean-shift-pill');
    if(trade) return {type:'trade',node:trade,key:`trade:${trade.getAttribute('data-trade-duty')||trade.textContent||''}`};
    return null;
  }

  function runAction(event,action){
    if(!action) return false;
    const now=Date.now();
    if(action.key===lastAction && now-lastActionAt<700){
      stop(event);
      return true;
    }
    lastAction=action.key;
    lastActionAt=now;
    window.__CNMI_LAST_POPUP_ACTION__={key:action.key,at:now};
    stop(event);
    if(action.type==='calendar') openCalendar(action.node.getAttribute('data-day-detail'));
    else if(action.type==='position') openPosition(action.node);
    else if(action.type==='trade') openTrade(action.node);
    return true;
  }

  /* Use touch events because older pointer/click handlers can swallow iOS taps. */
  document.addEventListener('touchstart',event=>{
    const action=actionFor(event.target);
    if(!action) return;
    const touch=event.changedTouches?.[0];
    if(!touch) return;
    touchStarts.set(touch.identifier,{x:touch.clientX,y:touch.clientY,action,moved:false});
  },{capture:true,passive:true});

  document.addEventListener('touchmove',event=>{
    for(const touch of Array.from(event.changedTouches||[])){
      const start=touchStarts.get(touch.identifier);
      if(!start) continue;
      if(Math.hypot(touch.clientX-start.x,touch.clientY-start.y)>14) start.moved=true;
    }
  },{capture:true,passive:true});

  document.addEventListener('touchend',event=>{
    const touch=event.changedTouches?.[0];
    if(!touch) return;
    const start=touchStarts.get(touch.identifier);
    touchStarts.delete(touch.identifier);
    if(!start || start.moved) return;
    const current=actionFor(document.elementFromPoint(touch.clientX,touch.clientY)) || start.action;
    if(current) runAction(event,current);
  },{capture:true,passive:false});

  document.addEventListener('touchcancel',event=>{
    for(const touch of Array.from(event.changedTouches||[])) touchStarts.delete(touch.identifier);
  },{capture:true,passive:true});

  /* Desktop fallback without relying on the older click chain. */
  document.addEventListener('mousedown',event=>{
    if(event.button!==0) return;
    const action=actionFor(event.target);
    if(action) runAction(event,action);
  },true);

  /* PWA/browser fallback: some WebKit builds do not dispatch the older chain consistently. */
  document.addEventListener('pointerup',event=>{
    if(event.pointerType==='mouse') return;
    const action=actionFor(event.target);
    if(action) runAction(event,action);
  },true);

  document.addEventListener('click',event=>{
    const action=actionFor(event.target);
    if(action) runAction(event,action);
  },true);

  document.addEventListener('keydown',event=>{
    if(event.key!=='Enter' && event.key!==' ') return;
    const action=actionFor(event.target);
    if(action) runAction(event,action);
  },true);

  function dailyRows(){
    if(Array.isArray(window.__CNMI_V226_DAILY_POSITION_ROWS__)) return window.__CNMI_V226_DAILY_POSITION_ROWS__;
    if(Array.isArray(window.__CNMI_V225_DAILY_POSITION_ROWS__)) return window.__CNMI_V225_DAILY_POSITION_ROWS__;
    return [];
  }

  function removeObsoleteCh4(root=document){
    root.querySelectorAll?.('.v234-ch4-shared-card,.v209-admin-ch4-card').forEach(node=>node.remove());
    root.querySelectorAll?.('.card').forEach(card=>{
      const heading=String(card.querySelector('h1,h2,h3,h4')?.textContent||'').replace(/\s+/g,' ').trim();
      const text=String(card.textContent||'').replace(/\s+/g,' ').trim();
      if(/^สถานะ\s*ช4\s*\/\s*งานปั่นเลือด(?:\s*รายเดือน)?$/i.test(heading)
        || (/สถานะ\s*ช4\s*\/\s*งานปั่นเลือด/i.test(text) && /SQL\s*V209|SQL\s*V234/i.test(text))){
        card.remove();
      }
    });
  }

  function removeOldTraineeNotes(panel){
    panel?.querySelectorAll?.('.v308-trainee-note,.v309-trainee-note,.v311-trainee-note').forEach(node=>node.remove());
  }

  function numberFrom(node){
    const match=String(node?.textContent||'').match(/\d+/);
    return match?Number(match[0]):0;
  }

  function repairDailySummary(root=document){
    const panel=root.querySelector?.('.v225-daily-compare-panel,.v226-daily-compare-panel');
    if(!panel) return;
    const cards=panel.querySelector('.v225-compare-cards');
    if(!cards) return;

    removeOldTraineeNotes(panel);
    panel.querySelectorAll('.v225-daily-slot-toolbar .hint').forEach(node=>node.remove());

    const originalText=String(cards.textContent||'');
    if(/คนเข้าร่วมออกหน่วย|Slot ชุดออกหน่วย/.test(originalText)) return;

    const oldItems=Array.from(cards.children||[]);
    const total=oldItems.length ? numberFrom(oldItems[0].querySelector('b,strong')) : 0;
    const rows=dailyRows();
    const baseRows=rows.filter(row=>row?._source!=='extra-plan');
    const fallbackSlots=baseRows.length;
    const originalPlan=oldItems.length>=5 ? numberFrom(oldItems[2].querySelector('b,strong')) : 0;
    const originalSlots=oldItems.length>=5 ? numberFrom(oldItems[3].querySelector('b,strong')) : 0;
    const slotCount=originalSlots || fallbackSlots;
    const filledCount=baseRows.filter(row=>String(row?.staff_id || row?._planned_staff_id || '').trim()).length;
    const counted=Math.min(slotCount,Math.max(originalPlan,filledCount,slotCount||0));
    const diff=counted-slotCount;

    cards.className='v225-compare-cards v311-summary-cards';
    const nextHtml=`<div><b>${total}</b><span>คนอยู่จริงทั้งหมด</span></div><div><b>${counted}/${slotCount}</b><span>คน/Slot วันนี้</span></div><div class="${diff<0?'warn':diff>0?'info':'ok'}"><b>${diff===0?'พอดี':diff>0?`เกิน ${diff}`:`ขาด ${Math.abs(diff)}`}</b><span>สถานะกำลังคน</span></div>`;
    if(cards.innerHTML!==nextHtml) cards.innerHTML=nextHtml;
  }

  function dailyJobText(card,row){
    const select=card?.querySelector?.('select[data-position-row],select[data-position-job]');
    const code=String(row?.position_code || row?.code || select?.dataset?.positionCode || '').trim();
    const direct=String(row?.job_desc || row?.description || select?.dataset?.positionJob || '').trim();
    if(direct) return direct;
    const master=findPositionByCode(code)||{};
    return String(master?.job_desc || master?.description || '').trim() || 'ยังไม่ได้ระบุรายละเอียดหน้าที่';
  }

  function keepDailyDutyText(root=document){
    const page=root.querySelector?.('.v225-positions-page,.v226-positions-page');
    if(!page) return;
    const rows=dailyRows();
    const cards=Array.from(page.querySelectorAll('.v225-mobile-position-list > .position-mobile-card,.v225-mobile-position-list > .v225-position-card'));
    cards.forEach((card,index)=>{
      const row=rows[index]||{};
      const job=dailyJobText(card,row);
      let preview=card.querySelector(':scope > .v311-position-duty-preview');
      const duplicate=card.querySelector(':scope > .v296-position-duty-preview');
      if(duplicate) duplicate.remove();
      if(!preview){
        preview=document.createElement('div');
        preview.className='v311-position-duty-preview';
      }
      const html=`<b>หน้าที่:</b><span>${esc(job)}</span>`;
      if(preview.innerHTML!==html) preview.innerHTML=html;
      const baseline=card.querySelector(':scope > .v322-baseline-box');
      const label=card.querySelector(':scope > label');
      const actions=card.querySelector(':scope > .actions');
      const anchor=baseline || label || actions;
      if(anchor && preview.nextElementSibling!==anchor) card.insertBefore(preview,anchor);
      else if(!anchor && preview.parentElement!==card) card.appendChild(preview);
    });
    page.querySelectorAll('[data-v296-position-detail],[data-v226-position-detail],[data-v225-position-detail],[data-position-detail-v219]').forEach(button=>{
      const actions=button.closest('.actions');
      button.remove();
      if(actions && !actions.querySelector('button,a,input,select,textarea')) actions.remove();
    });
    page.querySelectorAll('.v225-job-short,.v219-job-short').forEach(node=>{
      node.classList.remove('v265-description-hidden');
      node.style.removeProperty('display');
    });
  }

  function enhance(root=document){
    removeObsoleteCh4(root);
    repairDailySummary(root);
    keepDailyDutyText(root);
  }

  function queueEnhance(){
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      enhance(document);
    });
  }

  const style=document.createElement('style');
  style.id='v311-mobile-popup-daily-summary-style';
  style.textContent=`
    .v234-ch4-shared-card,.v209-admin-ch4-card{display:none!important}
    .v311-summary-cards{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important}
    .v311-summary-cards>div{min-width:0}
    .v311-position-duty-preview{margin-top:12px;padding:12px 13px;border:1px solid #d6e7f7;border-radius:14px;background:#f7fbff;color:#334155;line-height:1.6}
    .v311-position-duty-preview b{display:block;color:#17324d;margin-bottom:4px}
    .v311-position-duty-preview span{display:block;white-space:pre-wrap;overflow-wrap:anywhere}
    .v311-position-modal h2,.v311-calendar-modal h2{margin:0 0 14px}
    .v311-position-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:12px}
    .v311-position-meta>span,.v311-position-box{padding:13px;border:1px solid #dbe7f3;border-radius:15px;background:#f8fbff}
    .v311-position-meta small{display:block;color:#64748b;margin-bottom:3px}
    .v311-position-box{margin-top:10px;background:#fff}
    .v311-position-box h3{margin:0 0 6px;color:#17324d}
    .v311-position-box p{margin:0;white-space:pre-wrap;line-height:1.65;color:#334155}
    @media(max-width:520px){
      .v311-summary-cards{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      .v311-summary-cards>div:last-child{grid-column:1/-1}
      .v311-position-meta{grid-template-columns:1fr}
    }
  `;
  document.head.appendChild(style);

  function installObserver(){
    const target=document.getElementById('pageContent') || document.body || document.documentElement;
    if(target && !target.__v323PopupDailyObserver){
      const observer=new MutationObserver(queueEnhance);
      observer.observe(target,{childList:true,subtree:true});
      target.__v323PopupDailyObserver=observer;
    }
    queueEnhance();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',installObserver,{once:true});
  else installObserver();
  window.addEventListener('pageshow',queueEnhance);

  window.cnmiV311={enhance,openCalendar,openTrade,openPosition,repairDailySummary,keepDailyDutyText,removeObsoleteCh4,findPositionByCode,dateFromPositionButton};
  console.info(`[${VERSION}] loaded`);
})();

} catch (error) { console.error("[v569] patch-v311-mobile-popup-daily-summary-fix.js", error); }
;

/* Original source: pwa-install-v556.js */
try {
/* CNMI Staff Planner PWA registration + install prompt — V556 */
(() => {
  'use strict';

  const scriptBaseUrl = document.currentScript
    ? new URL('.', document.currentScript.src)
    : new URL('./', window.location.href);

  let deferredInstallPrompt = null;
  let registrationReady = false;
  const installButtons = new Set();

  const isStandalone = () => (
    window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.navigator.standalone === true
  );
  const isAndroid = () => /Android/i.test(navigator.userAgent || '');
  const isIOS = () => /iPad|iPhone|iPod/i.test(navigator.userAgent || '')
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function pruneButtons() {
    installButtons.forEach((button) => {
      if (!button.isConnected) installButtons.delete(button);
    });
  }

  function setButtonsVisible(visible) {
    pruneButtons();
    installButtons.forEach((button) => {
      button.classList.toggle('hidden', !visible);
      button.disabled = false;
      button.setAttribute('aria-hidden', visible ? 'false' : 'true');
    });
  }

  function setButtonsBusy(busy, label) {
    pruneButtons();
    installButtons.forEach((button) => {
      button.disabled = busy;
      const labelNode = button.querySelector('[data-pwa-label]');
      if (label && labelNode) labelNode.textContent = label;
    });
  }

  function createButton(extraClass = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `pwa-install-btn ${extraClass}`.trim();
    button.innerHTML = '<span aria-hidden="true">⬇️</span><span data-pwa-label>ติดตั้งแอป</span>';
    button.addEventListener('click', handleInstallClick);
    installButtons.add(button);
    return button;
  }

  function ensureAuthButton() {
    const authCard = document.querySelector('.auth-card');
    if (!authCard || authCard.querySelector('[data-cnmi-pwa-auth-install="v556"]')) return;
    const wrapper = document.createElement('div');
    wrapper.dataset.cnmiPwaAuthInstall = 'v556';
    wrapper.className = 'pwa-install-auth-wrap';
    const button = createButton('pwa-install-btn--auth');
    const note = document.createElement('p');
    note.className = 'pwa-install-note';
    note.textContent = 'ติดตั้งแล้วเปิดเต็มหน้าจอเหมือนแอป';
    wrapper.append(button, note);
    const loginForm = authCard.querySelector('#loginForm, form.auth-panel');
    if (loginForm) authCard.insertBefore(wrapper, loginForm);
    else authCard.appendChild(wrapper);
  }

  function ensureMenuButton() {
    const sidebarFoot = document.querySelector('.sidebar-foot');
    if (!sidebarFoot || sidebarFoot.querySelector('[data-cnmi-pwa-menu-install="v556"]')) return;
    const button = createButton('pwa-install-btn--menu');
    button.dataset.cnmiPwaMenuInstall = 'v556';
    sidebarFoot.insertBefore(button, sidebarFoot.firstChild);
  }

  function ensureInstallUI() {
    createModal();
    ensureAuthButton();
    ensureMenuButton();
    setButtonsVisible(!isStandalone());
  }

  function createModal() {
    if (document.getElementById('pwaInstallModalV556')) return;
    const modal = document.createElement('div');
    modal.id = 'pwaInstallModalV556';
    modal.className = 'pwa-install-modal hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'pwaInstallTitleV556');
    modal.innerHTML = `
      <div class="pwa-install-dialog">
        <button type="button" class="pwa-install-close" aria-label="ปิด">×</button>
        <h3 id="pwaInstallTitleV556">ติดตั้ง CNMI Staff Planner</h3>
        <div data-pwa-instructions></div>
      </div>`;
    modal.querySelector('.pwa-install-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
    document.body.appendChild(modal);
  }

  function showModal(html) {
    createModal();
    const modal = document.getElementById('pwaInstallModalV556');
    if (!modal) return;
    modal.querySelector('[data-pwa-instructions]').innerHTML = html;
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function closeModal() {
    const modal = document.getElementById('pwaInstallModalV556');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  async function handleInstallClick() {
    if (isStandalone()) {
      setButtonsVisible(false);
      return;
    }

    if (deferredInstallPrompt) {
      setButtonsBusy(true, 'กำลังเปิดหน้าติดตั้ง…');
      try {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        if (choice?.outcome === 'accepted') setButtonsBusy(true, 'กำลังติดตั้ง…');
        else setButtonsBusy(false, 'ติดตั้งแอป');
      } catch (error) {
        console.warn('[PWA V556] Install prompt failed:', error);
        setButtonsBusy(false, 'ติดตั้งแอป');
        showManualInstructions();
      }
      return;
    }

    if (!registrationReady && 'serviceWorker' in navigator) {
      setButtonsBusy(true, 'กำลังเตรียมแอป…');
      try {
        await navigator.serviceWorker.ready;
        registrationReady = true;
      } catch (_) {}
      setButtonsBusy(false, 'ติดตั้งแอป');
    }
    showManualInstructions();
  }

  function showManualInstructions() {
    if (isAndroid()) {
      showModal(`
        <p>หากหน้าต่างติดตั้งไม่เด้ง ให้ทำตามนี้:</p>
        <ol>
          <li>เปิดด้วย <strong>Google Chrome</strong></li>
          <li>แตะเมนู <strong>⋮</strong></li>
          <li>เลือก <strong>ติดตั้งแอป</strong> หรือ <strong>เพิ่มไปยังหน้าจอหลัก</strong></li>
          <li>แตะ <strong>ติดตั้ง</strong></li>
        </ol>`);
      return;
    }
    if (isIOS()) {
      showModal(`
        <p>บน iPhone/iPad ให้เปิดด้วย Safari:</p>
        <ol>
          <li>แตะปุ่ม <strong>แชร์</strong></li>
          <li>เลือก <strong>เพิ่มไปยังหน้าจอโฮม</strong></li>
          <li>แตะ <strong>เพิ่ม</strong></li>
        </ol>`);
      return;
    }
    showModal('<p>เปิดเมนู Browser แล้วเลือก <strong>ติดตั้งแอป</strong> หรือกดไอคอนติดตั้งที่แถบที่อยู่</p>');
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const workerUrl = new URL('sw.js?v=556', scriptBaseUrl);
      const registration = await navigator.serviceWorker.register(workerUrl.href, {
        scope: scriptBaseUrl.pathname,
        updateViaCache: 'none'
      });
      registrationReady = true;

      const activateWaiting = () => {
        try { registration.waiting?.postMessage({ type: 'SKIP_WAITING' }); } catch (_) {}
      };
      activateWaiting();
      if (registration.installing) {
        registration.installing.addEventListener('statechange', activateWaiting);
      }
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (installing) installing.addEventListener('statechange', activateWaiting);
      });

      console.info('[PWA V556] Service Worker registered:', registration.scope);
    } catch (error) {
      console.warn('[PWA V556] Service Worker registration failed:', error);
    }
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    ensureInstallUI();
    setButtonsVisible(!isStandalone());
    setButtonsBusy(false, 'ติดตั้งแอป');
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    setButtonsVisible(false);
    closeModal();
  });

  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', (event) => {
    if (event.matches) setButtonsVisible(false);
  });

  document.addEventListener('DOMContentLoaded', () => {
    ensureInstallUI();
    registerServiceWorker();
    const observer = new MutationObserver(() => ensureInstallUI());
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();

} catch (error) { console.error("[v569] pwa-install-v556.js", error); }
;

/* Original source: patch-v313-app-count-filter-pwa-trade-fix.js */
try {
/* CNMI Staff Planner V313
   Targeted app-only repair. No database/schema changes.
   1) Daily daytime-position summary counts only staff who count toward today's Slot.
   2) Mentor history defaults to usable/current records and can be filtered by status.
   3) Admin leave page defaults to pending cancellation approval and removes obsolete notices.
   4) Full-month roster duty pills reliably open the sell-duty / HR OT modal in installed PWA/mobile.
   5) Keeps V312 daily-card and monthly-position description repairs.
*/
(function(){
  'use strict';

  const VERSION='V313_APP_TARGETED_COUNT_FILTER_PWA_FIX';
  if(window.__CNMI_V313_APP_TARGETED_POSITION_TRADE_FIX__) return;
  window.__CNMI_V313_APP_TARGETED_POSITION_TRADE_FIX__=true;

  let queued=false;
  let lastTouchAction='';
  let lastTouchAt=0;
  const pointerStarts=new Map();

  function S(){
    try{return state || window.state || null;}
    catch(_){return window.state || null;}
  }

  function esc(value){
    try{
      const fn=window.escapeHtml || (typeof escapeHtml==='function' ? escapeHtml : null);
      if(typeof fn==='function') return fn(value==null?'':String(value));
    }catch(_){}
    return String(value==null?'':value).replace(/[&<>"']/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }

  function normDate(value){
    try{
      const fn=window.normalizeDateKey || (typeof normalizeDateKey==='function' ? normalizeDateKey : null);
      if(typeof fn==='function') return String(fn(value)||'').slice(0,10);
    }catch(_){}
    return String(value||'').slice(0,10);
  }

  function stop(event){
    try{event.preventDefault();}catch(_){}
    try{event.stopPropagation();}catch(_){}
    try{event.stopImmediatePropagation?.();}catch(_){}
  }

  function toast(message){
    try{
      const fn=window.showToast || (typeof showToast==='function' ? showToast : null);
      if(typeof fn==='function') return fn(message,{tone:'error'});
    }catch(_){}
    console.error(`[${VERSION}] ${message}`);
  }

  function forceModal(){
    const modal=document.getElementById('modal');
    const body=document.getElementById('modalBody');
    if(!modal || !body || !String(body.innerHTML||'').trim()) return;
    try{
      if(window.__modalCloseTimerV193){
        clearTimeout(window.__modalCloseTimerV193);
        window.__modalCloseTimerV193=null;
      }
    }catch(_){}
    modal.classList.remove('hidden','modal-closing');
    modal.classList.add('modal-ready');
    document.body.classList.add('modal-open');
    const card=modal.querySelector('.modal-card');
    if(card) card.scrollTop=0;
  }

  function currentStaffId(){
    try{
      const fn=window.currentStaffId || (typeof currentStaffId==='function' ? currentStaffId : null);
      if(typeof fn==='function') return String(fn()||'');
    }catch(_){}
    const st=S();
    return String(st?.profile?.staff_id || st?.profile?.id || st?.user?.staff_id || st?.currentStaffId || '');
  }

  function isAdmin(){
    try{
      const fn=window.isAdmin || (typeof isAdmin==='function' ? isAdmin : null);
      if(typeof fn==='function') return !!fn();
    }catch(_){}
    const st=S();
    return String(st?.role || st?.currentRole || '').toLowerCase()==='admin';
  }

  function monthKey(){
    const st=S();
    const input=document.getElementById('scheduleMonthInput');
    return String(input?.value || st?.positionMonthViewKey || st?.positionMonthKey || st?.monthKey || '').slice(0,7);
  }

  function monthDates(key=monthKey()){
    try{
      const fn=window.scheduleMonthDates || (typeof scheduleMonthDates==='function' ? scheduleMonthDates : null);
      const result=typeof fn==='function' ? fn(key) : null;
      if(Array.isArray(result) && result.length) return result.map(normDate);
    }catch(_){}
    if(!/^\d{4}-\d{2}$/.test(key)) return [];
    const [year,month]=key.split('-').map(Number);
    const last=new Date(year,month,0).getDate();
    return Array.from({length:last},(_,index)=>`${key}-${String(index+1).padStart(2,'0')}`);
  }

  function dailyRows(){
    if(Array.isArray(window.__CNMI_V226_DAILY_POSITION_ROWS__)) return window.__CNMI_V226_DAILY_POSITION_ROWS__;
    if(Array.isArray(window.__CNMI_V225_DAILY_POSITION_ROWS__)) return window.__CNMI_V225_DAILY_POSITION_ROWS__;
    return [];
  }

  function numberFrom(node){
    const match=String(node?.textContent||'').match(/\d+/);
    return match ? Number(match[0]) : 0;
  }

  function removeObsoleteCh4(root=document){
    root.querySelectorAll?.('.v234-ch4-shared-card,.v209-admin-ch4-card').forEach(node=>node.remove());
    root.querySelectorAll?.('.card').forEach(card=>{
      const heading=String(card.querySelector('h1,h2,h3,h4')?.textContent||'').replace(/\s+/g,' ').trim();
      const text=String(card.textContent||'').replace(/\s+/g,' ').trim();
      if(/^สถานะ\s*ช4\s*\/\s*งานปั่นเลือด(?:\s*รายเดือน)?$/i.test(heading)
        || (/สถานะ\s*ช4\s*\/\s*งานปั่นเลือด/i.test(text) && /SQL\s*V209|SQL\s*V234/i.test(text))){
        card.remove();
      }
    });
  }

  function ratioFrom(node){
    const match=String(node?.textContent||'').match(/(\d+)\s*\/\s*(\d+)/);
    return match ? [Number(match[1]),Number(match[2])] : null;
  }

  function repairDailySummary(root=document){
    const panel=root.querySelector?.('.v225-daily-compare-panel,.v226-daily-compare-panel');
    if(!panel) return;
    const cards=panel.querySelector('.v225-compare-cards');
    if(!cards) return;

    panel.querySelectorAll('.v308-trainee-note,.v309-trainee-note,.v311-trainee-note,.v313-trainee-note').forEach(node=>node.remove());
    panel.querySelectorAll('.v225-daily-slot-toolbar .hint').forEach(node=>node.remove());

    const text=String(cards.textContent||'');
    if(/คนเข้าร่วมออกหน่วย|Slot ชุดออกหน่วย/.test(text)) return;

    const oldItems=Array.from(cards.children||[]);
    const rows=dailyRows();
    const baseRows=rows.filter(row=>row?._source!=='extra-plan');
    const ratio=oldItems.length>=2 ? ratioFrom(oldItems[1]) : null;
    const countedFromOriginal=oldItems.length>=5
      ? numberFrom(oldItems[1].querySelector('b,strong'))
      : (ratio ? ratio[0] : null);
    const slotsFromOriginal=oldItems.length>=5
      ? numberFrom(oldItems[3].querySelector('b,strong'))
      : (ratio ? ratio[1] : null);
    const uniqueAssigned=new Set(baseRows.map(row=>String(row?.staff_id || row?._planned_staff_id || '').trim()).filter(Boolean)).size;
    const slotCount=Number.isFinite(slotsFromOriginal) && slotsFromOriginal>0 ? slotsFromOriginal : baseRows.length;
    const counted=Number.isFinite(countedFromOriginal) ? countedFromOriginal : uniqueAssigned;
    // ผู้ฝึก/Intern ที่อยู่กับพี่เลี้ยงไม่ใช่กำลังคนหลักของ Slot จึงไม่บวกในยอด "คนอยู่จริงทั้งหมด" อีกครั้ง
    const total=counted;
    const diff=counted-slotCount;
    const html=`<div><b>${total}</b><span>คนอยู่จริงทั้งหมด</span></div><div><b>${counted}/${slotCount}</b><span>คน/Slot วันนี้</span></div><div class="${diff<0?'warn':diff>0?'info':'ok'}"><b>${diff===0?'พอดี':diff>0?`เกิน ${diff}`:`ขาด ${Math.abs(diff)}`}</b><span>สถานะกำลังคน</span></div>`;

    cards.className='v225-compare-cards v313-summary-cards';
    if(cards.innerHTML!==html) cards.innerHTML=html;
  }

  function dutyPreviewHtml(job){
    return `<b>หน้าที่:</b><span>${esc(job)}</span>`;
  }

  function keepDailyDutyText(root=document){
    const page=root.querySelector?.('.v225-positions-page,.v226-positions-page');
    if(!page) return;
    const rows=dailyRows();
    const cards=Array.from(page.querySelectorAll('.position-mobile-card.v225-position-card,.position-mobile-card'));

    cards.forEach((card,index)=>{
      const detailButton=card.querySelector('[data-v296-position-detail],[data-v226-position-detail],[data-v225-position-detail],[data-position-detail-v219]');
      const rawIndex=detailButton?.getAttribute('data-v296-position-detail')
        ?? detailButton?.getAttribute('data-v226-position-detail')
        ?? detailButton?.getAttribute('data-v225-position-detail')
        ?? detailButton?.getAttribute('data-position-detail-v219');
      const row=rows[Number.isFinite(Number(rawIndex)) ? Number(rawIndex) : index] || rows[index] || {};
      const job=String(row?.job_desc || row?.description || '').trim() || 'ยังไม่ได้ระบุรายละเอียดหน้าที่';
      const html=dutyPreviewHtml(job);

      let preview=card.querySelector('.v313-position-duty-preview');
      if(!preview){
        preview=document.createElement('div');
        preview.className='v313-position-duty-preview';
        const actions=card.querySelector('.actions');
        if(actions) actions.insertAdjacentElement('beforebegin',preview);
        else card.appendChild(preview);
      }
      if(preview.innerHTML!==html) preview.innerHTML=html;

      card.querySelectorAll('.v296-position-duty-preview,.v311-position-duty-preview').forEach(node=>node.remove());
      card.querySelectorAll('[data-v296-position-detail],[data-v226-position-detail],[data-v225-position-detail],[data-position-detail-v219]').forEach(button=>{
        const actions=button.closest('.actions');
        button.remove();
        if(actions && !actions.querySelector('button,a,input,select,textarea')) actions.remove();
      });
    });

    page.querySelectorAll('.v225-job-short,.v219-job-short').forEach(node=>{
      node.classList.remove('v265-description-hidden');
      node.style.removeProperty('display');
    });
  }

  function rosterAssignments(key=monthKey()){
    try{
      const fn=window.scheduleAssignmentsForMonth || (typeof scheduleAssignmentsForMonth==='function' ? scheduleAssignmentsForMonth : null);
      const rows=typeof fn==='function' ? fn(key) : null;
      if(Array.isArray(rows)) return rows;
    }catch(_){}
    return (S()?.rosterAssignments||[]).filter(row=>normDate(row?.duty_date).startsWith(key));
  }

  function dutySort(code){
    try{
      const fn=window.dutySortIndex || (typeof dutySortIndex==='function' ? dutySortIndex : null);
      if(typeof fn==='function') return Number(fn(code))||0;
    }catch(_){}
    return String(code||'');
  }

  function dutyLabel(code){
    try{
      const fn=window.dutyDisplayLabel || (typeof dutyDisplayLabel==='function' ? dutyDisplayLabel : null);
      if(typeof fn==='function') return String(fn(code)||code||'');
    }catch(_){}
    return String(code||'');
  }

  function resolveStaffIdFromRow(row){
    const direct=row?.querySelector?.('[data-staff-stat]')?.getAttribute('data-staff-stat')
      || row?.querySelector?.('[data-staff-id]')?.getAttribute('data-staff-id');
    if(direct) return String(direct);
    const name=String(row?.children?.[0]?.textContent||'').replace(/\s+/g,' ').trim();
    if(!name) return '';
    const person=(S()?.staff||[]).find(item=>{
      const nick=String(item?.nickname||'').trim();
      const full=String(item?.full_name||'').trim();
      return (nick && name.includes(nick)) || (full && name.includes(full));
    });
    return String(person?.id||'');
  }

  function canOpenTrade(assignment){
    if(!assignment?.id || !assignment?.staff_id) return false;
    if(isAdmin()) return true;
    return String(assignment.staff_id)===currentStaffId();
  }

  function resolveTradeAssignmentForPill(pill){
    if(!pill?.closest) return null;
    const existingId=String(pill.getAttribute('data-v313-trade-id') || pill.getAttribute('data-trade-duty') || '').trim();
    const key=String(document.getElementById('scheduleMonthInput')?.value || S()?.monthKey || '').slice(0,7);
    const dates=monthDates(key);
    const row=pill.closest('tr');
    const cell=pill.closest('td');
    const staffId=resolveStaffIdFromRow(row);
    if(!row || !cell || !staffId || !dates.length) return null;
    const cells=Array.from(row.children||[]);
    const frozenCount=Math.max(0,cells.length-dates.length);
    const dateIndex=cells.indexOf(cell)-frozenCount;
    const date=dates[dateIndex] || '';
    if(!date) return null;
    const candidates=rosterAssignments(key).filter(item=>
      String(item?.staff_id||'')===staffId && normDate(item?.duty_date)===date
    ).sort((a,b)=>{
      const ai=dutySort(a?.duty_code),bi=dutySort(b?.duty_code);
      return typeof ai==='number'&&typeof bi==='number' ? ai-bi : String(ai).localeCompare(String(bi));
    });
    let assignment=existingId ? candidates.find(item=>String(item?.id||'')===existingId) : null;
    if(!assignment){
      const label=String(pill.textContent||'').replace(/\s+/g,'').trim();
      assignment=candidates.find(item=>dutyLabel(item?.duty_code).replace(/\s+/g,'')===label) || candidates[0] || null;
    }
    if(!canOpenTrade(assignment)) return null;
    const id=String(assignment.id);
    pill.setAttribute('data-trade-duty',id);
    pill.setAttribute('data-v313-trade-id',id);
    pill.classList.add('v313-trade-ready');
    pill.setAttribute('title','แตะเพื่อขายเวร / เบิก OT ผ่าน HR');
    pill.setAttribute('role','button');
    if(!pill.hasAttribute('tabindex')) pill.setAttribute('tabindex','0');
    return assignment;
  }

  function repairFullMonthTradeTargets(root=document){
    const table=root.querySelector?.('.clean-schedule-page #scheduleTable.clean-schedule-grid,.clean-schedule-page #scheduleTable');
    if(!table) return;
    const key=String(document.getElementById('scheduleMonthInput')?.value || S()?.monthKey || '').slice(0,7);
    const dates=monthDates(key);
    if(!dates.length) return;
    const assignments=rosterAssignments(key);

    table.querySelectorAll('tbody tr').forEach(row=>{
      const staffId=resolveStaffIdFromRow(row);
      if(!staffId) return;
      const cells=Array.from(row.children||[]);
      const frozenCount=Math.max(0,cells.length-dates.length);
      dates.forEach((date,dateIndex)=>{
        const cell=cells[frozenCount+dateIndex];
        if(!cell) return;
        const candidates=assignments.filter(item=>
          String(item?.staff_id||'')===staffId && normDate(item?.duty_date)===date
        ).sort((a,b)=>{
          const ai=dutySort(a?.duty_code),bi=dutySort(b?.duty_code);
          return typeof ai==='number'&&typeof bi==='number' ? ai-bi : String(ai).localeCompare(String(bi));
        });
        const used=new Set();
        const pills=Array.from(cell.querySelectorAll('.clean-shift-pill'));
        pills.forEach((pill,pillIndex)=>{
          if(pill.classList.contains('v217-received')) return;
          let id=String(pill.getAttribute('data-trade-duty')||'').trim();
          let assignment=id ? candidates.find(item=>String(item?.id||'')===id) : null;
          if(!assignment){
            const label=String(pill.textContent||'').replace(/\s+/g,'').trim();
            assignment=candidates.find(item=>!used.has(String(item?.id||'')) && dutyLabel(item?.duty_code).replace(/\s+/g,'')===label)
              || candidates.find(item=>!used.has(String(item?.id||'')))
              || candidates[pillIndex]
              || candidates[0];
          }
          if(!canOpenTrade(assignment)) return;
          id=String(assignment.id);
          used.add(id);
          pill.setAttribute('data-trade-duty',id);
          pill.setAttribute('data-v313-trade-id',id);
          pill.classList.add('v313-trade-ready');
          pill.setAttribute('title','แตะเพื่อขายเวร / เบิก OT ผ่าน HR');
          pill.setAttribute('role','button');
          if(!pill.hasAttribute('tabindex')) pill.setAttribute('tabindex','0');
        });
      });
    });
  }

  function openTrade(id){
    const assignmentId=String(id||'').trim();
    if(!assignmentId){
      toast('ไม่พบรายการเวรของช่องนี้ กรุณารีเฟรชแล้วลองใหม่');
      return;
    }
    const input=document.getElementById('scheduleMonthInput');
    if(input?.value && S() && String(S().monthKey||'')!==String(input.value)) S().monthKey=input.value;
    try{
      const fn=window.showTradeModal || (typeof showTradeModal==='function' ? showTradeModal : null);
      if(typeof fn!=='function') throw new Error('ไม่พบฟังก์ชันขายเวร');
      fn(assignmentId);
      requestAnimationFrame(forceModal);
      setTimeout(forceModal,60);
      setTimeout(forceModal,180);
    }catch(error){
      console.error(`[${VERSION}] trade modal`,error);
      toast('เปิดหน้าขายเวรไม่สำเร็จ กรุณารีเฟรชแล้วลองใหม่');
    }
  }

  function isWeekendOrHoliday(date){
    try{
      const weekend=typeof window.isWeekend==='function' ? window.isWeekend(date) : (typeof isWeekend==='function' ? isWeekend(date) : false);
      const holiday=typeof window.isHolidayDate==='function' ? window.isHolidayDate(date) : (typeof isHolidayDate==='function' ? isHolidayDate(date) : false);
      return !!(weekend||holiday);
    }catch(_){}
    const d=new Date(`${date}T00:00:00`);
    return d.getDay()===0 || d.getDay()===6;
  }

  function isOutingDate(date){
    try{
      const fn=window.hasOuting || (typeof hasOuting==='function' ? hasOuting : null);
      if(typeof fn==='function') return !!fn(date);
    }catch(_){}
    return (S()?.activities||[]).some(row=>
      String(row?.event_type||'').trim()==='ออกหน่วย'
      && normDate(row?.start_date)<=date
      && normDate(row?.end_date||row?.start_date)>=date
    );
  }

  function currentConfigs(){
    try{return window.cnmiV224?.currentConfigs?.() || S()?.slotTemplateV224?.configs || null;}
    catch(_){return S()?.slotTemplateV224?.configs || null;}
  }

  function codeOf(row){
    return String(row?.code || row?.position_code || '').trim();
  }

  function slotTarget(date){
    const selector=`[data-v275-slot][data-date="${String(date).replace(/"/g,'\\"')}"]`;
    const input=document.querySelector(selector);
    const row=(S()?.manualDaySlotSettingsV273||[]).find(item=>normDate(item?.work_date)===date);
    const raw=input?.value ?? row?.target_slots;
    const n=Number(raw);
    return Number.isFinite(n)&&n>0 ? Math.round(n) : null;
  }

  function configBuckets(configs){
    const buckets=[];
    Object.entries(configs?.day||{}).forEach(([count,rows])=>{
      if(Array.isArray(rows)) buckets.push({kind:'day',count:Number(count),rows});
    });
    Object.entries(configs?.outing_by_count||{}).forEach(([count,rows])=>{
      if(Array.isArray(rows)) buckets.push({kind:'outing',count:Number(count),rows});
    });
    if(Array.isArray(configs?.outing)) buckets.push({kind:'outing',count:14,rows:configs.outing});
    return buckets;
  }

  function expectedCodesForDate(date){
    try{
      const rows=window.cnmiV278?.templateRowsForDate?.(date) || [];
      return rows.map(codeOf).filter(Boolean);
    }catch(_){return [];}
  }

  function configuredRowsForDate(date){
    const configs=currentConfigs();
    const target=slotTarget(date);
    const outing=isOutingDate(date);
    if(configs && target){
      if(outing){
        const bucket=target<=12?12:(target<=13?13:14);
        const rows=configs.outing_by_count?.[bucket] || configs.outing_by_count?.[String(bucket)] || configs.outing || [];
        if(Array.isArray(rows)&&rows.length) return rows;
      }else{
        const rows=configs.day?.[target] || configs.day?.[String(target)] || [];
        if(Array.isArray(rows)&&rows.length) return rows;
      }
    }

    const expected=expectedCodesForDate(date);
    const buckets=configBuckets(configs).filter(bucket=>bucket.kind===(outing?'outing':'day'));
    if(expected.length && buckets.length){
      const wanted=expected.join('\u241f');
      const exact=buckets.find(bucket=>bucket.rows.map(codeOf).filter(Boolean).join('\u241f')===wanted);
      if(exact) return exact.rows;
      const scored=buckets.map(bucket=>{
        const codes=bucket.rows.map(codeOf).filter(Boolean);
        const overlap=expected.filter(code=>codes.includes(code)).length;
        return {bucket,score:overlap*100-(Math.abs(codes.length-expected.length)*5)+(codes.length===expected.length?20:0)};
      }).sort((a,b)=>b.score-a.score);
      if(scored[0]?.score>0) return scored[0].bucket.rows;
    }

    const masters=(S()?.positionMasters||[]).filter(row=>row && row.is_active!==false && !row.deleted_at && !codeOf(row).startsWith('__CNMI_SLOT_TEMPLATE'));
    return masters.filter(row=>outing ? (row.is_outing===true || String(row.zone||'')==='ออกหน่วย') : !(row.is_outing===true || String(row.zone||'')==='ออกหน่วย'));
  }

  function hasMonthPositionData(key){
    if(document.querySelector('.v275-position-wrap [data-v275-position-select] option:checked:not([value=""])')) return true;
    if(document.querySelector('.v275-position-wrap [data-v275-job]')) return true;
    return (S()?.positions||[]).some(row=>normDate(row?.work_date).startsWith(key) && codeOf(row) && codeOf(row)!=='รอตรวจสอบ');
  }

  function compactDays(values){
    const nums=[...new Set((values||[]).map(value=>Number(String(value).slice(-2))).filter(Number.isFinite))].sort((a,b)=>a-b);
    if(!nums.length) return '-';
    const out=[];
    let start=nums[0],previous=nums[0];
    for(let index=1;index<=nums.length;index++){
      const current=nums[index];
      if(current===previous+1){previous=current;continue;}
      out.push(start===previous?String(start):`${start}-${previous}`);
      start=current;
      previous=current;
    }
    return out.join(', ');
  }

  function positionDatesWithData(key){
    const dates=new Set();
    const wrap=document.querySelector('.v275-position-wrap');
    if(wrap){
      wrap.querySelectorAll('[data-v275-position-cell][data-date]').forEach(cell=>{
        const code=String(cell.querySelector('[data-v275-position-select]')?.value||'').trim();
        const date=normDate(cell.getAttribute('data-date'));
        if(code && code!=='รอตรวจสอบ' && date.startsWith(key)) dates.add(date);
      });
      wrap.querySelectorAll('[data-v275-job]').forEach(button=>{
        const date=dateFromPositionButton(button);
        if(date.startsWith(key)) dates.add(date);
      });
      if(dates.size) return dates;
    }
    (S()?.positions||[]).forEach(row=>{
      const date=normDate(row?.work_date),code=codeOf(row);
      if(date.startsWith(key) && code && code!=='รอตรวจสอบ') dates.add(date);
    });
    return dates;
  }

  function authoritativeDescriptionRows(key){
    if(!hasMonthPositionData(key)) return [];
    const activeDates=positionDatesWithData(key);
    const map=new Map();
    monthDates(key).forEach(date=>{
      if(isWeekendOrHoliday(date) || (activeDates.size && !activeDates.has(date))) return;
      const rows=configuredRowsForDate(date);
      rows.forEach((row,index)=>{
        const code=codeOf(row);
        if(!code || code==='รอตรวจสอบ' || row?.is_active===false) return;
        const detail={
          code,
          zone:String(row?.zone||'-'),
          break_time:String(row?.break_time||'-'),
          main_rule:String(row?.main_rule||row?.required_role||'-'),
          job_desc:String(row?.job_desc||row?.description||'ยังไม่ได้ระบุรายละเอียดหน้าที่'),
          sort_order:Number(row?.sort_order||index+1)||index+1
        };
        const signature=[detail.code,detail.zone,detail.break_time,detail.main_rule,detail.job_desc].join('\u241f');
        if(!map.has(signature)) map.set(signature,{...detail,dates:new Set()});
        map.get(signature).dates.add(date);
      });
    });
    return [...map.values()].map(row=>({...row,dates:[...row.dates]})).sort((a,b)=>
      Number(a.sort_order||999)-Number(b.sort_order||999)
      || String(a.code).localeCompare(String(b.code),'th')
    );
  }

  function descriptionTableHtml(rows){
    if(!rows.length) return '<div class="empty-state">เดือนนี้ยังไม่มีตำแหน่งในตาราง</div>';
    return `<div class="table-wrap v297-position-description-wrap"><table class="v297-position-description-table"><thead><tr><th>ตำแหน่ง</th><th>วันที่ใช้</th><th>โซน</th><th>เวลาพัก</th><th>ผู้ปฏิบัติหลัก / เงื่อนไข</th><th>รายละเอียดหน้าที่</th></tr></thead><tbody>${rows.map(row=>`<tr><td><b>${esc(row.code)}</b></td><td>${esc(compactDays(row.dates))}</td><td>${esc(row.zone)}</td><td>${esc(row.break_time)}</td><td>${esc(row.main_rule)}</td><td class="v297-job-cell">${esc(row.job_desc)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function repairMonthlyPositionDescriptions(root=document){
    const st=S();
    if(!['positionMonth','positionMonthView'].includes(st?.page)) return;
    const page=root.querySelector?.('.v275-page');
    const wrap=page?.querySelector('.v275-position-wrap');
    if(!page || !wrap) return;
    const key=String(st?.page==='positionMonthView' ? (st?.positionMonthViewKey||st?.monthKey) : (st?.positionMonthKey||st?.monthKey)).slice(0,7);
    if(!/^\d{4}-\d{2}$/.test(key)) return;
    const rows=authoritativeDescriptionRows(key);
    const signature=rows.map(row=>[row.code,row.zone,row.break_time,row.main_rule,row.job_desc,row.dates.join(',')].join('|')).join('||');
    let section=page.querySelector('[data-v297-position-descriptions]');
    if(!section){
      section=document.createElement('section');
      section.className='v297-position-description-card';
      section.setAttribute('data-v297-position-descriptions','');
      wrap.insertAdjacentElement('afterend',section);
    }
    if(section.dataset.v313Signature===signature) return;
    section.dataset.v313Signature=signature;
    section.innerHTML=`<div class="section-title"><div><h3>คำอธิบายตำแหน่งที่ใช้ในตาราง</h3><p class="hint">อ้างอิงฐาน Slot ปัจจุบันชุดเดียวกับหน้าตารางตำแหน่งกลางวัน รายวัน</p></div></div>${descriptionTableHtml(rows)}`;
  }

  function detailForPosition(code,date=''){
    const wanted=String(code||'').trim();
    const rows=date ? configuredRowsForDate(date) : [];
    let row=rows.find(item=>codeOf(item)===wanted);
    if(!row){
      const family=wanted.replace(/\s+\d+$/,'').trim();
      const familyRows=rows.filter(item=>codeOf(item).replace(/\s+\d+$/,'').trim()===family);
      if(familyRows.length===1) row=familyRows[0];
    }
    if(!row){
      const buckets=configBuckets(currentConfigs());
      row=buckets.flatMap(bucket=>bucket.rows).find(item=>codeOf(item)===wanted);
    }
    if(!row){
      row=(S()?.positionMasters||[]).find(item=>codeOf(item)===wanted && item?.is_active!==false && !item?.deleted_at);
    }
    return row || {code:wanted,zone:'-',break_time:'-',main_rule:'-',job_desc:'ยังไม่ได้ระบุรายละเอียดหน้าที่'};
  }

  function dateFromPositionButton(button){
    const direct=button?.closest?.('[data-date]')?.getAttribute('data-date');
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(direct||''))) return String(direct);
    const cell=button?.closest?.('td');
    const row=button?.closest?.('tr');
    const dates=monthDates();
    if(!cell || !row || !dates.length) return '';
    const children=Array.from(row.children||[]);
    const index=children.indexOf(cell);
    const frozen=Math.max(0,children.length-dates.length);
    return dates[index-frozen] || '';
  }

  function openPosition(button){
    const code=String(button?.getAttribute?.('data-v275-job') || button?.getAttribute?.('data-v273-job-code') || '').trim();
    if(!code) return;
    const date=dateFromPositionButton(button);
    const row=detailForPosition(code,date);
    try{
      const fn=window.showModal || (typeof showModal==='function' ? showModal : null);
      if(typeof fn!=='function') throw new Error('ไม่พบ Modal');
      fn(`<div class="v313-position-modal"><h2>${esc(codeOf(row)||code)}</h2><div class="v313-position-meta"><span><small>โซน</small><b>${esc(row?.zone||'-')}</b></span><span><small>เวลาพัก</small><b>${esc(row?.break_time||'-')}</b></span></div><div class="v313-position-box"><h3>ผู้ปฏิบัติหลัก / เงื่อนไข</h3><p>${esc(row?.main_rule||row?.required_role||'-')}</p></div><div class="v313-position-box"><h3>รายละเอียดหน้าที่</h3><p>${esc(row?.job_desc||row?.description||'ยังไม่ได้ระบุรายละเอียดหน้าที่')}</p></div></div>`,{large:false});
      requestAnimationFrame(forceModal);
      setTimeout(forceModal,60);
    }catch(error){
      console.error(`[${VERSION}] position modal`,error);
      toast('เปิดรายละเอียดตำแหน่งไม่สำเร็จ กรุณารีเฟรชแล้วลองใหม่');
    }
  }

  function openCalendar(date){
    const key=normDate(date);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
    try{
      const direct=window.showDayDetail || (typeof showDayDetail==='function' ? showDayDetail : null);
      if(typeof direct==='function') direct(key);
      else{
        const collect=window.collectCalendarEvents || (typeof collectCalendarEvents==='function' ? collectCalendarEvents : null);
        const render=window.renderCalendarModalRow || (typeof renderCalendarModalRow==='function' ? renderCalendarModalRow : null);
        const rows=(typeof collect==='function' ? collect() : []).filter(row=>normDate(row?.date)===key);
        const format=window.formatThaiDate || (typeof formatThaiDate==='function' ? formatThaiDate : null);
        const title=typeof format==='function' ? format(key) : key;
        const body=rows.length ? rows.map(row=>typeof render==='function'?render(row):`<div class="calendar-modal-row"><b>${esc(row?.title||'-')}</b></div>`).join('') : '<div class="empty-state">ไม่มีรายการในวันนี้</div>';
        const show=window.showModal || (typeof showModal==='function' ? showModal : null);
        if(typeof show==='function') show(`<h2>${esc(title)}</h2><div class="calendar-modal-list">${body}</div>`);
      }
      requestAnimationFrame(forceModal);
      setTimeout(forceModal,60);
    }catch(error){
      console.error(`[${VERSION}] calendar modal`,error);
      toast('เปิดรายละเอียด Calendar ไม่สำเร็จ กรุณารีเฟรชแล้วลองใหม่');
    }
  }

  function touchActionFor(target){
    if(target?.nodeType===3) target=target.parentElement;
    if(!target?.closest) return null;
    const trade=target.closest('#scheduleTable .clean-shift-pill');
    if(trade){
      const assignment=resolveTradeAssignmentForPill(trade);
      const id=String(assignment?.id || trade.getAttribute('data-v313-trade-id') || '').trim();
      if(id) return {type:'trade',key:`trade:${id}`,node:trade,id};
    }
    const calendar=target.closest('[data-day-detail]');
    if(calendar) return {type:'calendar',key:`calendar:${calendar.getAttribute('data-day-detail')}`,node:calendar};
    const position=target.closest('[data-v275-job],[data-v273-job-code]');
    if(position){
      const code=position.getAttribute('data-v275-job')||position.getAttribute('data-v273-job-code')||'';
      return {type:'position',key:`position:${code}`,node:position};
    }
    return null;
  }

  function runTouchAction(event,action){
    if(!action) return;
    const now=Date.now();
    if(action.key===lastTouchAction && now-lastTouchAt<900){stop(event);return;}
    lastTouchAction=action.key;
    lastTouchAt=now;
    stop(event);
    if(action.type==='trade') openTrade(action.id || action.node.getAttribute('data-v313-trade-id'));
    else if(action.type==='calendar') openCalendar(action.node.getAttribute('data-day-detail'));
    else if(action.type==='position') openPosition(action.node);
  }

  document.addEventListener('change',event=>{
    if(event.target?.id!=='trainingHistoryStatusV313') return;
    const st=S();
    if(st) st.trainingHistoryFilterV313=String(event.target.value||'active');
    enhanceTrainingHistory(document);
  },true);

  document.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse') return;
    const action=touchActionFor(event.target);
    if(!action) return;
    pointerStarts.set(event.pointerId,{x:event.clientX,y:event.clientY,action,moved:false});
  },{capture:true,passive:true});

  document.addEventListener('pointermove',event=>{
    const start=pointerStarts.get(event.pointerId);
    if(!start) return;
    if(Math.hypot(event.clientX-start.x,event.clientY-start.y)>26) start.moved=true;
  },{capture:true,passive:true});

  document.addEventListener('pointerup',event=>{
    if(event.pointerType==='mouse') return;
    const start=pointerStarts.get(event.pointerId);
    pointerStarts.delete(event.pointerId);
    if(!start || start.moved) return;
    const current=touchActionFor(document.elementFromPoint(event.clientX,event.clientY)) || start.action;
    runTouchAction(event,current);
  },{capture:true,passive:false});

  document.addEventListener('pointercancel',event=>pointerStarts.delete(event.pointerId),{capture:true,passive:true});

  let touchStartV313=null;
  document.addEventListener('touchstart',event=>{
    const touch=event.touches?.[0];
    const action=touchActionFor(event.target);
    if(!touch || action?.type!=='trade') return;
    touchStartV313={x:touch.clientX,y:touch.clientY,action,moved:false};
  },{capture:true,passive:true});

  document.addEventListener('touchmove',event=>{
    if(!touchStartV313) return;
    const touch=event.touches?.[0];
    if(touch && Math.hypot(touch.clientX-touchStartV313.x,touch.clientY-touchStartV313.y)>26) touchStartV313.moved=true;
  },{capture:true,passive:true});

  document.addEventListener('touchend',event=>{
    const start=touchStartV313;
    touchStartV313=null;
    if(!start || start.moved) return;
    const touch=event.changedTouches?.[0];
    const target=touch ? document.elementFromPoint(touch.clientX,touch.clientY) : event.target;
    const action=touchActionFor(target) || start.action;
    if(action?.type==='trade') runTouchAction(event,action);
  },{capture:true,passive:false});

  document.addEventListener('touchcancel',()=>{touchStartV313=null;},{capture:true,passive:true});

  document.addEventListener('click',event=>{
    const action=touchActionFor(event.target);
    if(action?.type!=='trade') return;
    if(Date.now()-lastTouchAt<900){stop(event);return;}
    runTouchAction(event,action);
  },true);

  document.addEventListener('keydown',event=>{
    if(event.key!=='Enter' && event.key!==' ') return;
    const action=touchActionFor(event.target);
    if(action?.type!=='trade') return;
    runTouchAction(event,action);
  },true);

  function localToday(){
    const now=new Date();
    const year=now.getFullYear();
    const month=String(now.getMonth()+1).padStart(2,'0');
    const day=String(now.getDate()).padStart(2,'0');
    return `${year}-${month}-${day}`;
  }

  function cleanLeaveUi(root=document){
    root.querySelectorAll?.('.v254-pending-admin-summary span').forEach(node=>{
      if(String(node.textContent||'').includes('ระบบเรียงรายการเหล่านี้ไว้ด้านบนก่อนแล้ว')) node.remove();
    });
    root.querySelectorAll?.('.notice').forEach(node=>{
      const text=String(node.textContent||'').replace(/\s+/g,' ').trim();
      if(text==='ถ้าวันที่ขอลามีการประกาศตารางตำแหน่งกลางวัน รายวันแล้ว ระบบยังบันทึกได้ แต่จะแจ้งเตือนให้ติดต่ออินชาร์จหรือหัวหน้า เพื่อให้ปรับตำแหน่งหน้างานทันที') node.remove();
    });
  }

  function installLeavePagePatch(){
    let previous=null;
    try{previous=window.renderLeavePage || (typeof renderLeavePage==='function' ? renderLeavePage : null);}catch(_){previous=window.renderLeavePage||null;}
    if(typeof previous!=='function' || previous.__v313LeavePage) return;
    const patched=function renderLeavePageV313(){
      const st=S();
      if(isAdmin() && st && !st.__leaveDefaultAppliedV313){
        if(!String(st.leaveFilterStatus||'').trim()) st.leaveFilterStatus='pending_admin';
        st.__leaveDefaultAppliedV313=true;
      }
      let html=String(previous.apply(this,arguments)||'');
      html=html.replace(/<div class="notice soft-notice wide">\s*ถ้าวันที่ขอลามีการประกาศตารางตำแหน่งกลางวัน รายวันแล้ว ระบบยังบันทึกได้ แต่จะแจ้งเตือนให้ติดต่ออินชาร์จหรือหัวหน้า เพื่อให้ปรับตำแหน่งหน้างานทันที\s*<\/div>/g,'');
      html=html.replace(/<span>\s*ระบบเรียงรายการเหล่านี้ไว้ด้านบนก่อนแล้ว\s*<\/span>/g,'');
      return html;
    };
    patched.__v313LeavePage=true;
    window.renderLeavePage=patched;
    try{renderLeavePage=patched;}catch(_){}
  }

  function historyCard(root=document){
    return Array.from(root.querySelectorAll?.('.v273-intern-page .card')||[]).find(card=>
      String(card.querySelector('h2,h3')?.textContent||'').replace(/\s+/g,' ').trim()==='ประวัติช่วงพี่เลี้ยง'
    ) || null;
  }

  function enhanceTrainingHistory(root=document){
    const card=historyCard(root);
    if(!card) return;
    const table=card.querySelector('table');
    const tbody=table?.querySelector('tbody');
    if(!tbody) return;
    const rows=Array.from(tbody.querySelectorAll(':scope > tr'));
    if(!rows.length || (rows.length===1 && rows[0].children.length===1)) return;
    const st=S();
    const selected=String(st?.trainingHistoryFilterV313 || 'active');
    const head=card.querySelector('.section-title');
    let select=card.querySelector('#trainingHistoryStatusV313');
    if(!select && head){
      const wrap=document.createElement('label');
      wrap.className='v313-training-history-filter';
      wrap.innerHTML=`<span>สถานะ</span><select id="trainingHistoryStatusV313"><option value="active">ใช้งาน</option><option value="expired">เลยช่วงวันที่</option><option value="inactive">ปิดใช้งาน</option><option value="all">ทั้งหมด</option></select>`;
      head.appendChild(wrap);
      select=wrap.querySelector('select');
    }
    if(select && select.value!==selected) select.value=selected;

    const today=localToday();
    let visible=0;
    rows.forEach(row=>{
      const cells=Array.from(row.children||[]);
      const dates=String(cells[3]?.textContent||'').match(/\d{4}-\d{2}-\d{2}/g)||[];
      const end=dates[1]||dates[0]||'';
      const statusText=String(cells[4]?.textContent||'').replace(/\s+/g,' ').trim();
      const inactive=/ปิดใช้งาน|ยกเลิก/.test(statusText);
      const group=inactive ? 'inactive' : (end && end<today ? 'expired' : 'active');
      row.dataset.v313TrainingStatus=group;
      const badge=cells[4]?.querySelector('.badge');
      if(badge){
        const desired=group==='inactive'?'ปิดใช้งาน':group==='expired'?'เลยช่วงวันที่':'ใช้งาน';
        if(String(badge.textContent||'').trim()!==desired) badge.textContent=desired;
        badge.classList.toggle('black',group==='inactive');
        badge.classList.toggle('green',group==='active');
        badge.classList.toggle('blue',group==='expired');
      }
      const show=selected==='all' || selected===group;
      row.classList.toggle('v313-training-hidden',!show);
      if(show) visible++;
    });
    const count=head?.querySelector('.badge.blue');
    if(count){
      const label=selected==='all' ? `${rows.length} รายการ` : `${visible} / ${rows.length} รายการ`;
      if(String(count.textContent||'').trim()!==label) count.textContent=label;
    }
  }

  function enhance(root=document){
    installLeavePagePatch();
    removeObsoleteCh4(root);
    repairDailySummary(root);
    keepDailyDutyText(root);
    repairFullMonthTradeTargets(root);
    repairMonthlyPositionDescriptions(root);
    enhanceTrainingHistory(root);
    cleanLeaveUi(root);
  }

  function queueEnhance(){
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      enhance(document);
    });
  }

  const style=document.createElement('style');
  style.id='v313-app-targeted-position-trade-style';
  style.textContent=`
    .v234-ch4-shared-card,.v209-admin-ch4-card{display:none!important}
    .v313-summary-cards{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:10px!important}
    .v313-summary-cards>div{min-width:0}

    .position-mobile-card.v225-position-card{
      grid-template-areas:
        "head head"
        "meta meta"
        "plan edit"
        "duty duty"
        "action action"!important;
    }
    .position-mobile-card.v225-position-card>.v313-position-duty-preview{
      grid-area:duty!important;
      width:100%!important;
      min-width:0!important;
      box-sizing:border-box!important;
      margin:0!important;
      padding:12px 13px!important;
      border:1px solid #d6e7f7!important;
      border-radius:14px!important;
      background:#f7fbff!important;
      color:#334155!important;
      line-height:1.6!important;
      position:relative!important;
      z-index:1!important;
    }
    .position-mobile-card.v225-position-card>.v313-position-duty-preview b{display:block!important;color:#17324d!important;margin:0 0 4px!important;font-size:14px!important}
    .position-mobile-card.v225-position-card>.v313-position-duty-preview span{display:block!important;white-space:pre-wrap!important;overflow-wrap:anywhere!important}
    .v225-positions-page [data-v296-position-detail],
    .v225-positions-page [data-v225-position-detail],
    .v226-positions-page [data-v226-position-detail],
    .v219-positions-page [data-position-detail-v219]{display:none!important}

    #scheduleTable .clean-shift-pill.v313-trade-ready{cursor:pointer!important;touch-action:manipulation!important;-webkit-tap-highlight-color:rgba(37,99,235,.18)!important;pointer-events:auto!important;user-select:none!important;box-shadow:0 0 0 1px rgba(37,99,235,.18)}
    .v313-training-history-filter{display:flex;align-items:center;gap:7px;margin-left:auto;font-size:12px;color:#475569}
    .v313-training-history-filter select{min-width:145px;padding:8px 30px 8px 10px;border:1px solid #cbd5e1;border-radius:10px;background:#fff}
    .v313-training-hidden{display:none!important}

    .v313-position-modal h2{margin:0 0 14px}
    .v313-position-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:12px}
    .v313-position-meta>span,.v313-position-box{padding:13px;border:1px solid #dbe7f3;border-radius:15px;background:#f8fbff}
    .v313-position-meta small{display:block;color:#64748b;margin-bottom:3px}
    .v313-position-box{margin-top:10px;background:#fff}
    .v313-position-box h3{margin:0 0 6px;color:#17324d}
    .v313-position-box p{margin:0;white-space:pre-wrap;line-height:1.65;color:#334155}

    @media(max-width:760px){
      .position-mobile-card.v225-position-card{
        grid-template-columns:minmax(0,1fr)!important;
        grid-template-areas:
          "head"
          "meta"
          "plan"
          "edit"
          "duty"
          "action"!important;
        gap:10px!important;
      }
    }
    @media(max-width:520px){
      .v313-summary-cards{grid-template-columns:repeat(2,minmax(0,1fr))!important}
      .v313-summary-cards>div:last-child{grid-column:1/-1}
      .v313-position-meta{grid-template-columns:1fr}
    }
  `;
  document.head.appendChild(style);

  const observer=new MutationObserver(queueEnhance);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',queueEnhance,{once:true});
  window.addEventListener('pageshow',queueEnhance);
  window.addEventListener('resize',queueEnhance);
  queueEnhance();

  window.cnmiV313={
    enhance,
    repairDailySummary,
    keepDailyDutyText,
    repairFullMonthTradeTargets,
    repairMonthlyPositionDescriptions,
    openTrade,
    openPosition,
    openCalendar,
    authoritativeDescriptionRows,
    enhanceTrainingHistory,
    cleanLeaveUi,
    resolveTradeAssignmentForPill
  };
  console.info(`[${VERSION}] loaded`);
})();

} catch (error) { console.error("[v569] patch-v313-app-count-filter-pwa-trade-fix.js", error); }
;

/* Original source: patch-v314-admin-ot-calendar-ch4-fix.js */
try {
/* CNMI Staff Planner V314
   Targeted fixes only:
   - Calendar details popup (paired with early preload router)
   - Admin extra-OT uses an explicit actual work date, not HR-cycle start
   - Admin OT edit popup is forced visible and remains editable
   - CH4 cover / no-claim actions use the current shift_confirmations table directly
*/
(function(){
  'use strict';
  const VERSION='V314_ADMIN_OT_CALENDAR_CH4_FIX';
  if(window.__CNMI_V314_ADMIN_OT_CALENDAR_CH4_FIX__) return;
  window.__CNMI_V314_ADMIN_OT_CALENDAR_CH4_FIX__=true;

  function S(){try{return window.state||state||null;}catch(_){return window.state||null;}}
  function esc(value){
    try{
      const fn=window.escapeHtml || (typeof escapeHtml==='function'?escapeHtml:null);
      if(typeof fn==='function') return fn(value==null?'':String(value));
    }catch(_){ }
    return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function normDate(value){
    try{
      const fn=window.normalizeDateKey || (typeof normalizeDateKey==='function'?normalizeDateKey:null);
      if(typeof fn==='function') return String(fn(value)||'').slice(0,10);
    }catch(_){ }
    return String(value||'').slice(0,10);
  }
  function today(){
    try{
      const fn=window.todayStr || (typeof todayStr==='function'?todayStr:null);
      if(typeof fn==='function') return fn();
    }catch(_){ }
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function isAdminSafe(){
    try{
      const fn=window.isAdmin || (typeof isAdmin==='function'?isAdmin:null);
      if(typeof fn==='function') return !!fn();
    }catch(_){ }
    return String(S()?.role||S()?.currentRole||'').toLowerCase()==='admin';
  }
  function currentStaff(){
    try{
      const fn=window.currentStaffId || (typeof currentStaffId==='function'?currentStaffId:null);
      if(typeof fn==='function') return String(fn()||'');
    }catch(_){ }
    return String(S()?.profile?.id||S()?.profile?.staff_id||'');
  }
  function staffName(id){
    try{
      const fn=window.staffNick || (typeof staffNick==='function'?staffNick:null);
      if(typeof fn==='function') return fn(id);
    }catch(_){ }
    const row=(S()?.staff||[]).find(item=>String(item?.id)===String(id))||{};
    return row.nickname||row.full_name||row.email||id||'-';
  }
  function activeStaff(){
    const rows=(S()?.staff||[]).filter(row=>{
      const active=Object.prototype.hasOwnProperty.call(row,'active') ? (row.active===true||String(row.active).toLowerCase()==='true') : (row.is_active!==false&&String(row.is_active).toLowerCase()!=='false');
      const schedule=Object.prototype.hasOwnProperty.call(row,'schedule') ? (row.schedule===true||String(row.schedule).toLowerCase()==='true') : true;
      return active&&schedule;
    });
    try{
      const fn=window.orderedStaff || (typeof orderedStaff==='function'?orderedStaff:null);
      if(typeof fn==='function') return fn(rows);
    }catch(_){ }
    return rows.slice().sort((a,b)=>String(a.nickname||a.full_name||'').localeCompare(String(b.nickname||b.full_name||''),'th'));
  }
  function staffOptions(selected='',exclude=''){
    return `<option value="">เลือกชื่อ</option>`+activeStaff().filter(row=>String(row.id)!==String(exclude||'')).map(row=>`<option value="${esc(row.id)}" ${String(row.id)===String(selected)?'selected':''}>${esc(row.nickname||row.full_name||row.email||row.id)}</option>`).join('');
  }
  function modal(html,opts={}){
    const pre=window.__cnmiV314Preload;
    if(pre?.showModalDom) return pre.showModalDom(html,opts);
    try{
      const fn=window.showModal || (typeof showModal==='function'?showModal:null);
      if(typeof fn==='function') fn(html,opts);
    }catch(_){ }
    const root=document.getElementById('modal');
    const body=document.getElementById('modalBody');
    if(!root||!body) return false;
    if(!String(body.innerHTML||'').trim()) body.innerHTML=html;
    root.classList.remove('hidden','modal-closing');
    root.classList.add('modal-ready');
    root.classList.toggle('modal-sm',!!opts.small);
    root.classList.toggle('modal-lg',!!opts.large);
    document.body.classList.add('modal-open');
    return true;
  }
  function toast(message,tone='error'){
    try{
      const fn=window.showToast || (typeof showToast==='function'?showToast:null);
      if(typeof fn==='function') return fn(message,{tone});
    }catch(_){ }
    modal(`<div class="app-alert ${tone}"><div class="app-alert-icon">${tone==='error'?'!':'✓'}</div><h2>${tone==='error'?'แจ้งเตือน':'สำเร็จ'}</h2><p>${esc(message)}</p><div class="confirm-actions"><button class="primary-btn" type="button" data-app-alert-ok>ตกลง</button></div></div>`,{small:true});
  }
  function busy(on,text='กำลังบันทึก'){
    try{
      const fn=window.setBusy || (typeof setBusy==='function'?setBusy:null);
      if(typeof fn==='function') fn(on,text);
    }catch(_){ }
  }
  async function refresh(){
    try{
      const load=window.loadAllData || (typeof loadAllData==='function'?loadAllData:null);
      if(typeof load==='function') await load();
    }catch(error){console.warn(`[${VERSION}] refresh load`,error);}
    try{
      const render=window.renderPage || (typeof renderPage==='function'?renderPage:null);
      if(typeof render==='function') render();
    }catch(error){console.warn(`[${VERSION}] refresh render`,error);}
  }
  function close(){
    try{
      const fn=window.closeModal || (typeof closeModal==='function'?closeModal:null);
      if(typeof fn==='function') return fn();
    }catch(_){ }
    const root=document.getElementById('modal');
    if(root) root.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }
  async function confirmSafe(message,title='ยืนยันการทำรายการ'){
    try{
      const fn=window.confirmDialog || (typeof confirmDialog==='function'?confirmDialog:null);
      if(typeof fn==='function') return await fn(message,title);
    }catch(_){ }
    return window.confirm(message);
  }

  function enhanceAdminOtFormHtml(html){
    if(!isAdminSafe() || !String(html||'').includes('data-admin-simple="1"')) return String(html||'');
    try{
      const tpl=document.createElement('template');
      tpl.innerHTML=String(html||'');
      const form=tpl.content.querySelector('#otForm[data-admin-simple="1"]');
      if(!form) return String(html||'');
      if(!form.querySelector('[name="work_date"]')){
        const label=document.createElement('label');
        label.className='v314-admin-ot-date';
        label.innerHTML=`วันที่ทำ OT จริง <input name="work_date" type="date" value="${esc(S()?.adminOtWorkDateV314||today())}" required><span class="hint">ใช้วันที่ทำ OT จริง ไม่ใช่วันเริ่มรอบเบิก HR</span>`;
        const hours=form.querySelector('[name="requested_hours"]')?.closest('label');
        if(hours) form.insertBefore(label,hours);
        else form.prepend(label);
      }
      if(!form.querySelector('[name="note"]')){
        const reason=form.querySelector('[name="reason"]')?.closest('label');
        const note=document.createElement('label');
        note.className='wide v314-admin-ot-note';
        note.innerHTML='<span>รายละเอียด/หมายเหตุ</span><textarea name="note" rows="2" placeholder="เช่น ประชุมหน่วยย่อย / อยู่แทน ช4 / ปรับยอดเบิก"></textarea>';
        if(reason) reason.insertAdjacentElement('afterend',note); else form.appendChild(note);
      }
      return tpl.innerHTML;
    }catch(error){
      console.warn(`[${VERSION}] form enhancement fallback`,error);
      return String(html||'');
    }
  }

  const previousRenderOtPage=window.renderOtPage || (typeof renderOtPage==='function'?renderOtPage:null);
  if(typeof previousRenderOtPage==='function' && !previousRenderOtPage.__v314){
    const wrapped=function renderOtPageV314(){
      return enhanceAdminOtFormHtml(previousRenderOtPage.apply(this,arguments));
    };
    wrapped.__v314=true;
    window.renderOtPage=wrapped;
    try{renderOtPage=wrapped;}catch(_){ }
  }

  async function safeGps(){
    try{
      const fn=window.getGps || (typeof getGps==='function'?getGps:null);
      if(typeof fn==='function'){
        const result=await fn();
        return result&&typeof result==='object'?result:{};
      }
    }catch(_){ }
    return {};
  }
  async function saveAdminExtraOt(form){
    if(!isAdminSafe()) return toast('เฉพาะ Admin เท่านั้น');
    const fd=new FormData(form);
    const staffId=String(fd.get('staff_id')||'').trim();
    const workDate=normDate(fd.get('work_date'));
    const hours=Number(fd.get('requested_hours'));
    const reason=String(fd.get('reason')||'').trim();
    const extra=String(fd.get('note')||'').trim();
    if(!staffId) return toast('กรุณาเลือกเจ้าหน้าที่');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return toast('กรุณาระบุวันที่ทำ OT จริง');
    if(!Number.isFinite(hours)||hours<=0) return toast('กรุณาระบุชั่วโมงที่ต้องการเบิกให้ถูกต้อง');
    if(!reason) return toast('กรุณาระบุเหตุผล');
    const st=S();
    if(st) st.adminOtWorkDateV314=workDate;
    const pos=await safeGps();
    const note=[`จำนวนเวลา OT: ${hours} ชั่วโมง`,extra].filter(Boolean).join(' | ');
    const payload={
      staff_id:staffId,
      work_date:workDate,
      start_time:'00:00',
      end_date:workDate,
      end_time:'00:00',
      reason,
      note,
      status:'รออนุมัติ',
      lat:pos?.lat??null,
      lng:pos?.lng??null,
      accuracy:pos?.accuracy??null,
      device:`${navigator.userAgent} | ${VERSION} admin extra OT`.slice(0,250)
    };
    busy(true,'กำลังบันทึก OT เพิ่ม');
    try{
      if(!window.sb && typeof sb==='undefined') throw new Error('ยังเชื่อมต่อฐานข้อมูลไม่สำเร็จ');
      const client=window.sb || sb;
      let result=await client.from('ot_requests').insert(payload);
      if(result.error){
        const fallback={...payload};
        delete fallback.end_date;
        delete fallback.start_time;
        result=await client.from('ot_requests').insert(fallback);
      }
      if(result.error) throw result.error;
      await refresh();
      toast(`บันทึก OT เพิ่มของ ${staffName(staffId)} วันที่ ${workDate} แล้ว`,'success');
    }catch(error){
      console.error(`[${VERSION}] save admin extra OT`,error);
      toast(error?.message||'บันทึก OT เพิ่มไม่สำเร็จ');
    }finally{busy(false);}
  }

  const previousSaveOtRequest=window.saveOtRequest || (typeof saveOtRequest==='function'?saveOtRequest:null);
  const saveWrapped=async function saveOtRequestV314(form){
    if(isAdminSafe() && form?.matches?.('#otForm[data-admin-simple="1"]')) return saveAdminExtraOt(form);
    if(typeof previousSaveOtRequest==='function') return previousSaveOtRequest(form);
  };
  window.saveOtRequest=saveWrapped;
  try{saveOtRequest=saveWrapped;}catch(_){ }

  function forceModal(){
    const root=document.getElementById('modal');
    const body=document.getElementById('modalBody');
    if(!root||!body||!String(body.innerHTML||'').trim()) return;
    root.classList.remove('hidden','modal-closing');
    root.classList.add('modal-ready');
    document.body.classList.add('modal-open');
    const card=root.querySelector('.modal-card');
    if(card) card.scrollTop=0;
  }
  function openEditOt(id){
    const row=(S()?.otRequests||[]).find(item=>String(item?.id)===String(id));
    if(!row) return toast('ไม่พบรายการ OT นี้ กรุณารีเฟรชหน้า');
    try{
      const fn=window.openEditOtModal || window.openEditModal;
      if(typeof fn!=='function') throw new Error('ไม่พบฟังก์ชันแก้ไข OT');
      fn(id);
      requestAnimationFrame(forceModal);
      setTimeout(forceModal,60);
    }catch(error){
      console.error(`[${VERSION}] open edit OT`,error);
      toast('เปิดหน้าต่างแก้ไข OT ไม่สำเร็จ');
    }
  }

  function assignmentFromKey(key){
    const [id,date,staffId,dutyCode]=String(key||'').split('|');
    return (S()?.rosterAssignments||[]).find(row=>{
      if(id&&String(row?.id||'')===id) return true;
      return normDate(row?.duty_date)===date&&String(row?.staff_id||'')===staffId&&String(row?.duty_code||'')===dutyCode;
    })||null;
  }
  function tableMissingMessage(error){
    const msg=String(error?.message||error||'');
    return /shift_confirmations|relation .* does not exist|schema cache|42P01|PGRST205/i.test(msg);
  }
  async function upsertCh4(assignment,status,coveredBy='',note=''){
    if(!assignment) throw new Error('ไม่พบรายการ ช4 นี้ กรุณารีเฟรชหน้า');
    const client=window.sb || (typeof sb!=='undefined'?sb:null);
    if(!client) throw new Error('ยังเชื่อมต่อฐานข้อมูลไม่สำเร็จ');
    const now=new Date().toISOString();
    const base={
      roster_assignment_id:assignment.id||null,
      shift_type:'ช4',
      duty_code:assignment.duty_code||'ช4',
      work_date:normDate(assignment.duty_date),
      owner_staff_id:assignment.staff_id,
      status,
      covered_by_staff_id:coveredBy||null,
      covered_by_name:coveredBy?staffName(coveredBy):null,
      covered_note:note||null,
      note:note||null,
      confirmed_at:now,
      covered_at:status==='covered_by_other'?now:null,
      updated_by:currentStaff(),
      created_by:currentStaff()
    };
    const attempts=[
      {...base},
      (()=>{const p={...base};delete p.covered_by_name;return p;})(),
      (()=>{const p={...base};delete p.roster_assignment_id;delete p.covered_by_name;return p;})(),
      (()=>{const p={...base};delete p.roster_assignment_id;delete p.covered_by_name;delete p.created_by;return p;})()
    ];
    let last=null;
    for(const payload of attempts){
      const result=await client.from('shift_confirmations').upsert(payload,{onConflict:'work_date,owner_staff_id,duty_code'}).select('*').maybeSingle();
      if(!result.error) return result.data||payload;
      last=result.error;
      if(!/column|schema|cache|constraint|conflict|status/i.test(String(result.error?.message||''))) break;
    }
    const lastMessage=String(last?.message||last||'');
    if(tableMissingMessage(last) || /no_claim|status_check|no unique|no unique or exclusion|42P10|23514/i.test(lastMessage)){
      const err=new Error('ฐานข้อมูลสถานะ ช4 ยังไม่พร้อมสำหรับปุ่มนี้ กรุณา Run ไฟล์ supabase_v314_ch4_status_repair.sql ใน Supabase SQL Editor หนึ่งครั้ง');
      err.code='V314_CH4_SQL_REQUIRED';
      throw err;
    }
    throw last||new Error('บันทึกสถานะ ช4 ไม่สำเร็จ');
  }
  function coverModal(key){
    const assignment=assignmentFromKey(key);
    if(!assignment) return toast('ไม่พบรายการ ช4 นี้ กรุณารีเฟรชหน้า');
    modal(`<div class="v314-ch4-cover-modal"><h2>ย้าย ช4 ให้คนอยู่แทน</h2><p class="hint">ไม่สร้าง OT อัตโนมัติ</p><form id="ch4CoverFormV314" class="form-grid"><input type="hidden" name="assignment_key" value="${esc(key)}"><label>เจ้าของ ช4 <input value="${esc(staffName(assignment.staff_id))}" disabled></label><label>วันที่ <input value="${esc(normDate(assignment.duty_date))}" disabled></label><label class="wide">ผู้ที่อยู่แทน <select name="covered_by_staff_id" required>${staffOptions('',assignment.staff_id)}</select></label><label class="wide">หมายเหตุ <textarea name="covered_note" rows="3" placeholder="เช่น ปั่นเลือดแทน / อยู่แทนช่วงเย็น"></textarea></label><div class="actions wide"><button class="ghost-btn" type="button" data-close-modal>ยกเลิก</button><button class="primary-btn" type="submit">ย้าย ช4</button></div></form></div>`,{small:true});
  }
  async function saveCover(form){
    const fd=new FormData(form);
    const assignment=assignmentFromKey(String(fd.get('assignment_key')||''));
    const coveredBy=String(fd.get('covered_by_staff_id')||'').trim();
    const note=String(fd.get('covered_note')||'').trim();
    if(!coveredBy) return toast('กรุณาเลือกผู้ที่อยู่แทน');
    busy(true,'กำลังบันทึกผู้ที่อยู่แทน');
    try{
      await upsertCh4(assignment,'covered_by_other',coveredBy,note||`มีคนอยู่แทน: ${staffName(coveredBy)}`);
      if(typeof window.cnmiV441Ch4Transfer?.transferCh4Assignment==='function') await window.cnmiV441Ch4Transfer.transferCh4Assignment(assignment,coveredBy,{ownerStaffId:assignment.staff_id});
      close();
      await refresh();
      toast(`ย้าย ช4 ให้ ${staffName(coveredBy)} แล้ว • ไม่สร้าง OT อัตโนมัติ`,'success');
    }catch(error){
      console.error(`[${VERSION}] save cover`,error);
      toast(error?.message||'บันทึกผู้ที่อยู่แทนไม่สำเร็จ');
    }finally{busy(false);}
  }
  async function runCh4Action(type,key){
    const assignment=assignmentFromKey(key);
    if(!assignment) return toast('ไม่พบรายการ ช4 นี้ กรุณารีเฟรชหน้า');
    if(type==='cover') return coverModal(key);
    const isSelf=type==='self';
    const message=isSelf
      ? 'บันทึกว่าทำ ช4 เองใช่ไหม? หากต้องการเบิก OT ต้องบันทึกเวลาจริงแยกต่างหาก'
      : 'บันทึกเป็น “ไม่เบิก / ไม่มีปั่นเลือด” ใช่ไหม? รายการนี้จะไม่เข้า OT และไม่เข้า Export HR';
    const ok=await confirmSafe(message,isSelf?'ยืนยันทำ ช4 เอง':'ยืนยันไม่เบิก');
    if(!ok) return;
    busy(true,'กำลังบันทึกสถานะ ช4');
    try{
      await upsertCh4(assignment,isSelf?'completed_self':'no_claim','',isSelf?'ทำ ช4 เอง':'ไม่เบิก/ไม่มีปั่นเลือด');
      await refresh();
      toast(isSelf?'บันทึกสถานะ ทำ ช4 เอง แล้ว':'บันทึกสถานะ ไม่เบิก/ไม่มีปั่นเลือด แล้ว','success');
    }catch(error){
      console.error(`[${VERSION}] CH4 status`,error);
      toast(error?.message||'บันทึกสถานะ ช4 ไม่สำเร็จ');
    }finally{busy(false);}
  }

  document.addEventListener('change',event=>{
    const input=event.target?.closest?.('#otForm[data-admin-simple="1"] [name="work_date"]');
    if(!input) return;
    const st=S();
    if(st) st.adminOtWorkDateV314=normDate(input.value)||today();
  },true);
  document.addEventListener('submit',event=>{
    if(event.target?.id!=='ch4CoverFormV314') return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    void saveCover(event.target);
  },true);
  document.addEventListener('click',event=>{
    if(event.target?.closest?.('[data-close-modal]')){
      event.preventDefault();
      close();
    }
  },true);

  const style=document.createElement('style');
  style.id='v314-admin-ot-calendar-ch4-style';
  style.textContent=`
    #otForm[data-admin-simple="1"] .v314-admin-ot-date .hint{display:block;margin-top:5px;color:#64748b;font-size:12px}
    .v314-calendar-modal h2{margin:0 0 14px}
    .v314-ch4-cover-modal h2{margin:0 0 8px}
    [data-edit-ot]:not([disabled]),[data-v234-ch4-self],[data-v234-ch4-cover],[data-v234-ch4-no-claim]{touch-action:manipulation}
  `;
  document.head.appendChild(style);

  window.cnmiV314={openEditOt,runCh4Action,saveAdminExtraOt,upsertCh4};
  console.info(`[${VERSION}] loaded`);
})();

} catch (error) { console.error("[v569] patch-v314-admin-ot-calendar-ch4-fix.js", error); }
;

/* Original source: patch-v550-route-loader-trade-stability.js */
try {
/* CNMI Staff Planner V550/V559 — route-aware low-egress loader + cached-render guard
   Loaded after every legacy patch so this becomes the final loadAllData/route loader.
   It does not alter roster, OT, balance, eligibility, or trade formulas.
*/
(function(){
  'use strict';
  const VERSION='V550_ROUTE_TRADE_STABILITY';
  if(window.__CNMI_V550_ROUTE_TRADE_STABILITY__) return;
  window.__CNMI_V550_ROUTE_TRADE_STABILITY__=true;

  const memory=new Map();
  const pending=new Map();
  const STATIC_TTL=5*60*1000;
  const PAGE_TTL=25*1000;
  const ERROR_TTL=45*1000;
  const STANDARD_PAGES=new Set([
    'dashboard','calendar','leave','myProfile','activities','schedule','tradeRequests',
    'positionMonthView','positions','ot','audit','hr','hrSummary','scheduler',
    'positionMonth','profileRequests','users','eligibility','positionManagement','internManagement'
  ]);

  function appState(){try{return state;}catch(_){return window.state||null;}}
  function client(){try{return sb;}catch(_){return window.sb||null;}}
  function isAdminSafe(){try{return typeof isAdmin==='function'&&isAdmin();}catch(_){return false;}}
  function pad2(n){return String(n).padStart(2,'0');}
  function dateKey(value){
    try{
      if(typeof normalizeDateKey==='function') return String(normalizeDateKey(value)||'').slice(0,10);
    }catch(_){ }
    const d=value instanceof Date?new Date(value):new Date(String(value||''));
    if(Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  }
  function monthKeySafe(value){
    const raw=String(value||'').slice(0,7);
    if(/^\d{4}-\d{2}$/.test(raw)) return raw;
    const d=value instanceof Date?value:new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
  }
  function monthRange(key){
    const mk=monthKeySafe(key);
    const [y,m]=mk.split('-').map(Number);
    const last=new Date(y,m,0).getDate();
    return {key:mk,start:`${mk}-01`,end:`${mk}-${pad2(last)}`,year:y,month:m};
  }
  function addDays(key,days){
    const d=new Date(`${dateKey(key)}T12:00:00`);
    d.setDate(d.getDate()+days);
    return dateKey(d);
  }
  function calendarRange(){
    const st=appState();
    const base=st?.calendarDate instanceof Date?new Date(st.calendarDate):new Date(st?.calendarDate||Date.now());
    const view=String(st?.calendarView||'month');
    if(view==='day'){
      const d=dateKey(base);return {start:d,end:d};
    }
    if(view==='week'){
      const d=dateKey(base);return {start:addDays(d,-base.getDay()),end:addDays(d,6-base.getDay())};
    }
    const first=new Date(base.getFullYear(),base.getMonth(),1);
    const start=new Date(first);start.setDate(1-first.getDay());
    const end=new Date(start);end.setDate(start.getDate()+41);
    return {start:dateKey(start),end:dateKey(end)};
  }
  function fiscalRange(){
    const now=new Date();
    const y=now.getFullYear();
    const fiscalEndYear=(now.getMonth()+1)>=10?y+1:y;
    return {start:`${fiscalEndYear-1}-10-01`,end:`${fiscalEndYear+1}-09-30`};
  }
  function recentMonths(back=12,ahead=3){
    const now=new Date();
    const s=new Date(now.getFullYear(),now.getMonth()-back,1);
    const e=new Date(now.getFullYear(),now.getMonth()+ahead+1,0);
    return {start:dateKey(s),end:dateKey(e)};
  }
  function selectedMonthFor(page){
    const st=appState();
    if(page==='positionMonth') return st?.positionMonthKey||st?.monthKey;
    if(page==='positionMonthView') return st?.positionMonthViewKey||st?.monthKey;
    if(page==='ot') return st?.otSourceMonthV241||st?.otMoneyMonthV241||st?.otApprovalMonthFilter||st?.monthKey;
    return st?.monthKey;
  }
  function setSync(text){
    try{const el=document.getElementById('syncStatus');if(el)el.textContent=text;}catch(_){ }
  }
  function ordered(rows){
    try{return typeof orderedStaff==='function'?orderedStaff(rows):rows;}catch(_){return rows;}
  }
  function applyRows(name,rows){
    const st=appState();if(!st)return;
    if(name==='staff') {
      // Preserve the ordered list identity on a TTL cache hit. Navigation uses
      // object identity to decide whether the page needs another full render.
      if(staffOrderSource!==rows){staffOrderSource=rows;staffOrderValue=ordered(rows||[]);}
      if(st.staff!==staffOrderValue)st.staff=staffOrderValue;
    }else if(st[name]!==rows)st[name]=rows||[];
  }
  let staffOrderSource=null,staffOrderValue=null;
  function mergeRowsById(name,rows){
    const st=appState();if(!st)return;
    const current=Array.isArray(st[name])?st[name]:[];
    const map=new Map();
    [...current,...(rows||[])].forEach(row=>{
      if(!row)return;
      const key=String(row.id??`${row.from_assignment_id||''}|${row.requester_id||''}|${row.receiver_id||''}|${row.created_at||''}`);
      if(key)map.set(key,row);
    });
    const merged=[...map.values()];
    if(current.length!==merged.length||current.some((row,index)=>row!==merged[index]))st[name]=merged;
  }
  async function cached(key,ttl,fetcher,apply,options={}){
    const force=!!options.force;
    const now=Date.now();
    const saved=memory.get(key);
    if(!force&&saved&&saved.expiresAt>now){
      if(saved.ok&&apply) apply(saved.value);
      return saved.ok?saved.value:null;
    }
    if(!force&&pending.has(key)){
      const value=await pending.get(key);
      if(value!==null&&apply) apply(value);
      return value;
    }
    const task=(async()=>{
      try{
        const result=await fetcher();
        if(result?.error) throw result.error;
        const value=result?.data??[];
        memory.set(key,{ok:true,value,expiresAt:Date.now()+ttl});
        return value;
      }catch(error){
        memory.set(key,{ok:false,error,expiresAt:Date.now()+ERROR_TTL});
        console.warn(`[${VERSION}] ${key} skipped`,error);
        return null;
      }
    })();
    pending.set(key,task);
    try{
      const value=await task;
      if(value!==null&&apply) apply(value);
      return value;
    }finally{pending.delete(key);}
  }
  async function group(tasks){await Promise.all(tasks.filter(Boolean));}
  function qStaff(force){
    const db=client();if(!db)return null;
    return cached('staff:all',STATIC_TTL,()=>db.from('staff_profiles').select('*').order('staff_type').order('nickname'),v=>applyRows('staff',v),{force});
  }
  function qLeaves(range,force){
    const db=client();if(!db)return null;
    return cached(`leaves:${range.start}:${range.end}`,PAGE_TTL,()=>db.from('leave_requests').select('*').gte('end_date',range.start).lte('start_date',range.end).order('start_date',{ascending:false}),v=>applyRows('leaves',v),{force});
  }
  function qActivities(range,force){
    const db=client();if(!db)return null;
    return cached(`activities:${range.start}:${range.end}`,PAGE_TTL,()=>db.from('activity_events').select('*').gte('end_date',range.start).lte('start_date',range.end).order('start_date'),v=>applyRows('activities',v),{force});
  }
  function qRoster(range,force){
    const db=client();if(!db)return null;
    return cached(`roster:${range.start}:${range.end}`,PAGE_TTL,()=>db.from('roster_assignments').select('*').gte('duty_date',range.start).lte('duty_date',range.end).order('duty_date'),v=>applyRows('rosterAssignments',v),{force});
  }
  function qPositions(range,force){
    const db=client();if(!db)return null;
    return cached(`positions:${range.start}:${range.end}`,PAGE_TTL,()=>db.from('daily_positions').select('*').gte('work_date',range.start).lte('work_date',range.end).order('work_date').order('position_code'),v=>applyRows('positions',v),{force});
  }
  function qDayStatus(range,force){
    const db=client();if(!db)return null;
    return cached(`position-status:${range.start}:${range.end}`,PAGE_TTL,()=>db.from('daily_position_day_status').select('*').gte('work_date',range.start).lte('work_date',range.end).order('work_date'),v=>applyRows('positionDayStatus',v),{force});
  }
  function qAttendance(range,force){
    const db=client();if(!db)return null;
    return cached(`attendance:${range.start}:${range.end}`,PAGE_TTL,()=>db.from('attendance_logs').select('*').gte('duty_date',range.start).lte('duty_date',range.end).order('duty_date',{ascending:false}),v=>applyRows('attendance',v),{force});
  }
  function qOt(range,force){
    const db=client();if(!db)return null;
    let query=db.from('ot_requests').select('*').gte('work_date',range.start).lte('work_date',range.end).order('work_date',{ascending:false});
    if(!isAdminSafe()){
      try{const sid=typeof currentStaffId==='function'?currentStaffId():'';if(sid)query=query.eq('staff_id',sid);}catch(_){ }
    }
    return cached(`ot:${isAdminSafe()?'admin':'staff'}:${range.start}:${range.end}`,PAGE_TTL,()=>query,v=>applyRows('otRequests',v),{force});
  }
  function qTrades(range,force){
    const db=client();if(!db)return null;
    return cached(`trades:${range.start}:${range.end}`,PAGE_TTL,()=>db.from('roster_trade_requests').select('*').gte('created_at',`${range.start}T00:00:00`).lte('created_at',`${range.end}T23:59:59`).order('created_at',{ascending:false}),v=>mergeRowsById('tradeRequests',v),{force});
  }
  function qCompletedTradesAll(force){
    const db=client();if(!db)return null;
    return cached('trades:completed:all',PAGE_TTL,()=>db.from('roster_trade_requests').select('*').eq('status','completed').order('created_at',{ascending:false}).limit(2000),v=>mergeRowsById('tradeRequests',v),{force});
  }
  function qHolidays(range,force){
    const db=client();if(!db)return null;
    return cached(`holidays:${range.start}:${range.end}`,STATIC_TTL,()=>db.from('public_holidays').select('*').gte('holiday_date',range.start).lte('holiday_date',range.end).order('holiday_date'),v=>applyRows('holidays',v),{force});
  }
  function qIncharges(range,force){
    const db=client();if(!db)return null;
    const start=range.start.slice(0,7),end=range.end.slice(0,7);
    return cached(`incharges:${start}:${end}`,STATIC_TTL,()=>db.from('monthly_incharges').select('*').gte('month_key',start).lte('month_key',end).order('month_key',{ascending:false}),v=>applyRows('incharges',v),{force});
  }
  function qRosterMonths(mr,force){
    const db=client();if(!db)return null;
    return cached(`roster-month:${mr.key}`,STATIC_TTL,()=>db.from('roster_months').select('*').eq('year',mr.year).eq('month',mr.month).limit(5),v=>applyRows('rosterMonths',v),{force});
  }
  function qHrChecks(force){
    const db=client();if(!db||!isAdminSafe())return null;
    return cached('hr-checks:admin',PAGE_TTL,()=>db.from('hr_checks').select('*').order('updated_at',{ascending:false}).limit(1500),v=>applyRows('hrChecks',v),{force});
  }
  function qAudit(force){
    const db=client(),st=appState();if(!db)return null;
    const day=dateKey(st?.auditDate||'');
    const key=day?`audit:${day}`:'audit:latest';
    const factory=()=>{
      let query=db.from('audit_logs').select('*').order('created_at',{ascending:false});
      if(day) query=query.gte('created_at',`${day}T00:00:00`).lte('created_at',`${day}T23:59:59`).limit(500);
      else query=query.limit(250);
      return query;
    };
    return cached(key,PAGE_TTL,factory,v=>applyRows('auditLogs',v),{force});
  }
  function qShiftConfirmations(range,force){
    const db=client();if(!db)return null;
    return cached(`shift-confirmations:${range.start}:${range.end}`,PAGE_TTL,()=>db.from('shift_confirmations').select('*').gte('work_date',range.start).lte('work_date',range.end).order('work_date',{ascending:false}),v=>{
      applyRows('shiftConfirmations',v);
      const st=appState();if(st)st.shiftConfirmationReadyV209=true;
    },{force}).then(value=>{
      if(value===null){const st=appState();if(st){st.shiftConfirmations=[];st.shiftConfirmationReadyV209=false;}}
      return value;
    });
  }
  async function qPositionConfig(force){
    const tasks=[];
    if(window.cnmiV260?.refreshPermissionsFromDatabase){
      tasks.push(cached('position-permissions:all',STATIC_TTL,async()=>{
        await window.cnmiV260.refreshPermissionsFromDatabase({render:false,silent:true,force:true,allowEmpty:true});
        return {data:(appState()?.positionEligibility||[]),error:null};
      },v=>applyRows('positionEligibility',v),{force}));
    }
    if(window.cnmiV260?.refreshSlotTemplatesFromDatabase){
      tasks.push(cached('position-templates:all',STATIC_TTL,async()=>{
        await window.cnmiV260.refreshSlotTemplatesFromDatabase({render:false,silent:true,force:true});
        return {data:(appState()?.positionMasters||[]),error:null};
      },v=>applyRows('positionMasters',v),{force}));
    }
    if(window.cnmiV271?.loadTrainingAssignments){
      tasks.push(cached('training-assignments:all',STATIC_TTL,async()=>{
        await window.cnmiV271.loadTrainingAssignments({force:true});
        return {data:(appState()?.trainingAssignmentsV271||appState()?.trainingAssignments||[]),error:null};
      },v=>{
        const st=appState();if(st){st.trainingAssignmentsV271=v||[];st.trainingAssignments=v||[];}
      },{force}));
    }
    await group(tasks);
  }
  async function qDutyEligibility(force){
    const fn=window.refreshDutyEligibilityFromDbV197;
    if(typeof fn!=='function')return;
    await cached('duty-eligibility:all',STATIC_TTL,async()=>{
      await fn({clearDraft:false,toast:false});
      return {data:(appState()?.dutyEligibilityV197||appState()?.dutyEligibility||[]),error:null};
    },v=>{const st=appState();if(st){st.dutyEligibilityV197=v||[];st.dutyEligibility=v||[];}},{force});
  }
  async function qProfileRequests(force){
    const fn=window.loadProfileChangeRequests||(typeof loadProfileChangeRequests==='function'?loadProfileChangeRequests:null);
    if(typeof fn!=='function')return;
    await cached(`profile-requests:${isAdminSafe()?'admin':'self'}`,PAGE_TTL,async()=>{
      await fn();return {data:(appState()?.profileChangeRequests||[]),error:null};
    },v=>applyRows('profileChangeRequests',v),{force});
  }

  async function loadPageData(page,options={}){
    const st=appState();
    if(!st?.profile||!client())return;
    const force=!!options.force;
    const p=String(page||st.page||'dashboard');
    setSync('กำลังโหลด');
    try{
      // Start independent route requests immediately; the staff list is only
      // required before the caller renders the completed page.
      const staffTask=qStaff(force);
      const today=dateKey(new Date());
      const todayRange={start:today,end:today};
      const mr=monthRange(selectedMonthFor(p));
      const fiscal=fiscalRange();

      if(p==='dashboard'){
        const now=new Date();const yearRange={start:`${now.getFullYear()}-01-01`,end:mr.end};
        // V550: RACE and the duty summary must always see completed trades, even when
        // the trade request was created outside the route loader's rolling created_at window.
        // Merge instead of replace so a later route refresh cannot make RACE revert.
        await group([qLeaves(yearRange,force),qActivities(todayRange,force),qRoster(mr,force),qPositions(todayRange,force),qAttendance(todayRange,force),qOt(mr,force),qCompletedTradesAll(force),qHolidays(mr,force),qIncharges(mr,force),qDayStatus(todayRange,force)]);
      }else if(p==='calendar'){
        const r=calendarRange();
        await group([qLeaves(r,force),qActivities(r,force),qRoster(r,force),qHolidays(r,force),qHrChecks(force)]);
      }else if(p==='leave'){
        await group([qLeaves(fiscal,force),qHolidays(fiscal,force),qHrChecks(force)]);
      }else if(p==='activities'){
        const r=recentMonths(6,6);await qActivities(r,force);
      }else if(p==='schedule'){
        await group([qRosterMonths(mr,force),qRoster(mr,force),qLeaves(mr,force),qHolidays(mr,force),qAttendance(mr,force),qOt(mr,force),qTrades(recentMonths(6,6),force),qShiftConfirmations(mr,force),qIncharges(mr,force)]);
      }else if(p==='tradeRequests'){
        const r=recentMonths(12,6);await group([qTrades(r,force),qRoster(r,force),qOt(r,force)]);
      }else if(p==='positionMonthView'||p==='positionMonth'){
        await group([qPositions(mr,force),qDayStatus(mr,force),qLeaves(mr,force),qActivities(mr,force),qHolidays(mr,force),qIncharges(mr,force),qRoster(mr,force)]);
        await qPositionConfig(force);
      }else if(p==='positions'){
        const d=dateKey(st.positionDate||today),r={start:d,end:d};
        await group([qPositions(r,force),qDayStatus(r,force),qLeaves(r,force),qActivities(r,force),qHolidays(r,force),qIncharges(r,force),qRoster(r,force)]);
        await qPositionConfig(force);
      }else if(p==='ot'){
        // V318: OT page reads only the selected source month. Export history uses its own
        // staff+year+month query after all filters are selected, so no multi-year preload is needed.
        await group([qOt(mr,force),qRoster(mr,force),qAttendance(mr,force),qHolidays(mr,force),qIncharges(mr,force),qShiftConfirmations(mr,force)]);
      }else if(p==='audit'){
        await qAudit(force);
      }else if(p==='hr'||p==='hrSummary'){
        await group([qLeaves(fiscal,force),qHrChecks(force)]);
      }else if(p==='scheduler'){
        await group([qRosterMonths(mr,force),qRoster(mr,force),qLeaves(mr,force),qActivities(mr,force),qHolidays(mr,force),qPositions(mr,force),qDayStatus(mr,force)]);
        await qPositionConfig(force);
        await qDutyEligibility(force);
      }else if(p==='eligibility'||p==='positionManagement'||p==='internManagement'){
        await qPositionConfig(force);
      }else if(p==='myProfile'||p==='profileRequests'){
        await qProfileRequests(force);
      }
      await staffTask;
      setSync('พร้อมใช้งาน');
    }catch(error){
      console.error(`[${VERSION}] page load failed`,p,error);
      setSync('โหลดบางส่วนไม่สำเร็จ');
    }
  }

  const legacyLoad=window.loadAllData||(typeof loadAllData==='function'?loadAllData:null);
  const finalLoad=async function loadAllDataV316(options={}){
    const force=options===true||options?.force===true;
    return loadPageData(appState()?.page||'dashboard',{force});
  };
  finalLoad.__v316RouteAware=true;
  try{window.loadAllData=loadAllData=finalLoad;}catch(_){window.loadAllData=finalLoad;}

  /* V559: avoid a second heavy DOM render when route data came from the same
     in-memory objects. This is especially important on mobile Safari where rebuilding
     the page + sidebar twice makes a normal menu tap feel frozen. */
  const stampIds=new WeakMap();let stampSeq=0;
  function refId(value){
    if(!value||((typeof value!=='object')&&(typeof value!=='function')))return String(value);
    let id=stampIds.get(value);if(!id){id=++stampSeq;stampIds.set(value,id);}return `@${id}`;
  }
  function stateStamp(){
    const st=appState();if(!st)return '';
    const parts=[];
    for(const key of Object.keys(st).sort()){
      const value=st[key];
      if(value instanceof Date){parts.push(`${key}:${value.getTime()}`);continue;}
      const type=typeof value;
      if(value&&type==='object'){parts.push(`${key}:${refId(value)}`);continue;}
      if(type==='string'||type==='number'||type==='boolean'||value==null)parts.push(`${key}:${String(value)}`);
    }
    return parts.join('|');
  }

  const previousClick=window.handleClick||(typeof handleClick==='function'?handleClick:null);
  if(typeof previousClick==='function'){
    const wrappedClick=async function handleClickV559(event){
      const target=event.target?.closest?.('button,[data-page],[data-cal-nav],[data-cal-view]');
      const page=String(target?.dataset?.page||'');
      if(page&&STANDARD_PAGES.has(page)){
        event.preventDefault();
        event.stopPropagation();
        const st=appState();
        const samePage=String(st?.page||'')===page;
        const plainMainNav=!!target?.closest?.('#mainNav .nav-btn[data-page]')&&!target?.closest?.('.v523-nav-tree,.v524-nav-tree');
        if(samePage&&plainMainNav){
          try{document.getElementById('sidebar')?.classList.remove('open');document.body.classList.remove('sidebar-open');}catch(_){ }
          return;
        }
        if(st)st.page=page;
        try{document.getElementById('sidebar')?.classList.remove('open');document.body.classList.remove('sidebar-open');}catch(_){ }
        try{if(typeof renderPage==='function')renderPage();}catch(_){ }
        const before=stateStamp();
        await loadPageData(page,{force:false});
        const after=stateStamp();
        /* Re-render only when the loader actually replaced state/data. Cache hits no
           longer force an identical second render. */
        if(after!==before){
          try{if(appState()?.page===page&&typeof renderPage==='function')renderPage();}catch(_){ }
        }
        return;
      }
      const isCalendar=!!(target?.dataset?.calNav||target?.dataset?.calView);
      const result=await previousClick.apply(this,arguments);
      if(isCalendar&&appState()?.page==='calendar'){
        const before=stateStamp();
        await loadPageData('calendar',{force:false});
        if(stateStamp()!==before){
          try{if(typeof renderPage==='function')renderPage();}catch(_){ }
        }
      }
      return result;
    };
    try{window.handleClick=handleClick=wrappedClick;}catch(_){window.handleClick=wrappedClick;}
  }

  const previousChange=window.handleChange||(typeof handleChange==='function'?handleChange:null);
  if(typeof previousChange==='function'){
    const reloadIds=new Set(['rosterMonthInput','scheduleMonthInput','positionDateInput','positionMonthInput','positionMonthViewInput','otApprovalMonthFilter','otMoneyMonthV241','otSourceMonthV241','auditDateInput']);
    const wrappedChange=async function handleChangeV559(event){
      const id=String(event.target?.id||'');
      const result=previousChange.apply(this,arguments);
      if(result&&typeof result.then==='function')await result;
      if(reloadIds.has(id)){
        const page=appState()?.page||'dashboard';
        const before=stateStamp();
        await loadPageData(page,{force:false});
        if(stateStamp()!==before){
          try{if(typeof renderPage==='function')renderPage();}catch(_){ }
        }
      }
      return result;
    };
    try{window.handleChange=handleChange=wrappedChange;}catch(_){window.handleChange=wrappedChange;}
  }

  window.addEventListener('cnmi:v316-cache-invalidated',()=>memory.clear());
  window.cnmiV316={
    version:VERSION,
    loadPageData,
    qCompletedTradesAll,
    clearCache(){memory.clear();pending.clear();window.cnmiV316FetchGuard?.clear?.();},
    cacheKeys(){return [...memory.keys()];},
    legacyLoad
  };
  console.info(`[${VERSION}] loaded`);
})();

} catch (error) { console.error("[v569] patch-v550-route-loader-trade-stability.js", error); }
;

/* Original source: patch-v318-hr-carry-year-month-filter.js */
try {
/* CNMI Staff Planner V371/V527 — balanced HR dummy allocation + automatic carry forward + adjustment ledger
   - Uses V317 manual-style HR workbook and 8-hour dummy allocation as the base.
   - Automatically adds the latest carry-out to the next source month before allocation.
   - Stores an exact carry snapshot inside the existing claim_batch_id field; no new SQL/table.
   - Migrates the first carry from a V317 batch by deriving the latest exported month remainder.
   - Export history stays blank until staff, year, and month are all selected.
*/
(function(){
  'use strict';
  const VERSION='V371_BALANCED_HR_DUMMY_ALLOCATION';
  if(window.__CNMI_V371_BALANCED_HR_DUMMY_ALLOCATION__)return;
  window.__CNMI_V371_BALANCED_HR_DUMMY_ALLOCATION__=true;

  const previousRenderOtPage=window.renderOtPage||(typeof renderOtPage==='function'?renderOtPage:null);
  const historyCache=new Map();
  const carryCache=new Map();
  const summaryCarryCache=new Map();
  const HISTORY_TTL=60*1000;
  const CARRY_TTL=5*60*1000;
  const CARRY_MARKER_PREFIX='V318CARRY';

  function st(){try{return state;}catch(_){return window.state||{};}}
  function db(){try{return sb;}catch(_){return window.sb||null;}}
  function admin(){try{return typeof isAdmin==='function'&&isAdmin();}catch(_){return false;}}
  function pad2(n){return String(n).padStart(2,'0');}
  function round2(v){const n=Number(v||0);return Number.isFinite(n)?Math.round(n*100)/100:0;}
  function round4(v){const n=Number(v||0);return Number.isFinite(n)?Math.round(n*10000)/10000:0;}
  function esc(v){
    try{return escapeHtml(v==null?'':String(v));}
    catch(_){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  }
  function toast(msg,tone){try{showToast(msg,tone?{tone}:undefined);}catch(_){console.info(msg);}}
  function busy(on,text){try{setBusy(on,text);}catch(_){}}
  function currentStaffIdSafe(){try{return currentStaffId();}catch(_){return st()?.profile?.id||'';}}
  function dateKey(v){
    if(v instanceof Date&&!Number.isNaN(v.getTime()))return `${v.getFullYear()}-${pad2(v.getMonth()+1)}-${pad2(v.getDate())}`;
    try{return String(normalizeDateKey(v)||'').slice(0,10);}
    catch(_){return String(v||'').slice(0,10);}
  }
  function currentMonth(){const d=new Date();return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;}
  function monthKey(v){const k=String(v||'').slice(0,7);return /^\d{4}-\d{2}$/.test(k)?k:currentMonth();}
  function monthRange(v){const key=monthKey(v),[y,m]=key.split('-').map(Number),last=new Date(y,m,0).getDate();return {month:key,start:`${key}-01`,end:`${key}-${pad2(last)}`};}
  const HR_LOCK_STORAGE_PREFIX='cnmi.staffplanner.hrLockedDatesV604.';
  function hrLockedDates(month){
    const key=monthKey(month),stateMap=st().hrLockedDatesV604ByMonth||{};
    if(Array.isArray(stateMap[key]))return [...new Set(stateMap[key].map(dateKey).filter(Boolean))].sort();
    let dates=[];try{dates=JSON.parse(localStorage.getItem(HR_LOCK_STORAGE_PREFIX+key)||'[]');}catch(_){dates=[];}
    dates=[...new Set((Array.isArray(dates)?dates:[]).map(dateKey).filter(Boolean))].sort();
    st().hrLockedDatesV604ByMonth={...stateMap,[key]:dates};return dates;
  }
  function saveHrLockedDates(month,dates){
    const key=monthKey(month),cycle=cycleRange(key),clean=[...new Set((dates||[]).map(dateKey).filter(d=>d>=cycle.start&&d<=cycle.end))].sort();
    st().hrLockedDatesV604ByMonth={...(st().hrLockedDatesV604ByMonth||{}),[key]:clean};
    try{localStorage.setItem(HR_LOCK_STORAGE_PREFIX+key,JSON.stringify(clean));}catch(_){ }
    return clean;
  }
  function hrLockedDatePanel(month){
    const key=monthKey(month),cycle=cycleRange(key),dates=hrLockedDates(key);
    const tags=dates.length?dates.map(d=>`<span class="badge blue" style="display:inline-flex;align-items:center;gap:6px;margin:2px 4px 2px 0">${esc(fmtDate(d))}<button type="button" class="tiny-btn" style="padding:1px 6px" data-v604-remove-lock-date="${esc(d)}" title="เอาวันนี้ออก">×</button></span>`).join(''):'<span class="muted">ยังไม่ได้ล็อกวันที่ — ระบบจะเฉลี่ยวันตามปกติ</span>';
    return `<div class="card" data-v604-lock-panel style="margin-bottom:12px"><div class="section-title"><div><h3>ล็อกวันที่ให้ทุกคนมีชื่อ</h3><p class="hint">เลือกวันในรอบ HR ${esc(cycle.start)} ถึง ${esc(cycle.end)} • ระบบจะย้ายเวร 8 ชม. เดิมมาไว้วันที่ล็อก โดยไม่เพิ่มยอด OT รวม • วันลามีสิทธิ์เหนือกฎนี้</p></div></div><div class="toolbar compact-filter" style="align-items:end"><label>วันที่พิเศษ <input id="hrLockDateV604" type="date" min="${esc(cycle.start)}" max="${esc(cycle.end)}"></label><button type="button" class="ghost-btn" data-v604-add-lock-date>+ เพิ่มวันที่</button></div><div style="margin-top:8px">${tags}</div><p class="hint" style="margin-top:8px">คำว่า “ทุกคน” หมายถึงเจ้าหน้าที่ที่มียอดพอสร้างเวร HR 8 ชม. ในรอบนี้ หากยอดไม่พอหรือความจุวันนั้นไม่พอ ระบบจะหยุด Export และแจ้งชื่อแทนการเพิ่มยอดเอง</p></div>`;
  }
  function nextMonth(v){const [y,m]=monthKey(v).split('-').map(Number),d=new Date(y,m,1);return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;}
  function previousMonth(v){const [y,m]=monthKey(v).split('-').map(Number),d=new Date(y,m-2,1);return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;}
  function cycleRange(v){const key=monthKey(v);return {start:`${key}-16`,end:`${nextMonth(key)}-15`};}
  function addDays(key,n){const d=new Date(`${dateKey(key)}T12:00:00`);d.setDate(d.getDate()+Number(n||0));return dateKey(d);}
  function datesBetween(start,end){const out=[];let d=dateKey(start),guard=0;while(d&&d<=end&&guard++<100){out.push(d);d=addDays(d,1);}return out;}
  function fmtDate(v){try{return formatThaiDate(dateKey(v));}catch(_){return dateKey(v)||'-';}}
  function fmtDateTime(v){try{return v?new Date(v).toLocaleString('th-TH'):'-';}catch(_){return String(v||'-');}}
  function hours(v,digits=2){const n=round2(v);if(Math.abs(n)<0.005)return '0';return Number.isInteger(n)?String(n):n.toFixed(digits).replace(/0+$/,'').replace(/\.$/,'');}
  function money(v){const n=round2(v);return `${n.toLocaleString('th-TH',{maximumFractionDigits:2})} บ.`;}
  function staffRecord(id){return (st().staff||[]).find(x=>String(x.id)===String(id))||null;}
  function staffNickSafe(id){const s=staffRecord(id)||{};return s.nickname||s.full_name||s.name||s.email||String(id||'-');}
  function staffFullName(id){const s=staffRecord(id)||{};return s.full_name||s.name||s.nickname||s.email||String(id||'-');}
  function staffPillSafe(id){try{return staffPill(id);}catch(_){return `<span class="staff-pill">${esc(staffNickSafe(id))}</span>`;}}
  function baseType(id){const s=staffRecord(id)||{};return /เคิก|clerk/i.test(String(s.staff_type||s.type||''))?'เคิก':'MT';}
  function baseRate(id){return baseType(id)==='เคิก'?90:130;}
  function claimCodes(id){return baseType(id)==='เคิก'?{normal:'00000076',holiday:'00000077',premium:'00000076',special:'00000328'}:{normal:'00000074',holiday:'00000075',premium:'00000076',special:'00000328'};}
  function employeeCode(id){const s=staffRecord(id)||{},raw=String(s.employee_code||s.emp_code||s.code||'').replace(/\D/g,'');return raw?raw.padStart(7,'0'):'';}
  function isTang(id){const s=staffRecord(id)||{},raw=`${s.nickname||''} ${s.full_name||''}`;return /(^|\s)แตง($|\s)|อริภัศ/.test(raw);}
  function isPumpingText(row){return /ปั่นเลือด|ห้อง\s*donor|blood\s*spin/i.test(`${row?.reason||''} ${row?.note||''}`);}
  function publicHoliday(date,holidayRows){
    const d=dateKey(date);
    if(Array.isArray(holidayRows))return holidayRows.some(h=>dateKey(h.holiday_date||h.date)===d);
    try{return !!isHolidayDate(d);}catch(_){return false;}
  }
  function weekend(date){const d=new Date(`${dateKey(date)}T12:00:00`),day=d.getDay();return day===0||day===6;}
  function thaiWeekday(date){return ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'][new Date(`${dateKey(date)}T12:00:00`).getDay()];}
  function approved(row){const s=String(row?.status||'').trim().toLowerCase();return ['อนุมัติ','approved','approve'].includes(s);}
  function claimStatus(row){const s=String(row?.claim_status||'pending').trim().toLowerCase();return ['claimed','exported','hr_exported','เบิกแล้ว','export แล้ว'].includes(s)?'exported':'pending';}
  function rowBatch(row){return row?.export_batch_id||row?.batch_id||row?.claim_batch_id||'ไม่พบ Batch ID';}
  function rowExportedAt(row){return row?.exported_at||row?.export_date||row?.claimed_at||'';}
  function encodeCarryMarker(sourceMonth,carry){return `${CARRY_MARKER_PREFIX}|${monthKey(sourceMonth)}|${hours(carry)}`;}
  function parseCarryMarker(row){
    const raw=String(row?.claim_batch_id||'').trim();
    const m=raw.match(/^V318CARRY\|(\d{4}-\d{2})\|(-?\d+(?:\.\d+)?)$/);
    if(!m)return null;
    const amount=round2(m[2]);
    return {month:m[1],amount:Math.max(0,amount),at:String(rowExportedAt(row)||'')};
  }

  /* Tang must use clerk HR code/base even when the actual task is paid at MT rate. */
  const v190=window.v190HrRateNormalization;
  const originalBreakdown=v190?.otNormalizationBreakdown190;
  if(v190&&typeof originalBreakdown==='function'&&!originalBreakdown.__v318TangBase){
    const wrapped=function otNormalizationBreakdownV318(row){
      const n=originalBreakdown.call(this,row)||{};
      if(!isTang(row?.staff_id))return n;
      const actual=round2(n.actualHours||0);
      if(actual<=0)return n;
      const isHoliday=publicHoliday(row?.work_date);
      let segments=Array.isArray(n.segments)&&n.segments.length?n.segments.map(x=>({...x})):[];
      const forceMt=isPumpingText(row);
      if(!segments.length)segments=[{actualHours:actual,rateType:forceMt?'MT':'เคิก',shiftType:n.shiftType||'-',isHoliday}];
      let actualSum=0,hrSum=0;
      segments=segments.map(seg=>{
        const segActual=round2(seg.actualHours||0);
        const mtWork=forceMt||String(seg.rateType||'').toUpperCase()==='MT'||['ช3A','ช3B','ช4','ช4A','ช4B'].includes(String(seg.shiftType||''));
        const workRate=mtWork?(isHoliday?160:130):(isHoliday?120:90);
        const hr=round2(segActual*workRate/90);
        actualSum=round2(actualSum+segActual);hrSum=round2(hrSum+hr);
        return {...seg,actualHours:segActual,hrHours:hr,sourceRateType:mtWork?'MT':'เคิก',rateType:'เคิก',normalRate:90,holidayRate:90,appliedRate:workRate,workRate,isHoliday,multiplier:round2(workRate/90)};
      });
      if(Math.abs(actualSum-actual)>0.11){
        const workRate=forceMt?(isHoliday?160:130):(isHoliday?120:90);
        segments=[{actualHours:actual,hrHours:round2(actual*workRate/90),sourceRateType:forceMt?'MT':'เคิก',rateType:'เคิก',normalRate:90,holidayRate:90,appliedRate:workRate,workRate,isHoliday,multiplier:round2(workRate/90),shiftType:n.shiftType||'-'}];
        hrSum=segments[0].hrHours;
      }
      return {...n,actualHours:actual,hrHours:round2(hrSum),segments,rateType:'เคิก',isHoliday,hrBaseRate:90,tangMtConversion:segments.some(x=>x.sourceRateType==='MT')};
    };
    wrapped.__v318TangBase=true;
    v190.otNormalizationBreakdown190=wrapped;
  }

  function normalize(row){
    try{
      const n=window.v190HrRateNormalization?.otNormalizationBreakdown190?.(row);
      if(n&&Number.isFinite(Number(n.hrHours))){
        const base=baseRate(row?.staff_id);
        const segments=Array.isArray(n.segments)?n.segments:[];
        const actualMoney=round2(segments.length?segments.reduce((sum,x)=>sum+Number(x.actualHours||0)*Number(x.appliedRate||base),0):Number(n.hrHours||0)*base);
        return {...n,actualHours:round2(n.actualHours),hrHours:round2(n.hrHours),baseRate:base,actualMoney};
      }
    }catch(_){ }
    let actual=0;try{actual=round2(calcOtHours(row)||0);}catch(_){actual=round2(row?.manual_hours||row?.requested_hours||row?.hours||0);}
    return {actualHours:actual,hrHours:actual,baseRate:baseRate(row?.staff_id),actualMoney:round2(actual*baseRate(row?.staff_id)),segments:[],shiftType:'-',rateType:baseType(row?.staff_id),isHoliday:publicHoliday(row?.work_date)};
  }

  function leaveEffective(l){
    const type=String(l?.type||l?.leave_type||'').trim();
    if(!type||type==='ไม่รับเวร')return false;
    const status=String(l?.status||'').trim().toLowerCase();
    return !/reject|cancelled|canceled|ไม่อนุมัติ|ยกเลิก/.test(status);
  }
  function hasLeave(staffId,date,leaves){
    const d=dateKey(date);
    return (leaves||[]).some(l=>String(l.staff_id)===String(staffId)&&leaveEffective(l)&&d>=dateKey(l.start_date||l.leave_date||l.date)&&d<=dateKey(l.end_date||l.start_date||l.leave_date||l.date));
  }
  function mergeRows(current,incoming,keyFn){
    const map=new Map();(current||[]).forEach(x=>map.set(keyFn(x),x));(incoming||[]).forEach(x=>map.set(keyFn(x),x));return [...map.values()];
  }
  async function queryCarryIn(month,force=false){
    const source=monthRange(month),key=source.month,saved=carryCache.get(key);
    if(!force&&saved&&saved.expires>Date.now())return saved.map;
    const client=db();if(!client)throw new Error('ไม่พบการเชื่อมต่อ Supabase');
    /* Runs only when Admin presses Export. It does not preload with the OT page. */
    const res=await client.from('ot_requests').select('*').lt('work_date',source.start).order('work_date',{ascending:false}).limit(5000);
    if(res.error)throw res.error;
    const exported=(res.data||[]).filter(row=>approved(row));
    const latestRowsByStaff=new Map(),markersByStaff=new Map();
    exported.forEach(row=>{
      const staffId=String(row.staff_id||''),mk=String(row.work_date||'').slice(0,7);
      if(!staffId||!/^[0-9]{4}-[0-9]{2}$/.test(mk)||mk>=source.month)return;
      const g=latestRowsByStaff.get(staffId);
      if(!g||mk>g.month)latestRowsByStaff.set(staffId,{month:mk,rows:[row]});
      else if(mk===g.month)g.rows.push(row);
      const marker=parseCarryMarker(row);
      if(marker&&marker.month<source.month){
        if(!markersByStaff.has(staffId))markersByStaff.set(staffId,[]);
        markersByStaff.get(staffId).push({...marker,rowId:row.id||''});
      }
    });
    markersByStaff.forEach(list=>list.sort((a,b)=>a.month.localeCompare(b.month)||a.at.localeCompare(b.at)));
    const out=new Map(),staffIds=new Set([...latestRowsByStaff.keys(),...markersByStaff.keys()]);
    staffIds.forEach(staffId=>{
      const latest=latestRowsByStaff.get(staffId),markers=markersByStaff.get(staffId)||[];
      const marker=markers[markers.length-1];
      /* A carry marker saved for the immediately previous month is the final
         carry-out shown by that month.  Pass it forward unchanged.  Do not
         reconstruct it from OT rows because that can turn (for example) June's
         displayed 5.14 into an unrelated 7.6 when July is opened. */
      if(latest&&latest.month===previousMonth(source.month)){
        const current=round2(latest.rows.reduce((sum,row)=>sum+Number(normalize(row).hrHours||0),0));
        /* Match the carry-out shown on the immediately previous month's
           summary.  An older marker is not an input here: adding it again is
           what changed June 5.14 into July 7.6. */
        const claimed=Math.floor((current+1e-7)/8)*8,amount=round2(Math.max(0,current-claimed));
        out.set(staffId,{amount,sourceMonth:latest.month,source:'previous-month-live-summary',anchorRowId:latest.rows[0]?.id||marker?.rowId||''});return;
      }
      const directMarker=[...markers].reverse().find(x=>x.month===previousMonth(source.month));
      if(directMarker){
        out.set(staffId,{amount:round2(directMarker.amount),sourceMonth:directMarker.month,source:'direct-previous-month-carry-fallback',anchorRowId:directMarker.rowId||''});return;
      }
      if(marker&&(!latest||marker.month>=latest.month)){
        out.set(staffId,{amount:round2(marker.amount),sourceMonth:marker.month,source:'saved-v318',anchorRowId:marker.rowId||''});return;
      }
      if(!latest)return;
      const total=round2(latest.rows.reduce((sum,row)=>sum+Number(normalize(row).hrHours||0),0));
      const claimed=Math.floor((total+1e-7)/8)*8,amount=round2(Math.max(0,total-claimed));
      out.set(staffId,{amount,sourceMonth:latest.month,source:'derived-v317',anchorRowId:latest.rows[0]?.id||''});
    });
    carryCache.set(key,{map:out,expires:Date.now()+CARRY_TTL});
    return out;
  }
  async function queryCarryInSummary(month,force=false){
    const source=monthRange(month),key=source.month,saved=summaryCarryCache.get(key),full=carryCache.get(key);
    if(!force&&full&&full.expires>Date.now())return full.map;
    if(!force&&saved&&saved.expires>Date.now())return saved.map;
    const client=db();if(!client)throw new Error('ไม่พบการเชื่อมต่อ Supabase');
    /* Summary mode keeps egress low: marker rows contain the saved V318 carry.
       Only the immediately previous month is read as a lightweight V317 fallback. */
    const prev=monthRange(previousMonth(source.month));
    const [markers,previousRows]=await Promise.all([
      client.from('ot_requests').select('id,staff_id,work_date,claim_batch_id,exported_at,export_date,claimed_at').lt('work_date',source.start).like('claim_batch_id',`${CARRY_MARKER_PREFIX}|%`).order('work_date',{ascending:false}).limit(1000),
      client.from('ot_requests').select('*').gte('work_date',prev.start).lte('work_date',prev.end).order('work_date',{ascending:false})
    ]);
    if(markers.error)throw markers.error;if(previousRows.error)throw previousRows.error;
    const markersByStaff=new Map();
    (markers.data||[]).forEach(row=>{const staffId=String(row.staff_id||''),marker=parseCarryMarker(row);if(!staffId||!marker||marker.month>=source.month)return;if(!markersByStaff.has(staffId))markersByStaff.set(staffId,[]);markersByStaff.get(staffId).push({...marker,rowId:row.id||''});});
    markersByStaff.forEach(list=>list.sort((a,b)=>a.month.localeCompare(b.month)||a.at.localeCompare(b.at)));
    const fallbackByStaff=new Map();
    /* The previous month's live approved rows are the source of truth.  A saved
       marker can become stale when Admin edits a rate/hours after HR export. */
    (previousRows.data||[]).filter(row=>approved(row)).forEach(row=>{const staffId=String(row.staff_id||'');if(!staffId)return;if(!fallbackByStaff.has(staffId))fallbackByStaff.set(staffId,[]);fallbackByStaff.get(staffId).push(row);});
    const out=new Map();
    new Set([...markersByStaff.keys(),...fallbackByStaff.keys()]).forEach(staffId=>{
      const markerList=markersByStaff.get(staffId)||[],marker=markerList[markerList.length-1],rows=fallbackByStaff.get(staffId)||[];
      if(rows.length){const current=round2(rows.reduce((sum,row)=>sum+Number(normalize(row).hrHours||0),0)),claimed=Math.floor((current+1e-7)/8)*8;out.set(staffId,{amount:round2(Math.max(0,current-claimed)),sourceMonth:prev.month,source:'previous-month-live-summary',anchorRowId:rows[0]?.id||marker?.rowId||''});return;}
      const directMarker=[...markerList].reverse().find(x=>x.month===prev.month);
      if(directMarker){out.set(staffId,{amount:round2(directMarker.amount),sourceMonth:directMarker.month,source:'direct-previous-month-carry-fallback',anchorRowId:directMarker.rowId||''});return;}
      if(marker)out.set(staffId,{amount:round2(marker.amount),sourceMonth:marker.month,source:'saved-v318',anchorRowId:marker.rowId||''});
    });
    summaryCarryCache.set(key,{map:out,expires:Date.now()+CARRY_TTL});
    return out;
  }
  async function queryExportData(month){
    const client=db();if(!client)throw new Error('ไม่พบการเชื่อมต่อ Supabase');
    const source=monthRange(month),cycle=cycleRange(month),holidayStart=source.start<cycle.start?source.start:cycle.start,holidayEnd=source.end>cycle.end?source.end:cycle.end;
    const queries=[
      client.from('ot_requests').select('*').gte('work_date',source.start).lte('work_date',source.end).order('work_date',{ascending:true}),
      client.from('leave_requests').select('*').gte('end_date',cycle.start).lte('start_date',cycle.end).order('start_date',{ascending:true}),
      client.from('public_holidays').select('*').gte('holiday_date',holidayStart).lte('holiday_date',holidayEnd).order('holiday_date',{ascending:true}),
      client.from('roster_assignments').select('*').gte('duty_date',source.start).lte('duty_date',source.end).order('duty_date',{ascending:true}),
      client.from('monthly_incharges').select('*').eq('month_key',source.month).limit(10),
      client.from('ot_adjustments').select('*').eq('apply_month',source.month).eq('status','pending').order('created_at',{ascending:true})
    ];
    const [ot,leaves,holidays,roster,incharges,adjustments]=await Promise.all(queries);
    for(const r of [ot,leaves,holidays,roster,incharges,adjustments])if(r?.error)throw r.error;
    const app=st();
    app.otRequests=mergeRows(app.otRequests,ot.data||[],x=>String(x.id||`${x.staff_id}|${x.work_date}|${x.created_at||''}`));
    app.leaves=mergeRows(app.leaves,leaves.data||[],x=>String(x.id||`${x.staff_id}|${x.start_date}|${x.end_date}`));
    app.holidays=mergeRows(app.holidays,holidays.data||[],x=>dateKey(x.holiday_date||x.date));
    app.rosterAssignments=mergeRows(app.rosterAssignments,roster.data||[],x=>String(x.id||`${x.staff_id}|${x.duty_date}|${x.duty_code}`));
    app.incharges=mergeRows(app.incharges,incharges.data||[],x=>String(x.id||x.month_key));
    return {source,cycle,rows:(ot.data||[]).filter(r=>approved(r)&&claimStatus(r)==='pending'),leaves:leaves.data||[],holidays:holidays.data||[],adjustments:adjustments.data||[]};
  }

  function applyAdjustmentUnits(totals,adjustments){
    const map=new Map((totals||[]).map(t=>[String(t.staff_id),t]));
    (adjustments||[]).forEach(adj=>{
      const sid=String(adj.staff_id||'');if(!sid)return;
      let t=map.get(sid);
      if(!t){
        t={staff_id:sid,actual:0,total:0,currentTotal:0,carryIn:0,carrySourceMonth:'',actualMoney:0,rows:[],baseType:baseType(sid),baseRate:baseRate(sid),employeeCode:employeeCode(sid)};
        map.set(sid,t);
      }
      if(t.regularAvailable==null)t.regularAvailable=round2(t.total||0);
      if(!Array.isArray(t.adjustments))t.adjustments=[];
      const units=round4(Number(adj.hr_unit_delta||0));
      const amount=round2(Number(adj.amount_delta||0));
      t.adjustmentUnits=(t.adjustmentUnits||0)+units;
      t.adjustmentAmount=round2((t.adjustmentAmount||0)+amount);
      t.adjustments.push(adj);
    });
    map.forEach(t=>{
      if(t.regularAvailable==null)t.regularAvailable=round2(t.total||0);
      const adjusted=round2(Number(t.regularAvailable||0)+Number(t.adjustmentUnits||0)*8);
      if(adjusted < -0.001) throw new Error(`ยอดลด OT ของ ${staffNickSafe(t.staff_id)} มากกว่ายอดที่มีในรอบนี้ กรุณาลดยอดทีละรอบ`);
      t.total=Math.max(0,adjusted);
    });
    return [...map.values()].filter(t=>Number(t.total||0)>0||Number(t.adjustmentAmount||0)!==0).sort((a,b)=>staffNickSafe(a.staff_id).localeCompare(staffNickSafe(b.staff_id),'th'));
  }

  function buildTotals(rows){
    const map=new Map();
    (rows||[]).forEach(row=>{
      const n=normalize(row);if(Number(n.hrHours||0)<=0)return;
      const id=String(row.staff_id||'');
      if(!map.has(id))map.set(id,{staff_id:id,actual:0,total:0,actualMoney:0,rows:[],baseType:baseType(id),baseRate:baseRate(id),employeeCode:employeeCode(id)});
      const t=map.get(id);t.actual=round2(t.actual+Number(n.actualHours||0));t.total=round2(t.total+Number(n.hrHours||0));t.actualMoney=round2(t.actualMoney+Number(n.actualMoney||0));t.rows.push({row,n});
    });
    return [...map.values()].sort((a,b)=>staffNickSafe(a.staff_id).localeCompare(staffNickSafe(b.staff_id),'th'));
  }
  function applyCarryIn(totals,carryMap){
    const map=new Map();
    (totals||[]).forEach(t=>{t.currentTotal=round2(t.total);t.carryIn=0;t.carrySourceMonth='';map.set(String(t.staff_id),t);});
    (carryMap instanceof Map?carryMap:new Map()).forEach((info,staffId)=>{
      const amount=round2(info?.amount||0);let t=map.get(String(staffId));
      if(!t&&amount>0){
        t={staff_id:String(staffId),actual:0,total:0,currentTotal:0,carryIn:0,carrySourceMonth:'',actualMoney:0,rows:[],baseType:baseType(staffId),baseRate:baseRate(staffId),employeeCode:employeeCode(staffId)};
        map.set(String(staffId),t);
      }
      if(!t)return;
      t.carryIn=amount;t.carrySourceMonth=String(info?.sourceMonth||'');t.carrySource=String(info?.source||'');t.carryAnchorRowId=String(info?.anchorRowId||'');
    });
    map.forEach(t=>{t.currentTotal=round2(t.currentTotal==null?t.total:t.currentTotal);t.total=round2(t.currentTotal+Number(t.carryIn||0));});
    return [...map.values()].filter(t=>Number(t.total||0)>0).sort((a,b)=>staffNickSafe(a.staff_id).localeCompare(staffNickSafe(b.staff_id),'th'));
  }
  function allowedSlots(date,holidays){return (weekend(date)||publicHoliday(date,holidays))?[0,8,16]:[0,16];}
  function slotTimes(slot){if(slot===8)return {start:'08:00',end:'16:00',startValue:8/24,endValue:16/24};if(slot===16)return {start:'16:00',end:'00:00',startValue:16/24,endValue:0};return {start:'00:00',end:'08:00',startValue:0,endValue:8/24};}
  function allocate(totals,cycle,leaves,holidays,lockedDates=[]){
    const dates=datesBetween(cycle.start,cycle.end);
    const dateCount=Math.max(1,dates.length);
    const totalUnits=(totals||[]).reduce((sum,t)=>sum+Math.max(0,Math.floor((Number(t.total||0)+1e-7)/8)),0);
    const occupancy=new Map(),dateOccupancy=new Map(),rows=[],leaveSkipped=[];
    const compareScore=(a,b)=>{for(let i=0;i<Math.max(a.length,b.length);i++){const av=Number(a[i]||0),bv=Number(b[i]||0);if(av<bv)return -1;if(av>bv)return 1;}return 0;};

    /*
      Build exact date targets before assigning any person.
      Normal weekdays have 2 slots; Saturday/Sunday/public holidays have 3 slots.
      Targets are proportional to slot capacity, so normal dates differ by at most 1
      and holiday-type dates differ by at most 1 whenever leave constraints allow.
    */
    const dateInfos=dates.map((date,index)=>{
      const slots=allowedSlots(date,holidays);
      return {date,index,slots,weight:slots.length,target:0,slotTargets:new Map()};
    });
    const totalWeight=Math.max(1,dateInfos.reduce((sum,x)=>sum+x.weight,0));
    let baseAllocated=0;
    dateInfos.forEach(info=>{
      const ideal=totalUnits*info.weight/totalWeight;
      info.ideal=ideal;
      info.fraction=ideal-Math.floor(ideal);
      info.target=Math.floor(ideal);
      baseAllocated+=info.target;
    });
    let extra=Math.max(0,totalUnits-baseAllocated);
    const spreadStep=dateCount>1?(dateCount%2===0?dateCount-1:Math.max(1,dateCount-2)):1;
    dateInfos.slice().sort((a,b)=>b.fraction-a.fraction||((a.index*spreadStep)%dateCount)-((b.index*spreadStep)%dateCount)||a.index-b.index).slice(0,extra).forEach(info=>{info.target++;});

    dateInfos.forEach(info=>{
      const count=info.slots.length,base=Math.floor(info.target/count),remainder=info.target%count,start=info.index%count;
      info.slots.forEach(slot=>info.slotTargets.set(slot,base));
      for(let i=0;i<remainder;i++){
        const slot=info.slots[(start+i)%count];
        info.slotTargets.set(slot,(info.slotTargets.get(slot)||0)+1);
      }
    });

    const dateInfoMap=new Map(dateInfos.map(x=>[x.date,x]));
    const cells=[];
    dateInfos.forEach(info=>info.slots.forEach(slot=>cells.push({date:info.date,dateIndex:info.index,slot,target:info.slotTargets.get(slot)||0,assigned:0})));
    const byStaffDay=new Map();
    const staffDaySlots=(staffId,date)=>{
      const key=`${staffId}|${date}`;
      if(!byStaffDay.has(key))byStaffDay.set(key,new Set());
      return byStaffDay.get(key);
    };
    const addRow=(t,cell)=>{
      const info=dateInfoMap.get(cell.date),times=slotTimes(cell.slot),holidayType=(weekend(cell.date)||publicHoliday(cell.date,holidays));
      rows.push({staff_id:t.staff_id,date:cell.date,slot:cell.slot,...times,type:holidayType?2:1,claimCode:holidayType?claimCodes(t.staff_id).holiday:claimCodes(t.staff_id).normal,employeeCode:t.employeeCode,name:staffNickSafe(t.staff_id),fullName:staffFullName(t.staff_id)});
      cell.assigned++;
      occupancy.set(`${cell.date}|${cell.slot}`,cell.assigned);
      dateOccupancy.set(cell.date,(dateOccupancy.get(cell.date)||0)+1);
      staffDaySlots(t.staff_id,cell.date).add(cell.slot);
    };

    /* Record every leave date in the HR cycle once, independently from allocation order. */
    (totals||[]).forEach(t=>dates.forEach(date=>{if(hasLeave(t.staff_id,date,leaves))leaveSkipped.push({staff_id:t.staff_id,date,reason:'วันลาในรอบ HR'});}));

    const remaining=new Map(),desiredMap=new Map(),assignedMap=new Map();
    (totals||[]).forEach(t=>{
      const desired=Math.max(0,Math.floor((Number(t.total||0)+1e-7)/8));
      t.desiredUnits=desired;
      remaining.set(String(t.staff_id),desired);
      desiredMap.set(String(t.staff_id),desired);
      assignedMap.set(String(t.staff_id),0);
    });
    const staffBase=(totals||[]).slice().sort((a,b)=>{
      const leaveA=dates.reduce((n,d)=>n+(hasLeave(a.staff_id,d,leaves)?1:0),0),leaveB=dates.reduce((n,d)=>n+(hasLeave(b.staff_id,d,leaves)?1:0),0);
      return leaveB-leaveA||Number(b.desiredUnits||0)-Number(a.desiredUnits||0)||staffNickSafe(a.staff_id).localeCompare(staffNickSafe(b.staff_id),'th');
    });
    const remainingTotal=()=>[...remaining.values()].reduce((sum,n)=>sum+Number(n||0),0);

    /* V604: reserve one existing 8-hour unit per staff on each locked date before normal balancing.
       This moves units only; it never increases desiredUnits / claimedUnits. Leave remains authoritative. */
    const lockReport=[];
    const locked=[...new Set((lockedDates||[]).map(dateKey).filter(d=>dateInfoMap.has(d)))].sort();
    locked.forEach(lockDate=>{
      const dateCells=cells.filter(c=>c.date===lockDate);
      staffBase.forEach(t=>{
        const staffId=String(t.staff_id),desired=desiredMap.get(staffId)||0,left=remaining.get(staffId)||0;
        if(desired<=0)return;
        if(hasLeave(t.staff_id,lockDate,leaves)){lockReport.push({date:lockDate,staff_id:t.staff_id,status:'leave',message:'ยกเว้นเพราะมีวันลา'});return;}
        if(left<=0){lockReport.push({date:lockDate,staff_id:t.staff_id,status:'insufficient',message:'ยอดเวร 8 ชม. ไม่พอสำหรับทุกวันที่ล็อก'});return;}
        const used=staffDaySlots(t.staff_id,lockDate);
        const candidates=dateCells.filter(cell=>cell.assigned<6&&!used.has(cell.slot)&&used.size<2).map(cell=>({cell,score:[cell.assigned,cell.slot]}));
        if(!candidates.length){lockReport.push({date:lockDate,staff_id:t.staff_id,status:'capacity',message:'ช่วงเวลาในวันนี้เต็ม (สูงสุด 6 คนต่อช่วง)'});return;}
        candidates.sort((a,b)=>compareScore(a.score,b.score));
        addRow(t,candidates[0].cell);
        remaining.set(staffId,left-1);
        assignedMap.set(staffId,(assignedMap.get(staffId)||0)+1);
        lockReport.push({date:lockDate,staff_id:t.staff_id,status:'locked',message:'ล็อกชื่อสำเร็จ'});
      });
    });

    /* Round-robin staff allocation prevents early staff from filling the first dates. */
    let round=0,progress=true;
    while(remainingTotal()>0&&progress&&round<100){
      progress=false;
      const order=staffBase.slice().sort((a,b)=>{
        const aid=String(a.staff_id),bid=String(b.staff_id),ar=(remaining.get(aid)||0)/Math.max(1,desiredMap.get(aid)||1),br=(remaining.get(bid)||0)/Math.max(1,desiredMap.get(bid)||1);
        return br-ar||(remaining.get(bid)||0)-(remaining.get(aid)||0)||staffNickSafe(a.staff_id).localeCompare(staffNickSafe(b.staff_id),'th');
      });
      order.forEach((t,staffIndex)=>{
        const staffId=String(t.staff_id),left=remaining.get(staffId)||0;
        if(left<=0)return;
        const candidates=[];
        cells.forEach(cell=>{
          if(cell.assigned>=cell.target)return;
          if(hasLeave(t.staff_id,cell.date,leaves))return;
          const used=staffDaySlots(t.staff_id,cell.date);
          if(used.has(cell.slot)||used.size>=2)return;
          const info=dateInfoMap.get(cell.date),dateUsed=dateOccupancy.get(cell.date)||0;
          const rotation=(cell.dateIndex-((staffIndex*3+round)%dateCount)+dateCount)%dateCount;
          candidates.push({cell,score:[used.size,cell.assigned/Math.max(1,cell.target),dateUsed/Math.max(1,info.target),cell.assigned,dateUsed,rotation,cell.slot]});
        });
        if(!candidates.length)return;
        candidates.sort((a,b)=>compareScore(a.score,b.score));
        addRow(t,candidates[0].cell);
        remaining.set(staffId,left-1);
        assignedMap.set(staffId,(assignedMap.get(staffId)||0)+1);
        progress=true;
      });
      round++;
    }

    /* Rare fallback for heavy leave overlap: keep max 6 people/slot and choose the least-overflowing date/slot. */
    let overflowRound=0;
    while(remainingTotal()>0&&overflowRound++<100){
      let moved=false;
      for(const t of staffBase){
        const staffId=String(t.staff_id),left=remaining.get(staffId)||0;
        if(left<=0)continue;
        const candidates=[];
        cells.forEach(cell=>{
          if(cell.assigned>=6||hasLeave(t.staff_id,cell.date,leaves))return;
          const used=staffDaySlots(t.staff_id,cell.date);
          if(used.has(cell.slot)||used.size>=2)return;
          const info=dateInfoMap.get(cell.date),dateUsed=dateOccupancy.get(cell.date)||0;
          const slotCounts=info.slots.map(slot=>occupancy.get(`${cell.date}|${slot}`)||0),after=slotCounts.map((n,i)=>info.slots[i]===cell.slot?n+1:n);
          const spread=Math.max(...after)-Math.min(...after);
          const slotOverflow=Math.max(0,cell.assigned+1-cell.target),dateOverflow=Math.max(0,dateUsed+1-info.target);
          candidates.push({cell,score:[slotOverflow,dateOverflow,spread,used.size,cell.assigned,dateUsed,cell.dateIndex,cell.slot]});
        });
        if(!candidates.length)continue;
        candidates.sort((a,b)=>compareScore(a.score,b.score));
        addRow(t,candidates[0].cell);
        remaining.set(staffId,left-1);
        assignedMap.set(staffId,(assignedMap.get(staffId)||0)+1);
        moved=true;
      }
      if(!moved)break;
    }

    (totals||[]).forEach(t=>{
      const desired=Number(t.desiredUnits||0),claimed=Number(assignedMap.get(String(t.staff_id))||0),unallocated=Math.max(0,desired-claimed);
      t.claimedUnits=claimed;t.claimed=round2(claimed*8);t.carry=round2(Number(t.total||0)-t.claimed);t.unallocatedUnits=unallocated;
      const mine=rows.filter(x=>String(x.staff_id)===String(t.staff_id));t.normalHours=mine.filter(x=>x.type===1).length*8;t.holidayHours=mine.filter(x=>x.type===2).length*8;t.money=round2(t.claimed*t.baseRate);
    });
    rows.sort((a,b)=>a.date.localeCompare(b.date)||a.slot-b.slot||staffNickSafe(a.staff_id).localeCompare(staffNickSafe(b.staff_id),'th'));

    const balanceRows=dateInfos.map(info=>{
      const slots={};info.slots.forEach(slot=>{slots[slot]=occupancy.get(`${info.date}|${slot}`)||0;});
      const values=Object.values(slots),spread=values.length?Math.max(...values)-Math.min(...values):0;
      return {date:info.date,target:info.target,total:dateOccupancy.get(info.date)||0,slots,spread,type:(weekend(info.date)||publicHoliday(info.date,holidays))?'holiday':'weekday'};
    });
    return {rows,occupancy,dateOccupancy,leaveSkipped,balanceRows,lockedDates:locked,lockReport};
  }

  function sourceRowsForSheet(totals,month,cycle){
    const out=[];
    totals.forEach(t=>t.rows.forEach(({row,n})=>{
      const segments=Array.isArray(n.segments)?n.segments:[];
      const rates=[...new Set(segments.map(x=>Number(x.appliedRate||0)).filter(Boolean))].join('/');
      out.push({
        'รหัสพนักงาน':t.employeeCode,'ชื่อ':staffFullName(t.staff_id),'ชื่อเล่น':staffNickSafe(t.staff_id),'วันที่ OT จริง':dateKey(row.work_date),'เดือนเบิกจริง':month,
        'รอบ HR dummy':`${cycle.start} ถึง ${cycle.end}`,'เหตุผล':String(row.reason||''),'หมายเหตุ':String(row.note||''),'ประเภทเวร':n.shiftType||'-',
        'ชั่วโมงจริง':round2(n.actualHours),'เรทงานจริง (บาท/ชม.)':rates||t.baseRate,'ฐาน HR (บาท/ชม.)':t.baseRate,'ชั่วโมงเทียบ HR':round2(n.hrHours),
        'เงินตามงานจริง':round2(n.actualMoney),'การแปลงเรท':n.tangMtConversion?'อริภัศ/แตง: งาน MT แปลงเป็นฐานเคิก 90':'ตามกลุ่มเจ้าหน้าที่','claim_status ก่อน Export':String(row.claim_status||'pending')
      });
    }));
    return out;
  }
  function staffSummaryRows(totals){return totals.map(t=>({'รหัสพนักงาน':t.employeeCode,'ชื่อ':staffFullName(t.staff_id),'ชื่อเล่น':staffNickSafe(t.staff_id),'กลุ่ม HR':t.baseType,'ฐาน HR':t.baseRate,'ชั่วโมงจริงรวม':t.actual,'OT เดือนนี้เทียบ HR':t.currentTotal,'ยอดทบยกมา(ชม.)':t.carryIn,'เดือนยอดทบยกมา':t.carrySourceMonth||'','รวมก่อนปรับย้อนหลัง':t.regularAvailable==null?t.total:t.regularAvailable,'ปรับย้อนหลังหน่วย HR 8ชม.':Number(t.adjustmentUnits||0),'ปรับย้อนหลัง(บาท)':Number(t.adjustmentAmount||0),'โอทีทั้งหมดหลังปรับ':t.total,'เบิก HR รอบนี้':t.claimed,'ทบเดือนหน้า(ชม.)':t.carry,'จำนวนเวร 8 ชม.':t.claimedUnits,'เวรที่จัดไม่ได้เพราะลา/ความจุ':t.unallocatedUnits,'ยอดเงินที่เบิก HR รอบนี้':t.money}));}
  function holidayDayList(cycle,holidays){return datesBetween(cycle.start,cycle.end).filter(d=>weekend(d)||publicHoliday(d,holidays)).map(d=>String(Number(d.slice(-2))).padStart(2,'0')).join(',');}

  function makeOtExtraSheet(sourceRows,totals,source,cycle){
    const rows=[
      [`สรุป OT เดือน ${source.month} / HR dummy ${cycle.start} ถึง ${cycle.end}`],
      ['ชื่อ','OT เดือนนี้เทียบ HR','ยอดทบยกมา','เดือนยอดทบ','รวมก่อนปรับย้อนหลัง','ปรับย้อนหลัง (เวร 8ชม.)','ยอดหลังปรับ','เบิก HR รอบนี้','ทบเดือนหน้า','ฐาน HR','ยอดเงินที่เบิก HR รอบนี้','หมายเหตุ'],
      ...totals.map(t=>[staffFullName(t.staff_id),t.currentTotal,t.carryIn,t.carrySourceMonth||'',t.regularAvailable==null?t.total:t.regularAvailable,Number(t.adjustmentUnits||0),t.total,t.claimed,t.carry,t.baseRate,t.money,[Number(t.carryIn||0)>0?'รวมยอดทบจากเดือนก่อนอัตโนมัติ':'',Number(t.adjustmentUnits||0)!==0?`V527 ปรับย้อนหลัง ${Number(t.adjustmentUnits)>0?'+':''}${Number(t.adjustmentUnits)} เวร`:'' ,isTang(t.staff_id)?'อริภัศ/แตง: งานปั่นเลือด/งาน MT คิดเรท MT แล้วหารฐานเคิก 90':''].filter(Boolean).join(' • ')]),
      [],
      ['รายละเอียดต้นทางเดือนปัจจุบัน'],
      ['ชื่อ','วันที่ OT','เหตุผล','ประเภทเวร','ชั่วโมงจริง','เรทงานจริง','ฐาน HR','ชั่วโมงเทียบ HR','เงินตามงานจริง','หมายเหตุการแปลง'],
      ...sourceRows.map(r=>[r['ชื่อ'],r['วันที่ OT จริง'],r['เหตุผล'],r['ประเภทเวร'],r['ชั่วโมงจริง'],r['เรทงานจริง (บาท/ชม.)'],r['ฐาน HR (บาท/ชม.)'],r['ชั่วโมงเทียบ HR'],r['เงินตามงานจริง'],r['การแปลงเรท']])
    ];
    const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=[{wch:34},{wch:18},{wch:15},{wch:15},{wch:20},{wch:20},{wch:18},{wch:16},{wch:18},{wch:12},{wch:22},{wch:60}];return ws;
  }
  function makeScheduleSheet(allocation,totals,cycle){
    const start=new Date(`${cycle.start}T12:00:00`),first=new Date(start);first.setDate(first.getDate()-first.getDay());
    const end=new Date(`${cycle.end}T12:00:00`),last=new Date(end);last.setDate(last.getDate()+(6-last.getDay()));
    const weeks=Math.ceil((last-first)/(7*86400000))+1,cols=31,data=[];
    const row1=Array(cols).fill(null),row2=Array(cols).fill(null);row1[0]=null;row2[0]=null;
    for(let day=0;day<7;day++){const c=1+day*3;row1[c]=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'][day];row2[c]=0;row2[c+1]=8;row2[c+2]=16;}
    const summaryHeaders=['ชื่อ','จำนวน','วันหยุดพิเศษ','คิดเงิน (บาท)','คิดเงิน (บาท) + วันที่ 13-15','โอทีทั้งหมด','เบิกจริง','ทบเดือนหน้า(ชม.)'];summaryHeaders.forEach((h,i)=>row1[23+i]=h);
    data.push(row1,row2);
    const byCell=new Map();allocation.rows.forEach(x=>{const k=`${x.date}|${x.slot}`;if(!byCell.has(k))byCell.set(k,[]);byCell.get(k).push(x.name);});
    for(let w=0;w<weeks;w++){
      const dateRow=Array(cols).fill(null);dateRow[0]='วันที่';
      const nameRows=Array.from({length:6},(_,i)=>{const r=Array(cols).fill(null);r[0]=String.fromCharCode(65+i);return r;});
      for(let day=0;day<7;day++){
        const d=new Date(first);d.setDate(first.getDate()+w*7+day);const key=dateKey(d),c=1+day*3;
        if(key>=cycle.start&&key<=cycle.end){dateRow[c]=String(Number(key.slice(-2))).padStart(2,'0');for(const slot of [0,8,16]){const names=byCell.get(`${key}|${slot}`)||[],slotCol=c+(slot===0?0:slot===8?1:2);for(let i=0;i<Math.min(6,names.length);i++)nameRows[i][slotCol]=names[i];}}
      }
      const block=[dateRow,...nameRows];
      block.forEach((r,bi)=>{
        const summaryIndex=(data.length+bi)-1;
        if(summaryIndex>=0&&summaryIndex<totals.length){const t=totals[summaryIndex];r[23]=staffNickSafe(t.staff_id);r[24]=t.claimedUnits;r[25]=t.holidayHours/8;r[26]=t.money;r[27]=t.money;r[28]=t.total;r[29]=t.claimed;r[30]=t.carry;}
      });
      data.push(...block);
    }
    /* Fill any summary rows that exceed the calendar block. */
    while(data.length<totals.length+2)data.push(Array(cols).fill(null));
    totals.forEach((t,i)=>{const r=data[i+2]||(data[i+2]=Array(cols).fill(null));r[23]=staffNickSafe(t.staff_id);r[24]=t.claimedUnits;r[25]=t.holidayHours/8;r[26]=t.money;r[27]=t.money;r[28]=t.total;r[29]=t.claimed;r[30]=t.carry;});
    const ws=XLSX.utils.aoa_to_sheet(data);ws['!cols']=[{wch:7},...Array.from({length:21},()=>({wch:13})),{wch:2},{wch:20},{wch:10},{wch:14},{wch:16},{wch:22},{wch:14},{wch:12},{wch:18}];return ws;
  }
  function makeCopySheet(allocation,cycle,holidays){
    const holidayList=holidayDayList(cycle,holidays);
    const rows=[['name','time','วันที่','1 = ธรรมดา\n2 = วันหยุด\n3 = พรีเมียม\n4 = อื่นๆ1\n5 = อื่นๆ2','copy ใส่ macro HR >>>','key no','no','วันที่','เวลาเข้า','เวลาออก','วันที่เต็ม (ตรวจสอบ)','วันหยุด>',holidayList]];
    allocation.rows.forEach(x=>rows.push([x.name,x.slot,Number(x.date.slice(-2)),x.type,'',x.claimCode,x.employeeCode,Number(x.date.slice(-2)),x.startValue,x.endValue,x.date,'','']));
    const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=[{wch:22},{wch:8},{wch:8},{wch:18},{wch:24},{wch:12},{wch:12},{wch:8},{wch:12},{wch:12},{wch:14},{wch:12},{wch:45}];
    for(let r=2;r<=rows.length;r++){
      for(const col of ['F','G'])if(ws[`${col}${r}`]){ws[`${col}${r}`].t='s';ws[`${col}${r}`].z='@';}
      for(const col of ['I','J'])if(ws[`${col}${r}`]){ws[`${col}${r}`].t='n';ws[`${col}${r}`].z='h:mm';}
    }
    ws['!autofilter']={ref:`A1:M${Math.max(1,rows.length)}`};return ws;
  }
  function makeTimeSheet(){const ws=XLSX.utils.aoa_to_sheet([[null,'เข้า','ออก'],[0,0,8/24],[8,8/24,16/24],[16,16/24,0]]);for(let r=2;r<=4;r++)for(const col of ['B','C']){ws[`${col}${r}`].t='n';ws[`${col}${r}`].z='h:mm';}ws['!cols']=[{wch:8},{wch:12},{wch:12}];return ws;}
  function makeNameSheet(totals,allocation){
    const rows=[['ชื่อ','รหัสพนักงาน','รหัสเบิกธรรมดา','รหัสเบิกวันหยุด','รหัสเบิกพรีเมียม','วันหยุดพิเศษ','อื่นๆ2','รวม(บาท)','ชั่วโมงธรรมดา','ชั่วโมงวันหยุด','จำนวนธรรมดา','จำนวนวันหยุด','เรทงานจริงวันปกติ','เรทงานจริงนักขัต','หมายเหตุ']];
    totals.forEach(t=>{const c=claimCodes(t.staff_id),mtTang=isTang(t.staff_id);rows.push([staffNickSafe(t.staff_id),t.employeeCode,c.normal,c.holiday,c.premium,c.special,'',t.money,t.baseRate,t.baseRate,t.normalHours,t.holidayHours,mtTang?130:t.baseRate,mtTang?160:(t.baseType==='เคิก'?120:160),mtTang?'อริภัศ/แตง: ปั่นเลือด/งาน MT ใช้ 130 หรือ 160 แล้วแปลงกลับฐานเคิก 90':'']);});
    const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=[{wch:22},{wch:14},{wch:17},{wch:17},{wch:17},{wch:15},{wch:12},{wch:14},{wch:15},{wch:15},{wch:15},{wch:15},{wch:18},{wch:18},{wch:55}];
    for(let r=2;r<=rows.length;r++)for(const col of ['B','C','D','E','F'])if(ws[`${col}${r}`]){ws[`${col}${r}`].t='s';ws[`${col}${r}`].z='@';}
    return ws;
  }
  function makeHrSheet(allocation){
    const rows=[['key no','no','วันที่','เวลาเข้า','เวลาออก'],...allocation.rows.map(x=>[x.claimCode,x.employeeCode,Number(x.date.slice(-2)),x.startValue,x.endValue])];
    const ws=XLSX.utils.aoa_to_sheet(rows);ws['!cols']=[{wch:14},{wch:14},{wch:10},{wch:12},{wch:12}];
    for(let r=2;r<=rows.length;r++){for(const col of ['A','B'])if(ws[`${col}${r}`]){ws[`${col}${r}`].t='s';ws[`${col}${r}`].z='@';}for(const col of ['D','E'])if(ws[`${col}${r}`]){ws[`${col}${r}`].t='n';ws[`${col}${r}`].z='h:mm';}}
    return ws;
  }
  function balanceCheckRows(allocation){
    return (allocation?.balanceRows||[]).map(x=>({
      'วันที่ HR dummy':x.date,'วัน':thaiWeekday(x.date),'ประเภทวัน':x.type==='holiday'?'เสาร์/อาทิตย์/นักขัต':'วันธรรมดา',
      'เป้าหมายจำนวนเวร':x.target,'จำนวนเวรจริง':x.total,'00:00-08:00':Number(x.slots?.[0]||0),'08:00-16:00':Number(x.slots?.[8]||0),'16:00-00:00':Number(x.slots?.[16]||0),
      'ส่วนต่างช่วงเวลาสูงสุด':x.spread,'ตรวจสอบ':x.spread<=1?'ผ่าน':'ควรตรวจสอบ'
    }));
  }
  function makeJsonSheet(rows,headers,widths){const ws=XLSX.utils.json_to_sheet(rows,{header:headers});ws['!cols']=(widths||headers.map(()=>16)).map(w=>({wch:w}));ws['!autofilter']={ref:`A1:${XLSX.utils.encode_col(headers.length-1)}${Math.max(1,rows.length+1)}`};return ws;}
  function batchId(){const d=new Date();return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;}
  async function markExported(rows,id,totals,sourceMonth){
    const grouped=new Map();(rows||[]).forEach(row=>{const staffId=String(row.staff_id||'');if(!row.id||!staffId)return;if(!grouped.has(staffId))grouped.set(staffId,[]);grouped.get(staffId).push(row.id);});
    if(!grouped.size)return;
    const now=new Date().toISOString(),actor=currentStaffIdSafe(),byStaff=new Map((totals||[]).map(t=>[String(t.staff_id),t]));
    for(const [staffId,ids] of grouped){
      const t=byStaff.get(staffId),payload={claim_status:'exported',export_batch_id:id,exported_by:actor,exported_at:now,batch_id:id,export_date:now,claim_batch_id:encodeCarryMarker(sourceMonth,t?.carry||0),claimed_at:now,claimed_by:actor};
      const res=await db().from('ot_requests').update(payload).in('id',ids);if(res.error)throw res.error;
    }
    /* A staff member can have carry-in but no new OT row this month. Move that person's
       snapshot forward on the latest exported source row so the carry is not duplicated. */
    for(const t of (totals||[])){
      const staffId=String(t.staff_id||'');if(grouped.has(staffId)||!t.carryAnchorRowId)continue;
      const res=await db().from('ot_requests').update({claim_batch_id:encodeCarryMarker(sourceMonth,t.carry||0),claimed_at:now,claimed_by:actor}).eq('id',t.carryAnchorRowId);
      if(res.error)throw res.error;
    }
    carryCache.clear();summaryCarryCache.clear();
  }

  async function exportV318(){
    if(!admin())return toast('เฉพาะ Admin เท่านั้น','error');
    if(typeof XLSX==='undefined')return toast('ไม่พบไลบรารี Excel','error');
    const month=monthKey(st().otSourceMonthV241||st().otMoneyMonthV241||st().monthKey);
    busy(true,'กำลังอ่านยอดทบเดือนก่อนและจัด HR dummy แบบไฟล์ Manual');
    try{
      const data=await queryExportData(month);if(!data.rows.length&&!(data.adjustments||[]).some(x=>Number(x.hr_unit_delta||0)!==0))throw new Error('ยังไม่มีรายการ OT หรือรายการปรับยอดที่ใช้ Export ในเดือนนี้');
      const carryInMap=await queryCarryIn(data.source.month);
      const regularTotals=applyCarryIn(buildTotals(data.rows),carryInMap);
      const totals=applyAdjustmentUnits(regularTotals,data.adjustments||[]);if(!totals.length)throw new Error('ไม่พบชั่วโมง OT ที่ใช้คำนวณได้');
      const missing=totals.filter(t=>!t.employeeCode).map(t=>staffNickSafe(t.staff_id));if(missing.length)throw new Error(`ยังไม่มีรหัสพนักงานของ: ${missing.join(', ')} กรุณาใส่ในข้อมูลเจ้าหน้าที่ก่อน Export`);
      const lockedDates=hrLockedDates(data.source.month).filter(d=>d>=data.cycle.start&&d<=data.cycle.end);
      const allocation=allocate(totals,data.cycle,data.leaves,data.holidays,lockedDates),sourceSheetRows=sourceRowsForSheet(totals,data.source.month,data.cycle),summaryRows=staffSummaryRows(totals);
      const lockFailures=(allocation.lockReport||[]).filter(x=>x.status==='insufficient'||x.status==='capacity');
      if(lockFailures.length){const detail=lockFailures.slice(0,8).map(x=>`${staffNickSafe(x.staff_id)} ${x.date}: ${x.message}`).join(' • ');throw new Error(`ล็อกวันที่ให้ทุกคนมีชื่อไม่ครบ: ${detail}${lockFailures.length>8?` • และอีก ${lockFailures.length-8} รายการ`:''}`);}
      const leaveRows=allocation.leaveSkipped.map(x=>({'รหัสพนักงาน':employeeCode(x.staff_id),'ชื่อ':staffFullName(x.staff_id),'วันที่ลาในรอบ HR':x.date,'หมายเหตุ':'ระบบไม่สร้าง dummy shift ในวันนี้'}));
      const carryRows=totals.map(t=>({'รหัสพนักงาน':t.employeeCode,'ชื่อ':staffFullName(t.staff_id),'เดือน OT ปัจจุบัน':data.source.month,'เดือนยอดทบยกมา':t.carrySourceMonth||'','ยอดทบยกมา(ชม.)':t.carryIn,'OT เดือนนี้เทียบ HR':t.currentTotal,'รวมก่อนปรับย้อนหลัง':t.regularAvailable==null?t.total:t.regularAvailable,'ปรับย้อนหลังหน่วย HR 8ชม.':Number(t.adjustmentUnits||0),'โอทีทั้งหมดหลังปรับ':t.total,'เบิก HR รอบนี้':t.claimed,'ทบเดือนหน้า(ชม.)':t.carry,'หมายเหตุ':'V530: รายการปรับย้อนหลังแยกจาก OT จริง; หน่วย HR รองรับทศนิยมและรวมยอดก่อนตัดเป็นชุด 8 ชม.'}));
      const adjustmentRows=(data.adjustments||[]).map(a=>({'รหัสพนักงาน':employeeCode(a.staff_id),'ชื่อ':staffFullName(a.staff_id),'ประเภท':a.adjustment_type==='overclaim'?'ลด OT เบิกเกิน':'OT ตกเบิกย้อนหลัง','เดือนต้นทาง':a.source_month,'เดือนที่นำมาปรับ':a.apply_month,'ยอดเงินปรับ':Number(a.amount_delta||0),'หน่วย HR 8 ชม.':Number(a.hr_unit_delta||0),'ฐาน HR':Number(a.base_rate||baseRate(a.staff_id)),'เหตุผล':a.reason||'','รายละเอียด':a.note||'','สถานะก่อน Export':a.status||'pending'}));
      const wb=XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb,makeOtExtraSheet(sourceSheetRows,totals,data.source,data.cycle),'OT เสริม');
      XLSX.utils.book_append_sheet(wb,makeScheduleSheet(allocation,totals,data.cycle),'ตาราง');
      XLSX.utils.book_append_sheet(wb,makeCopySheet(allocation,data.cycle,data.holidays),'copy');
      XLSX.utils.book_append_sheet(wb,makeTimeSheet(),'time');
      XLSX.utils.book_append_sheet(wb,makeNameSheet(totals,allocation),'name');
      XLSX.utils.book_append_sheet(wb,makeHrSheet(allocation),'HR_OT');
      const balanceRows=balanceCheckRows(allocation);
      XLSX.utils.book_append_sheet(wb,makeJsonSheet(balanceRows,Object.keys(balanceRows[0]||{'วันที่ HR dummy':'','วัน':'','ประเภทวัน':'','เป้าหมายจำนวนเวร':'','จำนวนเวรจริง':'','00:00-08:00':'','08:00-16:00':'','16:00-00:00':'','ส่วนต่างช่วงเวลาสูงสุด':'','ตรวจสอบ':''}),[16,12,22,18,16,16,16,16,22,18]),'Dummy_Balance_Check');
      XLSX.utils.book_append_sheet(wb,makeJsonSheet(sourceSheetRows,Object.keys(sourceSheetRows[0]||{}),[14,30,14,14,12,24,34,42,14,12,16,12,16,16,44,20]),'Source_OT_1_to_End');
      XLSX.utils.book_append_sheet(wb,makeJsonSheet(summaryRows,Object.keys(summaryRows[0]||{}),[14,30,14,12,10,16,16,16,22,18,18,18,20,16,18,14,18,18]),'Staff_Total');
      XLSX.utils.book_append_sheet(wb,makeJsonSheet(adjustmentRows,Object.keys(adjustmentRows[0]||{'รหัสพนักงาน':'','ชื่อ':'','ประเภท':'','เดือนต้นทาง':'','เดือนที่นำมาปรับ':'','ยอดเงินปรับ':'','หน่วย HR 8 ชม.':'','ฐาน HR':'','เหตุผล':'','รายละเอียด':'','สถานะก่อน Export':''}),[14,30,22,14,16,16,18,12,24,46,18]),'OT_Adjustments');
      XLSX.utils.book_append_sheet(wb,makeJsonSheet(carryRows,Object.keys(carryRows[0]||{'รหัสพนักงาน':'','ชื่อ':'','เดือน OT ปัจจุบัน':'','เดือนยอดทบยกมา':'','ยอดทบยกมา(ชม.)':'','OT เดือนนี้เทียบ HR':'','รวมก่อนปรับย้อนหลัง':'','ปรับย้อนหลังหน่วย HR 8ชม.':'','โอทีทั้งหมดหลังปรับ':'','เบิก HR รอบนี้':'','ทบเดือนหน้า(ชม.)':'','หมายเหตุ':''}),[14,30,16,16,18,18,20,22,20,16,18,62]),'Carry_Forward');
      XLSX.utils.book_append_sheet(wb,makeJsonSheet(leaveRows,Object.keys(leaveRows[0]||{'รหัสพนักงาน':'','ชื่อ':'','วันที่ลาในรอบ HR':'','หมายเหตุ':''}),[14,30,18,42]),'Leave_Skipped');
      if(lockedDates.length){const lockRows=(allocation.lockReport||[]).map(x=>({'วันที่ล็อก':x.date,'รหัสพนักงาน':employeeCode(x.staff_id),'ชื่อ':staffFullName(x.staff_id),'สถานะ':x.status==='locked'?'มีชื่อแล้ว':x.status==='leave'?'ยกเว้น-วันลา':x.status,'หมายเหตุ':x.message||''}));XLSX.utils.book_append_sheet(wb,makeJsonSheet(lockRows,Object.keys(lockRows[0]||{'วันที่ล็อก':'','รหัสพนักงาน':'','ชื่อ':'','สถานะ':'','หมายเหตุ':''}),[16,14,30,18,46]),'Locked_Date_Check');}
      const id=batchId(),filename=`HR_OT_V318_${id}_source_${data.source.start}_to_${data.source.end}_dummy_${data.cycle.start}_to_${data.cycle.end}.xlsx`;
      const v532ctx={batchId:id,filename,month:data.source.month,source:data.source,cycle:data.cycle,totals,allocation,data,workbook:wb,summaryRows,adjustmentRows,sourceSheetRows,carryRows};
      if(window.cnmiV532ExportGuard?.preExport)await window.cnmiV532ExportGuard.preExport(v532ctx);
      XLSX.writeFile(wb,filename);
      await markExported(data.rows,id,totals,data.source.month);
      const adjustmentIds=(data.adjustments||[]).filter(a=>a.id&&Number(a.hr_unit_delta||0)!==0).map(a=>a.id);
      if(adjustmentIds.length){const ar=await db().from('ot_adjustments').update({status:'exported',export_batch_id:id,exported_at:new Date().toISOString(),updated_at:new Date().toISOString()}).in('id',adjustmentIds);if(ar.error)throw ar.error;}
      if(window.cnmiV532ExportGuard?.postExport)await window.cnmiV532ExportGuard.postExport(v532ctx);
      try{window.cnmiV527AdjustmentLedger?.refresh?.();}catch(_){ }
      try{window.cnmiV316?.clearCache?.();await window.cnmiV316?.loadPageData?.('ot',{force:true});}catch(_){ }
      st().otSubtabV241='summary';try{renderPage();}catch(_){ }
      const totalCarryIn=round2(totals.reduce((s,x)=>s+Number(x.carryIn||0),0)),totalCarry=round2(totals.reduce((s,x)=>s+Number(x.carry||0),0)),adjustUnits=totals.reduce((s,x)=>s+Number(x.adjustmentUnits||0),0);
      toast(`Export สำเร็จ ${allocation.rows.length} เวร 8 ชม. • ปรับย้อนหลัง ${adjustUnits>=0?'+':''}${adjustUnits} เวร • ยกมา ${hours(totalCarryIn)} ชม. • ทบเดือนหน้า ${hours(totalCarry)} ชม. • Batch ${id}`);
    }catch(err){console.error(`[${VERSION}] export failed`,err);try{if(window.cnmiV532ExportGuard?.exportFailed)await window.cnmiV532ExportGuard.exportFailed(window.__CNMI_V532_LAST_EXPORT__?.ctx||null,err);}catch(_){ }toast(String(err?.message||err||'Export ไม่สำเร็จ'),'error');}
    finally{busy(false);}
  }

  function historyYears(){const now=new Date().getFullYear(),out=[];for(let y=now+1;y>=now-6;y--)out.push({value:String(y),label:String(y+543)});return out;}
  function historyMonthOptions(){return ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'].map((label,i)=>({value:pad2(i+1),label}));}
  function selectedHistoryMonth(){const year=String(st().hrHistoryYearV318||''),monthNo=String(st().hrHistoryMonthNumberV318||'');return /^\d{4}$/.test(year)&&/^\d{2}$/.test(monthNo)?`${year}-${monthNo}`:'';}
  function activeStaff(){return (st().staff||[]).filter(s=>s.is_active!==false&&s.active!==false&&!(window.cnmiPersonTypeV516?.isPhysician?.(s)??/^(แพทย์|physician|doctor)$/i.test(String(s.staff_type||s.role||'').trim()))).sort((a,b)=>String(a.nickname||a.full_name||'').localeCompare(String(b.nickname||b.full_name||''),'th'));}
  function historyKey(staffId,year,monthNo){return `${staffId}|${year}|${monthNo}`;}
  async function loadHistory(force=false){
    const staffId=String(st().hrHistoryStaffV318||''),year=String(st().hrHistoryYearV318||''),monthNo=String(st().hrHistoryMonthNumberV318||''),month=selectedHistoryMonth();if(!staffId||!month)return;
    const key=historyKey(staffId,year,monthNo),saved=historyCache.get(key);if(!force&&saved&&saved.expires>Date.now()){st().hrHistoryRowsV318=saved.rows;st().hrHistoryLoadingV318=false;return;}
    st().hrHistoryLoadingV318=true;try{renderPage();}catch(_){ }
    try{
      const r=monthRange(month),res=await db().from('ot_requests').select('*').eq('staff_id',staffId).gte('work_date',r.start).lte('work_date',r.end).order('work_date',{ascending:false});
      if(res.error)throw res.error;const rows=(res.data||[]).filter(x=>approved(x)&&claimStatus(x)==='exported');historyCache.set(key,{rows,expires:Date.now()+HISTORY_TTL});st().hrHistoryRowsV318=rows;
    }catch(err){console.error(`[${VERSION}] history load failed`,err);st().hrHistoryRowsV318=[];toast(`โหลดประวัติ Export ไม่สำเร็จ: ${err?.message||err}`,'error');}
    finally{st().hrHistoryLoadingV318=false;try{renderPage();}catch(_){ }}
  }
  function groupHistory(rows){const map=new Map();(rows||[]).forEach(row=>{const id=rowBatch(row);if(!map.has(id))map.set(id,{rows:[],actual:0,hr:0,money:0,at:'',by:''});const g=map.get(id),n=normalize(row);g.rows.push(row);g.actual=round2(g.actual+Number(n.actualHours||0));g.hr=round2(g.hr+Number(n.hrHours||0));g.money=round2(g.money+Number(n.hrHours||0)*baseRate(row.staff_id));const at=rowExportedAt(row);if(at&&(!g.at||String(at)>String(g.at)))g.at=at;if(row.exported_by||row.claimed_by)g.by=row.exported_by||row.claimed_by;});return [...map.entries()].sort((a,b)=>String(b[1].at||b[0]).localeCompare(String(a[1].at||a[0])));}
  function historyHtml(){
    if(!admin())return '<div class="card"><div class="empty">เฉพาะ Admin เท่านั้น</div></div>';
    const selectedStaff=String(st().hrHistoryStaffV318||''),selectedYear=String(st().hrHistoryYearV318||''),selectedMonthNo=String(st().hrHistoryMonthNumberV318||''),selectedMonth=selectedHistoryMonth();
    const filters=`<div class="card"><div class="section-title"><div><h3>ประวัติ Export HR</h3><p class="hint">ระบบจะยังไม่ดึงตารางจนกว่าจะเลือกชื่อเจ้าหน้าที่ ปี และเดือนครบ</p></div></div><div class="toolbar compact-filter"><label>เจ้าหน้าที่ <select id="hrHistoryStaffV318"><option value="">กรุณาเลือกชื่อ</option>${activeStaff().map(s=>`<option value="${esc(s.id)}" ${String(s.id)===selectedStaff?'selected':''}>${esc(s.nickname||s.full_name||'-')}</option>`).join('')}</select></label><label>ปี พ.ศ. <select id="hrHistoryYearV318"><option value="">กรุณาเลือกปี</option>${historyYears().map(y=>`<option value="${y.value}" ${y.value===selectedYear?'selected':''}>${esc(y.label)}</option>`).join('')}</select></label><label>เดือน <select id="hrHistoryMonthNumberV318"><option value="">กรุณาเลือกเดือน</option>${historyMonthOptions().map(m=>`<option value="${m.value}" ${m.value===selectedMonthNo?'selected':''}>${esc(m.label)}</option>`).join('')}</select></label></div></div>`;
    if(!selectedStaff||!selectedYear||!selectedMonthNo)return `${filters}<div class="card"><div class="empty">กรุณาเลือกชื่อเจ้าหน้าที่ ปี และเดือนก่อน ระบบจึงจะโหลดประวัติ Export</div></div>`;
    if(st().hrHistoryLoadingV318)return `${filters}<div class="card"><div class="empty">กำลังโหลดเฉพาะ ${esc(staffNickSafe(selectedStaff))} เดือน ${esc(selectedMonthNo)}/${esc(selectedYear)}…</div></div>`;
    const rows=st().hrHistoryRowsV318||[],groups=groupHistory(rows);if(!groups.length)return `${filters}<div class="card"><div class="empty">ไม่พบรายการ Exported ของ ${esc(staffNickSafe(selectedStaff))} ในเดือนและปีที่เลือก</div></div>`;
    return `${filters}${groups.map(([id,g])=>`<div class="card v241-export-batch"><div class="section-title"><div><h3>Batch ${esc(id)}</h3><p class="hint">${g.rows.length} รายการ • ${hours(g.hr)} ชั่วโมงเบิก HR • ${esc(money(g.money))} • Export เมื่อ ${esc(fmtDateTime(g.at))}${g.by?` • โดย ${esc(staffNickSafe(g.by))}`:''}</p></div><div class="actions"><button class="tiny-btn danger" type="button" data-v318-revert-selected-batch="${esc(id)}">ตีกลับเฉพาะชื่อนี้</button><button class="danger-btn" type="button" data-v318-revert-whole-batch="${esc(id)}">ตีกลับทั้ง Batch</button></div></div><div class="table-wrap"><table><thead><tr><th>วันที่ OT</th><th>เจ้าหน้าที่</th><th>ชั่วโมงจริง</th><th>ชั่วโมงเบิก HR</th><th>เหตุผล</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${g.rows.map(row=>{const n=normalize(row);return `<tr><td>${esc(fmtDate(row.work_date))}</td><td>${staffPillSafe(row.staff_id)}</td><td>${hours(n.actualHours,1)}</td><td><b>${hours(n.hrHours)}</b></td><td>${esc(row.reason||'-')}</td><td><span class="badge green">Exported</span></td><td><button class="tiny-btn danger" type="button" data-v318-revert-row="${esc(row.id)}">ตีกลับรายการนี้</button></td></tr>`;}).join('')}</tbody></table></div></div>`).join('')}`;
  }
  function replaceContent(base,html){
    try{const tpl=document.createElement('template');tpl.innerHTML=String(base||'');const content=tpl.content.querySelector('.v241-ot-content');if(content)content.innerHTML=html;const holder=document.createElement('div');holder.appendChild(tpl.content.cloneNode(true));return holder.innerHTML;}catch(_){return base;}
  }
  if(previousRenderOtPage){
    const wrapped=function renderOtPageV318(){let base=String(previousRenderOtPage.apply(this,arguments)||'');const menu=String(st().otMenuV369||'');const active=menu==='export'?'export':menu==='history'?'history':(st().otSubtabV241||'mine');if(active==='history')return replaceContent(base,historyHtml());if(active==='export'){base=base.replace(/data-export-hr-v241/g,'data-export-hr-v318').replace('นำ OT จริงของเดือน 1-สิ้นเดือน ไปกระจายเป็น HR dummy ในรอบ 16-15','สร้างไฟล์แบบ Manual: รวมยอดทบเดือนก่อนอัตโนมัติ เบิกชุดละ 8 ชม. และส่งเศษต่อเดือนหน้า');const panel=hrLockedDatePanel(monthKey(st().otSourceMonthV241||st().otMoneyMonthV241||st().monthKey));base=base.replace(/(<button[^>]*data-export-hr-v318[^>]*>)/i,panel+'$1');}return base;};
    try{window.renderOtPage=renderOtPage=wrapped;}catch(_){window.renderOtPage=wrapped;}
  }

  async function resetHistoryRows(ids){
    ids=[...new Set((ids||[]).filter(Boolean))];if(!ids.length)return toast('ไม่พบรายการที่ต้องตีกลับ','error');
    if(window.cnmiV532ExportGuard?.lockedHistory)return window.cnmiV532ExportGuard.handleLegacyRevert(ids);
    const ok=typeof confirmDialog==='function'?await confirmDialog(`ต้องการตีกลับ ${ids.length} รายการเป็น Pending ใช่ไหม?`,'ยืนยันตีกลับ Export'):window.confirm(`ต้องการตีกลับ ${ids.length} รายการเป็น Pending ใช่ไหม?`);if(!ok)return;
    busy(true,'กำลังตีกลับ Export');
    try{const payload={claim_status:'pending',export_batch_id:null,exported_by:null,exported_at:null,batch_id:null,export_date:null,claim_batch_id:null,claimed_at:null,claimed_by:null},res=await db().from('ot_requests').update(payload).in('id',ids);if(res.error)throw res.error;historyCache.delete(historyKey(st().hrHistoryStaffV318,st().hrHistoryYearV318,st().hrHistoryMonthNumberV318));carryCache.clear();summaryCarryCache.clear();await loadHistory(true);toast(`ตีกลับเป็น Pending แล้ว ${ids.length} รายการ`);}catch(err){toast(`ตีกลับไม่สำเร็จ: ${err?.message||err}`,'error');}finally{busy(false);}
  }

  document.addEventListener('click',async e=>{
    const addLock=e.target?.closest?.('[data-v604-add-lock-date]');if(addLock){e.preventDefault();e.stopPropagation();const input=document.getElementById('hrLockDateV604'),date=dateKey(input?.value),month=monthKey(st().otSourceMonthV241||st().otMoneyMonthV241||st().monthKey),cycle=cycleRange(month);if(!date)return toast('กรุณาเลือกวันที่ที่ต้องการล็อก','error');if(date<cycle.start||date>cycle.end)return toast(`วันที่ต้องอยู่ในรอบ HR ${cycle.start} ถึง ${cycle.end}`,'error');saveHrLockedDates(month,[...hrLockedDates(month),date]);try{renderPage();}catch(_){ }toast(`ล็อกวันที่ ${fmtDate(date)} แล้ว`);return;}
    const removeLock=e.target?.closest?.('[data-v604-remove-lock-date]');if(removeLock){e.preventDefault();e.stopPropagation();const month=monthKey(st().otSourceMonthV241||st().otMoneyMonthV241||st().monthKey),date=dateKey(removeLock.getAttribute('data-v604-remove-lock-date'));saveHrLockedDates(month,hrLockedDates(month).filter(d=>d!==date));try{renderPage();}catch(_){ }return;}
    const exportBtn=e.target?.closest?.('[data-export-hr-v318]');if(exportBtn){e.preventDefault();e.stopPropagation();await exportV318();return;}
    const row=e.target?.closest?.('[data-v318-revert-row]');if(row){e.preventDefault();e.stopPropagation();await resetHistoryRows([row.getAttribute('data-v318-revert-row')]);return;}
    const selectedBatch=e.target?.closest?.('[data-v318-revert-selected-batch]');if(selectedBatch){e.preventDefault();e.stopPropagation();const id=selectedBatch.getAttribute('data-v318-revert-selected-batch'),ids=(st().hrHistoryRowsV318||[]).filter(x=>String(rowBatch(x))===String(id)).map(x=>x.id);await resetHistoryRows(ids);return;}
    const wholeBatch=e.target?.closest?.('[data-v318-revert-whole-batch]');if(wholeBatch){
      e.preventDefault();e.stopPropagation();const id=wholeBatch.getAttribute('data-v318-revert-whole-batch');
      busy(true,'กำลังค้นหารายการทั้ง Batch');
      try{
        let res=await db().from('ot_requests').select('id').eq('export_batch_id',id);
        if(res.error)throw res.error;
        if(!(res.data||[]).length){res=await db().from('ot_requests').select('id').eq('batch_id',id);if(res.error)throw res.error;}
        if(!(res.data||[]).length){res=await db().from('ot_requests').select('id').eq('claim_batch_id',id);if(res.error)throw res.error;}
        busy(false);await resetHistoryRows((res.data||[]).map(x=>x.id));
      }catch(err){busy(false);toast(`ค้นหา Batch ไม่สำเร็จ: ${err?.message||err}`,'error');}
    }
  },true);

  document.addEventListener('change',async e=>{
    const id=e.target?.id||'';
    if(id==='hrHistoryStaffV318'||id==='hrHistoryYearV318'||id==='hrHistoryMonthNumberV318'){
      if(id==='hrHistoryStaffV318')st().hrHistoryStaffV318=String(e.target.value||'');
      if(id==='hrHistoryYearV318')st().hrHistoryYearV318=String(e.target.value||'');
      if(id==='hrHistoryMonthNumberV318')st().hrHistoryMonthNumberV318=String(e.target.value||'');
      st().hrHistoryRowsV318=[];try{renderPage();}catch(_){ }
      if(st().hrHistoryStaffV318&&st().hrHistoryYearV318&&st().hrHistoryMonthNumberV318)await loadHistory(false);
      return;
    }
    if(id==='otMoneyMonthV241'||id==='otSourceMonthV241'){
      const value=monthKey(e.target.value);st().otMoneyMonthV241=value;st().otSourceMonthV241=value;
      try{await window.cnmiV316?.loadPageData?.('ot',{force:false});renderPage();}catch(_){ }
    }
  },true);

  window.cnmiV318={version:VERSION,exportHr:exportV318,loadHistory,queryCarryIn,queryCarryInSummary,getLockedDates:hrLockedDates,setLockedDates:saveHrLockedDates,clearHistoryCache(){historyCache.clear();},clearCarryCache(){carryCache.clear();summaryCarryCache.clear();},_test:{encodeCarryMarker,parseCarryMarker,applyCarryIn,selectedHistoryMonth,allocate}};
  console.info(`[${VERSION}] loaded`);
})();

} catch (error) { console.error("[v569] patch-v318-hr-carry-year-month-filter.js", error); }
;

/* Original source: patch-v319-fiscal-year-unlock.js */
try {
/* CNMI Staff Planner V319 — fiscal-year unlock on 1 October
   - HR Export history year filter unlocks the next fiscal year every 1 October.
   - Leave date inputs for both Staff and Admin use the same fiscal-year limit.
   - No new Supabase table or SQL is required.
*/
(function(){
  'use strict';
  const VERSION='V319_FISCAL_YEAR_UNLOCK';
  if(window.__CNMI_V319_FISCAL_YEAR_UNLOCK__)return;
  window.__CNMI_V319_FISCAL_YEAR_UNLOCK__=true;

  function pad2(n){return String(n).padStart(2,'0');}
  function localDate(value){
    if(value instanceof Date&&!Number.isNaN(value.getTime()))return new Date(value.getFullYear(),value.getMonth(),value.getDate());
    const text=String(value||'').slice(0,10),m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if(!m)return new Date();
    const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
    return Number.isNaN(d.getTime())?new Date():d;
  }
  function thaiDate(value){
    const d=localDate(value);
    return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()+543}`;
  }
  function fiscalUnlockInfo(baseDate){
    const d=localDate(baseDate||new Date()),year=d.getFullYear(),month=d.getMonth()+1;
    const currentFiscalYearCE=month>=10?year+1:year;
    const unlockedFiscalYearCE=currentFiscalYearCE+1;
    const unlockedFiscalYearBE=unlockedFiscalYearCE+543;
    return {
      currentFiscalYearCE,
      currentFiscalYearBE:currentFiscalYearCE+543,
      unlockedFiscalYearCE,
      unlockedFiscalYearBE,
      maxLeaveDate:`${unlockedFiscalYearCE}-09-30`,
      maxLeaveDateThai:`30/09/${unlockedFiscalYearBE}`,
      nextUnlockDate:`${currentFiscalYearCE}-10-01`,
      nextUnlockDateThai:`01/10/${currentFiscalYearCE+543}`,
      nextUnlockedFiscalYearBE:unlockedFiscalYearBE+1
    };
  }
  function historyYears(baseDate,count=8){
    const max=fiscalUnlockInfo(baseDate).unlockedFiscalYearCE,out=[];
    for(let y=max;y>max-Math.max(1,Number(count)||8);y--)out.push({value:String(y),label:`พ.ศ. ${y+543}`});
    return out;
  }
  function escapeHtmlSafe(value){
    try{return typeof escapeHtml==='function'?escapeHtml(String(value??'')):String(value??'');}
    catch(_){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  }
  function stateSafe(){try{return state;}catch(_){return window.state||{};}}
  function addOrReplaceAttr(tag,name,value){
    const attr=`${name}="${String(value).replace(/"/g,'&quot;')}"`,re=new RegExp(`\\s${name}="[^"]*"`,'i');
    return re.test(tag)?tag.replace(re,` ${attr}`):tag.replace(/>$/,` ${attr}>`);
  }
  function applyLeaveLimit(html){
    const info=fiscalUnlockInfo(),note=`<div class="notice soft-notice wide" data-v319-fiscal-leave-note>ระบบเปิดให้ทุกคนบันทึกการลาถึง ${info.maxLeaveDateThai} (สิ้นปีงบประมาณ ${info.unlockedFiscalYearBE}) และจะปลดล็อกปีงบประมาณ ${info.nextUnlockedFiscalYearBE} อัตโนมัติวันที่ ${info.nextUnlockDateThai}</div>`;
    let out=String(html||'');
    out=out.replace(/<input\s+name="start_date"\s+type="date"[^>]*>/i,tag=>addOrReplaceAttr(tag,'max',info.maxLeaveDate));
    out=out.replace(/<input\s+name="end_date"\s+type="date"[^>]*>/i,tag=>addOrReplaceAttr(tag,'max',info.maxLeaveDate));
    out=out.replace(/<div class="notice soft-notice wide" data-v203-fiscal-leave-note>[\s\S]*?<\/div>/i,note);
    if(!out.includes('data-v319-fiscal-leave-note'))out=out.replace(/<button class="primary-btn wide" type="submit">/i,`${note}<button class="primary-btn wide" type="submit">`);
    return out;
  }
  function applyHistoryYears(html){
    let out=String(html||'');
    if(!out.includes('id="hrHistoryYearV318"'))return out;
    const selected=String(stateSafe().hrHistoryYearV318||''),info=fiscalUnlockInfo();
    if(selected&&Number(selected)>info.unlockedFiscalYearCE){
      stateSafe().hrHistoryYearV318='';
      stateSafe().hrHistoryRowsV318=[];
    }
    const current=String(stateSafe().hrHistoryYearV318||'');
    const options=['<option value="">กรุณาเลือกปี</option>',...historyYears().map(y=>`<option value="${y.value}" ${y.value===current?'selected':''}>${escapeHtmlSafe(y.label)}</option>`)].join('');
    return out.replace(/(<select\s+id="hrHistoryYearV318"[^>]*>)[\s\S]*?(<\/select>)/i,`$1${options}$2`);
  }

  const previousRenderOtPage=window.renderOtPage||(typeof renderOtPage==='function'?renderOtPage:null);
  if(typeof previousRenderOtPage==='function'&&!previousRenderOtPage.__v319FiscalUnlock){
    const wrapped=function renderOtPageV319(){return applyHistoryYears(previousRenderOtPage.apply(this,arguments));};
    wrapped.__v319FiscalUnlock=true;
    try{window.renderOtPage=renderOtPage=wrapped;}catch(_){window.renderOtPage=wrapped;}
  }

  const previousRenderLeavePage=window.renderLeavePage||(typeof renderLeavePage==='function'?renderLeavePage:null);
  if(typeof previousRenderLeavePage==='function'&&!previousRenderLeavePage.__v319FiscalUnlock){
    const wrapped=function renderLeavePageV319(){return applyLeaveLimit(previousRenderLeavePage.apply(this,arguments));};
    wrapped.__v319FiscalUnlock=true;
    try{window.renderLeavePage=renderLeavePage=wrapped;}catch(_){window.renderLeavePage=wrapped;}
  }

  function validateLeave(form,notify=true){
    const info=fiscalUnlockInfo(),start=form?.querySelector?.('input[name="start_date"]'),end=form?.querySelector?.('input[name="end_date"]');
    if(start)start.max=info.maxLeaveDate;if(end)end.max=info.maxLeaveDate;
    const over=[start?.value,end?.value].some(v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))&&String(v)>info.maxLeaveDate);
    const message=over?`บันทึกการลาได้ถึง ${info.maxLeaveDateThai} ซึ่งเป็นวันสิ้นสุดปีงบประมาณ ${info.unlockedFiscalYearBE}`:'';
    [start,end].forEach(input=>{try{input?.setCustomValidity?.(message);}catch(_){}});
    if(over&&notify){try{showToast(message,{tone:'error'});}catch(_){alert(message);}}
    return !over;
  }
  const previousSaveLeave=window.saveLeave||(typeof saveLeave==='function'?saveLeave:null);
  if(typeof previousSaveLeave==='function'&&!previousSaveLeave.__v319FiscalUnlock){
    const wrapped=async function saveLeaveV319(form){if(!validateLeave(form,true))return;return previousSaveLeave.apply(this,arguments);};
    wrapped.__v319FiscalUnlock=true;
    try{window.saveLeave=saveLeave=wrapped;}catch(_){window.saveLeave=wrapped;}
  }
  document.addEventListener('change',event=>{
    const form=event.target?.closest?.('#leaveForm');
    if(form&&['start_date','end_date'].includes(event.target?.name))validateLeave(form,true);
  },true);

  window.cnmiV319={version:VERSION,getFiscalUnlockInfo:fiscalUnlockInfo,historyYears,_test:{fiscalUnlockInfo,historyYears,applyHistoryYears,applyLeaveLimit}};
  console.info(`[${VERSION}] 1 October fiscal-year unlock loaded`,fiscalUnlockInfo());
})();

} catch (error) { console.error("[v569] patch-v319-fiscal-year-unlock.js", error); }
;

/* Original source: patch-v321-daily-role-options.js */
try {
/* CNMI Staff Planner — V321
   Daily position manual dropdowns:
   - Show every active staff member who matches the slot's main role.
   - Do not hide names because of personal position-permission rows.
   - Keep auto-assignment/monthly permission logic unchanged.
   - Include trainees in manual choices; leave records remain visible but disabled.
*/
(function cnmiV321DailyRoleOptions(){
  'use strict';
  const VERSION = 'V321';

  function appState(){
    try { if (typeof state !== 'undefined' && state) return state; } catch (_) {}
    return window.state || {};
  }
  function idOf(value){ return String(value == null ? '' : value); }
  function text(value){ return String(value == null ? '' : value).trim(); }
  function nickname(staff){ return text(staff?.nickname || staff?.nick_name || staff?.display_name || staff?.full_name); }
  function fullLabel(staff){
    const name = nickname(staff) || text(staff?.full_name) || '-';
    const type = text(staff?.staff_type || staff?.role_type || staff?.position_type);
    const trainee = staff?.is_trainee === true || /น้องใหม่|ผู้ฝึก/.test(text(staff?.position_training_status));
    return `${name}${type ? ` (${type})` : ''}${trainee ? ' • น้องใหม่/ผู้ฝึก' : ''}`;
  }
  function isActiveStaff(staff){
    if (!staff?.id) return false;
    if (staff.is_active === false || staff.active === false || staff.enabled === false) return false;
    const status = text(staff.status).toLowerCase();
    if (['inactive','disabled','deleted','resigned'].includes(status)) return false;
    const type = text(staff.staff_type);
    if (window.cnmiPersonTypeV516?.isPhysician?.(staff) ?? /^(แพทย์|physician|doctor)$/i.test(type)) return false;
    return true;
  }
  function isTang(staff){ return nickname(staff) === 'แตง'; }
  function isMT(staff){
    const raw = text(staff?.staff_type || staff?.role_type || staff?.position_type);
    return /^mt$/i.test(raw) || /นักเทคนิค|medical\s*technologist/i.test(raw);
  }
  function isClerk(staff){
    const raw = text(staff?.staff_type || staff?.role_type || staff?.position_type);
    return raw === 'เคิก' || /clerk|ธุรการ|เจ้าหน้าที่ธุรการ/i.test(raw);
  }
  function roleMatch(staff, rule){
    if (!isActiveStaff(staff)) return false;
    const source = text(rule);
    if (!source) return true;
    const lower = source.toLowerCase();
    const mentionsMT = /(^|[^a-z])mt([^a-z]|$)/i.test(source) || /นักเทคนิค/.test(source);
    const mentionsClerk = /clerk/i.test(source) || /เคิก|ธุรการ/.test(source);
    const mentionsTang = /แตง/.test(source);

    if (mentionsMT && mentionsClerk) return isMT(staff) || isClerk(staff) || isTang(staff);
    if (mentionsMT) return isMT(staff) || isTang(staff);
    if (mentionsClerk) return isClerk(staff) || isTang(staff);
    if (mentionsTang) return isTang(staff);
    if (/ทุกคน|all|ไม่จำกัด|ทั่วไป/.test(lower)) return true;
    return true;
  }
  function selectedOption(select){
    return Array.from(select.options || []).find(option => option.selected) || null;
  }
  function currentDate(){
    const st = appState();
    return text(document.getElementById('positionDateInput')?.value || st.positionDate || '').slice(0,10);
  }
  function isOnLeave(staffId, date){
    if (!staffId || !date) return false;
    try {
      if (typeof isActiveLeaveOn === 'function') return !!isActiveLeaveOn(staffId, date);
    } catch (_) {}
    try {
      if (typeof window.isActiveLeaveOn === 'function') return !!window.isActiveLeaveOn(staffId, date);
    } catch (_) {}
    return false;
  }
  function compareStaff(a, b){
    try {
      if (typeof compareStaffOrder === 'function') return compareStaffOrder(a, b);
    } catch (_) {}
    try {
      if (typeof window.compareStaffOrder === 'function') return window.compareStaffOrder(a, b);
    } catch (_) {}
    return nickname(a).localeCompare(nickname(b), 'th');
  }
  function optionFor(staff, selectedId, date){
    const option = document.createElement('option');
    option.value = idOf(staff.id);
    const leave = isOnLeave(staff.id, date);
    option.textContent = `${fullLabel(staff)}${leave ? ' ⚠ ลาวันนี้' : ''}`;
    option.selected = idOf(staff.id) === selectedId;
    if (leave && !option.selected) option.disabled = true;
    return option;
  }
  function patchSelect(select, date){
    if (!select || select.dataset.v321RoleOptions === '1') return;
    const st = appState();
    const selected = selectedOption(select);
    const selectedId = idOf(select.value || selected?.value);
    const rule = text(select.dataset.positionRule);
    let list = (Array.isArray(st.staff) ? st.staff : []).filter(person => roleMatch(person, rule));

    const selectedStaff = (Array.isArray(st.staff) ? st.staff : []).find(person => idOf(person.id) === selectedId);
    if (selectedStaff && !list.some(person => idOf(person.id) === selectedId)) list.unshift(selectedStaff);
    list.sort(compareStaff);

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'เลือกคน/ว่าง';
    if (!selectedId) placeholder.selected = true;

    select.replaceChildren(placeholder, ...list.map(person => optionFor(person, selectedId, date)));

    if (selectedId && !list.some(person => idOf(person.id) === selectedId)) {
      const preserved = document.createElement('option');
      preserved.value = selectedId;
      preserved.textContent = selected?.textContent || 'ค่าปัจจุบัน';
      preserved.selected = true;
      select.appendChild(preserved);
    }
    select.dataset.v321RoleOptions = '1';
  }
  function patchRoot(root){
    if (!root?.querySelectorAll) return;
    const st = appState();
    if (st.page && st.page !== 'positions') return;
    const date = currentDate();
    root.querySelectorAll('select[data-position-row]').forEach(select => patchSelect(select, date));
  }
  function patchHtml(html){
    if (typeof document === 'undefined') return String(html || '');
    const template = document.createElement('template');
    template.innerHTML = String(html || '');
    const date = currentDate();
    template.content.querySelectorAll('select[data-position-row]').forEach(select => patchSelect(select, date));
    return template.innerHTML;
  }
  function assignRender(fn){
    window.renderPositionsPage = fn;
    try { renderPositionsPage = fn; } catch (_) {}
  }

  try {
    const previous = window.renderPositionsPage || (typeof renderPositionsPage === 'function' ? renderPositionsPage : null);
    if (previous && !previous.__v321DailyRoleOptions) {
      const wrapped = function renderPositionsPageV321(){
        return patchHtml(previous.apply(this, arguments));
      };
      wrapped.__v321DailyRoleOptions = true;
      wrapped.__v321Previous = previous;
      assignRender(wrapped);
    }
  } catch (error) {
    console.warn(`${VERSION}: render wrapper skipped`, error);
  }

  if (typeof document !== 'undefined') {
    const installObserver = () => {
      const root = document.getElementById('pageContent');
      if (!root || root.dataset.v321Observer === '1') return;
      root.dataset.v321Observer = '1';
      const observer = new MutationObserver(() => patchRoot(root));
      observer.observe(root, { childList:true, subtree:true });
      patchRoot(root);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installObserver, { once:true });
    else installObserver();
  }

  window.cnmiV321 = { roleMatch, isMT, isClerk, isTang, patchRoot };
  console.info(`${VERSION}: daily manual dropdowns now use role-based full staff lists`);
})();

} catch (error) { console.error("[v569] patch-v321-daily-role-options.js", error); }
;

/* Original source: patch-v322-daily-baseline-compare.js */
try {
/* CNMI Staff Planner — V322
   Daily-position baseline comparison for Admin / Incharge.
   - Restores the visible monthly-plan name on mobile cards.
   - Shows a live "baseline -> today" comparison while dropdowns are changed.
   - Uses rows and staff already loaded on the daily page.
   - No Supabase query, insert, update, schema, Carry, OT, roster, or formula change.
*/
(function cnmiV322DailyBaselineCompare(){
  'use strict';
  const VERSION='V322_DAILY_BASELINE_COMPARE';
  if(window.__CNMI_V322_DAILY_BASELINE_COMPARE__) return;
  window.__CNMI_V322_DAILY_BASELINE_COMPARE__=true;

  let queued=false;
  let enhancing=false;

  function appState(){
    try{if(typeof state!=='undefined'&&state)return state;}catch(_){}
    return window.state||{};
  }
  function text(value){return String(value==null?'':value).trim();}
  function id(value){return String(value==null?'':value);}
  function esc(value){
    return text(value).replace(/[&<>"']/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }
  function rows(){
    return window.__CNMI_V226_DAILY_POSITION_ROWS__
      || window.__CNMI_V225_DAILY_POSITION_ROWS__
      || [];
  }
  function staffList(){
    const list=appState()?.staff;
    return Array.isArray(list)?list:[];
  }
  function staffById(staffId){
    const key=id(staffId);
    return staffList().find(person=>id(person?.id)===key)||null;
  }
  function staffName(staffId){
    if(!staffId)return 'ว่าง';
    const person=staffById(staffId);
    return text(person?.nickname||person?.nick_name||person?.display_name||person?.full_name||person?.email)||'ไม่พบชื่อ';
  }
  function isTrainee(staffId){
    const person=staffById(staffId);
    if(!person)return false;
    if(person.is_trainee===true)return true;
    const status=text(person.position_training_status||person.training_status||person.staff_status);
    return /น้องใหม่|ผู้ฝึก|intern|trainee/i.test(status);
  }
  function isOnLeave(staffId,date){
    if(!staffId||!date)return false;
    try{if(typeof isActiveLeaveOn==='function')return !!isActiveLeaveOn(staffId,date);}catch(_){}
    try{if(typeof window.isActiveLeaveOn==='function')return !!window.isActiveLeaveOn(staffId,date);}catch(_){}
    return false;
  }
  function currentDate(){
    return text(document.getElementById('positionDateInput')?.value||appState()?.positionDate).slice(0,10);
  }
  function codeOf(row){
    return text(row?.position_code||row?.code)||'ตำแหน่ง';
  }
  function plannedId(row){
    return id(row?._planned_staff_id||'');
  }
  function currentId(row,index,root){
    const mobile=root.querySelector(`select[data-position-row="${index}"][data-position-layout-item="mobile"]`);
    const any=mobile||root.querySelector(`select[data-position-row="${index}"]`);
    return any?id(any.value):id(row?.staff_id||'');
  }
  function badgeText(staffId,date){
    const notes=[];
    if(isTrainee(staffId))notes.push('น้องใหม่/ผู้ฝึก • ไม่นับ Slot');
    if(isOnLeave(staffId,date))notes.push('ลาวันนี้');
    return notes.join(' • ');
  }
  function makeBaselineBox(row,date){
    const box=document.createElement('div');
    box.className='v322-baseline-box';
    const pid=plannedId(row);
    const note=badgeText(pid,date);
    box.innerHTML=`
      <span class="v322-baseline-label">ตั้งต้นจาก Admin</span>
      <strong class="v322-baseline-name">${esc(staffName(pid))}</strong>
      ${note?`<span class="v322-baseline-note">${esc(note)}</span>`:''}
    `;
    return box;
  }
  function findPlanNode(card){
    return Array.from(card.children||[]).find(node=>{
      if(!(node instanceof HTMLElement))return false;
      if(node.classList.contains('section-title')||node.classList.contains('v311-position-duty-preview')||node.classList.contains('v296-position-duty-preview'))return false;
      return /แผนตั้งต้น|ตั้งต้นจาก Admin/.test(text(node.textContent));
    })||null;
  }
  function ensureCardBaseline(card,row,date){
    let box=card.querySelector(':scope > .v322-baseline-box');
    const old=findPlanNode(card);
    if(!box){
      box=makeBaselineBox(row,date);
      if(old)old.replaceWith(box);
      else{
        const duty=card.querySelector(':scope > .v311-position-duty-preview,:scope > .v296-position-duty-preview');
        const label=card.querySelector(':scope > label');
        if(duty)card.insertBefore(box,duty);
        else if(label)card.insertBefore(box,label);
        else card.appendChild(box);
      }
    }else{
      const fresh=makeBaselineBox(row,date);
      if(box.innerHTML!==fresh.innerHTML)box.innerHTML=fresh.innerHTML;
      if(old&&old!==box)old.remove();
    }
  }
  function statusMessage(plan,current){
    const from=staffName(plan);
    const to=staffName(current);
    if(plan===current){
      return {tone:'same',html:`วันนี้: <b>ใช้ตามแผนตั้งต้น (${esc(to)})</b>`};
    }
    if(plan&&!current){
      return {tone:'changed',html:`ปรับวันนี้: <b>${esc(from)} → ว่าง</b>`};
    }
    if(!plan&&current){
      return {tone:'changed',html:`ปรับวันนี้: <b>ว่าง → ${esc(to)}</b>`};
    }
    return {tone:'changed',html:`ปรับวันนี้: <b>${esc(from)} → ${esc(to)}</b>`};
  }
  function ensureCardStatus(card,row,index,root){
    const plan=plannedId(row);
    const current=currentId(row,index,root);
    const message=statusMessage(plan,current);
    let node=card.querySelector(':scope > .v322-change-status');
    if(!node){
      node=document.createElement('div');
      node.className='v322-change-status';
      const label=card.querySelector(':scope > label');
      if(label)label.insertAdjacentElement('afterend',node);
      else card.appendChild(node);
    }
    node.classList.toggle('is-changed',message.tone==='changed');
    if(node.innerHTML!==message.html)node.innerHTML=message.html;
  }
  function enhanceDesktop(root,date){
    const data=rows();
    const tableRows=Array.from(root.querySelectorAll('.v225-daily-position-table tbody tr'));
    tableRows.forEach((tr,index)=>{
      const row=data[index]||{};
      const cell=tr.querySelector('.v225-plan-cell')||tr.children?.[3];
      if(!cell)return;
      cell.classList.add('v322-desktop-baseline');
      const pid=plannedId(row);
      const note=badgeText(pid,date);
      const html=`<span class="v322-desktop-label">ตั้งต้นจาก Admin</span><b>${esc(staffName(pid))}</b>${note?`<small>${esc(note)}</small>`:''}`;
      if(cell.innerHTML!==html)cell.innerHTML=html;
    });
    const head=Array.from(root.querySelectorAll('.v225-daily-position-table thead th'));
    if(head[3]&&head[3].textContent!=='ตั้งต้นจาก Admin')head[3].textContent='ตั้งต้นจาก Admin';
  }
  function ensureSummary(root){
    let panel=root.querySelector('.v322-daily-change-summary');
    if(panel)return panel;
    panel=document.createElement('section');
    panel.className='v322-daily-change-summary';
    panel.innerHTML='<h3>เทียบแผนตั้งต้นกับการปรับวันนี้</h3><div class="v322-summary-body"></div>';
    const mobileList=root.querySelector('.v225-mobile-position-list');
    const desktopTable=root.querySelector('.v225-daily-position-table');
    const anchor=desktopTable||mobileList;
    if(anchor)anchor.insertAdjacentElement('beforebegin',panel);
    else root.appendChild(panel);
    return panel;
  }
  function updateSummary(root){
    const data=rows();
    const changes=[];
    data.forEach((row,index)=>{
      const plan=plannedId(row);
      const current=currentId(row,index,root);
      if(plan===current)return;
      changes.push({
        code:codeOf(row),
        from:staffName(plan),
        to:staffName(current)
      });
    });
    const panel=ensureSummary(root);
    const body=panel.querySelector('.v322-summary-body');
    if(!body)return;
    const html=changes.length
      ? `<div class="v322-summary-count">มีการปรับ ${changes.length} ตำแหน่ง</div><div class="v322-summary-list">${changes.map(item=>`<div><b>${esc(item.code)}</b><span>${esc(item.from)} → ${esc(item.to)}</span></div>`).join('')}</div>`
      : '<div class="v322-summary-empty">ยังไม่มีการปรับจากแผนตั้งต้นของ Admin</div>';
    if(body.innerHTML!==html)body.innerHTML=html;
  }
  function syncTwinSelect(source,root){
    const row=source?.dataset?.positionRow;
    if(row==null)return;
    root.querySelectorAll(`select[data-position-row="${CSS.escape(String(row))}"]`).forEach(select=>{
      if(select===source)return;
      if(Array.from(select.options||[]).some(option=>id(option.value)===id(source.value))){
        select.value=source.value;
      }
    });
  }
  function enhance(){
    if(enhancing)return;
    const root=document.getElementById('pageContent');
    if(!root||String(appState()?.page||'')!=='positions')return;
    const page=root.querySelector('.v225-positions-page,.v226-positions-page');
    if(!page)return;
    enhancing=true;
    try{
      const data=rows();
      const date=currentDate();
      const cards=Array.from(page.querySelectorAll('.v225-mobile-position-list > .position-mobile-card,.v225-mobile-position-list > .v225-position-card'));
      cards.forEach((card,index)=>{
        const row=data[index]||{};
        ensureCardBaseline(card,row,date);
        ensureCardStatus(card,row,index,page);
      });
      enhanceDesktop(page,date);
      updateSummary(page);
      page.dataset.v322BaselineCompare='1';
    }finally{
      enhancing=false;
    }
  }
  function queueEnhance(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      enhance();
    });
  }
  function injectStyle(){
    if(document.getElementById('v322-daily-baseline-compare-style'))return;
    const style=document.createElement('style');
    style.id='v322-daily-baseline-compare-style';
    style.textContent=`
      .v322-baseline-box{
        display:flex!important;
        flex-direction:column!important;
        gap:4px!important;
        width:100%!important;
        min-width:0!important;
        padding:12px 14px!important;
        border:1px solid #bfdbfe!important;
        border-radius:16px!important;
        background:#eff6ff!important;
        color:#1e3a5f!important;
        box-sizing:border-box!important;
        position:relative!important;
        z-index:2!important;
      }
      .v322-baseline-label{font-size:13px;font-weight:700;color:#64748b}
      .v322-baseline-name{font-size:17px;color:#0f3d68;line-height:1.25}
      .v322-baseline-note{font-size:12px;font-weight:700;color:#b45309}
      .v322-change-status{
        display:block!important;
        width:100%!important;
        min-width:0!important;
        padding:9px 12px!important;
        border-radius:12px!important;
        background:#f8fafc!important;
        border:1px solid #e2e8f0!important;
        color:#475569!important;
        box-sizing:border-box!important;
        font-size:13px!important;
      }
      .v322-change-status.is-changed{
        background:#fff7ed!important;
        border-color:#fdba74!important;
        color:#9a3412!important;
      }
      .v322-daily-change-summary{
        margin:14px 0!important;
        padding:14px!important;
        border:1px solid #bfdbfe!important;
        border-radius:18px!important;
        background:#fff!important;
      }
      .v322-daily-change-summary h3{margin:0 0 10px;font-size:17px}
      .v322-summary-empty{color:#64748b}
      .v322-summary-count{font-weight:800;color:#9a3412;margin-bottom:8px}
      .v322-summary-list{display:grid;gap:7px}
      .v322-summary-list>div{
        display:flex;justify-content:space-between;gap:12px;
        padding:8px 10px;border-radius:10px;background:#fff7ed;
        border:1px solid #fed7aa
      }
      .v322-summary-list span{text-align:right;color:#9a3412}
      .v322-desktop-baseline{min-width:150px}
      .v322-desktop-baseline .v322-desktop-label{display:block;font-size:11px;color:#64748b}
      .v322-desktop-baseline b{display:block;margin-top:2px}
      .v322-desktop-baseline small{display:block;margin-top:3px;color:#b45309}

      @media(max-width:760px){
        .position-mobile-card.v225-position-card{
          grid-template-columns:minmax(0,1fr)!important;
          grid-template-areas:
            "head"
            "meta"
            "plan"
            "duty"
            "edit"
            "compare"
            "action"!important;
        }
        .position-mobile-card.v225-position-card > .v322-baseline-box{
          grid-area:plan!important;
          display:flex!important;
        }
        .position-mobile-card.v225-position-card > .v311-position-duty-preview,
        .position-mobile-card.v225-position-card > .v296-position-duty-preview{
          grid-area:duty!important;
          width:100%!important;
          min-width:0!important;
          position:relative!important;
          z-index:1!important;
        }
        .position-mobile-card.v225-position-card > label{
          grid-area:edit!important;
        }
        .position-mobile-card.v225-position-card > .v322-change-status{
          grid-area:compare!important;
        }
        .position-mobile-card.v225-position-card > .actions{
          grid-area:action!important;
        }
        .v322-summary-list>div{flex-direction:column;gap:3px}
        .v322-summary-list span{text-align:left}
      }
    `;
    document.head.appendChild(style);
  }

  injectStyle();

  document.addEventListener('change',event=>{
    const select=event.target?.closest?.('select[data-position-row]');
    if(!select)return;
    const root=document.querySelector('.v225-positions-page,.v226-positions-page');
    if(!root)return;
    syncTwinSelect(select,root);
    queueEnhance();
  },true);

  const install=()=>{
    injectStyle();
    const root=document.getElementById('pageContent');
    if(root&&!root.__v322Observer){
      const observer=new MutationObserver(queueEnhance);
      observer.observe(root,{childList:true,subtree:true});
      root.__v322Observer=observer;
    }
    queueEnhance();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.cnmiV322={enhance,queueEnhance,staffName};
  console.info(`${VERSION}: baseline comparison enabled without extra Supabase reads`);
})();
} catch (error) { console.error("[v569] patch-v322-daily-baseline-compare.js", error); }
;

/* Original source: patch-v323-popup-job-stability.js */
try {
/* CNMI Staff Planner — V323
   PWA popup + daily job-description stability guard.
   - Keeps the daily job description visible together with V322 baseline comparison.
   - Provides a fallback popup route when an older interaction patch is unavailable.
   - Uses data already loaded in the page; no Supabase read/write is added.
*/
(function cnmiV323PopupJobStability(){
  'use strict';
  const VERSION='V323_POPUP_JOB_STABILITY';
  if(window.__CNMI_V323_POPUP_JOB_STABILITY__) return;
  window.__CNMI_V323_POPUP_JOB_STABILITY__=true;

  let queued=false;
  let lastFallbackKey='';
  let lastFallbackAt=0;

  function stateSafe(){
    try{if(typeof state!=='undefined'&&state)return state;}catch(_){}
    return window.state||{};
  }
  function text(value){return String(value==null?'':value).trim();}
  function esc(value){
    return text(value).replace(/[&<>"']/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[ch]));
  }
  function rows(){
    return window.__CNMI_V226_DAILY_POSITION_ROWS__
      || window.__CNMI_V225_DAILY_POSITION_ROWS__
      || [];
  }
  function positionCode(row,card){
    return text(row?.position_code||row?.code||card?.querySelector?.('select[data-position-code]')?.dataset?.positionCode);
  }
  function positionMaster(code){
    const st=stateSafe();
    for(const list of [st.positionMasters,st.dailyPositionMasters,st.positions]){
      if(!Array.isArray(list))continue;
      const found=list.find(item=>text(item?.code||item?.position_code)===text(code));
      if(found)return found;
    }
    try{if(typeof window.positionByCode==='function')return window.positionByCode(code)||{};}catch(_){}
    try{
      const list=window.DEFAULT_DAILY_POSITIONS||[];
      return (Array.isArray(list)?list:[]).find(item=>text(item?.code)===text(code))||{};
    }catch(_){return {};}
  }
  function jobText(row,card){
    const select=card?.querySelector?.('select[data-position-row],select[data-position-job]');
    const direct=text(row?.job_desc||row?.description||select?.dataset?.positionJob);
    if(direct)return direct;
    const master=positionMaster(positionCode(row,card));
    return text(master?.job_desc||master?.description)||'ยังไม่ได้ระบุรายละเอียดหน้าที่';
  }
  function ensureDailyJobDescriptions(){
    const root=document.getElementById('pageContent');
    const page=root?.querySelector?.('.v225-positions-page,.v226-positions-page');
    if(!page)return;
    try{
      if(window.cnmiV311?.keepDailyDutyText){
        window.cnmiV311.keepDailyDutyText(document);
        return;
      }
    }catch(error){console.warn(`[${VERSION}] V311 daily detail fallback`,error);}

    const data=rows();
    const cards=Array.from(page.querySelectorAll('.v225-mobile-position-list > .position-mobile-card,.v225-mobile-position-list > .v225-position-card'));
    cards.forEach((card,index)=>{
      const job=jobText(data[index]||{},card);
      let preview=card.querySelector(':scope > .v311-position-duty-preview');
      if(!preview){
        preview=document.createElement('div');
        preview.className='v311-position-duty-preview v323-position-duty-preview';
      }
      const html=`<b>หน้าที่:</b><span>${esc(job)}</span>`;
      if(preview.innerHTML!==html)preview.innerHTML=html;
      const anchor=card.querySelector(':scope > .v322-baseline-box,:scope > label,:scope > .actions');
      if(anchor&&preview.nextElementSibling!==anchor)card.insertBefore(preview,anchor);
      else if(!anchor&&preview.parentElement!==card)card.appendChild(preview);
    });
  }
  function modalVisible(){
    const modal=document.getElementById('modal');
    return !!(modal&&!modal.classList.contains('hidden'));
  }
  function forceModal(html){
    const modal=document.getElementById('modal');
    const body=document.getElementById('modalBody');
    if(!modal||!body)return false;
    if(typeof html==='string')body.innerHTML=html;
    modal.classList.remove('hidden','modal-closing');
    modal.classList.add('modal-ready');
    document.body.classList.add('modal-open');
    return true;
  }
  function showModalSafe(html){
    try{
      if(typeof window.showModal==='function')window.showModal(html);
      else forceModal(html);
    }catch(_){forceModal(html);}
    requestAnimationFrame(()=>forceModal(null));
  }
  function thaiDate(date){
    try{if(typeof window.formatThaiDate==='function')return window.formatThaiDate(date);}catch(_){}
    return date;
  }
  function calendarPopup(date){
    try{if(window.cnmiV311?.openCalendar)return window.cnmiV311.openCalendar(date);}catch(_){}
    let all=[];
    try{if(typeof window.collectCalendarEvents==='function')all=window.collectCalendarEvents()||[];}catch(_){}
    const key=text(date).slice(0,10);
    const found=(Array.isArray(all)?all:[]).filter(item=>text(item?.date).slice(0,10)===key);
    const items=found.length?found.map(item=>`<div class="calendar-modal-row"><b>${esc(item?.title||'-')}</b></div>`).join(''):'<div class="empty-state">ไม่มีรายการในวันนี้</div>';
    showModalSafe(`<div class="v311-calendar-modal"><h2>${esc(thaiDate(key))}</h2><div class="calendar-modal-list">${items}</div></div>`);
  }
  function resolvePositionCode(node){
    const direct=text(node?.dataset?.v275Job||node?.dataset?.v273JobCode);
    if(direct)return direct;
    const card=node?.closest?.('.v225-position-card,.v219-position-card,.position-mobile-card');
    const fromCard=text(card?.querySelector?.('select[data-position-code]')?.dataset?.positionCode||card?.querySelector?.('h3')?.textContent);
    if(fromCard)return fromCard.replace(/\s+/g,' ').trim();
    const index=Number(node?.dataset?.v225PositionDetail||node?.dataset?.v226PositionDetail||node?.dataset?.positionDetailV219||node?.dataset?.v296PositionDetail);
    const row=Number.isInteger(index)?rows()[index]:null;
    return text(row?.position_code||row?.code);
  }
  function positionPopup(node){
    const code=resolvePositionCode(node);
    if(!code)return;
    try{
      if(window.cnmiV311?.openPosition){
        const proxy=document.createElement('button');
        proxy.setAttribute('data-v275-job',code);
        return window.cnmiV311.openPosition(proxy);
      }
    }catch(_){}
    const row=positionMaster(code)||{};
    showModalSafe(`<div class="v311-position-modal"><h2>${esc(code)}</h2><div class="v311-position-meta"><span><small>โซน</small><b>${esc(row?.zone||'-')}</b></span><span><small>เวลาพัก</small><b>${esc(row?.break_time||'-')}</b></span></div><div class="v311-position-box"><h3>ผู้ปฏิบัติหลัก / เงื่อนไข</h3><p>${esc(row?.main_rule||'-')}</p></div><div class="v311-position-box"><h3>รายละเอียดหน้าที่</h3><p>${esc(row?.job_desc||row?.description||'ยังไม่ได้ระบุรายละเอียดหน้าที่')}</p></div></div>`);
  }
  function tradePopup(node){
    try{if(window.cnmiV311?.openTrade)return window.cnmiV311.openTrade(node);}catch(_){}
    const id=text(node?.dataset?.tradeDuty);
    if(!id)return;
    try{
      if(typeof window.showTradeModal==='function'){
        window.showTradeModal(id);
        requestAnimationFrame(()=>forceModal(null));
      }
    }catch(error){console.warn(`[${VERSION}] trade popup fallback failed`,error);}
  }
  function actionFor(target){
    if(target?.nodeType===3)target=target.parentElement;
    if(!target?.closest)return null;
    const calendar=target.closest('[data-day-detail]');
    if(calendar)return {type:'calendar',node:calendar,key:`calendar:${text(calendar.dataset.dayDetail)}`};
    const position=target.closest('[data-v275-job],[data-v273-job-code],[data-v225-position-detail],[data-v226-position-detail],[data-position-detail-v219],[data-v296-position-detail]');
    if(position)return {type:'position',node:position,key:`position:${resolvePositionCode(position)}`};
    const trade=target.closest('[data-trade-duty],#scheduleTable .clean-shift-pill,.clean-schedule-grid .clean-shift-pill');
    if(trade)return {type:'trade',node:trade,key:`trade:${text(trade.dataset.tradeDuty||trade.textContent)}`};
    return null;
  }
  function fallbackAction(action){
    if(!action)return;
    const recent=window.__CNMI_LAST_POPUP_ACTION__;
    if(recent&&recent.key===action.key&&Date.now()-Number(recent.at||0)<900)return;
    if(modalVisible())return;
    const now=Date.now();
    if(action.key===lastFallbackKey&&now-lastFallbackAt<900)return;
    lastFallbackKey=action.key;
    lastFallbackAt=now;
    if(action.type==='calendar')calendarPopup(action.node.dataset.dayDetail);
    else if(action.type==='position')positionPopup(action.node);
    else if(action.type==='trade')tradePopup(action.node);
  }
  function delayedFallback(event){
    const action=actionFor(event.target);
    if(!action)return;
    setTimeout(()=>fallbackAction(action),0);
  }
  function queueEnhance(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      ensureDailyJobDescriptions();
    });
  }
  function injectStyle(){
    if(document.getElementById('v323-popup-job-stability-style'))return;
    const style=document.createElement('style');
    style.id='v323-popup-job-stability-style';
    style.textContent=`
      .modal:not(.hidden){z-index:100000!important}
      .v311-position-duty-preview,.v323-position-duty-preview{
        display:block!important;width:100%!important;min-width:0!important;
        box-sizing:border-box!important;position:relative!important;z-index:1!important
      }
      @media(max-width:760px){
        .position-mobile-card.v225-position-card{
          grid-template-areas:
            "head"
            "meta"
            "duty"
            "plan"
            "edit"
            "compare"
            "action"!important;
        }
      }
    `;
    document.head.appendChild(style);
  }
  function install(){
    injectStyle();
    const root=document.getElementById('pageContent')||document.body;
    if(root&&!root.__v323JobObserver){
      const observer=new MutationObserver(queueEnhance);
      observer.observe(root,{childList:true,subtree:true});
      root.__v323JobObserver=observer;
    }
    document.addEventListener('click',delayedFallback,true);
    document.addEventListener('pointerup',event=>{
      if(event.pointerType==='mouse')return;
      delayedFallback(event);
    },true);
    window.addEventListener('pageshow',queueEnhance);
    queueEnhance();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.cnmiV323={ensureDailyJobDescriptions,calendarPopup,positionPopup,tradePopup};
  console.info(`[${VERSION}] loaded; DOM-only, no extra Supabase traffic`);
})();

} catch (error) { console.error("[v569] patch-v323-popup-job-stability.js", error); }
;

/* Original source: patch-v326-donor-helper-unit-dropdown.js */
try {
/* CNMI Staff Planner V326 — คนมาช่วยห้องบริจาคโลหิต + Dropdown 7 หน่วย
   - คนในหน่วยดูตารางจาก App Staff Planner
   - คนนอกหน่วยลงชื่อผ่าน donor-helper.html
   - ผู้ลงชื่อขอยกเลิกได้ แต่ลบชื่อ/คืนช่องเองไม่ได้
   - ไม่แก้สูตร OT และคงการขอ OT ส่วนที่ 2 ตามเดิม
*/
(function(){
  'use strict';
  const VERSION = 'V326_DONOR_HELPER_UNIT_DROPDOWN';
  const PAGE_ID = 'donorHelpers';
  const UNIT_OPTIONS = [
    'หน่วยคลังพยาธิวิทยา',
    'หน่วยธุรการพยาธิ',
    'หน่วยนิติเวช',
    'หน่วยบริการพยาธิวิทยา',
    'หน่วยพยาธิวิทยากายวิภาค',
    'หน่วยพยาธิวิทยาคลินิก',
    'หน่วยเวชศาสตร์บริการโลหิต',
  ];
  if (window.__CNMI_V326_DONOR_HELPER_UNIT_DROPDOWN__) return;
  window.__CNMI_V326_DONOR_HELPER_UNIT_DROPDOWN__ = true;

  function appState(){ try { return state; } catch (_) { return window.state || null; } }
  function db(){ try { return sb; } catch (_) { return window.sb || null; } }
  function esc(value){
    try { if (typeof escapeHtml === 'function') return escapeHtml(value); } catch (_) {}
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function isAllowedUnit(value){ return UNIT_OPTIONS.includes(String(value || '').trim()); }
  function unitSelectOptions(selected=''){
    const value=String(selected||'').trim();
    return `<option value=""${isAllowedUnit(value)?'':' selected'} disabled>กรุณาเลือกหน่วยงาน</option>`+
      UNIT_OPTIONS.map(unit=>`<option value="${esc(unit)}"${unit===value?' selected':''}>${esc(unit)}</option>`).join('');
  }
  function isAdminSafe(){ try { return typeof isAdmin === 'function' && isAdmin(); } catch (_) { return false; } }
  function toast(message, tone){
    try { return showToast(message, tone ? { tone } : undefined); }
    catch (_) { window.alert(message); }
  }
  function pageRender(){
    try {
      const fn = window.renderPage || (typeof renderPage === 'function' ? renderPage : null);
      if (typeof fn === 'function') fn();
    } catch (error) { console.warn(`[${VERSION}] render failed`, error); }
  }
  function monthKeyNow(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  function dateKey(value){
    const d = value instanceof Date ? value : new Date(`${String(value).slice(0,10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) return String(value || '').slice(0,10);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function thaiDate(value){
    try { if (typeof formatThaiDate === 'function') return formatThaiDate(value); } catch (_) {}
    const d = new Date(`${dateKey(value)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? String(value || '-') : d.toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' });
  }
  function thaiDateTime(value){
    if (!value) return '-';
    try { if (typeof formatThaiDateTime === 'function') return formatThaiDateTime(value); } catch (_) {}
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('th-TH', { dateStyle:'medium', timeStyle:'short' });
  }
  function weekendDates(month){
    const [year, mon] = String(month || monthKeyNow()).split('-').map(Number);
    if (!year || !mon) return [];
    const result = [];
    const days = new Date(year, mon, 0).getDate();
    for (let day = 1; day <= days; day++) {
      const d = new Date(year, mon - 1, day, 12, 0, 0);
      if (d.getDay() === 0 || d.getDay() === 6) result.push(dateKey(d));
    }
    return result;
  }
  function monthLabel(month){
    const [year, mon] = String(month || monthKeyNow()).split('-').map(Number);
    const d = new Date(year, (mon || 1) - 1, 1);
    return Number.isNaN(d.getTime()) ? month : d.toLocaleDateString('th-TH', { month:'long', year:'numeric' });
  }
  function slotKey(date, type, no){ return `${date}|${type}|${no}`; }
  function slotLabel(type, no){ return type === 'clerk' ? 'Clerk' : `คนเจาะ ${no}`; }
  function statusText(status){
    return ({
      confirmed:'ยืนยันแล้ว',
      cancel_requested:'ขอยกเลิก — รออนุมัติ',
      cancelled:'ยกเลิกแล้ว',
      completed:'มาปฏิบัติงานแล้ว',
      no_show:'ไม่มาตามนัด'
    })[status] || status || '-';
  }
  function statusClass(status){
    return ({confirmed:'green', cancel_requested:'orange', cancelled:'black', completed:'blue', no_show:'red'})[status] || 'black';
  }
  function publicUrl(){
    try { return new URL('donor-helper.html', window.location.href).href; }
    catch (_) { return 'donor-helper.html'; }
  }
  function errorMessage(error){
    const raw = String(error?.message || error || 'ดำเนินการไม่สำเร็จ');
    if (/function .* does not exist|Could not find the function|schema cache/i.test(raw)) {
      return 'ยังไม่ได้ติดตั้งฐานข้อมูล V324 กรุณาให้ Admin Run ไฟล์ SQL_V324_DONOR_HELPER_BOOKING.sql ใน Supabase ก่อน';
    }
    if (/Permission denied/i.test(raw)) return 'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้';
    try { if (typeof friendlyDbError === 'function') return friendlyDbError(error); } catch (_) {}
    return raw;
  }

  try {
    if (typeof NAV_ITEMS !== 'undefined' && Array.isArray(NAV_ITEMS) && !NAV_ITEMS.some(item => item.id === PAGE_ID)) {
      const otIndex = NAV_ITEMS.findIndex(item => item.id === 'ot');
      const item = {
        id: PAGE_ID,
        icon: '🩸',
        title: 'คนมาช่วยห้องบริจาคโลหิต',
        subtitle: 'ดูรายชื่อคนนอกหน่วยที่มาช่วยวันเสาร์–อาทิตย์ 09:00–17:00 น.',
        group: 'staff'
      };
      NAV_ITEMS.splice(otIndex >= 0 ? otIndex : NAV_ITEMS.length, 0, item);
    }
  } catch (error) { console.warn(`[${VERSION}] cannot add nav`, error); }

  const st = appState();
  if (st) {
    st.donorHelperMonthV324 = st.donorHelperMonthV324 || monthKeyNow();
    st.donorHelperRowsV324 = st.donorHelperRowsV324 || [];
    st.donorHelperLoadedMonthV324 = st.donorHelperLoadedMonthV324 || '';
    st.donorHelperLoadingV324 = false;
    st.donorHelperErrorV324 = '';
  }

  async function loadMonth(month, options={}){
    const stateRef = appState();
    const client = db();
    if (!stateRef || !client) return;
    const key = String(month || stateRef.donorHelperMonthV324 || monthKeyNow()).slice(0,7);
    if (!options.force && stateRef.donorHelperLoadedMonthV324 === key && !stateRef.donorHelperErrorV324) return;
    if (stateRef.donorHelperLoadingV324) return;

    stateRef.donorHelperLoadingV324 = true;
    stateRef.donorHelperErrorV324 = '';
    if (stateRef.page === PAGE_ID) pageRender();
    try {
      const result = await client.rpc('get_donor_helper_month_internal_v324', { p_month:key });
      if (result.error) throw result.error;
      stateRef.donorHelperRowsV324 = Array.isArray(result.data) ? result.data : [];
      stateRef.donorHelperLoadedMonthV324 = key;
    } catch (error) {
      console.warn(`[${VERSION}] load month failed`, error);
      stateRef.donorHelperRowsV324 = [];
      stateRef.donorHelperLoadedMonthV324 = '';
      stateRef.donorHelperErrorV324 = errorMessage(error);
    } finally {
      stateRef.donorHelperLoadingV324 = false;
      if (stateRef.page === PAGE_ID) pageRender();
    }
  }

  function activeRows(rows){
    return (rows || []).filter(row => row.status !== 'cancelled');
  }
  function activeMap(rows){
    const map = new Map();
    activeRows(rows).forEach(row => map.set(slotKey(dateKey(row.work_date), row.slot_type, Number(row.slot_no)), row));
    return map;
  }
  function slotCard(date, type, no, row, admin){
    if (!row) {
      return `<div class="donor-helper-slot empty">
        <div class="donor-helper-slot-name">${esc(slotLabel(type,no))}</div>
        <div class="donor-helper-empty-text">ยังว่าง</div>
        ${admin ? `<button class="tiny-btn" type="button" data-helper-admin-add="${esc(`${date}|${type}|${no}`)}">เพิ่มชื่อ</button>` : ''}
      </div>`;
    }
    const status = String(row.status || 'confirmed');
    let actions = '';
    if (admin) {
      if (status === 'cancel_requested') {
        actions = `<div class="actions compact-actions">
          <button class="tiny-btn danger" type="button" data-helper-status="${esc(row.id)}|cancelled">ยืนยันยกเลิก</button>
          <button class="tiny-btn" type="button" data-helper-status="${esc(row.id)}|confirmed">ไม่อนุมัติการยกเลิก</button>
        </div>`;
      } else if (status === 'confirmed') {
        actions = `<div class="actions compact-actions">
          <button class="tiny-btn" type="button" data-helper-edit="${esc(row.id)}">แก้ชื่อ</button>
          <button class="tiny-btn" type="button" data-helper-status="${esc(row.id)}|completed">มาปฏิบัติงานแล้ว</button>
          <button class="tiny-btn danger" type="button" data-helper-status="${esc(row.id)}|no_show">ไม่มาตามนัด</button>
          <button class="tiny-btn danger-ghost" type="button" data-helper-status="${esc(row.id)}|cancelled">Admin ยกเลิก</button>
        </div>`;
      }
    }
    return `<div class="donor-helper-slot occupied status-${esc(status)}">
      <div class="donor-helper-slot-head"><span>${esc(slotLabel(type,no))}</span><span class="badge ${esc(statusClass(status))}">${esc(statusText(status))}</span></div>
      <div class="donor-helper-person">${esc(row.helper_name || '-')}</div>
      <div class="donor-helper-unit">${esc(row.unit_name || '-')}</div>
      ${row.phone && admin ? `<div class="donor-helper-phone">โทร ${esc(row.phone)}</div>` : ''}
      ${status === 'cancel_requested' && row.cancel_reason ? `<div class="donor-helper-cancel-reason"><b>เหตุผล:</b> ${esc(row.cancel_reason)}</div>` : ''}
      ${actions}
    </div>`;
  }

  function renderHistory(rows){
    if (!isAdminSafe()) return '';
    const history = (rows || []).filter(row => row.status === 'cancelled' || row.status === 'no_show' || row.status === 'completed' || row.status === 'cancel_requested')
      .sort((a,b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')));
    if (!history.length) return '';
    return `<div class="card donor-helper-history">
      <div class="section-title"><div><h3>ประวัติการเปลี่ยนแปลงเดือนนี้</h3><p class="hint">รายการไม่ถูกลบออกจากฐานข้อมูล แม้ Admin ยืนยันยกเลิกแล้ว</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>วันที่</th><th>ตำแหน่ง</th><th>ชื่อ / หน่วยงาน</th><th>สถานะ</th><th>เหตุผล/เวลา</th></tr></thead><tbody>
        ${history.map(row => `<tr>
          <td>${esc(thaiDate(row.work_date))}</td>
          <td>${esc(slotLabel(row.slot_type, row.slot_no))}</td>
          <td><b>${esc(row.helper_name || '-')}</b><br><span class="muted">${esc(row.unit_name || '-')}</span></td>
          <td><span class="badge ${esc(statusClass(row.status))}">${esc(statusText(row.status))}</span></td>
          <td>${row.cancel_reason ? esc(row.cancel_reason) : '-'}<br><span class="muted">อัปเดต ${esc(thaiDateTime(row.updated_at || row.created_at))}</span></td>
        </tr>`).join('')}
      </tbody></table></div>
    </div>`;
  }

  function renderHelperPage(){
    const stateRef = appState();
    const month = stateRef?.donorHelperMonthV324 || monthKeyNow();
    const rows = stateRef?.donorHelperRowsV324 || [];
    const map = activeMap(rows);
    const admin = isAdminSafe();
    const dates = weekendDates(month);
    const filled = dates.reduce((sum,date) => sum + ['phlebotomist|1','phlebotomist|2','clerk|1'].filter(token => {
      const [type,no] = token.split('|');
      return map.has(slotKey(date,type,Number(no)));
    }).length, 0);
    const total = dates.length * 3;

    return `<div class="donor-helper-page-v324">
      <div class="card donor-helper-hero">
        <div>
          <span class="donor-helper-kicker">ห้องบริจาคโลหิต • 09:00–17:00 น.</span>
          <h3>ตารางคนนอกหน่วยมาช่วย ${esc(monthLabel(month))}</h3>
          <p>คนเจาะ 2 คน และ Clerk 1 คนต่อวัน • เปิดลงชื่อวันที่ 21 ของเดือนก่อนหน้า</p>
        </div>
        <div class="donor-helper-hero-actions">
          <a class="primary-btn donor-helper-link-btn" href="${esc(publicUrl())}" target="_blank" rel="noopener">เปิดหน้าลงชื่อคนนอกหน่วย</a>
          <button class="ghost-btn" type="button" data-copy-helper-link>คัดลอกลิงก์</button>
        </div>
      </div>

      <div class="notice soft-notice donor-helper-ot-note">
        <b>คนในหน่วยที่มาช่วยวันเสาร์–อาทิตย์:</b> ใช้เมนู <b>ลงชื่ออยู่เวร / ขอ OT เพิ่ม → ส่วนที่ 2</b> เหมือนเดิม ตารางหน้านี้ใช้สำหรับคนนอกหน่วยเท่านั้น
        <button class="tiny-btn" type="button" data-page="ot">ไปส่วนขอ OT</button>
      </div>

      <div class="card donor-helper-toolbar">
        <label>เลือกเดือน <input id="donorHelperMonthInputV324" type="month" value="${esc(month)}"></label>
        <div class="donor-helper-counts"><span class="badge blue">ลงชื่อแล้ว ${filled}/${total} ช่อง</span><span class="badge black">${dates.length} วัน</span></div>
        <button class="ghost-btn" type="button" data-helper-refresh>รีเฟรชรายชื่อ</button>
      </div>

      ${stateRef?.donorHelperErrorV324 ? `<div class="notice donor-helper-error"><b>ยังเปิดตารางไม่ได้</b><br>${esc(stateRef.donorHelperErrorV324)}</div>` : ''}
      ${stateRef?.donorHelperLoadingV324 ? `<div class="card donor-helper-loading">กำลังโหลดรายชื่อ…</div>` : ''}

      <div class="donor-helper-weekend-grid">
        ${dates.map(date => {
          const d = new Date(`${date}T12:00:00`);
          const dow = d.toLocaleDateString('th-TH', { weekday:'long' });
          return `<div class="card donor-helper-day-card">
            <div class="donor-helper-day-head"><div><span>${esc(dow)}</span><b>${esc(thaiDate(date))}</b></div><span class="badge ${d.getDay()===0?'orange':'blue'}">09:00–17:00</span></div>
            <div class="donor-helper-slots">
              ${slotCard(date,'phlebotomist',1,map.get(slotKey(date,'phlebotomist',1)),admin)}
              ${slotCard(date,'phlebotomist',2,map.get(slotKey(date,'phlebotomist',2)),admin)}
              ${slotCard(date,'clerk',1,map.get(slotKey(date,'clerk',1)),admin)}
            </div>
          </div>`;
        }).join('') || '<div class="card">ไม่พบวันเสาร์–อาทิตย์ในเดือนที่เลือก</div>'}
      </div>
      ${renderHistory(rows)}
    </div>`;
  }

  const previousRenderPage = window.renderPage || (typeof renderPage === 'function' ? renderPage : null);
  const wrappedRenderPage = function renderPageV324(){
    const stateRef = appState();
    if (!stateRef || stateRef.page !== PAGE_ID) {
      return previousRenderPage ? previousRenderPage.apply(this, arguments) : undefined;
    }
    try {
      const item = (typeof NAV_ITEMS !== 'undefined' && NAV_ITEMS.find(x => x.id === PAGE_ID)) || { title:'คนมาช่วยห้องบริจาคโลหิต', subtitle:'ดูรายชื่อวันเสาร์–อาทิตย์' };
      const title = document.getElementById('pageTitle');
      const subtitle = document.getElementById('pageSubtitle');
      if (title) title.textContent = item.title;
      if (subtitle) subtitle.textContent = item.subtitle;
      try { if (typeof renderNav === 'function') renderNav(); } catch (_) {}
      const content = document.getElementById('pageContent');
      if (content) content.innerHTML = renderHelperPage();
      if (!stateRef.donorHelperLoadingV324 && !stateRef.donorHelperErrorV324 && stateRef.donorHelperLoadedMonthV324 !== stateRef.donorHelperMonthV324) {
        window.setTimeout(() => loadMonth(stateRef.donorHelperMonthV324, { force:false }), 0);
      }
    } catch (error) {
      console.error(`[${VERSION}] page render failed`, error);
      const content = document.getElementById('pageContent');
      if (content) content.innerHTML = `<div class="notice">เปิดหน้าคนมาช่วยไม่สำเร็จ: ${esc(error.message || error)}</div>`;
    }
  };
  try { window.renderPage = renderPage = wrappedRenderPage; }
  catch (_) { window.renderPage = wrappedRenderPage; }

  function rowById(id){ return (appState()?.donorHelperRowsV324 || []).find(row => String(row.id) === String(id)); }

  function showAddModal(payload){
    const [workDate, slotType, slotNo] = String(payload || '').split('|');
    const html = `<h2>เพิ่มชื่อคนนอกหน่วย</h2>
      <p class="muted">${esc(thaiDate(workDate))} • ${esc(slotLabel(slotType, Number(slotNo)))} • 09:00–17:00 น.</p>
      <form id="donorHelperAdminAddFormV324" class="form-grid">
        <input type="hidden" name="work_date" value="${esc(workDate)}">
        <input type="hidden" name="slot_type" value="${esc(slotType)}">
        <input type="hidden" name="slot_no" value="${esc(slotNo)}">
        <label>ชื่อ-สกุล <input name="helper_name" required maxlength="120"></label>
        <label>หน่วยงาน <select class="donor-helper-unit-select" name="unit_name" required>${unitSelectOptions()}</select></label>
        <label class="wide">เบอร์โทร (ถ้ามี) <input name="phone" inputmode="tel" maxlength="30"></label>
        <button class="primary-btn wide" type="submit">บันทึกชื่อ</button>
      </form>`;
    try { showModal(html, { small:true }); }
    catch (_) { toast('เปิดแบบฟอร์มไม่สำเร็จ', 'error'); }
  }

  function showEditModal(id){
    const row = rowById(id);
    if (!row) return toast('ไม่พบรายการ', 'error');
    const html = `<h2>แก้ไขข้อมูลผู้มาช่วย</h2>
      <p class="muted">${esc(thaiDate(row.work_date))} • ${esc(slotLabel(row.slot_type, row.slot_no))}</p>
      <form id="donorHelperAdminEditFormV324" class="form-grid">
        <input type="hidden" name="signup_id" value="${esc(row.id)}">
        <label>ชื่อ-สกุล <input name="helper_name" value="${esc(row.helper_name || '')}" required maxlength="120"></label>
        <label>หน่วยงาน <select class="donor-helper-unit-select" name="unit_name" required>${unitSelectOptions(row.unit_name || '')}</select>${row.unit_name && !isAllowedUnit(row.unit_name) ? `<span class="muted">ข้อมูลเดิม: ${esc(row.unit_name)} — กรุณาเลือกหน่วยงานใหม่จากรายการ</span>` : ''}</label>
        <label class="wide">เบอร์โทร (ถ้ามี) <input name="phone" value="${esc(row.phone || '')}" inputmode="tel" maxlength="30"></label>
        <button class="primary-btn wide" type="submit">บันทึกการแก้ไข</button>
      </form>`;
    try { showModal(html, { small:true }); }
    catch (_) { toast('เปิดแบบฟอร์มไม่สำเร็จ', 'error'); }
  }

  async function confirmAction(message, title='ยืนยันรายการ'){
    try { if (typeof confirmDialog === 'function') return await confirmDialog(message, title); }
    catch (_) {}
    return window.confirm(message);
  }

  async function updateStatus(id, nextStatus){
    if (!isAdminSafe()) return toast('เฉพาะ Admin เท่านั้น', 'error');
    const row = rowById(id);
    if (!row) return toast('ไม่พบรายการ', 'error');
    const prompts = {
      cancelled: `ยืนยันนำ ${row.helper_name} ออกจากช่อง ${slotLabel(row.slot_type,row.slot_no)} วันที่ ${thaiDate(row.work_date)} ใช่หรือไม่? ประวัติจะยังคงอยู่`,
      confirmed: `ไม่อนุมัติคำขอยกเลิกของ ${row.helper_name} และคงชื่อไว้ในตารางใช่หรือไม่?`,
      completed: `ยืนยันว่า ${row.helper_name} มาปฏิบัติงานแล้วใช่หรือไม่?`,
      no_show: `ยืนยันบันทึกว่า ${row.helper_name} ไม่มาตามนัดใช่หรือไม่?`
    };
    const ok = await confirmAction(prompts[nextStatus] || 'ยืนยันเปลี่ยนสถานะรายการนี้หรือไม่?');
    if (!ok) return;
    let note = null;
    if (nextStatus === 'cancelled' && row.status !== 'cancel_requested') {
      note = await promptDialog('เหตุผลที่ Admin ยกเลิก (ถ้ามี)', 'ระบุเหตุผล', '') || null;
    }
    try {
      const result = await db().rpc('admin_update_donor_helper_status_v324', {
        p_signup_id:id,
        p_status:nextStatus,
        p_note:note
      });
      if (result.error) throw result.error;
      await loadMonth(appState().donorHelperMonthV324, { force:true });
      toast(nextStatus === 'cancelled' ? 'ยืนยันยกเลิกแล้ว ช่องกลับมาว่าง แต่ประวัติยังอยู่' : 'บันทึกสถานะแล้ว');
    } catch (error) { toast(errorMessage(error), 'error'); }
  }

  async function copyPublicLink(){
    const link = publicUrl();
    try {
      await navigator.clipboard.writeText(link);
      toast('คัดลอกลิงก์หน้าลงชื่อคนนอกหน่วยแล้ว');
    } catch (_) {
      await promptDialog('คัดลอกลิงก์นี้', 'ลิงก์หน้าลงชื่อ', link);
    }
  }

  document.addEventListener('change', function(event){
    const target = event.target;
    if (!target || target.id !== 'donorHelperMonthInputV324') return;
    const stateRef = appState();
    if (!stateRef) return;
    stateRef.donorHelperMonthV324 = target.value || monthKeyNow();
    stateRef.donorHelperLoadedMonthV324 = '';
    stateRef.donorHelperErrorV324 = '';
    pageRender();
  }, true);

  document.addEventListener('click', function(event){
    const target = event.target?.closest?.('[data-helper-admin-add],[data-helper-status],[data-helper-edit],[data-helper-refresh],[data-copy-helper-link]');
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    if (target.hasAttribute('data-helper-admin-add')) return showAddModal(target.getAttribute('data-helper-admin-add'));
    if (target.hasAttribute('data-helper-edit')) return showEditModal(target.getAttribute('data-helper-edit'));
    if (target.hasAttribute('data-helper-status')) {
      const [id,status] = String(target.getAttribute('data-helper-status') || '').split('|');
      return void updateStatus(id,status);
    }
    if (target.hasAttribute('data-helper-refresh')) return void loadMonth(appState()?.donorHelperMonthV324, { force:true });
    if (target.hasAttribute('data-copy-helper-link')) return void copyPublicLink();
  }, true);

  document.addEventListener('submit', async function(event){
    const form = event.target;
    if (!form || !['donorHelperAdminAddFormV324','donorHelperAdminEditFormV324'].includes(form.id)) return;
    event.preventDefault();
    event.stopPropagation();
    if (!isAdminSafe()) return toast('เฉพาะ Admin เท่านั้น', 'error');
    const data = new FormData(form);
    const unitName = String(data.get('unit_name') || '').trim();
    if (!isAllowedUnit(unitName)) return toast('กรุณาเลือกหน่วยงานจากรายการ', 'error');
    try {
      if (form.id === 'donorHelperAdminAddFormV324') {
        const result = await db().rpc('admin_add_donor_helper_v324', {
          p_work_date:data.get('work_date'),
          p_slot_type:data.get('slot_type'),
          p_slot_no:Number(data.get('slot_no')),
          p_helper_name:String(data.get('helper_name') || '').trim(),
          p_unit_name:unitName,
          p_phone:String(data.get('phone') || '').trim() || null
        });
        if (result.error) throw result.error;
        try { closeModal(); } catch (_) {}
        await loadMonth(appState().donorHelperMonthV324, { force:true });
        toast('เพิ่มชื่อคนนอกหน่วยแล้ว');
      } else {
        const result = await db().rpc('admin_edit_donor_helper_v324', {
          p_signup_id:data.get('signup_id'),
          p_helper_name:String(data.get('helper_name') || '').trim(),
          p_unit_name:unitName,
          p_phone:String(data.get('phone') || '').trim() || null
        });
        if (result.error) throw result.error;
        try { closeModal(); } catch (_) {}
        await loadMonth(appState().donorHelperMonthV324, { force:true });
        toast('แก้ไขข้อมูลแล้ว');
      }
    } catch (error) { toast(errorMessage(error), 'error'); }
  }, true);

  window.cnmiDonorHelperV324 = {
    version:VERSION,
    loadMonth,
    publicUrl
  };
  console.info(`[${VERSION}] loaded`);
})();

} catch (error) { console.error("[v569] patch-v326-donor-helper-unit-dropdown.js", error); }
;

/* Original source: patch-v327-donor-helper-internal-booking.js */
try {
/* CNMI Staff Planner V327 — ลงชื่อช่วยห้องบริจาคโลหิตในแอป + กันเวร + ปิดวันหยุดนักขัตฤกษ์
   - เจ้าหน้าที่ในหน่วยลงชื่อจากหน้าเดียวกัน ชื่อ/หน่วย/เบอร์โทรมาจากโปรไฟล์
   - หากมีเวรในวันเดียวกัน ระบบไม่ให้ลงจนกว่าจะขายเวรและตารางเวรถูกโอนแล้ว
   - วันเสาร์–อาทิตย์ที่อยู่ใน public_holidays ปิดรับลงชื่อทั้งคนในและคนนอก
   - ไม่สร้าง OT อัตโนมัติ ยังคงให้ขอ OT ส่วนที่ 2 ตามเดิม
*/
(function(){
  'use strict';
  const VERSION = 'V344_DONOR_HELPER_INTERNAL_CANCEL_REQUEST_BUTTON';
  const PAGE_ID = 'donorHelpers';
  const INTERNAL_UNIT = 'หน่วยเวชศาสตร์บริการโลหิต';
  const UNIT_OPTIONS = [
    'หน่วยคลังพยาธิวิทยา',
    'หน่วยธุรการพยาธิ',
    'หน่วยนิติเวช',
    'หน่วยบริการพยาธิวิทยา',
    'หน่วยพยาธิวิทยากายวิภาค',
    'หน่วยพยาธิวิทยาคลินิก',
    INTERNAL_UNIT,
  ];
  if (window.__CNMI_V327_DONOR_HELPER_INTERNAL_BOOKING__) return;
  window.__CNMI_V327_DONOR_HELPER_INTERNAL_BOOKING__ = true;

  function S(){ try { return state; } catch (_) { return window.state || null; } }
  function DB(){ try { return sb; } catch (_) { return window.sb || null; } }
  function admin(){ try { return typeof isAdmin === 'function' && isAdmin(); } catch (_) { return false; } }
  function esc(value){
    try { if (typeof escapeHtml === 'function') return escapeHtml(value); } catch (_) {}
    return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function toast(message, tone){
    try { return showToast(message, tone ? { tone } : undefined); }
    catch (_) { window.alert(message); }
  }
  function rerender(){
    try {
      const fn = window.renderPage || (typeof renderPage === 'function' ? renderPage : null);
      if (typeof fn === 'function') fn();
    } catch (error) { console.warn(`[${VERSION}] render failed`, error); }
  }
  function bangkokDateParts(value=new Date()){
    try{
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(value);
      const map=Object.fromEntries(parts.map(part=>[part.type,part.value]));
      return {year:Number(map.year),month:Number(map.month),day:Number(map.day),hour:Number(map.hour||0),minute:Number(map.minute||0)};
    }catch(_){
      return {year:value.getFullYear(),month:value.getMonth()+1,day:value.getDate(),hour:value.getHours(),minute:value.getMinutes()};
    }
  }
  function monthNow(){ const d=bangkokDateParts(); return `${d.year}-${String(d.month).padStart(2,'0')}`; }
  function dateKey(value){
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0,10);
    const d=value instanceof Date?value:new Date(value);
    if(Number.isNaN(d.getTime())) return String(value||'').slice(0,10);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function today(){ const d=bangkokDateParts(); return `${d.year}-${String(d.month).padStart(2,'0')}-${String(d.day).padStart(2,'0')}`; }
  function weekendDates(month){
    const [y,m]=String(month||monthNow()).split('-').map(Number); if(!y||!m)return[];
    const last=new Date(y,m,0).getDate(),out=[];
    for(let day=1;day<=last;day++){const d=new Date(y,m-1,day,12);if(d.getDay()===0||d.getDay()===6)out.push(dateKey(d));}
    return out;
  }
  function openDateFor(workDate){
    const d=new Date(`${String(workDate).slice(0,7)}-01T12:00:00`); d.setMonth(d.getMonth()-1,21); return dateKey(d);
  }
  function openAtFor(workDate){ return `${openDateFor(workDate)}T10:00:00+07:00`; }
  function isSignupOpenFor(workDate){ const t=Date.parse(openAtFor(workDate)); return Number.isFinite(t) && Date.now()>=t; }
  function openLabelFor(workDate){ return `${thaiDate(openDateFor(workDate))} เวลา 10:00 น.`; }
  function thaiDate(value){
    try { if (typeof formatThaiDate === 'function') return formatThaiDate(value); } catch (_) {}
    const d=new Date(`${dateKey(value)}T12:00:00`); return Number.isNaN(d.getTime())?String(value||'-'):d.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'});
  }
  function thaiDateTime(value){
    if(!value)return'-';
    try { if (typeof formatThaiDateTime === 'function') return formatThaiDateTime(value); } catch (_) {}
    const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'});
  }
  function monthLabel(month){
    const [y,m]=String(month||monthNow()).split('-').map(Number),d=new Date(y,(m||1)-1,1);
    return Number.isNaN(d.getTime())?month:d.toLocaleDateString('th-TH',{month:'long',year:'numeric'});
  }
  function slotKey(date,type,no){return `${date}|${type}|${no}`;}
  function slotLabel(type,no){return type==='clerk'?'Clerk':`คนเจาะ ${no}`;}
  function statusText(status){return ({confirmed:'ยืนยันแล้ว',cancel_requested:'ขอยกเลิก — รออนุมัติ',cancelled:'ยกเลิกแล้ว',completed:'มาปฏิบัติงานแล้ว',no_show:'ไม่มาตามนัด (No Show)'})[status]||status||'-';}
  function statusClass(status){return ({confirmed:'green',cancel_requested:'orange',cancelled:'black',completed:'blue',no_show:'red'})[status]||'black';}
  function isAllowedUnit(value){return UNIT_OPTIONS.includes(String(value||'').trim());}
  function unitOptions(selected=''){
    const value=String(selected||'').trim();
    return `<option value=""${isAllowedUnit(value)?'':' selected'} disabled>กรุณาเลือกหน่วยงาน</option>`+
      UNIT_OPTIONS.map(unit=>`<option value="${esc(unit)}"${unit===value?' selected':''}>${esc(unit)}</option>`).join('');
  }
  function normalizeFullName(value){return String(value||'').trim().replace(/\s+/g,' ');}
  function hasFirstAndLastName(value){return /^\S+\s+\S+/.test(normalizeFullName(value));}
  function phoneDigits(value){return String(value||'').replace(/\D/g,'').slice(0,10);}
  function formatPhone(value){const digits=phoneDigits(value);if(digits.length<=3)return digits;if(digits.length<=6)return `${digits.slice(0,3)}-${digits.slice(3)}`;return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6,10)}`;}
  function validPhone(value){return /^0\d{2}-\d{3}-\d{4}$/.test(formatPhone(value));}
  function publicUrl(){try{return new URL('donor-helper.html',window.location.href).href;}catch(_){return'donor-helper.html';}}
  function errorText(error){
    const raw=String(error?.message||error||'ดำเนินการไม่สำเร็จ');
    if(/get_donor_helper_month_internal_v327|signup_donor_helper_internal_v327|function .* does not exist|schema cache/i.test(raw)) return 'ยังไม่ได้ติดตั้งฐานข้อมูล V327 กรุณาให้ Admin Run ไฟล์ SQL_V327_DONOR_HELPER_INTERNAL_BOOKING_HOLIDAY_GUARD.sql ใน Supabase ก่อน';
    if(/Permission denied/i.test(raw))return'บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้';
    try{if(typeof friendlyDbError==='function')return friendlyDbError(error);}catch(_){}
    return raw.replace(/^.*?:\s*/,'');
  }
  function parsePayload(data){
    if(!data)return{};
    if(typeof data==='string'){try{return JSON.parse(data)||{};}catch(_){return{};}}
    return data;
  }

  try{
    if(typeof NAV_ITEMS!=='undefined'&&Array.isArray(NAV_ITEMS)){
      let item=NAV_ITEMS.find(x=>x.id===PAGE_ID);
      if(!item){
        item={id:PAGE_ID,icon:'🩸',title:'คนมาช่วยห้องบริจาคโลหิต',subtitle:'คนในหน่วยลงชื่อในแอปได้ • คนนอกหน่วยใช้ลิงก์สาธารณะ',group:'staff'};
        const otIndex=NAV_ITEMS.findIndex(x=>x.id==='ot');
        NAV_ITEMS.splice(otIndex>=0?otIndex:NAV_ITEMS.length,0,item);
      }
      item.title='คนมาช่วยห้องบริจาคโลหิต';
      item.subtitle='คนในหน่วยลงชื่อในแอปได้ • คนนอกหน่วยใช้ลิงก์สาธารณะ';
    }
  }catch(_){}

  const initial=S();
  if(initial){
    initial.donorHelperMonthV327=initial.donorHelperMonthV327||initial.donorHelperMonthV324||monthNow();
    initial.donorHelperPayloadV327=initial.donorHelperPayloadV327||{rows:[],blocked_dates:[],my_duties:[],my_profile:null,contact:null};
    initial.donorHelperLoadedMonthV327=initial.donorHelperLoadedMonthV327||'';
    initial.donorHelperLoadingV327=false;
    initial.donorHelperErrorV327='';
  }

  async function loadMonth(month,options={}){
    const st=S(),client=DB();if(!st||!client)return;
    const key=String(month||st.donorHelperMonthV327||monthNow()).slice(0,7);
    if(!options.force&&st.donorHelperLoadedMonthV327===key&&!st.donorHelperErrorV327)return;
    if(st.donorHelperLoadingV327)return;
    st.donorHelperLoadingV327=true;st.donorHelperErrorV327='';if(st.page===PAGE_ID)rerender();
    try{
      const result=await client.rpc('get_donor_helper_month_internal_v327',{p_month:key});
      if(result.error)throw result.error;
      const payload=parsePayload(result.data);
      st.donorHelperPayloadV327={
        rows:Array.isArray(payload.rows)?payload.rows:[],
        blocked_dates:Array.isArray(payload.blocked_dates)?payload.blocked_dates:[],
        my_duties:Array.isArray(payload.my_duties)?payload.my_duties:[],
        my_profile:payload.my_profile||null,
        contact:payload.contact||null
      };
      st.donorHelperLoadedMonthV327=key;
    }catch(error){
      console.warn(`[${VERSION}] load month failed`,error);
      st.donorHelperPayloadV327={rows:[],blocked_dates:[],my_duties:[],my_profile:null,contact:null};
      st.donorHelperLoadedMonthV327='';st.donorHelperErrorV327=errorText(error);
    }finally{st.donorHelperLoadingV327=false;if(st.page===PAGE_ID)rerender();}
  }

  function payload(){return S()?.donorHelperPayloadV327||{rows:[],blocked_dates:[],my_duties:[],my_profile:null,contact:null};}
  function rows(){return payload().rows||[];}
  function activeRows(){return rows().filter(row=>row.status!=='cancelled');}
  function activeMap(){const map=new Map();activeRows().forEach(row=>map.set(slotKey(dateKey(row.work_date),row.slot_type,Number(row.slot_no)),row));return map;}
  function blockedMap(){const map=new Map();(payload().blocked_dates||[]).forEach(row=>map.set(dateKey(row.work_date),row.title||'วันหยุดนักขัตฤกษ์'));return map;}
  function dutyMap(){const map=new Map();(payload().my_duties||[]).forEach(row=>map.set(dateKey(row.work_date),Array.isArray(row.duty_codes)?row.duty_codes:[]));return map;}
  function isMyRow(row){
    const profileId=payload()?.my_profile?.staff_id;
    if(row?.is_mine===true||String(row?.is_mine||'').toLowerCase()==='true')return true;
    return !!(profileId&&row?.internal_staff_id&&String(row.internal_staff_id)===String(profileId));
  }
  function canRequestCancel(row){return isMyRow(row)&&String(row?.status||'confirmed')==='confirmed'&&dateKey(row?.work_date)>=today();}
  function myActiveOn(date){return activeRows().find(row=>isMyRow(row)&&dateKey(row.work_date)===date);}
  function rowById(id){return rows().find(row=>String(row.id)===String(id));}
  function cancelHistoryFor(date,type,no){return rows().filter(row=>String(row.status||'')==='cancelled'&&dateKey(row.work_date)===date&&row.slot_type===type&&Number(row.slot_no)===Number(no)).sort((a,b)=>String(b.cancelled_at||b.updated_at||b.created_at||'').localeCompare(String(a.cancelled_at||a.updated_at||a.created_at||'')))[0]||null;}
  function cancelHistoryHtml(row){if(!row)return'';return `<div class="donor-helper-slot-history"><b>เคยลงชื่อ:</b> ${esc(row.helper_name||'-')}<br><b>ยกเลิกโดย:</b> ${esc(row.cancelled_by_label||'หัวหน้าหน่วยเวชศาสตร์บริการโลหิต/อินชาร์จ')}<br><b>เหตุผล:</b> ${esc(row.cancel_reason||'-')}<br><b>วันที่-เวลา:</b> ${esc(thaiDateTime(row.cancelled_at||row.updated_at))}</div>`;}
  function contactNotice(){const c=payload().contact||{};return `<div class="notice soft-notice donor-helper-contact-note"><b>ผู้ติดต่อกรณีขอยกเลิก:</b> ${c.incharge_label?`อินชาร์จเดือนนี้: ${esc(c.incharge_label)} หรือหัวหน้าหน่วย`:'กรุณาแจ้งหัวหน้าหน่วยเวชศาสตร์บริการโลหิต'}</div>`;}
  function myBookingsHtml(){
    const mine=rows().filter(row=>isMyRow(row)&&['confirmed','cancel_requested'].includes(String(row.status||'confirmed'))).sort((a,b)=>dateKey(a.work_date).localeCompare(dateKey(b.work_date)));
    if(!mine.length)return'';
    return `<div class="card donor-helper-my-bookings"><div class="section-title donor-helper-my-bookings-head"><div><span class="muted">จัดการรายการของตนเอง</span><h3>รายการลงชื่อของฉัน</h3></div><span class="badge blue">${mine.length} รายการ</span></div><div class="donor-helper-my-booking-list">${mine.map(row=>{
      const status=String(row.status||'confirmed');
      const pending=status==='cancel_requested';
      return `<div class="donor-helper-my-booking-row ${pending?'pending':''}"><div><b>${esc(thaiDate(row.work_date))}</b><span>${esc(slotLabel(row.slot_type,row.slot_no))} • 09:00–17:00 น.</span></div><div class="donor-helper-my-booking-actions"><span class="badge ${esc(statusClass(status))}">${esc(statusText(status))}</span>${canRequestCancel(row)?`<button class="tiny-btn danger-ghost donor-helper-request-cancel-btn" type="button" data-v327-self-cancel="${esc(row.id)}">รีเควสขอยกเลิก</button>`:pending?'<span class="donor-helper-pending-note">ชื่อยังคงอยู่จนกว่าหัวหน้าหน่วยหรืออินชาร์จจะอนุมัติ</span>':''}</div></div>`;
    }).join('')}</div></div>`;
  }

  function emptyActions(date,type,no,isBlocked,myDuty){
    const isPast=date<today(),isOpen=isSignupOpenFor(date),own=myActiveOn(date);
    if(isBlocked)return'';
    if(isPast)return'';
    if(!isOpen)return`<div class="donor-helper-empty-reason">เปิดลงชื่อ ${esc(openLabelFor(date))}</div>`;
    const selfLabel=own?'ลงชื่อวันนี้แล้ว':myDuty?'ตรวจสอบเวรก่อน':'ลงชื่อของฉัน';
    const selfClass=myDuty||own?'tiny-btn donor-helper-self-btn blocked':'tiny-btn donor-helper-self-btn';
    return `<div class="donor-helper-empty-actions">
      <button class="${selfClass}" type="button" data-v327-self-book="${esc(`${date}|${type}|${no}`)}">${esc(selfLabel)}</button>
      ${admin()?`<button class="tiny-btn ghost" type="button" data-v327-admin-add="${esc(`${date}|${type}|${no}`)}">เพิ่มชื่อแทน</button>`:''}
    </div>`;
  }

  function slotCard(date,type,no,row,context){
    const label=slotLabel(type,no),isBlocked=context.blocked,myDuty=context.myDuty;
    if(!row){
      return `<div class="donor-helper-slot empty ${isBlocked?'holiday-closed':''}">
        <div class="donor-helper-slot-name">${esc(label)}</div>
        <div class="donor-helper-empty-text">${isBlocked?'ปิดรับลงชื่อ':myDuty?'วันนี้คุณอยู่เวร — ต้องขายเวรก่อน':'ยังว่าง'}</div>
        ${cancelHistoryHtml(cancelHistoryFor(date,type,no))}
        ${emptyActions(date,type,no,isBlocked,myDuty)}
      </div>`;
    }
    const status=String(row.status||'confirmed'),mine=isMyRow(row);
    let actions='';
    if(canRequestCancel(row)){
      actions+=`<button class="tiny-btn danger-ghost donor-helper-request-cancel-btn" type="button" data-v327-self-cancel="${esc(row.id)}">รีเควสขอยกเลิก</button>`;
    }
    if(admin()){
      if(status==='cancel_requested'){
        actions+=`<button class="tiny-btn danger" type="button" data-v327-status="${esc(row.id)}|cancelled">ยกเลิกตามคำขอ</button><button class="tiny-btn" type="button" data-v327-status="${esc(row.id)}|confirmed">ไม่อนุมัติการยกเลิก</button>`;
      }else if(status==='confirmed'){
        actions+=`<button class="tiny-btn" type="button" data-v327-edit="${esc(row.id)}">แก้ข้อมูล</button><button class="tiny-btn" type="button" data-v327-status="${esc(row.id)}|completed">มาปฏิบัติงานแล้ว</button><button class="tiny-btn danger" type="button" data-v327-status="${esc(row.id)}|no_show">ไม่มาตามนัด (No Show)</button><button class="tiny-btn danger-ghost" type="button" data-v327-status="${esc(row.id)}|cancelled">ยกเลิกตามคำขอ</button>`;
      }
    }
    return `<div class="donor-helper-slot occupied status-${esc(status)} ${mine?'mine':''}">
      <div class="donor-helper-slot-head"><span>${esc(label)}</span><span class="badge ${esc(statusClass(status))}">${esc(statusText(status))}</span></div>
      <div class="donor-helper-person">${esc(row.helper_name||'-')}</div>
      <div class="donor-helper-unit">${esc(row.unit_name||'-')}</div>
      ${mine?'<div class="donor-helper-mine-label">รายการของฉัน</div>':''}
      ${row.phone?`<div class="donor-helper-phone">โทร ${esc(formatPhone(row.phone))}</div>`:''}
      ${status==='cancel_requested'&&row.cancel_reason?`<div class="donor-helper-cancel-reason"><b>เหตุผล:</b> ${esc(row.cancel_reason)}</div>`:''}
      ${actions?`<div class="actions compact-actions">${actions}</div>`:''}
    </div>`;
  }

  function historyActions(row){
    if(!admin())return'';
    const status=String(row.status||'');
    const buttons=[];
    buttons.push(`<button class="tiny-btn" type="button" data-v327-edit="${esc(row.id)}">แก้ไขข้อมูล</button>`);
    if(['cancel_requested','cancelled','no_show'].includes(status))buttons.push(`<button class="tiny-btn" type="button" data-v327-edit-reason="${esc(row.id)}">แก้ไขเหตุผล</button>`);
    if(['cancelled','no_show','completed'].includes(status))buttons.push(`<button class="tiny-btn danger-ghost" type="button" data-v327-status="${esc(row.id)}|confirmed">คืนสถานะยืนยัน</button>`);
    return buttons.join(' ');
  }
  function historyTable(){
    if(!admin())return'';
    const history=rows().filter(row=>['cancelled','no_show','completed','cancel_requested'].includes(row.status)).sort((a,b)=>String(b.updated_at||b.created_at||'').localeCompare(String(a.updated_at||a.created_at||'')));
    if(!history.length)return'';
    return `<div class="card donor-helper-history"><div class="section-title"><h3>ประวัติและรายการที่ต้องติดตาม</h3><span class="badge black">${history.length} รายการ</span></div><div class="table-wrap"><table><thead><tr><th>วันที่</th><th>ตำแหน่ง</th><th>ชื่อ / หน่วยงาน</th><th>สถานะ</th><th>เหตุผล/เวลา</th><th>จัดการ</th></tr></thead><tbody>${history.map(row=>`<tr><td>${esc(thaiDate(row.work_date))}</td><td>${esc(slotLabel(row.slot_type,row.slot_no))}</td><td><b>${esc(row.helper_name||'-')}</b><br><span class="muted">${esc(row.unit_name||'-')}</span>${row.phone?`<br><span class="muted">โทร ${esc(formatPhone(row.phone))}</span>`:''}</td><td><span class="badge ${esc(statusClass(row.status))}">${esc(statusText(row.status))}</span></td><td>${row.cancel_reason?esc(row.cancel_reason):'-'}<br><span class="muted">อัปเดต ${esc(thaiDateTime(row.updated_at||row.created_at))}</span></td><td><div class="donor-helper-row-actions">${historyActions(row)}</div></td></tr>`).join('')}</tbody></table></div></div>`;
  }

  function renderPageHtml(){
    const st=S(),month=st?.donorHelperMonthV327||monthNow(),dates=weekendDates(month),map=activeMap(),blocked=blockedMap(),duties=dutyMap();
    const openDates=dates.filter(date=>!blocked.has(date));
    const filled=openDates.reduce((sum,date)=>sum+[['phlebotomist',1],['phlebotomist',2],['clerk',1]].filter(([type,no])=>map.has(slotKey(date,type,no))).length,0);
    const profile=payload().my_profile||{};
    return `<div class="donor-helper-page-v324 donor-helper-page-v327">
      <div class="card donor-helper-hero"><div><span class="donor-helper-kicker">ห้องบริจาคโลหิต • 09:00–17:00 น.</span><h3>ตารางผู้มาช่วย ${esc(monthLabel(month))}</h3><p>คนเจาะ 2 คน • Clerk 1 คน • เปิดลงชื่อ 10:00 น. วันที่ 21</p></div><div class="donor-helper-hero-actions"><a class="primary-btn donor-helper-link-btn" href="${esc(publicUrl())}" target="_blank" rel="noopener">หน้าลงชื่อคนนอกหน่วย</a><button class="ghost-btn" type="button" data-v327-copy-link>คัดลอกลิงก์</button></div></div>
      <div class="notice soft-notice donor-helper-ot-note"><b>คนในหน่วย:</b> ใช้ “ลงชื่อของฉัน” • OT ขอที่ส่วนที่ 2 • ยกเลิกแจ้ง ${esc(payload().contact?.incharge_label||'อินชาร์จ/หัวหน้าหน่วย')} <button class="tiny-btn" type="button" data-v327-go-ot>ไปส่วน OT</button></div>
      ${profile.full_name?`<div class="card donor-helper-my-profile"><div><span class="muted">ข้อมูลของฉัน</span><b>${esc(profile.full_name)}</b></div><div><span class="muted">โทร</span><b>${esc(profile.phone?formatPhone(profile.phone):'ยังไม่มีเบอร์')}</b></div></div>`:''}
      ${myBookingsHtml()}
      <div class="card donor-helper-toolbar"><label>เลือกเดือน <input id="donorHelperMonthInputV327" type="month" value="${esc(month)}"></label><div class="donor-helper-counts"><span class="badge blue">ลงชื่อแล้ว ${filled}/${openDates.length*3} ช่อง</span><span class="badge black">เปิดรับ ${openDates.length} วัน</span>${blocked.size?`<span class="badge orange">ปิดวันหยุด ${blocked.size} วัน</span>`:''}</div><button class="ghost-btn" type="button" data-v327-refresh>รีเฟรชรายชื่อ</button></div>
      ${st?.donorHelperErrorV327?`<div class="notice donor-helper-error"><b>ยังเปิดตารางไม่ได้</b><br>${esc(st.donorHelperErrorV327)}</div>`:''}
      ${st?.donorHelperLoadingV327?'<div class="card donor-helper-loading">กำลังโหลดรายชื่อและตรวจตารางเวร…</div>':''}
      <div class="donor-helper-weekend-grid">${dates.map(date=>{
        const d=new Date(`${date}T12:00:00`),holiday=blocked.get(date),myDuty=duties.has(date),codes=duties.get(date)||[];
        return `<div class="card donor-helper-day-card ${holiday?'donor-helper-day-closed':''}"><div class="donor-helper-day-head"><div><span>${esc(d.toLocaleDateString('th-TH',{weekday:'long'}))}</span><b>${esc(thaiDate(date))}</b></div><span class="badge ${holiday?'red':d.getDay()===0?'orange':'blue'}">${holiday?'ปิดรับลงชื่อ':'09:00–17:00'}</span></div>${holiday?`<div class="donor-helper-holiday-banner"><b>${esc(holiday)}</b><span>วันนี้เป็นวันหยุดนักขัตฤกษ์ จึงไม่เปิดช่องให้ลงชื่อ</span></div>`:''}${myDuty&&!holiday?`<div class="donor-helper-duty-warning"><b>คุณมีเวรวันนี้${codes.length?` (${esc(codes.join(', '))})`:''}</b><span>ลงชื่อช่วยไม่ได้จนกว่าจะขายเวรและโอนเวรเรียบร้อย</span></div>`:''}<div class="donor-helper-slots">${slotCard(date,'phlebotomist',1,map.get(slotKey(date,'phlebotomist',1)),{blocked:!!holiday,myDuty})}${slotCard(date,'phlebotomist',2,map.get(slotKey(date,'phlebotomist',2)),{blocked:!!holiday,myDuty})}${slotCard(date,'clerk',1,map.get(slotKey(date,'clerk',1)),{blocked:!!holiday,myDuty})}</div></div>`;
      }).join('')||'<div class="card">ไม่พบวันเสาร์–อาทิตย์ในเดือนที่เลือก</div>'}</div>${historyTable()}</div>`;
  }

  const previousRender=window.renderPage||(typeof renderPage==='function'?renderPage:null);
  const renderV327=function(){
    const st=S();if(!st||st.page!==PAGE_ID)return previousRender?previousRender.apply(this,arguments):undefined;
    try{
      const title=document.getElementById('pageTitle'),subtitle=document.getElementById('pageSubtitle'),content=document.getElementById('pageContent');
      if(title)title.textContent='คนมาช่วยห้องบริจาคโลหิต';
      if(subtitle)subtitle.textContent='คนในหน่วยลงชื่อในแอปได้ • คนนอกหน่วยใช้ลิงก์สาธารณะ';
      try{if(typeof renderNav==='function')renderNav();}catch(_){}
      if(content)content.innerHTML=renderPageHtml();
      if(!st.donorHelperLoadingV327&&!st.donorHelperErrorV327&&st.donorHelperLoadedMonthV327!==st.donorHelperMonthV327)window.setTimeout(()=>loadMonth(st.donorHelperMonthV327),0);
    }catch(error){console.error(`[${VERSION}] render failed`,error);const content=document.getElementById('pageContent');if(content)content.innerHTML=`<div class="notice">เปิดหน้าไม่สำเร็จ: ${esc(error.message||error)}</div>`;}
  };
  try{window.renderPage=renderPage=renderV327;}catch(_){window.renderPage=renderV327;}

  function showSelfModal(payloadText){
    const [date,type,noRaw]=String(payloadText||'').split('|'),no=Number(noRaw),blocked=blockedMap(),duties=dutyMap(),profile=payload().my_profile||{};
    if(blocked.has(date))return toast('วันนี้ไม่เปิดลงชื่อ เนื่องจากเป็นวันหยุดนักขัตฤกษ์','error');
    if(duties.has(date))return toast('วันนี้ลงไม่ได้ เนื่องจากอยู่เวร ต้องขายเวรก่อน','error');
    if(date<today())return toast('ไม่สามารถลงชื่อย้อนหลังได้','error');
    if(!isSignupOpenFor(date))return toast(`เปิดลงชื่อ ${openLabelFor(date)}`,'error');
    if(myActiveOn(date))return toast('วันนี้คุณลงชื่อช่วยไว้แล้ว 1 ตำแหน่ง','error');
    const html=`<h2>ยืนยันลงชื่อของฉัน</h2><p class="muted">${esc(thaiDate(date))} • ${esc(slotLabel(type,no))} • 09:00–17:00 น.</p><form id="donorHelperSelfFormV327" class="form-grid"><input type="hidden" name="work_date" value="${esc(date)}"><input type="hidden" name="slot_type" value="${esc(type)}"><input type="hidden" name="slot_no" value="${esc(no)}"><div class="wide donor-helper-confirm-profile"><div><span>ชื่อ</span><b>${esc(profile.full_name||'-')}</b></div><div><span>หน่วยงาน</span><b>${esc(profile.unit_name||INTERNAL_UNIT)}</b></div><div><span>เบอร์โทร</span><b>${esc(profile.phone?formatPhone(profile.phone):'ยังไม่มีในข้อมูลส่วนตัว')}</b></div></div><label class="wide donor-helper-ack"><input type="checkbox" name="ack" required><span>ยืนยันว่าจะมาช่วยตามวันที่เลือก และรับทราบว่าหากต้องยกเลิกต้องส่งคำขอพร้อมเหตุผลเพื่อให้หัวหน้าหน่วยอนุมัติ</span></label><div class="wide form-actions"><button class="ghost-btn" type="button" data-v327-close>กลับ</button><button class="primary-btn" type="submit">ยืนยันลงชื่อ</button></div></form>`;
    try{showModal(html,{small:true});}catch(_){toast('เปิดหน้าต่างยืนยันไม่สำเร็จ','error');}
  }

  function showCancelModal(id){
    const row=rowById(id);if(!row||!isMyRow(row))return toast('ไม่พบสิทธิ์จัดการรายการนี้','error');
    if(!canRequestCancel(row))return toast(String(row.status||'')==='cancel_requested'?'รายการนี้ส่งรีเควสขอยกเลิกแล้ว':'รายการนี้ไม่สามารถขอยกเลิกได้','error');
    const html=`<h2>รีเควสขอยกเลิกการมาช่วย</h2><p class="muted">${esc(row.helper_name)} • ${esc(thaiDate(row.work_date))} • ${esc(slotLabel(row.slot_type,row.slot_no))}</p><form id="donorHelperSelfCancelFormV327" class="form-grid"><input type="hidden" name="signup_id" value="${esc(row.id)}"><label class="wide">เหตุผล <textarea name="reason" rows="3" minlength="3" required placeholder="ระบุเหตุผลเพื่อให้หน่วยงานจัดคนแทนได้"></textarea></label><label class="wide donor-helper-ack"><input type="checkbox" name="ack" required><span>รับทราบว่าต้องแจ้งอินชาร์จเดือนนี้หรือหัวหน้าหน่วยเวชศาสตร์บริการโลหิตเพื่ออนุมัติ และชื่อจะยังคงอยู่จนกว่า Admin จะยืนยัน</span></label><div class="wide form-actions"><button class="ghost-btn" type="button" data-v327-close>กลับ</button><button class="danger-btn" type="submit">ส่งรีเควสขอยกเลิก</button></div></form>`;
    try{showModal(html,{small:true});}catch(_){toast('เปิดหน้าต่างขอยกเลิกไม่สำเร็จ','error');}
  }

  function showAdminAdd(payloadText){
    const [date,type,no]=String(payloadText||'').split('|');if(blockedMap().has(date))return toast('วันนี้ไม่เปิดลงชื่อ เนื่องจากเป็นวันหยุดนักขัตฤกษ์','error');
    const html=`<h2>เพิ่มชื่อแทน</h2><p class="muted">${esc(thaiDate(date))} • ${esc(slotLabel(type,Number(no)))}</p><form id="donorHelperAdminAddFormV327" class="form-grid"><input type="hidden" name="work_date" value="${esc(date)}"><input type="hidden" name="slot_type" value="${esc(type)}"><input type="hidden" name="slot_no" value="${esc(no)}"><label>ชื่อ-สกุล <input name="helper_name" required maxlength="120" placeholder="เช่น สมชาย ใจดี"></label><label>หน่วยงาน <select name="unit_name" required>${unitOptions()}</select></label><label class="wide">เบอร์โทร <input name="phone" inputmode="numeric" required maxlength="12" placeholder="0XX-XXX-XXXX" pattern="0[0-9]{2}-[0-9]{3}-[0-9]{4}"></label><button class="primary-btn wide" type="submit">บันทึกชื่อ</button></form>`;
    try{showModal(html,{small:true});}catch(_){toast('เปิดแบบฟอร์มไม่สำเร็จ','error');}
  }
  function showAdminEdit(id){
    const row=rowById(id);if(!row)return toast('ไม่พบรายการ','error');
    const external=!row.internal_staff_id;
    const html=`<h2>แก้ไขข้อมูลผู้มาช่วย</h2><p class="muted">${esc(thaiDate(row.work_date))} • ${esc(slotLabel(row.slot_type,row.slot_no))}</p><form id="donorHelperAdminEditFormV327" class="form-grid"><input type="hidden" name="signup_id" value="${esc(row.id)}"><label>ชื่อ-สกุล <input name="helper_name" value="${esc(row.helper_name||'')}" required maxlength="120" placeholder="เช่น สมชาย ใจดี"></label><label>หน่วยงาน <select name="unit_name" required>${unitOptions(row.unit_name||'')}</select>${row.unit_name&&!isAllowedUnit(row.unit_name)?`<span class="muted">ข้อมูลเดิม: ${esc(row.unit_name)} — กรุณาเลือกใหม่</span>`:''}</label><label class="wide">เบอร์โทร${external?'':' (ถ้ามี)'} <input name="phone" value="${esc(formatPhone(row.phone||''))}" inputmode="numeric" ${external?'required ':''}maxlength="12" placeholder="0XX-XXX-XXXX" pattern="0[0-9]{2}-[0-9]{3}-[0-9]{4}"></label>${external?'<div class="notice soft-notice wide">รายการคนนอกหน่วยต้องมีชื่อ-สกุลและเบอร์โทร 10 หลัก</div>':''}<button class="primary-btn wide" type="submit">บันทึกการแก้ไข</button></form>`;
    try{showModal(html,{small:true});}catch(_){toast('เปิดแบบฟอร์มไม่สำเร็จ','error');}
  }
  function showEditReason(id){
    const row=rowById(id);if(!row)return toast('ไม่พบรายการ','error');
    const html=`<h2>แก้ไขเหตุผล/หมายเหตุ</h2><p class="muted">${esc(row.helper_name||'-')} • ${esc(thaiDate(row.work_date))} • ${esc(slotLabel(row.slot_type,row.slot_no))}</p><form id="donorHelperAdminReasonFormV327" class="form-grid"><input type="hidden" name="signup_id" value="${esc(row.id)}"><input type="hidden" name="status" value="${esc(row.status||'confirmed')}"><label class="wide">เหตุผล/หมายเหตุ <textarea name="reason" rows="4" maxlength="500" placeholder="แก้ไขเหตุผลหรือหมายเหตุ">${esc(row.cancel_reason||'')}</textarea></label><div class="notice soft-notice wide">ใช้แก้ไขกรณีพิมพ์ผิดหรือกดผิด โดยใช้สิทธิ์ Admin/อินชาร์จเดิม</div><div class="wide form-actions"><button class="ghost-btn" type="button" data-v327-close>กลับ</button><button class="primary-btn" type="submit">บันทึกเหตุผล</button></div></form>`;
    try{showModal(html,{small:true});}catch(_){toast('เปิดแบบฟอร์มไม่สำเร็จ','error');}
  }
  async function confirmAction(message,title='ยืนยันรายการ'){try{if(typeof confirmDialog==='function')return await confirmDialog(message,title);}catch(_){}return window.confirm(message);}
  async function updateStatus(id,next){
    const row=rowById(id);if(!row)return toast('ไม่พบรายการ','error');
    const prompts={cancelled:`ยืนยัน “ยกเลิกตามคำขอ” ของ ${row.helper_name} ใช่หรือไม่? ประวัติจะยังคงอยู่`,confirmed:`ไม่อนุมัติคำขอยกเลิกของ ${row.helper_name} และคงชื่อไว้ใช่หรือไม่?`,completed:`ยืนยันว่า ${row.helper_name} มาปฏิบัติงานแล้วใช่หรือไม่?`,no_show:`ยืนยันบันทึกว่า ${row.helper_name} ไม่มาตามนัด (No Show) ใช่หรือไม่?`};
    if(!await confirmAction(prompts[next]||'ยืนยันเปลี่ยนสถานะหรือไม่?'))return;
    let note=null;if(next==='cancelled')note=await promptDialog('เหตุผลที่ยกเลิกตามคำขอ','ระบุเหตุผล',row.cancel_reason||'')||row.cancel_reason||null;
    try{const result=await DB().rpc('admin_update_donor_helper_status_v324',{p_signup_id:id,p_status:next,p_note:note});if(result.error)throw result.error;await loadMonth(S().donorHelperMonthV327,{force:true});toast('บันทึกสถานะแล้ว');}catch(error){toast(errorText(error),'error');}
  }
  async function copyLink(){const link=publicUrl();try{await navigator.clipboard.writeText(link);toast('คัดลอกลิงก์แล้ว');}catch(_){await promptDialog('คัดลอกลิงก์นี้','ลิงก์หน้าลงชื่อ',link);}}
  function goOt(){const st=S();if(!st)return;try{closeModal();}catch(_){}st.page='ot';rerender();}

  document.addEventListener('change',event=>{
    const target=event.target;if(!target||target.id!=='donorHelperMonthInputV327')return;const st=S();if(!st)return;
    st.donorHelperMonthV327=target.value||monthNow();st.donorHelperLoadedMonthV327='';st.donorHelperErrorV327='';rerender();
  },true);

  document.addEventListener('input',event=>{
    const target=event.target;if(target?.name==='phone')target.value=formatPhone(target.value);
  },true);

  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-v327-self-book],[data-v327-self-cancel],[data-v327-admin-add],[data-v327-edit],[data-v327-edit-reason],[data-v327-status],[data-v327-refresh],[data-v327-copy-link],[data-v327-go-ot],[data-v327-close]');
    if(!target)return;event.preventDefault();event.stopPropagation();
    if(target.hasAttribute('data-v327-self-book'))return showSelfModal(target.getAttribute('data-v327-self-book'));
    if(target.hasAttribute('data-v327-self-cancel'))return showCancelModal(target.getAttribute('data-v327-self-cancel'));
    if(target.hasAttribute('data-v327-admin-add'))return showAdminAdd(target.getAttribute('data-v327-admin-add'));
    if(target.hasAttribute('data-v327-edit'))return showAdminEdit(target.getAttribute('data-v327-edit'));
    if(target.hasAttribute('data-v327-edit-reason'))return showEditReason(target.getAttribute('data-v327-edit-reason'));
    if(target.hasAttribute('data-v327-status')){const [id,status]=String(target.getAttribute('data-v327-status')||'').split('|');return void updateStatus(id,status);}
    if(target.hasAttribute('data-v327-refresh'))return void loadMonth(S()?.donorHelperMonthV327,{force:true});
    if(target.hasAttribute('data-v327-copy-link'))return void copyLink();
    if(target.hasAttribute('data-v327-go-ot'))return goOt();
    if(target.hasAttribute('data-v327-close')){try{closeModal();}catch(_){}return;}
  },true);

  document.addEventListener('submit',async event=>{
    const form=event.target;if(!form||!['donorHelperSelfFormV327','donorHelperSelfCancelFormV327','donorHelperAdminAddFormV327','donorHelperAdminEditFormV327','donorHelperAdminReasonFormV327'].includes(form.id))return;
    event.preventDefault();event.stopPropagation();const fd=new FormData(form),button=form.querySelector('button[type="submit"]');if(button)button.disabled=true;
    try{
      if(form.id==='donorHelperSelfFormV327'){
        if(!isSignupOpenFor(String(fd.get('work_date')||'')))return toast(`เปิดลงชื่อ ${openLabelFor(String(fd.get('work_date')||''))}`,'error');
        const result=await DB().rpc('signup_donor_helper_internal_v327',{p_work_date:fd.get('work_date'),p_slot_type:fd.get('slot_type'),p_slot_no:Number(fd.get('slot_no'))});if(result.error)throw result.error;
        try{closeModal();}catch(_){}await loadMonth(S().donorHelperMonthV327,{force:true});
        try{showModal(`<h2>ลงชื่อเรียบร้อยแล้ว</h2><p>ระบบเติมชื่อ เบอร์โทร และหน่วยงานจากข้อมูลส่วนตัวให้แล้ว</p><div class="notice soft-notice">รายการนี้ยังไม่สร้าง OT อัตโนมัติ กรุณาไปขอ OT ที่ <b>ส่วนที่ 2</b></div><div class="form-actions"><button class="primary-btn" type="button" data-v327-go-ot>ไปขอ OT ส่วนที่ 2</button><button class="ghost-btn" type="button" data-v327-close>ปิด</button></div>`,{small:true});}catch(_){toast('ลงชื่อเรียบร้อยแล้ว');}
      }else if(form.id==='donorHelperSelfCancelFormV327'){
        const result=await DB().rpc('request_cancel_donor_helper_internal_v327',{p_signup_id:fd.get('signup_id'),p_reason:String(fd.get('reason')||'').trim()});if(result.error)throw result.error;
        try{closeModal();}catch(_){}await loadMonth(S().donorHelperMonthV327,{force:true});toast('ส่งรีเควสขอยกเลิกแล้ว ชื่อจะยังอยู่จนกว่า Admin จะยืนยัน');
      }else if(form.id==='donorHelperAdminAddFormV327'){
        if(!admin())throw new Error('Permission denied');
        const unit=String(fd.get('unit_name')||'').trim(),name=normalizeFullName(fd.get('helper_name')),phone=formatPhone(fd.get('phone'));
        if(!hasFirstAndLastName(name))throw new Error('กรุณากรอกทั้งชื่อและนามสกุล โดยเว้นวรรคระหว่างชื่อกับนามสกุล');
        if(!isAllowedUnit(unit))throw new Error('กรุณาเลือกหน่วยงานจากรายการ');
        if(!validPhone(phone))throw new Error('กรุณากรอกเบอร์โทร 10 หลัก ขึ้นต้นด้วย 0 เช่น 081-234-5678');
        const result=await DB().rpc('admin_add_donor_helper_v324',{p_work_date:fd.get('work_date'),p_slot_type:fd.get('slot_type'),p_slot_no:Number(fd.get('slot_no')),p_helper_name:name,p_unit_name:unit,p_phone:phone});if(result.error)throw result.error;
        try{closeModal();}catch(_){}await loadMonth(S().donorHelperMonthV327,{force:true});toast('เพิ่มชื่อแล้ว');
      }else if(form.id==='donorHelperAdminEditFormV327'){
        if(!admin())throw new Error('Permission denied');
        const row=rowById(fd.get('signup_id')),external=!row?.internal_staff_id,unit=String(fd.get('unit_name')||'').trim(),name=normalizeFullName(fd.get('helper_name')),phone=formatPhone(fd.get('phone'));
        if(external&&!hasFirstAndLastName(name))throw new Error('กรุณากรอกทั้งชื่อและนามสกุล โดยเว้นวรรคระหว่างชื่อกับนามสกุล');
        if(!isAllowedUnit(unit))throw new Error('กรุณาเลือกหน่วยงานจากรายการ');
        if(external&&!validPhone(phone))throw new Error('กรุณากรอกเบอร์โทร 10 หลัก ขึ้นต้นด้วย 0 เช่น 081-234-5678');
        if(!external&&phone&&!validPhone(phone))throw new Error('กรุณากรอกเบอร์โทร 10 หลัก ขึ้นต้นด้วย 0 เช่น 081-234-5678');
        const result=await DB().rpc('admin_edit_donor_helper_v324',{p_signup_id:fd.get('signup_id'),p_helper_name:name,p_unit_name:unit,p_phone:phone||null});if(result.error)throw result.error;
        try{closeModal();}catch(_){}await loadMonth(S().donorHelperMonthV327,{force:true});toast('แก้ไขข้อมูลแล้ว');
      }else if(form.id==='donorHelperAdminReasonFormV327'){
        if(!admin())throw new Error('Permission denied');
        const result=await DB().rpc('admin_update_donor_helper_status_v324',{p_signup_id:fd.get('signup_id'),p_status:String(fd.get('status')||'cancelled'),p_note:String(fd.get('reason')||'').trim()||null});if(result.error)throw result.error;
        try{closeModal();}catch(_){}await loadMonth(S().donorHelperMonthV327,{force:true});toast('บันทึกเหตุผลแล้ว');
      }
    }catch(error){toast(errorText(error),'error');if(button)button.disabled=false;}
  },true);

  window.cnmiDonorHelperV327={version:VERSION,loadMonth,publicUrl};
  console.info(`[${VERSION}] loaded`);
})();

} catch (error) { console.error("[v569] patch-v327-donor-helper-internal-booking.js", error); }
;

/* Original source: patch-v331-ch4-daily-detail-staff-order.js */
try {
/* CNMI Staff Planner V331
   1) Fix CH4 replacement selection/save for Admin and Staff.
   2) Put a duty-detail card directly under today's adjusted assignee.
   3) Sort MT staff by employee code, including trainees/new staff; Mus stays first.
   4) Inactive/resigned staff disappear naturally and remaining staff close ranks.
   Popup functions are not replaced or removed.
*/
(function(){
  'use strict';
  const VERSION='V331_CH4_DAILY_DETAIL_STAFF_ORDER';
  if(window.__CNMI_V331__) return;
  window.__CNMI_V331__=true;

  function st(){try{return window.state||state||{};}catch(_){return window.state||{};}}
  function txt(v){return String(v==null?'':v).trim();}
  function esc(v){
    try{if(typeof window.escapeHtml==='function')return window.escapeHtml(txt(v));}catch(_){}
    return txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function normalizeDate(v){
    try{if(typeof window.normalizeDateKey==='function')return txt(window.normalizeDateKey(v)).slice(0,10);}catch(_){}
    return txt(v).slice(0,10);
  }
  function currentStaffId(){
    try{if(typeof window.currentStaffId==='function')return txt(window.currentStaffId());}catch(_){}
    const s=st(); return txt(s.profile?.staff_id||s.profile?.id);
  }
  function staffName(id){
    const row=(st().staff||[]).find(x=>txt(x?.id)===txt(id))||{};
    return txt(row.nickname||row.full_name||row.email||id||'-');
  }
  function isActive(row){
    const active=Object.prototype.hasOwnProperty.call(row||{},'active')
      ? (row.active===true||txt(row.active).toLowerCase()==='true')
      : (row?.is_active!==false&&txt(row?.is_active).toLowerCase()!=='false');
    const schedule=Object.prototype.hasOwnProperty.call(row||{},'schedule')
      ? (row.schedule===true||txt(row.schedule).toLowerCase()==='true') : true;
    return active&&schedule;
  }
  function employeeCode(row){return txt(row?.employee_code||row?.emp_code||row?.staff_code||row?.code);}
  function isMus(row){
    const nick=txt(row?.nickname).replace(/\s+/g,'');
    const full=txt(row?.full_name).replace(/\s+/g,'');
    return nick==='มัส'||full.includes('ปาริฉัตรอินทร์เกลี้ยง');
  }
  function isMt(row){
    const all=`${txt(row?.staff_type)} ${txt(row?.role)} ${txt(row?.position)} ${txt(row?.profession)}`.toLowerCase();
    return /(^|\s)mt($|\s)|นักเทคนิคการแพทย์|เทคนิคการแพทย์/.test(all);
  }
  function compareCode(a,b){
    const ac=employeeCode(a), bc=employeeCode(b);
    if(ac&&!bc)return -1; if(!ac&&bc)return 1;
    const c=ac.localeCompare(bc,'th',{numeric:true,sensitivity:'base'});
    if(c)return c;
    return staffName(a?.id).localeCompare(staffName(b?.id),'th',{numeric:true});
  }
  function compareV331(a,b){
    if(isMus(a)!==isMus(b))return isMus(a)?-1:1;
    if(isMt(a)!==isMt(b))return isMt(a)?-1:1;
    return compareCode(a,b);
  }
  function orderedV331(list){return [...(list||[])].sort(compareV331);}

  // Override only the shared ordering helper. New/trainee MT are deliberately not separated.
  window.orderedStaff=orderedV331;
  try{orderedStaff=orderedV331;}catch(_){}
  window.compareStaffOrder=compareV331;
  try{compareStaffOrder=compareV331;}catch(_){}

  function activeStaff(){return orderedV331((st().staff||[]).filter(isActive));}
  function assignmentFromKey(key){
    const parts=txt(key).split('|');
    const [id,date,staffId,dutyCode]=parts;
    return (st().rosterAssignments||[]).find(row=>{
      if(id&&txt(row?.id)===id)return true;
      return normalizeDate(row?.duty_date)===date&&txt(row?.staff_id)===staffId&&txt(row?.duty_code)===dutyCode;
    })||null;
  }
  function modal(html){
    try{if(typeof window.showModal==='function')window.showModal(html,{small:true});}catch(_){}
    const root=document.getElementById('modal'),body=document.getElementById('modalBody');
    if(!root||!body)return;
    if(!txt(body.innerHTML))body.innerHTML=html;
    root.classList.remove('hidden','modal-closing'); root.classList.add('modal-ready');
    document.body.classList.add('modal-open');
  }
  function toast(message,tone='error'){
    try{if(typeof window.showToast==='function')return window.showToast(message,{tone});}catch(_){}
    alert(message);
  }
  function closeModalSafe(){
    try{if(typeof window.closeModal==='function')return window.closeModal();}catch(_){}
    document.getElementById('modal')?.classList.add('hidden'); document.body.classList.remove('modal-open');
  }
  function coverModal(key){
    const assignment=assignmentFromKey(key);
    if(!assignment)return toast('ไม่พบรายการ ช4 นี้ กรุณารีเฟรชหน้า');
    const people=activeStaff().filter(x=>txt(x.id)!==txt(assignment.staff_id));
    const options='<option value="">เลือกผู้ที่อยู่แทน</option>'+people.map(x=>`<option value="${esc(x.id)}">${esc(staffName(x.id))}${employeeCode(x)?` — ${esc(employeeCode(x))}`:''}</option>`).join('');
    const chips=people.map(x=>`<button type="button" class="v331-cover-person" data-v331-cover-person="${esc(x.id)}">${esc(staffName(x.id))}</button>`).join('');
    modal(`<div class="v331-ch4-modal"><h2>ย้าย ช4 ให้คนอยู่แทน</h2><p class="hint">ไม่สร้าง OT อัตโนมัติ</p><form id="ch4CoverFormV331" class="form-grid"><input type="hidden" name="assignment_key" value="${esc(key)}"><label>เจ้าของ ช4 <input value="${esc(staffName(assignment.staff_id))}" disabled></label><label>วันที่ <input value="${esc(normalizeDate(assignment.duty_date))}" disabled></label><label class="wide">ผู้ที่อยู่แทน <select name="covered_by_staff_id" required>${options}</select></label><div class="wide v331-cover-grid">${chips||'<span class="muted">ไม่พบรายชื่อที่เลือกได้</span>'}</div><label class="wide">หมายเหตุ <textarea name="covered_note" rows="3" placeholder="เช่น ปั่นเลือดแทน / อยู่แทนช่วงเย็น"></textarea></label><div class="actions wide"><button class="ghost-btn" type="button" data-close-modal>ยกเลิก</button><button class="primary-btn" type="submit">ย้าย ช4</button></div></form></div>`);
  }
  async function saveCover(form){
    const fd=new FormData(form),assignment=assignmentFromKey(fd.get('assignment_key'));
    const coveredBy=txt(fd.get('covered_by_staff_id')),note=txt(fd.get('covered_note'));
    if(!assignment)return toast('ไม่พบรายการ ช4 นี้ กรุณารีเฟรชหน้า');
    if(!coveredBy)return toast('กรุณาเลือกผู้ที่อยู่แทน');
    const client=window.sb||(()=>{try{return sb;}catch(_){return null;}})();
    if(!client)return toast('ยังเชื่อมต่อฐานข้อมูลไม่สำเร็จ');
    const now=new Date().toISOString();
    const base={
      roster_assignment_id:assignment.id||null,shift_type:'ช4',duty_code:assignment.duty_code||'ช4',
      work_date:normalizeDate(assignment.duty_date),owner_staff_id:assignment.staff_id,status:'covered_by_other',
      covered_by_staff_id:coveredBy,covered_by_name:staffName(coveredBy),covered_note:note||`มีคนอยู่แทน: ${staffName(coveredBy)}`,
      note:note||`มีคนอยู่แทน: ${staffName(coveredBy)}`,confirmed_at:now,covered_at:now,
      updated_by:currentStaffId(),created_by:currentStaffId()
    };
    const variants=[base,(()=>{const p={...base};delete p.covered_by_name;return p;})(),(()=>{const p={...base};delete p.covered_by_name;delete p.roster_assignment_id;return p;})(),(()=>{const p={...base};delete p.covered_by_name;delete p.roster_assignment_id;delete p.created_by;return p;})()];
    let saved=null,lastError=null;
    try{if(typeof window.setBusy==='function')window.setBusy(true,'กำลังบันทึกคนอยู่แทน');}catch(_){}
    for(const payload of variants){
      const res=await client.from('shift_confirmations').upsert(payload,{onConflict:'work_date,owner_staff_id,duty_code'}).select('*').maybeSingle();
      if(!res.error){saved=res.data||payload;break;}
      lastError=res.error;
      if(!/column|schema|cache|constraint|conflict|unique/i.test(txt(res.error?.message)))break;
    }
    try{if(typeof window.setBusy==='function')window.setBusy(false);}catch(_){}
    if(!saved)return toast(txt(lastError?.message||lastError||'บันทึกคนอยู่แทนไม่สำเร็จ'));
    const s=st();
    if(!Array.isArray(s.shiftConfirmations))s.shiftConfirmations=[];
    s.shiftConfirmations=s.shiftConfirmations.filter(r=>!(normalizeDate(r?.work_date||r?.duty_date)===base.work_date&&txt(r?.owner_staff_id||r?.staff_id)===txt(base.owner_staff_id)&&txt(r?.duty_code||'ช4')===txt(base.duty_code)));
    s.shiftConfirmations.push(saved);
    try{
      const mover=window.cnmiV441Ch4Transfer?.transferCh4Assignment;
      if(typeof mover==='function')await mover(assignment,coveredBy,{ownerStaffId:base.owner_staff_id});
    }catch(err){
      console.error('[V441] transfer CH4 after V331 cover',err);
      closeModalSafe();
      return toast('บันทึกคนอยู่แทนแล้ว แต่ย้าย ช4 ไม่สำเร็จ','error');
    }
    closeModalSafe();
    try{if(typeof window.renderPage==='function')window.renderPage();}catch(_){}
    toast(`ย้าย ช4 ให้ ${staffName(coveredBy)} แล้ว • ไม่สร้าง OT อัตโนมัติ`,'success');
  }

  function positionRows(){return window.__CNMI_V226_DAILY_POSITION_ROWS__||window.__CNMI_V225_DAILY_POSITION_ROWS__||[];}
  function masterFor(code){
    const s=st();
    for(const list of [s.positionMasters,s.dailyPositionMasters,s.positions,window.DEFAULT_DAILY_POSITIONS]){
      if(!Array.isArray(list))continue;
      const found=list.find(x=>txt(x?.code||x?.position_code)===txt(code)); if(found)return found;
    }
    try{if(typeof window.positionByCode==='function')return window.positionByCode(code)||{};}catch(_){}
    return {};
  }
  function detailText(row,card){
    const code=txt(row?.position_code||row?.code||card?.querySelector('[data-position-code]')?.dataset?.positionCode||card?.querySelector('h3')?.textContent);
    const master=masterFor(code);
    return txt(row?.job_desc||row?.description||master?.job_desc||master?.description)||'ยังไม่ได้ระบุรายละเอียดหน้าที่';
  }
  function enhanceDailyCards(){
    const page=document.querySelector('#pageContent .v225-positions-page,#pageContent .v226-positions-page'); if(!page)return;
    const rows=positionRows();
    const cards=[...page.querySelectorAll('.v225-mobile-position-list > .position-mobile-card,.v225-mobile-position-list > .v225-position-card')];
    cards.forEach((card,i)=>{
      let box=card.querySelector(':scope > .v331-duty-detail-card');
      if(!box){box=document.createElement('div');box.className='v331-duty-detail-card';}
      box.innerHTML=`<span>รายละเอียดตำแหน่ง</span><p>${esc(detailText(rows[i]||{},card))}</p>`;
      const adjustment=card.querySelector(':scope > label');
      const change=card.querySelector(':scope > .v322-change-status');
      const anchor=change||adjustment;
      if(anchor){if(box.previousElementSibling!==anchor)anchor.insertAdjacentElement('afterend',box);}else card.appendChild(box);
    });
  }
  let queued=false;
  function queueEnhance(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhanceDailyCards();});}

  // Window capture runs before the older document capture handler, avoiding its stopImmediatePropagation path.
  window.addEventListener('click',event=>{
    const cover=event.target?.closest?.('[data-v234-ch4-cover]');
    if(cover){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();coverModal(cover.getAttribute('data-v234-ch4-cover'));return;}
    const person=event.target?.closest?.('[data-v331-cover-person]');
    if(person){event.preventDefault();const form=person.closest('form');const select=form?.querySelector('[name="covered_by_staff_id"]');if(select){select.value=person.dataset.v331CoverPerson;form.querySelectorAll('.v331-cover-person').forEach(b=>b.classList.toggle('selected',b===person));}return;}
  },true);
  window.addEventListener('submit',event=>{
    if(event.target?.id!=='ch4CoverFormV331')return;
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();void saveCover(event.target);
  },true);

  function install(){
    const root=document.getElementById('pageContent')||document.body;
    if(root&&!root.__v331Observer){const ob=new MutationObserver(queueEnhance);ob.observe(root,{childList:true,subtree:true});root.__v331Observer=ob;}
    queueEnhance();
  }
  const style=document.createElement('style');style.id='v331-style';style.textContent=`
    .v331-cover-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:8px}
    .v331-cover-person{border:1px solid #cfe0ef;background:#fff;border-radius:14px;padding:10px 8px;font:inherit;color:#1979bd;cursor:pointer}
    .v331-cover-person.selected{background:#72bff0;color:#17334a;border-color:#72bff0;font-weight:700}
    .v331-duty-detail-card{display:block;width:100%;box-sizing:border-box;border:1px solid #cfe3f5;background:#f7fbff;border-radius:18px;padding:14px 16px;margin-top:10px}
    .v331-duty-detail-card>span{display:block;font-weight:800;color:#24577b;margin-bottom:5px}
    .v331-duty-detail-card>p{margin:0;white-space:pre-line;line-height:1.55;color:#526a82}
  `;document.head.appendChild(style);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.cnmiV331={orderedV331,coverModal,enhanceDailyCards};
  console.info(`[${VERSION}] loaded`);
})();

} catch (error) { console.error("[v569] patch-v331-ch4-daily-detail-staff-order.js", error); }
;

/* Original source: patch-v332-calendar-activity-time-location.js */
try {
/* V332 — Calendar activity time/location detail (display-only, no extra data request) */
(function(){
  'use strict';
  const VERSION='V332';

  function esc(value){
    return String(value == null ? '' : value)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

  function isActivity(row){
    return ['activity','training','meeting','outing','standard','code'].includes(String(row?.type || ''));
  }

  function activityMeta(row){
    if(!isActivity(row)) return '';
    const raw=row?.raw || {};
    const start=String(raw.start_time || '').trim();
    const end=String(raw.end_time || '').trim();
    const location=String(raw.location || '').trim();
    const timeText=start && end ? `${start}–${end}` : (start || end);
    if(!timeText && !location) return '';
    return `<div class="v332-activity-meta muted">${timeText ? `<div><b>เวลา:</b> ${esc(timeText)}</div>` : ''}${location ? `<div><b>สถานที่:</b> ${esc(location)}</div>` : ''}</div>`;
  }

  function enhanceRenderer(){
    const original=window.renderCalendarModalRow;
    if(typeof original!=='function' || original.__v332Enhanced) return false;

    function renderCalendarModalRowV332(row){
      const html=String(original(row) || '');
      const meta=activityMeta(row);
      if(!meta || html.includes('v332-activity-meta')) return html;
      const marker='</div>';
      const titleStart=html.indexOf('<div class="event-title"');
      if(titleStart<0) return html;
      const titleEnd=html.indexOf(marker,titleStart);
      if(titleEnd<0) return html;
      const insertAt=titleEnd+marker.length;
      return html.slice(0,insertAt)+meta+html.slice(insertAt);
    }
    renderCalendarModalRowV332.__v332Enhanced=true;
    renderCalendarModalRowV332.__v332Original=original;
    window.renderCalendarModalRow=renderCalendarModalRowV332;
    try{ renderCalendarModalRow=renderCalendarModalRowV332; }catch(_){ }
    return true;
  }

  function addStyle(){
    if(document.getElementById('v332-calendar-meta-style')) return;
    const style=document.createElement('style');
    style.id='v332-calendar-meta-style';
    style.textContent='.v332-activity-meta{margin:.45rem 0 .3rem;line-height:1.5}.v332-activity-meta>div+div{margin-top:.1rem}';
    document.head.appendChild(style);
  }

  addStyle();
  enhanceRenderer();
  document.addEventListener('DOMContentLoaded',()=>{ addStyle(); enhanceRenderer(); },{once:true});
  setTimeout(enhanceRenderer,0);
  window.cnmiV332={version:VERSION,enhanceRenderer};
})();

} catch (error) { console.error("[v569] patch-v332-calendar-activity-time-location.js", error); }
;

/* Original source: patch-v333-physician-direct-leave.js */
try {
/* CNMI Staff Planner V333
   Physician direct leave workflow
   - A profile whose staff_type is แพทย์ (or role contains physician/doctor) may submit own leave normally.
   - The physician may cancel their own active leave/no-duty record immediately without Admin approval.
   - Cancellation preserves the record by setting status = cancelled.
   - No popup/modal functions are replaced and no additional data query is added.
*/
(function () {
  'use strict';

  const VERSION = 'V333_PHYSICIAN_DIRECT_LEAVE';

  function appState() {
    try { return typeof state !== 'undefined' ? state : (window.state || {}); }
    catch (_) { return window.state || {}; }
  }

  function currentId() {
    try { return typeof currentStaffId === 'function' ? currentStaffId() : appState()?.profile?.id || null; }
    catch (_) { return appState()?.profile?.id || null; }
  }

  function currentProfile() {
    const st = appState();
    const id = currentId();
    return st?.profile || (Array.isArray(st?.staff) ? st.staff.find(row => String(row?.id) === String(id)) : null) || {};
  }

  function isPhysicianProfile(profile) {
    const type = String(profile?.staff_type || profile?.position || profile?.job_title || '').trim();
    const role = String(profile?.role || profile?.app_role || '').trim();
    if(window.cnmiPersonTypeV516?.isPhysician)return window.cnmiPersonTypeV516.isPhysician(profile);
    return /^(แพทย์|physician|doctor)$/i.test(type)||/^(แพทย์|physician|doctor)$/i.test(role);
  }

  function isCurrentPhysician() {
    return isPhysicianProfile(currentProfile());
  }

  function ownRow(row) {
    return String(row?.staff_id || '') === String(currentId() || '');
  }

  function finalInactive(row) {
    try {
      const fn = window.isLeaveFinalInactive || (typeof isLeaveFinalInactive === 'function' ? isLeaveFinalInactive : null);
      if (typeof fn === 'function') return !!fn(row);
    } catch (_) {}
    return ['cancelled', 'canceled', 'rejected', 'inactive'].includes(String(row?.status || '').trim().toLowerCase());
  }

  function esc(value) {
    try {
      const fn = window.escapeHtml || (typeof escapeHtml === 'function' ? escapeHtml : null);
      if (typeof fn === 'function') return fn(value);
    } catch (_) {}
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function toast(message) {
    try {
      const fn = window.showToast || (typeof showToast === 'function' ? showToast : null);
      if (typeof fn === 'function') return fn(message);
    } catch (_) {}
    console.info(`[${VERSION}] ${message}`);
  }

  async function confirmAction(message, title) {
    try {
      const fn = window.confirmDialog || (typeof confirmDialog === 'function' ? confirmDialog : null);
      if (typeof fn === 'function') return !!(await fn(message, title));
    } catch (_) {}
    return window.confirm(message);
  }

  function friendly(error) {
    try {
      const fn = window.friendlyDbError || (typeof friendlyDbError === 'function' ? friendlyDbError : null);
      if (typeof fn === 'function') return fn(error);
    } catch (_) {}
    return error?.message || error?.details || error?.hint || 'บันทึกไม่สำเร็จ';
  }

  function busy(value, text) {
    try {
      const fn = window.setBusy || (typeof setBusy === 'function' ? setBusy : null);
      if (typeof fn === 'function') fn(value, text);
    } catch (_) {}
  }

  function rerender() {
    try {
      const fn = window.renderPage || (typeof renderPage === 'function' ? renderPage : null);
      if (typeof fn === 'function') fn();
    } catch (error) {
      console.warn(`[${VERSION}] renderPage failed`, error);
    }
  }

  async function physicianCancelOwnLeave(id) {
    if (!isCurrentPhysician()) return toast('สิทธิ์ยกเลิกทันทีใช้สำหรับแพทย์เท่านั้น');

    const st = appState();
    const row = (Array.isArray(st?.leaves) ? st.leaves : []).find(item => String(item?.id) === String(id));
    if (!row) return toast('ไม่พบรายการลา กรุณารีเฟรชหน้าแล้วลองใหม่');
    if (!ownRow(row)) return toast('ยกเลิกได้เฉพาะรายการลาของตนเอง');
    if (finalInactive(row)) return toast('รายการนี้ถูกยกเลิกแล้ว');

    const noun = String(row?.type || '') === 'ไม่รับเวร' ? 'รายการไม่รับเวร' : 'รายการลา';
    const ok = await confirmAction(
      `ยืนยันยกเลิก${noun}นี้ทันที? ระบบจะเก็บประวัติรายการไว้และเปลี่ยนสถานะเป็น “ยกเลิกแล้ว” โดยไม่ต้องรอ Admin`,
      `ยกเลิก${noun}`
    );
    if (!ok) return;

    const client = (() => {
      try { return typeof sb !== 'undefined' ? sb : window.sb; }
      catch (_) { return window.sb; }
    })();
    if (!client?.from) return toast('ระบบฐานข้อมูลยังโหลดไม่สมบูรณ์ กรุณารีเฟรชหน้า');

    busy(true, 'กำลังยกเลิกรายการ');
    const patch = { status: 'cancelled', updated_by: currentId() };
    const { error } = await client
      .from('leave_requests')
      .update(patch)
      .eq('id', id)
      .eq('staff_id', currentId());
    busy(false);

    if (error) return toast(friendly(error));

    // Update the already-loaded row locally. This avoids an extra Supabase query/egress.
    Object.assign(row, patch);
    try { if (String(st?.editingLeaveId || '') === String(id)) st.editingLeaveId = null; } catch (_) {}
    rerender();
    toast(`${noun}ถูกยกเลิกแล้ว ไม่ต้องรอ Admin`);
  }

  const previousRenderLeaveActions = (() => {
    try { return window.renderLeaveActions || (typeof renderLeaveActions === 'function' ? renderLeaveActions : null); }
    catch (_) { return window.renderLeaveActions || null; }
  })();

  if (typeof previousRenderLeaveActions === 'function') {
    const patchedRenderLeaveActions = function renderLeaveActionsV333(row) {
      if (!isCurrentPhysician() || !ownRow(row)) return previousRenderLeaveActions(row);
      if (finalInactive(row)) return '<span class="muted">ยกเลิกแล้ว</span>';

      let editButton = '';
      try {
        const fn = window.canEditOwn || (typeof canEditOwn === 'function' ? canEditOwn : null);
        if (typeof fn === 'function' && fn(row)) {
          editButton = `<button class="tiny-btn" data-edit-leave="${esc(row?.id)}">แก้ไข</button>`;
        }
      } catch (_) {}

      const label = String(row?.type || '') === 'ไม่รับเวร' ? 'ยกเลิกไม่รับเวรทันที' : 'ยกเลิกวันลาทันที';
      return `${editButton}<button class="tiny-btn danger" type="button" data-v333-physician-cancel-leave="${esc(row?.id)}">${label}</button>`;
    };

    window.renderLeaveActions = patchedRenderLeaveActions;
    try { renderLeaveActions = patchedRenderLeaveActions; } catch (_) {}
  }

  const previousRenderLeavePage = (() => {
    try { return window.renderLeavePage || (typeof renderLeavePage === 'function' ? renderLeavePage : null); }
    catch (_) { return window.renderLeavePage || null; }
  })();

  if (typeof previousRenderLeavePage === 'function') {
    const patchedRenderLeavePage = function renderLeavePageV333() {
      let html = previousRenderLeavePage();
      if (!isCurrentPhysician() || typeof html !== 'string' || html.includes('data-v333-physician-leave-notice')) return html;
      const notice = '<div class="notice soft-notice wide" data-v333-physician-leave-notice><b>สิทธิ์แพทย์:</b> บันทึกรายการลาได้ตามปกติและยกเลิกรายการของตนเองได้ทันที โดยไม่ต้องส่งคำขอให้ Admin อนุมัติ</div>';
      html = html.replace(/(<form[^>]*id=["']leaveForm["'][^>]*>)/i, `$1${notice}`);
      return html;
    };
    window.renderLeavePage = patchedRenderLeavePage;
    try { renderLeavePage = patchedRenderLeavePage; } catch (_) {}
  }

  document.addEventListener('click', function (event) {
    const button = event.target?.closest?.('[data-v333-physician-cancel-leave]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    const id = button.getAttribute('data-v333-physician-cancel-leave');
    if (!id || button.disabled) return;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    Promise.resolve(physicianCancelOwnLeave(id)).finally(() => {
      if (button.isConnected) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    });
  }, true);

  window.isCurrentPhysicianV333 = isCurrentPhysician;
  window.physicianCancelOwnLeaveV333 = physicianCancelOwnLeave;
  console.info(`[${VERSION}] loaded`);
})();

} catch (error) { console.error("[v569] patch-v333-physician-direct-leave.js", error); }
;

/* Original source: patch-v335-daily-position-save-route-lock.js */
try {
/* CNMI Staff Planner V335 — Daily position save route lock
   Scope: daily daytime-position Save/Publish buttons only.
   - Keeps Admin/Incharge on the daily page after saving.
   - Uses the V261 authoritative daily save directly, bypassing legacy wrappers
     that reload all page data and can switch the current route to the monthly page.
   - Preserves trainee/mentor synchronization and reads the saved date back once.
   - Does not change popup, calendar, roster, leave, OT, or monthly-position UI logic.
*/
(function(){
  'use strict';
  const VERSION='V335_DAILY_POSITION_SAVE_ROUTE_LOCK';
  if(window.__CNMI_V335_DAILY_POSITION_SAVE_ROUTE_LOCK__) return;
  window.__CNMI_V335_DAILY_POSITION_SAVE_ROUTE_LOCK__=true;

  let inFlight=false;

  function S(){
    try{return state||window.state||null;}
    catch(_){return window.state||null;}
  }
  function normDate(value){
    try{if(typeof normalizeDateKey==='function') return normalizeDateKey(value);}
    catch(_){}
    return String(value||'').trim().slice(0,10);
  }
  function friendly(error){
    try{if(typeof friendlyDbError==='function') return friendlyDbError(error);}
    catch(_){}
    return error?.message||error?.details||error?.hint||String(error||'เกิดข้อผิดพลาด');
  }
  function toast(message,tone){
    try{
      if(typeof showToast==='function') showToast(message,tone?{tone}:undefined);
      else console.info(message);
    }catch(_){console.info(message);}
  }
  function assignGlobal(name,value){
    try{window[name]=value;}catch(_){}
    try{(0,eval)(`${name}=window[${JSON.stringify(name)}]`);}catch(_){}
  }
  function dailyDate(){
    const st=S();
    return normDate(document.getElementById('positionDateInput')?.value||st?.positionDate||'');
  }
  function pinDailyRoute(date){
    const st=S();
    if(!st) return;
    st.page='positions';
    if(date) st.positionDate=normDate(date);
  }
  function isDailyPage(){return String(S()?.page||'')==='positions';}
  function snapshotScroll(){
    const root=document.getElementById('pageContent');
    const scroller=root?.querySelector('.daily-position-table,.v331-daily-position-list,.table-wrap');
    return {
      windowX:window.scrollX||0,
      windowY:window.scrollY||0,
      rootTop:root?.scrollTop||0,
      rootLeft:root?.scrollLeft||0,
      tableTop:scroller?.scrollTop||0,
      tableLeft:scroller?.scrollLeft||0
    };
  }
  function restoreScroll(saved){
    if(!saved) return;
    requestAnimationFrame(()=>{
      try{window.scrollTo(saved.windowX,saved.windowY);}catch(_){}
      const root=document.getElementById('pageContent');
      if(root){root.scrollTop=saved.rootTop;root.scrollLeft=saved.rootLeft;}
      const scroller=root?.querySelector('.daily-position-table,.v331-daily-position-list,.table-wrap');
      if(scroller){scroller.scrollTop=saved.tableTop;scroller.scrollLeft=saved.tableLeft;}
    });
  }
  function renderDaily(date,scroll){
    pinDailyRoute(date);
    try{
      if(window.cnmiV287?.renderDailyStable) window.cnmiV287.renderDailyStable();
      else if(typeof renderPage==='function') renderPage();
      else window.renderPage?.();
    }catch(error){console.warn(`${VERSION}: daily rerender skipped`,error);}
    restoreScroll(scroll);
  }
  function setButtonsDisabled(disabled){
    document.querySelectorAll('[data-save-positions],[data-publish-positions]').forEach(button=>{
      try{button.disabled=!!disabled;button.setAttribute('aria-busy',disabled?'true':'false');}
      catch(_){}
    });
  }

  async function syncTrainingRows(date){
    /* V270 becomes inert when V271 date-range mentorship is active, but keeping
       this call preserves compatibility with older saved staff profiles. */
    if(window.cnmiV270?.syncTraineePairsForDate){
      await window.cnmiV270.syncTraineePairsForDate(date);
      pinDailyRoute(date);
    }
    if(window.cnmiV271?.syncTrainingPairsForDate){
      await window.cnmiV271.syncTrainingPairsForDate(date);
      pinDailyRoute(date);
    }
  }

  async function refreshSavedDate(date){
    const api=window.cnmiV261;
    if(!api?.fetchDateFromDatabase||!api?.replaceDateInState) return;
    const fresh=await api.fetchDateFromDatabase(date);
    api.replaceDateInState(date,fresh?.rows||[],fresh?.status||null);
    pinDailyRoute(date);
  }

  const previousSave=window.savePositions||(typeof savePositions==='function'?savePositions:null);
  const previousPublish=window.publishPositionsForDay||(typeof publishPositionsForDay==='function'?publishPositionsForDay:null);

  async function runStableDailySave(publish,args,context){
    if(!isDailyPage()){
      const fallback=publish?previousPublish:previousSave;
      return typeof fallback==='function'?fallback.apply(context,args):false;
    }
    const date=dailyDate();
    if(!date) return false;
    if(inFlight){toast('ระบบกำลังบันทึกตำแหน่งวันนี้ กรุณารอสักครู่');return false;}

    const core=window.cnmiV261?.saveDailyAuthoritative;
    if(typeof core!=='function'){
      const fallback=publish?previousPublish:previousSave;
      return typeof fallback==='function'?fallback.apply(context,args):false;
    }

    const scroll=snapshotScroll();
    inFlight=true;
    pinDailyRoute(date);
    setButtonsDisabled(true);
    try{
      const result=await core({publish:!!publish});
      pinDailyRoute(date);
      if(result!==true){renderDaily(date,scroll);return result;}

      try{
        await syncTrainingRows(date);
        await refreshSavedDate(date);
      }catch(error){
        console.error(`${VERSION}: trainee sync/readback failed`,error);
        toast(`บันทึกตำแหน่งหลักแล้ว แต่ซิงก์ผู้ฝึกไม่สำเร็จ: ${friendly(error)}`,'error');
      }

      /* Invalidate only in-memory route caches. No extra Supabase request is made
         here; the next page opens with fresh data instead of an old cached month. */
      try{window.cnmiV316?.clearCache?.();}catch(_){}
      pinDailyRoute(date);
      renderDaily(date,scroll);
      return result;
    }finally{
      pinDailyRoute(date);
      inFlight=false;
      setButtonsDisabled(false);
    }
  }

  const saveStable=async function savePositionsV335(){
    return runStableDailySave(false,arguments,this);
  };
  saveStable.__v335DailyRouteLock=true;
  assignGlobal('savePositions',saveStable);

  const publishStable=async function publishPositionsForDayV335(){
    return runStableDailySave(true,arguments,this);
  };
  publishStable.__v335DailyRouteLock=true;
  assignGlobal('publishPositionsForDay',publishStable);

  window.cnmiV335={version:VERSION,runStableDailySave,pinDailyRoute};
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v335-daily-position-save-route-lock.js", error); }
;

/* Original source: patch-v336-continuous-balance-staff-color.js */
try {
/* CNMI Staff Planner V336
   Continuous duty + holiday balance across every available month.
   - No automatic calendar/fiscal-year reset
   - Reset only from each staff member's Admin reset month
   - Preserve V298 pre-trade baseline logic
   - Highlight current cumulative duty/holiday columns with each staff colour
   - Load only the compact historical columns required for this calculation
*/
(function(){
  'use strict';
  const VERSION='V336_CONTINUOUS_BALANCE_STAFF_COLOR';
  if(window.__CNMI_V336_CONTINUOUS_BALANCE_STAFF_COLOR__)return;
  window.__CNMI_V336_CONTINUOUS_BALANCE_STAFF_COLOR__=true;

  const history={
    assignments:[],
    trades:[],
    holidays:[],
    loadedThrough:'',
    ready:false,
    loading:null,
    error:''
  };
  const PAGE_SIZE=1000;

  function S(){try{return state||window.state||null;}catch(_){return window.state||null;}}
  function DB(){try{return sb||window.sb||null;}catch(_){return window.sb||null;}}
  function esc(v){try{return escapeHtml(v==null?'':String(v));}catch(_){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}}
  function normId(v){return String(v==null?'':v);}
  function normDate(v){try{return normalizeDateKey(v);}catch(_){return String(v||'').slice(0,10);}}
  function monthKeySafe(v){return /^\d{4}-\d{2}$/.test(String(v||''))?String(v):new Date().toISOString().slice(0,7);}
  function monthEnd(key){const y=Number(key.slice(0,4)),m=Number(key.slice(5,7));return `${key}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;}
  function nextMonth(key){const y=Number(key.slice(0,4)),m=Number(key.slice(5,7)),d=new Date(y,m,1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;}
  function nextDate(date){const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function monthsBetween(start,end){const out=[];let cur=start,guard=0;while(cur<=end&&guard<600){out.push(cur);cur=nextMonth(cur);guard++;}return out;}
  function explicitFalse(v){return v===false||['false','0','no','off','ปิด'].includes(String(v??'').trim().toLowerCase());}
  function isAdminSafe(){try{return !!isAdmin();}catch(_){return String(S()?.profile?.role||'').toLowerCase()==='admin';}}
  function isLongLeave(person){try{return !!isLongTermLeaveStaff(person);}catch(_){return person?.maternity_status===true||person?.is_long_term_leave===true;}}
  function isRosterPerson(person){
    if(!person)return false;
    const active=Object.prototype.hasOwnProperty.call(person,'is_active')?person.is_active:person.active;
    if(active==null||explicitFalse(active)||String(person.staff_type||'').trim()==='แพทย์')return false;
    const enabled=person.roster_enabled??person.duty_enabled??person.can_roster??person.is_roster_enabled??person.schedule_enabled??person.is_schedule_enabled;
    return !explicitFalse(enabled);
  }
  function ordered(rows){try{return orderedStaff(rows);}catch(_){return [...rows].sort((a,b)=>String(a?.nickname||a?.full_name||'').localeCompare(String(b?.nickname||b?.full_name||''),'th'));}}
  function currentStaffList(staffList){const input=Array.isArray(staffList)&&staffList.length?staffList:(S()?.staff||[]).filter(isRosterPerson);return ordered(input.filter(p=>p&&String(p.staff_type||'').trim()!=='แพทย์'));}
  function groupLabel(person){return String(person?.staff_type||'').trim()==='เคิก'?'เคิก':'MT';}
  function resetMonth(person,field){const raw=person?.[field];return raw?normDate(raw).slice(0,7):'';}
  function badgeHtml(text,tone){try{return badge(text,tone);}catch(_){return `<span class="badge ${esc(tone||'')}">${esc(text)}</span>`;}}
  function staffPillHtml(person){try{return staffPill(person);}catch(_){return `<b>${esc(person?.nickname||person?.full_name||'-')}</b>`;}}
  function staffColorSafe(person){try{return staffColor(person);}catch(_){return person?.staff_color||person?.color||'#e2e8f0';}}
  function textColorSafe(color){try{return textColorFor(color);}catch(_){return '#0f172a';}}
  function fmt(n){const x=Number(n||0);return Math.abs(x)<0.05?'0.0':x.toFixed(1);}
  function calcStats(rows){try{return calcFairness((rows||[]).filter(r=>r?.staff_id))||{};}catch(_){return{};}}
  function daysOff(staffId,key,rows){try{return Number(calculateDaysOff(staffId,key,rows)||0);}catch(_){return 0;}}
  function countDutyCodes(rows,staffId){
    const own=(rows||[]).filter(r=>normId(r?.staff_id)===normId(staffId));
    const count=fn=>own.filter(fn).length;
    return{total:own.length,chbd1:count(r=>r.duty_code==='ชบด1'),chbd2:count(r=>r.duty_code==='ชบด2'),chbd3:count(r=>r.duty_code==='ชบด3'),ch3a:count(r=>r.duty_code==='ช3A'),ch3b:count(r=>r.duty_code==='ช3B'),ch4:count(r=>String(r.duty_code||'').startsWith('ช4')),ch9:count(r=>String(r.duty_code||'').startsWith('ช9'))};
  }
  function tradeTime(row){return row?.updated_at||row?.completed_at||row?.confirmed_at||row?.created_at||'';}
  function completedTrades(rows){return (rows||[]).filter(r=>String(r?.status||'')==='completed'&&r?.from_assignment_id&&r?.requester_id);}
  function isWholeTrade(request,assignment){
    try{const api=window.cnmiTradeSegmentsV217;if(api){const part=api.partFromNote(request?.note,assignment);return api.coversWholeSlot(part,assignment);}}catch(_){}
    return true;
  }
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
  function mergeUnique(rows,keyFn){
    const map=new Map();
    (rows||[]).forEach(row=>{const key=keyFn(row);if(key)map.set(key,row);});
    return [...map.values()];
  }
  function mergeHolidaysIntoState(rows){
    const st=S();if(!st)return;
    st.holidays=mergeUnique([...(st.holidays||[]),...(rows||[])],r=>normDate(r?.holiday_date||r?.date));
  }

  async function fetchPaged(makeQuery){
    const rows=[];
    for(let from=0,guard=0;guard<100;from+=PAGE_SIZE,guard++){
      const result=await makeQuery(from,from+PAGE_SIZE-1);
      if(result?.error)throw result.error;
      const page=Array.isArray(result?.data)?result.data:[];
      rows.push(...page);
      if(page.length<PAGE_SIZE)break;
    }
    return rows;
  }
  async function fetchAssignments(client,startDate,endDate){
    return fetchPaged((from,to)=>{
      let q=client.from('roster_assignments').select('id,duty_date,duty_code,staff_id').not('staff_id','is',null).lte('duty_date',endDate).order('duty_date').range(from,to);
      if(startDate)q=q.gte('duty_date',startDate);
      return q;
    });
  }
  async function fetchHolidays(client,startDate,endDate){
    return fetchPaged((from,to)=>{
      let q=client.from('public_holidays').select('holiday_date,title').lte('holiday_date',endDate).order('holiday_date').range(from,to);
      if(startDate)q=q.gte('holiday_date',startDate);
      return q;
    });
  }
  async function fetchTrades(client){
    return fetchPaged((from,to)=>client.from('roster_trade_requests')
      .select('id,status,from_assignment_id,to_assignment_id,requester_id,receiver_id,note,updated_at,confirmed_at,created_at')
      .eq('status','completed').order('created_at').range(from,to));
  }
  function invalidateHistory(){
    history.assignments=[];history.trades=[];history.holidays=[];history.loadedThrough='';history.ready=false;history.loading=null;history.error='';
  }
  async function ensureHistoryData(key){
    const safe=monthKeySafe(key),endDate=monthEnd(safe);
    if(history.ready&&history.loadedThrough>=endDate)return history;
    if(history.loading)return history.loading;
    const client=DB();
    if(!client){history.error='ไม่พบการเชื่อมต่อฐานข้อมูล';return history;}
    const startDate=history.ready&&history.loadedThrough?nextDate(history.loadedThrough):'';
    history.loading=(async()=>{
      try{
        const [newAssignments,newHolidays,newTrades]=await Promise.all([
          fetchAssignments(client,startDate,endDate),
          fetchHolidays(client,startDate,endDate),
          fetchTrades(client)
        ]);
        history.assignments=mergeUnique([...(history.assignments||[]),...newAssignments],r=>normId(r?.id)||`${normDate(r?.duty_date)}|${r?.duty_code}|${normId(r?.staff_id)}`);
        history.holidays=mergeUnique([...(history.holidays||[]),...newHolidays],r=>normDate(r?.holiday_date));
        history.trades=completedTrades(newTrades);
        history.loadedThrough=endDate;
        history.ready=true;
        history.error='';
        mergeHolidaysIntoState(history.holidays);
      }catch(error){
        history.error=error?.message||String(error||'โหลดข้อมูลสะสมไม่สำเร็จ');
        console.warn(`${VERSION}: history`,error);
      }finally{
        history.loading=null;
        setTimeout(()=>{try{if(['scheduler','schedule'].includes(S()?.page))window.renderPage?.();}catch(_){}},0);
      }
      return history;
    })();
    return history.loading;
  }

  function earliestMonth(rows,fallback){
    const keys=(rows||[]).map(r=>normDate(r?.duty_date).slice(0,7)).filter(k=>/^\d{4}-\d{2}$/.test(k)).sort();
    return keys[0]||fallback;
  }
  function firstMonthByStaff(rows){
    const map=new Map();
    (rows||[]).forEach(row=>{
      const id=normId(row?.staff_id),month=normDate(row?.duty_date).slice(0,7);
      if(!id||!/^\d{4}-\d{2}$/.test(month))return;
      if(!map.has(id)||month<map.get(id))map.set(id,month);
    });
    return map;
  }
  function eligibleFrom(person,field,firstMap,safe){
    const reset=resetMonth(person,field);
    if(reset)return reset;
    return firstMap.get(normId(person?.id))||safe;
  }
  function availableHistory(key,selectedAssignments){
    const safe=monthKeySafe(key),end=monthEnd(safe);
    const source=history.ready?history.assignments.filter(r=>normDate(r?.duty_date)<=end):(S()?.rosterAssignments||[]).filter(r=>normDate(r?.duty_date)<=end);
    const current=mergeSelectedMonth(source,selectedAssignments,safe);
    const trades=history.ready?history.trades:completedTrades(S()?.tradeRequests||[]);
    return{current,trades,baseline:reconstructBaseline(current,trades)};
  }
  function buildBalanceData(staffList,assignments,key){
    const safe=monthKeySafe(key),people=currentStaffList(staffList),data=availableHistory(safe,assignments);
    const globalStart=earliestMonth(data.baseline,safe),months=monthsBetween(globalStart,safe);
    const currentByMonth=new Map(),baseByMonth=new Map();
    months.forEach(month=>{
      const currentRows=data.current.filter(r=>normDate(r?.duty_date).startsWith(month)&&r?.staff_id);
      const baseRows=data.baseline.filter(r=>normDate(r?.duty_date).startsWith(month)&&r?.staff_id);
      currentByMonth.set(month,{rows:currentRows,stats:calcStats(currentRows)});
      baseByMonth.set(month,{rows:baseRows,stats:calcStats(baseRows)});
    });
    const firstMap=firstMonthByStaff(data.baseline);
    const selectedCurrent=currentByMonth.get(safe)||{rows:[],stats:{}},selectedBase=baseByMonth.get(safe)||{rows:[],stats:{}};
    const groupNames=['MT','เคิก'].filter(label=>people.some(p=>groupLabel(p)===label));
    const groupAverages=new Map();
    months.forEach(month=>{
      const pack=baseByMonth.get(month)||{rows:[],stats:{}};const values={};
      groupNames.forEach(label=>{
        const groupPeople=people.filter(p=>groupLabel(p)===label&&!isLongLeave(p));
        const dutyEligible=groupPeople.filter(p=>month===safe||month>=eligibleFrom(p,'balance_reset_at',firstMap,safe));
        const holidayEligible=groupPeople.filter(p=>month===safe||month>=eligibleFrom(p,'holiday_balance_reset_at',firstMap,safe));
        const units=dutyEligible.map(p=>Number(pack.stats[normId(p.id)]?.units||0));
        const dayValues=holidayEligible.map(p=>daysOff(p.id,month,pack.rows));
        values[label]={
          units:units.length?units.reduce((a,c)=>a+c,0)/units.length:0,
          days:dayValues.length?dayValues.reduce((a,c)=>a+c,0)/dayValues.length:0
        };
      });
      groupAverages.set(month,values);
    });
    const groups=groupNames.map(label=>{
      const groupPeople=people.filter(p=>groupLabel(p)===label),selectedAvg=groupAverages.get(safe)?.[label]||{units:0,days:0};
      const rows=groupPeople.map(person=>{
        const id=normId(person.id),currentStat=selectedCurrent.stats[id]||{},baseStat=selectedBase.stats[id]||{},excluded=isLongLeave(person);
        const dutyReset=resetMonth(person,'balance_reset_at'),holidayReset=resetMonth(person,'holiday_balance_reset_at');
        const dutyStart=eligibleFrom(person,'balance_reset_at',firstMap,safe),holidayStart=eligibleFrom(person,'holiday_balance_reset_at',firstMap,safe);
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
        return{person,excluded,current:{total:Number(currentStat.total||0),units:Number(currentStat.units||0),hours:Number(currentStat.hours||0),pay:Number(currentStat.pay||0),days:currentDays},fixed:{gap,carry,cumulative,holidayGap,holidayCarry,holidayCumulative,counts,dutyReset,holidayReset,status,tone}};
      });
      return{label,average:Number(selectedAvg.units||0),rows};
    });
    return{key:safe,groups,startKey:globalStart};
  }
  function cumulativeCell(person,value,type){
    const bg=staffColorSafe(person),fg=textColorSafe(bg);
    return `<td class="v336-staff-cumulative v336-${esc(type)}" style="--v336-staff-bg:${esc(bg)};--v336-staff-fg:${esc(fg)};background:${esc(bg)};color:${esc(fg)}" title="ยอดสะสมของ ${esc(person?.nickname||person?.full_name||'เจ้าหน้าที่')}"><b>${fmt(value)}</b></td>`;
  }
  function loadingHtml(){
    const message=history.error?`โหลดข้อมูลสะสมไม่สำเร็จ: ${history.error}`:'กำลังคำนวณเวรสะสมและวันหยุดสะสมจากทุกเดือน กรุณารอสักครู่…';
    return `<div class="notice ${history.error?'danger-notice':'soft-notice'} v336-balance-loading"><b>${esc(message)}</b></div>`;
  }
  function adminTable(data){
    return `<div class="clean-balance-dashboard grouped-balance-dashboard v278-cumulative-dashboard v298-baseline-balance v336-continuous-balance">${data.groups.map(group=>`<section class="balance-group-section"><div class="section-title balance-group-title"><h3>กลุ่ม ${esc(group.label)}</h3><span>${badgeHtml(`ค่าเฉลี่ยเดือนนี้ ${group.average.toFixed(1)} หน่วยเวร`,'blue')}</span></div><div class="table-wrap v278-balance-table-wrap"><table class="clean-balance-table v278-balance-table"><thead><tr><th>เจ้าหน้าที่</th><th>เวรรวม</th><th>หน่วยเวร</th><th>ชั่วโมงรวม</th><th>เงินประมาณ</th><th>Quota Gap</th><th>OT Balance ยกมา</th><th class="v336-cumulative-head">เวรสะสมเดือนนี้</th><th>วันหยุดเดือนนี้</th><th class="v336-cumulative-head">วันหยุดสะสมเดือนนี้</th><th>ชบด1</th><th>ชบด2</th><th>ชบด3</th><th>ช3A</th><th>ช3B</th><th>ช4</th><th>ช9</th><th class="v279-pair-column">ดูคู่เวร</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${group.rows.map(row=>{
      const f=row.fixed,c=row.current,id=normId(row.person.id),dutyReset=f.dutyReset===data.key,holidayReset=f.holidayReset===data.key;
      return `<tr class="${row.excluded?'v278-exempt-row':''}"><td>${staffPillHtml(row.person)}</td><td>${c.total}</td><td>${c.units.toFixed(1)}</td><td>${c.hours.toFixed(1)}</td><td>${Math.round(c.pay).toLocaleString()}</td><td class="${f.gap>0.5?'v278-positive':f.gap<-0.5?'v278-negative':''}">${fmt(f.gap)}</td><td class="${f.carry>0.5?'v278-positive':f.carry<-0.5?'v278-negative':''}">${fmt(f.carry)}</td>${cumulativeCell(row.person,f.cumulative,'duty')}<td>${c.days}</td>${cumulativeCell(row.person,f.holidayCumulative,'holiday')}<td>${f.counts.chbd1}</td><td>${f.counts.chbd2}</td><td>${f.counts.chbd3}</td><td>${f.counts.ch3a}</td><td>${f.counts.ch3b}</td><td>${f.counts.ch4}</td><td>${f.counts.ch9}</td><td class="v279-pair-column"><button type="button" class="tiny-btn soft v279-pair-button" data-v279-duty-pair="${esc(id)}" data-v279-month="${esc(data.key)}">ดูคู่เวร</button></td><td>${badgeHtml(f.status,f.tone)}${f.dutyReset?`<small class="v278-reset-note">เวรเริ่ม ${esc(f.dutyReset)}</small>`:''}${f.holidayReset?`<small class="v278-reset-note">วันหยุดเริ่ม ${esc(f.holidayReset)}</small>`:''}</td><td><div class="v278-action-stack"><button type="button" class="tiny-btn ${dutyReset?'danger':'warning'}" data-v277-balance-reset="${esc(id)}" data-v277-month="${esc(data.key)}" data-v277-action="${dutyReset?'undo':'reset'}">${dutyReset?'ยกเลิกรีเซ็ตเวร':'เริ่มนับเวรใหม่เดือนนี้'}</button><button type="button" class="tiny-btn ${holidayReset?'danger':'soft'}" data-v278-holiday-reset="${esc(id)}" data-v278-month="${esc(data.key)}" data-v278-action="${holidayReset?'undo':'reset'}">${holidayReset?'ยกเลิกรีเซ็ตวันหยุด':'เริ่มนับวันหยุดใหม่เดือนนี้'}</button></div></td></tr>`;
    }).join('')}</tbody></table></div></section>`).join('')}</div>`;
  }
  function staffTable(data){
    return `<div class="clean-balance-dashboard grouped-balance-dashboard v265-balance-dashboard v298-baseline-balance v336-continuous-balance">${data.groups.map(group=>`<section class="balance-group-section v265-balance-group"><div class="section-title balance-group-title"><h3>กลุ่ม ${esc(group.label)}</h3><span>${badgeHtml(`ค่าเฉลี่ย ${group.average.toFixed(1)} หน่วยเวร`,'blue')}</span></div><div class="table-wrap v265-balance-wrap"><table class="clean-balance-table v265-balance-table"><thead><tr><th>เจ้าหน้าที่</th><th>เวรรวม</th><th>หน่วยเวร</th><th>ชั่วโมงรวม</th><th>เงินประมาณ</th><th>Quota Gap</th><th class="v336-cumulative-head">เวรสะสมเดือนนี้</th><th class="v336-cumulative-head">วันหยุดสะสมเดือนนี้</th><th>ชบด1</th><th>ชบด2</th><th>ชบด3</th><th>ช3A</th><th>ช3B</th><th>ช4</th><th>ช9</th><th>สถานะ</th></tr></thead><tbody>${group.rows.map(row=>{const f=row.fixed,c=row.current;return `<tr><td>${staffPillHtml(row.person)}</td><td>${c.total}</td><td>${c.units.toFixed(1)}</td><td>${c.hours.toFixed(1)}</td><td>${Math.round(c.pay).toLocaleString()}</td><td>${fmt(f.gap)}</td>${cumulativeCell(row.person,f.cumulative,'duty')}${cumulativeCell(row.person,f.holidayCumulative,'holiday')}<td>${f.counts.chbd1}</td><td>${f.counts.chbd2}</td><td>${f.counts.chbd3}</td><td>${f.counts.ch3a}</td><td>${f.counts.ch3b}</td><td>${f.counts.ch4}</td><td>${f.counts.ch9}</td><td>${badgeHtml(f.status,f.tone)}</td></tr>`;}).join('')}</tbody></table></div></section>`).join('')}</div>`;
  }

  const previousRender=window.renderBalanceDashboard||(typeof renderBalanceDashboard==='function'?renderBalanceDashboard:null);
  const renderV336=function renderBalanceDashboardV336(staffList,assignments,key){
    const safe=monthKeySafe(key||S()?.monthKey);
    if(!history.ready){ensureHistoryData(safe);return loadingHtml();}
    if(history.loadedThrough<monthEnd(safe)){ensureHistoryData(safe);return loadingHtml();}
    try{const data=buildBalanceData(staffList,assignments,safe);return isAdminSafe()&&S()?.page==='scheduler'?adminTable(data):staffTable(data);}catch(error){console.error(`${VERSION}: render`,error);return previousRender?previousRender.apply(this,arguments):'<div class="empty-state">คำนวณสมดุลเวรไม่สำเร็จ</div>';}
  };
  window.renderBalanceDashboard=renderV336;try{renderBalanceDashboard=renderV336;}catch(_){}

  const showFairnessV336=function(){
    const key=monthKeySafe(S()?.monthKey);let assignments=[];let staffList=[];
    try{assignments=getAssignmentsForMonth(key).filter(r=>r?.staff_id);}catch(_){assignments=(S()?.rosterAssignments||[]).filter(r=>normDate(r?.duty_date).startsWith(key)&&r?.staff_id);}
    try{staffList=scheduleStaffList();}catch(_){staffList=(S()?.staff||[]).filter(isRosterPerson);}
    if(!history.ready||history.loadedThrough<monthEnd(key)){ensureHistoryData(key);try{showModal(`<h2>ตรวจสมดุลการกระจายเวร ${esc(key)}</h2>${loadingHtml()}`,{large:true});}catch(_){}return;}
    try{showModal(`<h2>ตรวจสมดุลการกระจายเวร ${esc(key)}</h2>${staffTable(buildBalanceData(staffList,assignments,key))}`,{large:true});}catch(error){console.warn(`${VERSION}: fairness modal`,error);}
  };
  window.showFairness=showFairnessV336;try{showFairness=showFairnessV336;}catch(_){}

  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('[data-save-roster],[data-publish-roster],[data-trade-status],[data-trade-apply],[data-trade-delete]');
    if(!target)return;
    setTimeout(()=>{invalidateHistory();try{if(S()?.scheduleMobileView==='balance')window.renderPage?.();}catch(_){}},1800);
  },true);

  const style=document.createElement('style');
  style.id='v336-continuous-balance-style';
  style.textContent=`
    .v336-continuous-balance .v336-cumulative-head{background:#e0f2fe!important;color:#0c4a6e!important;font-weight:900;box-shadow:inset 0 -3px 0 #38bdf8}
    .v336-continuous-balance td.v336-staff-cumulative{background:var(--v336-staff-bg)!important;color:var(--v336-staff-fg)!important;text-align:center;font-weight:900;min-width:92px;box-shadow:inset 0 0 0 2px rgba(15,23,42,.16)}
    .v336-continuous-balance td.v336-staff-cumulative b{font-size:1.05em;text-shadow:0 1px 1px rgba(255,255,255,.2)}
    .v336-balance-loading{margin:12px 0;min-height:70px;display:flex;align-items:center;justify-content:center;text-align:center}
    @media(max-width:760px){.v336-continuous-balance td.v336-staff-cumulative{min-width:82px}}
  `;
  document.head.appendChild(style);

  window.cnmiV336ContinuousBalance={
    version:VERSION,
    invalidate:invalidateHistory,
    ensureHistory:ensureHistoryData,
    _test:{buildBalanceData,reconstructBaseline,monthsBetween,eligibleFrom,firstMonthByStaff,availableHistory,history}
  };
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v336-continuous-balance-staff-color.js", error); }
;

/* Original source: patch-v337-daily-position-single-save-publish.js */
try {
/* CNMI Staff Planner V337 — Daily position single Save + Publish
   Scope: daily daytime-position page only.
   - Replaces the confusing two-step Save / Publish flow with one button.
   - Synchronizes desktop and mobile dropdown copies before saving.
   - Blocks an accidental all-blank overwrite when the baseline still has staff.
   - Uses the existing V335/V261 authoritative save flow; no new read loop or egress-heavy loader.
*/
(function(){
  'use strict';
  const VERSION='V337_DAILY_POSITION_SINGLE_SAVE_PUBLISH';
  if(window.__CNMI_V337_DAILY_POSITION_SINGLE_SAVE_PUBLISH__)return;
  window.__CNMI_V337_DAILY_POSITION_SINGLE_SAVE_PUBLISH__=true;

  let queued=false;
  let saving=false;

  function S(){try{return window.state||state||null;}catch(_){return window.state||null;}}
  function isDaily(){return String(S()?.page||'')==='positions';}
  function text(value){return String(value==null?'':value).trim();}
  function toast(message,tone){
    try{if(typeof window.showToast==='function')return window.showToast(message,tone?{tone}:undefined);}catch(_){}
    try{window.alert(message);}catch(_){console.info(message);}
  }
  function visible(control){
    if(!control||control.disabled)return false;
    try{
      const style=window.getComputedStyle(control);
      if(style.display==='none'||style.visibility==='hidden')return false;
      if(control.closest('[hidden],.hidden'))return false;
      return control.getClientRects().length>0;
    }catch(_){return true;}
  }
  function identity(select){
    return [
      text(select?.dataset?.positionCode),
      text(select?.dataset?.positionZone),
      text(select?.dataset?.positionBreak),
      text(select?.dataset?.positionRule),
      text(select?.dataset?.positionJob),
      text(select?.dataset?.positionRow)
    ].join('|');
  }
  function controlsByIdentity(root=document){
    const groups=new Map();
    root.querySelectorAll?.('select[data-position-row]')?.forEach(select=>{
      const key=identity(select);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(select);
    });
    return groups;
  }
  function changedAt(control){
    return Math.max(Number(control?.dataset?.v337ChangedAt||0),Number(control?.dataset?.v261ChangedAt||0));
  }
  function chooseControl(list){
    const rows=Array.from(list||[]);
    if(!rows.length)return null;
    const active=rows.find(row=>row===document.activeElement);
    if(active)return active;
    const changed=rows.slice().sort((a,b)=>changedAt(b)-changedAt(a))[0];
    if(changed&&changedAt(changed)>0)return changed;
    return rows.find(visible)||rows.find(row=>text(row.value))||rows[0];
  }
  function syncGroup(list,source){
    const chosen=source||chooseControl(list);
    if(!chosen)return '';
    const value=String(chosen.value||'');
    const stamp=String(Date.now());
    Array.from(list||[]).forEach(control=>{
      const exists=Array.from(control.options||[]).some(option=>String(option.value)===value);
      if(exists||value==='')control.value=value;
      control.dataset.v337ChangedAt=stamp;
      control.dataset.v261ChangedAt=stamp;
    });
    return value;
  }
  function synchronizeDailySelections(){
    const page=document.querySelector('#pageContent .v225-positions-page,#pageContent .v226-positions-page')||document;
    const groups=controlsByIdentity(page);
    const snapshot=[];
    groups.forEach((list,key)=>snapshot.push({key,value:syncGroup(list)}));
    return snapshot;
  }
  function baselineAssignedCount(){
    const rows=window.__CNMI_V226_DAILY_POSITION_ROWS__||window.__CNMI_V225_DAILY_POSITION_ROWS__||[];
    return Array.isArray(rows)?rows.filter(row=>text(row?._planned_staff_id||row?.staff_id)).length:0;
  }
  function assignedCount(snapshot){return (snapshot||[]).filter(row=>text(row.value)).length;}

  function enhance(){
    if(!isDaily())return;
    const page=document.querySelector('#pageContent .v225-positions-page,#pageContent .v226-positions-page');
    if(!page)return;
    const toolbar=page.querySelector('.v225-position-toolbar,.toolbar');
    if(toolbar){
      const oldSave=toolbar.querySelector('[data-save-positions]');
      const oldPublish=toolbar.querySelector('[data-publish-positions]');
      let single=toolbar.querySelector('[data-v337-save-publish]');
      if(!single){
        single=document.createElement('button');
        single.type='button';
        single.className='primary-btn v337-save-publish-btn';
        single.setAttribute('data-v337-save-publish','');
        single.textContent='บันทึกและประกาศให้ Staff เห็น';
        if(oldSave)oldSave.replaceWith(single);
        else if(oldPublish)oldPublish.insertAdjacentElement('beforebegin',single);
        else toolbar.appendChild(single);
      }
      oldSave?.remove();
      oldPublish?.remove();
    }
    const note=page.querySelector('.v225-position-note');
    if(note)note.innerHTML='<b>วิธีใช้:</b> เลือกหรือปรับคนในแต่ละตำแหน่ง แล้วกด “บันทึกและประกาศให้ Staff เห็น” เพียงครั้งเดียว ระบบจะบันทึกและเผยแพร่พร้อมกัน';
    const heading=page.querySelector('.v322-daily-change-summary h3');
    if(heading)heading.textContent='ตรวจสอบก่อนบันทึก: แผนตั้งต้นเทียบกับวันนี้';
    page.dataset.v337SingleSavePublish='1';
  }
  function queueEnhance(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;enhance();});
  }

  document.addEventListener('change',event=>{
    const source=event.target?.closest?.('select[data-position-row]');
    if(!source||!isDaily())return;
    source.dataset.v337ChangedAt=String(Date.now());
    const page=source.closest('.v225-positions-page,.v226-positions-page')||document;
    const group=controlsByIdentity(page).get(identity(source));
    if(group)syncGroup(group,source);
    try{window.cnmiV322?.queueEnhance?.();}catch(_){}
  },true);

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('[data-v337-save-publish]');
    if(!button)return;
    event.preventDefault();
    event.stopPropagation();
    if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();
    if(saving){toast('ระบบกำลังบันทึกและประกาศ กรุณารอสักครู่');return;}
    (async()=>{
      const snapshot=synchronizeDailySelections();
      const baseline=baselineAssignedCount();
      const assigned=assignedCount(snapshot);
      if(baseline>0&&assigned===0){
        toast('ระบบหยุดการบันทึก เพราะพบว่ารายชื่อทุกตำแหน่งกลายเป็นว่าง กรุณารีเฟรชหน้าแล้วลองใหม่','error');
        return;
      }
      const publish=window.publishPositionsForDay||(typeof publishPositionsForDay==='function'?publishPositionsForDay:null);
      if(typeof publish!=='function'){
        toast('ไม่พบคำสั่งบันทึกตำแหน่ง กรุณารีเฟรชหน้า','error');
        return;
      }
      saving=true;
      button.disabled=true;
      button.setAttribute('aria-busy','true');
      try{
        await publish();
      }catch(error){
        console.error(`${VERSION}: save/publish failed`,error);
        toast(`บันทึกไม่สำเร็จ: ${error?.message||error}`,'error');
      }finally{
        saving=false;
        queueEnhance();
      }
    })();
  },true);

  function install(){
    const root=document.getElementById('pageContent');
    if(root&&!root.__v337Observer){
      const observer=new MutationObserver(queueEnhance);
      observer.observe(root,{childList:true,subtree:true});
      root.__v337Observer=observer;
    }
    queueEnhance();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();

  window.cnmiV337={version:VERSION,enhance,synchronizeDailySelections};
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v337-daily-position-single-save-publish.js", error); }
;

/* Original source: patch-v338-partial-trade-current-balance-fix.js */
try {
/* CNMI Staff Planner V338
   Fix current monthly duty/day-off figures after partial shift sales.

   Business rules preserved:
   - Current columns reflect the people who actually work after completed sales,
     including 8/16-hour partial transfers.
   - Baseline fairness columns (Quota Gap, carry, cumulative balances, duty-type
     counts and status) remain based on the Admin's original roster before sales.
   - No new database table/RPC and no extra API request.
*/
(function(){
  'use strict';
  const VERSION='V338_PARTIAL_TRADE_CURRENT_BALANCE_FIX';
  if(window.__CNMI_V338_PARTIAL_TRADE_CURRENT_BALANCE_FIX__)return;
  window.__CNMI_V338_PARTIAL_TRADE_CURRENT_BALANCE_FIX__=true;

  function S(){try{return state||window.state||null;}catch(_){return window.state||null;}}
  function esc(v){try{return escapeHtml(v==null?'':String(v));}catch(_){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}}
  function normId(v){return String(v==null?'':v);}
  function normDate(v){try{return normalizeDateKey(v);}catch(_){return String(v||'').slice(0,10);}}
  function monthKeySafe(v){return /^\d{4}-\d{2}$/.test(String(v||''))?String(v):new Date().toISOString().slice(0,7);}
  function monthEnd(key){const y=Number(key.slice(0,4)),m=Number(key.slice(5,7));return `${key}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;}
  function isAdminSafe(){try{return !!isAdmin();}catch(_){return String(S()?.profile?.role||'').toLowerCase()==='admin';}}
  function badgeHtml(text,tone){try{return badge(text,tone);}catch(_){return `<span class="badge ${esc(tone||'')}">${esc(text)}</span>`;}}
  function staffPillHtml(person){try{return staffPill(person);}catch(_){return `<b>${esc(person?.nickname||person?.full_name||'-')}</b>`;}}
  function staffColorSafe(person){try{return staffColor(person);}catch(_){return person?.staff_color||person?.color||'#e2e8f0';}}
  function textColorSafe(color){try{return textColorFor(color);}catch(_){return '#0f172a';}}
  function fmt(n){const x=Number(n||0);return Math.abs(x)<0.05?'0.0':x.toFixed(1);}
  function completedTrades(rows){return (rows||[]).filter(r=>String(r?.status||'')==='completed'&&r?.from_assignment_id&&r?.requester_id&&r?.receiver_id);}
  function tradeTime(row){return row?.updated_at||row?.confirmed_at||row?.created_at||'';}
  function mergeTrades(rows){
    const map=new Map();
    (rows||[]).forEach(row=>{
      const key=normId(row?.id)||`${normId(row?.from_assignment_id)}|${normId(row?.requester_id)}|${normId(row?.receiver_id)}|${String(row?.note||'')}|${tradeTime(row)}`;
      if(key)map.set(key,row);
    });
    return completedTrades([...map.values()]);
  }
  function tradeApi(){return window.cnmiTradeSegmentsV217||null;}
  function partFromRequest(request,assignment){
    try{const api=tradeApi();if(api?.partFromNote)return api.partFromNote(request?.note,assignment);}catch(_){}
    return String(request?.note||'').match(/\[SELL_PART=([a-z_]+)\]/i)?.[1]?.toLowerCase()||'';
  }
  function operationalFullHours(assignment){
    try{const h=Number(shiftPaymentHoursForCode(assignment?.duty_date,assignment?.duty_code));if(Number.isFinite(h)&&h>0)return h;}catch(_){}
    try{const h=Number(dutyHoursForCode(assignment?.duty_date,assignment?.duty_code));if(Number.isFinite(h)&&h>0)return h;}catch(_){}
    try{const m=dutyMetrics(assignment,assignment?.staff_id);const h=Number(m?.hours);if(Number.isFinite(h)&&h>0)return h;}catch(_){}
    return 8;
  }
  function soldHours(request,assignment){
    const part=partFromRequest(request,assignment);
    try{const api=tradeApi();if(api?.partHours){const h=Number(api.partHours(part,assignment));if(Number.isFinite(h)&&h>=0)return h;}}catch(_){}
    const marker=Number(String(request?.note||'').match(/\[SELL_HOURS=(\d+(?:\.\d+)?)\]/i)?.[1]||0);
    return marker>0?Math.min(marker,operationalFullHours(assignment)):operationalFullHours(assignment);
  }
  function isWholeTrade(request,assignment){
    const part=partFromRequest(request,assignment);
    try{const api=tradeApi();if(api?.coversWholeSlot)return !!api.coversWholeSlot(part,assignment);}catch(_){}
    return soldHours(request,assignment)>=operationalFullHours(assignment)-0.01;
  }
  function metricsFor(assignment,staffId){
    try{
      const m=dutyMetrics(assignment,staffId)||{};
      return {hours:Number(m.hours||0),units:Number(m.units||0),pay:Number(m.pay||0)};
    }catch(_){return {hours:0,units:0,pay:0};}
  }
  function emptyStat(){return {total:0,units:0,hours:0,pay:0,dutyDates:new Set()};}
  function statFor(map,staffId){
    const id=normId(staffId);
    if(!map.has(id))map.set(id,emptyStat());
    return map.get(id);
  }
  function addPortion(map,assignment,staffId,ratio,countAsEntry=true){
    const id=normId(staffId);if(!id||ratio<=0.0001)return;
    const m=metricsFor(assignment,id),stat=statFor(map,id),safeRatio=Math.max(0,Math.min(1,Number(ratio||0)));
    stat.total+=countAsEntry?1:0;
    stat.units+=m.units*safeRatio;
    stat.hours+=m.hours*safeRatio;
    stat.pay+=m.pay*safeRatio;
    const date=normDate(assignment?.duty_date);if(date)stat.dutyDates.add(date);
  }
  function effectiveCurrentStats(assignments,trades,key){
    const safe=monthKeySafe(key),rows=(assignments||[]).filter(row=>row?.staff_id&&normDate(row?.duty_date).startsWith(safe));
    const completed=mergeTrades(trades);
    const byAssignment=new Map();
    completed.forEach(request=>{
      const id=normId(request?.from_assignment_id);if(!id)return;
      if(!byAssignment.has(id))byAssignment.set(id,[]);
      byAssignment.get(id).push(request);
    });
    const stats=new Map();
    rows.forEach(assignment=>{
      const requests=(byAssignment.get(normId(assignment?.id))||[]).filter(request=>!isWholeTrade(request,assignment));
      if(!requests.length){addPortion(stats,assignment,assignment.staff_id,1,true);return;}
      const fullHours=Math.max(0.01,operationalFullHours(assignment));
      let soldRatio=0;
      requests.slice().sort((a,b)=>String(tradeTime(a)).localeCompare(String(tradeTime(b)))).forEach(request=>{
        const ratio=Math.max(0,Math.min(1,soldHours(request,assignment)/fullHours));
        if(ratio<=0)return;
        soldRatio+=ratio;
        addPortion(stats,assignment,request.receiver_id,ratio,true);
      });
      const remainRatio=Math.max(0,1-Math.min(1,soldRatio));
      if(remainRatio>0.0001)addPortion(stats,assignment,assignment.staff_id,remainRatio,true);
    });
    return stats;
  }
  function monthDatesSafe(key){
    try{return scheduleMonthDates(key);}catch(_){const y=Number(key.slice(0,4)),m=Number(key.slice(5,7)),last=new Date(y,m,0).getDate();return Array.from({length:last},(_,i)=>`${key}-${String(i+1).padStart(2,'0')}`);}
  }
  function isCalendarOff(date){
    try{return !!(isWeekend(date)||isHolidayDate(date));}catch(_){const d=new Date(`${date}T12:00:00`).getDay();return d===0||d===6;}
  }
  function currentDaysOff(staffId,key,stats){
    const dutyDates=stats.get(normId(staffId))?.dutyDates||new Set();
    return monthDatesSafe(key).reduce((sum,date)=>sum+(isCalendarOff(date)&&!dutyDates.has(normDate(date))?1:0),0);
  }
  function currentTrades(){
    const apiHistory=window.cnmiV336ContinuousBalance?._test?.history?.trades||[];
    const stateTrades=S()?.tradeRequests||[];
    return mergeTrades([...(apiHistory||[]),...(stateTrades||[])]);
  }
  function correctedData(staffList,assignments,key){
    const baseBuilder=window.cnmiV336ContinuousBalance?._test?.buildBalanceData;
    if(typeof baseBuilder!=='function')throw new Error('ไม่พบตัวคำนวณ V336');
    const safe=monthKeySafe(key),data=baseBuilder(staffList,assignments,safe),effective=effectiveCurrentStats(assignments,currentTrades(),safe);
    data.groups.forEach(group=>group.rows.forEach(row=>{
      const stat=effective.get(normId(row.person?.id))||emptyStat();
      row.current={
        total:Number(stat.total||0),
        units:Number(stat.units||0),
        hours:Number(stat.hours||0),
        pay:Number(stat.pay||0),
        days:row.excluded?0:currentDaysOff(row.person?.id,safe,effective)
      };
    }));
    return data;
  }
  function cumulativeCell(person,value,type){
    const bg=staffColorSafe(person),fg=textColorSafe(bg);
    return `<td class="v336-staff-cumulative v336-${esc(type)}" style="--v336-staff-bg:${esc(bg)};--v336-staff-fg:${esc(fg)};background:${esc(bg)};color:${esc(fg)}" title="ยอดสะสมตามแผนตั้งต้นของ ${esc(person?.nickname||person?.full_name||'เจ้าหน้าที่')}"><b>${fmt(value)}</b></td>`;
  }
  function balanceNote(){
    return `<div class="notice soft-notice v338-balance-rule-note"><b>การอ่านตาราง:</b> เวรรวม–เงินประมาณและวันหยุดเดือนนี้เป็นข้อมูลปัจจุบันหลังซื้อขายเวร ส่วน Quota Gap ยอดยกมา ยอดสะสม จำนวนเวรรายประเภท และสถานะ ยึดแผนตั้งต้นที่ Admin จัด</div>`;
  }
  function loadingHtml(){
    const history=window.cnmiV336ContinuousBalance?._test?.history||{};
    const message=history.error?`โหลดข้อมูลสะสมไม่สำเร็จ: ${history.error}`:'กำลังคำนวณเวรสะสมและวันหยุดสะสมจากทุกเดือน กรุณารอสักครู่…';
    return `<div class="notice ${history.error?'danger-notice':'soft-notice'} v336-balance-loading"><b>${esc(message)}</b></div>`;
  }
  function adminTable(data){
    return `${balanceNote()}<div class="clean-balance-dashboard grouped-balance-dashboard v278-cumulative-dashboard v298-baseline-balance v336-continuous-balance v338-current-trade-balance">${data.groups.map(group=>`<section class="balance-group-section"><div class="section-title balance-group-title"><h3>กลุ่ม ${esc(group.label)}</h3><span>${badgeHtml(`ค่าเฉลี่ยตั้งต้นเดือนนี้ ${group.average.toFixed(1)} หน่วยเวร`,'blue')}</span></div><div class="table-wrap v278-balance-table-wrap"><table class="clean-balance-table v278-balance-table"><thead><tr><th>เจ้าหน้าที่</th><th title="ปัจจุบันหลังซื้อขายเวร">เวรรวม</th><th title="ปัจจุบันหลังซื้อขายเวร">หน่วยเวร</th><th title="ปัจจุบันหลังซื้อขายเวร">ชั่วโมงรวม</th><th title="ปัจจุบันหลังซื้อขายเวร">เงินประมาณ</th><th>Quota Gap</th><th>OT Balance ยกมา</th><th class="v336-cumulative-head">เวรสะสมเดือนนี้</th><th title="ปัจจุบันหลังซื้อขายเวร รวมการรับซื้อเฉพาะช่วง">วันหยุดเดือนนี้</th><th class="v336-cumulative-head">วันหยุดสะสมเดือนนี้</th><th>ชบด1</th><th>ชบด2</th><th>ชบด3</th><th>ช3A</th><th>ช3B</th><th>ช4</th><th>ช9</th><th class="v279-pair-column">ดูคู่เวร</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${group.rows.map(row=>{
      const f=row.fixed,c=row.current,id=normId(row.person.id),dutyReset=f.dutyReset===data.key,holidayReset=f.holidayReset===data.key;
      return `<tr class="${row.excluded?'v278-exempt-row':''}"><td>${staffPillHtml(row.person)}</td><td>${Number(c.total||0)}</td><td>${Number(c.units||0).toFixed(1)}</td><td>${Number(c.hours||0).toFixed(1)}</td><td>${Math.round(Number(c.pay||0)).toLocaleString()}</td><td class="${f.gap>0.5?'v278-positive':f.gap<-0.5?'v278-negative':''}">${fmt(f.gap)}</td><td class="${f.carry>0.5?'v278-positive':f.carry<-0.5?'v278-negative':''}">${fmt(f.carry)}</td>${cumulativeCell(row.person,f.cumulative,'duty')}<td>${Number(c.days||0)}</td>${cumulativeCell(row.person,f.holidayCumulative,'holiday')}<td>${f.counts.chbd1}</td><td>${f.counts.chbd2}</td><td>${f.counts.chbd3}</td><td>${f.counts.ch3a}</td><td>${f.counts.ch3b}</td><td>${f.counts.ch4}</td><td>${f.counts.ch9}</td><td class="v279-pair-column"><button type="button" class="tiny-btn soft v279-pair-button" data-v279-duty-pair="${esc(id)}" data-v279-month="${esc(data.key)}">ดูคู่เวร</button></td><td>${badgeHtml(f.status,f.tone)}${f.dutyReset?`<small class="v278-reset-note">เวรเริ่ม ${esc(f.dutyReset)}</small>`:''}${f.holidayReset?`<small class="v278-reset-note">วันหยุดเริ่ม ${esc(f.holidayReset)}</small>`:''}</td><td><div class="v278-action-stack"><button type="button" class="tiny-btn ${dutyReset?'danger':'warning'}" data-v277-balance-reset="${esc(id)}" data-v277-month="${esc(data.key)}" data-v277-action="${dutyReset?'undo':'reset'}">${dutyReset?'ยกเลิกรีเซ็ตเวร':'เริ่มนับเวรใหม่เดือนนี้'}</button><button type="button" class="tiny-btn ${holidayReset?'danger':'soft'}" data-v278-holiday-reset="${esc(id)}" data-v278-month="${esc(data.key)}" data-v278-action="${holidayReset?'undo':'reset'}">${holidayReset?'ยกเลิกรีเซ็ตวันหยุด':'เริ่มนับวันหยุดใหม่เดือนนี้'}</button></div></td></tr>`;
    }).join('')}</tbody></table></div></section>`).join('')}</div>`;
  }
  function staffTable(data){
    return `${balanceNote()}<div class="clean-balance-dashboard grouped-balance-dashboard v265-balance-dashboard v298-baseline-balance v336-continuous-balance v338-current-trade-balance">${data.groups.map(group=>`<section class="balance-group-section v265-balance-group"><div class="section-title balance-group-title"><h3>กลุ่ม ${esc(group.label)}</h3><span>${badgeHtml(`ค่าเฉลี่ยตั้งต้น ${group.average.toFixed(1)} หน่วยเวร`,'blue')}</span></div><div class="table-wrap v265-balance-wrap"><table class="clean-balance-table v265-balance-table"><thead><tr><th>เจ้าหน้าที่</th><th title="ปัจจุบันหลังซื้อขายเวร">เวรรวม</th><th title="ปัจจุบันหลังซื้อขายเวร">หน่วยเวร</th><th title="ปัจจุบันหลังซื้อขายเวร">ชั่วโมงรวม</th><th title="ปัจจุบันหลังซื้อขายเวร">เงินประมาณ</th><th>Quota Gap</th><th class="v336-cumulative-head">เวรสะสมเดือนนี้</th><th class="v336-cumulative-head">วันหยุดสะสมเดือนนี้</th><th>ชบด1</th><th>ชบด2</th><th>ชบด3</th><th>ช3A</th><th>ช3B</th><th>ช4</th><th>ช9</th><th>สถานะ</th></tr></thead><tbody>${group.rows.map(row=>{const f=row.fixed,c=row.current;return `<tr><td>${staffPillHtml(row.person)}</td><td>${Number(c.total||0)}</td><td>${Number(c.units||0).toFixed(1)}</td><td>${Number(c.hours||0).toFixed(1)}</td><td>${Math.round(Number(c.pay||0)).toLocaleString()}</td><td>${fmt(f.gap)}</td>${cumulativeCell(row.person,f.cumulative,'duty')}${cumulativeCell(row.person,f.holidayCumulative,'holiday')}<td>${f.counts.chbd1}</td><td>${f.counts.chbd2}</td><td>${f.counts.chbd3}</td><td>${f.counts.ch3a}</td><td>${f.counts.ch3b}</td><td>${f.counts.ch4}</td><td>${f.counts.ch9}</td><td>${badgeHtml(f.status,f.tone)}</td></tr>`;}).join('')}</tbody></table></div></section>`).join('')}</div>`;
  }

  const previousRender=window.renderBalanceDashboard||(typeof renderBalanceDashboard==='function'?renderBalanceDashboard:null);
  const renderV338=function renderBalanceDashboardV338(staffList,assignments,key){
    const safe=monthKeySafe(key||S()?.monthKey),v336=window.cnmiV336ContinuousBalance,history=v336?._test?.history;
    if(!v336||!history||typeof v336?._test?.buildBalanceData!=='function')return previousRender?previousRender.apply(this,arguments):'<div class="empty-state">ยังโหลดตัวคำนวณสมดุลเวรไม่ครบ</div>';
    if(!history.ready){v336.ensureHistory?.(safe);return loadingHtml();}
    if(String(history.loadedThrough||'')<monthEnd(safe)){v336.ensureHistory?.(safe);return loadingHtml();}
    try{const data=correctedData(staffList,assignments,safe);return isAdminSafe()&&S()?.page==='scheduler'?adminTable(data):staffTable(data);}catch(error){console.error(`${VERSION}: render`,error);return previousRender?previousRender.apply(this,arguments):'<div class="empty-state">คำนวณสมดุลเวรไม่สำเร็จ</div>';}
  };
  window.renderBalanceDashboard=renderV338;try{renderBalanceDashboard=renderV338;}catch(_){}

  const showFairnessV338=function(){
    const key=monthKeySafe(S()?.monthKey),v336=window.cnmiV336ContinuousBalance,history=v336?._test?.history;let assignments=[],staffList=[];
    try{assignments=getAssignmentsForMonth(key).filter(r=>r?.staff_id);}catch(_){assignments=(S()?.rosterAssignments||[]).filter(r=>normDate(r?.duty_date).startsWith(key)&&r?.staff_id);}
    try{staffList=scheduleStaffList();}catch(_){staffList=S()?.staff||[];}
    if(!history?.ready||String(history.loadedThrough||'')<monthEnd(key)){v336?.ensureHistory?.(key);try{showModal(`<h2>ตรวจสมดุลการกระจายเวร ${esc(key)}</h2>${loadingHtml()}`,{large:true});}catch(_){}return;}
    try{showModal(`<h2>ตรวจสมดุลการกระจายเวร ${esc(key)}</h2>${staffTable(correctedData(staffList,assignments,key))}`,{large:true});}catch(error){console.warn(`${VERSION}: fairness modal`,error);}
  };
  window.showFairness=showFairnessV338;try{showFairness=showFairnessV338;}catch(_){}

  const style=document.createElement('style');
  style.id='v338-partial-trade-current-balance-style';
  style.textContent=`
    .v338-balance-rule-note{margin:0 0 12px;line-height:1.55}
    .v338-current-trade-balance th[title]{text-decoration:underline dotted rgba(15,23,42,.35);text-underline-offset:3px}
  `;
  document.head.appendChild(style);

  window.cnmiV338PartialTradeBalance={version:VERSION,_test:{effectiveCurrentStats,currentDaysOff,soldHours,isWholeTrade,correctedData}};
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v338-partial-trade-current-balance-fix.js", error); }
;

/* Original source: patch-v339-thai-balance-label-holiday-carry.js */
try {
/* CNMI Staff Planner V339
   Make monthly balance headings easier to understand and show holiday carry-forward.
   - Remove the explanatory notice above MT/Clerk groups.
   - Use clear Thai labels instead of Quota Gap / OT Balance.
   - Show duty and holiday carry-forward separately from cumulative totals.
   - Keep V338 calculation rules; no new Supabase request and no SQL change.
*/
(function(){
  'use strict';
  const VERSION='V339_THAI_BALANCE_LABEL_HOLIDAY_CARRY';
  if(window.__CNMI_V339_THAI_BALANCE_LABEL_HOLIDAY_CARRY__)return;
  window.__CNMI_V339_THAI_BALANCE_LABEL_HOLIDAY_CARRY__=true;

  function S(){try{return state||window.state||null;}catch(_){return window.state||null;}}
  function esc(v){try{return escapeHtml(v==null?'':String(v));}catch(_){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}}
  function normId(v){return String(v==null?'':v);}
  function normDate(v){try{return normalizeDateKey(v);}catch(_){return String(v||'').slice(0,10);}}
  function monthKeySafe(v){return /^\d{4}-\d{2}$/.test(String(v||''))?String(v):new Date().toISOString().slice(0,7);}
  function monthEnd(key){const y=Number(key.slice(0,4)),m=Number(key.slice(5,7));return `${key}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;}
  function isAdminSafe(){try{return !!isAdmin();}catch(_){return String(S()?.profile?.role||'').toLowerCase()==='admin';}}
  function badgeHtml(text,tone){try{return badge(text,tone);}catch(_){return `<span class="badge ${esc(tone||'')}">${esc(text)}</span>`;}}
  function staffPillHtml(person){try{return staffPill(person);}catch(_){return `<b>${esc(person?.nickname||person?.full_name||'-')}</b>`;}}
  function staffColorSafe(person){try{return staffColor(person);}catch(_){return person?.staff_color||person?.color||'#e2e8f0';}}
  function textColorSafe(color){try{return textColorFor(color);}catch(_){return '#0f172a';}}
  function fmt(n){const x=Number(n||0);return Math.abs(x)<0.05?'0.0':x.toFixed(1);}
  function signedClass(v){const n=Number(v||0);return n>0.5?'v278-positive':n<-0.5?'v278-negative':'';}

  function cumulativeCell(person,value,type){
    const bg=staffColorSafe(person),fg=textColorSafe(bg);
    return `<td class="v336-staff-cumulative v336-${esc(type)}" style="--v336-staff-bg:${esc(bg)};--v336-staff-fg:${esc(fg)};background:${esc(bg)};color:${esc(fg)}" title="ยอดสะสมต่อเนื่องของ ${esc(person?.nickname||person?.full_name||'เจ้าหน้าที่')}"><b>${fmt(value)}</b></td>`;
  }
  function loadingHtml(){
    const history=window.cnmiV336ContinuousBalance?._test?.history||{};
    const message=history.error?`โหลดข้อมูลสะสมไม่สำเร็จ: ${history.error}`:'กำลังคำนวณเวรสะสมและวันหยุดสะสมจากทุกเดือน กรุณารอสักครู่…';
    return `<div class="notice ${history.error?'danger-notice':'soft-notice'} v336-balance-loading"><b>${esc(message)}</b></div>`;
  }
  function correctedData(staffList,assignments,key){
    const builder=window.cnmiV338PartialTradeBalance?._test?.correctedData;
    if(typeof builder!=='function')throw new Error('ไม่พบตัวคำนวณ V338');
    return builder(staffList,assignments,key);
  }

  function adminTable(data){
    return `<div class="clean-balance-dashboard grouped-balance-dashboard v278-cumulative-dashboard v298-baseline-balance v336-continuous-balance v338-current-trade-balance v339-thai-balance">${data.groups.map(group=>`<section class="balance-group-section"><div class="section-title balance-group-title"><h3>กลุ่ม ${esc(group.label)}</h3><span>${badgeHtml(`ค่าเฉลี่ยตั้งต้นเดือนนี้ ${group.average.toFixed(1)} หน่วยเวร`,'blue')}</span></div><div class="table-wrap v278-balance-table-wrap"><table class="clean-balance-table v278-balance-table"><thead><tr><th>เจ้าหน้าที่</th><th>เวรรวม</th><th>หน่วยเวร</th><th>ชั่วโมงรวม</th><th>เงินประมาณ</th><th>ส่วนต่างเวรเดือนนี้</th><th>เวรยกมา</th><th class="v336-cumulative-head">เวรสะสม</th><th>วันหยุดเดือนนี้</th><th>วันหยุดยกมา</th><th class="v336-cumulative-head">วันหยุดสะสม</th><th>ชบด1</th><th>ชบด2</th><th>ชบด3</th><th>ช3A</th><th>ช3B</th><th>ช4</th><th>ช9</th><th class="v279-pair-column">ดูคู่เวร</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${group.rows.map(row=>{
      const f=row.fixed||{},c=row.current||{},id=normId(row.person?.id),dutyReset=f.dutyReset===data.key,holidayReset=f.holidayReset===data.key;
      return `<tr class="${row.excluded?'v278-exempt-row':''}"><td>${staffPillHtml(row.person)}</td><td>${Number(c.total||0)}</td><td>${Number(c.units||0).toFixed(1)}</td><td>${Number(c.hours||0).toFixed(1)}</td><td>${Math.round(Number(c.pay||0)).toLocaleString()}</td><td class="${signedClass(f.gap)}">${fmt(f.gap)}</td><td class="${signedClass(f.carry)}">${fmt(f.carry)}</td>${cumulativeCell(row.person,f.cumulative,'duty')}<td>${Number(c.days||0)}</td><td class="${signedClass(f.holidayCarry)}">${fmt(f.holidayCarry)}</td>${cumulativeCell(row.person,f.holidayCumulative,'holiday')}<td>${Number(f.counts?.chbd1||0)}</td><td>${Number(f.counts?.chbd2||0)}</td><td>${Number(f.counts?.chbd3||0)}</td><td>${Number(f.counts?.ch3a||0)}</td><td>${Number(f.counts?.ch3b||0)}</td><td>${Number(f.counts?.ch4||0)}</td><td>${Number(f.counts?.ch9||0)}</td><td class="v279-pair-column"><button type="button" class="tiny-btn soft v279-pair-button" data-v279-duty-pair="${esc(id)}" data-v279-month="${esc(data.key)}">ดูคู่เวร</button></td><td>${badgeHtml(f.status,f.tone)}${f.dutyReset?`<small class="v278-reset-note">เวรเริ่ม ${esc(f.dutyReset)}</small>`:''}${f.holidayReset?`<small class="v278-reset-note">วันหยุดเริ่ม ${esc(f.holidayReset)}</small>`:''}</td><td><div class="v278-action-stack"><button type="button" class="tiny-btn ${dutyReset?'danger':'warning'}" data-v277-balance-reset="${esc(id)}" data-v277-month="${esc(data.key)}" data-v277-action="${dutyReset?'undo':'reset'}">${dutyReset?'ยกเลิกรีเซ็ตเวร':'เริ่มนับเวรใหม่เดือนนี้'}</button><button type="button" class="tiny-btn ${holidayReset?'danger':'soft'}" data-v278-holiday-reset="${esc(id)}" data-v278-month="${esc(data.key)}" data-v278-action="${holidayReset?'undo':'reset'}">${holidayReset?'ยกเลิกรีเซ็ตวันหยุด':'เริ่มนับวันหยุดใหม่เดือนนี้'}</button></div></td></tr>`;
    }).join('')}</tbody></table></div></section>`).join('')}</div>`;
  }

  function staffTable(data){
    return `<div class="clean-balance-dashboard grouped-balance-dashboard v265-balance-dashboard v298-baseline-balance v336-continuous-balance v338-current-trade-balance v339-thai-balance">${data.groups.map(group=>`<section class="balance-group-section v265-balance-group"><div class="section-title balance-group-title"><h3>กลุ่ม ${esc(group.label)}</h3><span>${badgeHtml(`ค่าเฉลี่ยตั้งต้น ${group.average.toFixed(1)} หน่วยเวร`,'blue')}</span></div><div class="table-wrap v265-balance-wrap"><table class="clean-balance-table v265-balance-table"><thead><tr><th>เจ้าหน้าที่</th><th>เวรรวม</th><th>หน่วยเวร</th><th>ชั่วโมงรวม</th><th>เงินประมาณ</th><th>ส่วนต่างเวรเดือนนี้</th><th>เวรยกมา</th><th class="v336-cumulative-head">เวรสะสม</th><th>วันหยุดเดือนนี้</th><th>วันหยุดยกมา</th><th class="v336-cumulative-head">วันหยุดสะสม</th><th>ชบด1</th><th>ชบด2</th><th>ชบด3</th><th>ช3A</th><th>ช3B</th><th>ช4</th><th>ช9</th><th>สถานะ</th></tr></thead><tbody>${group.rows.map(row=>{
      const f=row.fixed||{},c=row.current||{};
      return `<tr><td>${staffPillHtml(row.person)}</td><td>${Number(c.total||0)}</td><td>${Number(c.units||0).toFixed(1)}</td><td>${Number(c.hours||0).toFixed(1)}</td><td>${Math.round(Number(c.pay||0)).toLocaleString()}</td><td class="${signedClass(f.gap)}">${fmt(f.gap)}</td><td class="${signedClass(f.carry)}">${fmt(f.carry)}</td>${cumulativeCell(row.person,f.cumulative,'duty')}<td>${Number(c.days||0)}</td><td class="${signedClass(f.holidayCarry)}">${fmt(f.holidayCarry)}</td>${cumulativeCell(row.person,f.holidayCumulative,'holiday')}<td>${Number(f.counts?.chbd1||0)}</td><td>${Number(f.counts?.chbd2||0)}</td><td>${Number(f.counts?.chbd3||0)}</td><td>${Number(f.counts?.ch3a||0)}</td><td>${Number(f.counts?.ch3b||0)}</td><td>${Number(f.counts?.ch4||0)}</td><td>${Number(f.counts?.ch9||0)}</td><td>${badgeHtml(f.status,f.tone)}</td></tr>`;
    }).join('')}</tbody></table></div></section>`).join('')}</div>`;
  }

  const previousRender=window.renderBalanceDashboard||(typeof renderBalanceDashboard==='function'?renderBalanceDashboard:null);
  const renderV339=function renderBalanceDashboardV339(staffList,assignments,key){
    const safe=monthKeySafe(key||S()?.monthKey),v336=window.cnmiV336ContinuousBalance,history=v336?._test?.history;
    if(!window.cnmiV338PartialTradeBalance||!v336||!history)return previousRender?previousRender.apply(this,arguments):'<div class="empty-state">ยังโหลดตัวคำนวณสมดุลเวรไม่ครบ</div>';
    if(!history.ready){v336.ensureHistory?.(safe);return loadingHtml();}
    if(String(history.loadedThrough||'')<monthEnd(safe)){v336.ensureHistory?.(safe);return loadingHtml();}
    try{const data=correctedData(staffList,assignments,safe);return isAdminSafe()&&S()?.page==='scheduler'?adminTable(data):staffTable(data);}catch(error){console.error(`${VERSION}: render`,error);return previousRender?previousRender.apply(this,arguments):'<div class="empty-state">คำนวณสมดุลเวรไม่สำเร็จ</div>';}
  };
  window.renderBalanceDashboard=renderV339;try{renderBalanceDashboard=renderV339;}catch(_){}

  const showFairnessV339=function(){
    const key=monthKeySafe(S()?.monthKey),v336=window.cnmiV336ContinuousBalance,history=v336?._test?.history;let assignments=[],staffList=[];
    try{assignments=getAssignmentsForMonth(key).filter(r=>r?.staff_id);}catch(_){assignments=(S()?.rosterAssignments||[]).filter(r=>normDate(r?.duty_date).startsWith(key)&&r?.staff_id);}
    try{staffList=scheduleStaffList();}catch(_){staffList=S()?.staff||[];}
    if(!history?.ready||String(history.loadedThrough||'')<monthEnd(key)){v336?.ensureHistory?.(key);try{showModal(`<h2>ตรวจสมดุลการกระจายเวร ${esc(key)}</h2>${loadingHtml()}`,{large:true});}catch(_){}return;}
    try{showModal(`<h2>ตรวจสมดุลการกระจายเวร ${esc(key)}</h2>${staffTable(correctedData(staffList,assignments,key))}`,{large:true});}catch(error){console.warn(`${VERSION}: fairness modal`,error);}
  };
  window.showFairness=showFairnessV339;try{showFairness=showFairnessV339;}catch(_){}

  const style=document.createElement('style');
  style.id='v339-thai-balance-style';
  style.textContent=`
    .v339-thai-balance th{white-space:nowrap}
    .v339-thai-balance th:nth-child(6),.v339-thai-balance th:nth-child(7),.v339-thai-balance th:nth-child(10){min-width:96px}
    .v339-thai-balance td:nth-child(6),.v339-thai-balance td:nth-child(7),.v339-thai-balance td:nth-child(10){font-variant-numeric:tabular-nums;text-align:center}
  `;
  document.head.appendChild(style);

  window.cnmiV339ThaiBalance={version:VERSION,_test:{adminTable,staffTable,correctedData}};
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v339-thai-balance-label-holiday-carry.js", error); }
;

/* Original source: patch-v340-baseline-duty-holiday-columns.js */
try {
/* CNMI Staff Planner V340
   Show the Admin's original duty and holiday baseline beside current figures.
   - Add "เวรตั้งต้น" as baseline duty units before completed roster trades.
   - Add "วันหยุดตั้งต้น" as baseline calendar days off before completed roster trades.
   - Keep current figures after trades and all V339 carry/cumulative calculations unchanged.
   - No new Supabase request and no SQL change.
*/
(function(){
  'use strict';
  const VERSION='V340_BASELINE_DUTY_HOLIDAY_COLUMNS';
  if(window.__CNMI_V340_BASELINE_DUTY_HOLIDAY_COLUMNS__)return;
  window.__CNMI_V340_BASELINE_DUTY_HOLIDAY_COLUMNS__=true;

  function S(){try{return state||window.state||null;}catch(_){return window.state||null;}}
  function esc(v){try{return escapeHtml(v==null?'':String(v));}catch(_){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}}
  function normId(v){return String(v==null?'':v);}
  function normDate(v){try{return normalizeDateKey(v);}catch(_){return String(v||'').slice(0,10);}}
  function monthKeySafe(v){return /^\d{4}-\d{2}$/.test(String(v||''))?String(v):new Date().toISOString().slice(0,7);}
  function monthEnd(key){const y=Number(key.slice(0,4)),m=Number(key.slice(5,7));return `${key}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;}
  function isAdminSafe(){try{return !!isAdmin();}catch(_){return String(S()?.profile?.role||'').toLowerCase()==='admin';}}
  function badgeHtml(text,tone){try{return badge(text,tone);}catch(_){return `<span class="badge ${esc(tone||'')}">${esc(text)}</span>`;}}
  function staffPillHtml(person){try{return staffPill(person);}catch(_){return `<b>${esc(person?.nickname||person?.full_name||'-')}</b>`;}}
  function staffColorSafe(person){try{return staffColor(person);}catch(_){return person?.staff_color||person?.color||'#e2e8f0';}}
  function textColorSafe(color){try{return textColorFor(color);}catch(_){return '#0f172a';}}
  function fmt(n){const x=Number(n||0);return String(Number.isFinite(x)?Math.trunc(x):0);}
  function signedClass(v){const n=Number(v||0);return n>0.5?'v278-positive':n<-0.5?'v278-negative':'';}
  function mergeUnique(rows,keyFn){const map=new Map();(rows||[]).forEach(row=>{const key=keyFn(row);if(key)map.set(key,row);});return [...map.values()];}

  function cumulativeCell(person,value,type){
    const bg=staffColorSafe(person),fg=textColorSafe(bg);
    return `<td class="v336-staff-cumulative v336-${esc(type)}" style="--v336-staff-bg:${esc(bg)};--v336-staff-fg:${esc(fg)};background:${esc(bg)};color:${esc(fg)}" title="ยอดสะสมต่อเนื่องของ ${esc(person?.nickname||person?.full_name||'เจ้าหน้าที่')}"><b>${fmt(value)}</b></td>`;
  }
  function loadingHtml(){
    const history=window.cnmiV336ContinuousBalance?._test?.history||{};
    const message=history.error?`โหลดข้อมูลสะสมไม่สำเร็จ: ${history.error}`:'กำลังคำนวณเวรสะสมและวันหยุดสะสมจากทุกเดือน กรุณารอสักครู่…';
    return `<div class="notice ${history.error?'danger-notice':'soft-notice'} v336-balance-loading"><b>${esc(message)}</b></div>`;
  }
  function baseCorrectedData(staffList,assignments,key){
    const builder=window.cnmiV339ThaiBalance?._test?.correctedData||window.cnmiV338PartialTradeBalance?._test?.correctedData;
    if(typeof builder!=='function')throw new Error('ไม่พบตัวคำนวณ V339');
    return builder(staffList,assignments,key);
  }
  function baselineRowsForMonth(assignments,key){
    const safe=monthKeySafe(key),history=window.cnmiV336ContinuousBalance?._test?.history||{};
    const end=monthEnd(safe);
    const source=(history.assignments||[]).filter(row=>normDate(row?.duty_date)<=end);
    const selected=(assignments||[]).filter(row=>normDate(row?.duty_date).startsWith(safe));
    const current=mergeUnique(
      source.filter(row=>!normDate(row?.duty_date).startsWith(safe)).concat(selected),
      row=>normId(row?.id)||`${normDate(row?.duty_date)}|${String(row?.duty_code||'')}|${normId(row?.staff_id)}`
    );
    const trades=mergeUnique([...(history.trades||[]),...(S()?.tradeRequests||[])],row=>normId(row?.id)||`${normId(row?.from_assignment_id)}|${normId(row?.requester_id)}|${normId(row?.receiver_id)}|${String(row?.note||'')}`);
    const reconstruct=window.cnmiV336ContinuousBalance?._test?.reconstructBaseline;
    const baseline=typeof reconstruct==='function'?reconstruct(current,trades):current;
    return baseline.filter(row=>row?.staff_id&&normDate(row?.duty_date).startsWith(safe));
  }
  function baselineStats(rows){try{return calcFairness((rows||[]).filter(row=>row?.staff_id))||{};}catch(_){return {};}}
  function baselineDays(staffId,key,rows){
    try {
      const saved=window.cnmiV648PublishedPlan?.publishedDaysOff?.(staffId,key,rows);
      return saved == null ? Number(calculateDaysOff(staffId,key,rows)||0) : saved;
    } catch(_){return 0;}
  }
  function correctedData(staffList,assignments,key){
    const safe=monthKeySafe(key),data=baseCorrectedData(staffList,assignments,safe),rows=baselineRowsForMonth(assignments,safe),stats=baselineStats(rows);
    data.groups.forEach(group=>group.rows.forEach(row=>{
      const id=normId(row.person?.id),f=row.fixed||(row.fixed={});
      const fallbackUnits=Number(group.average||0)+Number(f.gap||0);
      const unpublished=window.cnmiV648PublishedPlan?.isFairnessMonth?.(safe) === false;
      f.baselineUnits=row.excluded||unpublished?0:Number(stats[id]?.units??fallbackUnits??0);
      f.baselineDays=row.excluded||unpublished?0:baselineDays(id,safe,rows);
    }));
    return data;
  }

  function adminTable(data){
    return `<div class="clean-balance-dashboard grouped-balance-dashboard v278-cumulative-dashboard v298-baseline-balance v336-continuous-balance v338-current-trade-balance v339-thai-balance v340-baseline-columns">${data.groups.map(group=>`<section class="balance-group-section"><div class="section-title balance-group-title"><h3>กลุ่ม ${esc(group.label)}</h3><span>${badgeHtml(`ค่ากลางเวรตามประกาศ ${group.average.toFixed(1)} หน่วยเวร`,'blue')}</span></div><div class="table-wrap v278-balance-table-wrap"><table class="clean-balance-table v278-balance-table"><thead><tr><th>เจ้าหน้าที่</th><th>เวรรวม</th><th title="หน่วยเวรปัจจุบันหลังซื้อขายเวร">หน่วยเวรปัจจุบัน</th><th>ชั่วโมงรวม</th><th>เงินประมาณ</th><th class="v340-baseline-head" title="หน่วยเวรตามแผนตั้งต้นที่หัวหน้าจัด ก่อนซื้อขายเวร">เวรตั้งต้น</th><th>ส่วนต่างเวรเดือนนี้</th><th>เวรยกมา</th><th class="v336-cumulative-head">เวรสะสม</th><th title="จำนวนวันหยุดปัจจุบันหลังซื้อขายเวร">วันหยุดปัจจุบัน</th><th class="v340-baseline-head" title="จำนวนวันหยุดตามแผนตั้งต้นที่หัวหน้าจัด ก่อนซื้อขายเวร">วันหยุดตั้งต้น</th><th title="วันหยุดตามประกาศของคนนี้ ลบค่ามัธยฐานของกลุ่ม">ส่วนต่างวันหยุดตามแผน</th><th>วันหยุดยกมา</th><th class="v336-cumulative-head">วันหยุดสะสม</th><th>ชบด1</th><th>ชบด2</th><th>ชบด3</th><th>ช3A</th><th>ช3B</th><th>ช4</th><th>ช9</th><th class="v279-pair-column">ดูคู่เวร</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>${group.rows.map(row=>{
      const f=row.fixed||{},c=row.current||{},id=normId(row.person?.id),dutyReset=f.dutyReset===data.key,holidayReset=f.holidayReset===data.key;
      return `<tr class="${row.excluded?'v278-exempt-row':''}"><td>${staffPillHtml(row.person)}</td><td>${Number(c.total||0)}</td><td>${Number(c.units||0).toFixed(1)}</td><td>${Number(c.hours||0).toFixed(1)}</td><td>${Math.round(Number(c.pay||0)).toLocaleString()}</td><td class="v340-baseline-cell"><b>${fmt(f.baselineUnits)}</b></td><td class="${signedClass(f.gap)}">${fmt(f.gap)}</td><td class="${signedClass(f.carry)}">${fmt(f.carry)}</td>${cumulativeCell(row.person,f.cumulative,'duty')}<td>${Number(c.days||0)}</td><td class="v340-baseline-cell"><b>${Number(f.baselineDays||0)}</b></td><td class="${signedClass(f.holidayGap)}">${fmt(f.holidayGap)}</td><td class="${signedClass(f.holidayCarry)}">${fmt(f.holidayCarry)}</td>${cumulativeCell(row.person,f.holidayCumulative,'holiday')}<td>${Number(f.counts?.chbd1||0)}</td><td>${Number(f.counts?.chbd2||0)}</td><td>${Number(f.counts?.chbd3||0)}</td><td>${Number(f.counts?.ch3a||0)}</td><td>${Number(f.counts?.ch3b||0)}</td><td>${Number(f.counts?.ch4||0)}</td><td>${Number(f.counts?.ch9||0)}</td><td class="v279-pair-column"><button type="button" class="tiny-btn soft v279-pair-button" data-v279-duty-pair="${esc(id)}" data-v279-month="${esc(data.key)}">ดูคู่เวร</button></td><td>${badgeHtml(f.status,f.tone)}${f.dutyReset?`<small class="v278-reset-note">เวรเริ่ม ${esc(f.dutyReset)}</small>`:''}${f.holidayReset?`<small class="v278-reset-note">วันหยุดเริ่ม ${esc(f.holidayReset)}</small>`:''}</td><td><div class="v278-action-stack"><button type="button" class="tiny-btn ${dutyReset?'danger':'warning'}" data-v277-balance-reset="${esc(id)}" data-v277-month="${esc(data.key)}" data-v277-action="${dutyReset?'undo':'reset'}">${dutyReset?'ยกเลิกรีเซ็ตเวร':'เริ่มนับเวรใหม่เดือนนี้'}</button><button type="button" class="tiny-btn ${holidayReset?'danger':'soft'}" data-v278-holiday-reset="${esc(id)}" data-v278-month="${esc(data.key)}" data-v278-action="${holidayReset?'undo':'reset'}">${holidayReset?'ยกเลิกรีเซ็ตวันหยุด':'เริ่มนับวันหยุดใหม่เดือนนี้'}</button></div></td></tr>`;
    }).join('')}</tbody></table></div></section>`).join('')}</div>`;
  }

  function staffTable(data){
    return `<div class="clean-balance-dashboard grouped-balance-dashboard v265-balance-dashboard v298-baseline-balance v336-continuous-balance v338-current-trade-balance v339-thai-balance v340-baseline-columns">${data.groups.map(group=>`<section class="balance-group-section v265-balance-group"><div class="section-title balance-group-title"><h3>กลุ่ม ${esc(group.label)}</h3><span>${badgeHtml(`ค่ากลางเวรตามประกาศ ${group.average.toFixed(1)} หน่วยเวร`,'blue')}</span></div><div class="table-wrap v265-balance-wrap"><table class="clean-balance-table v265-balance-table"><thead><tr><th>เจ้าหน้าที่</th><th>เวรรวม</th><th title="หน่วยเวรปัจจุบันหลังซื้อขายเวร">หน่วยเวรปัจจุบัน</th><th>ชั่วโมงรวม</th><th>เงินประมาณ</th><th class="v340-baseline-head" title="หน่วยเวรตามแผนตั้งต้นที่หัวหน้าจัด ก่อนซื้อขายเวร">เวรตั้งต้น</th><th>ส่วนต่างเวรเดือนนี้</th><th>เวรยกมา</th><th class="v336-cumulative-head">เวรสะสม</th><th title="จำนวนวันหยุดปัจจุบันหลังซื้อขายเวร">วันหยุดปัจจุบัน</th><th class="v340-baseline-head" title="จำนวนวันหยุดตามแผนตั้งต้นที่หัวหน้าจัด ก่อนซื้อขายเวร">วันหยุดตั้งต้น</th><th title="วันหยุดตามประกาศของคนนี้ ลบค่ามัธยฐานของกลุ่ม">ส่วนต่างวันหยุดตามแผน</th><th>วันหยุดยกมา</th><th class="v336-cumulative-head">วันหยุดสะสม</th><th>ชบด1</th><th>ชบด2</th><th>ชบด3</th><th>ช3A</th><th>ช3B</th><th>ช4</th><th>ช9</th><th>สถานะ</th></tr></thead><tbody>${group.rows.map(row=>{
      const f=row.fixed||{},c=row.current||{};
      return `<tr><td>${staffPillHtml(row.person)}</td><td>${Number(c.total||0)}</td><td>${Number(c.units||0).toFixed(1)}</td><td>${Number(c.hours||0).toFixed(1)}</td><td>${Math.round(Number(c.pay||0)).toLocaleString()}</td><td class="v340-baseline-cell"><b>${fmt(f.baselineUnits)}</b></td><td class="${signedClass(f.gap)}">${fmt(f.gap)}</td><td class="${signedClass(f.carry)}">${fmt(f.carry)}</td>${cumulativeCell(row.person,f.cumulative,'duty')}<td>${Number(c.days||0)}</td><td class="v340-baseline-cell"><b>${Number(f.baselineDays||0)}</b></td><td class="${signedClass(f.holidayGap)}">${fmt(f.holidayGap)}</td><td class="${signedClass(f.holidayCarry)}">${fmt(f.holidayCarry)}</td>${cumulativeCell(row.person,f.holidayCumulative,'holiday')}<td>${Number(f.counts?.chbd1||0)}</td><td>${Number(f.counts?.chbd2||0)}</td><td>${Number(f.counts?.chbd3||0)}</td><td>${Number(f.counts?.ch3a||0)}</td><td>${Number(f.counts?.ch3b||0)}</td><td>${Number(f.counts?.ch4||0)}</td><td>${Number(f.counts?.ch9||0)}</td><td>${badgeHtml(f.status,f.tone)}</td></tr>`;
    }).join('')}</tbody></table></div></section>`).join('')}</div>`;
  }

  const previousRender=window.renderBalanceDashboard||(typeof renderBalanceDashboard==='function'?renderBalanceDashboard:null);
  const renderV340=function renderBalanceDashboardV340(staffList,assignments,key){
    const safe=monthKeySafe(key||S()?.monthKey),v336=window.cnmiV336ContinuousBalance,history=v336?._test?.history;
    if(!window.cnmiV339ThaiBalance||!v336||!history)return previousRender?previousRender.apply(this,arguments):'<div class="empty-state">ยังโหลดตัวคำนวณสมดุลเวรไม่ครบ</div>';
    if(!history.ready){v336.ensureHistory?.(safe);return loadingHtml();}
    if(String(history.loadedThrough||'')<monthEnd(safe)){v336.ensureHistory?.(safe);return loadingHtml();}
    try{const data=correctedData(staffList,assignments,safe);return isAdminSafe()&&S()?.page==='scheduler'?adminTable(data):staffTable(data);}catch(error){console.error(`${VERSION}: render`,error);return previousRender?previousRender.apply(this,arguments):'<div class="empty-state">คำนวณสมดุลเวรไม่สำเร็จ</div>';}
  };
  window.renderBalanceDashboard=renderV340;try{renderBalanceDashboard=renderV340;}catch(_){}

  const showFairnessV340=function(){
    const key=monthKeySafe(S()?.monthKey),v336=window.cnmiV336ContinuousBalance,history=v336?._test?.history;let assignments=[],staffList=[];
    try{assignments=getAssignmentsForMonth(key).filter(row=>row?.staff_id);}catch(_){assignments=(S()?.rosterAssignments||[]).filter(row=>normDate(row?.duty_date).startsWith(key)&&row?.staff_id);}
    try{staffList=scheduleStaffList();}catch(_){staffList=S()?.staff||[];}
    if(!history?.ready||String(history.loadedThrough||'')<monthEnd(key)){v336?.ensureHistory?.(key);try{showModal(`<h2>ตรวจสมดุลการกระจายเวร ${esc(key)}</h2>${loadingHtml()}`,{large:true});}catch(_){}return;}
    try{showModal(`<h2>ตรวจสมดุลการกระจายเวร ${esc(key)}</h2>${staffTable(correctedData(staffList,assignments,key))}`,{large:true});}catch(error){console.warn(`${VERSION}: fairness modal`,error);}
  };
  window.showFairness=showFairnessV340;try{showFairness=showFairnessV340;}catch(_){}

  const style=document.createElement('style');
  style.id='v340-baseline-columns-style';
  style.textContent=`
    .v340-baseline-columns th{white-space:nowrap}
    .v340-baseline-columns .v340-baseline-head{background:#fef3c7!important;color:#78350f!important;font-weight:900;box-shadow:inset 0 -3px 0 #f59e0b}
    .v340-baseline-columns td.v340-baseline-cell{background:#fffbeb;text-align:center;font-variant-numeric:tabular-nums;min-width:86px;box-shadow:inset 0 0 0 1px rgba(245,158,11,.28)}
    .v340-baseline-columns th[title]{text-decoration:underline dotted rgba(15,23,42,.35);text-underline-offset:3px}
    @media(max-width:760px){.v340-baseline-columns td.v340-baseline-cell{min-width:78px}}
  `;
  document.head.appendChild(style);

  window.cnmiV340BaselineColumns={version:VERSION,_test:{correctedData,baselineRowsForMonth,adminTable,staffTable}};
  console.info(`${VERSION} loaded`);
})();

} catch (error) { console.error("[v569] patch-v340-baseline-duty-holiday-columns.js", error); }
;

/* Original source: patch-v346-ot-carry-in-summary.js */
try {
/* CNMI Staff Planner V346 — show OT carry-in clearly in monthly summary
   - Reuses the V318 carry snapshot; no new table, SQL, or background preload.
   - Loads carry only while the monthly summary/export table is visible.
   - Makes the HR calculation auditable: current + carry-in = available,
     then whole 8-hour claims + carry-out.
*/
(function(){
  'use strict';
  const VERSION='V346_OT_CARRY_IN_SUMMARY';
  if(window.__CNMI_V346_OT_CARRY_IN_SUMMARY__)return;
  window.__CNMI_V346_OT_CARRY_IN_SUMMARY__=true;

  const previousRenderOtPage=window.renderOtPage||(typeof renderOtPage==='function'?renderOtPage:null);
  let hydrationToken=0;

  function st(){try{return state;}catch(_){return window.state||{};}}
  function esc(v){
    try{return escapeHtml(v==null?'':String(v));}
    catch(_){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  }
  function monthKey(){
    const raw=String(st().otSourceMonthV241||st().otMoneyMonthV241||st().monthKey||'').slice(0,7);
    if(/^\d{4}-\d{2}$/.test(raw))return raw;
    const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  function round2(v){const n=Number(v||0);return Number.isFinite(n)?Math.round(n*100)/100:0;}
  function fmt(v){const n=round2(v);return Number.isInteger(n)?String(n):n.toFixed(2).replace(/0+$/,'').replace(/\.$/,'');}
  function readNumber(cell){
    const raw=String(cell?.textContent||'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);
    return raw?round2(raw[0]):0;
  }
  function thaiMonth(key){
    const names=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
    const [y,m]=String(key||'').split('-').map(Number);
    return y&&m?`${names[m-1]} ${y+543}`:'รอบก่อน';
  }
  function cell(value,cls,title){return `<td class="${cls}"${title?` title="${esc(title)}"`:''}><b>${esc(fmt(value))}</b></td>`;}

  function prepareTable(table){
    if(!table||table.dataset.v346Prepared==='1')return;
    const headers=Array.from(table.querySelectorAll('thead th'));
    if(headers.length<8)return;
    const hrIndex=headers.findIndex(th=>(th.textContent||'').trim()==='ชั่วโมงเบิก HR');
    const carryOutIndex=headers.findIndex(th=>(th.textContent||'').includes('OT ทบไปรอบหน้า'));
    if(hrIndex<0||carryOutIndex<0)return;
    headers[hrIndex].textContent='OT เดือนนี้เทียบ HR';
    headers[hrIndex].title='ชั่วโมง OT ของเดือนนี้หลังแปลงตามฐาน HR ยังไม่รวมยอดทบจากรอบก่อน';
    headers[carryOutIndex].insertAdjacentHTML('beforebegin','<th class="v346-carry-in-head">OT ทบมาจากรอบก่อน</th><th class="v346-available-head">รวมพร้อมเบิก HR</th><th class="v346-claimed-head">เบิก HR รอบนี้</th>');
    Array.from(table.querySelectorAll('tbody tr')).forEach(row=>{
      const cells=row.children;
      if(!cells[hrIndex]||!cells[carryOutIndex])return;
      row.dataset.v346CurrentHr=String(readNumber(cells[hrIndex]));
      cells[carryOutIndex].insertAdjacentHTML('beforebegin',cell(0,'v346-carry-in','กำลังตรวจสอบยอดทบจากรอบก่อน')+cell(readNumber(cells[hrIndex]),'v346-available','OT เดือนนี้ + ยอดทบจากรอบก่อน')+cell(Math.floor((readNumber(cells[hrIndex])+1e-7)/8)*8,'v346-claimed','เบิกเป็นชุดละ 8 ชั่วโมง'));
    });
    table.dataset.v346Prepared='1';
  }

  function prepareVisibleTables(){
    document.querySelectorAll('.v241-real-month-section .v241-ot-summary-table table, .v241-hr-export-section .v241-ot-summary-table table').forEach(prepareTable);
  }
  function updateRows(carryMap){
    document.querySelectorAll('table[data-v346-prepared="1"] tbody tr').forEach(row=>{
      const staffButton=row.querySelector('[data-v347-show-staff],[data-v234-show-staff]');
      const staffId=staffButton?.getAttribute('data-v347-show-staff')||staffButton?.getAttribute('data-v234-show-staff')||'';
      const info=carryMap instanceof Map?carryMap.get(String(staffId)):null;
      const carryIn=round2(info?.amount||0),current=round2(row.dataset.v346CurrentHr||0),available=round2(current+carryIn);
      const claimed=Math.floor((available+1e-7)/8)*8,carryOut=round2(Math.max(0,available-claimed));
      const carryCell=row.querySelector('.v346-carry-in'),availableCell=row.querySelector('.v346-available'),claimedCell=row.querySelector('.v346-claimed');
      if(carryCell){carryCell.innerHTML=`<b>${esc(fmt(carryIn))}</b>${carryIn>0?`<small>${esc(thaiMonth(info?.sourceMonth))}</small>`:''}`;carryCell.title=carryIn>0?`ยอดทบจาก ${thaiMonth(info?.sourceMonth)}`:'ไม่มียอดทบจากรอบก่อน';}
      if(availableCell){availableCell.innerHTML=`<b>${esc(fmt(available))}</b>`;availableCell.title=`${fmt(current)} + ${fmt(carryIn)} = ${fmt(available)} ชั่วโมง`;}
      if(claimedCell){claimedCell.innerHTML=`<b>${esc(fmt(claimed))}</b>`;claimedCell.title=`เบิกได้ ${Math.floor((available+1e-7)/8)} ชุด × 8 ชั่วโมง`;}
      const allCells=Array.from(row.children),carryOutHeader=Array.from(row.closest('table').querySelectorAll('thead th')).findIndex(th=>(th.textContent||'').includes('OT ทบไปรอบหน้า'));
      if(carryOutHeader>=0&&allCells[carryOutHeader]){allCells[carryOutHeader].innerHTML=`<b>${esc(fmt(carryOut))}</b>`;allCells[carryOutHeader].title=`${fmt(available)} − ${fmt(claimed)} = ${fmt(carryOut)} ชั่วโมง`;}
    });
  }
  function showLoadError(){
    document.querySelectorAll('.v346-carry-in').forEach(td=>{td.innerHTML='<span class="badge orange">โหลดไม่ได้</span>';td.title='ยังอ่านยอดทบจากรอบก่อนไม่สำเร็จ กรุณารีเฟรชแล้วลองใหม่';});
  }
  async function hydrate(){
    const token=++hydrationToken;
    await new Promise(resolve=>setTimeout(resolve,0));
    if(token!==hydrationToken)return;
    prepareVisibleTables();
    if(!document.querySelector('table[data-v346-prepared="1"]'))return;
    try{
      const api=window.cnmiV318;
      if(!api||typeof api.queryCarryInSummary!=='function')throw new Error('ไม่พบตัวอ่านยอดทบ V318');
      const map=await api.queryCarryInSummary(monthKey());
      if(token!==hydrationToken)return;
      updateRows(map);
    }catch(err){console.error(`[${VERSION}] carry-in hydration failed`,err);if(token===hydrationToken)showLoadError();}
  }

  if(previousRenderOtPage){
    const wrapped=function renderOtPageV346(){const html=previousRenderOtPage.apply(this,arguments);const active=st().otSubtabV241||'mine';if(active==='summary'||active==='export')hydrate();return html;};
    try{window.renderOtPage=renderOtPage=wrapped;}catch(_){window.renderOtPage=wrapped;}
  }
  document.addEventListener('change',e=>{if(e.target?.id==='otMoneyMonthV241'||e.target?.id==='otSourceMonthV241')setTimeout(hydrate,20);},true);
  document.addEventListener('click',e=>{const tab=e.target?.closest?.('[data-ot-subtab-v241]');if(tab&&['summary','export'].includes(tab.getAttribute('data-ot-subtab-v241')))setTimeout(hydrate,20);},true);

  const style=document.createElement('style');
  style.textContent='.v346-carry-in,.v346-available,.v346-claimed{white-space:nowrap}.v346-carry-in{background:#fff8e8}.v346-available{background:#eef8ff}.v346-claimed{background:#effbf4}.v346-carry-in small{display:block;margin-top:2px;color:#8a5a00;font-size:11px;font-weight:500}.v346-carry-in-head{background:#fff3d6!important}.v346-available-head{background:#e5f5ff!important}.v346-claimed-head{background:#e7f8ee!important}';
  document.head.appendChild(style);
  window.cnmiV346={version:VERSION,hydrate};
  console.info(`[${VERSION}] loaded`);
})();

} catch (error) { console.error("[v569] patch-v346-ot-carry-in-summary.js", error); }
;

/* Original source: patch-v347-ot-claim-details-money.js */
try {
/* =========================
   V349 OT Claim Details + Mixed-rate Claimed Money
   - Staff sees claim details for the signed-in staff account only.
   - Admin can open one person's OT details from the monthly summary.
   - Money is calculated from "เบิก HR รอบนี้" after carry-in, not raw monthly OT.
   ========================= */
(function(){
  'use strict';
  const VERSION = 'V349_OT_CLAIM_DETAILS_MIXED_RATE_MONEY';
  if (window.__CNMI_V349_OT_CLAIM_DETAILS_MIXED_RATE_MONEY__) return;
  window.__CNMI_V349_OT_CLAIM_DETAILS_MIXED_RATE_MONEY__ = true;

  const previousRenderOtPage = window.renderOtPage || (typeof renderOtPage === 'function' ? renderOtPage : null);
  let detailHydrationToken = 0;
  let moneyRefreshQueued = false;

  function esc(v){
    try { return escapeHtml(v == null ? '' : String(v)); }
    catch (_) { return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  }
  function round2(v){
    const n = Number(v || 0);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }
  function hours(v, digits=2){
    const n = round2(v);
    if (Math.abs(n) < 0.005) return '0';
    return Number.isInteger(n) ? String(n) : n.toFixed(digits).replace(/0+$/,'').replace(/\.$/,'');
  }
  function money(v){
    const n = round2(v);
    return `${n.toLocaleString('th-TH', { minimumFractionDigits:Number.isInteger(n) ? 0 : 2, maximumFractionDigits:2 })} บ.`;
  }
  function normDate(v){
    try { return normalizeDateKey(v); }
    catch (_) { return String(v || '').slice(0, 10); }
  }
  function fmtDate(v){
    const d = normDate(v);
    if (!d) return '-';
    try { return formatThaiDate(d); }
    catch (_) { return d; }
  }
  function isAdminSafe(){
    try { return typeof isAdmin === 'function' && isAdmin(); }
    catch (_) { return false; }
  }
  function currentSid(){
    try { return String(currentStaffId() || ''); }
    catch (_) { return String(state?.profile?.staff_id || state?.profile?.id || ''); }
  }
  function staffRec(staffId){
    return (state?.staff || []).find(s => String(s?.id || '') === String(staffId || '')) || null;
  }
  function staffName(staffId){
    const s = staffRec(staffId) || {};
    try { return staffNick(staffId); }
    catch (_) { return s.nickname || s.full_name || s.name || staffId || '-'; }
  }
  function staffPillSafe(staffId){
    try { return staffPill(staffId); }
    catch (_) { return `<span class="staff-pill">${esc(staffName(staffId))}</span>`; }
  }
  function isTang(staffId){
    const s = staffRec(staffId) || {};
    return /(^|\s)แตง($|\s)/.test(`${s.nickname || ''} ${s.full_name || ''}`.trim()) || String(s.nickname || '').trim() === 'แตง';
  }
  function staffRateType(staffId){
    const s = staffRec(staffId) || {};
    const type = String(s.staff_type || s.type || '').trim();
    return type === 'เคิก' || isTang(staffId) ? 'เคิก' : 'MT';
  }
  function staffRate(staffId){ return staffRateType(staffId) === 'เคิก' ? 90 : 130; }
  function selectedMonth(forStaff=false){
    const raw = forStaff
      ? (state?.myDutyMonthFilter || state?.otMoneyMonthV241 || state?.otSourceMonthV241 || state?.monthKey)
      : (state?.otMoneyMonthV241 || state?.otSourceMonthV241 || state?.otMoneyMonthV238 || state?.monthKey);
    if (raw) return String(raw).slice(0, 7);
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }
  function isApproved(row){
    const s = String(row?.status || '').trim().toLowerCase();
    return s === 'อนุมัติ' || s === 'อนุมัติแล้ว' || s === 'approved';
  }
  function claimStatus(row){
    const s = String(row?.claim_status || '').trim().toLowerCase();
    return ['claimed','exported','hr_exported','เบิกแล้ว','export แล้ว'].includes(s) ? 'Exported' : 'Pending';
  }
  function statusBadge(row){
    const st = claimStatus(row);
    return `<span class="badge ${st === 'Exported' ? 'green' : 'orange'}">${st}</span>`;
  }
  function breakdown(row){
    try {
      const n = window.v190HrRateNormalization?.otNormalizationBreakdown190?.(row);
      if (n && Number.isFinite(Number(n.hrHours))) return n;
    } catch (_) {}
    let actual = 0;
    try { actual = Number(calcOtHours(row) || 0); }
    catch (_) { actual = Number(row?.manual_hours || row?.requested_hours || row?.hours || 0); }
    return { actualHours:round2(actual), hrHours:round2(actual), isHoliday:false, shiftType:row?.duty_code || '-' };
  }
  function approvedDetails(staffId, month){
    const requested = String(staffId || '');
    const allowed = isAdminSafe() ? requested : currentSid();
    if (!allowed) return [];
    return (state?.otRequests || [])
      .filter(row => String(row?.staff_id || '') === allowed && normDate(row?.work_date).startsWith(String(month || '').slice(0, 7)) && isApproved(row))
      .sort((a,b) => normDate(a?.work_date).localeCompare(normDate(b?.work_date)) || String(a?.created_at || '').localeCompare(String(b?.created_at || '')));
  }
  function timeRange(row){
    const start = String(row?.start_time || '').slice(0, 5);
    const end = String(row?.end_time || '').slice(0, 5);
    const endDate = normDate(row?.end_date);
    const date = normDate(row?.work_date);
    if (!start && !end) return '-';
    const next = endDate && date && endDate !== date ? ` (${fmtDate(endDate)})` : '';
    return `${start || '-'}–${end || '-'}${next}`;
  }
  function rowTable(rows, showName=false){
    if (!rows.length) return '<div class="empty">ยังไม่มีรายการ OT ที่อนุมัติในเดือนนี้</div>';
    return `<div class="table-wrap v347-detail-table"><table><thead><tr>${showName ? '<th>ชื่อ</th>' : ''}<th>วันที่ OT</th><th>เวลา</th><th>เหตุผล / รายละเอียด</th><th>ชั่วโมงจริง</th><th>OT เดือนนี้เทียบ HR</th><th>สถานะ Export</th></tr></thead><tbody>${rows.map(row => {
      const n = breakdown(row);
      const note = String(row?.note || '').trim();
      return `<tr>${showName ? `<td>${staffPillSafe(row.staff_id)}</td>` : ''}<td>${esc(fmtDate(row.work_date))}</td><td>${esc(timeRange(row))}</td><td><b>${esc(row.reason || '-')}</b>${note ? `<br><span class="muted">${esc(note)}</span>` : ''}</td><td>${hours(n.actualHours, 1)}</td><td><b>${hours(n.hrHours, 2)}</b>${n.isHoliday ? '<br><span class="badge blue">นักขัตฤกษ์</span>' : ''}</td><td>${statusBadge(row)}</td></tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function sumCurrentHr(rows){ return round2(rows.reduce((sum,row) => sum + Number(breakdown(row).hrHours || 0), 0)); }
  function rateSegmentsForRow(row){
    const n = breakdown(row);
    const trade = n?.tradeInfo;
    if (trade) {
      const rate = Number(trade.receiverNormalRate || (trade.receiverType === 'เคิก' ? 90 : 130));
      return [{ hours:round2(n.hrHours), rate, type:trade.receiverType || (rate === 90 ? 'เคิก' : 'MT'), duty:String(trade.assignment?.duty_code || row?.duty_code || '') }];
    }
    const source = Array.isArray(n?.segments) && n.segments.length ? n.segments : [n];
    const out = source.map(seg => {
      const type = String(seg?.rateType || n?.rateType || staffRateType(row?.staff_id)) === 'เคิก' ? 'เคิก' : 'MT';
      const rate = Number(seg?.normalRate || (type === 'เคิก' ? 90 : 130));
      return { hours:round2(seg?.hrHours == null ? n?.hrHours : seg.hrHours), rate, type, duty:String(seg?.shiftType || n?.shiftType || row?.duty_code || '') };
    }).filter(seg => seg.hours > 0 && seg.rate > 0);
    const sourceTotal = round2(out.reduce((sum,seg) => sum + seg.hours, 0));
    const targetTotal = round2(n?.hrHours || 0);
    if (out.length && Math.abs(sourceTotal - targetTotal) > 0.01) out[out.length - 1].hours = round2(Math.max(0, out[out.length - 1].hours + targetTotal - sourceTotal));
    return out;
  }
  function claimedMoneyBreakdown(staffId, rows, carryIn, claimedHours){
    const claimed = round2(Math.max(0, claimedHours || 0));
    const segments = [];
    const carry = round2(Math.max(0, carryIn || 0));
    if (carry > 0) segments.push({ hours:carry, rate:staffRate(staffId), type:staffRateType(staffId), duty:'ยอดทบจากรอบก่อน', carry:true });
    (rows || []).slice().sort((a,b) => normDate(a?.work_date).localeCompare(normDate(b?.work_date)) || String(a?.created_at || '').localeCompare(String(b?.created_at || ''))).forEach(row => {
      rateSegmentsForRow(row).forEach(seg => segments.push(seg));
    });
    let remaining = claimed;
    const buckets = new Map();
    segments.forEach(seg => {
      if (remaining <= 0) return;
      const used = round2(Math.min(Math.max(0, seg.hours || 0), remaining));
      if (used <= 0) return;
      remaining = round2(Math.max(0, remaining - used));
      const tangCh4 = isTang(staffId) && seg.type === 'MT' && /ช4/.test(seg.duty || '');
      const label = tangCh4 ? 'MT (เฉพาะ ช4)' : seg.type;
      const key = `${label}|${seg.rate}`;
      const current = buckets.get(key) || { label, rate:seg.rate, hours:0, amount:0 };
      current.hours = round2(current.hours + used);
      current.amount = round2(current.amount + used * seg.rate);
      buckets.set(key, current);
    });
    if (remaining > 0) {
      const rate = staffRate(staffId), label = staffRateType(staffId), key = `${label}|${rate}`;
      const current = buckets.get(key) || { label, rate, hours:0, amount:0 };
      current.hours = round2(current.hours + remaining);
      current.amount = round2(current.amount + remaining * rate);
      buckets.set(key, current);
      remaining = 0;
    }
    const items = Array.from(buckets.values());
    const amount = round2(items.reduce((sum,item) => sum + item.amount, 0));
    const formula = items.length ? items.map(item => `${item.label} ${hours(item.rate, 0)} บ./ชม. × ${hours(item.hours, 2)} ชม.`).join(' + ') : '-';
    return { amount, items, formula, claimed };
  }
  function summaryHtml(staffId, rows, carryInfo){
    const current = sumCurrentHr(rows);
    const carryIn = round2(carryInfo?.amount || 0);
    const available = round2(current + carryIn);
    const claimed = Math.floor((available + 1e-7) / 8) * 8;
    const carryOut = round2(Math.max(0, available - claimed));
    const pay = claimedMoneyBreakdown(staffId, rows, carryIn, claimed);
    return `<div class="v347-claim-equation">
      <div><span>OT เดือนนี้เทียบ HR</span><b>${hours(current, 2)} ชม.</b></div>
      <div><span>OT ทบมาจากรอบก่อน</span><b>${hours(carryIn, 2)} ชม.</b></div>
      <div><span>รวมพร้อมเบิก HR</span><b>${hours(available, 2)} ชม.</b></div>
      <div class="claimed"><span>เบิก HR รอบนี้</span><b>${hours(claimed, 2)} ชม.</b></div>
      <div><span>OT ทบไปรอบหน้า</span><b>${hours(carryOut, 2)} ชม.</b></div>
      <div class="money"><span>คำนวณเป็นเงินจากยอดเบิก</span><b>${money(pay.amount)}</b><small>${esc(pay.formula)}</small></div>
    </div>`;
  }
  async function carryFor(staffId, month){
    try {
      const api = window.cnmiV318;
      if (!api || typeof api.queryCarryInSummary !== 'function') return { amount:0, sourceMonth:'' };
      const map = await api.queryCarryInSummary(month);
      return map instanceof Map ? (map.get(String(staffId)) || { amount:0, sourceMonth:'' }) : { amount:0, sourceMonth:'' };
    } catch (err) {
      console.warn(`${VERSION}: carry-in unavailable`, err);
      return { amount:0, sourceMonth:'', unavailable:true };
    }
  }
  function staffDetailCard(){
    const sid = currentSid();
    const month = selectedMonth(true);
    const rows = approvedDetails(sid, month);
    return `<div class="card wide-card v347-my-claim-card" style="grid-column:1/-1;" data-v347-staff="${esc(sid)}" data-v347-month="${esc(month)}">
      <div class="section-title"><div><h3>รายละเอียด OT ที่นำมาคำนวณเบิกของฉัน</h3><p class="hint">แสดงเฉพาะข้อมูลของบัญชีที่กำลังล็อกอิน • เดือน ${esc(month)} • รายการที่อนุมัติแล้ว</p></div></div>
      <div class="v347-summary-slot"><div class="notice soft-notice compact">กำลังตรวจสอบยอดทบและยอดเบิก HR รอบนี้…</div></div>
      ${rowTable(rows)}
    </div>`;
  }
  async function hydrateOwnCard(){
    const token = ++detailHydrationToken;
    await new Promise(resolve => setTimeout(resolve, 0));
    const card = document.querySelector('.v347-my-claim-card');
    if (!card || token !== detailHydrationToken) return;
    const sid = currentSid();
    if (!sid || String(card.dataset.v347Staff || '') !== sid) { card.remove(); return; }
    const month = String(card.dataset.v347Month || selectedMonth(true)).slice(0, 7);
    const rows = approvedDetails(sid, month);
    const carry = await carryFor(sid, month);
    if (token !== detailHydrationToken || !document.body.contains(card)) return;
    const slot = card.querySelector('.v347-summary-slot');
    if (slot) slot.innerHTML = `${summaryHtml(sid, rows, carry)}${carry.unavailable ? '<div class="notice error-notice compact">ยังอ่านยอดทบจากรอบก่อนไม่สำเร็จ กรุณารีเฟรชอีกครั้ง</div>' : ''}`;
  }
  async function showAdminDetail(staffId){
    if (!isAdminSafe()) return;
    const sid = String(staffId || '');
    const month = selectedMonth(false);
    const rows = approvedDetails(sid, month);
    const carry = await carryFor(sid, month);
    const html = `<div class="v347-admin-detail"><div class="section-title"><div><h2>รายละเอียด OT ของ ${esc(staffName(sid))}</h2><p class="hint">เดือน ${esc(month)} • แสดงรายการที่อนุมัติแล้วของบุคคลนี้เท่านั้น</p></div></div>${summaryHtml(sid, rows, carry)}${rowTable(rows, false)}${carry.unavailable ? '<div class="notice error-notice compact">ยังอ่านยอดทบจากรอบก่อนไม่สำเร็จ กรุณาปิดแล้วเปิดรายละเอียดอีกครั้ง</div>' : ''}</div>`;
    try { showModal(html); }
    catch (_) {
      const body = document.getElementById('modalBody');
      const modal = document.getElementById('modal');
      if (body) body.innerHTML = html;
      if (modal) modal.classList.remove('hidden');
    }
  }
  function readCellNumber(cell){
    const m = String(cell?.textContent || '').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : 0;
  }
  function updateClaimedMoney(){
    document.querySelectorAll('.v241-real-month-section .v241-ot-summary-table table[data-v346-prepared="1"], .v241-hr-export-section .v241-ot-summary-table table[data-v346-prepared="1"]').forEach(table => {
      const headers = Array.from(table.querySelectorAll('thead th'));
      const moneyIndex = headers.findIndex(th => String(th.textContent || '').includes('คำนวณเป็นเงิน'));
      const claimedIndex = headers.findIndex(th => String(th.textContent || '').includes('เบิก HR รอบนี้'));
      if (moneyIndex < 0 || claimedIndex < 0) return;
      let total = 0;
      Array.from(table.querySelectorAll('tbody tr')).forEach(row => {
        const staffButton = row.querySelector('[data-v347-show-staff],[data-v234-show-staff]');
        const sid = staffButton?.getAttribute('data-v347-show-staff') || staffButton?.getAttribute('data-v234-show-staff') || '';
        const claimed = readCellNumber(row.children[claimedIndex]);
        const carryIn = readCellNumber(row.querySelector('.v346-carry-in'));
        const month = selectedMonth(false);
        let detailRows = approvedDetails(sid, month);
        if (table.closest('.v241-hr-export-section')) detailRows = detailRows.filter(r => claimStatus(r) === 'Pending');
        const pay = claimedMoneyBreakdown(sid, detailRows, carryIn, claimed);
        const amount = pay.amount;
        total = round2(total + amount);
        const cell = row.children[moneyIndex];
        const signature = `${amount}|${claimed}|${pay.formula}`;
        if (cell && cell.dataset.v347ClaimedMoney !== signature) {
          cell.innerHTML = `<b>${money(amount)}</b><br><span class="muted">${esc(pay.formula)}</span>`;
          cell.title = `คิดจากเบิก HR รอบนี้ ${hours(claimed, 2)} ชั่วโมง: ${pay.formula}`;
          cell.dataset.v347ClaimedMoney = signature;
        }
      });
      if (table.closest('.v241-real-month-section')) {
        const card = table.closest('.v241-real-month-section')?.querySelector('.v241-money-cards .mini-stat.overdue');
        if (card) {
          const label = card.querySelector('span');
          const value = card.querySelector('b');
          if (label && label.textContent !== 'ยอดเงินเบิก HR รอบนี้') label.textContent = 'ยอดเงินเบิก HR รอบนี้';
          if (value && value.textContent !== money(total)) value.textContent = money(total);
        }
      }
    });
  }
  function queueMoneyRefresh(){
    if (moneyRefreshQueued) return;
    moneyRefreshQueued = true;
    requestAnimationFrame(() => {
      moneyRefreshQueued = false;
      updateClaimedMoney();
    });
  }

  if (previousRenderOtPage) {
    const wrapped = function renderOtPageV347(){
      let html = String(previousRenderOtPage.apply(this, arguments) || '');
      const active = state?.otSubtabV241 || 'mine';
      if (active === 'mine' && !isAdminSafe()) {
        setTimeout(hydrateOwnCard, 0);
        const card = staffDetailCard();
        return /<\/div>\s*<\/div>\s*$/.test(html)
          ? html.replace(/<\/div>\s*<\/div>\s*$/, `${card}</div></div>`)
          : html.replace(/<\/div>\s*$/, `${card}</div>`);
      }
      if (active === 'summary' || active === 'export') {
        html = html.replace(/data-v234-show-staff=/g, 'data-v347-show-staff=');
        [0, 80, 250, 700].forEach(ms => setTimeout(queueMoneyRefresh, ms));
      }
      return html;
    };
    try { window.renderOtPage = renderOtPage = wrapped; }
    catch (_) { window.renderOtPage = wrapped; }
  }

  document.addEventListener('click', function(e){
    const link = e.target?.closest?.('.v241-real-month-section [data-v347-show-staff]');
    if (!link || !isAdminSafe()) return;
    e.preventDefault();
    const sid = link.getAttribute('data-v347-show-staff') || '';
    if (sid) setTimeout(() => showAdminDetail(sid), 0);
  }, true);
  document.addEventListener('change', function(e){
    if (e.target?.id === 'myDutyMonthFilter') setTimeout(hydrateOwnCard, 0);
    if (['otMoneyMonthV241','otSourceMonthV241'].includes(e.target?.id)) [40, 180, 600].forEach(ms => setTimeout(queueMoneyRefresh, ms));
  }, true);

  const pageContent = document.getElementById('pageContent');
  if (pageContent && typeof MutationObserver === 'function') {
    const observer = new MutationObserver(mutations => {
      if (mutations.some(m => m.target?.closest?.('.v241-ot-summary-table') || Array.from(m.addedNodes || []).some(n => n.nodeType === 1 && (n.matches?.('.v241-ot-summary-table, .v346-claimed') || n.querySelector?.('.v241-ot-summary-table, .v346-claimed'))))) queueMoneyRefresh();
    });
    observer.observe(pageContent, { childList:true, subtree:true, characterData:true });
  }

  const style = document.createElement('style');
  style.textContent = '.v347-claim-equation{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:10px;margin:12px 0 16px}.v347-claim-equation>div{display:flex;flex-direction:column;gap:4px;padding:12px;border:1px solid #dbe7f3;border-radius:12px;background:#f8fbff}.v347-claim-equation span{color:#5f7184;font-size:12px}.v347-claim-equation b{font-size:18px}.v347-claim-equation .claimed{background:#effbf4;border-color:#ccebd8}.v347-claim-equation .money{background:#fff7ec;border-color:#f2dfc2}.v347-claim-equation small{color:#7a5a2b}.v347-detail-table th,.v347-detail-table td{vertical-align:top}.v347-admin-detail{min-width:min(100%,980px)}@media(max-width:760px){.v347-claim-equation{grid-template-columns:1fr 1fr}.v347-claim-equation .money{grid-column:1/-1}}';
  document.head.appendChild(style);

  window.cnmiV347 = { version:VERSION, approvedDetails, summaryHtml, updateClaimedMoney, showAdminDetail, claimedMoneyBreakdown, rateSegmentsForRow };
  console.info(`[${VERSION}] loaded`);
})();

} catch (error) { console.error("[v569] patch-v347-ot-claim-details-money.js", error); }
;
