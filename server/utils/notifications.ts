import { storage } from '../storage';
import { NotificationType, NotificationPriority } from '@shared/schema';

/**
 * Generates a vocabulary review notification for a user
 * @param userId The user ID to create the notification for
 * @returns The created notification
 */
export async function createVocabularyReviewNotification(userId: number) {
  const dueItems = await storage.getVocabularyForReview(userId, 1);
  
  if (dueItems.length === 0) {
    return null;
  }
  
  const count = await storage.getVocabularyForReview(userId);
  const countText = count.length > 1 ? `${count.length} words` : '1 word';
  
  return storage.createNotification({
    userId,
    type: NotificationType.VOCABULARY_REVIEW,
    title: "Time to review your vocabulary!",
    message: `You have ${countText} due for review today. Regular practice helps retention!`,
    priority: NotificationPriority.MEDIUM,
    actionLink: "/vocabulary-review",
    isRead: false
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
  return storage.createNotification({
    userId,
    type: NotificationType.TEST_REMINDER,
    title: "Complete your IELTS test",
    message: `You have an in-progress ${testTitle} test. Continue where you left off.`,
    priority: NotificationPriority.HIGH,
    actionLink: `/tests/${testId}`,
    isRead: false
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
  achievement: { name: string, description: string }
) {
  return storage.createNotification({
    userId,
    type: NotificationType.ACHIEVEMENT,
    title: `Achievement Unlocked: ${achievement.name}`,
    message: achievement.description,
    priority: NotificationPriority.LOW,
    isRead: false
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
  return storage.createNotification({
    userId,
    type: NotificationType.SYSTEM,
    title,
    message,
    priority,
    actionLink,
    isRead: false
  });
}

/**
 * Checks for and creates vocabulary review notifications if needed
 * This function should be called periodically (e.g., daily)
 */
export async function checkAndCreateVocabularyNotifications() {
  // Get all users
  const users = await storage.getAllUsers();
  
  for (const user of users) {
    // Check if user has vocabulary due for review
    const dueItems = await storage.getVocabularyForReview(user.id);
    
    if (dueItems.length > 0) {
      // Check if user already has an unread vocabulary notification
      const existingNotifications = await storage.getNotificationsByUser(user.id, true);
      const hasVocabularyNotification = existingNotifications.some(
        n => n.type === NotificationType.VOCABULARY_REVIEW
      );
      
      if (!hasVocabularyNotification) {
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
    // Get all attempts by this user
    const attempts = await storage.getAttemptsByUser(user.id);
    
    // Filter to in-progress or paused attempts
    const incompleteAttempts = attempts.filter(a => 
      a.status === "in_progress" || a.status === "paused"
    );
    
    for (const attempt of incompleteAttempts) {
      // Get the test details
      const test = await storage.getTest(attempt.testId);
      if (!test) continue;
      
      // Check if user already has an unread notification for this test
      const existingNotifications = await storage.getNotificationsByUser(user.id, true);
      const hasTestNotification = existingNotifications.some(
        n => n.type === NotificationType.TEST_REMINDER && n.actionLink === `/tests/${attempt.testId}`
      );
      
      if (!hasTestNotification) {
        await createTestReminderNotification(user.id, attempt.testId, test.title);
      }
    }
  }
}