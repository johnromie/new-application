const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const url = require('url');
let Pool = null;
try {
  ({ Pool } = require('pg'));
} catch (err) {
  // Optional dependency when running in JSON mode.
}
try {
  require('dotenv').config();
} catch (err) {
  // dotenv is optional; ignore if not installed
}

const DEFAULT_ROOT = path.join(__dirname, '..');
const ROOT = fs.existsSync(path.join(DEFAULT_ROOT, 'admin')) ? DEFAULT_ROOT : process.cwd();
const EMPLOYEE_INDEX_PATH = path.join(ROOT, 'employee', 'index.html');
const EMPLOYEE_APP_PATH = path.join(ROOT, 'employee', 'app.js');
const MARINDUQUE_BARANGAY_DATA_PATH = path.join(ROOT, 'data', 'marinduque-barangays.json');
const MARINDUQUE_BARANGAY_BOUNDARY_DATA_PATH = path.join(ROOT, 'data', 'marinduque-barangay-boundaries.json');

function computeEmployeeBuildStamp() {
  const candidates = [EMPLOYEE_INDEX_PATH, EMPLOYEE_APP_PATH];
  let latestMtime = 0;
  candidates.forEach((filePath) => {
    try {
      const stat = fs.statSync(filePath);
      if (stat && Number.isFinite(stat.mtimeMs)) {
        latestMtime = Math.max(latestMtime, Math.floor(stat.mtimeMs));
      }
    } catch (err) {
      // ignore missing file stat errors
    }
  });
  if (!latestMtime) return String(Date.now());
  return String(latestMtime);
}

const EMPLOYEE_CACHE_BUSTER = String(process.env.EMPLOYEE_CACHE_BUSTER || '').trim() || computeEmployeeBuildStamp();

function resolveDataPath(rawPath, fallbackPath = '') {
  const value = String(rawPath || '').trim();
  if (value) {
    return path.isAbsolute(value) ? path.normalize(value) : path.normalize(path.join(ROOT, value));
  }
  if (!fallbackPath) return '';
  return path.normalize(fallbackPath);
}

const CWD_NORMALIZED = String(process.cwd()).replace(/\\/g, '/').toLowerCase();
const IS_HOSTINGER_LIKE_RUNTIME = CWD_NORMALIZED.includes('/domains/') && CWD_NORMALIZED.includes('/nodejs');

function normalizeHostingerPersistentEnvPath(rawPath) {
  const value = String(rawPath || '').trim();
  if (!value || !IS_HOSTINGER_LIKE_RUNTIME) return value;
  const unixLike = value.replace(/\\/g, '/');
  if (/^\.?\/?persistent-data(\/|$)/i.test(unixLike)) {
    return unixLike.startsWith('../') ? unixLike : `../${unixLike.replace(/^\.?\//, '')}`;
  }
  return value;
}

function isPathInside(parentPath, childPath) {
  if (!parentPath || !childPath) return false;
  const parent = path.resolve(parentPath);
  const child = path.resolve(childPath);
  const rel = path.relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

const ENV_DB_PATH = normalizeHostingerPersistentEnvPath(process.env.DB_PATH || process.env.RENDER_DB_PATH || '');
const HOSTINGER_DB_PATH_FALLBACK = IS_HOSTINGER_LIKE_RUNTIME ? path.join(ROOT, '..', 'persistent-data', 'db.json') : '';
const DEFAULT_JSON_DB_PATH = HOSTINGER_DB_PATH_FALLBACK || path.join(ROOT, 'data', 'db.json');
const DATA_PATH = resolveDataPath(ENV_DB_PATH, DEFAULT_JSON_DB_PATH);
const BACKUP_PATH = `${DATA_PATH}.bak`;
const DATA_DIR = path.dirname(DATA_PATH);
const LEGACY_DATA_PATH = path.normalize(path.join(ROOT, 'data', 'db.json'));
const LEGACY_BACKUP_PATH = `${LEGACY_DATA_PATH}.bak`;
const USE_LEGACY_DB_FALLBACK = LEGACY_DATA_PATH !== path.normalize(DATA_PATH);
const ENV_DB_MIRROR_PATH = normalizeHostingerPersistentEnvPath(
  process.env.DB_MIRROR_PATH || process.env.PERSISTENT_DB_PATH || ''
);
const HOSTINGER_DB_MIRROR_FALLBACK = IS_HOSTINGER_LIKE_RUNTIME ? path.join(ROOT, '..', 'persistent-data', 'db-mirror.json') : '';
const HOME_DB_MIRROR_FALLBACK =
  !HOSTINGER_DB_MIRROR_FALLBACK && String(process.env.NODE_ENV || '').toLowerCase() === 'production'
    ? path.join(os.homedir(), '.sdo-attendance', 'db.json')
    : '';
const DB_MIRROR_PATH = resolveDataPath(ENV_DB_MIRROR_PATH, HOSTINGER_DB_MIRROR_FALLBACK || HOME_DB_MIRROR_FALLBACK);
const DB_MIRROR_BACKUP_PATH = DB_MIRROR_PATH ? `${DB_MIRROR_PATH}.bak` : '';
const DB_MIRROR_DIR = DB_MIRROR_PATH ? path.dirname(DB_MIRROR_PATH) : '';
const DB_BACKUP_MIN_INTERVAL_MS = Math.max(0, Number(process.env.DB_BACKUP_MIN_INTERVAL_MS || 60000));
const IS_PRODUCTION = String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';
const DATA_PATH_INSIDE_DEPLOY_ROOT = isPathInside(ROOT, DATA_PATH);
const DB_MIRROR_PATH_INSIDE_DEPLOY_ROOT = DB_MIRROR_PATH ? isPathInside(ROOT, DB_MIRROR_PATH) : false;
const REQUEST_TIMEOUT_MS = Math.max(5000, Number(process.env.REQUEST_TIMEOUT_MS || 25000));
const MAX_INFLIGHT_REQUESTS = Math.max(20, Number(process.env.MAX_INFLIGHT_REQUESTS || 200));
const EXTERNAL_FETCH_TIMEOUT_MS = Math.max(1200, Number(process.env.EXTERNAL_FETCH_TIMEOUT_MS || 4500));

const REVERSE_GEOCODE_CACHE_TTL_MS = Math.max(0, Number(process.env.REVERSE_GEOCODE_CACHE_TTL_MS || 5 * 60 * 1000));
const REVERSE_GEOCODE_CACHE_LIMIT = Math.max(50, Number(process.env.REVERSE_GEOCODE_CACHE_LIMIT || 2000));
const LOCAL_BARANGAY_STRONG_DISTANCE_METERS = Math.max(
  120,
  Number(process.env.LOCAL_BARANGAY_STRONG_DISTANCE_METERS || 900)
);
const LOCAL_BARANGAY_MAX_DISTANCE_METERS = Math.max(
  LOCAL_BARANGAY_STRONG_DISTANCE_METERS,
  Number(process.env.LOCAL_BARANGAY_MAX_DISTANCE_METERS || 1800)
);
const LOCAL_BARANGAY_OVERRIDE_DISTANCE_METERS = Math.max(
  80,
  Math.min(
    LOCAL_BARANGAY_MAX_DISTANCE_METERS,
    Number(process.env.LOCAL_BARANGAY_OVERRIDE_DISTANCE_METERS || 650)
  )
);
const MARINDUQUE_BOUNDARY_SNAP_DISTANCE_METERS = Math.max(
  12,
  Number(process.env.MARINDUQUE_BOUNDARY_SNAP_DISTANCE_METERS || 45)
);
const MARINDUQUE_BOUNDARY_SEARCH_PADDING_METERS = Math.max(
  MARINDUQUE_BOUNDARY_SNAP_DISTANCE_METERS + 8,
  Number(process.env.MARINDUQUE_BOUNDARY_SEARCH_PADDING_METERS || 70)
);
const MARINDUQUE_BOUNDARY_AMBIGUOUS_EDGE_METERS = Math.max(
  6,
  Number(process.env.MARINDUQUE_BOUNDARY_AMBIGUOUS_EDGE_METERS || 90)
);
const LOCAL_BARANGAY_EDGE_OVERRIDE_DISTANCE_METERS = Math.max(
  40,
  Number(process.env.LOCAL_BARANGAY_EDGE_OVERRIDE_DISTANCE_METERS || 500)
);

const DEFAULT_DB = {
  admins: [
    {
      id: 'ADM-001',
      name: 'SDO Admin',
      username: 'admin',
      password: 'admin123',
      office: 'ICT Unit'
    }
  ],
  employees: [],
  attendance: [],
  notifications: [],
  concerns: [],
  reports: []
};

const DB_MODE = String(process.env.DB_MODE || '').trim().toLowerCase();
const HAS_DATABASE_URL = !!process.env.DATABASE_URL;
const WANTS_PG = DB_MODE === 'postgres' || (!DB_MODE && HAS_DATABASE_URL);
let pgInitError = '';
let pool = null;
let USE_PG = false;

if (!!Pool && WANTS_PG) {
  try {
    pool = new Pool(
      process.env.DATABASE_URL
        ? { connectionString: process.env.DATABASE_URL }
        : {
            host: process.env.PGHOST || 'localhost',
            port: Number(process.env.PGPORT || 5432),
            user: process.env.PGUSER || 'sdo_user',
            password: process.env.PGPASSWORD || 'sdo_pass',
            database: process.env.PGDATABASE || 'sdo_attendance'
          }
    );
    USE_PG = true;
  } catch (err) {
    pgInitError = err && err.message ? String(err.message) : 'Failed to initialize PostgreSQL pool';
    USE_PG = false;
    pool = null;
    console.error('PostgreSQL init failed, falling back to JSON mode:', pgInitError);
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function parseJsonSafe(raw) {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, error: err };
  }
}

async function pgQuery(text, params) {
  if (!pool) throw new Error('PostgreSQL not configured.');
  return pool.query(text, params);
}

async function forcePgFallback(reason) {
  const message = reason && reason.message ? String(reason.message) : String(reason || 'Unknown PostgreSQL error');
  pgInitError = message;
  USE_PG = false;
  if (pool) {
    try {
      await pool.end();
    } catch (_) {
      // Ignore pool shutdown errors during fallback.
    }
  }
  pool = null;
  console.error('PostgreSQL unavailable, falling back to JSON mode:', message);
}

async function ensureSchema() {
  if (!USE_PG) return;
  await pgQuery(
    `CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      office TEXT NOT NULL
    );`
  );
  await pgQuery(
    `CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position TEXT,
      office TEXT,
      email TEXT,
      username TEXT,
      employee_type TEXT,
      password TEXT,
      status TEXT,
      avatar TEXT,
      verified BOOLEAN DEFAULT false,
      otp TEXT,
      otp_expires_at BIGINT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`
  );
  await pgQuery(`CREATE INDEX IF NOT EXISTS idx_employees_email ON employees (LOWER(email));`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS idx_employees_username ON employees (LOWER(username));`);
  await pgQuery(
    `CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      time_in TEXT,
      time_out TEXT,
      time_in_am TEXT,
      time_out_am TEXT,
      time_in_pm TEXT,
      time_out_pm TEXT,
      photo_in_am TEXT,
      photo_out_am TEXT,
      photo_in_pm TEXT,
      photo_out_pm TEXT,
      location_in_am TEXT,
      location_out_am TEXT,
      location_in_pm TEXT,
      location_out_pm TEXT,
      lat_in_am TEXT,
      lng_in_am TEXT,
      lat_out_am TEXT,
      lng_out_am TEXT,
      lat_in_pm TEXT,
      lng_in_pm TEXT,
      lat_out_pm TEXT,
      lng_out_pm TEXT,
      status TEXT,
      latitude TEXT,
      longitude TEXT,
      location TEXT,
      photo TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (employee_id, date)
    );`
  );
  await pgQuery(
    `CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT,
      title TEXT,
      message TEXT,
      employee_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      read BOOLEAN DEFAULT false
    );`
  );
  await pgQuery(
    `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      employee_id TEXT,
      employee_name TEXT,
      office TEXT,
      subject TEXT,
      message TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      read BOOLEAN DEFAULT false
    );`
  );
  await pgQuery(
    `CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
      employee_name TEXT,
      office TEXT,
      report_date DATE NOT NULL,
      summary TEXT,
      attachment_name TEXT,
      attachment_data TEXT,
      attested_by TEXT,
      attested_position TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );`
  );
  await pgQuery('ALTER TABLE reports ADD COLUMN IF NOT EXISTS attested_by TEXT;');
  await pgQuery('ALTER TABLE reports ADD COLUMN IF NOT EXISTS attested_position TEXT;');
  await pgQuery(`CREATE INDEX IF NOT EXISTS idx_reports_employee ON reports (employee_id);`);
  await pgQuery(`CREATE INDEX IF NOT EXISTS idx_reports_date ON reports (report_date);`);
  const adminCheck = await pgQuery('SELECT COUNT(*) AS count FROM admins');
  if (Number(adminCheck.rows[0].count) === 0) {
    const admin = DEFAULT_DB.admins[0];
    await pgQuery(
      'INSERT INTO admins (id, name, username, password, office) VALUES ($1, $2, $3, $4, $5)',
      [admin.id, admin.name, admin.username, admin.password, admin.office]
    );
  }
}

function formatDbDate(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function mapEmployeeRow(row) {
  return {
    id: row.id,
    name: row.name,
    position: row.position || '',
    office: row.office || '',
    email: row.email || '',
    username: row.username || '',
    employeeType: row.employee_type || 'Regular',
    password: row.password || '',
    status: row.status || '',
    avatar: row.avatar || '',
    verified: row.verified === true,
    otp: row.otp || '',
    otpExpiresAt: row.otp_expires_at ? Number(row.otp_expires_at) : 0
  };
}

function mapAdminRow(row) {
  return {
    id: row.id,
    name: row.name,
    username: row.username,
    password: row.password,
    office: row.office
  };
}

function mapAttendanceRow(row) {
  const record = {
    id: row.id,
    employeeId: row.employee_id,
    date: formatDbDate(row.date),
    timeIn: row.time_in || '',
    timeOut: row.time_out || '',
    timeInAM: row.time_in_am || '',
    timeOutAM: row.time_out_am || '',
    timeInPM: row.time_in_pm || '',
    timeOutPM: row.time_out_pm || '',
    photoInAM: row.photo_in_am || '',
    photoOutAM: row.photo_out_am || '',
    photoInPM: row.photo_in_pm || '',
    photoOutPM: row.photo_out_pm || '',
    locationInAM: row.location_in_am || '',
    locationOutAM: row.location_out_am || '',
    locationInPM: row.location_in_pm || '',
    locationOutPM: row.location_out_pm || '',
    latInAM: row.lat_in_am || '',
    lngInAM: row.lng_in_am || '',
    latOutAM: row.lat_out_am || '',
    lngOutAM: row.lng_out_am || '',
    latInPM: row.lat_in_pm || '',
    lngInPM: row.lng_in_pm || '',
    latOutPM: row.lat_out_pm || '',
    lngOutPM: row.lng_out_pm || '',
    status: row.status || '',
    latitude: row.latitude || '',
    longitude: row.longitude || '',
    location: row.location || '',
    photo: row.photo || '',
    employeeName: row.employee_name || undefined,
    office: row.office || undefined,
    position: row.position || undefined
  };
  return normalizeAttendanceRecord(record);
}

function mapReportRow(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name || '',
    office: row.office || '',
    reportDate: formatDbDate(row.report_date),
    summary: row.summary || '',
    attachmentName: row.attachment_name || '',
    attachmentData: row.attachment_data || '',
    attestedBy: row.attested_by || '',
    attestedPosition: row.attested_position || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : ''
  };
}

let memoryDb = null;
let lastDbWriteError = '';
let lastDbWriteWarning = '';
let lastDbWriteAttemptAt = 0;
let lastDbWriteOkAt = 0;
let lastDbLoadSource = '';
const dbBackupLastAt = new Map();

const reverseGeocodeCache = new Map();
const reverseGeocodeInflight = new Map();

function normalizeDb(db) {
  const safe = db && typeof db === 'object' ? db : {};
  if (!Array.isArray(safe.admins)) safe.admins = [];
  if (!Array.isArray(safe.employees)) safe.employees = [];
  if (!Array.isArray(safe.attendance)) safe.attendance = [];
  if (!Array.isArray(safe.notifications)) safe.notifications = [];
  if (!Array.isArray(safe.concerns)) safe.concerns = [];
  if (!Array.isArray(safe.reports)) safe.reports = [];
  if (!safe.admins.length) {
    safe.admins = JSON.parse(JSON.stringify(DEFAULT_DB.admins));
  }
  migrateEmpIdsToSdo(safe);
  return safe;
}

function normalizeEmployeeIdToSdo(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const match = /^EMP[-_]?(\d+)$/i.exec(raw.replace(/\s+/g, ''));
  if (!match) return '';
  const digits = String(match[1] || '').replace(/\D+/g, '');
  if (!digits) return '';
  const width = Math.max(4, digits.length);
  return `SDO-${digits.padStart(width, '0')}`;
}

function migrateEmpIdsToSdo(db) {
  // Idempotent migration: converts EMP-0001 style ids to SDO-0001 and updates references.
  const mapping = new Map();
  const existingIds = new Set((db.employees || []).map((e) => String(e && e.id ? e.id : '').trim()).filter(Boolean));

  for (const emp of db.employees || []) {
    if (!emp || !emp.id) continue;
    const oldId = String(emp.id).trim();
    const newId = normalizeEmployeeIdToSdo(oldId);
    if (!newId || newId === oldId) continue;
    if (existingIds.has(newId)) {
      // Avoid collisions; skip migration for this record.
      continue;
    }
    mapping.set(oldId, newId);
    existingIds.delete(oldId);
    existingIds.add(newId);
    emp.id = newId;
  }

  if (!mapping.size) return;

  const rewriteId = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return raw;
    return mapping.get(raw) || raw;
  };

  const rewriteText = (value) => {
    let text = String(value || '');
    if (!text) return text;
    for (const [oldId, newId] of mapping.entries()) {
      text = text.split(oldId).join(newId);
    }
    return text;
  };

  for (const item of db.attendance || []) {
    if (!item) continue;
    if (item.employeeId) item.employeeId = rewriteId(item.employeeId);
    if (item.id) item.id = rewriteText(item.id);
  }
  for (const item of db.notifications || []) {
    if (!item) continue;
    if (item.employeeId) item.employeeId = rewriteId(item.employeeId);
  }
  for (const item of db.messages || []) {
    if (!item) continue;
    if (item.employeeId) item.employeeId = rewriteId(item.employeeId);
  }
  for (const item of db.concerns || []) {
    if (!item) continue;
    if (item.employeeId) item.employeeId = rewriteId(item.employeeId);
  }
  for (const item of db.reports || []) {
    if (!item) continue;
    if (item.employeeId) item.employeeId = rewriteId(item.employeeId);
    if (item.id) item.id = rewriteText(item.id);
  }
}

function getDbScore(db) {
  const safe = normalizeDb(db);
  return (
    (safe.admins || []).length +
    (safe.employees || []).length * 10 +
    (safe.attendance || []).length * 8 +
    (safe.notifications || []).length * 3 +
    (safe.concerns || []).length * 3 +
    (safe.reports || []).length * 5
  );
}

function readDbCandidate(filePath, source) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = parseJsonSafe(raw);
    if (!parsed.ok) return null;
    const stat = fs.statSync(filePath);
    const db = normalizeDb(parsed.value);
    return {
      db,
      source,
      filePath,
      mtimeMs: Number(stat.mtimeMs || 0),
      score: getDbScore(db)
    };
  } catch (err) {
    return null;
  }
}

function ensureDirExists(dirPath) {
  if (!dirPath) return;
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function shouldWriteBackup(backupPath) {
  if (!backupPath) return false;
  if (!fs.existsSync(backupPath)) {
    dbBackupLastAt.set(backupPath, Date.now());
    return true;
  }
  const lastAt = Number(dbBackupLastAt.get(backupPath) || 0);
  const now = Date.now();
  if (now - lastAt >= DB_BACKUP_MIN_INTERVAL_MS) {
    dbBackupLastAt.set(backupPath, now);
    return true;
  }
  return false;
}

function writeFileAtomicSync(filePath, content) {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, content, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function writeDbFileWithBackup(filePath, backupPath, serializedDb) {
  const dirPath = path.dirname(filePath);
  ensureDirExists(dirPath);
  writeFileAtomicSync(filePath, serializedDb);
  if (shouldWriteBackup(backupPath)) {
    try {
      fs.copyFileSync(filePath, backupPath);
    } catch (err) {
      // Ignore backup copy failures; main write still proceeds.
    }
  }
}

function readDb() {
  if (memoryDb) return memoryDb;

  try {
    ensureDirExists(DATA_DIR);
    ensureDirExists(DB_MIRROR_DIR);
  } catch (err) {
    // ignore directory errors
  }

  const candidates = [
    readDbCandidate(DATA_PATH, 'data'),
    readDbCandidate(BACKUP_PATH, 'data-backup'),
    ...(USE_LEGACY_DB_FALLBACK
      ? [
          readDbCandidate(LEGACY_DATA_PATH, 'legacy-data'),
          readDbCandidate(LEGACY_BACKUP_PATH, 'legacy-data-backup')
        ]
      : []),
    readDbCandidate(DB_MIRROR_PATH, 'mirror'),
    readDbCandidate(DB_MIRROR_BACKUP_PATH, 'mirror-backup')
  ].filter(Boolean);

  if (candidates.length) {
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.mtimeMs - a.mtimeMs;
    });
    const selected = candidates[0];
    memoryDb = normalizeDb(selected.db);
    lastDbLoadSource = `${selected.source}:${selected.filePath}`;
    // Keep main and mirror files synchronized after choosing best candidate.
    writeDb(memoryDb);
    return memoryDb;
  }

  memoryDb = normalizeDb(JSON.parse(JSON.stringify(DEFAULT_DB)));
  lastDbLoadSource = 'default-template';
  writeDb(memoryDb);
  return memoryDb;
}

function writeDb(db) {
  memoryDb = normalizeDb(db);
  lastDbWriteAttemptAt = Date.now();
  lastDbWriteWarning = '';

  const targets = [
    { name: 'primary', filePath: DATA_PATH, backupPath: BACKUP_PATH }
  ];
  if (DB_MIRROR_PATH && path.normalize(DB_MIRROR_PATH) !== path.normalize(DATA_PATH)) {
    targets.push({ name: 'mirror', filePath: DB_MIRROR_PATH, backupPath: DB_MIRROR_BACKUP_PATH });
  }

  const warnings = [];
  let writesOk = 0;
  try {
    const serialized = JSON.stringify(memoryDb);
    for (const target of targets) {
      try {
        writeDbFileWithBackup(target.filePath, target.backupPath, serialized);
        writesOk += 1;
      } catch (err) {
        const message = err && err.message ? err.message : 'Unknown write error';
        warnings.push(`${target.name}(${target.filePath}): ${message}`);
      }
    }
    if (writesOk > 0) {
      lastDbWriteError = '';
      lastDbWriteWarning = warnings.join(' | ');
      lastDbWriteOkAt = Date.now();
      return;
    }
    lastDbWriteError = warnings.join(' | ') || 'Unknown DB write error';
  } catch (err) {
    lastDbWriteError = err && err.message ? err.message : 'Unknown DB write error';
  }
}

function persistJsonDbOrFail(res, db) {
  writeDb(db);
  if (lastDbWriteError) {
    sendJson(res, 500, {
      ok: false,
      message: 'Database write failed. Check DB_PATH and directory permissions.',
      error: lastDbWriteError,
      dataPath: DATA_PATH
    });
    return false;
  }
  return true;
}

function getJsonDbDiagnostics(db) {
  let dataDirWritable = false;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.accessSync(DATA_DIR, fs.constants.W_OK);
    dataDirWritable = true;
  } catch (err) {
    dataDirWritable = false;
  }
  return {
    envDbPath: ENV_DB_PATH || '',
    envDbMirrorPath: ENV_DB_MIRROR_PATH || '',
    dataPath: DATA_PATH,
    dataDir: DATA_DIR,
    legacyDataPath: USE_LEGACY_DB_FALLBACK ? LEGACY_DATA_PATH : '',
    dbMirrorPath: DB_MIRROR_PATH || '',
    dbMirrorDir: DB_MIRROR_DIR || '',
    dbMirrorEnabled: !!DB_MIRROR_PATH,
    dataPathInsideDeployRoot: DATA_PATH_INSIDE_DEPLOY_ROOT,
    dbMirrorPathInsideDeployRoot: DB_MIRROR_PATH_INSIDE_DEPLOY_ROOT,
    persistenceRisk:
      IS_HOSTINGER_LIKE_RUNTIME && (DATA_PATH_INSIDE_DEPLOY_ROOT || DB_MIRROR_PATH_INSIDE_DEPLOY_ROOT)
        ? 'DB path points inside deploy directory. Use ../persistent-data/*.json to survive redeploy.'
        : '',
    dataDirWritable,
    dataFileExists: fs.existsSync(DATA_PATH),
    dbMirrorFileExists: DB_MIRROR_PATH ? fs.existsSync(DB_MIRROR_PATH) : false,
    cwd: process.cwd(),
    root: ROOT,
    hostingerLikeRuntime: IS_HOSTINGER_LIKE_RUNTIME,
    dbLoadSource: lastDbLoadSource,
    lastDbWriteError,
    lastDbWriteWarning,
    lastDbWriteAttemptAt,
    lastDbWriteOkAt,
    counts: {
      admins: (db.admins || []).length,
      employees: (db.employees || []).length,
      attendance: (db.attendance || []).length,
      notifications: (db.notifications || []).length,
      concerns: (db.concerns || []).length,
      reports: (db.reports || []).length
    }
  };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

async function fetchWithTimeout(resource, options = {}, timeoutMs = EXTERNAL_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(resource, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  const headers = { 'Content-Type': contentType };
  if (['.html', '.css', '.js', '.json', '.webmanifest'].includes(ext)) {
    headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate';
    headers.Pragma = 'no-cache';
    headers.Expires = '0';
  }
  res.writeHead(200, headers);
  const stream = fs.createReadStream(filePath);
  stream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end('Unable to read file.');
  });
  stream.pipe(res);
}

function collectBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        if (body.includes('=')) {
          const params = new URLSearchParams(body);
          return resolve(Object.fromEntries(params.entries()));
        }
        resolve({});
      }
    });
  });
}

function isoToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getPhilippineNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(new Date());
  const map = {};
  parts.forEach((p) => {
    if (p.type !== 'literal') map[p.type] = p.value;
  });
  const date = `${map.year}-${map.month}-${map.day}`;
  const time = `${map.hour}:${map.minute}`;
  return { date, time };
}

function timeToMinutes(time) {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

const AM_IN_START = 6 * 60;
const AM_IN_END = 11 * 60 + 59;
const AM_OUT_START = 12 * 60;
const AM_OUT_END = 12 * 60 + 59;
const PM_IN_START = 13 * 60;
const PM_IN_END = 16 * 60 + 59;
const PM_OUT_START = 17 * 60;
const BIOMETRIC_SESSION_SPLIT = 13 * 60; // 1:00 PM
const AM_LATE_CUTOFF_MINUTES = Number(process.env.AM_LATE_CUTOFF_MINUTES || 8 * 60); // 8:00 AM
const PM_LATE_CUTOFF_MINUTES = Number(process.env.PM_LATE_CUTOFF_MINUTES || (13 * 60 + 15)); // 1:15 PM

function classifyTimeIn(time) {
  const minutes = timeToMinutes(time);
  if (minutes === null) {
    return { ok: false, message: 'Invalid time.' };
  }
  return { ok: true, session: minutes >= BIOMETRIC_SESSION_SPLIT ? 'PM' : 'AM' };
}

function classifyTimeOut(time) {
  const minutes = timeToMinutes(time);
  if (minutes === null) {
    return { ok: false, message: 'Invalid time.' };
  }
  return { ok: true, session: minutes >= BIOMETRIC_SESSION_SPLIT ? 'PM' : 'AM' };
}

function normalizeAttendanceSlot(value) {
  const slot = String(value || '').trim().toUpperCase();
  if (slot === 'AM' || slot === 'PM') return slot;
  return '';
}

function hasAnyAttendance(record) {
  return Boolean(
    record &&
    (
      record.timeInAM ||
      record.timeOutAM ||
      record.timeInPM ||
      record.timeOutPM ||
      record.timeIn ||
      record.timeOut
    )
  );
}

function computeStatus(timeIn) {
  if (!timeIn) return 'Absent';
  const minutes = timeToMinutes(timeIn);
  return minutes !== null && minutes <= AM_LATE_CUTOFF_MINUTES ? 'Present' : 'Late';
}

function computeDailyStatus(record) {
  if (!hasAnyAttendance(record)) return 'Absent';
  const amIn = record.timeInAM || record.timeIn || '';
  const pmIn = record.timeInPM || '';
  let late = false;
  if (amIn && timeToMinutes(amIn) > AM_LATE_CUTOFF_MINUTES) late = true;
  if (pmIn && timeToMinutes(pmIn) > PM_LATE_CUTOFF_MINUTES) late = true;
  return late ? 'Late' : 'Present';
}

function normalizeAttendanceRecord(record) {
  if (!record) return record;
  const normalized = { ...record };
  const hasAmIn = !!normalized.timeInAM;
  const hasPmIn = !!normalized.timeInPM;
  if (normalized.timeIn && !hasAmIn && !hasPmIn) {
    const minutes = timeToMinutes(normalized.timeIn);
    if (minutes !== null && minutes >= PM_IN_START) {
      normalized.timeInPM = normalized.timeIn;
    } else {
      normalized.timeInAM = normalized.timeIn;
    }
  }

  const hasAmOut = !!normalized.timeOutAM;
  const hasPmOut = !!normalized.timeOutPM;
  if (normalized.timeOut && !hasAmOut && !hasPmOut) {
    const minutes = timeToMinutes(normalized.timeOut);
    if (minutes !== null && minutes >= PM_OUT_START) {
      normalized.timeOutPM = normalized.timeOut;
    } else if (minutes !== null && minutes >= AM_OUT_START && minutes <= AM_OUT_END) {
      normalized.timeOutAM = normalized.timeOut;
    } else if (minutes !== null && minutes < PM_OUT_START) {
      normalized.timeOutAM = normalized.timeOut;
    }
  }

  const amInMinutes = timeToMinutes(normalized.timeInAM);
  if (amInMinutes !== null && amInMinutes >= PM_IN_START) {
    normalized.timeInPM = normalized.timeInAM;
    normalized.timeInAM = '';
  }

  const pmInMinutes = timeToMinutes(normalized.timeInPM);
  if (pmInMinutes !== null && pmInMinutes < PM_IN_START && !normalized.timeInAM) {
    normalized.timeInAM = normalized.timeInPM;
    normalized.timeInPM = '';
  }

  const amOutMinutes = timeToMinutes(normalized.timeOutAM);
  if (amOutMinutes !== null && amOutMinutes >= PM_IN_START) {
    normalized.timeOutPM = normalized.timeOutAM;
    normalized.timeOutAM = '';
  }

  return normalized;
}

function findEmployeeByLogin(db, value) {
  const lookup = String(value || '').trim().toLowerCase();
  if (!lookup) return null;
  const altLookup =
    lookup.startsWith('sdo-') ? lookup.replace(/^sdo-/, 'emp-') : lookup.startsWith('emp-') ? lookup.replace(/^emp-/, 'sdo-') : '';
  return (
    db.employees.find((e) =>
      (e.username && e.username.toLowerCase() === lookup) ||
      (e.email && e.email.toLowerCase() === lookup) ||
      (e.id && e.id.toLowerCase() === lookup) ||
      (e.name && e.name.toLowerCase() === lookup)
    ) ||
    (altLookup
      ? db.employees.find((e) => (e.id && e.id.toLowerCase() === altLookup) || (e.username && e.username.toLowerCase() === altLookup))
      : null)
  );
}

function pickLatestValue(...values) {
  return values.find((val) => val && String(val).trim().length > 0) || '';
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeLookup(value) {
  return String(value || '').trim().toLowerCase();
}

function parseBooleanEnv(value, fallback = false) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return !!fallback;
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function isEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function resolveOtpLookup(body) {
  return normalizeLookup(body.identifier || body.email || body.username || body.id || '');
}

function resolveOtpTargetEmail(employee) {
  if (!employee) return '';
  const candidateEmail = String(employee.email || '').trim().toLowerCase();
  if (isEmailAddress(candidateEmail)) return candidateEmail;
  const candidateUsername = String(employee.username || '').trim().toLowerCase();
  if (isEmailAddress(candidateUsername)) return candidateUsername;
  return '';
}

function isDepedEmail(email) {
  return /@deped\.gov\.ph$/i.test(email);
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getBrevoConfig() {
  const apiKey = process.env.BREVO_API_KEY || '';
  const fromEmail = process.env.BREVO_FROM || '';
  const fromName = process.env.BREVO_FROM_NAME || 'SDO Marinduque Attendance';
  if (!apiKey || !fromEmail) return null;
  return { apiKey, fromEmail, fromName };
}

const OTP_EMAIL_REQUIRED = parseBooleanEnv(process.env.OTP_EMAIL_REQUIRED, IS_PRODUCTION);
const ALLOW_DEV_OTP_FALLBACK = parseBooleanEnv(process.env.ALLOW_DEV_OTP_FALLBACK, !OTP_EMAIL_REQUIRED);

function getGoogleMapsKey() {
  return process.env.GOOGLE_MAPS_KEY || process.env.GMAPS_KEY || '';
}

function toRadians(value) {
  return (Number(value) * Math.PI) / 180;
}

function distanceMeters(a, b) {
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const R = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aVal = s1 * s1 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(aVal));
}

function metersToLatitudeDegrees(meters) {
  const value = Number(meters);
  if (!Number.isFinite(value)) return 0;
  return value / 111320;
}

function metersToLongitudeDegrees(meters, latitude) {
  const value = Number(meters);
  const lat = Number(latitude);
  if (!Number.isFinite(value) || !Number.isFinite(lat)) return 0;
  const scale = Math.cos(toRadians(lat)) * 111320;
  if (!Number.isFinite(scale) || Math.abs(scale) < 1e-6) return 0;
  return value / scale;
}

function estimateDistanceToBBoxMeters(lat, lng, bbox) {
  if (!bbox || !Number.isFinite(lat) || !Number.isFinite(lng)) return Number.POSITIVE_INFINITY;

  const clampedLat = Math.max(bbox.minLat, Math.min(bbox.maxLat, lat));
  const clampedLng = Math.max(bbox.minLng, Math.min(bbox.maxLng, lng));
  return distanceMeters({ lat, lng }, { lat: clampedLat, lng: clampedLng });
}

function distanceToSegmentMeters(pointLat, pointLng, aLat, aLng, bLat, bLng) {
  const refLat = (Number(pointLat) + Number(aLat) + Number(bLat)) / 3;
  const latScale = 111320;
  const lngScale = Math.max(1e-6, Math.cos(toRadians(refLat)) * 111320);

  const px = Number(pointLng) * lngScale;
  const py = Number(pointLat) * latScale;
  const ax = Number(aLng) * lngScale;
  const ay = Number(aLat) * latScale;
  const bx = Number(bLng) * lngScale;
  const by = Number(bLat) * latScale;
  if (![px, py, ax, ay, bx, by].every(Number.isFinite)) return Number.POSITIVE_INFINITY;

  const dx = bx - ax;
  const dy = by - ay;
  const denom = dx * dx + dy * dy;
  let t = 0;
  if (denom > 0) {
    t = ((px - ax) * dx + (py - ay) * dy) / denom;
    t = Math.max(0, Math.min(1, t));
  }
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  const distX = px - closestX;
  const distY = py - closestY;
  return Math.sqrt(distX * distX + distY * distY);
}

function getGoogleTypeScore(types) {
  if (!Array.isArray(types)) return 0;
  const scoreMap = {
    street_address: 9,
    premise: 8,
    subpremise: 7,
    route: 6,
    intersection: 5,
    plus_code: 4,
    neighborhood: 3,
    sublocality_level_1: 3,
    sublocality: 2,
    locality: 1.5,
    administrative_area_level_3: 1,
    administrative_area_level_2: 0.5
  };
  return types.reduce((sum, type) => sum + (scoreMap[type] || 0), 0);
}

function getGoogleLocationTypeScore(value) {
  const locationType = String(value || '').toUpperCase();
  if (locationType === 'ROOFTOP') return 5;
  if (locationType === 'RANGE_INTERPOLATED') return 3.5;
  if (locationType === 'GEOMETRIC_CENTER') return 2;
  if (locationType === 'APPROXIMATE') return 1;
  return 0;
}

function pickGoogleResult(results, queryLat, queryLng) {
  if (!Array.isArray(results) || results.length === 0) return null;
  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  results.forEach((result, index) => {
    if (!result) return;
    const formatted = formatGoogleAddress(result);
    const resultLat = Number(result?.geometry?.location?.lat);
    const resultLng = Number(result?.geometry?.location?.lng);
    const dist = distanceMeters({ lat: queryLat, lng: queryLng }, { lat: resultLat, lng: resultLng });
    const distanceScore = Number.isFinite(dist) ? Math.max(0, 3000 - dist) / 300 : 0;
    const score =
      formatted.score +
      getGoogleTypeScore(result.types) +
      getGoogleLocationTypeScore(result?.geometry?.location_type) +
      distanceScore -
      index * 0.02;
    if (score > bestScore) {
      best = result;
      bestScore = score;
    }
  });
  if (best) return best;
  const priorities = ['street_address', 'premise', 'subpremise', 'route', 'neighborhood', 'sublocality', 'locality'];
  for (const type of priorities) {
    const found = results.find((result) => Array.isArray(result?.types) && result.types.includes(type));
    if (found) return found;
  }
  return results[0];
}

function pickGoogleComponent(components, types) {
  if (!Array.isArray(components)) return '';
  const match = components.find((comp) => types.every((type) => comp.types && comp.types.includes(type)));
  return match ? match.long_name : '';
}

function formatGoogleAddress(result) {
  if (!result || !Array.isArray(result.address_components)) return { address: '', score: 0 };
  const comps = result.address_components;
  const streetNumber = pickGoogleComponent(comps, ['street_number']);
  const route = pickGoogleComponent(comps, ['route']);
  const roadLine = [streetNumber, route].filter(Boolean).join(' ');
  const place =
    pickGoogleComponent(comps, ['neighborhood']) ||
    pickGoogleComponent(comps, ['sublocality_level_2']) ||
    pickGoogleComponent(comps, ['sublocality_level_1']) ||
    pickGoogleComponent(comps, ['sublocality']) ||
    pickGoogleComponent(comps, ['administrative_area_level_4']) ||
    pickGoogleComponent(comps, ['administrative_area_level_3']) ||
    pickGoogleComponent(comps, ['locality']);
  const municipality =
    pickGoogleComponent(comps, ['locality']) ||
    pickGoogleComponent(comps, ['administrative_area_level_3']) ||
    pickGoogleComponent(comps, ['administrative_area_level_2']);
  const province =
    pickGoogleComponent(comps, ['administrative_area_level_2']) ||
    pickGoogleComponent(comps, ['administrative_area_level_1']);
  const parts = {
    roadLine,
    place,
    municipality,
    province,
    postcode: pickGoogleComponent(comps, ['postal_code']),
    country: pickGoogleComponent(comps, ['country'])
  };
  const address = formatAddressParts(parts);
  return { address, score: scoreAddressParts(parts) };
}

function scoreAddressParts(parts) {
  if (!parts) return 0;
  let score = 0;
  if (parts.roadLine) score += 3;
  if (parts.place) score += 3;
  if (parts.municipality) score += 2;
  if (parts.province) score += 1.5;
  if (parts.postcode) score += 0.5;
  if (parts.country) score += 0.5;
  return score;
}

function formatAddressParts(parts) {
  if (!parts) return '';
  const list = [];
  if (parts.roadLine) list.push(parts.roadLine);
  if (parts.place && !list.includes(parts.place)) list.push(parts.place);
  if (parts.municipality && !list.includes(parts.municipality)) list.push(parts.municipality);
  if (parts.province && !list.includes(parts.province)) list.push(parts.province);
  if (parts.postcode) list.push(parts.postcode);
  if (parts.country) list.push(parts.country);
  return list.join(', ');
}

function formatOsmAddress(osmData) {
  if (!osmData) return { address: '', score: 0 };
  const addr = osmData.address || {};
  const roadLine = [addr.house_number, addr.road].filter(Boolean).join(' ');
  const place =
    addr.barangay ||
    addr.neighbourhood ||
    addr.suburb ||
    addr.village ||
    addr.hamlet ||
    addr.quarter ||
    addr.city_district ||
    addr.subdistrict ||
    addr.municipality ||
    addr.town ||
    addr.city;
  const municipality = addr.city || addr.town || addr.municipality || addr.county;
  const province = addr.state || addr.region || addr.province;
  const parts = {
    roadLine,
    place,
    municipality,
    province,
    postcode: addr.postcode || '',
    country: addr.country || ''
  };
  const address = formatAddressParts(parts) || osmData.display_name || '';
  return { address, score: scoreAddressParts(parts) };
}

function formatPhotonFeature(feature) {
  if (!feature || !feature.properties) return { address: '', score: 0 };
  const props = feature.properties;
  const roadLine = [props.housenumber, props.street].filter(Boolean).join(' ');
  const place =
    props.neighbourhood ||
    props.suburb ||
    props.district ||
    props.locality ||
    props.name ||
    props.city;
  const municipality = props.city || props.county;
  const province = props.state || props.region;
  const parts = {
    roadLine,
    place,
    municipality,
    province,
    postcode: props.postcode || '',
    country: props.country || ''
  };
  const address = formatAddressParts(parts);
  return { address, score: scoreAddressParts(parts) };
}

function formatBigDataCloud(data) {
  if (!data) return { address: '', score: 0 };
  const admin = Array.isArray(data.localityInfo && data.localityInfo.administrative)
    ? data.localityInfo.administrative
    : [];
  const filteredAdmin = admin.filter((entry) => entry && entry.name && !/philippines/i.test(entry.name));
  filteredAdmin.sort((a, b) => {
    const aLevel = Number(a.adminLevel || a.adminLevelCode || 0);
    const bLevel = Number(b.adminLevel || b.adminLevelCode || 0);
    return bLevel - aLevel;
  });
  const mostSpecific = filteredAdmin[0] ? filteredAdmin[0].name : '';
  const roadLine = [data.streetNumber, data.street].filter(Boolean).join(' ');
  const place = data.locality || data.city || mostSpecific || '';
  const municipality = data.city || data.locality || data.principalSubdivision || '';
  const province = data.principalSubdivision || '';
  const parts = {
    roadLine,
    place,
    municipality,
    province,
    postcode: data.postcode || '',
    country: data.countryName || data.countryCode || ''
  };
  const address = formatAddressParts(parts);
  return { address, score: scoreAddressParts(parts) };
}

function getDistanceCalibrationScore(distance) {
  if (!Number.isFinite(distance)) return 0;
  if (distance <= 8) return 4;
  if (distance <= 15) return 3.5;
  if (distance <= 30) return 3;
  if (distance <= 60) return 2;
  if (distance <= 120) return 1;
  if (distance <= 250) return 0.2;
  if (distance <= 500) return -1.5;
  return -3;
}

function normalizeAddressKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeBarangayName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\bbrgy\.?\b/g, '')
    .replace(/\bbarangay\b/g, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadMarinduqueBarangayDataset() {
  if (!fs.existsSync(MARINDUQUE_BARANGAY_DATA_PATH)) return [];
  try {
    const raw = fs.readFileSync(MARINDUQUE_BARANGAY_DATA_PATH, 'utf8');
    const parsed = parseJsonSafe(raw);
    if (!parsed.ok) return [];
    const rows = Array.isArray(parsed.value?.barangays) ? parsed.value.barangays : [];
    return rows
      .map((item) => {
        const barangay = String(item?.barangay || '').trim();
        const municipality = String(item?.municipality || '').trim();
        const province = String(item?.province || 'Marinduque').trim() || 'Marinduque';
        const source = String(item?.source || '').trim().toLowerCase();
        const lat = Number(item?.lat);
        const lng = Number(item?.lng);
        if (!barangay || !municipality || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          barangay,
          municipality,
          province,
          source,
          lat,
          lng,
          key: `${normalizeAddressKey(municipality)}|${normalizeBarangayName(barangay)}`,
          isHighQuality: source !== 'municipality-centroid' && source !== 'unresolved'
        };
      })
      .filter(Boolean);
  } catch (err) {
    return [];
  }
}

const MARINDUQUE_BARANGAY_DATA = loadMarinduqueBarangayDataset();

function parseBoundaryBBox(value) {
  if (!value || typeof value !== 'object') return null;
  const minLat = Number(value.minLat);
  const minLng = Number(value.minLng);
  const maxLat = Number(value.maxLat);
  const maxLng = Number(value.maxLng);
  if (!Number.isFinite(minLat) || !Number.isFinite(minLng) || !Number.isFinite(maxLat) || !Number.isFinite(maxLng)) {
    return null;
  }
  if (maxLat < minLat || maxLng < minLng) return null;
  return { minLat, minLng, maxLat, maxLng };
}

function parseBoundaryRings(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((ring) => {
      if (!Array.isArray(ring) || ring.length < 4) return null;
      const points = ring
        .map((point) => {
          if (!Array.isArray(point) || point.length < 2) return null;
          const lng = Number(point[0]);
          const lat = Number(point[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return [lng, lat];
        })
        .filter(Boolean);
      return points.length >= 4 ? points : null;
    })
    .filter(Boolean);
}

function loadMarinduqueBarangayBoundaryDataset() {
  if (!fs.existsSync(MARINDUQUE_BARANGAY_BOUNDARY_DATA_PATH)) return [];
  try {
    const raw = fs.readFileSync(MARINDUQUE_BARANGAY_BOUNDARY_DATA_PATH, 'utf8');
    const parsed = parseJsonSafe(raw);
    if (!parsed.ok) return [];
    const rows = Array.isArray(parsed.value?.boundaries) ? parsed.value.boundaries : [];
    return rows
      .map((item) => {
        const barangay = String(item?.barangay || '').trim();
        const municipality = String(item?.municipality || '').trim();
        const province = String(item?.province || 'Marinduque').trim() || 'Marinduque';
        const geocode = String(item?.geocode || '').trim();
        const bbox = parseBoundaryBBox(item?.bbox);
        const rings = parseBoundaryRings(item?.rings);
        if (!barangay || !municipality || !bbox || !rings.length) return null;
        const bboxArea = Math.max(0, (bbox.maxLat - bbox.minLat) * (bbox.maxLng - bbox.minLng));
        return {
          barangay,
          municipality,
          province,
          geocode,
          bbox,
          bboxArea,
          rings
        };
      })
      .filter(Boolean);
  } catch (err) {
    return [];
  }
}

const MARINDUQUE_BARANGAY_BOUNDARY_DATA = loadMarinduqueBarangayBoundaryDataset();

function isPointInsideBBox(lat, lng, bbox) {
  if (!bbox) return false;
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= bbox.minLat &&
    lat <= bbox.maxLat &&
    lng >= bbox.minLng &&
    lng <= bbox.maxLng
  );
}

function isPointOnSegment(pointLng, pointLat, aLng, aLat, bLng, bLat, epsilon = 1e-10) {
  const cross = (pointLat - aLat) * (bLng - aLng) - (pointLng - aLng) * (bLat - aLat);
  if (Math.abs(cross) > epsilon) return false;
  const dot = (pointLng - aLng) * (bLng - aLng) + (pointLat - aLat) * (bLat - aLat);
  if (dot < -epsilon) return false;
  const squaredLen = (bLng - aLng) * (bLng - aLng) + (bLat - aLat) * (bLat - aLat);
  if (dot - squaredLen > epsilon) return false;
  return true;
}

function isPointInRing(lat, lng, ring) {
  if (!Array.isArray(ring) || ring.length < 4) return false;
  const pointLat = Number(lat);
  const pointLng = Number(lng);
  if (!Number.isFinite(pointLat) || !Number.isFinite(pointLng)) return false;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [aLng, aLat] = ring[i];
    const [bLng, bLat] = ring[j];
    if (!Number.isFinite(aLat) || !Number.isFinite(aLng) || !Number.isFinite(bLat) || !Number.isFinite(bLng)) continue;

    if (isPointOnSegment(pointLng, pointLat, aLng, aLat, bLng, bLat)) return true;

    const intersects =
      aLat > pointLat !== bLat > pointLat &&
      pointLng < ((bLng - aLng) * (pointLat - aLat)) / (bLat - aLat + Number.EPSILON) + aLng;
    if (intersects) inside = !inside;
  }
  return inside;
}

function isPointInRingsEvenOdd(lat, lng, rings) {
  if (!Array.isArray(rings) || !rings.length) return false;
  let inside = false;
  rings.forEach((ring) => {
    if (isPointInRing(lat, lng, ring)) inside = !inside;
  });
  return inside;
}

function findContainingMarinduqueBarangayBoundary(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!Array.isArray(MARINDUQUE_BARANGAY_BOUNDARY_DATA) || !MARINDUQUE_BARANGAY_BOUNDARY_DATA.length) return null;

  let best = null;
  MARINDUQUE_BARANGAY_BOUNDARY_DATA.forEach((boundary) => {
    if (!isPointInsideBBox(lat, lng, boundary.bbox)) return;
    if (!isPointInRingsEvenOdd(lat, lng, boundary.rings)) return;
    if (
      !best ||
      boundary.bboxArea < best.bboxArea ||
      (boundary.bboxArea === best.bboxArea &&
        boundary.barangay.localeCompare(best.barangay) < 0)
    ) {
      best = boundary;
    }
  });

  return best;
}

function expandBoundaryBBoxByMeters(bbox, meters) {
  if (!bbox) return null;
  const padLat = metersToLatitudeDegrees(meters);
  const midLat = (Number(bbox.minLat) + Number(bbox.maxLat)) / 2;
  const padLng = metersToLongitudeDegrees(meters, midLat);
  return {
    minLat: bbox.minLat - padLat,
    minLng: bbox.minLng - padLng,
    maxLat: bbox.maxLat + padLat,
    maxLng: bbox.maxLng + padLng
  };
}

function distancePointToBoundaryMeters(lat, lng, boundary) {
  if (!boundary || !Array.isArray(boundary.rings) || !boundary.rings.length) return Number.POSITIVE_INFINITY;
  let minDistance = Number.POSITIVE_INFINITY;
  boundary.rings.forEach((ring) => {
    if (!Array.isArray(ring) || ring.length < 2) return;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const a = ring[i];
      const b = ring[j];
      if (!Array.isArray(a) || !Array.isArray(b)) continue;
      const segDistance = distanceToSegmentMeters(lat, lng, Number(a[1]), Number(a[0]), Number(b[1]), Number(b[0]));
      if (Number.isFinite(segDistance) && segDistance < minDistance) {
        minDistance = segDistance;
      }
    }
  });
  return minDistance;
}

function findNearestMarinduqueBarangayBoundary(lat, lng, maxDistanceMeters = Number.POSITIVE_INFINITY) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!Array.isArray(MARINDUQUE_BARANGAY_BOUNDARY_DATA) || !MARINDUQUE_BARANGAY_BOUNDARY_DATA.length) return null;

  const maxDistance = Number.isFinite(maxDistanceMeters) ? Math.max(0, maxDistanceMeters) : Number.POSITIVE_INFINITY;
  let best = null;

  MARINDUQUE_BARANGAY_BOUNDARY_DATA.forEach((boundary) => {
    const paddedBBox = expandBoundaryBBoxByMeters(boundary.bbox, MARINDUQUE_BOUNDARY_SEARCH_PADDING_METERS);
    if (!isPointInsideBBox(lat, lng, paddedBBox)) return;

    const bboxDistance = estimateDistanceToBBoxMeters(lat, lng, boundary.bbox);
    if (Number.isFinite(maxDistance) && bboxDistance > maxDistance + MARINDUQUE_BOUNDARY_SEARCH_PADDING_METERS) return;

    const boundaryDistance = distancePointToBoundaryMeters(lat, lng, boundary);
    if (!Number.isFinite(boundaryDistance)) return;
    if (Number.isFinite(maxDistance) && boundaryDistance > maxDistance) return;

    if (
      !best ||
      boundaryDistance < best.distanceMeters ||
      (boundaryDistance === best.distanceMeters &&
        (boundary.bboxArea < best.boundary.bboxArea ||
          (boundary.bboxArea === best.boundary.bboxArea &&
            boundary.barangay.localeCompare(best.boundary.barangay) < 0)))
    ) {
      best = { boundary, distanceMeters: boundaryDistance };
    }
  });

  return best;
}

function resolveMarinduqueBarangayBoundaryContext(lat, lng) {
  const insideBoundary = findContainingMarinduqueBarangayBoundary(lat, lng);
  if (insideBoundary) {
    const edgeDistance = distancePointToBoundaryMeters(lat, lng, insideBoundary);
    return {
      boundary: insideBoundary,
      matchType: 'inside',
      edgeDistanceMeters: Number.isFinite(edgeDistance) ? edgeDistance : 0,
      edgeDistanceSummaryMeters: Number.isFinite(edgeDistance) ? edgeDistance : 0
    };
  }

  const nearest = findNearestMarinduqueBarangayBoundary(lat, lng, MARINDUQUE_BOUNDARY_SNAP_DISTANCE_METERS);
  if (!nearest) return null;
  return {
    boundary: nearest.boundary,
    matchType: 'snap',
    edgeDistanceMeters: nearest.distanceMeters,
    edgeDistanceSummaryMeters: nearest.distanceMeters
  };
}

function normalizeMunicipalityName(value) {
  return normalizeAddressKey(value)
    .replace(/\bsta\.?\b/g, 'santa')
    .replace(/\s+/g, ' ')
    .trim();
}

const KNOWN_MARINDUQUE_MUNICIPALITY_KEYS = new Set(
  ['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos', 'Sta Cruz'].map((item) =>
    normalizeMunicipalityName(item)
  )
);

function isKnownMarinduqueMunicipality(value) {
  const key = normalizeMunicipalityName(value);
  return !!key && KNOWN_MARINDUQUE_MUNICIPALITY_KEYS.has(key);
}

const MARINDUQUE_BARANGAY_LOOKUP = (() => {
  const map = new Map();
  MARINDUQUE_BARANGAY_DATA.forEach((entry) => {
    const municipalityKey = normalizeMunicipalityName(entry.municipality);
    const barangayKey = normalizeBarangayName(entry.barangay);
    if (!municipalityKey || !barangayKey) return;
    if (!map.has(municipalityKey)) map.set(municipalityKey, new Set());
    map.get(municipalityKey).add(barangayKey);
  });
  return map;
})();

const MARINDUQUE_BARANGAY_NAME_INDEX = (() => {
  const map = new Map();
  MARINDUQUE_BARANGAY_DATA.forEach((entry) => {
    const key = normalizeBarangayName(entry.barangay);
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(entry);
  });
  return map;
})();

const MARINDUQUE_BARANGAY_KEY_SET = (() => {
  const set = new Set();
  MARINDUQUE_BARANGAY_DATA.forEach((entry) => {
    const key = normalizeBarangayName(entry.barangay);
    if (key) set.add(key);
  });
  return set;
})();

function inferMunicipalityFromBarangayName(barangayName, queryLat, queryLng) {
  const key = normalizeBarangayName(barangayName);
  if (!key) return '';
  const candidates = MARINDUQUE_BARANGAY_NAME_INDEX.get(key);
  if (!Array.isArray(candidates) || !candidates.length) return '';
  if (candidates.length === 1) return String(candidates[0].municipality || '').trim();

  let best = null;
  candidates.forEach((entry) => {
    const distance = distanceMeters({ lat: queryLat, lng: queryLng }, { lat: entry.lat, lng: entry.lng });
    if (!Number.isFinite(distance)) return;
    if (!best || distance < best.distanceMeters) {
      best = { municipality: entry.municipality, distanceMeters: distance };
    }
  });
  return best ? String(best.municipality || '').trim() : '';
}

function addressContainsKnownMarinduqueBarangay(address) {
  const text = normalizeAddressKey(address);
  if (!text) return false;
  for (const barangayKey of MARINDUQUE_BARANGAY_KEY_SET) {
    if (barangayKey && text.includes(barangayKey)) return true;
  }
  return false;
}

function chooseBoundaryBarangayName(candidates, municipality) {
  const list = Array.isArray(candidates)
    ? [...new Set(candidates.map((item) => String(item || '').trim()).filter(Boolean))]
    : [];
  if (!list.length) return '';

  const municipalityKey = normalizeMunicipalityName(municipality);
  const knownBarangays = MARINDUQUE_BARANGAY_LOOKUP.get(municipalityKey);
  if (!knownBarangays || !knownBarangays.size) return list[0];

  let picked = list[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  list.forEach((name, index) => {
    const normalized = normalizeBarangayName(name);
    let score = -index * 0.01;

    if (knownBarangays.has(normalized)) {
      score += 8;
    } else {
      for (const known of knownBarangays) {
        if (!known) continue;
        if (known.includes(normalized) || normalized.includes(known)) {
          score += 3;
          break;
        }
      }
    }

    if (/\bpob\b|\bpoblacion\b/.test(normalized)) score += 0.15;
    if (score > bestScore) {
      bestScore = score;
      picked = name;
    }
  });

  return picked;
}

function getBarangaySourceBoost(source) {
  const kind = String(source || '').toLowerCase();
  // Keep source quality as a light tie-breaker only.
  // Distance must stay the dominant factor for nearby barangays.
  if (kind === 'manual-override') return 0.7;
  if (kind === 'osm-place') return 0.6;
  if (kind === 'nominatim-search') return 0.4;
  if (kind === 'municipality-centroid') return -7;
  return 0;
}

function getBarangayDistanceScore(distance) {
  if (!Number.isFinite(distance)) return -100;
  if (distance <= 15) return 12;
  if (distance <= 30) return 11;
  if (distance <= 50) return 10;
  if (distance <= 80) return 9;
  if (distance <= 120) return 8;
  if (distance <= 200) return 7;
  if (distance <= 300) return 6;
  if (distance <= 450) return 5;
  if (distance <= 700) return 4;
  if (distance <= 1000) return 3;
  if (distance <= 1500) return 2;
  if (distance <= 2200) return 1;
  if (distance <= 3000) return -0.5;
  if (distance <= 5000) return -2;
  return -4;
}

function createBarangayAddress(entry) {
  return `${entry.barangay}, ${entry.municipality}, ${entry.province || 'Marinduque'}, Philippines`;
}

function findNearestMarinduqueBarangayCandidate(lat, lng, boundaryContext = null) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!Array.isArray(MARINDUQUE_BARANGAY_DATA) || !MARINDUQUE_BARANGAY_DATA.length) return null;

  const queryPoint = { lat, lng };
  const boundaryMunicipalityKey = normalizeAddressKey(boundaryContext?.municipality || '');
  let best = null;

  MARINDUQUE_BARANGAY_DATA.forEach((entry) => {
    if (!entry.isHighQuality) return;
    const distance = distanceMeters(queryPoint, { lat: entry.lat, lng: entry.lng });
    if (!Number.isFinite(distance)) return;

    let score = getBarangayDistanceScore(distance) + getBarangaySourceBoost(entry.source);
    if (boundaryMunicipalityKey) {
      const sameMunicipality = normalizeAddressKey(entry.municipality) === boundaryMunicipalityKey;
      score += sameMunicipality ? 0.9 : -0.35;
    }

    if (
      !best ||
      score > best.score ||
      (score === best.score &&
        (distance < best.distanceMeters ||
          (distance === best.distanceMeters && entry.barangay.localeCompare(best.barangay) < 0)))
    ) {
      best = {
        ...entry,
        distanceMeters: distance,
        score
      };
    }
  });

  if (!best) return null;
  if (!Number.isFinite(best.distanceMeters) || best.distanceMeters > 5000) return null;

  const candidate = createAddressCandidate({
    source: 'marinduque-barangay-db',
    address: createBarangayAddress(best),
    baseScore: best.score + 1.5,
    providerBoost: 1.2,
    queryLat: lat,
    queryLng: lng,
    resultLat: best.lat,
    resultLng: best.lng
  });
  if (!candidate) return null;
  candidate.barangay = best.barangay;
  candidate.municipality = best.municipality;
  candidate.province = best.province || 'Marinduque';
  return candidate;
}

function createAddressCandidate({
  source,
  address,
  baseScore = 0,
  providerBoost = 0,
  queryLat,
  queryLng,
  resultLat,
  resultLng
}) {
  const cleanAddress = String(address || '').trim();
  if (!cleanAddress) return null;
  const distance = distanceMeters(
    { lat: queryLat, lng: queryLng },
    { lat: Number(resultLat), lng: Number(resultLng) }
  );
  return {
    source: String(source || 'unknown'),
    address: cleanAddress,
    distanceMeters: Number.isFinite(distance) ? distance : null,
    score: Number(baseScore || 0) + Number(providerBoost || 0) + getDistanceCalibrationScore(distance)
  };
}

function pickBestAddressCandidate(candidates) {
  if (!Array.isArray(candidates) || !candidates.length) return null;
  const deduped = new Map();
  candidates.forEach((candidate) => {
    if (!candidate || !candidate.address) return;
    const key = normalizeAddressKey(candidate.address);
    if (!key) return;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, candidate);
      return;
    }
    const existingDistance = Number.isFinite(existing.distanceMeters) ? existing.distanceMeters : Number.POSITIVE_INFINITY;
    const candidateDistance = Number.isFinite(candidate.distanceMeters) ? candidate.distanceMeters : Number.POSITIVE_INFINITY;
    if (candidate.score > existing.score || (candidate.score === existing.score && candidateDistance < existingDistance)) {
      deduped.set(key, candidate);
    }
  });
  const list = [...deduped.values()];
  list.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aDistance = Number.isFinite(a.distanceMeters) ? a.distanceMeters : Number.POSITIVE_INFINITY;
    const bDistance = Number.isFinite(b.distanceMeters) ? b.distanceMeters : Number.POSITIVE_INFINITY;
    return aDistance - bDistance;
  });
  return list[0] || null;
}

function parseOverpassBoundaryContext(elements) {
  if (!Array.isArray(elements) || !elements.length) return null;
  const byLevel = new Map();
  elements.forEach((element) => {
    const tags = element && element.tags ? element.tags : null;
    const name = String(tags && tags.name ? tags.name : '').trim();
    const adminLevelRaw = String(tags && tags.admin_level ? tags.admin_level : '').trim();
    const adminLevel = Number(adminLevelRaw);
    if (!name || !Number.isFinite(adminLevel)) return;
    if (!byLevel.has(adminLevel)) byLevel.set(adminLevel, []);
    const bucket = byLevel.get(adminLevel);
    if (!bucket.includes(name)) bucket.push(name);
  });

  const first = (level) => {
    const list = byLevel.get(level);
    return Array.isArray(list) && list.length ? list[0] : '';
  };

  const barangayCandidates = [
    ...(byLevel.get(10) || []),
    ...(byLevel.get(9) || []),
    ...(byLevel.get(11) || [])
  ];
  const municipalityCandidates = [...(byLevel.get(8) || []), ...(byLevel.get(7) || [])];
  const municipality =
    municipalityCandidates.find((name) => isKnownMarinduqueMunicipality(name)) ||
    municipalityCandidates[0] ||
    '';
  const barangay = chooseBoundaryBarangayName(barangayCandidates, municipality);
  const province = first(6) || first(5) || first(4);
  const country = first(2) || 'Philippines';
  if (!barangay && !municipality && !province) return null;
  return { barangay, municipality, province, country };
}

async function fetchOverpassBoundaryContext(lat, lng) {
  const query = `[out:json][timeout:8];
is_in(${lat},${lng})->.areas;
relation(pivot.areas)["boundary"="administrative"]["name"]["admin_level"];
out tags;`;
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter'
  ];
  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal
      });
      if (!res.ok) continue;
      const data = await res.json();
      const parsed = parseOverpassBoundaryContext(Array.isArray(data && data.elements) ? data.elements : []);
      if (parsed) return parsed;
    } catch (err) {
      // try next endpoint
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

function getBoundaryBoost(address, boundary) {
  if (!address || !boundary) return 0;
  const text = normalizeAddressKey(address);
  let boost = 0;
  const has = (value) => {
    const key = normalizeAddressKey(value);
    return !!key && text.includes(key);
  };
  if (boundary.barangay) boost += has(boundary.barangay) ? 2.8 : -1.4;
  if (boundary.municipality) boost += has(boundary.municipality) ? 0.8 : -0.3;
  if (boundary.province) boost += has(boundary.province) ? 0.6 : 0;
  return boost;
}

function buildBoundaryAddress(boundary, fallbackAddress = '') {
  if (!boundary) return String(fallbackAddress || '').trim();
  const parts = [];
  const add = (value) => {
    const clean = String(value || '').trim();
    if (clean && !parts.includes(clean)) parts.push(clean);
  };
  add(boundary.barangay);
  add(boundary.municipality);
  add(boundary.province);
  add(boundary.country || 'Philippines');
  if (parts.length) return parts.join(', ');
  return String(fallbackAddress || '').trim();
}

function buildBoundaryCalibratedAddress(address, boundary) {
  const raw = String(address || '').trim();
  if (!boundary) return raw;

  const barangay = String(boundary.barangay || '').trim();
  const municipality = String(boundary.municipality || '').trim();
  const province = String(boundary.province || 'Marinduque').trim() || 'Marinduque';
  const country = String(boundary.country || 'Philippines').trim() || 'Philippines';
  if (!barangay && !municipality) return raw;

  const rawParts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const boundaryAddressKeys = new Set(
    [barangay, municipality, province, country]
      .map((part) => normalizeAddressKey(part))
      .filter(Boolean)
  );
  const boundaryBarangayKeys = new Set(
    [barangay, municipality]
      .map((part) => normalizeBarangayName(part))
      .filter(Boolean)
  );

  const looksLikePostal = (value) => /\b\d{4}\b/.test(String(value || ''));
  const streetPart = rawParts.find((part) => {
    const addrKey = normalizeAddressKey(part);
    const brgyKey = normalizeBarangayName(part);
    if (!addrKey) return false;
    if (looksLikePostal(part)) return false;
    if (boundaryAddressKeys.has(addrKey)) return false;
    if (boundaryBarangayKeys.has(brgyKey)) return false;
    if (addrKey === 'philippines') return false;
    return true;
  });

  const finalParts = [];
  const dedupe = new Set();
  const addPart = (value, mode = 'addr') => {
    const clean = String(value || '').trim();
    if (!clean) return;
    const keyBase = mode === 'barangay' ? normalizeBarangayName(clean) : normalizeAddressKey(clean);
    if (!keyBase) return;
    const key = `${mode}:${keyBase}`;
    if (dedupe.has(key)) return;
    dedupe.add(key);
    finalParts.push(clean);
  };

  addPart(streetPart, 'addr');
  addPart(barangay, 'barangay');
  addPart(municipality, 'addr');
  addPart(province, 'addr');
  addPart(country, 'addr');

  return finalParts.length ? finalParts.join(', ') : raw;
}

function roundCoordinate(value, precision = 4) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';
  return numeric.toFixed(precision);
}

function getReverseGeocodeCacheKey(lat, lng, precision = 5) {
  const latKey = roundCoordinate(lat, precision);
  const lngKey = roundCoordinate(lng, precision);
  if (!latKey || !lngKey) return '';
  return `${latKey},${lngKey}`;
}

function pruneReverseGeocodeCache() {
  if (reverseGeocodeCache.size <= REVERSE_GEOCODE_CACHE_LIMIT) return;
  const entries = [...reverseGeocodeCache.entries()];
  entries.sort((a, b) => Number(a[1]?.expiresAt || 0) - Number(b[1]?.expiresAt || 0));
  const overflow = reverseGeocodeCache.size - REVERSE_GEOCODE_CACHE_LIMIT;
  for (let i = 0; i < overflow; i += 1) {
    reverseGeocodeCache.delete(entries[i][0]);
  }
}

function getCachedReverseGeocode(lat, lng) {
  const key = getReverseGeocodeCacheKey(lat, lng, 5);
  if (!key) return null;
  const item = reverseGeocodeCache.get(key);
  if (!item) return null;
  if (Number(item.expiresAt || 0) <= Date.now()) {
    reverseGeocodeCache.delete(key);
    return null;
  }
  return item.payload || null;
}

function setCachedReverseGeocode(lat, lng, payload) {
  const key = getReverseGeocodeCacheKey(lat, lng, 5);
  if (!key || !payload) return;
  reverseGeocodeCache.set(key, {
    payload,
    expiresAt: Date.now() + REVERSE_GEOCODE_CACHE_TTL_MS
  });
  pruneReverseGeocodeCache();
}

async function fetchJsonWithTimeout(resourceUrl, options = {}, timeoutMs = 3500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(resourceUrl, { ...options, signal: controller.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveReverseGeocodeAddress(lat, lng) {
  const candidates = [];
  const localCandidates = [];
  const apiKey = getGoogleMapsKey();
  const maybeAddLocalBarangayCandidate = (candidate) => {
    if (!candidate) return;
    const distance = Number(candidate.distanceMeters);
    if (!Number.isFinite(distance) || distance > LOCAL_BARANGAY_MAX_DISTANCE_METERS) return;
    if (distance <= 150) {
      candidate.score += 3.4;
    } else if (distance <= LOCAL_BARANGAY_STRONG_DISTANCE_METERS) {
      candidate.score += 2.2;
    } else {
      candidate.score += 1.1;
    }
    localCandidates.push(candidate);
    candidates.push(candidate);
  };

  const boundaryResolution = resolveMarinduqueBarangayBoundaryContext(lat, lng);
  const polygonBoundaryContext = boundaryResolution && boundaryResolution.boundary
    ? {
        barangay: boundaryResolution.boundary.barangay || '',
        municipality: boundaryResolution.boundary.municipality || '',
        province: boundaryResolution.boundary.province || 'Marinduque',
        country: 'Philippines'
      }
    : null;
  const boundaryEdgeDistance = Number.isFinite(boundaryResolution?.edgeDistanceSummaryMeters)
    ? boundaryResolution.edgeDistanceSummaryMeters
    : null;
  const isBoundaryEdgeAmbiguous =
    Number.isFinite(boundaryEdgeDistance) && boundaryEdgeDistance <= MARINDUQUE_BOUNDARY_AMBIGUOUS_EDGE_METERS;
  const polygonBarangayKey = normalizeBarangayName(polygonBoundaryContext?.barangay || '');

  if (polygonBoundaryContext && isBoundaryEdgeAmbiguous) {
    const edgeLocal = findNearestMarinduqueBarangayCandidate(lat, lng, polygonBoundaryContext);
    const edgeLocalKey = normalizeBarangayName(edgeLocal?.barangay || '');
    const edgeLocalDistance = Number(edgeLocal?.distanceMeters);
    if (
      edgeLocal &&
      edgeLocalKey &&
      edgeLocalKey !== polygonBarangayKey &&
      Number.isFinite(edgeLocalDistance) &&
      edgeLocalDistance <= LOCAL_BARANGAY_EDGE_OVERRIDE_DISTANCE_METERS
    ) {
      const payload = {
        ok: true,
        address: edgeLocal.address,
        source: 'marinduque-barangay-edge-override',
        distanceMeters: Math.round(edgeLocalDistance),
        boundaryBarangay: edgeLocal.barangay || '',
        boundaryMatchType: 'edge-override',
        boundaryEdgeDistanceMeters: Number.isFinite(boundaryEdgeDistance) ? Math.round(boundaryEdgeDistance) : null
      };
      setCachedReverseGeocode(lat, lng, payload);
      return payload;
    }
  }
  if (polygonBoundaryContext) {
    const polygonAddress = buildBoundaryAddress(polygonBoundaryContext, '');
    const polygonCandidate = createAddressCandidate({
      source: boundaryResolution.matchType === 'snap' ? 'marinduque-boundary-snap' : 'marinduque-boundary-polygon',
      address: polygonAddress,
      baseScore: boundaryResolution.matchType === 'snap' ? 34 : 36,
      providerBoost: 5.2,
      queryLat: lat,
      queryLng: lng,
      resultLat: lat,
      resultLng: lng
    });
    if (polygonCandidate) {
      polygonCandidate.barangay = polygonBoundaryContext.barangay;
      polygonCandidate.municipality = polygonBoundaryContext.municipality;
      polygonCandidate.province = polygonBoundaryContext.province;
      polygonCandidate.boundaryMatchType = boundaryResolution.matchType;
      polygonCandidate.boundaryEdgeDistanceMeters = Number.isFinite(boundaryResolution.edgeDistanceMeters)
        ? boundaryResolution.edgeDistanceMeters
        : null;
      if (isBoundaryEdgeAmbiguous) {
        polygonCandidate.score -= 6.5;
      }
      candidates.push(polygonCandidate);
    }

    // Fast path: if we already resolved a barangay boundary from local Marinduque polygons,
    // return immediately so the app shows a concrete place label instead of temporary pinned text.
    if (normalizeAddressKey(polygonBoundaryContext.barangay || '') && !isBoundaryEdgeAmbiguous) {
      const fastAddress = buildBoundaryAddress(polygonBoundaryContext, '');
      if (fastAddress) {
        const payload = {
          ok: true,
          address: fastAddress,
          source: boundaryResolution.matchType === 'snap' ? 'marinduque-boundary-snap' : 'marinduque-boundary-polygon',
          distanceMeters:
            boundaryResolution.matchType === 'snap' && Number.isFinite(boundaryResolution.edgeDistanceMeters)
              ? Math.round(boundaryResolution.edgeDistanceMeters)
              : 0,
          boundaryBarangay: polygonBoundaryContext.barangay || '',
          boundaryMatchType: boundaryResolution.matchType,
          boundaryEdgeDistanceMeters:
            boundaryResolution.matchType === 'snap' && Number.isFinite(boundaryResolution.edgeDistanceMeters)
              ? Math.round(boundaryResolution.edgeDistanceMeters)
              : 0
        };
        setCachedReverseGeocode(lat, lng, payload);
        return payload;
      }
    }
  }

  const immediateLocal = findNearestMarinduqueBarangayCandidate(lat, lng, null);
  maybeAddLocalBarangayCandidate(immediateLocal);

  const overpassBoundaryContext = polygonBoundaryContext ? null : await fetchOverpassBoundaryContext(lat, lng);
  const mergedBoundaryContext = polygonBoundaryContext || overpassBoundaryContext
    ? {
        barangay: (polygonBoundaryContext && polygonBoundaryContext.barangay) || (overpassBoundaryContext && overpassBoundaryContext.barangay) || '',
        municipality:
          (polygonBoundaryContext && polygonBoundaryContext.municipality) ||
          (overpassBoundaryContext && overpassBoundaryContext.municipality) ||
          '',
        province:
          (polygonBoundaryContext && polygonBoundaryContext.province) ||
          (overpassBoundaryContext && overpassBoundaryContext.province) ||
          'Marinduque',
        country:
          (overpassBoundaryContext && overpassBoundaryContext.country) ||
          (polygonBoundaryContext && polygonBoundaryContext.country) ||
          'Philippines'
      }
    : null;
  const hasBoundaryBarangay = !!normalizeAddressKey(mergedBoundaryContext?.barangay || '');
  const hasBoundaryMunicipality = !!normalizeAddressKey(mergedBoundaryContext?.municipality || '');
  const boundaryForCalibration = hasBoundaryBarangay || hasBoundaryMunicipality ? mergedBoundaryContext : null;
  if (boundaryForCalibration) {
    const boundaryAddress = buildBoundaryAddress(boundaryForCalibration, '');
    const boundaryCandidate = createAddressCandidate({
      source: polygonBoundaryContext
        ? boundaryResolution.matchType === 'snap'
          ? 'marinduque-boundary-snap'
          : 'marinduque-boundary'
        : 'overpass-boundary',
      address: boundaryAddress,
      baseScore: 17,
      providerBoost: 3.5,
      queryLat: lat,
      queryLng: lng,
      resultLat: lat,
      resultLng: lng
    });
    if (boundaryCandidate) {
      boundaryCandidate.barangay = boundaryForCalibration.barangay || '';
      boundaryCandidate.municipality = boundaryForCalibration.municipality || '';
      boundaryCandidate.province = boundaryForCalibration.province || 'Marinduque';
      candidates.push(boundaryCandidate);
    }
  }
  const localBarangayCandidate = findNearestMarinduqueBarangayCandidate(lat, lng, mergedBoundaryContext);
  maybeAddLocalBarangayCandidate(localBarangayCandidate);

  const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=19&addressdetails=1&namedetails=1`;
  const osmData = await fetchJsonWithTimeout(
    osmUrl,
    { headers: { 'Accept-Language': 'en,fil;q=0.9' } },
    3200
  );
  if (osmData) {
    const formatted = formatOsmAddress(osmData);
    if (formatted.address) {
      const candidate = createAddressCandidate({
        source: 'osm',
        address: formatted.address,
        baseScore: formatted.score,
        providerBoost: 1.6,
        queryLat: lat,
        queryLng: lng,
        resultLat: Number(osmData?.lat),
        resultLng: Number(osmData?.lon)
      });
      if (candidate) candidates.push(candidate);
    }
  }

  const currentlyHasKnownBarangay = candidates.some((candidate) =>
    addressContainsKnownMarinduqueBarangay(candidate?.address || '')
  );
  if (!hasBoundaryBarangay && !currentlyHasKnownBarangay) {
    const nearbyPlaceCandidate = await fetchOverpassNearbyPlaceCandidate(lat, lng, mergedBoundaryContext);
    if (nearbyPlaceCandidate) candidates.push(nearbyPlaceCandidate);
  }

  if (apiKey && candidates.length < 2) {
    const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=en&region=PH`;
    const gData = await fetchJsonWithTimeout(gUrl, {}, 3200);
    if (gData && Array.isArray(gData.results) && gData.results.length) {
      const picked = pickGoogleResult(gData.results, lat, lng);
      if (picked) {
        const formatted = formatGoogleAddress(picked);
        const candidate = createAddressCandidate({
          source: 'google',
          address: formatted.address || picked.formatted_address || '',
          baseScore:
            (formatted.address ? formatted.score : 2) +
            getGoogleTypeScore(picked.types) +
            getGoogleLocationTypeScore(picked?.geometry?.location_type),
          providerBoost: 2.8,
          queryLat: lat,
          queryLng: lng,
          resultLat: Number(picked?.geometry?.location?.lat),
          resultLng: Number(picked?.geometry?.location?.lng)
        });
        if (candidate) candidates.push(candidate);
      }
    }
  }

  if (mergedBoundaryContext) {
    candidates.forEach((candidate) => {
      candidate.score += getBoundaryBoost(candidate.address, mergedBoundaryContext);
    });
  }

  let best = pickBestAddressCandidate(candidates);
  if (best && best.address) {
    const hasKnownBarangayInBest = addressContainsKnownMarinduqueBarangay(best.address);
    if (localCandidates.length) {
      const nearestLocal = [...localCandidates]
        .sort((a, b) => {
          const aDist = Number.isFinite(a.distanceMeters) ? a.distanceMeters : Number.POSITIVE_INFINITY;
          const bDist = Number.isFinite(b.distanceMeters) ? b.distanceMeters : Number.POSITIVE_INFINITY;
          return aDist - bDist;
        })
        .find((candidate) => {
          const distance = Number(candidate.distanceMeters);
          return Number.isFinite(distance) && distance <= LOCAL_BARANGAY_MAX_DISTANCE_METERS;
        });
      const nearestDistance = Number(nearestLocal?.distanceMeters);
      const forceLocalOverride =
        !!nearestLocal &&
        Number.isFinite(nearestDistance) &&
        nearestDistance <= LOCAL_BARANGAY_OVERRIDE_DISTANCE_METERS &&
        !hasBoundaryBarangay;
      if (forceLocalOverride || (!hasKnownBarangayInBest && nearestLocal)) {
        best = nearestLocal;
      }
    }
  }

  if (best && best.address) {
    const isLowConfidenceLocalGuess =
      best.source === 'marinduque-barangay-db' &&
      !hasBoundaryBarangay &&
      !hasBoundaryMunicipality &&
      (!Number.isFinite(best.distanceMeters) || best.distanceMeters > LOCAL_BARANGAY_MAX_DISTANCE_METERS);
    if (isLowConfidenceLocalGuess) {
      const coarseAddress = [
        best.municipality || '',
        best.province || 'Marinduque',
        'Philippines'
      ]
        .filter(Boolean)
        .join(', ');
      const payload = {
        ok: true,
        address: coarseAddress || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        source: 'coarse-locality',
        distanceMeters: Number.isFinite(best.distanceMeters) ? Math.round(best.distanceMeters) : null,
        boundaryBarangay: ''
      };
      setCachedReverseGeocode(lat, lng, payload);
      return payload;
    }

    const effectiveBoundary = {
      barangay: (mergedBoundaryContext && mergedBoundaryContext.barangay) || best.barangay || '',
      municipality: (mergedBoundaryContext && mergedBoundaryContext.municipality) || best.municipality || '',
      province: (mergedBoundaryContext && mergedBoundaryContext.province) || best.province || 'Marinduque',
      country: (mergedBoundaryContext && mergedBoundaryContext.country) || 'Philippines'
    };
    const bestAddressKey = normalizeAddressKey(best.address);
    const barangayKey = normalizeAddressKey(boundaryForCalibration?.barangay || '');
    const shouldForceBoundary =
      !!boundaryForCalibration &&
      !!barangayKey &&
      !bestAddressKey.includes(barangayKey);
    const rawFinalAddress = shouldForceBoundary ? buildBoundaryAddress(boundaryForCalibration, best.address) : best.address;
    const hasStrictBoundaryBarangay = !!normalizeAddressKey(boundaryForCalibration?.barangay || '');
    const finalAddress = hasStrictBoundaryBarangay
      ? buildBoundaryAddress(boundaryForCalibration, rawFinalAddress) || rawFinalAddress || best.address
      : boundaryForCalibration
        ? buildBoundaryCalibratedAddress(rawFinalAddress, boundaryForCalibration) || rawFinalAddress || best.address
        : rawFinalAddress;
    const payload = {
      ok: true,
      address: finalAddress,
      source: best.source,
      distanceMeters: Number.isFinite(best.distanceMeters) ? Math.round(best.distanceMeters) : null,
      boundaryBarangay: (boundaryForCalibration && boundaryForCalibration.barangay) || effectiveBoundary.barangay || '',
      boundaryMatchType: boundaryResolution ? boundaryResolution.matchType : '',
      boundaryEdgeDistanceMeters: boundaryResolution && Number.isFinite(boundaryResolution.edgeDistanceMeters)
        ? Math.round(boundaryResolution.edgeDistanceMeters)
        : null
    };
    setCachedReverseGeocode(lat, lng, payload);
    return payload;
  }

  const fallbackPayload = {
    ok: false,
    address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    message: 'Address unavailable. Showing coordinate label.'
  };
  setCachedReverseGeocode(lat, lng, fallbackPayload);
  return fallbackPayload;
}

function getPlaceTypeScore(placeTag) {
  const tag = String(placeTag || '').toLowerCase();
  if (tag === 'neighbourhood') return 4.5;
  if (tag === 'suburb') return 4.2;
  if (tag === 'quarter') return 4;
  if (tag === 'village') return 3.2;
  if (tag === 'hamlet') return 2.8;
  if (tag === 'locality') return 2.4;
  return 1.8;
}

function getElementLatLng(element) {
  if (!element || typeof element !== 'object') return { lat: NaN, lng: NaN };
  const lat = Number(element.lat ?? element?.center?.lat);
  const lng = Number(element.lon ?? element?.center?.lon);
  return { lat, lng };
}

function parseOverpassNearbyPlaceCandidate(elements, queryLat, queryLng, boundaryContext = null) {
  if (!Array.isArray(elements) || !elements.length) return null;
  let best = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  elements.forEach((element) => {
    const tags = element && element.tags ? element.tags : null;
    const name = String(tags && tags.name ? tags.name : '').trim();
    if (!name) return;
    const { lat, lng } = getElementLatLng(element);
    const dist = distanceMeters({ lat: queryLat, lng: queryLng }, { lat, lng });
    const placeType = String(tags && tags.place ? tags.place : '').trim();
    const base = getPlaceTypeScore(placeType) + getDistanceCalibrationScore(dist) + 1.7;
    const score = base;
    if (score > bestScore) {
      bestScore = score;
      best = { name, placeType, lat, lng, distanceMeters: Number.isFinite(dist) ? dist : null };
    }
  });
  if (!best || !best.name) return null;
  const inferredMunicipality =
    (boundaryContext && boundaryContext.municipality) || inferMunicipalityFromBarangayName(best.name, queryLat, queryLng);
  const address = buildBoundaryAddress(
    {
      barangay: best.name,
      municipality: inferredMunicipality || '',
      province: (boundaryContext && boundaryContext.province) || 'Marinduque',
      country: (boundaryContext && boundaryContext.country) || 'Philippines'
    },
    best.name
  );
  const candidate = createAddressCandidate({
    source: 'overpass-place',
    address,
    baseScore: bestScore,
    providerBoost: 2.6,
    queryLat,
    queryLng,
    resultLat: best.lat,
    resultLng: best.lng
  });
  if (!candidate) return null;
  candidate.barangay = best.name;
  candidate.municipality = inferredMunicipality || '';
  candidate.province = (boundaryContext && boundaryContext.province) || 'Marinduque';
  return candidate;
}

async function fetchOverpassNearbyPlaceCandidate(lat, lng, boundaryContext = null) {
  const endpoint = 'https://overpass-api.de/api/interpreter';
  const query = `[out:json][timeout:8];
(
  node(around:800,${lat},${lng})["place"~"neighbourhood|suburb|quarter|village|hamlet|locality"];
  way(around:800,${lat},${lng})["place"~"neighbourhood|suburb|quarter|village|hamlet|locality"];
  relation(around:800,${lat},${lng})["place"~"neighbourhood|suburb|quarter|village|hamlet|locality"];
);
out center tags 40;`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal
    });
    if (!res.ok) return null;
    const data = await res.json();
    const elements = Array.isArray(data && data.elements) ? data.elements : [];
    return parseOverpassNearbyPlaceCandidate(elements, lat, lng, boundaryContext);
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function canSeed() {
  return String(process.env.ALLOW_SEED || '').toLowerCase() === 'true';
}

function getSeedEmployees() {
  return [
    {
      id: 'SDO-001',
      name: 'Juan Dela Cruz',
      position: 'IT Officer',
      office: 'ICT Unit',
      email: 'juan.delacruz@example.com',
      username: 'juan.delacruz@example.com',
      employeeType: 'Regular',
      password: 'password123',
      status: 'Active',
      avatar: 'assets/avatar-generic.svg',
      verified: true,
      otp: '',
      otpExpiresAt: 0
    },
    {
      id: 'SDO-002',
      name: 'Joji Ama',
      position: 'Registrar',
      office: 'Records Unit',
      email: 'joji.ama@example.com',
      username: 'joji.ama@example.com',
      employeeType: 'COS',
      password: 'password123',
      status: 'Active',
      avatar: 'assets/avatar-generic.svg',
      verified: true,
      otp: '',
      otpExpiresAt: 0
    }
  ];
}

function getSeedAttendance(date) {
  return [
    {
      id: `ATT-${date}-SDO-001`,
      employeeId: 'SDO-001',
      date,
      timeIn: '08:05',
      timeOut: '17:02',
      timeInAM: '08:05',
      timeOutAM: '12:01',
      timeInPM: '13:02',
      timeOutPM: '17:02',
      photoInAM: '',
      photoOutAM: '',
      photoInPM: '',
      photoOutPM: '',
      locationInAM: '',
      locationOutAM: '',
      locationInPM: '',
      locationOutPM: '',
      latInAM: '',
      lngInAM: '',
      latOutAM: '',
      lngOutAM: '',
      latInPM: '',
      lngInPM: '',
      latOutPM: '',
      lngOutPM: '',
      status: 'Late',
      latitude: '',
      longitude: '',
      location: '',
      photo: ''
    },
    {
      id: `ATT-${date}-SDO-002`,
      employeeId: 'SDO-002',
      date,
      timeIn: '07:55',
      timeOut: '17:00',
      timeInAM: '07:55',
      timeOutAM: '12:00',
      timeInPM: '13:00',
      timeOutPM: '17:00',
      photoInAM: '',
      photoOutAM: '',
      photoInPM: '',
      photoOutPM: '',
      locationInAM: '',
      locationOutAM: '',
      locationInPM: '',
      locationOutPM: '',
      latInAM: '',
      lngInAM: '',
      latOutAM: '',
      lngOutAM: '',
      latInPM: '',
      lngInPM: '',
      latOutPM: '',
      lngOutPM: '',
      status: 'Present',
      latitude: '',
      longitude: '',
      location: '',
      photo: ''
    }
  ];
}

async function sendOtpEmail(to, code) {
  const config = getBrevoConfig();
  if (!config) {
    return { ok: false, reason: 'Brevo not configured (missing BREVO_API_KEY or BREVO_FROM)' };
  }
  const payload = {
    sender: { name: config.fromName, email: config.fromEmail },
    to: [{ email: to }],
    subject: 'SDO Attendance OTP Verification',
    textContent: `Your OTP code is ${code}. It expires in 10 minutes.`,
    htmlContent: `<p>Your OTP code is <strong>${code}</strong>. It expires in 10 minutes.</p>`
  };
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': config.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const responseText = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      reason: `Brevo ${res.status}: ${responseText.slice(0, 200)}`
    };
  }
  return { ok: true, info: responseText };
}

function otpDeliveryFailureMessage() {
  return 'OTP email could not be delivered right now. Please try again in a moment or contact admin.';
}

async function deliverOtpCode(email, otp) {
  let emailError = '';
  try {
    const mailResult = await sendOtpEmail(email, otp);
    if (!mailResult.ok) {
      emailError = mailResult.reason || 'Email request failed';
    }
  } catch (err) {
    emailError = err && err.message ? String(err.message) : 'Email request failed';
  }

  const emailSent = !emailError;
  const allowFallback = ALLOW_DEV_OTP_FALLBACK && !OTP_EMAIL_REQUIRED;
  const devOtp = !emailSent && allowFallback ? String(otp) : '';
  return { emailSent, emailError, devOtp };
}

function attendanceForDate(db, date) {
  return db.attendance.filter((att) => att.date === date);
}

function enrichAttendance(db, list) {
  return list.map((att) => {
    const emp = db.employees.find((e) => e.id === att.employeeId);
    const normalized = normalizeAttendanceRecord(att);
    const status = computeDailyStatus(normalized);
    return {
      ...normalized,
      employeeName: emp ? emp.name : 'Unknown',
      office: emp ? emp.office : 'Unknown',
      position: emp ? emp.position : 'Unknown',
      status
    };
  });
}

function summaryForDate(db, date, officeScope = '') { 
  const scope = normalizeDivisionOfficeScope(officeScope);
  const activeEmployees = (db.employees || []).filter((emp) => {
    if (String(emp && emp.status ? emp.status : 'Active').toLowerCase() === 'deleted') return false;
    if (scope && String(emp && emp.office ? emp.office : '') !== scope) return false;
    return true;
  }); 
  const activeEmployeeIds = new Set(activeEmployees.map((emp) => emp.id)); 
  const totalEmployees = activeEmployees.length; 
  // System is used every Friday; do not count absences for other days.
  if (!isFridayInManila(date)) {
    return { totalEmployees, present: 0, late: 0, absent: 0 };
  }
  const todays = attendanceForDate(db, date); 
  const attendedIds = new Set(); 
  let present = 0; 
  let late = 0; 
  todays.forEach((att) => { 
    if (!activeEmployeeIds.has(att.employeeId)) return;
    if (!hasAnyAttendance(att)) return;
    attendedIds.add(att.employeeId);
    const status = computeDailyStatus(att);
    if (status === 'Late') late += 1;
    if (status === 'Present') present += 1;
  });
  const absent = totalEmployees - attendedIds.size; 
  return { totalEmployees, present, late, absent }; 
} 

function normalizeDivisionOfficeScope(value) {
  const raw = String(value || '').trim();
  const office = raw.toLowerCase();

  if (!raw) return '';

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

  // Canonicalize common office labels to match saved values in DB.
  const canonicalMap = {
    'office of the sds': 'Office of the SDS',
    'office of the asds': 'Office of the ASDS',
    'legal unit': 'Legal Unit',
    'ict unit': 'ICT Unit',
    'administrative unit': 'Administrative Unit',
    'personnel section': 'Personnel Section',
    'supply section': 'Supply Section',
    'cash section': 'Cash Section',
    'records section': 'Records Section',
    'procurement section': 'Procurement Section',
    'curriculum implementation division': 'Curriculum Implementation Division',
    'school governance and operations division': 'School Governance and Operations Division',
    'accounting section': 'Accounting Section',
    'budget section': 'Budget Section'
  };
  if (canonicalMap[office]) return canonicalMap[office];

  // Fallback: allow exact office filtering for any other saved values.
  return raw;
}

function isFridayInManila(dateStr) {
  if (!dateStr) return false;
  try {
    // Use a stable instant (00:00Z) then format in Asia/Manila to get the local weekday.
    const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`);
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Manila' }).format(d);
    return weekday === 'Fri';
  } catch (err) {
    return false;
  }
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function pushNotification(db, data) {
  const note = {
    id: makeId('NTF'),
    type: data.type || 'info',
    title: data.title || 'Notification',
    message: data.message || '',
    employeeId: data.employeeId || '',
    createdAt: new Date().toISOString(),
    read: false
  };
  db.notifications.unshift(note);
  if (db.notifications.length > 200) db.notifications = db.notifications.slice(0, 200);
  return note;
}

function pushMessage(db, data) {
  const msg = {
    id: makeId('MSG'),
    employeeId: data.employeeId || '',
    employeeName: data.employeeName || 'Unknown',
    office: data.office || '',
    subject: data.subject || 'Concern',
    message: data.message || '',
    createdAt: new Date().toISOString(),
    read: false
  };
  db.messages.unshift(msg);
  if (db.messages.length > 200) db.messages = db.messages.slice(0, 200);
  return msg;
}

function pushReport(db, data) {
  const report = {
    id: makeId('RPT'),
    employeeId: data.employeeId || '',
    employeeName: data.employeeName || '',
    office: data.office || '',
    reportDate: data.reportDate || isoToday(),
    summary: data.summary || '',
    attachmentName: data.attachmentName || '',
    attachmentData: data.attachmentData || '',
    attestedBy: data.attestedBy || '',
    attestedPosition: data.attestedPosition || '',
    createdAt: new Date().toISOString()
  };
  db.reports.unshift(report);
  if (db.reports.length > 500) db.reports = db.reports.slice(0, 500);
  return report;
}

function updateReportAttestedJson(db, payload) {
  const reportId = String(payload.id || '').trim();
  const employeeId = String(payload.employeeId || '').trim();
  const reportDate = String(payload.reportDate || payload.date || '').trim();
  const attestedBy = String(payload.attestedBy || '').trim();
  const attestedPosition = String(payload.attestedPosition || '').trim();

  let report = null;
  if (reportId) {
    report = (db.reports || []).find((item) => item.id === reportId) || null;
  }
  if (!report && employeeId && reportDate) {
    report = (db.reports || [])
      .filter((item) => item.employeeId === employeeId && String(item.reportDate) === reportDate)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0] || null;
  }
  if (!report) return null;

  report.attestedBy = attestedBy;
  report.attestedPosition = attestedPosition;
  return report;
}

async function insertNotificationPg(data) {
  const note = {
    id: makeId('NTF'),
    type: data.type || 'info',
    title: data.title || 'Notification',
    message: data.message || '',
    employeeId: data.employeeId || '',
    createdAt: new Date().toISOString(),
    read: false
  };
  await pgQuery(
    'INSERT INTO notifications (id, type, title, message, employee_id, created_at, read) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [note.id, note.type, note.title, note.message, note.employeeId, note.createdAt, note.read]
  );
  return note;
}

async function insertMessagePg(data) {
  const msg = {
    id: makeId('MSG'),
    employeeId: data.employeeId || '',
    employeeName: data.employeeName || 'Unknown',
    office: data.office || '',
    subject: data.subject || 'Concern',
    message: data.message || '',
    createdAt: new Date().toISOString(),
    read: false
  };
  await pgQuery(
    'INSERT INTO messages (id, employee_id, employee_name, office, subject, message, created_at, read) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [msg.id, msg.employeeId, msg.employeeName, msg.office, msg.subject, msg.message, msg.createdAt, msg.read]
  );
  return msg;
}

async function insertReportPg(data) {
  const report = {
    id: makeId('RPT'),
    employeeId: data.employeeId || '',
    employeeName: data.employeeName || '',
    office: data.office || '',
    reportDate: data.reportDate || isoToday(),
    summary: data.summary || '',
    attachmentName: data.attachmentName || '',
    attachmentData: data.attachmentData || '',
    attestedBy: data.attestedBy || '',
    attestedPosition: data.attestedPosition || '',
    createdAt: new Date().toISOString()
  };
  await pgQuery(
    `INSERT INTO reports (
       id, employee_id, employee_name, office, report_date, summary, attachment_name, attachment_data, attested_by, attested_position, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      report.id,
      report.employeeId,
      report.employeeName,
      report.office,
      report.reportDate,
      report.summary,
      report.attachmentName,
      report.attachmentData,
      report.attestedBy,
      report.attestedPosition,
      report.createdAt
    ]
  );
  return report;
}

async function updateReportAttestedPg(payload) {
  const reportId = String(payload.id || '').trim();
  const employeeId = String(payload.employeeId || '').trim();
  const reportDate = String(payload.reportDate || payload.date || '').trim();
  const attestedBy = String(payload.attestedBy || '').trim();
  const attestedPosition = String(payload.attestedPosition || '').trim();

  if (!reportId && (!employeeId || !reportDate)) return null;

  if (reportId) {
    const result = await pgQuery(
      `UPDATE reports
         SET attested_by = $2, attested_position = $3
       WHERE id = $1
       RETURNING *`,
      [reportId, attestedBy, attestedPosition]
    );
    if (result.rows.length) return mapReportRow(result.rows[0]);
  }

  const fallback = await pgQuery(
    `UPDATE reports
       SET attested_by = $3, attested_position = $4
     WHERE id = (
       SELECT id
       FROM reports
       WHERE employee_id = $1 AND report_date = $2
       ORDER BY created_at DESC
       LIMIT 1
     )
     RETURNING *`,
    [employeeId, reportDate, attestedBy, attestedPosition]
  );
  if (!fallback.rows.length) return null;
  return mapReportRow(fallback.rows[0]);
}

async function upsertAttendancePg(record) {
  const cols = [
    'id',
    'employee_id',
    'date',
    'time_in',
    'time_out',
    'time_in_am',
    'time_out_am',
    'time_in_pm',
    'time_out_pm',
    'photo_in_am',
    'photo_out_am',
    'photo_in_pm',
    'photo_out_pm',
    'location_in_am',
    'location_out_am',
    'location_in_pm',
    'location_out_pm',
    'lat_in_am',
    'lng_in_am',
    'lat_out_am',
    'lng_out_am',
    'lat_in_pm',
    'lng_in_pm',
    'lat_out_pm',
    'lng_out_pm',
    'status',
    'latitude',
    'longitude',
    'location',
    'photo',
    'updated_at'
  ];
  const values = [
    record.id,
    record.employeeId,
    record.date,
    record.timeIn,
    record.timeOut,
    record.timeInAM,
    record.timeOutAM,
    record.timeInPM,
    record.timeOutPM,
    record.photoInAM,
    record.photoOutAM,
    record.photoInPM,
    record.photoOutPM,
    record.locationInAM,
    record.locationOutAM,
    record.locationInPM,
    record.locationOutPM,
    record.latInAM,
    record.lngInAM,
    record.latOutAM,
    record.lngOutAM,
    record.latInPM,
    record.lngInPM,
    record.latOutPM,
    record.lngOutPM,
    record.status,
    record.latitude,
    record.longitude,
    record.location,
    record.photo,
    new Date().toISOString()
  ];
  const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
  const updates = cols
    .filter((col) => !['id', 'employee_id', 'date'].includes(col))
    .map((col) => `${col} = EXCLUDED.${col}`)
    .join(', ');
  await pgQuery(
    `INSERT INTO attendance (${cols.join(', ')}) VALUES (${placeholders})
     ON CONFLICT (employee_id, date) DO UPDATE SET ${updates}`,
    values
  );
}

async function handleApiPg(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/db-health') {
    const brevoConfig = getBrevoConfig();
    const [admins, employees, attendance, notifications, messages, reports] = await Promise.all([
      pgQuery('SELECT COUNT(*) AS count FROM admins'),
      pgQuery('SELECT COUNT(*) AS count FROM employees'),
      pgQuery('SELECT COUNT(*) AS count FROM attendance'),
      pgQuery('SELECT COUNT(*) AS count FROM notifications'),
      pgQuery('SELECT COUNT(*) AS count FROM messages'),
      pgQuery('SELECT COUNT(*) AS count FROM reports')
    ]);
    return sendJson(res, 200, {
      ok: true,
      mode: 'postgres',
      counts: {
        admins: Number(admins.rows[0].count),
        employees: Number(employees.rows[0].count),
        attendance: Number(attendance.rows[0].count),
        notifications: Number(notifications.rows[0].count),
        messages: Number(messages.rows[0].count),
        reports: Number(reports.rows[0].count)
      },
      email: {
        provider: 'brevo',
        configured: Boolean(brevoConfig),
        from: brevoConfig ? brevoConfig.fromEmail : ''
      },
      postgres: {
        enabled: USE_PG,
        wanted: WANTS_PG,
        initError: pgInitError
      },
      runtime: {
        requestTimeoutMs: REQUEST_TIMEOUT_MS,
        maxInflightRequests: MAX_INFLIGHT_REQUESTS,
        externalFetchTimeoutMs: EXTERNAL_FETCH_TIMEOUT_MS,
        inflightRequests
      },
      time: Date.now()
    });
  }

  if (req.method === 'POST' && pathname === '/api/dev/seed') {
    if (!canSeed()) {
      return sendJson(res, 403, { ok: false, message: 'Seeding disabled. Set ALLOW_SEED=true in .env.' });
    }
    const existing = await pgQuery('SELECT COUNT(*) AS count FROM employees');
    if (Number(existing.rows[0].count) > 0) {
      return sendJson(res, 409, { ok: false, message: 'Employees already exist. Seed skipped.' });
    }
    const seedEmployees = getSeedEmployees();
    for (const emp of seedEmployees) {
      await pgQuery(
        `INSERT INTO employees (id, name, position, office, email, username, employee_type, password, status, avatar, verified, otp, otp_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          emp.id,
          emp.name,
          emp.position,
          emp.office,
          emp.email,
          emp.username,
          emp.employeeType,
          emp.password,
          emp.status,
          emp.avatar,
          emp.verified,
          emp.otp,
          emp.otpExpiresAt
        ]
      );
    }
    const today = isoToday();
    const seedAttendance = getSeedAttendance(today);
    for (const record of seedAttendance) {
      await upsertAttendancePg(record);
    }
    return sendJson(res, 200, { ok: true, employees: seedEmployees.length, attendance: seedAttendance.length });
  }

  if (req.method === 'GET' && pathname === '/api/summary') { 
    const query = url.parse(req.url, true).query; 
    const date = String(query.date || isoToday()); 
    const officeScope = normalizeDivisionOfficeScope(query.office);
    const totalRes = await pgQuery( 
      `SELECT COUNT(*) AS count 
       FROM employees 
       WHERE LOWER(COALESCE(status, 'Active')) <> 'deleted'${officeScope ? ' AND office = $1' : ''}` 
      , officeScope ? [officeScope] : [] 
    );  
    const totalEmployees = Number(totalRes.rows[0].count);  
    // System is used every Friday; do not count absences for other days.
    if (!isFridayInManila(date)) {
      return sendJson(res, 200, { date, totalEmployees, present: 0, late: 0, absent: 0 });
    }
    const attendanceRes = await pgQuery(  
      `SELECT a.*  
       FROM attendance a  
       INNER JOIN employees e ON e.id = a.employee_id  
       WHERE a.date = $1 
         AND LOWER(COALESCE(e.status, 'Active')) <> 'deleted'${officeScope ? ' AND e.office = $2' : ''}`, 
      officeScope ? [date, officeScope] : [date] 
    ); 
    const todays = attendanceRes.rows.map(mapAttendanceRow); 
    const attendedIds = new Set(); 
    let present = 0; 
    let late = 0; 
    todays.forEach((att) => {
      if (!hasAnyAttendance(att)) return;
      attendedIds.add(att.employeeId);
      const status = computeDailyStatus(att);
      if (status === 'Late') late += 1;
      if (status === 'Present') present += 1;
    });
    const absent = totalEmployees - attendedIds.size;
    return sendJson(res, 200, { date, totalEmployees, present, late, absent });
  }

  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, time: Date.now() });
  }

  if (req.method === 'GET' && pathname === '/api/employees') { 
    const query = url.parse(req.url, true).query; 
    const officeScope = normalizeDivisionOfficeScope(query.office);
    const result = officeScope
      ? await pgQuery('SELECT * FROM employees WHERE office = $1 ORDER BY id', [officeScope])
      : await pgQuery('SELECT * FROM employees ORDER BY id'); 
    return sendJson(res, 200, { employees: result.rows.map(mapEmployeeRow) }); 
  } 

  if (req.method === 'GET' && pathname === '/api/notifications') {
    const result = await pgQuery('SELECT * FROM notifications ORDER BY created_at DESC');
    const notifications = result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      employeeId: row.employee_id || '',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
      read: row.read === true
    }));
    return sendJson(res, 200, { notifications });
  }

  if (req.method === 'POST' && pathname === '/api/notifications/read') {
    const body = await collectBody(req);
    if (body && body.all) {
      await pgQuery('UPDATE notifications SET read = true');
    } else if (Array.isArray(body.ids) && body.ids.length) {
      await pgQuery('UPDATE notifications SET read = true WHERE id = ANY($1::text[])', [body.ids]);
    }
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/messages') {
    const result = await pgQuery('SELECT * FROM messages ORDER BY created_at DESC');
    const messages = result.rows.map((row) => ({
      id: row.id,
      employeeId: row.employee_id || '',
      employeeName: row.employee_name || '',
      office: row.office || '',
      subject: row.subject || '',
      message: row.message || '',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
      read: row.read === true
    }));
    return sendJson(res, 200, { messages });
  }

  if (req.method === 'POST' && pathname === '/api/messages') {
    const body = await collectBody(req);
    const employeeId = String(body.employeeId || '').trim();
    const message = String(body.message || '').trim();
    const subject = String(body.subject || 'Concern').trim();
    if (!employeeId || !message) {
      return sendJson(res, 400, { ok: false, message: 'Employee and message are required.' });
    }
    const empRes = await pgQuery('SELECT name, office FROM employees WHERE id = $1', [employeeId]);
    const empRow = empRes.rows[0];
    const newMsg = await insertMessagePg({
      employeeId,
      employeeName: empRow ? empRow.name : String(body.employeeName || 'Unknown'),
      office: empRow ? empRow.office : String(body.office || ''),
      subject,
      message
    });
    return sendJson(res, 201, { ok: true, message: newMsg });
  }

  if (req.method === 'POST' && pathname === '/api/messages/read') {
    const body = await collectBody(req);
    if (body && body.all) {
      await pgQuery('UPDATE messages SET read = true');
    } else if (Array.isArray(body.ids) && body.ids.length) {
      await pgQuery('UPDATE messages SET read = true WHERE id = ANY($1::text[])', [body.ids]);
    }
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/reports') { 
    const query = url.parse(req.url, true).query; 
    const from = query.from || '1900-01-01'; 
    const to = query.to || '2999-12-31'; 
    const employeeId = query.employeeId; 
    const officeScope = normalizeDivisionOfficeScope(query.office);
    const params = [from, to]; 
    let sql = 
      `SELECT * FROM reports 
       WHERE report_date >= $1 AND report_date <= $2`; 
    if (employeeId) { 
      sql += ' AND employee_id = $3'; 
      params.push(employeeId); 
    } else if (officeScope) { 
      sql += ' AND office = $3'; 
      params.push(officeScope); 
    } 
    sql += ' ORDER BY report_date DESC, created_at DESC'; 
    const result = await pgQuery(sql, params); 
    return sendJson(res, 200, { reports: result.rows.map(mapReportRow) }); 
  } 

  if (req.method === 'POST' && pathname === '/api/reports') {
    const body = await collectBody(req);
    const employeeId = String(body.employeeId || '').trim();
    const summary = String(body.summary || '').trim();
    const reportDate = String(body.reportDate || body.date || isoToday());
    const attachmentData = String(body.attachment || body.attachmentData || '');
    const attachmentName = String(body.attachmentName || '');

    if (!employeeId || !summary) {
      return sendJson(res, 400, { ok: false, message: 'Employee and summary are required.' });
    }

    const empRes = await pgQuery('SELECT name, office FROM employees WHERE id = $1', [employeeId]);
    const empRow = empRes.rows[0];
    const report = await insertReportPg({
      employeeId,
      employeeName: empRow ? empRow.name : String(body.employeeName || 'Unknown'),
      office: empRow ? empRow.office : String(body.office || ''),
      reportDate,
      summary,
      attachmentName,
      attachmentData
    });
    await insertNotificationPg({
      type: 'report',
      title: 'New Daily Report',
      message: `${report.employeeName || 'Employee'} submitted a report for ${reportDate}.`,
      employeeId
    });
    return sendJson(res, 201, { ok: true, report });
  }

  if (req.method === 'POST' && pathname === '/api/reports/attested') {
    const body = await collectBody(req);
    const hasReportId = Boolean(String(body.id || '').trim());
    const employeeId = String(body.employeeId || '').trim();
    const reportDate = String(body.reportDate || body.date || '').trim();
    if (!hasReportId && (!employeeId || !reportDate)) {
      return sendJson(res, 400, { ok: false, message: 'Report id or employee/date is required.' });
    }
    const report = await updateReportAttestedPg(body);
    if (!report) {
      return sendJson(res, 404, { ok: false, message: 'Report not found.' });
    }
    return sendJson(res, 200, { ok: true, report });
  }

  if (req.method === 'POST' && pathname === '/api/employees') { 
    const body = await collectBody(req); 
    const email = normalizeEmail(body.email || ''); 
    const countRes = await pgQuery('SELECT COUNT(*) AS count FROM employees'); 
    const nextId = body.id || `SDO-${String(Number(countRes.rows[0].count) + 1).padStart(4, '0')}`; 
    const newEmp = {
      id: nextId,
      name: body.name || 'New Employee',
      position: body.position || 'Staff',
      office: body.office || 'Office',
      email,
      username: email || body.username || '',
      employeeType: body.employeeType || 'Regular',
      password: body.password || 'password123',
      status: 'Active',
      avatar: body.avatar || 'assets/avatar-generic.png',
      verified: true,
      otp: '',
      otpExpiresAt: 0
    };
    await pgQuery(
      `INSERT INTO employees (id, name, position, office, email, username, employee_type, password, status, avatar, verified, otp, otp_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        newEmp.id,
        newEmp.name,
        newEmp.position,
        newEmp.office,
        newEmp.email,
        newEmp.username,
        newEmp.employeeType,
        newEmp.password,
        newEmp.status,
        newEmp.avatar,
        newEmp.verified,
        newEmp.otp,
        newEmp.otpExpiresAt
      ]
    ); 
    return sendJson(res, 201, { employee: newEmp }); 
  } 

  if (req.method === 'POST' && pathname === '/api/employees/update') { 
    const body = await collectBody(req); 
    const employeeId = String(body.id || '').trim(); 
    const position = String(body.position || '').trim(); 
    if (!employeeId || !position) { 
      return sendJson(res, 400, { ok: false, message: 'Employee id and position are required.' }); 
    } 
    const existing = await pgQuery('SELECT 1 FROM employees WHERE id = $1', [employeeId]); 
    if (!existing.rows.length) { 
      return sendJson(res, 404, { ok: false, message: 'Employee not found.' }); 
    } 
    await pgQuery('UPDATE employees SET position = $1 WHERE id = $2', [position, employeeId]); 
    const updated = await pgQuery('SELECT * FROM employees WHERE id = $1', [employeeId]); 
    return sendJson(res, 200, { ok: true, employee: mapEmployeeRow(updated.rows[0]) }); 
  } 
 
  if (req.method === 'POST' && pathname === '/api/employees/delete') { 
    const body = await collectBody(req); 
    const employeeId = String(body.id || '').trim(); 
    if (!employeeId) { 
      return sendJson(res, 400, { ok: false, message: 'Employee id is required.' });
    }
    const existing = await pgQuery('SELECT * FROM employees WHERE id = $1', [employeeId]);
    if (!existing.rows.length) {
      return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
    }
    await pgQuery('UPDATE employees SET status = $1 WHERE id = $2', ['Deleted', employeeId]);
    const updated = await pgQuery('SELECT * FROM employees WHERE id = $1', [employeeId]);
    return sendJson(res, 200, { ok: true, employee: mapEmployeeRow(updated.rows[0]) });
  }

  if (req.method === 'POST' && pathname === '/api/employees/restore') {
    const body = await collectBody(req);
    const employeeId = String(body.id || '').trim();
    if (!employeeId) {
      return sendJson(res, 400, { ok: false, message: 'Employee id is required.' });
    }
    const existing = await pgQuery('SELECT * FROM employees WHERE id = $1', [employeeId]);
    if (!existing.rows.length) {
      return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
    }
    await pgQuery('UPDATE employees SET status = $1 WHERE id = $2', ['Active', employeeId]);
    const updated = await pgQuery('SELECT * FROM employees WHERE id = $1', [employeeId]);
    return sendJson(res, 200, { ok: true, employee: mapEmployeeRow(updated.rows[0]) });
  }

  if (req.method === 'POST' && pathname === '/api/admin/register') {
    const body = await collectBody(req);
    const name = String(body.name || '').trim();
    const username = String(body.username || '').trim();
    const password = String(body.password || '').trim();
    const office = String(body.office || '').trim();

    if (!name || !username || !password || !office) {
      return sendJson(res, 400, { ok: false, message: 'All fields are required.' });
    }

    const existing = await pgQuery('SELECT 1 FROM admins WHERE LOWER(username) = LOWER($1)', [username]);
    if (existing.rows.length) {
      return sendJson(res, 409, { ok: false, message: 'Username is already taken.' });
    }

    const countRes = await pgQuery('SELECT COUNT(*) AS count FROM admins');
    const newAdmin = {
      id: `ADM-${String(Number(countRes.rows[0].count) + 1).padStart(3, '0')}`,
      name,
      username,
      password,
      office
    };
    await pgQuery(
      'INSERT INTO admins (id, name, username, password, office) VALUES ($1, $2, $3, $4, $5)',
      [newAdmin.id, newAdmin.name, newAdmin.username, newAdmin.password, newAdmin.office]
    );
    return sendJson(res, 201, { ok: true, admin: newAdmin });
  }

  if (req.method === 'POST' && pathname === '/api/register') {
    const body = await collectBody(req);
    const name = String(body.name || '').trim();
    const office = String(body.office || '').trim();
    const employeeType = String(body.employeeType || '').trim();
    const position = String(body.position || 'Staff').trim();
    const email = normalizeEmail(body.email || '');
    const password = String(body.password || '').trim();

    if (!name || !office || !employeeType || !email || !password) {
      return sendJson(res, 400, { ok: false, message: 'All fields are required.' });
    }

    if (employeeType === 'Regular' && !isDepedEmail(email)) {
      return sendJson(res, 400, { ok: false, message: 'Regular employees must use a DepEd email.' });
    }

    const existingRes = await pgQuery(
      'SELECT * FROM employees WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)',
      [email]
    );

    if (existingRes.rows.length) {
      const existing = mapEmployeeRow(existingRes.rows[0]);
      const otp = generateOtp();
      existing.name = name;
      existing.office = office;
      existing.employeeType = employeeType;
      existing.position = position || existing.position;
      existing.email = email;
      existing.username = email;
      existing.password = password;
      existing.verified = false;
      existing.otp = otp;
      existing.otpExpiresAt = Date.now() + 10 * 60 * 1000;

      await pgQuery(
        `UPDATE employees SET name=$1, position=$2, office=$3, email=$4, username=$5, employee_type=$6, password=$7, verified=$8, otp=$9, otp_expires_at=$10 WHERE id=$11`,
        [
          existing.name,
          existing.position,
          existing.office,
          existing.email,
          existing.username,
          existing.employeeType,
          existing.password,
          existing.verified,
          existing.otp,
          existing.otpExpiresAt,
          existing.id
        ]
      );

      const delivery = await deliverOtpCode(email, otp);
      if (!delivery.emailSent && OTP_EMAIL_REQUIRED) {
        return sendJson(res, 503, {
          ok: false,
          emailSent: false,
          emailError: delivery.emailError,
          message: otpDeliveryFailureMessage()
        });
      }
      return sendJson(res, 200, {
        ok: true,
        employee: existing,
        devOtp: delivery.devOtp,
        emailSent: delivery.emailSent,
        emailError: delivery.emailError,
        message: 'Account updated. OTP sent to your email.'
      });
    }

    const countRes = await pgQuery('SELECT COUNT(*) AS count FROM employees');
    const nextId = `SDO-${String(Number(countRes.rows[0].count) + 1).padStart(3, '0')}`;
    const otp = generateOtp();
    const newEmp = {
      id: nextId,
      name,
      position,
      office,
      email,
      username: email,
      employeeType,
      password,
      status: 'Active',
      avatar: 'assets/avatar-generic.svg',
      verified: false,
      otp,
      otpExpiresAt: Date.now() + 10 * 60 * 1000
    };

    await pgQuery(
      `INSERT INTO employees (id, name, position, office, email, username, employee_type, password, status, avatar, verified, otp, otp_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        newEmp.id,
        newEmp.name,
        newEmp.position,
        newEmp.office,
        newEmp.email,
        newEmp.username,
        newEmp.employeeType,
        newEmp.password,
        newEmp.status,
        newEmp.avatar,
        newEmp.verified,
        newEmp.otp,
        newEmp.otpExpiresAt
      ]
    );

    const delivery = await deliverOtpCode(email, otp);
    if (!delivery.emailSent && OTP_EMAIL_REQUIRED) {
      return sendJson(res, 503, {
        ok: false,
        emailSent: false,
        emailError: delivery.emailError,
        message: otpDeliveryFailureMessage()
      });
    }

    return sendJson(res, 201, {
      ok: true,
      employee: newEmp,
      devOtp: delivery.devOtp,
      emailSent: delivery.emailSent,
      emailError: delivery.emailError
    });
  }

  if (req.method === 'POST' && pathname === '/api/register/verify') {
    const body = await collectBody(req);
    const lookup = resolveOtpLookup(body);
    const otp = String(body.otp || '').trim();
    if (!lookup || !otp) {
      return sendJson(res, 400, { ok: false, message: 'Account identifier and OTP are required.' });
    }
    const employeeRes = await pgQuery(
      'SELECT * FROM employees WHERE LOWER(email) = $1 OR LOWER(username) = $1 OR LOWER(id) = $1',
      [lookup]
    );
    if (!employeeRes.rows.length) return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
    const employee = mapEmployeeRow(employeeRes.rows[0]);
    if (!employee.otp || employee.otp !== otp) {
      return sendJson(res, 400, { ok: false, message: 'Invalid OTP.' });
    }
    if (employee.otpExpiresAt && Date.now() > employee.otpExpiresAt) {
      return sendJson(res, 400, { ok: false, message: 'OTP expired. Please resend.' });
    }
    await pgQuery('UPDATE employees SET verified = true, otp = $1, otp_expires_at = $2 WHERE id = $3', ['', 0, employee.id]);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/api/register/resend') {
    const body = await collectBody(req);
    const lookup = resolveOtpLookup(body);
    if (!lookup) return sendJson(res, 400, { ok: false, message: 'Account identifier is required.' });
    const employeeRes = await pgQuery(
      'SELECT * FROM employees WHERE LOWER(email) = $1 OR LOWER(username) = $1 OR LOWER(id) = $1',
      [lookup]
    );
    if (!employeeRes.rows.length) return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
    const employee = mapEmployeeRow(employeeRes.rows[0]);
    const targetEmail = resolveOtpTargetEmail(employee);
    if (!targetEmail) {
      return sendJson(res, 400, {
        ok: false,
        message: 'No valid email is registered for this account. Please contact admin.'
      });
    }
    const otp = generateOtp();
    const expires = Date.now() + 10 * 60 * 1000;
    await pgQuery('UPDATE employees SET otp = $1, otp_expires_at = $2 WHERE id = $3', [otp, expires, employee.id]);
    const delivery = await deliverOtpCode(targetEmail, otp);
    if (!delivery.emailSent && OTP_EMAIL_REQUIRED) {
      return sendJson(res, 503, {
        ok: false,
        emailSent: false,
        emailError: delivery.emailError,
        message: otpDeliveryFailureMessage()
      });
    }
    return sendJson(res, 200, {
      ok: true,
      devOtp: delivery.devOtp,
      emailSent: delivery.emailSent,
      emailError: delivery.emailError,
      sentTo: targetEmail
    });
  }

  if (req.method === 'POST' && pathname === '/api/password-reset') {
    const body = await collectBody(req);
    const role = String(body.role || '').trim();
    const username = String(body.username || '').trim();
    const newPassword = String(body.newPassword || '').trim();

    if (!role || !username || !newPassword) {
      return sendJson(res, 400, { ok: false, message: 'All fields are required.' });
    }

    if (role === 'admin') {
      const adminRes = await pgQuery('SELECT * FROM admins WHERE LOWER(username) = LOWER($1)', [username]);
      if (!adminRes.rows.length) return sendJson(res, 404, { ok: false, message: 'Admin not found.' });
      await pgQuery('UPDATE admins SET password = $1 WHERE id = $2', [newPassword, adminRes.rows[0].id]);
      return sendJson(res, 200, { ok: true });
    }

    const lookup = username.toLowerCase();
    const empRes = await pgQuery(
      'SELECT * FROM employees WHERE LOWER(username) = $1 OR LOWER(email) = $1 OR LOWER(id) = $1 OR LOWER(name) = $1',
      [lookup]
    );
    if (!empRes.rows.length) return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
    await pgQuery('UPDATE employees SET password = $1 WHERE id = $2', [newPassword, empRes.rows[0].id]);
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/api/login') {
    const body = await collectBody(req);
    const username = String(body.username || '').trim();
    const password = String(body.password || '').trim();
    if (!username || !password) {
      return sendJson(res, 400, { ok: false, message: 'Missing credentials' });
    }

    const adminRes = await pgQuery('SELECT * FROM admins WHERE LOWER(username) = LOWER($1)', [username]);
    if (adminRes.rows.length) {
      const admin = mapAdminRow(adminRes.rows[0]);
      if (admin.password === password) {
        return sendJson(res, 200, { ok: true, user: admin, role: 'admin' });
      }
    }

    const lookup = username.toLowerCase();
    const empRes = await pgQuery(
      'SELECT * FROM employees WHERE LOWER(username) = $1 OR LOWER(email) = $1 OR LOWER(id) = $1 OR LOWER(name) = $1',
      [lookup]
    );
    if (!empRes.rows.length) {
      return sendJson(res, 401, { ok: false, message: 'Invalid credentials' });
    }
    const emp = mapEmployeeRow(empRes.rows[0]);
    if (emp.password !== password) {
      return sendJson(res, 401, { ok: false, message: 'Invalid credentials' });
    }
    if (String(emp.status || '').toLowerCase() === 'deleted') {
      return sendJson(res, 403, { ok: false, message: 'This employee account is deactivated. Contact admin.' });
    }
    if (emp.verified === false) {
      return sendJson(res, 403, {
        ok: false,
        message: 'Email not verified. Please enter the OTP sent to your email.',
        identifier: emp.email || emp.username || emp.id || username
      });
    }
    return sendJson(res, 200, { ok: true, user: emp, role: 'employee' });
  }

  if (req.method === 'GET' && pathname === '/api/attendance/today') { 
    const query = url.parse(req.url, true).query; 
    const date = String(query.date || isoToday()); 
    const officeScope = normalizeDivisionOfficeScope(query.office);
    const result = await pgQuery( 
      `SELECT a.*, e.name AS employee_name, e.office, e.position 
       FROM attendance a 
       LEFT JOIN employees e ON e.id = a.employee_id 
       WHERE a.date = $1 
       ${officeScope ? 'AND e.office = $2' : ''} 
       ORDER BY a.date DESC`, 
      officeScope ? [date, officeScope] : [date] 
    ); 
    const attendance = result.rows.map((row) => {
      const rec = mapAttendanceRow(row);
      rec.employeeName = row.employee_name || 'Unknown';
      rec.office = row.office || 'Unknown';
      rec.position = row.position || 'Unknown';
      rec.status = computeDailyStatus(rec);
      return rec;
    });
    return sendJson(res, 200, { date, attendance });
  }

  if (req.method === 'GET' && pathname === '/api/attendance') { 
    const query = url.parse(req.url, true).query; 
    const from = query.from || '1900-01-01'; 
    const to = query.to || '2999-12-31'; 
    const employeeId = query.employeeId; 
    const officeScope = normalizeDivisionOfficeScope(query.office);
    const params = [from, to]; 
    let sql = 
      `SELECT a.*, e.name AS employee_name, e.office, e.position 
       FROM attendance a 
       LEFT JOIN employees e ON e.id = a.employee_id 
       WHERE a.date >= $1 AND a.date <= $2`; 
    if (employeeId) { 
      sql += ' AND a.employee_id = $3'; 
      params.push(employeeId); 
    } else if (officeScope) { 
      sql += ' AND e.office = $3'; 
      params.push(officeScope); 
    } 
    sql += ' ORDER BY a.date DESC'; 
    const result = await pgQuery(sql, params); 
    const attendance = result.rows.map((row) => {
      const rec = mapAttendanceRow(row);
      rec.employeeName = row.employee_name || 'Unknown';
      rec.office = row.office || 'Unknown';
      rec.position = row.position || 'Unknown';
      rec.status = computeDailyStatus(rec);
      return rec;
    });
    return sendJson(res, 200, { attendance });
  }

  if (req.method === 'POST' && pathname === '/api/attendance/timein') {
    const body = await collectBody(req);
    const nowPH = getPhilippineNow();
    const useServerTime = body.useServerTime !== false;
    const date = useServerTime ? nowPH.date : (body.date || nowPH.date);
    const employeeId = body.employeeId;
    const rawTime = String(body.timeIn || '').trim();
    const timeIn = useServerTime ? nowPH.time : (rawTime || nowPH.time);
    const requestedSlot = normalizeAttendanceSlot(body.slot || body.session);
    const timeWindow = classifyTimeIn(timeIn);
    if (!timeWindow.ok) return sendJson(res, 400, { message: timeWindow.message });
    const session = requestedSlot || timeWindow.session;
    const photo = body.photo || '';
    const location = body.location || '';
    const latitude = body.latitude || '';
    const longitude = body.longitude || '';
    const existingRes = await pgQuery(
      'SELECT * FROM attendance WHERE employee_id = $1 AND date = $2',
      [employeeId, date]
    );
    if (existingRes.rows.length) {
      const existing = mapAttendanceRow(existingRes.rows[0]);
      if (existing.timeIn && !existing.timeInAM) existing.timeInAM = existing.timeIn;
      if (existing.timeOut && !existing.timeOutAM) existing.timeOutAM = existing.timeOut;
      if (session === 'AM') {
        if (existing.timeInAM) return sendJson(res, 409, { message: 'Time in already recorded.' });
        existing.timeInAM = timeIn;
        existing.photoInAM = photo || existing.photoInAM;
        existing.locationInAM = location || existing.locationInAM;
        existing.latInAM = latitude || existing.latInAM;
        existing.lngInAM = longitude || existing.lngInAM;
      } else {
        if (existing.timeInPM) return sendJson(res, 409, { message: 'Time in already recorded.' });
        existing.timeInPM = timeIn;
        existing.photoInPM = photo || existing.photoInPM;
        existing.locationInPM = location || existing.locationInPM;
        existing.latInPM = latitude || existing.latInPM;
        existing.lngInPM = longitude || existing.lngInPM;
      }
      if (session === 'AM' && !existing.timeIn) existing.timeIn = timeIn;
      existing.photo = pickLatestValue(photo, existing.photo);
      existing.location = pickLatestValue(location, existing.location);
      existing.latitude = pickLatestValue(latitude, existing.latitude);
      existing.longitude = pickLatestValue(longitude, existing.longitude);
      existing.status = computeDailyStatus(existing);
      await upsertAttendancePg(existing);
      return sendJson(res, 200, { attendance: existing, slot: session });
    }
    const record = {
      id: `ATT-${date}-${employeeId}`,
      employeeId,
      date,
      timeIn,
      timeOut: '',
      timeInAM: session === 'AM' ? timeIn : '',
      timeOutAM: '',
      timeInPM: session === 'PM' ? timeIn : '',
      timeOutPM: '',
      photoInAM: session === 'AM' ? photo : '',
      photoOutAM: '',
      photoInPM: session === 'PM' ? photo : '',
      photoOutPM: '',
      locationInAM: session === 'AM' ? location : '',
      locationOutAM: '',
      locationInPM: session === 'PM' ? location : '',
      locationOutPM: '',
      latInAM: session === 'AM' ? latitude : '',
      lngInAM: session === 'AM' ? longitude : '',
      latOutAM: '',
      lngOutAM: '',
      latInPM: session === 'PM' ? latitude : '',
      lngInPM: session === 'PM' ? longitude : '',
      latOutPM: '',
      lngOutPM: '',
      status: computeDailyStatus({
        timeInAM: session === 'AM' ? timeIn : '',
        timeInPM: session === 'PM' ? timeIn : '',
        timeOutAM: '',
        timeOutPM: '',
        timeIn
      }),
      latitude,
      longitude,
      location,
      photo
    };
    await upsertAttendancePg(record);
    const empRes = await pgQuery('SELECT name, office FROM employees WHERE id = $1', [employeeId]);
    const empRow = empRes.rows[0];
    await insertNotificationPg({
      type: 'attendance',
      employeeId,
      title: 'New Time In',
      message: `${empRow ? empRow.name : employeeId} (${empRow ? empRow.office : 'Office'}) timed in at ${timeIn}.`
    });
    return sendJson(res, 201, { attendance: record, slot: session });
  }

  if (req.method === 'POST' && pathname === '/api/attendance/timeout') {
    const body = await collectBody(req);
    const nowPH = getPhilippineNow();
    const useServerTime = body.useServerTime !== false;
    const date = useServerTime ? nowPH.date : (body.date || nowPH.date);
    const employeeId = body.employeeId;
    const rawTime = String(body.timeOut || '').trim();
    const timeOut = useServerTime ? nowPH.time : (rawTime || nowPH.time);
    const requestedSlot = normalizeAttendanceSlot(body.slot || body.session);
    const timeWindow = classifyTimeOut(timeOut);
    if (!timeWindow.ok) return sendJson(res, 400, { message: timeWindow.message });
    const session = requestedSlot || timeWindow.session;
    const photo = body.photo || '';
    const location = body.location || '';
    const latitude = body.latitude || '';
    const longitude = body.longitude || '';
    const existingRes = await pgQuery(
      'SELECT * FROM attendance WHERE employee_id = $1 AND date = $2',
      [employeeId, date]
    );
    if (!existingRes.rows.length) {
      const record = {
        id: `ATT-${date}-${employeeId}`,
        employeeId,
        date,
        timeIn: '',
        timeOut: session === 'PM' ? timeOut : '',
        timeInAM: '',
        timeOutAM: session === 'AM' ? timeOut : '',
        timeInPM: '',
        timeOutPM: session === 'PM' ? timeOut : '',
        photoInAM: '',
        photoOutAM: session === 'AM' ? photo : '',
        photoInPM: '',
        photoOutPM: session === 'PM' ? photo : '',
        locationInAM: '',
        locationOutAM: session === 'AM' ? location : '',
        locationInPM: '',
        locationOutPM: session === 'PM' ? location : '',
        latInAM: '',
        lngInAM: '',
        latOutAM: session === 'AM' ? latitude : '',
        lngOutAM: session === 'AM' ? longitude : '',
        latInPM: '',
        lngInPM: '',
        latOutPM: session === 'PM' ? latitude : '',
        lngOutPM: session === 'PM' ? longitude : '',
        status: computeDailyStatus({
          timeInAM: '',
          timeOutAM: session === 'AM' ? timeOut : '',
          timeInPM: '',
          timeOutPM: session === 'PM' ? timeOut : '',
          timeOut: session === 'PM' ? timeOut : ''
        }),
        latitude,
        longitude,
        location,
        photo
      };
      await upsertAttendancePg(record);
      if (timeOut) {
        const empRes = await pgQuery('SELECT name, office FROM employees WHERE id = $1', [employeeId]);
        const empRow = empRes.rows[0];
        await insertNotificationPg({
          type: 'attendance',
          employeeId,
          title: 'New Time Out',
          message: `${empRow ? empRow.name : employeeId} (${empRow ? empRow.office : 'Office'}) timed out at ${timeOut}.`
        });
      }
      return sendJson(res, 201, { attendance: record, slot: session });
    }
    const existing = mapAttendanceRow(existingRes.rows[0]);
    if (existing.timeIn && !existing.timeInAM) existing.timeInAM = existing.timeIn;
    if (existing.timeOut && !existing.timeOutAM) existing.timeOutAM = existing.timeOut;
    if (session === 'AM') {
      if (existing.timeOutAM) return sendJson(res, 409, { message: 'Time out already recorded.' });
      existing.timeOutAM = timeOut;
      existing.photoOutAM = photo || existing.photoOutAM;
      existing.locationOutAM = location || existing.locationOutAM;
      existing.latOutAM = latitude || existing.latOutAM;
      existing.lngOutAM = longitude || existing.lngOutAM;
    } else {
      if (existing.timeOutPM) return sendJson(res, 409, { message: 'Time out already recorded.' });
      existing.timeOutPM = timeOut;
      existing.photoOutPM = photo || existing.photoOutPM;
      existing.locationOutPM = location || existing.locationOutPM;
      existing.latOutPM = latitude || existing.latOutPM;
      existing.lngOutPM = longitude || existing.lngOutPM;
    }
    if (session === 'PM' && !existing.timeOut) existing.timeOut = timeOut;
    existing.photo = pickLatestValue(photo, existing.photo);
    existing.location = pickLatestValue(location, existing.location);
    existing.latitude = pickLatestValue(latitude, existing.latitude);
    existing.longitude = pickLatestValue(longitude, existing.longitude);
    existing.status = computeDailyStatus(existing);
    await upsertAttendancePg(existing);
    if (timeOut) {
      const empRes = await pgQuery('SELECT name, office FROM employees WHERE id = $1', [employeeId]);
      const empRow = empRes.rows[0];
      await insertNotificationPg({
        type: 'attendance',
        employeeId,
        title: 'New Time Out',
        message: `${empRow ? empRow.name : employeeId} (${empRow ? empRow.office : 'Office'}) timed out at ${timeOut}.`
      });
    }
    return sendJson(res, 200, { attendance: existing, slot: session });
  }

  return sendJson(res, 404, { message: 'Not found' });
}

async function handleApi(req, res, pathname) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  if (req.method === 'GET' && pathname === '/api/reverse-geocode') {
    const query = url.parse(req.url, true).query;
    const lat = parseFloat(query.lat);
    const lng = parseFloat(query.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return sendJson(res, 400, { ok: false, message: 'Latitude and longitude are required.' });
    }
    const cached = getCachedReverseGeocode(lat, lng);
    if (cached) return sendJson(res, 200, cached);

    const inflightKey = getReverseGeocodeCacheKey(lat, lng, 5);
    if (!inflightKey) {
      return sendJson(res, 400, { ok: false, message: 'Invalid coordinates.' });
    }

    try {
      let inflight = reverseGeocodeInflight.get(inflightKey);
      if (!inflight) {
        inflight = resolveReverseGeocodeAddress(lat, lng);
        reverseGeocodeInflight.set(inflightKey, inflight);
      }
      const payload = await inflight;
      return sendJson(res, 200, payload);
    } catch (err) {
      return sendJson(res, 500, { ok: false, message: 'Unable to fetch address.' });
    } finally {
      reverseGeocodeInflight.delete(inflightKey);
    }
  }

  if (req.method === 'GET' && pathname === '/api/map') {
    const query = url.parse(req.url, true).query;
    const lat = parseFloat(query.lat);
    const lng = parseFloat(query.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Latitude and longitude are required.');
    }
    const apiKey = getGoogleMapsKey();
    try {
      if (!apiKey) {
        const osmParams = new URLSearchParams({
          center: `${lat},${lng}`,
          zoom: '17',
          size: '600x320',
          markers: `${lat},${lng},red-pushpin`
        });
        res.writeHead(302, { Location: `https://staticmap.openstreetmap.de/staticmap.php?${osmParams.toString()}` });
        return res.end();
      }
      const gParams = new URLSearchParams({
        center: `${lat},${lng}`,
        zoom: '17',
        size: '600x320',
        scale: '2',
        maptype: 'roadmap',
        markers: `color:red|label:A|${lat},${lng}`,
        key: apiKey
      });
      const gRes = await fetchWithTimeout(
        `https://maps.googleapis.com/maps/api/staticmap?${gParams.toString()}`,
        {},
        EXTERNAL_FETCH_TIMEOUT_MS
      );
      if (!gRes.ok) {
        const osmParams = new URLSearchParams({
          center: `${lat},${lng}`,
          zoom: '17',
          size: '600x320',
          markers: `${lat},${lng},red-pushpin`
        });
        res.writeHead(302, { Location: `https://staticmap.openstreetmap.de/staticmap.php?${osmParams.toString()}` });
        return res.end();
      }
      const buffer = Buffer.from(await gRes.arrayBuffer());
      res.writeHead(200, {
        'Content-Type': gRes.headers.get('content-type') || 'image/png',
        'Cache-Control': 'no-store'
      });
      return res.end(buffer);
    } catch (err) {
      const osmParams = new URLSearchParams({
        center: `${lat},${lng}`,
        zoom: '17',
        size: '600x320',
        markers: `${lat},${lng},red-pushpin`
      });
      res.writeHead(302, { Location: `https://staticmap.openstreetmap.de/staticmap.php?${osmParams.toString()}` });
      return res.end();
    }
  }

  if (USE_PG) {
    try {
      return await handleApiPg(req, res, pathname);
    } catch (err) {
      await forcePgFallback(err);
      return handleApi(req, res, pathname);
    }
  }

  if (req.method === 'GET' && pathname === '/api/db-health') {
    const db = readDb();
    const diag = getJsonDbDiagnostics(db);
    const brevoConfig = getBrevoConfig();
    return sendJson(res, 200, {
      ok: true,
      mode: 'json',
      counts: diag.counts,
      storage: {
        envDbPath: diag.envDbPath,
        dataPath: diag.dataPath,
        dataDir: diag.dataDir,
        dataDirWritable: diag.dataDirWritable,
        dataFileExists: diag.dataFileExists,
        cwd: diag.cwd,
        root: diag.root,
        lastDbWriteError: diag.lastDbWriteError,
        lastDbWriteAttemptAt: diag.lastDbWriteAttemptAt,
        lastDbWriteOkAt: diag.lastDbWriteOkAt
      },
      email: {
        provider: 'brevo',
        configured: Boolean(brevoConfig),
        from: brevoConfig ? brevoConfig.fromEmail : ''
      },
      postgres: {
        enabled: USE_PG,
        wanted: WANTS_PG,
        initError: pgInitError
      },
      runtime: {
        requestTimeoutMs: REQUEST_TIMEOUT_MS,
        maxInflightRequests: MAX_INFLIGHT_REQUESTS,
        externalFetchTimeoutMs: EXTERNAL_FETCH_TIMEOUT_MS,
        inflightRequests
      },
      time: Date.now()
    });
  }

  if (req.method === 'POST' && pathname === '/api/dev/seed') {
    if (!canSeed()) {
      return sendJson(res, 403, { ok: false, message: 'Seeding disabled. Set ALLOW_SEED=true in .env.' });
    }
    const db = readDb();
    if (db.employees.length > 0) {
      return sendJson(res, 409, { ok: false, message: 'Employees already exist. Seed skipped.' });
    }
    const seedEmployees = getSeedEmployees();
    const today = isoToday();
    const seedAttendance = getSeedAttendance(today);
    db.employees.push(...seedEmployees);
    db.attendance.push(...seedAttendance);
    writeDb(db);
    return sendJson(res, 200, { ok: true, employees: seedEmployees.length, attendance: seedAttendance.length });
  }

  if (req.method === 'GET' && pathname === '/api/summary') { 
    const db = readDb(); 
    const query = url.parse(req.url, true).query; 
    const date = String(query.date || isoToday()); 
    const officeScope = normalizeDivisionOfficeScope(query.office);
    const summary = summaryForDate(db, date, officeScope); 
    return sendJson(res, 200, { date, ...summary }); 
  } 

  if (req.method === 'GET' && pathname === '/api/health') {
    return sendJson(res, 200, { ok: true, time: Date.now() });
  }

  if (req.method === 'GET' && pathname === '/api/employees') { 
    const db = readDb(); 
    const query = url.parse(req.url, true).query; 
    const officeScope = normalizeDivisionOfficeScope(query.office);
    const list = officeScope ? (db.employees || []).filter((e) => String(e.office || '') === officeScope) : (db.employees || []);
    return sendJson(res, 200, { employees: list }); 
  } 

  if (req.method === 'GET' && pathname === '/api/notifications') {
    const db = readDb();
    return sendJson(res, 200, { notifications: db.notifications || [] });
  }

  if (req.method === 'POST' && pathname === '/api/notifications/read') {
    return collectBody(req).then((body) => {
      const db = readDb();
      if (body && body.all) {
        db.notifications.forEach((n) => { n.read = true; });
      } else if (Array.isArray(body.ids)) {
        const set = new Set(body.ids);
        db.notifications.forEach((n) => { if (set.has(n.id)) n.read = true; });
      }
      writeDb(db);
      return sendJson(res, 200, { ok: true });
    });
  }

  if (req.method === 'GET' && pathname === '/api/messages') {
    const db = readDb();
    return sendJson(res, 200, { messages: db.messages || [] });
  }

  if (req.method === 'POST' && pathname === '/api/messages') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const employeeId = String(body.employeeId || '').trim();
      const message = String(body.message || '').trim();
      const subject = String(body.subject || 'Concern').trim();
      if (!employeeId || !message) {
        return sendJson(res, 400, { ok: false, message: 'Employee and message are required.' });
      }
      const emp = db.employees.find((e) => e.id === employeeId);
      const newMsg = pushMessage(db, {
        employeeId,
        employeeName: emp ? emp.name : String(body.employeeName || 'Unknown'),
        office: emp ? emp.office : String(body.office || ''),
        subject,
        message
      });
      pushNotification(db, {
        type: 'message',
        employeeId,
        title: 'New Concern',
        message: `${newMsg.employeeName || 'Employee'} (${newMsg.office || 'Office'}) sent a concern: ${subject || 'Concern'}.`
      });
      writeDb(db);
      return sendJson(res, 201, { ok: true, message: newMsg });
    });
  }

  if (req.method === 'POST' && pathname === '/api/messages/read') {
    return collectBody(req).then((body) => {
      const db = readDb();
      if (body && body.all) {
        db.messages.forEach((m) => { m.read = true; });
      } else if (Array.isArray(body.ids)) {
        const set = new Set(body.ids);
        db.messages.forEach((m) => { if (set.has(m.id)) m.read = true; });
      }
      writeDb(db);
      return sendJson(res, 200, { ok: true });
    });
  }

  if (req.method === 'GET' && pathname === '/api/reports') { 
    const db = readDb(); 
    const query = url.parse(req.url, true).query; 
    const from = query.from || '1900-01-01'; 
    const to = query.to || '2999-12-31'; 
    const employeeId = query.employeeId; 
    const officeScope = normalizeDivisionOfficeScope(query.office);
    let list = db.reports || []; 
    list = list.filter((r) => r.reportDate >= from && r.reportDate <= to); 
    if (employeeId) list = list.filter((r) => r.employeeId === employeeId); 
    if (!employeeId && officeScope) list = list.filter((r) => String(r.office || '') === officeScope);
    list.sort((a, b) => { 
      if (a.reportDate === b.reportDate) { 
        return String(b.createdAt || '').localeCompare(String(a.createdAt || '')); 
      } 
      return String(b.reportDate).localeCompare(String(a.reportDate)); 
    }); 
    return sendJson(res, 200, { reports: list }); 
  } 

  if (req.method === 'POST' && pathname === '/api/reports') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const employeeId = String(body.employeeId || '').trim();
      const summary = String(body.summary || '').trim();
      const reportDate = String(body.reportDate || body.date || isoToday());
      const attachmentData = String(body.attachment || body.attachmentData || '');
      const attachmentName = String(body.attachmentName || '');
      if (!employeeId || !summary) {
        return sendJson(res, 400, { ok: false, message: 'Employee and summary are required.' });
      }
      const emp = db.employees.find((e) => e.id === employeeId);
      const report = pushReport(db, {
        employeeId,
        employeeName: emp ? emp.name : String(body.employeeName || 'Unknown'),
        office: emp ? emp.office : String(body.office || ''),
        reportDate,
        summary,
        attachmentName,
        attachmentData
      });
      pushNotification(db, {
        type: 'report',
        title: 'New Daily Report',
        message: `${report.employeeName || 'Employee'} submitted a report for ${reportDate}.`,
        employeeId
      });
      if (!persistJsonDbOrFail(res, db)) return;
      return sendJson(res, 201, { ok: true, report });
    });
  }

  if (req.method === 'POST' && pathname === '/api/reports/attested') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const hasReportId = Boolean(String(body.id || '').trim());
      const employeeId = String(body.employeeId || '').trim();
      const reportDate = String(body.reportDate || body.date || '').trim();
      if (!hasReportId && (!employeeId || !reportDate)) {
        return sendJson(res, 400, { ok: false, message: 'Report id or employee/date is required.' });
      }
      const report = updateReportAttestedJson(db, body);
      if (!report) {
        return sendJson(res, 404, { ok: false, message: 'Report not found.' });
      }
      if (!persistJsonDbOrFail(res, db)) return;
      return sendJson(res, 200, { ok: true, report });
    });
  }

  if (req.method === 'POST' && pathname === '/api/employees') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const email = normalizeEmail(body.email || '');
      const newEmp = {
        id: body.id || `SDO-${String(db.employees.length + 1).padStart(4, '0')}`,
        name: body.name || 'New Employee',
        position: body.position || 'Staff',
        office: body.office || 'Office',
        email,
        username: email || body.username || '',
        employeeType: body.employeeType || 'Regular',
        password: body.password || 'password123',
        status: 'Active',
        avatar: body.avatar || 'assets/avatar-generic.png',
        verified: true,
        otp: '',
        otpExpiresAt: 0
      };
      db.employees.push(newEmp);
      writeDb(db);
      return sendJson(res, 201, { employee: newEmp }); 
    }); 
  } 

  if (req.method === 'POST' && pathname === '/api/employees/update') { 
    return collectBody(req).then((body) => { 
      const db = readDb(); 
      const employeeId = String(body.id || '').trim(); 
      const position = String(body.position || '').trim(); 
      if (!employeeId || !position) { 
        return sendJson(res, 400, { ok: false, message: 'Employee id and position are required.' }); 
      } 
      const employee = db.employees.find((e) => e.id === employeeId); 
      if (!employee) { 
        return sendJson(res, 404, { ok: false, message: 'Employee not found.' }); 
      } 
      employee.position = position; 
      writeDb(db); 
      return sendJson(res, 200, { ok: true, employee }); 
    }); 
  } 
 
  if (req.method === 'POST' && pathname === '/api/employees/delete') { 
    return collectBody(req).then((body) => { 
      const db = readDb(); 
      const employeeId = String(body.id || '').trim(); 
      if (!employeeId) {
        return sendJson(res, 400, { ok: false, message: 'Employee id is required.' });
      }
      const employee = db.employees.find((e) => e.id === employeeId);
      if (!employee) {
        return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
      }
      employee.status = 'Deleted';
      writeDb(db);
      return sendJson(res, 200, { ok: true, employee });
    });
  }

  if (req.method === 'POST' && pathname === '/api/employees/restore') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const employeeId = String(body.id || '').trim();
      if (!employeeId) {
        return sendJson(res, 400, { ok: false, message: 'Employee id is required.' });
      }
      const employee = db.employees.find((e) => e.id === employeeId);
      if (!employee) {
        return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
      }
      employee.status = 'Active';
      writeDb(db);
      return sendJson(res, 200, { ok: true, employee });
    });
  }

  if (req.method === 'POST' && pathname === '/api/admin/register') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const name = String(body.name || '').trim();
      const username = String(body.username || '').trim();
      const password = String(body.password || '').trim();
      const office = String(body.office || '').trim();

      if (!name || !username || !password || !office) {
        return sendJson(res, 400, { ok: false, message: 'All fields are required.' });
      }

      const existing = db.admins.find((a) => a.username.toLowerCase() === username.toLowerCase());
      if (existing) {
        return sendJson(res, 409, { ok: false, message: 'Username is already taken.' });
      }

      const newAdmin = {
        id: `ADM-${String(db.admins.length + 1).padStart(3, '0')}`,
        name,
        username,
        password,
        office
      };
      db.admins.push(newAdmin);
      writeDb(db);
      return sendJson(res, 201, { ok: true, admin: newAdmin });
    });
  }

  if (req.method === 'POST' && pathname === '/api/register') {
    return collectBody(req).then(async (body) => {
      const db = readDb();
      const name = String(body.name || '').trim();
      const office = String(body.office || '').trim();
      const employeeType = String(body.employeeType || '').trim();
      const position = String(body.position || 'Staff').trim();
      const email = normalizeEmail(body.email || '');
      const password = String(body.password || '').trim();

      if (!name || !office || !employeeType || !email || !password) {
        return sendJson(res, 400, { ok: false, message: 'All fields are required.' });
      }

      if (employeeType === 'Regular' && !isDepedEmail(email)) {
        return sendJson(res, 400, { ok: false, message: 'Regular employees must use a DepEd email.' });
      }

      const existing = db.employees.find((e) =>
        (e.email && e.email.toLowerCase() === email) ||
        (e.username && e.username.toLowerCase() === email)
      );
      if (existing) {
        const otp = generateOtp();
        existing.name = name;
        existing.office = office;
        existing.employeeType = employeeType;
        existing.position = position || existing.position;
        existing.email = email;
        existing.username = email;
        existing.password = password;
        existing.verified = false;
        existing.otp = otp;
        existing.otpExpiresAt = Date.now() + 10 * 60 * 1000;
        writeDb(db);
        const delivery = await deliverOtpCode(email, otp);
        if (!delivery.emailSent && OTP_EMAIL_REQUIRED) {
          return sendJson(res, 503, {
            ok: false,
            emailSent: false,
            emailError: delivery.emailError,
            message: otpDeliveryFailureMessage()
          });
        }
        return sendJson(res, 200, {
          ok: true,
          employee: existing,
          devOtp: delivery.devOtp,
          emailSent: delivery.emailSent,
          emailError: delivery.emailError,
          message: 'Account updated. OTP sent to your email.'
        });
      }

      const nextId = `SDO-${String(db.employees.length + 1).padStart(3, '0')}`;
      const otp = generateOtp();
      const newEmp = {
        id: nextId,
        name,
        position,
        office,
        email,
        username: email,
        employeeType,
        password,
        status: 'Active',
        avatar: 'assets/avatar-generic.svg',
        verified: false,
        otp,
        otpExpiresAt: Date.now() + 10 * 60 * 1000
      };
      db.employees.push(newEmp);
      writeDb(db);

      const delivery = await deliverOtpCode(email, otp);
      if (!delivery.emailSent && OTP_EMAIL_REQUIRED) {
        return sendJson(res, 503, {
          ok: false,
          emailSent: false,
          emailError: delivery.emailError,
          message: otpDeliveryFailureMessage()
        });
      }

      return sendJson(res, 201, {
        ok: true,
        employee: newEmp,
        devOtp: delivery.devOtp,
        emailSent: delivery.emailSent,
        emailError: delivery.emailError
      });
    });
  }

  if (req.method === 'POST' && pathname === '/api/register/verify') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const lookup = resolveOtpLookup(body);
      const otp = String(body.otp || '').trim();
      if (!lookup || !otp) {
        return sendJson(res, 400, { ok: false, message: 'Account identifier and OTP are required.' });
      }
      const employee = db.employees.find((e) =>
        (e.email && e.email.toLowerCase() === lookup) ||
        (e.username && e.username.toLowerCase() === lookup) ||
        (e.id && e.id.toLowerCase() === lookup)
      );
      if (!employee) return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
      if (!employee.otp || employee.otp !== otp) {
        return sendJson(res, 400, { ok: false, message: 'Invalid OTP.' });
      }
      if (employee.otpExpiresAt && Date.now() > employee.otpExpiresAt) {
        return sendJson(res, 400, { ok: false, message: 'OTP expired. Please resend.' });
      }
      employee.verified = true;
      employee.otp = '';
      employee.otpExpiresAt = 0;
      writeDb(db);
      return sendJson(res, 200, { ok: true });
    });
  }

  if (req.method === 'POST' && pathname === '/api/register/resend') {
    return collectBody(req).then(async (body) => {
      const db = readDb();
      const lookup = resolveOtpLookup(body);
      if (!lookup) return sendJson(res, 400, { ok: false, message: 'Account identifier is required.' });
      const employee = db.employees.find((e) =>
        (e.email && e.email.toLowerCase() === lookup) ||
        (e.username && e.username.toLowerCase() === lookup) ||
        (e.id && e.id.toLowerCase() === lookup)
      );
      if (!employee) return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
      const targetEmail = resolveOtpTargetEmail(employee);
      if (!targetEmail) {
        return sendJson(res, 400, {
          ok: false,
          message: 'No valid email is registered for this account. Please contact admin.'
        });
      }
      const otp = generateOtp();
      employee.otp = otp;
      employee.otpExpiresAt = Date.now() + 10 * 60 * 1000;
      writeDb(db);
      const delivery = await deliverOtpCode(targetEmail, otp);
      if (!delivery.emailSent && OTP_EMAIL_REQUIRED) {
        return sendJson(res, 503, {
          ok: false,
          emailSent: false,
          emailError: delivery.emailError,
          message: otpDeliveryFailureMessage()
        });
      }
      return sendJson(res, 200, {
        ok: true,
        devOtp: delivery.devOtp,
        emailSent: delivery.emailSent,
        emailError: delivery.emailError,
        sentTo: targetEmail
      });
    });
  }

  if (req.method === 'POST' && pathname === '/api/password-reset') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const role = String(body.role || '').trim();
      const username = String(body.username || '').trim();
      const newPassword = String(body.newPassword || '').trim();

      if (!role || !username || !newPassword) {
        return sendJson(res, 400, { ok: false, message: 'All fields are required.' });
      }

      if (role === 'admin') {
        const admin = db.admins.find((a) => a.username.toLowerCase() === username.toLowerCase());
        if (!admin) return sendJson(res, 404, { ok: false, message: 'Admin not found.' });
        admin.password = newPassword;
        writeDb(db);
        return sendJson(res, 200, { ok: true });
      }

      const lookup = username.toLowerCase();
      const emp = db.employees.find((e) =>
        (e.username && e.username.toLowerCase() === lookup) ||
        (e.email && e.email.toLowerCase() === lookup) ||
        (e.id && e.id.toLowerCase() === lookup) ||
        (e.name && e.name.toLowerCase() === lookup)
      );
      if (!emp) return sendJson(res, 404, { ok: false, message: 'Employee not found.' });
      emp.password = newPassword;
      writeDb(db);
      return sendJson(res, 200, { ok: true });
    });
  }

  if (req.method === 'POST' && pathname === '/api/login') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const username = String(body.username || '').trim();
      const password = String(body.password || '').trim();
      if (!username || !password) {
        return sendJson(res, 400, { ok: false, message: 'Missing credentials' });
      }

      const admin = db.admins.find((a) => a.username.toLowerCase() === username.toLowerCase());
      if (admin && admin.password === password) {
        return sendJson(res, 200, { ok: true, user: admin, role: 'admin' });
      }

      const lookup = username.toLowerCase();
      const emp = db.employees.find((e) =>
        (e.username && e.username.toLowerCase() === lookup) ||
        (e.email && e.email.toLowerCase() === lookup) ||
        (e.id && e.id.toLowerCase() === lookup) ||
        (e.name && e.name.toLowerCase() === lookup)
      );
      if (!emp || emp.password !== password) {
        return sendJson(res, 401, { ok: false, message: 'Invalid credentials' });
      }
      if (String(emp.status || '').toLowerCase() === 'deleted') {
        return sendJson(res, 403, { ok: false, message: 'This employee account is deactivated. Contact admin.' });
      }
      if (emp.verified === false) {
        return sendJson(res, 403, {
          ok: false,
          message: 'Email not verified. Please enter the OTP sent to your email.',
          identifier: emp.email || emp.username || emp.id || username
        });
      }
      return sendJson(res, 200, { ok: true, user: emp, role: 'employee' });
    });
  }

  if (req.method === 'GET' && pathname === '/api/attendance/today') { 
    const db = readDb(); 
    const query = url.parse(req.url, true).query; 
    const date = String(query.date || isoToday()); 
    const officeScope = normalizeDivisionOfficeScope(query.office);
    let todays = enrichAttendance(db, attendanceForDate(db, date)); 
    if (officeScope) todays = todays.filter((att) => String(att.office || '') === officeScope);
    return sendJson(res, 200, { date, attendance: todays }); 
  } 
 
  if (req.method === 'GET' && pathname === '/api/attendance') { 
    const db = readDb(); 
    const query = url.parse(req.url, true).query; 
    const from = query.from || '1900-01-01'; 
    const to = query.to || '2999-12-31'; 
    const employeeId = query.employeeId; 
    const officeScope = normalizeDivisionOfficeScope(query.office);
    let list = db.attendance.filter((a) => a.date >= from && a.date <= to); 
    if (employeeId) list = list.filter((a) => a.employeeId === employeeId); 
    let enriched = enrichAttendance(db, list); 
    if (!employeeId && officeScope) enriched = enriched.filter((att) => String(att.office || '') === officeScope);
    return sendJson(res, 200, { attendance: enriched }); 
  } 

  if (req.method === 'POST' && pathname === '/api/attendance/timein') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const nowPH = getPhilippineNow();
      const useServerTime = body.useServerTime !== false;
      const date = useServerTime ? nowPH.date : (body.date || nowPH.date);
      const employeeId = body.employeeId;
      const rawTime = String(body.timeIn || '').trim();
      const timeIn = useServerTime ? nowPH.time : (rawTime || nowPH.time);
      const timeWindow = classifyTimeIn(timeIn);
      if (!timeWindow.ok) {
        return sendJson(res, 400, { message: timeWindow.message });
      }
      const requestedSlot = normalizeAttendanceSlot(body.slot || body.session);
      const session = requestedSlot || timeWindow.session;
      const photo = body.photo || '';
      const location = body.location || '';
      const latitude = body.latitude || '';
      const longitude = body.longitude || '';
      const existing = db.attendance.find((a) => a.employeeId === employeeId && a.date === date);
      if (existing) {
        if (existing.timeIn && !existing.timeInAM) existing.timeInAM = existing.timeIn;
        if (existing.timeOut && !existing.timeOutAM) existing.timeOutAM = existing.timeOut;
        if (session === 'AM') {
          if (existing.timeInAM) return sendJson(res, 409, { message: 'Time in already recorded.' });
          existing.timeInAM = timeIn;
          existing.photoInAM = photo || existing.photoInAM;
          existing.locationInAM = location || existing.locationInAM;
          existing.latInAM = latitude || existing.latInAM;
          existing.lngInAM = longitude || existing.lngInAM;
        } else {
          if (existing.timeInPM) return sendJson(res, 409, { message: 'Time in already recorded.' });
          existing.timeInPM = timeIn;
          existing.photoInPM = photo || existing.photoInPM;
          existing.locationInPM = location || existing.locationInPM;
          existing.latInPM = latitude || existing.latInPM;
          existing.lngInPM = longitude || existing.lngInPM;
        }
        if (session === 'AM' && !existing.timeIn) existing.timeIn = timeIn;
        existing.photo = pickLatestValue(photo, existing.photo);
        existing.location = pickLatestValue(location, existing.location);
        existing.latitude = pickLatestValue(latitude, existing.latitude);
        existing.longitude = pickLatestValue(longitude, existing.longitude);
        existing.status = computeDailyStatus(existing);
        if (!persistJsonDbOrFail(res, db)) return;
        return sendJson(res, 200, { attendance: existing, slot: session });
      }
      const record = {
        id: `ATT-${date}-${employeeId}`,
        employeeId,
        date,
        timeIn: session === 'AM' ? timeIn : '',
        timeOut: '',
        timeInAM: session === 'AM' ? timeIn : '',
        timeOutAM: '',
        timeInPM: session === 'PM' ? timeIn : '',
        timeOutPM: '',
        photoInAM: session === 'AM' ? photo : '',
        photoOutAM: '',
        photoInPM: session === 'PM' ? photo : '',
        photoOutPM: '',
        locationInAM: session === 'AM' ? location : '',
        locationOutAM: '',
        locationInPM: session === 'PM' ? location : '',
        locationOutPM: '',
        latInAM: session === 'AM' ? latitude : '',
        lngInAM: session === 'AM' ? longitude : '',
        latOutAM: '',
        lngOutAM: '',
        latInPM: session === 'PM' ? latitude : '',
        lngInPM: session === 'PM' ? longitude : '',
        latOutPM: '',
        lngOutPM: '',
        status: computeDailyStatus({
          timeInAM: session === 'AM' ? timeIn : '',
          timeInPM: session === 'PM' ? timeIn : '',
          timeOutAM: '',
          timeOutPM: '',
          timeIn
        }),
        latitude,
        longitude,
        location,
        photo
      };
      db.attendance.push(record);
      const emp = db.employees.find((e) => e.id === employeeId);
      const empName = emp ? emp.name : employeeId;
      const office = emp ? emp.office : 'Office';
      pushNotification(db, {
        type: 'attendance',
        employeeId,
        title: 'New Time In',
        message: `${empName} (${office}) timed in at ${timeIn}.`
      });
      if (!persistJsonDbOrFail(res, db)) return;
      return sendJson(res, 201, { attendance: record, slot: session });
    });
  }

  if (req.method === 'POST' && pathname === '/api/attendance/timeout') {
    return collectBody(req).then((body) => {
      const db = readDb();
      const nowPH = getPhilippineNow();
      const useServerTime = body.useServerTime !== false;
      const date = useServerTime ? nowPH.date : (body.date || nowPH.date);
      const employeeId = body.employeeId;
      const rawTime = String(body.timeOut || '').trim();
      const timeOut = useServerTime ? nowPH.time : (rawTime || nowPH.time);
      const timeWindow = classifyTimeOut(timeOut);
      if (!timeWindow.ok) {
        return sendJson(res, 400, { message: timeWindow.message });
      }
      const requestedSlot = normalizeAttendanceSlot(body.slot || body.session);
      const session = requestedSlot || timeWindow.session;
      const photo = body.photo || '';
      const location = body.location || '';
      const latitude = body.latitude || '';
      const longitude = body.longitude || '';
      const existing = db.attendance.find((a) => a.employeeId === employeeId && a.date === date);
      if (!existing) {
        const record = {
          id: `ATT-${date}-${employeeId}`,
          employeeId,
          date,
          timeIn: '',
          timeOut: session === 'PM' ? timeOut : '',
          timeInAM: '',
          timeOutAM: session === 'AM' ? timeOut : '',
          timeInPM: '',
          timeOutPM: session === 'PM' ? timeOut : '',
          photoInAM: '',
          photoOutAM: session === 'AM' ? photo : '',
          photoInPM: '',
          photoOutPM: session === 'PM' ? photo : '',
          locationInAM: '',
          locationOutAM: session === 'AM' ? location : '',
          locationInPM: '',
          locationOutPM: session === 'PM' ? location : '',
          latInAM: '',
          lngInAM: '',
          latOutAM: session === 'AM' ? latitude : '',
          lngOutAM: session === 'AM' ? longitude : '',
          latInPM: '',
          lngInPM: '',
          latOutPM: session === 'PM' ? latitude : '',
          lngOutPM: session === 'PM' ? longitude : '',
          status: computeDailyStatus({
            timeInAM: '',
            timeOutAM: session === 'AM' ? timeOut : '',
            timeInPM: '',
            timeOutPM: session === 'PM' ? timeOut : '',
            timeOut: session === 'PM' ? timeOut : ''
          }),
          latitude,
          longitude,
          location,
          photo
        };
        db.attendance.push(record);
        if (timeOut) {
          const emp = db.employees.find((e) => e.id === employeeId);
          const empName = emp ? emp.name : employeeId;
          const office = emp ? emp.office : 'Office';
          pushNotification(db, {
            type: 'attendance',
            employeeId,
            title: 'New Time Out',
            message: `${empName} (${office}) timed out at ${timeOut}.`
          });
        }
        if (!persistJsonDbOrFail(res, db)) return;
        return sendJson(res, 201, { attendance: record, slot: session });
      }
      if (existing.timeIn && !existing.timeInAM) existing.timeInAM = existing.timeIn;
      if (existing.timeOut && !existing.timeOutAM) existing.timeOutAM = existing.timeOut;
      if (session === 'AM') {
        if (existing.timeOutAM) return sendJson(res, 409, { message: 'Time out already recorded.' });
        existing.timeOutAM = timeOut;
        existing.photoOutAM = photo || existing.photoOutAM;
        existing.locationOutAM = location || existing.locationOutAM;
        existing.latOutAM = latitude || existing.latOutAM;
        existing.lngOutAM = longitude || existing.lngOutAM;
      } else {
        if (existing.timeOutPM) return sendJson(res, 409, { message: 'Time out already recorded.' });
        existing.timeOutPM = timeOut;
        existing.photoOutPM = photo || existing.photoOutPM;
        existing.locationOutPM = location || existing.locationOutPM;
        existing.latOutPM = latitude || existing.latOutPM;
        existing.lngOutPM = longitude || existing.lngOutPM;
      }
      if (session === 'PM' && !existing.timeOut) existing.timeOut = timeOut;
      existing.photo = pickLatestValue(photo, existing.photo);
      existing.location = pickLatestValue(location, existing.location);
      existing.latitude = pickLatestValue(latitude, existing.latitude);
      existing.longitude = pickLatestValue(longitude, existing.longitude);
      existing.status = computeDailyStatus(existing);
      if (timeOut) {
        const emp = db.employees.find((e) => e.id === employeeId);
        const empName = emp ? emp.name : employeeId;
        const office = emp ? emp.office : 'Office';
        pushNotification(db, {
          type: 'attendance',
          employeeId,
          title: 'New Time Out',
          message: `${empName} (${office}) timed out at ${timeOut}.`
        });
      }
      if (!persistJsonDbOrFail(res, db)) return;
      return sendJson(res, 200, { attendance: existing, slot: session });
    });
  }

  sendJson(res, 404, { message: 'Not found' });
}

function routeRequest(req, res) {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname;

  if (pathname.startsWith('/api/')) {
    return handleApi(req, res, pathname);
  }

  if (pathname === '/') {
    res.writeHead(302, { Location: '/admin/' });
    return res.end();
  }

  if (pathname.startsWith('/admin')) {
    const safePath = pathname.replace('/admin', '').replace(/\/+$/, '');
    const filePath = safePath === '' || safePath === '/' ? 'index.html' : safePath;
    return sendFile(res, path.join(ROOT, 'admin', filePath));
  }

  if (pathname.startsWith('/employee')) {
    if (pathname === '/employee' || pathname === '/employee/') {
      const queryParams = new URLSearchParams(parsed.query || '');
      const currentVersion = String(queryParams.get('v') || '');
      if (currentVersion !== EMPLOYEE_CACHE_BUSTER) {
        queryParams.set('v', EMPLOYEE_CACHE_BUSTER);
        const queryString = queryParams.toString();
        const redirectLocation = queryString ? `/employee/?${queryString}` : '/employee/';
        res.writeHead(302, {
          Location: redirectLocation,
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0'
        });
        return res.end();
      }
    }
    const safePath = pathname.replace('/employee', '').replace(/\/+$/, '');
    const filePath = safePath === '' || safePath === '/' ? 'index.html' : safePath;
    return sendFile(res, path.join(ROOT, 'employee', filePath));
  }

  return sendFile(res, path.join(ROOT, pathname));
}

const app = express();
app.disable('x-powered-by');
let inflightRequests = 0;
app.use((req, res) => {
  const parsedUrl = url.parse(req.url || '');
  const isApiRequest = String(parsedUrl.pathname || '').startsWith('/api/');

  if (isApiRequest && inflightRequests >= MAX_INFLIGHT_REQUESTS) {
    setCors(res);
    return sendJson(res, 503, {
      ok: false,
      message: 'Server is busy. Please retry in a few seconds.'
    });
  }

  inflightRequests += 1;
  let finished = false;
  const release = () => {
    if (finished) return;
    finished = true;
    inflightRequests = Math.max(0, inflightRequests - 1);
  };

  res.on('finish', release);
  res.on('close', release);
  res.setTimeout(REQUEST_TIMEOUT_MS, () => {
    if (res.headersSent) return;
    if (isApiRequest) setCors(res);
    sendJson(res, 503, {
      ok: false,
      message: 'Request timed out. Please retry.'
    });
  });

  Promise.resolve(routeRequest(req, res)).catch((err) => {
    console.error('Unhandled request error:', err && err.message ? err.message : err);
    if (!res.headersSent) {
      if (isApiRequest) setCors(res);
      sendJson(res, 503, {
        ok: false,
        message: 'Service temporarily unavailable. Please retry shortly.'
      });
    }
  });
});

const PORT = process.env.PORT || 5173;
(async () => {
  try {
    await ensureSchema();
  } catch (err) {
    console.error('Database initialization failed:', err.message || err);
    if (USE_PG) {
      await forcePgFallback(err);
    }
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
})();
