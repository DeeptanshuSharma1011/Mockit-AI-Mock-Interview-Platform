import { Response } from "express";
import { isUsingMockDB, mockDB, supabase } from "../config/db";
import { AuthenticatedRequest } from "../middleware/auth";

export async function updateUserAnalytics(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthenticated request" });
  }

  const { score, technicalScore, communicationScore, confidenceScore, domain, category } = req.body;

  if (score === undefined || !domain || !category) {
    return res.status(400).json({ 
      error: "Missing required analytics fields. 'score', 'domain', and 'category' are mandatory." 
    });
  }

  try {
    const numScore = Number(score);
    const numTech = technicalScore !== undefined ? Number(technicalScore) : numScore;
    const numComm = communicationScore !== undefined ? Number(communicationScore) : numScore;
    const numConf = confidenceScore !== undefined ? Number(confidenceScore) : numScore;

    const trendEntry = {
      score: numScore,
      category,
      domain,
      date: new Date().toISOString()
    };

    let updatedAnalytics: any = null;

    if (isUsingMockDB) {
      const userIndex = mockDB.users.findIndex(u => u.id === req.user?.userId);
      if (userIndex === -1) {
        return res.status(404).json({ error: "User not found in mock workspace storage." });
      }

      const user = mockDB.users[userIndex];
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

      const trends = user.analytics.improvementTrends || [];
      trends.push(trendEntry);

      const total = trends.length;
      
      // Calculate averages
      const avgOverall = Math.round(trends.reduce((sum: number, t: any) => sum + t.score, 0) / total);
      
      // Keep domain-wise mapping
      const domainScores = user.analytics.domainWiseScores || {};
      domainScores[domain] = numScore;

      user.analytics = {
        overallScore: avgOverall,
        technicalScore: Math.round(((user.analytics.technicalScore || 0) * (total - 1) + numTech) / total),
        communicationScore: Math.round(((user.analytics.communicationScore || 0) * (total - 1) + numComm) / total),
        confidenceScore: Math.round(((user.analytics.confidenceScore || 0) * (total - 1) + numConf) / total),
        domainWiseScores: domainScores,
        totalInterviews: total,
        improvementTrends: trends
      };

      updatedAnalytics = user.analytics;
    } else {
      const { data: user, error: fetchError } = await supabase
        .from("users")
        .select("*")
        .eq("id", req.user.userId)
        .maybeSingle();

      if (fetchError || !user) {
        return res.status(404).json({ error: "User profile not found in Supabase." });
      }

      // Initialize analytics object if empty or null
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
      trends.push(trendEntry);

      const total = trends.length;

      // Compute simple averages
      const sumOverall = trends.reduce((sum: number, item: any) => sum + item.score, 0);
      const overallScore = Math.round(sumOverall / total);

      // Rolling averages for sub-scores
      const oldTech = currentAnalytics.technicalScore || 0;
      const technicalScoreComputed = Math.round((oldTech * (total - 1) + numTech) / total);

      const oldComm = currentAnalytics.communicationScore || 0;
      const communicationScoreComputed = Math.round((oldComm * (total - 1) + numComm) / total);

      const oldConf = currentAnalytics.confidenceScore || 0;
      const confidenceScoreComputed = Math.round((oldConf * (total - 1) + numConf) / total);

      const domainWiseScores = currentAnalytics.domainWiseScores || {};
      domainWiseScores[domain] = numScore;

      updatedAnalytics = {
        overallScore,
        technicalScore: technicalScoreComputed,
        communicationScore: communicationScoreComputed,
        confidenceScore: confidenceScoreComputed,
        domainWiseScores,
        totalInterviews: total,
        improvementTrends: trends
      };

      const { error: updateError } = await supabase
        .from("users")
        .update({ analytics: updatedAnalytics })
        .eq("id", req.user.userId);

      if (updateError) {
        throw new Error("Supabase update error: " + updateError.message);
      }
    }

    res.json({
      message: "Candidate analytics updated successfully",
      analytics: updatedAnalytics
    });

  } catch (error: any) {
    console.error("Update user analytics controller error:", error);
    res.status(500).json({ error: "Failed to update interview analytics scorecard: " + error.message });
  }
}
