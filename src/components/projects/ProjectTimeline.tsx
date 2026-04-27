import { Check } from 'lucide-react';
import { PROJECT_STATUSES } from '../../types';
import type { ProjectStatus } from '../../types';
import { cn } from '../../lib/utils';

interface ProjectTimelineProps {
  currentStatus: ProjectStatus;
  onStatusChange?: (status: ProjectStatus) => void;
}

export function ProjectTimeline({ currentStatus, onStatusChange }: ProjectTimelineProps) {
  const currentIndex = PROJECT_STATUSES.indexOf(currentStatus);

  return (
    <div className="flex flex-wrap items-center gap-2 w-full">
      {PROJECT_STATUSES.map((status, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <div key={status} className="flex items-center flex-1">
            <button
              onClick={() => onStatusChange?.(status)}
              disabled={!onStatusChange}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors w-full',
                isCompleted && 'bg-emerald-500/10 text-emerald-400',
                isCurrent && 'bg-[#4F6BFF] text-white',
                !isCompleted && !isCurrent && 'border bg-card border-card-line text-muted-foreground',
                onStatusChange && 'cursor-pointer hover:opacity-80'
              )}
            >
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                isCompleted && 'bg-emerald-500 text-white',
                isCurrent && 'bg-white text-blue-600',
                !isCompleted && !isCurrent && 'bg-muted text-muted-foreground',
              )}
              >
                {isCompleted ? <Check size={14} /> : index + 1}
              </div>
              <span className="truncate">{status}</span>
            </button>
            {index < PROJECT_STATUSES.length - 1 && (
              <div className={cn(
                'w-4 h-0.5 flex-shrink-0 mx-1',
                index < currentIndex ? 'bg-emerald-500' : 'bg-card-line'
              )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
