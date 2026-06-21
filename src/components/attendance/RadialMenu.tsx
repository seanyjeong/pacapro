'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';

type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

interface RadialMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (status: AttendanceStatus) => void;
  position: { x: number; y: number };
}

const menuItems = [
  { status: 'present' as AttendanceStatus, icon: CheckCircle2, label: '출석', color: 'bg-emerald-500' },
  { status: 'late' as AttendanceStatus, icon: Clock, label: '지각', color: 'bg-amber-500' },
  { status: 'absent' as AttendanceStatus, icon: XCircle, label: '결석', color: 'bg-red-500' },
  { status: 'excused' as AttendanceStatus, icon: AlertCircle, label: '공결', color: 'bg-blue-500' },
];

export function RadialMenu({ isOpen, onClose, onSelect, position }: RadialMenuProps) {
  const radius = 80;
  const angleStep = (Math.PI * 2) / menuItems.length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
          />

          {/* Radial Menu */}
          <div
            className="fixed z-50"
            style={{
              left: position.x,
              top: position.y,
            }}
          >
            {/* Center indicator */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-card border-2 border-primary shadow-lg"
            />

            {/* Menu items */}
            {menuItems.map((item, index) => {
              const angle = angleStep * index - Math.PI / 2;
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;

              return (
                <motion.button
                  key={item.status}
                  initial={{ scale: 0, x: 0, y: 0 }}
                  animate={{ scale: 1, x, y }}
                  exit={{ scale: 0, x: 0, y: 0 }}
                  transition={{ delay: index * 0.05, type: 'spring', stiffness: 300, damping: 20 }}
                  onClick={() => {
                    onSelect(item.status);
                    onClose();
                  }}
                  className={`
                    absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                    w-14 h-14 rounded-full ${item.color} text-white
                    flex flex-col items-center justify-center
                    shadow-lg hover:scale-110 transition-transform
                  `}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[9px] mt-0.5">{item.label}</span>
                </motion.button>
              );
            })}
          </div>
        </>
      )}
    </AnimatePresence>
  );
}