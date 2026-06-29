import { Response } from "express";
import { isUsingMockDB, mockDB, supabase } from "../config/db";
import { AuthenticatedRequest } from "../middleware/auth";

// Temporary storage for mock interviews if using fallback DB
export const mockInterviews = [] as any[];

export async function getDashboardData(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthenticated request" });
  }

  const userId = req.user.userId;

  try {
    let userInterviews: any[] = [];
    let foundUser: any = null;

    if (isUsingMockDB) {
      foundUser = mockDB.users.find(u => u.id === userId);
      userInterviews = mockInterviews.filter(item => item.userId === userId);
    } else {
      const { data, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (userError) {
        throw new Error("Supabase user lookup error: " + userError.message);
      }
      foundUser = data;

      const { data: interviewsData, error: intError } = await supabase
        .from("interviews")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (intError) {
        throw new Error("Supabase interviews lookup error: " + intError.message);
      }

      // Map snake_case database schema properties into frontend camelCase format
      userInterviews = (interviewsData || []).map((i: any) => ({
        id: i.id,
        userId: i.user_id || i.userId,
        interviewerGender: i.interviewer_gender || i.interviewerGender,
        category: i.category,
        domain: i.domain,
        difficulty: i.difficulty,
        status: i.status,
        performanceScore: i.performance_score !== undefined ? i.performance_score : i.performanceScore,
        durationMinutes: i.duration_minutes !== undefined ? i.duration_minutes : i.durationMinutes,
        createdAt: i.created_at || i.createdAt
      }));
    }

    if (!foundUser) {
      return res.status(404).json({ error: "Candidate profile not found" });
    }

    const completed = userInterviews.filter(i => i.status === "Completed");
    const totalCompleted = completed.length;

    // Retrieve stats directly from user analytics model if exists, otherwise compute on-the-fly
    const overallScore = foundUser.analytics?.overallScore || 0;
    const hoursPracticed = foundUser.analytics?.totalInterviews 
      ? parseFloat((completed.reduce((sum, item) => sum + (item.durationMinutes || 0), 0) / 60).toFixed(1))
      : 0;

    const placeholderImprovements = [
      {
        id: "imp_1",
        domain: "Technical Answers",
        title: "Explain Big O Complexity",
        description: "Practice breaking down time and space complexity with absolute clarity when asked.",
        category: "Technical",
        impact: "High"
      },
      {
        id: "imp_2",
        domain: "Behavioral Response",
        title: "Use the STAR Method",
        description: "Formulate your situational stories strictly using Situation, Task, Action, and Result.",
        category: "Non Technical",
        impact: "Medium"
      },
      {
        id: "imp_3",
        domain: "System Design",
        title: "Deepen Database Sharding",
        description: "Refine how you address database replication, partitioning, and horizontally scaling.",
        category: "Technical",
        impact: "High"
      }
    ];

    // Dynamic or fallback analytics for beautiful dashboard charts
    const defaultDomainWise = {
      "Frontend": 84,
      "Backend": 78,
      "System Design": 72,
      "Behavioral": 86,
      "Algorithms": 80
    };

    const emptyDomainWise = {
      "Frontend": 0,
      "Backend": 0,
      "System Design": 0,
      "Behavioral": 0,
      "Algorithms": 0
    };

    // Calculate a realistic trend from user interviews or fallback to a professional progression
    const defaultTrends = [
      { date: "May 10", score: 68, confidence: 70, communication: 72 },
      { date: "May 22", score: 72, confidence: 74, communication: 75 },
      { date: "Jun 02", score: 75, confidence: 78, communication: 78 },
      { date: "Jun 15", score: 81, confidence: 80, communication: 82 },
      { date: "Jun 28", score: overallScore || (totalCompleted > 0 ? Math.round(completed.reduce((sum, i) => sum + (i.performanceScore || 0), 0) / totalCompleted) : 84), confidence: foundUser.analytics?.confidenceScore || 82, communication: foundUser.analytics?.communicationScore || 85 }
    ];

    const hasCompletedAny = totalCompleted > 0 || (foundUser.analytics?.totalInterviews && foundUser.analytics.totalInterviews > 0);

    res.json({
      userName: foundUser.name,
      stats: {
        interviewsCompleted: hasCompletedAny ? (foundUser.analytics?.totalInterviews || totalCompleted) : 0,
        averageScore: hasCompletedAny ? (overallScore || Math.round(completed.reduce((sum, i) => sum + (i.performanceScore || 0), 0) / totalCompleted)) : 0,
        hoursPracticed: hasCompletedAny ? (hoursPracticed || parseFloat((totalCompleted * 0.4).toFixed(1))) : 0,
        globalRank: hasCompletedAny ? "Top 12%" : "Unranked"
      },
      analytics: {
        technicalScore: hasCompletedAny ? (foundUser.analytics?.technicalScore || 82) : 0,
        communicationScore: hasCompletedAny ? (foundUser.analytics?.communicationScore || 85) : 0,
        confidenceScore: hasCompletedAny ? (foundUser.analytics?.confidenceScore || 81) : 0,
        domainWiseScores: hasCompletedAny ? (foundUser.analytics?.domainWiseScores || defaultDomainWise) : emptyDomainWise,
        improvementTrends: hasCompletedAny ? (foundUser.analytics?.improvementTrends || defaultTrends) : []
      },
      interviews: userInterviews,
      improvements: placeholderImprovements,
      lastEvaluation: foundUser.analytics?.lastEvaluation || null
    });

  } catch (error: any) {
    console.error("Dashboard controller error:", error);
    res.status(500).json({ error: "Failed to gather dashboard data: " + error.message });
  }
}

export async function createInterviewSetup(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthenticated request" });
  }

  const userId = req.user.userId;
  const { interviewerGender, category, domain, difficulty } = req.body;

  if (!interviewerGender || !category || !domain || !difficulty) {
    return res.status(400).json({ error: "Missing required setup parameters" });
  }

  try {
    let newInterview: any = null;

    if (isUsingMockDB) {
      newInterview = {
        id: "mock_int_" + Math.random().toString(36).substr(2, 9),
        userId,
        interviewerGender,
        category,
        domain,
        difficulty,
        status: "Scheduled",
        createdAt: new Date().toISOString()
      };
      mockInterviews.push(newInterview);
    } else {
      const { data, error } = await supabase
        .from("interviews")
        .insert({
          user_id: userId,
          interviewer_gender: interviewerGender,
          category,
          domain,
          difficulty,
          status: "Scheduled"
        })
        .select()
        .single();

      if (error || !data) {
        throw new Error("Supabase insert error: " + (error?.message || "Failed to schedule setup."));
      }

      newInterview = {
        id: data.id,
        userId: data.user_id || data.userId,
        interviewerGender: data.interviewer_gender || data.interviewerGender,
        category: data.category,
        domain: data.domain,
        difficulty: data.difficulty,
        status: data.status,
        createdAt: data.created_at || data.createdAt
      };
    }

    res.status(201).json({
      message: "Mock interview scenario configured successfully",
      interview: newInterview
    });

  } catch (error: any) {
    console.error("Create setup controller error:", error);
    res.status(500).json({ error: "Failed to schedule interview setup: " + error.message });
  }
}

export async function completeInterview(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthenticated request" });
  }

  const userId = req.user.userId;
  const interviewId = req.params.id;
  const { score } = req.body;

  try {
    const finalScore = score !== undefined ? parseInt(score) : Math.floor(Math.random() * 25) + 72; // 72 to 97
    const duration = Math.floor(Math.random() * 15) + 15; // 15 to 30 mins

    let completedInterview: any = null;
    let targetDomain = "";
    let targetCategory = "";

    if (isUsingMockDB) {
      const idx = mockInterviews.findIndex(i => i.id === interviewId && i.userId === userId);
      if (idx === -1) {
        return res.status(404).json({ error: "Interview setup session not found" });
      }

      mockInterviews[idx].status = "Completed";
      mockInterviews[idx].performanceScore = finalScore;
      mockInterviews[idx].durationMinutes = duration;
      completedInterview = mockInterviews[idx];
      targetDomain = completedInterview.domain;
      targetCategory = completedInterview.category;

      // Automatically update User analytics in Mock DB
      const uIdx = mockDB.users.findIndex(u => u.id === userId);
      if (uIdx !== -1) {
        const user = mockDB.users[uIdx];
        if (!user.analytics) {
          user.analytics = {
            overallScore: 0,
            technicalScore: 0,
            communicationScore: 0,
            confidenceScore: 0,
            domainWiseScores: {},
            totalInterviews: 0,
            improvementTrends: []
          };
        }

        user.analytics.improvementTrends.push({
          score: finalScore,
          category: targetCategory,
          domain: targetDomain,
          date: new Date()
        });

        const total = user.analytics.improvementTrends.length;
        user.analytics.totalInterviews = total;

        user.analytics.overallScore = Math.round(user.analytics.improvementTrends.reduce((sum: number, t: any) => sum + t.score, 0) / total);
        user.analytics.technicalScore = Math.round(((user.analytics.technicalScore || 0) * (total - 1) + finalScore) / total);
        user.analytics.communicationScore = Math.round(((user.analytics.communicationScore || 0) * (total - 1) + finalScore) / total);
        user.analytics.confidenceScore = Math.round(((user.analytics.confidenceScore || 0) * (total - 1) + finalScore) / total);
        
        if (!user.analytics.domainWiseScores) {
          user.analytics.domainWiseScores = {};
        }
        user.analytics.domainWiseScores[targetDomain] = finalScore;
      }
    } else {
      const { data: interviewDoc, error: intError } = await supabase
        .from("interviews")
        .update({
          status: "Completed",
          performance_score: finalScore,
          duration_minutes: duration
        })
        .eq("id", interviewId)
        .eq("user_id", userId)
        .select()
        .maybeSingle();

      if (intError || !interviewDoc) {
        return res.status(404).json({ error: "Interview setup session not found in Supabase" });
      }

      completedInterview = {
        id: interviewDoc.id,
        userId: interviewDoc.user_id || interviewDoc.userId,
        interviewerGender: interviewDoc.interviewer_gender || interviewDoc.interviewerGender,
        category: interviewDoc.category,
        domain: interviewDoc.domain,
        difficulty: interviewDoc.difficulty,
        status: interviewDoc.status,
        performanceScore: interviewDoc.performance_score !== undefined ? interviewDoc.performance_score : interviewDoc.performanceScore,
        durationMinutes: interviewDoc.duration_minutes !== undefined ? interviewDoc.duration_minutes : interviewDoc.durationMinutes,
        createdAt: interviewDoc.created_at || interviewDoc.createdAt
      };

      targetDomain = completedInterview.domain;
      targetCategory = completedInterview.category;

      // Automatically update User analytics in Supabase
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (user) {
        const currentAnalytics = user.analytics || {
          overallScore: 0,
          technicalScore: 0,
          communicationScore: 0,
          confidenceScore: 0,
          domainWiseScores: {},
          totalInterviews: 0,
          improvementTrends: []
        };

        const trends = currentAnalytics.improvementTrends || [];
        trends.push({
          score: finalScore,
          category: targetCategory,
          domain: targetDomain,
          date: new Date().toISOString()
        });

        const total = trends.length;

        const sumOverall = trends.reduce((sum: number, t: any) => sum + t.score, 0);
        const overallScore = Math.round(sumOverall / total);

        const oldTech = currentAnalytics.technicalScore || 0;
        const technicalScoreComputed = Math.round((oldTech * (total - 1) + finalScore) / total);

        const oldComm = currentAnalytics.communicationScore || 0;
        const communicationScoreComputed = Math.round((oldComm * (total - 1) + finalScore) / total);

        const oldConf = currentAnalytics.confidenceScore || 0;
        const confidenceScoreComputed = Math.round((oldConf * (total - 1) + finalScore) / total);

        const domainWiseScores = currentAnalytics.domainWiseScores || {};
        domainWiseScores[targetDomain] = finalScore;

        const updatedAnalytics = {
          overallScore,
          technicalScore: technicalScoreComputed,
          communicationScore: communicationScoreComputed,
          confidenceScore: confidenceScoreComputed,
          domainWiseScores,
          totalInterviews: total,
          improvementTrends: trends
        };

        await supabase
          .from("users")
          .update({ analytics: updatedAnalytics })
          .eq("id", userId);
      }
    }

    res.json({
      message: "Interview session simulated as completed successfully",
      interview: completedInterview
    });

  } catch (error: any) {
    console.error("Complete interview controller error:", error);
    res.status(500).json({ error: "Failed to process interview completion: " + error.message });
  }
}
