import { 
  PointActionType, 
  BadgeType, 
  BadgeRarity, 
  UserAchievement 
} from "@shared/schema";
import { storage } from "../storage";

/**
 * Award points to a user for a specific action
 * @param userId User ID to award points to
 * @param actionType Type of action performed
 * @param relatedEntityId Optional ID of related entity (test, vocabulary, etc.)
 * @param relatedEntityType Optional type of related entity
 * @returns The updated user achievement record or null if error
 */
export async function awardPoints(
  userId: number, 
  actionType: PointActionType, 
  relatedEntityId?: number,
  relatedEntityType?: string
): Promise<UserAchievement | null> {
  try {
    // Get point action configuration
    const pointAction = await storage.getPointActionByType(actionType);
    if (!pointAction || !pointAction.isActive) {
      console.warn(`Point action ${actionType} not found or not active.`);
      return null;
    }

    // Create point transaction record
    await storage.createUserPoint({
      userId,
      actionType,
      points: pointAction.pointsAwarded,
      description: pointAction.description,
      relatedEntityId,
      relatedEntityType
    });

    // Update user's achievements
    const achievement = await storage.getUserAchievement(userId);
    
    if (!achievement) {
      // Create new achievement record if it doesn't exist
      const newAchievement = await storage.createUserAchievement({
        userId,
        totalPoints: pointAction.pointsAwarded,
        currentLevel: 1
      });
      
      // Check for any level ups
      await checkForLevelUp(userId, pointAction.pointsAwarded);
      
      return newAchievement;
    } else {
      // Update existing achievement
      const newTotal = achievement.totalPoints + pointAction.pointsAwarded;
      
      // Update achievement stats based on action type
      let updates: Partial<UserAchievement> = {
        totalPoints: newTotal,
        updatedAt: new Date()
      };
      
      if (actionType === PointActionType.COMPLETE_TEST) {
        updates.testsCompleted = (achievement.testsCompleted || 0) + 1;
      } else if (actionType === PointActionType.ADD_VOCABULARY) {
        updates.vocabularyAdded = (achievement.vocabularyAdded || 0) + 1;
      } else if (actionType === PointActionType.REVIEW_VOCABULARY) {
        updates.vocabularyReviewed = (achievement.vocabularyReviewed || 0) + 1;
      }
      
      const updatedAchievement = await storage.updateUserAchievement(userId, updates);
      
      // Check for any level ups
      await checkForLevelUp(userId, newTotal);
      
      // Check for any badges earned
      await checkForBadges(userId);
      
      return updatedAchievement;
    }
  } catch (error) {
    console.error("Error awarding points:", error);
    return null;
  }
}

/**
 * Check if a user has leveled up based on their total points
 * @param userId User ID to check
 * @param points Current total points
 */
export async function checkForLevelUp(userId: number, points: number): Promise<void> {
  try {
    // Get user's current achievement
    const achievement = await storage.getUserAchievement(userId);
    if (!achievement) return;
    
    // Get all levels
    const levels = await storage.getAllUserLevels();
    
    // Find the highest level the user qualifies for
    const qualifyingLevels = levels.filter(level => level.requiredPoints <= points)
      .sort((a, b) => b.level - a.level);
    
    if (qualifyingLevels.length > 0) {
      const highestLevel = qualifyingLevels[0];
      
      // If user has leveled up, update their achievement
      if (highestLevel.level > achievement.currentLevel) {
        await storage.updateUserAchievement(userId, {
          currentLevel: highestLevel.level,
          updatedAt: new Date()
        });
        
        // Notify user of level up
        await createLevelUpNotification(userId, highestLevel.level, highestLevel.name);
        
        // Award badge if available
        if (highestLevel.badgeId) {
          const badge = await storage.getBadge(highestLevel.badgeId);
          if (badge) {
            await awardBadge(userId, badge.id);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error checking for level up:", error);
  }
}

/**
 * Create a notification for level up
 * @param userId User ID to notify
 * @param level New level reached
 * @param levelName Name of the new level
 */
async function createLevelUpNotification(userId: number, level: number, levelName: string): Promise<void> {
  const notificationUtils = await import("./notifications");
  await notificationUtils.createSystemNotification(
    userId,
    `Level Up! You've reached Level ${level}`,
    `Congratulations! You've advanced to "${levelName}" level. Keep earning points to unlock more rewards and features.`,
    "HIGH",
    "/achievements"
  );
}

/**
 * Award a badge to a user
 * @param userId User ID to award the badge to
 * @param badgeId Badge ID to award
 * @returns True if badge was awarded, false otherwise
 */
export async function awardBadge(userId: number, badgeId: number): Promise<boolean> {
  try {
    // Check if badge exists and is active
    const badge = await storage.getBadge(badgeId);
    if (!badge || !badge.isActive) {
      console.warn(`Badge ${badgeId} not found or not active.`);
      return false;
    }
    
    // Check if user already has this badge
    const existingBadge = await storage.getUserBadgeByBadgeId(userId, badgeId);
    
    if (existingBadge) {
      // If already awarded, increment times earned
      await storage.updateUserBadge(existingBadge.id, {
        timesEarned: existingBadge.timesEarned + 1,
        earnedAt: new Date()
      });
    } else {
      // Award new badge
      await storage.createUserBadge({
        userId,
        badgeId,
        isDisplayed: true,
        timesEarned: 1
      });
    }
    
    // Create notification for badge earned
    const notificationUtils = await import("./notifications");
    await notificationUtils.createAchievementNotification(
      userId,
      {
        name: `New Badge: ${badge.name}`,
        description: `You've earned the "${badge.name}" badge! ${badge.description}`
      }
    );
    
    return true;
  } catch (error) {
    console.error("Error awarding badge:", error);
    return false;
  }
}

/**
 * Check for badges that a user may have earned
 * @param userId User ID to check
 */
export async function checkForBadges(userId: number): Promise<void> {
  try {
    // Get user achievement data
    const achievement = await storage.getUserAchievement(userId);
    if (!achievement) return;
    
    // Get all active badges
    const badges = await storage.getActiveBadges();
    
    // Check each badge to see if the user qualifies
    for (const badge of badges) {
      // Skip badges that require specific values we can't check automatically
      if (!badge.requiredCount && !badge.requiredScore) continue;
      
      let qualifies = false;
      
      // Check badge type and required count/score
      if (badge.type === BadgeType.MILESTONE) {
        if (badge.moduleType === "vocabulary" && badge.requiredCount && achievement.vocabularyAdded >= badge.requiredCount) {
          qualifies = true;
        } else if (badge.moduleType === "vocabulary_reviewed" && badge.requiredCount && achievement.vocabularyReviewed >= badge.requiredCount) {
          qualifies = true;
        } else if (badge.moduleType === "tests" && badge.requiredCount && achievement.testsCompleted >= badge.requiredCount) {
          qualifies = true;
        } else if (badge.moduleType === "login_streak" && badge.requiredCount && achievement.loginStreak >= badge.requiredCount) {
          qualifies = true;
        } else if (badge.moduleType === "points" && badge.requiredScore && achievement.totalPoints >= badge.requiredScore) {
          qualifies = true;
        } else if (badge.moduleType === "score" && badge.requiredScore && achievement.highestScore >= badge.requiredScore) {
          qualifies = true;
        }
      }
      
      // Award the badge if user qualifies
      if (qualifies) {
        // Check if user already has this badge
        const userBadge = await storage.getUserBadgeByBadgeId(userId, badge.id);
        if (!userBadge) {
          await awardBadge(userId, badge.id);
        }
      }
    }
  } catch (error) {
    console.error("Error checking for badges:", error);
  }
}

/**
 * Update user login streak
 * @param userId User ID to update
 * @returns The updated user achievement or null if error
 */
export async function updateLoginStreak(userId: number): Promise<UserAchievement | null> {
  try {
    // Get user achievement data
    const achievement = await storage.getUserAchievement(userId);
    
    if (!achievement) {
      // Create new achievement record
      return await storage.createUserAchievement({
        userId,
        loginStreak: 1,
        lastLoginDate: new Date()
      });
    }
    
    // Calculate if login continues streak
    const lastLogin = new Date(achievement.lastLoginDate);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
    
    let newStreak = achievement.loginStreak;
    
    if (daysDiff === 0) {
      // Already logged in today, no change
      return achievement;
    } else if (daysDiff === 1) {
      // Consecutive day, increment streak
      newStreak += 1;
      
      // Check for streak milestones (3, 7, 14, 30, etc.)
      if (
        newStreak === 3 || 
        newStreak === 7 || 
        newStreak === 14 || 
        newStreak === 30 || 
        (newStreak > 30 && newStreak % 30 === 0) || 
        (newStreak > 7 && newStreak % 7 === 0)
      ) {
        // Create streak notification
        const notificationUtils = await import("./notifications");
        await notificationUtils.createStreakNotification(userId, newStreak);
        
        // Award streak points
        await awardPoints(userId, PointActionType.LOGIN_STREAK);
      }
    } else {
      // Streak broken, reset to 1
      newStreak = 1;
    }
    
    // Update the achievement
    return await storage.updateUserAchievement(userId, {
      loginStreak: newStreak,
      lastLoginDate: now,
      updatedAt: now
    });
  } catch (error) {
    console.error("Error updating login streak:", error);
    return null;
  }
}

/**
 * Initialize default point action values
 */
export async function initializePointActions(): Promise<void> {
  try {
    const defaultPointActions = [
      {
        actionType: PointActionType.COMPLETE_TEST,
        pointsAwarded: 100,
        description: "Completing a test"
      },
      {
        actionType: PointActionType.REVIEW_VOCABULARY,
        pointsAwarded: 10,
        description: "Reviewing vocabulary items"
      },
      {
        actionType: PointActionType.ADD_VOCABULARY,
        pointsAwarded: 5,
        description: "Adding a new vocabulary word"
      },
      {
        actionType: PointActionType.LOGIN_STREAK,
        pointsAwarded: 20,
        description: "Maintaining a login streak"
      },
      {
        actionType: PointActionType.PERFECT_SCORE,
        pointsAwarded: 150,
        description: "Achieving a perfect score on a test"
      },
      {
        actionType: PointActionType.FIRST_ATTEMPT,
        pointsAwarded: 50,
        description: "Completing a test on first attempt"
      },
      {
        actionType: PointActionType.FEEDBACK_GIVEN,
        pointsAwarded: 15,
        description: "Providing feedback on test questions"
      }
    ];
    
    for (const action of defaultPointActions) {
      // Check if action already exists
      const existing = await storage.getPointActionByType(action.actionType);
      if (!existing) {
        await storage.createPointAction(action);
      }
    }
  } catch (error) {
    console.error("Error initializing point actions:", error);
  }
}

/**
 * Initialize default user levels
 */
export async function initializeUserLevels(): Promise<void> {
  try {
    const defaultLevels = [
      { level: 1, name: "Beginner", requiredPoints: 0 },
      { level: 2, name: "Novice", requiredPoints: 100 },
      { level: 3, name: "Apprentice", requiredPoints: 300 },
      { level: 4, name: "Proficient", requiredPoints: 600 },
      { level: 5, name: "Advanced", requiredPoints: 1000 },
      { level: 6, name: "Expert", requiredPoints: 1500 },
      { level: 7, name: "Master", requiredPoints: 2500 },
      { level: 8, name: "Grandmaster", requiredPoints: 4000 },
      { level: 9, name: "Champion", requiredPoints: 6000 },
      { level: 10, name: "Legend", requiredPoints: 10000 }
    ];
    
    for (const level of defaultLevels) {
      // Check if level already exists
      const existing = await storage.getUserLevelByLevel(level.level);
      if (!existing) {
        await storage.createUserLevel(level);
      }
    }
  } catch (error) {
    console.error("Error initializing user levels:", error);
  }
}

/**
 * Initialize default badges
 */
export async function initializeDefaultBadges(): Promise<void> {
  try {
    const defaultBadges = [
      {
        name: "First Test",
        description: "Completed your first test",
        type: BadgeType.ACHIEVEMENT,
        rarity: BadgeRarity.COMMON,
        imageUrl: "/badges/first-test.svg",
        requiredCount: 1,
        moduleType: "tests"
      },
      {
        name: "Test Enthusiast",
        description: "Completed 5 tests",
        type: BadgeType.MILESTONE,
        rarity: BadgeRarity.UNCOMMON,
        imageUrl: "/badges/test-enthusiast.svg",
        requiredCount: 5,
        moduleType: "tests"
      },
      {
        name: "Test Master",
        description: "Completed 25 tests",
        type: BadgeType.MILESTONE,
        rarity: BadgeRarity.RARE,
        imageUrl: "/badges/test-master.svg",
        requiredCount: 25,
        moduleType: "tests"
      },
      {
        name: "Vocabulary Collector",
        description: "Added 10 vocabulary words",
        type: BadgeType.MILESTONE,
        rarity: BadgeRarity.COMMON,
        imageUrl: "/badges/vocabulary-collector.svg",
        requiredCount: 10,
        moduleType: "vocabulary"
      },
      {
        name: "Vocabulary Expert",
        description: "Added 50 vocabulary words",
        type: BadgeType.MILESTONE,
        rarity: BadgeRarity.UNCOMMON,
        imageUrl: "/badges/vocabulary-expert.svg",
        requiredCount: 50,
        moduleType: "vocabulary"
      },
      {
        name: "Vocabulary Master",
        description: "Added 100 vocabulary words",
        type: BadgeType.MILESTONE,
        rarity: BadgeRarity.RARE,
        imageUrl: "/badges/vocabulary-master.svg",
        requiredCount: 100,
        moduleType: "vocabulary"
      },
      {
        name: "Study Streak",
        description: "Logged in for 7 consecutive days",
        type: BadgeType.MILESTONE,
        rarity: BadgeRarity.UNCOMMON,
        imageUrl: "/badges/study-streak.svg",
        requiredCount: 7,
        moduleType: "login_streak"
      },
      {
        name: "Dedicated Learner",
        description: "Logged in for 30 consecutive days",
        type: BadgeType.MILESTONE,
        rarity: BadgeRarity.EPIC,
        imageUrl: "/badges/dedicated-learner.svg",
        requiredCount: 30,
        moduleType: "login_streak"
      },
      {
        name: "Perfect Score",
        description: "Achieved a perfect score on a test",
        type: BadgeType.ACHIEVEMENT,
        rarity: BadgeRarity.RARE,
        imageUrl: "/badges/perfect-score.svg",
        requiredScore: 100,
        moduleType: "score"
      },
      {
        name: "Point Collector",
        description: "Earned 1000 points",
        type: BadgeType.MILESTONE,
        rarity: BadgeRarity.UNCOMMON,
        imageUrl: "/badges/point-collector.svg",
        requiredScore: 1000,
        moduleType: "points"
      },
      {
        name: "Reading Expert",
        description: "Mastered the reading section",
        type: BadgeType.MASTERY,
        rarity: BadgeRarity.EPIC,
        imageUrl: "/badges/reading-expert.svg"
      },
      {
        name: "Listening Expert",
        description: "Mastered the listening section",
        type: BadgeType.MASTERY,
        rarity: BadgeRarity.EPIC,
        imageUrl: "/badges/listening-expert.svg"
      },
      {
        name: "Writing Expert",
        description: "Mastered the writing section",
        type: BadgeType.MASTERY,
        rarity: BadgeRarity.EPIC,
        imageUrl: "/badges/writing-expert.svg"
      },
      {
        name: "Speaking Expert",
        description: "Mastered the speaking section",
        type: BadgeType.MASTERY,
        rarity: BadgeRarity.EPIC,
        imageUrl: "/badges/speaking-expert.svg"
      },
      {
        name: "IELTS Legend",
        description: "Achieved mastery in all IELTS sections",
        type: BadgeType.SPECIAL,
        rarity: BadgeRarity.LEGENDARY,
        imageUrl: "/badges/ielts-legend.svg"
      }
    ];
    
    for (const badge of defaultBadges) {
      // Check if badge already exists
      const existing = await storage.getBadgeByName(badge.name);
      if (!existing) {
        await storage.createBadge(badge);
      }
    }
  } catch (error) {
    console.error("Error initializing default badges:", error);
  }
}

/**
 * Initialize all gamification data
 */
export async function initializeGamificationSystem(): Promise<void> {
  await initializePointActions();
  await initializeUserLevels();
  await initializeDefaultBadges();
}