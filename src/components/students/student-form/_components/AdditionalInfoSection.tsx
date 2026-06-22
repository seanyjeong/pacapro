'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { StudentFormData, StudentStatus } from '@/lib/types/student';
import { STATUS_OPTIONS } from '@/lib/types/student';
import type { Student } from '@/lib/types/student';

interface AdditionalInfoSectionProps {
  mode: 'create' | 'edit';
  formData: StudentFormData;
  initialData?: Student;
  isIndefiniteRest: boolean;
  setIsIndefiniteRest: (v: boolean) => void;
  handleChange: (field: keyof StudentFormData, value: unknown) => void;
  onOpenRestModal: () => void;
}

export function AdditionalInfoSection({
  mode, formData, initialData, isIndefiniteRest, setIsIndefiniteRest, handleChange, onOpenRestModal,
}: AdditionalInfoSectionProps) {
  return (
    <Card className="rounded-md shadow-none">
      <CardHeader><CardTitle>추가 정보</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {/* 주소 */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">주소</label>
          <input type="text" value={formData.address || ''}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="서울시 강남구..."
            className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>

        {/* 비고 */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">비고</label>
          <input type="text" value={formData.notes || ''}
            onChange={(e) => handleChange('notes', e.target.value)}
            placeholder="간단한 특이사항..."
            className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>

        {/* 학생 메모 */}
        <div className="col-span-2">
          <label className="block text-sm font-medium text-foreground mb-2">
            학생 메모 <span className="text-muted-foreground text-xs">(상담 내용, 특이사항 등 상세 기록)</span>
          </label>
          <textarea value={formData.memo || ''}
            onChange={(e) => handleChange('memo', e.target.value)}
            placeholder="상담 내용, 학생 특성, 주의사항 등을 자유롭게 기록하세요..."
            rows={4}
            className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>

        {/* 상태 (수정 모드일 때만) */}
        {mode === 'edit' && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">상태</label>
            <select value={formData.status}
              onChange={(e) => {
                const newStatus = e.target.value as StudentStatus;
                if (newStatus === 'paused' && formData.status !== 'paused' && initialData?.id) {
                  onOpenRestModal();
                  return;
                }
                handleChange('status', newStatus);
                if (newStatus !== 'paused') {
                  handleChange('rest_start_date', '');
                  handleChange('rest_end_date', '');
                  handleChange('rest_reason', '');
                  setIsIndefiniteRest(false);
                }
              }}
              className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {formData.status !== 'paused' && initialData?.id && (
              <p className="text-xs text-muted-foreground mt-1">
                휴원 선택 시 수업료 처리 옵션을 선택할 수 있습니다.
              </p>
            )}
          </div>
        )}

        {/* 휴식 설정 (휴원 상태일 때만) */}
        {mode === 'edit' && formData.status === 'paused' && (
          <div className="col-span-2 p-4 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg space-y-4">
            <h4 className="font-medium text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
              휴식 설정
            </h4>

            <div className="grid grid-cols-2 gap-4">
              {/* 휴식 시작일 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  휴식 시작일 <span className="text-red-500">*</span>
                </label>
                <input type="date" value={formData.rest_start_date || ''}
                  onChange={(e) => handleChange('rest_start_date', e.target.value)}
                  className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  required />
              </div>

              {/* 휴식 종료일 */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">휴식 종료일</label>
                <div className="flex items-center gap-2">
                  <input type="date" value={formData.rest_end_date || ''}
                    onChange={(e) => handleChange('rest_end_date', e.target.value)}
                    disabled={isIndefiniteRest}
                    className={`flex-1 px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 ${
                      isIndefiniteRest ? 'opacity-50' : ''
                    }`} />
                </div>
                <label className="flex items-center gap-2 mt-2 text-sm text-muted-foreground cursor-pointer">
                  <input type="checkbox" checked={isIndefiniteRest}
                    onChange={(e) => {
                      setIsIndefiniteRest(e.target.checked);
                      if (e.target.checked) handleChange('rest_end_date', '');
                    }}
                    className="rounded border-border text-yellow-600 focus:ring-yellow-500" />
                  무기한 휴식
                </label>
              </div>
            </div>

            {/* 휴식 사유 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">휴식 사유</label>
              <input type="text" value={formData.rest_reason || ''}
                onChange={(e) => handleChange('rest_reason', e.target.value)}
                placeholder="예: 개인 사정, 부상, 여행 등"
                className="w-full px-4 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500" />
            </div>

            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              휴식 기간 동안 학원비 이월/환불 처리는 학생 상세 페이지에서 별도로 진행할 수 있습니다.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
