export interface InterviewerPersonality {
  id: string;
  name: string;
  title: string;
  description: string;
  gender: "Male" | "Female";
  defaultRate: number;
  defaultPitch: number;
  voiceKeywords: string[];
}

export const INTERVIEWER_PERSONALITIES: Record<string, InterviewerPersonality> = {
  Sophia: {
    id: "sophia",
    name: "Sophia",
    title: "Staff Lead Engineer",
    description: "A thorough, empathetic lead engineer who focuses deeply on clean design, trade-offs, scalability, and code hygiene.",
    gender: "Female",
    defaultRate: 1.0,
    defaultPitch: 1.0,
    voiceKeywords: [
      "samantha",
      "zira",
      "female",
      "susan",
      "hazel",
      "heather",
      "karen",
      "moira",
      "tessa",
      "veena",
      "fiona",
      "google us english"
    ]
  },
  James: {
    id: "james",
    name: "James",
    title: "VP Executive Recruiter",
    description: "An executive recruiter with an objective, fast-paced evaluation style, prioritizing direct commercial outcomes and structured STAR story methods.",
    gender: "Male",
    defaultRate: 1.0,
    defaultPitch: 0.95,
    voiceKeywords: [
      "daniel",
      "david",
      "male",
      "alex",
      "guy",
      "ravi",
      "en-in",
      "microsoft david",
      "google us english"
    ]
  },
  // Future extension personalities can be easily added here
  Rohan: {
    id: "rohan",
    name: "Rohan",
    title: "Technical Architect (Senior Mentor)",
    description: "A friendly, warm system architect with a soft, supportive Indian English accent. Focuses on data structures and scalability.",
    gender: "Male",
    defaultRate: 0.95,
    defaultPitch: 1.0,
    voiceKeywords: [
      "ravi",
      "heera",
      "en-in",
      "daniel",
      "david",
      "google uk english male",
      "alex"
    ]
  }
};

export interface VoiceSynthesisConfig {
  rate: number;
  pitch: number;
  voice: SpeechSynthesisVoice | null;
}

/**
 * Finds the optimal voice for a given interviewer personality from available system voices.
 */
export function getBestVoiceForPersonality(
  personalityName: string,
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | null {
  if (!voices || voices.length === 0) return null;

  const personality = INTERVIEWER_PERSONALITIES[personalityName] || INTERVIEWER_PERSONALITIES.Sophia;
  const isFemale = personality.gender === "Female";

  // 1. Try matching high-priority custom keywords for the personality
  for (const keyword of personality.voiceKeywords) {
    const matched = voices.find(v => {
      const name = v.name.toLowerCase();
      const lang = v.lang.toLowerCase();
      return lang.startsWith("en") && name.includes(keyword);
    });
    if (matched) return matched;
  }

  // 2. Try general matching by gender keywords if specific ones didn't match
  const fallbackGenderMatched = voices.find(v => {
    const name = v.name.toLowerCase();
    const lang = v.lang.toLowerCase();
    const isEn = lang.startsWith("en");
    if (!isEn) return false;
    
    if (isFemale) {
      return name.includes("female") || name.includes("zira") || name.includes("samantha") || (name.includes("google") && !name.includes("male"));
    } else {
      return name.includes("male") || name.includes("david") || name.includes("daniel") || (name.includes("google") && !name.includes("female"));
    }
  });

  if (fallbackGenderMatched) return fallbackGenderMatched;

  // 3. Fallback to any English voice
  const englishVoice = voices.find(v => v.lang.toLowerCase().startsWith("en"));
  if (englishVoice) return englishVoice;

  // 4. Ultimate fallback
  return voices[0];
}

/**
 * Computes dynamic speaking settings (rate & pitch variations) for human voice behaviour.
 */
export function calculateDynamicVoiceConfig(
  text: string,
  baseRate: number,
  personalityName: string
): { rate: number; pitch: number } {
  const personality = INTERVIEWER_PERSONALITIES[personalityName] || INTERVIEWER_PERSONALITIES.Sophia;
  const lowerText = text.toLowerCase();
  
  let rate = baseRate * personality.defaultRate;
  let pitch = personality.defaultPitch;

  // Sound slow, warm, and highly reassuring during encouragement phrases
  const isEncouraging = lowerText.includes("take your time") || 
                        lowerText.includes("no worries") || 
                        lowerText.includes("doing well") || 
                        lowerText.includes("koi baat nahi") || 
                        lowerText.includes("bilkul") || 
                        lowerText.includes("theek hai") ||
                        lowerText.includes("relax");

  // Sound focused, crisp, analytical during technical terms or probing
  const isAnalytical = lowerText.includes("explain") || 
                       lowerText.includes("complexity") || 
                       lowerText.includes("architecture") || 
                       lowerText.includes("trade-off") || 
                       lowerText.includes("how does") || 
                       lowerText.includes("why did") ||
                       lowerText.includes("deep dive");

  // Sound slightly hesitant or reflective if starting with a filler word to show human consideration
  const isThoughtful = lowerText.startsWith("hmm") ||
                        lowerText.startsWith("alright") ||
                        lowerText.startsWith("interesting") ||
                        lowerText.startsWith("okay");

  if (isEncouraging) {
    rate = Math.max(0.85, rate * 0.9); // 10% slower
    pitch = pitch * 1.05; // Slightly warmer/higher pitch
  } else if (isAnalytical) {
    rate = Math.min(1.15, rate * 1.05); // 5% faster
    pitch = pitch * 0.95; // Slightly lower, analytical pitch
  } else if (isThoughtful) {
    rate = Math.max(0.9, rate * 0.95);
  }

  return { rate, pitch };
}
