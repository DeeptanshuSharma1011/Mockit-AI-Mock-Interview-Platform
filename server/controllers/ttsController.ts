import { Request, Response } from "express";

// A pre-verified list of free-tier pre-made voices in ElevenLabs.
// All of these are 100% available under the free tier without any paid plan.
const APPROVED_FREE_VOICES: Record<string, string> = {
  lauren: "DODLEQrClDo8wCz460ld",  // Lauren (Female)
  evan: "TWutjvRaJqAX89preB4e",    // Evan (Male)
  sophia: "DODLEQrClDo8wCz460ld",  // Sophia mapped to Lauren (Female default)
  james: "TWutjvRaJqAX89preB4e"    // James mapped to Evan (Male default)
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
    console.warn("⚠️ ELEVENLABS_API_KEY is not defined in process.env.");
    return res.status(412).json({ 
      error: "ElevenLabs API Key is not configured on the server. Falling back to default browser voice.", 
      fallback: true 
    });
  }

  // Log key presence and mask it for security
  const maskedKey = apiKey.length > 8 
    ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` 
    : "Invalid/Too Short";
  console.log(`- API Key loaded: YES (Masked: ${maskedKey}, Length: ${apiKey.length})`);

  // 1. Voice Selection Logic: Map personality or requested voice to standard free-tier voices
  // Female -> Lauren (DODLEQrClDo8wCz460ld)
  // Male -> Evan (TWutjvRaJqAX89preB4e)
  let voiceId = APPROVED_FREE_VOICES.sophia; // Default to Lauren/Sophia

  if (requestedVoiceId) {
    voiceId = requestedVoiceId;
  } else if (personality) {
    const lowerP = personality.toLowerCase();
    if (lowerP === "james" || lowerP === "evan") {
      voiceId = APPROVED_FREE_VOICES.evan;
    } else if (lowerP === "sophia" || lowerP === "lauren") {
      voiceId = APPROVED_FREE_VOICES.lauren;
    } else if (APPROVED_FREE_VOICES[lowerP]) {
      voiceId = APPROVED_FREE_VOICES[lowerP];
    }
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
      console.log(`- Attempting synthesis using model: "${modelId}"...`);
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
        console.log(`✅ ElevenLabs synthesis succeeded with model "${modelId}"!`);
        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = Buffer.from(arrayBuffer);
        usedModel = modelId;
        success = true;
        break;
      } else {
        const errText = await response.text();
        console.warn(`⚠️ Model "${modelId}" synthesis failed (HTTP ${response.status}). Details:`, errText);
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
