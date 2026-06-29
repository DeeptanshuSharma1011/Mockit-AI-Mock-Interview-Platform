import React from "react";
import { Page } from "../types";
import { 
  Brain, 
  Sparkles, 
  TrendingUp, 
  ArrowRight, 
  Zap, 
  Award, 
  ShieldCheck, 
  MessageSquare,
  Clock,
  Terminal,
  Cpu
} from "lucide-react";

interface LandingPageProps {
  onNavigate: (page: Page) => void;
  isAuthenticated: boolean;
}

export default function LandingPage({ onNavigate, isAuthenticated }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#07080d] text-gray-100 flex flex-col font-sans animate-fade-in" id="landing-page-root">
      
      {/* Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#07080d]/80 border-b border-white/5 py-4 px-6 md:px-12 transition-all" id="landing-nav">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate("landing")}>
            <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-purple-500/20 flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-extrabold text-2xl tracking-tight bg-gradient-to-r from-white via-gray-100 to-purple-400 bg-clip-text text-transparent">
              Mockit
            </span>
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <button 
                id="btn-nav-dashboard"
                onClick={() => onNavigate("dashboard")}
                className="group flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium px-5 py-2.5 rounded-xl shadow-lg shadow-purple-500/20 transition-all duration-300 hover:shadow-purple-500/30 cursor-pointer active:scale-[0.98]"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            ) : (
              <>
                <button 
                  id="btn-nav-login"
                  onClick={() => onNavigate("login")}
                  className="text-gray-400 hover:text-white font-medium px-4 py-2 transition-colors cursor-pointer"
                >
                  Log In
                </button>
                <button 
                  id="btn-nav-signup"
                  onClick={() => onNavigate("signup")}
                  className="bg-white/10 hover:bg-white/15 border border-white/10 text-white font-medium px-5 py-2.5 rounded-xl transition-all cursor-pointer active:scale-[0.98]"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 px-6 md:px-12 max-w-7xl mx-auto w-full text-center overflow-hidden" id="hero-section">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 -translate-x-1/2 w-[300px] h-[300px] bg-indigo-600/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-1.5 rounded-full text-purple-400 text-sm font-semibold mb-6 shadow-sm shadow-purple-500/5 select-none animate-pulse">
            <Sparkles className="w-4 h-4" />
            Empowered by Next-Gen Conversational AI
          </div>

          <h1 className="font-display font-black text-4xl sm:text-6xl md:text-7xl tracking-tight leading-[1.1] mb-6 text-white text-center">
            Master the Interview.<br/>
            <span className="bg-gradient-to-r from-purple-400 via-indigo-400 to-pink-400 bg-clip-text text-transparent">
              Secure the Offer.
            </span>
          </h1>

          <p className="text-gray-400 text-lg sm:text-xl max-w-2xl leading-relaxed mb-10 text-center">
            Mockit uses state-of-the-art conversational AI to simulate hyper-realistic technical and non-technical interviews. Get direct feedback, granular analytics, and precise insights to land your dream role.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center w-full max-w-md">
            <button 
              id="btn-hero-cta"
              onClick={() => onNavigate(isAuthenticated ? "setup" : "signup")}
              className="group w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:via-indigo-500 hover:to-indigo-600 text-white font-semibold text-base px-8 py-4 rounded-2xl shadow-xl shadow-purple-500/20 transition-all duration-300 hover:shadow-purple-500/35 cursor-pointer active:scale-[0.98]"
            >
              Start Free Mock Interview
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>
            <button 
              id="btn-hero-features"
              onClick={() => {
                document.getElementById("features-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 hover:text-white font-semibold text-base px-8 py-4 rounded-2xl transition-all cursor-pointer"
            >
              See How It Works
            </button>
          </div>

          {/* Interactive UI Mockup Card */}
          <div className="mt-16 w-full max-w-4xl bg-[#0f111a] border border-white/10 rounded-2xl p-2 md:p-4 shadow-2xl shadow-purple-500/5 relative group" id="hero-preview">
            <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/5 to-indigo-500/5 rounded-2xl pointer-events-none group-hover:opacity-100 transition-opacity" />
            <div className="bg-[#07080d] border border-white/5 rounded-xl overflow-hidden shadow-inner">
              
              {/* Fake App header */}
              <div className="bg-[#0b0c13] border-b border-white/5 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500/60" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <span className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <div className="bg-[#0f111a] border border-white/5 px-4 py-1.5 rounded-lg text-[11px] text-gray-500 font-mono tracking-wider w-1/3 text-center truncate">
                  mockit.ai/dashboard/session_71
                </div>
                <div className="w-8 h-4 bg-purple-500/20 rounded-full animate-pulse" />
              </div>

              {/* Fake App body */}
              <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                {/* Interviewer column */}
                <div className="md:col-span-1 bg-[#0f111a] border border-white/5 p-5 rounded-xl flex flex-col justify-between min-h-[220px]">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center font-display font-bold text-white shadow-md">
                        AI
                      </div>
                      <div>
                        <h4 className="font-semibold text-white text-sm">Eleanor (AI Interviewer)</h4>
                        <p className="text-purple-400 text-xs font-medium">Senior Staff Engineer</p>
                      </div>
                    </div>
                    <p className="text-gray-400 text-xs leading-relaxed italic bg-white/5 p-3 rounded-lg border border-white/5">
                      "Excellent. Can you describe how you would handle database replication lag in a high-traffic microservices environment?"
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-4">
                    <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                    <span>Live Conversation Active</span>
                  </div>
                </div>

                {/* Live Transcript Analysis column */}
                <div className="md:col-span-2 bg-[#0f111a] border border-white/5 p-5 rounded-xl flex flex-col justify-between min-h-[220px]">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-sm text-white flex items-center gap-1.5">
                        <Terminal className="w-4 h-4 text-emerald-400" />
                        Speech-to-Text & Instant Feedback
                      </h4>
                      <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono px-2 py-0.5 rounded-full uppercase">
                        AI Analyzing
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="bg-[#07080d] p-3 rounded-lg border border-white/5 text-xs text-gray-300">
                        <span className="text-indigo-400 font-semibold block mb-1">Your Response:</span>
                        "I would set up read replicas and put a Redis caching layer in front of the database to offload primary database traffic..."
                      </div>
                      <div className="bg-purple-500/5 p-3 rounded-lg border border-purple-500/10 text-xs text-purple-300 flex items-start gap-2">
                        <Cpu className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <strong className="block text-white mb-0.5">Mockit Recommendation:</strong>
                          Great mention of caching. Ensure you also explain handling consistency issues with redis eviction policies.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 md:px-12 bg-[#0a0c14] border-y border-white/5" id="features-section">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-white tracking-tight mb-4">
              Engineered for Enterprise-Grade Practice
            </h2>
            <p className="text-gray-400 text-base sm:text-lg">
              Designed by recruiting veterans and AI specialists, Mockit provides an industry-leading interview environment that actually replicates standard tech processes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-[#11131e] border border-white/5 p-8 rounded-2xl hover:border-purple-500/20 transition-all group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl w-fit text-purple-400 mb-6 group-hover:scale-110 transition-transform">
                <Brain className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-3">
                Intelligent Adaptive AI
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Our advanced interview agent listens to your answers, understands deep technical concepts, and asks logical, context-aware follow-up questions tailored directly to your explanations.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-[#11131e] border border-white/5 p-8 rounded-2xl hover:border-purple-500/20 transition-all group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl w-fit text-indigo-400 mb-6 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-3">
                Granular Scorecard Analytics
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Receive instant grades on custom criteria including technical depth, problem-solving, communication structure, and tone. Easily track your performance trajectory over time.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-[#11131e] border border-white/5 p-8 rounded-2xl hover:border-purple-500/20 transition-all group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="bg-pink-500/10 border border-pink-500/20 p-3 rounded-xl w-fit text-pink-400 mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-xl text-white mb-3">
                19+ Specialization Domains
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed">
                Whether you are gearing up for Frontend React, Backend Distributed Systems, Machine Learning Research, Product Management, or leadership roles, Mockit covers specialized pathways.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-24 px-6 md:px-12 max-w-7xl mx-auto w-full" id="how-it-works-section">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-display font-extrabold text-3xl sm:text-5xl text-white tracking-tight mb-4">
            How Mockit Prepares You
          </h2>
          <p className="text-gray-400 text-base sm:text-lg">
            A seamless, structured process that transforms anxiety into interview confidence in three simple steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          {/* Connector Line for Desktop */}
          <div className="hidden md:block absolute top-[68px] left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-purple-500/20 via-indigo-500/20 to-pink-500/20 z-0" />

          {/* Step 1 */}
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#11131e] border border-purple-500/20 flex items-center justify-center font-display font-bold text-lg text-purple-400 shadow-lg mb-6 shadow-purple-500/5">
              01
            </div>
            <h3 className="font-display font-bold text-lg text-white mb-2">Configure Setup</h3>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              Pick your interviewer gender, select from technical/non-technical domains, and choose your experience difficulty.
            </p>
          </div>

          {/* Step 2 */}
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#11131e] border border-indigo-500/20 flex items-center justify-center font-display font-bold text-lg text-indigo-400 shadow-lg mb-6 shadow-indigo-500/5">
              02
            </div>
            <h3 className="font-display font-bold text-lg text-white mb-2">Engage in Dialogue</h3>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              Have a real voice or text conversation with our human-like AI interviewer. Answer situational, architectural, or behavioral questions.
            </p>
          </div>

          {/* Step 3 */}
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#11131e] border border-pink-500/20 flex items-center justify-center font-display font-bold text-lg text-pink-400 shadow-lg mb-6 shadow-pink-500/5">
              03
            </div>
            <h3 className="font-display font-bold text-lg text-white mb-2">Get Actionable Scorecard</h3>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xs">
              Get an instant score with a point-by-point breakdown of strengths, grammar fixes, vocabulary optimizations, and suggested model answers.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 md:px-12 max-w-5xl mx-auto w-full mb-16" id="cta-section">
        <div className="bg-gradient-to-tr from-purple-900/40 via-indigo-900/40 to-slate-900/40 border border-purple-500/20 rounded-3xl p-8 md:p-16 text-center relative overflow-hidden shadow-2xl shadow-purple-500/5">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-purple-500/10 via-transparent to-transparent pointer-events-none" />
          
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="font-display font-extrabold text-3xl sm:text-4xl text-white mb-4">
              Ready to land your dream job?
            </h2>
            <p className="text-gray-300 text-sm sm:text-base leading-relaxed mb-8">
              Join thousands of software engineers, product managers, and specialists practicing on Mockit daily to refine their delivery, polish their communication, and unlock high-paying offers.
            </p>
            <button 
              id="btn-cta-start"
              onClick={() => onNavigate(isAuthenticated ? "setup" : "signup")}
              className="group inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-slate-950 font-bold px-8 py-4 rounded-xl shadow-lg transition-all duration-300 active:scale-[0.98] cursor-pointer"
            >
              Start Free Interview
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="mt-auto bg-[#05060a] border-t border-white/5 py-12 px-6 md:px-12 w-full text-center" id="landing-footer">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="bg-purple-600/20 p-2 rounded-lg">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-white">Mockit</span>
          </div>
          
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Mockit AI. All rights reserved. Built for engineering excellence and career growth.
          </p>

          <div className="flex items-center gap-6 text-xs text-gray-400">
            <a href="#" className="hover:text-purple-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-purple-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-purple-400 transition-colors">Support</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
