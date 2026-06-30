import { Request, Response } from "express";

// A pre-verified list of free-tier pre-made voices in ElevenLabs.
// All of these are 100% available under the free tier without any paid plan.
const APPROVED_FREE_VOICES: Record<string, string> = {
  rachel: "21m00Tcm4TlvDq8ikWAM",  // Rachel (Female) - Free pre-made
  adam: "pNInz6obpgqjM7Y6WJQj",    // Adam (Male) - Free pre-made
  sophia: "21m00Tcm4TlvDq8ikWAM",  // Sophia mapped to Rachel (Female default)
  james: "pNInz6obpgqjM7Y6WJQj",   // James mapped to Adam (Male default)
  lauren: "21m00Tcm4TlvDq8ikWAM",  // Backwards compatibility
  evan: "pNInz6obpgqjM7Y6WJQj"     // Backwards compatibility
};

const APPROVED_VOICE_IDS_SET = new Set(Object.values(APPROVED_FREE_VOICES));

export async function textToSpeech(req: Request, res: Response) {
  const { text, personality, voiceId: requestedVoiceId } = req.body;

  console.log("=== [ElevenLabs TTS Request Received] ===");
  console.log(`- Text to synthesize (first 60 chars): "${text?.substring(0, 60)}..."`);
  console.log(`- Requested Personality: "${personality}"`);
  console.log(`- Requested Voice ID: "${requestedVoiceId}"`);

  if (!text) {
    console.error("❌ TTS Request failed: Text is missing in the request body.");
    return res.status(400).json({ error: "Text is required" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.log("✗ ElevenLabs API Key Missing");
    console.error("❌ DEVELOPER ERROR: ELEVENLABS_API_KEY is not defined in process.env. Please add ELEVENLABS_API_KEY=\"your_key_here\" to your /.env file and restart the development server.");
    return res.status(412).json({ 
      error: "ElevenLabs API Key is not configured on the server. Please configure ELEVENLABS_API_KEY in your environment.", 
      fallback: false
    });
  }

  console.log("✓ ElevenLabs API Key Loaded");
  const maskedKey = apiKey.length > 8 
    ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` 
    : "Invalid/Too Short";
  console.log(`- API Key loaded (Masked: ${maskedKey}, Length: ${apiKey.length})`);

  // Fetch available voices from ElevenLabs to ensure we only use voices that are fully accessible to this account/API key.
  let availableVoices: any[] = [];
  try {
    const voicesRes = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey }
    });
    if (voicesRes.ok) {
      const voicesData = await voicesRes.json();
      availableVoices = voicesData.voices || [];
      console.log(`- Dynamically fetched ${availableVoices.length} available voices from ElevenLabs.`);
    } else {
      console.warn(`- Failed to fetch voices list from ElevenLabs (Status: ${voicesRes.status}). Falling back to static mappings.`);
    }
  } catch (voicesErr: any) {
    console.warn(`- Network error fetching available voices: ${voicesErr.message}. Falling back to static mappings.`);
  }

  // 1. Voice Selection Logic: Map personality or requested voice to standard free-tier voices
  // Default fallback values
  let voiceId = APPROVED_FREE_VOICES.rachel; // Default to Rachel (21m00Tcm4TlvDq8ikWAM)

  const lowerP = (personality || "rachel").toLowerCase();
  const isMale = lowerP === "james" || lowerP === "evan" || lowerP === "adam";

  if (availableVoices.length > 0) {
    // Check if the requested voice is already in the available list (e.g. to avoid using a library voice that isn't on the profile)
    let matchedVoice = null;

    // Filter by premade first to ensure we use free-tier compliant voices
    const premadeVoices = availableVoices.filter(v => v.category === "premade");
    const candidatePool = premadeVoices.length > 0 ? premadeVoices : availableVoices;

    if (requestedVoiceId) {
      matchedVoice = availableVoices.find(v => v.voice_id === requestedVoiceId);
    }

    if (!matchedVoice) {
      // Find a matched voice from the candidate pool based on requested personality or gender
      if (isMale) {
        // Find a male voice
        matchedVoice = candidatePool.find(v => 
          v.name.toLowerCase() === "adam" || 
          v.name.toLowerCase() === "evan" ||
          v.labels?.gender === "male" || 
          v.labels?.gender?.toLowerCase() === "male" ||
          v.description?.toLowerCase().includes("male")
        ) || candidatePool.find(v => v.name.toLowerCase() === "dom" || v.name.toLowerCase() === "dave" || v.name.toLowerCase() === "callum");
      } else {
        // Find a female voice
        matchedVoice = candidatePool.find(v => 
          v.name.toLowerCase() === "rachel" || 
          v.name.toLowerCase() === "sophia" ||
          v.name.toLowerCase() === "lauren" ||
          v.labels?.gender === "female" || 
          v.labels?.gender?.toLowerCase() === "female" ||
          v.description?.toLowerCase().includes("female")
        ) || candidatePool.find(v => v.name.toLowerCase() === "bella" || v.name.toLowerCase() === "ellie" || v.name.toLowerCase() === "emily");
      }
    }

    // Fallback to first voice in candidate pool if no gender match found
    if (!matchedVoice && candidatePool.length > 0) {
      matchedVoice = candidatePool[0];
    }

    if (matchedVoice) {
      voiceId = matchedVoice.voice_id;
      console.log(`- Dynamically resolved to available voice: "${matchedVoice.name}" (ID: ${voiceId}, Category: ${matchedVoice.category})`);
    } else {
      console.log(`- No available voices matched. Falling back to static voice ID: "${voiceId}"`);
    }
  } else {
    // Traditional static resolution if API voices list could not be retrieved
    if (requestedVoiceId) {
      voiceId = requestedVoiceId;
    } else if (personality) {
      if (isMale) {
        voiceId = APPROVED_FREE_VOICES.adam;
      } else {
        voiceId = APPROVED_FREE_VOICES.rachel;
      }
    }
    console.log(`- Resolved to static voice ID: "${voiceId}"`);
  }

  console.log(`- Resolved Voice ID to use: "${voiceId}"`);

  // Clean text of markdown before synthesizing
  const cleanText = text.replace(/[*_`#\-]/g, " ").trim();

  // Try different models in sequence if one is unsupported by the free tier or the voice
  const candidateModels = [
    "eleven_multilingual_v2", // Primary: advanced, multilingual, works with custom voices
    "eleven_turbo_v2_5",      // Backup 1: extremely fast low-latency model
    "eleven_turbo_v2",        // Backup 2: reliable turbo model
    "eleven_monolingual_v1"   // Backup 3: basic legacy monolingual model
  ];

  let lastError: any = null;
  let success = false;
  let audioBuffer: Buffer | null = null;
  let usedModel = "";

  for (const modelId of candidateModels) {
    try {
      console.log(`🔊 [ElevenLabs Outgoing Request]`);
      console.log(`  - URL: https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`);
      console.log(`  - Voice ID: "${voiceId}"`);
      console.log(`  - Model: "${modelId}"`);
      console.log(`  - Text payload: "${cleanText}"`);

      const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: modelId,
          voice_settings: {
            stability: 0.50, // Standard balance for natural speech
            similarity_boost: 0.75, // Standard boost
          }
        })
      });

      if (response.ok) {
        console.log(`✅ [ElevenLabs Response SUCCESS]`);
        console.log(`  - Status: ${response.status} ${response.statusText}`);
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = Buffer.from(arrayBuffer);
        console.log(`  - Audio received successfully: ${audioBuffer.length} bytes`);
        usedModel = modelId;
        success = true;
        break;
      } else {
        const errText = await response.text();
        console.error(`❌ [ElevenLabs Response FAILURE]`);
        console.error(`  - Status: ${response.status} ${response.statusText}`);
        console.error(`  - Error Body:`, errText);
        lastError = {
          status: response.status,
          statusText: response.statusText,
          details: errText
        };

        // If it's a quota, billing, or subscription limit error, do not try other models
        const lowerErr = errText.toLowerCase();
        if (
          response.status === 401 ||
          response.status === 402 || 
          response.status === 403 || 
          lowerErr.includes("billing") || 
          lowerErr.includes("subscription") || 
          lowerErr.includes("payment") || 
          lowerErr.includes("upgrade") || 
          lowerErr.includes("quota") || 
          lowerErr.includes("limit_exceeded")
        ) {
          console.error(`🛑 Quota, Billing, or Authentication issue detected on ElevenLabs. Aborting model fallback list.`);
          break;
        }
      }
    } catch (modelErr: any) {
      console.warn(`⚠️ Request failed for model "${modelId}" due to network/fetch error:`, modelErr.message);
      lastError = modelErr;
    }
  }

  if (success && audioBuffer) {
    console.log(`Sending synthesized audio payload (size: ${audioBuffer.length} bytes, model: ${usedModel})`);
    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": audioBuffer.length,
      "Cache-Control": "public, max-age=3600"
    });
    return res.send(audioBuffer);
  }

  // If all candidate models failed
  console.error("❌ All ElevenLabs candidate models failed to synthesize speech.");
  if (lastError) {
    console.error("Last recorded ElevenLabs error details:", lastError);
    
    const errText = lastError.details || "";
    const lowerErrText = errText.toLowerCase();
    const isQuotaOrBillingError = 
      lastError.status === 402 || 
      lastError.status === 403 || 
      lowerErrText.includes("billing") || 
      lowerErrText.includes("subscription") || 
      lowerErrText.includes("payment") || 
      lowerErrText.includes("upgrade") || 
      lowerErrText.includes("quota") || 
      lowerErrText.includes("limit_exceeded");

    if (isQuotaOrBillingError) {
      return res.status(402).json({
        error: "Your ElevenLabs free-tier quota has been exceeded or billing is required. Switching to browser voice fallback.",
        fallback: true
      });
    }

    return res.status(lastError.status || 500).json({ 
      error: `ElevenLabs synthesis failed: ${lastError.statusText || "Error"}`, 
      details: errText || lastError.message,
      fallback: true 
    });
  }

  return res.status(500).json({ 
    error: "Failed to synthesize speech using ElevenLabs.", 
    fallback: true 
  });
}
