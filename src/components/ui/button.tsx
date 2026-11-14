import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl text-[15px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                default: 'bg-primary text-primary-foreground hover:bg-primary/90',
                destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                outline: 'bg-secondary text-secondary-foreground hover:bg-secondary/70 hover:text-foreground',
                secondary: 'bg-primary-soft text-primary hover:bg-primary-soft/70',
                ghost: 'text-secondary-foreground hover:bg-muted hover:text-foreground',
                link: 'h-auto px-0 text-primary underline-offset-4 hover:underline',
                gradient: 'bg-primary text-primary-foreground hover:bg-primary/90',
                soft: 'bg-primary-soft text-primary hover:bg-primary-soft/70',
            },
            size: {
                default: 'h-11 px-4',
                sm: 'h-9 rounded-lg px-3 text-sm',
                lg: 'h-14 rounded-2xl px-6 text-base',
                icon: 'h-11 w-11',
                'icon-sm': 'h-9 w-9 rounded-lg',
                'icon-lg': 'h-12 w-12',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, ...props }, ref) => {
        return (
            <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
        );
    }
);
Button.displayName = 'Button';

export { Button, buttonVariants };