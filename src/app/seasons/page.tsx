'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus,
  AlertCircle,
  Trophy,
  Loader2,
  Edit2,
  Trash2,
  CheckCircle,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { seasonsApi } from '@/lib/api/seasons';
import type { Season, SeasonFilters, SeasonType, SeasonStatus } from '@/lib/types/season';
import {
  SEASON_TYPE_LABELS,
  SEASON_STATUS_LABELS,
  formatSeasonFee,
  formatOperatingDays,
  parseOperatingDays,
} from '@/lib/types/season';

export default function SeasonsPage() {
  const router = useRouter();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SeasonFilters>({});

  const fetchSeasons = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await seasonsApi.getSeasons(filters);
      setSeasons(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '시즌 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchSeasons();
  }, [fetchSeasons]);

  const handleAddSeason = () => {
    router.push('/seasons/new');
  };

  const handleSeasonClick = (id: number) => {
    router.push(`/seasons/${id}`);
  };

  const handleDeleteSeason = async (id: number, seasonName: string) => {
    if (!confirm(`"${seasonName}" 시즌을 삭제하시겠습니까?\n등록된 학생이 있으면 삭제할 수 없습니다.`)) return;

    try {
      await seasonsApi.deleteSeason(id);
      fetchSeasons();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '삭제에 실패했습니다.');
    }
  };

  // 통계 계산
  const stats = {
    total: seasons.length,
    active: seasons.filter(s => s.status === 'active').length,
    early: seasons.filter(s => s.season_type === 'early').length,
    regular: seasons.filter(s => s.season_type === 'regular').length,
  };

  // 연도 목록 (필터용) - start_date에서 연도 추출
  const years = Array.from(new Set(seasons.map(s => new Date(s.start_date).getFullYear()))).sort((a, b) => b - a);
  const currentYear = new Date().getFullYear();
  if (!years.includes(currentYear)) years.unshift(currentYear);
  if (!years.includes(currentYear + 1)) years.unshift(currentYear + 1);

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">시즌 관리</h1>
          <p className="text-muted-foreground mt-1">수시/정시 시즌 등록 및 관리</p>
        </div>

        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">데이터 로드 실패</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchSeasons}>다시 시도</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">시즌 관리</h1>
          <p className="text-muted-foreground mt-1">수시/정시 시즌 등록 및 관리</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={fetchSeasons}>
            새로고침
          </Button>
          <Button onClick={handleAddSeason}>
            <Plus className="w-4 h-4 mr-2" />
            시즌 등록
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">전체 시즌</p>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
              </div>
              <Trophy className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">진행 중</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">수시 시즌</p>
                <p className="text-2xl font-bold text-blue-600">{stats.early}</p>
              </div>
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">수</span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">정시 시즌</p>
                <p className="text-2xl font-bold text-orange-600">{stats.regular}</p>
              </div>
              <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                <span className="text-orange-600 dark:text-orange-400 font-bold text-sm">정</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <select
              className="px-3 py-2 border border-border bg-background text-foreground rounded-md text-sm"
              value={filters.year || ''}
              onChange={e => setFilters(prev => ({ ...prev, year: e.target.value ? parseInt(e.target.value) : undefined }))}
            >
              <option value="">모든 연도</option>
              {years.map(year => (
                <option key={year} value={year}>{year}년</option>
              ))}
            </select>
            <select
              className="px-3 py-2 border border-border bg-background text-foreground rounded-md text-sm"
              value={filters.season_type || ''}
              onChange={e => setFilters(prev => ({ ...prev, season_type: (e.target.value as SeasonType) || undefined }))}
            >
              <option value="">모든 시즌 타입</option>
              <option value="early">수시</option>
              <option value="regular">정시</option>
            </select>
            <select
              className="px-3 py-2 border border-border bg-background text-foreground rounded-md text-sm"
              value={filters.status || ''}
              onChange={e => setFilters(prev => ({ ...prev, status: (e.target.value as SeasonStatus) || undefined }))}
            >
              <option value="">모든 상태</option>
              <option value="active">진행중</option>
              <option value="completed">종료</option>
              <option value="cancelled">취소</option>
            </select>
            {(filters.year || filters.season_type || filters.status) && (
              <Button variant="ghost" size="sm" onClick={() => setFilters({})}>
                필터 초기화
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Season List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            시즌 목록 <span className="text-muted-foreground font-normal">({seasons.length}개)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : seasons.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">등록된 시즌이 없습니다.</p>
              <Button className="mt-4" onClick={handleAddSeason}>
                <Plus className="w-4 h-4 mr-2" />
                첫 시즌 등록하기
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">시즌명</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">타입</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">기간</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">운영요일</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">시즌비</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">상태</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {seasons.map(season => {
                    const operatingDays = parseOperatingDays(season.operating_days || []);
                    return (
                      <tr
                        key={season.id}
                        className="border-b border-border hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleSeasonClick(season.id)}
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">{season.name}</div>
                          <div className="text-sm text-muted-foreground">{new Date(season.start_date).getFullYear()}년</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            season.season_type === 'early' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
                          }`}>
                            {season.season_type ? SEASON_TYPE_LABELS[season.season_type] : '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          <div>{season.start_date} ~ {season.end_date}</div>
                          {season.non_season_end_date && (
                            <div className="text-xs text-muted-foreground/70">비시즌 종강: {season.non_season_end_date}</div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-muted-foreground">
                          {formatOperatingDays(operatingDays)}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-foreground">
                          {formatSeasonFee(season.fee)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              season.status === 'active'
                                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                : season.status === 'completed'
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                            }`}
                          >
                            {SEASON_STATUS_LABELS[season.status]}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/seasons/${season.id}/edit`)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSeason(season.id, season.name)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Help */}
      {!loading && seasons.length === 0 && (
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">시즌 관리 안내</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  시즌을 등록하면 학생들을 시즌에 등록하고 시즌비를 관리할 수 있습니다.
                  <br />
                  수시 시즌, 정시 시즌을 각각 생성하고 학생별 일할계산도 자동으로 처리됩니다.
                  <br />
                  <span className="font-medium">공무원 학생은 시즌 없이 연중 월회비로 운영됩니다.</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
