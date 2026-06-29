import React, { useState } from "react";
import { 
  Brain, 
  Mail, 
  Lock, 
  User, 
  ArrowLeft, 
  AlertCircle, 
  Loader2,
  CheckCircle2,
  Eye,
  EyeOff
} from "lucide-react";

interface AuthPageProps {
  initialMode: "login" | "signup";
  onNavigate: (page: "landing" | "login" | "signup" | "dashboard" | "setup") => void;
  onAuthSuccess: (token: string, user: { id: string; name: string; email: string }) => void;
}

export default function AuthPage({ initialMode, onNavigate, onAuthSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
    const payload = mode === "signup" 
      ? { name, email, password } 
      : { email, password };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "An unexpected error occurred");
      }

      if (mode === "signup") {
        setSuccessMsg("Account created successfully! Logging you in...");
        setTimeout(() => {
          onAuthSuccess(data.token, data.user);
          onNavigate("dashboard");
        }, 1200);
      } else {
        setSuccessMsg("Logged in successfully!");
        setTimeout(() => {
          onAuthSuccess(data.token, data.user);
          onNavigate("dashboard");
        }, 800);
      }
    } catch (err: any) {
      setError(err.message || "Failed to authenticate. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setError(null);
    setSuccessMsg(null);
    setMode(prev => prev === "login" ? "signup" : "login");
  };

  return (
    <div className="min-h-screen bg-[#07080d] flex flex-col justify-between py-12 px-6 md:px-12 relative overflow-hidden font-sans text-gray-100" id="auth-page-root">
      {/* Background decorations */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Header Back Button */}
      <div className="max-w-7xl mx-auto w-full relative z-10">
        <button
          id="btn-auth-back-to-home"
          onClick={() => onNavigate("landing")}
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl border border-white/5 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </button>
      </div>

      {/* Auth Card Container */}
      <div className="max-w-md w-full mx-auto relative z-10 my-8 animate-fade-in" id="auth-card-wrapper">
        <div className="bg-[#0f111a] border border-white/10 rounded-3xl p-8 md:p-10 shadow-2xl shadow-purple-500/5">
          
          {/* Logo Heading */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-purple-500/10 mb-4">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <h1 className="font-display font-black text-3xl tracking-tight text-white">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-gray-400 text-sm mt-2">
              {mode === "login" 
                ? "Enter your credentials to access your mock dashboard" 
                : "Get started with the world's most advanced mock interviewer"
              }
            </p>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 text-sm mb-6" id="auth-error-alert">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-start gap-3 text-sm mb-6" id="auth-success-alert">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="space-y-5" id="auth-form">
            
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2" htmlFor="auth-name-input">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    id="auth-name-input"
                    type="text"
                    required
                    placeholder="Jane Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#07080d] border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-sm text-white placeholder-gray-600 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2" htmlFor="auth-email-input">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  id="auth-email-input"
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#07080d] border border-white/5 rounded-xl py-3.5 pl-12 pr-4 text-sm text-white placeholder-gray-600 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider" htmlFor="auth-password-input">
                  Password
                </label>
                {mode === "login" && (
                  <a href="#" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                    Forgot Password?
                  </a>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  id="auth-password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder={mode === "signup" ? "At least 6 characters" : "••••••••"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#07080d] border border-white/5 rounded-xl py-3.5 pl-12 pr-12 text-sm text-white placeholder-gray-600 focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 outline-none transition-all"
                />
                <button
                  id="btn-auth-toggle-password"
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              id="btn-auth-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-purple-500/10 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 text-sm"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Authenticating..." : mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          {/* Form Switch footer */}
          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-gray-400 text-sm">
              {mode === "login" ? "Don't have an account yet?" : "Already have an account?"}{" "}
              <button
                id="btn-auth-toggle-mode"
                onClick={toggleMode}
                className="text-purple-400 hover:text-purple-300 font-semibold underline underline-offset-4 cursor-pointer transition-colors"
              >
                {mode === "login" ? "Sign up free" : "Log in here"}
              </button>
            </p>
          </div>

        </div>
      </div>

      {/* Footer copyright */}
      <div className="max-w-7xl mx-auto w-full text-center relative z-10 text-xs text-gray-600">
        &copy; {new Date().getFullYear()} Mockit. Fully secured login portal.
      </div>

    </div>
  );
}
