export type Page = "landing" | "login" | "signup" | "dashboard" | "setup" | "interview";

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface InterviewSetup {
  interviewerGender: "Male" | "Female";
  category: "Technical" | "Non Technical";
  domain: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
}

export interface InterviewSession extends InterviewSetup {
  id: string;
  userId: string;
  status: "Scheduled" | "Completed" | "In Progress";
  createdAt: string;
  performanceScore?: number;
  durationMinutes?: number;
}

export interface ImprovementItem {
  id: string;
  domain: string;
  title: string;
  description: string;
  category: string;
  impact: string;
}

export interface LastEvaluation {
  overallScore: number;
  domainScore: number;
  strengths: string[];
  weaknesses: string[];
  areasOfImprovement: string[];
  personalizedSuggestions: string[];
  timestamp: string;
  domain: string;
  category: string;
}

export interface DashboardData {
  userName: string;
  stats: {
    interviewsCompleted: number;
    averageScore: number;
    hoursPracticed: number;
    globalRank: string;
  };
  interviews: InterviewSession[];
  improvements: ImprovementItem[];
  lastEvaluation?: LastEvaluation | null;
}
