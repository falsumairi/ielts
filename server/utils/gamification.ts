import { format, isToday, subDays } from 'date-fns';
import { storage } from '../storage';
import { BadgeType, BadgeRarity, PointActionType } from '../../shared/schema';
import { createNotification } from './notifications';
import { NotificationType, NotificationPriority } from '../../shared/schema';

/**
 * Point values for different actions
 */
const POINT_VALUES = {
  [PointActionType.FIRST_ATTEMPT]: 25,
  [PointActionType.LOGIN_STREAK]: 10,
  [PointActionType.COMPLETE_TEST]: 20,
  // per point in test score (e.g. 80% = 80 points)
  [PointActionType.PERFECT_SCORE]: 50,
  [PointActionType.ADD_VOCABULARY]: 2,
  [PointActionType.REVIEW_VOCABULARY]: 1,
  [PointActionType.FEEDBACK_GIVEN]: 5,
};

/**
 * Streak thresholds for badges
 */
const STREAK_BADGES = [
  { days: 3, type: BadgeType.MILESTONE, name: '3-Day Streak', description: 'Logged in for 3 days in a row', rarity: BadgeRarity.COMMON },
  { days: 7, type: BadgeType.MILESTONE, name: '7-Day Streak', description: 'Logged in for a week straight', rarity: BadgeRarity.UNCOMMON },
  { days: 14, type: BadgeType.MILESTONE, name: '2-Week Streak', description: 'Logged in for two weeks straight', rarity: BadgeRarity.RARE },
  { days: 30, type: BadgeType.MILESTONE, name: 'Monthly Dedication', description: 'Logged in every day for a month', rarity: BadgeRarity.EPIC },
  { days: 90, type: BadgeType.MILESTONE, name: '90-Day Mastery', description: 'Logged in for 90 consecutive days', rarity: BadgeRarity.LEGENDARY },
];

/**
 * Test count badges
 */
const TEST_COUNT_BADGES = [
  { count: 1, type: BadgeType.MILESTONE, name: 'First Test', description: 'Completed your first test', rarity: BadgeRarity.COMMON },
  { count: 5, type: BadgeType.MILESTONE, name: 'Test Explorer', description: 'Completed 5 tests', rarity: BadgeRarity.UNCOMMON },
  { count: 10, type: BadgeType.MILESTONE, name: 'Test Expert', description: 'Completed 10 tests', rarity: BadgeRarity.RARE },
  { count: 25, type: BadgeType.MILESTONE, name: 'Test Master', description: 'Completed 25 tests', rarity: BadgeRarity.EPIC },
  { count: 50, type: BadgeType.MASTERY, name: 'Test Champion', description: 'Completed 50 tests', rarity: BadgeRarity.LEGENDARY },
];

/**
 * Vocabulary count badges
 */
const VOCABULARY_COUNT_BADGES = [
  { count: 10, type: BadgeType.MILESTONE, name: 'Word Collector', description: 'Added 10 words to your vocabulary', rarity: BadgeRarity.COMMON },
  { count: 50, type: BadgeType.MILESTONE, name: 'Vocabulary Builder', description: 'Added 50 words to your vocabulary', rarity: BadgeRarity.UNCOMMON },
  { count: 100, type: BadgeType.MILESTONE, name: 'Word Expert', description: 'Added 100 words to your vocabulary', rarity: BadgeRarity.RARE },
  { count: 250, type: BadgeType.MASTERY, name: 'Vocabulary Master', description: 'Added 250 words to your vocabulary', rarity: BadgeRarity.EPIC },
  { count: 500, type: BadgeType.MASTERY, name: 'Lexicon Legend', description: 'Added 500 words to your vocabulary', rarity: BadgeRarity.LEGENDARY },
];

/**
 * Achievement badges
 */
const ACHIEVEMENT_BADGES = [
  { type: BadgeType.ACHIEVEMENT, name: 'Perfect Score', description: 'Achieved a perfect score on a test', rarity: BadgeRarity.EPIC, requiredScore: 100 },
  { type: BadgeType.ACHIEVEMENT, name: 'Review Champion', description: 'Reviewed 100 vocabulary words', rarity: BadgeRarity.RARE, requiredCount: 100 },
  { type: BadgeType.SPECIAL, name: 'Early Adopter', description: 'One of the first users of IELTS Exam Pro', rarity: BadgeRarity.LEGENDARY },
];

/**
 * Checks and updates user login streak
 * @param userId User ID to check
 * @returns Updated streak count
 */
export async function checkAndUpdateLoginStreak(userId: number): Promise<number> {
  // Get user achievement record
  const achievement = await storage.getUserAchievement(userId);
  if (!achievement) {
    return 0;
  }

  const today = new Date();
  const lastLogin = achievement.lastLoginDate;
  
  let newStreak = achievement.loginStreak;
  
  // If last login was yesterday, increment streak
  if (lastLogin && isToday(subDays(today, 1)) && !isToday(lastLogin)) {
    newStreak += 1;
    
    // Add streak points
    await awardPoints(userId, PointActionType.LOGIN_STREAK);
    
    // Check if user earned a streak badge
    await checkAndAwardStreakBadge(userId, newStreak);
  } 
  // If last login was not yesterday and not today, reset streak to 1
  else if (!lastLogin || (!isToday(subDays(today, 1)) && !isToday(lastLogin))) {
    newStreak = 1;
  }
  
  // Update last login date
  await storage.updateUserAchievement(userId, {
    lastLoginDate: today,
    loginStreak: newStreak
  });
  
  return newStreak;
}

/**
 * Awards points to a user for an action
 * @param userId User ID
 * @param action Point action type
 * @param value Optional override value (for test scores)
 * @param metadata Optional metadata
 */
export async function awardPoints(
  userId: number, 
  action: PointActionType, 
  value?: number,
  metadata?: string
): Promise<void> {
  const points = value !== undefined ? value : POINT_VALUES[action];
  
  // Add points to history
  await storage.addPointHistory(userId, {
    points,
    action,
    metadata: metadata || null,
    createdAt: new Date()
  });
  
  // Update total points in user achievement
  const achievement = await storage.getUserAchievement(userId);
  if (achievement) {
    const newPoints = achievement.totalPoints + points;
    await storage.updateUserAchievement(userId, {
      totalPoints: newPoints
    });
    
    // Check if user leveled up
    await checkAndUpdateUserLevel(userId, newPoints);
  }
}

/**
 * Checks and awards streak badges
 * @param userId User ID
 * @param streak Current streak count
 */
async function checkAndAwardStreakBadge(userId: number, streak: number): Promise<void> {
  // Find all eligible badges that the user should have based on streak
  const eligibleBadges = STREAK_BADGES.filter(badge => streak >= badge.days);
  
  for (const badgeConfig of eligibleBadges) {
    // Find or create the badge
    let badge = await storage.getBadgeByName(badgeConfig.name);
    if (!badge) {
      badge = await storage.createBadge({
        name: badgeConfig.name,
        type: badgeConfig.type,
        description: badgeConfig.description,
        rarity: badgeConfig.rarity,
        imageUrl: '', // No image URLs yet
        isActive: true
      });
    }
    
    // Check if user already has this badge
    const userBadge = await storage.getUserBadge(userId, badge.id);
    if (!userBadge) {
      // Award the badge
      await storage.awardBadge(userId, badge.id);
      
      // Create notification
      await createNotification({
        userId,
        type: NotificationType.ACHIEVEMENT,
        title: `New Badge Earned: ${badge.name}`,
        message: `You've earned the ${badge.name} badge! ${badge.description}`,
        priority: NotificationPriority.MEDIUM,
      });
    }
  }
}

/**
 * Checks and updates user level based on total points
 * @param userId User ID
 * @param points Total points
 */
async function checkAndUpdateUserLevel(userId: number, points: number): Promise<void> {
  // Get current user level
  const achievement = await storage.getUserAchievement(userId);
  if (!achievement) return;
  
  // Get all levels
  const levels = await storage.getAllLevels();
  
  // Sort levels by required points
  levels.sort((a, b) => a.requiredPoints - b.requiredPoints);
  
  // Find highest level user qualifies for
  let highestQualifyingLevel = levels[0];
  for (const level of levels) {
    if (points >= level.requiredPoints) {
      highestQualifyingLevel = level;
    } else {
      break;
    }
  }
  
  // If user leveled up, update their level and create notification
  if (highestQualifyingLevel.level > achievement.currentLevel) {
    await storage.updateUserAchievement(userId, {
      currentLevel: highestQualifyingLevel.level
    });
    
    // Create notification for level up
    await createNotification({
      userId,
      type: NotificationType.ACHIEVEMENT,
      title: `Level Up! You are now Level ${highestQualifyingLevel.level}`,
      message: `Congratulations! You've reached ${highestQualifyingLevel.name} (Level ${highestQualifyingLevel.level}). Keep earning points to level up further!`,
      priority: NotificationPriority.HIGH,
    });
  }
}

/**
 * Record test completion and award points and badges
 * @param userId User ID
 * @param score Test score (0-100)
 * @param moduleType Test module type (reading, writing, etc.)
 */
export async function recordTestCompletion(
  userId: number, 
  score: number, 
  moduleType: string
): Promise<void> {
  // Get user achievement
  const achievement = await storage.getUserAchievement(userId);
  if (!achievement) return;
  
  // Update tests completed count
  const newCount = achievement.testsCompleted + 1;
  await storage.updateUserAchievement(userId, {
    testsCompleted: newCount,
    highestScore: Math.max(score, achievement.highestScore || 0)
  });
  
  // Award points for test completion
  await awardPoints(userId, PointActionType.COMPLETE_TEST, undefined, moduleType);
  
  // Award points based on score
  await awardPoints(userId, PointActionType.PERFECT_SCORE, score, moduleType);
  
  // Award first test badge if this is their first test
  if (newCount === 1) {
    await awardPoints(userId, PointActionType.FIRST_ATTEMPT);
  }
  
  // Award perfect score badge if applicable
  if (score === 100) {
    await awardPoints(userId, PointActionType.PERFECT_SCORE);
    await awardPerfectScoreBadge(userId, moduleType);
  }
  
  // Check if user earned a test count badge
  await checkAndAwardTestCountBadge(userId, newCount);
}

/**
 * Awards perfect score badge
 * @param userId User ID
 * @param moduleType Test module type
 */
async function awardPerfectScoreBadge(userId: number, moduleType: string): Promise<void> {
  const perfectScoreConfig = ACHIEVEMENT_BADGES.find(b => b.name === 'Perfect Score');
  if (!perfectScoreConfig) return;
  
  // Find or create the badge
  let badge = await storage.getBadgeByName(perfectScoreConfig.name);
  if (!badge) {
    badge = await storage.createBadge({
      name: perfectScoreConfig.name,
      type: perfectScoreConfig.type,
      description: perfectScoreConfig.description,
      rarity: perfectScoreConfig.rarity,
      imageUrl: '',
      requiredScore: perfectScoreConfig.requiredScore,
      moduleType: null,
      isActive: true
    });
  }
  
  // Check if user already has this badge
  const userBadge = await storage.getUserBadge(userId, badge.id);
  if (!userBadge) {
    // Award the badge
    await storage.awardBadge(userId, badge.id);
    
    // Create notification
    await createNotification({
      userId,
      type: NotificationType.ACHIEVEMENT,
      title: `New Badge Earned: ${badge.name}`,
      message: `Incredible! You've earned the ${badge.name} badge for achieving a perfect score on a ${moduleType} test!`,
      priority: NotificationPriority.HIGH,
    });
  }
}

/**
 * Checks and awards test count badges
 * @param userId User ID
 * @param count Test count
 */
async function checkAndAwardTestCountBadge(userId: number, count: number): Promise<void> {
  // Find all eligible badges that the user should have based on count
  const eligibleBadges = TEST_COUNT_BADGES.filter(badge => count >= badge.count);
  
  for (const badgeConfig of eligibleBadges) {
    // Find or create the badge
    let badge = await storage.getBadgeByName(badgeConfig.name);
    if (!badge) {
      badge = await storage.createBadge({
        name: badgeConfig.name,
        type: badgeConfig.type,
        description: badgeConfig.description,
        rarity: badgeConfig.rarity,
        imageUrl: '',
        requiredCount: badgeConfig.count,
        isActive: true
      });
    }
    
    // Check if user already has this badge
    const userBadge = await storage.getUserBadge(userId, badge.id);
    if (!userBadge) {
      // Award the badge
      await storage.awardBadge(userId, badge.id);
      
      // Create notification
      await createNotification({
        userId,
        type: NotificationType.ACHIEVEMENT,
        title: `New Badge Earned: ${badge.name}`,
        message: `You've earned the ${badge.name} badge! ${badge.description}`,
        priority: NotificationPriority.MEDIUM,
      });
    }
  }
}

/**
 * Record vocabulary addition and award points and badges
 * @param userId User ID
 */
export async function recordVocabularyAddition(userId: number): Promise<void> {
  // Get user achievement
  const achievement = await storage.getUserAchievement(userId);
  if (!achievement) return;
  
  // Update vocabulary added count
  const newCount = achievement.vocabularyAdded + 1;
  await storage.updateUserAchievement(userId, {
    vocabularyAdded: newCount
  });
  
  // Award points for vocabulary addition
  await awardPoints(userId, PointActionType.ADD_VOCABULARY);
  
  // Check if user earned a vocabulary count badge
  await checkAndAwardVocabularyCountBadge(userId, newCount);
}

/**
 * Record vocabulary review and award points and badges
 * @param userId User ID
 */
export async function recordVocabularyReview(userId: number): Promise<void> {
  // Get user achievement
  const achievement = await storage.getUserAchievement(userId);
  if (!achievement) return;
  
  // Update vocabulary reviewed count
  const newCount = achievement.vocabularyReviewed + 1;
  await storage.updateUserAchievement(userId, {
    vocabularyReviewed: newCount
  });
  
  // Award points for vocabulary review
  await awardPoints(userId, PointActionType.REVIEW_VOCABULARY);
  
  // Check for review champion badge at 100 reviews
  if (newCount >= 100) {
    await awardReviewChampionBadge(userId);
  }
}

/**
 * Awards review champion badge
 * @param userId User ID
 */
async function awardReviewChampionBadge(userId: number): Promise<void> {
  const reviewChampionConfig = ACHIEVEMENT_BADGES.find(b => b.name === 'Review Champion');
  if (!reviewChampionConfig) return;
  
  // Find or create the badge
  let badge = await storage.getBadgeByName(reviewChampionConfig.name);
  if (!badge) {
    badge = await storage.createBadge({
      name: reviewChampionConfig.name,
      type: reviewChampionConfig.type,
      description: reviewChampionConfig.description,
      rarity: reviewChampionConfig.rarity,
      imageUrl: '',
      requiredCount: reviewChampionConfig.requiredCount,
      isActive: true
    });
  }
  
  // Check if user already has this badge
  const userBadge = await storage.getUserBadge(userId, badge.id);
  if (!userBadge) {
    // Award the badge
    await storage.awardBadge(userId, badge.id);
    
    // Create notification
    await createNotification({
      userId,
      type: NotificationType.ACHIEVEMENT,
      title: `New Badge Earned: ${badge.name}`,
      message: `You've earned the ${badge.name} badge for reviewing 100 vocabulary words! Your dedication to vocabulary practice is paying off.`,
      priority: NotificationPriority.MEDIUM,
    });
  }
}

/**
 * Checks and awards vocabulary count badges
 * @param userId User ID
 * @param count Vocabulary count
 */
async function checkAndAwardVocabularyCountBadge(userId: number, count: number): Promise<void> {
  // Find all eligible badges that the user should have based on count
  const eligibleBadges = VOCABULARY_COUNT_BADGES.filter(badge => count >= badge.count);
  
  for (const badgeConfig of eligibleBadges) {
    // Find or create the badge
    let badge = await storage.getBadgeByName(badgeConfig.name);
    if (!badge) {
      badge = await storage.createBadge({
        name: badgeConfig.name,
        type: badgeConfig.type,
        description: badgeConfig.description,
        rarity: badgeConfig.rarity,
        imageUrl: '',
        requiredCount: badgeConfig.count,
        isActive: true
      });
    }
    
    // Check if user already has this badge
    const userBadge = await storage.getUserBadge(userId, badge.id);
    if (!userBadge) {
      // Award the badge
      await storage.awardBadge(userId, badge.id);
      
      // Create notification
      await createNotification({
        userId,
        type: NotificationType.ACHIEVEMENT,
        title: `New Badge Earned: ${badge.name}`,
        message: `You've earned the ${badge.name} badge! ${badge.description}`,
        priority: NotificationPriority.MEDIUM,
      });
    }
  }
}

/**
 * Get user's gamification data
 * @param userId User ID
 */
export async function getUserGamificationData(userId: number) {
  // Get user achievement
  const achievement = await storage.getUserAchievement(userId);
  if (!achievement) return null;
  
  // Get user badges
  const userBadges = await storage.getUserBadges(userId);
  
  // Get all badges for these user badges
  const badgeIds = userBadges.map(ub => ub.badgeId);
  const badges = await Promise.all(
    badgeIds.map(id => storage.getBadge(id))
  );
  
  // Attach badges to user badges
  const userBadgesWithDetails = userBadges.map((ub, index) => ({
    ...ub,
    badge: badges[index] || undefined
  }));
  
  // Get point history
  const pointHistory = await storage.getUserPointHistory(userId);
  
  // Get current level
  const currentLevel = await storage.getUserLevel(achievement.currentLevel);
  if (!currentLevel) return null;
  
  // Get next level if exists
  const nextLevel = await storage.getUserLevel(achievement.currentLevel + 1);
  
  // Calculate level progress percentage
  let levelProgress = 100;
  if (nextLevel) {
    const pointsForCurrentLevel = currentLevel.requiredPoints;
    const pointsForNextLevel = nextLevel.requiredPoints;
    const pointsNeeded = pointsForNextLevel - pointsForCurrentLevel;
    const pointsGained = achievement.totalPoints - pointsForCurrentLevel;
    
    levelProgress = Math.min(100, Math.max(0, (pointsGained / pointsNeeded) * 100));
  }
  
  return {
    achievement,
    currentLevel,
    nextLevel,
    levelProgress,
    badges: userBadgesWithDetails,
    pointHistory
  };
}

/**
 * Get leaderboard
 * @param limit Maximum number of entries
 */
export async function getLeaderboard(limit: number = 10) {
  // Get all user achievements
  const achievements = await storage.getAllUserAchievements();
  
  // Sort by total points descending
  achievements.sort((a, b) => b.totalPoints - a.totalPoints);
  
  // Limit results
  const topAchievements = achievements.slice(0, limit);
  
  // Get user details
  const leaderboard = await Promise.all(topAchievements.map(async (a, index) => {
    const user = await storage.getUser(a.userId);
    const userLevel = await storage.getUserLevel(a.currentLevel);
    const userBadges = await storage.getUserBadges(a.userId);
    
    return {
      userId: a.userId,
      username: user?.username || 'Unknown User',
      totalPoints: a.totalPoints,
      currentLevel: a.currentLevel,
      levelName: userLevel?.name || 'Unknown Level',
      badgeCount: userBadges.length,
      rank: index + 1
    };
  }));
  
  return leaderboard;
}

/**
 * Initialize the gamification system
 */
export function initGamification() {
  console.log('[gamification] Gamification system initialized');
}