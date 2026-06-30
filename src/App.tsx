import React, { useEffect, useState } from "react";
import LandingPage from "./components/LandingPage";
import AuthPage from "./components/AuthPage";
import DashboardPage from "./components/DashboardPage";
import InterviewSetupPage from "./components/InterviewSetupPage";
import ActiveInterviewPage from "./components/ActiveInterviewPage";
import { Page, User } from "./types";
import { Loader2 } from "lucide-react";

export default function App() {
  const [page, setPage] = useState<Page>("landing");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeInterviewId, setActiveInterviewId] = useState<string | null>(null);

  // Restore authenticated session on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("mockit_token");
    const storedUser = localStorage.getItem("mockit_user");
    const storedPage = localStorage.getItem("mockit_page") as Page | null;
    const storedActiveId = localStorage.getItem("mockit_active_interview_id");

    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        
        if (storedPage === "interview" && storedActiveId) {
          setActiveInterviewId(storedActiveId);
          setPage("interview");
        } else if (storedPage && ["dashboard", "setup"].includes(storedPage)) {
          setPage(storedPage);
        } else {
          setPage("dashboard");
        }
      } catch (err) {
        console.error("Failed to restore saved session", err);
        localStorage.removeItem("mockit_token");
        localStorage.removeItem("mockit_user");
        localStorage.removeItem("mockit_page");
        localStorage.removeItem("mockit_active_interview_id");
      }
    }
    setCheckingSession(false);
  }, []);

  const handleAuthSuccess = (newToken: string, newUser: User) => {
    localStorage.setItem("mockit_token", newToken);
    localStorage.setItem("mockit_user", JSON.stringify(newUser));
    localStorage.setItem("mockit_page", "dashboard");
    setToken(newToken);
    setUser(newUser);
    setPage("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("mockit_token");
    localStorage.removeItem("mockit_user");
    localStorage.removeItem("mockit_page");
    localStorage.removeItem("mockit_active_interview_id");
    setToken(null);
    setUser(null);
    setPage("landing");
    setActiveInterviewId(null);
  };

  const handleNavigate = (targetPage: Page) => {
    setPage(targetPage);
    localStorage.setItem("mockit_page", targetPage);
    if (targetPage !== "interview") {
      localStorage.removeItem("mockit_active_interview_id");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleStartInterview = (interviewId: string) => {
    setActiveInterviewId(interviewId);
    localStorage.setItem("mockit_active_interview_id", interviewId);
    localStorage.setItem("mockit_page", "interview");
    setPage("interview");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#07080d] flex items-center justify-center text-gray-100 font-sans" id="app-session-checking">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
          <p className="text-gray-400 text-sm font-medium animate-pulse">Initializing Mockit platform workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080d] text-gray-100 flex flex-col justify-between selection:bg-purple-500/30 selection:text-white" id="app-container">
      {/* Dynamic router wrapper */}
      <div className="flex-1 w-full" id="page-renderer">
        {page === "landing" && (
          <LandingPage 
            onNavigate={handleNavigate} 
            isAuthenticated={!!token} 
          />
        )}

        {(page === "login" || page === "signup") && (
          <AuthPage 
            initialMode={page} 
            onNavigate={handleNavigate} 
            onAuthSuccess={handleAuthSuccess} 
          />
        )}

        {page === "dashboard" && token && (
          <DashboardPage 
            token={token} 
            onNavigate={handleNavigate} 
            onLogout={handleLogout} 
            onStartInterview={handleStartInterview}
          />
        )}

        {page === "setup" && token && (
          <InterviewSetupPage 
            token={token} 
            onNavigate={handleNavigate} 
            onStartInterview={handleStartInterview}
          />
        )}

        {page === "interview" && token && activeInterviewId && (
          <ActiveInterviewPage 
            token={token} 
            interviewId={activeInterviewId}
            onNavigate={(tgt) => {
              if (tgt === "dashboard") {
                setActiveInterviewId(null);
              }
              handleNavigate(tgt);
            }} 
          />
        )}
      </div>
    </div>
  );
}
