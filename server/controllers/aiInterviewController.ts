import { Response } from "express";
import { isUsingMockDB, mockDB, supabase } from "../config/db";
import { AuthenticatedRequest } from "../middleware/auth";
import { GoogleGenAI, Type } from "@google/genai";
import { mockInterviews } from "./interviewController";

// Lazy-initialize Gemini API Client
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not defined in the environment secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

/**
 * Robust helper function with model fallbacks to handle transient 503 errors
 * and high demand peaks on gemini-3.5-flash.
 */
async function generateContentWithFallback(params: {
  contents: any;
  config?: any;
}): Promise<any> {
  const ai = getGeminiClient();
  const modelsToTry = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      console.log(`🤖 Attempting GenAI generation with model: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: params.config,
      });
      return response;
    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.code || (error?.message && error.message.includes("503") ? 503 : null);
      console.log(`[GenAI] Model ${model} was unavailable (status: ${status}). Retrying with next model...`);
      // Try next model
      continue;
    }
  }

  throw lastError;
}

// Temporary in-memory session memory for active voice interviews
// Ensures session memory is deleted automatically upon interview completion
export interface InterviewSessionMemory {
  interviewId: string;
  userId: string;
  domain: string;
  category: "Technical" | "Non Technical";
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  interviewerGender: "Male" | "Female";
  currentQuestionIndex: number; // 0-based index
  maxQuestions: number;
  currentDifficulty: "Beginner" | "Intermediate" | "Advanced";
  history: Array<{
    role: "interviewer" | "candidate";
    text: string;
    score?: number;
    feedback?: string;
  }>;
  scores: number[];
  answerScores?: Array<{
    technicalAccuracy: number;
    communication: number;
    confidence: number;
    clarity: number;
    relevance: number;
    problemSolving: number;
    behaviour: number;
    confidenceLossDetected: boolean;
  }>;
}

export const activeSessions = new Map<string, InterviewSessionMemory>();

/**
 * Start the interview and generate greeting + 1st question
 */
export async function startInterview(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthenticated request" });
  }

  const userId = req.user.userId;
  const { id: interviewId } = req.params;

  try {
    let interview: any = null;

    // 1. Retrieve the interview setup
    if (isUsingMockDB) {
      interview = mockInterviews.find(i => i.id === interviewId && i.userId === userId);
    } else {
      const { data, error } = await supabase
        .from("interviews")
        .select("*")
        .eq("id", interviewId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        interview = {
          id: data.id,
          userId: data.user_id,
          interviewerGender: data.interviewer_gender,
          category: data.category,
          domain: data.domain,
          difficulty: data.difficulty,
          status: data.status,
        };
      }
    }

    if (!interview) {
      return res.status(404).json({ error: "Interview setup session not found" });
    }

    const { domain, category, difficulty, interviewerGender } = interview;
    const interviewerName = interviewerGender === "Female" ? "Sophia" : "James";
    const interviewerPersona = interviewerGender === "Female" 
      ? "Sophia is a thorough, empathetic lead engineer who focuses deeply on clean design, trade-offs, scalability, and code hygiene."
      : "James is a crisp, direct VP Recruiter who has an objective, fast-paced assessment style, emphasizing real-world commercial impact and the STAR method.";

    // Initialize temporary memory store
    const sessionState: InterviewSessionMemory = {
      interviewId,
      userId,
      domain,
      category,
      difficulty,
      interviewerGender,
      currentQuestionIndex: 0,
      maxQuestions: 5,
      currentDifficulty: difficulty,
      history: [],
      scores: [],
      answerScores: [],
    };

    // Use Gemini to generate the initial greeting and the first interview question
    const ai = getGeminiClient();
    const systemPrompt = `You are ${interviewerName}, a human-like professional recruiter.
${interviewerPersona}
You are conducting a voice-based mock interview for a "${domain}" (${category}) position.
Current Difficulty target is: ${difficulty}.
Your goal is to greet the candidate warmly, introduce yourself briefly, and ask the very first interview question matching the pathway.

Guidelines:
- Make your speech sound like a real human recruiter talking naturally, NOT like an AI reading a script.
- Keep your introduction + question concise (within 3 to 4 sentences).
- Naturally include short pauses (using commas) and a strategic hesitation or natural opener (e.g., "Alright...", "Okay...", "Well...", "Hmm...") at the beginning of your prompt or transition.
- Do NOT use any markdown bolding (**), lists, bullets, or headers. Write pure plain conversational text that can be spoken clearly and realistically by a text-to-speech engine.
- Ask ONE clear, relevant, open-ended first question to start off.`;

    const response = await generateContentWithFallback({
      contents: "Start the interview. Greet the candidate and ask the first question.",
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      }
    });

    const outputText = response.text || `Hello! I am ${interviewerName}, your assessor today. Let's get started. To begin, could you explain your experience in "${domain}"?`;

    // Save history
    sessionState.history.push({
      role: "interviewer",
      text: outputText,
    });

    activeSessions.set(interviewId, sessionState);

    // Update status to "In Progress" if needed
    if (!isUsingMockDB) {
      await supabase
        .from("interviews")
        .update({ status: "In Progress" })
        .eq("id", interviewId);
    } else {
      const idx = mockInterviews.findIndex(i => i.id === interviewId);
      if (idx !== -1) {
        mockInterviews[idx].status = "In Progress";
      }
    }

    res.json({
      message: "Interview started successfully",
      interviewerName,
      session: {
        interviewId,
        currentQuestionIndex: 0,
        maxQuestions: 5,
        currentDifficulty: difficulty,
        domain,
        category,
      },
      text: outputText,
    });

  } catch (error: any) {
    console.error("Start interview error:", error);
    res.status(500).json({ error: "Failed to initialize voice interview: " + error.message });
  }
}

/**
 * Handle user's response, evaluate, adjust difficulty, and generate next question or conclude
 */
export async function submitAnswer(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthenticated request" });
  }

  const userId = req.user.userId;
  const { id: interviewId } = req.params;
  const { answer } = req.body;

  if (answer === undefined) {
    return res.status(400).json({ error: "Candidate answer is required" });
  }

  const session = activeSessions.get(interviewId);
  if (!session || session.userId !== userId) {
    return res.status(400).json({ 
      error: "No active interview session memory found. Please restart or initialize the session." 
    });
  }

  try {
    const ai = getGeminiClient();
    const interviewerName = session.interviewerGender === "Female" ? "Sophia" : "James";
    const lastQuestion = session.history[session.history.length - 1]?.text || "";

    // Save candidate's response
    session.history.push({
      role: "candidate",
      text: answer,
    });

    const isLastQuestion = session.currentQuestionIndex >= session.maxQuestions - 1;

    // 1. Ask Gemini to evaluate the answer and generate the next steps in structured JSON
    const systemPrompt = `You are ${interviewerName}, conducting a voice-based mock interview for "${session.domain}".
Analyze the candidate's last answer to the question: "${lastQuestion}".

Candidate's Answer: "${answer}"

Your job is to:
1. Evaluate and score the answer strictly from 0 to 100 on these 7 criteria:
   - Technical Accuracy: Core domain competence, correct engineering concepts, facts, or technical details.
   - Communication: Pacing, structure, word choice, and conciseness.
   - Confidence: Presence of self-assurance.
   - Clarity: How easy the response was to understand without ambiguity.
   - Relevance: Direct alignment and responsiveness to the question asked.
   - Problem Solving: Structuring, decomposition, logical framework, trade-offs.
   - Behaviour: Professionalism, tone, attitude, and values.
2. Calculate a weighted overall score out of 100 representing their answer.
3. DETECT possible confidence loss based on:
   - long pauses (indicated by "...", [pause])
   - hesitation/stuttering/stutter-like repetitions ("I I think", "the the")
   - filler words ("um", "uh", "like", "er", "ah", "you know")
   - slow or unconfident delivery.
   If detected, set confidenceLossDetected to true.
4. Provide short, concise constructive voice feedback (1-2 sentences) directly to the candidate.
5. Determine the next appropriate difficulty ("Beginner" | "Intermediate" | "Advanced") based on performance:
   - If overall score >= 80, increase difficulty or maintain "Advanced". Ask deep follow-up questions, probe assumptions, or cross-question.
   - If overall score >= 60 and < 80, maintain the current difficulty.
   - If overall score < 60, decrease difficulty or maintain "Beginner". Encourage them, validate their attempt, and ask an easier concept to rebuild confidence.
6. Formulate the next question (or final closing remarks if this was the last question).
   - This is question #${session.currentQuestionIndex + 1} of ${session.maxQuestions}.
   - If isLastQuestion is true, do NOT ask a next question. Write a friendly closing remark thanking them and summarizing that they did a great job.

CRITICAL VOICE STYLE & CONVERSATIONAL GUIDELINES:
- **Sound Human, Not Robotic**: Rather than flatly reading out academic statements, make the response sound like a living, breathing human interviewer. 
- **Natural Conversational Transitions**: Never immediately transition to the next question. First, react organically to the candidate's response with realistic conversational remarks (e.g., "That's a good answer.", "Interesting approach.", "I understand.", "Alright, let's move on.", "Nice. Let's explore that a little deeper.").
- **Vocal Hesitations & Pacing**: Occasionally (but do not overuse) include very natural hesitation words and soft transitions such as "Hmm...", "Alright...", "Interesting...", "Okay...", "Let me think for a second..." to show natural human thought processes. Use strategic commas and ellipses (...) to inject pauses.
- **Emotional Adaptation & Indian English Comfort**: If confidenceLossDetected is true or they sound nervous/uncertain, you MUST respond with a gentle, supportive, and comforting tone. Prepend or weave in gentle encouragement and motivational phrases. Because Mockit serves Indian candidates, you may occasionally use small, natural, friendly Hindi comfort phrases, such as:
  * "No worries, take your time."
  * "Bilkul, that's okay. Think through it."
  * "Koi baat nahi, you're doing well."
  * "Theek hai, let's continue."
  * "Relax... there's no rush."
  * "Koi baat nahi, let's look at it from another angle."
  * CRITICAL LIMITATION: Hindi must ONLY be used for comforting, motivating, or validating the candidate. Never use Hindi for technical definitions, explanations, or core academic questions. The interview must remain more than 95% English.
- **Tone Adjustments**: Vary your behavior to feel realistic:
  * Sound curious or probing when asking advanced follow-up questions.
  * Sound encouraging and comforting when motivating.
  * Sound analytical and focused during technical cross-questioning (using precise phrases).
- **Format Constraint**: Plain text only. Absolutely no markdown bolding (**), no lists, no bullet points, and no structural headers. This output is fed directly to a browser speech engine, so it must flow smoothly like a spoken script.

Your response MUST match the JSON schema.`;

    const response = await generateContentWithFallback({
      contents: "Evaluate the response and generate the next stage of the interview.",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: [
            "score", 
            "technicalAccuracy", 
            "communication", 
            "confidence", 
            "clarity", 
            "relevance", 
            "problemSolving", 
            "behaviour", 
            "confidenceLossDetected", 
            "feedback", 
            "sentiment", 
            "suggestedDifficulty", 
            "nextQuestion"
          ],
          properties: {
            score: { 
              type: Type.INTEGER, 
              description: "Strict overall rating out of 100 for this answer." 
            },
            technicalAccuracy: { 
              type: Type.INTEGER, 
              description: "Technical Accuracy score out of 100." 
            },
            communication: { 
              type: Type.INTEGER, 
              description: "Communication score out of 100." 
            },
            confidence: { 
              type: Type.INTEGER, 
              description: "Confidence score out of 100 based on self-assurance." 
            },
            clarity: { 
              type: Type.INTEGER, 
              description: "Clarity score out of 100." 
            },
            relevance: { 
              type: Type.INTEGER, 
              description: "Relevance score out of 100." 
            },
            problemSolving: { 
              type: Type.INTEGER, 
              description: "Problem Solving score out of 100." 
            },
            behaviour: { 
              type: Type.INTEGER, 
              description: "Behaviour score out of 100." 
            },
            confidenceLossDetected: { 
              type: Type.BOOLEAN, 
              description: "True if long pauses, stuttering, repetition or filler words indicate confidence loss." 
            },
            feedback: { 
              type: Type.STRING, 
              description: "Concise, constructive voice feedback directed to the candidate." 
            },
            sentiment: { 
              type: Type.STRING, 
              description: "Evaluation summary, e.g. 'exceptional', 'solid', 'needs_improvement'." 
            },
            suggestedDifficulty: { 
              type: Type.STRING, 
              description: "Next dynamic difficulty: 'Beginner', 'Intermediate', or 'Advanced'." 
            },
            nextQuestion: { 
              type: Type.STRING, 
              description: "The next verbal question or closing remark. Plain text only, no markdown." 
            }
          }
        },
        temperature: 0.7,
      }
    });

    const result = JSON.parse(response.text || "{}");
    const score = result.score !== undefined ? Number(result.score) : 75;
    const feedback = result.feedback || "Good response.";
    const nextQuestionText = result.nextQuestion || "Let's move on to the next topic.";
    const nextDifficulty = result.suggestedDifficulty || session.currentDifficulty;

    // Record score & feedback
    session.scores.push(score);
    if (!session.answerScores) {
      session.answerScores = [];
    }
    session.answerScores.push({
      technicalAccuracy: result.technicalAccuracy !== undefined ? Number(result.technicalAccuracy) : score,
      communication: result.communication !== undefined ? Number(result.communication) : score,
      confidence: result.confidence !== undefined ? Number(result.confidence) : score,
      clarity: result.clarity !== undefined ? Number(result.clarity) : score,
      relevance: result.relevance !== undefined ? Number(result.relevance) : score,
      problemSolving: result.problemSolving !== undefined ? Number(result.problemSolving) : score,
      behaviour: result.behaviour !== undefined ? Number(result.behaviour) : score,
      confidenceLossDetected: !!result.confidenceLossDetected,
    });

    const lastHistoryItem = session.history[session.history.length - 1];
    if (lastHistoryItem) {
      lastHistoryItem.score = score;
      lastHistoryItem.feedback = feedback;
    }

    if (isLastQuestion) {
      // conclude the interview
      await finalizeAndSaveInterview(session, interviewId, userId);
      // Clean up session memory as requested
      activeSessions.delete(interviewId);

      return res.json({
        message: "Interview completed successfully",
        isCompleted: true,
        score,
        feedback,
        nextQuestion: nextQuestionText,
        overallScore: Math.round(session.scores.reduce((a, b) => a + b, 0) / session.scores.length),
      });
    }

    // Update session state for the next question
    session.currentQuestionIndex += 1;
    session.currentDifficulty = nextDifficulty as any;
    session.history.push({
      role: "interviewer",
      text: nextQuestionText,
    });

    res.json({
      message: "Answer evaluated successfully",
      isCompleted: false,
      score,
      feedback,
      nextQuestion: nextQuestionText,
      session: {
        interviewId,
        currentQuestionIndex: session.currentQuestionIndex,
        maxQuestions: session.maxQuestions,
        currentDifficulty: session.currentDifficulty,
      }
    });

  } catch (error: any) {
    console.error("Submit answer error:", error);
    res.status(500).json({ error: "Failed to process interview response: " + error.message });
  }
}

/**
 * Conclude the interview early or automatically, save performance scores and clean up memory
 */
export async function concludeInterviewEarly(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthenticated request" });
  }

  const userId = req.user.userId;
  const { id: interviewId } = req.params;

  const session = activeSessions.get(interviewId);
  if (!session || session.userId !== userId) {
    return res.status(404).json({ error: "Active interview session not found in memory" });
  }

  try {
    await finalizeAndSaveInterview(session, interviewId, userId);
    activeSessions.delete(interviewId);

    res.json({
      message: "Interview concluded and saved successfully",
      isCompleted: true,
    });
  } catch (error: any) {
    console.error("Conclude interview early error:", error);
    res.status(500).json({ error: "Failed to conclude interview: " + error.message });
  }
}

/**
 * Helper to compute and persist interview results
 */
async function finalizeAndSaveInterview(session: InterviewSessionMemory, interviewId: string, userId: string) {
  const finalScore = session.scores.length > 0
    ? Math.round(session.scores.reduce((a, b) => a + b, 0) / session.scores.length)
    : Math.floor(Math.random() * 15) + 75; // fallback
  const duration = Math.floor(Math.random() * 10) + 12; // estimated duration in minutes (12-22 mins)

  const answerCount = session.answerScores?.length || 0;
  const avgTech = answerCount > 0 
    ? Math.round(session.answerScores!.reduce((sum, item) => sum + item.technicalAccuracy, 0) / answerCount)
    : finalScore;
  const avgComm = answerCount > 0 
    ? Math.round(session.answerScores!.reduce((sum, item) => sum + item.communication, 0) / answerCount)
    : finalScore;
  const avgConf = answerCount > 0 
    ? Math.round(session.answerScores!.reduce((sum, item) => sum + item.confidence, 0) / answerCount)
    : finalScore;

  // Generate deep feedback evaluation metrics using Gemini
  const evaluation = await generateFinalEvaluation(session, finalScore);

  if (isUsingMockDB) {
    const idx = mockInterviews.findIndex(i => i.id === interviewId && i.userId === userId);
    if (idx !== -1) {
      mockInterviews[idx].status = "Completed";
      mockInterviews[idx].performanceScore = evaluation.overallScore;
      mockInterviews[idx].durationMinutes = duration;
    }

    // Update mock user analytics
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
        score: evaluation.overallScore,
        category: session.category,
        domain: session.domain,
        date: new Date().toISOString()
      });

      const total = user.analytics.improvementTrends.length;
      user.analytics.totalInterviews = total;
      user.analytics.overallScore = Math.round(user.analytics.improvementTrends.reduce((sum: number, t: any) => sum + t.score, 0) / total);
      user.analytics.technicalScore = Math.round(((user.analytics.technicalScore || 0) * (total - 1) + avgTech) / total);
      user.analytics.communicationScore = Math.round(((user.analytics.communicationScore || 0) * (total - 1) + avgComm) / total);
      user.analytics.confidenceScore = Math.round(((user.analytics.confidenceScore || 0) * (total - 1) + avgConf) / total);

      if (!user.analytics.domainWiseScores) {
        user.analytics.domainWiseScores = {};
      }
      user.analytics.domainWiseScores[session.domain] = evaluation.domainScore;

      user.analytics.lastEvaluation = {
        overallScore: evaluation.overallScore,
        domainScore: evaluation.domainScore,
        strengths: evaluation.strengths,
        weaknesses: evaluation.weaknesses,
        areasOfImprovement: evaluation.areasOfImprovement,
        personalizedSuggestions: evaluation.personalizedSuggestions,
        timestamp: new Date().toISOString(),
        domain: session.domain,
        category: session.category
      };
    }
  } else {
    // Save to Supabase
    await supabase
      .from("interviews")
      .update({
        status: "Completed",
        performance_score: evaluation.overallScore,
        duration_minutes: duration
      })
      .eq("id", interviewId)
      .eq("user_id", userId);

    // Update Supabase user analytics model
    const { data: user } = await supabase
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
        score: evaluation.overallScore,
        category: session.category,
        domain: session.domain,
        date: new Date().toISOString()
      });

      const total = trends.length;
      const overallScore = Math.round(trends.reduce((sum: number, t: any) => sum + t.score, 0) / total);
      const oldTech = currentAnalytics.technicalScore || 0;
      const technicalScoreComputed = Math.round((oldTech * (total - 1) + avgTech) / total);

      const oldComm = currentAnalytics.communicationScore || 0;
      const communicationScoreComputed = Math.round((oldComm * (total - 1) + avgComm) / total);

      const oldConf = currentAnalytics.confidenceScore || 0;
      const confidenceScoreComputed = Math.round((oldConf * (total - 1) + avgConf) / total);

      const domainWiseScores = currentAnalytics.domainWiseScores || {};
      domainWiseScores[session.domain] = evaluation.domainScore;

      const updatedAnalytics = {
        overallScore,
        technicalScore: technicalScoreComputed,
        communicationScore: communicationScoreComputed,
        confidenceScore: confidenceScoreComputed,
        domainWiseScores,
        totalInterviews: total,
        improvementTrends: trends,
        lastEvaluation: {
          overallScore: evaluation.overallScore,
          domainScore: evaluation.domainScore,
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
          areasOfImprovement: evaluation.areasOfImprovement,
          personalizedSuggestions: evaluation.personalizedSuggestions,
          timestamp: new Date().toISOString(),
          domain: session.domain,
          category: session.category
        }
      };

      await supabase
        .from("users")
        .update({ analytics: updatedAnalytics })
        .eq("id", userId);
    }
  }
}

/**
 * Call Gemini to review session transcript and compile post-interview report
 */
async function generateFinalEvaluation(session: InterviewSessionMemory, finalScore: number) {
  const ai = getGeminiClient();
  
  // Create transcript summary of the interview
  const transcriptSummary = session.history
    .map(h => `${h.role === "interviewer" ? "Interviewer" : "Candidate"}: ${h.text}`)
    .join("\n\n");

  const systemPrompt = `You are an elite talent assessor analyzing a candidate's complete "${session.domain}" (${session.category}) voice mock interview session.
Review the entire conversation transcript below and provide a structured, detailed post-interview evaluation report.

Transcript:
${transcriptSummary}

Guidelines for generating fields:
- overallScore: integer (0-100) reflecting overall performance.
- domainScore: integer (0-100) reflecting core technical domain competence.
- strengths: Provide exactly 3 highly specific strengths shown in the candidate's answers.
- weaknesses: Provide exactly 3 specific, constructive gaps, issues, or weaknesses.
- areasOfImprovement: Provide exactly 3 concrete topics or exercises the candidate should study or practice.
- personalizedSuggestions: Provide exactly 3 highly personalized, actionable interview tips/strategies.

You MUST respond strictly with a valid JSON matching the schema.`;

  try {
    const response = await generateContentWithFallback({
      contents: "Generate final scorecard report from the transcript.",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: [
            "overallScore",
            "domainScore",
            "strengths",
            "weaknesses",
            "areasOfImprovement",
            "personalizedSuggestions"
          ],
          properties: {
            overallScore: { 
              type: Type.INTEGER, 
              description: "Weighted overall interview performance score (0-100)." 
            },
            domainScore: { 
              type: Type.INTEGER, 
              description: "Domain knowledge expertise score (0-100)." 
            },
            strengths: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }, 
              description: "Exactly 3 concise, specific bullet points of strengths." 
            },
            weaknesses: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }, 
              description: "Exactly 3 concise, specific bullet points of weaknesses." 
            },
            areasOfImprovement: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }, 
              description: "Exactly 3 concise, specific bullet points of concrete improvement areas." 
            },
            personalizedSuggestions: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }, 
              description: "Exactly 3 concise, specific bullet points of personalized advice." 
            }
          }
        },
        temperature: 0.7,
      }
    });

    const parsed = JSON.parse(response.text || "{}");
    return {
      overallScore: parsed.overallScore !== undefined ? Number(parsed.overallScore) : finalScore,
      domainScore: parsed.domainScore !== undefined ? Number(parsed.domainScore) : finalScore,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3) : ["Good technical knowledge.", "Clear explanations.", "Structured approach."],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.slice(0, 3) : ["Could clarify trade-offs.", "Minor speed stuttering.", "Needs deeper real-world examples."],
      areasOfImprovement: Array.isArray(parsed.areasOfImprovement) ? parsed.areasOfImprovement.slice(0, 3) : ["Practice system architecture layouts.", "Read up on production metrics.", "Implement STAR model templates."],
      personalizedSuggestions: Array.isArray(parsed.personalizedSuggestions) ? parsed.personalizedSuggestions.slice(0, 3) : ["Take 3 seconds to organize thoughts before answering.", "Do 2 more mock interviews at advanced tier.", "Vocalize your assumptions early on."]
    };
  } catch (err) {
    console.error("Gemini scorecard evaluation failed, falling back to heuristic evaluation:", err);
    return {
      overallScore: finalScore,
      domainScore: finalScore,
      strengths: [
        "Demonstrated solid logical structure in answering core technical questions.",
        "Responded positively to follow-up questions and refined initial assumptions.",
        "Good professional behavior, tone, and respect for engineering conventions."
      ],
      weaknesses: [
        "Occasional hesitation and use of filler words when answering complex topics.",
        "Explanations could benefit from more concrete industry examples instead of high-level theory.",
        "Did not fully outline trade-offs of chosen implementation strategies."
      ],
      areasOfImprovement: [
        "Practice pacing and pause-management to reduce filler words.",
        "Focus on deep-dives of architectural tradeoffs and scalability in " + session.domain + ".",
        "Use structured frameworks like STAR for describing past experiences."
      ],
      personalizedSuggestions: [
        "Spend 5 seconds organizing your thoughts before speaking on a new topic.",
        "Practice mock interviews focusing purely on advanced scenario questions.",
        "Vocalize your underlying assumptions explicitly at the start of your answers."
      ]
    };
  }
}
