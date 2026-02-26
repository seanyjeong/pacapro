/**
 * Income Service
 * 기타수입 비즈니스 로직
 */

const db = require('../config/database');
const { decrypt } = require('../utils/encryption');

function decryptNames(obj) {
    if (!obj) return obj;
    if (obj.student_name) obj.student_name = decrypt(obj.student_name);
    if (obj.recorded_by_name) obj.recorded_by_name = decrypt(obj.recorded_by_name);
    return obj;
}

function decryptIncomeArray(arr) {
    return arr.map(item => decryptNames({...item}));
}

const CATEGORY_LABELS = {
    clothing: '의류',
    shoes: '신발',
    equipment: '용품',
    beverage: '음료',
    snack: '간식',
    other: '기타'
};

const VALID_CATEGORIES = Object.keys(CATEGORY_LABELS);

/**
 * 기타수입 목록 조회 (필터 지원)
 */
async function getIncomes(academyId, filters) {
    const { category, student_id, start_date, end_date, payment_method } = filters;

    let query = `
        SELECT
            i.id, i.income_date, i.category, i.amount, i.description,
            i.student_id, s.name as student_name, i.payment_method,
            i.notes, i.recorded_by, u.name as recorded_by_name, i.created_at
        FROM other_incomes i
        LEFT JOIN students s ON i.student_id = s.id
        LEFT JOIN users u ON i.recorded_by = u.id
        WHERE i.academy_id = ?
    `;
    const params = [academyId];

    if (category) { query += ' AND i.category = ?'; params.push(category); }
    if (student_id) { query += ' AND i.student_id = ?'; params.push(parseInt(student_id)); }
    if (start_date) { query += ' AND i.income_date >= ?'; params.push(start_date); }
    if (end_date) { query += ' AND i.income_date <= ?'; params.push(end_date); }
    if (payment_method) { query += ' AND i.payment_method = ?'; params.push(payment_method); }

    query += ' ORDER BY i.income_date DESC, i.created_at DESC';

    const [incomes] = await db.query(query, params);
    const totalAmount = incomes.reduce((sum, income) => sum + parseFloat(income.amount), 0);

    return {
        message: `Found ${incomes.length} income records`,
        total_amount: totalAmount,
        incomes: decryptIncomeArray(incomes)
    };
}

/**
 * 기타수입 상세 조회
 */
async function getIncomeById(incomeId, academyId) {
    const [incomes] = await db.query(
        `SELECT i.*, s.name as student_name, u.name as recorded_by_name
        FROM other_incomes i
        LEFT JOIN students s ON i.student_id = s.id
        LEFT JOIN users u ON i.recorded_by = u.id
        WHERE i.id = ? AND i.academy_id = ?`,
        [incomeId, academyId]
    );

    if (incomes.length === 0) return null;
    return decryptNames({...incomes[0]});
}

/**
 * 기타수입 등록
 */
async function createIncome(academyId, userId, body) {
    const { income_date, category, amount, description, student_id, payment_method, notes } = body;

    if (!income_date || !amount) {
        return { status: 400, error: 'Validation Error', message: '필수 항목을 모두 입력해주세요. (날짜, 금액)' };
    }
    if (parseFloat(amount) <= 0) {
        return { status: 400, error: 'Validation Error', message: '금액은 0원보다 커야 합니다.' };
    }
    if (category && !VALID_CATEGORIES.includes(category)) {
        return { status: 400, error: 'Validation Error', message: '유효하지 않은 카테고리입니다.' };
    }

    if (student_id) {
        const [students] = await db.query(
            'SELECT id FROM students WHERE id = ? AND academy_id = ?',
            [student_id, academyId]
        );
        if (students.length === 0) {
            return { status: 400, error: 'Validation Error', message: '학생을 찾을 수 없습니다.' };
        }
    }

    const [result] = await db.query(
        `INSERT INTO other_incomes
        (academy_id, income_date, category, amount, description, student_id, payment_method, notes, recorded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [academyId, income_date, category || 'other', amount, description || null, student_id || null, payment_method || 'cash', notes || null, userId]
    );

    const [newIncome] = await db.query(
        `SELECT i.*, s.name as student_name, u.name as recorded_by_name
        FROM other_incomes i
        LEFT JOIN students s ON i.student_id = s.id
        LEFT JOIN users u ON i.recorded_by = u.id
        WHERE i.id = ?`,
        [result.insertId]
    );

    return { status: 201, message: '기타수입이 등록되었습니다.', income: decryptNames({...newIncome[0]}) };
}

/**
 * 기타수입 수정
 */
async function updateIncome(incomeId, academyId, body) {
    const [existing] = await db.query(
        'SELECT id FROM other_incomes WHERE id = ? AND academy_id = ?',
        [incomeId, academyId]
    );
    if (existing.length === 0) {
        return { status: 404, error: 'Not Found', message: '기타수입 내역을 찾을 수 없습니다.' };
    }

    const { income_date, category, amount, description, student_id, payment_method, notes } = body;

    const updates = [];
    const params = [];

    if (income_date !== undefined) { updates.push('income_date = ?'); params.push(income_date); }
    if (category !== undefined) { updates.push('category = ?'); params.push(category); }
    if (amount !== undefined) {
        if (parseFloat(amount) <= 0) {
            return { status: 400, error: 'Validation Error', message: '금액은 0원보다 커야 합니다.' };
        }
        updates.push('amount = ?'); params.push(amount);
    }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (student_id !== undefined) { updates.push('student_id = ?'); params.push(student_id || null); }
    if (payment_method !== undefined) { updates.push('payment_method = ?'); params.push(payment_method); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

    if (updates.length === 0) {
        return { status: 400, error: 'Validation Error', message: '수정할 항목이 없습니다.' };
    }

    params.push(incomeId);
    await db.query(`UPDATE other_incomes SET ${updates.join(', ')} WHERE id = ?`, params);

    const [updated] = await db.query(
        `SELECT i.*, s.name as student_name, u.name as recorded_by_name
        FROM other_incomes i
        LEFT JOIN students s ON i.student_id = s.id
        LEFT JOIN users u ON i.recorded_by = u.id
        WHERE i.id = ?`,
        [incomeId]
    );

    return { status: 200, message: '기타수입 내역이 수정되었습니다.', income: decryptNames({...updated[0]}) };
}

/**
 * 기타수입 삭제
 */
async function deleteIncome(incomeId, academyId) {
    const [existing] = await db.query(
        'SELECT id FROM other_incomes WHERE id = ? AND academy_id = ?',
        [incomeId, academyId]
    );
    if (existing.length === 0) {
        return { status: 404, error: 'Not Found', message: '기타수입 내역을 찾을 수 없습니다.' };
    }

    await db.query('DELETE FROM other_incomes WHERE id = ?', [incomeId]);
    return { status: 200, message: '기타수입 내역이 삭제되었습니다.' };
}

module.exports = { CATEGORY_LABELS, getIncomes, getIncomeById, createIncome, updateIncome, deleteIncome };
