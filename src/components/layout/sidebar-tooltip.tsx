'use client';

import React, { useState, useRef } from 'react';

interface SidebarTooltipProps {
  children: React.ReactNode;
  label: string;
  collapsed: boolean;
}

export function SidebarTooltip({ children, label, collapsed }: SidebarTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ top: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (collapsed && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({ top: rect.top + rect.height / 2 });
      setShowTooltip(true);
    }
  };

  return (
    <div
      ref={buttonRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {collapsed && showTooltip && (
        <div
          className="fixed left-[68px] pl-2 z-[100] -translate-y-1/2"
          style={{ top: position.top }}
        >
          <div className="px-2 py-1 bg-popover border border-border rounded-md shadow-lg whitespace-nowrap">
            <span className="text-sm font-medium text-foreground">{label}</span>
          </div>
        </div>
      )}
    </div>
  );
}
