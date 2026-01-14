/**
 * P-ACA Design Tokens
 * 일관된 디자인을 위한 표준 정의
 * 
 * 사용법:
 * import { tokens } from '@/lib/design-tokens';
 * <div className={cn(tokens.shadow.sm, tokens.border.default)}>
 */

export const tokens = {
  /**
   * Shadows - Minimal & Subtle
   */
  shadow: {
    sm: 'shadow-[0_1px_2px_0_rgba(0,0,0,0.02)] dark:shadow-[0_1px_2px_0_rgba(0,0,0,0.1)]',
    md: 'shadow-[0_2px_4px_0_rgba(0,0,0,0.04)] dark:shadow-[0_2px_4px_0_rgba(0,0,0,0.1)]',
    lg: 'shadow-[0_4px_8px_0_rgba(0,0,0,0.06)] dark:shadow-[0_4px_8px_0_rgba(0,0,0,0.12)]',
  },

  /**
   * Spacing - 8px Grid System
   */
  spacing: {
    card: 'p-6',
    cardHeader: 'px-6 py-4',
    page: 'p-4 md:p-6',
    modal: 'px-6 py-6',
    section: 'space-y-8',
    gap: 'gap-4',
    gapSm: 'gap-3',
    gapLg: 'gap-6',
  },

  /**
   * Typography - Pretendard Variable
   */
  typography: {
    // Headings
    pageTitle: 'text-3xl font-bold tracking-tight',
    sectionTitle: 'text-2xl font-semibold',
    cardTitle: 'text-lg font-semibold',
    subheading: 'text-base font-semibold',

    // Body
    body: 'text-sm',
    bodyLarge: 'text-base',
    label: 'text-sm font-medium',
    
    // Small
    caption: 'text-xs text-muted-foreground',
    help: 'text-xs text-muted-foreground',
  },

  /**
   * Icon Sizes
   */
  iconSize: {
    xs: 'w-3 h-3',   // 12px - badge, inline
    sm: 'w-4 h-4',   // 16px - 인라인, 서브메뉴
    md: 'w-5 h-5',   // 20px - 기본 (네비, 버튼)
    lg: 'w-6 h-6',   // 24px - 강조 (카드)
    xl: 'w-8 h-8',   // 32px - 큰 카드
  },

  /**
   * Borders
   */
  border: {
    default: 'border-border/50',
    solid: 'border-border',
    radius: {
      sm: 'rounded-md',
      md: 'rounded-lg',
      lg: 'rounded-xl',
      full: 'rounded-full',
    },
  },

  /**
   * Transitions - Subtle & Fast
   */
  transition: {
    default: 'transition-colors duration-200',
    all: 'transition-all duration-300',
    fast: 'transition-all duration-150',
  },

  /**
   * Hover Effects
   */
  hover: {
    lift: 'hover:-translate-y-1 transition-transform duration-200',
    scale: 'hover:scale-105 transition-transform duration-200',
    bg: 'hover:bg-muted transition-colors',
  },
} as const;

/**
 * 컴포넌트별 조합된 스타일
 */
export const components = {
  card: {
    base: `${tokens.border.radius.lg} ${tokens.border.default} bg-card ${tokens.shadow.sm}`,
    hover: `${tokens.hover.lift} ${tokens.shadow.md}`,
  },
  button: {
    base: `${tokens.border.radius.md} ${tokens.transition.default} font-medium`,
  },
  input: {
    base: `${tokens.border.radius.md} ${tokens.border.default} bg-background ${tokens.typography.body}`,
  },
} as const;