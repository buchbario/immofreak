interface ProgressBarProps {
  percentage: number;
  color?: string;
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({ percentage, color, className, showLabel = true }: ProgressBarProps) {
  return (
    <div className={`space-y-1 ${className || ''}`}>
      <div className="flex w-full h-1.5 rounded-full overflow-hidden bg-white/5">
        <div
          className={`flex flex-col justify-center rounded-full overflow-hidden transition-all duration-500 ${color || 'bg-[#4F6BFF]'}`}
          role="progressbar"
          style={{ width: `${Math.min(percentage, 100)}%` }}
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-right text-muted-foreground-2">{percentage}%</p>
      )}
    </div>
  );
}
