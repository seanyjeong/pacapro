# Plan: Admin vs Owner 권한 정리

## 개요
P-ACA / P-EAK 두 시스템에서 admin과 owner 역할의 권한 경계를 명확히 정의한다.

## 현황 분석

### P-ACA 권한 현황
| 기능 | 현재 권한 | 올바른 권한 | 상태 |
|------|----------|-----------|------|
| 원장 가입 승인/거절 | admin only | **admin only** (유지) | OK |
| 직원 관리 (계정생성/권한) | owner only | owner only | OK |
| 학생/강사/결제 등 | owner + admin | owner + admin | OK |
| 상담 설정 (slug 등) | verifyToken only | owner + admin | **v3.10.2에서 수정** |

### P-EAK 권한 현황
| 기능 | 현재 권한 | 올바른 권한 | 상태 |
|------|----------|-----------|------|
| 설정 메뉴 | admin + owner | admin + owner | OK |
| 운동/팩 관리 | admin + owner | admin + owner | OK |
| 태그 관리 | ~~admin only~~ | admin + owner | **v5.2.1에서 수정** |
| 기록/수업 등 | 전체 | 전체 | OK |

## 권한 원칙

### Admin (시스템 관리자) 전용
- **P-ACA**: 원장 가입 승인/거절 (`/paca/users/pending`, `/approve`, `/reject`)
- **P-EAK**: 없음 (admin 전용 기능 불필요)

### Owner (원장) 권한
- admin 전용 기능 제외한 **모든 기능** 접근 가능
- 자기 지점(`academy_id`) 데이터만 관리

### Staff (직원/강사) 권한
- owner가 부여한 `permissions` JSON 기반 페이지별 권한

## 완료된 수정 (2026-02-24)

### P-ACA v3.10.2
- [x] slug 빈값 에러 수정 (백엔드)
- [x] slug 저장 버튼 분리 (프론트엔드)
- [x] slug 미설정 시 안내 메시지

### P-EAK v5.2.1
- [x] 태그 관리 `isSystemAdmin` → `isAdmin` (owner 접근 허용)

## 향후 계획

### 공지사항 팝업 시스템 (P-ACA)
- admin이 작성하는 전역 공지사항
- 모든 원장/직원에게 팝업으로 표시
- "다시 보지 않기" 기능 (localStorage 또는 DB)
- 디자인 중요: 깔끔한 팝업 UI
- **구현 시기**: 추후 결정
