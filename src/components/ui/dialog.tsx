'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onOpenChange(false);
  };

  return (
    <div
      className="fixed inset-0 z-50"
      onClick={(event) => event.stopPropagation()}
    >
      {/* Backdrop + Content Container */}
      <div
        className="fixed inset-0 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-4"
        onClick={handleBackdropClick}
      >
        {children}
      </div>
    </div>
  );
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogContent({ children, className }: DialogContentProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className={cn(
        'relative w-full max-w-lg overflow-y-auto bg-card text-card-foreground',
        'max-h-[92vh] rounded-t-3xl pb-[env(safe-area-inset-bottom)] sm:max-h-[85vh] sm:rounded-3xl sm:pb-0',
        'shadow-[0_16px_48px_rgba(0,0,0,0.16)]',
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

interface DialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return (
    <div className={cn('px-6 pb-2 pt-6', className)}>
      {children}
    </div>
  );
}

interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogTitle({ children, className }: DialogTitleProps) {
  return (
    <h2 className={cn('text-xl font-bold tracking-tight text-foreground', className)}>
      {children}
    </h2>
  );
}

interface DialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogDescription({ children, className }: DialogDescriptionProps) {
  return (
    <p className={cn('mt-1.5 text-[15px] text-muted-foreground', className)}>
      {children}
    </p>
  );
}

interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div className={cn('flex justify-end gap-2 px-6 pb-6 pt-3', className)}>
      {children}
    </div>
  );
}
