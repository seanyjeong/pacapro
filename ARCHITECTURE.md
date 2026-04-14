# pacapro ARCHITECTURE

## 이중화 토폴로지
```
                         ┌─ NORMAL ──────────────────────────────────┐
                         │                                            │
Cloudflare DNS           │ chejump.com A=218.148.190.61 (n100)       │
                         │                                            │
Browser ─HTTPS──→ chejump.com ─→ [CF] ─→ etserver Caddy(218.148.190.61:443) ─→ proxy to 192.168.35.249 (n100 LAN)          │
                                                │                    │
                                                ├─ /paca/*   → :8320 │
                                                ├─ /peak/*   → :8330 │
                                                └─ /(other)  → :3000 (Next.js dev)

                         ┌─ FAILOVER ────────────────────────────────┐
                         │ chejump.com A=158.247.250.58 (vultr)      │
                         │                                           │
Browser ─HTTPS──→ chejump.com ─→ vultr Caddy ─→ /paca/* → :8320     │
                                                   /peak/* → :8330   │
                         └───────────────────────────────────────────┘
```

**전환 트리거**: vultr cron `/root/auto-failover.sh` 매 1분 실행, `chejump.com/paca-health + /peak-health` 가 N100 IP 대상 둘 다 실패 시 자동.

## 코드 위치
- n100: `/home/sean/pacapro/` (전체 프로젝트 — backend + frontend + assets)
  - `backend/paca.js` — Express 4 서버 진입점
  - `backend/routes/` — 모듈별 라우트 (자동 마운트)
  - `src/` — Next.js 15 App Router
  - `landing/`, `public/`, `toss-plugin/`
- vultr: `/root/pacapro/backend/paca.js` — 페일오버용 동일 코드 (동기화 주기 확인 필요)

## 스택
- **Runtime**: Node.js v25.2.1 (n100), v18.19.1 (vultr)
- **Server**: Express 4 + helmet + compression + morgan + rate-limit
- **ORM**: mysql2 (직접 쿼리)
- **Frontend**: Next.js 15 + React 18 + Tailwind + Playwright
- **Payment**: Toss Payments
- **Push**: VAPID web push
- **Cache**: 없음 (MySQL 직접)

## 모듈 경계
- `paca.js` — 부트스트랩 (cors, helmet, morgan, rate limiter, 모듈 자동 로드)
- `routes/*.js` — 기능별 REST API
- `database/` — 스키마 관리
- `n8n-workflows/` — N8N 연동 워크플로우

## DB 연결
- **n100 primary**: `mysql` user `paca`, db `paca`, localhost:3306
- **vultr failover**: `mysql` user `maxilsan`, db `paca`, 127.0.0.1:3306
- env vars: `DB_HOST`, `DB_PORT=3306`, `DB_USER`, `DB_NAME=paca`

## 외부 의존
- **Cloudflare DNS** (페일오버 전환)
- **N8N** (`http://n100:5678` 또는 docker n8n-n8n-1) — 알림톡/SMS/자동화
- **Toss Payments** API
- **peak 와 JWT 공유** — users 테이블 조회용 크로스 DB 접근

## 공존 시스템 (같은 `paca` DB)
- **NocoDB** — `nc_*` 테이블로 동거 (건드리지 말 것, 관리자 전용)
- NocoDB 접속: `https://nocodb.sean8320.dedyn.io` (etserver Caddy → n100:8380)
