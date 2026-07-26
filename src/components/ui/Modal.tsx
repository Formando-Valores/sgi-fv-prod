import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
};

const Modal: React.FC<ModalProps> = ({ open, onClose, title, description, size = 'md', children, footer }) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-surface-900/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`
          relative w-full ${sizeClasses[size]} bg-white rounded-2xl shadow-elevated
          animate-scale-in max-h-[90vh] flex flex-col
        `}
      >
        {(title || description) && (
          <div className="flex items-start justify-between px-6 pt-6 pb-0">
            <div className="min-w-0">
              {title && <h2 className="text-lg font-bold text-surface-800">{title}</h2>}
              {description && <p className="text-sm text-surface-500 mt-1">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="ml-4 p-2 rounded-xl text-surface-400 hover:text-surface-600 hover:bg-surface-100 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-surface-100 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
