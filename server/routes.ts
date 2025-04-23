import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { TestModule, UserRole, QuestionType } from "@shared/schema";
import helmet from "helmet";
import { z } from "zod";
import { sendEmail, generateOTP, emailTemplates } from "./utils/email";
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

  const httpServer = createServer(app);
  return httpServer;
}
