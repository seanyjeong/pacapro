/**
 * 정시엔진 연동 API
 * P-ACA 학생과 정시엔진 학생 매칭 + 수능 성적 조회
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { verifyToken, requireRole } = require('../middleware/auth');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');

// 정시엔진 API 설정
// - vultr 9090 포트는 외부 차단됨. Caddy 통해 https://supermax.kr/jungsi/* 로만 접근 가능
// - JWT secret이 P-ACA와 다름 (옵션 B-2: 정시엔진 secret으로 서버-서버용 토큰 발급)
const JUNGSI_API_BASE = process.env.JUNGSI_API_BASE || 'https://supermax.kr';
const JUNGSI_JWT_SECRET = process.env.JUNGSI_JWT_SECRET || 'super-secret-key!!';

// P-ACA academy_id → 정시엔진 branch_name 매핑
const ACADEMY_BRANCH_MAP = {
    2: '일산'  // academy_id=2 → 일산지점
    // 추가 지점 매핑 시 여기에 추가
};

// 사용 가능한 시험 유형 (모형)
const EXAM_TYPES = ['3월', '6월', '9월', '수능'];

// 현재 시점 기준 기본 시험 유형 결정
function getDefaultExam() {
    const month = new Date().getMonth() + 1; // 1-12
    if (month >= 11) return '수능';      // 11월 이후: 수능
    if (month >= 9) return '9월';        // 9-10월: 9월 모평
    if (month >= 6) return '6월';        // 6-8월: 6월 모평
    return '3월';                        // 1-5월: 3월 모평
}

/**
 * 정시엔진용 서비스 토큰 생성
 */
function generateJungsiToken(branchName) {
    return jwt.sign(
        {
            userid: 'paca_service',
            branch: branchName,
            role: 'admin',
            service: 'paca'
        },
        JUNGSI_JWT_SECRET,
        { expiresIn: '1h' }
    );
}

/**
 * 학교명 정규화 함수
 * "행신고등학교" → "행신고"
 * "일산대진고" → "일산대진고"
 */
function normalizeSchoolName(name) {
    if (!name) return '';
    return name
        .replace(/고등학교$/g, '고')
        .replace(/중학교$/g, '중')
        .replace(/초등학교$/g, '초')
        .trim();
}

/**
 * 학생 매칭 함수
 * P-ACA 학생과 정시엔진 학생을 이름+학교+학년으로 매칭
 */
function matchStudents(pacaStudent, jungsiStudents) {
    const pacaName = pacaStudent.name;
    const pacaSchool = normalizeSchoolName(pacaStudent.school);
    const pacaGrade = pacaStudent.grade;

    // 1차: 이름 + 정규화된 학교명 + 학년 완전 일치
    let match = jungsiStudents.find(j => {
        const jungsiSchool = normalizeSchoolName(j.school_name);
        return j.student_name === pacaName &&
               jungsiSchool === pacaSchool &&
               j.grade === pacaGrade;
    });

    if (match) return { match, confidence: 'high', method: 'name+school+grade' };

    // 2차: 이름 + 정규화된 학교명 (학년 무시)
    match = jungsiStudents.find(j => {
        const jungsiSchool = normalizeSchoolName(j.school_name);
        return j.student_name === pacaName && jungsiSchool === pacaSchool;
    });

    if (match) return { match, confidence: 'medium', method: 'name+school' };

    // 3차: 이름만 (동명이인 주의)
    const nameMatches = jungsiStudents.filter(j => j.student_name === pacaName);
    if (nameMatches.length === 1) {
        return { match: nameMatches[0], confidence: 'low', method: 'name_only' };
    }

    return { match: null, confidence: 'none', method: null };
}

/**
 * 정시엔진 API 호출 (내부용)
 */
async function fetchJungsiStudents(branchName, year = '2027', exam = null) {
    // exam이 없으면 현재 시점 기준 기본값 사용
    const examType = exam || getDefaultExam();
    try {
        // 정시엔진용 서비스 토큰 생성
        const token = generateJungsiToken(branchName);

        const response = await axios.get(`${JUNGSI_API_BASE}/jungsi/students/list-by-branch`, {
            params: { year, exam: examType },
            headers: {
                'Authorization': `Bearer ${token}`,
                'X-Internal-Service': 'paca'
            },
            timeout: 10000
        });

        if (response.data.success) {
            return response.data.students || [];
        }
        return [];
    } catch (error) {
        logger.error('[Jungsi] API 호출 실패:', error.message);
        return [];
    }
}

/**
 * GET /paca/jungsi/scores/:studentId
 * 특정 학생의 정시엔진 수능 성적 조회
 */
router.get('/scores/:studentId', verifyToken, async (req, res) => {
    try {
        const studentId = parseInt(req.params.studentId);
        const { year = '2027' } = req.query;
        const exam = req.query.exam || getDefaultExam(); // 3월/6월/9월/수능

        // 1. P-ACA 학생 정보 조회
        const [students] = await db.query(
            `SELECT id, name, school, grade, academy_id
             FROM students
             WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                success: false,
                message: '학생을 찾을 수 없습니다.'
            });
        }

        const student = students[0];
        const decryptedName = decrypt(student.name) || student.name;

        // 2. academy_id → branch_name 매핑
        const branchName = ACADEMY_BRANCH_MAP[student.academy_id];
        if (!branchName) {
            return res.status(400).json({
                success: false,
                message: '해당 학원은 정시엔진 연동이 설정되지 않았습니다.',
                academyId: student.academy_id
            });
        }

        // 3. 정시엔진에서 해당 지점 학생 목록 조회
        const jungsiStudents = await fetchJungsiStudents(branchName, year, exam);

        if (jungsiStudents.length === 0) {
            return res.json({
                success: true,
                matched: false,
                message: '정시엔진에 해당 지점 학생 데이터가 없습니다.',
                student: {
                    id: student.id,
                    name: decryptedName,
                    school: student.school,
                    grade: student.grade
                }
            });
        }

        // 4. 학생 매칭
        const pacaStudent = {
            name: decryptedName,
            school: student.school,
            grade: student.grade
        };

        const { match, confidence, method } = matchStudents(pacaStudent, jungsiStudents);

        if (!match) {
            return res.json({
                success: true,
                matched: false,
                message: '정시엔진에서 일치하는 학생을 찾을 수 없습니다.',
                student: pacaStudent,
                searchInfo: {
                    branchName,
                    year,
                    exam,
                    totalStudentsInBranch: jungsiStudents.length
                }
            });
        }

        // 5. 성적 데이터 정리
        const scores = match.scores || {};

        res.json({
            success: true,
            matched: true,
            confidence,
            matchMethod: method,
            student: {
                paca: {
                    id: student.id,
                    name: decryptedName,
                    school: student.school,
                    grade: student.grade
                },
                jungsi: {
                    student_id: match.student_id,
                    student_name: match.student_name,
                    school_name: match.school_name,
                    grade: match.grade
                }
            },
            scores: {
                year,
                exam,
                국어: {
                    선택과목: scores.국어_선택과목,
                    원점수: scores.국어_원점수,
                    표준점수: scores.국어_표준점수,
                    백분위: scores.국어_백분위,
                    등급: scores.국어_등급
                },
                수학: {
                    선택과목: scores.수학_선택과목,
                    원점수: scores.수학_원점수,
                    표준점수: scores.수학_표준점수,
                    백분위: scores.수학_백분위,
                    등급: scores.수학_등급
                },
                영어: {
                    원점수: scores.영어_원점수,
                    등급: scores.영어_등급
                },
                한국사: {
                    원점수: scores.한국사_원점수,
                    등급: scores.한국사_등급
                },
                탐구1: {
                    선택과목: scores.탐구1_선택과목,
                    원점수: scores.탐구1_원점수,
                    표준점수: scores.탐구1_표준점수,
                    백분위: scores.탐구1_백분위,
                    등급: scores.탐구1_등급
                },
                탐구2: {
                    선택과목: scores.탐구2_선택과목,
                    원점수: scores.탐구2_원점수,
                    표준점수: scores.탐구2_표준점수,
                    백분위: scores.탐구2_백분위,
                    등급: scores.탐구2_등급
                }
            }
        });

    } catch (error) {
        logger.error('[Jungsi] 성적 조회 오류:', error);
        res.status(500).json({
            success: false,
            message: '성적 조회에 실패했습니다.',
            error: error.message
        });
    }
});

/**
 * GET /paca/jungsi/match-preview
 * 학원 전체 학생의 정시엔진 매칭 미리보기
 */
router.get('/match-preview', verifyToken, async (req, res) => {
    try {
        const { year = '2027' } = req.query;
        const exam = req.query.exam || getDefaultExam(); // 3월/6월/9월/수능
        const academyId = req.user.academyId;

        // 1. branch_name 확인
        const branchName = ACADEMY_BRANCH_MAP[academyId];
        if (!branchName) {
            return res.status(400).json({
                success: false,
                message: '해당 학원은 정시엔진 연동이 설정되지 않았습니다.'
            });
        }

        // 2. P-ACA 재원생 조회 (active, paused만)
        const [pacaStudents] = await db.query(
            `SELECT id, name, school, grade
             FROM students
             WHERE academy_id = ?
               AND status IN ('active', 'paused')
               AND deleted_at IS NULL
             ORDER BY grade, name`,
            [academyId]
        );

        // 3. 정시엔진 학생 조회
        const jungsiStudents = await fetchJungsiStudents(branchName, year, exam);

        // 4. 매칭 결과 생성
        const results = pacaStudents.map(student => {
            const decryptedName = decrypt(student.name) || student.name;
            const pacaStudent = {
                name: decryptedName,
                school: student.school,
                grade: student.grade
            };

            const { match, confidence, method } = matchStudents(pacaStudent, jungsiStudents);

            return {
                paca: {
                    id: student.id,
                    name: decryptedName,
                    school: student.school,
                    grade: student.grade
                },
                jungsi: match ? {
                    student_id: match.student_id,
                    student_name: match.student_name,
                    school_name: match.school_name,
                    grade: match.grade,
                    hasScores: !!(match.scores && match.scores.국어_등급)
                } : null,
                matched: !!match,
                confidence,
                matchMethod: method
            };
        });

        // 5. 통계
        const stats = {
            total: results.length,
            matched: results.filter(r => r.matched).length,
            highConfidence: results.filter(r => r.confidence === 'high').length,
            mediumConfidence: results.filter(r => r.confidence === 'medium').length,
            lowConfidence: results.filter(r => r.confidence === 'low').length,
            notMatched: results.filter(r => !r.matched).length,
            jungsiTotal: jungsiStudents.length
        };

        res.json({
            success: true,
            branchName,
            year,
            exam,
            stats,
            results
        });

    } catch (error) {
        logger.error('[Jungsi] 매칭 미리보기 오류:', error);
        res.status(500).json({
            success: false,
            message: '매칭 미리보기에 실패했습니다.',
            error: error.message
        });
    }
});

/**
 * GET /paca/jungsi/status
 * 정시엔진 연동 상태 확인
 */
router.get('/status', verifyToken, async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const branchName = ACADEMY_BRANCH_MAP[academyId];

        // 정시엔진 헬스체크 (실제 API 호출로 확인 - /health 엔드포인트 없음)
        // /jungsi/public/schools/:year 는 인증 없이 접근 가능
        let jungsiHealthy = false;
        let healthCheckError = null;
        try {
            const response = await axios.get(`${JUNGSI_API_BASE}/jungsi/public/schools/2027`, { timeout: 5000 });
            jungsiHealthy = response.status === 200;
        } catch (error) {
            jungsiHealthy = false;
            healthCheckError = error.message;
        }

        res.json({
            success: true,
            academyId,
            branchName: branchName || null,
            isConfigured: !!branchName,
            jungsiApi: {
                url: JUNGSI_API_BASE,
                healthy: jungsiHealthy,
                healthCheckEndpoint: '/jungsi/public/schools/2027',
                error: healthCheckError
            },
            examTypes: EXAM_TYPES,  // ['3월', '6월', '9월', '수능']
            defaultExam: getDefaultExam(),  // 현재 시점 기준 기본값
            jwtOption: 'B-2 (정시엔진 secret으로 서버-서버용 토큰 발급)',
            mapping: ACADEMY_BRANCH_MAP
        });

    } catch (error) {
        logger.error('[Jungsi] 상태 확인 오류:', error);
        res.status(500).json({
            success: false,
            message: '상태 확인에 실패했습니다.'
        });
    }
});

/**
 * POST /paca/jungsi/link
 * P-ACA 학생과 정시엔진 학생 수동 연결
 */
router.post('/link', verifyToken, async (req, res) => {
    try {
        const { pacaStudentId, jungsiStudentId } = req.body;

        if (!pacaStudentId || !jungsiStudentId) {
            return res.status(400).json({
                success: false,
                message: 'pacaStudentId와 jungsiStudentId가 필요합니다.'
            });
        }

        // P-ACA 학생 확인
        const [students] = await db.query(
            `SELECT id FROM students
             WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
            [pacaStudentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                success: false,
                message: '학생을 찾을 수 없습니다.'
            });
        }

        // jungsi_student_id 저장 (students 테이블에 컬럼 필요)
        await db.query(
            `UPDATE students SET jungsi_student_id = ? WHERE id = ?`,
            [jungsiStudentId, pacaStudentId]
        );

        res.json({
            success: true,
            message: '정시엔진 학생 연결이 완료되었습니다.',
            pacaStudentId,
            jungsiStudentId
        });

    } catch (error) {
        logger.error('[Jungsi] 학생 연결 오류:', error);
        res.status(500).json({
            success: false,
            message: '학생 연결에 실패했습니다.'
        });
    }
});

module.exports = router;
