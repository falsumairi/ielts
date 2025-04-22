import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { TestModule, UserRole } from "@shared/schema";
import helmet from "helmet";
import { z } from "zod";

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
      res.status(400).send(`Invalid test data: ${error.message}`);
    }
  });

  // Questions routes
  app.get("/api/tests/:id/questions", isAuthenticated, async (req, res) => {
    const testId = parseInt(req.params.id);
    if (isNaN(testId)) {
      return res.status(400).send("Invalid test ID");
    }

    const questions = await storage.getQuestionsForTest(testId);
    res.json(questions);
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

  // Admin dashboard stats
  app.get("/api/admin/stats", isAdmin, async (req, res) => {
    const tests = await storage.getAllTests();
    const testCount = tests.length;
    
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
    
    // Get all users count
    const allUsers = Array.from(new Array(storage.currentUserId - 1)).map((_, i) => i + 1);
    const userCount = allUsers.length;
    
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

  const httpServer = createServer(app);
  return httpServer;
}
