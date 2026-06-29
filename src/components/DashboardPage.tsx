import React, { useEffect, useState } from "react";
import { 
  Brain, 
  Calendar, 
  TrendingUp, 
  Clock, 
  Award, 
  Zap, 
  ArrowRight, 
  LogOut, 
  Plus, 
  Loader2, 
  CheckCircle2, 
  Flame, 
  User, 
  Sparkles,
  ChevronRight,
  AlertCircle,
  Mic,
  Activity,
  Sliders,
  Target
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { DashboardData, InterviewSession } from "../types";

interface DashboardPageProps {
  token: string;
  onNavigate: (page: any) => void;
  onLogout: () => void;
  onStartInterview: (interviewId: string) => void;
}

export default function DashboardPage({ token, onNavigate, onLogout, onStartInterview }: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    try {
      setError(null);
      const response = await fetch("/api/dashboard", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.status === 401 || response.status === 403) {
        onLogout();
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to retrieve dashboard analytics");
      }
      const resData = await response.json();
      setData(resData);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while loading your profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  // Allows mock completion of scheduled setup interviews to demo dynamic stats live!
  const handleMockComplete = async (interviewId: string) => {
    setActionLoadingId(interviewId);
    try {
      // Simulate with a random high-quality score
      const randomScore = Math.floor(Math.random() * 20) + 78; // 78 to 98
      const response = await fetch(`/api/interviews/${interviewId}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ score: randomScore })
      });

      if (!response.ok) {
        throw new Error("Could not update interview status");
      }
      
      // Re-fetch database stats
      await fetchDashboardData();
    } catch (err: any) {
      alert(err.message || "Failed to complete interview simulation");
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080d] flex items-center justify-center text-gray-100 font-sans" id="dashboard-loading">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
          <p className="text-gray-400 text-sm font-medium animate-pulse">Analyzing stats & synchronizing secure session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080d] text-gray-100 font-sans pb-16 animate-fade-in" id="dashboard-root">
      
      {/* Upper Navigation Rail */}
      <nav className="bg-[#0b0c13] border-b border-white/5 py-4 px-6 md:px-12 sticky top-0 z-40 backdrop-blur-md bg-opacity-90" id="dashboard-nav">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate("landing")}>
            <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 p-2 rounded-xl shadow-md">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-extrabold text-xl tracking-tight text-white">Mockit</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg text-xs font-mono text-gray-400">
              <User className="w-3.5 h-3.5 text-purple-400" />
              <span>{data?.userName}</span>
            </div>
            
            <button 
              id="btn-dash-logout"
              onClick={onLogout}
              className="text-gray-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/5 p-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 text-sm font-medium"
              title="Log Out"
            >
              <LogOut className="w-4 h-4 text-red-400" />
              <span className="hidden sm:inline">Log Out</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 pt-10" id="dashboard-content">
        
        {/* Welcome Block */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10" id="dashboard-welcome">
          <div>
            <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full text-purple-400 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              Candidate Workspace Active
            </div>
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
              Welcome, {data?.userName}!
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              Analyze your performance scorecard and configure your next mock scenario.
            </p>
          </div>

          <button
            id="btn-dash-start-setup"
            onClick={() => onNavigate("setup")}
            className="group flex items-center gap-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold px-6 py-3.5 rounded-xl shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20 transition-all duration-300 cursor-pointer active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            Start Mock Interview
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm mb-8" id="dashboard-error-alert">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Analytics Section Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12" id="dashboard-analytics-grid">
          
          {/* Card 1: Completed */}
          <div className="bg-[#0f111a] border border-white/5 p-6 rounded-2xl flex items-center justify-between hover:border-white/10 transition-colors">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Interviews Completed
              </span>
              <span className="font-display font-black text-3xl text-white">
                {data?.stats.interviewsCompleted}
              </span>
              <span className="text-[10px] text-gray-400 block mt-1">
                All scheduled trials logged
              </span>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/20 p-3.5 rounded-xl text-purple-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2: Average Score */}
          <div className="bg-[#0f111a] border border-white/5 p-6 rounded-2xl flex items-center justify-between hover:border-white/10 transition-colors">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Average Score
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display font-black text-3xl text-white">
                  {data?.stats.averageScore ? `${data.stats.averageScore}%` : "N/A"}
                </span>
                {data?.stats.averageScore ? (
                  <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    Good
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] text-gray-400 block mt-1">
                Target performance: 80%+
              </span>
            </div>
            <div className="bg-indigo-500/10 border border-indigo-500/20 p-3.5 rounded-xl text-indigo-400">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3: Hours Practiced */}
          <div className="bg-[#0f111a] border border-white/5 p-6 rounded-2xl flex items-center justify-between hover:border-white/10 transition-colors">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Hours Practiced
              </span>
              <span className="font-display font-black text-3xl text-white">
                {data?.stats.hoursPracticed}h
              </span>
              <span className="text-[10px] text-gray-400 block mt-1">
                Time spent in AI sandbox
              </span>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 p-3.5 rounded-xl text-amber-400">
              <Clock className="w-6 h-6" />
            </div>
          </div>

          {/* Card 4: Global Rank */}
          <div className="bg-[#0f111a] border border-white/5 p-6 rounded-2xl flex items-center justify-between hover:border-white/10 transition-colors">
            <div>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Platform Standings
              </span>
              <span className="font-display font-black text-3xl text-white">
                {data?.stats.globalRank}
              </span>
              <span className="text-[10px] text-gray-400 block mt-1">
                Based on communication metrics
              </span>
            </div>
            <div className="bg-pink-500/10 border border-pink-500/20 p-3.5 rounded-xl text-pink-400">
              <Award className="w-6 h-6" />
            </div>
          </div>

        </section>

        {/* VISUAL PERFORMANCE ANALYTICS SECTION */}
        <section className="mb-12" id="dashboard-visual-analytics">
          <div className="bg-[#0f111a] border border-white/5 rounded-3xl p-6 md:p-8 flex flex-col gap-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
              <div>
                <h2 className="font-display font-extrabold text-2xl text-white tracking-tight flex items-center gap-2.5">
                  <Activity className="w-5.5 h-5.5 text-purple-400" />
                  Interactive Performance Sandbox
                </h2>
                <p className="text-gray-400 text-xs mt-1">
                  Track real-time trends, communication ratings, and adaptive difficulty standings across practice tracks.
                </p>
              </div>

              {/* Quick Summary Pill */}
              <div className="flex items-center gap-2 bg-[#07080d] border border-white/5 px-3 py-1.5 rounded-full text-xs text-gray-400">
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-ping" />
                <span>Live Metrics Feed</span>
              </div>
            </div>

            {/* Core Bento Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Box 1: Score, Confidence & Communication Trends (AreaChart) */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-sm text-gray-200 tracking-wide uppercase">
                    Competency Growth Timeline
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono">
                    <span className="flex items-center gap-1.5 text-purple-400 font-semibold">
                      <span className="w-2 h-2 bg-purple-500 rounded-full" />
                      Overall Score
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                      Confidence Level
                    </span>
                    <span className="flex items-center gap-1.5 text-indigo-400 font-semibold">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full" />
                      Communication Quality
                    </span>
                  </div>
                </div>

                <div className="bg-[#07080d] border border-white/5 p-5 rounded-2xl h-[260px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data?.analytics?.improvementTrends || []}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="scoreGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="confidenceGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="communicationGlow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff03" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 100]}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "#0b0c13", 
                          borderColor: "rgba(255,255,255,0.08)", 
                          borderRadius: "12px",
                          fontSize: "11px",
                          color: "#fff"
                        }} 
                      />
                      <Area 
                        type="monotone" 
                        dataKey="score" 
                        stroke="#a855f7" 
                        strokeWidth={2.5} 
                        fillOpacity={1} 
                        fill="url(#scoreGlow)" 
                        name="Overall Score"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="confidence" 
                        stroke="#10b981" 
                        strokeWidth={1.5} 
                        fillOpacity={1} 
                        fill="url(#confidenceGlow)" 
                        name="Confidence"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="communication" 
                        stroke="#6366f1" 
                        strokeWidth={1.5} 
                        fillOpacity={1} 
                        fill="url(#communicationGlow)" 
                        name="Communication"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Box 2: Domain-wise Performance & Skill Progressions */}
              <div className="lg:col-span-1 flex flex-col gap-4">
                <h3 className="font-display font-bold text-sm text-gray-200 tracking-wide uppercase">
                  Domain Performance Breakdown
                </h3>
                
                <div className="bg-[#07080d] border border-white/5 p-5 rounded-2xl flex flex-col justify-between flex-grow gap-4">
                  <div className="space-y-4">
                    {data?.analytics?.domainWiseScores && Object.entries(data.analytics.domainWiseScores).map(([domainName, scoreValue]) => (
                      <div key={domainName} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-300 font-medium">{domainName}</span>
                          <span className="font-mono text-purple-400 font-bold">{scoreValue}%</span>
                        </div>
                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-1000"
                            style={{ width: `${scoreValue}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-gray-500 italic text-center leading-relaxed mt-2">
                    These ratings adapt dynamically as Sophia and the AI evaluation engine track your progress.
                  </p>
                </div>
              </div>

            </div>

            {/* Row 3: Skill Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 border-t border-white/5 pt-6">
              
              {/* Skill 1: Technical Accuracy */}
              <div className="bg-[#07080d] border border-white/5 p-5 rounded-2xl hover:border-purple-500/20 transition-all flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-purple-500/10 text-purple-400 p-2 rounded-xl">
                      <Sliders className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Technical Depth</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                    {data?.analytics?.technicalScore}%
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Measures architectural structure, Big-O metrics compliance, and clean modular pattern explanation.
                </p>
                <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10 inline-block self-start mt-auto">
                  ✓ Advancing Competency
                </span>
              </div>

              {/* Skill 2: Communication Quality */}
              <div className="bg-[#07080d] border border-white/5 p-5 rounded-2xl hover:border-indigo-500/20 transition-all flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-indigo-500/10 text-indigo-400 p-2 rounded-xl">
                      <Mic className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Communication Clarity</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full">
                    {data?.analytics?.communicationScore}%
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Evaluates use of the STAR framework, structural delivery pacing, and vocabulary appropriateness.
                </p>
                <span className="text-[10px] text-indigo-400 font-medium bg-indigo-500/5 px-2 py-1 rounded border border-indigo-500/10 inline-block self-start mt-auto">
                  ✓ Highly Eloquent
                </span>
              </div>

              {/* Skill 3: Vocal Confidence */}
              <div className="bg-[#07080d] border border-white/5 p-5 rounded-2xl hover:border-pink-500/20 transition-all flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="bg-pink-500/10 text-pink-400 p-2 rounded-xl">
                      <Target className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Vocal Confidence</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-full">
                    {data?.analytics?.confidenceScore}%
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Tracks low latency response delivery, avoidance of filler words (e.g. "uh", "um"), and steady articulation.
                </p>
                <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10 inline-block self-start mt-auto">
                  ✓ High Delivery Pace
                </span>
              </div>

            </div>

          </div>
        </section>

        {/* Latest AI Evaluation Scorecard */}
        {data?.lastEvaluation && (
          <section className="bg-gradient-to-b from-[#111322] to-[#0f111a] border border-purple-500/15 rounded-3xl p-6 md:p-8 mb-12 relative overflow-hidden" id="dashboard-last-evaluation">
            <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-6 mb-6">
              <div>
                <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full text-purple-400 text-xs font-semibold mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  Latest AI Evaluation Scorecard
                </div>
                <h2 className="font-display font-extrabold text-2xl text-white tracking-tight">
                  {data.lastEvaluation.domain} Assessment Report
                </h2>
                <p className="text-gray-400 text-xs mt-1">
                  Category: <span className="text-gray-300 font-medium">{data.lastEvaluation.category}</span> • Evaluated on {new Date(data.lastEvaluation.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="bg-[#07080d] border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center min-w-[100px]">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Overall Score</span>
                  <span className="font-display font-black text-3xl text-purple-400">
                    {data.lastEvaluation.overallScore}%
                  </span>
                </div>
                <div className="bg-[#07080d] border border-white/5 p-4 rounded-2xl flex flex-col items-center justify-center min-w-[100px]">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mb-1">Domain Score</span>
                  <span className="font-display font-black text-3xl text-indigo-400">
                    {data.lastEvaluation.domainScore}%
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {/* Strengths */}
              <div className="bg-[#07080d]/50 border border-white/5 rounded-2xl p-5 hover:border-emerald-500/10 transition-colors">
                <h3 className="font-display font-bold text-sm text-emerald-400 flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-4 h-4" />
                  Key Strengths
                </h3>
                <ul className="space-y-3">
                  {data.lastEvaluation.strengths.map((str, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-xs text-gray-300 leading-relaxed">
                      <span className="bg-emerald-500/10 text-emerald-400 p-0.5 rounded-full mt-0.5 flex-shrink-0">✓</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Weaknesses */}
              <div className="bg-[#07080d]/50 border border-white/5 rounded-2xl p-5 hover:border-red-500/10 transition-colors">
                <h3 className="font-display font-bold text-sm text-red-400 flex items-center gap-2 mb-4">
                  <AlertCircle className="w-4 h-4" />
                  Areas to Address
                </h3>
                <ul className="space-y-3">
                  {data.lastEvaluation.weaknesses.map((weak, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-xs text-gray-300 leading-relaxed">
                      <span className="bg-red-500/10 text-red-400 px-1 py-0.5 rounded text-[9px] font-bold mt-0.5 flex-shrink-0">⚠️</span>
                      <span>{weak}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Areas of Improvement */}
              <div className="bg-[#07080d]/50 border border-white/5 rounded-2xl p-5 hover:border-purple-500/10 transition-colors">
                <h3 className="font-display font-bold text-sm text-purple-400 flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4" />
                  Areas of Improvement
                </h3>
                <ul className="space-y-3">
                  {data.lastEvaluation.areasOfImprovement.map((imp, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-xs text-gray-300 leading-relaxed">
                      <span className="bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded text-[9px] font-bold mt-0.5 flex-shrink-0">Focus</span>
                      <span>{imp}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Personalized Suggestions */}
              <div className="bg-[#07080d]/50 border border-white/5 rounded-2xl p-5 hover:border-indigo-500/10 transition-colors">
                <h3 className="font-display font-bold text-sm text-indigo-400 flex items-center gap-2 mb-4">
                  <Flame className="w-4 h-4" />
                  Personalized Suggestions
                </h3>
                <ul className="space-y-3">
                  {data.lastEvaluation.personalizedSuggestions.map((sug, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-xs text-gray-300 leading-relaxed">
                      <span className="bg-indigo-500/10 text-indigo-400 p-0.5 rounded-full mt-0.5 flex-shrink-0">★</span>
                      <span>{sug}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* Dashboard Split Sections */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8" id="dashboard-sections">
          
          {/* Left Column - Custom Session List & Scheduler (2 Cols on desktop) */}
          <div className="lg:col-span-2 flex flex-col gap-8">
            
            {/* Interview Configurations / Sessions */}
            <div className="bg-[#0f111a] border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-display font-bold text-xl text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-400" />
                    Interview Configurations
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Manage and run configured scenarios.
                  </p>
                </div>
                
                <span className="text-xs bg-white/5 px-3 py-1 rounded-full border border-white/5 font-mono text-gray-400">
                  {data?.interviews.length || 0} Saved
                </span>
              </div>

              {/* Configurations List */}
              {(!data || data.interviews.length === 0) ? (
                <div className="flex flex-col items-center justify-center text-center py-12 border border-dashed border-white/5 rounded-xl" id="no-interviews-placeholder">
                  <div className="bg-white/5 p-4 rounded-full text-gray-500 mb-4">
                    <Brain className="w-8 h-8" />
                  </div>
                  <h4 className="font-semibold text-white mb-1">No setups created yet</h4>
                  <p className="text-gray-400 text-xs max-w-sm leading-relaxed mb-6">
                    Configure your specialized domain parameters (Software Engineering, PM, behavioral, etc.) and launch your AI assessment session.
                  </p>
                  <button
                    id="btn-dash-create-first-setup"
                    onClick={() => onNavigate("setup")}
                    className="flex items-center gap-2 bg-white hover:bg-gray-100 text-slate-950 font-semibold px-4 py-2.5 rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Setup First Interview
                  </button>
                </div>
              ) : (
                <div className="space-y-4" id="interviews-list">
                  {data.interviews.map((session) => (
                    <div 
                      key={session.id} 
                      className="bg-[#07080d] border border-white/5 rounded-xl p-5 hover:border-white/10 transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-xl flex items-center justify-center ${
                          session.category === "Technical" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}>
                          <Zap className="w-5 h-5" />
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <h4 className="font-bold text-white text-base">
                              {session.domain}
                            </h4>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              session.difficulty === "Advanced" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                              session.difficulty === "Intermediate" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                              "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                            }`}>
                              {session.difficulty}
                            </span>
                            <span className="text-[10px] bg-white/5 border border-white/10 text-gray-300 px-2 py-0.5 rounded-full">
                              Interviewer: {session.interviewerGender}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{session.category}</span>
                            <span>•</span>
                            <span>{new Date(session.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status / Simulated Call button */}
                      <div className="flex items-center gap-3 self-end sm:self-center w-full sm:w-auto justify-end">
                        {session.status === "In Progress" ? (
                          <div className="flex items-center gap-2.5 flex-wrap justify-end">
                            <button
                              id={`btn-dash-resume-${session.id}`}
                              onClick={() => onStartInterview(session.id)}
                              className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold px-4.5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md active:scale-[0.98] cursor-pointer"
                            >
                              <Mic className="w-3.5 h-3.5" />
                              Resume Interview
                            </button>
                          </div>
                        ) : session.status === "Scheduled" ? (
                          <div className="flex items-center gap-2.5 flex-wrap justify-end">
                            <button
                              id={`btn-dash-start-voice-${session.id}`}
                              onClick={() => onStartInterview(session.id)}
                              className="bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-4.5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md shadow-purple-500/10 active:scale-[0.98] cursor-pointer animate-pulse-subtle"
                              title="Start highly interactive voice-based AI assessment"
                            >
                              <Mic className="w-3.5 h-3.5 text-purple-200" />
                              Start Voice Interview
                            </button>

                            <button
                              id={`btn-dash-complete-${session.id}`}
                              disabled={actionLoadingId !== null}
                              onClick={() => handleMockComplete(session.id)}
                              className="bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5 px-4.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                              title="Mock complete this interview to generate instant scorecards"
                            >
                              {actionLoadingId === session.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                              Simulate Complete
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[11px] text-gray-400 uppercase font-bold tracking-wider">
                              Score Awarded
                            </span>
                            <span className="font-display font-extrabold text-lg text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                              {session.performanceScore || 0}%
                            </span>
                          </div>
                        )}
                      </div>

                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>

          {/* Right Column - Recommendations / Analytics (1 Col on desktop) */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            
            {/* AI Recommendation Panel */}
            <div className="bg-[#0f111a] border border-white/5 rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="bg-purple-500/10 border border-purple-500/20 p-2 rounded-xl text-purple-400">
                  <Brain className="w-5 h-5" />
                </div>
                <h3 className="font-display font-bold text-lg text-white">
                  Recent Improvements
                </h3>
              </div>
              <p className="text-xs text-gray-400 mb-6">
                Personalized directives identified by our AI evaluation agents.
              </p>

              <div className="space-y-4" id="improvements-list">
                {data?.improvements.map((imp) => (
                  <div 
                    key={imp.id} 
                    className="bg-[#07080d] border border-white/5 rounded-xl p-4 hover:border-purple-500/10 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] bg-purple-500/10 border border-purple-500/25 text-purple-400 font-mono px-2 py-0.5 rounded-full font-semibold">
                        {imp.domain}
                      </span>
                      <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-md font-bold ${
                        imp.impact === "High" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      }`}>
                        {imp.impact} Impact
                      </span>
                    </div>
                    
                    <h4 className="font-bold text-white text-sm mb-1">
                      {imp.title}
                    </h4>
                    
                    <p className="text-gray-400 text-xs leading-relaxed">
                      {imp.description}
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-500">
                      <span>Category: {imp.category}</span>
                      <a href="#" className="text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1">
                        Review Model Answers
                        <ChevronRight className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Tips Box */}
            <div className="bg-gradient-to-tr from-purple-950/20 to-[#0f111a] border border-purple-500/15 rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center gap-2 text-purple-400 font-semibold mb-3 text-sm">
                <Flame className="w-4 h-4" />
                <span>Weekly Streak Booster</span>
              </div>
              <p className="text-gray-300 text-xs leading-relaxed mb-4">
                You are on a <strong>3-day streak</strong>! Practicing consistently for just 15 minutes a day doubles your retention rate and reduces communication hesitations by up to 40%.
              </p>
              <div className="text-[11px] text-purple-300 font-semibold flex items-center gap-1.5 cursor-pointer hover:text-purple-200 transition-colors" onClick={() => onNavigate("setup")}>
                Schedule tomorrow's practice
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>

          </div>

        </section>

      </main>

    </div>
  );
}
