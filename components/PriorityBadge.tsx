import { cn, priorityColors } from '@/lib/utils';

type Priority = keyof typeof priorityColors;

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

export default function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const key = priority as Priority;
  const colors =
    priorityColors[key] ?? 'text-slate-400 bg-slate-400/10 border-slate-400/20';

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border capitalize',
        colors,
        className,
      )}
    >
      {priority}
    </span>
  );
}
