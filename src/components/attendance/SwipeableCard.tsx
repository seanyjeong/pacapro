'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';
import { haptics } from '@/lib/attendance/haptics';

interface SwipeableCardProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  className?: string;
}

export function SwipeableCard({
  children,
  onSwipeLeft,
  onSwipeRight,
  onLongPress,
  disabled = false,
  className = '',
}: SwipeableCardProps) {
  const x = useMotionValue(0);
  const constraintsRef = useRef(null);
  
  // Background color based on swipe direction
  const backgroundColorLeft = useTransform(
    x,
    [-150, 0],
    ['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0)']
  );
  
  const backgroundColorRight = useTransform(
    x,
    [0, 150],
    ['rgba(16, 185, 129, 0)', 'rgba(16, 185, 129, 0.2)']
  );

  const iconOpacityLeft = useTransform(x, [-150, -50, 0], [1, 0.5, 0]);
  const iconOpacityRight = useTransform(x, [0, 50, 150], [0, 0.5, 1]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const swipeThreshold = 100;
    
    if (info.offset.x < -swipeThreshold && onSwipeLeft) {
      haptics.buttonPress();
      onSwipeLeft();
      x.set(0);
    } else if (info.offset.x > swipeThreshold && onSwipeRight) {
      haptics.buttonPress();
      onSwipeRight();
      x.set(0);
    } else {
      x.set(0);
    }
  };

  if (disabled || (!onSwipeLeft && !onSwipeRight)) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className="relative overflow-hidden" ref={constraintsRef}>
      {/* Background indicators */}
      <motion.div
        className="absolute inset-0 flex items-center justify-start pl-6 pointer-events-none"
        style={{ backgroundColor: backgroundColorLeft }}
      >
        <motion.div style={{ opacity: iconOpacityLeft }}>
          <XCircle className="h-8 w-8 text-red-500" />
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-6 pointer-events-none"
        style={{ backgroundColor: backgroundColorRight }}
      >
        <motion.div style={{ opacity: iconOpacityRight }}>
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </motion.div>
      </motion.div>

      {/* Swipeable content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -200, right: 200 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={className}
        whileTap={{ cursor: 'grabbing' }}
      >
        {children}
      </motion.div>
    </div>
  );
}