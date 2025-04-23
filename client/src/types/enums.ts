export enum BadgeType {
  ACHIEVEMENT = "achievement", // For completing specific goals
  MILESTONE = "milestone",     // For reaching numerical milestones
  SPECIAL = "special",         // For special achievements or events
  MASTERY = "mastery"          // For skill mastery
}

export enum BadgeRarity {
  COMMON = "common",
  UNCOMMON = "uncommon",
  RARE = "rare",
  EPIC = "epic",
  LEGENDARY = "legendary"
}

export enum PointActionType {
  COMPLETE_TEST = "complete_test",
  REVIEW_VOCABULARY = "review_vocabulary",
  ADD_VOCABULARY = "add_vocabulary",
  LOGIN_STREAK = "login_streak",
  PERFECT_SCORE = "perfect_score",
  FIRST_ATTEMPT = "first_attempt",
  FEEDBACK_GIVEN = "feedback_given" 
}