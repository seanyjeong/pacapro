# 화면 새 디자인 작업 지시 (공통)

사장님이 파카·피크 화면을 "토스·당근 같은 앱 느낌"으로 완전히 새로 만들라고 했다. 배치까지 새로, 기능은 그대로.
기반(토큰·공통 부품·앱 뼈대·대시보드)은 이미 만들어졌다. 너는 맡은 영역의 화면들을 같은 기준으로 다시 배치한다.

## 먼저 읽기

1. `docs/design/redesign-2026-11.md` — 디자인 기준(반드시 따른다).
2. 참고 구현: `src/components/ui/page.tsx`(PageHeader·SectionCard·StatTile·ListRow·EmptyState), `src/features/dashboard/*`, `src/components/ui/button.tsx`·`badge.tsx`·`input.tsx`.
3. 저장소 `CLAUDE.md`(있으면).

## 규칙

- **기능 그대로**: API 호출, 상태 관리, 검증, 권한 검사, 라우트, 필드, 버튼이 하는 일을 바꾸지 않는다. 문구는 뜻을 유지하는 범위에서 짧게 다듬는 것만.
- **공유 파일 수정 금지**: `src/components/ui/*`, `src/components/layout/*`, `src/app/globals.css`, `tailwind.config.ts`, `src/app/layout.tsx`, `docs/design/*`. 공통 부품이 더 필요하면 맡은 feature 폴더 안에 만들고 보고에 "공통으로 올릴 후보"로 적는다.
- 맡은 영역 밖 파일은 건드리지 않는다(같은 파일을 다른 작업자가 고친다). 꼭 필요하면 보고에 적는다.
- 색은 토큰만. `dark:` 색 클래스 쓰지 않는다. 영어 소제목 쓰지 않는다.
- 같은 숫자를 화면에 두 번 보여 주지 않는다. 필터는 본문 카드 맨 위 한 줄로.
- `data-testid`, `aria-label` 은 유지한다.
- 휴대폰 390 폭에서 가로 넘침 없게.

## 확인

- `export PATH=/opt/homebrew/opt/node@24/bin:$PATH` (기본 node 가 깨져 있다).
- `npx tsc --noEmit`, `npx eslint <바꾼 파일>` 오류 0.
- **화면 눈으로 확인**: 맡은 포트로 데모를 띄워 본다.
  - 데모 사본 만들기: `rsync -a --exclude .git --exclude node_modules --exclude .next --exclude next.config.js --exclude src/lib/api/base-url.ts <내 워크트리>/ <데모 폴더>/` 후 `cp ~/worktrees/pacapro-redesign-demo/next.config.js <데모 폴더>/` , `cp ~/worktrees/pacapro-redesign-demo/src/lib/api/base-url.ts <데모 폴더>/src/lib/api/` , `ln -sfn ~/worktrees/pacapro-branch-class/node_modules <데모 폴더>/node_modules`, 그리고 `cd <데모 폴더> && npx next dev -p <포트>` (백그라운드). 코드를 고칠 때마다 rsync 로 다시 맞춘다.
  - 백엔드는 이미 떠 있다(http://localhost:18320, 로컬 가짜 데이터). 로그인: 원장 `owner@local.test`, 비밀번호는 `/private/tmp/claude-501/-Users-etlab-projects-pacapro-vultr-work/efe176d1-202c-4c19-9c7c-2567d8389465/scratchpad/qa-login.txt` 파일에서 스크립트로 읽어 쓴다(출력·기록 금지).
  - 브라우저는 에고라이트: `ego-browser skill` 을 먼저 읽고, **새 작업 공간 하나**를 만들어 쓴다. 1440 폭과 390 폭 캡처를 찍어 직접 본다(`page.cdp("Emulation.setDeviceMetricsOverride", {...})`). 캡처는 `/private/tmp/claude-501/-Users-etlab-projects-pacapro-vultr-work/efe176d1-202c-4c19-9c7c-2567d8389465/scratchpad/redesign/<영역>/` 에. 끝나면 작업 공간을 `finish({ keep: [] })` 로 닫는다.
  - 데이터를 바꾸는 버튼(저장·삭제·발송)은 누르지 않는다. 화면 모양 확인이 목적이다.
- 데모 서버는 끝나면 끈다.

## 커밋

- 내 워크트리·브랜치에만, 화면 묶음별로 커밋(예: `feat(design): 학원비 화면 새 배치`). 마지막 줄 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. push·배포 금지.

## 보고 (한국어, 짧게)

바꾼 화면 목록, 커밋, 확인 결과(tsc/eslint, 캡처 경로 대표 몇 장), 남긴 것·공통으로 올릴 후보·영역 밖에서 발견한 것.
