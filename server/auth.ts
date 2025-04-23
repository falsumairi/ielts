import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { compare, hash } from "bcrypt";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { z } from "zod";
import { sendEmail, emailTemplates, generateOTP } from "./utils/email";
import { createWelcomeNotificationsForNewUser } from "./utils/notifications";
import { updateLoginStreak, checkForBadges } from "./utils/gamification";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

async function hashPassword(password: string) {
  return await hash(password, 10);
}

async function comparePasswords(supplied: string, stored: string) {
  return await compare(supplied, stored);
}

// Store for password reset tokens
// Format: { email: { token: string, expires: Date } }
const resetTokens = new Map<string, { token: string, expires: Date }>();

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "ielts-exam-secret-key",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Validate request body
      const userSchema = z.object({
        username: z.string().min(3).max(30),
        email: z.string().email(),
        password: z.string().min(8),
      });

      const validatedData = userSchema.parse(req.body);

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(validatedData.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Create user with hashed password
      const user = await storage.createUser({
        ...validatedData,
        password: await hashPassword(validatedData.password),
        role: "test_taker", // Default role
      });

      // Create welcome notifications for the new user
      try {
        await createWelcomeNotificationsForNewUser(user.id);
      } catch (notificationError) {
        console.error("Error creating welcome notifications:", notificationError);
        // Continue with registration even if notifications fail
      }

      // Remove password from response
      const userWithoutPassword = { ...user, password: undefined };

      // Log the user in
      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: error.errors });
      }
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }
      
      req.login(user, (err) => {
        if (err) return next(err);
        // Remove password from response
        const userWithoutPassword = { ...user, password: undefined };
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    
    // Remove password from response
    const userWithoutPassword = { ...req.user, password: undefined };
    res.json(userWithoutPassword);
  });

  /**
   * Password Reset Request Endpoint
   * 
   * @route POST /api/password-reset/request
   * @description Initiates a password reset by sending a reset token via email
   * @access Public
   * 
   * Request body:
   * - email: string - The email address of the user requesting password reset
   * 
   * Response:
   * - 200: Password reset email sent successfully
   * - 404: User with the provided email not found
   * - 500: Failed to send reset email
   */
  app.post("/api/password-reset/request", async (req, res) => {
    try {
      // Validate request body
      const schema = z.object({
        email: z.string().email()
      });
      
      const { email } = schema.parse(req.body);
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // For security reasons, don't reveal whether the email exists or not
        return res.status(200).json({ message: "If the email exists, a password reset link has been sent" });
      }
      
      // Generate 6-digit OTP
      const token = generateOTP(6);
      
      // Set expiration time (60 seconds from now)
      const expires = new Date();
      expires.setSeconds(expires.getSeconds() + 60);
      
      // Store token and expiration
      resetTokens.set(email, { token, expires });
      
      // Get email template
      const template = emailTemplates.passwordReset(token);
      
      // Send password reset email
      const emailSent = await sendEmail({
        to: email,
        from: 'noreply@ieltsexam.com',
        subject: template.subject,
        html: template.html,
        text: template.text
      });
      
      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send password reset email" });
      }
      
      res.status(200).json({ message: "Password reset instructions sent to your email" });
    } catch (error) {
      console.error("Password reset request error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid email address" });
      }
      res.status(500).json({ message: "Failed to process password reset request" });
    }
  });

  /**
   * Verify Password Reset Token Endpoint
   * 
   * @route POST /api/password-reset/verify
   * @description Verifies the password reset token before allowing password change
   * @access Public
   * 
   * Request body:
   * - email: string - The email address of the user
   * - token: string - The OTP/token received via email
   * 
   * Response:
   * - 200: Token verified successfully
   * - 400: Invalid or expired token
   */
  app.post("/api/password-reset/verify", (req, res) => {
    try {
      // Validate request body
      const schema = z.object({
        email: z.string().email(),
        token: z.string().length(6)
      });
      
      const { email, token } = schema.parse(req.body);
      
      // Check if token exists and has not expired
      const resetData = resetTokens.get(email);
      if (!resetData || resetData.token !== token || new Date() > resetData.expires) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
      
      res.status(200).json({ message: "Token verified successfully" });
    } catch (error) {
      console.error("Token verification error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ message: "Invalid request data" });
      }
      res.status(500).json({ message: "Failed to verify token" });
    }
  });

  /**
   * Reset Password Endpoint
   * 
   * @route POST /api/password-reset/reset
   * @description Resets the user's password after token verification
   * @access Public
   * 
   * Request body:
   * - email: string - The email address of the user
   * - token: string - The OTP/token received via email
   * - password: string - The new password
   * 
   * Response:
   * - 200: Password reset successful
   * - 400: Invalid or expired token, or password requirements not met
   * - 404: User not found
   * - 500: Failed to reset password
   */
  app.post("/api/password-reset/reset", async (req, res) => {
    try {
      // Validate request body
      const schema = z.object({
        email: z.string().email(),
        token: z.string().length(6),
        password: z.string().min(8)
      });
      
      const { email, token, password } = schema.parse(req.body);
      
      // Check if token exists and has not expired
      const resetData = resetTokens.get(email);
      if (!resetData || resetData.token !== token || new Date() > resetData.expires) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Hash new password
      const hashedPassword = await hashPassword(password);
      
      // Update user's password
      const updatedUser = await storage.updateUserPassword(user.id, hashedPassword);
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update password" });
      }
      
      // Remove token from store
      resetTokens.delete(email);
      
      res.status(200).json({ message: "Password reset successful. You can now log in with your new password." });
    } catch (error) {
      console.error("Password reset error:", error);
      if (error.name === "ZodError") {
        return res.status(400).json({ 
          message: "Invalid request data. Password must be at least 8 characters long." 
        });
      }
      res.status(500).json({ message: "Failed to reset password" });
    }
  });
}
