import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAchievement } from '../../types/gamification';
import { LevelProgress, SmallLevelBadge } from './LevelProgress';
import { Badge as BadgeComponent } from './Badge';
import { Badge } from '../../types/gamification';
import { CalendarDays, Star, BookOpen, Award, Flame } from 'lucide-react';

interface AchievementCardProps {
  achievement: UserAchievement;
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
  progress: number;
  badges: Array<{
    id: number;
    userId: number;
    badgeId: number;
    earnedAt: string;
    badge?: Badge;
  }>;
  className?: string;
}

/**
 * Card displaying a user's achievements
 */
export function AchievementCard({
  achievement,
  currentLevel,
  nextLevel,
  progress,
  badges,
  className
}: AchievementCardProps) {
  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Your Progress</CardTitle>
            <CardDescription>Track your achievements</CardDescription>
          </div>
          <SmallLevelBadge level={currentLevel.level} name={currentLevel.name} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <LevelProgress 
          currentLevel={currentLevel}
          nextLevel={nextLevel}
          progressPercentage={progress}
        />

        <div className="grid grid-cols-2 gap-4">
          <StatItem 
            icon={<Star className="h-4 w-4" />}
            label="Total Points"
            value={achievement.totalPoints.toString()}
          />
          
          <StatItem 
            icon={<Flame className="h-4 w-4" />}
            label="Login Streak"
            value={achievement.loginStreak.toString()}
          />
          
          <StatItem 
            icon={<BookOpen className="h-4 w-4" />}
            label="Vocabulary Added"
            value={achievement.vocabularyAdded.toString()}
          />
          
          <StatItem 
            icon={<CalendarDays className="h-4 w-4" />}
            label="Tests Completed"
            value={achievement.testsCompleted.toString()}
          />
        </div>

        {badges.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-1">
              <Award className="h-4 w-4" />
              <span>Earned Badges ({badges.length})</span>
            </h4>
            <div className="flex flex-wrap gap-2">
              {badges.map((userBadge) => 
                userBadge.badge && (
                  <BadgeComponent 
                    key={userBadge.id}
                    badge={userBadge.badge}
                    size="sm"
                  />
                )
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

/**
 * Small stat item with icon, label and value
 */
function StatItem({ icon, label, value }: StatItemProps) {
  return (
    <div className="flex items-center space-x-2">
      <div className="bg-primary/10 p-2 rounded">
        {icon}
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{value}</div>
      </div>
    </div>
  );
}