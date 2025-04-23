import { 
  users, type User, type InsertUser,
  tests, type Test, type InsertTest,
  questions, type Question, type InsertQuestion,
  passages, type Passage, type InsertPassage,
  attempts, type Attempt, type InsertAttempt,
  answers, type Answer, type InsertAnswer,
  vocabularies, type Vocabulary, type InsertVocabulary,
  notifications, type Notification, type InsertNotification,
  badges, type Badge, type InsertBadge,
  userBadges, type UserBadge, type InsertUserBadge,
  pointActions, type PointAction, type InsertPointAction,
  userPoints, type UserPoint, type InsertUserPoint,
  userLevels, type UserLevel, type InsertUserLevel,
  userAchievements, type UserAchievement, type InsertUserAchievement,
  UserRole, TestModule, QuestionType, CEFRLevel, PointActionType
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// Define session store type
type SessionStore = ReturnType<typeof createMemoryStore>;

// Storage interface
export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUserVerificationStatus(id: number, verified: boolean): Promise<User | undefined>;
  updateUserPassword(id: number, newPassword: string): Promise<User | undefined>;
  updateUserRole(id: number, role: string): Promise<User | undefined>;
  
  // Tests
  getAllTests(): Promise<Test[]>;
  getTestsByModule(module: TestModule): Promise<Test[]>;
  getTest(id: number): Promise<Test | undefined>;
  createTest(test: InsertTest): Promise<Test>;
  updateTest(id: number, test: Partial<Test>): Promise<Test | undefined>;
  
  // Questions
  getQuestionsForTest(testId: number): Promise<Question[]>;
  getRandomizedQuestionsForTest(testId: number, count?: number): Promise<Question[]>;
  getQuestion(id: number): Promise<Question | undefined>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  
  // Passages
  getPassagesForTest(testId: number): Promise<Passage[]>;
  getPassage(id: number): Promise<Passage | undefined>;
  createPassage(passage: InsertPassage): Promise<Passage>;
  
  // Attempts
  getAttemptsByUser(userId: number): Promise<Attempt[]>;
  getAttemptsForTest(testId: number): Promise<Attempt[]>;
  getAttempt(id: number): Promise<Attempt | undefined>;
  createAttempt(attempt: InsertAttempt): Promise<Attempt>;
  updateAttemptStatus(id: number, status: string, endTime?: Date, score?: number): Promise<Attempt | undefined>;
  
  // Answers
  getAnswersForAttempt(attemptId: number): Promise<Answer[]>;
  getAnswer(id: number): Promise<Answer | undefined>;
  createAnswer(answer: InsertAnswer): Promise<Answer>;
  updateAnswer(id: number, isCorrect: boolean, score?: number, feedback?: string, gradedBy?: number): Promise<Answer | undefined>;
  
  // Vocabulary
  getVocabulariesByUser(userId: number): Promise<Vocabulary[]>;
  getVocabulary(id: number): Promise<Vocabulary | undefined>;
  createVocabulary(vocabulary: InsertVocabulary): Promise<Vocabulary>;
  updateVocabulary(id: number, vocabulary: Partial<Vocabulary>): Promise<Vocabulary | undefined>;
  deleteVocabulary(id: number): Promise<boolean>;
  getVocabularyForReview(userId: number, limit?: number): Promise<Vocabulary[]>;
  updateVocabularyReviewStatus(id: number, reviewStage: number): Promise<Vocabulary | undefined>;
  
  // Notifications
  getNotificationsByUser(userId: number, unreadOnly?: boolean): Promise<Notification[]>;
  getNotification(id: number): Promise<Notification | undefined>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification | undefined>;
  markAllNotificationsAsRead(userId: number): Promise<boolean>;
  deleteNotification(id: number): Promise<boolean>;
  getUnreadNotificationsCount(userId: number): Promise<number>;
  
  // Badges
  getBadge(id: number): Promise<Badge | undefined>;
  getBadgeByName(name: string): Promise<Badge | undefined>;
  getAllBadges(): Promise<Badge[]>;
  getActiveBadges(): Promise<Badge[]>;
  createBadge(badge: InsertBadge): Promise<Badge>;
  updateBadge(id: number, badge: Partial<Badge>): Promise<Badge | undefined>;
  
  // User Badges
  getUserBadgesByUser(userId: number): Promise<UserBadge[]>;
  getUserBadge(id: number): Promise<UserBadge | undefined>;
  getUserBadgeByBadgeId(userId: number, badgeId: number): Promise<UserBadge | undefined>;
  createUserBadge(userBadge: InsertUserBadge): Promise<UserBadge>;
  updateUserBadge(id: number, userBadge: Partial<UserBadge>): Promise<UserBadge | undefined>;
  
  // Point Actions
  getPointAction(id: number): Promise<PointAction | undefined>;
  getPointActionByType(actionType: PointActionType): Promise<PointAction | undefined>;
  getAllPointActions(): Promise<PointAction[]>;
  createPointAction(pointAction: InsertPointAction): Promise<PointAction>;
  updatePointAction(id: number, pointAction: Partial<PointAction>): Promise<PointAction | undefined>;
  
  // User Points
  getUserPointsByUser(userId: number): Promise<UserPoint[]>;
  getUserPoint(id: number): Promise<UserPoint | undefined>;
  createUserPoint(userPoint: InsertUserPoint): Promise<UserPoint>;
  
  // User Levels
  getUserLevel(id: number): Promise<UserLevel | undefined>;
  getUserLevelByLevel(level: number): Promise<UserLevel | undefined>;
  getAllUserLevels(): Promise<UserLevel[]>;
  createUserLevel(userLevel: InsertUserLevel): Promise<UserLevel>;
  updateUserLevel(id: number, userLevel: Partial<UserLevel>): Promise<UserLevel | undefined>;
  
  // User Achievements
  getUserAchievement(userId: number): Promise<UserAchievement | undefined>;
  createUserAchievement(userAchievement: InsertUserAchievement): Promise<UserAchievement>;
  updateUserAchievement(userId: number, userAchievement: Partial<UserAchievement>): Promise<UserAchievement | undefined>;
  
  // Session store
  sessionStore: SessionStore;
}

// In-memory storage implementation
export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private tests: Map<number, Test>;
  private questions: Map<number, Question>;
  private passages: Map<number, Passage>;
  private attempts: Map<number, Attempt>;
  private answers: Map<number, Answer>;
  private vocabularies: Map<number, Vocabulary>;
  private notifications: Map<number, Notification>;
  private badges: Map<number, Badge>;
  private userBadges: Map<number, UserBadge>;
  private pointActions: Map<number, PointAction>;
  private userPoints: Map<number, UserPoint>;
  private userLevels: Map<number, UserLevel>;
  private userAchievements: Map<number, UserAchievement>;
  currentUserId: number;
  currentTestId: number;
  currentQuestionId: number;
  currentPassageId: number;
  currentAttemptId: number;
  currentAnswerId: number;
  currentVocabularyId: number;
  currentNotificationId: number;
  currentBadgeId: number;
  currentUserBadgeId: number;
  currentPointActionId: number;
  currentUserPointId: number;
  currentUserLevelId: number;
  currentUserAchievementId: number;
  sessionStore: SessionStore;

  constructor() {
    this.users = new Map();
    this.tests = new Map();
    this.questions = new Map();
    this.passages = new Map();
    this.attempts = new Map();
    this.answers = new Map();
    this.vocabularies = new Map();
    this.notifications = new Map();
    this.badges = new Map();
    this.userBadges = new Map();
    this.pointActions = new Map();
    this.userPoints = new Map();
    this.userLevels = new Map();
    this.userAchievements = new Map();
    this.currentUserId = 1;
    this.currentTestId = 1;
    this.currentQuestionId = 1;
    this.currentPassageId = 1;
    this.currentAttemptId = 1;
    this.currentAnswerId = 1;
    this.currentVocabularyId = 1;
    this.currentNotificationId = 1;
    this.currentBadgeId = 1;
    this.currentUserBadgeId = 1;
    this.currentPointActionId = 1;
    this.currentUserPointId = 1;
    this.currentUserLevelId = 1;
    this.currentUserAchievementId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // 24h
    });
    
    // Initialize with admin user
    this.createUser({
      username: "admin",
      password: "$2b$10$JUHEcQTYFBavQBvTEmU1e.UoBgePiITG7YoDvxAHvLGZUsMSN7IQ.", // "password"
      email: "admin@ielts-exam.com",
      role: UserRole.ADMIN
    });
    
    // Initialize with test taker user
    this.createUser({
      username: "student",
      password: "$2b$10$JUHEcQTYFBavQBvTEmU1e.UoBgePiITG7YoDvxAHvLGZUsMSN7IQ.", // "password"
      email: "student@example.com",
      role: UserRole.TEST_TAKER
    });
    
    // Initialize with sample reading test
    this.initializeReadingTest();
    this.initializeListeningTest();
    this.initializeWritingTest();
    this.initializeSpeakingTest();
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }
  
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async updateUserVerificationStatus(id: number, verified: boolean): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      verified: verified
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async updateUserPassword(id: number, newPassword: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    // In a real app, we would hash the password here
    // For this prototype, we'll use the raw password
    const updatedUser: User = {
      ...user,
      password: newPassword
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async updateUserRole(id: number, role: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser: User = {
      ...user,
      role: role
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    // Add required role property with a default if not provided
    const role = insertUser.role || UserRole.TEST_TAKER;
    const user: User = { 
      ...insertUser, 
      id, 
      role, // Ensure role is always defined
      verified: insertUser.verified !== undefined ? insertUser.verified : false,
      createdAt: new Date() 
    };
    this.users.set(id, user);
    return user;
  }

  // Test methods
  async getAllTests(): Promise<Test[]> {
    return Array.from(this.tests.values());
  }

  async getTestsByModule(module: TestModule): Promise<Test[]> {
    return Array.from(this.tests.values()).filter(test => test.module === module);
  }

  async getTest(id: number): Promise<Test | undefined> {
    return this.tests.get(id);
  }

  async createTest(insertTest: InsertTest): Promise<Test> {
    const id = this.currentTestId++;
    const test: Test = { 
      ...insertTest, 
      id, 
      description: insertTest.description || null,
      active: insertTest.active || null,
      createdAt: new Date() 
    };
    this.tests.set(id, test);
    return test;
  }

  async updateTest(id: number, updatedTest: Partial<Test>): Promise<Test | undefined> {
    const existingTest = this.tests.get(id);
    if (!existingTest) return undefined;
    
    const test: Test = { 
      ...existingTest, 
      ...updatedTest 
    };
    
    this.tests.set(id, test);
    return test;
  }

  // Question methods
  async getQuestionsForTest(testId: number): Promise<Question[]> {
    return Array.from(this.questions.values()).filter(q => q.testId === testId);
  }
  
  // Get randomized questions for a test
  async getRandomizedQuestionsForTest(testId: number, count?: number): Promise<Question[]> {
    // Get all questions for this test
    const allQuestions = Array.from(this.questions.values()).filter(q => q.testId === testId);
    
    // If count is not specified or is greater than available questions, use all questions
    if (!count || count >= allQuestions.length) {
      // Randomize the order
      return this.shuffleArray([...allQuestions]);
    }
    
    // Otherwise, select a random subset
    return this.getRandomSubset(allQuestions, count);
  }
  
  // Helper method to shuffle an array using Fisher-Yates algorithm
  private shuffleArray<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  
  // Helper method to get a random subset of items
  private getRandomSubset<T>(array: T[], count: number): T[] {
    // First shuffle the array
    const shuffled = this.shuffleArray(array);
    // Then take the first 'count' elements
    return shuffled.slice(0, count);
  }

  async getQuestion(id: number): Promise<Question | undefined> {
    return this.questions.get(id);
  }

  async createQuestion(insertQuestion: InsertQuestion): Promise<Question> {
    const id = this.currentQuestionId++;
    const question: Question = { 
      ...insertQuestion, 
      id, 
      options: insertQuestion.options || {},
      correctAnswer: insertQuestion.correctAnswer || null,
      audioPath: insertQuestion.audioPath || null,
      passageIndex: insertQuestion.passageIndex || null,
      createdAt: new Date() 
    };
    this.questions.set(id, question);
    return question;
  }

  // Passage methods
  async getPassagesForTest(testId: number): Promise<Passage[]> {
    return Array.from(this.passages.values())
      .filter(p => p.testId === testId)
      .sort((a, b) => a.index - b.index);
  }

  async getPassage(id: number): Promise<Passage | undefined> {
    return this.passages.get(id);
  }

  async createPassage(insertPassage: InsertPassage): Promise<Passage> {
    const id = this.currentPassageId++;
    const passage: Passage = { ...insertPassage, id, createdAt: new Date() };
    this.passages.set(id, passage);
    return passage;
  }

  // Attempt methods
  async getAttemptsByUser(userId: number): Promise<Attempt[]> {
    return Array.from(this.attempts.values()).filter(a => a.userId === userId);
  }

  async getAttemptsForTest(testId: number): Promise<Attempt[]> {
    return Array.from(this.attempts.values()).filter(a => a.testId === testId);
  }

  async getAttempt(id: number): Promise<Attempt | undefined> {
    return this.attempts.get(id);
  }

  async createAttempt(insertAttempt: InsertAttempt): Promise<Attempt> {
    const id = this.currentAttemptId++;
    const attempt: Attempt = { 
      ...insertAttempt, 
      id, 
      status: insertAttempt.status || "in_progress", // Ensure status is always defined
      startTime: new Date(),
      endTime: null,
      score: null,
      createdAt: new Date() 
    };
    this.attempts.set(id, attempt);
    return attempt;
  }

  async updateAttemptStatus(id: number, status: string, endTime?: Date, score?: number): Promise<Attempt | undefined> {
    const attempt = this.attempts.get(id);
    if (!attempt) return undefined;
    
    const updatedAttempt: Attempt = {
      ...attempt,
      status: status,
      endTime: endTime || attempt.endTime,
      score: score !== undefined ? score : attempt.score
    };
    
    this.attempts.set(id, updatedAttempt);
    return updatedAttempt;
  }

  // Answer methods
  async getAnswersForAttempt(attemptId: number): Promise<Answer[]> {
    return Array.from(this.answers.values()).filter(a => a.attemptId === attemptId);
  }

  async getAnswer(id: number): Promise<Answer | undefined> {
    return this.answers.get(id);
  }

  async createAnswer(insertAnswer: InsertAnswer): Promise<Answer> {
    const id = this.currentAnswerId++;
    const answer: Answer = { 
      ...insertAnswer, 
      id, 
      audioPath: insertAnswer.audioPath || null,
      score: insertAnswer.score || null,
      isCorrect: insertAnswer.isCorrect || null,
      gradedBy: null,
      feedback: null,
      createdAt: new Date() 
    };
    this.answers.set(id, answer);
    return answer;
  }

  async updateAnswer(id: number, isCorrect: boolean, score?: number, feedback?: string, gradedBy?: number): Promise<Answer | undefined> {
    const answer = this.answers.get(id);
    if (!answer) return undefined;
    
    const updatedAnswer: Answer = {
      ...answer,
      isCorrect: isCorrect,
      score: score !== undefined ? score : answer.score,
      feedback: feedback || answer.feedback,
      gradedBy: gradedBy || answer.gradedBy
    };
    
    this.answers.set(id, updatedAnswer);
    return updatedAnswer;
  }

  // Helper to initialize a sample reading test
  private async initializeReadingTest() {
    const test = await this.createTest({
      title: "Academic Reading Test 1",
      description: "Complete reading test with 3 passages and 40 questions",
      module: TestModule.READING,
      durationMinutes: 60,
      active: true
    });

    // Create passage 1
    const passage1 = await this.createPassage({
      testId: test.id,
      title: "The History of Writing",
      content: `<p>Writing is often regarded as one of humanity's most significant inventions. Unlike spoken language, which disappears as soon as it is uttered, writing preserves thoughts, allowing them to transcend time and space. The development of writing systems across different cultures represents a fascinating journey through human innovation and cultural exchange.</p>
      
      <p>The earliest writing systems emerged independently in different parts of the world between 3400 and 3100 BCE. Mesopotamian cuneiform and Egyptian hieroglyphs are considered the first true writing systems, though they were preceded by proto-writing systems that used pictographic symbols. These early systems were primarily developed to record commercial transactions and administrative information rather than for creative or literary purposes.</p>
      
      <p>Cuneiform, which means "wedge-shaped," was developed by the Sumerians in ancient Mesopotamia (modern-day Iraq). Initially pictographic, the system evolved to become more abstract, with symbols representing syllables rather than whole words or concepts. This adaptation made the system more efficient and versatile, allowing it to represent a wider range of information. Cuneiform was written on clay tablets using a reed stylus, and thousands of these tablets have survived to the present day, providing valuable insights into ancient Mesopotamian civilization.</p>
      
      <p>Egyptian hieroglyphs, with their elaborate and beautiful symbols, served a different primary purpose. While also used for administrative records, hieroglyphs were particularly important for religious texts and monumental inscriptions. The Egyptians believed in the magical power of writing, considering it a gift from the god Thoth. Hieroglyphs remained in use for nearly 3,500 years, making them one of the longest-used writing systems in history.</p>
      
      <p>In China, writing developed independently around 1200 BCE with the oracle bone script, used for divination practices during the Shang Dynasty. Chinese characters, unlike alphabetic systems, are logographic—each character represents a word or meaningful unit rather than a sound. This fundamental principle has remained consistent despite numerous stylistic changes over thousands of years, allowing modern Chinese readers to understand texts written centuries ago far more easily than English speakers can comprehend Old English.</p>`,
      index: 1
    });

    // Create questions for passage 1
    await this.createQuestion({
      testId: test.id,
      type: QuestionType.MULTIPLE_CHOICE,
      content: "According to the passage, what was the primary purpose of the earliest writing systems?",
      options: ["To record commercial transactions and administrative information", "To preserve religious and spiritual teachings", "To create literary and artistic works", "To facilitate communication between different cultures"],
      correctAnswer: "To record commercial transactions and administrative information",
      passageIndex: 1,
      audioPath: null
    });

    await this.createQuestion({
      testId: test.id,
      type: QuestionType.TRUE_FALSE_NG,
      content: "Egyptian hieroglyphs were used exclusively for religious purposes.",
      options: ["True", "False", "Not Given"],
      correctAnswer: "False",
      passageIndex: 1,
      audioPath: null
    });

    await this.createQuestion({
      testId: test.id,
      type: QuestionType.FILL_BLANK,
      content: "The Chinese writing system is described as ____________, which means each character represents a word rather than a sound.",
      options: null,
      correctAnswer: "logographic",
      passageIndex: 1,
      audioPath: null
    });

    // Create passage 2
    const passage2 = await this.createPassage({
      testId: test.id,
      title: "The Science of Memory",
      content: `<p>Memory is a fundamental cognitive process that allows humans to acquire, store, retain, and retrieve information. Without memory, we would be unable to learn, recognize familiar faces, or even engage in meaningful conversations. Scientists have made significant advances in understanding how memory works at both psychological and neurological levels.</p>
      
      <p>Psychologists often divide memory into three main systems: sensory memory, short-term memory, and long-term memory. Sensory memory holds environmental information perceived by our senses for extremely brief periods, typically just a few seconds. This system allows us to retain impressions of sensory information after the original stimuli have ended. The most extensively studied forms are iconic memory (visual) and echoic memory (auditory).</p>
      
      <p>Short-term memory, also known as working memory, holds a small amount of information in an active, readily available state for a brief period, typically 20-30 seconds. It has a limited capacity, with research suggesting that most people can hold about 7 (plus or minus 2) items in short-term memory at once. However, this capacity can be expanded through a process called chunking, where individual pieces of information are grouped into meaningful units.</p>
      
      <p>Long-term memory, by contrast, can store vast amounts of information for potentially unlimited duration—sometimes for an entire lifetime. Unlike the other systems, information in long-term memory must be encoded, a process that requires attention and conscious effort. Once encoded, information can be stored across various interconnected neural systems depending on the type of memory.</p>
      
      <p>Neurologically, memory formation involves changes at the level of individual neurons and the strength of connections between them. When new information is encountered, neurons in the brain fire together, and "neurons that fire together, wire together"—a principle known as Hebbian learning. This process creates physical changes at synapses, the junctions between neurons, strengthening their connections and facilitating future communication.</p>`,
      index: 2
    });

    // Create questions for passage 2
    await this.createQuestion({
      testId: test.id,
      type: QuestionType.MATCHING,
      content: "Match the memory systems with their correct descriptions.",
      options: {
        items: ["Sensory memory", "Short-term memory", "Long-term memory"],
        matches: ["Retains impressions of environmental information for a few seconds", "Holds information in an active state for 20-30 seconds", "Can store vast amounts of information for potentially unlimited duration"]
      },
      correctAnswer: JSON.stringify({"Sensory memory": "Retains impressions of environmental information for a few seconds", "Short-term memory": "Holds information in an active state for 20-30 seconds", "Long-term memory": "Can store vast amounts of information for potentially unlimited duration"}),
      passageIndex: 2,
      audioPath: null
    });

    await this.createQuestion({
      testId: test.id,
      type: QuestionType.MULTIPLE_CHOICE,
      content: "What is the capacity of short-term memory according to the passage?",
      options: ["3-5 items", "7±2 items", "10-12 items", "Unlimited items"],
      correctAnswer: "7±2 items",
      passageIndex: 2,
      audioPath: null
    });

    // Create passage 3
    const passage3 = await this.createPassage({
      testId: test.id,
      title: "Sustainable Urban Planning",
      content: `<p>The twenty-first century has been marked by unprecedented urbanization, with more than half the world's population now living in cities. This shift has profound implications for the environment, as urban areas consume over two-thirds of the world's energy and account for more than 70% of global carbon emissions. In response, sustainable urban planning has emerged as a crucial field, aiming to create cities that meet the needs of the present without compromising future generations.</p>
      
      <p>At its core, sustainable urban planning seeks to balance environmental, social, and economic considerations. This holistic approach recognizes that cities are complex systems where these factors are deeply interconnected. For instance, walkable neighborhoods with good public transportation not only reduce carbon emissions but also promote public health, increase property values, and foster community connections.</p>
      
      <p>One key strategy in sustainable urban planning is transit-oriented development (TOD), which concentrates housing, commercial spaces, and amenities around public transportation hubs. This approach reduces car dependency, decreases transportation costs for residents, and makes efficient use of existing infrastructure. Cities like Copenhagen, Denmark, and Portland, Oregon, have successfully implemented TOD principles, creating vibrant, accessible neighborhoods centered around transit stations.</p>
      
      <p>Green infrastructure represents another important component of sustainable cities. This includes urban forests, parks, green roofs, rain gardens, and permeable pavements that help manage stormwater, reduce urban heat island effects, improve air quality, and enhance biodiversity. Singapore, often called a "city in a garden," has incorporated extensive green spaces into its urban fabric, with nearly 50% of the city-state covered by green areas.</p>
      
      <p>Energy-efficient buildings are also critical to sustainable urban development. Passive design strategies that maximize natural lighting and ventilation, along with technologies like solar panels and efficient insulation, can dramatically reduce energy consumption. The European Union's nearly zero-energy buildings (nZEB) standard, which requires all new buildings to be highly energy efficient by 2021, exemplifies the regulatory approach that many regions are adopting to encourage green building practices.</p>`,
      index: 3
    });

    // Create questions for passage 3
    await this.createQuestion({
      testId: test.id,
      type: QuestionType.TRUE_FALSE_NG,
      content: "Urban areas consume more than two-thirds of the world's energy.",
      options: ["True", "False", "Not Given"],
      correctAnswer: "True",
      passageIndex: 3,
      audioPath: null
    });

    await this.createQuestion({
      testId: test.id,
      type: QuestionType.SHORT_ANSWER,
      content: "What percentage of Singapore is covered by green areas?",
      options: null,
      correctAnswer: "50%",
      passageIndex: 3,
      audioPath: null
    });
  }

  // Helper to initialize a sample listening test
  private async initializeListeningTest() {
    const test = await this.createTest({
      title: "Academic Listening Test 1",
      description: "Complete listening test with 4 sections and 40 questions",
      module: TestModule.LISTENING,
      durationMinutes: 30,
      active: true
    });

    // Create questions for section 1
    await this.createQuestion({
      testId: test.id,
      type: QuestionType.FILL_BLANK,
      content: "Property Address:",
      options: null,
      correctAnswer: "42 Oak Avenue",
      passageIndex: 1,
      audioPath: "section1.mp3" // Note: This would be a real audio file path in production
    });

    await this.createQuestion({
      testId: test.id,
      type: QuestionType.FILL_BLANK,
      content: "Monthly Rent:",
      options: null,
      correctAnswer: "1250",
      passageIndex: 1,
      audioPath: "section1.mp3"
    });

    await this.createQuestion({
      testId: test.id,
      type: QuestionType.FILL_BLANK,
      content: "Security Deposit:",
      options: null,
      correctAnswer: "one month's rent",
      passageIndex: 1,
      audioPath: "section1.mp3"
    });

    // Create questions for section 2
    await this.createQuestion({
      testId: test.id,
      type: QuestionType.MULTIPLE_CHOICE,
      content: "What is the main purpose of the campus tour?",
      options: ["To showcase the university's history", "To help new students find their classes", "To orient students to campus facilities", "To promote the university's sports teams"],
      correctAnswer: "To orient students to campus facilities",
      passageIndex: 2,
      audioPath: "section2.mp3"
    });
  }

  // Helper to initialize a sample writing test
  private async initializeWritingTest() {
    const test = await this.createTest({
      title: "Academic Writing Test 1",
      description: "Complete writing test with tasks 1 and 2",
      module: TestModule.WRITING,
      durationMinutes: 60,
      active: true
    });

    // Create task 1
    await this.createQuestion({
      testId: test.id,
      type: QuestionType.ESSAY,
      content: "The chart below shows the percentage of households with access to the internet in three different countries between 2000 and 2020.\n\nSummarize the information by selecting and reporting the main features, and make comparisons where relevant.",
      options: null,
      correctAnswer: null, // No correct answer for essays
      passageIndex: 1,
      audioPath: null
    });

    // Create task 2
    await this.createQuestion({
      testId: test.id,
      type: QuestionType.ESSAY,
      content: "Some people believe that universities should focus on providing academic skills, while others think that universities should prepare students for their future careers. Discuss both views and give your own opinion.",
      options: null,
      correctAnswer: null,
      passageIndex: 2,
      audioPath: null
    });
  }

  // Helper to initialize a sample speaking test
  private async initializeSpeakingTest() {
    const test = await this.createTest({
      title: "Academic Speaking Test 1",
      description: "Complete speaking test with all 3 parts",
      module: TestModule.SPEAKING,
      durationMinutes: 15,
      active: true
    });

    // Create part 1 question
    await this.createQuestion({
      testId: test.id,
      type: QuestionType.SPEAKING,
      content: "Talk about your hometown. What do you like and dislike about it?",
      options: null,
      correctAnswer: null,
      passageIndex: 1,
      audioPath: null
    });

    // Create part 2 question
    await this.createQuestion({
      testId: test.id,
      type: QuestionType.SPEAKING,
      content: "Describe a place you have visited that you found interesting.\n\nYou should say:\n- Where the place is\n- When you visited this place\n- What you did there\n- And explain why you found this place interesting",
      options: null,
      correctAnswer: null,
      passageIndex: 2,
      audioPath: null
    });

    // Create part 3 question
    await this.createQuestion({
      testId: test.id,
      type: QuestionType.SPEAKING,
      content: "What factors make a city or town a good place to live?",
      options: null,
      correctAnswer: null,
      passageIndex: 3,
      audioPath: null
    });
  }

  // Vocabulary methods
  async getVocabulariesByUser(userId: number): Promise<Vocabulary[]> {
    return Array.from(this.vocabularies.values())
      .filter(v => v.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getVocabulary(id: number): Promise<Vocabulary | undefined> {
    return this.vocabularies.get(id);
  }

  async createVocabulary(insertVocabulary: InsertVocabulary): Promise<Vocabulary> {
    const id = this.currentVocabularyId++;

    // Calculate next review time (24 hours from now for new items)
    const nextReview = new Date();
    nextReview.setHours(nextReview.getHours() + 24);

    const vocabulary: Vocabulary = {
      ...insertVocabulary,
      id,
      lastReviewed: new Date(),
      nextReview,
      reviewStage: insertVocabulary.reviewStage || 0,
      createdAt: new Date()
    };

    this.vocabularies.set(id, vocabulary);
    return vocabulary;
  }

  async updateVocabulary(id: number, updatedVocabulary: Partial<Vocabulary>): Promise<Vocabulary | undefined> {
    const existingVocabulary = this.vocabularies.get(id);
    if (!existingVocabulary) return undefined;

    const vocabulary: Vocabulary = {
      ...existingVocabulary,
      ...updatedVocabulary
    };

    this.vocabularies.set(id, vocabulary);
    return vocabulary;
  }

  async deleteVocabulary(id: number): Promise<boolean> {
    const exists = this.vocabularies.has(id);
    if (exists) {
      this.vocabularies.delete(id);
      return true;
    }
    return false;
  }

  // Get vocabulary items due for review based on their next review time
  async getVocabularyForReview(userId: number, limit: number = 20): Promise<Vocabulary[]> {
    const now = new Date();
    
    return Array.from(this.vocabularies.values())
      .filter(v => v.userId === userId && v.nextReview && new Date(v.nextReview) <= now)
      .sort((a, b) => {
        // Sort by review stage (lower stages first) and then by nextReview date (oldest first)
        if (a.reviewStage !== b.reviewStage) {
          return a.reviewStage - b.reviewStage;
        }
        return new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime();
      })
      .slice(0, limit);
  }

  // Update the review stage and next review time based on the PACE method
  async updateVocabularyReviewStatus(id: number, reviewStage: number): Promise<Vocabulary | undefined> {
    const vocabulary = this.vocabularies.get(id);
    if (!vocabulary) return undefined;

    // Calculate the next review time based on the new review stage
    const nextReview = new Date();
    
    // PACE repetition intervals:
    // Stage 0: 1 day
    // Stage 1: 3 days
    // Stage 2: 7 days
    // Stage 3: 14 days
    // Stage 4: 30 days
    // Stage 5+: 90 days
    switch (reviewStage) {
      case 0:
        nextReview.setDate(nextReview.getDate() + 1); // 1 day
        break;
      case 1:
        nextReview.setDate(nextReview.getDate() + 3); // 3 days
        break;
      case 2:
        nextReview.setDate(nextReview.getDate() + 7); // 7 days
        break;
      case 3:
        nextReview.setDate(nextReview.getDate() + 14); // 14 days
        break;
      case 4:
        nextReview.setDate(nextReview.getDate() + 30); // 30 days
        break;
      default:
        nextReview.setDate(nextReview.getDate() + 90); // 90 days
        break;
    }

    const updatedVocabulary: Vocabulary = {
      ...vocabulary,
      reviewStage,
      lastReviewed: new Date(),
      nextReview
    };

    this.vocabularies.set(id, updatedVocabulary);
    return updatedVocabulary;
  }

  // Notification methods
  async getNotificationsByUser(userId: number, unreadOnly: boolean = false): Promise<Notification[]> {
    const notifications = Array.from(this.notifications.values())
      .filter(n => n.userId === userId);
    
    return unreadOnly ? notifications.filter(n => !n.isRead) : notifications;
  }
  
  async getNotification(id: number): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }
  
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = this.currentNotificationId++;
    const now = new Date();
    
    const newNotification: Notification = {
      ...notification,
      id,
      isRead: notification.isRead ?? false,
      scheduledFor: notification.scheduledFor ?? now,
      createdAt: now
    };
    
    this.notifications.set(id, newNotification);
    return newNotification;
  }
  
  async markNotificationAsRead(id: number): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification) return undefined;
    
    const updatedNotification: Notification = {
      ...notification,
      isRead: true
    };
    
    this.notifications.set(id, updatedNotification);
    return updatedNotification;
  }
  
  async markAllNotificationsAsRead(userId: number): Promise<boolean> {
    let success = true;
    const userNotifications = await this.getNotificationsByUser(userId);
    
    for (const notification of userNotifications) {
      try {
        const updatedNotification: Notification = {
          ...notification,
          isRead: true
        };
        this.notifications.set(notification.id, updatedNotification);
      } catch (error) {
        console.error(`Failed to mark notification ${notification.id} as read:`, error);
        success = false;
      }
    }
    
    return success;
  }
  
  async deleteNotification(id: number): Promise<boolean> {
    return this.notifications.delete(id);
  }
  
  async getUnreadNotificationsCount(userId: number): Promise<number> {
    return (await this.getNotificationsByUser(userId, true)).length;
  }
  
  // Badge methods
  async getBadge(id: number): Promise<Badge | undefined> {
    return this.badges.get(id);
  }
  
  async getBadgeByName(name: string): Promise<Badge | undefined> {
    return Array.from(this.badges.values()).find(badge => badge.name === name);
  }
  
  async getAllBadges(): Promise<Badge[]> {
    return Array.from(this.badges.values());
  }
  
  async getActiveBadges(): Promise<Badge[]> {
    return Array.from(this.badges.values()).filter(badge => badge.isActive);
  }
  
  async createBadge(insertBadge: InsertBadge): Promise<Badge> {
    const id = this.currentBadgeId++;
    const badge: Badge = {
      ...insertBadge,
      id,
      requiredScore: insertBadge.requiredScore || null,
      requiredCount: insertBadge.requiredCount || null,
      moduleType: insertBadge.moduleType || null,
      createdAt: new Date(),
      isActive: insertBadge.isActive !== undefined ? insertBadge.isActive : true
    };
    this.badges.set(id, badge);
    return badge;
  }
  
  async updateBadge(id: number, updateBadge: Partial<Badge>): Promise<Badge | undefined> {
    const badge = this.badges.get(id);
    if (!badge) return undefined;
    
    const updatedBadge: Badge = {
      ...badge,
      ...updateBadge
    };
    
    this.badges.set(id, updatedBadge);
    return updatedBadge;
  }
  
  // User Badges methods
  async getUserBadgesByUser(userId: number): Promise<UserBadge[]> {
    return Array.from(this.userBadges.values()).filter(userBadge => userBadge.userId === userId);
  }
  
  async getUserBadge(id: number): Promise<UserBadge | undefined> {
    return this.userBadges.get(id);
  }
  
  async getUserBadgeByBadgeId(userId: number, badgeId: number): Promise<UserBadge | undefined> {
    return Array.from(this.userBadges.values()).find(
      userBadge => userBadge.userId === userId && userBadge.badgeId === badgeId
    );
  }
  
  async createUserBadge(insertUserBadge: InsertUserBadge): Promise<UserBadge> {
    const id = this.currentUserBadgeId++;
    const userBadge: UserBadge = {
      ...insertUserBadge,
      id,
      earnedAt: new Date(),
      isDisplayed: insertUserBadge.isDisplayed !== undefined ? insertUserBadge.isDisplayed : true,
      timesEarned: insertUserBadge.timesEarned || 1
    };
    this.userBadges.set(id, userBadge);
    return userBadge;
  }
  
  async updateUserBadge(id: number, updateUserBadge: Partial<UserBadge>): Promise<UserBadge | undefined> {
    const userBadge = this.userBadges.get(id);
    if (!userBadge) return undefined;
    
    const updatedUserBadge: UserBadge = {
      ...userBadge,
      ...updateUserBadge
    };
    
    this.userBadges.set(id, updatedUserBadge);
    return updatedUserBadge;
  }
  
  // Point Actions methods
  async getPointAction(id: number): Promise<PointAction | undefined> {
    return this.pointActions.get(id);
  }
  
  async getPointActionByType(actionType: PointActionType): Promise<PointAction | undefined> {
    return Array.from(this.pointActions.values()).find(action => action.actionType === actionType);
  }
  
  async getAllPointActions(): Promise<PointAction[]> {
    return Array.from(this.pointActions.values());
  }
  
  async createPointAction(insertPointAction: InsertPointAction): Promise<PointAction> {
    const id = this.currentPointActionId++;
    const pointAction: PointAction = {
      ...insertPointAction,
      id,
      isActive: insertPointAction.isActive !== undefined ? insertPointAction.isActive : true,
      createdAt: new Date()
    };
    this.pointActions.set(id, pointAction);
    return pointAction;
  }
  
  async updatePointAction(id: number, updatePointAction: Partial<PointAction>): Promise<PointAction | undefined> {
    const pointAction = this.pointActions.get(id);
    if (!pointAction) return undefined;
    
    const updatedPointAction: PointAction = {
      ...pointAction,
      ...updatePointAction
    };
    
    this.pointActions.set(id, updatedPointAction);
    return updatedPointAction;
  }
  
  // User Points methods
  async getUserPointsByUser(userId: number): Promise<UserPoint[]> {
    return Array.from(this.userPoints.values()).filter(userPoint => userPoint.userId === userId);
  }
  
  async getUserPoint(id: number): Promise<UserPoint | undefined> {
    return this.userPoints.get(id);
  }
  
  async createUserPoint(insertUserPoint: InsertUserPoint): Promise<UserPoint> {
    const id = this.currentUserPointId++;
    const userPoint: UserPoint = {
      ...insertUserPoint,
      id,
      relatedEntityId: insertUserPoint.relatedEntityId || null,
      relatedEntityType: insertUserPoint.relatedEntityType || null,
      earnedAt: new Date()
    };
    this.userPoints.set(id, userPoint);
    return userPoint;
  }
  
  // User Levels methods
  async getUserLevel(id: number): Promise<UserLevel | undefined> {
    return this.userLevels.get(id);
  }
  
  async getUserLevelByLevel(level: number): Promise<UserLevel | undefined> {
    return Array.from(this.userLevels.values()).find(userLevel => userLevel.level === level);
  }
  
  async getAllUserLevels(): Promise<UserLevel[]> {
    return Array.from(this.userLevels.values());
  }
  
  async createUserLevel(insertUserLevel: InsertUserLevel): Promise<UserLevel> {
    const id = this.currentUserLevelId++;
    const userLevel: UserLevel = {
      ...insertUserLevel,
      id,
      badgeId: insertUserLevel.badgeId || null,
      createdAt: new Date()
    };
    this.userLevels.set(id, userLevel);
    return userLevel;
  }
  
  async updateUserLevel(id: number, updateUserLevel: Partial<UserLevel>): Promise<UserLevel | undefined> {
    const userLevel = this.userLevels.get(id);
    if (!userLevel) return undefined;
    
    const updatedUserLevel: UserLevel = {
      ...userLevel,
      ...updateUserLevel
    };
    
    this.userLevels.set(id, updatedUserLevel);
    return updatedUserLevel;
  }
  
  // User Achievements methods
  async getUserAchievement(userId: number): Promise<UserAchievement | undefined> {
    return Array.from(this.userAchievements.values()).find(achievement => achievement.userId === userId);
  }
  
  async createUserAchievement(insertUserAchievement: InsertUserAchievement): Promise<UserAchievement> {
    const id = this.currentUserAchievementId++;
    const userAchievement: UserAchievement = {
      ...insertUserAchievement,
      id,
      totalPoints: insertUserAchievement.totalPoints || 0,
      currentLevel: insertUserAchievement.currentLevel || 1,
      loginStreak: insertUserAchievement.loginStreak || 0,
      lastLoginDate: new Date(),
      testsCompleted: insertUserAchievement.testsCompleted || 0,
      vocabularyAdded: insertUserAchievement.vocabularyAdded || 0,
      vocabularyReviewed: insertUserAchievement.vocabularyReviewed || 0,
      highestScore: insertUserAchievement.highestScore || 0,
      updatedAt: new Date()
    };
    this.userAchievements.set(id, userAchievement);
    return userAchievement;
  }
  
  async updateUserAchievement(userId: number, updateUserAchievement: Partial<UserAchievement>): Promise<UserAchievement | undefined> {
    const achievement = Array.from(this.userAchievements.values()).find(a => a.userId === userId);
    if (!achievement) return undefined;
    
    const updatedAchievement: UserAchievement = {
      ...achievement,
      ...updateUserAchievement,
      updatedAt: new Date()
    };
    
    this.userAchievements.set(achievement.id, updatedAchievement);
    return updatedAchievement;
  }
}

export const storage = new MemStorage();
