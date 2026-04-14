# pacapro (P-ACA)

@ARCHITECTURE.md
@API-SPEC.md
@DB-SCHEMA.md
@BUSINESS-LOGIC.md
@DEPLOYMENT.md
@RELATIONSHIPS.md

체대입시 학원관리 SaaS · 학생/결제/강의/상담/출결 · Next.js 15 + Express 4 + MySQL · **n100 primary + vultr failover 이중화**.

## 🏗 구조 한 줄 요약
- **Primary**: n100 `paca.service` (systemd) · `/home/sean/pacapro/backend/paca.js` · **port 8320** · Node v25.2.1
- **Failover**: vultr `paca-failover.service` (systemd, enabled·inactive) · `/root/pacapro/backend/paca.js` · **port 8320**
- **DB**: MySQL `paca` (n100 primary) · **30분마다 vultr로 동기화** (sync-to-vultr.sh)
- **도메인**: **chejump.com** (CF DNS A=218.148.190.61 → **etserver:443 Caddy** → 192.168.35.249:8320 / 페일오버 시 → vultr 158.247.250.58:443 → localhost:8320)
- **Frontend**: Next.js 15 `/home/sean/pacapro/` (src/ App Router)

## 🔁 페일오버 (매우 중요)
vultr 에서 `/root/auto-failover.sh` 가 **매 1분 cron** 실행:
1. `chejump.com/paca-health` + `/peak-health` 를 --resolve 로 n100 IP(218.148.190.61) 향해 체크
2. **둘 다 실패 시**:
   - vultr `systemctl start paca-failover peak-failover`
   - Cloudflare API 로 `chejump.com` A 레코드 → `158.247.250.58` (vultr)
3. **복구 감지 시**: 역순 복원
4. 상태: `/root/.failover-state` (normal | failover)
5. 로그: `/var/log/failover.log`

**DB 동기화**: n100 cron `*/30 * * * * /home/sean/backups/sync-to-vultr.sh` — paca/peak DB 를 vultr MySQL 로 복사

## 🧭 프로세스 관리 = **systemd** (PM2 아님)
```bash
# n100 primary
ssh n100 'sudo systemctl status paca'
ssh n100 'sudo systemctl restart paca'
ssh n100 'sudo journalctl -u paca -f'

# vultr failover (수동 기동 거의 안함 — auto-failover.sh 가 제어)
ssh vultr 'systemctl status paca-failover'
```

## 📡 포트 맵
| 환경 | Host | Port | 서비스 |
|---|---|---|---|
| Primary | n100 | 8320 | paca.js (Express) |
| Failover | vultr | 8320 | paca.js (동일 코드) |
| MySQL | n100 | 3306 | paca DB |
| MySQL | vultr | 3306 | paca DB (sync 복제) |

## 🌐 도메인/라우팅
- **prod**: https://chejump.com/paca/* — **etserver Caddy → 192.168.35.249:8320** (페일오버 시 vultr Caddy → localhost:8320)
- **dev**: https://dev-paca.sean8320.dedyn.io/paca/* — Caddy(etserver) → n100:8320
- **health**: `/paca-health` → `/health` rewrite

## 🗄 DB 핵심 (MySQL `paca`)
학생/학원/강의/결제/상담/출결 + **NocoDB 관리 테이블 (nc_*)** 공존.
주요 테이블: `academies`, `academy_events`, `academy_settings`, `classes`, `class_schedules`, `attendance`, `audit_logs`, `consultations`, `consultation_settings`, `consultation_weekly_hours`, `consultation_blocked_slots`, `expenses`, `holidays`, `instructors`, `instructor_attendance`, `instructor_schedules`, ... + **nc_*** (NocoDB 메타)

자세한 건 `DB-SCHEMA.md`.

## 🔌 API 루트
Express 4, prefix `/paca/*`. `paca.js` 는 모듈 자동 로드 패턴:
```js
app.use('/paca/auth/login', loginLimiter);
app.use('/paca/public', publicLimiter);
app.use('/paca', generalLimiter);
// → routes/ 디렉토리에서 자동 마운트
```
- `GET /health` — 공용 헬스체크
- `GET /paca` — 엔드포인트 루트
- `/paca/auth/*`, `/paca/public/*`, 기타 route modules

세부는 `API-SPEC.md`.

## 🔐 인증 & 보안
- **JWT** (peak 과 secret 공유 — `.env` `JWT_SECRET`)
- bcrypt, helmet, rate limiter (loginLimiter, publicLimiter, generalLimiter)
- `DATA_ENCRYPTION_KEY=QQe/soOzfamoQhmoHQBQ32CM7qQHthbTs3yhE/qDem0=` (peak 과 동일)
- Toss Payments (`TOSS_ACCESS_KEY`)
- VAPID 웹푸시 키
- N8N API Key (`N8N_API_KEY=paca-n8n-api-key-2024`)

## 🚨 절대 규칙
1. **PM2 아님** — systemd
2. **paca.service restart 시 chejump.com 다운 → 30초 내 auto-failover 가 vultr로 전환 가능** → 짧은 재시작만
3. **DB 수정은 n100 primary 에서** — vultr 는 sync 대상 (vultr 직접 INSERT 금지)
4. **peak 과 JWT secret + DATA_ENCRYPTION_KEY 공유** — 변경 시 둘 다 재시작 필수
5. **nc_* 테이블 건드리지 말 것** — NocoDB 가 관리
6. 시간 KST
7. **GitHub push** — etlab8320 계정 콜라보레이터로 설정됨

## 📦 버전업 & 배포 절차 (PWA)

### 버전 업데이트 위치 (푸시 전 필수!)

**수동 수정 필요 (6곳)**:
| 파일 | 필드/위치 |
|------|----------|
| `package.json` | `"version": "3.15.0"` |
| `src/components/version-checker.tsx` | `APP_VERSION = '3.15.0'` |
| `src/components/layout/sidebar.tsx` | `P-ACA v3.15.0` |
| `src/app/m/page.tsx` | `P-ACA Mobile v3.15.0` |
| `src/app/settings/page.tsx` | `v3.15.0` |
| `src/app/tablet/layout.tsx` | `APP_VERSION = 'v3.15.0'` |

**자동 갱신**:
| 파일 | 설명 |
|------|------|
| `package-lock.json` | `npm install` 시 자동 |
| `public/sw.js` | `next build` 시 자동 (next-pwa) |

### 배포 체크리스트
```bash
# 1. 버전업 (package.json 수정)
# version: "3.14.4" → "3.15.0" (기능 추가 시 minor, 버그픽스 시 patch)

# 2. 커밋 & 푸시
git add -A
git commit -m "feat: 기능 설명 + 버전 3.15.0"
git push origin main

# 3. Vercel 자동 배포 확인 (프론트)
# → GitHub push 후 자동 빌드 (sw.js 재생성됨)

# 4. 백엔드 변경 시 재시작
sudo systemctl restart paca
```

### PWA 캐시 갱신
- `sw.js` 빌드 시 chunk 해시가 바뀌어 자동 갱신
- 강제 갱신: 브라우저 개발자도구 → Application → Service Workers → Update

## 🛠 자주 쓰는 명령
```bash
# 헬스
curl -s https://chejump.com/paca-health
ssh n100 'curl -s http://localhost:8320/health'

# 페일오버 상태
ssh vultr 'cat /root/.failover-state; tail -10 /var/log/failover.log'

# DB 동기화 강제
ssh n100 '/home/sean/backups/sync-to-vultr.sh'

# 로그
ssh n100 'sudo journalctl -u paca -f'
```
