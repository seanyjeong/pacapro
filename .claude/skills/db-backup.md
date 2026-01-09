---
name: db-backup
description: P-ACA MySQL 데이터베이스 백업
arguments:
  - name: memo
    description: 백업 메모 (선택, 예: 학생데이터수정전)
    required: false
---

# P-ACA DB 백업 스킬

## 수행 작업

1. **백업 디렉토리 확인/생성**
   ```bash
   mkdir -p ~/pacapro/database/backups
   ```

2. **mysqldump 실행**
   ```bash
   mysqldump -u paca paca > ~/pacapro/database/backups/paca_YYYYMMDD_HHMMSS_{memo}.sql
   ```
   - 파일명 형식: `paca_20250109_143052_학생데이터수정전.sql`
   - memo 없으면: `paca_20250109_143052.sql`

3. **백업 파일 압축** (선택)
   ```bash
   gzip 백업파일.sql
   ```

4. **결과 확인**
   - 파일 크기 출력
   - 최근 백업 목록 표시

## 백업 위치
`~/pacapro/database/backups/`

## 복원 방법
```bash
mysql -u paca paca < 백업파일.sql
```
