import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LeaderboardEntry } from '../../types/gamification';
import { SmallLevelBadge } from './LevelProgress';
import { Award, Trophy, Medal } from 'lucide-react';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: number;
  className?: string;
}

/**
 * Leaderboard component to display top users by points
 */
export function Leaderboard({
  entries,
  currentUserId,
  className
}: LeaderboardProps) {
  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Leaderboard
        </CardTitle>
        <CardDescription>Top users by points</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Level</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead className="text-right">Badges</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry, index) => (
              <TableRow 
                key={entry.userId}
                className={cn(
                  entry.userId === currentUserId && "bg-primary/5"
                )}
              >
                <TableCell className="font-medium flex items-center">
                  {index === 0 ? (
                    <Trophy className="h-4 w-4 text-yellow-500 mr-1" />
                  ) : index === 1 ? (
                    <Medal className="h-4 w-4 text-gray-400 mr-1" />
                  ) : index === 2 ? (
                    <Medal className="h-4 w-4 text-amber-600 mr-1" />
                  ) : (
                    index + 1
                  )}
                </TableCell>
                <TableCell>
                  {entry.username}
                  {entry.userId === currentUserId && (
                    <span className="ml-2 text-xs text-muted-foreground">(You)</span>
                  )}
                </TableCell>
                <TableCell>
                  <SmallLevelBadge 
                    level={entry.currentLevel} 
                    name={entry.levelName} 
                  />
                </TableCell>
                <TableCell className="text-right font-medium">
                  {entry.totalPoints}
                </TableCell>
                <TableCell className="text-right">
                  <span className="flex items-center justify-end gap-1">
                    <Award className="h-3 w-3" />
                    {entry.badgeCount}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}