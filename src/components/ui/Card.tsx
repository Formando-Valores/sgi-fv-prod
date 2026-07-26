import React from 'react';

type CardVariant = 'default' | 'elevated' | 'bordered' | 'flat';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-white border border-surface-200/60 shadow-card',
  elevated: 'bg-white shadow-elevated border border-surface-100',
  bordered: 'bg-white border-2 border-surface-200',
  flat: 'bg-surface-50 border border-surface-200/60',
};

const paddingClasses: Record<CardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  padding?: CardPadding;
};

const Card: React.FC<CardProps> = ({
  className = '',
  variant = 'default',
  padding = 'md',
  ...props
}) => (
  <div
    className={`rounded-2xl transition-shadow duration-200 ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`.trim()}
    {...props}
  />
);

export const CardHeader: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <div className={`mb-4 ${className}`.trim()}>{children}</div>
);

export const CardTitle: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <h3 className={`text-lg font-bold text-surface-800 ${className}`.trim()}>{children}</h3>
);

export const CardDescription: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <p className={`text-sm text-surface-500 mt-1 ${className}`.trim()}>{children}</p>
);

export default Card;
