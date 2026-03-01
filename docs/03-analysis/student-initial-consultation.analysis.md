# student-initial-consultation Analysis Report

> **Analysis Type**: Gap Analysis (Design vs Implementation)
>
> **Project**: P-ACA (paca-frontend)
> **Version**: v3.12.1
> **Analyst**: gap-detector
> **Date**: 2026-03-01
> **Design Doc**: [student-initial-consultation.design.md](../02-design/features/student-initial-consultation.design.md)
> **Plan Doc**: [student-initial-consultation.plan.md](../01-plan/features/student-initial-consultation.plan.md)

---

## 1. Analysis Overview

### 1.1 Analysis Purpose

student-initial-consultation 기능(학생 상세 페이지의 상담기록 탭에 신규상담 기록 통합 표시)에 대해, Design 문서에 명시된 요구사항이 실제 구현 코드에 얼마나 반영되었는지 검증한다.

### 1.2 Analysis Scope

- **Plan Document**: `docs/01-plan/features/student-initial-consultation.plan.md`
- **Design Document**: `docs/02-design/features/student-initial-consultation.design.md`
- **Backend**: `backend/routes/student-consultations.js` (lines 68-121)
- **Frontend**: `src/components/students/student-consultations.tsx` (541 lines)
- **API Docs**: `docs/API-ROUTES.md` (line 256)
- **Analysis Date**: 2026-03-01

---

## 2. Gap Analysis (Design vs Implementation)

### 2.1 Backend API (FR-1)

#### SQL Query

| Design | Implementation | Status |
|--------|---------------|--------|
| `SELECT id, consultation_type, learning_type, preferred_date, preferred_time, status, student_name, parent_name, parent_phone, student_grade, inquiry_content, consultation_memo, admin_notes, academic_scores, target_school, checklist, referral_sources, created_at` | Identical column list (lines 91-95) | **Match** |
| `FROM consultations WHERE linked_student_id = ? AND academy_id = ?` | `FROM consultations WHERE linked_student_id = ? AND academy_id = ?` (lines 97-98) | **Match** |
| `ORDER BY preferred_date DESC` | `ORDER BY preferred_date DESC` (line 98) | **Match** |

#### Response Format (Backward Compatibility - FR-3)

| Design | Implementation | Status |
|--------|---------------|--------|
| `{ consultations: [...], initialConsultations: [...] }` | `{ consultations: decryptedConsultations, initialConsultations: decryptedInitialConsultations }` (lines 113-116) | **Match** |
| 기존 `consultations` 필드 유지 | 기존 로직 보존 (lines 73-88) | **Match** |

#### Decryption / JSON Parsing (Design Section 1 - Decryption/Parsing)

| Field | Design | Implementation | Status |
|-------|--------|---------------|--------|
| student_name | Decrypt | `decrypt(c.student_name)` (line 105) | **Match** |
| parent_name | Decrypt | `decrypt(c.parent_name)` (line 106) | **Match** |
| parent_phone | Decrypt | `decrypt(c.parent_phone)` (line 107) | **Match** |
| academic_scores | JSON parse | `typeof === 'string' ? JSON.parse(...)` (line 108) | **Match** |
| checklist | JSON parse | `typeof === 'string' ? JSON.parse(...)` (line 109) | **Match** |
| referral_sources | JSON parse | `typeof === 'string' ? JSON.parse(...)` (line 110) | **Match** |

### 2.2 Frontend Interface (Design Section 2)

#### InitialConsultation Interface

| Design Field | Implementation Field | Type Match | Status |
|-------------|---------------------|:----------:|--------|
| id: number | id: number | Yes | **Match** |
| consultation_type: string | consultation_type: string | Yes | **Match** |
| learning_type: string \| null | learning_type: string \| null | Yes | **Match** |
| preferred_date: string | preferred_date: string | Yes | **Match** |
| preferred_time: string | preferred_time: string | Yes | **Match** |
| status: string | status: string | Yes | **Match** |
| student_name: string \| null | student_name: string \| null | Yes | **Match** |
| parent_name: string \| null | parent_name: string \| null | Yes | **Match** |
| parent_phone: string \| null | parent_phone: string \| null | Yes | **Match** |
| student_grade: string \| null | student_grade: string \| null | Yes | **Match** |
| inquiry_content: string \| null | inquiry_content: string \| null | Yes | **Match** |
| consultation_memo: string \| null | consultation_memo: string \| null | Yes | **Match** |
| admin_notes: string \| null | admin_notes: string \| null | Yes | **Match** |
| academic_scores: any | academic_scores: any | Yes | **Match** |
| target_school: string \| null | target_school: string \| null | Yes | **Match** |
| checklist: any | checklist: any | Yes | **Match** |
| referral_sources: any | referral_sources: any | Yes | **Match** |
| created_at: string | created_at: string | Yes | **Match** |

#### TimelineItem Type

| Design | Implementation | Status |
|--------|---------------|--------|
| `type: 'student'` \| `type: 'initial'` union type | Lines 57-59: identical union type definition | **Match** |
| date-based descending sort | Lines 119-121: `sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())` | **Match** |

### 2.3 Frontend UI (Design Section 2 - UI Items)

#### Badge Color

| Design | Implementation | Status |
|--------|---------------|--------|
| student = green badge | `bg-emerald-100 text-emerald-800` (line 227) | **Match** |
| initial = blue badge | `bg-blue-100 text-blue-800` (line 394) with text "신규상담" | **Match** |

#### Display Items for Initial Consultation

| Design Item | Implementation | Status |
|------------|---------------|--------|
| Date/Time | Lines 386-392: preferred_date + preferred_time | **Match** |
| Status badge | Lines 397-404: INITIAL_STATUS_LABELS + color coding | **Match** |
| inquiry_content (문의내용) | Lines 416-428: MessageSquare icon + whitespace-pre-wrap | **Match** |
| consultation_memo (상담메모) | Lines 431-443: FileText icon + whitespace-pre-wrap | **Match** |
| admin_notes (관리자메모) | Lines 446-458: ClipboardList icon + whitespace-pre-wrap | **Match** |
| target_school (목표학교) | Lines 461-471: Target icon + display | **Match** |
| academic_scores (학업성적) | Lines 474-491: BookOpen icon + grid display | **Match** |
| checklist (체크리스트) | Lines 494-511: ClipboardList icon + list display | **Match** |

#### Count Label (건수 표시)

| Design | Implementation | Status |
|--------|---------------|--------|
| `상담 기록 (재원 N건 + 신규 N건)` (only when initial exists) | Lines 169-171: `재원 ${consultations.length}건 + 신규 ${initialConsultations.length}건` with `initialConsultations.length > 0` guard | **Match** |
| 기본: `상담 기록 (N건)` | `${consultations.length}건` fallback | **Match** |

### 2.4 Documentation Update (Design Section 3)

| Design | Implementation | Status |
|--------|---------------|--------|
| API-ROUTES.md: initialConsultations 필드 추가 반영 | Line 256: `학생 상담 이력 (응답: consultations + initialConsultations)` | **Match** |

### 2.5 Implementation Order (Design Section 4)

| Step | Design | Verified | Status |
|------|--------|----------|--------|
| 1 | Backend API 수정 | `student-consultations.js` lines 89-116 implemented | **Match** |
| 2 | Frontend 컴포넌트 수정 | `student-consultations.tsx` fully implemented (541 lines) | **Match** |
| 3 | 문서 업데이트 | API-ROUTES.md updated | **Match** |
| 4 | 검증 | Not verifiable in static analysis | N/A |

### 2.6 Added Features (Design X, Implementation O)

| Item | Implementation Location | Description |
|------|------------------------|-------------|
| Parent info display | `student-consultations.tsx` lines 513-535 | parent_name, parent_phone displayed as additional section (not in design UI items list) |
| Status label map | `student-consultations.tsx` lines 73-79 | INITIAL_STATUS_LABELS const (pending/confirmed/completed/cancelled/no_show) |
| Status color coding | `student-consultations.tsx` lines 397-404 | Conditional border/text colors per status |
| Undefined fallback | `student-consultations.tsx` line 96, 99 | `initialConsultations?` optional chaining, `|| []` fallback (matches FR-3) |

These additions are all sensible enhancements that complement the design intent. The parent info display and status label/color are natural extensions of the consultation data. The undefined fallback exactly implements FR-3 from the Plan document.

### 2.7 Match Rate Summary

```
+---------------------------------------------+
|  Overall Match Rate: 100%                    |
+---------------------------------------------+
|  Match:           28 items (100%)            |
|  Missing design:   0 items (0%)              |
|  Not implemented:  0 items (0%)              |
|  Added (harmless): 4 items (complementary)   |
+---------------------------------------------+
```

---

## 3. Plan Requirements Traceability

| Requirement | Description | Design Coverage | Implementation | Status |
|------------|-------------|:--------------:|:--------------:|:------:|
| FR-1 | Backend API extension (initialConsultations field) | Section 1 | Lines 89-116 | **Match** |
| FR-2 | Frontend unified timeline | Section 2 | Lines 107-199 + 365-539 | **Match** |
| FR-3 | Backward compatibility | Section 1 response format | Lines 96, 99, 113-116 | **Match** |

---

## 4. Code Quality Notes

### 4.1 Strengths

- **Type safety**: InitialConsultation interface covers all 18 fields with proper nullable types
- **Defensive coding**: JSON parse with type check (`typeof === 'string'`), null guards on decrypt
- **Clean separation**: `renderStudentConsultation` and `renderInitialConsultation` are separate functions
- **Responsive design**: Grid layouts use `sm:` breakpoints

### 4.2 Minor Observations (not gaps)

| Observation | File | Note |
|-------------|------|------|
| `academic_scores: any` type | student-consultations.tsx:50 | Could benefit from a more specific type, but matches design |
| No error boundary on JSON.parse in backend | student-consultations.js:108-110 | If DB contains malformed JSON, it will throw. The frontend's `parseJSON` helper handles this more gracefully |
| `referral_sources` fetched but not displayed | student-consultations.tsx | Backend returns it (line 110), interface includes it (line 53), but no UI render section. Design also does not list it as a UI display item, so this is consistent |

---

## 5. Overall Scores

| Category | Score | Status |
|----------|:-----:|:------:|
| Design Match (API) | 100% | **Pass** |
| Design Match (Data Model) | 100% | **Pass** |
| Design Match (UI) | 100% | **Pass** |
| Design Match (Documentation) | 100% | **Pass** |
| Plan Requirements Coverage | 100% | **Pass** |
| **Overall Match Rate** | **100%** | **Pass** |

---

## 6. Conclusion

Design 문서와 구현 코드가 완전히 일치한다. Plan 문서의 3개 요구사항(FR-1, FR-2, FR-3) 모두 Design에 반영되었고, Design에 명시된 모든 항목이 Backend/Frontend 코드에 충실하게 구현되었다.

추가 구현된 4개 항목(학부모 정보 표시, 상태 라벨 맵, 상태 색상 코딩, undefined fallback)은 모두 Design 의도를 보완하는 자연스러운 확장이며, Design과 충돌하지 않는다.

### Recommended Actions

- **즉시 조치 필요**: 없음
- **문서 업데이트 필요**: 없음
- **향후 개선 고려사항**:
  - Backend JSON.parse에 try-catch 추가 고려 (malformed JSON 방어)
  - `academic_scores: any` 타입을 보다 구체적인 타입으로 정의 고려
  - `referral_sources` 데이터의 UI 표시 여부 검토 (현재 fetched but not displayed -- 의도적이라면 OK)

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | 2026-03-01 | Initial gap analysis | gap-detector |
