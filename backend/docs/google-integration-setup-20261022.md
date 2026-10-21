# Google 연동 설정 및 검증 기록 — 2026-10-22 KST

## Google Cloud

사용자가 승인한 Ego Lite 브라우저 세션으로 기존 `paca-480014` 프로젝트를 확인했다. 기존 n8n OAuth 클라이언트를 삭제·수정하지 않고 Web 클라이언트 **PACA Google Integration**을 별도로 만들었다.

- Google Calendar API와 Drive API를 활성화했다. Sheets API는 이미 활성화된 상태를 확인했다.
- redirect URI: `https://supermax.kr/paca/google-integration/callback`, `http://localhost:8339/paca/google-integration/callback`.
- 공통 OAuth 권한 7개를 Data Access에 등록하고 저장된 상태를 재조회했다.
- 프로젝트 공통 동의 화면 이름을 `P-ACA n8n`에서 `P-ACA`로 변경했다. 이 브랜딩과 게시 상태는 프로젝트 내 기존 n8n 클라이언트에도 공통으로 적용되지만 기존 클라이언트 자격증명/redirect는 유지했다.
- 소개·개인정보처리방침·약관 주소를 등록한 후 **프로덕션 단계(In production)**로 전환했다. 정식 검증 요청은 제출하지 않았다. 콘솔의 외부 사용자 유형, 사용자 한도 100명 중 1명, 미검증 앱 안내를 확인했다.
- 키는 이 작업 사본의 gitignored `.env.google`에 0600 권한으로 보관했다. client secret/암호화 키/토큰은 코드·커밋·문서에 싣지 않았다. 파카 운영 서버 환경에는 아직 반영하지 않았다.

테스트 상태에서의 구글 로그인, PKCE code 교환, 전체 scope 발급, 계정 이메일 검증, refresh_token 갱신을 실제로 확인했다. 프로덕션 전환 후 2026-10-22 01:03 KST에도 다시 동의·code 교환·전체 scope·refresh 갱신에 성공했다. 새 응답에 `refresh_token_expires_in`은 없었다. 테스트 모드의 7일 제한과 별개로 사용자 권한 취소 등 일반 토큰 만료 사유는 여전히 존재한다. 실제 PACA 학생/상담 데이터 및 구글 일정의 쓰기는 수행하지 않았다.

## 공개 문서 게시

사용자의 추가 승인으로 공개 문서만 기존 Vultr 정적 경로에 게시했다. Caddy가 이미 제공하는 `/files/*` → `/var/www/public-files` 경로를 이용했다. Caddy 설정 수정·reload, PACA 서비스 restart, DB migration, 앱 기능 배포는 수행하지 않았다.

| 파일 | 공개 URL | SHA-256 |
| --- | --- | --- |
| `public/google-integration/index.html` | https://supermax.kr/files/paca-google/index.html | `54ffade55a73540e17003068e345e23cce2b3da348dd502449728407355e27d7` |
| `public/google-integration/privacy.html` | https://supermax.kr/files/paca-google/privacy.html | `1f71b641a3709d85919f911003468591409888e174bc46363dcfd7d2cc22275d` |
| `public/google-integration/terms.html` | https://supermax.kr/files/paca-google/terms.html | `6632a8ce7cb627f780d7629c1d756df6991ce6b879fe4a3c6b3826c87216acc1` |
| `public/google-integration/legal.css` | https://supermax.kr/files/paca-google/legal.css | `f5d85028f31ce110a82d9024427bb8f3a80ec39523686bfa17848c160a095e89` |

배치 위치: `vultr:/var/www/public-files/paca-google/` (새 디렉터리). 4개 URL 모두 비인증 HTTPS 200 및 로컬 SHA-256 일치를 확인했다. 문서는 1365/390px 렌더링과 상대 링크를 점검했다. 원래 있던 공개 파일을 덮어쓰지 않았다. 문서 롤백이 필요하면 새 디렉터리를 비공개 보관 위치로 옮기고 브랜딩 URL도 함께 조정해야 한다.

이 기록은 저장소 범위 안에 남기는 서버 인벤토리 추가 근거다. 작업 사본 외 로컬 인벤토리 파일은 수정하지 않았다.

## 로컬 검증

- Backend: Google 단위/라우트/격리 MySQL + 기존 상담/학원 일정/MAX Engine/privacy 회귀 **13 suites, 110 tests 통과**.
- 격리 MySQL: Docker MySQL 8, loopback 13376, 테스트 실행마다 고유한 합성 DB 생성·삭제. 운영 DB/학생 자료 사용 없음.
- 프론트 lint: 오류 0. 전체 저장소에서 기존 경고 83건; 변경 UI/스모크 파일 범위에서는 경고·오류 0.
- TypeScript `tsc --noEmit` 통과.
- 설정 화면: 합성 원장 및 네트워크 차단 fixture, Calendar/Drive/Sheets 독립 토글, 실패 시 상태 보존, 재조회, 연결 해제 후 스위치 비활성화 통과. 1365/768/390px 가로 넘침 없음.
- Next production build 통과. Google 설정 UI와 공개 HTML은 최종 빌드에 포함한다.

본 기능은 커밋만 한다. 실제 교육원 연결과 자동 동기화 시작에는 운영 마이그레이션·환경 주입·서버/프론트 배포가 별도로 필요하다. 본 문서의 공개 정적 안내 게시를 캘린더 동기화의 운영 배포나 실학생 E2E 완료로 해석하지 않는다.

정제된 기계 판독 근거: [google-integration-verification.json](google-integration-verification.json).
