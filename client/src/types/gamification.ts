import { BadgeRarity, BadgeType, PointActionType } from './enums';

/**
 * Badge schema for achievements
 */
export interface Badge {
  id: number;
  name: string;
  type: BadgeType;
  description: string;
  rarity: BadgeRarity;
  imageUrl: string;
  requiredScore?: number | null;
  requiredCount?: number | null;
  moduleType?: string | null;
  isActive: boolean | null;
  createdAt: Date | null;
}

/**
 * User Badge record - links users to their earned badges
 */
export interface UserBadge {
  id: number;
  userId: number;
  badgeId: number;
  earnedAt: string;
  badge?: Badge;
}

/**
 * User Levels define the progression system
 */
export interface UserLevel {
  id: number;
  name: string;
  level: number;
  requiredPoints: number;
  badgeId: number | null;
  createdAt: Date | null;
}

/**
 * User Point History records points earned by users
 */
export interface PointHistory {
  id: number;
  userId: number;
  points: number;
  action: PointActionType;
  createdAt: Date;
  metadata?: string | null;
}

/**
 * User Achievement record - tracks user progress in the gamification system
 */
export interface UserAchievement {
  id: number;
  userId: number;
  totalPoints: number;
  currentLevel: number;
  loginStreak: number;
  lastLoginDate: Date | null;
  testsCompleted: number;
  vocabularyAdded: number;
  vocabularyReviewed: number;
  highestScore: number | null;
  updatedAt: Date | null;
}

/**
 * Gamification Data returned from the server
 */
export interface GamificationData {
  achievement: UserAchievement;
  currentLevel: UserLevel;
  nextLevel: UserLevel | null;
  levelProgress: number;
  badges: UserBadge[];
  pointHistory: PointHistory[];
}

/**
 * Leaderboard entry for display
 */
export interface LeaderboardEntry {
  userId: number;
  username: string;
  totalPoints: number;
  currentLevel: number;
  levelName: string;
  badgeCount: number;
  rank: number;
}