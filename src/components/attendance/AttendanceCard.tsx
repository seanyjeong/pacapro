'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, AlertCircle, Phone } from 'lucide-react';
import { motion } from 'framer-motion';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export interface Student {
  student_id: number;
  student_name: string;
  grade?: string;
  attendance_status: AttendanceStatus | null;
  notes?: string | null;
  is_trial?: boolean;
  trial_remaining?: number;
  is_makeup?: boolean;
  is_season_student?: boolean;
  phone?: string;
  parent_phone?: string;
}

interface AttendanceCardProps {
  student: Student;
  onStatusChange: (status: AttendanceStatus) => void;
  onPhoneCall?: (phone?: string, parentPhone?: string) => void;
  layout?: 'compact' | 'standard' | 'tablet';
  saving?: boolean;
}

const STATUS_CONFIG = {
  present: { 
    label: '출석', 
    icon: CheckCircle2, 
    gradient: 'bg-attendance-present',
    lightBg: 'bg-emerald-100 dark:bg-emerald-900/30',
    lightText: 'text-emerald-700 dark:text-emerald-300',
    glow: 'glow-present'
  },
  late: { 
    label: '지각', 
    icon: Clock, 
    gradient: 'bg-attendance-late',
    lightBg: 'bg-amber-100 dark:bg-amber-900/30',
    lightText: 'text-amber-700 dark:text-amber-300',
    glow: 'glow-late'
  },
  absent: { 
    label: '결석', 
    icon: XCircle, 
    gradient: 'bg-attendance-absent',
    lightBg: 'bg-red-100 dark:bg-red-900/30',
    lightText: 'text-red-700 dark:text-red-300',
    glow: 'glow-absent'
  },
  excused: { 
    label: '공결', 
    icon: AlertCircle, 
    gradient: 'bg-attendance-excused',
    lightBg: 'bg-blue-100 dark:bg-blue-900/30',
    lightText: 'text-blue-700 dark:text-blue-300',
    glow: 'glow-excused'
  },
};

export function AttendanceCard({ 
  student, 
  onStatusChange, 
  onPhoneCall,
  layout = 'standard',
  saving = false 
}: AttendanceCardProps) {
  const [isChecking, setIsChecking] = useState(false);
  const currentStatus = student.attendance_status;
  const config = currentStatus ? STATUS_CONFIG[currentStatus] : null;

  const handleStatusClick = async (status: AttendanceStatus) => {
    setIsChecking(true);
    await onStatusChange(status);
    setTimeout(() => setIsChecking(false), 300);
  };

  const isCompact = layout === 'compact';
  const isTablet = layout === 'tablet';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: isTablet ? 1.02 : 1 }}
      className={`
        bg-card rounded-2xl shadow-sm overflow-hidden transition-shadow
        ${saving ? 'opacity-50 pointer-events-none' : ''}
        ${currentStatus && config ? `${config.glow}` : ''}
        ${isChecking ? 'animate-card-check' : ''}
        ${isCompact ? 'p-3' : isTablet ? 'p-3' : 'p-4'}
        ${currentStatus ? 'ring-2 ring-opacity-20' : ''}
        ${currentStatus === 'present' ? 'ring-emerald-500' : ''}
        ${currentStatus === 'late' ? 'ring-amber-500' : ''}
        ${currentStatus === 'absent' ? 'ring-red-500' : ''}
        ${currentStatus === 'excused' ? 'ring-blue-500' : ''}
      `}
    >
      {/* Header */}
      <div className={`flex items-center justify-between ${isCompact ? 'mb-2' : isTablet ? 'mb-2' : 'mb-3'}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`font-bold truncate ${isCompact ? 'text-base' : isTablet ? 'text-sm' : 'text-lg'}`}>
              {student.student_name}
            </p>
            
            {/* Compact Badges */}
            <div className="flex items-center gap-1 shrink-0">
              {student.is_season_student && (
                <span className={`px-1.5 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full shrink-0 ${isTablet ? 'text-[10px]' : 'text-xs'}`}>
                  시즌
                </span>
              )}
              {student.is_makeup && (
                <span className={`px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full shrink-0 ${isTablet ? 'text-[10px]' : 'text-xs'}`}>
                  보충
                </span>
              )}
              {student.is_trial && (() => {
                const remaining = student.trial_remaining ?? 2;
                const currentSession = Math.max(1, 2 - remaining + 1);
                return (
                  <span className={`px-1.5 py-0.5 rounded-full shrink-0 ${isTablet ? 'text-[10px]' : 'text-xs'} ${
                    remaining === 0
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                      : 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300'
                  }`}>
                    {remaining === 0 ? '완료' : `${currentSession}/2`}
                  </span>
                );
              })()}
            </div>
          </div>
          
          {student.grade && String(student.grade) !== '0' && String(student.grade) !== '00' && (
            <p className={`text-muted-foreground ${isCompact ? 'text-xs' : isTablet ? 'text-[11px]' : 'text-sm'}`}>
              {student.grade}
            </p>
          )}
        </div>

        {/* Phone Button */}
        {onPhoneCall && (student.phone || student.parent_phone) && !isTablet && (
          <button
            onClick={() => onPhoneCall(student.parent_phone, student.phone)}
            className="p-2 text-muted-foreground hover:text-emerald-500 dark:hover:text-emerald-400 transition shrink-0"
          >
            <Phone className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Current Status Badge - Compact for tablet */}
      {currentStatus && config && !isTablet && (
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`mb-2`}
        >
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white font-medium ${config.gradient} ${isCompact ? 'text-xs' : 'text-sm'}`}>
            <config.icon className={`${isCompact ? 'h-3 w-3' : 'h-4 w-4'}`} />
            <span>{config.label}</span>
          </div>
        </motion.div>
      )}

      {/* Reason Note - More compact */}
      {(currentStatus === 'absent' || currentStatus === 'excused') && student.notes && config && !isTablet && (
        <div className={`mb-2 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 ${config.lightBg} ${isCompact ? 'text-xs' : 'text-sm'}`}>
          <AlertCircle className={`${isCompact ? 'h-3 w-3' : 'h-4 w-4'} flex-shrink-0`} />
          <span className={`truncate ${config.lightText}`}>{student.notes}</span>
        </div>
      )}

      {/* Status Buttons - Responsive sizing */}
      <div className={`grid gap-2 ${isTablet ? 'grid-cols-2' : 'grid-cols-2'}`}>
        {(Object.keys(STATUS_CONFIG) as AttendanceStatus[]).map((status) => {
          const statusConfig = STATUS_CONFIG[status];
          const isActive = currentStatus === status;
          
          return (
            <motion.button
              key={status}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleStatusClick(status)}
              disabled={saving}
              className={`
                rounded-xl font-medium transition-all flex items-center justify-center gap-1.5
                ${isCompact ? 'py-2.5 text-sm' : isTablet ? 'py-2 text-xs' : 'py-3 text-sm'}
                ${isActive 
                  ? `${statusConfig.gradient} text-white shadow-md` 
                  : `${statusConfig.lightBg} ${statusConfig.lightText}`
                }
                hover:shadow-lg active:scale-95
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {isTablet && <statusConfig.icon className="h-3 w-3" />}
              <span>{statusConfig.label}</span>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}