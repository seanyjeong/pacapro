---
name: release
description: P-ACA 버전 업데이트 + 프론트/백엔드 배포
arguments:
  - name: version
    description: 새 버전 번호 (예: 1.2.3)
    required: true
---

# P-ACA 릴리즈 스킬

## 수행 작업

1. **버전 업데이트** (4곳)
   - `package.json` → `"version": "{version}"`
   - `src/components/version-checker.tsx` → `APP_VERSION = "{version}"`
   - `src/components/layout/sidebar.tsx` → `P-ACA v{version}` + 오늘 날짜
   - `src/app/settings/page.tsx` → `v{version}` + 오늘 날짜

2. **프론트엔드 배포**
   ```bash
   git add -A
   git commit -m "v{version} 릴리즈"
   git push
   ```
   → Vercel 자동 배포

3. **백엔드 배포**
   ```bash
   echo 'q141171616!' | sudo -S systemctl restart paca
   ```

## 주의사항
- 날짜 형식: `2025.01.09` (YYYY.MM.DD)
- 커밋 전 변경사항 확인 필수
