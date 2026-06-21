'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { Search, Zap, BarChart3, Filter, Undo2, Redo2, GripVertical } from 'lucide-react';

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

const STORAGE_KEY = 'quickActionsToolbarPosition';

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
  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // 저장된 위치 불러오기
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const pos = JSON.parse(saved);
        setDragPosition(pos);
      } catch {
        // ignore
      }
    }
  }, []);

  // 위치 저장
  const handleDragEnd = (_: any, info: { offset: { x: number; y: number } }) => {
    const newPos = {
      x: dragPosition.x + info.offset.x,
      y: dragPosition.y + info.offset.y,
    };
    setDragPosition(newPos);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPos));
    setIsDragging(false);
  };

  return (
    <>
      {/* 드래그 영역 제한용 (전체 화면) */}
      <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-30" />

      <motion.div
        drag
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={constraintsRef}
        dragElastic={0.1}
        dragMomentum={false}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={handleDragEnd}
        initial={{
          x: dragPosition.x,
          y: dragPosition.y,
          opacity: 0,
          scale: 0.9
        }}
        animate={{
          x: dragPosition.x,
          y: dragPosition.y,
          opacity: 1,
          scale: 1
        }}
        exit={{ opacity: 0, scale: 0.9 }}
        className={`
          fixed ${position === 'bottom' ? 'bottom-4' : 'top-20'} left-1/2 -translate-x-1/2
          glass-strong rounded-2xl shadow-2xl px-2 py-3 z-40
          flex items-center gap-1
          ${isDragging ? 'cursor-grabbing shadow-3xl scale-105' : ''}
          ${className}
        `}
        style={{ touchAction: 'none' }}
      >
        {/* 드래그 핸들 */}
        <motion.div
          onPointerDown={(e) => dragControls.start(e)}
          className="p-2 rounded-lg cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors touch-none"
          title="드래그해서 이동"
        >
          <GripVertical className="h-5 w-5" />
        </motion.div>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Undo/Redo - Desktop only */}
        <div className="hidden md:flex items-center gap-1 border-r border-border pr-2">
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
    </>
  );
}
