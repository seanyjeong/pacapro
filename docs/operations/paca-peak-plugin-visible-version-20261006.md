# GPT 플러그인 화면의 MCP 버전 표시 — 2026-10-06

실제 학원관리·실기관리 개발 앱의 이름과 설명을 수정해 도구 새로고침 관리 화면에서 `학원관리 · MCP 0.4.1`, `실기관리 · MCP 0.4.1`을 바로 확인할 수 있게 했다. 새로고침 실행 완료 후 관리 화면과 플러그인 상세 화면의 표시가 유지되는 것을 DOM·스크린샷·재다운로드 ZIP으로 검증했다. 서버 조회용 새 도구는 추가하지 않았다.

공식 설명서에서는 [도구 Refresh](https://developers.openai.com/plugins/deploy/connect-chatgpt#refresh-metadata)와 [플러그인 패키지 버전 변경](https://developers.openai.com/plugins/deploy/submission#update-your-published-plugin)을 별도로 설명한다. 현재 개발 앱 관리 화면의 기본 버전 칸은 `dev mode`이고, 플러그인 상세 화면의 패키지 버전은 `1.0.0`이었다. 서버 health는 양쪽 모두 `0.4.1`이다.

실제 검증 과정에서 두 앱의 새 ZIP `1.0.3` 업로드는 받아들여졌고 화면에도 `1.0.3`이 표시됐다. 그러나 이후 도구 새로고침을 실행하면 패키지 버전은 `1.0.0`으로 다시 생성됐으며 재다운로드 ZIP의 manifest에서도 확인됐다. 이는 현재 두 개발 앱에서 직접 관찰한 결과이며, 모든 ChatGPT 플러그인의 동작으로 일반화하지 않는다. 최종 지속되는 표시는 앱 이름·설명의 `MCP 0.4.1`이며 `1.0.3`이 현재 유지된다고 보고하지 않는다.

학원관리 앱 ID는 `asdk_app_6ab8e29a8578819182ade74b038fa002`, 연결은 Primary·파카 그대로다. 실기관리 앱 ID는 `asdk_app_6ab8efce268081918768079c633fb74d`, 연결은 Primary 그대로다. 사용자가 제시한 `asdk_app_v_6ab8efce269081919d123c4e6f5304db`는 실제 관리 화면에서 실기관리의 버전 ID로 확인했다. `.app.json` 바이트와 package name·author·apps 및 interface category·developerName·defaultPrompt·capabilities는 기존과 동일하다. 원래 계정 권한·연결 설정을 바꾸는 동작은 수행하지 않았다.

관련 원본·후보·새로고침 후 ZIP/JSON, 화면 스냅샷과 PNG 및 `verification.json`은 같은 이름 디렉터리에 보존한다. 이번 변경은 ChatGPT 개발 앱의 표시 메타데이터만 수정했다. PACA/PEAK/MCP runtime·운영 DB·env는 수정하거나 재배포하지 않았고 실제 업무 확인 호출은 0회다. 코드가 바뀌지 않아 runtime 테스트를 반복하지 않았다.

다음 MCP 배포에서는 운영 health의 실제 버전을 읽고 두 앱의 이름·설명에 해당 버전을 함께 반영한다. 도구 새로고침 후 관리 화면의 이름·연결 계정·앱 ID와 재다운로드 metadata가 일치하는지 확인한다. 현재 개발 앱에서는 업로드 ZIP의 package version만으로 최신 MCP 기능 반영을 판정하지 않는다. 되돌리기는 기존 앱 ID를 유지하며 이전 앱 이름·설명을 복원한다.
