---
name: check-logs
description: P-ACA 백엔드 로그 확인
arguments:
  - name: lines
    description: 출력할 라인 수 (기본 50)
    required: false
---

# P-ACA 로그 확인 스킬

## 수행 작업

1. **systemd 서비스 로그 확인**
   ```bash
   journalctl -u paca -n {lines} --no-pager
   ```

2. **에러만 필터링** (선택)
   ```bash
   journalctl -u paca -p err -n 20 --no-pager
   ```

3. **실시간 로그** (필요시)
   ```bash
   journalctl -u paca -f
   ```

## 확인 포인트
- 500 에러
- DB 연결 실패
- 인증 오류
- 메모리/CPU 이슈
