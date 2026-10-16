# 태블릿 접수용 HTML

파일: `public/admissions/일산맥스_입학원서_접수용.html`.
전달 사본: `/Users/etlab/Downloads/일산맥스_입학원서_접수용.html`, `/tmp/ilsan-admission-html/일산맥스_입학원서_접수용.html`.

기존 승인된 학부모 화면의 마크업·스타일을 유지한 단일 파일이다. 이미지·스타일·제출 스크립트를 포함한다. 학원/직원 로그인이나 비밀키는 포함하지 않는다. 직원 화면이 아닌 공개 원서 접수만 수행한다.

- 브라우저에서 열면 운영 서버의 일산 접수 가능 여부를 확인한다.
- 연결 성공 전에는 제출 버튼이 비활성화된다. 저장되지 않았는데 접수 완료로 표시하지 않는다.
- 제출 성공 응답의 received와 접수 UUID를 검증한 뒤 완료를 표시한다.
- 네트워크 응답 유실 후 같은 내용으로 재제출하면 같은 UUID로 확인한다.
- 성공 후 개인정보 필드를 비우고 다음 학생 작성 버튼을 제공한다. localStorage/sessionStorage에 원서·직원 토큰을 저장하지 않는다.
- 접수만으로 재원생/학원비를 즉시 생성하지 않는다. 담당자가 기존 `/admissions` 화면에서 금액과 등록일을 승인한다.
- 인터넷 연결이 필요하다. 파일 미리보기 앱이 JavaScript를 실행하지 않으면 제출할 수 없다. 홈 화면에서 앱처럼 실행하는 용도는 운영 웹 페이지 주소를 사용해야 한다. 태블릿 기종은 아직 확인되지 않았다.

## 운영 상태

2026-10-16 현재 점검에서 `GET https://supermax.kr/paca/ilsan-admissions`가 404였다. **이 파일을 만드는 작업에서는 운영 반영하지 않았다. 따라서 지금 운영 접수에 사용할 수는 없다.**

필요한 서버 변경은 이미 로컬 구현했다: 기존 입학원서 migration/API/scheduler와 함께 접수 준비 확인 `/availability`, 로컬 HTML `Origin:null`에 대한 익명 `/availability`·`/submit`만의 CORS 예외. 인증·조회·승인 경로에는 로컬 파일 예외를 적용하지 않는다. 해당 middleware는 `backend/paca.js`의 전역 CORS 및 OPTIONS보다 앞에서 동작한다. CORS 설정만 바꿔서 전체 PACA API를 로컬 파일에 공개하면 안 된다.

실제 사용에는 이 서버 변경과 입학원서 테이블, 담당자 프론트 화면을 운영 반영해야 한다. 기존 학생/청구를 변경하는 데이터 보정은 포함하지 않는다. 배포할 때 현재 운영 소스/버전을 다시 비교하고 버전업한다.

## 재생성 / 검증

```sh
python3 scripts/admissions/build-standalone.py \
  --template /tmp/ilsan-admission-html/일산맥스_입학원서_학부모폼.html \
  --output public/admissions/일산맥스_입학원서_접수용.html
cd backend
node node_modules/jest/bin/jest.js --runInBand __tests__/models/ilsanAdmission.test.js __tests__/middleware/ilsanAdmissionFileCors.test.js
cd ..
python3 scripts/test-ilsan-admission-mysql.py
```

모델/CORS 10개 및 격리 MySQL HTTP·브라우저 통합 10개 통과. 브라우저는 실제 `file://` HTML을 열고 운영 URL 요청을 전부 임시 loopback API로 전환했다. 서버 연결 불가 시 제출 차단, 실제 암호화 원서 저장, 성공 응답 유실 후 같은 UUID 재시도, 단일 원서 유지, 입력 삭제, 다음 학생 작성, 800px 태블릿 너비에서 가로 넘침 없음까지 확인했다. 운영에 합성 원서를 제출하지 않았다.

검증 파일: `docs/operations/ilsan-admission-20261016/tablet-html-verification.json`.
