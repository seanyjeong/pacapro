'use client';

import { motion } from 'framer-motion';
import { Search, Zap, BarChart3, Settings, Filter, Undo2, Redo2 } from 'lucide-react';

interface QuickActionsToolbarProps {
  onQuickAttendance?: () => void;
  onSearch?: () => void;
  onStats?: () => void;
  onFilter?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  position?: 'bottom' | 'top';
  className?: string;
}

export function QuickActionsToolbar({
  onQuickAttendance,
  onSearch,
  onStats,
  onFilter,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  position = 'bottom',
  className = '',
}: QuickActionsToolbarProps) {
  return (
    <motion.div
      initial={{ y: position === 'bottom' ? 100 : -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: position === 'bottom' ? 100 : -100, opacity: 0 }}
      className={`
        fixed ${position === 'bottom' ? 'bottom-4' : 'top-20'} left-1/2 -translate-x-1/2
        glass-strong rounded-2xl shadow-2xl px-4 py-3 z-40
        flex items-center gap-2
        ${className}
      `}
    >
      {/* Undo/Redo - Desktop only */}
      <div className="hidden md:flex items-center gap-1 mr-2 border-r border-border pr-2">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-2 rounded-lg transition-colors ${
            canUndo
              ? 'text-foreground hover:bg-secondary'
              : 'text-muted-foreground/30 cursor-not-allowed'
          }`}
          title="실행 취소 (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-2 rounded-lg transition-colors ${
            canRedo
              ? 'text-foreground hover:bg-secondary'
              : 'text-muted-foreground/30 cursor-not-allowed'
          }`}
          title="다시 실행 (Ctrl+Shift+Z)"
        >
          <Redo2 className="h-4 w-4" />
        </motion.button>
      </div>

      {/* Main Actions */}
      {onSearch && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onSearch}
          className="p-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground transition-all"
          title="검색 (/)"
        >
          <Search className="h-5 w-5" />
        </motion.button>
      )}

      {onQuickAttendance && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onQuickAttendance}
          className="px-4 py-3 rounded-xl bg-attendance-present text-white font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
          title="전체 출석"
        >
          <Zap className="h-5 w-5" />
          <span className="hidden sm:inline">전체 출석</span>
        </motion.button>
      )}

      {onStats && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onStats}
          className="p-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground transition-all"
          title="통계"
        >
          <BarChart3 className="h-5 w-5" />
        </motion.button>
      )}

      {onFilter && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onFilter}
          className="p-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground transition-all"
          title="필터"
        >
          <Filter className="h-5 w-5" />
        </motion.button>
      )}
    </motion.div>
  );
}