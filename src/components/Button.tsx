import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import React, { useCallback, useRef, useState } from 'react';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-500',
        ghost: 'bg-transparent text-[color:var(--muted)] hover:text-white hover:bg-white/5',
        outline: 'border border-white/10 text-white hover:bg-white/5',
        destructive: 'bg-red-600 text-white hover:bg-red-500',
      },
      size: {
        sm: 'h-8 px-3',
        md: 'h-9 px-4',
        lg: 'h-10 px-5 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

function useButtonRipple() {
  const [rippling, setRippling] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const start = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    e.currentTarget.style.setProperty('--ripple-x', x + '%');
    e.currentTarget.style.setProperty('--ripple-y', y + '%');
    setRippling(true);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setRippling(false), 450);
  }, []);
  return { rippling, start };
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant, size, className, onClick, ...props }, ref) {
  const { rippling, start } = useButtonRipple();
  return (
    <button
      ref={ref}
      className={clsx(buttonVariants({ variant, size }), className, rippling && 'rippling')}
      onClick={(e) => { start(e); onClick?.(e); }}
      {...props}
    />
  );
});
