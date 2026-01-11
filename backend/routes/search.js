/**
 * Search Routes
 * 통합 검색 API
 * NOTE: 암호화된 필드는 SQL LIKE 검색 불가 → 메모리 필터링 사용
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

/**
 * GET /paca/search
 * 학생, 강사, 전화번호 통합 검색
 * Access: 로그인 사용자
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length < 1) {
            return res.json({
                message: '검색어를 입력해주세요.',
                results: []
            });
        }

        const searchQuery = q.trim().toLowerCase();
        const academyId = req.user.academyId;

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

        res.json({
            message: `${results.length}건의 검색 결과`,
            query: q,
            results
        });
    } catch (error) {
        logger.error('Search error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '검색에 실패했습니다.'
        });
    }
});

module.exports = router;
