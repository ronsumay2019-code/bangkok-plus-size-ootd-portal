import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Send, 
  Mic, 
  MicOff, 
  Video, 
  Bot, 
  User, 
  CheckCircle2, 
  FileText, 
  ArrowRight,
  ShieldAlert,
  Loader2,
  Volume2,
  VolumeX,
  PhoneCall,
  PhoneOff,
  Radio,
  Settings2,
  Cpu,
  Layers,
  HelpCircle,
  Copy,
  Check,
  RefreshCw,
  Zap,
  Brain,
  MessageSquare
} from 'lucide-react';
import { ChatMessage, ReconciliationSummary } from '../types/reconciliation';
import { LiveVoiceClient } from '../utils/liveAudioClient';

interface PolaAICopilotProps {
  summary: ReconciliationSummary | null;
}

export const PolaAICopilot: React.FC<PolaAICopilotProps> = ({ summary }) => {
  // Navigation tool tab: multi-turn chat, live voice conversation (gemini-3.8-live), video analysis, speech transcribe
  const [activeAiTool, setActiveAiTool] = useState<'chat' | 'live_voice' | 'video' | 'audio'>('chat');

  // Role & Model State
  const [selectedRole, setSelectedRole] = useState<'reconciler' | 'auditor' | 'market_sourcing' | 'fast_triage'>('reconciler');
  const [selectedModel, setSelectedModel] = useState<'gemini-3.8-flash' | 'gemini-4-argon' | 'gemini-3.1-flash-lite'>('gemini-3.8-flash');
  const [showSystemInstruction, setShowSystemInstruction] = useState(false);

  // Multi-Turn Chat Conversation State
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      role: 'assistant',
      content: `Kumusta! I am **Pola**, your Bangkok Plus Size OOTD Live Selling & Inventory Reconciliation Co-pilot. 

I can help you:
- **Reconcile orders & resolve disputes**: Match live chat comments with Messenger size/color changes.
- **Audit Bangkok store purchases**: Calculate shortages, extra stock costs in Thai Baht (THB), and revenue in Philippine Peso (PHP).
- **Enforce the Zero-Refund Invoicing Rule**: Guarantee that only physically bought pieces are invoiced.
- **Switch to Live Voice Conversation**: Speak with me in real-time using model **gemini-3.8-live**.

Select a specialized role or model above, or start chatting below!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      metadata: {
        modelUsed: 'gemini-3.8-flash',
        taskType: 'reconciler',
      },
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // =================== LIVE VOICE API (gemini-3.8-live) STATE ===================
  const [isVoiceConnected, setIsVoiceConnected] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [isVoiceSpeaking, setIsVoiceSpeaking] = useState(false);
  const [voiceAudioLevel, setVoiceAudioLevel] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [voiceTranscriptLogs, setVoiceTranscriptLogs] = useState<Array<{ sender: 'user' | 'model'; text: string; time: string }>>([]);
  const liveVoiceClientRef = useRef<LiveVoiceClient | null>(null);

  // =================== VIDEO ANALYSIS & TRANSCRIBE STATE ===================
  const [videoAnalysisPrompt, setVideoAnalysisPrompt] = useState(
    'Identify all garment codes called by host Myra, note their sizes and quoted PHP prices.'
  );
  const [videoAnalysisResult, setVideoAnalysisResult] = useState<string | null>(null);
  const [audioTranscriptResult, setAudioTranscriptResult] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const recordTimerRef = useRef<any>(null);
  const [micError, setMicError] = useState<string | null>(null);

  // Auto-scroll chat thread
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, voiceTranscriptLogs]);

  // Clean up Live Voice on unmount
  useEffect(() => {
    return () => {
      if (liveVoiceClientRef.current) {
        liveVoiceClientRef.current.disconnect();
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
      }
    };
  }, []);

  // Sync recommended model when role changes
  const handleRoleChange = (role: 'reconciler' | 'auditor' | 'market_sourcing' | 'fast_triage') => {
    setSelectedRole(role);
    if (role === 'auditor') {
      setSelectedModel('gemini-4-argon'); // Complex tasks
    } else if (role === 'fast_triage') {
      setSelectedModel('gemini-3.1-flash-lite'); // Tasks that should happen fast
    } else {
      setSelectedModel('gemini-3.8-flash'); // General tasks
    }
  };

  // =================== MULTI-TURN CHAT HANDLER ===================
  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputPrompt;
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      // Format full history for multi-turn conversational context
      const history = [...messages, userMessage].map((m) => ({
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        content: m.content,
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          model: selectedModel,
          role: selectedRole,
          context: summary ? JSON.stringify({
            liveTitle: summary.liveTitle,
            accuracy: summary.accuracy,
            purchasedCostThb: summary.totalPurchasedCostThb,
            revenuePhp: summary.projectedRevenuePhp,
            shortageBuyers: summary.affectedShortageBuyers,
            readyToLeaveStore: summary.checklist.readyToLeaveStore,
          }) : null,
        }),
      });

      const data: any = await res.json();
      const reply = data.reply || 'I processed your request, but received an empty response.';

      const botMessage: ChatMessage = {
        id: `bot_${Date.now()}`,
        role: 'assistant',
        content: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        metadata: {
          modelUsed: data.usedModel || selectedModel,
          taskType: data.role || selectedRole,
        },
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot_err_${Date.now()}`,
          role: 'assistant',
          content: `Apologies, I encountered an issue connecting to Gemini (${selectedModel}): ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Play audio speech for assistant message via gemini-3.8-flash-lite-tts
  const handlePlayMessageAudio = async (msgId: string, text: string) => {
    if (playingAudioId === msgId) {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        setPlayingAudioId(null);
      }
      return;
    }

    try {
      setPlayingAudioId(msgId);
      const res = await fetch('/api/ai/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 400) }),
      });
      const data: any = await res.json();
      if (data.audio) {
        const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
        currentAudioRef.current = audio;
        audio.play();
        audio.onended = () => setPlayingAudioId(null);
        audio.onerror = () => setPlayingAudioId(null);
      } else {
        setPlayingAudioId(null);
      }
    } catch (e) {
      console.error('Audio playback error:', e);
      setPlayingAudioId(null);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // =================== LIVE VOICE (gemini-3.8-live) CONTROLS ===================
  const handleStartLiveVoice = async () => {
    setVoiceError(null);
    try {
      const client = new LiveVoiceClient({
        onConnected: () => {
          setIsVoiceConnected(true);
          setVoiceTranscriptLogs((prev) => [
            ...prev,
            { sender: 'model', text: 'Connected to gemini-3.8-live. Speak to me anytime!', time: new Date().toLocaleTimeString() }
          ]);
        },
        onDisconnected: () => {
          setIsVoiceConnected(false);
          setIsVoiceListening(false);
          setIsVoiceSpeaking(false);
        },
        onListening: (listening) => {
          setIsVoiceListening(listening);
        },
        onSpeaking: (speaking) => {
          setIsVoiceSpeaking(speaking);
        },
        onAudioLevel: (level) => {
          setVoiceAudioLevel(level);
        },
        onTranscript: (text, isUser) => {
          setVoiceTranscriptLogs((prev) => [
            ...prev,
            { sender: isUser ? 'user' : 'model', text, time: new Date().toLocaleTimeString() }
          ]);
        },
        onError: (err) => {
          setVoiceError(err);
        },
      });

      liveVoiceClientRef.current = client;
      await client.connect();
    } catch (err: any) {
      setVoiceError(err?.message || 'Could not connect to Live Voice session');
      setIsVoiceConnected(false);
    }
  };

  const handleStopLiveVoice = () => {
    if (liveVoiceClientRef.current) {
      liveVoiceClientRef.current.disconnect();
      liveVoiceClientRef.current = null;
    }
    setIsVoiceConnected(false);
    setIsVoiceListening(false);
    setIsVoiceSpeaking(false);
  };

  const handleSendVoiceTestPrompt = (promptText: string) => {
    if (liveVoiceClientRef.current && isVoiceConnected) {
      liveVoiceClientRef.current.sendTextMessage(promptText);
    }
  };

  // =================== VIDEO ANALYSIS HANDLER ===================
  const handleRunVideoAnalysis = async () => {
    setIsLoading(true);
    setVideoAnalysisResult(null);
    try {
      const res = await fetch('/api/ai/video-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: videoAnalysisPrompt }),
      });
      const data: any = await res.json();
      setVideoAnalysisResult(data.analysis || 'Analysis completed.');
    } catch (e: any) {
      setVideoAnalysisResult(`Video analysis error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // =================== TRANSCRIPTION RECORDER ===================
  const startMicRecording = async () => {
    setMicError(null);
    setAudioTranscriptResult(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          setIsLoading(true);
          try {
            const res = await fetch('/api/ai/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: base64Audio, mimeType: 'audio/webm' }),
            });
            const data: any = await res.json();
            setAudioTranscriptResult(data.text || 'No speech detected.');
          } catch (e: any) {
            setAudioTranscriptResult(`Transcription error: ${e.message}`);
          } finally {
            setIsLoading(false);
          }
        };
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      setMicError(`Microphone access error: ${err.message || 'Permission denied'}`);
      setIsRecording(false);
    }
  };

  const stopMicRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      clearInterval(recordTimerRef.current);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Copilot Header with AI Tool Mode Switcher */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-pink-600 to-amber-500 p-0.5 shadow-lg shadow-rose-950/40">
              <div className="w-full h-full bg-neutral-900 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-rose-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Pola AI Intelligence Suite</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold border border-rose-500/30">
                  Gemini API Powered
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Multi-turn role-based chat, real-time Live API voice conversation (gemini-3.8-live), video inspection, & speech-to-text.
              </p>
            </div>
          </div>

          {/* Tool Switcher Tabs */}
          <div className="flex flex-wrap items-center gap-2 bg-neutral-950 p-1.5 rounded-xl border border-neutral-800 text-xs">
            <button
              onClick={() => setActiveAiTool('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeAiTool === 'chat'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Multi-Turn Chat</span>
            </button>

            <button
              onClick={() => setActiveAiTool('live_voice')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeAiTool === 'live_voice'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
              <span>Live Voice (gemini-3.8-live)</span>
            </button>

            <button
              onClick={() => setActiveAiTool('video')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeAiTool === 'video'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video Analysis</span>
            </button>

            <button
              onClick={() => setActiveAiTool('audio')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                activeAiTool === 'audio'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Host Transcribe</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===================== TAB 1: MULTI-TURN CHAT INTERFACE ===================== */}
      {activeAiTool === 'chat' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column: Role & Model Configuration with System Instructions */}
          <div className="space-y-4">
            {/* Model Selector Card */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-400 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-rose-400" />
                  <span>Gemini Model</span>
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">Select Engine</span>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => setSelectedModel('gemini-3.8-flash')}
                  className={`w-full text-left p-2.5 rounded-xl border transition cursor-pointer ${
                    selectedModel === 'gemini-3.8-flash'
                      ? 'bg-rose-950/40 border-rose-500 ring-1 ring-rose-500/30'
                      : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">gemini-3.8-flash</span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-500/20 text-rose-300 font-mono">General</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Balanced speed & intelligence. Default for reconciliation, general questions, and chat.
                  </p>
                </button>

                <button
                  onClick={() => setSelectedModel('gemini-3.1-flash-lite')}
                  className={`w-full text-left p-2.5 rounded-xl border transition cursor-pointer ${
                    selectedModel === 'gemini-3.1-flash-lite'
                      ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500/30'
                      : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>gemini-3.1-flash-lite</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300 font-mono">Ultra-Fast</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    High throughput, sub-second responses. Optimized for rapid code and price checks.
                  </p>
                </button>

                <button
                  onClick={() => setSelectedModel('gemini-4-argon')}
                  className={`w-full text-left p-2.5 rounded-xl border transition cursor-pointer ${
                    selectedModel === 'gemini-4-argon'
                      ? 'bg-purple-950/40 border-purple-500 ring-1 ring-purple-500/30'
                      : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white flex items-center gap-1">
                      <Brain className="w-3 h-3 text-purple-400" />
                      <span>gemini-4-argon</span>
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-purple-500/20 text-purple-300 font-mono">Complex</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Deep mathematical reasoning. Best for complex shortage resolution and multi-party disputes.
                  </p>
                </button>
              </div>
            </div>

            {/* Chatbot Role Switcher with System Instructions */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-400 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-amber-400" />
                  <span>Persona Role</span>
                </span>
                <button
                  onClick={() => setShowSystemInstruction(!showSystemInstruction)}
                  className="text-[10px] text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
                >
                  {showSystemInstruction ? 'Hide Prompt' : 'View Prompt'}
                </button>
              </div>

              <div className="space-y-1.5">
                {[
                  { id: 'reconciler', label: '👩‍💼 Pola (Live Reconciler)', desc: 'Zero-refund gate & order changes' },
                  { id: 'auditor', label: '📊 Financial Auditor', desc: 'Margin, Baht-to-Peso, lost sales' },
                  { id: 'market_sourcing', label: '🛍️ Wholesale Sourcing', desc: 'Pratunam stalls & plus-size sizing' },
                  { id: 'fast_triage', label: '⚡ Rapid Code Triage', desc: 'Instant 1-liner lookups' },
                ].map((role) => (
                  <button
                    key={role.id}
                    onClick={() => handleRoleChange(role.id as any)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                      selectedRole === role.id
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'bg-neutral-950 text-neutral-300 hover:bg-neutral-800 border border-neutral-850'
                    }`}
                  >
                    <div>{role.label}</div>
                    <div className="text-[10px] font-normal opacity-80 mt-0.5">{role.desc}</div>
                  </button>
                ))}
              </div>

              {/* Viewable System Instruction Accordion */}
              {showSystemInstruction && (
                <div className="mt-3 p-3 bg-neutral-950 rounded-xl border border-neutral-800 text-[10px] text-neutral-300 space-y-1.5 font-mono max-h-48 overflow-y-auto">
                  <div className="font-bold text-rose-400 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    <span>Active System Instruction:</span>
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap text-neutral-400">
                    {selectedRole === 'reconciler' && 'You are "Pola", the Senior Live Selling Operations and Inventory Reconciler for Bangkok Plus Size OOTD (BPSO). Expert in Taglish live chat claims, Messenger amendments, and enforcing the Zero-Refund Invoicing Gate.'}
                    {selectedRole === 'auditor' && 'You are the Lead Financial Auditor & Dispute Arbitrator for Bangkok Plus Size OOTD. Conduct forensic reconciliation between wholesale Baht receipts and retail Peso sales.'}
                    {selectedRole === 'market_sourcing' && 'You are the Bangkok Wholesale Market & Fashion Sourcing Specialist. Guide on Pratunam & Platinum stalls, fabric selection, and Thai plus-size conversions.'}
                    {selectedRole === 'fast_triage' && 'You are the Quick-Triage Assistant. Answer in 1-3 rapid bullet points with maximum brevity and accuracy.'}
                  </p>
                </div>
              )}
            </div>

            {/* Quick Prompt Suggestions */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 space-y-2 shadow-lg">
              <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-400 block mb-1">
                Contextual Shortcuts:
              </span>
              {[
                'Audit current live shortages & lost sales',
                'Can we invoice any buyers right now?',
                'How do I handle a Messenger size swap from 2XL to 3XL?',
                'Calculate Pratunam 450฿ cost to PHP at current rate',
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(suggestion)}
                  disabled={isLoading}
                  className="w-full text-left text-[11px] text-neutral-300 hover:text-white bg-neutral-950 hover:bg-neutral-800 p-2 rounded-lg border border-neutral-850 transition cursor-pointer truncate"
                >
                  💬 {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Right Column: Multi-Turn Conversation Thread */}
          <div className="lg:col-span-3 bg-neutral-900 border border-neutral-800 rounded-2xl flex flex-col h-[680px] shadow-xl overflow-hidden">
            {/* Thread Header */}
            <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/90 backdrop-blur">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-bold text-xs text-white">
                  Active Conversation Thread · {messages.length} Messages
                </span>
                <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px]">
                  {selectedModel}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMessages([messages[0]])}
                  className="text-[11px] text-neutral-400 hover:text-white px-2.5 py-1 rounded-lg bg-neutral-800 hover:bg-neutral-750 transition cursor-pointer"
                >
                  Clear Thread
                </button>
              </div>
            </div>

            {/* Scrollable Message Thread */}
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isUser
                          ? 'bg-rose-600 text-white'
                          : 'bg-neutral-800 border border-neutral-700 text-rose-400'
                      }`}
                    >
                      {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>

                    <div className={`max-w-[82%] space-y-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                      {/* Meta header above bubble */}
                      <div className={`flex items-center gap-2 text-[10px] text-neutral-500 px-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <span className="font-semibold text-neutral-400">{isUser ? 'You' : 'Pola Assistant'}</span>
                        {msg.metadata?.modelUsed && (
                          <span className="font-mono text-neutral-500">· {msg.metadata.modelUsed}</span>
                        )}
                        <span>· {msg.timestamp}</span>
                      </div>

                      {/* Chat Bubble */}
                      <div
                        className={`p-4 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                          isUser
                            ? 'bg-gradient-to-r from-rose-600 to-rose-700 text-white rounded-tr-none shadow-md'
                            : 'bg-neutral-950 border border-neutral-800 text-neutral-200 rounded-tl-none shadow-sm'
                        }`}
                      >
                        {msg.content}
                      </div>

                      {/* Action Bar for Assistant Messages (TTS read-aloud & Copy) */}
                      {!isUser && (
                        <div className="flex items-center gap-1.5 px-1 pt-0.5">
                          <button
                            onClick={() => handlePlayMessageAudio(msg.id, msg.content)}
                            className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 transition cursor-pointer"
                            title="Listen to spoken audio via gemini-3.8-flash-lite-tts"
                          >
                            {playingAudioId === msg.id ? (
                              <>
                                <VolumeX className="w-3 h-3 text-rose-400 animate-pulse" />
                                <span>Stop Audio</span>
                              </>
                            ) : (
                              <>
                                <Volume2 className="w-3 h-3 text-neutral-400" />
                                <span>Read Aloud</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleCopyText(msg.id, msg.content)}
                            className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 transition cursor-pointer"
                          >
                            {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-rose-400">
                    <Bot className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="bg-neutral-950 border border-neutral-800 p-3 rounded-2xl rounded-tl-none text-xs text-neutral-400 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-rose-500 animate-spin" />
                    <span>Pola is thinking with <strong>{selectedModel}</strong>...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-4 bg-neutral-950 border-t border-neutral-800">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={inputPrompt}
                  onChange={(e) => setInputPrompt(e.target.value)}
                  placeholder={`Ask Pola with ${selectedModel} (e.g., "Check BP01 rack vs live demand")...`}
                  disabled={isLoading}
                  className="flex-1 bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-rose-500"
                />

                <button
                  type="submit"
                  disabled={isLoading || !inputPrompt.trim()}
                  className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 disabled:opacity-40 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-rose-950/40 transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: REAL-TIME LIVE VOICE (gemini-3.8-live) ===================== */}
      {activeAiTool === 'live_voice' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-800">
            <div>
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-amber-400 animate-pulse" />
                <h3 className="font-bold text-base text-white">
                  Real-Time Voice Conversation · Model: gemini-3.8-live
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold border border-amber-500/30">
                  Live API
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Have a live bidirectional spoken dialogue with Gemini Live API. Low latency 16kHz microphone stream to 24kHz audio playback with barge-in interruption.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {isVoiceConnected ? (
                <button
                  onClick={handleStopLiveVoice}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-red-950/40 transition cursor-pointer"
                >
                  <PhoneOff className="w-4 h-4" />
                  <span>End Live Voice Session</span>
                </button>
              ) : (
                <button
                  onClick={handleStartLiveVoice}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-amber-950/40 transition cursor-pointer"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Start Live Voice Conversation</span>
                </button>
              )}
            </div>
          </div>

          {/* Interactive Voice Orb & Visualizer */}
          <div className="bg-neutral-950 border border-neutral-800/80 rounded-2xl p-8 flex flex-col items-center justify-center space-y-6 text-center">
            {/* Visualizer Pulsing Ring */}
            <div className="relative flex items-center justify-center">
              <div
                className={`w-32 h-32 rounded-full transition-all duration-300 flex items-center justify-center ${
                  isVoiceSpeaking
                    ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-pink-500 animate-pulse scale-110 shadow-2xl shadow-amber-500/40'
                    : isVoiceListening
                    ? 'bg-gradient-to-tr from-emerald-500 to-teal-500 animate-ping shadow-lg shadow-emerald-500/30'
                    : isVoiceConnected
                    ? 'bg-neutral-800 border-2 border-neutral-700'
                    : 'bg-neutral-900 border border-neutral-800'
                }`}
              >
                <div className="w-24 h-24 rounded-full bg-neutral-950 flex items-center justify-center border border-neutral-800">
                  {isVoiceSpeaking ? (
                    <Volume2 className="w-10 h-10 text-amber-400 animate-bounce" />
                  ) : isVoiceListening ? (
                    <Mic className="w-10 h-10 text-emerald-400 animate-pulse" />
                  ) : (
                    <Radio className="w-10 h-10 text-neutral-500" />
                  )}
                </div>
              </div>
            </div>

            {/* Audio Wave Frequency Bars */}
            {isVoiceConnected && (
              <div className="flex items-center gap-1.5 h-8">
                {[4, 12, 24, 16, 28, 36, 20, 32, 18, 26, 14, 8].map((h, i) => (
                  <div
                    key={i}
                    style={{
                      height: `${Math.max(4, isVoiceSpeaking || isVoiceListening ? h * (1 + voiceAudioLevel * 2) : 4)}px`,
                    }}
                    className={`w-1.5 rounded-full transition-all duration-75 ${
                      isVoiceSpeaking ? 'bg-amber-400' : isVoiceListening ? 'bg-emerald-400' : 'bg-neutral-700'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Status Text */}
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">
                {!isVoiceConnected
                  ? 'Live API Disconnected'
                  : isVoiceSpeaking
                  ? 'gemini-3.8-live is Speaking (24kHz Gapless Audio)...'
                  : 'Listening... (Speak to Pola or barge in anytime)'}
              </h4>
              <p className="text-xs text-neutral-400 max-w-md">
                {!isVoiceConnected
                  ? 'Click "Start Live Voice Conversation" to open real-time WebSocket connection to gemini-3.8-live.'
                  : 'Speak naturally into your device microphone. Gemini Live API streams back responses in real time.'}
              </p>
            </div>

            {voiceError && (
              <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-300 text-xs max-w-lg">
                {voiceError}
              </div>
            )}
          </div>

          {/* Quick Voice Questions to trigger gemini-3.8-live responses */}
          <div className="space-y-2">
            <span className="text-[11px] uppercase tracking-wider font-bold text-neutral-400">
              Or Ask Pola via Instant Voice Prompt:
            </span>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: 'Shortages Check', prompt: 'Pola, what are our critical store rack shortages right now?' },
                { label: 'Zero-Refund Rule', prompt: 'Pola, explain the strict zero-refund invoicing rule.' },
                { label: 'Market Shopping', prompt: 'Pola, what sizes should we prioritize buying at Pratunam Soi 3?' },
              ].map((btn, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendVoiceTestPrompt(btn.prompt)}
                  disabled={!isVoiceConnected}
                  className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-amber-500/50 text-left transition disabled:opacity-40 cursor-pointer"
                >
                  <span className="font-bold text-xs text-amber-300 block">🎙️ {btn.label}</span>
                  <span className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">"{btn.prompt}"</span>
                </button>
              ))}
            </div>
          </div>

          {/* Live Transcript Thread */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-850">
              <span className="font-bold text-xs text-white flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>Live Voice Transcript Stream</span>
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">
                {voiceTranscriptLogs.length} entries
              </span>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 text-xs">
              {voiceTranscriptLogs.length === 0 ? (
                <p className="text-neutral-500 italic text-[11px]">No spoken dialog recorded yet. Connect and speak to see live speech transcriptions.</p>
              ) : (
                voiceTranscriptLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    <span className={`font-bold shrink-0 ${log.sender === 'user' ? 'text-rose-400' : 'text-amber-300'}`}>
                      {log.sender === 'user' ? 'You:' : 'gemini-3.8-live:'}
                    </span>
                    <span className="text-neutral-200">{log.text}</span>
                    <span className="text-[10px] text-neutral-600 font-mono shrink-0 ml-auto">{log.time}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 3: VIDEO ANALYSIS ===================== */}
      {activeAiTool === 'video' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h3 className="font-bold text-sm text-white">Live Broadcast Video Understanding</h3>
              <p className="text-xs text-neutral-400">
                Uses Gemini to visually inspect live video clips, identify garment tags, physical fabrics, and buyer names.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <textarea
              rows={3}
              value={videoAnalysisPrompt}
              onChange={(e) => setVideoAnalysisPrompt(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
            />

            <button
              onClick={handleRunVideoAnalysis}
              disabled={isLoading}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
            >
              <Video className="w-4 h-4" />
              <span>{isLoading ? 'Analyzing Video Clip...' : 'Run Video AI Inspection'}</span>
            </button>

            {videoAnalysisResult && (
              <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 whitespace-pre-wrap font-mono text-xs text-neutral-200">
                {videoAnalysisResult}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== TAB 4: HOST SPEECH TRANSCRIPTION ===================== */}
      {activeAiTool === 'audio' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h3 className="font-bold text-sm text-white">Host Audio Call Transcription (gemini-3.5-transcribe)</h3>
              <p className="text-xs text-neutral-400">
                Record live host calls or price announcements and automatically extract garment codes and quoted prices.
              </p>
            </div>

            <div>
              {isRecording ? (
                <button
                  onClick={stopMicRecording}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-xs flex items-center gap-2 animate-pulse cursor-pointer shadow-lg"
                >
                  <MicOff className="w-4 h-4" />
                  <span>Stop Recording ({recordSeconds}s)</span>
                </button>
              ) : (
                <button
                  onClick={startMicRecording}
                  disabled={isLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg"
                >
                  <Mic className="w-4 h-4" />
                  <span>Record Microphone</span>
                </button>
              )}
            </div>
          </div>

          {micError && <div className="p-3 bg-red-950/40 text-red-300 rounded-xl text-xs">{micError}</div>}

          {audioTranscriptResult && (
            <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-800 whitespace-pre-wrap font-mono text-xs text-neutral-200">
              {audioTranscriptResult}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
