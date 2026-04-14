# pacapro DEPLOYMENT

## 📦 이중화 환경
| 역할 | Host | 위치 | 포트 | 상태 |
|---|---|---|---|---|
| **Primary** | n100 | `/home/sean/pacapro/backend` | 8320 | systemd `paca.service` (active) |
| **Failover** | vultr | `/root/pacapro/backend` | 8320 | systemd `paca-failover.service` (enabled·**inactive**) |
| Frontend | **Vercel** (자동) | github.com/seanyjeong/pacapro | - | Vercel ↔ GitHub 연결 |

## 🌐 도메인 / 라우팅
**`https://chejump.com`** — Cloudflare DNS A 레코드로 자동 전환
- **NORMAL**: `chejump.com` → `218.148.190.61` → **etserver Caddy** → reverse_proxy `192.168.35.249:8320` (n100)
- **FAILOVER**: `chejump.com` → `158.247.250.58` → **vultr Caddy** → `localhost:8320`

### etserver Caddy (`chejump.com` block, 정상 시 라우팅)
```
chejump.com {
    handle /server-status/* { uri strip_prefix /server-status; reverse_proxy 192.168.35.249:9999 }
    handle /stats-api/*     { uri strip_prefix /stats-api;     reverse_proxy 192.168.35.249:3003 }
    handle /stats           { redir /stats/ permanent }
    handle /stats/*         { uri strip_prefix /stats;         reverse_proxy 192.168.35.249:3002 }
    handle /socket.io/*     { reverse_proxy 192.168.35.249:8330 }                  # peak Socket.io
    handle /peak-health     { rewrite * /health; reverse_proxy 192.168.35.249:8330 }
    handle /peak/*          { reverse_proxy 192.168.35.249:8330 }
    handle /paca-health     { rewrite * /health; reverse_proxy 192.168.35.249:8320 }
    handle /paca/*          { reverse_proxy 192.168.35.249:8320 }
    handle                  { reverse_proxy 192.168.35.249:8320 }
}
```

### vultr Caddy (`chejump.com` block, 페일오버 시)
```
chejump.com {
    handle /paca/*       { reverse_proxy localhost:8320 }
    handle /peak/*       { reverse_proxy localhost:8330 }
    handle /socket.io/*  { reverse_proxy localhost:8330 }
    handle               { reverse_proxy localhost:8320 }
}
```

### 추가 dev 도메인 (etserver Caddy)
- `https://dev-paca.sean8320.dedyn.io` → n100:8320 (백엔드) + n100:3000 (프론트 dev)
- `https://nocodb.sean8320.dedyn.io` → n100:8380 (NocoDB 관리 UI)

## 🔧 systemd (n100 primary) — `paca.service`
```ini
[Unit]
Description=P-ACA Backend API
After=network.target mysql.service

[Service]
Type=simple
User=sean
WorkingDirectory=/home/sean/pacapro/backend
ExecStart=/home/sean/.nvm/versions/node/v25.2.1/bin/node paca.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 🔧 systemd (vultr failover) — `paca-failover.service`
```ini
[Unit]
Description=P-ACA Failover Backend (Port 8320)
After=network.target mysql.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/pacapro/backend
ExecStart=/usr/bin/node paca.js
Restart=always
RestartSec=10
EnvironmentFile=/root/pacapro/backend/.env

[Install]
WantedBy=multi-user.target
```

## 🗄 환경변수 (`/home/sean/pacapro/backend/.env`)
| Key | Value | 비고 |
|---|---|---|
| `DB_HOST` | `localhost` | n100 MySQL |
| `DB_PORT` | `3306` | |
| `DB_USER` | `paca` | |
| `DB_NAME` | `paca` | n100 + vultr 동기화 |
| `JWT_SECRET` | (env) | peak 와 공유 |
| `DATA_ENCRYPTION_KEY` | `QQe/soOzfamoQhmoHQBQ32CM7qQHthbTs3yhE/qDem0=` | peak 와 공유 |
| `N8N_API_KEY` | `paca-n8n-api-key-2024` | n8n 웹훅 |
| `ENCRYPTION_KEY` | (notification) | 알림톡/SMS |
| `VAPID_EMAIL` | `mailto:paca@chejump.com` | 웹푸시 |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | (env) | 웹푸시 |
| `TOSS_ACCESS_KEY` | (env) | Toss Payments |

## 🔁 GitHub repo & push
- **repo**: `https://github.com/seanyjeong/pacapro.git` (HTTPS + token: `ghp_p0Xj...` 임베드)
- **현재 HEAD**: `fb9422a fix: 학생 수정 후 상세 페이지 최신화 안되는 버그`
- **push 위치**:
  - n100 `/home/sean/pacapro` — 가능 (token 임베드 origin URL)
  - 맥미니 — 가능 (사장님 SSH key)
- 권장: **n100 또는 맥미니** 에서 push (둘 다 가능)
- ⚠️ etserver 에는 pacapro clone 없음 (n100 만 보유)

## 🚀 배포 흐름

### A. Backend (n100 systemd)
```bash
ssh n100
cd /home/sean/pacapro
git pull origin main
cd backend
npm install            # 의존성 변경 시
sudo systemctl restart paca
sudo journalctl -u paca -f
```
- 영향: `https://chejump.com/paca/*`, `/api/*` 즉시 교체 (재시작 ~3초)
- ⚠️ **재시작 시간 30초 넘으면 vultr auto-failover 발동** → 짧은 재시작만

### B. Frontend (Vercel 자동)
- github.com/seanyjeong/pacapro **main 브랜치 push** → Vercel 자동 빌드
- `vercel.json` 존재 (Next.js PWA, framework 명시)
- 도메인: (Vercel project 이름 확인 필요)
- 빌드 명령: `next build`
- PWA 활성: `@ducanh2912/next-pwa`

### C. Vultr Failover Backend 동기화
- **자동**: vultr cron `*/1 /root/auto-failover.sh` 가 헬스체크 + DNS 전환만 (코드는 미동기화)
- **DB 동기화**: n100 cron `*/30 * * * * /home/sean/backups/sync-to-vultr.sh` — paca DB 를 vultr 로 복제
- **코드 동기화**: vultr 의 `/root/pacapro/backend/paca.js` 갱신은 **수동** (확인 필요)

## 🔁 자동 페일오버 메커니즘 (`vultr:/root/auto-failover.sh`)
```bash
* * * * * /root/auto-failover.sh   # 매 1분 cron
```
1. `chejump.com/paca-health` + `/peak-health` 를 N100 IP(218.148.190.61) 향해 체크
2. **둘 다 실패 시**:
   - vultr 에서 `systemctl start paca-failover peak-failover`
   - Cloudflare DNS API 호출 → `chejump.com` A 레코드 → `158.247.250.58` (vultr)
3. **복구 감지 시**: 역순 (failover stop + DNS → n100 IP)
4. 상태: `/root/.failover-state` (normal | failover)
5. 로그: `/var/log/failover.log`

수동 제어:
```bash
ssh vultr '/root/failover-on.sh'    # 강제 페일오버
ssh vultr '/root/failover-off.sh'   # 강제 복구
```

## ❤️ 헬스체크
```bash
curl -s https://chejump.com/paca-health           # → 200 OK (어디로 라우팅되든)
ssh n100 'curl -s http://localhost:8320/health'   # n100 직접
ssh vultr 'curl -s http://localhost:8320/health'  # vultr (failover active 시)
ssh vultr 'cat /root/.failover-state'             # 현재 상태
ssh vultr 'tail -30 /var/log/failover.log'        # 최근 전환 로그
```

## 🗃 DB
- **n100 (primary)**: MySQL `paca` DB
- **vultr (sync 복제)**: 30분마다 `/home/sean/backups/sync-to-vultr.sh`
- **백업**: n100 cron `0 3 * * * /home/sean/backups/backup_all.sh` (매일 03:00 KST)
- **NocoDB 공존**: `paca` DB 안에 `nc_*` 60+ 테이블 — 직접 DML 금지

## 🛠 로그 / 디버그
```bash
ssh n100 'sudo journalctl -u paca -f'
ssh n100 'sudo journalctl -u paca --since "1 hour ago" -n 100 --no-pager'
ssh vultr 'systemctl status paca-failover'
```

## ⏪ 롤백
```bash
ssh n100 'cd /home/sean/pacapro && git log --oneline -5'
ssh n100 'cd /home/sean/pacapro && git checkout <SHA> && cd backend && sudo systemctl restart paca'
```

## 🚨 운영 주의
1. **재시작은 30초 내** (페일오버 트리거 회피)
2. **DB 변경은 n100 에서만** (vultr 는 sync 덮어씀)
3. JWT secret / DATA_ENCRYPTION_KEY 변경 시 peak 도 동시 재시작
4. NocoDB `nc_*` 테이블 DDL 금지
5. **vercel.json 의 framework 변경 금지** — Vercel 빌드 실패 위험
