/**
 * Haptic feedback utilities for mobile devices
 * Provides tactile feedback for user interactions
 */

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

/**
 * Check if haptic feedback is available
 */
export function isHapticSupported(): boolean {
  return 'vibrate' in navigator;
}

/**
 * Trigger haptic feedback
 */
export function triggerHaptic(type: HapticType = 'light'): void {
  if (!isHapticSupported()) return;

  const patterns: Record<HapticType, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 10],
    warning: [20, 100, 20],
    error: [30, 100, 30, 100, 30],
  };

  const pattern = patterns[type];
  
  if (Array.isArray(pattern)) {
    navigator.vibrate(pattern);
  } else {
    navigator.vibrate(pattern);
  }
}

/**
 * Haptic feedback for attendance status selection
 */
export function hapticForStatus(status: 'present' | 'absent' | 'late' | 'excused'): void {
  const hapticMap: Record<string, HapticType> = {
    present: 'success',
    late: 'warning',
    absent: 'error',
    excused: 'medium',
  };

  triggerHaptic(hapticMap[status] || 'light');
}

/**
 * Haptic feedback for UI interactions
 */
export const haptics = {
  tap: () => triggerHaptic('light'),
  buttonPress: () => triggerHaptic('medium'),
  success: () => triggerHaptic('success'),
  error: () => triggerHaptic('error'),
  warning: () => triggerHaptic('warning'),
};