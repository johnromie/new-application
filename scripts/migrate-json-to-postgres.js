const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

try {
  require('dotenv').config();
} catch (err) {
  // dotenv is optional
}

function normalizeDb(db) {
  const safe = db && typeof db === 'object' ? db : {};
  if (!Array.isArray(safe.admins)) safe.admins = [];
  if (!Array.isArray(safe.employees)) safe.employees = [];
  if (!Array.isArray(safe.attendance)) safe.attendance = [];
  if (!Array.isArray(safe.notifications)) safe.notifications = [];
  if (!Array.isArray(safe.messages)) safe.messages = [];
  if (!Array.isArray(safe.reports)) safe.reports = [];
  return safe;
}

function resolveJsonPath() {
  const root = path.join(__dirname, '..');
  const explicit = String(process.env.MIGRATE_JSON_PATH || '').trim();
  if (explicit) return path.isAbsolute(explicit) ? explicit : path.join(root, explicit);
  const dbPath = String(process.env.DB_PATH || '').trim();
  if (dbPath) return path.isAbsolute(dbPath) ? dbPath : path.join(root, dbPath);
  return path.join(root, 'data', 'db.json');
}

function loadJsonDb(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return normalizeDb(JSON.parse(raw));
}

function makePool() {
  if (process.env.DATABASE_URL) {
    return new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return new Pool({
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'sdo_user',
    password: process.env.PGPASSWORD || 'sdo_pass',
    database: process.env.PGDATABASE || 'sdo_attendance'
  });
}

async function ensureSchema(client) {
  await client.query(
    `CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      office TEXT NOT NULL
    );`
  );
  await client.query(
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
  await client.query(`CREATE INDEX IF NOT EXISTS idx_employees_email ON employees (LOWER(email));`);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_employees_username ON employees (LOWER(username));`);
  await client.query(
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
  await client.query(
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
  await client.query(
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
  await client.query(
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
}

async function migrate() {
  const jsonPath = resolveJsonPath();
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`JSON database file not found: ${jsonPath}`);
  }

  const db = loadJsonDb(jsonPath);
  const pool = makePool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await ensureSchema(client);

    for (const admin of db.admins) {
      await client.query(
        `INSERT INTO admins (id, name, username, password, office)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             username = EXCLUDED.username,
             password = EXCLUDED.password,
             office = EXCLUDED.office`,
        [
          String(admin.id || ''),
          String(admin.name || ''),
          String(admin.username || ''),
          String(admin.password || ''),
          String(admin.office || '')
        ]
      );
    }

    for (const emp of db.employees) {
      await client.query(
        `INSERT INTO employees
         (id, name, position, office, email, username, employee_type, password, status, avatar, verified, otp, otp_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE
         SET name = EXCLUDED.name,
             position = EXCLUDED.position,
             office = EXCLUDED.office,
             email = EXCLUDED.email,
             username = EXCLUDED.username,
             employee_type = EXCLUDED.employee_type,
             password = EXCLUDED.password,
             status = EXCLUDED.status,
             avatar = EXCLUDED.avatar,
             verified = EXCLUDED.verified,
             otp = EXCLUDED.otp,
             otp_expires_at = EXCLUDED.otp_expires_at`,
        [
          String(emp.id || ''),
          String(emp.name || ''),
          String(emp.position || ''),
          String(emp.office || ''),
          String(emp.email || ''),
          String(emp.username || ''),
          String(emp.employeeType || 'Regular'),
          String(emp.password || ''),
          String(emp.status || 'Active'),
          String(emp.avatar || ''),
          emp.verified === true,
          String(emp.otp || ''),
          Number(emp.otpExpiresAt || 0)
        ]
      );
    }

    for (const item of db.attendance) {
      await client.query(
        `INSERT INTO attendance
         (id, employee_id, date, time_in, time_out, time_in_am, time_out_am, time_in_pm, time_out_pm,
          photo_in_am, photo_out_am, photo_in_pm, photo_out_pm,
          location_in_am, location_out_am, location_in_pm, location_out_pm,
          lat_in_am, lng_in_am, lat_out_am, lng_out_am, lat_in_pm, lng_in_pm, lat_out_pm, lng_out_pm,
          status, latitude, longitude, location, photo, updated_at)
         VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17,
          $18, $19, $20, $21, $22, $23, $24, $25,
          $26, $27, $28, $29, $30, NOW())
         ON CONFLICT (employee_id, date) DO UPDATE
         SET time_in = EXCLUDED.time_in,
             time_out = EXCLUDED.time_out,
             time_in_am = EXCLUDED.time_in_am,
             time_out_am = EXCLUDED.time_out_am,
             time_in_pm = EXCLUDED.time_in_pm,
             time_out_pm = EXCLUDED.time_out_pm,
             photo_in_am = EXCLUDED.photo_in_am,
             photo_out_am = EXCLUDED.photo_out_am,
             photo_in_pm = EXCLUDED.photo_in_pm,
             photo_out_pm = EXCLUDED.photo_out_pm,
             location_in_am = EXCLUDED.location_in_am,
             location_out_am = EXCLUDED.location_out_am,
             location_in_pm = EXCLUDED.location_in_pm,
             location_out_pm = EXCLUDED.location_out_pm,
             lat_in_am = EXCLUDED.lat_in_am,
             lng_in_am = EXCLUDED.lng_in_am,
             lat_out_am = EXCLUDED.lat_out_am,
             lng_out_am = EXCLUDED.lng_out_am,
             lat_in_pm = EXCLUDED.lat_in_pm,
             lng_in_pm = EXCLUDED.lng_in_pm,
             lat_out_pm = EXCLUDED.lat_out_pm,
             lng_out_pm = EXCLUDED.lng_out_pm,
             status = EXCLUDED.status,
             latitude = EXCLUDED.latitude,
             longitude = EXCLUDED.longitude,
             location = EXCLUDED.location,
             photo = EXCLUDED.photo,
             updated_at = NOW()`,
        [
          String(item.id || ''),
          String(item.employeeId || ''),
          String(item.date || '').slice(0, 10),
          String(item.timeIn || ''),
          String(item.timeOut || ''),
          String(item.timeInAM || ''),
          String(item.timeOutAM || ''),
          String(item.timeInPM || ''),
          String(item.timeOutPM || ''),
          String(item.photoInAM || ''),
          String(item.photoOutAM || ''),
          String(item.photoInPM || ''),
          String(item.photoOutPM || ''),
          String(item.locationInAM || ''),
          String(item.locationOutAM || ''),
          String(item.locationInPM || ''),
          String(item.locationOutPM || ''),
          String(item.latInAM || ''),
          String(item.lngInAM || ''),
          String(item.latOutAM || ''),
          String(item.lngOutAM || ''),
          String(item.latInPM || ''),
          String(item.lngInPM || ''),
          String(item.latOutPM || ''),
          String(item.lngOutPM || ''),
          String(item.status || ''),
          String(item.latitude || ''),
          String(item.longitude || ''),
          String(item.location || ''),
          String(item.photo || '')
        ]
      );
    }

    for (const note of db.notifications) {
      await client.query(
        `INSERT INTO notifications (id, type, title, message, employee_id, created_at, read)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE
         SET type = EXCLUDED.type,
             title = EXCLUDED.title,
             message = EXCLUDED.message,
             employee_id = EXCLUDED.employee_id,
             created_at = EXCLUDED.created_at,
             read = EXCLUDED.read`,
        [
          String(note.id || ''),
          String(note.type || 'info'),
          String(note.title || 'Notification'),
          String(note.message || ''),
          String(note.employeeId || ''),
          String(note.createdAt || new Date().toISOString()),
          note.read === true
        ]
      );
    }

    for (const msg of db.messages) {
      await client.query(
        `INSERT INTO messages (id, employee_id, employee_name, office, subject, message, created_at, read)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE
         SET employee_id = EXCLUDED.employee_id,
             employee_name = EXCLUDED.employee_name,
             office = EXCLUDED.office,
             subject = EXCLUDED.subject,
             message = EXCLUDED.message,
             created_at = EXCLUDED.created_at,
             read = EXCLUDED.read`,
        [
          String(msg.id || ''),
          String(msg.employeeId || ''),
          String(msg.employeeName || ''),
          String(msg.office || ''),
          String(msg.subject || ''),
          String(msg.message || ''),
          String(msg.createdAt || new Date().toISOString()),
          msg.read === true
        ]
      );
    }

    for (const report of db.reports) {
      await client.query(
        `INSERT INTO reports
         (id, employee_id, employee_name, office, report_date, summary, attachment_name, attachment_data, attested_by, attested_position, created_at)
         VALUES
         ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE
         SET employee_id = EXCLUDED.employee_id,
             employee_name = EXCLUDED.employee_name,
             office = EXCLUDED.office,
             report_date = EXCLUDED.report_date,
             summary = EXCLUDED.summary,
             attachment_name = EXCLUDED.attachment_name,
             attachment_data = EXCLUDED.attachment_data,
             attested_by = EXCLUDED.attested_by,
             attested_position = EXCLUDED.attested_position,
             created_at = EXCLUDED.created_at`,
        [
          String(report.id || ''),
          String(report.employeeId || ''),
          String(report.employeeName || ''),
          String(report.office || ''),
          String(report.reportDate || '').slice(0, 10),
          String(report.summary || ''),
          String(report.attachmentName || ''),
          String(report.attachmentData || ''),
          String(report.attestedBy || ''),
          String(report.attestedPosition || ''),
          String(report.createdAt || new Date().toISOString())
        ]
      );
    }

    await client.query('COMMIT');
    console.log(
      `Migration complete: admins=${db.admins.length}, employees=${db.employees.length}, attendance=${db.attendance.length}, notifications=${db.notifications.length}, messages=${db.messages.length}, reports=${db.reports.length}`
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('Migration failed:', err && err.message ? err.message : err);
  process.exitCode = 1;
});
