import React, { useEffect, useState, useRef } from "react";
import { 
  Brain, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  ArrowLeft, 
  Send, 
  Loader2, 
  AlertCircle,
  HelpCircle,
  TrendingUp,
  User,
  Activity,
  Play,
  RotateCcw,
  CheckCircle2,
  Sliders,
  Award,
  Timer,
  Tag
} from "lucide-react";
import { Page } from "../types";
import { 
  getBestVoiceForPersonality, 
  calculateDynamicVoiceConfig, 
  INTERVIEWER_PERSONALITIES 
} from "../lib/voiceProvider";

interface ActiveInterviewPageProps {
  token: string;
  interviewId: string;
  onNavigate: (page: Page) => void;
}

interface HistoryItem {
  role: "interviewer" | "candidate";
  text: string;
  score?: number;
  feedback?: string;
}

export default function ActiveInterviewPage({ token, interviewId, onNavigate }: ActiveInterviewPageProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Interview progress states
  const [interviewerName, setInterviewerName] = useState("Sophia");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [maxQuestions, setMaxQuestions] = useState(5);
  const [currentDifficulty, setCurrentDifficulty] = useState<"Beginner" | "Intermediate" | "Advanced">("Intermediate");
  const [currentQuestionText, setCurrentQuestionText] = useState("");
  const [isCompleted, setIsCompleted] = useState(false);
  const [overallScore, setOverallScore] = useState<number | null>(null);
  const [domain, setDomain] = useState("");
  const [category, setCategory] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Conversation history
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Speech and voice settings
  const [isMuted, setIsMuted] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>("");
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // Microphone Speech Recognition states
  const [isListening, setIsListening] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  // Transition & Evaluation states
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalResult, setEvalResult] = useState<{ score: number; feedback: string } | null>(null);
  const [adaptiveStatusMsg, setAdaptiveStatusMsg] = useState("Assessing candidate pathway...");

  // Refs for audio / speech synthesis
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const recognitionRef = useRef<any>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const evalTimeoutRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [useElevenLabs, setUseElevenLabs] = useState(true);

  // Load Speech Synthesis voices
  useEffect(() => {
    if (typeof window !== "undefined") {
      synthRef.current = window.speechSynthesis;
      const loadVoices = () => {
        if (synthRef.current) {
          const voices = synthRef.current.getVoices();
          setAvailableVoices(voices);
          
          // Check if there is a persisted voice selection for this personality
          const savedVoiceKey = `mockit_selected_voice_${interviewerName}`;
          const persistedVoice = localStorage.getItem(savedVoiceKey);
          
          if (persistedVoice && voices.find(v => v.name === persistedVoice)) {
            setSelectedVoiceName(persistedVoice);
          } else {
            const bestVoice = getBestVoiceForPersonality(interviewerName, voices);
            if (bestVoice) {
              setSelectedVoiceName(bestVoice.name);
            }
          }
        }
      };

      loadVoices();
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }, [interviewerName]);

  // Speech recognition setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setRecognitionError(null);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          setUserInput(prev => {
            const separator = prev.trim() ? " " : "";
            return prev + separator + finalTranscript;
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        if (event.error === "not-allowed") {
          setRecognitionError("Microphone permission denied. Please allow mic access in your browser or type manually.");
        } else if (event.error === "no-speech") {
          // Ignore transient no-speech triggers
        } else if (event.error === "network") {
          setRecognitionError("Speech recognition network error: Google Chrome's speech service has restriction policies inside preview frames. Please open the application in a new tab using the top-right button, or type your response manually below.");
        } else {
          setRecognitionError(`Microphone error: ${event.error}. Please type if issue persists.`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      setRecognitionError("Your browser does not support Speech Recognition. Please type your responses manually below.");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Fetch first question on mount
  useEffect(() => {
    isMountedRef.current = true;
    startSession();
    return () => {
      isMountedRef.current = false;
      // Cancel any ongoing speech on unmount
      if (synthRef.current) {
        synthRef.current.cancel();
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (evalTimeoutRef.current) {
        clearTimeout(evalTimeoutRef.current);
      }
    };
  }, [interviewId]);

  // Live session timer
  useEffect(() => {
    if (loading || isCompleted) return;
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, isCompleted]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Scroll to bottom of conversation
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isEvaluating]);

  const startSession = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/interviews/${interviewId}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
       if (!response.ok) {
        throw new Error(data.error || "Failed to start the AI Voice Interview");
      }

      setInterviewerName(data.interviewerName);
      setCurrentQuestionIndex(data.session.currentQuestionIndex);
      setMaxQuestions(data.session.maxQuestions);
      setCurrentDifficulty(data.session.currentDifficulty);
      setDomain(data.session.domain || "Technical Domain");
      setCategory(data.session.category || "Professional");
      setCurrentQuestionText(data.text);
      setHistory([{ role: "interviewer", text: data.text }]);
      
      // Warm adaptive greeting message
      setAdaptiveStatusMsg(`Initial pacing calibrated to ${data.session.currentDifficulty} level.`);

      // Direct selection of the optimal voice to prevent race conditions or outdated state
      let currentVoices = availableVoices;
      if (currentVoices.length === 0 && synthRef.current) {
        currentVoices = synthRef.current.getVoices();
        setAvailableVoices(currentVoices);
      }
      
      const bestVoice = getBestVoiceForPersonality(data.interviewerName, currentVoices);
      const voiceToUse = bestVoice ? bestVoice.name : selectedVoiceName;
      if (bestVoice) {
        setSelectedVoiceName(bestVoice.name);
      }

      // Read aloud the greeting & question using the correct voice name
      speakText(data.text, voiceToUse);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Could not initialize interview");
    } finally {
      setLoading(false);
    }
  };

  // System speech fallback engine with robust gender-matching fix
  const speakTextSystem = (cleanText: string, overrideVoiceName?: string, overrideRate?: number) => {
    if (!synthRef.current) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const baseRate = overrideRate !== undefined ? overrideRate : speechRate;
    const dynamicConfig = calculateDynamicVoiceConfig(cleanText, baseRate, interviewerName);
    
    utterance.rate = dynamicConfig.rate;
    utterance.pitch = dynamicConfig.pitch;

    let voices = availableVoices;
    if (voices.length === 0) {
      voices = synthRef.current.getVoices();
    }

    let voiceName = overrideVoiceName || selectedVoiceName;
    if (!voiceName || voiceName === "") {
      const bestVoice = getBestVoiceForPersonality(interviewerName, voices);
      if (bestVoice) {
        voiceName = bestVoice.name;
        setSelectedVoiceName(voiceName);
      }
    }

    if (voiceName) {
      const voice = voices.find(v => v.name === voiceName);
      if (voice) {
        utterance.voice = voice;
      }
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    synthRef.current.speak(utterance);
  };

  // Speaks text aloud using premium ElevenLabs voice or system fallback
  const speakText = async (text: string, overrideVoiceName?: string, overrideRate?: number) => {
    if (!isMountedRef.current) return;
    if (isMuted) return;

    // Stop any current speaking
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsSpeaking(false);

    const cleanText = text.replace(/[*_`#\-]/g, " ").trim();

    if (useElevenLabs) {
      try {
        setIsSpeaking(true);
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: cleanText,
            personality: interviewerName
          })
        });

        if (response.ok) {
          const blob = await response.blob();
          const audioUrl = URL.createObjectURL(blob);
          
          if (audioRef.current) {
            audioRef.current.src = audioUrl;
          } else {
            audioRef.current = new Audio(audioUrl);
          }

          audioRef.current.playbackRate = overrideRate !== undefined ? overrideRate : speechRate;
          
          audioRef.current.onended = () => {
            setIsSpeaking(false);
          };
          audioRef.current.onerror = () => {
            setIsSpeaking(false);
            speakTextSystem(cleanText, overrideVoiceName, overrideRate);
          };

          await audioRef.current.play();
          return;
        } else {
          // Fall back to system TTS
          speakTextSystem(cleanText, overrideVoiceName, overrideRate);
        }
      } catch (err) {
        console.error("ElevenLabs TTS failed, playing via system:", err);
        speakTextSystem(cleanText, overrideVoiceName, overrideRate);
      }
    } else {
      speakTextSystem(cleanText, overrideVoiceName, overrideRate);
    }
  };

  // Toggle microphone listening
  const toggleListening = () => {
    if (!recognitionRef.current) {
      setRecognitionError("Speech-to-text is not supported or was not initialized in this browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setRecognitionError(null);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Start recognition error:", err);
      }
    }
  };

  // Submit response
  const handleSendResponse = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userInput.trim()) return;

    const candidateAnswer = userInput;
    setUserInput("");
    
    // Stop recording if active
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    // Stop speaking
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }

    // Update conversational feed
    setHistory(prev => [...prev, { role: "candidate", text: candidateAnswer }]);
    setIsEvaluating(true);
    setAdaptiveStatusMsg(`Assessing answer metrics & calculating rating...`);

    try {
      const response = await fetch(`/api/interviews/${interviewId}/answer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ answer: candidateAnswer })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to send response");
      }

      setEvalResult({
        score: data.score,
        feedback: data.feedback
      });

      // Stagger slightly for user to read/hear feedback
      evalTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;
        setIsEvaluating(false);
        setEvalResult(null);

        // Update states
        if (data.isCompleted) {
          setIsCompleted(true);
          setOverallScore(data.overallScore);
          setHistory(prev => [...prev, { role: "interviewer", text: data.nextQuestion }]);
          setAdaptiveStatusMsg("Mock interview pathway finalized and saved!");
          speakText(`Thank you. The interview is now complete. Your overall score is ${data.overallScore} percent.`);
        } else {
          setCurrentQuestionIndex(data.session.currentQuestionIndex);
          setCurrentDifficulty(data.session.currentDifficulty);
          setCurrentQuestionText(data.nextQuestion);
          setHistory(prev => [...prev, { role: "interviewer", text: data.nextQuestion }]);

          // Update adaptive prompt status beautifully
          if (data.score >= 80) {
            setAdaptiveStatusMsg(`Excellent response (${data.score}%). Elevating difficulty to ${data.session.currentDifficulty}...`);
          } else if (data.score < 60) {
            setAdaptiveStatusMsg(`Struggled slightly (${data.score}%). Lowering to ${data.session.currentDifficulty} to rebuild confidence...`);
          } else {
            setAdaptiveStatusMsg(`Solid answer (${data.score}%). Maintaining stable ${data.session.currentDifficulty} pacing.`);
          }

          // Speak the next question!
          speakText(data.nextQuestion);
        }
      }, 3500);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while evaluating your answer.");
      setIsEvaluating(false);
    }
  };

  const handleAbort = () => {
    isMountedRef.current = false;
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
    if (evalTimeoutRef.current) {
      clearTimeout(evalTimeoutRef.current);
    }

    // Trigger API cleanup asynchronously to prevent blocking the UI
    fetch(`/api/interviews/${interviewId}/abort`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    }).catch((err) => {
      console.error("Abort session memory cleanup error:", err);
    });

    onNavigate("dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080d] flex items-center justify-center text-gray-100 font-sans" id="interview-loading">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
          <p className="text-gray-400 text-sm font-medium animate-pulse">Initializing conversational memory & launching assessor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#07080d] text-gray-100 font-sans flex flex-col justify-between relative overflow-hidden" id="active-interview-root">
      
      {/* Background radial glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Header bar */}
      <header className="bg-[#0b0c13] border-b border-white/5 py-4 px-6 sticky top-0 z-40 backdrop-blur-md bg-opacity-90">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleAbort}
              className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all cursor-pointer text-gray-400 hover:text-white"
              title="Abort interview and back to dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-white text-base tracking-tight">Active Mock Interview</span>
                <span className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full font-mono uppercase font-black tracking-wider animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                  LIVE SESSION
                </span>
              </div>
              <p className="text-xs text-gray-400">Assessed by AI Recruiter <span className="text-purple-400 font-semibold">{interviewerName}</span></p>
            </div>
          </div>

          {/* Active Interview Metadata Center */}
          <div className="flex flex-wrap items-center gap-3 bg-[#07080d]/80 border border-white/5 px-4 py-2.5 rounded-2xl">
            {domain && (
              <div className="flex items-center gap-1.5 text-xs text-gray-300 font-medium border-r border-white/5 pr-3">
                <Tag className="w-3.5 h-3.5 text-purple-400" />
                <span>{domain}</span>
                <span className="text-gray-500 text-[10px] bg-white/5 px-1.5 py-0.5 rounded">{category}</span>
              </div>
            )}

            {/* Difficulty Badge */}
            <div className="flex items-center gap-1 border-r border-white/5 pr-3">
              <span className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-0.5 rounded-md ${
                currentDifficulty === "Advanced" ? "bg-red-500/10 text-red-400 border border-red-500/15 shadow-[0_0_12px_rgba(239,68,68,0.1)]" :
                currentDifficulty === "Intermediate" ? "bg-amber-500/10 text-amber-400 border border-amber-500/15 shadow-[0_0_12px_rgba(245,158,11,0.1)]" :
                "bg-indigo-500/10 text-indigo-400 border border-indigo-500/15 shadow-[0_0_12px_rgba(99,102,241,0.1)]"
              }`}>
                {currentDifficulty}
              </span>
            </div>

            {/* Clock Timer */}
            <div className="flex items-center gap-1.5 text-gray-300 font-mono text-xs">
              <Timer className="w-3.5 h-3.5 text-purple-400 animate-spin [animation-duration:8s]" />
              <span className="font-bold text-white bg-white/5 px-2 py-0.5 rounded tracking-wider">
                {formatTime(elapsedSeconds)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Mute Button */}
            <button
              onClick={() => {
                const nextMuted = !isMuted;
                setIsMuted(nextMuted);
                if (nextMuted) {
                  if (synthRef.current) {
                    synthRef.current.cancel();
                  }
                  if (audioRef.current) {
                    audioRef.current.pause();
                    audioRef.current.currentTime = 0;
                  }
                  setIsSpeaking(false);
                } else if (!nextMuted && currentQuestionText) {
                  speakText(currentQuestionText);
                }
              }}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-2 text-xs font-semibold ${
                isMuted 
                  ? "bg-red-500/10 text-red-400 border-red-500/20" 
                  : "bg-white/5 text-gray-300 border-white/5 hover:bg-white/10"
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span className="hidden sm:inline">{isMuted ? "Voice Muted" : "Voice Enabled"}</span>
            </button>

            {/* End Early */}
            <button
              onClick={handleAbort}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer hover:shadow-lg hover:shadow-red-500/5"
            >
              Terminate
            </button>
          </div>
        </div>
      </header>

      {/* Main content grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-6 py-6 overflow-hidden relative z-10" id="interview-workspace">
        
        {/* Left 2 Cols: Chat Feed & Controls */}
        <div className="lg:col-span-2 flex flex-col h-full bg-[#0f111a] border border-white/5 rounded-2xl relative overflow-hidden shadow-2xl">
          
          {/* Active Question Bar */}
          <div className="bg-[#141624] border-b border-white/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-xs bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2.5 py-1 rounded font-bold">
                Q {currentQuestionIndex + 1} of {maxQuestions}
              </span>
              <span className="text-xs text-gray-400">Adaptive Progress Tracker</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 font-mono">Current Difficulty:</span>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                currentDifficulty === "Advanced" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                currentDifficulty === "Intermediate" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
              }`}>
                {currentDifficulty}
              </span>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6" id="messages-feed-container">
            {history.map((msg, idx) => (
              <div 
                key={idx}
                className={`flex gap-4 max-w-[85%] ${msg.role === "candidate" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  msg.role === "candidate" 
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/10" 
                    : "bg-white/5 text-gray-300 border border-white/10"
                }`}>
                  {msg.role === "candidate" ? "U" : interviewerName[0]}
                </div>

                {/* Message Bubble */}
                <div className="space-y-1">
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "candidate"
                      ? "bg-purple-600/15 text-purple-100 rounded-tr-none border border-purple-500/20"
                      : "bg-[#07080d] text-gray-200 rounded-tl-none border border-white/5"
                  }`}>
                    {msg.text}
                  </div>

                  {/* Rating / Constructive feedback display for candidate answers */}
                  {msg.role === "candidate" && msg.score !== undefined && (
                    <div className="bg-purple-500/5 border border-purple-500/10 rounded-xl p-3 text-xs space-y-1.5 max-w-lg mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-purple-400 font-semibold flex items-center gap-1">
                          <Activity className="w-3.5 h-3.5" />
                          Sophia's Score
                        </span>
                        <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${
                          msg.score >= 80 ? "bg-emerald-500/15 text-emerald-400" :
                          msg.score >= 60 ? "bg-amber-500/15 text-amber-400" :
                          "bg-red-500/15 text-red-400"
                        }`}>
                          {msg.score}/100
                        </span>
                      </div>
                      <p className="text-gray-400 italic font-medium leading-relaxed">
                        "{msg.feedback}"
                      </p>
                    </div>
                  )}

                  {/* Speaker helper button for questions */}
                  {msg.role === "interviewer" && idx === history.length - 1 && !isCompleted && (
                    <button 
                      onClick={() => speakText(msg.text)}
                      className="text-[10px] text-gray-500 hover:text-white flex items-center gap-1.5 mt-1 bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-colors cursor-pointer"
                    >
                      <Volume2 className="w-3 h-3 text-purple-400 animate-pulse" />
                      Replay Voice Question
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* AI Evaluation Loading Transition */}
            {isEvaluating && (
              <div className="flex gap-4 max-w-[85%] mr-auto">
                <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-xs text-purple-400">
                  <Brain className="w-4 h-4 animate-bounce" />
                </div>
                <div className="space-y-3 flex-1">
                  <div className="bg-[#0b0c13] text-gray-200 border border-purple-500/10 p-5 rounded-2xl rounded-tl-none text-sm space-y-3 shadow-lg shadow-purple-500/2">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                      <span className="font-semibold text-white">AI Assessing Intake Metrics...</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400 font-mono">
                      <div className="flex items-center gap-2 bg-[#07080d] p-2 rounded border border-white/5">
                        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-ping" />
                        <span>Core Syntax Depth</span>
                      </div>
                      <div className="flex items-center gap-2 bg-[#07080d] p-2 rounded border border-white/5">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />
                        <span>Semantic Accuracy</span>
                      </div>
                      <div className="flex items-center gap-2 bg-[#07080d] p-2 rounded border border-white/5">
                        <span className="w-1.5 h-1.5 bg-pink-400 rounded-full animate-ping" />
                        <span>Tone & Delivery</span>
                      </div>
                      <div className="flex items-center gap-2 bg-[#07080d] p-2 rounded border border-white/5">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                        <span>Formulating Coaching</span>
                      </div>
                    </div>
                    
                    <p className="text-xs text-gray-400 italic">
                      {interviewerName} is compiling real-time score feedback and calibrating the adaptive path...
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div ref={historyEndRef} />
          </div>

          {/* Interactive Microphone & Input Panel */}
          <div className="bg-[#141624] border-t border-white/5 p-6 space-y-4">
            
            {/* Adaptive Status Banner */}
            <div className="flex items-center justify-between text-xs bg-purple-500/5 border border-purple-500/10 rounded-xl px-4 py-2 text-purple-300">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-ping" />
                <strong>Adaptive Engine Status:</strong> {adaptiveStatusMsg}
              </span>
              <span className="hidden md:inline font-mono text-[10px] text-gray-500">Live Feedback Channel</span>
            </div>

            {/* Error alerts */}
            {recognitionError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3.5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md shadow-red-500/2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                  <span className="leading-relaxed">{recognitionError}</span>
                </div>
                <a 
                  href={window.location.href} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-red-500/20 hover:bg-red-500/30 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all whitespace-nowrap text-center inline-block cursor-pointer border border-red-500/20"
                >
                  Open in New Tab
                </a>
              </div>
            )}

            {isCompleted ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-2xl text-center space-y-4">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">Interview Completed Successfully</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Your assessment has been summarized and evaluated by the adaptive AI engine.
                  </p>
                </div>

                <div className="max-w-xs mx-auto bg-[#0f111a] border border-white/5 rounded-xl p-4 flex items-center justify-between">
                  <span className="text-xs text-gray-400">Consolidated Score:</span>
                  <span className="font-display font-black text-2xl text-emerald-400">{overallScore}%</span>
                </div>

                <button
                  onClick={() => onNavigate("dashboard")}
                  className="bg-white hover:bg-gray-100 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-lg inline-flex items-center gap-1.5"
                >
                  Return to Dashboard
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendResponse} className="space-y-4">
                
                {/* Wave Visualizer and Voice Recorder Ring */}
                <div className="flex flex-col items-center justify-center py-6 bg-[#07080d]/60 rounded-2xl border border-white/5 relative overflow-hidden w-full">
                  
                  {isListening ? (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.15]">
                      {/* Ambient glows */}
                      <div className="w-40 h-40 bg-purple-500 rounded-full animate-ping absolute" />
                      <div className="w-60 h-60 bg-indigo-500 rounded-full animate-ping absolute [animation-delay:0.5s]" />
                    </div>
                  ) : null}

                  {/* Audio Waveform Spectrum Visualization */}
                  <div className="flex items-end justify-center gap-[3px] h-12 mb-6" id="audio-visualizer-spectrum">
                    {isListening ? (
                      // Interactive dynamic voice frequency spectrum
                      [12, 28, 16, 42, 24, 48, 18, 36, 14, 28, 40, 22, 38, 16, 30, 12, 24, 34, 18, 10].map((height, i) => {
                        const randomFactor = Math.random() * 0.5 + 0.5;
                        const finalHeight = Math.round(height * randomFactor);
                        const duration = `${(0.4 + Math.random() * 0.4).toFixed(2)}s`;
                        const delay = `${(i * 0.04).toFixed(2)}s`;
                        return (
                          <span 
                            key={i} 
                            className="w-[3px] bg-gradient-to-t from-purple-500 via-pink-500 to-indigo-400 rounded-full animate-[pulse_0.4s_infinite_alternate]"
                            style={{ 
                              height: `${finalHeight}px`,
                              animationDuration: duration,
                              animationDelay: delay
                            }}
                          />
                        );
                      })
                    ) : (
                      // Silent ambient state with tiny dots
                      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((dot) => (
                        <span key={dot} className="w-[3px] h-[5px] bg-white/10 rounded-full transition-all duration-300" />
                      ))
                    )}
                  </div>

                  <div className="flex items-center gap-6 z-10">
                    <button
                      type="button"
                      onClick={toggleListening}
                      className={`w-16 h-16 rounded-full flex items-center justify-center border shadow-2xl transition-all duration-300 cursor-pointer ${
                        isListening
                          ? "bg-red-500 text-white border-red-600 scale-105 shadow-red-500/30 animate-pulse"
                          : "bg-purple-600 text-white border-purple-500 hover:bg-purple-500 hover:scale-105 hover:shadow-purple-500/30"
                      }`}
                    >
                      {isListening ? (
                        <MicOff className="w-6 h-6 animate-pulse" />
                      ) : (
                        <Mic className="w-6 h-6" />
                      )}
                    </button>
 
                    <div className="text-left">
                      <h4 className="font-extrabold text-white text-sm tracking-tight flex items-center gap-2">
                        {isListening ? (
                          <>
                            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                            Listening - Speak Now
                          </>
                        ) : (
                          "Tap Microphone to Speak"
                        )}
                      </h4>
                      <p className="text-xs text-gray-400 mt-0.5 max-w-xs leading-relaxed">
                        {isListening 
                          ? "We are converting your speech to text in real-time. When finished, tap the red button to pause or edit." 
                          : "Speak your mind naturally. Your voice is automatically transcribed and refined by AI."
                        }
                      </p>
                    </div>
                  </div>

                </div>

                {/* Edit & Manual input field fallback */}
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Type or edit your transcribed response..."
                    disabled={isEvaluating}
                    className="flex-1 bg-[#07080d] border border-white/5 focus:border-purple-500/50 rounded-xl px-4 py-3 text-sm text-gray-200 outline-none transition-all placeholder:text-gray-600 disabled:opacity-50"
                  />

                  {userInput.trim() && (
                    <button
                      type="submit"
                      disabled={isEvaluating}
                      className="bg-purple-600 hover:bg-purple-500 text-white p-3.5 rounded-xl transition-colors shadow-lg shadow-purple-600/10 cursor-pointer disabled:opacity-50 flex items-center justify-center"
                      title="Submit Answer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500 px-1">
                  <span>Press enter or click Send to submit your answer.</span>
                  <span>Supports complete voice editing.</span>
                </div>

              </form>
            )}

          </div>

        </div>

        {/* Right 1 Col: Assessor Persona & Voice Options */}
        <div className="lg:col-span-1 h-full overflow-y-auto pr-1 pb-4 space-y-6 scrollbar-thin">
          
          {/* Persona Card */}
          <div className="bg-[#0f111a] border border-white/5 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <h3 className="font-display font-bold text-white text-base mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-purple-400" />
              Active AI Assessor
            </h3>

            <div className="flex items-start gap-4 mb-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-display font-black text-xl text-white shadow-lg ${
                interviewerName === "Sophia" 
                  ? "bg-gradient-to-tr from-purple-500 to-pink-500 shadow-purple-500/10" 
                  : "bg-gradient-to-tr from-indigo-500 to-blue-500 shadow-indigo-500/10"
              }`}>
                {interviewerName[0]}
              </div>

              <div>
                <h4 className="font-extrabold text-white text-lg leading-snug">{interviewerName}</h4>
                <span className="text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/25 font-mono px-2 py-0.5 rounded uppercase font-semibold mt-1 inline-block">
                  {interviewerName === "Sophia" ? "Staff Lead Engineer" : "VP Executive Recruiter"}
                </span>
              </div>
            </div>

            <p className="text-gray-400 text-xs leading-relaxed border-t border-white/5 pt-3.5 pb-3">
              {interviewerName === "Sophia" 
                ? "A thorough and encouraging assessor who focuses deeply on architectural trade-offs, scalability, code hygiene, and structural concepts."
                : "An executive recruiter with an objective, fast-paced evaluation style, prioritizing direct commercial outcomes and structured STAR story methods."
              }
            </p>

            {/* AI Real-time Audio Speaking & Listening States */}
            <div className="border-t border-white/5 pt-3 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Assessor Vocalizer</span>
                {isSpeaking ? (
                  <div className="flex items-center gap-1.5 text-xs text-purple-400 font-bold">
                    <div className="flex gap-0.5 items-center">
                      <span className="w-0.5 h-3 bg-purple-400 rounded-full animate-bounce [animation-duration:0.6s]" />
                      <span className="w-0.5 h-4.5 bg-purple-400 rounded-full animate-bounce [animation-duration:0.4s]" />
                      <span className="w-0.5 h-2 bg-purple-400 rounded-full animate-bounce [animation-duration:0.8s]" />
                    </div>
                    <span>Speaking</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-500 font-semibold uppercase">Idle</span>
                )}
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider">Candidate Mic Intake</span>
                {isListening ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                    <span>Listening</span>
                  </div>
                ) : (
                  <span className="text-[10px] text-gray-500 font-semibold uppercase">Off</span>
                )}
              </div>
            </div>
          </div>

          {/* Voice Tuning Dashboard */}
          <div className="bg-[#0f111a] border border-white/5 rounded-2xl p-6 space-y-5">
            <h3 className="font-display font-bold text-white text-base flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              Voice Synth Controller
            </h3>

            {/* Premium Voice Toggle */}
            <div className="bg-[#141624] border border-white/5 rounded-xl p-3.5 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                  ElevenLabs Voice AI
                </span>
                <p className="text-[10px] text-gray-400 leading-normal">
                  {useElevenLabs 
                    ? "Premium hyper-realistic voices active." 
                    : "Standard web speech synthesis."
                  }
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nextVal = !useElevenLabs;
                  setUseElevenLabs(nextVal);
                  if (currentQuestionText) speakText(currentQuestionText, undefined, undefined);
                }}
                className={`w-11 h-6 rounded-full transition-all duration-300 relative p-1 cursor-pointer flex items-center ${
                  useElevenLabs ? "bg-purple-600 justify-end" : "bg-white/10 justify-start"
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-white block shadow" />
              </button>
            </div>

            {/* Voice Select */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Select Speech Synthesis Voice
                </label>
                {useElevenLabs && (
                  <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                    Fallback Active
                  </span>
                )}
              </div>
              
              {availableVoices.length === 0 ? (
                <span className="text-xs text-gray-500 italic block">
                  Loading system voice profiles...
                </span>
              ) : (
                <select
                  value={selectedVoiceName}
                  onChange={(e) => {
                    const newVoiceName = e.target.value;
                    setSelectedVoiceName(newVoiceName);
                    const savedVoiceKey = `mockit_selected_voice_${interviewerName}`;
                    localStorage.setItem(savedVoiceKey, newVoiceName);
                    if (currentQuestionText) speakText(currentQuestionText, newVoiceName);
                  }}
                  className="w-full bg-[#07080d] border border-white/5 rounded-xl px-3 py-2 text-xs text-gray-300 outline-none focus:border-purple-500/50 cursor-pointer"
                >
                  {availableVoices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Speech Rate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Speech Speed</span>
                <span className="font-mono text-purple-400 font-bold text-xs">{speechRate}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={speechRate}
                onChange={(e) => {
                  const rate = parseFloat(e.target.value);
                  setSpeechRate(rate);
                  if (currentQuestionText) speakText(currentQuestionText, undefined, rate);
                }}
                className="w-full h-1 bg-[#07080d] accent-purple-500 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Quick Helper Notes */}
            <div className="bg-purple-500/5 border border-purple-500/10 p-3.5 rounded-xl text-[10px] text-gray-400 leading-relaxed space-y-1.5">
              <div className="flex items-center gap-1 text-purple-300 font-semibold text-xs">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Interviewer Tips</span>
              </div>
              <p>1. Tap the mic button and state your response naturally.</p>
              <p>2. Sophia dynamically gauges your technical knowledge and raises the difficulty as you perform well.</p>
              <p>3. If you struggle, Sophia will offer encouraging hints and easier questions to build confidence.</p>
            </div>

          </div>

          {/* Quick Metrics display */}
          <div className="bg-gradient-to-tr from-purple-950/20 to-[#0f111a] border border-purple-500/15 rounded-2xl p-6 space-y-4">
            <h3 className="font-display font-semibold text-purple-400 text-sm flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              Real-time Calibration
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#07080d] border border-white/5 p-3 rounded-xl">
                <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Target Pace</span>
                <span className="text-white text-xs font-semibold">Standard</span>
              </div>
              <div className="bg-[#07080d] border border-white/5 p-3 rounded-xl">
                <span className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Stability</span>
                <span className="text-emerald-400 text-xs font-semibold">98.2%</span>
              </div>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              Assessor is tuned to your candidate level. Feedback scores automatically translate to global standings on completion.
            </p>
          </div>

        </div>

      </main>

    </div>
  );
}
