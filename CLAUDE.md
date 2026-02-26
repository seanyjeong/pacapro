# P-ACA (파카) - 체대입시 학원관리

## 스택
- **프론트**: Next.js 15 + TailwindCSS + shadcn/ui → Vercel
- **백엔드**: Express.js + MySQL → 로컬 서버 (chejump.com:8320)

## 배포

```bash
# 프론트 (자동)
git push

# 백엔드
echo 'q141171616!' | sudo -S systemctl restart paca
```

## 버전 업데이트 (4곳) - PWA라서 필수!

> **중요**: PWA 앱이라 코드 수정 후 배포할 때 반드시 버전 업데이트 필요!
> 버전 안 올리면 사용자 기기에 캐시된 구버전이 계속 실행됨

```
package.json                        → "version"
src/components/version-checker.tsx  → APP_VERSION
src/components/layout/sidebar.tsx   → P-ACA vX.X.X + 날짜
src/app/settings/page.tsx           → vX.X.X + 날짜
```

## 핵심 규칙

**학생 상태**: active(재원) / paused(휴원) / withdrawn(퇴원) / graduated(졸업) / trial(체험) / pending(미등록)

**암호화 필드**: name, phone, parent_phone, address → SQL LIKE 검색 불가, 메모리 필터링

**시간대**: DB `morning/afternoon/evening` ↔ 화면 `오전/오후/저녁`

**모달 패딩**: `py-6 px-6` 필수

**API 테스트**: 항상 아카데미 1번 (academy_id=1) 계정으로 테스트. 로컬 CLI에서 `.env` 안 읽히므로 curl 토큰 테스트 대신 `journalctl -u paca`로 실제 트래픽 로그 확인.

## 📄 문서 동기화 (필수!)

> **기능 추가/수정/삭제 시 아래 문서를 반드시 함께 업데이트할 것.**
> 코드만 배포하고 문서를 안 고치면 다음 세션에서 틀린 정보로 작업하게 됨.

| 변경 유형 | 업데이트 대상 문서 |
|-----------|-------------------|
| API 엔드포인트 추가/수정/삭제 | `docs/API-ROUTES.md` |
| DB 테이블/컬럼 변경 | `docs/DATABASE-SCHEMA.md` |
| 새 페이지/라우트 추가 | 이 파일 (`CLAUDE.md`) + 상위 `academy/CLAUDE.md` |
| 프론트 주요 컴포넌트 추가 | 이 파일 (`CLAUDE.md`) 관련 섹션 |
| 배포 구조 변경 | 이 파일 (`CLAUDE.md`) 배포 섹션 |
| 버전 업데이트 | 4곳 (위 "버전 업데이트" 섹션 참조) |

**체크리스트 (커밋 전 확인):**
- [ ] API 변경 → `docs/API-ROUTES.md` 반영했는가?
- [ ] DB 변경 → `docs/DATABASE-SCHEMA.md` 반영했는가?
- [ ] 기능 배포 → 버전 4곳 올렸는가?

상세 스키마/API는 `docs/` 폴더 참조:
- DATABASE-SCHEMA.md (43개 테이블)
- API-ROUTES.md (200+ 엔드포인트)
