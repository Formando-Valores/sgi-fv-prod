import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-blue-500 hover:bg-blue-600 text-white',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const Button: React.FC<ButtonProps> = ({ className = '', variant = 'primary', type = 'button', ...props }) => (
  <button
    type={type}
    className={`rounded-lg px-4 py-2 font-semibold transition-colors ${variantClasses[variant]} ${className}`.trim()}
    {...props}
  />
);

export default Button;
