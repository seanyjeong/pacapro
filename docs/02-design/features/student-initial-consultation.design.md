# student-initial-consultation Design

## 1. 백엔드 수정

### 파일: `backend/routes/student-consultations.js`
### 엔드포인트: `GET /:studentId` (68-93줄)

#### 변경 내용
기존 `student_consultations` 조회 후, 추가로 `consultations` 테이블 조회:

```sql
SELECT id, consultation_type, learning_type, preferred_date, preferred_time,
       status, student_name, parent_name, parent_phone, student_grade,
       inquiry_content, consultation_memo, admin_notes,
       academic_scores, target_school, checklist, referral_sources,
       created_at
FROM consultations
WHERE linked_student_id = ? AND academy_id = ?
ORDER BY preferred_date DESC
```

#### 응답 형태 (하위호환)
```json
{
  "consultations": [...],           // 기존 그대로
  "initialConsultations": [...]     // 새로 추가
}
```

#### 복호화/파싱 처리
- 복호화: student_name, parent_name, parent_phone
- JSON 파싱: academic_scores, checklist, referral_sources

## 2. 프론트엔드 수정

### 파일: `src/components/students/student-consultations.tsx`

#### 인터페이스 추가
```typescript
interface InitialConsultation {
  id: number;
  consultation_type: string;
  learning_type: string | null;
  preferred_date: string;
  preferred_time: string;
  status: string;
  student_name: string | null;
  parent_name: string | null;
  parent_phone: string | null;
  student_grade: string | null;
  inquiry_content: string | null;
  consultation_memo: string | null;
  admin_notes: string | null;
  academic_scores: any;
  target_school: string | null;
  checklist: any;
  referral_sources: any;
  created_at: string;
}
```

#### 통합 타임라인
```typescript
type TimelineItem =
  | { type: 'student'; data: StudentConsultation; date: string }
  | { type: 'initial'; data: InitialConsultation; date: string };
```
- 두 배열을 합치고 date 기준 내림차순 정렬
- type에 따라 배지 색상 분기: student=초록, initial=파란

#### UI 표시 항목 (신규상담)
- 날짜/시간, 상태 배지
- 문의내용 (inquiry_content)
- 상담메모 (consultation_memo)
- 관리자메모 (admin_notes)
- 목표학교 (target_school)
- 학업성적 (academic_scores)
- 체크리스트 (checklist)

#### 건수 표시
- 기존: `상담 기록 (N건)`
- 변경: `상담 기록 (재원 N건 + 신규 N건)` (신규가 있을 때만)

## 3. 문서 업데이트
- `docs/API-ROUTES.md`: GET /student-consultations/:studentId 응답에 initialConsultations 필드 추가 반영

## 4. 구현 순서
1. 백엔드 API 수정
2. 프론트엔드 컴포넌트 수정
3. 문서 업데이트
4. 검증 (journalctl 로그 + 실제 화면)
