/**
 * Types of notifications that can be sent to users
 */
export enum NotificationType {
  SYSTEM = 'system',
  ACHIEVEMENT = 'achievement',
  TEST = 'test',
  VOCABULARY = 'vocabulary',
  REMINDER = 'reminder',
  UPDATE = 'update',
}

/**
 * Priority levels for notifications
 */
export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

/**
 * Types of badges that can be awarded to users
 */
export enum BadgeType {
  ACHIEVEMENT = 'achievement',
  STREAK = 'streak',
  TEST = 'test',
  VOCABULARY = 'vocabulary',
  SPECIAL = 'special',
}

/**
 * Rarity levels for badges
 */
export enum BadgeRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary',
}

/**
 * Actions that can earn points for users
 */
export enum PointActionType {
  LOGIN = 'login',
  LOGIN_STREAK = 'login_streak',
  TEST_COMPLETION = 'test_completion',
  TEST_SCORE = 'test_score',
  VOCABULARY_ADD = 'vocabulary_add',
  VOCABULARY_REVIEW = 'vocabulary_review',
  PERFECT_SCORE = 'perfect_score',
  FIRST_TEST = 'first_test',
}