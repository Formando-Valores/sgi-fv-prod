import React from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const EmptyState: React.FC<Props> = ({ icon: Icon = Inbox, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center mb-5 ring-1 ring-surface-200/60">
      <Icon className="w-7 h-7 text-surface-400" />
    </div>
    <p className="text-sm font-bold text-surface-700 mb-1">{title}</p>
    {description && <p className="text-xs text-surface-400 max-w-xs leading-relaxed">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export default EmptyState;
