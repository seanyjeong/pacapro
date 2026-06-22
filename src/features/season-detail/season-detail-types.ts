import type { RefundData, RefundPreviewResponse, Season, StudentSeason } from '@/lib/types/season';

export interface SeasonDetailResponse {
  message: string;
  season: Season;
  enrolled_students?: StudentSeason[];
}

export interface EnrolledStudentsResponse {
  enrolled_students?: StudentSeason[];
}

export interface SeasonRefundCancelResponse {
  message: string;
  refundCalculation: RefundData;
}

export type SeasonRefundPreview = RefundPreviewResponse;
