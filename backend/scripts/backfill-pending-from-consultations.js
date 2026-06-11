/**
 * 상담완료(completed) + 학생 미연결 신규상담 → 미등록관리(pending) 학생 소급 생성
 *
 * 배경: 상담만 완료하고 체험등록/미등록관리 버튼을 안 누른 학생은
 *       학생 목록 어디에도 안 보였음. write.js PUT /:id 에 자동 전환이 추가됐고
 *       (2026-06-11), 이 스크립트는 그 이전의 과거 건을 소급 처리한다.
 *
 * 대상: status='completed' AND linked_student_id IS NULL AND consultation_type='new_registration'
 * 생성 로직: routes/consultations/_utils.js createPendingStudentFromConsultation (수동 전환과 동일)
 *
 * 실행 (n100 backend 디렉토리에서):
 *   node scripts/backfill-pending-from-consultations.js            # dry-run (대상 조회만)
 *   node scripts/backfill-pending-from-consultations.js --execute  # 실제 반영
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const db = require('../config/database');
const { decrypt } = require('../utils/encryption');
const { createPendingStudentFromConsultation } = require('../routes/consultations/_utils');

const EXECUTE = process.argv.includes('--execute');

async function main() {
    const [rows] = await db.execute(
        `SELECT * FROM consultations
         WHERE status = 'completed'
           AND linked_student_id IS NULL
           AND consultation_type = 'new_registration'
         ORDER BY preferred_date ASC`
    );

    console.log(`===== 소급 대상: ${rows.length}건 (mode: ${EXECUTE ? 'EXECUTE' : 'dry-run'}) =====\n`);

    for (const c of rows) {
        const name = c.student_name ? decrypt(c.student_name) : '(이름 없음)';
        const date = c.preferred_date instanceof Date
            ? c.preferred_date.toISOString().split('T')[0]
            : c.preferred_date;
        console.log(`- [상담 ${c.id}] academy=${c.academy_id} ${name} (${c.student_grade || '-'}) 상담일 ${date}`);

        if (EXECUTE) {
            try {
                const studentId = await createPendingStudentFromConsultation(c);
                console.log(`    → 미등록관리 학생 ${studentId} 생성 + 연결 완료`);
            } catch (err) {
                console.error(`    ✗ 실패: ${err.message}`);
            }
        }
    }

    if (!EXECUTE) {
        console.log('\ndry-run 완료. 실제 반영하려면 --execute 를 붙여 실행하세요.');
    }

    process.exit(0);
}

main().catch((err) => {
    console.error('스크립트 오류:', err);
    process.exit(1);
});
