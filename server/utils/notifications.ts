import { NotificationType, NotificationPriority } from "@shared/schema";
import { storage } from "../storage";

/**
 * Creates a generic notification
 * @param params Notification parameters
 * @returns The created notification
 */
export async function createNotification(params: {
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  actionLink?: string | null;
  scheduledFor?: Date | null;
}) {
  return await storage.createNotification({
    userId: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    priority: params.priority,
    isRead: false,
    actionLink: params.actionLink || null,
    scheduledFor: params.scheduledFor || null
  });
}

/**
 * Generates a vocabulary review notification for a user
 * @param userId The user ID to create the notification for
 * @returns The created notification
 */
export async function createVocabularyReviewNotification(userId: number) {
  return await storage.createNotification({
    userId,
    type: NotificationType.VOCABULARY_REVIEW,
    title: "Vocabulary Review Due",
    message: "You have vocabulary items that are ready to be reviewed. Regular review helps you memorize words better.",
    priority: NotificationPriority.MEDIUM,
    isRead: false,
    actionLink: "/vocabulary-review"
  });
}

/**
 * Generates a test reminder notification for a user
 * @param userId The user ID to create the notification for
 * @param testId The test ID to remind about
 * @param testTitle The title of the test
 * @returns The created notification
 */
export async function createTestReminderNotification(userId: number, testId: number, testTitle: string) {
  return await storage.createNotification({
    userId,
    type: NotificationType.TEST_REMINDER,
    title: "Test Reminder",
    message: `Do not forget to complete the "${testTitle}" test. Regular practice improves your IELTS score.`,
    priority: NotificationPriority.MEDIUM,
    isRead: false,
    actionLink: `/tests/${testId}`
  });
}

/**
 * Generates an achievement notification for a user
 * @param userId The user ID to create the notification for
 * @param achievement The achievement details
 * @returns The created notification
 */
export async function createAchievementNotification(
  userId: number,
  achievement: { name: string; description: string }
) {
  return await storage.createNotification({
    userId,
    type: NotificationType.ACHIEVEMENT,
    title: `Achievement Unlocked: ${achievement.name}`,
    message: achievement.description,
    priority: NotificationPriority.HIGH,
    isRead: false,
    actionLink: "/achievements"
  });
}

/**
 * Generates a custom system notification for a user
 * @param userId The user ID to create the notification for
 * @param title The notification title
 * @param message The notification message
 * @param priority The notification priority
 * @param actionLink Optional link for the notification
 * @returns The created notification
 */
export async function createSystemNotification(
  userId: number,
  title: string,
  message: string,
  priority: NotificationPriority = NotificationPriority.MEDIUM,
  actionLink?: string
) {
  return await storage.createNotification({
    userId,
    type: NotificationType.SYSTEM,
    title,
    message,
    priority,
    isRead: false,
    actionLink
  });
}

/**
 * Creates a notification about a new feature being added to the platform
 * @param userId The user ID to create the notification for
 * @param featureName The name of the new feature
 * @param featureDescription A brief description of the feature
 * @param featureLink The link to the new feature
 */
export async function createNewFeatureNotification(
  userId: number,
  featureName: string,
  featureDescription: string,
  featureLink: string
) {
  return await storage.createNotification({
    userId,
    type: NotificationType.SYSTEM,
    title: `New Feature: ${featureName}`,
    message: featureDescription,
    priority: NotificationPriority.MEDIUM,
    isRead: false,
    actionLink: featureLink
  });
}

/**
 * Creates a notification for an upcoming test
 * @param userId The user ID to create the notification for
 * @param testId The test ID
 * @param testTitle The test title
 * @param testDate The date of the test
 */
export async function createUpcomingTestNotification(
  userId: number,
  testId: number,
  testTitle: string,
  testDate: Date
) {
  const formattedDate = testDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
  
  return await storage.createNotification({
    userId,
    type: NotificationType.TEST_REMINDER,
    title: "Upcoming Test",
    message: `You have a "${testTitle}" test scheduled for ${formattedDate}. Make sure to prepare in advance.`,
    priority: NotificationPriority.HIGH,
    isRead: false,
    actionLink: `/tests/${testId}`
  });
}

/**
 * Creates a notification to remind the user to practice speaking
 * @param userId The user ID to create the notification for
 */
export async function createSpeakingPracticeNotification(userId: number) {
  return await storage.createNotification({
    userId,
    type: NotificationType.SYSTEM,
    title: "Speaking Practice Reminder",
    message: "Regular speaking practice is crucial for IELTS success. Try our speaking exercises today.",
    priority: NotificationPriority.MEDIUM,
    isRead: false,
    actionLink: "/speaking-test"
  });
}

/**
 * Creates a notification to remind the user to practice writing
 * @param userId The user ID to create the notification for
 */
export async function createWritingPracticeNotification(userId: number) {
  return await storage.createNotification({
    userId,
    type: NotificationType.SYSTEM,
    title: "Writing Practice Reminder",
    message: "Improve your writing skills by practicing regularly. Try our writing exercises today.",
    priority: NotificationPriority.MEDIUM,
    isRead: false,
    actionLink: "/writing-test"
  });
}

/**
 * Creates a notification to recommend helpful learning resources
 * @param userId The user ID to create the notification for
 * @param resourceTitle The title of the recommended resource
 * @param resourceDescription A brief description of the resource
 * @param resourceLink The link to the resource
 */
export async function createResourceRecommendationNotification(
  userId: number,
  resourceTitle: string,
  resourceDescription: string,
  resourceLink: string
) {
  return await storage.createNotification({
    userId,
    type: NotificationType.SYSTEM,
    title: `Recommended: ${resourceTitle}`,
    message: resourceDescription,
    priority: NotificationPriority.LOW,
    isRead: false,
    actionLink: resourceLink
  });
}

/**
 * Creates a notification for a test progress update
 * @param userId The user ID to create the notification for
 * @param testModule The test module name
 * @param score The score achieved
 * @param previousScore The previous best score (if available)
 */
export async function createProgressUpdateNotification(
  userId: number,
  testModule: string,
  score: number,
  previousScore?: number
) {
  let message = `You scored ${score}% on your recent ${testModule} test.`;
  
  if (previousScore !== undefined && score > previousScore) {
    const improvement = score - previousScore;
    message += ` That is a ${improvement}% improvement from your previous best score!`;
  } else if (previousScore !== undefined) {
    message += ` Keep practicing to improve your score.`;
  }
  
  return await storage.createNotification({
    userId,
    type: NotificationType.ACHIEVEMENT,
    title: `${testModule} Progress Update`,
    message,
    priority: NotificationPriority.MEDIUM,
    isRead: false,
    actionLink: "/results"
  });
}

/**
 * Creates a notification to encourage continued practice during a streak
 * @param userId The user ID to create the notification for
 * @param streakDays The number of consecutive days of activity
 */
export async function createStreakNotification(userId: number, streakDays: number) {
  let title = "";
  let message = "";
  let priority = NotificationPriority.MEDIUM;
  
  if (streakDays === 3) {
    title = "3-Day Streak!";
    message = "You have been learning for 3 days in a row. Keep up the great work!";
  } else if (streakDays === 7) {
    title = "1-Week Streak!";
    message = "Congratulations on your 7-day streak! Consistency is key to IELTS success.";
    priority = NotificationPriority.HIGH;
  } else if (streakDays === 14) {
    title = "2-Week Streak!";
    message = "14 days of continuous learning! Your dedication is impressive.";
    priority = NotificationPriority.HIGH;
  } else if (streakDays === 30) {
    title = "30-Day Streak!";
    message = "Amazing! You have maintained a study habit for 30 days. This will make a real difference in your IELTS score.";
    priority = NotificationPriority.HIGH;
  } else if (streakDays % 30 === 0 && streakDays > 30) {
    const months = streakDays / 30;
    title = `${months}-Month Streak!`;
    message = `Incredible! You have been consistently studying for ${months} months. Your dedication is truly remarkable.`;
    priority = NotificationPriority.HIGH;
  } else if (streakDays % 7 === 0) {
    const weeks = streakDays / 7;
    title = `${weeks}-Week Streak!`;
    message = `You have maintained your learning streak for ${weeks} weeks! Keep going!`;
    priority = NotificationPriority.MEDIUM;
  }
  
  if (title && message) {
    return await storage.createNotification({
      userId,
      type: NotificationType.ACHIEVEMENT,
      title,
      message,
      priority,
      isRead: false,
      actionLink: "/dashboard"
    });
  }
  
  return null;
}

/**
 * Checks for and creates vocabulary review notifications if needed
 * This function should be called periodically (e.g., daily)
 */
export async function checkAndCreateVocabularyNotifications() {
  // Get all users
  const users = await storage.getAllUsers();
  
  for (const user of users) {
    // Check if the user has vocabulary items ready for review
    const reviewItems = await storage.getVocabularyForReview(user.id);
    
    if (reviewItems.length > 0) {
      // Check if a notification for this already exists and is unread
      const existingNotifications = await storage.getNotificationsByUser(user.id, true);
      const hasRecentReviewNotification = existingNotifications.some(
        n => n.type === NotificationType.VOCABULARY_REVIEW && 
        new Date(n.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
      );
      
      // If no recent notification exists, create one
      if (!hasRecentReviewNotification) {
        await createVocabularyReviewNotification(user.id);
      }
    }
  }
}

/**
 * Checks for and creates test reminder notifications for incomplete tests
 * This function should be called periodically (e.g., daily)
 */
export async function checkAndCreateTestReminderNotifications() {
  // Get all users
  const users = await storage.getAllUsers();
  
  for (const user of users) {
    // Get all tests
    const tests = await storage.getAllTests();
    
    // Get user's attempts
    const userAttempts = await storage.getAttemptsByUser(user.id);
    
    // Find tests that the user hasn't completed
    for (const test of tests) {
      const hasCompletedAttempt = userAttempts.some(
        attempt => attempt.testId === test.id && attempt.status === "completed"
      );
      
      const hasInProgressAttempt = userAttempts.some(
        attempt => attempt.testId === test.id && 
        ["not_started", "in_progress", "paused"].includes(attempt.status)
      );
      
      // If the test is active, the user has no completed attempts, 
      // and either has no attempts or has an in-progress attempt older than 3 days
      if (test.active && !hasCompletedAttempt) {
        let shouldSendReminder = false;
        
        if (!hasInProgressAttempt) {
          shouldSendReminder = true;
        } else {
          // Find the most recent in-progress attempt
          const inProgressAttempt = userAttempts
            .filter(attempt => attempt.testId === test.id && 
              ["not_started", "in_progress", "paused"].includes(attempt.status))
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
          
          // If the attempt is older than 3 days, send a reminder
          if (inProgressAttempt && new Date(inProgressAttempt.startTime).getTime() < Date.now() - 3 * 24 * 60 * 60 * 1000) {
            shouldSendReminder = true;
          }
        }
        
        if (shouldSendReminder) {
          // Check if a notification for this already exists and is unread
          const existingNotifications = await storage.getNotificationsByUser(user.id, true);
          const hasRecentTestNotification = existingNotifications.some(
            n => n.type === NotificationType.TEST_REMINDER && 
            n.message.includes(test.title) && 
            new Date(n.createdAt).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000
          );
          
          // If no recent notification exists, create one
          if (!hasRecentTestNotification) {
            await createTestReminderNotification(user.id, test.id, test.title);
          }
        }
      }
    }
  }
}

/**
 * Function to create all initial notifications for a new user
 * @param userId The ID of the new user
 */
export async function createWelcomeNotificationsForNewUser(userId: number) {
  // Create welcome notification
  await createSystemNotification(
    userId,
    "Welcome to the IELTS Exam Simulation Platform!",
    "We are excited to help you prepare for your IELTS exam. Start by exploring our features and taking a practice test.",
    NotificationPriority.HIGH,
    "/dashboard"
  );
  
  // Create notification about vocabulary feature
  await createSystemNotification(
    userId,
    "Vocabulary Learning Feature",
    "Build your vocabulary with our advanced learning system. Add words and practice with spaced repetition for better retention.",
    NotificationPriority.MEDIUM,
    "/vocabulary-page"
  );
  
  // Create notification about test modules
  await createSystemNotification(
    userId,
    "Practice All IELTS Modules",
    "Our platform offers comprehensive practice for all IELTS modules: Reading, Writing, Listening, and Speaking.",
    NotificationPriority.MEDIUM,
    "/dashboard"
  );
  
  return true;
}