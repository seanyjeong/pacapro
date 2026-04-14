# pacapro RELATIONSHIPS

## 연계 프로덕트

### peak (실기 기록 시스템) — TIGHT COUPLING
- **같은 n100 + 같은 Cloudflare 도메인 (chejump.com)**
- Peak 가 paca DB 의 `users`, `students` 테이블 읽기 (cross-DB JOIN)
- **JWT secret 공유** — pacapro 가 발급한 토큰으로 peak API 사용 가능
- **DATA_ENCRYPTION_KEY 공유** — 민감 필드 암호화 일관성
- peak 의 `students.paca_student_id` → pacapro `students.id`
- **페일오버 동시** — auto-failover.sh 가 둘 다 전환

### teamimax (강사 협업 도구)
- teamimax frontend 가 pacapro 로그인 사용: `NEXT_PUBLIC_PACAPRO_LOGIN_URL=http://192.168.35.249`
- pacapro users 테이블이 teamimax 의 SSO 기반

### NocoDB (paca DB 공존)
- `nc_*` 테이블 60+ 개 같은 `paca` DB
- NocoDB 웹 UI: https://nocodb.sean8320.dedyn.io (etserver Caddy → n100:8380)
- 관리자용 데이터 편집 도구
- ⚠️ 절대 `nc_*` DDL/DML 직접 하지 말 것

### n8n (자동화)
- n8n docker on n100 (`n8n-n8n-1` container, port 5678)
- webhook URL: `https://n8n.sean8320.dedyn.io/webhook/*`
- 알림톡/SMS/이메일 발송 워크플로우
- pacapro → N8N: `N8N_API_KEY=paca-n8n-api-key-2024` 인증

### Cloudflare
- **DNS 자동 전환** 주체 (auto-failover.sh 가 CF API 호출)
- Zone: chejump.com (Zone ID: `2c0f7306d452f9821e1f86a0eadf2da8`)
- API Token: CF_TOKEN (vultr failover script 에 하드코딩됨)

### 맥미니 (GitHub push)
- n100 에는 SSH key 있음 (seanyjeong 계정)
- etlab8320 collaborator 로도 push 가능

## 도메인 매핑
| URL | 대상 | 경유 |
|---|---|---|
| chejump.com | etserver Caddy 218.148.190.61 → n100:8320 (normal) / vultr:443 (failover) | CF DNS A 레코드 |
| chejump.com/paca/* | n100:8320 (etserver Caddy 경유) | reverse_proxy 192.168.35.249:8320 |
| chejump.com/peak/* | n100:8330 (etserver Caddy 경유) | reverse_proxy 192.168.35.249:8330 |
| chejump.com/socket.io/* | Express :8330 (peak Socket.io) | 동일 |
| dev-paca.sean8320.dedyn.io | n100:8320 (backend) + :3000 (frontend dev) | etserver Caddy → n100 |
| nocodb.sean8320.dedyn.io | n100:8380 NocoDB | etserver Caddy → n100 |

## 포트 맵 (n100)
- 3306: MySQL (모든 DB)
- 8320: paca.service (Express)
- 8330: peak.service (Express)
- 8331: coach-eval.service (Next.js)
- 3000: 개발 Next.js
- 8081: adminer docker
- 5678: n8n docker
- 8380: nocodb docker
- 9999: server-status

## 실패 시나리오
1. **n100 다운** → vultr failover 활성 → chejump.com 전환
2. **n100 DB 만 다운** → 서비스 전부 죽음 (각 서버가 DB 접속 불가)
3. **vultr 다운** → 페일오버 불가 (chejump.com 도 영향 — n100 가 살아있으면 여전히 서비스됨)
4. **Cloudflare 다운** → DNS 해석 실패 → 도메인 접근 불가
5. **GitHub 다운** → 배포 차단 (코드 pull 불가)

## 배포 의존 관계
```
mac mini (코드 수정) ─push─→ GitHub(seanyjeong)
                             ↓ pull
                    ┌────── n100 /home/sean/pacapro
                    └────── vultr /root/pacapro (failover, 주기 sync 필요 — 확인)
```
