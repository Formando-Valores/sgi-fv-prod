import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'warning';
type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm hover:shadow-md active:bg-brand-800',
  secondary: 'bg-surface-100 hover:bg-surface-200 text-surface-700 border border-surface-200 hover:border-surface-300',
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm hover:shadow-md active:bg-red-800',
  ghost: 'bg-transparent hover:bg-surface-100 text-surface-600 hover:text-surface-800',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:bg-emerald-800',
  warning: 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm active:bg-amber-700',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
  md: 'px-4 py-2.5 text-sm rounded-xl gap-2',
  lg: 'px-6 py-3.5 text-base rounded-xl gap-2.5',
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

const Button: React.FC<ButtonProps> = ({
  className = '',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  ...props
}) => (
  <button
    type="button"
    disabled={disabled || loading}
    className={`
      inline-flex items-center justify-center font-semibold transition-all duration-150
      focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
      active:scale-[0.98] select-none
      ${variantClasses[variant]} ${sizeClasses[size]} ${className}
    `.trim()}
    {...props}
  >
    {loading && (
      <svg className="animate-spin -ml-0.5 h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    )}
    {children}
  </button>
);

export default Button;
