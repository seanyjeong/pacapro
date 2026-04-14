# 학생 검색 (암호화 복호화)

P-ACA DB에서 암호화된 학생 이름을 복호화하여 검색합니다.

## 사용법
`/find-student 윤병훈` 또는 `/find-student 김` (부분 검색 가능)

## 실행 방법

아래 스크립트를 실행하여 학생을 검색합니다. `$ARGUMENTS`가 검색어입니다.

```bash
cd /home/sean/pacapro/backend && node -e "
require('dotenv').config();
const { decrypt } = require('./utils/encryption');
const mysql = require('mysql2/promise');
const search = '$ARGUMENTS'.trim();
if (!search) { console.log('검색어를 입력하세요. 예: /find-student 윤병훈'); process.exit(0); }
(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost', user: 'paca', password: process.env.DB_PASSWORD, database: 'paca'
  });
  const [rows] = await conn.query(
    'SELECT id, name, phone, parent_phone, status, is_trial, trial_remaining, trial_dates, grade, academy_id, class_days, time_slot FROM students WHERE deleted_at IS NULL ORDER BY id DESC'
  );
  const results = [];
  for (const r of rows) {
    try { r.decrypted_name = decrypt(r.name); } catch { r.decrypted_name = r.name; }
    if (r.decrypted_name.includes(search)) {
      try { r.decrypted_phone = decrypt(r.phone); } catch { r.decrypted_phone = '-'; }
      try { r.decrypted_parent_phone = decrypt(r.parent_phone); } catch { r.decrypted_parent_phone = '-'; }
      results.push(r);
    }
  }
  if (results.length === 0) { console.log('검색 결과 없음: ' + search); }
  else {
    console.log('=== 검색 결과: ' + search + ' (' + results.length + '건) ===');
    for (const r of results) {
      console.log('');
      console.log('ID:', r.id, '| 이름:', r.decrypted_name, '| 학년:', r.grade || '-');
      console.log('상태:', r.status, '| 체험:', r.is_trial ? 'Y' : 'N', '| 아카데미:', r.academy_id);
      console.log('전화:', r.decrypted_phone, '| 부모:', r.decrypted_parent_phone);
      console.log('수업:', r.class_days || '-', '| 시간대:', r.time_slot || '-');
      if (r.trial_dates) console.log('체험일정:', JSON.stringify(r.trial_dates));
    }
  }
  await conn.end();
})();
"
```

검색 결과를 보고 사용자에게 보여주세요. 스케줄 조회가 필요하면 해당 학생 ID로 attendance + class_schedules 테이블을 조회하세요.
