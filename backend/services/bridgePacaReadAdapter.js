const crypto = require('crypto');
const http = require('http');
const { URL } = require('url');

const MINIMUM_KEY_BYTES = 32;

function isLoopbackAddress(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}
function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}

function loadPacaTenants(env = process.env) {
  return {
    ilsan: { academyId: Number(env.PACA_BRIDGE_academyId || 2), key: String(env.PACA_BRIDGE_ILSAN_READ_KEY || ''), label: 'ilsan' },
    bucheon: { academyId: Number(env.PACA_BRIDGE_BUCHEON_ACADEMY_ID || 51), key: String(env.PACA_BRIDGE_BUCHEON_READ_KEY || ''), label: 'bucheon' },
  };
}
function parsePacaPath(pathname) {
  const m = String(pathname || '').match(/^\/v1\/paca\/([a-z][a-z0-9_-]{0,31})\/?(.*)$/);
  if (!m) return null;
  return { slug: m[1], route: String(m[2] || '').replace(/\/+$/, '') };
}

function configuredKey(env = process.env) {
  const key = String(env.PACA_BRIDGE_ILSAN_READ_KEY || '');
  return Buffer.byteLength(key, 'utf8') >= MINIMUM_KEY_BYTES ? key : null;
}
function respond(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}
function audit(logger, action, outcome, status, meta = {}) {
  logger?.info?.('[PacaBridgeReadAdapter]', {
    academy: meta.academy, academyId: meta.academyId, action, outcome, status,
  });
}
function normalizeCounts(rows, field = 'status') {
  return rows.reduce((counts, row) => {
    const status = typeof row[field] === 'string' && row[field].length <= 32 ? row[field] : 'unknown';
    const count = Number(row.count);
    counts[status] = Number.isSafeInteger(count) && count >= 0 ? count : 0;
    return counts;
  }, {});
}
function safeText(value, max = 40) {
  const s = String(value || '').trim();
  if (!s || s.length > max) return null;
  if (!/^[\w가-힣 .·+\/-]{1,80}$/u.test(s)) return null;
  return s;
}
function normName(value) {
  return String(value || '').replace(/\s+/g, '');
}
function mapGender(value) {
  const g = String(value || '').trim().toUpperCase();
  if (!g) return null;
  if (g === 'M' || g === 'MALE' || g.startsWith('남')) return 'M';
  if (g === 'F' || g === 'FEMALE' || g.startsWith('여')) return 'F';
  // paca stores male/female sometimes
  if (g === 'MALE') return 'M';
  return null;
}
function publicGender(value) {
  const g = String(value || '');
  if (g === 'male' || g === 'M' || g.startsWith('남')) return 'M';
  if (g === 'female' || g === 'F' || g.startsWith('여')) return 'F';
  return value || null;
}
function decryptRows(rows) {
  try {
    const { decrypt } = require('../utils/encryption');
    return rows.map((r) => {
      const out = { ...r };
      for (const key of ['name', 'school']) {
        if (out[key]) {
          try { out[key] = decrypt(out[key]); } catch (_) {}
        }
      }
      if (out.gender === 'male') out.gender = 'M';
      else if (out.gender === 'female') out.gender = 'F';
      return out;
    });
  } catch (_) {
    return rows;
  }
}
function publicStudent(row) {
  return {
    id: row.id,
    name: row.name || null,
    gender: publicGender(row.gender),
    school: row.school || null,
    grade: row.grade ?? null,
    status: row.status || null,
    class_days: row.class_days || null,
    time_slot: row.time_slot || null,
  };
}

async function loadStudents(db, { status = null, academyId } = {}) {
  let sql = `
    SELECT id, name, gender, school, grade, status, class_days, time_slot, enrollment_date
      FROM students
     WHERE academy_id = ? AND deleted_at IS NULL`;
  const params = [academyId];
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  const [rows] = await db.execute(sql, params);
  return decryptRows(rows);
}

function resolveStudents(all, q) {
  const name = safeText(q.name, 40);
  const school = safeText(q.school, 80);
  const grade = safeText(q.grade, 20);
  const gender = mapGender(q.gender);
  const status = safeText(q.status, 32);
  const id = q.id != null && String(q.id).trim() !== '' ? Number(q.id) : null;

  let rows = all.slice();
  if (Number.isFinite(id)) {
    rows = rows.filter((r) => Number(r.id) === id);
  } else {
    if (!name) return { status: 'error', error: 'name_or_id_required' };
    rows = rows.filter((r) => normName(r.name) === normName(name));
    if (school) rows = rows.filter((r) => String(r.school || '').includes(school) || normName(r.school) === normName(school));
    if (grade) rows = rows.filter((r) => String(r.grade || '') === grade);
    if (gender) {
      rows = rows.filter((r) => publicGender(r.gender) === gender || r.gender === gender);
    }
    if (status) rows = rows.filter((r) => r.status === status);
  }
  if (!rows.length) return { status: 'not_found', candidates: [] };
  if (rows.length > 1) {
    return {
      status: 'ambiguous',
      count: rows.length,
      candidates: rows.slice(0, 20).map(publicStudent),
    };
  }
  return { status: 'resolved', student: rows[0] };
}

function createPacaBridgeReadHandler({ db, env = process.env, logger = console } = {}) {
  if (!db?.execute) throw new Error('Paca Bridge adapter requires a database execute function');
  return async function handler(req, res) {
    if (!isLoopbackAddress(req.socket?.remoteAddress)) {
      audit(logger, 'any', 'non_loopback_denied', 403);
      return respond(res, 403, { ok: false, error: 'loopback_only' });
    }
    if (req.method !== 'GET') {
      audit(logger, 'any', 'method_denied', 405);
      return respond(res, 405, { ok: false, error: 'read_only' });
    }
    // multi-tenant: credential checked against path slug key below
    let url;
    try { url = new URL(req.url || '/', 'http://127.0.0.1'); }
    catch { return respond(res, 404, { ok: false, error: 'not_found' }); }
    const path = url.pathname;
    const parsedPath = parsePacaPath(path);
    if (!parsedPath) {
      return respond(res, 404, { ok: false, error: 'not_found' });
    }
    const tenants = loadPacaTenants(env);
    const tenant = tenants[parsedPath.slug];
    if (!tenant || !tenant.key || Buffer.byteLength(tenant.key) < 32) {
      return respond(res, 404, { ok: false, error: 'not_found' });
    }
    const academyId = tenant.academyId;
    const academy = tenant.label;
    const provided = req.headers?.['x-academy-bridge-adapter-key'];
    if (!provided || !safeEqual(provided, tenant.key)) {
      return respond(res, 401, { ok: false, error: 'invalid_service_credential' });
    }
    const route = parsedPath.route;
    const q = Object.fromEntries(url.searchParams.entries());

    try {
      if (route === 'summary') {
        const [studentStatusRows] = await db.execute(
          `SELECT status, COUNT(*) AS count FROM students WHERE academy_id = ? AND deleted_at IS NULL GROUP BY status`,
          [academyId],
        );
        const [attendanceStatusRows] = await db.execute(
          `SELECT a.attendance_status, COUNT(*) AS count
             FROM attendance a
             JOIN class_schedules cs ON cs.id = a.class_schedule_id
            WHERE cs.academy_id = ?
              AND cs.class_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
              AND cs.class_date < DATE_ADD(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
            GROUP BY a.attendance_status`,
          [academyId],
        );
        const byStatus = normalizeCounts(studentStatusRows, 'status');
        const studentTotal = Object.values(byStatus).reduce((t, c) => t + c, 0);
        audit(logger, 'summary', 'ok', 200);
        return respond(res, 200, {
          ok: true, source: 'paca', academy, readOnly: true,
          dto: {
            students: { total: studentTotal, byStatus },
            attendanceCurrentMonth: { byStatus: normalizeCounts(attendanceStatusRows, 'attendance_status') },
          },
        });
      }

      if (route === 'students') {
        const status = safeText(q.status, 32) || 'active';
        const gender = mapGender(q.gender);
        const school = safeText(q.school, 80);
        const grade = safeText(q.grade, 20);
        let rows = await loadStudents(db, { status });
        if (gender) rows = rows.filter((r) => publicGender(r.gender) === gender);
        if (school) rows = rows.filter((r) => String(r.school || '').includes(school));
        if (grade) rows = rows.filter((r) => String(r.grade || '') === grade);
        const students = rows.slice(0, 500).map(publicStudent);
        audit(logger, 'students', 'ok', 200);
        return respond(res, 200, {
          ok: true, source: 'paca', academy, readOnly: true,
          dto: { status, count: students.length, students },
        });
      }

      if (route === 'payments-summary') {
        let byStatus = {};
        let source = 'students.payment_status';
        try {
          const [rows] = await db.execute(
            `SELECT payment_status AS status, COUNT(*) AS count
               FROM students WHERE academy_id = ? AND deleted_at IS NULL GROUP BY payment_status`,
            [academyId],
          );
          byStatus = normalizeCounts(rows, 'status');
        } catch (e) {
          const [rows] = await db.execute(
            `SELECT payment_status AS status, COUNT(*) AS count
               FROM student_payments WHERE academy_id = ? GROUP BY payment_status`,
            [academyId],
          );
          byStatus = normalizeCounts(rows, 'status');
          source = 'student_payments.payment_status';
        }
        audit(logger, 'payments-summary', 'ok', 200);
        return respond(res, 200, {
          ok: true, source: 'paca', academy, readOnly: true,
          dto: { source, byStatus, total: Object.values(byStatus).reduce((a, b) => a + b, 0) },
        });
      }

      if (route === 'attendance') {
        // academy-level aggregate (legacy)
        const days = Math.min(31, Math.max(1, parseInt(q.days || '7', 10) || 7));
        const [rows] = await db.execute(
          `SELECT a.attendance_status AS status, COUNT(*) AS count
             FROM attendance a
             JOIN class_schedules cs ON cs.id = a.class_schedule_id
            WHERE cs.academy_id = ?
              AND cs.class_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
            GROUP BY a.attendance_status`,
          [academyId, days],
        );
        audit(logger, 'attendance', 'ok', 200);
        return respond(res, 200, {
          ok: true, source: 'paca', academy, readOnly: true,
          dto: { grain: 'academy_aggregate', days, byStatus: normalizeCounts(rows, 'status') },
        });
      }

      if (route === 'student-lookup' || route === 'resolve-student') {
        const statusDefault = safeText(q.status, 32) || 'active';
        let all = await loadStudents(db, { status: statusDefault, academyId });
        let resolved = resolveStudents(all, q);
        if (resolved.status === 'not_found' && !url.searchParams.has('status')) {
          all = await loadStudents(db, { status: null, academyId });
          resolved = resolveStudents(all, { ...q, status: null });
        }
        if (resolved.status === 'error') return respond(res, 400, { ok: false, error: resolved.error });
        if (resolved.status === 'not_found') {
          return respond(res, 404, { ok: false, error: 'student_not_found' });
        }
        if (resolved.status === 'ambiguous') {
          return respond(res, 409, {
            ok: false, error: 'student_ambiguous', count: resolved.count, candidates: resolved.candidates,
          });
        }
        audit(logger, route, 'ok', 200);
        return respond(res, 200, {
          ok: true, source: 'paca', academy, readOnly: true,
          dto: { student: publicStudent(resolved.student) },
        });
      }

      if (route === 'student-attendance') {
        // personal monthly daily attendance
        const yearMonth = safeText(q.year_month || q.month, 7);
        if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
          return respond(res, 400, { ok: false, error: 'year_month_required', hint: 'YYYY-MM' });
        }
        if (!q.status) q.status = 'active';
        let all = await loadStudents(db, { status: q.status === 'all' ? null : q.status, academyId });
        let resolved = resolveStudents(all, q.status === 'all' ? { ...q, status: null } : q);
        if (resolved.status === 'not_found' && q.status === 'active' && !url.searchParams.has('status')) {
          all = await loadStudents(db, { status: null, academyId });
          resolved = resolveStudents(all, { ...q, status: null });
        }
        if (resolved.status === 'error') return respond(res, 400, { ok: false, error: resolved.error });
        if (resolved.status === 'not_found') return respond(res, 404, { ok: false, error: 'student_not_found' });
        if (resolved.status === 'ambiguous') {
          return respond(res, 409, {
            ok: false, error: 'student_ambiguous', count: resolved.count, candidates: resolved.candidates,
          });
        }
        const student = resolved.student;
        const [year, month] = yearMonth.split('-');
        const startDate = `${year}-${month}-01`;
        const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
        const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
        let effectiveStart = startDate;
        if (student.enrollment_date) {
          const enroll = new Date(student.enrollment_date).toISOString().slice(0, 10);
          if (enroll > startDate) effectiveStart = enroll;
        }
        const [records] = await db.execute(
          `SELECT cs.class_date AS date, cs.time_slot, a.attendance_status, a.is_makeup, a.notes
             FROM attendance a
             JOIN class_schedules cs ON a.class_schedule_id = cs.id
            WHERE a.student_id = ?
              AND cs.class_date >= ?
              AND cs.class_date <= ?
              AND cs.academy_id = ?
            ORDER BY cs.class_date, FIELD(cs.time_slot, 'morning', 'afternoon', 'evening')`,
          [student.id, effectiveStart, endDate, academyId],
        );
        const summary = { total: records.length, present: 0, absent: 0, late: 0, excused: 0, unknown: 0, makeup: 0 };
        const days = records.map((r) => {
          const status = r.attendance_status || 'unknown';
          if (summary[status] != null) summary[status] += 1;
          else summary.unknown += 1;
          if (r.is_makeup) summary.makeup += 1;
          const date = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).split('T')[0];
          return {
            date,
            time_slot: r.time_slot || null,
            attendance_status: status,
            is_makeup: !!r.is_makeup,
            notes: r.notes || null,
          };
        });
        summary.attendance_rate = summary.total > 0
          ? Number((((summary.present || 0) / summary.total) * 100).toFixed(1))
          : 0;
        audit(logger, 'student-attendance', 'ok', 200);
        return respond(res, 200, {
          ok: true, source: 'paca', academy, readOnly: true,
          dto: {
            grain: 'student_daily',
            student: publicStudent(student),
            year_month: yearMonth,
            date_from: effectiveStart,
            date_to: endDate,
            summary,
            days,
          },
        });
      }

      audit(logger, route, 'path_denied', 404);
      return respond(res, 404, {
        ok: false, error: 'not_found',
        allowed: [
          'summary', 'students', 'payments-summary', 'attendance',
          'student-lookup', 'resolve-student', 'student-attendance',
        ],
      });
    } catch (error) {
      logger?.error?.('[PacaBridgeReadAdapter] query failed', { message: error.message, route });
      audit(logger, route || 'any', 'query_failed', 503);
      return respond(res, 503, { ok: false, error: 'source_temporarily_unavailable', message: error.message });
    }
  };
}

function startPacaBridgeReadAdapter({ db, env = process.env, logger = console } = {}) {
  const tenantsBoot = loadPacaTenants(env);
  if (!Object.values(tenantsBoot).some((x) => x.key && Buffer.byteLength(x.key) >= 32)) {
    throw new Error('PACA bridge keys missing');
  }
  const port = Number(env.PACA_BRIDGE_READ_PORT || env.PACA_BRIDGE_ILSAN_READ_PORT || 8790);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error('PACA_BRIDGE_READ_PORT must be a non-privileged TCP port');
  }
  const server = http.createServer(createPacaBridgeReadHandler({ db, env, logger }));
  server.listen(port, '127.0.0.1', () => {
    logger?.info?.(`[PacaBridgeReadAdapter] listening on 127.0.0.1:${port}`);
  });
  return server;
}

module.exports = {
  loadPacaTenants,
  createPacaBridgeReadHandler,
  isLoopbackAddress,
  startPacaBridgeReadAdapter,
};
