# P-ACA 서버 이전 완료

> 작성일: 2025-12-06
> 완료일: 2025-12-07
> 목적: P-ACA를 cafe24 서버에서 sean-mini-server로 완전 이전

## 이전 결과

| 구성요소 | 이전 전 | 이전 후 |
|---------|--------|--------|
| **DB** | 211.37.174.218 (cafe24) | localhost (sean-mini-server) |
| **백엔드 API** | https://supermax.kr/paca | https://chejump.com/paca |
| **프론트엔드** | pacapro.vercel.app | pacapro.vercel.app (유지) |
| **n8n** | n8n.sean8320.dedyn.io | n8n.sean8320.dedyn.io (유지) |

---

## 현재 운영 환경

### 서버 정보
- **서버**: sean-mini-server (218.148.190.61)
- **도메인**: chejump.com
- **API URL**: https://chejump.com/paca

### 서비스 관리
```bash
# 백엔드 재시작
sudo systemctl restart paca

# 상태 확인
sudo systemctl status paca

# 로그 확인
sudo journalctl -u paca -f
```

### DB 접속
```bash
mysql -u paca -p paca
```

### 백업
- **위치**: `/home/sean/backups/paca/`
- **주기**: 매주 일요일 새벽 3시
- **수동 실행**: `/home/sean/backups/paca/backup.sh`

---

## 완료된 작업

- [x] MySQL 시작 및 DB 생성
- [x] cafe24에서 DB 덤프 및 import
- [x] database.js 수정 (localhost)
- [x] npm install
- [x] systemd 서비스 생성 (paca.service)
- [x] Caddy 설정 (chejump.com → localhost:8320)
- [x] Vercel 환경변수 변경 (NEXT_PUBLIC_API_URL)
- [x] 프론트엔드 테스트 완료
- [x] n8n 워크플로우 업데이트
- [x] 백업 스크립트 설정
- [x] CLAUDE.md 업데이트
- [x] .env.local 업데이트

---

## cafe24 서버 (레거시)

- **IP**: 211.37.174.218
- **상태**: 백업용으로만 유지
- **참고**: DB와 백엔드 모두 sean-mini-server로 이전 완료
