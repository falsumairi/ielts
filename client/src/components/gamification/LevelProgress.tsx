import React from 'react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { UserLevel } from '../../types/gamification';

interface LevelProgressProps {
  currentLevel: UserLevel;
  nextLevel: UserLevel | null;
  progressPercentage: number;
  className?: string;
}

/**
 * Component to display a user's level progress
 */
export function LevelProgress({
  currentLevel,
  nextLevel,
  progressPercentage,
  className
}: LevelProgressProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex justify-between items-center">
        <div className="text-sm font-medium">
          Level {currentLevel.level}: {currentLevel.name}
        </div>
        {nextLevel && (
          <div className="text-xs text-muted-foreground">
            Next: Level {nextLevel.level}: {nextLevel.name}
          </div>
        )}
      </div>
      
      <Progress 
        value={progressPercentage} 
        className="h-2"
      />
      
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{currentLevel.requiredPoints} points</span>
        {nextLevel ? (
          <span>{nextLevel.requiredPoints} points</span>
        ) : (
          <span>Max level</span>
        )}
      </div>
    </div>
  );
}

interface SmallLevelBadgeProps {
  level: number;
  name: string;
  className?: string;
}

/**
 * Small badge displaying just the level number and name
 */
export function SmallLevelBadge({ level, name, className }: SmallLevelBadgeProps) {
  return (
    <div className={cn(
      'inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium',
      className
    )}>
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground mr-1 text-[10px]">
        {level}
      </span>
      <span className="truncate">{name}</span>
    </div>
  );
}