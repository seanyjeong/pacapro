'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, HelpCircle } from 'lucide-react';

interface ReasonBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  studentName: string;
  type: 'absent' | 'excused';
}

const EXCUSED_REASONS = [
  { value: '질병', label: '질병' },
  { value: '학교시험', label: '학교 시험' },
];

const ABSENT_REASONS = [
  { value: '개인사정', label: '개인 사정' },
  { value: '무단결석', label: '무단 결석' },
  { value: '기타', label: '기타' },
];

export function ReasonBottomSheet({
  isOpen,
  onClose,
  onConfirm,
  studentName,
  type,
}: ReasonBottomSheetProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const reasons = type === 'excused' ? EXCUSED_REASONS : ABSENT_REASONS;
  const isExcused = type === 'excused';

  const handleConfirm = () => {
    const finalReason = selectedReason === '기타' ? customReason : selectedReason;
    if (finalReason.trim()) {
      onConfirm(finalReason);
      setSelectedReason('');
      setCustomReason('');
    }
  };

  const handleClose = () => {
    onClose();
    setSelectedReason('');
    setCustomReason('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-end justify-center z-50"
          onClick={handleClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="glass-strong w-full max-w-lg rounded-t-3xl p-6 pb-8 safe-area-pb shadow-2xl border-t border-border"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <AlertCircle className={`h-5 w-5 ${isExcused ? 'text-blue-500' : 'text-red-500'}`} />
                {isExcused ? '공결 사유' : '결석 사유'}
              </h3>
              <button onClick={handleClose} className="p-2 text-muted-foreground hover:text-foreground transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Student Info */}
            <div className="text-center py-4 mb-4 bg-secondary rounded-xl">
              <p className="font-semibold text-xl">{studentName}</p>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${
                isExcused
                  ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400'
                  : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
              }`}>
                {isExcused ? '공결' : '결석'}
              </span>
            </div>

            {/* Info Box */}
            {isExcused && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-2">
                  <HelpCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-semibold mb-1">공결이란?</p>
                    <p className="text-blue-700 dark:text-blue-400">
                      공식적 결석으로, 원장님의 승인이 필요합니다.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Reason Selection */}
            <div className="space-y-2 mb-4">
              <label className="text-sm font-medium">사유 선택</label>
              <div className="grid grid-cols-2 gap-2">
                {reasons.map((option) => (
                  <motion.button
                    key={option.value}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => {
                      setSelectedReason(option.value);
                      setCustomReason('');
                    }}
                    className={`p-4 border-2 rounded-xl text-sm font-medium transition-all ${
                      selectedReason === option.value
                        ? isExcused
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 shadow-md'
                          : 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 shadow-md'
                        : 'border-border bg-secondary text-foreground hover:border-muted-foreground'
                    }`}
                  >
                    {option.label}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Custom Input for 기타 */}
            <AnimatePresence>
              {selectedReason === '기타' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-2 mb-4 overflow-hidden"
                >
                  <label className="text-sm font-medium">사유 입력</label>
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="사유를 입력하세요..."
                    rows={3}
                    autoFocus
                    className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleClose}
                className="flex-1 py-4 rounded-xl font-medium bg-secondary text-muted-foreground hover:bg-secondary/80 transition-all"
              >
                취소
              </button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleConfirm}
                disabled={!selectedReason || (selectedReason === '기타' && !customReason.trim())}
                className={`flex-1 py-4 rounded-xl font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  isExcused
                    ? 'bg-attendance-excused hover:shadow-lg'
                    : 'bg-attendance-absent hover:shadow-lg'
                }`}
              >
                확인
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}