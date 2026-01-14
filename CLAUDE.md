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

## 문서

상세 스키마/API는 `docs/` 폴더 참조:
- DATABASE-SCHEMA.md (41개 테이블)
- API-ROUTES.md (200+ 엔드포인트)
