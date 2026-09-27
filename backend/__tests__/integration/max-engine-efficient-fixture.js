/** Disposable loopback MySQL only. Metadata mirrors the source schema; all rows are synthetic. */
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const schema = require('./max-engine-schema.json');
const catalog = require('../../constants/maxEngineReadCatalog.json');
async function fixture() {
  const port = Number(process.env.TEST_MYSQL_PORT);
  if (process.env.RUN_MAX_ENGINE_MYSQL !== '1' || !Number.isInteger(port) || port < 10000) throw new Error('Isolated MySQL required');
  const opts = { host: '127.0.0.1', port, user: 'root', password: '', dateStrings: true };
  const admin = await mysql.createConnection(opts), pools = {};
  for (const provider of ['paca', 'peak']) {
    const database = 'max_engine_eff_test_' + provider;
    await admin.query(`CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4`);
    for (const [key, columns] of Object.entries(schema).filter(([k]) => k.startsWith(provider + '.') && catalog[k])) {
      const name = key.split('.')[1];
      await admin.query(`DROP TABLE IF EXISTS ${database}.\`${name}\``);
      const defs = columns.map(([col, type, nullable, index]) => `\`${col}\` ${type} ${col === 'id' ? 'NOT NULL AUTO_INCREMENT PRIMARY KEY' : index === 'PRI' ? 'NOT NULL PRIMARY KEY' : nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
      await admin.query(`CREATE TABLE ${database}.\`${name}\` (${defs.join(',')}) ENGINE=InnoDB`);
    }
    pools[provider] = mysql.createPool({ ...opts, database });
  }
  await admin.end();
  process.env.MAX_ENGINE_LINK_SECRET = crypto.randomBytes(48).toString('hex');
  process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  const { encrypt } = require('../../services/maxEngineFullSecurity');
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const earlier = new Date(date); earlier.setUTCDate(earlier.getUTCDate() - 7);
  const start = earlier.toISOString().slice(0, 10), month = date.slice(0, 7);
  async function insert(provider, table, values) {
    const result = { ...values };
    for (const [col, type, nullable] of schema[`${provider}.${table}`]) {
      if (col === 'id' || Object.hasOwn(result, col) || nullable !== 'NO') continue;
      result[col] = type.startsWith('enum(') ? type.match(/'([^']+)'/)[1] : type === 'json' ? '[]' : /date|timestamp/.test(type) ? date : /int|decimal|tinyint/.test(type) ? 0 : 'synthetic';
    }
    const keys = Object.keys(result);
    return pools[provider].execute(`INSERT INTO \`${table}\` (${keys.map(k => `\`${k}\``).join(',')}) VALUES (${keys.map(() => '?').join(',')})`, Object.values(result));
  }
  const hash = require('bcryptjs').hashSync('synthetic', 4);
  for (const id of [1, 2]) {
    await insert('paca', 'academies', { id, owner_user_id: id, name: `Synthetic ${id}` });
    await insert('paca', 'users', { id, name: 'Synthetic', email: `${id === 1 ? 'a' : 'b'}@example.invalid`, password_hash: hash, role: 'owner', academy_id: id, is_active: 1, approval_status: 'approved' });
  }
  await insert('paca', 'academy_settings', { id: 1, academy_id: 1, morning_class_time: '09:30-12:00', afternoon_class_time: '14:00-18:00', evening_class_time: '18:30-21:00' });
  await insert('paca', 'classes', { id: 1, academy_id: 1, class_name: '합성 수업' });
  await insert('paca', 'instructors', { id: 1, academy_id: 1, name: encrypt('합성강사') });
  for (const [id, slot] of [[1, 'afternoon'], [2, 'morning'], [3, 'evening']]) await insert('paca', 'class_schedules', { id, academy_id: 1, class_id: 1, instructor_id: 1, class_date: date, time_slot: slot });
  for (let id = 1; id <= 8; id++) {
    const name = `합성${String(id).padStart(2, '0')}`;
    await insert('paca', 'students', { id, academy_id: 1, name: encrypt(name), phone: encrypt(`0100000${String(id).padStart(4, '0')}`), school: '합성고', grade: '고3', gender: id % 2 ? 'male' : 'female', status: id === 8 ? 'trial' : 'active', is_trial: id === 8 ? 1 : 0, trial_remaining: id === 8 ? 2 : 0, trial_dates: '[]' });
    await insert('paca', 'attendance', { id, class_schedule_id: 1, student_id: id, attendance_status: id === 2 ? 'absent' : id === 3 ? null : 'present' });
    await insert('paca', 'student_payments', { id, student_id: id, academy_id: 1, year_month: month, final_amount: '100.10', paid_amount: id <= 2 ? '20.05' : '0', payment_status: id <= 2 ? 'partial' : 'pending', due_date: date });
    await insert('peak', 'students', { id, academy_id: 1, paca_student_id: id, name: encrypt(name), school: '합성고', grade: '고3', gender: id % 2 ? 'M' : 'F', status: id === 8 ? 'trial' : 'active' });
  }
  for (const id of [50, 51, 90]) await insert('paca', 'students', { id, academy_id: id === 90 ? 2 : 1, name: encrypt(id === 90 ? '외부학생' : '동명이인'), grade: '고2', status: 'active' });
  await insert('paca', 'student_payments', { id: 90, student_id: 90, academy_id: 1, year_month: month, final_amount: '999.99', paid_amount: 0, payment_status: 'pending' });
  await insert('paca', 'student_payments', { id: 91, student_id: 1, academy_id: 1, year_month: month, final_amount: '999.99', paid_amount: 0, payment_status: 'cancelled' });
  await insert('paca', 'attendance', { id: 90, class_schedule_id: 1, student_id: 90, attendance_status: 'present' });
  await insert('paca', 'student_classes', { id: 1, academy_id: 1, student_id: 1, class_id: 1, status: 'active', assigned_date: start });
  await insert('paca', 'student_consultations', { id: 1, academy_id: 1, student_id: 1, consultation_date: date, general_memo: '합성 상담' });
  await insert('paca', 'consultations', { id: 1, academy_id: 1, linked_student_id: 1, preferred_date: date, preferred_time: '14:00', status: 'pending' });
  await insert('paca', 'consultations', { id: 90, academy_id: 1, linked_student_id: 90, preferred_date: date, preferred_time: '14:00', student_name: '외부캐시', status: 'pending' });
  for (const [id, name, unit, direction] of [[1, '제자리멀리뛰기', 'cm', 'higher'], [2, '100m', 'sec', 'lower']]) await insert('peak', 'record_types', { id, academy_id: 1, name, unit, direction });
  for (let id = 1; id <= 8; id++) {
    for (const [offset, type, measured, value] of [[0, 1, start, 200], [10, 1, date, 250 + Math.floor(id / 2)], [20, 2, start, 15], [30, 2, date, 14 - id / 10]]) {
      await insert('peak', 'student_records', { id: id + offset, academy_id: 1, student_id: id, record_type_id: type, measured_at: measured, value });
    }
  }
  await insert('peak', 'students', { id: 90, academy_id: 1, paca_student_id: 90, name: '외부캐시' });
  await insert('peak', 'student_records', { id: 90, academy_id: 1, student_id: 90, record_type_id: 1, measured_at: date, value: 999 });
  return { ...pools, date, start, month, insert, encrypt, async close() { await Promise.all(Object.values(pools).map(p => p.end())); } };
}
module.exports = { fixture };
