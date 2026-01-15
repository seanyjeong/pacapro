'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  permissionKey?: string;
  ownerOnly?: boolean;
}

interface NavCategory {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  defaultOpen?: boolean;
}

interface CollapsedCategoryMenuProps {
  category: NavCategory;
  hasActiveChild: boolean;
  pathname: string;
  canAccessMenu: (item: NavItem) => boolean;
  consultationCounts: { newInquiry: number; enrolled: number };
}

export function CollapsedCategoryMenu({
  category,
  hasActiveChild,
  pathname,
  canAccessMenu,
  consultationCounts,
}: CollapsedCategoryMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [position, setPosition] = useState({ top: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const CategoryIcon = category.icon;

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({ top: rect.top });
      setShowMenu(true);
    }
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowMenu(false);
    }, 150);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'w-full flex items-center justify-center p-2.5 rounded-lg text-sm font-medium transition-colors',
          hasActiveChild
            ? 'bg-primary/10 text-primary'
            : 'text-foreground hover:bg-muted'
        )}
      >
        <CategoryIcon className={cn('w-5 h-5', hasActiveChild ? 'text-primary' : 'text-muted-foreground')} />
      </button>
      {showMenu && (
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="fixed left-[52px] pl-5 z-[100]"
          style={{ top: position.top }}
        >
          <div className="min-w-[180px] bg-popover border border-border rounded-lg shadow-xl">
            <div className="px-3 py-2 border-b border-border">
              <span className="text-sm font-semibold text-foreground">{category.title}</span>
            </div>
            <ul className="py-1">
              {category.items.filter(canAccessMenu).map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setShowMenu(false)}
                      className={cn(
                        'flex items-center space-x-2 px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-foreground/80 hover:bg-muted'
                      )}
                    >
                      <Icon className={cn('w-4 h-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                      <span>{item.title}</span>
                      {item.href === '/consultations/new-inquiry' && consultationCounts.newInquiry > 0 && (
                        <span className="ml-auto bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                          {consultationCounts.newInquiry}
                        </span>
                      )}
                      {item.href === '/consultations/enrolled' && consultationCounts.enrolled > 0 && (
                        <span className="ml-auto bg-blue-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                          {consultationCounts.enrolled}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
