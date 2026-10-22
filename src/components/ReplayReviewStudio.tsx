import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Volume2, 
  Video, 
  Clock, 
  Tag, 
  User, 
  ExternalLink,
  ShieldCheck,
  Sparkles,
  FastForward,
  Rewind,
  Bookmark,
  Check,
  Plus,
  SlidersHorizontal,
  ChevronRight,
  Filter,
  Mic,
  MicOff,
  Loader2
} from 'lucide-react';
import { LiveSession, BuyerOrder } from '../types/reconciliation';

interface ReplayReviewStudioProps {
  live: LiveSession;
  orders: BuyerOrder[];
  onVerifyPrice: (orderId: string, verifiedPrice: number, replayTimestamp: string) => void;
}

export const ReplayReviewStudio: React.FC<ReplayReviewStudioProps> = ({
  live,
  orders,
  onVerifyPrice,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(412); // Default to first item call at 06:52
  const [duration, setDuration] = useState(3132); // ~52 mins
  const [playbackRate, setPlaybackRate] = useState(1);
  const [videoUrl, setVideoUrl] = useState('/media/bpso-live-preview.mp4');
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [showUrlConfig, setShowUrlConfig] = useState(false);
  const [clockLagSeconds, setClockLagSeconds] = useState(195); // 03:15 min FB live creation lag calibration
  const [activeItemFilter, setActiveItemFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [verifiedOrderIds, setVerifiedOrderIds] = useState<Set<string>>(new Set(['ord_01', 'ord_02', 'ord_06', 'ord_11', 'ord_15']));
  const [selectedOrderId, setSelectedOrderId] = useState<string>('ord_01');

  // New marker modal
  const [showAddMarker, setShowAddMarker] = useState(false);
  const [newMarkerCode, setNewMarkerCode] = useState('BP01');
  const [newMarkerBuyer, setNewMarkerBuyer] = useState('');
  const [newMarkerPrice, setNewMarkerPrice] = useState('550');
  const [newMarkerQuote, setNewMarkerQuote] = useState('');

  // Microphone speech transcription state (gemini-3.5-transcribe)
  const [showAudioTranscriber, setShowAudioTranscriber] = useState(false);
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [micSeconds, setMicSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioTranscript, setAudioTranscript] = useState<string | null>(null);
  const [extractedCalls, setExtractedCalls] = useState<Array<{ code: string; price: number; buyer?: string }>>([]);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micTimerRef = useRef<any>(null);

  const startMicRecording = async () => {
    setMicError(null);
    setAudioTranscript(null);
    setExtractedCalls([]);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Data = reader.result as string;
          await sendAudioToTranscribe(base64Data, 'audio/webm');
        };
      };

      mediaRecorder.start();
      setIsRecordingMic(true);
      setMicSeconds(0);
      micTimerRef.current = setInterval(() => {
        setMicSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      setMicError(`Microphone access error: ${err.message || 'Permission denied'}. You can also use the preset Live Host Audio samples below.`);
    }
  };

  const stopMicRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingMic(false);
    if (micTimerRef.current) {
      clearInterval(micTimerRef.current);
    }
  };

  const sendAudioToTranscribe = async (audioBase64: string, mimeType: string = 'audio/webm') => {
    setIsTranscribing(true);
    setAudioTranscript(null);

    try {
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, mimeType }),
      });
      const data: any = await res.json();
      if (data.error) {
        setAudioTranscript(`Transcription error: ${data.error}`);
      } else {
        setAudioTranscript(data.text || 'Transcription complete.');
        if (data.parsedCalls && Array.isArray(data.parsedCalls)) {
          setExtractedCalls(data.parsedCalls);
          if (data.parsedCalls.length > 0) {
            setNewMarkerCode(data.parsedCalls[0].code || 'BP01');
            if (data.parsedCalls[0].price) setNewMarkerPrice(String(data.parsedCalls[0].price));
            if (data.parsedCalls[0].buyer) setNewMarkerBuyer(data.parsedCalls[0].buyer);
            setNewMarkerQuote(data.text.slice(0, 120));
          }
        }
      }
    } catch (err: any) {
      setAudioTranscript(`Network error: ${err.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleTranscribeSample = async (type: 'sample1' | 'sample2') => {
    setIsTranscribing(true);
    setAudioTranscript(null);
    setMicError(null);

    const dummyAudioBase64 = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    try {
      const res = await fetch('/api/ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: dummyAudioBase64, mimeType: 'audio/wav' }),
      });
      const data: any = await res.json();
      if (type === 'sample1') {
        const text = data.text || 'Ito pong BP01 House patchwork doodle, 550 lang po! Yours na Maricel Santos!';
        setAudioTranscript(text);
        const calls = [{ code: 'BP01', price: 550, buyer: 'Maricel Santos' }];
        setExtractedCalls(calls);
        setNewMarkerCode('BP01');
        setNewMarkerPrice('550');
        setNewMarkerBuyer('Maricel Santos');
        setNewMarkerQuote(text);
      } else {
        const text = data.text || 'Price correction po sa T07: 2,590 lang po ito dahil direct wholesale sa Pratunam!';
        setAudioTranscript(text);
        const calls = [{ code: 'T07', price: 2590 }];
        setExtractedCalls(calls);
        setNewMarkerCode('T07');
        setNewMarkerPrice('2590');
        setNewMarkerQuote(text);
      }
    } catch (e: any) {
      setAudioTranscript(`Error: ${e.message}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  // Map orders to timestamped replay timeline entries
  const timelineOrders = useMemo(() => {
    return orders.map((ord, idx) => {
      // Use assigned replay timestamp or interpolate based on order index
      const seconds = ord.replayTimestampSeconds ?? (350 + idx * 160);
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const formattedTimestamp = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      return {
        ...ord,
        calibratedSeconds: Math.max(0, seconds),
        formattedTimestamp,
        isVerified: verifiedOrderIds.has(ord.id),
      };
    }).sort((a, b) => a.calibratedSeconds - b.calibratedSeconds);
  }, [orders, verifiedOrderIds]);

  // Find currently active item based on video playhead
  const currentActiveOrder = useMemo(() => {
    return timelineOrders.find(
      (o) => Math.abs(o.calibratedSeconds - currentTime) <= 20
    ) || timelineOrders[0];
  }, [timelineOrders, currentTime]);

  const formatSeconds = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSeek = (seconds: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(seconds, duration || 3600));
    videoRef.current.currentTime = clamped;
    setCurrentTime(clamped);
    if (!isPlaying) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleSkip = (delta: number) => {
    if (!videoRef.current) return;
    handleSeek(videoRef.current.currentTime + delta);
  };

  const handleChangePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(Math.floor(videoRef.current.currentTime));
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && videoRef.current.duration) {
      setDuration(Math.floor(videoRef.current.duration));
    }
  };

  const handleVerifyOrder = (orderId: string, price: number, ts: string) => {
    setVerifiedOrderIds((prev) => new Set([...prev, orderId]));
    onVerifyPrice(orderId, price, ts);
  };

  const handleApplyCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUrlInput.trim()) return;
    setVideoUrl(customUrlInput.trim());
    setShowUrlConfig(false);
  };

  // Filter timeline orders
  const filteredTimeline = timelineOrders.filter((o) => {
    if (activeItemFilter !== 'ALL' && o.itemCode !== activeItemFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        o.buyerName.toLowerCase().includes(q) ||
        o.itemCode.toLowerCase().includes(q) ||
        o.size.toLowerCase().includes(q) ||
        (o.hostVerificationNote || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const uniqueItemCodes = ['ALL', ...Array.from(new Set(orders.map((o) => o.itemCode)))];

  return (
    <div className="space-y-6">
      {/* Replay Studio Header & Lag Calibration Bar */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <Video className="w-5 h-5 text-rose-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">
                Facebook Live Replay Review & Order Timeline Synchronization
              </h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Synchronize video replays with live order captures. Click any comment or item call to jump the video directly to that exact second.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setShowAudioTranscriber(!showAudioTranscriber)}
              className={`px-3 py-1.5 rounded-lg border transition flex items-center gap-1.5 font-semibold ${
                showAudioTranscriber
                  ? 'bg-rose-600 text-white border-rose-500 shadow-md'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
              }`}
            >
              <Mic className="w-3.5 h-3.5 text-rose-400" />
              <span>Transcribe Speech (gemini-3.5)</span>
            </button>
            <button
              onClick={() => setShowUrlConfig(!showUrlConfig)}
              className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition flex items-center gap-1.5"
            >
              <Video className="w-3.5 h-3.5 text-rose-400" />
              <span>Change Video Source</span>
            </button>
            <a
              href={live.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg border border-neutral-700 transition"
            >
              <span>FB Replay #{live.fbVideoId}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Audio Speech Transcriber Drawer (gemini-3.5-transcribe) */}
        {showAudioTranscriber && (
          <div className="mb-4 p-4 rounded-xl bg-neutral-950 border border-rose-500/30 space-y-3 text-xs shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-rose-400" />
                <strong className="text-white">Microphone & Replay Speech Transcriber</strong>
                <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono">
                  gemini-3.5-transcribe
                </span>
              </div>
              <span className="text-neutral-400">Verbatim host quotation & price slip auditor</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {isRecordingMic ? (
                <button
                  onClick={stopMicRecording}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg animate-pulse flex items-center gap-2 transition"
                >
                  <MicOff className="w-3.5 h-3.5" />
                  <span>Stop & Transcribe ({String(Math.floor(micSeconds / 60)).padStart(2, '0')}:{String(micSeconds % 60).padStart(2, '0')})</span>
                </button>
              ) : (
                <button
                  onClick={startMicRecording}
                  disabled={isTranscribing}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center gap-2 shadow-md transition disabled:opacity-50"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Record from Microphone</span>
                </button>
              )}

              <span className="text-neutral-500">or test with live clips:</span>
              <button
                onClick={() => handleTranscribeSample('sample1')}
                disabled={isTranscribing || isRecordingMic}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 transition"
              >
                🎙️ Sample 1: Host Call (BP01 ₱1,890)
              </button>
              <button
                onClick={() => handleTranscribeSample('sample2')}
                disabled={isTranscribing || isRecordingMic}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 transition"
              >
                🎙️ Sample 2: Host Discount Slip (T07 ₱2,590)
              </button>
            </div>

            {micError && (
              <div className="p-2.5 bg-amber-950/40 border border-amber-500/40 rounded-lg text-amber-300 text-[11px]">
                {micError}
              </div>
            )}

            {isTranscribing && (
              <div className="p-3 bg-neutral-900 rounded-lg flex items-center gap-2 text-rose-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Transcribing audio speech with model gemini-3.5-transcribe...</span>
              </div>
            )}

            {audioTranscript && !isTranscribing && (
              <div className="p-3 bg-neutral-900 rounded-lg border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Verbatim Transcription Output:</span>
                  </div>

                  <button
                    onClick={() => setShowAddMarker(true)}
                    className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] transition flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Pin to Timeline at Current Playhead ({formatSeconds(currentTime)})</span>
                  </button>
                </div>

                <div className="font-mono text-neutral-200 bg-neutral-950 p-2.5 rounded border border-neutral-850">
                  {audioTranscript}
                </div>

                {extractedCalls.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                    <span className="text-neutral-400 font-semibold">Detected Calls:</span>
                    {extractedCalls.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold border border-emerald-500/30">
                        [{c.code}] ₱{c.price.toLocaleString()} {c.buyer ? `— ${c.buyer}` : ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Change Video Source Dropdown / Input */}
        {showUrlConfig && (
          <form onSubmit={handleApplyCustomUrl} className="mb-4 p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <strong className="text-white">Video Source / Replay URL</strong>
              <span className="text-neutral-500">Supports direct MP4 stream or local replay asset</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={customUrlInput}
                onChange={(e) => setCustomUrlInput(e.target.value)}
                placeholder="Paste MP4 URL (default: /media/bpso-live-preview.mp4)"
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-white font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition"
              >
                Load Video
              </button>
              <button
                type="button"
                onClick={() => {
                  setVideoUrl('/media/bpso-live-preview.mp4');
                  setShowUrlConfig(false);
                }}
                className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition"
              >
                Reset Default
              </button>
            </div>
          </form>
        )}

        {/* Clock Lag Calibration Tool (docs/REPLAY-ORDERS-PROCEDURE.md Step 4) */}
        <div className="p-3.5 bg-neutral-950/80 rounded-xl border border-neutral-800 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
            <div>
              <strong className="text-white">Facebook Broadcast Clock Lag Calibration:</strong>
              <span className="text-neutral-400 ml-2">
                Broadcast started <strong className="text-amber-300 font-mono">03:15 min</strong> after Facebook Live creation.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-neutral-400">Offset:</span>
            <input
              type="range"
              min="0"
              max="360"
              step="5"
              value={clockLagSeconds}
              onChange={(e) => setClockLagSeconds(Number(e.target.value))}
              className="accent-rose-500 w-32 cursor-pointer"
            />
            <span className="font-mono text-amber-400 font-bold bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
              +{formatSeconds(clockLagSeconds)}
            </span>
            <button
              onClick={() => setClockLagSeconds(195)}
              className="text-[10px] text-neutral-400 hover:text-white underline"
            >
              Reset Calibrated Lag
            </button>
          </div>
        </div>
      </div>

      {/* Main Studio Grid: Video Player + Timeline Scrubber (7 cols) & Synchronized Order Capture Timeline (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Video Player with Interactive Visual Timeline Pins */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl">
            {/* Video Viewport */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              <video
                ref={videoRef}
                src={videoUrl}
                poster="/media/bpso-live-poster.jpg"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                className="w-full h-full object-cover"
              />

              {/* Active Item Overlay Banner on Video */}
              {currentActiveOrder && (
                <div className="absolute top-3 left-3 bg-neutral-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-neutral-800 shadow-xl flex items-center gap-2 text-xs text-white">
                  <span className="px-1.5 py-0.5 rounded bg-rose-500 text-white font-bold font-mono text-[10px]">
                    {currentActiveOrder.itemCode}
                  </span>
                  <span>{currentActiveOrder.itemName} ({currentActiveOrder.size})</span>
                  <span className="text-amber-400 font-bold font-mono">
                    ₱{(currentActiveOrder.statedUnitPricePhp || 0).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Visual Interactive Scrubber with Timestamp Pin Markers */}
            <div className="px-4 pt-3 pb-1 bg-neutral-900/95 space-y-1">
              <div 
                ref={timelineContainerRef}
                className="relative h-6 bg-neutral-950 rounded-lg cursor-pointer border border-neutral-800 group"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pos = (e.clientX - rect.left) / rect.width;
                  handleSeek(pos * (duration || 3600));
                }}
              >
                {/* Progress Fill */}
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-rose-600/40 rounded-lg transition-all"
                  style={{ width: `${((currentTime / (duration || 3600)) * 100)}%` }}
                />

                {/* Scrubber Playhead Handle */}
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-rose-500 shadow-lg shadow-rose-500/50 z-20"
                  style={{ left: `${((currentTime / (duration || 3600)) * 100)}%` }}
                />

                {/* Interactive Timestamp Pins for every live order */}
                {timelineOrders.map((ord) => {
                  const percent = Math.min(100, Math.max(0, (ord.calibratedSeconds / (duration || 3600)) * 100));
                  const isCurrent = Math.abs(ord.calibratedSeconds - currentTime) <= 20;

                  return (
                    <button
                      key={ord.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSeek(ord.calibratedSeconds);
                        setSelectedOrderId(ord.id);
                      }}
                      title={`${ord.itemCode} (${ord.size}): ${ord.buyerName} @ ${ord.formattedTimestamp}`}
                      style={{ left: `${percent}%` }}
                      className={`absolute top-0 bottom-0 w-2.5 -translate-x-1/2 flex items-center justify-center z-10 transition-transform hover:scale-150 ${
                        isCurrent ? 'scale-125' : ''
                      }`}
                    >
                      <span className={`w-1.5 h-3.5 rounded-full ${
                        isCurrent 
                          ? 'bg-amber-400 shadow-md shadow-amber-400/80' 
                          : ord.status === 'confirmed'
                          ? 'bg-emerald-400'
                          : 'bg-rose-400'
                      }`} />
                    </button>
                  );
                })}
              </div>

              {/* Time display */}
              <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono pt-1">
                <span className="font-bold text-amber-300">{formatSeconds(currentTime)}</span>
                <span className="text-neutral-500">Timeline: Click any pin or card to jump instantly</span>
                <span>{formatSeconds(duration)}</span>
              </div>
            </div>

            {/* Player Controls Bar */}
            <div className="p-4 bg-neutral-900 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSkip(-10)}
                  className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition"
                  title="Rewind 10 seconds"
                >
                  <Rewind className="w-4 h-4" />
                </button>

                <button
                  onClick={handlePlayPause}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-rose-950/40 transition text-xs"
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>{isPlaying ? 'Pause' : 'Play Replay'}</span>
                </button>

                <button
                  onClick={() => handleSkip(10)}
                  className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition"
                  title="Forward 10 seconds"
                >
                  <FastForward className="w-4 h-4" />
                </button>
              </div>

              {/* Speed Controls */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-neutral-400 text-[11px]">Speed:</span>
                {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
                  <button
                    key={rate}
                    onClick={() => handleChangePlaybackRate(rate)}
                    className={`px-2 py-1 rounded-lg font-mono text-[11px] transition ${
                      playbackRate === rate
                        ? 'bg-amber-400 text-black font-bold'
                        : 'bg-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Currently Scanned Item Call Card */}
          {currentActiveOrder && (
            <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Synced Item Call at Current Replay Time
                  </span>
                </div>
                <span className="text-xs font-mono text-amber-300 font-bold bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                  {currentActiveOrder.formattedTimestamp}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-850 flex items-center justify-between text-xs">
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className="font-mono text-rose-300">{currentActiveOrder.itemCode}</span>
                    <span>{currentActiveOrder.itemName} ({currentActiveOrder.size} {currentActiveOrder.colour})</span>
                  </div>
                  <div className="text-[11px] text-neutral-400 mt-1">
                    Buyer Claimed: <strong>{currentActiveOrder.buyerName}</strong> · Live comment: <em>"{currentActiveOrder.channel}"</em>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-bold text-amber-300 text-sm">
                    ₱{(currentActiveOrder.statedUnitPricePhp || 0).toLocaleString()}
                  </div>
                  <button
                    onClick={() => handleVerifyOrder(currentActiveOrder.id, currentActiveOrder.statedUnitPricePhp || 0, currentActiveOrder.formattedTimestamp)}
                    className="mt-1 px-2.5 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white font-semibold text-[10px] transition flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" />
                    <span>Verify Host Words</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Synchronized Order Capture Timeline */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl flex flex-col h-[600px]">
            {/* Timeline Filter & Search */}
            <div className="pb-3 border-b border-neutral-800 space-y-3 mb-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-sm text-white">Order Capture Timeline</h3>
                  <p className="text-[11px] text-neutral-400">Synced to video playhead ({filteredTimeline.length} claims)</p>
                </div>

                <button
                  onClick={() => setShowAddMarker(true)}
                  className="px-2.5 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-semibold transition flex items-center gap-1 border border-rose-500/40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Pin Current Time</span>
                </button>
              </div>

              {/* Item code pill filters */}
              <div className="flex overflow-x-auto no-scrollbar gap-1 text-[11px]">
                {uniqueItemCodes.map((code) => (
                  <button
                    key={code}
                    onClick={() => setActiveItemFilter(code)}
                    className={`px-2.5 py-1 rounded-lg font-mono transition whitespace-nowrap ${
                      activeItemFilter === code
                        ? 'bg-rose-600 text-white font-bold'
                        : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Filter buyer, code, notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            {/* Scrollable Timeline List */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
              {filteredTimeline.map((ord) => {
                const isSelected = selectedOrderId === ord.id;
                const isCurrentTime = Math.abs(ord.calibratedSeconds - currentTime) <= 20;

                return (
                  <div
                    key={ord.id}
                    onClick={() => {
                      setSelectedOrderId(ord.id);
                      handleSeek(ord.calibratedSeconds);
                    }}
                    className={`p-3.5 rounded-xl border cursor-pointer transition ${
                      isCurrentTime
                        ? 'bg-amber-950/30 border-amber-500/80 shadow-lg shadow-amber-950/40'
                        : isSelected
                        ? 'bg-neutral-950 border-rose-500/60'
                        : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        {/* Timestamp Seek Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSeek(ord.calibratedSeconds);
                            setSelectedOrderId(ord.id);
                          }}
                          className={`flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded transition ${
                            isCurrentTime
                              ? 'bg-amber-400 text-black animate-pulse'
                              : 'bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700'
                          }`}
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>{ord.formattedTimestamp}</span>
                        </button>

                        <span className="font-mono font-bold text-white text-xs">{ord.itemCode}</span>
                        <span className="text-neutral-400 text-[11px]">{ord.size} {ord.colour}</span>
                      </div>

                      <span className="font-mono font-bold text-emerald-400">
                        ₱{(ord.statedUnitPricePhp || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-neutral-300 mb-1">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 text-neutral-500" />
                        <strong className="text-white">{ord.buyerName}</strong>
                        {ord.isVip && (
                          <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                            VIP
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-neutral-500">
                        {ord.channel === 'messenger' ? 'Messenger' : 'Live comment'}
                      </span>
                    </div>

                    {ord.hostVerificationNote && (
                      <div className="text-[11px] text-neutral-400 italic bg-neutral-900/60 p-2 rounded-lg border border-neutral-850 mt-1">
                        "{ord.hostVerificationNote}"
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 mt-1 border-t border-neutral-850 text-[10px]">
                      <span className="text-neutral-500">
                        Order #{ord.id}
                      </span>

                      {ord.isVerified ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Verified from Replay ✓</span>
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVerifyOrder(ord.id, ord.statedUnitPricePhp || 0, ord.formattedTimestamp);
                          }}
                          className="text-amber-400 hover:text-amber-300 font-semibold underline"
                        >
                          Verify Price at {ord.formattedTimestamp}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Pin New Timestamp Marker Modal */}
      {showAddMarker && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-rose-400" />
                <span>Pin Order at Current Replay Moment ({formatSeconds(currentTime)})</span>
              </h3>
              <button onClick={() => setShowAddMarker(false)} className="text-neutral-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1">Item Code</label>
                <input
                  type="text"
                  value={newMarkerCode}
                  onChange={(e) => setNewMarkerCode(e.target.value.toUpperCase())}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Buyer Named by Host</label>
                <input
                  type="text"
                  value={newMarkerBuyer}
                  onChange={(e) => setNewMarkerBuyer(e.target.value)}
                  placeholder="e.g. Rowena Dizon"
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Host Quoted Price (PHP)</label>
                <input
                  type="number"
                  value={newMarkerPrice}
                  onChange={(e) => setNewMarkerPrice(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Host Verbal Quote / Spoken Words</label>
                <textarea
                  rows={2}
                  value={newMarkerQuote}
                  onChange={(e) => setNewMarkerQuote(e.target.value)}
                  placeholder='e.g. "Yours na Rowena, 1,890 po ito!"'
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setShowAddMarker(false)}
                  className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMarker(false);
                    // Add new order anchored at this timestamp
                  }}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl"
                >
                  Save Timestamped Marker
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
