import React, { useState } from "react";
import { 
  Brain, 
  ArrowLeft, 
  ArrowRight, 
  User, 
  Users, 
  Zap, 
  Award, 
  CheckCircle2, 
  Loader2,
  Sliders,
  MessageSquare,
  ShieldCheck,
  Check
} from "lucide-react";

interface InterviewSetupPageProps {
  token: string;
  onNavigate: (page: any) => void;
  onStartInterview: (interviewId: string) => void;
}

const TECHNICAL_DOMAINS = [
  "Software Engineering",
  "Frontend Development",
  "Backend Development",
  "Full Stack Development",
  "System Design",
  "Artificial Intelligence",
  "Machine Learning",
  "Data Science",
  "DevOps",
  "Cloud Computing & Engineering",
  "Cybersecurity",
  "Product Engineering"
];

const NON_TECHNICAL_DOMAINS = [
  "HR Interview",
  "Behavioural Interview",
  "Leadership & Management",
  "Product Management",
  "Sales & Business Development",
  "Marketing & Strategy",
  "Communication & Soft Skills"
];

export default function InterviewSetupPage({ token, onNavigate, onStartInterview }: InterviewSetupPageProps) {
  const [gender, setGender] = useState<"Male" | "Female">("Female");
  const [category, setCategory] = useState<"Technical" | "Non Technical">("Technical");
  const [domain, setDomain] = useState<string>("");
  const [difficulty, setDifficulty] = useState<"Beginner" | "Intermediate" | "Advanced">("Intermediate");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Automatically pre-select a domain when the category switches to prevent mismatch
  const handleCategoryChange = (cat: "Technical" | "Non Technical") => {
    setCategory(cat);
    setDomain(""); // Reset domain so user explicitly chooses
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain) {
      setError("Please select a specific interview domain to proceed");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/interviews/setup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          interviewerGender: gender,
          category,
          domain,
          difficulty
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to configure interview scenario");
      }

      // Beautiful simulated wait for "AI Persona Customization"
      setTimeout(() => {
        if (data.interview && data.interview.id) {
          onStartInterview(data.interview.id);
        } else {
          onNavigate("dashboard");
        }
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while creating your setup");
      setLoading(false);
    }
  };

  const domainOptions = category === "Technical" ? TECHNICAL_DOMAINS : NON_TECHNICAL_DOMAINS;

  return (
    <div className="min-h-screen bg-[#07080d] text-gray-100 font-sans pb-24 relative overflow-hidden" id="setup-page-root">
      
      {/* Background radial glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Navigation header */}
      <nav className="bg-[#0b0c13] border-b border-white/5 py-4 px-6 md:px-12 sticky top-0 z-40 backdrop-blur-md bg-opacity-90" id="setup-nav">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate("dashboard")}>
            <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 p-2 rounded-xl shadow-md">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-extrabold text-xl tracking-tight text-white">Mockit</span>
          </div>

          <button
            id="btn-setup-nav-back"
            onClick={() => onNavigate("dashboard")}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl border border-white/5 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pt-12 relative z-10 animate-fade-in" id="setup-content">
        
        {/* Title Heading */}
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full text-purple-400 text-xs font-semibold mb-3">
            <Sliders className="w-3.5 h-3.5" />
            Interactive Interview Planner
          </div>
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl tracking-tight text-white">
            Configure Interview Parameters
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            Tailor your artificial intelligence assessor to fit your specialized sector and experience level.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm mb-8" id="setup-error-alert">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 rotate-180 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8" id="setup-form">
          
          {/* Step 1: Interviewer Character Profile */}
          <div className="bg-[#0f111a] border border-white/5 rounded-2xl p-6 md:p-8" id="step-interviewer">
            <h3 className="font-display font-bold text-lg text-white mb-2 flex items-center gap-2">
              <span className="text-xs bg-purple-500/10 border border-purple-500/20 text-purple-400 w-5 h-5 rounded-full flex items-center justify-center font-bold">1</span>
              Assessor Character Persona
            </h3>
            <p className="text-xs text-gray-400 mb-6">
              Choose the vocal style and mock profile that matches your target interview format.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Profile Female: Rachel */}
              <div 
                id="profile-interviewer-female"
                onClick={() => setGender("Female")}
                className={`relative border rounded-2xl p-5 flex items-start gap-4 cursor-pointer transition-all ${
                  gender === "Female" 
                    ? "bg-purple-500/5 border-purple-500 shadow-lg shadow-purple-500/5" 
                    : "bg-[#07080d] border-white/5 hover:border-white/10"
                }`}
              >
                <div className="bg-gradient-to-tr from-purple-500 to-pink-500 w-12 h-12 rounded-xl flex items-center justify-center text-white font-display font-bold shadow-md">
                  F
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className="font-bold text-white text-sm">Rachel</h4>
                    <span className="text-[10px] bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded uppercase font-semibold">
                      Staff Lead
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    A thorough and encouraging assessor who focuses deeply on architectural trade-offs, scalability, and code hygiene.
                  </p>
                </div>

                {gender === "Female" && (
                  <div className="absolute top-4 right-4 bg-purple-500 p-1 rounded-full text-white">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Profile Male: Evan */}
              <div 
                id="profile-interviewer-male"
                onClick={() => setGender("Male")}
                className={`relative border rounded-2xl p-5 flex items-start gap-4 cursor-pointer transition-all ${
                  gender === "Male" 
                    ? "bg-purple-500/5 border-purple-500 shadow-lg shadow-purple-500/5" 
                    : "bg-[#07080d] border-white/5 hover:border-white/10"
                }`}
              >
                <div className="bg-gradient-to-tr from-indigo-500 to-blue-500 w-12 h-12 rounded-xl flex items-center justify-center text-white font-display font-bold shadow-md">
                  M
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className="font-bold text-white text-sm">Evan</h4>
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded uppercase font-semibold">
                      VP Recruiter
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    An executive recruiter with an objective, fast-paced evaluation style, emphasizing commercial impact and STAR responses.
                  </p>
                </div>

                {gender === "Male" && (
                  <div className="absolute top-4 right-4 bg-purple-500 p-1 rounded-full text-white">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Step 2: Category & Domains */}
          <div className="bg-[#0f111a] border border-white/5 rounded-2xl p-6 md:p-8" id="step-category">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
                  <span className="text-xs bg-purple-500/10 border border-purple-500/20 text-purple-400 w-5 h-5 rounded-full flex items-center justify-center font-bold">2</span>
                  Category & Specific Specialization
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Specify whether the focus is highly programming-oriented or behavioral-focused.
                </p>
              </div>

              {/* Tab Selector */}
              <div className="bg-[#07080d] border border-white/5 p-1 rounded-xl flex items-center self-start sm:self-center">
                <button
                  id="tab-category-tech"
                  type="button"
                  onClick={() => handleCategoryChange("Technical")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    category === "Technical" 
                      ? "bg-purple-600 text-white shadow-md" 
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Technical
                </button>
                <button
                  id="tab-category-nontech"
                  type="button"
                  onClick={() => handleCategoryChange("Non Technical")}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    category === "Non Technical" 
                      ? "bg-purple-600 text-white shadow-md" 
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Non-Technical
                </button>
              </div>
            </div>

            {/* Grid of Domains */}
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Select Domain Pathway
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" id="domain-selector-grid">
                {domainOptions.map((opt) => (
                  <div
                    key={opt}
                    onClick={() => setDomain(opt)}
                    className={`border rounded-xl p-3.5 text-center cursor-pointer transition-all flex items-center justify-center min-h-[58px] ${
                      domain === opt
                        ? "bg-purple-500/10 border-purple-500 text-white font-semibold"
                        : "bg-[#07080d] border-white/5 text-gray-400 hover:text-gray-300 hover:border-white/10"
                    }`}
                  >
                    <span className="text-xs">{opt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Step 3: Difficulty Level */}
          <div className="bg-[#0f111a] border border-white/5 rounded-2xl p-6 md:p-8" id="step-difficulty">
            <h3 className="font-display font-bold text-lg text-white mb-2 flex items-center gap-2">
              <span className="text-xs bg-purple-500/10 border border-purple-500/20 text-purple-400 w-5 h-5 rounded-full flex items-center justify-center font-bold">3</span>
              Scenario Difficulty Level
            </h3>
            <p className="text-xs text-gray-400 mb-6">
              Adjust the assessment strictness and architectural depth of the questions.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* Beginner */}
              <div
                id="diff-beginner"
                onClick={() => setDifficulty("Beginner")}
                className={`relative border rounded-2xl p-5 cursor-pointer transition-all ${
                  difficulty === "Beginner"
                    ? "bg-purple-500/5 border-purple-500 shadow-lg shadow-purple-500/5"
                    : "bg-[#07080d] border-white/5 hover:border-white/10"
                }`}
              >
                <h4 className="font-bold text-white text-sm mb-1 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  Beginner
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Focuses strictly on syntactic foundations, introductory jargon, basic problem decomposition, and essential definitions.
                </p>
                {difficulty === "Beginner" && (
                  <div className="absolute top-4 right-4 bg-purple-500 p-1 rounded-full text-white">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Intermediate */}
              <div
                id="diff-intermediate"
                onClick={() => setDifficulty("Intermediate")}
                className={`relative border rounded-2xl p-5 cursor-pointer transition-all ${
                  difficulty === "Intermediate"
                    ? "bg-purple-500/5 border-purple-500 shadow-lg shadow-purple-500/5"
                    : "bg-[#07080d] border-white/5 hover:border-white/10"
                }`}
              >
                <h4 className="font-bold text-white text-sm mb-1 flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  Intermediate
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Deepens into optimization, design patterns, solid engineering choices, and comprehensive analytical structure.
                </p>
                {difficulty === "Intermediate" && (
                  <div className="absolute top-4 right-4 bg-purple-500 p-1 rounded-full text-white">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Advanced */}
              <div
                id="diff-advanced"
                onClick={() => setDifficulty("Advanced")}
                className={`relative border rounded-2xl p-5 cursor-pointer transition-all ${
                  difficulty === "Advanced"
                    ? "bg-purple-500/5 border-purple-500 shadow-lg shadow-purple-500/5"
                    : "bg-[#07080d] border-white/5 hover:border-white/10"
                }`}
              >
                <h4 className="font-bold text-white text-sm mb-1 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-pink-400" />
                  Advanced
                </h4>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Tests large-scale system trade-offs, advanced algorithms under strict limits, and multi-dimensional behavioral scenarios.
                </p>
                {difficulty === "Advanced" && (
                  <div className="absolute top-4 right-4 bg-purple-500 p-1 rounded-full text-white">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Action Footer Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <ShieldCheck className="w-4 h-4 text-purple-400" />
              <span>Configure sessions safely. Reset at any time.</span>
            </div>

            <button
              id="btn-setup-submit"
              type="submit"
              disabled={loading}
              className="group w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-500 text-white font-bold px-8 py-4 rounded-xl shadow-lg shadow-purple-500/10 transition-all duration-300 active:scale-[0.98] disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Configuring AI Agent...
                </>
              ) : (
                <>
                  Generate Interview Session
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </div>

        </form>

      </main>

    </div>
  );
}
