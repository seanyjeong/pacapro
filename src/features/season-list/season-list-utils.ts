import type { Season } from '@/lib/types/season';

export const SEASON_LIST_LOAD_ERROR = '시즌 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
export const SEASON_DELETE_ERROR = '시즌을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.';

export function getSeasonStats(seasons: Season[]) {
  return {
    active: seasons.filter((season) => season.status === 'active').length,
    early: seasons.filter((season) => season.season_type === 'early').length,
    regular: seasons.filter((season) => season.season_type === 'regular').length,
    total: seasons.length,
  };
}

export function getSeasonYears(seasons: Season[]): number[] {
  const currentYear = new Date().getFullYear();
  const years = new Set<number>([currentYear, currentYear + 1]);
  seasons.forEach((season) => years.add(new Date(season.season_start_date).getFullYear()));
  return Array.from(years).sort((a, b) => b - a);
}

export function formatDateRange(startDate: string, endDate: string): string {
  return `${startDate} ~ ${endDate}`;
}

export function selectPrimarySeason(seasons: Season[]): Season | null {
  return (
    seasons.find((season) => season.status === 'active') ||
    seasons.find((season) => season.status === 'upcoming' || season.status === 'draft') ||
    seasons[0] ||
    null
  );
}
