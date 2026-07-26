import React from 'react';
import type { LucideIcon } from 'lucide-react';

type InputSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<InputSize, string> = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-4 py-3 text-base',
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: LucideIcon;
  size?: InputSize;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, hint, icon: Icon, size = 'md', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-semibold text-surface-700">
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400 pointer-events-none" />
          )}
          <input
            ref={ref}
            id={inputId}
            className={`
              w-full bg-white border rounded-xl text-surface-800 font-medium
              placeholder:text-surface-400
              transition-all duration-150
              focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500
              disabled:bg-surface-50 disabled:text-surface-400 disabled:cursor-not-allowed
              ${error ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-surface-200 hover:border-surface-300'}
              ${Icon ? 'pl-10' : ''}
              ${sizeClasses[size]}
              ${className}
            `.trim()}
            {...props}
          />
        </div>
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-surface-400">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
