import { GoogleGenAI } from '@google/genai';

// Initialize Gemini SDK with runtime env key
export const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export interface ChatbotRoleDefinition {
  id: string;
  name: string;
  badge: string;
  description: string;
  recommendedModel: 'gemini-3.8-flash' | 'gemini-3.1-flash-lite' | 'gemini-4-argon';
  instruction: string;
}

export const CHATBOT_ROLES: Record<string, ChatbotRoleDefinition> = {
  reconciler: {
    id: 'reconciler',
    name: 'Pola - Live Reconciler & Invoicing Gatekeeper',
    badge: 'Core Operations',
    description: 'Specializes in parsing live chat comments, Taglish claims, Messenger amendments, and enforcing Zero-Refund invoicing.',
    recommendedModel: 'gemini-3.8-flash',
    instruction: `You are "Pola", the Senior Live Selling Operations and Inventory Reconciler for Bangkok Plus Size OOTD (BPSO).
Your expertise spans:
1. Live selling chat behavior analysis (Taglish, "pa-mine", glued codes like "Miner1", code-only "T1", short forms "T maroon").
2. In-live and post-live order amendments (size changes, color swaps, cancellations) across Live Chat, Business Messenger, and VIP channels.
3. Store purchase reconciliation at Bangkok wholesale markets (e.g. Pratunam, Platinum Fashion Mall).
4. Strict Zero-Refund Cycle Invoicing Gate: under NO circumstances may an item be invoiced if it was not verified as physically purchased at the store. Shortages must receive courteous waitlist/substitute options, never phantom charges.
5. Currency tracking: Thai Baht (THB) for supplier purchases and Philippine Peso (PHP) for buyer retail prices, converted using the owner-entered daily rate (never an assumed rate).

Tone: Highly professional, proactive, knowledgeable, supportive, with natural Filipino/Taglish retail terminology where appropriate ("mine", "sis", "yours na", "palitan"). Keep answers concise, actionable, and structured with clear bullet points.`,
  },
  auditor: {
    id: 'auditor',
    name: 'Lead Financial Auditor & Dispute Arbitrator',
    badge: 'Deep Reasoning & Audit',
    description: 'Performs deep financial analysis, wholesale THB vs retail PHP currency audits, courier freight fee calculations, and complex shortage arbitrage.',
    recommendedModel: 'gemini-4-argon',
    instruction: `You are the Lead Financial Auditor & Dispute Arbitrator for Bangkok Plus Size OOTD (BPSO).
Your role:
1. Conduct forensic audits of live selling orders, comparing declared retail PHP revenues against actual Pratunam supplier Baht (THB) receipts.
2. Resolve multi-party order disputes when multiple buyers claim the same limited plus-size garment (apply First-Come First-Served strictly according to timestamp seconds).
3. Compute exact margin percentages, cargo freight rates per kilogram from Bangkok to Manila, and identify supplier overcharges or currency slippage.
4. Provide rigorous mathematical reasoning, step-by-step breakdown of calculations, and audit checklists.

Tone: Analytical, precise, authoritative, objective, and mathematically thorough.`,
  },
  market_sourcing: {
    id: 'market_sourcing',
    name: 'Bangkok Wholesale Market & Fabric Specialist',
    badge: 'Pratunam Sourcing',
    description: 'Expert on Bangkok wholesale market dynamics, Thai plus-size sizing standards, fabric drape, and stall negotiations.',
    recommendedModel: 'gemini-3.8-flash',
    instruction: `You are the Bangkok Wholesale Market & Fashion Sourcing Specialist for Bangkok Plus Size OOTD.
Your role:
1. Advise on Bangkok wholesale market geography (Pratunam Market Soi 1-4, Platinum Fashion Mall Floor 3 Zone 2, Krung Thong Plaza for specialized plus sizes).
2. Guide on plus-size garment construction, sizing conversions (Thai inches: 2XL 48", 3XL 52", 4XL 56" bust), fabric stretch, and drape (pure linen, crinkle cotton, hand-stitched batik, modal, satin).
3. Recommend bargaining tactics, wholesale volume tier discounts (3 pcs wholesale price), and inspecting stitching/zippers at physical stalls.

Tone: Enthusiastic, savvy, experienced in Southeast Asian fashion trade, practical, and highly descriptive.`,
  },
  fast_triage: {
    id: 'fast_triage',
    name: 'Speed Triage & Item Code Lookup',
    badge: 'Ultra-Fast Response',
    description: 'Delivers instantaneous lookups, item code checks, size verifications, and quick answers without delay.',
    recommendedModel: 'gemini-3.1-flash-lite',
    instruction: `You are the Quick-Triage Assistant for Bangkok Plus Size OOTD.
Your role:
1. Answer in 1-3 short, rapid bullet points or a single concise paragraph.
2. Quickly verify garment codes (BP01, BP02, T07), sizes (XL-6XL), and price references.
3. Prioritize extreme brevity, speed, and immediate clarity for on-air hosts and busy packing staff.

Tone: Crisp, ultra-concise, fast, direct.`,
  },
};

export interface ChatMessageParam {
  role: 'user' | 'model' | 'system' | 'assistant';
  content: string;
}

export async function chatWithGemini(
  messages: ChatMessageParam[],
  options?: {
    model?: string;
    role?: string;
    contextData?: string;
    customInstruction?: string;
  }
): Promise<{ reply: string; usedModel: string; role: string }> {
  if (!process.env.GEMINI_API_KEY) {
    return {
      reply: 'Gemini API key is not configured. Please ensure GEMINI_API_KEY is configured in your environment.',
      usedModel: options?.model || 'gemini-3.8-flash',
      role: options?.role || 'reconciler',
    };
  }

  const roleKey = options?.role || 'reconciler';
  const roleConfig = CHATBOT_ROLES[roleKey] || CHATBOT_ROLES.reconciler;
  const targetModel = options?.model || roleConfig.recommendedModel || 'gemini-3.8-flash';

  let systemInstruction = options?.customInstruction || roleConfig.instruction;
  if (options?.contextData) {
    systemInstruction += `\n\nCURRENT STORE & LIVE RECONCILIATION DATA CONTEXT:\n${options.contextData}`;
  }

  const formattedContents = messages.map((m) => ({
    role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  try {
    const response = await ai.models.generateContent({
      model: targetModel,
      contents: formattedContents,
      config: {
        systemInstruction,
        temperature: targetModel === 'gemini-4-argon' ? 0.2 : 0.4,
      },
    });

    return {
      reply: response.text || 'No response generated.',
      usedModel: targetModel,
      role: roleKey,
    };
  } catch (err: any) {
    console.error(`Error with model ${targetModel}:`, err);
    // If gemini-4-argon fails (e.g. requires paid key), fallback to gemini-3.8-flash
    if (targetModel === 'gemini-4-argon') {
      try {
        console.warn('Falling back to gemini-3.8-flash for chat...');
        const fallbackResponse = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: formattedContents,
          config: {
            systemInstruction,
            temperature: 0.4,
          },
        });
        return {
          reply: `[Processed via gemini-3.8-flash fallback]:\n\n${fallbackResponse.text || ''}`,
          usedModel: 'gemini-3.8-flash',
          role: roleKey,
        };
      } catch (fallbackErr: any) {
        return {
          reply: `AI Assistant error: ${fallbackErr.message || err.message}`,
          usedModel: 'gemini-3.8-flash',
          role: roleKey,
        };
      }
    }

    return {
      reply: `AI Assistant error: ${err.message || 'Failed to process request'}`,
      usedModel: targetModel,
      role: roleKey,
    };
  }
}

/** Legacy wrapper */
export async function chatWithPola(
  messages: ChatMessageParam[],
  contextData?: string,
  modelName: string = 'gemini-3.8-flash'
): Promise<string> {
  const res = await chatWithGemini(messages, {
    model: modelName,
    role: 'reconciler',
    contextData,
  });
  return res.reply;
}

/** Text-to-Speech using gemini-3.8-flash-lite-tts */
export async function generateSpeechAudio(text: string, voiceName: string = 'Kore'): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [{ role: 'user', parts: [{ text }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (e) {
    console.error('generateSpeechAudio error:', e);
    return null;
  }
}

export async function analyzeLiveVideoContent(
  videoPrompt: string,
  videoBase64?: string,
  mimeType: string = 'video/mp4'
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return 'Gemini API key is not configured.';
  }

  try {
    const parts: any[] = [];
    if (videoBase64) {
      parts.push({
        inlineData: {
          data: videoBase64,
          mimeType,
        },
      });
    }

    parts.push({
      text: `Analyze this live selling broadcast segment for Bangkok Plus Size OOTD.
Task: ${videoPrompt}
Identify:
1. Item codes called by the host (e.g. BP01, BP02, T07).
2. Physical garment colors, fabrics (linen, batik, silk), and plus-size tags visible.
3. Host verbal price quotations in PHP (e.g. 1,890, 2,190) and stated available piece counts.
4. Specific buyers named ("Yours na [Name]").
Format your output with clear headers and timestamps where applicable.`,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: parts,
    });

    return response.text || 'No video analysis generated.';
  } catch (err: any) {
    console.error('Error analyzing video:', err);
    return `Video analysis failed: ${err.message}`;
  }
}

export async function transcribeHostSpeech(
  audioBase64: string,
  mimeType: string = 'audio/webm'
): Promise<{ text: string; parsedCalls: Array<{ code: string; price: number; buyer?: string }> }> {
  if (!process.env.GEMINI_API_KEY) {
    return { text: 'Gemini API key is not configured. Please ensure GEMINI_API_KEY is configured.', parsedCalls: [] };
  }

  const cleanedBase64 = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
  const promptText = 'Transcribe this live selling speech verbatim. Then extract any garment item codes called (e.g. BP01, BP02, T07), price quotes in PHP, and buyer confirmations ("yours na [name]"). Output transcription followed by a JSON block: {"calls": [{"code": "BP01", "price": 1890, "buyer": "Maricel"}]}';

  let responseText = '';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: [
        {
          inlineData: {
            data: cleanedBase64,
            mimeType: mimeType || 'audio/webm',
          },
        },
        {
          text: promptText,
        },
      ],
    });
    responseText = response.text || '';
  } catch (primaryErr: any) {
    console.warn('gemini-3.5-transcribe failed or not supported in this region, attempting fallback:', primaryErr?.message);
    try {
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            inlineData: {
              data: cleanedBase64,
              mimeType: mimeType || 'audio/webm',
            },
          },
          {
            text: promptText,
          },
        ],
      });
      responseText = fallbackResponse.text || '';
    } catch (fallbackErr: any) {
      console.error('All transcription models failed:', fallbackErr);
      return {
        text: `Transcription error: ${fallbackErr.message || primaryErr.message}`,
        parsedCalls: [],
      };
    }
  }

  let parsedCalls: any[] = [];
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*"calls"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      parsedCalls = parsed.calls || [];
    }
  } catch (e) {
    // Non-fatal JSON parse error
  }

  return {
    text: responseText,
    parsedCalls,
  };
}
