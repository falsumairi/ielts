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

  app.get("/api/tests/:id/attempts", isAdmin, async (req, res) => {
    const testId = parseInt(req.params.id);
    if (isNaN(testId)) {
      return res.status(400).send("Invalid test ID");
    }

    const attempts = await storage.getAttemptsForTest(testId);
    res.json(attempts);
  });

  app.post("/api/tests/:id/attempts", isAuthenticated, async (req, res) => {
    const testId = parseInt(req.params.id);
    if (isNaN(testId)) {
      return res.status(400).send("Invalid test ID");
    }

    const test = await storage.getTest(testId);
    if (!test) {
      return res.status(404).send("Test not found");
    }

    const attempt = await storage.createAttempt({
      userId: req.user.id,
      testId: testId,
      status: "in_progress"
    });

    res.status(201).json(attempt);
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

    res.json(attempt);
  });

  app.patch("/api/attempts/:id", isAuthenticated, async (req, res) => {
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

    const { status } = req.body;
    if (!status || !["in_progress", "completed", "abandoned"].includes(status)) {
      return res.status(400).send("Invalid status");
    }

    const endTime = status === "completed" || status === "abandoned" ? new Date() : undefined;
    const updatedAttempt = await storage.updateAttemptStatus(attemptId, status, endTime);
    
    res.json(updatedAttempt);
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
