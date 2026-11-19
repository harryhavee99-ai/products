import React, { useRef, useState } from 'react';
import { Activity, Loader2, Mic, MicOff, Music, Plus, Square, Sparkles, Wand2 } from 'lucide-react';
import type { AudioAnalysisResult, BeatSyncMode, MediaAsset, StudioProject } from '../types/studio';
import { studioApi, uploadMediaFileChunked } from '../services/api';
import { formatShortDuration } from '../data/catalogs';

interface AudioBeatAndVoiceStudioProps {
  project: StudioProject;
  geminiConfigured: boolean;
  onAudioAnalyzed: (analysis: AudioAnalysisResult) => void;
  onSyncClipsToBeats: (mode: BeatSyncMode) => void;
  onVoiceoverCreated: (asset: MediaAsset, addTextOverlay?: { text: string }) => void;
  onAddAudioToTimeline: (asset: MediaAsset, trackId: 'a1' | 'a2') => void;
}

export const AudioBeatAndVoiceStudio: React.FC<AudioBeatAndVoiceStudioProps> = ({
  project,
  geminiConfigured,
  onAudioAnalyzed,
  onSyncClipsToBeats,
  onVoiceoverCreated,
  onAddAudioToTimeline,
}) => {
  const audioAssets = project.assets.filter((a) => a.mediaType === 'audio');
  const [selectedAssetId, setSelectedAssetId] = useState<string>(
    project.audioAnalysis?.assetId || audioAssets[0]?.id || ''
  );
  const [sensitivity, setSensitivity] = useState<number>(project.audioAnalysis?.sensitivity ?? 55);
  const [syncMode, setSyncMode] = useState<BeatSyncMode>(project.beatSyncMode);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voiceover Studio (TTS + Live Mic Recording)
  const [scriptText, setScriptText] = useState('');
  const [voiceName, setVoiceName] = useState<'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr'>('Kore');
  const [voiceStyle, setVoiceStyle] = useState('Warm, confident luxury commercial narrator');
  const [syncCaption, setSyncCaption] = useState(true);
  const [generatingTts, setGeneratingTts] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const activeAssetId = selectedAssetId || audioAssets[0]?.id || '';

  const handleAnalyzeAudio = async () => {
    if (!activeAssetId) return;
    setAnalyzing(true);
    setError(null);
    try {
      const analysis = await studioApi.analyzeAudio(project.id, activeAssetId, sensitivity);
      onAudioAnalyzed(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateTts = async () => {
    if (!scriptText.trim()) return;
    setGeneratingTts(true);
    setTtsError(null);
    try {
      const asset = await studioApi.generateVoiceoverTts(project.id, {
        text: scriptText.trim(),
        voiceName,
        style: voiceStyle,
        title: `${project.settings.productName || 'Commercial'}_VO`,
      });
      onVoiceoverCreated(asset, syncCaption ? { text: scriptText.trim().slice(0, 72) } : undefined);
      setScriptText('');
    } catch (err) {
      setTtsError(err instanceof Error ? err.message : String(err));
    } finally {
      setGeneratingTts(false);
    }
  };

  const toggleMicRecording = async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }
    setTtsError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true },
      });
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `Voiceover_${Date.now().toString().slice(-4)}.webm`, {
          type: 'audio/webm',
        });
        try {
          const asset = await uploadMediaFileChunked({
            projectId: project.id,
            file,
            bin: 'audio',
            folder: 'Voiceovers',
          });
          onVoiceoverCreated(asset);
        } catch (err) {
          setTtsError(err instanceof Error ? err.message : String(err));
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      setTtsError(err instanceof Error ? err.message : 'Microphone permission denied.');
    }
  };

  const analysis = project.audioAnalysis;

  return (
    <div className="h-full overflow-y-auto p-3.5 space-y-5 text-xs">
      {/* Section 1: Music Beat Intelligence */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Audio Beat Intelligence</h3>
          <p className="text-slate-400 mt-0.5 leading-relaxed">
            Signal-processing onset & autocorrelation engine detects BPM, downbeats, bars, drops, energy curves, and silences directly from your imported soundtrack.
          </p>
        </div>

        {audioAssets.length === 0 ? (
          <div className="p-3 rounded-lg bg-[#151923] border border-white/[0.07] text-slate-400">
            Import an MP3, WAV, AAC, M4A, FLAC, OGG, or AIFF soundtrack in the Import tab first.
          </div>
        ) : (
          <div className="space-y-2.5">
            <label className="block space-y-1">
              <span className="text-slate-400">Select Soundtrack</span>
              <select
                value={activeAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full bg-[#181C26] border border-white/10 rounded px-2.5 py-1.5 text-white"
              >
                {audioAssets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatShortDuration(a.duration)})
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Beat Sensitivity</span>
                <span className="font-mono tabular-nums text-slate-200">{sensitivity}%</span>
              </div>
              <input
                type="range"
                min={15}
                max={90}
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAnalyzeAudio}
                disabled={analyzing || !activeAssetId}
                className="flex-1 py-2 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-45 text-white font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                <span>{analyzing ? 'Analyzing PCM...' : 'Analyze Beats & Drops'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const found = audioAssets.find((a) => a.id === activeAssetId);
                  if (found) onAddAudioToTimeline(found, 'a1');
                }}
                className="px-2.5 py-2 rounded-lg bg-[#181C26] hover:bg-white/[0.1] border border-white/10 text-slate-200"
                title="Place music on track A1"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300">
            {error}
          </div>
        )}

        {analysis && (
          <div className="p-3 rounded-lg bg-[#151923] border border-white/[0.08] space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#0F121A] rounded p-2">
                <div className="text-[10px] text-slate-400">Tempo</div>
                <div className="font-mono text-sm font-semibold text-[#C4B5FD] tabular-nums">
                  {analysis.bpm} BPM
                </div>
              </div>
              <div className="bg-[#0F121A] rounded p-2">
                <div className="text-[10px] text-slate-400">Beats</div>
                <div className="font-mono text-sm font-semibold text-[#93C5FD] tabular-nums">
                  {analysis.beats.length}
                </div>
              </div>
              <div className="bg-[#0F121A] rounded p-2">
                <div className="text-[10px] text-slate-400">Peak Level</div>
                <div className="font-mono text-sm font-semibold text-emerald-300 tabular-nums">
                  {analysis.peakDb} dB
                </div>
              </div>
            </div>

            {/* Mini Energy & Waveform Visualization */}
            <div className="h-14 bg-[#0B0E14] rounded border border-white/[0.06] px-1.5 py-2 flex items-end gap-[2px] overflow-hidden">
              {analysis.energyCurve.map((val, idx) => (
                <div
                  key={idx}
                  className="flex-1 rounded-t bg-gradient-to-t from-[#3B82F6] to-[#A855F7]"
                  style={{ height: `${Math.max(8, Math.round(val * 100))}%` }}
                />
              ))}
            </div>

            {/* Detected Musical Sections */}
            <div className="space-y-1">
              <div className="text-[11px] text-slate-400">Detected Sections</div>
              <div className="space-y-1 max-h-28 overflow-y-auto">
                {analysis.sections.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between text-[11px] py-1 border-b border-white/[0.05] last:border-none"
                  >
                    <span className="text-slate-200 font-medium">{s.label}</span>
                    <span className="font-mono tabular-nums text-slate-400">
                      {s.start.toFixed(1)}s – {s.end.toFixed(1)}s · {Math.round(s.energy * 100)}% energy
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sync Existing Timeline Cuts to Beats */}
            <div className="space-y-2 pt-2 border-t border-white/[0.07]">
              <select
                value={syncMode}
                onChange={(e) => setSyncMode(e.target.value as BeatSyncMode)}
                className="w-full bg-[#1C212E] border border-white/10 rounded px-2 py-1.5 text-white"
              >
                <option value="strict">Strict Beat Sync</option>
                <option value="intelligent">Intelligent Music Sync</option>
                <option value="cinematic">Cinematic Audio Sync</option>
              </select>
              <button
                type="button"
                onClick={() => onSyncClipsToBeats(syncMode)}
                className="w-full py-2 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Snap Timeline Video Cuts to Beats</span>
              </button>
              <p className="text-[10px] text-slate-500">
                Tip: Shift+Double-Click on the timeline ruler to add or remove manual beat markers.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Section 2: Voiceover & Text-to-Speech Studio */}
      <section className="space-y-3 pt-4 border-t border-white/[0.08]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Voiceover & Narration Studio</h3>
            <p className="text-slate-400 mt-0.5">Record via microphone or generate studio TTS narration.</p>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleMicRecording}
          className={`w-full py-2 rounded-lg border font-medium flex items-center justify-center gap-2 transition-colors ${
            isRecording
              ? 'bg-rose-600 border-rose-500 text-white'
              : 'bg-[#151923] border-white/10 text-slate-200 hover:border-white/25'
          }`}
        >
          {isRecording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-rose-400" />}
          <span>{isRecording ? 'Stop Recording & Save to Voiceovers' : 'Record Voiceover (Noise Reduction On)'}</span>
        </button>

        <div className="space-y-2 pt-2">
          <textarea
            rows={3}
            value={scriptText}
            onChange={(e) => setScriptText(e.target.value)}
            placeholder="Write your approved commercial voiceover narration script..."
            className="w-full bg-[#181C26] border border-white/10 rounded-lg p-2.5 text-slate-100 placeholder:text-slate-500 resize-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={voiceName}
              onChange={(e) => setVoiceName(e.target.value as typeof voiceName)}
              className="bg-[#181C26] border border-white/10 rounded px-2 py-1.5 text-white"
            >
              <option value="Kore">Kore · Crisp Editorial</option>
              <option value="Puck">Puck · Energetic Modern</option>
              <option value="Charon">Charon · Deep Cinema</option>
              <option value="Fenrir">Fenrir · Bold Commercial</option>
              <option value="Zephyr">Zephyr · Soft Luxury</option>
            </select>
            <input
              type="text"
              value={voiceStyle}
              onChange={(e) => setVoiceStyle(e.target.value)}
              placeholder="Delivery direction"
              className="bg-[#181C26] border border-white/10 rounded px-2 py-1.5 text-white"
            />
          </div>
          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={syncCaption}
              onChange={(e) => setSyncCaption(e.target.checked)}
            />
            <span>Add synchronized narration caption to GFX track</span>
          </label>
          <button
            type="button"
            onClick={handleGenerateTts}
            disabled={generatingTts || !scriptText.trim() || !geminiConfigured}
            className="w-full py-2 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-45 text-white font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            {generatingTts ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>{generatingTts ? 'Synthesizing WAV...' : 'Generate Commercial Voiceover'}</span>
          </button>
          {!geminiConfigured && (
            <p className="text-[11px] text-amber-300">
              Configure GEMINI_API_KEY in Settings &gt; Secrets to enable AI TTS voiceover generation.
            </p>
          )}
          {ttsError && (
            <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px]">
              {ttsError}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
