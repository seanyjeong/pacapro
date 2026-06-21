'use client';

import { AlertCircle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import type { ProRatedPreview, Season, StudentSeason } from '@/lib/types/season';
import { SEASON_TYPE_LABELS, formatSeasonFee } from '@/lib/types/season';

interface EditData {
  registration_date: string;
  season_fee: number;
  discount_amount: number;
  discount_reason: string;
}

interface StudentSeasonEditModalProps {
  editingEnrollment: StudentSeason;
  editData: EditData;
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onEditDataChange: (editData: EditData) => void;
}

interface StudentSeasonEnrollModalProps {
  availableSeasons: Season[];
  enrollments: StudentSeason[];
  selectedSeasonId: number | null;
  registrationDate: string;
  isContinuous: boolean;
  preview: ProRatedPreview | null;
  previewLoading: boolean;
  previewError: string | null;
  enrolling: boolean;
  onSeasonChange: (seasonId: number | null) => void;
  onRegistrationDateChange: (registrationDate: string) => void;
  onContinuousChange: (isContinuous: boolean) => void;
  onClose: () => void;
  onEnroll: () => void;
}

export function StudentSeasonEditModal({
  editingEnrollment,
  editData,
  saving,
  onClose,
  onSave,
  onEditDataChange,
}: StudentSeasonEditModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">시즌 등록 정보 수정</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="font-medium text-blue-900">{editingEnrollment.season_name}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">등록일</label>
            <input
              type="date"
              value={editData.registration_date}
              onChange={(e) => onEditDataChange({ ...editData, registration_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              시즌 시작일 이후로 설정하면 일할계산이 적용됩니다.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시즌비</label>
            <MoneyInput
              value={editData.season_fee}
              onChange={(season_fee) => onEditDataChange({ ...editData, season_fee })}
              className="focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">1만원 단위</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">할인 금액</label>
            <MoneyInput
              value={editData.discount_amount}
              onChange={(discount_amount) => onEditDataChange({ ...editData, discount_amount })}
              className="focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">1만원 단위</p>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">시즌비</span>
              <span>{editData.season_fee.toLocaleString()}원</span>
            </div>
            {editData.discount_amount > 0 && (
              <div className="flex justify-between text-sm text-red-600 mt-1">
                <span>할인</span>
                <span>-{editData.discount_amount.toLocaleString()}원</span>
              </div>
            )}
            <div className="flex justify-between font-semibold mt-2 pt-2 border-t">
              <span>최종 금액</span>
              <span className="text-primary-600">
                {Math.max(0, editData.season_fee - editData.discount_amount).toLocaleString()}원
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button className="flex-1" onClick={onSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function StudentSeasonEnrollModal({
  availableSeasons,
  enrollments,
  selectedSeasonId,
  registrationDate,
  isContinuous,
  preview,
  previewLoading,
  previewError,
  enrolling,
  onSeasonChange,
  onRegistrationDateChange,
  onContinuousChange,
  onClose,
  onEnroll,
}: StudentSeasonEnrollModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">시즌 등록</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">등록할 시즌 선택</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={selectedSeasonId || ''}
              onChange={(e) => onSeasonChange(e.target.value ? parseInt(e.target.value) : null)}
            >
              <option value="">시즌을 선택하세요</option>
              {availableSeasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.season_name} ({SEASON_TYPE_LABELS[season.season_type]})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              등록일 (시즌 시작 후 합류 시 일할계산)
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={registrationDate}
              onChange={(e) => onRegistrationDateChange(e.target.value)}
            />
          </div>

          {enrollments.length > 0 && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="continuous"
                checked={isContinuous}
                onChange={(e) => onContinuousChange(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="continuous" className="text-sm text-gray-700">
                연속등록 (이전 시즌에서 이어서 등록)
              </label>
            </div>
          )}

          {selectedSeasonId && (
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">납부 예상 금액</h4>
              {previewLoading ? (
                <div className="flex items-center text-gray-500">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  계산 중...
                </div>
              ) : previewError ? (
                <div className="bg-red-50 p-4 rounded-lg flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{previewError}</span>
                </div>
              ) : preview?.final_calculation ? (
                <SeasonPreview preview={preview} />
              ) : (
                <p className="text-gray-500 text-sm">시즌을 선택해주세요.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={onEnroll} disabled={!selectedSeasonId || enrolling || !!previewError}>
            {enrolling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            등록
          </Button>
        </div>
      </div>
    </div>
  );
}

function SeasonPreview({ preview }: { preview: ProRatedPreview }) {
  return (
    <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-600">시즌비</span>
        <span>
          {formatSeasonFee(preview.final_calculation.original_season_fee || preview.final_calculation.season_fee)}
        </span>
      </div>

      {preview.mid_season_prorated && (
        <div className="flex justify-between text-orange-600">
          <span>
            중간합류 할인 ({preview.mid_season_prorated.remaining_days}/{preview.mid_season_prorated.total_days}일)
          </span>
          <span>-{formatSeasonFee(preview.mid_season_prorated.discount)}</span>
        </div>
      )}

      {preview.non_season_prorated_info && (
        <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded mt-1">
          비시즌 일할 {formatSeasonFee(preview.non_season_prorated_info.amount)}은(는) 시즌 전달 학원비에서 별도 청구됩니다.
        </div>
      )}

      {preview.final_calculation.discount_amount > 0 && (
        <div className="flex justify-between text-green-600">
          <span>연속등록 할인</span>
          <span>-{formatSeasonFee(preview.final_calculation.discount_amount)}</span>
        </div>
      )}

      <div className="flex justify-between font-semibold border-t pt-2">
        <span>총 납부액</span>
        <span className="text-primary-600">
          {formatSeasonFee(preview.final_calculation.total_due)}
        </span>
      </div>

      {preview.mid_season_prorated && (
        <div className="text-xs text-orange-600 mt-2 bg-orange-50 p-2 rounded">
          {preview.mid_season_prorated.details}
        </div>
      )}
    </div>
  );
}
