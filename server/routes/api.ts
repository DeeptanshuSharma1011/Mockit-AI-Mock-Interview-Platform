import { Router } from "express";
import { signup, login, getUserProfile } from "../controllers/authController";
import { updateUserAnalytics } from "../controllers/analyticsController";
import { getDashboardData, createInterviewSetup, completeInterview } from "../controllers/interviewController";
import { startInterview, submitAnswer, concludeInterviewEarly } from "../controllers/aiInterviewController";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Authentication Endpoints
router.post("/auth/signup", signup);
router.post("/auth/login", login);
router.get("/auth/me", authenticateToken as any, getUserProfile as any);

// Analytics Metrics Endpoints
router.post("/analytics/update", authenticateToken as any, updateUserAnalytics as any);

// Dashboard & Session Scheduling Endpoints
router.get("/dashboard", authenticateToken as any, getDashboardData as any);
router.post("/interviews/setup", authenticateToken as any, createInterviewSetup as any);
router.post("/interviews/:id/complete", authenticateToken as any, completeInterview as any);

// Interactive AI Voice Interview Endpoints
router.post("/interviews/:id/start", authenticateToken as any, startInterview as any);
router.post("/interviews/:id/answer", authenticateToken as any, submitAnswer as any);
router.post("/interviews/:id/abort", authenticateToken as any, concludeInterviewEarly as any);

export default router;
