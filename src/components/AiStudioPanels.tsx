import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Sparkles, Wand2 } from 'lucide-react';
import type {
  BeatSyncMode,
  CustomPaceSettings,
  EditingPaceMode,
  ProductAnalysisReport,
  StudioProject,
  TimelineClip,
} from '../types/studio';
import { DURATION_PRESETS, getCategoryMeta } from '../data/catalogs';
import { studioApi } from '../services/api';

interface AiStudioPanelsProps {
  mode: 'analysis' | 'auto_edit';
  project: StudioProject;
  geminiConfigured: boolean;
  onAnalysisComplete: (report: ProductAnalysisReport) => void;
  onApplyRecommendedStyle: (lookId: string, pace: EditingPaceMode, idealDuration: number) => void;
  onApplyAutoEdit: (clips: TimelineClip[], pace: EditingPaceMode, targetDuration: number, beatSyncMode: BeatSyncMode) => void;
  onUpdateCustomPace: (custom: CustomPaceSettings) => void;
}

export const AiStudioPanels: React.FC<AiStudioPanelsProps> = ({
  mode,
  project,
  geminiConfigured,
  onAnalysisComplete,
  onApplyRecommendedStyle,
  onApplyAutoEdit,
  onUpdateCustomPace,
}) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Auto Editor state
  const [pace, setPace] = useState<EditingPaceMode>(project.settings.editingStyle);
  const [targetDuration, setTargetDuration] = useState<number>(project.settings.targetDuration);
  const [beatSyncMode, setBeatSyncMode] = useState<BeatSyncMode>(project.beatSyncMode);
  const [useAiSequencing, setUseAiSequencing] = useState(true);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [autoFeedback, setAutoFeedback] = useState<{
    achievedDuration: number;
    targetDuration: number;
    footageShortfall: boolean;
    shortfallSeconds: number;
    shortfallAlternatives: string[];
    pacingNotes: string;
    beatSynced: boolean;
  } | null>(null);

  const category = getCategoryMeta(project.settings.productCategory);
  const visualCount = project.assets.filter((a) => a.mediaType === 'video' || a.mediaType === 'image').length;

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const report = await studioApi.analyzeProduct(project.id);
      onAnalysisComplete(report);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  };

  const runAutoEdit = async () => {
    setAutoRunning(true);
    setAutoError(null);
    try {
      const res = await studioApi.runAutoEdit(project.id, {
        pace,
        targetDuration,
        beatSyncMode,
        useAiSequencing,
      });
      setAutoFeedback({
        achievedDuration: res.achievedDuration,
        targetDuration: res.targetDuration,
        footageShortfall: res.footageShortfall,
        shortfallSeconds: res.shortfallSeconds,
        shortfallAlternatives: res.shortfallAlternatives,
        pacingNotes: res.pacingNotes,
        beatSynced: res.beatSynced,
      });
      onApplyAutoEdit(res.clips, pace, targetDuration, beatSyncMode);
    } catch (err) {
      setAutoError(err instanceof Error ? err.message : String(err));
    } finally {
      setAutoRunning(false);
    }
  };

  if (mode === 'analysis') {
    const report = project.productAnalysis;
    return (
      <div className="h-full overflow-y-auto p-3.5 space-y-4 text-xs">
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-white">AI Product Understanding Engine</h3>
          <p className="text-slate-400 leading-relaxed">
            Inspects extracted video keyframes and product images with Gemini vision to identify packaging, materials, angles, and optimal commercial structure while strictly preserving original product identity.
          </p>
        </div>

        <div className="p-3 rounded-lg bg-[#151923] border border-white/[0.07] space-y-1.5">
          <div className="text-slate-200 font-medium">Category Direction · {category.label}</div>
          <p className="text-slate-400 leading-relaxed">{category.cinematographyGuidance}</p>
          <div className="text-[11px] text-slate-500 pt-1">
            Suggested pace: {category.recommendedPace} · Color: {category.recommendedColorLook.replace(/_/g, ' ')} · Music: {category.recommendedMusicStyle}
          </div>
        </div>

        {!geminiConfigured && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              Gemini API key is not configured on the server. Configure <span className="font-mono">GEMINI_API_KEY</span> in Settings &gt; Secrets to run AI product frame analysis.
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={runAnalysis}
          disabled={analyzing || visualCount === 0}
          className="w-full py-2.5 px-3 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-45 text-white font-medium flex items-center justify-center gap-2 transition-colors"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          <span>
            {analyzing
              ? 'Analyzing Product Frames with Gemini...'
              : `Analyze ${visualCount} Visual Asset${visualCount === 1 ? '' : 's'}`}
          </span>
        </button>

        {analysisError && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
            {analysisError}
          </div>
        )}

        {report && (
          <div className="space-y-3 pt-2 border-t border-white/[0.08]">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">Analysis Report</span>
              <span className="text-[11px] font-mono text-slate-500">{report.modelUsed}</span>
            </div>

            <div className="p-3 rounded-lg bg-[#141822] border border-white/[0.07] space-y-2">
              <div>
                <div className="text-[11px] text-slate-400">Product Identity</div>
                <div className="text-slate-100 mt-0.5">{report.productIdentity}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Appearance & Packaging</div>
                <div className="text-slate-300 mt-0.5">{report.productAppearance} {report.packagingDetails}</div>
              </div>
              <div className="text-[11px] text-slate-400">
                Colors: <span className="text-slate-200">{report.dominantColors.join(' · ') || 'Detected in frame'}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Materials: <span className="text-slate-200">{report.materials.join(' · ') || 'Unspecified'}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Brand Logo: <span className="text-slate-200">{report.brandLogoDetected}</span>
              </div>
              <div className="text-[11px] text-emerald-300 flex items-start gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{report.fidelityConfirmation}</span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#141822] border border-white/[0.07] space-y-2">
              <div className="font-medium text-white">Editorial Recommendations</div>
              <div className="text-slate-300 space-y-1">
                <p><strong className="text-slate-200">Opening:</strong> {report.recommendations.bestOpeningShotReason}</p>
                <p><strong className="text-slate-200">Reveal:</strong> {report.recommendations.bestProductRevealReason}</p>
                <p><strong className="text-slate-200">Closing:</strong> {report.recommendations.bestClosingShotReason}</p>
              </div>
              <div className="text-[11px] text-slate-400 pt-1">
                Recommended: {report.recommendations.recommendedPace} pace · {report.recommendations.idealDurationSeconds}s · {report.recommendations.recommendedColorGrade.replace(/_/g, ' ')} · {report.recommendations.recommendedMusicStyle}
              </div>
              <button
                type="button"
                onClick={() =>
                  onApplyRecommendedStyle(
                    report.recommendations.recommendedColorGrade,
                    (report.recommendations.recommendedPace as EditingPaceMode) || 'normal',
                    Math.max(5, Math.round(report.recommendations.idealDurationSeconds || 30))
                  )
                }
                className="w-full py-1.5 rounded bg-[#3B82F6]/20 hover:bg-[#3B82F6]/30 text-[#93C5FD] border border-[#3B82F6]/40 font-medium transition-colors"
              >
                Apply Recommended Color Look, Pace & Duration
              </button>
            </div>

            {report.shotBreakdown.length > 0 && (
              <div className="space-y-1.5">
                <div className="font-medium text-slate-200">Shot Breakdown</div>
                {report.shotBreakdown.map((shot, idx) => (
                  <div key={`${shot.assetId}_${idx}`} className="p-2.5 rounded bg-[#151923] border border-white/[0.06]">
                    <div className="flex items-center justify-between text-slate-100 font-medium">
                      <span className="truncate">{shot.assetName}</span>
                      <span className="text-[11px] text-[#C4B5FD] capitalize shrink-0">{shot.role}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {shot.cameraAngle} · In {shot.recommendedIn}s – Out {shot.recommendedOut}s
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{shot.notes}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // AI Auto Editor Mode
  const custom = project.settings.customPace;

  return (
    <div className="h-full overflow-y-auto p-3.5 space-y-4 text-xs">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-white">AI Automatic Video Editor</h3>
        <p className="text-slate-400 leading-relaxed">
          Automatically sequences your imported footage to your target duration and music beats. Never silently duplicates shots when footage is short.
        </p>
      </div>

      {/* Editing Pace Mode */}
      <div className="space-y-1.5">
        <label className="text-slate-300 font-medium block">Editing Pace</label>
        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              { id: 'fast', label: 'Fast-Paced', desc: 'Social & energetic drops' },
              { id: 'normal', label: 'Normal-Paced', desc: 'Balanced commercial' },
              { id: 'slow', label: 'Slow-Paced', desc: 'Luxury & cinematic' },
              { id: 'custom', label: 'Custom Pace', desc: 'Manual control' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPace(opt.id)}
              className={`p-2.5 rounded-lg border text-left transition-colors ${
                pace === opt.id
                  ? 'bg-[#7C3AED]/20 border-[#7C3AED] text-white'
                  : 'bg-[#151923] border-white/[0.07] text-slate-300 hover:border-white/20'
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Pace Controls */}
      {pace === 'custom' && (
        <div className="p-3 rounded-lg bg-[#151923] border border-white/[0.08] space-y-2.5">
          <div className="font-medium text-slate-200">Custom Pace Parameters</div>
          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] text-slate-400">Min (s)</span>
              <input
                type="number"
                step={0.2}
                min={0.3}
                value={custom.minShotDuration}
                onChange={(e) => onUpdateCustomPace({ ...custom, minShotDuration: Number(e.target.value) })}
                className="w-full bg-[#1C212E] border border-white/10 rounded px-1.5 py-1 text-white font-mono"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-slate-400">Avg (s)</span>
              <input
                type="number"
                step={0.2}
                min={0.5}
                value={custom.avgShotDuration}
                onChange={(e) => onUpdateCustomPace({ ...custom, avgShotDuration: Number(e.target.value) })}
                className="w-full bg-[#1C212E] border border-white/10 rounded px-1.5 py-1 text-white font-mono"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-slate-400">Max (s)</span>
              <input
                type="number"
                step={0.5}
                min={1}
                value={custom.maxShotDuration}
                onChange={(e) => onUpdateCustomPace({ ...custom, maxShotDuration: Number(e.target.value) })}
                className="w-full bg-[#1C212E] border border-white/10 rounded px-1.5 py-1 text-white font-mono"
              />
            </label>
          </div>
          {(
            [
              ['cutFrequency', 'Cut Frequency'],
              ['transitionFrequency', 'Transition Frequency'],
              ['motionIntensity', 'Motion Intensity'],
              ['speedRampIntensity', 'Speed Ramp Intensity'],
              ['zoomIntensity', 'Zoom Intensity'],
              ['visualEffectIntensity', 'Visual Effect Intensity'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="space-y-0.5">
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>{label}</span>
                <span className="font-mono tabular-nums text-slate-200">{custom[key]}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={custom[key]}
                onChange={(e) => onUpdateCustomPace({ ...custom, [key]: Number(e.target.value) })}
                className="w-full"
              />
            </div>
          ))}
        </div>
      )}

      {/* Target Commercial Duration */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-medium">Final Video Duration</span>
          <span className="font-mono tabular-nums text-[#C4B5FD]">{targetDuration}s</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {DURATION_PRESETS.map((d) => (
            <button
              key={d.seconds}
              type="button"
              onClick={() => setTargetDuration(d.seconds)}
              className={`px-2 py-1 rounded font-mono text-[11px] tabular-nums transition-colors ${
                targetDuration === d.seconds
                  ? 'bg-[#3B82F6] text-white'
                  : 'bg-[#181C26] text-slate-400 hover:text-white'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[11px] text-slate-400">Custom seconds:</span>
          <input
            type="number"
            min={3}
            max={600}
            value={targetDuration}
            onChange={(e) => setTargetDuration(Math.max(3, Number(e.target.value)))}
            className="w-20 bg-[#181C26] border border-white/10 rounded px-2 py-1 text-white font-mono tabular-nums"
          />
        </div>
      </div>

      {/* Music Beat Synchronization Mode */}
      <div className="space-y-1.5">
        <label className="text-slate-300 font-medium block">Music Synchronization Mode</label>
        <select
          value={beatSyncMode}
          onChange={(e) => setBeatSyncMode(e.target.value as BeatSyncMode)}
          className="w-full bg-[#181C26] border border-white/10 rounded px-2.5 py-1.5 text-white"
        >
          <option value="strict">Strict Beat Sync (cut on every detected beat)</option>
          <option value="intelligent">Intelligent Music Sync (cut on strong beats & drops)</option>
          <option value="cinematic">Cinematic Audio Sync (cut on bar downbeats & phrases)</option>
        </select>
        <div className="text-[11px] text-slate-500">
          {project.audioAnalysis
            ? `Active music grid: ${project.audioAnalysis.bpm} BPM · ${project.audioAnalysis.beats.length} beats detected`
            : 'No music analyzed yet — analyze an audio track in Audio & Beats to snap cuts to rhythm.'}
        </div>
      </div>

      <label className="flex items-center gap-2 text-slate-300">
        <input
          type="checkbox"
          checked={useAiSequencing}
          onChange={(e) => setUseAiSequencing(e.target.checked)}
        />
        <span>Use Gemini AI director shot ordering</span>
      </label>

      <button
        type="button"
        onClick={runAutoEdit}
        disabled={autoRunning || visualCount === 0}
        className="w-full py-2.5 px-3 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-45 text-white font-medium flex items-center justify-center gap-2 transition-colors"
      >
        {autoRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
        <span>{autoRunning ? 'Generating Commercial Edit...' : 'Build Commercial Edit on Timeline'}</span>
      </button>

      {autoError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
          {autoError}
        </div>
      )}

      {autoFeedback && (
        <div className="p-3 rounded-lg bg-[#151923] border border-white/[0.08] space-y-2">
          <div className="flex items-center justify-between text-slate-200 font-medium">
            <span>Edit Generated</span>
            <span className="font-mono tabular-nums text-[#93C5FD]">
              {autoFeedback.achievedDuration}s / {autoFeedback.targetDuration}s
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed">{autoFeedback.pacingNotes}</p>
          {autoFeedback.beatSynced && (
            <div className="text-[11px] text-emerald-300">
              Cuts synchronized to detected musical beats ({beatSyncMode} mode).
            </div>
          )}
          {autoFeedback.footageShortfall && (
            <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-1.5">
              <div className="font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Footage Shortfall ({autoFeedback.shortfallSeconds}s remaining)</span>
              </div>
              <p className="text-[11px] text-amber-200/85">
                Pro Product Studio AI did not duplicate or stretch your shots. Options to reach {autoFeedback.targetDuration}s:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                {autoFeedback.shortfallAlternatives.map((alt, idx) => (
                  <li key={idx}>{alt}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
