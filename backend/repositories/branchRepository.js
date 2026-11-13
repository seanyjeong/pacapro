const db = require('../config/database');

async function withTransaction(work) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const result = await work(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// 지점·반 목록과 학생 수 (student_count: 삭제 안 된 전체, active_count: 재원생)
async function findTree(academyId) {
    const [branches] = await db.query(
        'SELECT id, name, sort_order, status FROM branches WHERE academy_id = ? ORDER BY sort_order, id', [academyId]);
    const [classes] = await db.query(
        `SELECT c.id, c.branch_id, c.class_name, c.default_time_slot, c.class_days, c.instructor_id, i.name AS instructor_name,
                c.sort_order, c.status
         FROM classes c
         LEFT JOIN instructors i ON i.id = c.instructor_id AND i.academy_id = c.academy_id
         WHERE c.academy_id = ? AND c.branch_id IS NOT NULL ORDER BY c.sort_order, c.id`, [academyId]);
    const [counts] = await db.query(
        `SELECT branch_id, class_id, COUNT(*) AS student_count, SUM(status = 'active') AS active_count
         FROM students WHERE academy_id = ? AND deleted_at IS NULL GROUP BY branch_id, class_id`, [academyId]);
    return { branches, classes, counts };
}

async function findBranch(id, academyId, connection = db) {
    const [rows] = await connection.query('SELECT * FROM branches WHERE id = ? AND academy_id = ?', [id, academyId]);
    return rows[0] || null;
}

async function findBranchByName(academyId, name) {
    const [rows] = await db.query('SELECT id FROM branches WHERE academy_id = ? AND name = ?', [academyId, name]);
    return rows[0] || null;
}

async function insertBranch(academyId, name) {
    const [result] = await db.query(
        `INSERT INTO branches (academy_id, name, sort_order)
         SELECT ?, ?, COALESCE(MAX(sort_order), 0) + 1 FROM branches WHERE academy_id = ?`, [academyId, name, academyId]);
    return result.insertId;
}

async function updateBranch(id, academyId, fields) {
    await db.query('UPDATE branches SET name = ?, sort_order = ?, status = ? WHERE id = ? AND academy_id = ?',
        [fields.name, fields.sort_order, fields.status, id, academyId]);
}

async function branchUsage(id, academyId) {
    const [[row]] = await db.query(
        `SELECT (SELECT COUNT(*) FROM classes WHERE branch_id = ? AND academy_id = ?) AS classes,
                (SELECT COUNT(*) FROM students WHERE branch_id = ? AND academy_id = ? AND deleted_at IS NULL) AS students,
                (SELECT COUNT(*) FROM student_payments WHERE branch_id = ? AND academy_id = ?) AS payments`,
        [id, academyId, id, academyId, id, academyId]);
    return row;
}

async function deleteBranch(id, academyId) {
    // 지운 지점의 상담은 지점 없음으로 돌린다
    await db.query('UPDATE consultations SET branch_id = NULL WHERE branch_id = ? AND academy_id = ?', [id, academyId]);
    await db.query('DELETE FROM branches WHERE id = ? AND academy_id = ?', [id, academyId]);
}

async function findClass(id, academyId, connection = db) {
    const [rows] = await connection.query(
        'SELECT * FROM classes WHERE id = ? AND academy_id = ? AND branch_id IS NOT NULL', [id, academyId]);
    return rows[0] || null;
}

async function instructorExists(id, academyId) {
    const [rows] = await db.query('SELECT id FROM instructors WHERE id = ? AND academy_id = ?', [id, academyId]);
    return rows.length > 0;
}

async function findClassByName(academyId, branchId, className) {
    const [rows] = await db.query(
        'SELECT id FROM classes WHERE academy_id = ? AND branch_id = ? AND class_name = ?', [academyId, branchId, className]);
    return rows[0] || null;
}

async function insertClass(academyId, branchId, fields) {
    const [result] = await db.query(
        `INSERT INTO classes (academy_id, branch_id, class_name, default_time_slot, sort_order)
         SELECT ?, ?, ?, ?, COALESCE(MAX(sort_order), 0) + 1 FROM classes WHERE academy_id = ? AND branch_id = ?`,
        [academyId, branchId, fields.class_name, fields.default_time_slot, academyId, branchId]);
    return result.insertId;
}

// 지점이 바뀌는 학생의 지금까지 청구서에 옮기기 전 지점을 적어 둔다 — 지점별 매출·미납이 나중에 옮겨 가지 않게.
// 지점이 없던 학생은 적지 않는다(처음 배정될 때는 지난 청구서도 그 지점을 따른다).
async function keepPaymentBranch(connection, academyId, studentFilter, filterParams, nextBranchId) {
    await connection.query(
        `UPDATE student_payments
         SET branch_id = (SELECT s.branch_id FROM students s WHERE s.id = student_payments.student_id),
             updated_at = updated_at
         WHERE academy_id = ? AND branch_id IS NULL
         AND student_id IN (
             SELECT s.id FROM students s
             WHERE s.academy_id = ? AND s.branch_id IS NOT NULL AND (? IS NULL OR s.branch_id <> ?)
             AND ${studentFilter}
         )`,
        [academyId, academyId, nextBranchId, nextBranchId, ...filterParams]);
}

// 반이 다른 지점으로 가면 그 반 학생의 지점도 같이 옮긴다.
async function updateClass(connection, id, academyId, fields) {
    await connection.query(
        `UPDATE classes SET branch_id = ?, class_name = ?, default_time_slot = ?, class_days = ?, instructor_id = ?, sort_order = ?, status = ?
         WHERE id = ? AND academy_id = ?`,
        [fields.branch_id, fields.class_name, fields.default_time_slot,
            fields.class_days.length ? JSON.stringify(fields.class_days) : null, fields.instructor_id, fields.sort_order, fields.status, id, academyId]);
    await keepPaymentBranch(connection, academyId, 's.class_id = ?', [id], fields.branch_id);
    await connection.query('UPDATE students SET branch_id = ? WHERE class_id = ? AND academy_id = ?',
        [fields.branch_id, id, academyId]);
}

async function classStudentCount(id, academyId) {
    const [[row]] = await db.query(
        'SELECT COUNT(*) AS students FROM students WHERE class_id = ? AND academy_id = ? AND deleted_at IS NULL', [id, academyId]);
    return row.students;
}

async function deleteClass(id, academyId) {
    await db.query('DELETE FROM classes WHERE id = ? AND academy_id = ?', [id, academyId]);
}

async function assignStudents(academyId, studentIds, branchId, classId) {
    await keepPaymentBranch(db, academyId, `s.id IN (${studentIds.map(() => '?').join(',')})`, studentIds, branchId);
    const [result] = await db.query(
        `UPDATE students SET branch_id = ?, class_id = ?
         WHERE academy_id = ? AND deleted_at IS NULL AND id IN (${studentIds.map(() => '?').join(',')})`,
        [branchId, classId, academyId, ...studentIds]);
    return result.affectedRows;
}

module.exports = {
    withTransaction, findTree, findBranch, findBranchByName, insertBranch, updateBranch, branchUsage, deleteBranch,
    findClass, instructorExists, findClassByName, insertClass, updateClass, classStudentCount, deleteClass, assignStudents
};
