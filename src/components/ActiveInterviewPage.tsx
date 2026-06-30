import React, { useEffect, useState, useRef, useMemo } from "react";
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
  Tag,
  MessageSquare,
  Keyboard,
  PhoneOff,
  Settings,
  Sparkles,
  ShieldAlert
} from "lucide-react";
import { Page } from "../types";
import { 
  getBestVoiceForPersonality, 
  calculateDynamicVoiceConfig, 
  INTERVIEWER_PERSONALITIES,
  BrowserSpeechProvider,
  ElevenLabsFreeProvider,
  VoiceProvider
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
  const [voiceProvider, setVoiceProvider] = useState<"browser" | "elevenlabs" >(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mockit_voice_provider");
      if (saved === "browser" || saved === "elevenlabs") {
        return saved;
      }
    }
    return "elevenlabs";
  });
  const useElevenLabs = voiceProvider === "elevenlabs";
  const setUseElevenLabs = (val: boolean) => setVoiceProvider(val ? "elevenlabs" : "browser");

  const browserProvider = useMemo(() => new BrowserSpeechProvider(), []);
  const elevenLabsProvider = useMemo(() => new ElevenLabsFreeProvider(), []);

  // Sync voice provider changes to localStorage
  useEffect(() => {
    localStorage.setItem("mockit_voice_provider", voiceProvider);
  }, [voiceProvider]);

  // Lobby and Pre-flight state variables
  const [isLobby, setIsLobby] = useState(true);
  const [micPermission, setMicPermission] = useState<"prompt" | "granted" | "denied" | "unsupported">("prompt");
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [testingVoiceSynth, setTestingVoiceSynth] = useState(false);
  const [elevenLabsError, setElevenLabsError] = useState<string | null>(null);

  // Modern meeting layout state variables
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

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

  // Audio level analyzer for the Pre-Flight mic test
  useEffect(() => {
    if (!micStream) return;
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(micStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      let animationId: number;
      const checkVolume = () => {
        if (!isMountedRef.current) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setVoiceLevel(average);
        animationId = requestAnimationFrame(checkVolume);
      };
      
      checkVolume();
      
      return () => {
        cancelAnimationFrame(animationId);
        audioContext.close();
      };
    } catch (e) {
      console.error("Failed to initialize volume analyzer:", e);
    }
  }, [micStream]);

  // Speech recognition setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    console.log("🎙️ [Speech Recognition] Browser Support Check:", SpeechRecognition ? "SUPPORTED" : "UNSUPPORTED");
    if (typeof navigator !== "undefined") {
      console.log("🎙️ [Speech Recognition] Browser Language:", navigator.language || "unknown");
    }

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        console.log("🎙️ [Speech Recognition] onstart Event: Active listening started.");
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
          console.log(`🎙️ [Speech Recognition] onresult Event: Final Segment parsed: "${finalTranscript}"`);
          setUserInput(prev => {
            const separator = prev.trim() ? " " : "";
            return prev + separator + finalTranscript;
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.error("🎙️ [Speech Recognition] onerror Event:", event.error);
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
        console.log("🎙️ [Speech Recognition] onend Event: Active listening ended.");
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("🎙️ [Speech Recognition] Browser does not support Web Speech API SpeechRecognition.");
      setRecognitionError("Your browser does not support Speech Recognition. Please type your responses manually below.");
    }

    return () => {
      if (recognitionRef.current) {
        console.log("🎙️ [Speech Recognition] Aborting active recognition on teardown.");
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Fetch interview metadata details on mount for the Pre-Flight Lobby
  const loadInterviewDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/interviews/${interviewId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to load interview details");
      }
      
      const int = data.interview;
      setDomain(int.domain || "Technical Domain");
      setCategory(int.category || "Professional");
      setCurrentDifficulty(int.difficulty || "Intermediate");
      
      // Determine default interviewer name based on gender setup
      const defaultName = int.interviewerGender === "Female" ? "Sophia" : "James";
      setInterviewerName(defaultName);
      
    } catch (err: any) {
      console.error("Lobby load error:", err);
      setError(err.message || "Failed to fetch lobby details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    loadInterviewDetails();
    
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
      // Clean up any remaining mic test streams
      if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [interviewId]);

  // Request browser microphone permission
  const requestMicPermission = async () => {
    console.log("🎙️ [Microphone Permission] Requesting browser mic permission...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("🎙️ [Microphone Permission] SUCCESS: Microphone stream obtained successfully.");
      setMicStream(stream);
      setMicPermission("granted");
      setRecognitionError(null);
    } catch (err: any) {
      console.error("🎙️ [Microphone Permission] ERROR: Failed to get microphone stream:", err.message || err);
      setMicPermission("denied");
      setRecognitionError("Microphone permission denied. To proceed with the voice interview, please allow microphone access or switch to manual typing.");
    }
  };

  // Test ElevenLabs voice synthesis in Lobby
  const testVoiceSynthesis = async () => {
    if (testingVoiceSynth) return;
    setTestingVoiceSynth(true);
    setElevenLabsError(null);
    
    const sampleText = interviewerName === "Sophia" 
      ? "Hi! I'm Lauren, and I'll be conducting your mock interview today."
      : "Hello! I'm Evan, and I'll be your interviewer today.";
      
    try {
      await elevenLabsProvider.speak(sampleText, {
        personality: interviewerName,
        rate: speechRate,
        onError: (err) => {
          throw err;
        }
      });
    } catch (err: any) {
      console.error("Lobby voice test error:", err);
      setElevenLabsError(err.message || "Failed to contact ElevenLabs voice service. Double check your ELEVENLABS_API_KEY.");
    } finally {
      setTestingVoiceSynth(false);
    }
  };

  // Stop lobby tracking and enter actual live session room
  const enterInterviewRoom = () => {
    if (micStream) {
      micStream.getTracks().forEach(track => track.stop());
      setMicStream(null);
    }
    setVoiceLevel(0);
    setIsLobby(false);
    
    // Begin actual session loading and speaking
    startSession();
  };

  // Live session timer
  useEffect(() => {
    if (loading || isCompleted || isLobby) return;
    const interval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, isCompleted, isLobby]);

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
        },
        body: JSON.stringify({
          voiceProvider: voiceProvider,
          voiceName: voiceProvider === "elevenlabs" ? interviewerName : selectedVoiceName
        })
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
      const voiceToUse = selectedVoiceName || (bestVoice ? bestVoice.name : "");
      if (bestVoice && !selectedVoiceName) {
        setSelectedVoiceName(bestVoice.name);
      }

      // Read aloud the greeting & question using the correct voice name, passing the personality explicitly
      speakText(data.text, voiceToUse, undefined, data.interviewerName);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Could not initialize interview");
    } finally {
      setLoading(false);
    }
  };

  // Speaks text aloud using our modular provider architecture (Browser / ElevenLabs with automatic fallback)
  const speakText = async (text: string, overrideVoiceName?: string, overrideRate?: number, overridePersonality?: string) => {
    if (!isMountedRef.current) return;
    if (isMuted) return;

    const activeInterviewer = overridePersonality || interviewerName;
    console.log("🔊 [Voice Output] speakText starting...");
    console.log(`- Text segment: "${text.substring(0, 80)}${text.length > 80 ? "..." : ""}"`);
    console.log(`- Selected Provider: "${voiceProvider}"`);
    console.log(`- Active Interviewer Persona: "${activeInterviewer}"`);
    console.log(`- Speech Rate: ${overrideRate !== undefined ? overrideRate : speechRate}`);

    // Stop any current speaking in both providers
    browserProvider.cancel();
    elevenLabsProvider.cancel();
    setIsSpeaking(false);
    setElevenLabsError(null);

    try {
      setIsSpeaking(true);
      const providerToUse = voiceProvider === "elevenlabs" ? elevenLabsProvider : browserProvider;

      await providerToUse.speak(text, {
        personality: activeInterviewer,
        rate: overrideRate !== undefined ? overrideRate : speechRate,
        voiceName: overrideVoiceName || selectedVoiceName,
        onStart: () => {
          console.log(`🔊 [Voice Output] STARTED audio playback using provider "${providerToUse.id}"`);
          setIsSpeaking(true);
        },
        onEnd: () => {
          console.log(`🔊 [Voice Output] COMPLETED audio playback using provider "${providerToUse.id}"`);
          setIsSpeaking(false);
        },
        onError: async (err) => {
          console.error(`❌ [Voice Output] ERROR during playback with provider "${providerToUse.id}":`, err.message || err);
          setIsSpeaking(false);

          if (providerToUse.id === "elevenlabs") {
            const friendlyMsg = `ElevenLabs is currently unavailable (Details: ${err.message || "Network Error"}). Switched to Browser Voice.`;
            setElevenLabsError(friendlyMsg);
            
            // Automatically fall back to Browser speech synthesis
            console.warn("🔊 [Voice Output] Falling back to Default Browser Voice SpeechSynthesis...");
            setVoiceProvider("browser");
            
            try {
              setIsSpeaking(true);
              await browserProvider.speak(text, {
                personality: activeInterviewer,
                rate: overrideRate !== undefined ? overrideRate : speechRate,
                voiceName: selectedVoiceName,
                onStart: () => {
                  console.log("🔊 [Voice Output] STARTED audio playback using fallback Browser voice.");
                  setIsSpeaking(true);
                },
                onEnd: () => {
                  console.log("🔊 [Voice Output] COMPLETED audio playback using fallback Browser voice.");
                  setIsSpeaking(false);
                },
                onError: (fallbackErr) => {
                  console.error("❌ [Voice Output] ERROR during fallback Browser voice playback:", fallbackErr);
                  setIsSpeaking(false);
                }
              });
            } catch (fallbackErr) {
              console.error("❌ [Voice Output] EXCEPTION during browser fallback execution:", fallbackErr);
              setIsSpeaking(false);
            }
          } else {
            setElevenLabsError(err.message || "Speech synthesis failed.");
          }
        }
      });
    } catch (err: any) {
      console.error("❌ [Voice Output] speakText caught high-level exception:", err);
      setIsSpeaking(false);
    }
  };

  // Toggle microphone listening
  const toggleListening = () => {
    console.log("🎙️ [Speech Recognition] Toggle clicked. Current state (isListening):", isListening);
    if (!recognitionRef.current) {
      console.warn("🎙️ [Speech Recognition] Cannot toggle listening: recognitionRef.current is not initialized.");
      setRecognitionError("Speech-to-text is not supported or was not initialized in this browser.");
      return;
    }

    if (isListening) {
      console.log("🎙️ [Speech Recognition] Stopping active listening session...");
      recognitionRef.current.stop();
    } else {
      setRecognitionError(null);
      try {
        console.log("🎙️ [Speech Recognition] Starting active listening session...");
        recognitionRef.current.start();
      } catch (err) {
        console.error("🎙️ [Speech Recognition] EXCEPTION during recognitionRef.start():", err);
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
    <div className={`${isLobby ? "min-h-screen overflow-y-auto scroll-smooth" : "h-screen overflow-hidden"} bg-[#07080d] text-gray-100 font-sans flex flex-col justify-between relative`} id="active-interview-root">
      
      {/* Background ambient radial glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none" />

      {/* ==================== 1. PRE-FLIGHT LOBBY ENTRY SCREEN ==================== */}
      {isLobby ? (
        <div className="min-h-screen bg-[#07080d] text-gray-100 font-sans flex flex-col justify-between pb-12 relative overflow-visible" id="interview-lobby-root">
          <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-600/5 rounded-full blur-[140px] pointer-events-none" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[140px] pointer-events-none" />

          {/* Minimal header */}
          <nav className="bg-[#0b0c13]/80 border-b border-white/5 py-4 px-6 md:px-12 backdrop-blur-md sticky top-0 z-40">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate("dashboard")}>
                <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 p-2 rounded-xl shadow-md">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <span className="font-display font-extrabold text-xl tracking-tight text-white">Mockit</span>
              </div>
              
              <button
                onClick={() => onNavigate("dashboard")}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border border-white/5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Exit to Dashboard
              </button>
            </div>
          </nav>

          {/* Main Lobby Space */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 md:py-12 flex flex-col justify-start relative z-10">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full text-[10px] font-mono uppercase tracking-widest font-black mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                Pre-Flight Secure Entry
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white font-sans">
                AI Interview Room Entrance
              </h1>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                Before entering, verify your microphone input and configure the AI voice synthesis engine to guarantee a realistic conversational experience.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Box: Mic check */}
              <div className="lg:col-span-7 bg-[#0b0c13] border border-white/5 rounded-2xl p-6 space-y-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <Mic className="w-4 h-4 text-purple-400" />
                    Step 1: Verify Microphone Input
                  </h3>
                  <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    micPermission === "granted" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-red-500/15 text-red-400 border border-red-500/20"
                  }`}>
                    {micPermission === "granted" ? "Verified" : "Action Required"}
                  </span>
                </div>

                {/* Visualized feedback feed box (16:9 meeting style) */}
                <div className="bg-[#07080d] border border-white/5 rounded-xl aspect-[16/9] flex flex-col items-center justify-center p-6 relative overflow-hidden shadow-inner">
                  {micPermission === "granted" ? (
                    <div className="flex flex-col items-center justify-center space-y-6 w-full h-full relative z-10">
                      <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 relative">
                        {/* Pulsing ring animation based on voice level */}
                        <span className="absolute inset-0 bg-emerald-500/5 rounded-full animate-ping pointer-events-none" />
                        <Mic className="w-8 h-8" />
                      </div>
                      
                      <div className="text-center space-y-1">
                        <p className="text-sm text-white font-bold">Microphone Connected Successfully</p>
                        <p className="text-xs text-gray-400">Speak into your mic to test the real-time sound calibration.</p>
                      </div>

                      {/* Equalizer bars representing volume */}
                      <div className="flex items-end justify-center gap-1.5 h-10 w-48 bg-[#0b0c13]/60 px-4 py-2 rounded-xl border border-white/5">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((bar) => {
                          const scale = voiceLevel > 1 ? voiceLevel : 3;
                          const heightPercent = Math.min(100, Math.max(10, (scale * (bar % 3 === 0 ? 1.5 : 1.1) * 3)));
                          return (
                            <span 
                              key={bar} 
                              className="w-1.5 bg-gradient-to-t from-emerald-500 to-teal-400 rounded-full transition-all duration-75"
                              style={{ height: `${heightPercent}%` }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-4 max-w-sm text-center relative z-10">
                      <div className="w-16 h-16 rounded-full bg-purple-500/15 flex items-center justify-center text-purple-400">
                        <MicOff className="w-6 h-6 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-white">Microphone Clearance Required</p>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          To converse with Sophia or James, Mockit requires microphone authorization. Please click the button below to grant permission.
                        </p>
                      </div>
                      <button
                        onClick={requestMicPermission}
                        className="px-5 py-2.5 bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-purple-600/10 cursor-pointer hover:scale-[1.02]"
                      >
                        <Mic className="w-4 h-4" />
                        Grant Microphone Access
                      </button>
                    </div>
                  )}
                </div>

                {/* Google Chrome embed limitation alert banner */}
                <div className="bg-amber-500/5 border border-amber-500/15 p-4 rounded-xl space-y-2.5">
                  <div className="flex items-start gap-2.5 text-amber-400">
                    <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-bold">Google Chrome Iframe Restrictions</p>
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        If you are viewing this app inside the Google AI Studio preview window, Chrome security policy blocks the network-based Web Speech API. For full hands-free voice control, please open this app in a separate browser tab.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                    <a 
                      href={window.location.href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-white rounded-lg text-[10px] font-bold transition-all border border-amber-500/20 inline-flex items-center gap-1 cursor-pointer"
                    >
                      Open in New Tab
                    </a>
                    <span className="text-[10px] text-gray-500">or proceed inside the frame and use manual keyboard typing as a fallback.</span>
                  </div>
                </div>
              </div>

              {/* Right Box: Setup & Voice Configuration */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Interview Setup Summary Card */}
                <div className="bg-[#0b0c13] border border-white/5 rounded-2xl p-6 space-y-4 shadow-xl">
                  <h3 className="font-bold text-white text-base flex items-center gap-2 border-b border-white/5 pb-3">
                    <Sliders className="w-4 h-4 text-purple-400" />
                    Interview Parameters
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center bg-[#07080d] p-3 rounded-xl border border-white/5">
                      <span className="text-xs text-gray-400">Interviewer Assessor</span>
                      <span className="text-xs font-bold text-purple-400 flex items-center gap-1">
                        {interviewerName === "Sophia" ? "Sophia (Female Lead)" : "James (Male VP)"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-[#07080d] p-3 rounded-xl border border-white/5">
                      <span className="text-xs text-gray-400">Domain / Focus Area</span>
                      <span className="text-xs font-bold text-white">{domain}</span>
                    </div>
                    <div className="flex justify-between items-center bg-[#07080d] p-3 rounded-xl border border-white/5">
                      <span className="text-xs text-gray-400">Pacing Level</span>
                      <span className="text-xs font-bold text-white uppercase tracking-wider">{currentDifficulty}</span>
                    </div>
                    <div className="flex justify-between items-center bg-[#07080d] p-3 rounded-xl border border-white/5">
                      <span className="text-xs text-gray-400">Target Category</span>
                      <span className="text-xs font-bold text-white">{category}</span>
                    </div>
                  </div>
                </div>

                {/* Voice Synthesizer Configuration Card */}
                <div className="bg-[#0b0c13] border border-white/5 rounded-2xl p-6 space-y-5 shadow-xl">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="font-bold text-white text-base flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-purple-400" />
                      Step 2: Voice Customization
                    </h3>
                  </div>

                  {/* Provider Grid Selector */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceProvider("browser");
                        setElevenLabsError(null);
                      }}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        voiceProvider === "browser"
                          ? "bg-purple-500/10 border-purple-500 text-white animate-pulse-subtle"
                          : "bg-[#07080d] border-white/5 text-gray-400 hover:border-white/10"
                      }`}
                    >
                      <span className="text-xs font-extrabold block mb-1">Browser Voice (Free)</span>
                      <span className="text-[9px] text-gray-400 block leading-tight">
                        Uses standard browser SpeechSynthesis. Always available, zero-config.
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setVoiceProvider("elevenlabs");
                        setElevenLabsError(null);
                      }}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                        voiceProvider === "elevenlabs"
                          ? "bg-purple-500/10 border-purple-500 text-white animate-pulse-subtle"
                          : "bg-[#07080d] border-white/5 text-gray-400 hover:border-white/10"
                      }`}
                    >
                      <span className="text-xs font-extrabold block mb-1">ElevenLabs (Free Tier)</span>
                      <span className="text-[9px] text-gray-400 block leading-tight">
                        Ultra-realistic AI voice synthesis using pre-made free tier voices.
                      </span>
                    </button>
                  </div>

                  {/* Test Voice Button & Errors for ElevenLabs */}
                  {useElevenLabs && (
                    <div className="space-y-3.5">
                      <button
                        type="button"
                        onClick={testVoiceSynthesis}
                        disabled={testingVoiceSynth}
                        className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all border border-white/5 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {testingVoiceSynth ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                            Previewing voice...
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 text-purple-400" />
                            Preview Voice
                          </>
                        )}
                      </button>

                      {/* Audio controller holder (hidden) */}
                      <audio ref={audioRef} className="hidden" />

                      {/* ElevenLabs API Key validation indicator error block */}
                      {elevenLabsError && (
                        <div className="bg-red-500/10 border border-red-500/20 p-3.5 rounded-xl space-y-2.5 shadow-md">
                          <div className="flex items-start gap-2 text-red-400">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <p className="text-xs font-bold">Voice Synthesis Error</p>
                              <p className="text-[10px] text-gray-400 leading-normal">
                                {elevenLabsError}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setVoiceProvider("browser");
                              setElevenLabsError(null);
                            }}
                            className="px-3 py-1.5 bg-red-500/15 hover:bg-red-500/25 text-white rounded-lg text-[9px] font-bold border border-red-500/25 cursor-pointer transition-colors"
                          >
                            Switch to Default Browser Voice
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* System TTS Settings (If ElevenLabs disabled) */}
                  {!useElevenLabs && (
                    <div className="space-y-3 pt-1">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                          Select Fallback Browser Voice
                        </label>
                        {availableVoices.length === 0 ? (
                          <span className="text-[11px] text-gray-500 italic block">
                            Waiting for Chrome to load system voices...
                          </span>
                        ) : (
                          <select
                            value={selectedVoiceName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSelectedVoiceName(val);
                              localStorage.setItem(`mockit_selected_voice_${interviewerName}`, val);
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

                      <div className="space-y-1.5 pt-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-gray-400">Voice Pitch Speed</span>
                          <span className="text-purple-400 font-bold">{speechRate}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.1"
                          value={speechRate}
                          onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                          className="w-full h-1 bg-[#07080d] accent-purple-500 rounded-lg cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Connect lobby bottom bar */}
            <div className="mt-12 flex flex-col items-center justify-center space-y-4 border-t border-white/5 pt-8">
              <button
                onClick={enterInterviewRoom}
                disabled={micPermission !== "granted" && micPermission !== "denied"}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-indigo-700 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm rounded-xl transition-all shadow-xl shadow-purple-600/10 flex items-center gap-2 cursor-pointer hover:scale-[1.03] disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 animate-spin [animation-duration:4s]" />
                Connect & Enter Interview Room
              </button>
              
              {micPermission !== "granted" && (
                <p className="text-xs text-gray-500">
                  You can bypass microphone connection and type manually if you prefer.
                </p>
              )}
            </div>
          </main>
        </div>
      ) : (
        // ==================== 2. REDESIGNED INTERVIEW ROOM WORKSPACE ====================
        <div className="h-screen bg-[#07080d] text-gray-100 font-sans flex flex-col justify-between relative overflow-hidden" id="active-interview-inner">
          
          {/* Header bar showing only details requested */}
          <header className="bg-[#0b0c13] border-b border-white/5 py-3 px-6 z-40">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleAbort}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 transition-all cursor-pointer text-gray-400 hover:text-white"
                  title="Abort interview and back to dashboard"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-white text-sm tracking-tight">Active Mock Interview</span>
                    <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-mono font-black animate-pulse flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                      SECURE LIVE FEED
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">Assessed by AI Recruiter <span className="text-purple-400 font-semibold">{interviewerName}</span></p>
                </div>
              </div>

              {/* Centered minimal details specified in prompt */}
              <div className="hidden md:flex items-center gap-3 bg-[#07080d]/80 border border-white/5 px-4 py-2 rounded-xl">
                <div className="flex items-center gap-1.5 text-xs text-gray-300 font-medium">
                  <span className="text-gray-500 text-[10px] bg-white/5 px-1.5 py-0.5 rounded">{category}</span>
                  <span className="text-gray-500">/</span>
                  <span className="text-purple-300 font-bold">{domain}</span>
                  <span className="text-gray-500">/</span>
                  <span className="text-xs text-gray-400">Interviewer: {interviewerName === "Sophia" ? "Female" : "Male"}</span>
                  <span className="text-gray-500">/</span>
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    currentDifficulty === "Advanced" ? "bg-red-500/10 text-red-400 border border-red-500/15" :
                    currentDifficulty === "Intermediate" ? "bg-amber-500/10 text-amber-400 border border-amber-500/15" :
                    "bg-indigo-500/10 text-indigo-400 border border-indigo-500/15"
                  }`}>
                    {currentDifficulty}
                  </span>
                </div>
                
                {/* Clock Timer */}
                <div className="border-l border-white/5 pl-3 flex items-center gap-1.5 text-gray-300 font-mono text-xs">
                  <Timer className="w-3.5 h-3.5 text-purple-400" />
                  <span className="font-bold text-white">
                    {formatTime(elapsedSeconds)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Toggle chat history panel */}
                <button
                  onClick={() => setIsSidebarOpen(prev => !prev)}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer relative flex items-center gap-1.5 text-xs font-semibold ${
                    isSidebarOpen 
                      ? "bg-purple-600/10 text-purple-400 border-purple-500/30" 
                      : "bg-white/5 text-gray-300 border-white/5 hover:bg-white/10"
                  }`}
                  title="Show Transcript & Live Feedback Chat"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Meeting Chat</span>
                  {history.length > 1 && (
                    <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-[#07080d]">
                      {history.length}
                    </span>
                  )}
                </button>
              </div>

            </div>
          </header>

          {/* Main interactive screen workspace */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-4 flex gap-6 overflow-hidden relative z-10">
            
            {/* Left Area: Main centered Interview stage (Google Meet Tile) */}
            <div className="flex-1 flex flex-col justify-between h-full relative">
              
              {/* Active Question Badge (Float top of the video feed) */}
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-[#0b0c13]/90 border border-white/5 rounded-lg px-3 py-1.5 backdrop-blur-md">
                <span className="text-[10px] bg-purple-500/20 border border-purple-500/30 text-purple-400 px-2 py-0.5 rounded font-black">
                  Q {currentQuestionIndex + 1} of {maxQuestions}
                </span>
                <span className="text-[10px] text-gray-400 font-medium">Adaptive Calibration Session</span>
              </div>

              {/* Center Space: Large AI Video-Like Assessor Feed Card */}
              <div className="flex-1 bg-[#0b0c13] border border-white/5 rounded-2xl relative overflow-hidden flex flex-col justify-between p-6 shadow-2xl">
                <div className="absolute top-0 right-0 w-48 h-48 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

                {/* Complete Performance Results Overlay */}
                {isCompleted ? (
                  <div className="absolute inset-0 bg-[#0b0c13]/98 flex flex-col items-center justify-center p-6 space-y-6 text-center z-30">
                    <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                      <CheckCircle2 className="w-8 h-8 animate-bounce" />
                    </div>
                    <div className="space-y-1.5 max-w-md">
                      <h3 className="font-display font-extrabold text-white text-2xl">Interview Completed</h3>
                      <p className="text-xs text-gray-400 leading-relaxed">
                        Your response metrics have been compiled and evaluated by Sophia and the adaptive platform. Your results are live.
                      </p>
                    </div>

                    <div className="max-w-xs w-full bg-[#07080d] border border-white/5 rounded-xl p-4 flex items-center justify-between">
                      <span className="text-xs text-gray-400 font-medium">Consolidated Score:</span>
                      <span className="font-display font-black text-3xl text-emerald-400 tracking-tight">{overallScore}%</span>
                    </div>

                    <button
                      onClick={() => onNavigate("dashboard")}
                      className="bg-white hover:bg-gray-100 text-slate-950 font-extrabold px-6 py-3 rounded-xl text-xs transition-all cursor-pointer shadow-lg inline-flex items-center gap-1.5 hover:scale-[1.02]"
                    >
                      Return to Dashboard
                    </button>
                  </div>
                ) : null}

                {/* AI speaking / listening errors display block */}
                {elevenLabsError && (
                  <div className="absolute top-16 left-4 right-4 z-20 bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3.5 rounded-xl flex items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                      <div className="space-y-0.5">
                        <p className="font-bold text-white text-xs">Premium Voice AI Offline</p>
                        <p className="text-gray-400 text-[11px] leading-relaxed">{elevenLabsError}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setUseElevenLabs(false);
                        setElevenLabsError(null);
                        if (currentQuestionText) speakText(currentQuestionText, undefined, undefined);
                      }}
                      className="bg-red-500/20 hover:bg-red-500/30 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] border border-red-500/20 transition-all whitespace-nowrap cursor-pointer"
                    >
                      Fallback to Browser Voice
                    </button>
                  </div>
                )}

                {/* Speech recognition errors block */}
                {recognitionError && !elevenLabsError && (
                  <div className="absolute top-16 left-4 right-4 z-20 bg-red-500/15 border border-red-500/20 text-red-400 text-xs p-3.5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-400" />
                      <span className="leading-relaxed">{recognitionError}</span>
                    </div>
                    <a 
                      href={window.location.href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-red-500/20 hover:bg-red-500/30 text-white font-bold px-3 py-1.5 rounded-lg text-[10px] transition-all whitespace-nowrap text-center inline-block cursor-pointer border border-red-500/20"
                    >
                      Open in New Tab
                    </a>
                  </div>
                )}

                {/* Absolute Center: Assessor Live Orb (Meeting Avatar Feed) */}
                <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                  
                  {/* Orb Wrapper */}
                  <div className="relative">
                    
                    {/* Glowing Concentric rings for active AI actions */}
                    {isSpeaking && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-36 h-36 bg-purple-500/10 rounded-full animate-ping absolute" />
                        <div className="w-48 h-48 bg-indigo-500/10 rounded-full animate-ping absolute [animation-delay:0.5s]" />
                      </div>
                    )}

                    {isListening && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-36 h-36 bg-emerald-500/15 rounded-full animate-ping absolute" />
                        <div className="w-48 h-48 bg-teal-500/10 rounded-full animate-ping absolute [animation-delay:0.5s]" />
                      </div>
                    )}

                    {isEvaluating && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-40 h-40 border border-purple-500/20 rounded-full animate-spin absolute [animation-duration:3s]" />
                        <div className="w-44 h-44 border border-dashed border-indigo-500/15 rounded-full animate-spin absolute [animation-duration:8s] [animation-direction:reverse]" />
                      </div>
                    )}

                    {/* Main Orb Body */}
                    <div className={`w-28 h-28 rounded-full flex flex-col items-center justify-center font-display text-3xl font-black text-white relative shadow-2xl transition-all duration-500 border border-white/5 ${
                      isListening
                        ? "bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-500 shadow-emerald-500/20 scale-105"
                        : isEvaluating
                        ? "bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-indigo-500/20 animate-pulse"
                        : isSpeaking
                        ? "bg-gradient-to-tr from-purple-600 via-pink-600 to-indigo-600 shadow-purple-600/20 scale-105"
                        : "bg-[#07080d] border border-white/10"
                    }`}>
                      {interviewerName[0]}

                      {/* Equalizer animation overlays */}
                      {isSpeaking && (
                        <div className="absolute bottom-4 flex gap-0.5 items-center justify-center">
                          <span className="w-0.5 h-2 bg-white/70 rounded-full animate-bounce [animation-duration:0.6s]" />
                          <span className="w-0.5 h-3 bg-white/90 rounded-full animate-bounce [animation-duration:0.4s]" />
                          <span className="w-0.5 h-1.5 bg-white/50 rounded-full animate-bounce [animation-duration:0.8s]" />
                        </div>
                      )}
                    </div>

                    {/* Miniature status badge overlay on Orb bottom-right */}
                    <div className={`absolute bottom-0 right-1 w-6 h-6 rounded-full border-2 border-[#0b0c13] flex items-center justify-center shadow-lg transition-colors ${
                      isListening ? "bg-emerald-500 text-white" :
                      isEvaluating ? "bg-indigo-500 text-white" :
                      isSpeaking ? "bg-purple-500 text-white" : "bg-gray-700 text-gray-400"
                    }`}>
                      {isListening ? <Mic className="w-3 h-3" /> :
                       isEvaluating ? <Brain className="w-3 h-3" /> :
                       isSpeaking ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                    </div>
                  </div>

                  {/* Status Label */}
                  <div className="text-center space-y-1 z-10">
                    <div className="text-xs font-mono uppercase tracking-widest text-gray-500 font-bold">
                      Assessor Feedback Frame
                    </div>
                    <h4 className="text-base font-extrabold text-white">
                      {isListening ? (
                        <span className="text-emerald-400 flex items-center gap-1.5 justify-center">
                          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                          Listening - Speak Now
                        </span>
                      ) : isEvaluating ? (
                        <span className="text-indigo-400 flex items-center gap-1.5 justify-center">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Assessing answer metrics...
                        </span>
                      ) : isSpeaking ? (
                        <span className="text-purple-400 flex items-center gap-1.5 justify-center">
                          <span className="w-2 h-2 bg-purple-500 rounded-full animate-ping" />
                          {interviewerName} is speaking...
                        </span>
                      ) : (
                        <span className="text-gray-400">Idle - Click Microphone to Respond</span>
                      )}
                    </h4>
                  </div>
                </div>

                {/* Redesigned bottom section overlay: Subtitles / Closed Captions */}
                <div className="bg-[#07080d]/80 backdrop-blur border border-white/5 rounded-xl p-4 flex gap-3 items-start w-full relative z-10 shadow-lg">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-white/5 border border-white/10 px-2 py-0.5 rounded text-gray-400 flex items-center gap-1 mt-0.5">
                    CC
                  </span>
                  <div className="flex-1 space-y-1">
                    {isSpeaking ? (
                      <p className="text-sm text-purple-200 leading-relaxed font-medium">
                        {currentQuestionText}
                      </p>
                    ) : isListening && userInput ? (
                      <p className="text-sm text-emerald-200 leading-relaxed font-sans italic">
                        "{userInput}"
                      </p>
                    ) : isListening ? (
                      <p className="text-xs text-gray-500 italic">
                        Waiting for speech transcription... (You can also type by click the keyboard icon below)
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 leading-relaxed">
                        {currentQuestionText || "Calibration completed. Begin by activating your mic stream."}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Collapsible Manual Input Panel (Floating below virtual meeting feed) */}
              {isKeyboardOpen && !isCompleted && (
                <div className="mt-4 bg-[#0b0c13] border border-purple-500/20 p-4 rounded-xl shadow-xl flex gap-3 items-center relative z-20">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Type or correct your transcribed response manually here..."
                    disabled={isEvaluating}
                    className="flex-1 bg-[#07080d] border border-white/5 focus:border-purple-500/50 rounded-lg px-4 py-3 text-sm text-gray-200 outline-none transition-all placeholder:text-gray-600 disabled:opacity-50"
                  />
                  {userInput.trim() && (
                    <button
                      onClick={() => handleSendResponse()}
                      disabled={isEvaluating}
                      className="bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-lg transition-colors shadow-lg cursor-pointer disabled:opacity-50 flex items-center justify-center flex-shrink-0"
                      title="Submit Response"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Centered Horizontal Toolbar (Google Meet/Teams Style) */}
              <div className="py-4 flex justify-center">
                <div className="bg-[#0b0c13] border border-white/5 rounded-full px-5 py-3 flex items-center gap-4.5 shadow-2xl relative z-20">
                  
                  {/* 1. Mute/Voice Control */}
                  <button
                    onClick={() => {
                      const nextVal = !useElevenLabs;
                      setUseElevenLabs(nextVal);
                      setElevenLabsError(null);
                      if (currentQuestionText) speakText(currentQuestionText, undefined, undefined);
                    }}
                    className={`p-2.5 rounded-full border transition-all cursor-pointer ${
                      useElevenLabs 
                        ? "bg-purple-600/10 text-purple-400 border-purple-500/20 hover:bg-purple-600/15" 
                        : "bg-white/5 text-gray-400 border-white/5 hover:bg-white/10"
                    }`}
                    title={useElevenLabs ? "ElevenLabs Active (Expressive)" : "System Default (Standard)"}
                  >
                    {useElevenLabs ? <Volume2 className="w-4.5 h-4.5" /> : <VolumeX className="w-4.5 h-4.5" />}
                  </button>

                  {/* 2. Replay Last Question */}
                  <button
                    onClick={() => currentQuestionText && speakText(currentQuestionText)}
                    className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5 rounded-full transition-all cursor-pointer"
                    title="Replay Voice Question"
                    disabled={isCompleted}
                  >
                    <RotateCcw className="w-4.5 h-4.5" />
                  </button>

                  {/* 3. Primary Microphone Toggle Button (Large in center) */}
                  <button
                    onClick={toggleListening}
                    disabled={isCompleted}
                    className={`w-14 h-14 rounded-full flex items-center justify-center border shadow-xl transition-all duration-300 cursor-pointer disabled:opacity-50 ${
                      isListening
                        ? "bg-red-500 border-red-600 text-white scale-105 shadow-red-500/20 hover:bg-red-600 animate-pulse"
                        : "bg-purple-600 border-purple-500 text-white hover:bg-purple-500 hover:scale-105 shadow-purple-600/10"
                    }`}
                    title={isListening ? "Pause Voice Capture" : "Activate Microphone"}
                  >
                    {isListening ? (
                      <MicOff className="w-5.5 h-5.5" />
                    ) : (
                      <Mic className="w-5.5 h-5.5" />
                    )}
                  </button>

                  {/* 4. Manual Input Form Toggle */}
                  <button
                    onClick={() => setIsKeyboardOpen(prev => !prev)}
                    className={`p-2.5 rounded-full border transition-all cursor-pointer ${
                      isKeyboardOpen 
                        ? "bg-indigo-600/15 text-indigo-400 border-indigo-500/20" 
                        : "bg-white/5 text-gray-400 border-white/5 hover:bg-white/10"
                    }`}
                    title="Toggle Manual Keyboard Entry"
                    disabled={isCompleted}
                  >
                    <Keyboard className="w-4.5 h-4.5" />
                  </button>

                  {/* Divider */}
                  <span className="w-[1px] h-6 bg-white/10" />

                  {/* 5. End Early Hang up Button (Crimson) */}
                  <button
                    onClick={handleAbort}
                    className="p-3 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 rounded-full transition-all cursor-pointer shadow-lg hover:shadow-red-500/10 flex items-center justify-center"
                    title="End Interview early"
                  >
                    <PhoneOff className="w-4.5 h-4.5" />
                  </button>

                </div>
              </div>
            </div>

            {/* Right Area: Collapsible Transcript Sidebar Drawer (Slide out meeting chat) */}
            {isSidebarOpen && (
              <div className="w-80 md:w-96 bg-[#0b0c13] border-l border-white/5 flex flex-col justify-between h-full relative z-30 shadow-2xl animate-[slideIn_0.25s_ease-out]">
                
                {/* Sidebar Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#10111a]">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4.5 h-4.5 text-purple-400" />
                    <span className="font-extrabold text-sm text-white">Meeting Chat & Scores</span>
                  </div>
                  <button 
                    onClick={() => setIsSidebarOpen(false)}
                    className="text-xs text-gray-500 hover:text-white bg-white/5 px-2 py-1 rounded transition-colors cursor-pointer"
                  >
                    Hide Panel
                  </button>
                </div>

                {/* Sidebar Feed */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
                  
                  {/* Adaptive path badge indicator */}
                  <div className="p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl text-[10px] text-gray-400 leading-relaxed space-y-1">
                    <p className="font-bold text-purple-300">Sophia's Adaptive Engine Pacing:</p>
                    <p>Metrics adapt to individual accuracy. Strong answers elevate core category syntax questions.</p>
                  </div>

                  {history.map((msg, idx) => (
                    <div 
                      key={idx}
                      className={`flex flex-col gap-1 max-w-[95%] ${msg.role === "candidate" ? "ml-auto text-right" : "mr-auto text-left"}`}
                    >
                      <span className="text-[9px] font-mono text-gray-500">
                        {msg.role === "candidate" ? "Candidate" : `${interviewerName} (Assessor)`}
                      </span>
                      
                      <div className={`p-3 rounded-xl text-xs leading-relaxed ${
                        msg.role === "candidate"
                          ? "bg-purple-600/10 text-purple-100 rounded-tr-none border border-purple-500/20 text-left ml-auto"
                          : "bg-[#07080d] text-gray-300 rounded-tl-none border border-white/5 text-left mr-auto"
                      }`}>
                        {msg.text}
                      </div>

                      {/* Rating / Real-time score details */}
                      {msg.role === "candidate" && msg.score !== undefined && (
                        <div className="bg-purple-500/5 border border-purple-500/10 rounded-lg p-2.5 text-[11px] space-y-1 mt-1 text-left">
                          <div className="flex items-center justify-between">
                            <span className="text-purple-400 font-bold flex items-center gap-1 text-[10px]">
                              <Activity className="w-3 h-3" />
                              Evaluation Metric
                            </span>
                            <span className={`font-mono font-black text-[10px] px-1 rounded ${
                              msg.score >= 80 ? "bg-emerald-500/10 text-emerald-400" :
                              msg.score >= 60 ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"
                            }`}>
                              {msg.score}/100
                            </span>
                          </div>
                          <p className="text-gray-400 italic text-[11px] leading-relaxed">
                            "{msg.feedback}"
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <div ref={historyEndRef} />
                </div>

                {/* Sidebar quick footer summary */}
                <div className="p-4 bg-[#10111a] border-t border-white/5 text-[10px] text-gray-500 text-center leading-relaxed">
                  Real-time calibration active. Scores are calculated using structural semantic grammar algorithms.
                </div>

              </div>
            )}

          </main>

        </div>
      )}
    </div>
  );
}
