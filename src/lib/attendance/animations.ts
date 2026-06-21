import { Variants } from 'framer-motion';

export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.3,
      ease: 'easeOut',
    },
  }),
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.4,
      ease: 'easeOut',
    },
  },
};

export const scaleIn: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: { 
    scale: 1, 
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 20,
    },
  },
};

export const checkAnimation: Variants = {
  initial: { scale: 0, rotate: -180 },
  animate: { 
    scale: 1, 
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 20,
    },
  },
};

export const swipeRevealVariants = {
  left: {
    x: '-100%',
    opacity: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  right: {
    x: '100%',
    opacity: 0,
    transition: { duration: 0.3, ease: 'easeOut' }
  },
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.3, ease: 'easeOut' }
  }
};