import { BadgeRarity, BadgeType, PointActionType } from './enums';

export interface UserAchievement {
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

export interface UserBadge {
  id: number;
  userId: number;
  badgeId: number;
  earnedAt: string;
  badge?: Badge;
}

export interface UserLevel {
  id: number;
  name: string;
  level: number;
  requiredPoints: number;
  badgeId: number | null;
}

export interface Badge {
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

export interface PointHistory {
  id: number;
  userId: number;
  actionType: string;
  pointsAwarded: number;
  createdAt: string;
  relatedEntityId: number | null;
  relatedEntityType: string | null;
}

export interface LeaderboardEntry {
  userId: number;
  username: string;
  totalPoints: number;
  currentLevel: number;
  levelName: string;
  badgeCount: number;
}

export interface GamificationData {
  achievement: UserAchievement;
  badges: UserBadge[];
  currentLevel: UserLevel;
  nextLevel: UserLevel | null;
  levelProgress: number;
}