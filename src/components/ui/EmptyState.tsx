import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="w-14 h-14 rounded-2xl bg-[#4F6BFF]/10 flex items-center justify-center mb-5 text-[#4F6BFF]" style={{ boxShadow: '0 0 24px rgba(59,130,246,0.1)' }}>{icon}</div>
      <h3 className="text-base font-bold mb-1.5 text-foreground">{title}</h3>
      <p className="text-sm mb-6 text-center max-w-sm font-medium text-muted-foreground">{description}</p>
      {action}
    </div>
  );
}
