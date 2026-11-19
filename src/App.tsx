import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Film,
  FolderOpen,
  Layers,
  Palette,
  Save,
  Sparkles,
  Type as TypeIcon,
  Upload,
  Wand2,
} from 'lucide-react';
import type {
  AspectRatioOption,
  AudioAnalysisResult,
  BeatSyncMode,
  ClipTransition,
  ColorGradingSettings,
  CustomColorPreset,
  CustomPaceSettings,
  EditingPaceMode,
  MediaAsset,
  MotionOverlay,
  ProductAnalysisReport,
  ProductCategoryId,
  ProjectPreset,
  RenderJobStatus,
  StudioProject,
  StudioServerSettings,
  TimelineClip,
  TimelineTrack,
} from './types/studio';
import {
  COLOR_LOOK_PRESETS,
  DEFAULT_COLOR_GRADING,
  TRANSITIONS_CATALOG,
  type CommercialTemplate,
  computeDimensionsForAspect,
  createDefaultProjectSettings,
} from './data/catalogs';
import { studioApi } from './services/api';
import { DashboardView, CreateProjectView } from './components/DashboardAndNewProject';
import {
  ProjectHistoryView,
  SettingsView,
  TemplatesLibraryView,
} from './components/TemplatesAndHistoryViews';
import { ExportAndPremiereStudio } from './components/ExportAndPremiereStudio';
import { VideoPreviewMonitor } from './components/VideoPreviewMonitor';
import { MultiTrackTimeline } from './components/MultiTrackTimeline';
import { InspectorPanel } from './components/InspectorPanel';
import { MediaImportAndBin } from './components/MediaImportAndBin';
import { AiStudioPanels } from './components/AiStudioPanels';
import { AudioBeatAndVoiceStudio } from './components/AudioBeatAndVoiceStudio';
import { CreativeStudiosPanel } from './components/CreativeStudiosPanel';

type TopPage =
  | 'dashboard'
  | 'new_project'
  | 'studio'
  | 'templates'
  | 'export'
  | 'premiere_xml'
  | 'history'
  | 'settings';

type StudioLeftTab =
  | 'import'
  | 'library'
  | 'analysis'
  | 'auto_edit'
  | 'audio'
  | 'transitions'
  | 'motion'
  | 'color';

interface UndoSnapshot {
  clips: TimelineClip[];
  overlays: MotionOverlay[];
  tracks: TimelineTrack[];
}

export default function App() {
  const [page, setPage] = useState<TopPage>('dashboard');
  const [newProjectCategory, setNewProjectCategory] = useState<ProductCategoryId | undefined>(undefined);
  const [studioTab, setStudioTab] = useState<StudioLeftTab>('import');

  // Persisted global data
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [activeProject, setActiveProject] = useState<StudioProject | null>(null);
  const [projectPresets, setProjectPresets] = useState<ProjectPreset[]>([]);
  const [colorPresets, setColorPresets] = useState<CustomColorPreset[]>([]);
  const [renders, setRenders] = useState<RenderJobStatus[]>([]);
  const [serverSettings, setServerSettings] = useState<StudioServerSettings>({
    maxUploadSizeMb: 4096,
    maxVideoDurationSec: 3600,
    chunkSizeMb: 5,
    proxyEnabled: true,
    proxyHeight: 720,
    defaultExportCodec: 'h264',
    hardwareAccel: 'auto',
  });
  const [systemStatus, setSystemStatus] = useState<{
    ffmpeg: { available: boolean; version: string; encoders: string[] };
    geminiConfigured: boolean;
  } | null>(null);

  // NLE Editor Runtime State
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<UndoSnapshot[]>([]);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  const saveTimerRef = useRef<number | null>(null);

  // Initial hydration from Express backend
  useEffect(() => {
    void (async () => {
      try {
        const [projList, sys, pPresets, cPresets, rJobs] = await Promise.all([
          studioApi.listProjects(),
          studioApi.getSystemStatus(),
          studioApi.listProjectPresets(),
          studioApi.listColorPresets(),
          studioApi.listRenders(),
        ]);
        setProjects(projList);
        setSystemStatus({ ffmpeg: sys.ffmpeg, geminiConfigured: sys.geminiConfigured });
        setServerSettings(sys.settings);
        setProjectPresets(pPresets);
        setColorPresets(cPresets);
        setRenders(rJobs);
      } catch (err) {
        console.error('Failed to initialize studio:', err);
      }
    })();
  }, []);

  // Poll active project when any asset has proxyStatus === 'processing'
  useEffect(() => {
    if (!activeProject) return;
    const hasProcessing = activeProject.assets.some((a) => a.proxyStatus === 'processing');
    if (!hasProcessing) return;
    const interval = window.setInterval(async () => {
      try {
        const fresh = await studioApi.getProject(activeProject.id);
        setActiveProject((prev) =>
          prev && prev.id === fresh.id ? { ...prev, assets: fresh.assets } : prev
        );
      } catch {
        // Ignore poll hiccup
      }
    }, 2500);
    return () => window.clearInterval(interval);
  }, [activeProject?.id, activeProject?.assets]);

  // Debounced project autosave
  const persistProject = useCallback((updated: StudioProject, immediate = false) => {
    setActiveProject(updated);
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === updated.id);
      return exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [updated, ...prev];
    });

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    const runSave = async () => {
      try {
        await studioApi.saveProject(updated);
      } catch (err) {
        console.error('Autosave failed:', err);
      }
    };
    if (immediate) {
      void runSave();
    } else {
      saveTimerRef.current = window.setTimeout(() => {
        void runSave();
      }, 650);
    }
  }, []);

  const pushUndo = useCallback((project: StudioProject) => {
    setUndoStack((prev) => [
      ...prev.slice(-29),
      {
        clips: JSON.parse(JSON.stringify(project.clips)),
        overlays: JSON.parse(JSON.stringify(project.overlays)),
        tracks: JSON.parse(JSON.stringify(project.tracks)),
      },
    ]);
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    if (!activeProject || undoStack.length === 0) return;
    const prevSnap = undoStack[undoStack.length - 1];
    setRedoStack((r) => [
      ...r,
      {
        clips: JSON.parse(JSON.stringify(activeProject.clips)),
        overlays: JSON.parse(JSON.stringify(activeProject.overlays)),
        tracks: JSON.parse(JSON.stringify(activeProject.tracks)),
      },
    ]);
    setUndoStack((u) => u.slice(0, -1));
    persistProject({
      ...activeProject,
      clips: prevSnap.clips,
      overlays: prevSnap.overlays,
      tracks: prevSnap.tracks,
    });
  }, [activeProject, undoStack, persistProject]);

  const handleRedo = useCallback(() => {
    if (!activeProject || redoStack.length === 0) return;
    const nextSnap = redoStack[redoStack.length - 1];
    setUndoStack((u) => [
      ...u,
      {
        clips: JSON.parse(JSON.stringify(activeProject.clips)),
        overlays: JSON.parse(JSON.stringify(activeProject.overlays)),
        tracks: JSON.parse(JSON.stringify(activeProject.tracks)),
      },
    ]);
    setRedoStack((r) => r.slice(0, -1));
    persistProject({
      ...activeProject,
      clips: nextSnap.clips,
      overlays: nextSnap.overlays,
      tracks: nextSnap.tracks,
    });
  }, [activeProject, redoStack, persistProject]);

  const totalDuration = useMemo(() => {
    if (!activeProject) return 30;
    const clipEnd = activeProject.clips.reduce((acc, c) => Math.max(acc, c.startTime + c.duration), 0);
    const ovEnd = activeProject.overlays.reduce((acc, o) => Math.max(acc, o.startTime + o.duration), 0);
    return Math.max(clipEnd, ovEnd, activeProject.settings.targetDuration, 5);
  }, [activeProject]);

  // Global NLE Keyboard Shortcuts when inside Studio Workspace
  useEffect(() => {
    if (page !== 'studio' || !activeProject) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentTime((t) => Math.max(0, t - 1 / Math.max(1, activeProject.settings.fps)));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentTime((t) => Math.min(totalDuration, t + 1 / Math.max(1, activeProject.settings.fps)));
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        const marker = {
          id: `m_${Date.now()}`,
          time: Math.round(currentTime * 100) / 100,
          name: `Marker ${activeProject.markers.length + 1}`,
          comment: 'Timeline note',
          color: '#F59E0B',
        };
        persistProject({ ...activeProject, markers: [...activeProject.markers, marker] });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedClipId) {
          e.preventDefault();
          pushUndo(activeProject);
          persistProject({
            ...activeProject,
            clips: activeProject.clips.filter((c) => c.id !== selectedClipId),
          });
          setSelectedClipId(null);
        } else if (selectedOverlayId) {
          e.preventDefault();
          pushUndo(activeProject);
          persistProject({
            ...activeProject,
            overlays: activeProject.overlays.filter((o) => o.id !== selectedOverlayId),
          });
          setSelectedOverlayId(null);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [page, activeProject, totalDuration, currentTime, selectedClipId, selectedOverlayId, handleUndo, handleRedo, persistProject, pushUndo]);

  // Project Management Handlers
  const openProject = (proj: StudioProject) => {
    setActiveProject(proj);
    setCurrentTime(0);
    setIsPlaying(false);
    setSelectedClipId(null);
    setSelectedOverlayId(null);
    setUndoStack([]);
    setRedoStack([]);
    setPage('studio');
  };

  const handleDuplicateProject = async (projectId: string) => {
    const copy = await studioApi.duplicateProject(projectId);
    setProjects((prev) => [copy, ...prev]);
    openProject(copy);
  };

  const handleDeleteProject = async (projectId: string) => {
    await studioApi.deleteProject(projectId);
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (activeProject?.id === projectId) {
      setActiveProject(null);
      setPage('dashboard');
    }
  };

  // Timeline Clip Helpers
  const addAssetsToTimeline = (assets: MediaAsset[], explicitTrackId?: string, explicitStart?: number) => {
    if (!activeProject || assets.length === 0) return;
    pushUndo(activeProject);

    const nextClips = [...activeProject.clips];
    for (const asset of assets) {
      const targetTrackId =
        explicitTrackId ||
        (asset.mediaType === 'audio' ? (asset.folder === 'Voiceovers' ? 'a2' : 'a1') : 'v1');
      const existingEnd = nextClips
        .filter((c) => c.trackId === targetTrackId)
        .reduce((acc, c) => Math.max(acc, c.startTime + c.duration), 0);
      const startTime = explicitStart !== undefined ? explicitStart : existingEnd;
      const dur = asset.mediaType === 'image' ? 4.0 : Math.max(0.5, asset.duration);

      nextClips.push({
        id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        trackId: targetTrackId,
        assetId: asset.id,
        name: asset.name,
        mediaType: asset.mediaType,
        startTime: Math.round(startTime * 1000) / 1000,
        duration: Math.round(dur * 1000) / 1000,
        inPoint: 0,
        outPoint: Math.round(dur * 1000) / 1000,
        sourceDuration: asset.duration,
        speed: 1,
        opacity: 100,
        scale: 100,
        positionX: 0,
        positionY: 0,
        rotation: 0,
        cropFocusX: 50,
        cropFocusY: 50,
        volume: asset.mediaType === 'audio' ? 85 : 100,
        fadeIn: asset.mediaType === 'audio' ? 0.3 : 0,
        fadeOut: asset.mediaType === 'audio' ? 0.8 : 0,
        muted: false,
        duckOnVoiceover: targetTrackId === 'a1',
        imageMotion: asset.mediaType === 'image' ? 'slow_zoom_in' : 'none',
        isAiGenerated: asset.isAiGenerated,
      });
    }

    persistProject({ ...activeProject, clips: nextClips });
  };

  const syncExistingClipsToBeats = (mode: BeatSyncMode) => {
    if (!activeProject?.audioAnalysis?.beats?.length) return;
    pushUndo(activeProject);

    const eligibleBeats = activeProject.audioAnalysis.beats
      .filter((b) => (mode === 'strict' ? true : mode === 'intelligent' ? b.strength >= 0.45 || b.isDownbeat : b.isDownbeat))
      .map((b) => b.time)
      .sort((a, b) => a - b);

    if (eligibleBeats.length === 0) return;

    const visualClips = activeProject.clips
      .filter((c) => c.trackId === 'v1')
      .sort((a, b) => a.startTime - b.startTime);
    const otherClips = activeProject.clips.filter((c) => c.trackId !== 'v1');

    let cursor = 0;
    const syncedVisual: TimelineClip[] = [];
    for (let i = 0; i < visualClips.length; i++) {
      const clip = visualClips[i];
      const desiredEnd = cursor + clip.duration;
      const nextBeat =
        eligibleBeats.find((bt) => bt >= cursor + 0.5 && bt <= cursor + clip.sourceDuration && Math.abs(bt - desiredEnd) <= 1.2) ??
        eligibleBeats.find((bt) => bt >= cursor + 0.5 && bt <= cursor + clip.sourceDuration);
      const newDur = nextBeat ? Math.max(0.4, Math.min(clip.sourceDuration, nextBeat - cursor)) : clip.duration;
      syncedVisual.push({
        ...clip,
        startTime: Math.round(cursor * 1000) / 1000,
        duration: Math.round(newDur * 1000) / 1000,
        outPoint: Math.round((clip.inPoint + newDur) * 1000) / 1000,
      });
      cursor += newDur;
    }

    persistProject({
      ...activeProject,
      beatSyncMode: mode,
      clips: [...syncedVisual, ...otherClips],
    });
  };

  const applyTemplateToProject = (tpl: CommercialTemplate, target: StudioProject) => {
    const dims = computeDimensionsForAspect(target.settings.resolution, tpl.aspectRatio);
    const look = COLOR_LOOK_PRESETS.find((l) => l.id === tpl.colorLook);
    const trans = TRANSITIONS_CATALOG.find((t) => t.id === tpl.transitionId);

    const updatedClips = target.clips.map((c, idx) =>
      c.mediaType !== 'audio' && idx > 0 && trans
        ? {
            ...c,
            transitionIn: {
              id: trans.id,
              name: trans.name,
              category: trans.category,
              duration: trans.defaultDuration,
              direction: 'left' as const,
              intensity: 70,
              timing: 'ease-in-out' as const,
            },
          }
        : c
    );

    const updated: StudioProject = {
      ...target,
      settings: {
        ...target.settings,
        productCategory: tpl.category,
        editingStyle: tpl.pace,
        targetDuration: tpl.duration,
        aspectRatio: tpl.aspectRatio,
        width: dims.width,
        height: dims.height,
        colorGradingPreference: tpl.colorLook,
      },
      colorGrading: {
        ...DEFAULT_COLOR_GRADING,
        ...(look?.values ?? {}),
        lookPreset: tpl.colorLook,
      },
      clips: updatedClips,
    };
    persistProject(updated, true);
    setPage('studio');
  };

  const selectedClip = useMemo(
    () => activeProject?.clips.find((c) => c.id === selectedClipId) ?? null,
    [activeProject, selectedClipId]
  );

  const selectedOverlay = useMemo(
    () => activeProject?.overlays.find((o) => o.id === selectedOverlayId) ?? null,
    [activeProject, selectedOverlayId]
  );

  const manualSave = async () => {
    if (!activeProject) return;
    await studioApi.saveProject(activeProject);
    setSaveBanner('Saved');
    setTimeout(() => setSaveBanner(null), 1800);
  };

  return (
    <div className="min-h-screen h-screen flex flex-col bg-[#0C0E13] text-[#EEF0F6] overflow-hidden">
      {/* Top Bar Contract: 1-line Wordmark — 5 Clean Single-Line Nav Links — 1 Primary Action */}
      <header className="h-13 shrink-0 px-5 border-b border-white/[0.08] bg-[#10131A] flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => setPage('dashboard')}
          className="font-display text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-[#C4B5FD] transition-colors"
        >
          Pro Product Studio AI
        </button>

        <nav className="flex items-center gap-6 text-xs font-medium text-slate-400 overflow-x-auto">
          <button
            type="button"
            onClick={() => setPage('dashboard')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
              page === 'dashboard' || page === 'new_project'
                ? 'border-[#7C3AED] text-white'
                : 'border-transparent hover:text-white'
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            disabled={!activeProject}
            onClick={() => activeProject && setPage('studio')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors disabled:opacity-35 ${
              page === 'studio'
                ? 'border-[#7C3AED] text-white'
                : 'border-transparent hover:text-white'
            }`}
          >
            Studio Editor
          </button>
          <button
            type="button"
            onClick={() => setPage('templates')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
              page === 'templates'
                ? 'border-[#7C3AED] text-white'
                : 'border-transparent hover:text-white'
            }`}
          >
            Templates
          </button>
          <button
            type="button"
            disabled={!activeProject}
            onClick={() => activeProject && setPage('export')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors disabled:opacity-35 ${
              page === 'export' || page === 'premiere_xml'
                ? 'border-[#3B82F6] text-white'
                : 'border-transparent hover:text-white'
            }`}
          >
            Export & Premiere XML
          </button>
          <button
            type="button"
            onClick={() => setPage('history')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
              page === 'history'
                ? 'border-[#7C3AED] text-white'
                : 'border-transparent hover:text-white'
            }`}
          >
            History
          </button>
          <button
            type="button"
            onClick={() => setPage('settings')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
              page === 'settings'
                ? 'border-[#7C3AED] text-white'
                : 'border-transparent hover:text-white'
            }`}
          >
            Settings
          </button>
        </nav>

        <div className="shrink-0 flex items-center gap-2">
          {page === 'studio' && activeProject ? (
            <button
              type="button"
              onClick={() => setPage('premiere_xml')}
              className="px-3.5 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
            >
              Export & Premiere XML
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNewProjectCategory(undefined);
                setPage('new_project');
              }}
              className="px-3.5 py-1.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0"
            >
              New Project
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 overflow-auto">
        {page === 'dashboard' && (
          <DashboardView
            projects={projects}
            renders={renders}
            onOpenProject={openProject}
            onCreateNewClick={(cat) => {
              setNewProjectCategory(cat);
              setPage('new_project');
            }}
            onDuplicateProject={handleDuplicateProject}
            onDeleteProject={handleDeleteProject}
            onNavigateTemplates={() => setPage('templates')}
          />
        )}

        {page === 'new_project' && (
          <CreateProjectView
            initialCategory={newProjectCategory}
            presets={projectPresets}
            onPresetsUpdated={setProjectPresets}
            onProjectCreated={(proj) => {
              setProjects((prev) => [proj, ...prev]);
              openProject(proj);
            }}
            onCancel={() => setPage('dashboard')}
          />
        )}

        {page === 'templates' && (
          <TemplatesLibraryView
            activeProject={activeProject}
            onApplyTemplateToActive={(tpl) => activeProject && applyTemplateToProject(tpl, activeProject)}
            onCreateProjectFromTemplate={async (tpl) => {
              const dims = computeDimensionsForAspect('1080p', tpl.aspectRatio);
              const proj = await studioApi.createProject(
                createDefaultProjectSettings({
                  projectName: tpl.name,
                  productCategory: tpl.category,
                  editingStyle: tpl.pace,
                  targetDuration: tpl.duration,
                  aspectRatio: tpl.aspectRatio,
                  width: dims.width,
                  height: dims.height,
                  colorGradingPreference: tpl.colorLook,
                })
              );
              applyTemplateToProject(tpl, proj);
            }}
          />
        )}

        {(page === 'export' || page === 'premiere_xml') && activeProject && (
          <ExportAndPremiereStudio
            project={activeProject}
            initialTab={page === 'premiere_xml' ? 'premiere' : 'render'}
            onRenderUpdated={(job) =>
              setRenders((prev) => [job, ...prev.filter((r) => r.id !== job.id)])
            }
          />
        )}

        {page === 'history' && (
          <ProjectHistoryView
            project={activeProject}
            renders={renders}
            onCreateSnapshot={async (label) => {
              if (!activeProject) return;
              await studioApi.saveProject(activeProject);
              const updated = await studioApi.createSnapshot(activeProject.id, label);
              setActiveProject(updated);
              setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            }}
            onRestoreSnapshot={async (versionId) => {
              if (!activeProject) return;
              const restored = await studioApi.restoreSnapshot(activeProject.id, versionId);
              openProject(restored);
            }}
            onDuplicateProject={handleDuplicateProject}
          />
        )}

        {page === 'settings' && (
          <SettingsView
            settings={serverSettings}
            systemStatus={systemStatus}
            onSaveSettings={async (next) => {
              const saved = await studioApi.updateSettings(next);
              setServerSettings(saved);
            }}
          />
        )}

        {/* PROFESSIONAL THREE-PANEL + MULTI-TRACK TIMELINE NLE WORKSPACE */}
        {page === 'studio' && activeProject && (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Project Context Sub-Toolbar */}
            <div className="h-9 px-3 bg-[#131722] border-b border-white/[0.07] flex items-center justify-between text-xs shrink-0">
              <div className="flex items-center gap-2 min-w-0 text-slate-400">
                <span className="font-semibold text-white truncate max-w-[240px]">
                  {activeProject.settings.projectName}
                </span>
                <span aria-hidden="true">·</span>
                <span className="truncate">{activeProject.settings.productName || 'Product Commercial'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {activeProject.assets.length} media · {activeProject.clips.length} clips
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {saveBanner && <span className="text-emerald-400 text-[11px]">{saveBanner}</span>}
                <button
                  type="button"
                  onClick={manualSave}
                  className="px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 flex items-center gap-1"
                >
                  <Save className="w-3 h-3" />
                  <span>Save</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPage('export')}
                  className="px-2.5 py-1 rounded bg-[#3B82F6]/20 hover:bg-[#3B82F6]/30 text-[#93C5FD]"
                >
                  Render Video
                </button>
              </div>
            </div>

            {/* Upper 3-Panel Split: LEFT Studio Rail + Panel | CENTER Preview Monitor | RIGHT Inspector */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
              {/* Vertical Module Rail */}
              <aside className="w-14 shrink-0 bg-[#0D1017] border-r border-white/[0.07] flex flex-col items-center py-2 gap-1">
                {(
                  [
                    { id: 'import', label: 'Import', icon: Upload },
                    { id: 'library', label: 'Media', icon: FolderOpen },
                    { id: 'analysis', label: 'AI Vision', icon: Sparkles },
                    { id: 'auto_edit', label: 'Auto Edit', icon: Wand2 },
                    { id: 'audio', label: 'Beats', icon: Activity },
                    { id: 'transitions', label: 'Trans.', icon: Layers },
                    { id: 'motion', label: 'Graphics', icon: TypeIcon },
                    { id: 'color', label: 'Color', icon: Palette },
                  ] as const
                ).map((item) => {
                  const Icon = item.icon;
                  const active = studioTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setStudioTab(item.id)}
                      className={`w-11 py-2 rounded-lg flex flex-col items-center gap-0.5 text-[10px] transition-colors ${
                        active
                          ? 'bg-[#7C3AED] text-white'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                      }`}
                      title={item.label}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="truncate max-w-[42px]">{item.label}</span>
                    </button>
                  );
                })}
              </aside>

              {/* LEFT PANEL: Active Studio Tool */}
              <section className="w-80 xl:w-[340px] shrink-0 bg-[#11141C] border-r border-white/[0.08] overflow-hidden flex flex-col">
                {(studioTab === 'import' || studioTab === 'library') && (
                  <MediaImportAndBin
                    mode={studioTab}
                    project={activeProject}
                    serverSettings={serverSettings}
                    onAssetImported={(asset) =>
                      persistProject({
                        ...activeProject,
                        assets: [asset, ...activeProject.assets.filter((a) => a.id !== asset.id)],
                      })
                    }
                    onUpdateAsset={(assetId, patch) =>
                      persistProject({
                        ...activeProject,
                        assets: activeProject.assets.map((a) => (a.id === assetId ? { ...a, ...patch } : a)),
                      })
                    }
                    onDeleteAsset={async (assetId) => {
                      const updated = await studioApi.deleteAsset(activeProject.id, assetId);
                      setActiveProject(updated);
                      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                    }}
                    onAddAssetsToTimeline={(assets) => addAssetsToTimeline(assets)}
                  />
                )}

                {(studioTab === 'analysis' || studioTab === 'auto_edit') && (
                  <AiStudioPanels
                    mode={studioTab}
                    project={activeProject}
                    geminiConfigured={Boolean(systemStatus?.geminiConfigured)}
                    onAnalysisComplete={(report: ProductAnalysisReport) =>
                      persistProject({ ...activeProject, productAnalysis: report }, true)
                    }
                    onApplyRecommendedStyle={(lookId, pace, idealDuration) => {
                      const look = COLOR_LOOK_PRESETS.find((l) => l.id === lookId);
                      persistProject({
                        ...activeProject,
                        settings: {
                          ...activeProject.settings,
                          editingStyle: pace,
                          targetDuration: idealDuration,
                          colorGradingPreference: look?.id ?? activeProject.settings.colorGradingPreference,
                        },
                        colorGrading: look
                          ? { ...DEFAULT_COLOR_GRADING, ...look.values, lookPreset: look.id }
                          : activeProject.colorGrading,
                      });
                    }}
                    onApplyAutoEdit={(clips, pace, targetDuration, beatSyncMode) => {
                      pushUndo(activeProject);
                      persistProject({
                        ...activeProject,
                        clips,
                        beatSyncMode,
                        settings: {
                          ...activeProject.settings,
                          editingStyle: pace,
                          targetDuration,
                        },
                      });
                      setCurrentTime(0);
                    }}
                    onUpdateCustomPace={(custom: CustomPaceSettings) =>
                      persistProject({
                        ...activeProject,
                        settings: { ...activeProject.settings, customPace: custom },
                      })
                    }
                  />
                )}

                {studioTab === 'audio' && (
                  <AudioBeatAndVoiceStudio
                    project={activeProject}
                    geminiConfigured={Boolean(systemStatus?.geminiConfigured)}
                    onAudioAnalyzed={(analysis: AudioAnalysisResult) =>
                      persistProject({ ...activeProject, audioAnalysis: analysis }, true)
                    }
                    onSyncClipsToBeats={syncExistingClipsToBeats}
                    onVoiceoverCreated={(asset, caption) => {
                      const nextAssets = [asset, ...activeProject.assets.filter((a) => a.id !== asset.id)];
                      const voClip: TimelineClip = {
                        id: `clip_vo_${Date.now()}`,
                        trackId: 'a2',
                        assetId: asset.id,
                        name: asset.name,
                        mediaType: 'audio',
                        startTime: Math.round(currentTime * 100) / 100,
                        duration: Math.max(0.5, asset.duration),
                        inPoint: 0,
                        outPoint: Math.max(0.5, asset.duration),
                        sourceDuration: asset.duration,
                        speed: 1,
                        opacity: 100,
                        scale: 100,
                        positionX: 0,
                        positionY: 0,
                        rotation: 0,
                        cropFocusX: 50,
                        cropFocusY: 50,
                        volume: 100,
                        fadeIn: 0.1,
                        fadeOut: 0.2,
                        muted: false,
                        duckOnVoiceover: false,
                        imageMotion: 'none',
                        isAiGenerated: asset.isAiGenerated,
                      };
                      const nextOverlays = caption
                        ? [
                            ...activeProject.overlays,
                            {
                              id: `ov_vo_${Date.now()}`,
                              trackId: 'gfx1',
                              type: 'lower_third' as const,
                              text: caption.text,
                              startTime: voClip.startTime,
                              duration: voClip.duration,
                              x: 50,
                              y: 86,
                              fontFamily: 'DM Sans',
                              fontSize: 28,
                              color: '#FFFFFF',
                              backgroundColor: '#0B0E14',
                              backgroundOpacity: 0.72,
                              strokeColor: '#000000',
                              strokeWidth: 0,
                              shadow: true,
                              opacity: 100,
                              animation: 'fade' as const,
                            },
                          ]
                        : activeProject.overlays;
                      persistProject(
                        {
                          ...activeProject,
                          assets: nextAssets,
                          clips: [...activeProject.clips, voClip],
                          overlays: nextOverlays,
                        },
                        true
                      );
                    }}
                    onAddAudioToTimeline={(asset, trackId) => addAssetsToTimeline([asset], trackId)}
                  />
                )}

                {(studioTab === 'transitions' || studioTab === 'motion' || studioTab === 'color') && (
                  <CreativeStudiosPanel
                    mode={studioTab}
                    project={activeProject}
                    currentTime={currentTime}
                    selectedClipId={selectedClipId}
                    colorPresets={colorPresets}
                    onApplyTransitionToSelected={(tr: ClipTransition) => {
                      if (!selectedClipId) return;
                      pushUndo(activeProject);
                      persistProject({
                        ...activeProject,
                        clips: activeProject.clips.map((c) =>
                          c.id === selectedClipId ? { ...c, transitionIn: tr } : c
                        ),
                      });
                    }}
                    onApplyTransitionToAllCuts={(tr: ClipTransition) => {
                      pushUndo(activeProject);
                      const v1Sorted = activeProject.clips
                        .filter((c) => c.trackId === 'v1')
                        .sort((a, b) => a.startTime - b.startTime);
                      const firstId = v1Sorted[0]?.id;
                      persistProject({
                        ...activeProject,
                        clips: activeProject.clips.map((c) =>
                          c.trackId === 'v1' && c.id !== firstId ? { ...c, transitionIn: tr } : c
                        ),
                      });
                    }}
                    onAddOverlay={(ov: MotionOverlay) => {
                      pushUndo(activeProject);
                      persistProject({
                        ...activeProject,
                        overlays: [...activeProject.overlays, ov],
                      });
                      setSelectedOverlayId(ov.id);
                      setSelectedClipId(null);
                    }}
                    onUpdateColorGrading={(next: ColorGradingSettings) =>
                      persistProject({ ...activeProject, colorGrading: next })
                    }
                    onColorPresetsUpdated={setColorPresets}
                  />
                )}
              </section>

              {/* CENTER PANEL: Video Preview Monitor */}
              <section className="flex-1 min-w-0 overflow-hidden">
                <VideoPreviewMonitor
                  project={activeProject}
                  currentTime={currentTime}
                  isPlaying={isPlaying}
                  totalDuration={totalDuration}
                  onTimeChange={setCurrentTime}
                  onTogglePlay={() => setIsPlaying((p) => !p)}
                  onAspectChange={(aspect: AspectRatioOption, platformId: string) => {
                    const dims = computeDimensionsForAspect(activeProject.settings.resolution, aspect);
                    persistProject({
                      ...activeProject,
                      settings: {
                        ...activeProject.settings,
                        aspectRatio: aspect,
                        platformPreset: platformId,
                        width: dims.width,
                        height: dims.height,
                      },
                    });
                  }}
                  selectedOverlayId={selectedOverlayId}
                  onSelectOverlay={(id) => {
                    setSelectedOverlayId(id);
                    if (id) setSelectedClipId(null);
                  }}
                />
              </section>

              {/* RIGHT PANEL: Properties Inspector */}
              <aside className="w-72 xl:w-80 shrink-0 overflow-hidden">
                <InspectorPanel
                  project={activeProject}
                  selectedClip={selectedClip}
                  selectedOverlay={selectedOverlay}
                  onUpdateClip={(clipId, patch) =>
                    persistProject({
                      ...activeProject,
                      clips: activeProject.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
                    })
                  }
                  onDeleteClip={(clipId) => {
                    pushUndo(activeProject);
                    persistProject({
                      ...activeProject,
                      clips: activeProject.clips.filter((c) => c.id !== clipId),
                    });
                    setSelectedClipId(null);
                  }}
                  onUpdateOverlay={(overlayId, patch) =>
                    persistProject({
                      ...activeProject,
                      overlays: activeProject.overlays.map((o) =>
                        o.id === overlayId ? { ...o, ...patch } : o
                      ),
                    })
                  }
                  onDeleteOverlay={(overlayId) => {
                    pushUndo(activeProject);
                    persistProject({
                      ...activeProject,
                      overlays: activeProject.overlays.filter((o) => o.id !== overlayId),
                    });
                    setSelectedOverlayId(null);
                  }}
                  onUpdateSettings={(patch) =>
                    persistProject({
                      ...activeProject,
                      settings: { ...activeProject.settings, ...patch },
                    })
                  }
                />
              </aside>
            </div>

            {/* BOTTOM PANEL: Multi-Track Editing Timeline */}
            <section className="h-[310px] shrink-0 overflow-hidden">
              <MultiTrackTimeline
                project={activeProject}
                currentTime={currentTime}
                totalDuration={totalDuration}
                selectedClipId={selectedClipId}
                selectedOverlayId={selectedOverlayId}
                canUndo={undoStack.length > 0}
                canRedo={redoStack.length > 0}
                onTimeChange={setCurrentTime}
                onSelectClip={setSelectedClipId}
                onSelectOverlay={setSelectedOverlayId}
                onUpdateClips={(clips, recordHistory) => {
                  if (recordHistory) pushUndo(activeProject);
                  persistProject({ ...activeProject, clips });
                }}
                onUpdateOverlays={(overlays, recordHistory) => {
                  if (recordHistory) pushUndo(activeProject);
                  persistProject({ ...activeProject, overlays });
                }}
                onUpdateTracks={(tracks) => persistProject({ ...activeProject, tracks })}
                onAddMarkerAtPlayhead={() => {
                  const marker = {
                    id: `m_${Date.now()}`,
                    time: Math.round(currentTime * 100) / 100,
                    name: `Marker ${activeProject.markers.length + 1}`,
                    comment: 'Editorial cue',
                    color: '#F59E0B',
                  };
                  persistProject({
                    ...activeProject,
                    markers: [...activeProject.markers, marker],
                  });
                }}
                onToggleBeatMarkerAtTime={(t) => {
                  if (!activeProject.audioAnalysis) return;
                  const rounded = Math.round(t * 1000) / 1000;
                  const existingIdx = activeProject.audioAnalysis.beats.findIndex(
                    (b) => Math.abs(b.time - rounded) < 0.25
                  );
                  const beats = [...activeProject.audioAnalysis.beats];
                  if (existingIdx >= 0) {
                    beats.splice(existingIdx, 1);
                  } else {
                    beats.push({
                      id: `beat_manual_${Date.now()}`,
                      time: rounded,
                      strength: 1,
                      isDownbeat: true,
                      barIndex: Math.floor(beats.length / 4),
                      manual: true,
                    });
                    beats.sort((a, b) => a.time - b.time);
                  }
                  persistProject({
                    ...activeProject,
                    audioAnalysis: { ...activeProject.audioAnalysis, beats },
                  });
                }}
                onDropAssetOnTrack={(assetId, trackId, startTime) => {
                  const asset = activeProject.assets.find((a) => a.id === assetId);
                  if (asset) addAssetsToTimeline([asset], trackId, startTime);
                }}
                onUndo={handleUndo}
                onRedo={handleRedo}
              />
            </section>
          </div>
        )}

        {page === 'studio' && !activeProject && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
            <Film className="w-10 h-10 text-slate-600" />
            <h2 className="text-lg font-semibold text-white">No Active Project Selected</h2>
            <p className="text-xs text-slate-400">Create a new commercial project or open an existing one from your Dashboard.</p>
            <button
              type="button"
              onClick={() => setPage('new_project')}
              className="px-4 py-2 rounded-lg bg-[#7C3AED] text-xs font-medium text-white"
            >
              Create Commercial Project
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
