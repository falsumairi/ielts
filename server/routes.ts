import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { TestModule, UserRole, QuestionType, NotificationType, NotificationPriority, PointActionType } from "@shared/schema";
import helmet from "helmet";
import { z } from "zod";
import { sendEmail, generateOTP, emailTemplates } from "./utils/email";
import { scoreWritingResponse, scoreSpeakingResponse, transcribeSpeakingAudio } from "./utils/openai";
import { translateToArabic, translateToEnglish, translateTranscription } from "./utils/translate";
import { analyzeVocabulary } from "./utils/vocabulary";
import { createVocabularyReviewNotification, createTestReminderNotification, createAchievementNotification, createSystemNotification } from "./utils/notifications";
import { initializeGamificationSystem, awardPoints, awardBadge, updateLoginStreak, checkForBadges } from "./utils/gamification";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import csvParser from 'csv-parser';

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).send("Unauthorized");
};

// Middleware to check if user is an admin
const isAdmin = (req: Request, res: Response, next: Function) => {
  if (req.isAuthenticated() && req.user.role === UserRole.ADMIN) {
    return next();
  }
  res.status(403).send("Forbidden");
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize gamification system
  await initializeGamificationSystem();
  console.log('[gamification] Gamification system initialized');

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
      },
    },
    // Allow audio to work properly
    crossOriginEmbedderPolicy: false
  }));

  // Setup authentication routes
  setupAuth(app);

  // Tests routes
  app.get("/api/tests", isAuthenticated, async (req, res) => {
    const tests = await storage.getAllTests();
    res.json(tests);
  });

  app.get("/api/tests/:id", isAuthenticated, async (req, res) => {
    const testId = parseInt(req.params.id);
    if (isNaN(testId)) {
      return res.status(400).send("Invalid test ID");
    }

    const test = await storage.getTest(testId);
    if (!test) {
      return res.status(404).send("Test not found");
    }

    res.json(test);
  });

  app.get("/api/tests/module/:module", isAuthenticated, async (req, res) => {
    const module = req.params.module as TestModule;
    if (!Object.values(TestModule).includes(module)) {
      return res.status(400).send("Invalid test module");
    }

    const tests = await storage.getTestsByModule(module);
    res.json(tests);
  });

  app.post("/api/tests", isAdmin, async (req, res) => {
    try {
      const testSchema = z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        module: z.enum([TestModule.READING, TestModule.LISTENING, TestModule.WRITING, TestModule.SPEAKING]),
        durationMinutes: z.number().positive(),
        active: z.boolean().optional(),
      });

      const validatedData = testSchema.parse(req.body);
      const test = await storage.createTest(validatedData);
      res.status(201).json(test);
    } catch (error) {
      res.status(400).send(`Invalid test data: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  
  // Update test
  app.patch("/api/tests/:id", isAdmin, async (req, res) => {
    const testId = parseInt(req.params.id);
    if (isNaN(testId)) {
      return res.status(400).send("Invalid test ID");
    }
    
    try {
      const testSchema = z.object({
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        durationMinutes: z.number().positive().optional(),
        active: z.boolean().optional(),
      });
      
      const validatedData = testSchema.parse(req.body);
      const updatedTest = await storage.updateTest(testId, validatedData);
      
      if (!updatedTest) {
        return res.status(404).send("Test not found");
      }
      
      res.json(updatedTest);
    } catch (error) {
      res.status(400).send(`Invalid test data: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  // Questions routes
  app.get("/api/tests/:id/questions", isAuthenticated, async (req, res) => {
    const testId = parseInt(req.params.id);
    if (isNaN(testId)) {
      return res.status(400).send("Invalid test ID");
    }
    
    // Check if randomize flag is set
    const randomize = req.query.randomize === 'true';
    const count = req.query.count ? parseInt(req.query.count as string) : undefined;
    
    if (randomize) {
      const questions = await storage.getRandomizedQuestionsForTest(testId, count);
      res.json(questions);
    } else {
      const questions = await storage.getQuestionsForTest(testId);
      res.json(questions);
    }
  });

  // Passages routes
  app.get("/api/tests/:id/passages", isAuthenticated, async (req, res) => {
    const testId = parseInt(req.params.id);
    if (isNaN(testId)) {
      return res.status(400).send("Invalid test ID");
    }

    const passages = await storage.getPassagesForTest(testId);
    res.json(passages);
  });

  // Attempts routes
  app.get("/api/attempts/user", isAuthenticated, async (req, res) => {
    const userId = req.user.id;
    const attempts = await storage.getAttemptsByUser(userId);
    res.json(attempts);
  });
  
  // Get active (in_progress or paused) session for a test
  app.get("/api/attempts/active", isAuthenticated, async (req, res) => {
    const userId = req.user.id;
    const testId = req.query.testId ? parseInt(req.query.testId as string) : undefined;
    
    if (testId && isNaN(testId)) {
      return res.status(400).send("Invalid test ID");
    }
    
    // Get all attempts by this user
    const userAttempts = await storage.getAttemptsByUser(userId);
    
    // Filter to active attempts for the given test (or any test if no testId)
    const activeAttempts = userAttempts.filter(a => 
      (a.status === "in_progress" || a.status === "paused") && 
      (!testId || a.testId === testId)
    );
    
    if (activeAttempts.length === 0) {
      return res.status(404).send("No active attempts found");
    }
    
    // Return the most recent active attempt
    const mostRecentAttempt = activeAttempts.sort((a, b) => 
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    )[0];
    
    // Get test to determine total duration
    const test = await storage.getTest(mostRecentAttempt.testId);
    if (!test) {
      return res.status(404).send("Test not found");
    }
    
    // Calculate remaining time
    let timeRemaining = test.durationMinutes * 60; // Convert to seconds
    
    if (mostRecentAttempt.startTime) {
      const startTime = new Date(mostRecentAttempt.startTime);
      const elapsedSeconds = Math.floor((Date.now() - startTime.getTime()) / 1000);
      timeRemaining = Math.max(0, (test.durationMinutes * 60) - elapsedSeconds);
    }
    
    // Get answers for this attempt
    const answers = await storage.getAnswersForAttempt(mostRecentAttempt.id);
    
    // Combine all data and return
    const attemptWithDetails = {
      ...mostRecentAttempt,
      testDuration: test.durationMinutes,
      timeRemaining,
      answers,
    };
    
    res.json(attemptWithDetails);
  });

  app.get("/api/tests/:id/attempts", isAdmin, async (req, res) => {
    const testId = parseInt(req.params.id);
    if (isNaN(testId)) {
      return res.status(400).send("Invalid test ID");
    }

    const attempts = await storage.getAttemptsForTest(testId);
    res.json(attempts);
  });

  // Create a new attempt/session
  app.post("/api/attempts", isAuthenticated, async (req, res) => {
    try {
      const attemptSchema = z.object({
        testId: z.number().int().positive(),
        userId: z.number().int().positive(),
        status: z.enum(["not_started", "in_progress", "paused", "completed", "timed_out"])
      });
      
      const validatedData = attemptSchema.parse(req.body);
      
      // Verify this is the user's own attempt
      if (validatedData.userId !== req.user.id) {
        return res.status(403).send("Cannot create attempt for another user");
      }
      
      // Verify the test exists
      const test = await storage.getTest(validatedData.testId);
      if (!test) {
        return res.status(404).send("Test not found");
      }
      
      // Check if user already has an active attempt for this test
      const userAttempts = await storage.getAttemptsByUser(req.user.id);
      const hasActiveAttempt = userAttempts.some(
        a => a.testId === validatedData.testId && 
        (a.status === "in_progress" || a.status === "paused")
      );
      
      if (hasActiveAttempt) {
        return res.status(409).send("You already have an active attempt for this test");
      }
      
      // Create the attempt
      const attempt = await storage.createAttempt({
        userId: validatedData.userId,
        testId: validatedData.testId,
        status: validatedData.status
      });
      
      // Return with test duration
      const response = {
        ...attempt,
        testDuration: test.durationMinutes
      };
      
      res.status(201).json(response);
    } catch (error) {
      res.status(400).send(`Invalid attempt data: ${error.message}`);
    }
  });

  app.get("/api/attempts/:id", isAuthenticated, async (req, res) => {
    const attemptId = parseInt(req.params.id);
    if (isNaN(attemptId)) {
      return res.status(400).send("Invalid attempt ID");
    }

    const attempt = await storage.getAttempt(attemptId);
    if (!attempt) {
      return res.status(404).send("Attempt not found");
    }

    // Check if the user is authorized to access this attempt
    if (attempt.userId !== req.user.id && req.user.role !== UserRole.ADMIN) {
      return res.status(403).send("Forbidden");
    }
    
    // Get the test to include duration info
    const test = await storage.getTest(attempt.testId);
    if (!test) {
      return res.status(404).send("Test not found");
    }
    
    // Get answers for this attempt
    const answers = await storage.getAnswersForAttempt(attemptId);
    
    // Calculate remaining time for in-progress attempts
    let timeRemaining = null;
    if (attempt.status === "in_progress" && attempt.startTime) {
      const startTime = new Date(attempt.startTime);
      const elapsedSeconds = Math.floor((Date.now() - startTime.getTime()) / 1000);
      timeRemaining = Math.max(0, (test.durationMinutes * 60) - elapsedSeconds);
    }
    
    // Combine all data and return
    const attemptWithDetails = {
      ...attempt,
      testDuration: test.durationMinutes,
      timeRemaining,
      answers,
    };

    res.json(attemptWithDetails);
  });

  // Update attempt status (for handling pauses, completions, timeouts)
  app.patch("/api/attempts/:id/status", isAuthenticated, async (req, res) => {
    const attemptId = parseInt(req.params.id);
    if (isNaN(attemptId)) {
      return res.status(400).send("Invalid attempt ID");
    }

    const attempt = await storage.getAttempt(attemptId);
    if (!attempt) {
      return res.status(404).send("Attempt not found");
    }

    // Check if the user is authorized to modify this attempt
    if (attempt.userId !== req.user.id && req.user.role !== UserRole.ADMIN) {
      return res.status(403).send("Forbidden");
    }

    try {
      const updateSchema = z.object({
        status: z.enum(["not_started", "in_progress", "paused", "completed", "timed_out"]),
        endTime: z.string().datetime().optional(),
        score: z.number().optional()
      });
      
      const validatedData = updateSchema.parse(req.body);
      
      // If we're ending the attempt, make sure we have an end time
      const endTime = validatedData.endTime 
        ? new Date(validatedData.endTime) 
        : (["completed", "timed_out"].includes(validatedData.status) ? new Date() : undefined);
      
      const updatedAttempt = await storage.updateAttemptStatus(
        attemptId, 
        validatedData.status, 
        endTime, 
        validatedData.score
      );
      
      // If the attempt is completed, send a notification
      if (validatedData.status === "completed") {
        // Get test details
        const test = await storage.getTest(updatedAttempt.testId);
        if (test) {
          // Create notification about completed test
          await createSystemNotification(
            updatedAttempt.userId,
            `${test.title} Completed`,
            `You have completed the ${test.title}. ${
              validatedData.score !== undefined ? `Your score is ${validatedData.score}%` : 'Your score will be available soon'
            }. Check your results page for more details.`,
            NotificationPriority.MEDIUM,
            "/results"
          );
          
          // Check if they've completed all modules for an achievement notification
          const userAttempts = await storage.getAttemptsByUser(updatedAttempt.userId);
          const completedAttempts = userAttempts.filter(a => a.status === "completed");
          const completedTestIds = completedAttempts.map(a => a.testId);
          
          // Get all the tests to check which modules they've completed
          const completedTests = await Promise.all(
            completedTestIds.map(id => storage.getTest(id))
          );
          
          // Extract modules from completed tests (filter out any undefined tests)
          const completedModules = new Set(
            completedTests
              .filter(Boolean) // Remove undefined tests
              .map(t => t?.module)
          );
          
          // Check if they've completed all modules
          if (completedModules.size === Object.keys(TestModule).length) {
            await createAchievementNotification(
              updatedAttempt.userId,
              {
                name: "IELTS Master",
                description: "You've completed all test modules! Great job preparing for your IELTS exam!"
              }
            );
          }
        }
      }
      
      res.json(updatedAttempt);
    } catch (error) {
      res.status(400).send(`Invalid status update: ${error.message}`);
    }
  });

  // Answers routes
  app.get("/api/attempts/:id/answers", isAuthenticated, async (req, res) => {
    const attemptId = parseInt(req.params.id);
    if (isNaN(attemptId)) {
      return res.status(400).send("Invalid attempt ID");
    }

    const attempt = await storage.getAttempt(attemptId);
    if (!attempt) {
      return res.status(404).send("Attempt not found");
    }

    // Check if the user is authorized to access answers for this attempt
    if (attempt.userId !== req.user.id && req.user.role !== UserRole.ADMIN) {
      return res.status(403).send("Forbidden");
    }

    const answers = await storage.getAnswersForAttempt(attemptId);
    res.json(answers);
  });

  app.post("/api/attempts/:id/answers", isAuthenticated, async (req, res) => {
    const attemptId = parseInt(req.params.id);
    if (isNaN(attemptId)) {
      return res.status(400).send("Invalid attempt ID");
    }

    const attempt = await storage.getAttempt(attemptId);
    if (!attempt) {
      return res.status(404).send("Attempt not found");
    }

    // Check if the user is authorized to add answers to this attempt
    if (attempt.userId !== req.user.id) {
      return res.status(403).send("Forbidden");
    }

    // Validate request body
    const answerSchema = z.object({
      questionId: z.number().int().positive(),
      answer: z.string().min(1),
      audioPath: z.string().optional(),
    });

    try {
      const validatedData = answerSchema.parse(req.body);
      
      // Check if the question exists and belongs to the test
      const question = await storage.getQuestion(validatedData.questionId);
      if (!question || question.testId !== attempt.testId) {
        return res.status(404).send("Question not found");
      }

      // For automatically graded question types, check correctness
      let isCorrect = undefined;
      if (question.correctAnswer) {
        // Simple string comparison for most question types
        isCorrect = question.correctAnswer.toLowerCase() === validatedData.answer.toLowerCase();
      }

      const answer = await storage.createAnswer({
        attemptId,
        questionId: validatedData.questionId,
        answer: validatedData.answer,
        isCorrect,
        score: isCorrect ? 1 : 0,
        audioPath: validatedData.audioPath || null,
      });

      res.status(201).json(answer);
    } catch (error) {
      res.status(400).send(`Invalid answer data: ${error.message}`);
    }
  });

  // For manual grading (admin only)
  app.patch("/api/answers/:id", isAdmin, async (req, res) => {
    const answerId = parseInt(req.params.id);
    if (isNaN(answerId)) {
      return res.status(400).send("Invalid answer ID");
    }

    const answer = await storage.getAnswer(answerId);
    if (!answer) {
      return res.status(404).send("Answer not found");
    }

    const { isCorrect, score, feedback } = req.body;
    
    if (isCorrect === undefined && score === undefined && feedback === undefined) {
      return res.status(400).send("No valid fields to update");
    }

    const updatedAnswer = await storage.updateAnswer(
      answerId,
      isCorrect !== undefined ? isCorrect : answer.isCorrect,
      score !== undefined ? score : answer.score,
      feedback,
      req.user.id
    );

    // Update attempt score if needed
    if (score !== undefined) {
      const allAnswers = await storage.getAnswersForAttempt(answer.attemptId);
      const totalScore = allAnswers.reduce((sum, ans) => sum + (ans.score || 0), 0);
      await storage.updateAttemptStatus(answer.attemptId, "completed", undefined, totalScore);
    }

    res.json(updatedAnswer);
  });

  // Admin routes
  // Get all users (admin only)
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    const users = await storage.getAllUsers();
    res.json(users);
  });

  // Verify a user (admin only)
  app.patch("/api/admin/users/:id/verify", isAdmin, async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).send("Invalid user ID");
    }

    try {
      const verifySchema = z.object({
        verified: z.boolean(),
      });

      const validatedData = verifySchema.parse(req.body);
      const updatedUser = await storage.updateUserVerificationStatus(userId, validatedData.verified);
      
      if (!updatedUser) {
        return res.status(404).send("User not found");
      }
      
      res.json(updatedUser);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).send(`Invalid update: ${error.message}`);
      } else {
        res.status(400).send("Invalid update");
      }
    }
  });

  // Update user role (admin only)
  app.patch("/api/admin/users/:id/role", isAdmin, async (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).send("Invalid user ID");
    }

    try {
      const roleSchema = z.object({
        role: z.enum([UserRole.ADMIN, UserRole.TEST_TAKER]),
      });

      const validatedData = roleSchema.parse(req.body);
      const updatedUser = await storage.updateUserRole(userId, validatedData.role);
      
      if (!updatedUser) {
        return res.status(404).send("User not found");
      }
      
      res.json(updatedUser);
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).send(`Invalid update: ${error.message}`);
      } else {
        res.status(400).send("Invalid update");
      }
    }
  });

  // Test Management Routes (Admin Only)
  
  // Get all tests
  app.get("/api/admin/tests", isAdmin, async (req, res) => {
    try {
      const tests = await storage.getAllTests();
      
      // Get additional stats like questions count
      const testsWithStats = await Promise.all(tests.map(async (test) => {
        const questions = await storage.getQuestionsForTest(test.id);
        const passages = test.module === TestModule.READING 
          ? await storage.getPassagesForTest(test.id)
          : [];
          
        return {
          ...test,
          questionsCount: questions.length,
          passagesCount: passages.length
        };
      }));
      
      res.json(testsWithStats);
    } catch (error) {
      console.error("Error fetching tests:", error);
      res.status(500).json({ error: "Failed to fetch tests" });
    }
  });

  // Get a specific test
  app.get("/api/admin/tests/:id", isAdmin, async (req, res) => {
    const testId = parseInt(req.params.id);
    if (isNaN(testId)) {
      return res.status(400).json({ error: "Invalid test ID" });
    }

    try {
      const test = await storage.getTest(testId);
      if (!test) {
        return res.status(404).json({ error: "Test not found" });
      }

      const questions = await storage.getQuestionsForTest(testId);
      const passages = test.module === TestModule.READING 
        ? await storage.getPassagesForTest(testId)
        : [];

      res.json({
        ...test,
        questions,
        passages
      });
    } catch (error) {
      console.error("Error fetching test:", error);
      res.status(500).json({ error: "Failed to fetch test" });
    }
  });

  // Create a new test
  app.post("/api/admin/tests", isAdmin, async (req, res) => {
    try {
      const testSchema = z.object({
        title: z.string().min(3),
        description: z.string().optional(),
        module: z.enum([
          TestModule.READING, 
          TestModule.LISTENING, 
          TestModule.WRITING, 
          TestModule.SPEAKING
        ]),
        durationMinutes: z.number().min(1),
        active: z.boolean().default(true),
      });

      const validatedData = testSchema.parse(req.body);
      const newTest = await storage.createTest(validatedData);
      
      res.status(201).json(newTest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating test:", error);
      res.status(500).json({ error: "Failed to create test" });
    }
  });

  // Update a test
  app.patch("/api/admin/tests/:id", isAdmin, async (req, res) => {
    const testId = parseInt(req.params.id);
    if (isNaN(testId)) {
      return res.status(400).json({ error: "Invalid test ID" });
    }

    try {
      const testSchema = z.object({
        title: z.string().min(3).optional(),
        description: z.string().optional(),
        module: z.enum([
          TestModule.READING, 
          TestModule.LISTENING, 
          TestModule.WRITING, 
          TestModule.SPEAKING
        ]).optional(),
        durationMinutes: z.number().min(1).optional(),
        active: z.boolean().optional(),
      });

      const validatedData = testSchema.parse(req.body);
      const test = await storage.getTest(testId);
      
      if (!test) {
        return res.status(404).json({ error: "Test not found" });
      }

      const updatedTest = await storage.updateTest(testId, {
        ...test,
        ...validatedData
      });
      
      res.json(updatedTest);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error updating test:", error);
      res.status(500).json({ error: "Failed to update test" });
    }
  });

  // Add a question to a test
  app.post("/api/admin/tests/:id/questions", isAdmin, async (req, res) => {
    const testId = parseInt(req.params.id);
    if (isNaN(testId)) {
      return res.status(400).json({ error: "Invalid test ID" });
    }

    try {
      const questionSchema = z.object({
        type: z.enum([
          QuestionType.MULTIPLE_CHOICE,
          QuestionType.TRUE_FALSE_NG,
          QuestionType.FILL_BLANK,
          QuestionType.MATCHING,
          QuestionType.SHORT_ANSWER,
          QuestionType.ESSAY, 
          QuestionType.SPEAKING
        ]),
        content: z.string().min(3),
        options: z.any().optional(),
        correctAnswer: z.string().optional(),
        audioPath: z.string().optional(),
        passageIndex: z.number().optional(),
      });

      const validatedData = questionSchema.parse(req.body);
      
      // Check if the test exists
      const test = await storage.getTest(testId);
      if (!test) {
        return res.status(404).json({ error: "Test not found" });
      }

      const newQuestion = await storage.createQuestion({
        ...validatedData,
        testId
      });
      
      res.status(201).json(newQuestion);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating question:", error);
      res.status(500).json({ error: "Failed to create question" });
    }
  });

  // Add a reading passage to a test
  app.post("/api/admin/tests/:id/passages", isAdmin, async (req, res) => {
    const testId = parseInt(req.params.id);
    if (isNaN(testId)) {
      return res.status(400).json({ error: "Invalid test ID" });
    }

    try {
      const passageSchema = z.object({
        title: z.string().min(3),
        content: z.string().min(10),
        index: z.number().min(1),
      });

      const validatedData = passageSchema.parse(req.body);
      
      // Check if the test exists and is a reading test
      const test = await storage.getTest(testId);
      if (!test) {
        return res.status(404).json({ error: "Test not found" });
      }
      
      if (test.module !== TestModule.READING) {
        return res.status(400).json({ 
          error: "Passages can only be added to reading tests" 
        });
      }

      const newPassage = await storage.createPassage({
        ...validatedData,
        testId
      });
      
      res.status(201).json(newPassage);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating passage:", error);
      res.status(500).json({ error: "Failed to create passage" });
    }
  });

  // File upload middleware

  // Create upload directories if they don't exist
  const moduleURL = new URL(import.meta.url);
  const dirname = path.dirname(moduleURL.pathname);
  const uploadDir = path.join(dirname, '../uploads');
  const audioDir = path.join(uploadDir, 'audio');
  const imagesDir = path.join(uploadDir, 'images');

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir);
  }
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir);
  }

  // Configure audio storage
  const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, audioDir);
    },
    filename: (req, file, cb) => {
      const testId = req.params.id;
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `test-${testId}-${uniqueSuffix}${ext}`);
    }
  });

  // Configure image storage
  const imageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, imagesDir);
    },
    filename: (req, file, cb) => {
      const testId = req.params.id;
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, `test-${testId}-${uniqueSuffix}${ext}`);
    }
  });

  // Create upload instances
  const uploadAudio = multer({ 
    storage: audioStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
      const allowedMimes = ['audio/mp3', 'audio/mpeg', 'audio/wav'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only MP3 and WAV files are allowed.'), false);
      }
    }
  });

  const uploadImage = multer({ 
    storage: imageStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPG and PNG files are allowed.'), false);
      }
    }
  });

  // Upload audio file
  app.post('/api/admin/tests/:id/audio/upload', isAdmin, uploadAudio.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Save the audio path in the database or return to client
      const relativePath = path.relative(path.join(dirname, '..'), req.file.path);
      
      // Remove leading "../" if present in the path
      const cleanPath = relativePath.replace(/^\.\.\//, '');
      
      res.json({ 
        success: true, 
        path: cleanPath,
        filename: req.file.filename,
        size: req.file.size
      });
    } catch (error) {
      console.error('Error uploading audio file:', error);
      res.status(500).json({ error: 'Failed to upload audio file' });
    }
  });

  // Upload image file
  app.post('/api/admin/tests/:id/images/upload', isAdmin, uploadImage.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Save the image path in the database or return to client
      const relativePath = path.relative(path.join(dirname, '..'), req.file.path);
      
      // Remove leading "../" if present in the path
      const cleanPath = relativePath.replace(/^\.\.\//, '');
      
      res.json({ 
        success: true, 
        path: cleanPath,
        filename: req.file.filename,
        size: req.file.size
      });
    } catch (error) {
      console.error('Error uploading image file:', error);
      res.status(500).json({ error: 'Failed to upload image file' });
    }
  });

  // Bulk upload questions (from JSON, CSV, or XLSX file)
  const uploadQuestionFiles = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        'application/json',
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JSON, CSV, and Excel files are allowed.'), false);
      }
    }
  });
  
  // Download question template
  app.get('/api/admin/tests/template/questions/download', isAdmin, (req, res) => {
    try {
      const format = req.query.format as string || 'xlsx';
      const testType = req.query.module as TestModule || TestModule.READING;
      
      // Create template data based on test type
      const templateData = [
        {
          type: QuestionType.MULTIPLE_CHOICE,
          content: 'Sample multiple choice question',
          options: JSON.stringify(['Option A', 'Option B', 'Option C', 'Option D']),
          correctAnswer: 'Option A',
          passageIndex: testType === TestModule.READING ? 0 : null,
          audioPath: testType === TestModule.LISTENING ? 'audio_file.mp3' : null,
        },
        {
          type: QuestionType.TRUE_FALSE_NG,
          content: 'Sample true/false/not given question',
          options: JSON.stringify(['True', 'False', 'Not Given']),
          correctAnswer: 'True',
          passageIndex: testType === TestModule.READING ? 0 : null,
          audioPath: testType === TestModule.LISTENING ? 'audio_file.mp3' : null,
        },
        {
          type: QuestionType.SHORT_ANSWER,
          content: 'Sample short answer question',
          options: null,
          correctAnswer: 'Sample answer',
          passageIndex: testType === TestModule.READING ? 0 : null,
          audioPath: testType === TestModule.LISTENING ? 'audio_file.mp3' : null,
        }
      ];
      
      if (format === 'json') {
        // Return JSON template
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=questions_template_${testType}.json`);
        return res.json(templateData);
      } 
      else if (format === 'csv') {
        // Convert to CSV format
        const csvContent = [
          // Header row
          Object.keys(templateData[0]).join(','),
          // Data rows
          ...templateData.map(row => 
            Object.values(row).map(value => {
              if (value === null) return '';
              if (typeof value === 'string' && value.includes(',')) {
                return `"${value}"`;
              }
              return value;
            }).join(',')
          )
        ].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=questions_template_${testType}.csv`);
        return res.send(csvContent);
      } 
      else {
        // Default: Return XLSX template
        const worksheet = XLSX.utils.json_to_sheet(templateData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions Template');
        
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=questions_template_${testType}.xlsx`);
        return res.send(Buffer.from(excelBuffer));
      }
    } catch (error) {
      console.error('Error generating template:', error);
      res.status(500).json({ error: 'Failed to generate template' });
    }
  });

  // Process uploaded questions from various file formats
  app.post('/api/admin/tests/:id/questions/upload', isAdmin, uploadQuestionFiles.single('file'), async (req, res) => {
    const testId = parseInt(req.params.id);
    if (isNaN(testId)) {
      return res.status(400).json({ error: "Invalid test ID" });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Check if the test exists
      const test = await storage.getTest(testId);
      if (!test) {
        return res.status(404).json({ error: "Test not found" });
      }
      
      let questionsData: any[] = [];
      const fileType = path.extname(req.file.originalname).toLowerCase();
      
      // Parse file based on its type
      if (fileType === '.json') {
        // Parse JSON file
        questionsData = JSON.parse(req.file.buffer.toString());
        if (!Array.isArray(questionsData)) {
          return res.status(400).json({ error: 'Invalid format. Expected an array of questions.' });
        }
      } 
      else if (fileType === '.csv') {
        // Parse CSV file
        const results: any[] = [];
        
        // Create a temporary file to read the CSV data
        const tempFilePath = path.join(__dirname, '../uploads/temp_' + Date.now() + '.csv');
        fs.writeFileSync(tempFilePath, req.file.buffer);
        
        // Process the CSV file
        await new Promise<void>((resolve, reject) => {
          fs.createReadStream(tempFilePath)
            .pipe(csvParser)
            .on('data', (data: any) => results.push(data))
            .on('end', () => {
              questionsData = results;
              // Delete temp file
              fs.unlinkSync(tempFilePath);
              resolve();
            })
            .on('error', (err) => {
              fs.unlinkSync(tempFilePath);
              reject(err);
            });
        });
      } 
      else if (fileType === '.xlsx' || fileType === '.xls') {
        // Parse Excel file
        const workbook = XLSX.read(req.file.buffer);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        questionsData = XLSX.utils.sheet_to_json(worksheet);
      } 
      else {
        return res.status(400).json({ error: 'Unsupported file format' });
      }
      
      // Process the parsed questions
      const createdQuestions = [];
      
      for (const questionData of questionsData) {
        try {
          // Add testId to each question
          const processedQuestion = {
            ...questionData,
            testId,
            // Convert options from string to JSON if needed
            options: typeof questionData.options === 'string' ? 
              questionData.options : 
              JSON.stringify(questionData.options || null)
          };
          
          const newQuestion = await storage.createQuestion(processedQuestion);
          createdQuestions.push(newQuestion);
        } catch (error) {
          console.error('Error creating question:', error);
          // Continue with other questions if one fails
        }
      }

      res.json({ 
        success: true, 
        count: createdQuestions.length,
        questions: createdQuestions
      });
    } catch (error) {
      console.error('Error uploading questions:', error);
      res.status(500).json({ error: 'Failed to upload questions' });
    }
  });

  // Admin dashboard stats
  app.get("/api/admin/stats", isAdmin, async (req, res) => {
    const tests = await storage.getAllTests();
    const testCount = tests.length;
    
    // Get all users count
    const users = await storage.getAllUsers();
    const userCount = users.length;
    
    // For each module, get attempt counts
    const readingTests = await storage.getTestsByModule(TestModule.READING);
    const listeningTests = await storage.getTestsByModule(TestModule.LISTENING);
    const writingTests = await storage.getTestsByModule(TestModule.WRITING);
    const speakingTests = await storage.getTestsByModule(TestModule.SPEAKING);
    
    let readingAttempts = 0;
    let listeningAttempts = 0;
    let writingAttempts = 0;
    let speakingAttempts = 0;
    
    for (const test of readingTests) {
      const attempts = await storage.getAttemptsForTest(test.id);
      readingAttempts += attempts.length;
    }
    
    for (const test of listeningTests) {
      const attempts = await storage.getAttemptsForTest(test.id);
      listeningAttempts += attempts.length;
    }
    
    for (const test of writingTests) {
      const attempts = await storage.getAttemptsForTest(test.id);
      writingAttempts += attempts.length;
    }
    
    for (const test of speakingTests) {
      const attempts = await storage.getAttemptsForTest(test.id);
      speakingAttempts += attempts.length;
    }
    
    res.json({
      testCount,
      userCount,
      moduleStats: {
        reading: {
          testCount: readingTests.length,
          attemptCount: readingAttempts
        },
        listening: {
          testCount: listeningTests.length,
          attemptCount: listeningAttempts
        },
        writing: {
          testCount: writingTests.length,
          attemptCount: writingAttempts
        },
        speaking: {
          testCount: speakingTests.length,
          attemptCount: speakingAttempts
        }
      }
    });
  });

  // Email verification and password reset routes
  // Store OTPs with expiration time (60 seconds)
  const otpStore = new Map<string, { otp: string, expires: number, userId?: number }>();
  
  // Send verification email
  app.post("/api/email/verify", async (req, res) => {
    try {
      const emailSchema = z.object({
        email: z.string().email("Invalid email format"),
      });

      const { email } = emailSchema.parse(req.body);
      
      // Check if email exists in the system
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // For security reasons, don't reveal whether email exists
        return res.status(200).json({ 
          message: "If your email is registered in our system, you will receive a verification code shortly."
        });
      }
      
      // Generate OTP
      const otp = generateOTP(6);
      const expiryTime = Date.now() + 60000; // 60 seconds from now
      
      // Store OTP with email as key
      otpStore.set(email, {
        otp,
        expires: expiryTime,
        userId: user.id
      });
      
      // Send verification email
      const template = emailTemplates.verification(otp);
      const emailSent = await sendEmail({
        to: email,
        from: "noreply@ieltsexam.com",
        subject: template.subject,
        html: template.html,
        text: template.text
      });
      
      if (!emailSent) {
        return res.status(500).json({ 
          error: "Failed to send verification email. Please try again later."
        });
      }
      
      res.status(200).json({ 
        message: "Verification code sent to your email.",
        expiresIn: 60 // seconds
      });
    } catch (error) {
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Invalid request"
      });
    }
  });
  
  // Verify OTP code
  app.post("/api/email/verify/code", async (req, res) => {
    try {
      const verifySchema = z.object({
        email: z.string().email("Invalid email format"),
        otp: z.string().length(6, "OTP must be 6 digits"),
      });

      const { email, otp } = verifySchema.parse(req.body);
      
      // Check if OTP exists and is valid
      const storedData = otpStore.get(email);
      
      if (!storedData) {
        return res.status(400).json({ error: "Invalid verification code or email." });
      }
      
      // Check if OTP has expired
      if (Date.now() > storedData.expires) {
        // Remove expired OTP
        otpStore.delete(email);
        return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
      }
      
      // Check if OTP matches
      if (storedData.otp !== otp) {
        return res.status(400).json({ error: "Invalid verification code." });
      }
      
      // Mark user as verified if needed
      if (storedData.userId) {
        await storage.updateUserVerificationStatus(storedData.userId, true);
      }
      
      // Remove used OTP
      otpStore.delete(email);
      
      res.status(200).json({ 
        message: "Email verification successful", 
        verified: true 
      });
    } catch (error) {
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Invalid request"
      });
    }
  });
  
  // Request password reset
  app.post("/api/password/reset/request", async (req, res) => {
    try {
      const resetSchema = z.object({
        email: z.string().email("Invalid email format"),
      });

      const { email } = resetSchema.parse(req.body);
      
      // Check if email exists in the system
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // For security reasons, don't reveal whether email exists
        return res.status(200).json({ 
          message: "If your email is registered in our system, you will receive a password reset code shortly."
        });
      }
      
      // Generate OTP
      const otp = generateOTP(6);
      const expiryTime = Date.now() + 60000; // 60 seconds from now
      
      // Store OTP with email as key
      otpStore.set(email, {
        otp,
        expires: expiryTime,
        userId: user.id
      });
      
      // Send password reset email
      const template = emailTemplates.passwordReset(otp);
      const emailSent = await sendEmail({
        to: email,
        from: "noreply@ieltsexam.com",
        subject: template.subject,
        html: template.html,
        text: template.text
      });
      
      if (!emailSent) {
        return res.status(500).json({ 
          error: "Failed to send password reset email. Please try again later."
        });
      }
      
      res.status(200).json({ 
        message: "Password reset code sent to your email.",
        expiresIn: 60 // seconds
      });
    } catch (error) {
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Invalid request"
      });
    }
  });
  
  // Reset password with OTP
  app.post("/api/password/reset", async (req, res) => {
    try {
      const resetSchema = z.object({
        email: z.string().email("Invalid email format"),
        otp: z.string().length(6, "OTP must be 6 digits"),
        newPassword: z.string().min(8, "Password must be at least 8 characters long"),
      });

      const { email, otp, newPassword } = resetSchema.parse(req.body);
      
      // Check if OTP exists and is valid
      const storedData = otpStore.get(email);
      
      if (!storedData) {
        return res.status(400).json({ error: "Invalid reset code or email." });
      }
      
      // Check if OTP has expired
      if (Date.now() > storedData.expires) {
        // Remove expired OTP
        otpStore.delete(email);
        return res.status(400).json({ error: "Reset code has expired. Please request a new one." });
      }
      
      // Check if OTP matches
      if (storedData.otp !== otp) {
        return res.status(400).json({ error: "Invalid reset code." });
      }
      
      // Reset password
      if (storedData.userId) {
        await storage.updateUserPassword(storedData.userId, newPassword);
      } else {
        return res.status(400).json({ error: "User not found." });
      }
      
      // Remove used OTP
      otpStore.delete(email);
      
      res.status(200).json({ 
        message: "Password has been reset successfully. You can now log in with your new password.", 
        success: true 
      });
    } catch (error) {
      res.status(400).json({ 
        error: error instanceof Error ? error.message : "Invalid request"
      });
    }
  });

  // AI-assisted scoring routes
  
  // Route for scoring writing responses
  app.post("/api/score/writing", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        promptId: z.number().optional(),
        prompt: z.string(),
        response: z.string().min(1, "Response is required"),
        attemptId: z.number().optional(),
        answerId: z.number().optional()
      });

      const data = schema.parse(req.body);
      
      // Use OpenAI to score the writing response
      const result = await scoreWritingResponse(data.prompt, data.response);

      // If an answerId was provided, update the answer with the score
      if (data.answerId) {
        const answer = await storage.getAnswer(data.answerId);
        if (answer) {
          // Check if user is authorized to update this answer
          if (answer.userId === req.user?.id || req.user?.role === UserRole.ADMIN) {
            await storage.updateAnswer(
              data.answerId, 
              true, // isCorrect
              result.overallScore, 
              result.feedback, 
              null // gradedBy (AI graded)
            );
          }
        }
      }

      // If an attemptId was provided, update the attempt score
      if (data.attemptId) {
        const attempt = await storage.getAttempt(data.attemptId);
        if (attempt && (attempt.userId === req.user?.id || req.user?.role === UserRole.ADMIN)) {
          await storage.updateAttemptStatus(
            data.attemptId,
            "completed",
            new Date(),
            result.overallScore
          );
        }
      }

      res.json({
        success: true,
        score: result.overallScore,
        criteriaScores: result.criteriaScores,
        feedback: result.feedback
      });
    } catch (error) {
      console.error("Error scoring writing response:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to score writing response"
      });
    }
  });

  /**
   * Audio Upload Configuration
   * 
   * This configuration handles audio file uploads for both transcription and scoring endpoints.
   * It uses memory storage to avoid writing files to disk and implements validation for:
   * - File size: Maximum 10MB to prevent system overload
   * - File format: Accepts MP3, WAV, and WebM formats from various recording sources
   */
  const audioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
      const allowedMimes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/webm'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(null, false);
        return cb(new Error('Only MP3, WAV, and WebM formats are allowed'));
      }
    }
  });
  
  /**
   * Audio Transcription Endpoint
   * 
   * @route POST /api/transcribe
   * @description Transcribes uploaded audio files to text using OpenAI's Whisper model
   * @access Authenticated users only
   * 
   * Request body:
   * - audio (file): The audio recording to transcribe (accepted formats: MP3, WAV, WebM)
   * 
   * Response:
   * - 200: JSON containing the transcribed text { transcription: string }
   * - 400: No audio file uploaded
   * - 500: Transcription failed with error details
   */
  app.post("/api/transcribe", isAuthenticated, audioUpload.single('audio'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).send("No audio file uploaded");
      }
      
      // Transcribe the audio using OpenAI's Whisper model via the utility function
      const transcription = await transcribeSpeakingAudio(req.file.buffer);
      
      res.json({ transcription });
    } catch (error) {
      console.error("Error transcribing audio:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Failed to transcribe audio"
      });
    }
  });

  /**
   * Speaking Response Scoring Endpoint
   * 
   * @route POST /api/speaking/score
   * @description Scores transcribed speaking responses using OpenAI's GPT-4o model
   * @access Authenticated users only
   * 
   * Request body:
   * - questionId: number - The ID of the speaking question
   * - transcription: string - The text transcription of the audio response
   * - prompt: string - The original speaking prompt/question
   * 
   * Response:
   * - 200: JSON containing:
   *   - success: boolean
   *   - overallScore: number (0-9 with 0.5 increments)
   *   - criteriaScores: object containing scores for each IELTS criterion
   *   - feedback: detailed feedback with strengths and areas for improvement
   * - 400: Invalid request body
   * - 500: Scoring failed with error details
   */
  app.post("/api/speaking/score", isAuthenticated, async (req, res) => {
    try {
      // Validate request body
      const scoreSchema = z.object({
        questionId: z.number(),
        transcription: z.string(),
        prompt: z.string()
      });

      const data = scoreSchema.parse(req.body);
      
      // Score the transcribed response using the OpenAI GPT-4o model
      const result = await scoreSpeakingResponse(data.prompt, data.transcription);

      // Return detailed scoring results
      res.json({
        success: true,
        overallScore: result.overallScore,
        criteriaScores: result.criteriaScores,
        feedback: result.feedback
      });
    } catch (error) {
      console.error("Error scoring speaking response:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to score speaking response"
      });
    }
  });
  
  /**
   * Text Translation Endpoint
   * 
   * @route POST /api/translate/to-arabic
   * @description Translates text from English to Arabic using OpenAI's GPT-4o model
   * @access Authenticated users only
   * 
   * Request body:
   * - text: string - The English text to translate
   * 
   * Response:
   * - 200: JSON containing { translation: string }
   * - 400: Bad request if text is missing or empty
   * - 500: Translation failed with error details
   */
  app.post("/api/translate/to-arabic", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        text: z.string().min(1, "Text is required")
      });
      
      const { text } = schema.parse(req.body);
      
      const translation = await translateToArabic(text);
      
      res.json({ translation });
    } catch (error) {
      console.error("Translation error:", error);
      res.status(error instanceof z.ZodError ? 400 : 500).json({ 
        error: error instanceof Error ? error.message : "Failed to translate text" 
      });
    }
  });
  
  /**
   * Text Translation Endpoint
   * 
   * @route POST /api/translate/to-english
   * @description Translates text from Arabic to English using OpenAI's GPT-4o model
   * @access Authenticated users only
   * 
   * Request body:
   * - text: string - The Arabic text to translate
   * 
   * Response:
   * - 200: JSON containing { translation: string }
   * - 400: Bad request if text is missing or empty
   * - 500: Translation failed with error details
   */
  app.post("/api/translate/to-english", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        text: z.string().min(1, "Text is required")
      });
      
      const { text } = schema.parse(req.body);
      
      const translation = await translateToEnglish(text);
      
      res.json({ translation });
    } catch (error) {
      console.error("Translation error:", error);
      res.status(error instanceof z.ZodError ? 400 : 500).json({ 
        error: error instanceof Error ? error.message : "Failed to translate text" 
      });
    }
  });
  
  /**
   * Audio Transcription + Translation Endpoint
   * 
   * @route POST /api/translate/transcription
   * @description Transcribes audio and translates the result to Arabic
   * @access Authenticated users only
   * 
   * Request body:
   * - transcription: string - The English transcription text to translate
   * 
   * Response:
   * - 200: JSON containing { translation: string }
   * - 400: Bad request if transcription is missing or empty
   * - 500: Translation failed with error details
   */
  app.post("/api/translate/transcription", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        transcription: z.string().min(1, "Transcription is required")
      });
      
      const { transcription } = schema.parse(req.body);
      
      const translation = await translateTranscription(transcription);
      
      res.json({ translation });
    } catch (error) {
      console.error("Transcription translation error:", error);
      res.status(error instanceof z.ZodError ? 400 : 500).json({ 
        error: error instanceof Error ? error.message : "Failed to translate transcription" 
      });
    }
  });

  /**
   * Vocabulary Endpoints
   */
   
  /**
   * Analyze Word with OpenAI
   * 
   * @route POST /api/vocabulary/analyze
   * @description Analyzes a word using OpenAI to get CEFR level, meaning, word family, example, and Arabic meaning
   * @access Authenticated users only
   * 
   * Request body:
   * - word: string - The word to analyze
   * 
   * Response:
   * - 200: JSON with analysis results
   * - 400: Invalid request
   * - 401: User not authenticated
   * - 500: Analysis failed with error details
   */
  app.post("/api/vocabulary/analyze", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        word: z.string().min(1, "Word is required"),
      });

      const { word } = schema.parse(req.body);
      
      const analysis = await analyzeVocabulary(word);
      
      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing vocabulary:", error);
      res.status(error instanceof z.ZodError ? 400 : 500).json({ 
        error: error instanceof Error ? error.message : "Failed to analyze vocabulary" 
      });
    }
  });

  /**
   * Get User's Vocabulary Items
   * 
   * @route GET /api/vocabulary
   * @description Retrieves all vocabulary items for the authenticated user
   * @access Authenticated users only
   * 
   * Response:
   * - 200: Array of vocabulary items
   * - 401: User not authenticated
   * - 500: Server error with details
   */
  app.get("/api/vocabulary", isAuthenticated, async (req, res) => {
    try {
      const vocabularies = await storage.getVocabulariesByUser(req.user.id);
      res.json(vocabularies);
    } catch (error) {
      console.error("Error fetching vocabulary:", error);
      res.status(500).json({ error: "Failed to fetch vocabulary items" });
    }
  });

  /**
   * Get Review Vocabulary Items
   * 
   * @route GET /api/vocabulary/review
   * @description Retrieves vocabulary items due for review using PACE repetition
   * @access Authenticated users only
   * 
   * Query parameters:
   * - limit: number (optional) - Maximum number of items to retrieve
   * 
   * Response:
   * - 200: Array of vocabulary items due for review
   * - 401: User not authenticated
   * - 500: Server error with details
   */
  app.get("/api/vocabulary/review", isAuthenticated, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const reviewItems = await storage.getVocabularyForReview(req.user.id, limit);
      res.json(reviewItems);
    } catch (error) {
      console.error("Error fetching vocabulary for review:", error);
      res.status(500).json({ error: "Failed to fetch vocabulary review items" });
    }
  });

  /**
   * Get Vocabulary Item
   * 
   * @route GET /api/vocabulary/:id
   * @description Retrieves a specific vocabulary item
   * @access Authenticated users only
   * 
   * Parameters:
   * - id: number - The ID of the vocabulary item
   * 
   * Response:
   * - 200: Vocabulary item details
   * - 401: User not authenticated
   * - 403: User not authorized to access this vocabulary item
   * - 404: Vocabulary item not found
   * - 500: Server error with details
   */
  app.get("/api/vocabulary/:id", isAuthenticated, async (req, res) => {
    try {
      const vocabularyId = parseInt(req.params.id);
      if (isNaN(vocabularyId)) {
        return res.status(400).json({ error: "Invalid vocabulary ID" });
      }

      const vocabulary = await storage.getVocabulary(vocabularyId);
      if (!vocabulary) {
        return res.status(404).json({ error: "Vocabulary item not found" });
      }

      // Check if the user is authorized to access this vocabulary
      if (vocabulary.userId !== req.user.id && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "Not authorized to access this vocabulary item" });
      }

      res.json(vocabulary);
    } catch (error) {
      console.error("Error fetching vocabulary item:", error);
      res.status(500).json({ error: "Failed to fetch vocabulary item" });
    }
  });

  /**
   * Add Vocabulary Item
   * 
   * @route POST /api/vocabulary
   * @description Adds a new vocabulary item
   * @access Authenticated users only
   * 
   * Request body:
   * - word: string - The word to add
   * - cefrLevel: string - CEFR level (A1, A2, B1, B2, C1, C2)
   * - wordFamily: string (optional) - Related words
   * - meaning: string - English definition
   * - example: string - Example sentence
   * - arabicMeaning: string (optional) - Arabic translation
   * 
   * Response:
   * - 201: Created vocabulary item
   * - 400: Invalid request body
   * - 401: User not authenticated
   * - 500: Server error with details
   */
  app.post("/api/vocabulary", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        word: z.string().min(1, "Word is required"),
        cefrLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
        wordFamily: z.string().optional(),
        meaning: z.string().min(1, "Meaning is required"),
        example: z.string().min(1, "Example is required"),
        arabicMeaning: z.string().optional(),
      });

      const validatedData = schema.parse(req.body);

      const vocabulary = await storage.createVocabulary({
        userId: req.user!.id,
        word: validatedData.word,
        cefrLevel: validatedData.cefrLevel,
        wordFamily: validatedData.wordFamily || null,
        meaning: validatedData.meaning,
        example: validatedData.example,
        arabicMeaning: validatedData.arabicMeaning || null,
        reviewStage: 0
      });
      
      // After creating the first vocabulary item, send a welcome notification
      const userVocabulary = await storage.getVocabulariesByUser(req.user!.id);
      if (userVocabulary.length === 1) {
        await createSystemNotification(
          req.user!.id,
          "Welcome to Vocabulary Learning!",
          "You've added your first vocabulary word. Keep adding more words and review them regularly to improve your English vocabulary.",
          NotificationPriority.MEDIUM,
          "/vocabulary-review"
        );
      }

      res.status(201).json(vocabulary);
    } catch (error) {
      console.error("Error creating vocabulary item:", error);
      res.status(error instanceof z.ZodError ? 400 : 500).json({ 
        error: error instanceof Error ? error.message : "Failed to create vocabulary item" 
      });
    }
  });

  /**
   * Update Review Stage (PACE method)
   * 
   * @route PATCH /api/vocabulary/:id/review
   * @description Updates the review stage of a vocabulary item based on user feedback
   * @access Authenticated users only
   * 
   * Parameters:
   * - id: number - The ID of the vocabulary item
   * 
   * Request body:
   * - knowledgeRating: number - User self-assessment of knowledge (1-5)
   *   1 = Don't know
   *   2 = Barely recognize
   *   3 = Can recognize but not use
   *   4 = Can use with effort
   *   5 = Know well
   * 
   * Response:
   * - 200: Updated vocabulary item
   * - 400: Invalid request body
   * - 401: User not authenticated
   * - 403: User not authorized to update this vocabulary item
   * - 404: Vocabulary item not found
   * - 500: Server error with details
   */
  app.patch("/api/vocabulary/:id/review", isAuthenticated, async (req, res) => {
    try {
      const vocabularyId = parseInt(req.params.id);
      if (isNaN(vocabularyId)) {
        return res.status(400).json({ error: "Invalid vocabulary ID" });
      }

      const schema = z.object({
        knowledgeRating: z.number().min(1).max(5)
      });

      const { knowledgeRating } = schema.parse(req.body);

      // Get the vocabulary item
      const vocabulary = await storage.getVocabulary(vocabularyId);
      if (!vocabulary) {
        return res.status(404).json({ error: "Vocabulary item not found" });
      }

      // Check if the user is authorized to update this vocabulary
      if (vocabulary.userId !== req.user.id && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "Not authorized to update this vocabulary item" });
      }

      // Calculate new review stage based on knowledge rating and current stage
      let newStage = vocabulary.reviewStage;
      
      if (knowledgeRating >= 4) {
        // Knowledge is good, move to next stage
        newStage = Math.min(newStage + 1, 5);
      } else if (knowledgeRating <= 2) {
        // Knowledge is poor, move back to stage 0
        newStage = 0;
      }
      // If rating is 3, keep the same stage

      // Update the vocabulary item
      const updatedVocabulary = await storage.updateVocabularyReviewStatus(vocabularyId, newStage);
      
      // Check if this was the last vocabulary item to review
      const remainingItems = await storage.getVocabularyForReview(req.user!.id);
      if (remainingItems.length === 0) {
        // Send achievement notification
        await createAchievementNotification(
          req.user!.id,
          {
            name: "Vocabulary Master",
            description: "You've completed all your vocabulary reviews for today! Keep up the good work!"
          }
        );
      }
      
      res.json(updatedVocabulary);
    } catch (error) {
      console.error("Error updating vocabulary review status:", error);
      res.status(error instanceof z.ZodError ? 400 : 500).json({ 
        error: error instanceof Error ? error.message : "Failed to update vocabulary review status" 
      });
    }
  });

  /**
   * Update Vocabulary Item
   * 
   * @route PUT /api/vocabulary/:id
   * @description Updates an existing vocabulary item
   * @access Authenticated users only
   * 
   * Parameters:
   * - id: number - The ID of the vocabulary item
   * 
   * Request body:
   * - word: string - The word to update
   * - cefrLevel: string - CEFR level (A1, A2, B1, B2, C1, C2)
   * - wordFamily: string (optional) - Related words
   * - meaning: string - English definition
   * - example: string - Example sentence
   * - arabicMeaning: string (optional) - Arabic translation
   * 
   * Response:
   * - 200: Updated vocabulary item
   * - 400: Invalid request body
   * - 401: User not authenticated
   * - 403: User not authorized to update this vocabulary item
   * - 404: Vocabulary item not found
   * - 500: Server error with details
   */
  app.put("/api/vocabulary/:id", isAuthenticated, async (req, res) => {
    try {
      const vocabularyId = parseInt(req.params.id);
      if (isNaN(vocabularyId)) {
        return res.status(400).json({ error: "Invalid vocabulary ID" });
      }

      const schema = z.object({
        word: z.string().min(1, "Word is required"),
        cefrLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
        wordFamily: z.string().optional(),
        meaning: z.string().min(1, "Meaning is required"),
        example: z.string().min(1, "Example is required"),
        arabicMeaning: z.string().optional(),
      });

      const validatedData = schema.parse(req.body);

      // Get the vocabulary item
      const vocabulary = await storage.getVocabulary(vocabularyId);
      if (!vocabulary) {
        return res.status(404).json({ error: "Vocabulary item not found" });
      }

      // Check if the user is authorized to update this vocabulary
      if (vocabulary.userId !== req.user.id && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "Not authorized to update this vocabulary item" });
      }

      // Update the vocabulary item
      const updatedVocabulary = await storage.updateVocabulary(vocabularyId, {
        word: validatedData.word,
        cefrLevel: validatedData.cefrLevel,
        wordFamily: validatedData.wordFamily || vocabulary.wordFamily,
        meaning: validatedData.meaning,
        example: validatedData.example,
        arabicMeaning: validatedData.arabicMeaning || vocabulary.arabicMeaning,
      });

      res.json(updatedVocabulary);
    } catch (error) {
      console.error("Error updating vocabulary item:", error);
      res.status(error instanceof z.ZodError ? 400 : 500).json({ 
        error: error instanceof Error ? error.message : "Failed to update vocabulary item" 
      });
    }
  });

  /**
   * Delete Vocabulary Item
   * 
   * @route DELETE /api/vocabulary/:id
   * @description Deletes a vocabulary item
   * @access Authenticated users only
   * 
   * Parameters:
   * - id: number - The ID of the vocabulary item
   * 
   * Response:
   * - 200: Success message
   * - 401: User not authenticated
   * - 403: User not authorized to delete this vocabulary item
   * - 404: Vocabulary item not found
   * - 500: Server error with details
   */
  app.delete("/api/vocabulary/:id", isAuthenticated, async (req, res) => {
    try {
      const vocabularyId = parseInt(req.params.id);
      if (isNaN(vocabularyId)) {
        return res.status(400).json({ error: "Invalid vocabulary ID" });
      }

      // Get the vocabulary item
      const vocabulary = await storage.getVocabulary(vocabularyId);
      if (!vocabulary) {
        return res.status(404).json({ error: "Vocabulary item not found" });
      }

      // Check if the user is authorized to delete this vocabulary
      if (vocabulary.userId !== req.user.id && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "Not authorized to delete this vocabulary item" });
      }

      // Delete the vocabulary item
      const success = await storage.deleteVocabulary(vocabularyId);
      if (success) {
        res.json({ message: "Vocabulary item deleted successfully" });
      } else {
        res.status(500).json({ error: "Failed to delete vocabulary item" });
      }
    } catch (error) {
      console.error("Error deleting vocabulary item:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to delete vocabulary item" 
      });
    }
  });

  /**
   * Notification Endpoints
   */
  
  /**
   * Get Notifications for Current User
   * 
   * @route GET /api/notifications
   * @description Retrieves all notifications for the authenticated user
   * @access Authenticated users only
   * 
   * Query parameters:
   * - unreadOnly: boolean - If true, returns only unread notifications
   * 
   * Response:
   * - 200: Array of Notification objects
   * - 401: User not authenticated
   */
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const unreadOnly = req.query.unreadOnly === 'true';
      const notifications = await storage.getNotificationsByUser(req.user.id, unreadOnly);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to fetch notifications" 
      });
    }
  });
  
  /**
   * Get Unread Notification Count
   * 
   * @route GET /api/notifications/count
   * @description Gets the count of unread notifications for the authenticated user
   * @access Authenticated users only
   * 
   * Response:
   * - 200: { count: number }
   * - 401: User not authenticated
   */
  app.get("/api/notifications/count", isAuthenticated, async (req, res) => {
    try {
      const count = await storage.getUnreadNotificationsCount(req.user.id);
      res.json({ count });
    } catch (error) {
      console.error("Error counting notifications:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to count notifications" 
      });
    }
  });
  
  /**
   * Mark Notification as Read
   * 
   * @route PATCH /api/notifications/:id/read
   * @description Marks a specific notification as read
   * @access Authenticated users only
   * 
   * Parameters:
   * - id: number - The ID of the notification
   * 
   * Response:
   * - 200: Updated Notification object
   * - 401: User not authenticated
   * - 403: User not authorized to update this notification
   * - 404: Notification not found
   */
  app.patch("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      if (isNaN(notificationId)) {
        return res.status(400).json({ error: "Invalid notification ID" });
      }
      
      // Check if notification exists and belongs to the user
      const notification = await storage.getNotification(notificationId);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      
      if (notification.userId !== req.user.id && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "Not authorized to update this notification" });
      }
      
      const updatedNotification = await storage.markNotificationAsRead(notificationId);
      res.json(updatedNotification);
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to update notification" 
      });
    }
  });
  
  /**
   * Mark All Notifications as Read
   * 
   * @route POST /api/notifications/read-all
   * @description Marks all notifications for the authenticated user as read
   * @access Authenticated users only
   * 
   * Response:
   * - 200: Success message
   * - 401: User not authenticated
   * - 500: Server error with details
   */
  app.post("/api/notifications/read-all", isAuthenticated, async (req, res) => {
    try {
      const success = await storage.markAllNotificationsAsRead(req.user.id);
      
      if (success) {
        res.json({ message: "All notifications marked as read" });
      } else {
        res.status(500).json({ error: "Some notifications could not be updated" });
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to update notifications" 
      });
    }
  });
  
  /**
   * Delete Notification
   * 
   * @route DELETE /api/notifications/:id
   * @description Deletes a notification
   * @access Authenticated users only
   * 
   * Parameters:
   * - id: number - The ID of the notification
   * 
   * Response:
   * - 200: Success message
   * - 401: User not authenticated
   * - 403: User not authorized to delete this notification
   * - 404: Notification not found
   */
  app.delete("/api/notifications/:id", isAuthenticated, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      if (isNaN(notificationId)) {
        return res.status(400).json({ error: "Invalid notification ID" });
      }
      
      // Check if notification exists and belongs to the user
      const notification = await storage.getNotification(notificationId);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      
      if (notification.userId !== req.user.id && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "Not authorized to delete this notification" });
      }
      
      const success = await storage.deleteNotification(notificationId);
      
      if (success) {
        res.json({ message: "Notification deleted successfully" });
      } else {
        res.status(500).json({ error: "Failed to delete notification" });
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to delete notification" 
      });
    }
  });
  
  /**
   * Create Notification (Admin Only)
   * 
   * @route POST /api/notifications
   * @description Creates a new notification for a user or multiple users
   * @access Admin users only
   * 
   * Request body:
   * - userIds: number[] - Array of user IDs to create notifications for
   * - type: string - One of NotificationType enum values
   * - title: string - Title of the notification
   * - message: string - Content of the notification
   * - priority: string - One of NotificationPriority enum values
   * - actionLink: string? - Optional link for taking action
   * - scheduledFor: Date? - Optional date to schedule the notification
   * 
   * Response:
   * - 201: Success message with count of created notifications
   * - 401: User not authenticated
   * - 403: User not an admin
   * - 400: Invalid request data
   */
  app.post("/api/notifications", isAdmin, async (req, res) => {
    try {
      const schema = z.object({
        userIds: z.array(z.number()).min(1, "At least one user ID is required"),
        type: z.enum([
          NotificationType.VOCABULARY_REVIEW, 
          NotificationType.TEST_REMINDER,
          NotificationType.ACHIEVEMENT,
          NotificationType.SYSTEM
        ]),
        title: z.string().min(1, "Title is required"),
        message: z.string().min(1, "Message is required"),
        priority: z.enum([
          NotificationPriority.LOW,
          NotificationPriority.MEDIUM,
          NotificationPriority.HIGH
        ]).default(NotificationPriority.MEDIUM),
        actionLink: z.string().optional(),
        scheduledFor: z.date().optional()
      });
      
      const validatedData = schema.parse(req.body);
      
      // Create notifications for each user
      const createdCount = {
        success: 0,
        failed: 0
      };
      
      for (const userId of validatedData.userIds) {
        try {
          await storage.createNotification({
            userId,
            type: validatedData.type,
            title: validatedData.title,
            message: validatedData.message,
            priority: validatedData.priority,
            actionLink: validatedData.actionLink,
            scheduledFor: validatedData.scheduledFor,
            isRead: false
          });
          createdCount.success++;
        } catch (error) {
          console.error(`Failed to create notification for user ${userId}:`, error);
          createdCount.failed++;
        }
      }
      
      res.status(201).json({ 
        message: "Notifications created",
        created: createdCount.success,
        failed: createdCount.failed
      });
    } catch (error) {
      console.error("Error creating notifications:", error);
      res.status(error instanceof z.ZodError ? 400 : 500).json({ 
        error: error instanceof Error ? error.message : "Failed to create notifications" 
      });
    }
  });

  // Gamification API endpoints
  app.get("/api/gamification/user-achievement", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const userAchievement = await storage.getUserAchievement(userId);
      
      if (!userAchievement) {
        return res.status(404).send("User achievement not found");
      }
      
      // Get badges earned by the user
      const userBadges = await storage.getUserBadges(userId);
      
      // Get user level information
      const userLevel = await storage.getUserLevel(userAchievement.currentLevel);
      
      // Get next level information if not at max level
      let nextLevel = null;
      if (userLevel && userAchievement.currentLevel < await storage.getMaxUserLevel()) {
        nextLevel = await storage.getUserLevel(userAchievement.currentLevel + 1);
      }
      
      // Calculate progress to next level
      let levelProgress = 0;
      if (nextLevel) {
        const currentLevelPoints = userLevel ? userLevel.pointsRequired : 0;
        const nextLevelPoints = nextLevel.pointsRequired;
        const pointsForNextLevel = nextLevelPoints - currentLevelPoints;
        const userPointsTowardsNextLevel = userAchievement.totalPoints - currentLevelPoints;
        levelProgress = Math.min(100, Math.max(0, Math.floor((userPointsTowardsNextLevel / pointsForNextLevel) * 100)));
      }
      
      res.json({
        achievement: userAchievement,
        badges: userBadges,
        currentLevel: userLevel,
        nextLevel,
        levelProgress
      });
    } catch (error) {
      console.error("Error getting user achievement:", error);
      res.status(500).send("Error retrieving user achievement data");
    }
  });
  
  app.get("/api/gamification/badges", isAuthenticated, async (req, res) => {
    try {
      const badges = await storage.getAllBadges();
      res.json(badges);
    } catch (error) {
      console.error("Error getting badges:", error);
      res.status(500).send("Error retrieving badges");
    }
  });
  
  app.get("/api/gamification/point-history", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const pointHistory = await storage.getUserPointHistory(userId);
      res.json(pointHistory);
    } catch (error) {
      console.error("Error getting point history:", error);
      res.status(500).send("Error retrieving point history");
    }
  });
  
  app.get("/api/gamification/leaderboard", isAuthenticated, async (req, res) => {
    try {
      const leaderboard = await storage.getLeaderboard();
      res.json(leaderboard);
    } catch (error) {
      console.error("Error getting leaderboard:", error);
      res.status(500).send("Error retrieving leaderboard data");
    }
  });
  
  app.post("/api/gamification/login-streak", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const result = await updateLoginStreak(userId);
      
      if (!result) {
        return res.status(404).send("User achievement not found");
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error updating login streak:", error);
      res.status(500).send("Error updating login streak");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
