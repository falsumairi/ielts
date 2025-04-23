import React from 'react';
import { cn } from '@/lib/utils';
import { Progress } from "@/components/ui/progress";
import { UserLevel } from '../../types/gamification';
import { Badge } from "@/components/ui/badge";

interface LevelProgressProps {
  currentLevel: {
    id: number;
    name: string;
    level: number;
    requiredPoints: number;
  };
  nextLevel: {
    id: number;
    name: string;
    level: number;
    requiredPoints: number;
  } | null;
  progressPercentage: number;
  className?: string;
}

export function SmallLevelBadge({ level, name }: { level: number, name: string }) {
  return (
    <Badge variant="outline" className="px-2 py-1 h-auto font-semibold">
      Level {level}: {name}
    </Badge>
  );
}

/**
 * Level progress bar component
 */
export function LevelProgress({ 
  currentLevel, 
  nextLevel, 
  progressPercentage,
  className
}: LevelProgressProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between items-center text-sm">
        <div className="font-medium">Level {currentLevel.level}</div>
        {nextLevel && (
          <div className="text-muted-foreground">Level {nextLevel.level}</div>
        )}
      </div>
      
      <Progress value={progressPercentage} className="h-2" />
      
      <div className="flex justify-between items-center text-xs">
        <div className="text-muted-foreground">
          {nextLevel 
            ? `${Math.round(progressPercentage)}% to next level` 
            : 'Maximum level reached!'}
        </div>
        
        {nextLevel && (
          <div className="font-medium">
            {nextLevel.requiredPoints - currentLevel.requiredPoints} points needed
          </div>
        )}
      </div>
    </div>
  );
}