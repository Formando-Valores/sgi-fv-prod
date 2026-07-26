import React from 'react';
import type { LucideIcon } from 'lucide-react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';
type BadgeSize = 'sm' | 'md';

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  warning: 'bg-amber-50 text-amber-700 border-amber-200/60',
  danger: 'bg-red-50 text-red-700 border-red-200/60',
  info: 'bg-brand-50 text-brand-700 border-brand-200/60',
  neutral: 'bg-surface-100 text-surface-600 border-surface-200/60',
  brand: 'bg-brand-50 text-brand-700 border-brand-200/60',
};

const dotColors: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-brand-500',
  neutral: 'bg-surface-400',
  brand: 'bg-brand-500',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
};

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: LucideIcon;
  dot?: boolean;
};

const Badge: React.FC<BadgeProps> = ({
  className = '',
  variant = 'neutral',
  size = 'md',
  icon: Icon,
  dot = false,
  children,
  ...props
}) => (
  <span
    className={`inline-flex items-center gap-1.5 font-semibold border rounded-full ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim()}
    {...props}
  >
    {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
    {Icon && <Icon className="w-3 h-3" />}
    {children}
  </span>
);

export default Badge;
