import { ADMISSION_FIELD_CLASS } from '@/constants/ilsan-admission';
import { cn } from '@/lib/utils/cn';

/** 입학원서 입력칸: 공통 칸 모양 위에 새 디자인(회색 채움·테두리 없음)을 덮는다. */
export const ADMISSION_FIELD = cn(
  ADMISSION_FIELD_CLASS,
  'rounded-xl border-transparent bg-muted focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10',
);
