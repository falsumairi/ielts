import { pgTable, text, serial, integer, boolean, timestamp, json, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// CEFR Language Proficiency Levels
export enum CEFRLevel {
  A1 = "A1",
  A2 = "A2",
  B1 = "B1",
  B2 = "B2",
  C1 = "C1",
  C2 = "C2"
}

// User roles
export enum UserRole {
  ADMIN = "admin",
  TEST_TAKER = "test_taker"
}

// Notification types
export enum NotificationType {
  SYSTEM = "system",
  TEST_REMINDER = "test_reminder",
  VOCABULARY_REVIEW = "vocabulary_review",
  ACHIEVEMENT = "achievement"
}

// Notification priorities
export enum NotificationPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent"
}

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default(UserRole.TEST_TAKER),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  role: true,
  verified: true,
});

// Test modules
export enum TestModule {
  READING = "reading",
  LISTENING = "listening",
  WRITING = "writing",
  SPEAKING = "speaking"
}

// Question types
export enum QuestionType {
  MULTIPLE_CHOICE = "multiple_choice",
  TRUE_FALSE_NG = "true_false_ng",
  FILL_BLANK = "fill_blank",
  MATCHING = "matching",
  SHORT_ANSWER = "short_answer",
  ESSAY = "essay",
  SPEAKING = "speaking"
}

// Tests table
export const tests = pgTable("tests", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  module: text("module").notNull(), // One of TestModule
  durationMinutes: integer("duration_minutes").notNull(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTestSchema = createInsertSchema(tests).pick({
  title: true,
  description: true,
  module: true,
  durationMinutes: true,
  active: true,
});

// Questions table
export const questions = pgTable("questions", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").notNull(),
  type: text("type").notNull(), // One of QuestionType
  content: text("content").notNull(),
  options: json("options"), // For multiple choice, true/false, matching
  correctAnswer: text("correct_answer"), // For automated grading
  audioPath: text("audio_path"), // For listening questions
  passageIndex: integer("passage_index"), // For reading questions
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQuestionSchema = createInsertSchema(questions).pick({
  testId: true,
  type: true,
  content: true,
  options: true,
  correctAnswer: true,
  audioPath: true,
  passageIndex: true,
});

// Reading passages
export const passages = pgTable("passages", {
  id: serial("id").primaryKey(),
  testId: integer("test_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  index: integer("index").notNull(), // Order in the test
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPassageSchema = createInsertSchema(passages).pick({
  testId: true,
  title: true,
  content: true,
  index: true,
});

// Test attempts
export const attempts = pgTable("attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  testId: integer("test_id").notNull(),
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  status: text("status").notNull().default("in_progress"), // in_progress, completed, abandoned
  score: integer("score"), // For automatically graded sections
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAttemptSchema = createInsertSchema(attempts).pick({
  userId: true,
  testId: true,
  status: true,
});

// Answers
export const answers = pgTable("answers", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id").notNull(),
  questionId: integer("question_id").notNull(),
  answer: text("answer").notNull(),
  isCorrect: boolean("is_correct"),
  score: integer("score"), // For partially correct answers
  audioPath: text("audio_path"), // For speaking answers
  gradedBy: integer("graded_by"), // User ID of admin who graded (for writing/speaking)
  feedback: text("feedback"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAnswerSchema = createInsertSchema(answers).pick({
  attemptId: true,
  questionId: true,
  answer: true,
  isCorrect: true,
  score: true,
  audioPath: true,
});

// Vocabulary table
export const vocabularies = pgTable("vocabularies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  word: text("word").notNull(),
  cefrLevel: text("cefr_level").notNull(), // One of CEFRLevel
  wordFamily: text("word_family"), // Related words (nouns, verbs, adjectives)
  meaning: text("meaning").notNull(), // English definition
  example: text("example").notNull(), // Example sentence
  arabicMeaning: text("arabic_meaning"), // Arabic translation
  lastReviewed: timestamp("last_reviewed").defaultNow(),
  nextReview: timestamp("next_review"), // For spaced repetition
  reviewStage: integer("review_stage").default(0), // Current stage in PACE repetition
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertVocabularySchema = createInsertSchema(vocabularies).pick({
  userId: true,
  word: true,
  cefrLevel: true,
  wordFamily: true,
  meaning: true,
  example: true,
  arabicMeaning: true,
  reviewStage: true
});

// Notifications table

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(), // One of NotificationType
  title: text("title").notNull(),
  message: text("message").notNull(),
  priority: text("priority").notNull().default(NotificationPriority.MEDIUM),
  isRead: boolean("is_read").default(false),
  actionLink: text("action_link"), // Optional link to take action on
  scheduledFor: timestamp("scheduled_for").defaultNow(), // When to show the notification
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  type: true,
  title: true,
  message: true,
  priority: true,
  isRead: true,
  actionLink: true,
  scheduledFor: true
});

// Type definitions
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertTest = z.infer<typeof insertTestSchema>;
export type Test = typeof tests.$inferSelect;

export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questions.$inferSelect;

export type InsertPassage = z.infer<typeof insertPassageSchema>;
export type Passage = typeof passages.$inferSelect;

export type InsertAttempt = z.infer<typeof insertAttemptSchema>;
export type Attempt = typeof attempts.$inferSelect;

export type InsertAnswer = z.infer<typeof insertAnswerSchema>;
export type Answer = typeof answers.$inferSelect;

export type InsertVocabulary = z.infer<typeof insertVocabularySchema>;
export type Vocabulary = typeof vocabularies.$inferSelect;

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Gamification Enums

// Badge types
export enum BadgeType {
  ACHIEVEMENT = "achievement", // For completing specific goals
  MILESTONE = "milestone",     // For reaching numerical milestones
  SPECIAL = "special",         // For special achievements or events
  MASTERY = "mastery"          // For skill mastery
}

// Badge rarity levels
export enum BadgeRarity {
  COMMON = "common",
  UNCOMMON = "uncommon",
  RARE = "rare",
  EPIC = "epic",
  LEGENDARY = "legendary"
}

// Point action types
export enum PointActionType {
  COMPLETE_TEST = "complete_test",
  REVIEW_VOCABULARY = "review_vocabulary",
  ADD_VOCABULARY = "add_vocabulary",
  LOGIN_STREAK = "login_streak",
  PERFECT_SCORE = "perfect_score",
  FIRST_ATTEMPT = "first_attempt",
  FEEDBACK_GIVEN = "feedback_given" 
}

// Badges table - System reference for all available badges
export const badges = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  type: text("type").notNull(), // One of BadgeType
  rarity: text("rarity").notNull().default(BadgeRarity.COMMON),
  imageUrl: text("image_url").notNull(),
  requiredScore: integer("required_score"), // Points needed (if applicable)
  requiredCount: integer("required_count"), // Actions needed (if applicable)
  moduleType: text("module_type"), // Optional: Specific module (reading, etc.)
  createdAt: timestamp("created_at").defaultNow(),
  isActive: boolean("is_active").default(true)
});

export const insertBadgeSchema = createInsertSchema(badges).pick({
  name: true,
  description: true,
  type: true,
  rarity: true,
  imageUrl: true,
  requiredScore: true,
  requiredCount: true,
  moduleType: true,
  isActive: true
});

// User badges - Links users to their earned badges
export const userBadges = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  badgeId: integer("badge_id").notNull(),
  earnedAt: timestamp("earned_at").defaultNow(),
  isDisplayed: boolean("is_displayed").default(true), // For user profile display
  timesEarned: integer("times_earned").default(1) // For repeated achievements
});

export const insertUserBadgeSchema = createInsertSchema(userBadges).pick({
  userId: true,
  badgeId: true,
  isDisplayed: true,
  timesEarned: true
});

// Point system configuration
export const pointActions = pgTable("point_actions", {
  id: serial("id").primaryKey(),
  actionType: text("action_type").notNull().unique(), // One of PointActionType
  pointsAwarded: integer("points_awarded").notNull(),
  description: text("description").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow()
});

export const insertPointActionSchema = createInsertSchema(pointActions).pick({
  actionType: true,
  pointsAwarded: true,
  description: true,
  isActive: true
});

// User points history - Tracks point transactions
export const userPoints = pgTable("user_points", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  actionType: text("action_type").notNull(), // One of PointActionType
  points: integer("points").notNull(),
  description: text("description").notNull(),
  earnedAt: timestamp("earned_at").defaultNow(),
  relatedEntityId: integer("related_entity_id"), // Optional: ID of related entity (test, vocabulary, etc.)
  relatedEntityType: text("related_entity_type") // Optional: Type of related entity
});

export const insertUserPointSchema = createInsertSchema(userPoints).pick({
  userId: true,
  actionType: true,
  points: true,
  description: true,
  relatedEntityId: true,
  relatedEntityType: true
});

// User levels - Defines achievement levels
export const userLevels = pgTable("user_levels", {
  id: serial("id").primaryKey(),
  level: integer("level").notNull().unique(),
  name: text("name").notNull(),
  requiredPoints: integer("required_points").notNull(),
  badgeId: integer("badge_id"), // Optional badge awarded for reaching this level
  createdAt: timestamp("created_at").defaultNow()
});

export const insertUserLevelSchema = createInsertSchema(userLevels).pick({
  level: true,
  name: true,
  requiredPoints: true,
  badgeId: true
});

// User achievements - Tracks overall progress and levels
export const userAchievements = pgTable("user_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  totalPoints: integer("total_points").notNull().default(0),
  currentLevel: integer("current_level").notNull().default(1),
  loginStreak: integer("login_streak").notNull().default(0),
  lastLoginDate: timestamp("last_login_date").defaultNow(),
  testsCompleted: integer("tests_completed").notNull().default(0),
  vocabularyAdded: integer("vocabulary_added").notNull().default(0),
  vocabularyReviewed: integer("vocabulary_reviewed").notNull().default(0),
  highestScore: integer("highest_score").default(0),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertUserAchievementSchema = createInsertSchema(userAchievements).pick({
  userId: true,
  totalPoints: true,
  currentLevel: true,
  loginStreak: true,
  lastLoginDate: true,
  testsCompleted: true,
  vocabularyAdded: true,
  vocabularyReviewed: true,
  highestScore: true
});

// Type definitions for Gamification
export type InsertBadge = z.infer<typeof insertBadgeSchema>;
export type Badge = typeof badges.$inferSelect;

export type InsertUserBadge = z.infer<typeof insertUserBadgeSchema>;
export type UserBadge = typeof userBadges.$inferSelect;

export type InsertPointAction = z.infer<typeof insertPointActionSchema>;
export type PointAction = typeof pointActions.$inferSelect;

export type InsertUserPoint = z.infer<typeof insertUserPointSchema>;
export type UserPoint = typeof userPoints.$inferSelect;

export type InsertUserLevel = z.infer<typeof insertUserLevelSchema>;
export type UserLevel = typeof userLevels.$inferSelect;

export type InsertUserAchievement = z.infer<typeof insertUserAchievementSchema>;
export type UserAchievement = typeof userAchievements.$inferSelect;
