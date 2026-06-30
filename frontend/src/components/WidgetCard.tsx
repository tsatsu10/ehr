import type { ReactNode } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { cn } from '@/lib/utils';

interface WidgetCardProps {
  title?: ReactNode;
  actions?: ReactNode;
  bodyPad?: 'flush' | 'pad';
  className?: string;
  id?: string;
  headerClassName?: string;
  children: ReactNode;
}

export function WidgetCard({
  title,
  actions,
  bodyPad = 'flush',
  className,
  id,
  headerClassName,
  children,
}: WidgetCardProps) {
  const showHeader = title != null || actions != null;

  return (
    <Card className={cn('overflow-hidden', className)} id={id}>
      {showHeader && (
        <CardHeader className={cn('gap-2', headerClassName)}>
          {title != null && (
            typeof title === 'string'
              ? <CardTitle>{title}</CardTitle>
              : title
          )}
          {actions != null && (
            <div className="ml-auto flex items-center gap-2">{actions}</div>
          )}
        </CardHeader>
      )}
      <CardContent className={cn(bodyPad === 'flush' ? 'p-0' : 'p-5')}>
        {children}
      </CardContent>
    </Card>
  );
}
