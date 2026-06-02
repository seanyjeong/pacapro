# P-ACA 보안 의존성 릴리즈 준비

날짜: 2026-06-02
브랜치: `release/security-deps-20260602`
대상 버전: 프론트 `3.18.19`, 백엔드 `1.1.13`

## 목적

운영 중인 학원 데이터 기능은 바꾸지 않고, 패키지 보안 점검에서 잡힌 위험을 낮춘다.

## 변경 내용

- PDF 생성 패키지 `jspdf`를 `4.2.1`로 올렸다.
- 메일 발송 패키지 `nodemailer`를 `8.0.10`으로 올렸다.
- 하위 패키지 보안 이슈를 막기 위해 `postcss`, `serialize-javascript`, `uuid` 버전을 고정했다.
- 프론트 버전을 `3.18.19`, 백엔드 버전을 `1.1.13`으로 올렸다.

## 토스 범위

- `toss-plugin` 폴더는 이번 릴리즈에서 제외했다.
- 파카 본체의 기존 토스 관리/콜백 API 파일도 기능 변경하지 않았다.
- 즉, 이번 작업은 토스 플러그인 출시가 아니라 파카 본체 보안 의존성 릴리즈다.

## 검증

- 프론트 `npm audit --omit=dev`: 0건
- 백엔드 `npm audit --omit=dev`: 0건
- 백엔드 `npm run test:ci`: 86개 테스트 묶음, 833개 테스트 통과
- 프론트 `npm run lint`: 오류 0건, 기존 경고만 있음
- 프론트 `npm run build`: 성공

## 배포 전 확인

- 운영 배포 전 `chejump.com/paca-health`를 먼저 확인한다.
- 배포 직후 로그인, 학생 목록, 상담 기록 저장, 결제/엑셀 다운로드, 피크 이동 버튼을 확인한다.
- 토스 플러그인은 별도 릴리즈 전까지 운영 경로에 추가하지 않는다.

## 되돌리는 법

운영 반영 후 문제가 생기면 직전 main 커밋으로 되돌린 뒤 서비스를 재시작한다.

```bash
git revert <release-commit>
sudo systemctl restart paca
curl -s https://chejump.com/paca-health
```
