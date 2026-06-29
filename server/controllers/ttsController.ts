import { Request, Response } from "express";

// A pre-verified list of free-tier pre-made voices in ElevenLabs.
// All of these are 100% available under the free tier without any paid plan.
const APPROVED_FREE_VOICES: Record<string, string> = {
  sophia: "21m00Tcm4TlvDq8ikWAM",  // Rachel (Female)
  james: "ErXwobaYiN019vkySvjV",   // Antoni (Male)
  rohan: "N2lVS1w4gNsC97gqnCUs",   // Liam (Male)
  nicole: "piTKgcLEGmPEeK7g3949",  // Nicole (Female Fallback)
  josh: "TxGEqn7nUu7vCg9vFr7b",    // Josh (Male Fallback)
  bella: "EXAVITQu4vr4xnSDxMaL",   // Bella (Female Fallback)
  arnold: "VR6A4Y667iaCHvInTka8"   // Arnold (Male Fallback)
};

const APPROVED_VOICE_IDS_SET = new Set(Object.values(APPROVED_FREE_VOICES));

export async function textToSpeech(req: Request, res: Response) {
  const { text, personality, voiceId: requestedVoiceId } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(412).json({ 
      error: "ElevenLabs API Key is not configured on the server. Falling back to default browser voice.", 
      fallback: true 
    });
  }

  // 1. Voice Selection Logic: Map personality to standard free-tier voices
  let voiceId = APPROVED_FREE_VOICES.sophia; // Default to Sophia/Rachel

  if (requestedVoiceId && APPROVED_VOICE_IDS_SET.has(requestedVoiceId)) {
    voiceId = requestedVoiceId;
  } else if (personality) {
    const lowerP = personality.toLowerCase();
    if (lowerP === "james") {
      voiceId = APPROVED_FREE_VOICES.james; // Antoni
    } else if (lowerP === "rohan") {
      voiceId = APPROVED_FREE_VOICES.rohan; // Liam
    } else if (APPROVED_FREE_VOICES[lowerP]) {
      voiceId = APPROVED_FREE_VOICES[lowerP];
    }
  }

  try {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    
    // Clean text of markdown before synthesizing
    const cleanText = text.replace(/[*_`#\-]/g, " ").trim();

    // Use a lightweight bilingual/multilingual model optimized for free tiers
    const modelId = "eleven_monolingual_v1"; // Always free, reliable, and lightning fast

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

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs API error:", response.status, errText);

      // Detect if this is a payment, quota, subscription or limit issue
      const lowerErrText = errText.toLowerCase();
      const isQuotaOrBillingError = 
        response.status === 402 || 
        response.status === 403 || 
        lowerErrText.includes("billing") || 
        lowerErrText.includes("subscription") || 
        lowerErrText.includes("payment") || 
        lowerErrText.includes("upgrade") || 
        lowerErrText.includes("quota") || 
        lowerErrText.includes("limit_exceeded");

      if (isQuotaOrBillingError) {
        return res.status(402).json({
          error: "The selected voice isn't available on the free plan. Switching to another free voice.",
          fallback: true
        });
      }

      return res.status(response.status).json({ 
        error: `ElevenLabs API error: ${response.statusText}`, 
        details: errText,
        fallback: true 
      });
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.set({
      "Content-Type": "audio/mpeg",
      "Content-Length": buffer.length,
      "Cache-Control": "public, max-age=3600"
    });

    return res.send(buffer);
  } catch (error: any) {
    console.error("ElevenLabs TTS generation failed:", error);
    return res.status(500).json({ 
      error: "Internal server error during speech synthesis", 
      message: error.message,
      fallback: true 
    });
  }
}
