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
export enum NotificationType {
  VOCABULARY_REVIEW = "vocabulary_review",
  TEST_REMINDER = "test_reminder",
  ACHIEVEMENT = "achievement",
  SYSTEM = "system"
}

export enum NotificationPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high"
}

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
