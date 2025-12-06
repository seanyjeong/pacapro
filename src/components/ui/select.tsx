import * as React from 'react';
import { cn } from '@/lib/utils/cn';
import { ChevronDown, Check } from 'lucide-react';

// Context for Select
const SelectContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled: boolean;
  items: Map<string, React.ReactNode>;
  registerItem: (value: string, label: React.ReactNode) => void;
}>({
  value: '',
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
  disabled: false,
  items: new Map(),
  registerItem: () => {},
});

// Select Root
interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

const Select = ({ value, defaultValue, onValueChange, disabled, children }: SelectProps) => {
  const [internalValue, setInternalValue] = React.useState(defaultValue || '');
  const [open, setOpen] = React.useState(false);
  const [items] = React.useState(() => new Map<string, React.ReactNode>());
  const currentValue = value ?? internalValue;

  const handleValueChange = React.useCallback((newValue: string) => {
    setInternalValue(newValue);
    onValueChange?.(newValue);
    setOpen(false);
  }, [onValueChange]);

  const registerItem = React.useCallback((itemValue: string, label: React.ReactNode) => {
    items.set(itemValue, label);
  }, [items]);

  return (
    <SelectContext.Provider value={{ value: currentValue, onValueChange: handleValueChange, open, setOpen, disabled: disabled || false, items, registerItem }}>
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  );
};

// Select Trigger
interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen, disabled } = React.useContext(SelectContext);

    return (
      <button
        type="button"
        ref={ref}
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className={cn('h-4 w-4 opacity-50 transition-transform', open && 'rotate-180')} />
      </button>
    );
  }
);
SelectTrigger.displayName = 'SelectTrigger';

// Select Value
interface SelectValueProps {
  placeholder?: string;
}

const SelectValue = ({ placeholder }: SelectValueProps) => {
  const { value, items } = React.useContext(SelectContext);
  // items에서 라벨을 찾고, 없으면 placeholder 사용 (value는 표시하지 않음)
  const displayLabel = items.get(value);
  const displayText = displayLabel || placeholder || '';
  return <span className={cn(!displayLabel && 'text-gray-500')}>{displayText}</span>;
};

// Select Content
interface SelectContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen } = React.useContext(SelectContext);
    const contentRef = React.useRef<HTMLDivElement>(null);

    // Close on click outside (but not on trigger button - it handles its own toggle)
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        // SelectTrigger 버튼 클릭은 무시 (버튼이 자체적으로 토글 처리)
        if (target.closest('button[type="button"]')) {
          return;
        }
        if (contentRef.current && !contentRef.current.contains(target)) {
          setOpen(false);
        }
      };

      if (open) {
        // mousedown 대신 click 사용 (버튼 클릭 완료 후 처리)
        document.addEventListener('click', handleClickOutside);
      }

      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }, [open, setOpen]);

    if (!open) return null;

    return (
      <div
        ref={contentRef}
        className={cn(
          'absolute z-[100] mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SelectContent.displayName = 'SelectContent';

// Select Item
interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, children, value, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    const isSelected = context.value === value;

    // 아이템 등록 (라벨 매핑용)
    React.useEffect(() => {
      context.registerItem(value, children);
    }, [value, children, context]);

    return (
      <div
        ref={ref}
        onClick={() => context.onValueChange(value)}
        className={cn(
          'relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-gray-100 focus:bg-gray-100',
          isSelected && 'bg-gray-100',
          className
        )}
        {...props}
      >
        {isSelected && (
          <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            <Check className="h-4 w-4" />
          </span>
        )}
        {children}
      </div>
    );
  }
);
SelectItem.displayName = 'SelectItem';

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
};
