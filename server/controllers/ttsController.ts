import { Request, Response } from "express";

export async function textToSpeech(req: Request, res: Response) {
  const { text, personality } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Text is required" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    // If ElevenLabs API Key is not configured, inform the client to fall back to Web Speech API
    return res.status(412).json({ 
      error: "ElevenLabs API Key is not configured on the server. Please define ELEVENLABS_API_KEY in your environment variables.", 
      fallback: true 
    });
  }

  // Map interviewer personality to premium ElevenLabs Voice IDs
  // Sophia (Staff Lead Engineer): Rachel (Warm, professional, extremely human)
  // James (VP Executive Recruiter): Antoni (Energetic, executive, polished, fast-paced)
  // Rohan (Technical Architect): Liam (Extremely natural, warm, supportive)
  let voiceId = "21m00Tcm4TlvDq8ikWAM"; // Default to Rachel
  
  if (personality) {
    const lowerP = personality.toLowerCase();
    if (lowerP === "james") {
      voiceId = "ErXwobaYiN019vkySvjV"; // Antoni
    } else if (lowerP === "rohan") {
      voiceId = "N2lVS1w4gNsC97gqnCUs"; // Liam
    }
  }

  try {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    
    // Clean text of markdown before synthesizing
    const cleanText = text.replace(/[*_`#\-]/g, " ").trim();

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey
      },
      body: JSON.stringify({
        text: cleanText,
        model_id: "eleven_monolingual_v1", // Optimized for ultra-low latency & natural expression
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.05,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs API error:", response.status, errText);
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
