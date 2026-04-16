const express = require('express');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const BACKUP_ROOT = path.join(DATA_DIR, 'backups');
const PORT = Number(process.env.PORT || 5173);

const ON_TIME_CUTOFF_AM = String(process.env.ON_TIME_CUTOFF_AM || process.env.ON_TIME_CUTOFF || '08:00:59');
const ON_TIME_CUTOFF_PM = String(process.env.ON_TIME_CUTOFF_PM || '13:00:59');

const OFFICE_CATALOG = [
  'Office of the SDS',
  'Office of the ASDS',
  'Legal Unit',
  'ICT Unit',
  'Administrative Unit',
  'Personnel Section',
  'Supply Section',
  'Cash Section',
  'Records Section',
  'Procurement Section',
  'Curriculum Implementation Division',
  'School Governance and Operations Division',
  'Finance Unit',
  'Accounting Section',
  'Budget Section'
];

const REGISTERABLE_OFFICES = OFFICE_CATALOG.filter((office) => office !== 'Finance Unit');
const OFFICE_ALIASES = new Map([
  ['office of the sds', 'Office of the SDS'],
  ['office of sds', 'Office of the SDS'],
  ['office of the asds', 'Office of the ASDS'],
  ['office of asds', 'Office of the ASDS'],
  ['legal unit', 'Legal Unit'],
  ['ict', 'ICT Unit'],
  ['ict unit', 'ICT Unit'],
  ['administrative unit', 'Administrative Unit'],
  ['personnel section', 'Personnel Section'],
  ['supply section', 'Supply Section'],
  ['cash section', 'Cash Section'],
  ['records section', 'Records Section'],
  ['procurement section', 'Procurement Section'],
  ['curriculum implementation division', 'Curriculum Implementation Division'],
  ['cid', 'Curriculum Implementation Division'],
  ['school governance and operations division', 'School Governance and Operations Division'],
  ['sgod', 'School Governance and Operations Division'],
  ['finance', 'Finance Unit'],
  ['finance unit', 'Finance Unit'],
  ['accounting', 'Accounting Section'],
  ['accounting section', 'Accounting Section'],
  ['budget', 'Budget Section'],
  ['budget section', 'Budget Section']
]);

const DEFAULT_DB = {
  employees: [],
  attendance: [],
  reports: [],
  concerns: []
};

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeDateInput(value) {
  const raw = normalizeText(value);
  if (!raw) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
}

function normalizeMonthInput(value) {
  const raw = normalizeText(value);
  if (!raw) return '';
  return /^\d{4}-\d{2}$/.test(raw) ? raw : '';
}

function parseTimeToSeconds(value) {
  const raw = normalizeText(value);
  if (!raw) return null;
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || '0');
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
  return hour * 3600 + minute * 60 + second;
}

function normalizeTimeInput(value) {
  const raw = normalizeText(value);
  if (!raw) return '';
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(raw);
  if (!match) return '';
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || '0');
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return '';
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return '';
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
}

function formatWorkedHours(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  return (seconds / 3600).toFixed(2);
}

function getPhilippineNow() {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  const valueMap = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      valueMap[part.type] = part.value;
    }
  }
  const date = `${valueMap.year}-${valueMap.month}-${valueMap.day}`;
  const time = `${valueMap.hour}:${valueMap.minute}:${valueMap.second}`;
  return { date, time, iso: `${date}T${time}+08:00` };
}

function normalizeOffice(value) {
  const raw = normalizeText(value);
  if (!raw) return '';

  const cleaned = raw.replace(/\s+/g, ' ').trim();
  const lowered = cleaned.toLowerCase();
  const aliased = OFFICE_ALIASES.get(lowered);
  if (aliased) return aliased;

  const exactCatalog = OFFICE_CATALOG.find((office) => office.toLowerCase() === lowered);
  if (exactCatalog) return exactCatalog;

  return cleaned
    .split(' ')
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === 'sds' || lower === 'asds' || lower === 'ict') return lower.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(' ');
}

function isRegisterableOffice(office) {
  const normalized = normalizeOffice(office);
  if (!normalized) return false;
  if (normalized === 'Finance Unit') return false;
  return REGISTERABLE_OFFICES.includes(normalized);
}

function validateRegisterOffice(office) {
  const normalized = normalizeOffice(office);
  if (!normalized) {
    return { ok: false, office: '', message: 'Name and office are required.' };
  }
  if (!isRegisterableOffice(normalized)) {
    return {
      ok: false,
      office: normalized,
      message: 'Invalid office selected. For Finance Unit, select Accounting Section or Budget Section.'
    };
  }
  return { ok: true, office: normalized, message: '' };
}

function listAdminOffices() {
  const unique = new Set(OFFICE_CATALOG.map((office) => normalizeOffice(office)));
  return Array.from(unique);
}

function officeMatches(a, b) {
  return normalizeOffice(a).toLowerCase() === normalizeOffice(b).toLowerCase();
}

function toOfficeSlug(value) {
  return normalizeOffice(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeDateRange(fromRaw, toRaw) {
  let from = normalizeDateInput(fromRaw);
  let to = normalizeDateInput(toRaw);
  if (from && to && from > to) {
    const temp = from;
    from = to;
    to = temp;
  }
  return { from, to };
}

function isWithinDateRange(targetDate, from, to) {
  const date = normalizeDateInput(targetDate);
  if (!date) return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function monthFromDate(dateValue) {
  const date = normalizeDateInput(dateValue);
  return date ? date.slice(0, 7) : '';
}

function currentPhilippineMonth() {
  return getPhilippineNow().date.slice(0, 7);
}

function normalizeSession(rawSession, mode, fallbackTime) {
  const raw = normalizeText(rawSession).toUpperCase();
  if (raw === 'AM' || raw === 'PM') return raw;
  const sec = parseTimeToSeconds(fallbackTime);
  if (sec === null) return mode === 'in' ? 'AM' : 'PM';
  return sec < 12 * 3600 ? 'AM' : 'PM';
}

function buildEmptyAttendanceRecord(employeeId, date, stamp) {
  return {
    id: `ATT-${date}-${employeeId}`,
    employeeId,
    date,
    timeInAM: '',
    timeOutAM: '',
    timeInPM: '',
    timeOutPM: '',
    timeIn: '',
    timeOut: '',
    createdAt: stamp,
    updatedAt: stamp
  };
}

function normalizeAttendanceRecord(record) {
  const now = getPhilippineNow().iso;
  const safe = record && typeof record === 'object' ? record : {};
  const employeeId = normalizeText(safe.employeeId);
  const date = normalizeDateInput(safe.date);

  const legacyIn = normalizeTimeInput(safe.timeIn);
  const legacyOut = normalizeTimeInput(safe.timeOut);

  const timeInAM = normalizeTimeInput(safe.timeInAM || legacyIn);
  const timeOutAM = normalizeTimeInput(safe.timeOutAM);
  const timeInPM = normalizeTimeInput(safe.timeInPM);
  const timeOutPM = normalizeTimeInput(safe.timeOutPM || legacyOut);

  return {
    id: normalizeText(safe.id) || (employeeId && date ? `ATT-${date}-${employeeId}` : ''),
    employeeId,
    date,
    timeInAM,
    timeOutAM,
    timeInPM,
    timeOutPM,
    timeIn: timeInAM || '',
    timeOut: timeOutPM || '',
    createdAt: normalizeText(safe.createdAt) || now,
    updatedAt: normalizeText(safe.updatedAt) || normalizeText(safe.createdAt) || now
  };
}

function computeAttendanceMetrics(record) {
  const cutoffAMSec = parseTimeToSeconds(ON_TIME_CUTOFF_AM) ?? parseTimeToSeconds('08:00:59');
  const cutoffPMSec = parseTimeToSeconds(ON_TIME_CUTOFF_PM) ?? parseTimeToSeconds('13:00:59');

  const inAMSec = parseTimeToSeconds(record.timeInAM);
  const outAMSec = parseTimeToSeconds(record.timeOutAM);
  const inPMSec = parseTimeToSeconds(record.timeInPM);
  const outPMSec = parseTimeToSeconds(record.timeOutPM);

  const statusInAM = inAMSec === null ? '--' : inAMSec > cutoffAMSec ? 'Late' : 'Present';
  const statusOutAM = outAMSec === null ? (inAMSec === null ? '--' : 'Pending') : 'Recorded';
  const statusInPM = inPMSec === null ? '--' : inPMSec > cutoffPMSec ? 'Late' : 'Present';
  const statusOutPM = outPMSec === null ? (inPMSec === null ? '--' : 'Pending') : 'Recorded';

  let lateMinutes = 0;
  if (inAMSec !== null && inAMSec > cutoffAMSec) lateMinutes += Math.ceil((inAMSec - cutoffAMSec) / 60);
  if (inPMSec !== null && inPMSec > cutoffPMSec) lateMinutes += Math.ceil((inPMSec - cutoffPMSec) / 60);

  let workedSeconds = 0;
  if (inAMSec !== null && outAMSec !== null && outAMSec >= inAMSec) {
    workedSeconds += outAMSec - inAMSec;
  }
  if (inPMSec !== null && outPMSec !== null && outPMSec >= inPMSec) {
    workedSeconds += outPMSec - inPMSec;
  }

  const hasAnyIn = inAMSec !== null || inPMSec !== null;
  const hasMismatch =
    (inAMSec !== null && outAMSec === null) ||
    (inAMSec === null && outAMSec !== null) ||
    (inPMSec !== null && outPMSec === null) ||
    (inPMSec === null && outPMSec !== null);

  let attendanceStatus = 'Absent';
  if (hasAnyIn) {
    if (hasMismatch) {
      attendanceStatus = lateMinutes > 0 ? 'Late - Incomplete' : 'Incomplete';
    } else {
      attendanceStatus = lateMinutes > 0 ? 'Late' : 'Present';
    }
  }

  return {
    statusInAM,
    statusOutAM,
    statusInPM,
    statusOutPM,
    attendanceStatus,
    lateMinutes,
    workedHours: formatWorkedHours(workedSeconds)
  };
}

function enrichAttendanceRecord(record) {
  const normalized = normalizeAttendanceRecord(record);
  const metrics = computeAttendanceMetrics(normalized);
  return {
    ...normalized,
    ...metrics
  };
}

function normalizeConcernRecord(concern) {
  const now = getPhilippineNow().iso;
  const safe = concern && typeof concern === 'object' ? concern : {};
  return {
    id: normalizeText(safe.id) || `CON-${Date.now()}`,
    employeeId: normalizeText(safe.employeeId),
    message: normalizeText(safe.message),
    createdAt: normalizeText(safe.createdAt) || now
  };
}

function nextConcernId(concerns) {
  let highest = 0;
  for (const concern of concerns) {
    const match = /^CON-(\d+)$/.exec(String(concern.id || ''));
    if (!match) continue;
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) highest = Math.max(highest, parsed);
  }
  return `CON-${String(highest + 1).padStart(6, '0')}`;
}

function ensureDb() {
  ensureDirectory(DATA_DIR);
  ensureDirectory(BACKUP_ROOT);
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DB, null, 2), 'utf8');
    return;
  }
  const db = readDb();
  writeDb(db);
}

function readDb() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const employees = Array.isArray(parsed.employees)
      ? parsed.employees.map((item) => normalizeEmployeeRecord(item)).filter((item) => item.id && item.name)
      : [];
    const reports = Array.isArray(parsed.reports) ? parsed.reports : [];
    const attendance = Array.isArray(parsed.attendance)
      ? parsed.attendance.map((item) => normalizeAttendanceRecord(item)).filter((item) => item.employeeId && item.date)
      : [];
    const concerns = Array.isArray(parsed.concerns) 
      ? parsed.concerns.map((item) => normalizeConcernRecord(item)).filter((item) => item.employeeId && item.message)
      : [];
    return { employees, attendance, reports, concerns };
  } catch (_error) {
    return JSON.parse(JSON.stringify(DEFAULT_DB));
  }
}

function writeDb(db) {
  const safe = {
    employees: Array.isArray(db.employees)
      ? db.employees.map((item) => normalizeEmployeeRecord(item)).filter((item) => item.id && item.name)
      : [],
    attendance: Array.isArray(db.attendance) ? db.attendance.map((item) => normalizeAttendanceRecord(item)) : [],
    reports: Array.isArray(db.reports) ? db.reports : [],
    concerns: Array.isArray(db.concerns) ? db.concerns.map((item) => normalizeConcernRecord(item)) : []
  };
  fs.writeFileSync(DB_PATH, JSON.stringify(safe, null, 2), 'utf8');
}

function padEmployeeNumber(number) {
  return String(number).padStart(4, '0');
}

function nextEmployeeId(employees) {
  let highest = 0;
  for (const employee of employees) {
    const match = /^EMP-(\d+)$/.exec(String(employee.id || ''));
    if (!match) continue;
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) highest = Math.max(highest, parsed);
  }
  return `EMP-${padEmployeeNumber(highest + 1)}`;
}

function nextReportId(reports) {
  let highest = 0;
  for (const report of reports) {
    const match = /^RPT-(\d+)$/.exec(String(report.id || ''));
    if (!match) continue;
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) highest = Math.max(highest, parsed);
  }
  return `RPT-${String(highest + 1).padStart(6, '0')}`;
}

function normalizeEmployeeRecord(employee) {
  const safe = employee && typeof employee === 'object' ? employee : {};
  const id = normalizeText(safe.id);
  const name = normalizeText(safe.name);
  const email = normalizeText(safe.email).toLowerCase();
  const username = normalizeText(safe.username || email || id).toLowerCase();
  const employeeType = normalizeText(safe.employeeType) || 'Regular';
  const position = normalizeText(safe.position) || (employeeType === 'Regular' ? 'Staff' : employeeType);
  const office = normalizeOffice(safe.office);
  return {
    ...safe,
    id,
    name,
    office,
    position,
    employeeType,
    email,
    username,
    password: normalizeText(safe.password),
    status: normalizeText(safe.status) || 'Active',
    createdAt: normalizeText(safe.createdAt) || getPhilippineNow().iso
  };
}

function findEmployeeByLookup(db, lookup) {
  const key = normalizeText(lookup).toLowerCase();
  if (!key) return null;
  const employees = Array.isArray(db.employees) ? db.employees : [];
  const matchBy = (pick) =>
    employees.find((emp) => normalizeText(pick(emp)).toLowerCase() === key) || null;
  return (
    matchBy((emp) => emp.id) ||
    matchBy((emp) => emp.email) ||
    matchBy((emp) => emp.username) ||
    matchBy((emp) => emp.name)
  );
}

function sanitizeEmployeeForClient(employee) {
  if (!employee) return null;
  const { password, ...safe } = employee;
  return safe;
}

function buildEmployeeView(db, employee, options = {}) {
  const { from, to } = normalizeDateRange(options.from, options.to);
  const month = normalizeMonthInput(options.month);

  const attendance = db.attendance
    .filter((record) => {
      if (record.employeeId !== employee.id) return false;
      if (month && monthFromDate(record.date) !== month) return false;
      return isWithinDateRange(record.date, from, to);
    })
    .map((record) => enrichAttendanceRecord(record))
    .sort((a, b) => b.date.localeCompare(a.date));

  const reports = db.reports
    .filter((report) => {
      if (report.employeeId !== employee.id) return false;
      if (month && monthFromDate(report.date) !== month) return false;
      return isWithinDateRange(report.date, from, to);
    })
    .sort((a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')));

  const concerns = db.concerns
    .filter((concern) => concern.employeeId === employee.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    ...sanitizeEmployeeForClient(employee),
    office: normalizeOffice(employee.office),
    attendance,
    reports,
    concerns,
    totals: {
      attendance: attendance.length,
      reports: reports.length,
      concerns: concerns.length
    }
  };
}

function getOfficeEmployees(db, office) {
  const normalizedOffice = normalizeOffice(office);
  return db.employees
    .filter((employee) => officeMatches(employee.office, normalizedOffice))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function buildOfficeMonthDataset(db, officeInput, monthInput) {
  const office = normalizeOffice(officeInput);
  const month = normalizeMonthInput(monthInput) || currentPhilippineMonth();
  const employees = getOfficeEmployees(db, office);

  const attendance = [];
  const reports = [];

  for (const employee of employees) {
    const employeeAttendance = db.attendance
      .filter((record) => record.employeeId === employee.id && monthFromDate(record.date) === month)
      .map((record) => enrichAttendanceRecord(record))
      .sort((a, b) => a.date.localeCompare(b.date));

    const employeeReports = db.reports
      .filter((report) => report.employeeId === employee.id && monthFromDate(report.date) === month)
      .sort((a, b) => a.date.localeCompare(b.date));

    for (const item of employeeAttendance) {
      attendance.push({
        office: normalizeOffice(employee.office),
        month,
        employeeId: employee.id,
        employeeName: employee.name,
        position: employee.position || '',
        date: item.date,
        timeInAM: item.timeInAM || '',
        statusInAM: item.statusInAM || '--',
        timeOutAM: item.timeOutAM || '',
        statusOutAM: item.statusOutAM || '--',
        timeInPM: item.timeInPM || '',
        statusInPM: item.statusInPM || '--',
        timeOutPM: item.timeOutPM || '',
        statusOutPM: item.statusOutPM || '--',
        attendanceStatus: item.attendanceStatus || '',
        lateMinutes: item.lateMinutes || 0,
        workedHours: item.workedHours || ''
      });
    }

    for (const report of employeeReports) {
      reports.push({
        office: normalizeOffice(employee.office),
        month,
        employeeId: employee.id,
        employeeName: employee.name,
        position: employee.position || '',
        date: report.date || '',
        summary: report.summary || '',
        details: report.details || ''
      });
    }
  }

  attendance.sort((a, b) => {
    if (a.date === b.date) return String(a.employeeName || '').localeCompare(String(b.employeeName || ''));
    return a.date.localeCompare(b.date);
  });
  reports.sort((a, b) => {
    if (a.date === b.date) return String(a.employeeName || '').localeCompare(String(b.employeeName || ''));
    return a.date.localeCompare(b.date);
  });

  return {
    office,
    month,
    employees,
    attendance,
    reports,
    totals: {
      employees: employees.length,
      attendance: attendance.length,
      reports: reports.length
    }
  };
}

function csvEscape(value) {
  const stringValue = String(value ?? '');
  if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildMonthlyCsv(dataset) {
  const lines = [];
  lines.push(`Office,${csvEscape(dataset.office)}`);
  lines.push(`Month,${csvEscape(dataset.month)}`);
  lines.push(`Employees,${dataset.totals.employees}`);
  lines.push(`Attendance Records,${dataset.totals.attendance}`);
  lines.push(`Reports,${dataset.totals.reports}`);
  lines.push('');
  lines.push('Attendance');
  lines.push('Office,Month,Employee ID,Employee Name,Position,Date,Time In (AM),Status In (AM),Time Out (A
