/**
 * routes/consultations/learning — 재원생 상담 일정 등록 (Phase 3 #2)
 *
 * Endpoint:
 *   POST /learning  — consultations + student_consultations 동시 INSERT
 *                     (스케줄 달력 표시 + 상담 기록), mockExamScores 옵션 처리,
 *                     PWA 푸시 알림 비동기 발송 (실패 무시)
 *
 * 인증: verifyToken (endpoint 단위, 원본 보존)
 *
 * DB: pool.execute (ADR-005).
 *   - consultations INSERT (students 학년/이름 암호화)
 *   - student_consultations INSERT (consultations.insertId 연결)
 *   - mockExamScores 입력 시 student_performance INSERT (3월/6월/9월 모의고사 row 별)
 *
 * 외부 의존성:
 *   - encrypt (보안 헬퍼, ADR-007 시그니처 무변경)
 *   - decrypt (학생 이름 복호화, ADR-007 시그니처 무변경)
 *   - require('../../services/pushService').sendPushToAcademyAdmins (비동기, 실패 무시)
 *     테스트는 require 캐시에 mock 주입 가능 (pushService 모듈 레벨 mock).
 *
 * 응답 표면 보존 (ADR-013):
 *   - 201 : { message, consultationId, studentConsultationId }
 *   - 400 : { error: '<한국어>' } — 필수 필드 누락
 *   - 404 : { error: '<한국어>' } — 학생 미존재
 *   - 5xx : { error: '<한국어>' } — e.message 누출 0건 (ADR-003)
 *     프론트 (consultations/page.tsx, calendar/page.tsx, enrolled/page.tsx) 가
 *     `apiClient.post('/consultations/learning', ...)` 결과를 별도 처리 X (단순 await),
 *     toast 표시는 axios 인터셉터가 .error 키로 한국어 메시지 표면화.
 */

const { pool, verifyToken, encrypt, decrypt, logger } = require('./_utils');

module.exports = function (router) {
    router.post('/learning', verifyToken, async (req, res) => {
        try {
            const academyId = req.user.academy_id;
            const userId = req.user.id;
            const {
                studentId,
                preferredDate,
                preferredTime,  // 시간 (스케줄 달력 표시용)
                learningType,   // regular, admission, parent, counseling
                adminNotes,
                mockExamScores  // { '3월': { 국어: '2', 수학: '1', ... }, ... }
            } = req.body;

            // 필수 필드 검증
            if (!studentId || !preferredDate || !preferredTime || !learningType) {
                return res.status(400).json({ error: '학생, 날짜, 시간, 상담유형은 필수입니다.' });
            }

            // 학생 정보 조회
            const [students] = await pool.execute(
                'SELECT id, name, phone, grade FROM students WHERE id = ? AND academy_id = ?',
                [studentId, academyId]
            );

            if (students.length === 0) {
                return res.status(404).json({ error: '학생을 찾을 수 없습니다.' });
            }

            const student = students[0];
            const studentName = decrypt(student.name) || student.name;
            const studentGrade = student.grade;  // 학생의 실제 학년 정보

            // 1. consultations 테이블에 저장 (스케줄 달력 표시용)
            const [consultationResult] = await pool.execute(
                `INSERT INTO consultations (
                    academy_id, consultation_type, learning_type, linked_student_id,
                    student_name, student_grade, preferred_date, preferred_time, status, admin_notes,
                    created_at
                ) VALUES (?, 'learning', ?, ?, ?, ?, ?, ?, 'confirmed', ?, NOW())`,
                [
                    academyId,
                    learningType,
                    studentId,
                    encrypt(studentName),
                    studentGrade,
                    preferredDate,
                    preferredTime + ':00',
                    adminNotes || null
                ]
            );

            // 2. student_consultations 테이블에 저장 (상담 기록용)
            const [studentConsultationResult] = await pool.execute(
                `INSERT INTO student_consultations (
                    academy_id, student_id, consultation_id, consultation_date, consultation_type,
                    general_memo, created_by, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    academyId,
                    studentId,
                    consultationResult.insertId,
                    preferredDate,
                    learningType,
                    adminNotes || null,
                    userId
                ]
            );

            // 3. 모의고사 성적 저장 (입력된 경우)
            if (mockExamScores && typeof mockExamScores === 'object') {
                const examMonthMap = { '3월': '03', '6월': '06', '9월': '09' };
                const currentYear = new Date().getFullYear();

                for (const [examName, subjects] of Object.entries(mockExamScores)) {
                    // 최소 1개 이상의 과목 성적이 있는 경우만 저장
                    const hasData = Object.values(subjects).some((v) => v !== '' && v !== null);
                    if (!hasData) continue;

                    const month = examMonthMap[examName];
                    if (!month) continue;

                    // record_date 는 해당 월의 첫날 (예: 2026-03-01)
                    const recordDate = `${currentYear}-${month}-01`;

                    // subjects 객체 → 배열
                    const subjectsArray = Object.entries(subjects)
                        .filter(([, grade]) => grade !== '' && grade !== null)
                        .map(([name, grade]) => ({
                            name,
                            grade: parseInt(grade),
                            score: null  // 등급만 입력
                        }));

                    if (subjectsArray.length === 0) continue;

                    await pool.execute(
                        `INSERT INTO student_performance (
                            student_id, record_date, record_type, performance_data, notes, recorded_by
                        ) VALUES (?, ?, 'mock_exam', ?, ?, ?)`,
                        [
                            studentId,
                            recordDate,
                            JSON.stringify({ exam: examName, subjects: subjectsArray }),
                            `${examName} 모의고사 (재원생상담 등록 시 입력)`,
                            userId
                        ]
                    );
                }
            }

            // 4. PWA 푸시 알림 발송 (학원 관리자들에게)
            try {
                const pushService = require('../../services/pushService');
                const formattedDate = new Date(preferredDate).toLocaleDateString('ko-KR', {
                    month: 'long', day: 'numeric', weekday: 'short'
                });
                const learningTypeLabels = {
                    regular: '정기상담',
                    admission: '진학상담',
                    parent: '학부모상담',
                    counseling: '고민상담'
                };
                await pushService.sendPushToAcademyAdmins(academyId, {
                    title: '재원생 상담 등록',
                    body: `${studentName} 학생 ${learningTypeLabels[learningType] || learningType} - ${formattedDate} ${preferredTime}`,
                    icon: '/icons/icon-192x192.png',
                    badge: '/icons/icon-72x72.png',
                    data: {
                        type: 'consultation',
                        url: `/consultations/calendar?date=${preferredDate}`
                    }
                });
            } catch (pushError) {
                logger.error('푸시 알림 발송 실패 (무시):', pushError);
            }

            res.status(201).json({
                message: '재원생 상담 일정이 등록되었습니다.',
                consultationId: consultationResult.insertId,
                studentConsultationId: studentConsultationResult.insertId
            });
        } catch (error) {
            logger.error('재원생 상담 등록 오류:', error);
            res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    });
};
