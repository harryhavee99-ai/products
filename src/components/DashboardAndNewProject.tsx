import React, { useState } from 'react';
import {
  Copy,
  Film,
  FolderOpen,
  Plus,
  Save,
  Sparkles,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import type {
  AspectRatioOption,
  EditingPaceMode,
  ExportFormatOption,
  FrameRateOption,
  ProductCategoryId,
  ProjectPreset,
  ProjectSettings,
  RenderJobStatus,
  ResolutionPreset,
  StudioProject,
} from '../types/studio';
import {
  COLOR_LOOK_PRESETS,
  DURATION_PRESETS,
  FRAME_RATE_OPTIONS,
  PLATFORM_PRESETS,
  PRODUCT_CATEGORIES,
  RESOLUTION_MAP,
  computeDimensionsForAspect,
  createDefaultProjectSettings,
  getCategoryMeta,
} from '../data/catalogs';
import { studioApi } from '../services/api';

interface DashboardViewProps {
  projects: StudioProject[];
  renders: RenderJobStatus[];
  onOpenProject: (project: StudioProject) => void;
  onCreateNewClick: (category?: ProductCategoryId) => void;
  onDuplicateProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onNavigateTemplates: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  projects,
  renders,
  onOpenProject,
  onCreateNewClick,
  onDuplicateProject,
  onDeleteProject,
  onNavigateTemplates,
}) => {
  const totalAssets = projects.reduce((sum, p) => sum + p.assets.length, 0);
  const completedRenders = renders.filter((r) => r.status === 'completed').length;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-10">
      {/* Hero Workspace Header */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-white/[0.08]">
        <div className="space-y-2.5 max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Commercial Video Production Studio
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Import high-resolution product footage up to 8K, analyze frames with Gemini vision while preserving product fidelity, synchronize edits to real music beats, render via FFmpeg, and export editable Adobe Premiere Pro XML projects.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onNavigateTemplates}
            className="px-4 py-2.5 rounded-lg bg-[#171B25] hover:bg-[#1F2533] border border-white/10 text-sm font-medium text-slate-200 transition-colors whitespace-nowrap"
          >
            Browse Templates
          </button>
          <button
            type="button"
            onClick={() => onCreateNewClick()}
            className="px-4 py-2.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-sm font-medium text-white flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>New Commercial Project</span>
          </button>
        </div>
      </section>

      {/* Studio Summary Strip (Real Workspace Data Only) */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-6 pb-2">
        <div className="bg-[#12161F] border border-white/[0.08] rounded-xl p-5">
          <div className="text-xs text-slate-400">Saved Projects</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
            {projects.length}
          </div>
        </div>
        <div className="bg-[#12161F] border border-white/[0.08] rounded-xl p-5">
          <div className="text-xs text-slate-400">Imported Media Assets</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
            {totalAssets}
          </div>
        </div>
        <div className="bg-[#12161F] border border-white/[0.08] rounded-xl p-5">
          <div className="text-xs text-slate-400">Completed FFmpeg Renders</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
            {completedRenders}
          </div>
        </div>
      </section>

      {/* Recent Projects Table / Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Your Commercial Projects</h2>
          <span className="text-xs text-slate-500 font-mono tabular-nums">
            {projects.length} total
          </span>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-xl border border-white/[0.08] bg-[#12161F] p-10 text-center space-y-3">
            <Film className="w-8 h-8 text-slate-600 mx-auto" />
            <div className="text-base font-medium text-slate-200">No projects created yet</div>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Create your first product commercial project, pick a product category, and drop in raw video, product photography, and soundtrack audio.
            </p>
            <button
              type="button"
              onClick={() => onCreateNewClick()}
              className="mt-2 px-4 py-2 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-sm font-medium text-white inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Project</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => {
              const cat = getCategoryMeta(p.settings.productCategory);
              const thumb = p.assets.find((a) => a.thumbnailUrl)?.thumbnailUrl;
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-white/[0.08] bg-[#12161F] overflow-hidden flex flex-col justify-between hover:border-white/20 transition-colors"
                >
                  <div>
                    <div
                      onClick={() => onOpenProject(p)}
                      className="h-36 bg-[#0A0C12] relative cursor-pointer overflow-hidden border-b border-white/[0.06] flex items-center justify-center"
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={p.settings.projectName}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover opacity-85 hover:opacity-100 transition-opacity"
                        />
                      ) : (
                        <div className="text-center text-slate-500">
                          <Film className="w-6 h-6 mx-auto mb-1 text-slate-600" />
                          <span className="text-xs">No media imported yet</span>
                        </div>
                      )}
                    </div>
                    <div className="p-4 space-y-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenProject(p)}
                        className="text-left text-base font-semibold text-white hover:text-[#C4B5FD] transition-colors line-clamp-1"
                      >
                        {p.settings.projectName}
                      </button>
                      <div className="text-xs text-slate-400">
                        {cat.label} · {p.settings.width}×{p.settings.height} · {p.settings.fps} fps
                      </div>
                      <div className="text-xs text-slate-500 font-mono tabular-nums">
                        {p.assets.length} assets · {p.clips.length} timeline clips · {p.settings.targetDuration}s target
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-3 border-t border-white/[0.06] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => onOpenProject(p)}
                      className="text-xs font-medium text-[#93C5FD] hover:text-white flex items-center gap-1"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Open Studio</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onDuplicateProject(p.id)}
                        className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/[0.06]"
                        title="Duplicate project"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProject(p.id)}
                        className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                        title="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Product Category Quick Start (All 16 Supported Categories) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Start by Product Category</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Each physical product category pre-configures recommended pace, transitions, color grade, and music guidance.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PRODUCT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCreateNewClick(cat.id)}
              className="text-left p-4 rounded-xl border border-white/[0.07] bg-[#12161F] hover:border-[#7C3AED]/60 hover:bg-[#161B27] transition-colors space-y-1.5 group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-100 group-hover:text-white">
                  {cat.label}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#A855F7] shrink-0" />
              </div>
              <div className="text-[11px] text-slate-400">
                {cat.recommendedPace} pace · {cat.recommendedDuration}s · {cat.recommendedColorLook.replace(/_/g, ' ')}
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

interface CreateProjectViewProps {
  initialCategory?: ProductCategoryId;
  presets: ProjectPreset[];
  onPresetsUpdated: (presets: ProjectPreset[]) => void;
  onProjectCreated: (project: StudioProject) => void;
  onCancel: () => void;
}

export const CreateProjectView: React.FC<CreateProjectViewProps> = ({
  initialCategory,
  presets,
  onPresetsUpdated,
  onProjectCreated,
  onCancel,
}) => {
  const initialMeta = getCategoryMeta(initialCategory ?? 'electronics');
  const [form, setForm] = useState<ProjectSettings>(() =>
    createDefaultProjectSettings({
      projectName: `${initialMeta.label} Commercial`,
      productCategory: initialMeta.id,
      editingStyle: initialMeta.recommendedPace,
      targetDuration: initialMeta.recommendedDuration,
      colorGradingPreference: initialMeta.recommendedColorLook,
      musicPreference: initialMeta.recommendedMusicStyle,
    })
  );
  const [presetName, setPresetName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const catMeta = getCategoryMeta(form.productCategory);

  const applyCategoryDefaults = (categoryId: ProductCategoryId) => {
    const meta = getCategoryMeta(categoryId);
    setForm((prev) => ({
      ...prev,
      productCategory: categoryId,
      editingStyle: meta.recommendedPace,
      targetDuration: meta.recommendedDuration,
      colorGradingPreference: meta.recommendedColorLook,
      musicPreference: meta.recommendedMusicStyle,
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const project = await studioApi.createProject(form);
      onProjectCreated(project);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePreset = async () => {
    if (!presetName.trim()) return;
    const updated = await studioApi.saveProjectPreset(presetName.trim(), form);
    onPresetsUpdated(updated);
    setPresetName('');
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Create Commercial Project</h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure resolution, frame rate, aspect ratio, product category, and commercial pacing. Every setting remains editable later.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-2 rounded-lg bg-[#171B25] hover:bg-white/[0.08] text-xs font-medium text-slate-300"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Saved Presets Bar */}
      {presets.length > 0 && (
        <div className="p-4 rounded-xl bg-[#12161F] border border-white/[0.08] space-y-2">
          <div className="text-xs font-medium text-slate-300">Load Saved Project Preset</div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <div key={p.id} className="flex items-center rounded-lg bg-[#191E2A] border border-white/10 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setForm({ ...p.settings })}
                  className="px-3 py-1.5 text-xs text-slate-200 hover:text-white"
                >
                  {p.name}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const next = await studioApi.deleteProjectPreset(p.id);
                    onPresetsUpdated(next);
                  }}
                  className="px-2 py-1.5 text-slate-500 hover:text-rose-400 border-l border-white/10"
                  title="Delete preset"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleCreate} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5 bg-[#12161F] border border-white/[0.08] rounded-xl p-6 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="space-y-1.5">
              <span className="text-slate-300 font-medium">Project Name</span>
              <input
                type="text"
                required
                value={form.projectName}
                onChange={(e) => setForm({ ...form, projectName: e.target.value })}
                className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-slate-300 font-medium">Product Name</span>
              <input
                type="text"
                value={form.productName}
                onChange={(e) => setForm({ ...form, productName: e.target.value })}
                placeholder="e.g., Lumina Eau de Parfum"
                className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-slate-300 font-medium">Brand Name</span>
              <input
                type="text"
                value={form.brandName}
                onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                placeholder="e.g., Atelier Lumina"
                className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-slate-300 font-medium">Product Category</span>
              <select
                value={form.productCategory}
                onChange={(e) => applyCategoryDefaults(e.target.value as ProductCategoryId)}
                className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
              >
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/[0.07]">
            <label className="space-y-1.5">
              <span className="text-slate-300 font-medium">Project Resolution</span>
              <select
                value={form.resolution}
                onChange={(e) => {
                  const res = e.target.value as ResolutionPreset;
                  const dims = computeDimensionsForAspect(res, form.aspectRatio);
                  setForm({ ...form, resolution: res, width: dims.width, height: dims.height });
                }}
                className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white"
              >
                {Object.entries(RESOLUTION_MAP).map(([id, meta]) => (
                  <option key={id} value={id}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-slate-300 font-medium">Frame Rate</span>
              <select
                value={form.fps}
                onChange={(e) => setForm({ ...form, fps: Number(e.target.value) as FrameRateOption })}
                className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white font-mono"
              >
                {FRAME_RATE_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f} FPS
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-slate-300 font-medium">Platform & Aspect Ratio</span>
              <select
                value={form.platformPreset}
                onChange={(e) => {
                  const p = PLATFORM_PRESETS.find((x) => x.id === e.target.value);
                  if (p) {
                    const dims = computeDimensionsForAspect(form.resolution, p.aspectRatio);
                    setForm({
                      ...form,
                      platformPreset: p.id,
                      aspectRatio: p.aspectRatio as AspectRatioOption,
                      width: dims.width,
                      height: dims.height,
                    });
                  }
                }}
                className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white"
              >
                {PLATFORM_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/[0.07]">
            <label className="space-y-1.5">
              <span className="text-slate-300 font-medium">Editing Style / Pace</span>
              <select
                value={form.editingStyle}
                onChange={(e) => setForm({ ...form, editingStyle: e.target.value as EditingPaceMode })}
                className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white"
              >
                <option value="fast">Fast-Paced (Social / Energetic)</option>
                <option value="normal">Normal-Paced (Commercial)</option>
                <option value="slow">Slow-Paced (Luxury / Cinematic)</option>
                <option value="custom">Custom Pace</option>
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-slate-300 font-medium">Color Grading Look</span>
              <select
                value={form.colorGradingPreference}
                onChange={(e) => setForm({ ...form, colorGradingPreference: e.target.value })}
                className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white"
              >
                {COLOR_LOOK_PRESETS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-slate-300 font-medium">Primary Export Format</span>
              <select
                value={form.exportFormat}
                onChange={(e) => setForm({ ...form, exportFormat: e.target.value as ExportFormatOption })}
                className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white"
              >
                <option value="mp4">MP4 (H.264 / H.265)</option>
                <option value="mov">MOV (QuickTime)</option>
                <option value="prores_mov">Apple ProRes MOV</option>
                <option value="webm">WebM (VP9)</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-white/[0.07]">
            <div className="space-y-1.5">
              <span className="text-slate-300 font-medium">Target Video Duration ({form.targetDuration}s)</span>
              <div className="flex flex-wrap gap-1">
                {DURATION_PRESETS.map((d) => (
                  <button
                    key={d.seconds}
                    type="button"
                    onClick={() => setForm({ ...form, targetDuration: d.seconds })}
                    className={`px-2 py-1 rounded font-mono text-[11px] tabular-nums ${
                      form.targetDuration === d.seconds
                        ? 'bg-[#7C3AED] text-white'
                        : 'bg-[#181D28] text-slate-400 hover:text-white'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="space-y-1.5">
              <span className="text-slate-300 font-medium">Music Direction Preference</span>
              <input
                type="text"
                value={form.musicPreference}
                onChange={(e) => setForm({ ...form, musicPreference: e.target.value })}
                className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white"
              />
            </label>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {error}
            </div>
          )}

          <div className="pt-4 border-t border-white/[0.07] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Save settings as preset..."
                className="bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
              />
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
                className="px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-40 text-slate-200 flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Preset</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-sm font-medium text-white transition-colors"
            >
              {submitting ? 'Creating Project...' : 'Create & Open Studio'}
            </button>
          </div>
        </div>

        {/* Live AI Category Style Recommendation Card */}
        <aside className="bg-[#12161F] border border-white/[0.08] rounded-xl p-5 space-y-4 h-fit">
          <div className="flex items-center gap-2 text-[#C4B5FD]">
            <Sparkles className="w-4 h-4" />
            <h3 className="text-sm font-semibold text-white">AI Commercial Direction</h3>
          </div>
          <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
            <p className="font-medium text-white">{catMeta.label}</p>
            <p className="text-slate-400">{catMeta.cinematographyGuidance}</p>
          </div>
          <div className="pt-3 border-t border-white/[0.07] space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Output Canvas</span>
              <span className="font-mono text-slate-200 tabular-nums">
                {form.width}×{form.height}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Suggested Pace</span>
              <span className="capitalize text-slate-200">{catMeta.recommendedPace}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Suggested Look</span>
              <span className="capitalize text-slate-200">
                {catMeta.recommendedColorLook.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Music Style</span>
              <span className="text-slate-200 text-right max-w-[160px]">{catMeta.recommendedMusicStyle}</span>
            </div>
          </div>
          <div className="pt-3 border-t border-white/[0.07] space-y-1.5">
            <div className="text-[11px] text-slate-400 font-medium">Recommended Shots to Capture</div>
            <ul className="space-y-1 text-xs text-slate-300">
              {catMeta.keyShotTypes.map((shot) => (
                <li key={shot}>· {shot}</li>
              ))}
            </ul>
          </div>
        </aside>
      </form>
    </div>
  );
};
