const loginForm = document.getElementById('login-form');
const loginScreen = document.getElementById('admin-login');
const adminApp = document.getElementById('admin-app');
const toggleButtons = document.querySelectorAll('[data-toggle="password"]');
const tabButtons = document.querySelectorAll('.tab-btn');

const statTotal = document.getElementById('stat-total');
const statPresent = document.getElementById('stat-present');
const statLate = document.getElementById('stat-late');
const statAbsent = document.getElementById('stat-absent');
const statCards = document.querySelectorAll('.stat-card[data-stat]');
const statModal = document.getElementById('stat-modal');
const statModalTitle = document.getElementById('stat-modal-title');
const statModalSubtitle = document.getElementById('stat-modal-subtitle');
const statModalTable = document.getElementById('stat-modal-table');
const statModalEmpty = document.getElementById('stat-modal-empty');
const closeStatModalBtn = document.getElementById('close-stat-modal');
const photoPreviewModal = document.getElementById('photo-preview-modal');
const photoPreviewImage = document.getElementById('photo-preview-image');
const closePhotoPreviewBtn = document.getElementById('close-photo-preview');
const currentTime = document.getElementById('current-time');
const currentDate = document.getElementById('current-date');

const attendanceTable = document.getElementById('attendance-table').querySelector('tbody');
const employeesTable = document.getElementById('employees-table').querySelector('tbody');
const attendanceHistory = document.getElementById('attendance-history').querySelector('tbody');
const attendanceFromInput = document.getElementById('attendance-from');
const attendanceToInput = document.getElementById('attendance-to');
const reportsTable = document.getElementById('reports-table').querySelector('tbody');
const reportsFrom = document.getElementById('reports-from');
const reportsTo = document.getElementById('reports-to');
const reportsOfficeFilter = document.getElementById('reports-office');
const filterReportsBtn = document.getElementById('filter-reports');
const refreshReportsBtn = document.getElementById('refresh-reports');
const dtrEmployee = document.getElementById('dtr-employee');
const dtrMonth = document.getElementById('dtr-month');
const generateDtrBtn = document.getElementById('generate-dtr');
const printDtrBtn = document.getElementById('print-dtr');
const dtrPreview = document.getElementById('dtr-preview');

const addEmployeeModal = document.getElementById('add-employee-modal');
const addEmployeeForm = document.getElementById('add-employee-form');
const employeeSearch = document.getElementById('employee-search');

const reportPreview = document.getElementById('report-preview');
const adminRegisterModal = document.getElementById('admin-register-modal');
const adminRegisterForm = document.getElementById('admin-register-form');
const adminForgotModal = document.getElementById('admin-forgot-modal');
const adminForgotForm = document.getElementById('admin-forgot-form');
const notifBtn = document.getElementById('notif-btn');
const notifPanel = document.getElementById('notif-panel');
const notifList = document.getElementById('notif-list');
const notifCount = document.getElementById('notif-count');
const notifEmpty = document.getElementById('notif-empty');
const markNotifReadBtn = document.getElementById('mark-notif-read');
const msgBtn = document.getElementById('msg-btn');
const msgPanel = document.getElementById('msg-panel');
const msgList = document.getElementById('msg-list');
const msgCount = document.getElementById('msg-count');
const msgEmpty = document.getElementById('msg-empty');
const markMsgReadBtn = document.getElementById('mark-msg-read');
const menuBtn = document.getElementById('menu-btn');
const menuPanel = document.getElementById('menu-panel');
const helpBtn = document.getElementById('need-help-btn');
const helpDetails = document.getElementById('help-details');
const logoutBtn = document.getElementById('logout-btn');

let employeesCache = [];
let attendanceCache = [];
let notificationsCache = []; 
let messagesCache = []; 
let reportsCache = []; 
let currentAdmin = null;
let officeScope = '';
let reportMap = new Map(); 
let reportAttestedDrafts = new Map(); 
let refreshTimer = null; 
const STAT_CACHE_TTL = 45000;
const statCache = {
  key: '',
  time: 0,
  attendance: [],
  employees: []
};

function normalizeEmployeeStatus(status) {
  return String(status || 'Active').trim();
}

function isDeletedEmployee(employee) {
  return normalizeEmployeeStatus(employee && employee.status).toLowerCase() === 'deleted';
}

function activeEmployeesFromCache() {
  return employeesCache.filter((emp) => !isDeletedEmployee(emp));
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function isoToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function timeToMinutes(time) {
  if (!time) return null;
  const [h, m] = String(time).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function getMonthRange() {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const to = isoToday();
  return { from, to };
}

function buildDateList(from, to) { 
  const dates = []; 
  const start = new Date(`${from}T00:00:00`); 
  const end = new Date(`${to}T00:00:00`); 
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) { 
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; 
    dates.push(dateStr); 
  } 
  return dates; 
} 

function isFridayDate(dateStr) {
  if (!dateStr) return false;
  const d = new Date(`${dateStr}T12:00:00`);
  return d.getDay() === 5;
}

function formatDateTimeStamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
}

function updateBadge(el, count) {
  if (!el) return;
  el.textContent = count;
  el.classList.toggle('hidden', count <= 0);
}

function tickClock() {
  const now = new Date();
  currentTime.textContent = formatTime(now);
  currentDate.textContent = formatDate(now);
}

function setView(viewId) {
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('hidden', view.id !== viewId);
  });
  tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === viewId));
}

function setStatusCell(cell, status) {
  if (!cell) return;
  const statusLower = status.toLowerCase();
  cell.classList.remove('status-present', 'status-late', 'status-absent', 'status-recorded', 'status-pending');
  if (statusLower === 'present') cell.classList.add('status-present');
  if (statusLower === 'late') cell.classList.add('status-late');
  if (statusLower === 'absent') cell.classList.add('status-absent');
  if (statusLower === 'recorded') cell.classList.add('status-recorded');
  if (statusLower === 'pending') cell.classList.add('status-pending');
}

function pickPhoto(item) {
  return item.photoInAM || item.photoInPM || item.photoOutAM || item.photoOutPM || item.photo || '';
}

function pickLocation(item) {
  return item.locationInAM || item.locationInPM || item.locationOutAM || item.locationOutPM || item.location || '';
}

function inferLegacyAttendanceSlot(item) {
  if (!item) return 'amIn';
  if (item.timeOutPM || item.timeOut) return 'pmOut';
  if (item.timeInPM) return 'pmIn';
  if (item.timeOutAM) return 'amOut';
  return 'amIn';
}

function buildAttendanceSlotTimes(item) {
  const values = {
    amIn: item.timeInAM || '',
    amOut: item.timeOutAM || '',
    pmIn: item.timeInPM || '',
    pmOut: item.timeOutPM || ''
  };

  // Fix bad/mis-tapped legacy data where PM fields were saved with AM times.
  // If PM time is earlier than 1:00 PM, treat it as AM when AM slot is empty.
  const PM_START_MINUTES = 13 * 60;
  const EARLY_PM_OVERRIDE_START = 11 * 60 + 30; // 11:30 AM
  const pmInMinutes = timeToMinutes(values.pmIn);
  if (
    values.pmIn &&
    pmInMinutes !== null &&
    pmInMinutes < PM_START_MINUTES &&
    pmInMinutes < EARLY_PM_OVERRIDE_START &&
    !values.amIn
  ) {
    values.amIn = values.pmIn;
    values.pmIn = '';
  }
  const pmOutMinutes = timeToMinutes(values.pmOut);
  if (values.pmOut && pmOutMinutes !== null && pmOutMinutes < PM_START_MINUTES && !values.amOut) {
    values.amOut = values.pmOut;
    values.pmOut = '';
  }

  // Legacy compatibility: some records only have timeIn/timeOut (no AM/PM split).
  // Classify by time of day to avoid treating an AM out as a PM out.
  if (!values.amIn && item.timeIn && !values.pmIn) {
    const minutes = timeToMinutes(item.timeIn);
    if (minutes !== null && minutes >= PM_START_MINUTES) values.pmIn = item.timeIn;
    else values.amIn = item.timeIn;
  }

  if (!values.amOut && item.timeOut && !values.pmOut) {
    const minutes = timeToMinutes(item.timeOut);
    if (minutes !== null && minutes >= PM_START_MINUTES) values.pmOut = item.timeOut;
    else values.amOut = item.timeOut;
  }

  return values;
}

function getSlotInStatus(timeValue, cutoffMinutes) {
  const minutes = timeToMinutes(timeValue);
  if (minutes === null) return '--';
  return minutes > cutoffMinutes ? 'Late' : 'Present';
}

function getSlotOutStatus(timeOut, timeIn) {
  if (!timeOut) return timeIn ? 'Pending' : '--';
  return 'Recorded';
}

function buildAttendanceSlotStatuses(item) {
  const times = buildAttendanceSlotTimes(item);
  return {
    amIn: getSlotInStatus(times.amIn, 8 * 60),
    amOut: getSlotOutStatus(times.amOut, times.amIn),
    pmIn: getSlotInStatus(times.pmIn, 13 * 60),
    pmOut: getSlotOutStatus(times.pmOut, times.pmIn)
  };
}

function buildAttendanceSlotDetails(item) {
  const details = {
    amIn: { photo: item.photoInAM || '', location: item.locationInAM || '', lat: item.latInAM || '', lng: item.lngInAM || '' },
    amOut: { photo: item.photoOutAM || '', location: item.locationOutAM || '', lat: item.latOutAM || '', lng: item.lngOutAM || '' },
    pmIn: { photo: item.photoInPM || '', location: item.locationInPM || '', lat: item.latInPM || '', lng: item.lngInPM || '' },
    pmOut: { photo: item.photoOutPM || '', location: item.locationOutPM || '', lat: item.latOutPM || '', lng: item.lngOutPM || '' }
  };
  const hasSlotPhoto = Object.values(details).some((slot) => !!slot.photo);
  const hasSlotLocation = Object.values(details).some((slot) => !!slot.location);
  const hasSlotGps = Object.values(details).some((slot) => normalizeCoordinate(slot.lat) && normalizeCoordinate(slot.lng));
  const legacySlot = inferLegacyAttendanceSlot(item);
  if (!hasSlotPhoto && item.photo) details[legacySlot].photo = item.photo;
  if (!hasSlotLocation && item.location) details[legacySlot].location = item.location;
  if (!hasSlotGps && item.latitude && item.longitude) {
    details[legacySlot].lat = item.latitude;
    details[legacySlot].lng = item.longitude;
  }
  return details;
}

function renderSlotPhoto(photo, altText) {
  if (!photo) return '--';
  const encodedPhoto = encodeURIComponent(photo);
  return `
    <button class="table-photo-btn" type="button" data-photo-src="${encodedPhoto}" data-photo-alt="${escapeHtml(altText)}">
      <img class="table-photo" src="${photo}" alt="${altText}" />
    </button>
  `;
}

function normalizeCoordinate(value) {
  const parsed = Number.parseFloat(String(value ?? '').trim());
  if (!Number.isFinite(parsed)) return '';
  return parsed.toFixed(5);
}

function buildMapLabel(locationText) {
  const raw = String(locationText || '').trim();
  if (!raw) return '';
  const firstPart = raw.split(',').map((part) => part.trim()).filter(Boolean)[0] || raw;
  return firstPart.slice(0, 60);
}

function buildGoogleMapsUrl(lat, lng, locationText = '') {
  const normalizedLat = normalizeCoordinate(lat);
  const normalizedLng = normalizeCoordinate(lng);
  if (!normalizedLat || !normalizedLng) return '';
  const label = buildMapLabel(locationText);
  const queryValue = label
    ? `loc:${normalizedLat},${normalizedLng} (${label})`
    : `${normalizedLat},${normalizedLng}`;
  return `https://www.google.com/maps?q=${encodeURIComponent(queryValue)}`;
}

function renderSlotLocation(slot) {
  if (!slot) return '--';
  const lat = normalizeCoordinate(slot.lat);
  const lng = normalizeCoordinate(slot.lng);
  const locationText = slot.location ? escapeHtml(shorten(slot.location, 84)) : '';
  if (!lat || !lng) {
    if (locationText) return `<div class="gps-cell"><div class="gps-address">${locationText}</div></div>`;
    return '--';
  }
  const mapUrl = buildGoogleMapsUrl(lat, lng, slot.location || '');
  return `
    <div class="gps-cell">
      <div class="gps-coords">${lat}, ${lng}</div>
      ${locationText ? `<div class="gps-address">${locationText}</div>` : ''}
      ${mapUrl ? `<a class="table-map-link" href="${mapUrl}" target="_blank" rel="noopener noreferrer">View Map</a>` : ''}
    </div>
  `;
}

function openPhotoPreview(photoSrc, altText = 'Attendance Photo') {
  if (!photoPreviewModal || !photoPreviewImage || !photoSrc) return;
  photoPreviewImage.src = photoSrc;
  photoPreviewImage.alt = altText;
  photoPreviewModal.classList.remove('hidden');
}

function closePhotoPreview() {
  if (!photoPreviewModal || !photoPreviewImage) return;
  photoPreviewModal.classList.add('hidden');
  photoPreviewImage.src = '';
  photoPreviewImage.alt = 'Attendance Photo';
}

function hasAnyAttendanceLocal(item) {
  if (!item) return false;
  return !!(
    item.timeInAM ||
    item.timeOutAM ||
    item.timeInPM ||
    item.timeOutPM ||
    item.timeIn ||
    item.timeOut
  );
}

async function ensureEmployeesLoaded() { 
  if (employeesCache.length) return; 
  const data = await api(withOfficeScope('/api/employees')); 
  employeesCache = data.employees || []; 
} 

function normalizeStatus(value) {
  return String(value || '').toLowerCase();
}

async function buildStatusList(status, from, to) { 
  const query = new URLSearchParams({ from, to }).toString(); 
  const data = await api(withOfficeScope(`/api/attendance?${query}`)); 
  const raw = data.attendance || []; 
  const unique = new Map(); 
  raw.forEach((item) => { 
    const key = `${item.date}|${item.employeeId}`; 
    if (!unique.has(key)) unique.set(key, item);
  });
  const records = Array.from(unique.values());

  if (status === 'present' || status === 'late') {
    return records
      .filter((item) => normalizeStatus(item.status) === status)
      .map((item) => ({
        date: item.date,
        employeeName: item.employeeName,
        office: item.office,
        status: item.status || status
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName));
  }

  await ensureEmployeesLoaded(); 
  const activeEmployees = activeEmployeesFromCache(); 
  if (!activeEmployees.length) return []; 
  const seen = new Set(records.map((item) => `${item.date}|${item.employeeId}`)); 
  // Attendance system is used every Friday; compute absences only for scheduled Fridays.
  const dates = buildDateList(from, to).filter(isFridayDate); 
  const list = []; 
  dates.forEach((date) => { 
    activeEmployees.forEach((emp) => { 
      if (!seen.has(`${date}|${emp.id}`)) { 
        list.push({ 
          date,
          employeeName: emp.name,
          office: emp.office,
          status: 'Absent'
        });
      }
    });
  });
  return list.sort((a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName));
}

function setStatModalLoading(message = 'Loading…') {
  if (!statModalTable) return;
  const tbody = statModalTable.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = `
    <tr class="stat-loading">
      <td colspan="4">${message}</td>
    </tr>
  `;
  if (statModalEmpty) statModalEmpty.classList.add('hidden');
}

async function loadStatBase(from, to, needsEmployees = false) { 
  const key = `${from}|${to}`; 
  const now = Date.now(); 
  if (statCache.key === key && (now - statCache.time) < STAT_CACHE_TTL) { 
    return { attendance: statCache.attendance, employees: statCache.employees }; 
  } 
  const query = new URLSearchParams({ from, to }).toString(); 
  const tasks = [api(withOfficeScope(`/api/attendance?${query}`))]; 
  if (needsEmployees || !employeesCache.length) { 
    tasks.push(api(withOfficeScope('/api/employees'))); 
  } 
  const results = await Promise.all(tasks); 
  const attendance = (results[0] && results[0].attendance) || []; 
  let employees = employeesCache; 
  if (results[1] && results[1].employees) { 
    employees = results[1].employees;
    employeesCache = employees;
  }
  statCache.key = key;
  statCache.time = now;
  statCache.attendance = attendance;
  statCache.employees = employees;
  return { attendance, employees };
}

function buildStatusListFromBase(status, from, to, attendance, employees) {
  const raw = attendance || [];
  const unique = new Map();
  raw.forEach((item) => {
    const key = `${item.date}|${item.employeeId}`;
    if (!unique.has(key)) unique.set(key, item);
  });
  const records = Array.from(unique.values());

  if (status === 'present' || status === 'late') {
    return records
      .filter((item) => normalizeStatus(item.status) === status)
      .map((item) => ({
        date: item.date,
        employeeName: item.employeeName,
        office: item.office,
        status: item.status || status
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName));
  }

  const activeEmployees = (employees || []).filter((emp) => !isDeletedEmployee(emp)); 
  if (!activeEmployees.length) return []; 
  const seen = new Set(records.map((item) => `${item.date}|${item.employeeId}`)); 
  // Attendance system is used every Friday; compute absences only for scheduled Fridays.
  const dates = buildDateList(from, to).filter(isFridayDate); 
  const list = []; 
  dates.forEach((date) => { 
    activeEmployees.forEach((emp) => { 
      if (!seen.has(`${date}|${emp.id}`)) { 
        list.push({ 
          date,
          employeeName: emp.name,
          office: emp.office,
          status: 'Absent'
        });
      }
    });
  });
  return list.sort((a, b) => a.date.localeCompare(b.date) || a.employeeName.localeCompare(b.employeeName));
}

function renderStatModalRows(list, status) {
  if (!statModalTable) return;
  const tbody = statModalTable.querySelector('tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!list.length) {
    if (statModalEmpty) statModalEmpty.classList.remove('hidden');
    return;
  }
  if (statModalEmpty) statModalEmpty.classList.add('hidden');
  list.forEach((item) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.date || '--'}</td>
      <td>${item.employeeName || '--'}</td>
      <td>${item.office || '--'}</td>
      <td class="status-cell">${item.status || status}</td>
    `;
    setStatusCell(row.querySelector('.status-cell'), item.status || status);
    tbody.appendChild(row);
  });
}

async function openStatModal(status) {
  if (!statModal) return;
  const labelMap = { present: 'Present', late: 'Late', absent: 'Absent' };
  const { from, to } = getMonthRange();
  if (statModalTitle) statModalTitle.textContent = `${labelMap[status] || 'Status'} Details`;
  if (statModalSubtitle) statModalSubtitle.textContent = `Coverage: ${from} to ${to}`;
  statModal.classList.remove('hidden');
  setStatModalLoading();
  try {
    const needsEmployees = status === 'absent';
    const base = await loadStatBase(from, to, needsEmployees);
    const list = buildStatusListFromBase(status, from, to, base.attendance, base.employees);
    renderStatModalRows(list, status);
  } catch (err) {
    setStatModalLoading('Unable to load data. Please try again.');
  }
}

function closeStatModal() {
  if (statModal) statModal.classList.add('hidden');
}

function buildReportKey(employeeId, date) {
  return `${employeeId || ''}|${date || ''}`;
}

function buildReportDraftKey(report) {
  const reportId = String(report && report.id ? report.id : '').trim();
  if (reportId) return `id:${reportId}`;
  const employeeId = String(report && report.employeeId ? report.employeeId : '').trim();
  const reportDate = String(report && report.reportDate ? report.reportDate : '').trim();
  return `emp:${employeeId}|date:${reportDate}`;
}

function isEditingReportAttestedInput() {
  const active = document.activeElement;
  return Boolean(active && active.classList && active.classList.contains('report-attested-input'));
}

function buildRangeQuery(from, to) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return params.toString();
}

function updateReportMap(list) {
  reportMap = new Map();
  list.forEach((report) => {
    reportMap.set(buildReportKey(report.employeeId, report.reportDate), report);
  });
}

function shorten(text, max = 90) {
  const value = String(text || '');
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function fetchAttendanceForReport(employeeId, reportDate) { 
  if (!employeeId || !reportDate) return null; 
  const query = new URLSearchParams({ employeeId, from: reportDate, to: reportDate }).toString(); 
  const data = await api(withOfficeScope(`/api/attendance?${query}`)); 
  return (data.attendance || [])[0] || null; 
} 

async function openReportPrint(report) {
  if (!report) return;

  let attendanceRecord = null;
  try {
    attendanceRecord = await fetchAttendanceForReport(report.employeeId, report.reportDate);
  } catch (err) {
    attendanceRecord = null;
  }

  const emp = employeesCache.find((item) => item.id === report.employeeId) || {};
  const employeeName = emp.name || report.employeeName || 'Employee';
  const employeePosition = emp.position || 'Staff';
  const employeeOffice = emp.office || report.office || '';
  const reportDate = report.reportDate || '--';
  const attTimes = attendanceRecord ? buildAttendanceSlotTimes(attendanceRecord) : { amIn: '', amOut: '', pmIn: '', pmOut: '' };
  const timeInAM = attTimes.amIn || '--';
  const timeOutAM = attTimes.amOut || '--';
  const timeInPM = attTimes.pmIn || '--';
  const timeOutPM = attTimes.pmOut || '--';
  const attestedBy = String(report.attestedBy || '').trim() || '______________________________';
  const attestedPosition = String(report.attestedPosition || '').trim() || '______________________________';
  const summaryHtml = escapeHtml(report.summary || '').replace(/\n/g, '<br>');
  const assetVersion = Date.now();
  const sealUrl = `${window.location.origin}/admin/assets/deped-seal.png?v=${assetVersion}`;
  const depedLogo = `${window.location.origin}/admin/assets/deped-wordmark.png?v=${assetVersion}`;
  const bagongLogo = `${window.location.origin}/admin/assets/bagong-pilipinas.png?v=${assetVersion}`;
  const sdoLogo = `${window.location.origin}/admin/assets/logo.jpg?v=${assetVersion}`;

  const printWindow = window.open(`${window.location.origin}/admin/`, '', 'width=900,height=700');
  if (!printWindow) {
    alert('Unable to open print preview. Please allow popups and try again.');
    return;
  }
  printWindow.document.open();
  printWindow.document.write(`
    <html>
      <head>
        <title>Individual Daily Log and Accomplishment Report</title>
        <style>
          @page { margin: 12mm; }
          html, body { margin: 0; padding: 0; }
          body { font-family: "Times New Roman", serif; color: #111; }
          .page { min-height: 100vh; display: flex; flex-direction: column; }
          .content { flex: 1 1 auto; }
          .report-header { text-align: center; }
          .seal { width: 20mm; height: 20mm; object-fit: contain; margin: 0 auto 3px; display: block; }
          .header-text { line-height: 1.1; }
          .rep { font-size: 12px; letter-spacing: 0.02em; font-family: "Old English Text MT", "Garamond", "Times New Roman", serif; }
          .dept { font-weight: 700; font-size: 20px; letter-spacing: 0.04em; text-transform: uppercase; font-family: "Old English Text MT", "Garamond", "Times New Roman", serif; }
          .division { font-weight: 700; font-size: 11px; letter-spacing: 0.14em; }
          .header-lines { margin: 6px 0 2px; }
          .header-line { border-top: 2px solid #000; }
          .header-line.thin { border-top: 1px solid #000; margin-top: 2px; }
          .office-line { font-size: 12px; font-weight: 700; text-align: left; margin: 4px 0 2px; }
          .title { margin: 10px 0 2px; font-weight: 700; font-size: 13px; text-align: center; }
          .subtitle { margin: 0 0 10px; font-weight: 700; font-size: 12px; text-align: center; }
          .meta { font-size: 12px; margin-top: 2px; }
          .meta-row { display: flex; gap: 10px; margin: 4px 0; align-items: flex-end; }
          .meta-label { width: 90px; font-weight: 700; }
          .meta-line { flex: 1; border-bottom: 1px solid #000; min-height: 14px; }
          table.report { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
          table.report th, table.report td { border: 1px solid #000; padding: 6px; vertical-align: top; }
          table.report th { text-align: center; font-weight: 700; }
          .logs { line-height: 1.5; white-space: pre-line; }
          .signatures { display: flex; justify-content: space-between; margin-top: 18px; font-size: 12px; }
          .sig { width: 44%; text-align: center; }
          .sig-line { border-top: 1px solid #000; margin-top: 22px; }
          .footer { margin-top: 14mm; font-size: 10px; page-break-inside: avoid; }
          .footer-line { border-top: 1.5px solid #000; margin-bottom: 6px; }
          .footer-content { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
          .footer-logos { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
          .footer-logos img { width: 42px; height: 42px; object-fit: contain; }
          .footer-text { line-height: 1.35; flex: 1 1 220px; min-width: 220px; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="content">
            <div class="report-header">
              <img class="seal" src="${sealUrl}" alt="Seal" />
              <div class="header-text">
                <div class="rep">Republic of the Philippines</div>
                <div class="dept">Department of Education</div>
                <div class="division">SCHOOLS DIVISION OF MARINDUQUE</div>
              </div>
              <div class="header-lines">
                <div class="header-line"></div>
                <div class="header-line thin"></div>
              </div>
              <div class="office-line">Office of the Schools Division Superintendent</div>
              <div class="header-line thin"></div>
              <div class="title">INDIVIDUAL DAILY LOG AND ACCOMPLISHMENT REPORT</div>
              <div class="subtitle">(WORK FROM HOME)</div>
            </div>

            <div class="meta">
              <div class="meta-row"><span class="meta-label">NAME:</span><span class="meta-line">${escapeHtml(employeeName)}</span></div>
              <div class="meta-row"><span class="meta-label">POSITION:</span><span class="meta-line">${escapeHtml(employeePosition)}</span></div>
              <div class="meta-row"><span class="meta-label">DIVISION:</span><span class="meta-line">Office of the Schools Division Superintendent</span></div>
              <div class="meta-row"><span class="meta-label">SECTION:</span><span class="meta-line">${escapeHtml(employeeOffice || '--')}</span></div>
              <div class="meta-row"><span class="meta-label">Date/s Covered:</span><span class="meta-line">${escapeHtml(reportDate)}</span></div>
            </div>

            <table class="report">
              <thead>
                <tr>
                  <th>Date and Actual Time Logs</th>
                  <th>Actual Accomplishments</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="logs">${escapeHtml(reportDate)}\nAM In: ${escapeHtml(timeInAM)}\nAM Out: ${escapeHtml(timeOutAM)}\nPM In: ${escapeHtml(timeInPM)}\nPM Out: ${escapeHtml(timeOutPM)}</td>
                  <td>${summaryHtml || '&nbsp;'}</td>
                </tr>
              </tbody>
            </table>

            <div class="signatures">
              <div class="sig">
                <div>Submitted by:</div>
                <div class="sig-line"></div>
                <div><strong>${escapeHtml(employeeName)}</strong></div>
                <div>${escapeHtml(employeePosition)}</div>
              </div>
              <div class="sig">
                <div>Attested by:</div>
                <div class="sig-line"></div>
                <div><strong>${escapeHtml(attestedBy)}</strong></div>
                <div>${escapeHtml(attestedPosition)}</div>
              </div>
            </div>
          </div>
          <div class="footer">
            <div class="footer-line"></div>
            <div class="footer-content">
              <div class="footer-logos">
                <img src="${depedLogo}" alt="DepEd" onerror="this.style.display='none'" />
                <img src="${bagongLogo}" alt="Bagong Pilipinas" onerror="this.style.display='none'" />
                <img src="${sdoLogo}" alt="SDO Marinduque" onerror="this.style.display='none'" />
              </div>
              <div class="footer-text">
                Address: T. Roque St., Malusak, Boac, Marinduque<br/>
                Tel. No.: (042) 754-0247 ● Fax No.: (042) 332-1611<br/>
                Email: marinduque@deped.gov.ph<br/>
                Website: https://depedmarinduque.com
              </div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  const finalizePrint = () => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch (err) {
      // ignore print errors
    }
  };

  const waitForImages = () => {
    const images = Array.from(printWindow.document.images || []);
    if (!images.length) {
      finalizePrint();
      return;
    }
    let done = 0;
    const checkDone = () => {
      done += 1;
      if (done >= images.length) finalizePrint();
    };
    images.forEach((img) => {
      if (img.complete) {
        checkDone();
      } else {
        img.addEventListener('load', checkDone, { once: true });
        img.addEventListener('error', checkDone, { once: true });
      }
    });
    setTimeout(finalizePrint, 1500);
  };

  if (printWindow.document.readyState === 'complete') {
    waitForImages();
  } else {
    printWindow.onload = waitForImages;
  }
}

async function api(path, options = {}) { 
  const method = String(options.method || 'GET').toUpperCase();
  const cacheBustedPath =
    method === 'GET'
      ? `${path}${path.includes('?') ? '&' : '?'}_ts=${Date.now()}`
      : path;
  const res = await fetch(cacheBustedPath, {
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    data = { message: text };
  }
  if (!res.ok) {
    const error = new Error(data.message || 'Request failed');
    error.status = res.status;
    throw error;
  }
  return data; 
} 

function normalizeOfficeScope(value) {
  const raw = String(value || '').trim();
  const office = raw.toLowerCase();

  // Accept common aliases saved in older data (e.g., "CID Unit", "CID", "SGOD Unit").
  const isCid =
    office === 'curriculum implementation division' ||
    office === 'cid' ||
    office === 'cid unit' ||
    office.includes('curriculum implementation') ||
    office.startsWith('cid');

  const isSgod =
    office === 'school governance and operations division' ||
    office === 'sgod' ||
    office === 'sgod unit' ||
    office.includes('school governance and operations') ||
    office.startsWith('sgod');

  if (isCid) return 'Curriculum Implementation Division';
  if (isSgod) return 'School Governance and Operations Division';
  return '';
}

function withOfficeScope(path) {
  if (!officeScope) return path;
  const glue = path.includes('?') ? '&' : '?';
  return `${path}${glue}office=${encodeURIComponent(officeScope)}`;
}

async function loadSummary() { 
  const data = await api(withOfficeScope(`/api/summary?date=${isoToday()}`)); 
  statTotal.textContent = data.totalEmployees; 
  statPresent.textContent = data.present; 
  statLate.textContent = data.late; 
  statAbsent.textContent = data.absent; 
} 

async function loadAttendanceToday() { 
  const today = isoToday(); 
  const [attendanceResult, reportsResult] = await Promise.allSettled([ 
    api(withOfficeScope(`/api/attendance/today?date=${today}`)), 
    api(withOfficeScope(`/api/reports?from=${today}&to=${today}`)) 
  ]); 
  if (attendanceResult.status !== 'fulfilled') throw attendanceResult.reason;
  const data = attendanceResult.value;
  const reportData = reportsResult.status === 'fulfilled' ? reportsResult.value : { reports: [] };
  attendanceCache = data.attendance;
  reportsCache = reportData.reports || [];
  updateReportMap(reportsCache);
  attendanceTable.innerHTML = '';
  data.attendance.forEach((item) => {
    const times = buildAttendanceSlotTimes(item);
    const slotStatuses = buildAttendanceSlotStatuses(item);
    const report = reportMap.get(buildReportKey(item.employeeId, item.date));
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.employeeId}</td>
      <td>${item.employeeName}</td>
      <td>${item.office}</td>
      <td>${times.amIn || '--'}</td>
      <td class="status-cell status-am-in">${slotStatuses.amIn}</td>
      <td>${times.amOut || '--'}</td>
      <td class="status-cell status-am-out">${slotStatuses.amOut}</td>
      <td>${times.pmIn || '--'}</td>
      <td class="status-cell status-pm-in">${slotStatuses.pmIn}</td>
      <td>${times.pmOut || '--'}</td>
      <td class="status-cell status-pm-out">${slotStatuses.pmOut}</td>
      <td> 
        ${report ? `<button class="table-action-btn" data-report="${report.id}" data-employee="${item.employeeId}" data-date="${item.date}">Print Report</button>` : '<span class="no-report-badge">No report has been attached yet</span>'} 
      </td> 
    `;
    setStatusCell(row.querySelector('.status-am-in'), slotStatuses.amIn);
    setStatusCell(row.querySelector('.status-am-out'), slotStatuses.amOut);
    setStatusCell(row.querySelector('.status-pm-in'), slotStatuses.pmIn);
    setStatusCell(row.querySelector('.status-pm-out'), slotStatuses.pmOut);
    attendanceTable.appendChild(row);
  });
}

async function loadEmployees() { 
  const data = await api(withOfficeScope('/api/employees')); 
  employeesCache = data.employees; 
  renderEmployees(employeesCache); 
  populateDtrEmployees(); 
} 

function renderEmployees(list) { 
  employeesTable.innerHTML = ''; 
  list.forEach((emp) => { 
    const statusValue = normalizeEmployeeStatus(emp.status); 
    const deleted = statusValue.toLowerCase() === 'deleted'; 
    const actionLabel = deleted ? 'Restore' : 'Delete'; 
    const actionType = deleted ? 'restore' : 'delete'; 
    const actionClass = deleted ? 'table-action-btn' : 'table-action-btn danger'; 
    const row = document.createElement('tr'); 
    row.innerHTML = ` 
      <td>${emp.id}</td> 
      <td>${emp.name}</td> 
      <td> 
        <span>${escapeHtml(String(emp.position || ''))}</span> 
        <button class="table-action-btn ghost" data-edit-position="${emp.id}" type="button">Edit</button> 
      </td> 
      <td>${emp.office}</td> 
      <td>${statusValue}</td> 
      <td> 
        <button class="${actionClass}" data-employee-action="${actionType}" data-employee-id="${emp.id}"> 
          ${actionLabel} 
        </button>
      </td>
    `;
    employeesTable.appendChild(row); 
  }); 
} 

async function updateEmployeePosition(employeeId, position) { 
  return api('/api/employees/update', { 
    method: 'POST', 
    body: JSON.stringify({ id: employeeId, position }) 
  }); 
} 

async function loadAttendanceHistory(from, to) { 
  const query = buildRangeQuery(from, to); 
  const attendancePath = withOfficeScope(query ? `/api/attendance?${query}` : '/api/attendance'); 
  const reportsPath = withOfficeScope(query ? `/api/reports?${query}` : '/api/reports'); 
  const [attendanceResult, reportsResult] = await Promise.allSettled([ 
    api(attendancePath), 
    api(reportsPath) 
  ]); 
  if (attendanceResult.status !== 'fulfilled') throw attendanceResult.reason;
  const data = attendanceResult.value;
  const reportData = reportsResult.status === 'fulfilled' ? reportsResult.value : { reports: [] };
  reportsCache = reportData.reports || [];
  updateReportMap(reportsCache);
  attendanceHistory.innerHTML = '';
  data.attendance.forEach((item) => {
    const times = buildAttendanceSlotTimes(item);
    const slotStatuses = buildAttendanceSlotStatuses(item);
    const report = reportMap.get(buildReportKey(item.employeeId, item.date));
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.date}</td>
      <td>${item.employeeName}</td>
      <td>${item.office}</td>
      <td>${times.amIn || '--'}</td>
      <td class="status-cell status-am-in">${slotStatuses.amIn}</td>
      <td>${times.amOut || '--'}</td>
      <td class="status-cell status-am-out">${slotStatuses.amOut}</td>
      <td>${times.pmIn || '--'}</td>
      <td class="status-cell status-pm-in">${slotStatuses.pmIn}</td>
      <td>${times.pmOut || '--'}</td>
      <td class="status-cell status-pm-out">${slotStatuses.pmOut}</td>
      <td> 
        ${report ? `<button class="table-action-btn" data-report="${report.id}" data-employee="${item.employeeId}" data-date="${item.date}">Print Report</button>` : '<span class="no-report-badge">No report has been attached yet</span>'} 
      </td> 
    `;
    setStatusCell(row.querySelector('.status-am-in'), slotStatuses.amIn);
    setStatusCell(row.querySelector('.status-am-out'), slotStatuses.amOut);
    setStatusCell(row.querySelector('.status-pm-in'), slotStatuses.pmIn);
    setStatusCell(row.querySelector('.status-pm-out'), slotStatuses.pmOut);
    attendanceHistory.appendChild(row);
  });
}

function renderNotifications(list) {
  notifList.innerHTML = '';
  if (!list.length) {
    notifEmpty.classList.remove('hidden');
  } else {
    notifEmpty.classList.add('hidden');
  }
  list.forEach((note) => {
    const item = document.createElement('div');
    item.className = `panel-item ${note.read ? '' : 'unread'}`;
    item.innerHTML = `
      <div class="panel-title">${note.title || 'Notification'}</div>
      <div class="panel-message">${note.message || ''}</div>
      <div class="panel-meta">${formatDateTimeStamp(note.createdAt)}</div>
    `;
    notifList.appendChild(item);
  });
  const unread = list.filter((n) => !n.read).length;
  updateBadge(notifCount, unread);
}

async function loadNotifications() {
  try {
    const data = await api('/api/notifications');
    notificationsCache = data.notifications || [];
    renderNotifications(notificationsCache);
  } catch (err) {
    // ignore notification failures
  }
}

function renderMessages(list) {
  msgList.innerHTML = '';
  if (!list.length) {
    msgEmpty.classList.remove('hidden');
  } else {
    msgEmpty.classList.add('hidden');
  }
  list.forEach((msg) => {
    const item = document.createElement('div');
    item.className = `panel-item ${msg.read ? '' : 'unread'}`;
    item.innerHTML = `
      <div class="panel-title">${msg.subject || 'Concern'}</div>
      <div class="panel-message">${msg.employeeName || 'Employee'}${msg.office ? ` · ${msg.office}` : ''}</div>
      <div class="panel-message">${msg.message || ''}</div>
      <div class="panel-meta">${formatDateTimeStamp(msg.createdAt)}</div>
    `;
    msgList.appendChild(item);
  });
  const unread = list.filter((m) => !m.read).length;
  updateBadge(msgCount, unread);
}

async function loadMessages() {
  try {
    const data = await api('/api/messages');
    messagesCache = data.messages || [];
    renderMessages(messagesCache);
  } catch (err) {
    // ignore message failures
  }
}

function renderReportsTable(list) {
  reportsTable.innerHTML = '';
  list.forEach((report) => {
    const draftKey = buildReportDraftKey(report);
    const draft = reportAttestedDrafts.get(draftKey) || {};
    const attestedBy = Object.prototype.hasOwnProperty.call(draft, 'attestedBy')
      ? String(draft.attestedBy || '')
      : String(report.attestedBy || '');
    const attestedPosition = Object.prototype.hasOwnProperty.call(draft, 'attestedPosition')
      ? String(draft.attestedPosition || '')
      : String(report.attestedPosition || '');
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${report.reportDate || '--'}</td>
      <td>${report.employeeName || '--'}</td>
      <td>${report.office || '--'}</td>
      <td class="summary-cell">${shorten(report.summary || '--')}</td>
      <td>
        <input
          class="report-attested-input"
          type="text"
          data-report-key="${escapeHtml(draftKey)}"
          data-attested-by="${report.id}"
          placeholder="Attested by name"
          value="${escapeHtml(attestedBy)}"
        />
      </td>
      <td>
        <input
          class="report-attested-input"
          type="text"
          data-report-key="${escapeHtml(draftKey)}"
          data-attested-position="${report.id}"
          placeholder="Attested by position"
          value="${escapeHtml(attestedPosition)}"
        />
      </td>
      <td>
        <button class="table-action-btn" data-save-attested="${report.id}" data-employee="${report.employeeId}" data-date="${report.reportDate}">Save</button>
        <button class="table-action-btn ghost" data-report="${report.id}" data-employee="${report.employeeId}" data-date="${report.reportDate}">Print</button>
      </td>
    `;
    reportsTable.appendChild(row);
  });
  updateReportMap(list);
}

async function loadReportsTable(from, to) { 
  let query = buildRangeQuery(from, to); 

  // Super admin can filter by office; CID/SGOD scoped admins are already filtered by officeScope.
  if (!officeScope && reportsOfficeFilter) {
    const selectedOffice = String(reportsOfficeFilter.value || '').trim();
    if (selectedOffice) {
      const params = new URLSearchParams(query);
      params.set('office', selectedOffice);
      query = params.toString();
    }
  }

  const path = withOfficeScope(query ? `/api/reports?${query}` : '/api/reports'); 
  const data = await api(path); 
  reportsCache = data.reports || []; 
  renderReportsTable(reportsCache); 
} 

function syncUpdatedReportInCache(updatedReport) {
  if (!updatedReport) return;
  const byIdIndex = reportsCache.findIndex((item) => item.id === updatedReport.id);
  if (byIdIndex >= 0) {
    reportsCache[byIdIndex] = { ...reportsCache[byIdIndex], ...updatedReport };
  } else {
    const byEmployeeDate = reportsCache.findIndex(
      (item) => item.employeeId === updatedReport.employeeId && item.reportDate === updatedReport.reportDate
    );
    if (byEmployeeDate >= 0) reportsCache[byEmployeeDate] = { ...reportsCache[byEmployeeDate], ...updatedReport };
  }
  updateReportMap(reportsCache);
}

async function handleReportAttestedSave(button) {
  if (!button) return;
  const reportId = button.dataset.saveAttested || '';
  const employeeId = button.dataset.employee || '';
  const reportDate = button.dataset.date || '';
  const row = button.closest('tr');
  const attestedByInput = row ? row.querySelector('input[data-attested-by]') : null;
  const attestedPositionInput = row ? row.querySelector('input[data-attested-position]') : null;
  const draftKey = row ? String((row.querySelector('input[data-report-key]') || {}).dataset?.reportKey || '') : '';
  const attestedBy = String(attestedByInput ? attestedByInput.value : '').trim();
  const attestedPosition = String(attestedPositionInput ? attestedPositionInput.value : '').trim();

  const previousLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Saving...';
  try {
    const data = await api('/api/reports/attested', {
      method: 'POST',
      body: JSON.stringify({
        id: reportId,
        employeeId,
        reportDate,
        attestedBy,
        attestedPosition
      })
    });
    const updated = data && data.report ? data.report : null;
    syncUpdatedReportInCache(updated);
    if (draftKey) reportAttestedDrafts.delete(draftKey);
    if (updated) {
      if (attestedByInput) attestedByInput.value = updated.attestedBy || '';
      if (attestedPositionInput) attestedPositionInput.value = updated.attestedPosition || '';
    }
    alert('Attested by details saved.');
  } catch (err) {
    alert(err.message || 'Unable to save attested by details.');
  } finally {
    button.disabled = false;
    button.textContent = previousLabel;
  }
}

function populateDtrEmployees() {
  if (!dtrEmployee) return;
  dtrEmployee.innerHTML = '<option value="" disabled selected>Select Employee</option>';
  activeEmployeesFromCache().forEach((emp) => {
    const option = document.createElement('option');
    option.value = emp.id;
    option.textContent = `${emp.name} (${emp.id})`;
    dtrEmployee.appendChild(option);
  });
}

async function updateEmployeeStatus(employeeId, actionType) {
  const endpoint = actionType === 'restore' ? '/api/employees/restore' : '/api/employees/delete';
  return api(endpoint, {
    method: 'POST',
    body: JSON.stringify({ id: employeeId })
  });
}

async function handleEmployeesActionClick(event) { 
  const editBtn = event.target.closest('[data-edit-position]'); 
  if (editBtn) { 
    const employeeId = String(editBtn.dataset.editPosition || '').trim(); 
    if (!employeeId) return; 
    const employee = employeesCache.find((emp) => emp.id === employeeId); 
    const currentPosition = employee ? String(employee.position || '').trim() : ''; 
    const nextPosition = window.prompt(`Edit position for ${employeeId}:`, currentPosition); 
    if (nextPosition === null) return; 
    const position = String(nextPosition || '').trim(); 
    if (!position) { 
      alert('Position is required.'); 
      return; 
    } 
    try { 
      await updateEmployeePosition(employeeId, position); 
      await loadEmployees(); 
    } catch (err) { 
      alert(err.message || 'Unable to update position.'); 
    } 
    return; 
  } 
 
  const button = event.target.closest('[data-employee-action]'); 
  if (!button) return; 
  const actionType = String(button.dataset.employeeAction || '').trim(); 
  const employeeId = String(button.dataset.employeeId || '').trim(); 
  if (!employeeId || !actionType) return; 
  const label = actionType === 'restore' ? 'restore' : 'delete';
  const confirmed = window.confirm(`Are you sure you want to ${label} employee ${employeeId}?`);
  if (!confirmed) return;
  try {
    await updateEmployeeStatus(employeeId, actionType);
    await loadEmployees();
  } catch (err) {
    alert(err.message || `Unable to ${label} employee.`);
  }
}

async function generateDtr() { 
  const employeeId = dtrEmployee.value;
  const monthValue = dtrMonth.value;
  if (!employeeId || !monthValue) {
    dtrPreview.textContent = 'Select an employee and month first.';
    return;
  }
  const [year, month] = monthValue.split('-').map(Number);
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const toDate = new Date(year, month, 0);
  const to = `${year}-${String(month).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;
  const query = new URLSearchParams({ from, to, employeeId }).toString(); 
  const data = await api(withOfficeScope(`/api/attendance?${query}`)); 
  const list = (data.attendance || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date))); 
  const map = new Map(list.map((item) => [item.date, item]));
  const employee = employeesCache.find((emp) => emp.id === employeeId);
  const employeeName = employee ? employee.name : (list[0] ? list[0].employeeName : 'Employee');
  const employeeOffice = employee ? employee.office : (list[0] ? list[0].office : '');
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const daysInMonth = toDate.getDate();

  const rows = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const rec = map.get(dateStr);
    const hasAttendance = hasAnyAttendanceLocal(rec);
    const dayOfWeek = new Date(year, month - 1, day).getDay(); 
    const weekendLabel = dayOfWeek === 0 ? 'Sun' : (dayOfWeek === 6 ? 'Sat' : ''); 
 
    if (!hasAttendance) { 
      // Requirement: do not mark ABSENT; keep rows blank when no attendance.
      rows.push(` 
        <tr> 
          <td class="center">${day}</td> 
          <td></td> 
          <td></td> 
          <td></td> 
          <td></td> 
          <td></td> 
          <td class="center">${weekendLabel}</td> 
        </tr> 
      `); 
      continue; 
    } 

    const times = buildAttendanceSlotTimes(rec || {});
    rows.push(`
      <tr>
        <td class="center">${day}</td>
        <td class="center">${times.amIn || ''}</td>
        <td class="center">${times.amOut || ''}</td>
        <td class="center">${times.pmIn || ''}</td>
        <td class="center">${times.pmOut || ''}</td>
        <td></td>
        <td class="center">${weekendLabel}</td>
      </tr>
    `);
  }

  dtrPreview.innerHTML = `
    <div class="dtr-sheet">
      <div class="dtr-header">
        <div>
          <div class="dtr-title">DAILY TIME RECORD</div>
          <div class="dtr-sub">Name: <strong>${employeeName}</strong></div>
          <div class="dtr-sub">For the month of <strong>${monthLabel}</strong></div>
          <div class="dtr-sub">Office hours for arrival and departure</div>
        </div>
        <div class="dtr-formno">CIVIL SERVICE FORM No. 48</div>
      </div>

      <div class="dtr-meta">
        <div>(Regular days)</div>
        <div>(Saturdays)</div>
        <div>Service as required</div>
      </div>

      <table class="dtr-table">
        <thead>
          <tr>
            <th rowspan="2" class="center">DAY</th>
            <th colspan="2" class="center">A.M.</th>
            <th colspan="2" class="center">P.M.</th>
            <th colspan="2" class="center">UNDERTIME</th>
          </tr>
          <tr>
            <th class="center">Arrival</th>
            <th class="center">Departure</th>
            <th class="center">Arrival</th>
            <th class="center">Departure</th>
            <th class="center">Hours</th>
            <th class="center">Minutes</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join('')}
        </tbody>
      </table>

      <div class="dtr-footer">
        <div class="dtr-total">TOTAL</div>
        <p class="dtr-cert">
          I CERTIFY on my honor that the above is a true and correct report of the hours of work performed,
          record of which was made daily at the time of arrival at and departure from office.
        </p>
        <div class="dtr-signatures">
          <div>Verified as to the prescribed office hours</div>
          <div class="line"></div>
          <div class="line"></div>
        </div>
        <div class="dtr-office">Office: <strong>${employeeOffice || ''}</strong></div>
      </div>
    </div>
  `;
}

function printDtr() {
  if (!dtrPreview.innerHTML.trim()) {
    dtrPreview.textContent = 'Generate a DTR first.';
    return;
  }
  const printWindow = window.open('', '', 'width=900,height=700');
  printWindow.document.write(`
    <html>
      <head>
        <title>DTR Print</title>
        <style>
          body { font-family: "Times New Roman", serif; padding: 24px; color: #1b1b1b; }
          .dtr-sheet { border: 1px solid #222; padding: 16px; }
          .dtr-header { display: flex; justify-content: space-between; align-items: flex-start; }
          .dtr-title { font-weight: 700; font-size: 18px; }
          .dtr-sub { font-size: 12px; margin-top: 2px; }
          .dtr-formno { font-size: 12px; }
          .dtr-meta { display: flex; gap: 18px; font-size: 11px; margin: 6px 0 10px; }
          .dtr-table { width: 100%; border-collapse: collapse; font-size: 12px; }
          .dtr-table th, .dtr-table td { border: 1px solid #222; padding: 4px; }
          .center { text-align: center; }
          .absent { font-weight: 700; letter-spacing: 2px; }
          .weekend { color: #a00; font-weight: 700; }
          .dtr-footer { margin-top: 14px; font-size: 11px; }
          .dtr-total { font-weight: 700; margin-bottom: 8px; }
          .dtr-signatures { display: flex; gap: 12px; align-items: center; margin-top: 8px; }
          .line { flex: 1; border-bottom: 1px solid #222; height: 1px; }
          .dtr-office { margin-top: 6px; }
        </style>
      </head>
      <body>
        ${dtrPreview.innerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function closePanels() {
  [notifPanel, msgPanel, menuPanel].forEach((panel) => {
    if (panel) panel.classList.add('hidden');
  });
}

function togglePanel(panel) {
  const isOpen = panel && !panel.classList.contains('hidden');
  closePanels();
  if (panel && !isOpen) panel.classList.remove('hidden');
}

function logoutAdmin() {
  closePanels();
  loginScreen.classList.remove('hidden');
  adminApp.classList.add('hidden');
  loginForm.reset();
  notificationsCache = [];
  messagesCache = [];
  updateBadge(notifCount, 0);
  updateBadge(msgCount, 0);
  if (refreshTimer) clearInterval(refreshTimer);
}

function openAddEmployee() {
  addEmployeeModal.classList.remove('hidden');
}

function closeAddEmployee() {
  addEmployeeModal.classList.add('hidden');
  addEmployeeForm.reset();
}

async function handleAddEmployee(event) {
  event.preventDefault();
  const formData = new FormData(addEmployeeForm);
  const payload = Object.fromEntries(formData.entries());
  await api('/api/employees', { method: 'POST', body: JSON.stringify(payload) });
  await loadEmployees();
  closeAddEmployee();
}

function getOfficeFilterSet(selectedOffice) {
  const aliases = {
    'Office of the SDS': ['Office of the SDS', 'Office of SDS', 'Superintendent Office'],
    'Office of the ASDS': ['Office of the ASDS', 'Office of ASDS', 'ASDS Office', 'Assistant Superintendent Office'],
    'Personnel Section': ['Personnel Section', 'Personnel Unit'],
    'Supply Section': ['Supply Section', 'Supply Unit'],
    'Cash Section': ['Cash Section', 'Cash Unit'],
    'Records Section': ['Records Section', 'Records Unit'],
    'Procurement Section': ['Procurement Section', 'Procurement Office'],
    'Curriculum Implementation Division': ['Curriculum Implementation Division', 'CID Unit', 'CID'],
    'School Governance and Operations Division': ['School Governance and Operations Division', 'SGOD Unit', 'SGOD'],
    'Accounting Section': ['Accounting Section', 'Accounting Unit', 'Finance Unit'],
    'Budget Section': ['Budget Section', 'Budget Unit']
  };
  const list = aliases[selectedOffice] || [selectedOffice];
  return new Set(list);
}

async function generateReport() { 
  const monthValue = document.getElementById('report-month').value;
  const office = document.getElementById('report-office').value;
  if (!monthValue) {
    reportPreview.textContent = 'Please select a month.';
    return;
  }
  const [year, month] = monthValue.split('-').map(Number);
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const toDate = new Date(year, month, 0);
  const to = `${year}-${String(month).padStart(2, '0')}-${String(toDate.getDate()).padStart(2, '0')}`;

  const query = new URLSearchParams({ from, to }).toString(); 
  const data = await api(withOfficeScope(`/api/attendance?${query}`)); 
  let list = data.attendance; 
  if (office) { 
    const officeSet = getOfficeFilterSet(office); 
    list = list.filter((item) => officeSet.has(item.office)); 
  }

  reportPreview.innerHTML = '';
  if (!list.length) {
    reportPreview.textContent = 'No records found for the selected filters.';
    return;
  }

  const table = document.createElement('table');
  table.className = 'data-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Date</th>
        <th>Employee</th>
        <th>Office</th>
        <th>Time In</th>
        <th>Time Out</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${list.map((item) => `
        <tr>
          <td>${item.date}</td>
          <td>${item.employeeName}</td>
          <td>${item.office}</td>
          <td>${item.timeIn || '--'}</td>
          <td>${item.timeOut || '--'}</td>
          <td>${item.status}</td>
        </tr>
      `).join('')}
    </tbody>
  `;
  reportPreview.appendChild(table);
}

function downloadReport() {
  if (!reportPreview.innerHTML.trim()) {
    reportPreview.textContent = 'Generate a report first.';
    return;
  }
  const printWindow = window.open('', '', 'width=900,height=700');
  printWindow.document.write(`
    <html>
      <head>
        <title>Attendance Report</title>
        <style>
          body { font-family: "Trebuchet MS", sans-serif; padding: 24px; }
          h1 { color: #0d2d6a; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border-bottom: 1px solid #ddd; padding: 8px; text-align: left; }
        </style>
      </head>
      <body>
        <h1>SDO Marinduque Attendance Report</h1>
        ${reportPreview.innerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

async function handleReportPrintClick(event) {
  const saveBtn = event.target.closest('button[data-save-attested]');
  if (saveBtn) {
    await handleReportAttestedSave(saveBtn);
    return;
  }

  const photoBtn = event.target.closest('button[data-photo-src]');
  if (photoBtn) {
    const encodedSrc = photoBtn.dataset.photoSrc || '';
    const alt = photoBtn.dataset.photoAlt || 'Attendance Photo';
    let photoSrc = '';
    try {
      photoSrc = encodedSrc ? decodeURIComponent(encodedSrc) : '';
    } catch (err) {
      photoSrc = '';
    }
    if (!photoSrc) {
      alert('Photo not available.');
      return;
    }
    openPhotoPreview(photoSrc, alt);
    return;
  }

  const btn = event.target.closest('button[data-report]');
  if (!btn) return;
  const reportId = btn.dataset.report;
  const employeeId = btn.dataset.employee;
  const reportDate = btn.dataset.date;
  let report = reportsCache.find((r) => r.id === reportId);
  if (!report && employeeId && reportDate) {
    try {
      const query = new URLSearchParams({ employeeId, from: reportDate, to: reportDate }).toString();
      const data = await api(`/api/reports?${query}`);
      report = (data.reports || [])[0];
      if (report) {
        reportsCache = data.reports || [];
        updateReportMap(reportsCache);
      }
    } catch (err) {
      alert('Unable to load report.');
      return;
    }
  }
  if (!report) {
    alert('No report found for this date.');
    return;
  }
  await openReportPrint(report);
}

function openAdminRegister() {
  adminRegisterModal.classList.remove('hidden');
}

function closeAdminRegister() {
  adminRegisterModal.classList.add('hidden');
  adminRegisterForm.reset();
}

async function handleAdminRegister(event) {
  event.preventDefault();
  const formData = new FormData(adminRegisterForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    await api('/api/admin/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    alert('Admin registered. You can now log in.');
    closeAdminRegister();
  } catch (err) {
    alert(err.message || 'Registration failed.');
  }
}

function openAdminForgot() {
  adminForgotModal.classList.remove('hidden');
}

function closeAdminForgot() {
  adminForgotModal.classList.add('hidden');
  adminForgotForm.reset();
}

async function handleAdminForgot(event) {
  event.preventDefault();
  const formData = new FormData(adminForgotForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    await api('/api/password-reset', {
      method: 'POST',
      body: JSON.stringify({ role: 'admin', username: payload.username, newPassword: payload.newPassword })
    });
    alert('Password updated.');
    closeAdminForgot();
  } catch (err) {
    alert(err.message || 'Reset failed.');
  }
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (adminApp.classList.contains('hidden')) return;
    loadSummary();
    loadNotifications();
    loadMessages();
    const active = document.querySelector('.tab-btn.active');
    if (active && active.dataset.view === 'dashboard-view') {
      loadAttendanceToday();
    }
    if (active && active.dataset.view === 'attendance-view') {
      const range = getMonthRange();
      const from = (attendanceFromInput && attendanceFromInput.value) || range.from;
      const to = (attendanceToInput && attendanceToInput.value) || range.to;
      if (attendanceFromInput && !attendanceFromInput.value) attendanceFromInput.value = from;
      if (attendanceToInput && !attendanceToInput.value) attendanceToInput.value = to;
      loadAttendanceHistory(from, to).catch(() => {});
    }
    if (active && active.dataset.view === 'reports-view') {
      const range = getMonthRange();
      const from = (reportsFrom && reportsFrom.value) || range.from;
      const to = (reportsTo && reportsTo.value) || range.to;
      if (reportsFrom && !reportsFrom.value) reportsFrom.value = from;
      if (reportsTo && !reportsTo.value) reportsTo.value = to;
      if (isEditingReportAttestedInput()) return;
      loadReportsTable(from, to).catch(() => {});
    }
  }, 10000);
}

function handleReportsInputDraft(event) {
  const input = event.target.closest('input.report-attested-input[data-report-key]');
  if (!input) return;
  const key = String(input.dataset.reportKey || '').trim();
  if (!key) return;
  const draft = reportAttestedDrafts.get(key) || {};
  if (input.hasAttribute('data-attested-by')) {
    draft.attestedBy = input.value;
  } else if (input.hasAttribute('data-attested-position')) {
    draft.attestedPosition = input.value;
  }
  reportAttestedDrafts.set(key, draft);
}

loginForm.addEventListener('submit', async (event) => { 
  event.preventDefault(); 
  const formData = new FormData(loginForm); 
  const payload = Object.fromEntries(formData.entries()); 
  try { 
    const username = String(payload.username || '').trim(); 
    const password = String(payload.password || '').trim(); 
    const result = await api('/api/login', { 
      method: 'POST', 
      body: JSON.stringify({ role: 'admin', username, password }) 
    }); 
    currentAdmin = result && result.user ? result.user : null;
    officeScope = normalizeOfficeScope(currentAdmin && currentAdmin.office);
    const reportOfficeSelect = document.getElementById('report-office');
    if (reportOfficeSelect && officeScope) {
      reportOfficeSelect.value = officeScope;
      reportOfficeSelect.disabled = true;
    }
    if (reportsOfficeFilter && officeScope) {
      reportsOfficeFilter.value = officeScope;
      reportsOfficeFilter.disabled = true;
    }
    const addOfficeSelect = addEmployeeForm ? addEmployeeForm.querySelector('select[name=\"office\"]') : null;
    if (addOfficeSelect && officeScope) {
      addOfficeSelect.value = officeScope;
      addOfficeSelect.disabled = true;
    }
    loginScreen.classList.add('hidden'); 
    adminApp.classList.remove('hidden'); 
    const monthRange = getMonthRange();
    if (attendanceFromInput) attendanceFromInput.value = monthRange.from;
    if (attendanceToInput) attendanceToInput.value = monthRange.to;
    if (reportsFrom) reportsFrom.value = monthRange.from;
    if (reportsTo) reportsTo.value = monthRange.to;
    await Promise.all([
      loadSummary(),
      loadAttendanceToday(),
      loadEmployees(),
      loadNotifications(),
      loadMessages(),
      loadAttendanceHistory(monthRange.from, monthRange.to),
      loadReportsTable(monthRange.from, monthRange.to)
    ]);
    const statRange = getMonthRange();
    loadStatBase(statRange.from, statRange.to, false).catch(() => {});
    tickClock();
    startAutoRefresh();
  } catch (err) {
    if (err.name === 'TypeError') {
      alert('Cannot reach the server. Make sure the server is running and try again.');
      return;
    }
    alert(err.message || 'Login failed.');
  }
});

setInterval(tickClock, 1000);

toggleButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = btn.parentElement.querySelector('input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
});

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    setView(btn.dataset.view);
    if (btn.dataset.view === 'attendance-view') {
      const today = new Date();
      const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const to = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      if (attendanceFromInput) attendanceFromInput.value = from;
      if (attendanceToInput) attendanceToInput.value = to;
      loadAttendanceHistory(from, to);
    }
    if (btn.dataset.view === 'reports-view') {
      const today = new Date();
      const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const to = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      if (reportsFrom) reportsFrom.value = from;
      if (reportsTo) reportsTo.value = to;
      loadReportsTable(from, to);
      if (dtrMonth && !dtrMonth.value) {
        dtrMonth.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      }
      populateDtrEmployees();
    }
  });
});

document.getElementById('open-add-employee').addEventListener('click', openAddEmployee);
document.getElementById('close-add-employee').addEventListener('click', closeAddEmployee);
document.getElementById('cancel-add-employee').addEventListener('click', closeAddEmployee);
addEmployeeForm.addEventListener('submit', handleAddEmployee);

employeeSearch.addEventListener('input', (event) => {
  const term = event.target.value.toLowerCase();
  const filtered = employeesCache.filter((emp) =>
    emp.name.toLowerCase().includes(term) ||
    emp.id.toLowerCase().includes(term) ||
    emp.office.toLowerCase().includes(term)
  );
  renderEmployees(filtered);
});

document.getElementById('refresh-attendance').addEventListener('click', () => {
  loadSummary();
  loadAttendanceToday();
});

document.getElementById('refresh-employees').addEventListener('click', loadEmployees);
employeesTable.addEventListener('click', handleEmployeesActionClick);

attendanceTable.addEventListener('click', handleReportPrintClick);
attendanceHistory.addEventListener('click', handleReportPrintClick);
reportsTable.addEventListener('click', handleReportPrintClick);
reportsTable.addEventListener('input', handleReportsInputDraft);

document.getElementById('filter-attendance').addEventListener('click', () => {
  const from = document.getElementById('attendance-from').value;
  const to = document.getElementById('attendance-to').value;
  loadAttendanceHistory(from, to);
});

document.getElementById('generate-report').addEventListener('click', generateReport);
document.getElementById('download-report').addEventListener('click', downloadReport);

if (filterReportsBtn) {
  filterReportsBtn.addEventListener('click', () => {
    const from = reportsFrom.value;
    const to = reportsTo.value;
    loadReportsTable(from, to);
  });
}

if (reportsOfficeFilter) {
  reportsOfficeFilter.addEventListener('change', () => {
    const from = (reportsFrom && reportsFrom.value) || '';
    const to = (reportsTo && reportsTo.value) || '';
    loadReportsTable(from, to);
  });
}

if (refreshReportsBtn) {
  refreshReportsBtn.addEventListener('click', () => {
    const today = new Date();
    const from = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const to = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (reportsFrom) reportsFrom.value = from;
    if (reportsTo) reportsTo.value = to;
    loadReportsTable(from, to);
  });
}

if (generateDtrBtn) generateDtrBtn.addEventListener('click', generateDtr);
if (printDtrBtn) printDtrBtn.addEventListener('click', printDtr);

document.getElementById('open-admin-register').addEventListener('click', openAdminRegister);
document.getElementById('close-admin-register').addEventListener('click', closeAdminRegister);
document.getElementById('cancel-admin-register').addEventListener('click', closeAdminRegister);
adminRegisterForm.addEventListener('submit', handleAdminRegister);

document.getElementById('open-admin-forgot').addEventListener('click', openAdminForgot);
document.getElementById('close-admin-forgot').addEventListener('click', closeAdminForgot);
document.getElementById('cancel-admin-forgot').addEventListener('click', closeAdminForgot);
adminForgotForm.addEventListener('submit', handleAdminForgot);

if (notifBtn && notifPanel) {
  notifBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePanel(notifPanel);
    loadNotifications();
  });
  notifPanel.addEventListener('click', (event) => event.stopPropagation());
}

if (msgBtn && msgPanel) {
  msgBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePanel(msgPanel);
    loadMessages();
  });
  msgPanel.addEventListener('click', (event) => event.stopPropagation());
}

if (menuBtn && menuPanel) {
  menuBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    togglePanel(menuPanel);
  });
  menuPanel.addEventListener('click', (event) => event.stopPropagation());
}

if (markNotifReadBtn) {
  markNotifReadBtn.addEventListener('click', async () => {
    try {
      await api('/api/notifications/read', { method: 'POST', body: JSON.stringify({ all: true }) });
      await loadNotifications();
    } catch (err) {
      alert(err.message || 'Unable to mark notifications.');
    }
  });
}

if (markMsgReadBtn) {
  markMsgReadBtn.addEventListener('click', async () => {
    try {
      await api('/api/messages/read', { method: 'POST', body: JSON.stringify({ all: true }) });
      await loadMessages();
    } catch (err) {
      alert(err.message || 'Unable to mark messages.');
    }
  });
}

if (statCards && statCards.length) {
  statCards.forEach((card) => {
    const open = () => openStatModal(card.dataset.stat);
    card.addEventListener('click', open);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
}

if (closeStatModalBtn) closeStatModalBtn.addEventListener('click', closeStatModal);
if (statModal) {
  statModal.addEventListener('click', (event) => {
    if (event.target === statModal) closeStatModal();
  });
}

if (closePhotoPreviewBtn) closePhotoPreviewBtn.addEventListener('click', closePhotoPreview);
if (photoPreviewModal) {
  photoPreviewModal.addEventListener('click', (event) => {
    if (event.target === photoPreviewModal) closePhotoPreview();
  });
}
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closePhotoPreview();
});

if (helpBtn && helpDetails) {
  helpBtn.addEventListener('click', () => {
    helpDetails.classList.toggle('hidden');
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', logoutAdmin);
}

document.addEventListener('click', closePanels);

tickClock();
