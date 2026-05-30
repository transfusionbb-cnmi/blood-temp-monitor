const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwP9FDgIr8kid_XKa3yjmVCxJ_SCPPzk9eUbJPC9Md2oQNl8tzTSntuVsbmHc-hczFJ4Q/exec";

    let html5QrCode = null;
    let scannerOpen = false;

    let historyHtml5QrCode = null;
    let historyScannerOpen = false;

    let chartHtml5QrCode = null;
    let chartScannerOpen = false;

    let tempChart = null;
    let lastHistoryRecords = [];
    let lastHistoryFridgeId = '';

    let fridgeMasterList = [];
    let currentDuplicateStatus = false;
    let fridgeStatusListCache = [];

    let dashboardRowsCache = [];
    let dashboardSummaryCache = {};
    let alarmHistoryCache = [];

    let dashboardListsCache = {
      morningRecorded: [],
      morningMissing: [],
      eveningRecorded: [],
      eveningMissing: []
    };

function showPage(pageId, btn) {
  const pages = document.querySelectorAll(".main-content > section.card");

  pages.forEach(page => {
    page.classList.add("hidden");
  });

  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.remove("hidden");
  }

  document.querySelectorAll(".menu-btn").forEach(button => {
    button.classList.remove("active");
  });

  if (btn) {
    btn.classList.add("active");
  }

  if (typeof closeMobileMenu === "function") {
    closeMobileMenu();
  }
}
function openMobileMenu() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("mobileOverlay");

  if (sidebar) sidebar.classList.add("open");
  if (overlay) overlay.classList.add("show");

  document.body.classList.add("menu-open");
}

function closeMobileMenu() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("mobileOverlay");

  if (sidebar) sidebar.classList.remove("open");
  if (overlay) overlay.classList.remove("show");

  document.body.classList.remove("menu-open");
}
    
async function loadIncidentTracking() {
  const dateFilter = document.getElementById("incidentDateFilter")?.value || "today";
  const statusFilter = document.getElementById("incidentStatusFilter")?.value || "all";
  const startDate = document.getElementById("incidentStartDate")?.value || "";
  const endDate = document.getElementById("incidentEndDate")?.value || "";
  const fridgeSearch = document.getElementById("incidentFridgeSearch")?.value?.trim() || "";

  const resultBox = document.getElementById("incidentResult");
  const tbody = document.getElementById("incidentTableBody");

  if (!tbody) return;

  tbody.innerHTML = "";

  try {
    const url =
      `${WEB_APP_URL}?action=incident_list`
      + `&dateFilter=${encodeURIComponent(dateFilter)}`
      + `&statusFilter=${encodeURIComponent(statusFilter)}`
      + `&startDate=${encodeURIComponent(startDate)}`
      + `&endDate=${encodeURIComponent(endDate)}`
      + `&fridgeSearch=${encodeURIComponent(fridgeSearch)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      showResult(resultBox, true, "ไม่พบรายการ Incident");
      scrollToResult("incidentResult");
      return;
    }

    showResult(resultBox, true, `พบ ${data.length} รายการ`);
    scrollToResult("incidentResult");

    data.forEach(item => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${item.incidentId || ""}</td>
        <td>${item.foundDate || ""}</td>
        <td>${item.foundTime || ""}</td>
        <td>${item.room || ""}</td>
        <td>${item.fridgeId || ""}</td>
        <td>${item.temp ?? ""}</td>
        <td>${item.reporter || ""}</td>
        <td><span class="status-badge ${getIncidentStatusClass(item.caseStatus)}">${item.caseStatus || ""}</span></td>
        <td>${item.owner || ""}</td>
        <td>${item.actionText || ""}</td>
        <td>${item.fixResult || ""}</td>
        <td>${item.updatedDate || ""}</td>
        <td>${item.round || ""}</td>
        <td>${item.logNote || ""}</td>
      `;

      tbody.appendChild(tr);
    });

  } catch (error) {
    showResult(resultBox, false, "โหลด Incident ไม่สำเร็จ: " + error);
    scrollToResult("incidentResult");
  }
}


function getIncidentStatusClass(status) {
  if (status === "รอ BEM รับเรื่อง") return "status-red";
  if (status === "BEM รับเรื่องแล้ว / กำลังดำเนินการ") return "status-orange";
  if (status === "รอส่งซ่อม / รอช่างภายนอก") return "status-purple";
  if (status === "ปิดงาน") return "status-green";
  return "";
}
    
    
function clearIncidentTracking() {
  const filter = document.getElementById("incidentQuickFilter");
  const tbody = document.getElementById("incidentTableBody");
  const resultBox = document.getElementById("incidentResult");

  if (filter) filter.value = "all";
  if (tbody) tbody.innerHTML = "";

  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }
}

async function loadOpenIncidentList() {
  const select = document.getElementById("updateIncidentSelect");
  const resultBox = document.getElementById("updateIncidentResult");

  if (!select) return;

  const dateFilter = document.getElementById("updateIncidentDateFilter")?.value || "today";
  const statusFilter = document.getElementById("updateIncidentStatusFilter")?.value || "waiting_bem";
  const startDate = document.getElementById("updateIncidentStartDate")?.value || "";
  const endDate = document.getElementById("updateIncidentEndDate")?.value || "";
  const fridgeSearch = document.getElementById("updateIncidentFridgeSearch")?.value?.trim() || "";

  select.innerHTML = '<option value="">-- เลือก Incident ID --</option>';

  try {
    const url =
      `${WEB_APP_URL}?action=incident_list`
      + `&dateFilter=${encodeURIComponent(dateFilter)}`
      + `&statusFilter=${encodeURIComponent(statusFilter)}`
      + `&startDate=${encodeURIComponent(startDate)}`
      + `&endDate=${encodeURIComponent(endDate)}`
      + `&fridgeSearch=${encodeURIComponent(fridgeSearch)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      showResult(resultBox, true, "ไม่พบ Incident ตามตัวกรอง");
      return;
    }

    data.forEach(item => {
      const option = document.createElement("option");
      option.value = item.incidentId;
      option.textContent =
        `${item.incidentId} | ${item.foundDate || "-"} ${item.foundTime || "-"} | ${item.fridgeId || "-"} | ${item.caseStatus || "-"}`;
      select.appendChild(option);
    });

    showResult(resultBox, true, `พบ ${data.length} รายการ`);

  } catch (error) {
    showResult(resultBox, false, "โหลด Incident ไม่สำเร็จ: " + error);
  }
}

async function loadIncidentHistoryPage() {
  const select = document.getElementById("incidentHistorySelect");
  const resultBox = document.getElementById("incidentHistoryResult");

  if (!select) return;

  const dateFilter = document.getElementById("incidentHistoryDateFilter")?.value || "today";
  const statusFilter = document.getElementById("incidentHistoryStatusFilter")?.value || "all";
  const startDate = document.getElementById("incidentHistoryStartDate")?.value || "";
  const endDate = document.getElementById("incidentHistoryEndDate")?.value || "";
  const fridgeSearch = document.getElementById("incidentHistoryFridgeSearch")?.value?.trim() || "";

  select.innerHTML = '<option value="">-- เลือก Incident ID --</option>';

  try {
    const url =
      `${WEB_APP_URL}?action=incident_all_list`
      + `&dateFilter=${encodeURIComponent(dateFilter)}`
      + `&statusFilter=${encodeURIComponent(statusFilter)}`
      + `&startDate=${encodeURIComponent(startDate)}`
      + `&endDate=${encodeURIComponent(endDate)}`
      + `&fridgeSearch=${encodeURIComponent(fridgeSearch)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      showResult(resultBox, true, "ไม่พบ Incident ตามตัวกรอง");
      return;
    }

    data.forEach(item => {
      const option = document.createElement("option");
      option.value = item.incidentId;
      option.textContent =
        `${item.incidentId} | ${item.foundDate || "-"} ${item.foundTime || "-"} | ${item.fridgeId || "-"} | ${item.caseStatus || "-"}`;
      select.appendChild(option);
    });

    showResult(resultBox, true, `พบ ${data.length} รายการ`);

  } catch (error) {
    showResult(resultBox, false, "โหลดรายการ Incident ไม่สำเร็จ: " + error);
  }
}

async function loadIncidentHistory() {
  const incidentId = document.getElementById("incidentHistorySelect")?.value || "";
  const resultBox = document.getElementById("incidentHistoryResult");
  const tbody = document.getElementById("incidentHistoryTableBody");
  const timeline = document.getElementById("incidentTimeline");

  if (!incidentId) {
    showResult(resultBox, false, "กรุณาเลือก Incident");
    return;
  }

  tbody.innerHTML = "";
  timeline.innerHTML = "";

  try {
    const response = await fetch(`${WEB_APP_URL}?action=incident_history&incidentId=${encodeURIComponent(incidentId)}`);
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      showResult(resultBox, true, "ไม่พบประวัติการอัปเดต");
      return;
    }

    showResult(resultBox, true, `พบ ${data.length} รายการ`);

    data.forEach(item => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.incidentId || ""}</td>
        <td>${item.updatedAt || ""}</td>
        <td><span class="status-badge ${getIncidentStatusClass(item.caseStatus)}">${item.caseStatus || ""}</span></td>
        <td>${item.owner || ""}</td>
        <td>${item.actionText || "-"}</td>
        <td>${item.fixResult || "-"}</td>
        <td>${item.updatedBy || ""}</td>
      `;
      tbody.appendChild(tr);

      const div = document.createElement("div");
      div.className = "timeline-item";
      div.innerHTML = `
        <div class="timeline-dot"></div>
        <div class="timeline-time">${item.updatedAt || ""}</div>
        <div class="timeline-status">${item.caseStatus || ""}</div>
        <div class="timeline-body">
          <div><strong>ผู้ดำเนินการ:</strong> ${item.owner || "-"}</div>
          <div><strong>รายละเอียด:</strong> ${item.actionText || "-"}</div>
          <div><strong>ผลการแก้ไข:</strong> ${item.fixResult || "-"}</div>
          <div><strong>ผู้อัปเดต:</strong> ${item.updatedBy || "-"}</div>
        </div>
      `;
      timeline.appendChild(div);
    });

  } catch (error) {
    showResult(resultBox, false, "โหลดประวัติการอัปเดตไม่สำเร็จ: " + error);
  }
}

function clearIncidentHistory() {
  const select = document.getElementById("incidentHistorySelect");
  const resultBox = document.getElementById("incidentHistoryResult");
  const tbody = document.getElementById("incidentHistoryTableBody");
  const timeline = document.getElementById("incidentTimeline");

  if (select) select.value = "";
  if (tbody) tbody.innerHTML = "";
  if (timeline) timeline.innerHTML = "";

  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }
}

  async function loadFridgeStatusList() {
  const select = document.getElementById("statusFridgeSelect");
  const resultBox = document.getElementById("fridgeStatusResult");

  if (!select) return;

  select.innerHTML = `<option value="">-- เลือกตู้ --</option>`;

  try {
    const response = await fetch(`${WEB_APP_URL}?action=all_fridge_list`);
    const data = await response.json();

    fridgeStatusListCache = Array.isArray(data) ? data : [];

    fridgeStatusListCache.forEach(item => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = `${item.id} | ${item.name || "-"} | ${item.room || "-"} | สถานะ: ${item.status || "-"}`;
      select.appendChild(option);
    });

    showResult(resultBox, true, "โหลดรายการตู้สำเร็จ");

  } catch (error) {
    showResult(resultBox, false, "โหลดรายการตู้ไม่สำเร็จ: " + error);
  }
}

    function onStatusFridgeChange() {
  const fridgeId = document.getElementById("statusFridgeSelect")?.value || "";
  const infoBox = document.getElementById("statusFridgeInfo");

  if (!infoBox) return;

  const item = fridgeStatusListCache.find(x => x.id === fridgeId);

  if (!item) {
    infoBox.innerHTML = "กรุณาเลือกตู้";
    return;
  }

  infoBox.innerHTML = `
    <strong>รหัสตู้:</strong> ${item.id || "-"}<br>
    <strong>ชื่อตู้:</strong> ${item.name || "-"}<br>
    <strong>ประเภท:</strong> ${item.type || "-"}<br>
    <strong>สถานที่:</strong> ${item.room || "-"}<br>
    <strong>สถานะปัจจุบัน:</strong> ${item.status || "-"}<br>
    <strong>เหตุผลล่าสุด:</strong> ${item.inactiveReason || "-"}<br>
    <strong>วันที่เริ่มไม่ได้ใช้งาน:</strong> ${item.inactiveStartDate || "-"}<br>
    <strong>ผู้ปรับสถานะล่าสุด:</strong> ${item.statusUpdatedBy || "-"}<br>
    <strong>วันที่อัปเดตล่าสุด:</strong> ${item.statusUpdatedAt || "-"}<br>
    <strong>ช่วงอุณหภูมิ:</strong> ${item.minTemp ?? "-"} ถึง ${item.maxTemp ?? "-"} °C
  `;
}

    function onNewFridgeStatusChange() {
  const status = document.getElementById("newFridgeStatus")?.value || "";
  const reasonBox = document.getElementById("statusReasonBox");
  const reasonSelect = document.getElementById("statusReason");

  if (!reasonBox || !reasonSelect) return;

  if (status === "ใช้งาน") {
    reasonBox.classList.add("hidden");
    reasonSelect.value = "";
  } else {
    reasonBox.classList.remove("hidden");
  }
}

    async function submitFridgeStatusUpdate() {
  const resultBox = document.getElementById("fridgeStatusResult");

  const fridgeId = document.getElementById("statusFridgeSelect")?.value || "";
  const status = document.getElementById("newFridgeStatus")?.value || "";
  const reason = document.getElementById("statusReason")?.value || "";
  const detail = document.getElementById("statusDetail")?.value?.trim() || "";
  const updatedBy = document.getElementById("statusUpdatedBy")?.value?.trim() || "";

  if (!fridgeId) {
    showResult(resultBox, false, "กรุณาเลือกตู้");
    return;
  }

  if (!status) {
    showResult(resultBox, false, "กรุณาเลือกสถานะใหม่");
    return;
  }

  if (!updatedBy) {
    showResult(resultBox, false, "กรุณากรอกชื่อผู้ปรับสถานะ");
    return;
  }

  if (status !== "ใช้งาน" && !reason) {
    showResult(resultBox, false, "กรุณาเลือกเหตุผล");
    return;
  }

  const url =
    `${WEB_APP_URL}?action=update_fridge_status` +
    `&fridgeId=${encodeURIComponent(fridgeId)}` +
    `&status=${encodeURIComponent(status)}` +
    `&reason=${encodeURIComponent(reason)}` +
    `&detail=${encodeURIComponent(detail)}` +
    `&updatedBy=${encodeURIComponent(updatedBy)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.ok) {
      showResult(resultBox, true, data.message || "อัปเดตสถานะตู้เรียบร้อย");

      if (typeof showAppPopup === "function") {
        showAppPopup(
          true,
          "อัปเดตสถานะสำเร็จ",
          `${data.fridgeId || ""}\nสถานะใหม่: ${data.newStatus || status}`
        );
      }

      clearFridgeStatusForm();
      loadFridgeStatusList();

      if (typeof loadDashboard === "function") {
        loadDashboard();
      }

    } else {
      showResult(resultBox, false, data.message || "อัปเดตสถานะตู้ไม่สำเร็จ");

      if (typeof showAppPopup === "function") {
        showAppPopup(false, "อัปเดตไม่สำเร็จ", data.message || "กรุณาตรวจสอบข้อมูล");
      }
    }

  } catch (error) {
    showResult(resultBox, false, "อัปเดตสถานะตู้ไม่สำเร็จ: " + error);
  }
}

function clearFridgeStatusForm() {
  const statusFridgeSelect = document.getElementById("statusFridgeSelect");
  const statusFridgeInfo = document.getElementById("statusFridgeInfo");
  const newFridgeStatus = document.getElementById("newFridgeStatus");
  const statusReason = document.getElementById("statusReason");
  const statusDetail = document.getElementById("statusDetail");
  const statusUpdatedBy = document.getElementById("statusUpdatedBy");
  const resultBox = document.getElementById("fridgeStatusResult");

  if (statusFridgeSelect) statusFridgeSelect.value = "";
  if (statusFridgeInfo) statusFridgeInfo.innerHTML = "กรุณาเลือกตู้";
  if (newFridgeStatus) newFridgeStatus.value = "";
  if (statusReason) statusReason.value = "";
  if (statusDetail) statusDetail.value = "";
  if (statusUpdatedBy) statusUpdatedBy.value = "";

  onNewFridgeStatusChange();

  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }
}
    
    
function fillUpdateIncidentId() {
  const select = document.getElementById("updateIncidentSelect");
  const input = document.getElementById("updateIncidentId");

  if (select && input) {
    input.value = select.value || "";
  }
}

async function loadDashboard() {
  const resultBox = document.getElementById("dashboardResult");
  const cardContainer = document.getElementById("dashboardCardContainer");
  const title = document.getElementById("dashboardDrillTitle");

  if (!cardContainer) return;
  cardContainer.innerHTML = "";

  try {
    const dashboardDateInput = document.getElementById("dashboardDate");

    if (dashboardDateInput && !dashboardDateInput.value) {
      dashboardDateInput.value = getTodayYMD();
    }

    const selectedDate = dashboardDateInput?.value || getTodayYMD();

    const response = await fetch(
      `${WEB_APP_URL}?action=dashboard_summary&date=${encodeURIComponent(selectedDate)}`
    );
    const data = await response.json();

    if (!data.ok) {
      showResult(resultBox, false, data.message || "โหลดภาพรวมไม่สำเร็จ");
      return;
    }

    // ===== ใช้ข้อมูลจาก Apps Script รูปแบบใหม่ =====
    const summary = {
      activeFridges: data.totalActive ?? data.totalFridges ?? data.totalRequired ?? 0,
      openIncidents: data.openIncidentCount ?? data.abnormalOpenCount ?? 0,
      closedToday: data.closedIncidentCount ?? data.closedToday ?? 0,
      missingToday: data.currentMissing ?? data.missingToday ?? data.missingCount ?? 0,
      recordedToday: data.currentRecorded ?? data.recordedToday ?? data.loggedCount ?? 0,
      currentRound: data.currentRound ?? data.targetRound ?? "-"
    };

    // ===== เก็บ list แยก เช้า/เย็น จาก Apps Script =====
    dashboardListsCache = {
      morningRecorded: Array.isArray(data.morningRecordedList) ? data.morningRecordedList : [],
      morningMissing: Array.isArray(data.morningMissingList) ? data.morningMissingList : [],
      eveningRecorded: Array.isArray(data.eveningRecordedList) ? data.eveningRecordedList : [],
      eveningMissing: Array.isArray(data.eveningMissingList) ? data.eveningMissingList : []
    };

    // ===== list เดิมของรอบปัจจุบัน เอาไว้กันฟังก์ชันเดิมพัง =====
    dashboardRowsCache = Array.isArray(data.missingList)
      ? data.missingList.map(item => ({
          ...item,
          dashboardStatus: item.dashboardStatus || "missing",
          currentRound: summary.currentRound,
          latestStamp: item.latestStamp || "-",
          latestRound: item.latestRound || summary.currentRound,
          latestTemp: item.latestTemp ?? "",
          latestAction: item.latestAction || ""
        }))
      : [];

    dashboardSummaryCache = summary;

    const cardActiveFridges = document.getElementById("cardActiveFridges");
    const cardOpenIncidents = document.getElementById("cardOpenIncidents");
    const cardClosedToday = document.getElementById("cardClosedToday");
    
    const cardMorningRecorded = document.getElementById("cardMorningRecorded");
    const cardMorningMissing = document.getElementById("cardMorningMissing");
    const cardEveningRecorded = document.getElementById("cardEveningRecorded");
    const cardEveningMissing = document.getElementById("cardEveningMissing");

    if (cardActiveFridges) cardActiveFridges.innerText = summary.activeFridges;
    if (cardOpenIncidents) cardOpenIncidents.innerText = summary.openIncidents;
    if (cardClosedToday) cardClosedToday.innerText = summary.closedToday;
    
    if (cardMorningRecorded) cardMorningRecorded.innerText = data.morningRecorded ?? 0;
    if (cardMorningMissing) cardMorningMissing.innerText = data.morningMissing ?? 0;
    if (cardEveningRecorded) cardEveningRecorded.innerText = data.eveningRecorded ?? 0;
    if (cardEveningMissing) cardEveningMissing.innerText = data.eveningMissing ?? 0;


    showResult(
      resultBox,
      true,
      `โหลดภาพรวมสำเร็จ | วันที่ ${selectedDate}`
    );

  } catch (error) {
    showResult(resultBox, false, "โหลดภาพรวมไม่สำเร็จ: " + error);
  }
}

function showDashboardGroup(group) {
  const cardContainer = document.getElementById("dashboardCardContainer");
  const title = document.getElementById("dashboardDrillTitle");
  const resultBox = document.getElementById("dashboardResult");

  if (!cardContainer) return;

  cardContainer.innerHTML = "";

  let rows = [];
  let titleText = "";

  if (group === "all") {
    rows = [
      ...dashboardListsCache.morningRecorded,
      ...dashboardListsCache.morningMissing
    ];
    titleText = "รายการตู้ทั้งหมดที่ต้องติดตาม";

  } else if (group === "missing") {
    rows = dashboardRowsCache;
    titleText = "รายการตู้ที่ยังไม่บันทึกรอบปัจจุบัน";

  } else if (group === "recorded") {
    rows = [];
    titleText = "รายการตู้ที่บันทึกแล้วรอบปัจจุบัน";

  } else if (group === "morningRecorded") {
    rows = dashboardListsCache.morningRecorded;
    titleText = "รอบเช้า: รายการที่บันทึกแล้ว";

  } else if (group === "morningMissing") {
    rows = dashboardListsCache.morningMissing;
    titleText = "รอบเช้า: รายการที่ยังไม่บันทึก";

  } else if (group === "eveningRecorded") {
    rows = dashboardListsCache.eveningRecorded;
    titleText = "รอบเย็น: รายการที่บันทึกแล้ว";

  } else if (group === "eveningMissing") {
    rows = dashboardListsCache.eveningMissing;
    titleText = "รอบเย็น: รายการที่ยังไม่บันทึก";

  } else if (group === "abnormal") {
    titleText = "Incident ที่อยู่ระหว่างติดตาม";
    showResult(resultBox, true, "กรุณาดูรายละเอียดที่เมนู ติดตาม Incident");
    if (title) title.innerText = titleText;
    showPage("incidentPage", document.querySelector("button[onclick*='incidentPage']"));
    return;

  } else if (group === "closedToday") {
    titleText = "เหตุที่ปิดแล้วทั้งหมด";
    showResult(resultBox, true, "ดูรายละเอียดเคสปิดแล้วได้ที่เมนู ติดตาม Incident");
    if (title) title.innerText = titleText;
    return;
  }

  rows.sort((a, b) => {
    const aStatus = getDashboardDisplayStatus(a);
    const bStatus = getDashboardDisplayStatus(b);

    if (aStatus.sortPriority !== bStatus.sortPriority) {
      return aStatus.sortPriority - bStatus.sortPriority;
    }

    const roomCompare = (a.room || "").localeCompare(b.room || "", "th");
    if (roomCompare !== 0) return roomCompare;

    return (a.fridgeId || "").localeCompare(b.fridgeId || "", "th");
  });

  if (title) title.innerText = `${titleText} (${rows.length} รายการ)`;

  if (rows.length === 0) {
    showResult(resultBox, true, "ไม่พบรายการในกลุ่มนี้");
    return;
  }

  showResult(resultBox, true, `แสดง ${rows.length} รายการ`);

  rows.forEach(item => {
    renderDashboardCard(item, cardContainer);
  });

scrollToDashboardCards();
}


function renderDashboardCard(item, cardContainer) {
  const displayStatus = getDashboardDisplayStatus(item);
  const cardClass = getDashboardCardClass(item);

  const latestStamp = item.latestStamp || "-";
  const latestRound = item.latestRound || "-";
  const latestTemp =
    item.latestTemp !== "" &&
    item.latestTemp !== null &&
    item.latestTemp !== undefined
      ? `${item.latestTemp} °C`
      : "-";

  const latestAction = item.latestAction ? item.latestAction : "-";

  const card = document.createElement("div");
  card.className = `monitor-item-card ${cardClass}`;

  card.innerHTML = `
    <div class="monitor-card-head">
      <div class="monitor-item-top">
        <div>
          <div class="monitor-item-title">${item.fridgeId || "-"}</div>
          <div class="monitor-item-subtitle">${item.fridgeName || "-"} • ${item.room || "-"}</div>
        </div>
        <div class="monitor-status-badge ${displayStatus.className}">
          ${displayStatus.text}
        </div>
      </div>
    </div>

    <div class="monitor-card-body">
      <div class="monitor-item-info">
        <div class="monitor-item-box">
          <div class="monitor-item-label">บันทึกล่าสุด</div>
          <div class="monitor-item-value ${latestStamp === "-" ? "monitor-empty small-text" : "small-text"}">
            ${latestStamp}
          </div>
        </div>

        <div class="monitor-item-box">
          <div class="monitor-item-label">รอบ</div>
          <div class="monitor-item-value ${latestRound === "-" ? "monitor-empty" : ""}">
            ${latestRound}
          </div>
        </div>

        <div class="monitor-item-box">
          <div class="monitor-item-label">อุณหภูมิ</div>
          <div class="monitor-item-value ${latestTemp === "-" ? "monitor-empty" : ""}">
            ${latestTemp}
          </div>
        </div>

        <div class="monitor-item-box">
          <div class="monitor-item-label">หมายเหตุ</div>
          <div class="monitor-item-value ${latestAction === "-" ? "monitor-empty small-text" : "small-text"}">
            ${latestAction}
          </div>
        </div>
      </div>

      <div class="monitor-card-foot">
        <div><strong>ช่วงควบคุม:</strong> ${item.minTemp} ถึง ${item.maxTemp} °C</div>
        <div><strong>ต้องบันทึกประจำวัน:</strong> ${item.requireDaily || "-"}</div>
      </div>
    </div>
  `;

  cardContainer.appendChild(card);
}
    
async function checkDuplicateBeforeSave() {
  const date = document.getElementById("date")?.value || "";
  const round = document.getElementById("round")?.value || "";
  const time = document.getElementById("time")?.value || "";
  const fridgeId = document.getElementById("fridgeId")?.value?.trim() || "";
  const resultBox = document.getElementById("result");
  const submitBtn = document.getElementById("submitBtn");

  if (!date || !round || !fridgeId) return false;

  try {
    const url =
      `${WEB_APP_URL}?action=check_duplicate` +
      `&date=${encodeURIComponent(date)}` +
      `&round=${encodeURIComponent(round)}` +
      `&time=${encodeURIComponent(time)}` +
      `&fridgeId=${encodeURIComponent(fridgeId)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.ok && data.duplicate) {
      const detail = data.data || {};
      const duplicateMessage =
        `เวลา: ${detail.time || time || "-"}\n` +
        `รอบ: ${detail.round || round || "-"}\n` +
        `อุณหภูมิ: ${detail.temp ?? "-"} °C\n` +
        `ผู้บันทึก: ${detail.recorderName || "-"}`;

      showAppPopup(
        false,
        "บันทึกซ้ำไม่ได้",
        duplicateMessage
      );

      showResult(
        resultBox,
        false,
        `${data.message || "รายการนี้ถูกบันทึกแล้ว"}\n${duplicateMessage}`
      );

      if (submitBtn) submitBtn.disabled = true;
      return true;
    }

    return false;
  } catch (error) {
    console.error("checkDuplicateBeforeSave error:", error);
    return false;
  }
}


function onIncidentStatusChange() {
  const statusEl = document.getElementById("updateCaseStatus");
  const actionEl = document.getElementById("updateActionText");

  if (!statusEl) return;

  const status = statusEl.value;

  if (status === "ยกเลิกเคส") {
    const ok = confirm(
      "ยืนยันยกเลิก Incident นี้หรือไม่?\n\nใช้เฉพาะกรณีคีย์ผิด / เลือกตู้ผิด / เปิดเคสผิดเท่านั้น"
    );

    if (!ok) {
      statusEl.value = "";
      return;
    }

    if (actionEl && !actionEl.value.trim()) {
      actionEl.placeholder = "กรุณาระบุเหตุผลการยกเลิก เช่น คีย์ผิด / เลือกตู้ผิด / บันทึกผิดเคส";
      actionEl.focus();
    }
  }
}
    

function getDashboardDisplayStatus(item) {
  if (item.dashboardStatus === "missing") {
    return {
      text: "ยังไม่บันทึก",
      className: "status-orange",
      sortPriority: 2
    };
  }

  if (item.dashboardStatus === "recorded") {
    return {
      text: "บันทึกแล้ว",
      className: "status-green",
      sortPriority: 3
    };
  }

  if (item.dashboardStatus === "abnormal") {
    return {
      text: "ผิดปกติ",
      className: "status-red",
      sortPriority: 1
    };
  }

  return {
    text: "ไม่ทราบสถานะ",
    className: "",
    sortPriority: 9
  };
}

    
function getDashboardCardClass(item) {
  if (item.dashboardStatus === "missing") {
    return "monitor-card-orange";
  }

  if (item.dashboardStatus === "recorded") {
    return "monitor-card-green";
  }

  if (item.dashboardStatus === "abnormal") {
    return "monitor-card-red";
  }

  return "monitor-card-green";
}
    

function clearDashboard() {
  const resultBox = document.getElementById("dashboardResult");
  const cardContainer = document.getElementById("dashboardCardContainer");
  const title = document.getElementById("dashboardDrillTitle");

  if (cardContainer) cardContainer.innerHTML = "";

  const cardActiveFridges = document.getElementById("cardActiveFridges");
  const cardOpenIncidents = document.getElementById("cardOpenIncidents");
  const cardClosedToday = document.getElementById("cardClosedToday");
  
  const cardMorningRecorded = document.getElementById("cardMorningRecorded");
  const cardMorningMissing = document.getElementById("cardMorningMissing");
  const cardEveningRecorded = document.getElementById("cardEveningRecorded");
  const cardEveningMissing = document.getElementById("cardEveningMissing");

  if (cardActiveFridges) cardActiveFridges.innerText = "0";
  if (cardOpenIncidents) cardOpenIncidents.innerText = "0";
  if (cardClosedToday) cardClosedToday.innerText = "0";
  
  if (cardMorningRecorded) cardMorningRecorded.innerText = "0";
  if (cardMorningMissing) cardMorningMissing.innerText = "0";
  if (cardEveningRecorded) cardEveningRecorded.innerText = "0";
  if (cardEveningMissing) cardEveningMissing.innerText = "0";

  dashboardRowsCache = [];
  dashboardSummaryCache = {};

  if (title) {
    title.innerText = "เลือกการ์ดด้านบนเพื่อดูรายละเอียด";
  }

  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }
}

function getDashboardStatusClass(status) {
  if (status === "ปกติ" || status === "บันทึกแล้ว") return "status-green";
  if (status === "ผิดปกติ") return "status-red";
  if (status === "ยังไม่บันทึก") return "status-orange";
  return "";
}
    
async function submitIncidentUpdate() {
  const incidentId = document.getElementById("updateIncidentId")?.value?.trim() || "";
  const caseStatus = document.getElementById("updateCaseStatus")?.value?.trim() || "";
  const owner = document.getElementById("updateOwner")?.value?.trim() || "";
  const actionText = document.getElementById("updateActionText")?.value?.trim() || "";
  const fixResult = document.getElementById("updateFixResult")?.value?.trim() || "";
  const updatedBy = owner;
  const resultBox = document.getElementById("updateIncidentResult");

  if (!incidentId || !caseStatus) {
    showResult(resultBox, false, "กรุณาเลือก Incident ID และสถานะเคส");
    return;
  }

  if (!owner) {
    showResult(resultBox, false, "กรุณากรอกผู้ดำเนินการ / ผู้รับผิดชอบ");
    return;
  }

  const url = `${WEB_APP_URL}?action=incident_update`
    + `&incidentId=${encodeURIComponent(incidentId)}`
    + `&caseStatus=${encodeURIComponent(caseStatus)}`
    + `&owner=${encodeURIComponent(owner)}`
    + `&actionText=${encodeURIComponent(actionText)}`
    + `&fixResult=${encodeURIComponent(fixResult)}`
    + `&updatedBy=${encodeURIComponent(updatedBy)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.ok) {
      showAppPopup(
        true,
        "บันทึกสำเร็จ",
        `${data.fridgeName || ""}\nสถานะ: ${data.status || "-"}`
      );

  showResult(resultBox, true, data.message || "บันทึกสำเร็จ");
      clearIncidentUpdateForm();
      loadOpenIncidentList();
    } else {
      showAppPopup(false, "บันทึกไม่สำเร็จ", data.message || "กรุณาตรวจสอบข้อมูล");
      showResult(resultBox, false, data.message || "บันทึกไม่สำเร็จ");
    }
  } catch (error) {
    showResult(resultBox, false, "อัปเดต Incident ไม่สำเร็จ: " + error);
  }
}


function openMobileMenu() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("mobileOverlay");

  if (sidebar) sidebar.classList.add("open");
  if (overlay) overlay.classList.add("show");
}

function closeMobileMenu() {
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("mobileOverlay");

  if (sidebar) sidebar.classList.remove("open");
  if (overlay) overlay.classList.remove("show");
}    
    

async function loadTodayLogStatus() {
  const fridgeId = document.getElementById("fridgeId")?.value?.trim() || "";
  const round = document.getElementById("round")?.value?.trim() || "";
  const box = document.getElementById("todayLogStatusBox");
  const submitBtn = document.getElementById("submitBtn");

  currentDuplicateStatus = false;

  if (!box) return;

  if (!fridgeId) {
    box.classList.add("hidden");
    box.innerHTML = "";
    validateForm();
    return;
  }

  try {
    const url =
      `${WEB_APP_URL}?action=today_log_status` +
      `&fridgeId=${encodeURIComponent(fridgeId)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok) {
      box.classList.remove("hidden");
      box.innerHTML = `<div class="today-log-duplicate">โหลดสถานะวันนี้ไม่สำเร็จ</div>`;
      validateForm();
      return;
    }

    const morning = data.data?.morning;
    const evening = data.data?.evening;

    let morningText = "";
    let eveningText = "";

    if (morning) {
      morningText =
        `<div class="today-log-ok">
          รอบเช้า: มีแล้ว | เวลา ${morning.time || "-"} | Temp ${morning.temp ?? "-"} °C | ผู้บันทึก ${morning.recorderName || "-"}
        </div>`;
    } else {
      morningText =
        `<div class="today-log-missing">
          รอบเช้า: ยังไม่มี
        </div>`;
    }

    if (evening) {
      eveningText =
        `<div class="today-log-ok">
          รอบเย็น: มีแล้ว | เวลา ${evening.time || "-"} | Temp ${evening.temp ?? "-"} °C | ผู้บันทึก ${evening.recorderName || "-"}
        </div>`;
    } else {
      eveningText =
        `<div class="today-log-missing">
          รอบเย็น: ยังไม่มี
        </div>`;
    }

    box.classList.remove("hidden");
    box.innerHTML = `
      <div class="today-log-status-title">สถานะการบันทึกวันนี้</div>
      ${morningText}
      ${eveningText}
    `;

    if (round === "เช้า" && morning) {
      currentDuplicateStatus = true;
    }

    if (round === "เย็น" && evening) {
      currentDuplicateStatus = true;
    }

    if (currentDuplicateStatus) {
      box.innerHTML += `
        <div class="today-log-duplicate">
          ⚠️ รอบที่เลือกถูกบันทึกแล้ว ระบบจะไม่อนุญาตให้บันทึกซ้ำ
        </div>
      `;
      if (submitBtn) submitBtn.disabled = true;
    }

    validateForm();

  } catch (error) {
    console.error("loadTodayLogStatus error:", error);
    box.classList.remove("hidden");
    box.innerHTML = `<div class="today-log-duplicate">เชื่อมต่อระบบตรวจสอบข้อมูลวันนี้ไม่ได้</div>`;
  }
}
    
function toggleIncidentHistoryCustomDate() {
  const filter = document.getElementById("incidentHistoryDateFilter")?.value || "";
  const startBox = document.getElementById("incidentHistoryStartDateBox");
  const endBox = document.getElementById("incidentHistoryEndDateBox");

  if (filter === "custom") {
    if (startBox) startBox.classList.remove("hidden");
    if (endBox) endBox.classList.remove("hidden");
  } else {
    if (startBox) startBox.classList.add("hidden");
    if (endBox) endBox.classList.add("hidden");
  }
}

function toggleUpdateIncidentCustomDate() {
  const filter = document.getElementById("updateIncidentDateFilter")?.value || "";
  const startBox = document.getElementById("updateIncidentStartDateBox");
  const endBox = document.getElementById("updateIncidentEndDateBox");

  if (filter === "custom") {
    startBox?.classList.remove("hidden");
    endBox?.classList.remove("hidden");
  } else {
    startBox?.classList.add("hidden");
    endBox?.classList.add("hidden");
  }
}


function clearUpdateIncidentFilter() {
  document.getElementById("updateIncidentDateFilter").value = "today";
  document.getElementById("updateIncidentStatusFilter").value = "waiting_bem";
  document.getElementById("updateIncidentFridgeSearch").value = "";
  document.getElementById("updateIncidentStartDate").value = "";
  document.getElementById("updateIncidentEndDate").value = "";

  toggleUpdateIncidentCustomDate();
  loadOpenIncidentList();
}    


function clearIncidentUpdateForm() {
  const ids = [
    "updateIncidentSelect",
    "updateIncidentId",
    "updateCaseStatus",
    "updateOwner",
    "updateActionText",
    "updateFixResult",
    "updateBy"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = "";
  });

  const resultBox = document.getElementById("updateIncidentResult");
  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }

  loadOpenIncidentList();
}
    
function clearHistoryViewOnly() {
  const resultBox = document.getElementById("historyResult");
  const tbody = document.getElementById("historyTableBody");

  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }

  if (tbody) {
    tbody.innerHTML = "";
  }

  lastHistoryRecords = [];
  lastHistoryFridgeId = "";
}

function clearChartOnly() {
  if (tempChart) {
    tempChart.destroy();
    tempChart = null;
  }
}

function clearChartViewOnly() {
  const resultBox = document.getElementById("chartResult");

  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }

  clearChartOnly();
}

    async function loadFridgeList() {
  try {
    const url = `${WEB_APP_URL}?action=list`;
    const response = await fetch(url);
    const data = await response.json();

    fridgeMasterList = data || [];
    console.log("fridgeMasterList =", fridgeMasterList);

    populateRoomDropdown("roomSelect");
    populateRoomDropdown("historyRoomSelect");
    populateRoomDropdown("chartRoomSelect");
  } catch (error) {
    console.error("โหลดรายการตู้ไม่สำเร็จ", error);
  }
}

function populateRoomDropdown(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const rooms = [...new Set(
    fridgeMasterList
      .map(item => (item.room || "").trim())
      .filter(room => room)
  )].sort();

  select.innerHTML = '<option value="">-- เลือกห้อง --</option>';

  rooms.forEach(room => {
    const option = document.createElement("option");
    option.value = room;
    option.textContent = room;
    select.appendChild(option);
  });
}

function scrollToResult(id) {
  const el = document.getElementById(id);
  if (!el) return;

  setTimeout(() => {
    const yOffset = window.innerWidth <= 768 ? -120 : -20;
    const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;

    window.scrollTo({
      top: y,
      behavior: "smooth"
    });
  }, 200);
}
    
    
function populateFridgeDropdown(selectId, roomValue) {
  const select = document.getElementById(selectId);
  if (!select) return;

  select.innerHTML = '<option value="">-- เลือกตู้ --</option>';

  const filtered = fridgeMasterList.filter(item => {
    if (!roomValue) return true;
    return (item.room || "").trim() === roomValue.trim();
  });

  filtered.forEach(item => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = `${item.id} - ${item.name}`;
    select.appendChild(option);
  });
}

function normalizeScanText(text) {
  return String(text || "").trim().toUpperCase();
}

function findFridgeByFullId(scannedText) {
  const key = normalizeScanText(scannedText);

  return fridgeMasterList.find(item => {
    return normalizeScanText(item.id) === key;
  }) || null;
}

function showInvalidFullQrMessage(scannedText) {
  alert(
    `ไม่พบรหัสตู้แบบเต็มในระบบ: ${scannedText}\n\n` +
    `กรุณาใช้ QR รหัสเต็ม เช่น CN-B-00307-TOP หรือ CN-B-00307-BOTTOM`
  );
}
    
function applyScannedFridgeToForm(scannedText) {
  const item = findFridgeByFullId(scannedText);

  if (!item) {
    showInvalidFullQrMessage(scannedText);
    return;
  }

  const roomSelect = document.getElementById("roomSelect");
  const fridgeSelect = document.getElementById("fridgeSelect");
  const fridgeIdInput = document.getElementById("fridgeId");

  if (roomSelect) {
    roomSelect.value = item.room || "";
    populateFridgeDropdown("fridgeSelect", item.room || "");
  }

  if (fridgeSelect) {
    fridgeSelect.value = item.id;
  }

  if (fridgeIdInput) {
    fridgeIdInput.value = item.id;
  }

  selectedFridgeInfo = item;
  setRoundTimeFromMaster();
  validateForm();
}

function applyScannedFridgeToHistory(scannedText) {
  const item = findFridgeByFullId(scannedText);

  if (!item) {
    showInvalidFullQrMessage(scannedText);
    return;
  }

  const roomSelect = document.getElementById("historyRoomSelect");
  const fridgeSelect = document.getElementById("historyFridgeSelect");
  const fridgeIdInput = document.getElementById("historyFridgeId");

  if (roomSelect) {
    roomSelect.value = item.room || "";
    populateFridgeDropdown("historyFridgeSelect", item.room || "");
  }

  if (fridgeSelect) {
    fridgeSelect.value = item.id;
  }

  if (fridgeIdInput) {
    fridgeIdInput.value = item.id;
  }
}

function applyScannedFridgeToChart(scannedText) {
  const item = findFridgeByFullId(scannedText);

  if (!item) {
    showInvalidFullQrMessage(scannedText);
    return;
  }

  const roomSelect = document.getElementById("chartRoomSelect");
  const fridgeSelect = document.getElementById("chartFridgeSelect");
  const fridgeIdInput = document.getElementById("chartFridgeId");

  if (roomSelect) {
    roomSelect.value = item.room || "";
    populateFridgeDropdown("chartFridgeSelect", item.room || "");
  }

  if (fridgeSelect) {
    fridgeSelect.value = item.id;
  }

  if (fridgeIdInput) {
    fridgeIdInput.value = item.id;
  }
}
    
    
function onRoomChange() {
  const room = document.getElementById("roomSelect").value;
  populateFridgeDropdown("fridgeSelect", room);

  document.getElementById("fridgeSelect").value = "";
  document.getElementById("fridgeId").value = "";
  selectedFridgeInfo = null;

  const round = document.getElementById("round")?.value || "";
  const timeEl = document.getElementById("time");

  if (timeEl) {
    if (round) {
      setRoundTimeFromMaster();
    } else {
      timeEl.value = "";
    }
  }

  validateForm();
}

function onHistoryRoomChange() {
  const room = document.getElementById("historyRoomSelect").value;
  populateFridgeDropdown("historyFridgeSelect", room);

  document.getElementById("historyFridgeSelect").value = "";
  document.getElementById("historyFridgeId").value = "";
}

function onChartRoomChange() {
  const room = document.getElementById("chartRoomSelect").value;
  populateFridgeDropdown("chartFridgeSelect", room);

  document.getElementById("chartFridgeSelect").value = "";
  document.getElementById("chartFridgeId").value = "";
}

function onChartSelectChange() {
  const select = document.getElementById("chartFridgeSelect");
  const input = document.getElementById("chartFridgeId");

  if (select && input) {
    input.value = select.value;
  }
}
    
function onSelectChange() {
  const select = document.getElementById("fridgeSelect");
  const fridgeIdInput = document.getElementById("fridgeId");

  if (select && fridgeIdInput) {
    fridgeIdInput.value = select.value;
    selectedFridgeInfo = fridgeMasterList.find(item => item.id === select.value) || null;
  }

  setRoundTimeFromMaster();
  loadTodayLogStatus();
  validateForm();
}

function onHistorySelectChange() {
  const select = document.getElementById("historyFridgeSelect");
  const input = document.getElementById("historyFridgeId");

  if (select && input) {
    input.value = select.value;
  }
}

async function toggleHistoryScanner() {
  const reader = document.getElementById("historyReader");

  if (!historyScannerOpen) {
    reader.classList.remove("hidden");

    historyHtml5QrCode = new Html5Qrcode("historyReader");
    historyScannerOpen = true;

    try {
      await historyHtml5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          applyScannedFridgeToHistory(decodedText.trim());
          stopHistoryScanner();
        },
        () => {}
      );
    } catch (err) {
      showResult(document.getElementById("historyResult"), false, "เปิดกล้องไม่ได้: " + err);
      historyScannerOpen = false;
    }
  } else {
    stopHistoryScanner();
  }
}


    
function stopHistoryScanner() {
  const reader = document.getElementById("historyReader");

  if (historyHtml5QrCode && historyScannerOpen) {
    historyHtml5QrCode.stop()
      .then(() => {
        historyHtml5QrCode.clear();
        reader.classList.add("hidden");
        historyScannerOpen = false;
      })
      .catch(() => {
        reader.classList.add("hidden");
        historyScannerOpen = false;
      });
  }
}

async function toggleChartScanner() {
  const reader = document.getElementById("chartReader");

  if (!chartScannerOpen) {
    reader.classList.remove("hidden");

    chartHtml5QrCode = new Html5Qrcode("chartReader");
    chartScannerOpen = true;

    try {
      await chartHtml5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 220 },
        (decodedText) => {
          applyScannedFridgeToChart(decodedText.trim());
          stopChartScanner();
        },
        () => {}
      );
    } catch (err) {
      showResult(document.getElementById("chartResult"), false, "เปิดกล้องไม่ได้: " + err);
      chartScannerOpen = false;
    }
  } else {
    stopChartScanner();
  }
}

function onFridgeIdInput() {
  const fridgeIdInput = document.getElementById("fridgeId");
  const fridgeId = fridgeIdInput?.value?.trim() || "";

  if (!fridgeId) {
    selectedFridgeInfo = null;
    validateForm();
    return;
  }

  const item = findFridgeByFullId(fridgeId);

  if (item) {
    const roomSelect = document.getElementById("roomSelect");
    const fridgeSelect = document.getElementById("fridgeSelect");

    if (roomSelect) {
      roomSelect.value = item.room || "";
      populateFridgeDropdown("fridgeSelect", item.room || "");
    }

    if (fridgeSelect) {
      fridgeSelect.value = item.id;
    }

    if (fridgeIdInput) {
      fridgeIdInput.value = item.id;
    }

    selectedFridgeInfo = item;
    setRoundTimeFromMaster();
  } else {
    selectedFridgeInfo = null;
  }

  loadTodayLogStatus();
  validateForm();
}

function onHistoryFridgeIdInput() {
  const text = document.getElementById("historyFridgeId")?.value?.trim() || "";
  if (!text) return;
  const item = findFridgeByFullId(text);
  if (!item) return;

  const roomSelect = document.getElementById("historyRoomSelect");
  const fridgeSelect = document.getElementById("historyFridgeSelect");

  if (roomSelect) {
    roomSelect.value = item.room || "";
    populateFridgeDropdown("historyFridgeSelect", item.room || "");
  }

  if (fridgeSelect) {
    fridgeSelect.value = item.id;
  }

  document.getElementById("historyFridgeId").value = item.id;
}

function onChartFridgeIdInput() {
  const text = document.getElementById("chartFridgeId")?.value?.trim() || "";
  if (!text) return;
  const item = findFridgeByFullId(text);
  if (!item) return;

  const roomSelect = document.getElementById("chartRoomSelect");
  const fridgeSelect = document.getElementById("chartFridgeSelect");

  if (roomSelect) {
    roomSelect.value = item.room || "";
    populateFridgeDropdown("chartFridgeSelect", item.room || "");
  }

  if (fridgeSelect) {
    fridgeSelect.value = item.id;
  }

  document.getElementById("chartFridgeId").value = item.id;
}

    
function setRoundTimeFromMaster() {
  setTimeByRound();
}
    
function stopChartScanner() {
  const reader = document.getElementById("chartReader");

  if (chartHtml5QrCode && chartScannerOpen) {
    chartHtml5QrCode.stop()
      .then(() => {
        chartHtml5QrCode.clear();
        reader.classList.add("hidden");
        chartScannerOpen = false;
      })
      .catch(() => {
        reader.classList.add("hidden");
        chartScannerOpen = false;
      });
  }
}
    
    function setToday() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const yyyy2 = twoYearsAgo.getFullYear();
  const mm2 = String(twoYearsAgo.getMonth() + 1).padStart(2, '0');
  const dd2 = String(twoYearsAgo.getDate()).padStart(2, '0');
  const twoYearsAgoStr = `${yyyy2}-${mm2}-${dd2}`;

  const dateEl = document.getElementById("date");
  const startDateEl = document.getElementById("startDate");
  const endDateEl = document.getElementById("endDate");
  const chartStartDateEl = document.getElementById("chartStartDate");
  const chartEndDateEl = document.getElementById("chartEndDate");

  if (dateEl) dateEl.value = todayStr;
  if (startDateEl) startDateEl.value = twoYearsAgoStr;
  if (endDateEl) endDateEl.value = todayStr;
  if (chartStartDateEl) chartStartDateEl.value = todayStr;
  if (chartEndDateEl) chartEndDateEl.value = todayStr;
}

function resetFormState() {
  selectedFridgeInfo = null;

  const roundEl = document.getElementById("round");
  const roomEl = document.getElementById("roomSelect");
  const fridgeSelectEl = document.getElementById("fridgeSelect");
  const fridgeIdEl = document.getElementById("fridgeId");
  const tempEl = document.getElementById("temp");
  const timeEl = document.getElementById("time");
  const recorderEl = document.getElementById("recorderName");
  const noteEl = document.getElementById("note");
  const resultEl = document.getElementById("result");
  const recordTypeEl = document.getElementById("recordType");
  const noTempReasonEl = document.getElementById("noTempReason");
  const noTempDetailEl = document.getElementById("noTempDetail");
  const noTempReasonBox = document.getElementById("noTempReasonBox");
  const noTempDetailBox = document.getElementById("noTempDetailBox");

  if (roundEl) roundEl.value = "";
  if (roomEl) roomEl.value = "";
  if (fridgeSelectEl) fridgeSelectEl.innerHTML = '<option value="">-- เลือกตู้ --</option>';
  if (fridgeIdEl) fridgeIdEl.value = "";
  if (tempEl) tempEl.value = "";
  if (timeEl) timeEl.value = "";
  if (recorderEl) recorderEl.value = "";
  if (noteEl) {
    noteEl.value = "";
    noteEl.placeholder = "ถ้ามี";
    noteEl.classList.remove("required-warning");
  }
  if (recordTypeEl) recordTypeEl.value = "TEMP";
  if (noTempReasonEl) noTempReasonEl.value = "";
  if (noTempDetailEl) noTempDetailEl.value = "";
  if (noTempReasonBox) noTempReasonBox.classList.add("hidden");
  if (noTempDetailBox) noTempDetailBox.classList.add("hidden");
  if (tempEl) {
    tempEl.disabled = false;
    tempEl.placeholder = "เช่น 4.0";
  }

  if (resultEl) {
    resultEl.style.display = "none";
    resultEl.innerText = "";
    resultEl.className = "result";
  }
}
    
async function submitForm() {
  const date = document.getElementById("date")?.value || "";
  const round = document.getElementById("round")?.value || "";
  const time = document.getElementById("time")?.value || "";
  const fridgeId = document.getElementById("fridgeId")?.value?.trim() || "";
  const temp = document.getElementById("temp")?.value?.trim() || "";
  const recorderName = document.getElementById("recorderName")?.value?.trim() || "";
  const note = document.getElementById("note")?.value?.trim() || "";
  const resultBox = document.getElementById("result");

  const recordType = document.getElementById("recordType")?.value || "TEMP";
  const noTempReason = document.getElementById("noTempReason")?.value?.trim() || "";
  const noTempDetail = document.getElementById("noTempDetail")?.value?.trim() || "";

  if (!date || !round || !fridgeId || !time || !recorderName) {
    const missing = [];
    if (!date) missing.push("วันที่");
    if (!round) missing.push("รอบ");
    if (!fridgeId) missing.push("รหัสตู้");
    if (!time) missing.push("เวลา");
    if (!recorderName) missing.push("ชื่อผู้บันทึก");

    const message = `กรุณากรอกข้อมูลให้ครบ\nขาด: ${missing.join(", ")}`;

    showAppPopup(false, "ข้อมูลไม่ครบ", message);
    showResult(resultBox, false, message);
    validateForm();
    return;
  }

  if (recordType === "TEMP" && !temp) {
    showAppPopup(false, "ข้อมูลไม่ครบ", "กรุณากรอกอุณหภูมิ");
    showResult(resultBox, false, "กรุณากรอกอุณหภูมิ");
    validateForm();
    return;
  }

  if (recordType === "NO_TEMP" && (!noTempReason || !noTempDetail)) {
    const missing = [];
    if (!noTempReason) missing.push("เหตุผลที่ไม่สามารถวัดอุณหภูมิได้");
    if (!noTempDetail) missing.push("รายละเอียดเพิ่มเติม");

    const message =
      `กรุณาระบุเหตุผลและรายละเอียดที่ไม่สามารถวัดอุณหภูมิได้\nขาด: ${missing.join(", ")}`;

    showAppPopup(false, "ข้อมูลไม่ครบ", message);
    showResult(resultBox, false, message);
    validateForm();
    return;
  }

  const isDuplicate = await checkDuplicateBeforeSave();
  if (isDuplicate) {
    return;
  }

  let isAbnormal = false;

  if (recordType === "TEMP" && selectedFridgeInfo) {
    const tempNum = Number(temp);
    const minTemp = Number(selectedFridgeInfo.minTemp);
    const maxTemp = Number(selectedFridgeInfo.maxTemp);

    if (!isNaN(tempNum) && !isNaN(minTemp) && !isNaN(maxTemp)) {
      isAbnormal = tempNum < minTemp || tempNum > maxTemp;
    }
  }

  if (recordType === "TEMP" && isAbnormal && !note) {
    showAppPopup(
      false,
      "บันทึกไม่สำเร็จ",
      "อุณหภูมิผิดปกติ กรุณากรอกการดำเนินการ"
    );

    showResult(resultBox, false, "อุณหภูมิผิดปกติ กรุณากรอกการดำเนินการ");
    validateForm();
    return;
  }

  const params = new URLSearchParams();

  params.set("date", date);
  params.set("round", round);
  params.set("time", time);
  params.set("fridgeId", fridgeId);
  params.set("temp", recordType === "NO_TEMP" ? "-" : temp);
  params.set("recorderName", recorderName);
  params.set("note", note);
  params.set("recordType", recordType);
  params.set("noTempReason", noTempReason);
  params.set("noTempDetail", noTempDetail);

  try {
    const response = await fetch(`${WEB_APP_URL}?${params.toString()}`);
    const data = await response.json();

    if (data.ok) {
      showAppPopup(
        true,
        "บันทึกสำเร็จ",
        buildTemperaturePopupMessage(data)
      );

      showResult(resultBox, true, data.message || "บันทึกสำเร็จ");

      clearForm();
      loadDashboard();

    } else {
      showAppPopup(
        false,
        "บันทึกไม่สำเร็จ",
        data.message || "กรุณาตรวจสอบข้อมูล"
      );

      showResult(resultBox, false, data.message || "บันทึกไม่สำเร็จ");
    }

  } catch (error) {
    showAppPopup(
      false,
      "บันทึกไม่สำเร็จ",
      String(error)
    );

    showResult(resultBox, false, "บันทึกไม่สำเร็จ: " + error);
  }
}

function clearForm() {
  const roomSelect = document.getElementById("roomSelect");
  const fridgeSelect = document.getElementById("fridgeSelect");
  const fridgeId = document.getElementById("fridgeId");
  const temp = document.getElementById("temp");
  const recorderName = document.getElementById("recorderName");
  const note = document.getElementById("note");
  const result = document.getElementById("result");
  const round = document.getElementById("round");
  const time = document.getElementById("time");

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const date = document.getElementById("date");
  if (date) date.value = todayStr;

  if (roomSelect) roomSelect.value = "";
  if (fridgeSelect) fridgeSelect.innerHTML = '<option value="">-- เลือกตู้ --</option>';
  if (fridgeId) fridgeId.value = "";
  if (temp) temp.value = "";
  if (recorderName) recorderName.value = "";
  if (note) note.value = "";

  selectedFridgeInfo = null;

  if (result) {
    result.style.display = "none";
    result.innerText = "";
    result.className = "result";
  }

  if (round) round.value = "";
  if (time) time.value = "";

  const todayLogStatusBox = document.getElementById("todayLogStatusBox");

  if (todayLogStatusBox) {
    todayLogStatusBox.classList.add("hidden");
    todayLogStatusBox.innerHTML = "";
  }

  currentDuplicateStatus = false;

  validateForm();
  }
    
async function loadHistory() {
  const fridgeId = document.getElementById("historyFridgeId").value.trim();
  const startDate = document.getElementById("startDate").value;
  const endDate = document.getElementById("endDate").value;
  const resultBox = document.getElementById("historyResult");
  const tbody = document.getElementById("historyTableBody");

  if (!fridgeId || !startDate || !endDate) {
    showResult(resultBox, false, "กรุณากรอกข้อมูลให้ครบ");
    return;
  }

  const url =
    `${WEB_APP_URL}?action=history&fridgeId=${encodeURIComponent(fridgeId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok) {
      showResult(resultBox, false, data.message);
      scrollToResult("historyResult");
      tbody.innerHTML = "";
      return;
    }

    showResult(
      resultBox,
      true,
      `พบข้อมูล ${data.total} รายการ
ตู้: ${data.fridgeName || "-"}
ช่วงอุณหภูมิ: ${data.minTemp} ถึง ${data.maxTemp} °C`
    );

    scrollToResult("historyResult");

  } catch (error) {
    showResult(resultBox, false, "โหลดข้อมูลไม่ได้: " + error);
    scrollToResult("historyResult");
  }
}

function clearHistoryForm() {
  const historyRoomSelect = document.getElementById("historyRoomSelect");
  const historyFridgeSelect = document.getElementById("historyFridgeSelect");
  const historyFridgeId = document.getElementById("historyFridgeId");
  const startDate = document.getElementById("startDate");
  const endDate = document.getElementById("endDate");
  const historyResult = document.getElementById("historyResult");
  const historyTableBody = document.getElementById("historyTableBody");
  const historyReader = document.getElementById("historyReader");

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const yyyy2 = twoYearsAgo.getFullYear();
  const mm2 = String(twoYearsAgo.getMonth() + 1).padStart(2, '0');
  const dd2 = String(twoYearsAgo.getDate()).padStart(2, '0');
  const twoYearsAgoStr = `${yyyy2}-${mm2}-${dd2}`;

  if (historyRoomSelect) historyRoomSelect.value = "";
  if (historyFridgeSelect) historyFridgeSelect.innerHTML = '<option value="">-- เลือกตู้ --</option>';
  if (historyFridgeId) historyFridgeId.value = "";
  if (startDate) startDate.value = twoYearsAgoStr;
  if (endDate) endDate.value = todayStr;

  if (historyResult) {
    historyResult.style.display = "none";
    historyResult.innerText = "";
    historyResult.className = "result";
  }

  if (historyTableBody) {
    historyTableBody.innerHTML = "";
  }

  if (historyReader) {
    historyReader.classList.add("hidden");
  }

  lastHistoryRecords = [];
  lastHistoryFridgeId = '';
}
    
async function loadChartData() {
  const fridgeId = document.getElementById("chartFridgeId").value.trim();
  const startDate = document.getElementById("chartStartDate").value;
  const endDate = document.getElementById("chartEndDate").value;
  const resultBox = document.getElementById("chartResult");

  if (!fridgeId || !startDate || !endDate) {
    showResult(resultBox, false, "กรุณากรอกข้อมูลให้ครบ");
    return;
  }

  const url =
    `${WEB_APP_URL}?action=history&fridgeId=${encodeURIComponent(fridgeId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok) {
      showResult(resultBox, false, data.message);
      scrollToResult("chartResult");
      clearChartOnly();
      return;
    }

    showResult(
      resultBox,
      true,
      `พบข้อมูล ${data.total} รายการ
ตู้: ${data.fridgeName || "-"}
ช่วงอุณหภูมิ: ${data.minTemp} ถึง ${data.maxTemp} °C`
    );

    scrollToResult("chartResult");

    if (!data.records || data.records.length === 0) {
      clearChartOnly();
      return;
    }

    drawChart(data.records, data.minTemp, data.maxTemp, fridgeId);

  } catch (error) {
    showResult(resultBox, false, "โหลดกราฟไม่ได้: " + error);
    scrollToResult("chartResult");
    clearChartOnly();
  }
}

function clearChartForm() {
  const chartRoomSelect = document.getElementById("chartRoomSelect");
  const chartFridgeSelect = document.getElementById("chartFridgeSelect");
  const chartFridgeId = document.getElementById("chartFridgeId");
  const chartStartDate = document.getElementById("chartStartDate");
  const chartEndDate = document.getElementById("chartEndDate");
  const chartResult = document.getElementById("chartResult");
  const chartReader = document.getElementById("chartReader");

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const yyyy2 = twoYearsAgo.getFullYear();
  const mm2 = String(twoYearsAgo.getMonth() + 1).padStart(2, '0');
  const dd2 = String(twoYearsAgo.getDate()).padStart(2, '0');
  const twoYearsAgoStr = `${yyyy2}-${mm2}-${dd2}`;

  if (chartRoomSelect) chartRoomSelect.value = "";
  if (chartFridgeSelect) chartFridgeSelect.innerHTML = '<option value="">-- เลือกตู้ --</option>';
  if (chartFridgeId) chartFridgeId.value = "";
  if (chartStartDate) chartStartDate.value = twoYearsAgoStr;
  if (chartEndDate) chartEndDate.value = todayStr;

  if (chartResult) {
    chartResult.style.display = "none";
    chartResult.innerText = "";
    chartResult.className = "result";
  }

  if (chartReader) {
    chartReader.classList.add("hidden");
  }

  clearChartOnly();
}
    
function onSelectChange() {
  const select = document.getElementById("fridgeSelect");
  const fridgeIdInput = document.getElementById("fridgeId");

  if (select && fridgeIdInput) {
    fridgeIdInput.value = select.value;
    selectedFridgeInfo = fridgeMasterList.find(item => item.id === select.value) || null;
  }

  setRoundTimeFromMaster();
  validateForm();
}
    
function drawChart(records, minTemp, maxTemp, fridgeId) {
  const ctx = document.getElementById('tempChart').getContext('2d');

  if (tempChart) {
    tempChart.destroy();
  }

  const labels = buildSmartLabels(records);
  const values = records.map(r => Number(r.temp));

  tempChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: `อุณหภูมิ ${fridgeId}`,
          data: values,
          tension: 0.25,
          borderWidth: 3,
          fill: false
        },
        {
          label: 'ต่ำสุด',
          data: labels.map(() => Number(minTemp)),
          borderDash: [6, 6],
          borderWidth: 2,
          fill: false
        },
        {
          label: 'สูงสุด',
          data: labels.map(() => Number(maxTemp)),
          borderDash: [6, 6],
          borderWidth: 2,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top'
        },
        tooltip: {
          callbacks: {
            title: function(context) {
              const index = context[0].dataIndex;
              const r = records[index];
              return `${r.date} ${r.time || ''}`.trim();
            },
            label: function(context) {
              return `อุณหภูมิ: ${context.raw} °C`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            autoSkip: true,
            maxTicksLimit: 12,
            maxRotation: 0,
            minRotation: 0
          }
        },
        y: {
          beginAtZero: false,
          title: {
            display: true,
            text: 'อุณหภูมิ (°C)'
          }
        }
      }
    }
  });
}

function buildSmartLabels(records) {
  if (!records || records.length === 0) return [];

  const firstDate = parseDisplayDate(records[0].date);
  const lastDate = parseDisplayDate(records[records.length - 1].date);

  if (!firstDate || !lastDate) {
    return records.map(r => `${r.date} ${r.time || ''}`.trim());
  }

  const diffDays = Math.floor((lastDate - firstDate) / (1000 * 60 * 60 * 24));

  // ≤ 7 วัน => แสดงเวลา
  if (diffDays <= 7) {
    return records.map(r => r.time || '');
  }

  // > 7 วัน ถึง ≤ 31 วัน => แสดงวัน/เดือน
  if (diffDays <= 31) {
    return records.map(r => {
      const d = parseDisplayDate(r.date);
      return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` : r.date;
    });
  }

  // > 31 วัน ถึง < 365 วัน => แสดงวัน/เดือน
  if (diffDays < 365) {
    return records.map(r => {
      const d = parseDisplayDate(r.date);
      return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` : r.date;
    });
  }

  // ≥ 1 ปี => แสดงเดือน/ปี
  return records.map(r => {
    const d = parseDisplayDate(r.date);
    return d ? `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : r.date;
  });
}

function parseDisplayDate(dateStr) {
  if (!dateStr) return null;

  // รองรับ DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('/').map(Number);
    return new Date(y, m - 1, d);
  }

  // รองรับ YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  return null;
}

function clearChartOnly() {
  if (tempChart) {
    tempChart.destroy();
    tempChart = null;
  }
}

function clearChartAndTable() {
  clearChartOnly();
  document.getElementById("historyTableBody").innerHTML = "";
}

function exportCSV() {
  if (!lastHistoryRecords || lastHistoryRecords.length === 0) {
    alert("ยังไม่มีข้อมูลสำหรับ export");
    return;
  }

  const headers = ["วันที่", "เวลา", "รอบ", "รหัสตู้", "ชื่อตู้", "ประเภทที่เก็บ", "อุณหภูมิ", "สถานะ", "การดำเนินการ", "สถานที่เก็บ", "ผู้บันทึก"];
  const rows = lastHistoryRecords.map(r => [
    r.date || '',
    r.time || '',
    r.round || '',
    r.fridgeId || '',
    r.fridgeName || '',
    r.productType || '',
    r.temp ?? '',
    r.status || '',
    r.action || '',
    r.storageLocation || '',
    r.recorderName || ''
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const fileName = `history_${lastHistoryFridgeId}_${new Date().toISOString().slice(0,10)}.csv`;

  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
}

   
    function showResult(el, ok, text) {
      el.style.display = "block";
      el.className = ok ? "result success" : "result error";
      el.innerText = text;
    }

    function getCurrentTime() {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }

    async function toggleScanner() {
  const popup = document.getElementById("scannerPopup");
  const reader = document.getElementById("reader");

  if (!popup || !reader) {
    alert("ไม่พบพื้นที่สำหรับเปิดกล้อง");
    return;
  }

  if (scannerOpen) {
    closeScannerPopup();
    return;
  }

  popup.classList.remove("hidden");
  document.body.style.overflow = "hidden";

  try {
    html5QrCode = new Html5Qrcode("reader");
    scannerOpen = true;

    await html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 220 },
      (decodedText) => {
        applyScannedFridgeToForm(decodedText.trim());
        onFridgeIdInput();
        validateForm();
        closeScannerPopup();
      },
      () => {}
    );

  } catch (err) {
    scannerOpen = false;
    popup.classList.add("hidden");
    document.body.style.overflow = "auto";

    showAppPopup(
      false,
      "เปิดกล้องไม่ได้",
      String(err)
    );
  }
}


function toggleIncidentCustomDate() {
  const filter = document.getElementById("incidentDateFilter")?.value || "";
  const startBox = document.getElementById("incidentStartDateBox");
  const endBox = document.getElementById("incidentEndDateBox");

  if (filter === "custom") {
    if (startBox) startBox.classList.remove("hidden");
    if (endBox) endBox.classList.remove("hidden");
  } else {
    if (startBox) startBox.classList.add("hidden");
    if (endBox) endBox.classList.add("hidden");
  }
}    

    
function getCurrentTimeHHMM() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatTimeForInput(value) {
  if (!value) return "";

  if (value instanceof Date) {
    const hh = String(value.getHours()).padStart(2, "0");
    const mm = String(value.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  const text = String(value).trim();

  const match = text.match(/(\d{1,2}):(\d{2})/);
  if (match) {
    return `${match[1].padStart(2, "0")}:${match[2]}`;
  }

  return text;
}

function setTimeByRound() {
  const round = document.getElementById("round")?.value || "";
  const timeInput = document.getElementById("time");

  if (!timeInput) return;

  if (round === "เช้า") {
    timeInput.value = formatTimeForInput(selectedFridgeInfo?.morningTime || "07:00");
  } else if (round === "เย็น") {
    timeInput.value = formatTimeForInput(selectedFridgeInfo?.eveningTime || "19:00");
  } else if (round === "ผิดปกติ") {
    const now = new Date();
    timeInput.value =
      String(now.getHours()).padStart(2, "0") + ":" +
      String(now.getMinutes()).padStart(2, "0");
  } else {
    timeInput.value = "";
  }

  loadTodayLogStatus();
  validateForm();
}

function setDefaultHistoryDateRange() {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 1);

  const toDateInput = d => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const startDate = document.getElementById("startDate");
  const endDate = document.getElementById("endDate");

  if (startDate) startDate.value = toDateInput(start);
  if (endDate) endDate.value = toDateInput(end);
}
    
function validateForm() {
  const date = document.getElementById("date")?.value?.trim() || "";
  const round = document.getElementById("round")?.value?.trim() || "";
  const fridgeId = document.getElementById("fridgeId")?.value?.trim() || "";
  const temp = document.getElementById("temp")?.value?.trim() || "";
  const time = document.getElementById("time")?.value?.trim() || "";
  const recorderName = document.getElementById("recorderName")?.value?.trim() || "";
  const actionText = document.getElementById("note")?.value?.trim() || "";
  const submitBtn = document.getElementById("submitBtn");
  const noteEl = document.getElementById("note");
  const recordType = document.getElementById("recordType")?.value || "TEMP";
  const noTempReason = document.getElementById("noTempReason")?.value?.trim() || "";
  const noTempDetail = document.getElementById("noTempDetail")?.value?.trim() || "";

  let isAbnormal = false;

  if (selectedFridgeInfo && temp !== "") {
    const tempNum = Number(temp);
    const minTemp = Number(selectedFridgeInfo.minTemp);
    const maxTemp = Number(selectedFridgeInfo.maxTemp);

    if (!isNaN(tempNum) && !isNaN(minTemp) && !isNaN(maxTemp)) {
      isAbnormal = tempNum < minTemp || tempNum > maxTemp;
    }
  }

  const specialRound =
    round === "ตรวจซ้ำ" || round === "ผิดปกติ" || round === "อื่นๆ";

  const room = document.getElementById("roomSelect")?.value?.trim() || "";
  const tempValid = recordType === "NO_TEMP" ? true : !!temp;
  const noTempValid = recordType === "NO_TEMP" ? !!(noTempReason && noTempDetail) : true;

  const basicValid = !!(date && room && round && fridgeId && tempValid && time && recorderName);

  const actionValid = recordType === "NO_TEMP"
    ? noTempValid
    : ((isAbnormal || specialRound) ? !!actionText : true);

    if (submitBtn) {
      submitBtn.disabled = !(basicValid && actionValid) || currentDuplicateStatus;
    }

    if (noteEl) {
    if (recordType !== "NO_TEMP" && (isAbnormal || specialRound) && !actionText) {
      noteEl.classList.add("required-warning");
      noteEl.placeholder = "กรุณากรอกการดำเนินการ";
    } else {
      noteEl.classList.remove("required-warning");
      noteEl.placeholder = "ถ้ามี";
    }
  }
}

function getTodayYMD() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
    
   function stopScanner() {
  closeScannerPopup();
}

    window.onload = function () {
  const pages = [
    "dashboardPage",
    "formPage",
    "historyPage",
    "chartPage",
    "incidentPage",
    "updateIncidentPage",
    "incidentHistoryPage"
  ];

  pages.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    if (id === "dashboardPage") {
      el.classList.remove("hidden");
    } else {
      el.classList.add("hidden");
    }
  });

  document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"));
  const firstBtn = document.querySelector(".menu-btn");
  if (firstBtn) firstBtn.classList.add("active");

      
  try { loadFridgeList(); } catch (e) { console.error("loadFridgeList error:", e); }
  try { setToday(); } catch (e) { console.error("setToday error:", e); }
  try { lsetDefaultHistoryDateRange(); } catch (e) { console.error("setDefaultHistoryDateRange error:", e); }
  try { resetFormState(); } catch (e) { console.error("resetFormState error:", e); }
  try { validateForm(); } catch (e) { console.error("validateForm error:", e); }
  try { loadDashboard(); } catch (e) { console.error("loadDashboard error:", e); }
  try { setupAlarmTestValidation(); } catch (e) { console.error("setupAlarmTestValidation:", e); }    
};

function scrollToDashboardCards() {
  const cardContainer = document.getElementById("dashboardCardContainer");

  if (!cardContainer) return;

  setTimeout(() => {
    cardContainer.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 150);
}

    
function showAppPopup(success, title, message) {
  const popup = document.getElementById("appPopup");
  const icon = document.getElementById("appPopupIcon");
  const titleBox = document.getElementById("appPopupTitle");
  const messageBox = document.getElementById("appPopupMessage");

  if (!popup || !icon || !titleBox || !messageBox) {
    alert(message || title || "");
    return;
  }

  icon.classList.toggle("error", !success);
  icon.innerText = success ? "✓" : "!";
  titleBox.innerText = title || (success ? "สำเร็จ" : "ไม่สำเร็จ");
  messageBox.innerText = message || "";

  popup.classList.remove("hidden");
}

function buildTemperaturePopupMessage(data) {
  const date = document.getElementById("date")?.value || "-";
  const round = document.getElementById("round")?.value || "-";
  const fridgeId = document.getElementById("fridgeId")?.value?.trim() || "-";
  const recorderName = document.getElementById("recorderName")?.value?.trim() || "-";
  const recordType = document.getElementById("recordType")?.value || "TEMP";
  const temp = data?.temp ?? document.getElementById("temp")?.value ?? "-";

  let message = "";
  message += `วันที่: ${date}\n`;
  message += `รอบ: ${round}\n`;
  message += `รหัสตู้: ${fridgeId}\n`;

  if (recordType === "NO_TEMP") {
    const noTempReason = document.getElementById("noTempReason")?.value || "-";
    const noTempDetail = document.getElementById("noTempDetail")?.value || "-";

    message += `อุณหภูมิ: -\n`;
    message += `สถานะ: ไม่สามารถวัดอุณหภูมิได้\n`;
    message += `เหตุผล: ${noTempReason}\n`;
    message += `รายละเอียด: ${noTempDetail}\n`;
  } else {
    message += `อุณหภูมิ: ${temp} °C\n`;
    message += `สถานะ: ${data?.status || "-"}\n`;
  }

  message += `ผู้บันทึก: ${recorderName}`;

  return message;
}

function closeAppPopup() {
  const popup = document.getElementById("appPopup");
  if (popup) {
    popup.classList.add("hidden");
  }
}

function unlockScrollAfterScanner() {
  document.body.style.overflow = "auto";
  document.documentElement.style.overflow = "auto";

  const reader = document.getElementById("reader");
  if (reader) {
    reader.classList.add("hidden");
  }

  const formPage = document.getElementById("formPage");

  if (formPage) {
    setTimeout(() => {
      formPage.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 300);
  }
} 


    let alarmDueItemsCache = [];

async function loadAlarmTestDueList() {
  const select = document.getElementById("alarmFridgeSelect");
  const summary = document.getElementById("alarmDueSummary");
  const resultBox = document.getElementById("alarmTestResult");

  if (!select) return;

  select.innerHTML = `<option value="">-- เลือกตู้ --</option>`;

  try {
    const response = await fetch(`${WEB_APP_URL}?action=alarm_due_list`);
    const data = await response.json();

    if (!data.ok) {
      if (summary) summary.innerText = data.message || "โหลดรายการไม่สำเร็จ";
      showResult(resultBox, false, data.message || "โหลดรายการไม่สำเร็จ");
      return;
    }

    alarmDueItemsCache = Array.isArray(data.dueItems) ? data.dueItems : [];

    if (summary) {
      summary.innerText = `วันนี้ครบกำหนด ${data.dueCount || 0} ตู้ จากทั้งหมด ${data.totalActiveFridges || 0} ตู้`;
    }

    alarmDueItemsCache.forEach(item => {
      const option = document.createElement("option");
      option.value = item.fridgeId;
      option.textContent = `${item.fridgeId} | ${item.fridgeName || "-"} | ${item.room || "-"} | ${item.dueStatus || "-"}`;
      select.appendChild(option);
    });

    setAlarmTestDefaultDateTime();

    showResult(resultBox, true, "โหลดรายการ Alarm Test สำเร็จ");

  } catch (error) {
    if (summary) summary.innerText = "โหลดรายการไม่สำเร็จ";
    showResult(resultBox, false, "โหลดรายการ Alarm Test ไม่สำเร็จ: " + error);
  }
}

function setAlarmTestDefaultDateTime() {
  const dateInput = document.getElementById("alarmTestDate");
  const timeInput = document.getElementById("alarmTestTime");

  if (dateInput && !dateInput.value) {
    dateInput.value = getTodayYMD();
  }

  if (timeInput && !timeInput.value) {
    timeInput.value = getCurrentTimeHHMM();
  }
}

function onAlarmFridgeChange() {
  const fridgeId = document.getElementById("alarmFridgeSelect")?.value || "";
  const infoBox = document.getElementById("alarmFridgeInfo");

  if (!infoBox) return;

  const item = alarmDueItemsCache.find(x => x.fridgeId === fridgeId);

  if (!item) {
    infoBox.innerHTML = "กรุณาเลือกตู้";
    return;
  }

  infoBox.innerHTML = `
    <strong>รหัสตู้:</strong> ${item.fridgeId || "-"}<br>
    <strong>ชื่อตู้:</strong> ${item.fridgeName || "-"}<br>
    <strong>ประเภท:</strong> ${item.productType || "-"}<br>
    <strong>สถานที่:</strong> ${item.room || "-"}<br>
    <strong>ทำล่าสุด:</strong> ${item.lastTestDate || "-"}<br>
    <strong>ครบกำหนด:</strong> ${item.nextDueDate || "-"}<br>
    <strong>สถานะ:</strong> ${item.dueStatus || "-"}<br>
    <strong>ผลครั้งล่าสุด:</strong> ${item.lastResult || "-"}<br>
    <strong>ผู้ทดสอบล่าสุด:</strong> ${item.lastTester || "-"}
  `;

  applyAlarmFrontRule();
  validateAlarmTestForm();
  }

    async function submitAlarmTest() {
  const resultBox = document.getElementById("alarmTestResult");

  const testDate = document.getElementById("alarmTestDate")?.value || "";
  const testTime = document.getElementById("alarmTestTime")?.value || "";
  const fridgeId = document.getElementById("alarmFridgeSelect")?.value || "";
  const probeId = document.getElementById("alarmProbeId")?.value?.trim() || "";
  const tester = document.getElementById("alarmTester")?.value?.trim() || "";

  if (!testDate || !testTime || !fridgeId || !tester) {
    showResult(resultBox, false, "กรุณากรอกวันที่ เวลา เลือกตู้ และผู้ทดสอบ");
    return;
  }

  const params = new URLSearchParams();

  const frontRule = getAlarmFrontRule();

function alarmValue(id, fallback = "") {
  return document.getElementById(id)?.value || fallback;
}

function frontValue(id) {
  if (
    frontRule === "ffp_sound_only" &&
    [
      "frontHighAlarmTemp",
      "frontHighAlarmSound",
      "frontHighAlarmStatus",
      "frontLowAlarmTemp",
      "frontLowAlarmSound",
      "frontLowAlarmStatus"
    ].includes(id)
  ) {
    return "N/A";
  }

  return alarmValue(id);
}
      
  params.set("action", "submit_alarm_test");
  params.set("testDate", testDate);
  params.set("testTime", testTime);
  params.set("fridgeId", fridgeId);
  params.set("probeId", probeId);
  params.set("tester", tester);

  params.set("batteryPercent", document.getElementById("batteryPercent")?.value || "");
  params.set("batteryStatus", document.getElementById("batteryStatus")?.value || "");

  params.set("signalPercent", document.getElementById("signalPercent")?.value || "");
  params.set("signalStatus", document.getElementById("signalStatus")?.value || "");

  params.set("datalogInterval", document.getElementById("datalogInterval")?.value || "");
  params.set("datalogStatus", document.getElementById("datalogStatus")?.value || "");

  params.set("highRemoteTime", document.getElementById("highRemoteTime")?.value || "");
  params.set("highLocalAlert", document.getElementById("highLocalAlert")?.value || "");
  params.set("highAlertResult", document.getElementById("highAlertResult")?.value || "");

  params.set("lowRemoteTime", document.getElementById("lowRemoteTime")?.value || "");
  params.set("lowLocalAlert", document.getElementById("lowLocalAlert")?.value || "");
  params.set("lowAlertResult", document.getElementById("lowAlertResult")?.value || "");

  params.set("wirelessRemoteTime", document.getElementById("wirelessRemoteTime")?.value || "");
  params.set("wirelessLocalAlert", document.getElementById("wirelessLocalAlert")?.value || "");
  params.set("wirelessAlertResult", document.getElementById("wirelessAlertResult")?.value || "");

  params.set("sensorRemoteTime", document.getElementById("sensorRemoteTime")?.value || "");
  params.set("sensorLocalAlert", document.getElementById("sensorLocalAlert")?.value || "");
  params.set("sensorAlertResult", document.getElementById("sensorAlertResult")?.value || "");

  params.set("frontHighAlarmTemp", frontValue("frontHighAlarmTemp"));
  params.set("frontHighAlarmSound", frontValue("frontHighAlarmSound"));
  params.set("frontHighAlarmStatus", frontValue("frontHighAlarmStatus"));

  params.set("frontLowAlarmTemp", frontValue("frontLowAlarmTemp"));
  params.set("frontLowAlarmSound", frontValue("frontLowAlarmSound"));
  params.set("frontLowAlarmStatus", frontValue("frontLowAlarmStatus"));

  params.set("frontDisplayStatus", frontValue("frontDisplayStatus"));
  params.set("frontOverallStatus", frontValue("frontOverallStatus"));

  params.set("actionWhenAbnormal", document.getElementById("alarmActionWhenAbnormal")?.value || "");
  params.set("note", document.getElementById("alarmNote")?.value?.trim() || "");
  params.set("bemChecker", document.getElementById("bemChecker")?.value?.trim() || "");

  try {
    const response = await fetch(`${WEB_APP_URL}?${params.toString()}`);
    const data = await response.json();

    if (data.ok) {
      showResult(resultBox, true, data.message || "บันทึก Alarm Test สำเร็จ");

      if (typeof showAppPopup === "function") {
        showAppPopup(
          true,
          "บันทึก Alarm Test สำเร็จ",
          `${data.fridgeId || ""}\nผลรวม: ${data.overallResult || "-"}`
        );
      }

      clearAlarmTestForm();
      loadAlarmTestDueList();

    } else {
      showResult(resultBox, false, data.message || "บันทึก Alarm Test ไม่สำเร็จ");

      if (typeof showAppPopup === "function") {
        showAppPopup(false, "บันทึกไม่สำเร็จ", data.message || "กรุณาตรวจสอบข้อมูล");
      }
    }

  } catch (error) {
    showResult(resultBox, false, "บันทึก Alarm Test ไม่สำเร็จ: " + error);
  }
}

    function clearAlarmTestForm() {
  const ids = [
    "alarmFridgeSelect",
    "alarmProbeId",
    "alarmTester",
    "batteryPercent",
    "signalPercent",
    "datalogInterval",
    "highRemoteTime",
    "lowRemoteTime",
    "wirelessRemoteTime",
    "sensorRemoteTime",
    "frontHighAlarmTemp",
    "frontLowAlarmTemp",
    "alarmActionWhenAbnormal",
    "alarmNote",
    "bemChecker"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const alarmFridgeInfo = document.getElementById("alarmFridgeInfo");
  if (alarmFridgeInfo) alarmFridgeInfo.innerHTML = "กรุณาเลือกตู้";

  const resultBox = document.getElementById("alarmTestResult");
  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }

  setAlarmTestDefaultDateTime();
  applyAlarmFrontRule();
  validateAlarmTestForm();
}

function getSelectedAlarmFridgeItem() {
  const fridgeId = document.getElementById("alarmFridgeSelect")?.value || "";
  return alarmDueItemsCache.find(x => x.fridgeId === fridgeId) || null;
}

function getAlarmFrontRule() {
  const item = getSelectedAlarmFridgeItem();
  const productType = String(item?.productType || "").trim();

  const isFfp = productType === "FFP" || productType.includes("FFP");

  if (isFfp) {
    return "ffp_sound_only";
  }

  return "full_front_test";
}

function setFieldVisible(fieldId, visible) {
  const el = document.getElementById(fieldId);
  if (!el) return;

  const box = el.closest("div");
  if (!box) return;

  if (visible) {
    box.classList.remove("hidden");
  } else {
    box.classList.add("hidden");
    el.value = "";
  }
}

function applyAlarmFrontRule() {
  const rule = getAlarmFrontRule();

  const highLowFields = [
    "frontHighAlarmTemp",
    "frontHighAlarmSound",
    "frontHighAlarmStatus",
    "frontLowAlarmTemp",
    "frontLowAlarmSound",
    "frontLowAlarmStatus"
  ];

  const frontGeneralFields = [
    "frontDisplayStatus",
    "frontOverallStatus"
  ];

  if (rule === "full_front_test") {
    highLowFields.forEach(id => setFieldVisible(id, true));
    frontGeneralFields.forEach(id => setFieldVisible(id, true));
  }

  if (rule === "ffp_sound_only") {
    // FFP ไม่ต้องทำ High/Low แยก
    highLowFields.forEach(id => setFieldVisible(id, false));

    // ให้ทำเฉพาะ Front Test ว่าส่งเสียง/ภาพรวม
    frontGeneralFields.forEach(id => setFieldVisible(id, true));
  }

  updateAlarmFrontNote(rule);
  validateAlarmTestForm();
}

function updateAlarmFrontNote(rule) {
  let noteBox = document.getElementById("alarmFrontRuleNote");

  if (!noteBox) {
    const frontTitle = Array.from(document.querySelectorAll(".sub-section-title"))
      .find(el => el.innerText.includes("Front Test"));

    if (!frontTitle) return;

    noteBox = document.createElement("div");
    noteBox.id = "alarmFrontRuleNote";
    noteBox.className = "info-box";
    noteBox.style.marginBottom = "14px";

    frontTitle.insertAdjacentElement("afterend", noteBox);
  }

  if (rule === "full_front_test") {
    noteBox.innerHTML = "ตู้ประเภทนี้ต้องทำ Front Test ครบทั้ง High Alarm, Low Alarm และหน้าจอ/ปุ่มกด";
  }

  if (rule === "ffp_sound_only") {
    noteBox.innerHTML = "ตู้ FFP: ไม่ต้องทำ Front Test แยก High Alarm / Low Alarm ให้ทดสอบเฉพาะเสียง/ภาพรวมหน้าตู้";
  }
}

    function getValue(id) {
  return document.getElementById(id)?.value?.trim() || "";
}

function validateAlarmTestForm() {
  const submitBtn = document.getElementById("alarmSubmitBtn");
  if (!submitBtn) return;

  const rule = getAlarmFrontRule();

  const requiredFields = [
    "alarmFridgeSelect",
    "alarmTestDate",
    "alarmTestTime",
    "alarmTester",

    "batteryPercent",
    "batteryStatus",
    "signalPercent",
    "signalStatus",
    "datalogInterval",
    "datalogStatus",

    "highRemoteTime",
    "highLocalAlert",
    "highAlertResult",

    "lowRemoteTime",
    "lowLocalAlert",
    "lowAlertResult",

    "wirelessRemoteTime",
    "wirelessLocalAlert",
    "wirelessAlertResult",

    "sensorRemoteTime",
    "sensorLocalAlert",
    "sensorAlertResult"
  ];

  if (rule === "full_front_test") {
  requiredFields.push(
    "frontHighAlarmTemp",
    "frontHighAlarmSound",
    "frontHighAlarmStatus",
    "frontLowAlarmTemp",
    "frontLowAlarmSound",
    "frontLowAlarmStatus",
    "frontDisplayStatus",
    "frontOverallStatus"
  );
}

if (rule === "ffp_sound_only") {
  requiredFields.push(
    "frontDisplayStatus",
    "frontOverallStatus"
  );
}

  const hasMissingRequired = requiredFields.some(id => !getValue(id));

  const failFields = [
    "batteryStatus",
    "signalStatus",
    "datalogStatus",
    "highAlertResult",
    "lowAlertResult",
    "wirelessAlertResult",
    "sensorAlertResult",
    "frontHighAlarmStatus",
    "frontLowAlarmStatus",
    "frontDisplayStatus",
    "frontOverallStatus"
  ];

  const hasFail = failFields.some(id => {
    const value = getValue(id);
    return value === "ผิดปกติ" || value === "ไม่ผ่าน" || value === "ไม่พร้อมใช้งาน";
  });

  const actionWhenAbnormal = getValue("alarmActionWhenAbnormal");
  const missingActionForFail = hasFail && !actionWhenAbnormal;

  submitBtn.disabled = hasMissingRequired || missingActionForFail;
}

    function setupAlarmTestValidation() {
  const alarmPage = document.getElementById("alarmTestPage");
  if (!alarmPage) return;

  const fields = alarmPage.querySelectorAll("input, select, textarea");

  fields.forEach(field => {
    field.addEventListener("input", validateAlarmTestForm);
    field.addEventListener("change", validateAlarmTestForm);
  });

  validateAlarmTestForm();
}

async function loadAlarmTestHistory() {
  const resultBox = document.getElementById("alarmHistoryResultBox");
  const tbody = document.getElementById("alarmHistoryTableBody");
  const detailBox = document.getElementById("alarmHistoryDetailBox");

  if (!tbody) return;

  const fridgeId = document.getElementById("alarmHistoryFridgeId")?.value?.trim() || "";
  const result = document.getElementById("alarmHistoryResult")?.value || "all";
  const startDate = document.getElementById("alarmHistoryStartDate")?.value || "";
  const endDate = document.getElementById("alarmHistoryEndDate")?.value || "";

  tbody.innerHTML = `<tr><td colspan="8">กำลังโหลดข้อมูล...</td></tr>`;
  if (detailBox) detailBox.classList.add("hidden");

  const params = new URLSearchParams();
  params.set("action", "alarm_test_history");
  params.set("fridgeId", fridgeId);
  params.set("result", result);
  params.set("startDate", startDate);
  params.set("endDate", endDate);

  try {
    const response = await fetch(`${WEB_APP_URL}?${params.toString()}`);
    const data = await response.json();

    if (!data.ok) {
      tbody.innerHTML = `<tr><td colspan="8">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
      showResult(resultBox, false, data.message || "โหลดประวัติ Alarm Test ไม่สำเร็จ");
      return;
    }

    alarmHistoryCache = Array.isArray(data.records) ? data.records : [];

    if (alarmHistoryCache.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8">ไม่พบข้อมูล</td></tr>`;
      showResult(resultBox, true, "ไม่พบข้อมูลตามเงื่อนไขที่ค้นหา");
      return;
    }

    tbody.innerHTML = "";

    alarmHistoryCache.forEach((item, index) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${item.testDate || "-"}</td>
        <td>${item.testTime || "-"}</td>
        <td>${item.fridgeId || "-"}</td>
        <td>${item.fridgeName || "-"}</td>
        <td>${item.room || "-"}</td>
        <td>
          <span class="${item.overallResult === "ผ่าน" ? "status-green" : "status-red"}">
            ${item.overallResult || "-"}
          </span>
        </td>
        <td>${item.tester || "-"}</td>
        <td>
          <button type="button" class="btn-secondary small-btn" onclick="showAlarmTestDetail(${index})">
            ดูรายละเอียด
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    showResult(resultBox, true, `พบประวัติ Alarm Test ${alarmHistoryCache.length} รายการ`);

  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="8">โหลดข้อมูลไม่สำเร็จ</td></tr>`;
    showResult(resultBox, false, "โหลดประวัติ Alarm Test ไม่สำเร็จ: " + error);
  }
}

function showAlarmTestDetail(index) {
  const detailBox = document.getElementById("alarmHistoryDetailBox");
  if (!detailBox) return;

  const item = alarmHistoryCache[index];
  if (!item) return;

  detailBox.classList.remove("hidden");

  detailBox.innerHTML = `
    <h3>รายละเอียด Alarm Test: ${item.fridgeId || "-"}</h3>

    <div class="alarm-detail-grid">
      <div class="alarm-detail-item"><strong>วันที่/เวลา:</strong> ${item.testDate || "-"} ${item.testTime || "-"}</div>
      <div class="alarm-detail-item"><strong>ผลรวม:</strong> ${item.overallResult || "-"}</div>
      <div class="alarm-detail-item"><strong>Probe:</strong> ${item.probeId || "-"}</div>
      <div class="alarm-detail-item"><strong>ผู้ทดสอบ:</strong> ${item.tester || "-"}</div>

      <div class="alarm-detail-item"><strong>Battery:</strong> ${item.batteryPercent || "-"}% / ${item.batteryStatus || "-"}</div>
      <div class="alarm-detail-item"><strong>Signal:</strong> ${item.signalPercent || "-"}% / ${item.signalStatus || "-"}</div>
      <div class="alarm-detail-item"><strong>Datalogging:</strong> Interval ${item.datalogInterval || "-"} นาที / ${item.datalogStatus || "-"}</div>

      <div class="alarm-detail-item"><strong>High Alert:</strong> ${item.highAlertResult || "-"} / Remote ${item.highRemoteTime || "-"} นาที / Local ${item.highLocalAlert || "-"}</div>
      <div class="alarm-detail-item"><strong>Low Alert:</strong> ${item.lowAlertResult || "-"} / Remote ${item.lowRemoteTime || "-"} นาที / Local ${item.lowLocalAlert || "-"}</div>
      <div class="alarm-detail-item"><strong>Wireless Alert:</strong> ${item.wirelessAlertResult || "-"} / Remote ${item.wirelessRemoteTime || "-"} นาที / Local ${item.wirelessLocalAlert || "-"}</div>
      <div class="alarm-detail-item"><strong>Sensor Alert:</strong> ${item.sensorAlertResult || "-"} / Remote ${item.sensorRemoteTime || "-"} นาที / Local ${item.sensorLocalAlert || "-"}</div>

      <div class="alarm-detail-item"><strong>Front High:</strong> ${item.frontHighAlarmTemp || "-"} °C / ${item.frontHighAlarmSound || "-"} / ${item.frontHighAlarmStatus || "-"}</div>
      <div class="alarm-detail-item"><strong>Front Low:</strong> ${item.frontLowAlarmTemp || "-"} °C / ${item.frontLowAlarmSound || "-"} / ${item.frontLowAlarmStatus || "-"}</div>
      <div class="alarm-detail-item"><strong>Front Display:</strong> ${item.frontDisplayStatus || "-"}</div>
      <div class="alarm-detail-item"><strong>Front Overall:</strong> ${item.frontOverallStatus || "-"}</div>

      <div class="alarm-detail-item"><strong>การดำเนินการ:</strong> ${item.actionWhenAbnormal || "-"}</div>
      <div class="alarm-detail-item"><strong>BEM:</strong> ${item.bemChecker || "-"}</div>
      <div class="alarm-detail-item"><strong>หมายเหตุ:</strong> ${item.note || "-"}</div>
      <div class="alarm-detail-item"><strong>ผู้บันทึก:</strong> ${item.savedBy || "-"}</div>
    </div>
  `;

  setTimeout(() => {
    detailBox.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }, 100);
}

function clearAlarmTestHistory() {
  const ids = [
    "alarmHistoryFridgeId",
    "alarmHistoryStartDate",
    "alarmHistoryEndDate"
  ];

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const resultSelect = document.getElementById("alarmHistoryResult");
  if (resultSelect) resultSelect.value = "all";

  const tbody = document.getElementById("alarmHistoryTableBody");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8">ยังไม่มีข้อมูล</td></tr>`;
  }

  const detailBox = document.getElementById("alarmHistoryDetailBox");
  if (detailBox) {
    detailBox.classList.add("hidden");
    detailBox.innerHTML = "";
  }

  const resultBox = document.getElementById("alarmHistoryResultBox");
  if (resultBox) {
    resultBox.style.display = "none";
    resultBox.innerText = "";
    resultBox.className = "result";
  }

  alarmHistoryCache = [];
}

function closeScannerPopup() {
  const popup = document.getElementById("scannerPopup");

  if (html5QrCode && scannerOpen) {
    html5QrCode.stop()
      .then(() => {
        html5QrCode.clear();
        html5QrCode = null;
        scannerOpen = false;
        if (popup) popup.classList.add("hidden");
        document.body.style.overflow = "auto";
      })
      .catch((err) => {
        console.warn("หยุดกล้องไม่ได้:", err);
        html5QrCode = null;
        scannerOpen = false;
        if (popup) popup.classList.add("hidden");
        document.body.style.overflow = "auto";
      });
  } else {
    scannerOpen = false;
    if (popup) popup.classList.add("hidden");
    document.body.style.overflow = "auto";
  }
}

function toggleDesktopSidebar() {
  document.body.classList.toggle("desktop-sidebar-collapsed");

  const isCollapsed = document.body.classList.contains("desktop-sidebar-collapsed");
  localStorage.setItem("desktopSidebarCollapsed", isCollapsed ? "yes" : "no");
}

document.addEventListener("DOMContentLoaded", function () {
  const savedState = localStorage.getItem("desktopSidebarCollapsed");

  if (savedState === "yes") {
    document.body.classList.add("desktop-sidebar-collapsed");
  }
});

function onRecordTypeChange() {
  const recordType = document.getElementById("recordType")?.value || "TEMP";
  const tempEl = document.getElementById("temp");
  const noteEl = document.getElementById("note");

  const noTempReasonBox = document.getElementById("noTempReasonBox");
  const noTempDetailBox = document.getElementById("noTempDetailBox");
  const noTempReason = document.getElementById("noTempReason");
  const noTempDetail = document.getElementById("noTempDetail");

  if (recordType === "NO_TEMP") {
    if (tempEl) {
      tempEl.value = "-";
      tempEl.disabled = true;
      tempEl.placeholder = "ไม่สามารถวัดได้";
    }

    if (noteEl) {
      noteEl.value = "";
      noteEl.disabled = true;
      noteEl.placeholder = "ระบบจะใช้เหตุผลที่ไม่สามารถวัดอุณหภูมิได้แทน";
      noteEl.classList.remove("required-warning");
    }

    if (noTempReasonBox) noTempReasonBox.classList.remove("hidden");
    if (noTempDetailBox) noTempDetailBox.classList.remove("hidden");
  } else {
    if (tempEl) {
      tempEl.value = "";
      tempEl.disabled = false;
      tempEl.placeholder = "เช่น 4.0";
    }

    if (noteEl) {
      noteEl.disabled = false;
      noteEl.placeholder = "ถ้ามี";
    }

    if (noTempReasonBox) noTempReasonBox.classList.add("hidden");
    if (noTempDetailBox) noTempDetailBox.classList.add("hidden");

    if (noTempReason) noTempReason.value = "";
    if (noTempDetail) noTempDetail.value = "";
  }

  validateForm();
}
