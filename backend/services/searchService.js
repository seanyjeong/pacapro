/**
 * Search Service
 * 통합 검색 비즈니스 로직
 */

const db = require('../config/database');
const { decrypt } = require('../utils/encryption');

/**
 * 학생, 강사, 전화번호 통합 검색
 * @param {string} query - 검색어
 * @param {number} academyId - 학원 ID
 * @returns {Promise<{message: string, query: string, results: Array}>}
 */
async function search(query, academyId) {
    const searchQuery = query.trim().toLowerCase();

    // 학생 조회 (LIMIT으로 메모리 부하 제한)
    // NOTE: 암호화 필드는 SQL LIKE 불가 → 메모리 필터링 필수
    // 성능 개선: 최대 500명까지만 로드 (대부분의 학원은 이 이하)
    const [allStudents] = await db.query(
        `SELECT id, name, student_number, phone, parent_phone, school, status
        FROM students
        WHERE academy_id = ? AND deleted_at IS NULL
        ORDER BY status = 'active' DESC, id DESC
        LIMIT 500`,
        [academyId]
    );

    // 강사 조회 (LIMIT 적용)
    const [allInstructors] = await db.query(
        `SELECT id, name, phone, status
        FROM instructors
        WHERE academy_id = ? AND deleted_at IS NULL
        LIMIT 100`,
        [academyId]
    );

    // 복호화 및 필터링
    const students = allStudents
        .map(s => ({
            ...s,
            name: decrypt(s.name),
            phone: decrypt(s.phone),
            parent_phone: decrypt(s.parent_phone)
        }))
        .filter(s => {
            const name = (s.name || '').toLowerCase();
            const studentNumber = (s.student_number || '').toLowerCase();
            const phone = (s.phone || '').replace(/-/g, '');
            const parentPhone = (s.parent_phone || '').replace(/-/g, '');
            const queryClean = searchQuery.replace(/-/g, '');
            return name.includes(searchQuery) ||
                   studentNumber.includes(searchQuery) ||
                   phone.includes(queryClean) ||
                   parentPhone.includes(queryClean);
        })
        .slice(0, 10);

    const instructors = allInstructors
        .map(i => ({
            ...i,
            name: decrypt(i.name),
            phone: decrypt(i.phone)
        }))
        .filter(i => {
            const name = (i.name || '').toLowerCase();
            const phone = (i.phone || '').replace(/-/g, '');
            const queryClean = searchQuery.replace(/-/g, '');
            return name.includes(searchQuery) || phone.includes(queryClean);
        })
        .slice(0, 10);

    // 결과 합치기
    const results = [
        ...students.map(s => ({
            id: s.id,
            type: 'student',
            name: s.name,
            subtext: s.student_number ? `${s.student_number} · ${s.school || ''}` : s.school || '',
            phone: s.phone || s.parent_phone,
            status: s.status
        })),
        ...instructors.map(i => ({
            id: i.id,
            type: 'instructor',
            name: i.name,
            subtext: '강사',
            phone: i.phone,
            status: i.status
        }))
    ];

    return {
        message: `${results.length}건의 검색 결과`,
        query,
        results
    };
}

module.exports = { search };
