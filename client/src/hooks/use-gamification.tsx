import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "./use-toast";
import { queryClient, getQueryFn, apiRequest } from "@/lib/queryClient";

interface UserAchievement {
  id: number;
  userId: number;
  totalPoints: number;
  currentLevel: number;
  loginStreak: number;
  lastLoginDate: string | null;
  testsCompleted: number;
  vocabularyAdded: number;
  vocabularyReviewed: number;
  highestScore: number | null;
  updatedAt: string | null;
}

interface UserBadge {
  id: number;
  userId: number;
  badgeId: number;
  earnedAt: string;
  badge?: Badge;
}

interface UserLevel {
  id: number;
  name: string;
  level: number;
  requiredPoints: number;
  badgeId: number | null;
}

interface Badge {
  id: number;
  name: string;
  type: string;
  description: string;
  rarity: string;
  imageUrl: string;
  requiredScore: number | null;
  requiredCount: number | null;
  moduleType: string | null;
  isActive: boolean | null;
}

interface PointHistory {
  id: number;
  userId: number;
  actionType: string;
  pointsAwarded: number;
  createdAt: string;
  relatedEntityId: number | null;
  relatedEntityType: string | null;
}

interface LeaderboardEntry {
  userId: number;
  username: string;
  totalPoints: number;
  currentLevel: number;
  levelName: string;
  badgeCount: number;
}

interface GamificationData {
  achievement: UserAchievement;
  badges: UserBadge[];
  currentLevel: UserLevel;
  nextLevel: UserLevel | null;
  levelProgress: number;
}

/**
 * Hook for accessing and managing user gamification data
 */
export function useGamification() {
  const { toast } = useToast();
  
  // Get user's gamification data
  const { 
    data: gamificationData, 
    isLoading: isGamificationLoading,
    error: gamificationError,
    refetch: refetchGamification 
  } = useQuery<GamificationData>({
    queryKey: ["/api/gamification/user-achievement"],
    queryFn: getQueryFn(),
    enabled: true, // Only fetch if user is authenticated
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Get all available badges
  const { 
    data: allBadges, 
    isLoading: isBadgesLoading 
  } = useQuery<Badge[]>({
    queryKey: ["/api/gamification/badges"],
    queryFn: getQueryFn(),
    staleTime: 60 * 60 * 1000, // 1 hour
  });
  
  // Get user's point history
  const { 
    data: pointHistory, 
    isLoading: isPointHistoryLoading 
  } = useQuery<PointHistory[]>({
    queryKey: ["/api/gamification/point-history"],
    queryFn: getQueryFn(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Get leaderboard
  const { 
    data: leaderboard, 
    isLoading: isLeaderboardLoading 
  } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/gamification/leaderboard"],
    queryFn: getQueryFn(),
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
  
  // Update login streak
  const updateLoginStreakMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/gamification/login-streak");
      return await response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch the gamification data
      queryClient.invalidateQueries({ queryKey: ["/api/gamification/user-achievement"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Couldn't update login streak",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  return {
    gamificationData,
    allBadges,
    pointHistory,
    leaderboard,
    isGamificationLoading,
    isBadgesLoading,
    isPointHistoryLoading,
    isLeaderboardLoading,
    gamificationError,
    refetchGamification,
    updateLoginStreak: updateLoginStreakMutation.mutate,
    isUpdatingLoginStreak: updateLoginStreakMutation.isPending,
    // Helper methods
    getEarnedBadgeIds: () => gamificationData?.badges.map(b => b.badgeId) || [],
    // Check if a user has a specific badge
    hasBadge: (badgeId: number) => gamificationData?.badges.some(b => b.badgeId === badgeId) || false,
    // Get progress percentage for the next level
    getLevelProgressPercentage: () => gamificationData?.levelProgress || 0,
  };
}