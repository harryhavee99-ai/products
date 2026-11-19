import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Copy,
  Download,
  History,
  Keyboard,
  RotateCcw,
  Save,
  Server,
  Sliders,
} from 'lucide-react';
import type {
  RenderJobStatus,
  StudioProject,
  StudioServerSettings,
} from '../types/studio';
import {
  COMMERCIAL_TEMPLATES,
  type CommercialTemplate,
  formatFileSize,
} from '../data/catalogs';

interface TemplatesLibraryViewProps {
  activeProject: StudioProject | null;
  onApplyTemplateToActive: (tpl: CommercialTemplate) => void;
  onCreateProjectFromTemplate: (tpl: CommercialTemplate) => void;
}

export const TemplatesLibraryView: React.FC<TemplatesLibraryViewProps> = ({
  activeProject,
  onApplyTemplateToActive,
  onCreateProjectFromTemplate,
}) => {
  const [group, setGroup] = useState<'All' | CommercialTemplate['group']>('All');
  const groups: Array<'All' | CommercialTemplate['group']> = [
    'All',
    'Fashion',
    'Beauty',
    'Grocery',
    'Electronics',
    'Jewellery',
    'General',
  ];

  const filtered = COMMERCIAL_TEMPLATES.filter((t) => (group === 'All' ? true : t.group === group));

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Product-Specific AI Commercial Templates</h1>
          <p className="text-xs text-slate-400 mt-1">
            Every template configures aspect ratio, commercial pace, color grading look, transition style, and editable title styling for your product footage.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {groups.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                group === g
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-[#151923] text-slate-400 hover:text-white'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((tpl) => (
          <div
            key={tpl.id}
            className="rounded-xl border border-white/[0.08] bg-[#12161F] overflow-hidden flex flex-col justify-between hover:border-white/20 transition-colors"
          >
            <div>
              <div className="h-44 bg-black relative overflow-hidden border-b border-white/[0.06]">
                <img
                  src={tpl.previewImage}
                  alt={tpl.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-3.5 right-3.5 flex items-end justify-between">
                  <div>
                    <div className="text-xs text-slate-300">
                      {tpl.group} · {tpl.aspectRatio} · {tpl.duration}s
                    </div>
                    <h3 className="text-base font-semibold text-white">{tpl.name}</h3>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-2 text-xs">
                <p className="text-slate-400 leading-relaxed">{tpl.description}</p>
                <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                  {tpl.pace} pace · {tpl.colorLook.replace(/_/g, ' ')} · ~{tpl.recommendedShotCount} shots
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-white/[0.06] flex items-center gap-2">
              {activeProject && (
                <button
                  type="button"
                  onClick={() => onApplyTemplateToActive(tpl)}
                  className="flex-1 py-2 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-xs font-medium text-white transition-colors"
                >
                  Apply to Active Project
                </button>
              )}
              <button
                type="button"
                onClick={() => onCreateProjectFromTemplate(tpl)}
                className={`${
                  activeProject ? 'px-3' : 'flex-1'
                } py-2 rounded-lg bg-[#1A202D] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap`}
              >
                New Project
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ProjectHistoryViewProps {
  project: StudioProject | null;
  renders: RenderJobStatus[];
  onCreateSnapshot: (label: string) => void;
  onRestoreSnapshot: (versionId: string) => void;
  onDuplicateProject: (projectId: string) => void;
}

export const ProjectHistoryView: React.FC<ProjectHistoryViewProps> = ({
  project,
  renders,
  onCreateSnapshot,
  onRestoreSnapshot,
  onDuplicateProject,
}) => {
  const [label, setLabel] = useState('');

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Project History & Render Queue</h1>
          <p className="text-xs text-slate-400 mt-1">
            Create named project checkpoints, restore earlier timeline versions, duplicate commercial cuts, and download completed FFmpeg renders.
          </p>
        </div>
        {project && (
          <button
            type="button"
            onClick={() => onDuplicateProject(project.id)}
            className="px-3.5 py-2 rounded-lg bg-[#171B25] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-slate-200 flex items-center gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Duplicate Active Project</span>
          </button>
        )}
      </div>

      {project ? (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-[#A855F7]" />
              <span>Version Snapshots · {project.settings.projectName}</span>
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Checkpoint name (e.g., Cut v2 Beat Synced)"
                className="w-64 bg-[#161A24] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white"
              />
              <button
                type="button"
                onClick={() => {
                  onCreateSnapshot(label.trim() || `Checkpoint ${project.versions.length + 1}`);
                  setLabel('');
                }}
                className="px-3.5 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-xs font-medium text-white flex items-center gap-1.5 whitespace-nowrap"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Snapshot</span>
              </button>
            </div>
          </div>

          {project.versions.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#12161F] border border-white/[0.08] text-xs text-slate-400">
              No manual version snapshots saved yet. Save a checkpoint before experimenting with major pace or color grade changes.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#12161F] overflow-hidden">
              {project.versions.map((v) => (
                <div key={v.id} className="px-5 py-3.5 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="text-sm font-medium text-white">{v.label}</div>
                    <div className="text-slate-400 font-mono tabular-nums mt-0.5">
                      {new Date(v.createdAt).toLocaleString()} · {v.clipCount} clips · {v.duration.toFixed(1)}s
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRestoreSnapshot(v.id)}
                    className="px-3 py-1.5 rounded-lg bg-[#1A202D] hover:bg-[#7C3AED] text-slate-200 hover:text-white flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <div className="p-6 rounded-xl bg-[#12161F] border border-white/[0.08] text-xs text-slate-400">
          Open a project from the Dashboard to manage version snapshots.
        </div>
      )}

      {/* Render Job History */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#3B82F6]" />
          <span>FFmpeg Render History</span>
        </h2>

        {renders.length === 0 ? (
          <div className="p-6 rounded-xl bg-[#12161F] border border-white/[0.08] text-xs text-slate-400">
            No FFmpeg export jobs have been run yet.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-[#12161F] overflow-hidden">
            {renders.map((job) => (
              <div key={job.id} className="px-5 py-3.5 flex items-center justify-between gap-4 text-xs">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{job.outputFilename}</div>
                  <div className="text-slate-400 font-mono tabular-nums mt-0.5">
                    Status: {job.status} · {job.progress}% · {job.stage}
                    {job.fileSize ? ` · ${formatFileSize(job.fileSize)}` : ''}
                  </div>
                  {job.error && <div className="text-rose-400 mt-1">{job.error}</div>}
                </div>
                {job.status === 'completed' && job.outputUrl && (
                  <a
                    href={job.outputUrl}
                    download={job.outputFilename}
                    className="px-3 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium flex items-center gap-1.5 shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

interface SettingsViewProps {
  settings: StudioServerSettings;
  systemStatus: {
    ffmpeg: { available: boolean; version: string; encoders: string[] };
    geminiConfigured: boolean;
  } | null;
  onSaveSettings: (next: StudioServerSettings) => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  systemStatus,
  onSaveSettings,
}) => {
  const [draft, setDraft] = useState<StudioServerSettings>(settings);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(draft);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      <div className="border-b border-white/[0.08] pb-5">
        <h1 className="text-2xl font-bold text-white">Studio Settings & Engine Configuration</h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure chunked upload limits, background proxy generation, default codecs, and inspect server FFmpeg capabilities.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSave} className="lg:col-span-2 bg-[#12161F] border border-white/[0.08] rounded-xl p-6 space-y-5 text-xs">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Sliders className="w-4 h-4 text-[#A855F7]" />
            <span>Media Ingestion & Proxy Pipeline</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <label className="space-y-1.5">
              <span className="text-slate-300">Max Upload Size (MB)</span>
              <input
                type="number"
                min={50}
                max={50000}
                value={draft.maxUploadSizeMb}
                onChange={(e) => setDraft({ ...draft, maxUploadSizeMb: Number(e.target.value) })}
                className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-slate-300">Max Video Duration (sec)</span>
              <input
                type="number"
                min={30}
                max={21600}
                value={draft.maxVideoDurationSec}
                onChange={(e) => setDraft({ ...draft, maxVideoDurationSec: Number(e.target.value) })}
                className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-slate-300">Resumable Chunk Size (MB)</span>
              <input
                type="number"
                min={1}
                max={50}
                value={draft.chunkSizeMb}
                onChange={(e) => setDraft({ ...draft, chunkSizeMb: Number(e.target.value) })}
                className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white font-mono tabular-nums"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-white/[0.07]">
            <label className="flex items-center gap-2.5 text-slate-200">
              <input
                type="checkbox"
                checked={draft.proxyEnabled}
                onChange={(e) => setDraft({ ...draft, proxyEnabled: e.target.checked })}
              />
              <span>Auto-generate edit proxies for 1080p+/4K/8K footage</span>
            </label>
            <label className="space-y-1.5">
              <span className="text-slate-300">Proxy Target Height</span>
              <select
                value={draft.proxyHeight}
                onChange={(e) => setDraft({ ...draft, proxyHeight: Number(e.target.value) })}
                className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white font-mono"
              >
                <option value={540}>540p (Ultra-fast scrub)</option>
                <option value={720}>720p (Balanced NLE proxy)</option>
                <option value={1080}>1080p (High detail proxy)</option>
              </select>
            </label>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-white/[0.07]">
            {savedNotice ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Settings saved
              </span>
            ) : (
              <span className="text-slate-500">Original high-resolution source files are always preserved.</span>
            )}
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-medium"
            >
              Save Configuration
            </button>
          </div>
        </form>

        <div className="space-y-4">
          <div className="bg-[#12161F] border border-white/[0.08] rounded-xl p-5 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Server className="w-4 h-4 text-[#3B82F6]" />
              <span>Runtime Engines</span>
            </div>
            <div className="space-y-2 text-slate-300">
              <div>
                <div className="text-slate-400">FFmpeg Video Pipeline</div>
                <div className="font-mono text-[11px] text-emerald-300 mt-0.5 break-all">
                  {systemStatus?.ffmpeg.available ? systemStatus.ffmpeg.version : 'Checking...'}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Detected Encoders</div>
                <div className="font-mono text-[11px] text-slate-200 mt-0.5">
                  {systemStatus?.ffmpeg.encoders.join(' · ') || '—'}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Gemini Vision & TTS API</div>
                <div className="mt-0.5 text-slate-200">
                  {systemStatus?.geminiConfigured
                    ? 'Configured via server environment'
                    : 'Not configured (set GEMINI_API_KEY in Settings > Secrets)'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#12161F] border border-white/[0.08] rounded-xl p-5 space-y-2.5 text-xs">
            <div className="flex items-center gap-2 text-white font-semibold text-sm">
              <Keyboard className="w-4 h-4 text-[#A855F7]" />
              <span>Keyboard Shortcuts</span>
            </div>
            <div className="space-y-1.5 text-slate-300">
              {[
                ['Space', 'Play / Pause Monitor'],
                ['← / →', 'Step Back / Forward 1 Frame'],
                ['M', 'Add Timeline Marker'],
                ['Ctrl + Z', 'Undo Timeline Edit'],
                ['Ctrl + Shift + Z', 'Redo Timeline Edit'],
                ['Delete', 'Remove Selected Clip / Graphic'],
                ['Shift + Dbl-Click Ruler', 'Add / Remove Manual Beat'],
              ].map(([key, action]) => (
                <div key={key} className="flex justify-between gap-2">
                  <span className="font-mono text-[11px] text-[#C4B5FD]">{key}</span>
                  <span className="text-slate-400">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
