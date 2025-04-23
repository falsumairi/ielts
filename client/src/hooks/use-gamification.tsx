import React, { createContext, ReactNode, useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getQueryFn } from '@/lib/queryClient';
import type { GamificationData, Badge, LeaderboardEntry, UserBadge } from '@/types/gamification';
import { useToast } from '@/hooks/use-toast';

interface GamificationContextType {
  gamificationData: GamificationData | null;
  allBadges: Badge[] | null;
  leaderboard: LeaderboardEntry[] | null;
  isGamificationLoading: boolean;
  isBadgesLoading: boolean;
  isLeaderboardLoading: boolean;
  hasBadge: (badgeId: number) => boolean;
  getProgressToNextLevel: () => number;
}

const GamificationContext = createContext<GamificationContextType | null>(null);

export function GamificationProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  // Fetch user's gamification data
  const {
    data: gamificationData,
    isLoading: isGamificationLoading,
    error: gamificationError,
  } = useQuery<GamificationData>({
    queryKey: ['/api/gamification/user'],
    queryFn: getQueryFn(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
    enabled: true,
  });

  // Fetch all available badges
  const {
    data: allBadges,
    isLoading: isBadgesLoading,
    error: badgesError,
  } = useQuery<Badge[]>({
    queryKey: ['/api/gamification/badges'],
    queryFn: getQueryFn(),
    staleTime: 1000 * 60 * 60, // 1 hour
    retry: 1,
    enabled: true,
  });

  // Fetch leaderboard
  const {
    data: leaderboard,
    isLoading: isLeaderboardLoading,
    error: leaderboardError,
  } = useQuery<LeaderboardEntry[]>({
    queryKey: ['/api/gamification/leaderboard'],
    queryFn: getQueryFn(),
    staleTime: 1000 * 60 * 15, // 15 minutes
    retry: 1,
    enabled: true,
  });

  // Show errors via toast
  React.useEffect(() => {
    if (gamificationError) {
      toast({
        title: 'Error loading achievements',
        description: 'Could not load your achievement data. Please try again later.',
        variant: 'destructive',
      });
    }
  }, [gamificationError, toast]);

  React.useEffect(() => {
    if (badgesError) {
      toast({
        title: 'Error loading badges',
        description: 'Could not load badge data. Please try again later.',
        variant: 'destructive',
      });
    }
  }, [badgesError, toast]);

  React.useEffect(() => {
    if (leaderboardError) {
      toast({
        title: 'Error loading leaderboard',
        description: 'Could not load leaderboard data. Please try again later.',
        variant: 'destructive',
      });
    }
  }, [leaderboardError, toast]);

  // Check if user has a specific badge
  const hasBadge = (badgeId: number): boolean => {
    if (!gamificationData || !gamificationData.badges) return false;
    return gamificationData.badges.some(userBadge => userBadge.badgeId === badgeId);
  };

  // Calculate progress to next level
  const getProgressToNextLevel = (): number => {
    if (!gamificationData || !gamificationData.nextLevel) return 100;
    
    const { currentLevel, nextLevel, achievement } = gamificationData;
    const totalPointsNeeded = nextLevel.requiredPoints - currentLevel.requiredPoints;
    const pointsGained = achievement.totalPoints - currentLevel.requiredPoints;
    
    // Calculate percentage
    return Math.min(100, Math.max(0, (pointsGained / totalPointsNeeded) * 100));
  };

  return (
    <GamificationContext.Provider
      value={{
        gamificationData: gamificationData || null,
        allBadges: allBadges || null,
        leaderboard: leaderboard || null,
        isGamificationLoading,
        isBadgesLoading,
        isLeaderboardLoading,
        hasBadge,
        getProgressToNextLevel,
      }}
    >
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within a GamificationProvider');
  }
  return context;
}