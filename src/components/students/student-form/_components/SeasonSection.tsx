'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Loader2 } from 'lucide-react';
import type { Season } from '@/lib/types/season';
import { SEASON_TYPE_LABELS, formatSeasonFee } from '@/lib/types/season';

interface SeasonSectionProps {
  mode: 'create' | 'edit';
  isSeasonTarget: boolean;
  isTrial: boolean;
  seasonsLoading: boolean;
  availableSeasons: Season[];
  enrollInSeason: boolean;
  selectedSeasonId: number | null;
  setEnrollInSeason: (v: boolean) => void;
  setSelectedSeasonId: (v: number | null) => void;
}

export function SeasonSection({
  mode, isSeasonTarget, isTrial, seasonsLoading, availableSeasons,
  enrollInSeason, selectedSeasonId, setEnrollInSeason, setSelectedSeasonId,
}: SeasonSectionProps) {
  if (!isSeasonTarget || mode !== 'create' || isTrial) return null;

  return (
    <Card className="rounded-md shadow-none">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
          시즌 등록
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {seasonsLoading ? (
          <div className="flex items-center text-muted-foreground py-4">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            시즌 정보 로딩 중...
          </div>
        ) : availableSeasons.length === 0 ? (
          <div className="text-muted-foreground py-4">현재 진행중인 시즌이 없습니다.</div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="enrollInSeason" checked={enrollInSeason}
                onChange={(e) => {
                  setEnrollInSeason(e.target.checked);
                  if (!e.target.checked) setSelectedSeasonId(null);
                }}
                className="w-4 h-4 text-primary-600 border-border rounded focus:ring-primary-500" />
              <label htmlFor="enrollInSeason" className="text-sm font-medium text-foreground">
                시즌에 함께 등록하기
              </label>
            </div>

            {enrollInSeason && (
              <div className="ml-6 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">등록할 시즌 선택</label>
                  <select value={selectedSeasonId || ''}
                    onChange={(e) => setSelectedSeasonId(e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-md focus:ring-primary-500 focus:border-primary-500">
                    <option value="">시즌을 선택하세요</option>
                    {availableSeasons.map((season) => (
                      <option key={season.id} value={season.id}>
                        {season.season_name} ({SEASON_TYPE_LABELS[season.season_type]}) - {formatSeasonFee(season.default_season_fee)}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedSeasonId && (
                  <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md p-3 text-sm text-yellow-800 dark:text-yellow-200">
                    <p>학생 등록 완료 후 시즌 등록 페이지에서 상세 설정이 가능합니다.</p>
                    <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                      (등록일이 시즌 시작일 이후인 경우 시즌비가 자동으로 일할계산됩니다)
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
