import React, { useMemo, useRef, useState } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  Flag,
  Lock,
  Magnet,
  MousePointer2,
  Plus,
  Redo2,
  Scissors,
  Trash2,
  Undo2,
  Unlock,
  Volume2,
  VolumeX,
  ZoomIn,
  ZoomOut,
  ArrowLeftRight,
} from 'lucide-react';
import type {
  MediaAsset,
  MotionOverlay,
  StudioProject,
  TimelineClip,
  TimelineTrack,
} from '../types/studio';
import { formatShortDuration, formatTimecode } from '../data/catalogs';

export type TimelineToolMode = 'select' | 'razor' | 'trim';

interface MultiTrackTimelineProps {
  project: StudioProject;
  currentTime: number;
  totalDuration: number;
  selectedClipId: string | null;
  selectedOverlayId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  onTimeChange: (t: number) => void;
  onSelectClip: (id: string | null) => void;
  onSelectOverlay: (id: string | null) => void;
  onUpdateClips: (clips: TimelineClip[], pushHistory?: boolean) => void;
  onUpdateOverlays: (overlays: MotionOverlay[], pushHistory?: boolean) => void;
  onUpdateTracks: (tracks: TimelineTrack[]) => void;
  onAddMarkerAtPlayhead: () => void;
  onToggleBeatMarkerAtTime: (time: number) => void;
  onDropAssetOnTrack: (assetId: string, trackId: string, startTime: number) => void;
  onUndo: () => void;
  onRedo: () => void;
}

export const MultiTrackTimeline: React.FC<MultiTrackTimelineProps> = ({
  project,
  currentTime,
  totalDuration,
  selectedClipId,
  selectedOverlayId,
  canUndo,
  canRedo,
  onTimeChange,
  onSelectClip,
  onSelectOverlay,
  onUpdateClips,
  onUpdateOverlays,
  onUpdateTracks,
  onAddMarkerAtPlayhead,
  onToggleBeatMarkerAtTime,
  onDropAssetOnTrack,
  onUndo,
  onRedo,
}) => {
  const [tool, setTool] = useState<TimelineToolMode>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [rippleEnabled, setRippleEnabled] = useState(false);
  const [pixelsPerSec, setPixelsPerSec] = useState(44);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const assetMap = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    for (const a of project.assets) map.set(a.id, a);
    return map;
  }, [project.assets]);

  const timelineSpanSec = Math.max(project.settings.targetDuration + 10, totalDuration + 10, 30);
  const timelineWidthPx = Math.max(900, Math.ceil(timelineSpanSec * pixelsPerSec));

  const snapPoints = useMemo(() => {
    const pts: number[] = [0, currentTime, project.settings.targetDuration];
    for (const c of project.clips) {
      pts.push(c.startTime, c.startTime + c.duration);
    }
    if (project.audioAnalysis?.beats) {
      for (const b of project.audioAnalysis.beats) pts.push(b.time);
    }
    return pts;
  }, [project.clips, project.audioAnalysis, currentTime, project.settings.targetDuration]);

  const snapTime = (rawTime: number): number => {
    if (!snapEnabled) return Math.max(0, Math.round(rawTime * 1000) / 1000);
    const thresholdSec = 10 / pixelsPerSec;
    let best = rawTime;
    let bestDist = thresholdSec;
    for (const p of snapPoints) {
      const d = Math.abs(p - rawTime);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return Math.max(0, Math.round(best * 1000) / 1000);
  };

  const handleRulerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const updateFromClientX = (clientX: number) => {
      const x = Math.max(0, clientX - rect.left);
      onTimeChange(Math.min(timelineSpanSec, x / pixelsPerSec));
    };
    updateFromClientX(e.clientX);
    const onMove = (ev: PointerEvent) => updateFromClientX(ev.clientX);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const splitClipAtTime = (clip: TimelineClip, splitTime: number) => {
    const track = project.tracks.find((t) => t.id === clip.trackId);
    if (track?.locked) return;
    if (splitTime <= clip.startTime + 0.15 || splitTime >= clip.startTime + clip.duration - 0.15) return;

    const firstDur = Math.round((splitTime - clip.startTime) * 1000) / 1000;
    const secondDur = Math.round((clip.duration - firstDur) * 1000) / 1000;
    const speed = clip.speed || 1;
    const splitSrcPoint = clip.inPoint + firstDur * speed;

    const firstPart: TimelineClip = {
      ...clip,
      duration: firstDur,
      outPoint: Math.round(splitSrcPoint * 1000) / 1000,
    };
    const secondPart: TimelineClip = {
      ...clip,
      id: `clip_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      startTime: Math.round(splitTime * 1000) / 1000,
      duration: secondDur,
      inPoint: Math.round(splitSrcPoint * 1000) / 1000,
      transitionIn: undefined,
    };

    const next = project.clips.flatMap((c) => (c.id === clip.id ? [firstPart, secondPart] : [c]));
    onUpdateClips(next, true);
    onSelectClip(secondPart.id);
  };

  const handleSplitSelectedAtPlayhead = () => {
    const target = selectedClipId
      ? project.clips.find((c) => c.id === selectedClipId)
      : project.clips.find((c) => currentTime > c.startTime + 0.15 && currentTime < c.startTime + c.duration - 0.15);
    if (target) splitClipAtTime(target, currentTime);
  };

  const handleDuplicateSelected = () => {
    if (selectedClipId) {
      const clip = project.clips.find((c) => c.id === selectedClipId);
      if (!clip) return;
      const copy: TimelineClip = {
        ...clip,
        id: `clip_${Date.now()}`,
        startTime: Math.round((clip.startTime + clip.duration) * 1000) / 1000,
      };
      onUpdateClips([...project.clips, copy], true);
      onSelectClip(copy.id);
    } else if (selectedOverlayId) {
      const ov = project.overlays.find((o) => o.id === selectedOverlayId);
      if (!ov) return;
      const copy: MotionOverlay = {
        ...ov,
        id: `ov_${Date.now()}`,
        startTime: Math.round((ov.startTime + ov.duration) * 1000) / 1000,
      };
      onUpdateOverlays([...project.overlays, copy], true);
      onSelectOverlay(copy.id);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedClipId) {
      const clip = project.clips.find((c) => c.id === selectedClipId);
      if (!clip) return;
      const track = project.tracks.find((t) => t.id === clip.trackId);
      if (track?.locked) return;
      let next = project.clips.filter((c) => c.id !== selectedClipId);
      if (rippleEnabled) {
        next = next.map((c) =>
          c.trackId === clip.trackId && c.startTime > clip.startTime
            ? { ...c, startTime: Math.max(0, Math.round((c.startTime - clip.duration) * 1000) / 1000) }
            : c
        );
      }
      onUpdateClips(next, true);
      onSelectClip(null);
    } else if (selectedOverlayId) {
      onUpdateOverlays(
        project.overlays.filter((o) => o.id !== selectedOverlayId),
        true
      );
      onSelectOverlay(null);
    }
  };

  const startClipDrag = (
    e: React.PointerEvent,
    clip: TimelineClip,
    mode: 'move' | 'trim-left' | 'trim-right'
  ) => {
    e.stopPropagation();
    const track = project.tracks.find((t) => t.id === clip.trackId);
    if (track?.locked) return;

    if (tool === 'razor' && mode === 'move') {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickOffsetSec = (e.clientX - rect.left) / pixelsPerSec;
      splitClipAtTime(clip, clip.startTime + clickOffsetSec);
      return;
    }

    onSelectClip(clip.id);
    onSelectOverlay(null);

    const startX = e.clientX;
    const origStart = clip.startTime;
    const origDur = clip.duration;
    const origIn = clip.inPoint;
    const origOut = clip.outPoint;
    let latestClips = project.clips;

    const onMove = (ev: PointerEvent) => {
      const dxSec = (ev.clientX - startX) / pixelsPerSec;
      latestClips = project.clips.map((c) => {
        if (c.id !== clip.id) {
          if (rippleEnabled && mode === 'trim-right' && c.trackId === clip.trackId && c.startTime >= origStart + origDur - 0.05) {
            const newDur = Math.max(0.25, origDur + dxSec);
            const delta = newDur - origDur;
            return { ...c, startTime: Math.max(0, Math.round((c.startTime + delta) * 1000) / 1000) };
          }
          return c;
        }
        if (mode === 'move') {
          const nextStart = snapTime(Math.max(0, origStart + dxSec));
          return { ...c, startTime: nextStart };
        }
        if (mode === 'trim-left') {
          const clampedDelta = Math.max(-origIn, Math.min(origDur - 0.25, dxSec));
          const nextStart = snapTime(Math.max(0, origStart + clampedDelta));
          const actualDelta = nextStart - origStart;
          return {
            ...c,
            startTime: nextStart,
            inPoint: Math.max(0, Math.round((origIn + actualDelta) * 1000) / 1000),
            duration: Math.max(0.25, Math.round((origDur - actualDelta) * 1000) / 1000),
          };
        }
        // trim-right
        const maxDur = c.mediaType === 'image' ? 120 : Math.max(0.25, c.sourceDuration - origIn);
        const nextEnd = snapTime(origStart + Math.max(0.25, Math.min(maxDur, origDur + dxSec)));
        const nextDur = Math.max(0.25, Math.min(maxDur, nextEnd - origStart));
        return {
          ...c,
          duration: Math.round(nextDur * 1000) / 1000,
          outPoint: Math.round((origIn + nextDur) * 1000) / 1000,
        };
      });
      onUpdateClips(latestClips, false);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onUpdateClips(latestClips, true);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startOverlayDrag = (e: React.PointerEvent, ov: MotionOverlay, mode: 'move' | 'trim-right') => {
    e.stopPropagation();
    onSelectOverlay(ov.id);
    onSelectClip(null);
    const startX = e.clientX;
    const origStart = ov.startTime;
    const origDur = ov.duration;
    let latest = project.overlays;

    const onMove = (ev: PointerEvent) => {
      const dxSec = (ev.clientX - startX) / pixelsPerSec;
      latest = project.overlays.map((o) => {
        if (o.id !== ov.id) return o;
        if (mode === 'move') {
          return { ...o, startTime: snapTime(Math.max(0, origStart + dxSec)) };
        }
        return { ...o, duration: Math.max(0.4, Math.round((origDur + dxSec) * 1000) / 1000) };
      });
      onUpdateOverlays(latest, false);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onUpdateOverlays(latest, true);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const toggleTrackProp = (trackId: string, prop: 'locked' | 'visible' | 'muted' | 'solo') => {
    onUpdateTracks(
      project.tracks.map((t) => (t.id === trackId ? { ...t, [prop]: !t[prop] } : t))
    );
  };

  const addTrack = (type: 'video' | 'audio') => {
    const count = project.tracks.filter((t) => t.type === type).length + 1;
    const newTrack: TimelineTrack = {
      id: `${type[0]}${Date.now().toString(36)}`,
      name: type === 'video' ? `V${count} · Video Layer` : `A${count} · Audio Track`,
      type,
      locked: false,
      visible: true,
      muted: false,
      solo: false,
      volume: 100,
      height: 58,
    };
    if (type === 'video') {
      onUpdateTracks([newTrack, ...project.tracks]);
    } else {
      onUpdateTracks([...project.tracks, newTrack]);
    }
  };

  // Ruler ticks
  const tickStepSec = pixelsPerSec >= 70 ? 1 : pixelsPerSec >= 32 ? 2 : 5;
  const ticks: number[] = [];
  for (let s = 0; s <= timelineSpanSec; s += tickStepSec) ticks.push(s);

  return (
    <div className="flex flex-col h-full bg-[#0F1219] border-t border-white/[0.08] select-none">
      {/* Timeline Editing Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#141822] border-b border-white/[0.07] gap-2 overflow-x-auto">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTool('select')}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
              tool === 'select' ? 'bg-[#7C3AED] text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
            title="Selection Tool (V)"
          >
            <MousePointer2 className="w-3.5 h-3.5" />
            <span>Select</span>
          </button>
          <button
            type="button"
            onClick={() => setTool('razor')}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
              tool === 'razor' ? 'bg-[#7C3AED] text-white' : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
            }`}
            title="Razor Split Tool (C) — click a clip to split"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Split</span>
          </button>
          <button
            type="button"
            onClick={handleSplitSelectedAtPlayhead}
            className="px-2 py-1 rounded text-xs text-slate-300 hover:text-white hover:bg-white/[0.06] whitespace-nowrap shrink-0 transition-colors"
            title="Split clip at current playhead"
          >
            Cut at Playhead
          </button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          <button
            type="button"
            onClick={() => setSnapEnabled((v) => !v)}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
              snapEnabled ? 'bg-[#3B82F6]/20 text-[#93C5FD]' : 'text-slate-400 hover:text-white'
            }`}
            title="Toggle Magnetic Snapping to Clips & Beats (S)"
          >
            <Magnet className="w-3.5 h-3.5" />
            <span>Snap</span>
          </button>
          <button
            type="button"
            onClick={() => setRippleEnabled((v) => !v)}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
              rippleEnabled ? 'bg-[#3B82F6]/20 text-[#93C5FD]' : 'text-slate-400 hover:text-white'
            }`}
            title="Toggle Ripple Delete & Ripple Trim (R)"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Ripple</span>
          </button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-white/10 mx-1" />

          <button
            type="button"
            onClick={handleDuplicateSelected}
            disabled={!selectedClipId && !selectedOverlayId}
            className="p-1.5 rounded text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
            title="Duplicate Selected Clip/Overlay"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={!selectedClipId && !selectedOverlayId}
            className="p-1.5 rounded text-slate-400 hover:text-rose-400 disabled:opacity-30 transition-colors"
            title="Delete Selected (Del)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onAddMarkerAtPlayhead}
            className="px-2 py-1 rounded text-xs text-slate-300 hover:text-white hover:bg-white/[0.06] flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors"
            title="Add Timeline Marker at Playhead (M)"
          >
            <Flag className="w-3.5 h-3.5 text-amber-400" />
            <span>Marker</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => addTrack('video')}
            className="px-2 py-1 rounded text-[11px] bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 flex items-center gap-1 whitespace-nowrap"
          >
            <Plus className="w-3 h-3" /> Video Track
          </button>
          <button
            type="button"
            onClick={() => addTrack('audio')}
            className="px-2 py-1 rounded text-[11px] bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 flex items-center gap-1 whitespace-nowrap"
          >
            <Plus className="w-3 h-3" /> Audio Track
          </button>

          <div className="flex items-center gap-1.5 ml-2">
            <button
              type="button"
              onClick={() => setPixelsPerSec((p) => Math.max(14, p - 10))}
              className="p-1 text-slate-400 hover:text-white"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              min={14}
              max={140}
              value={pixelsPerSec}
              onChange={(e) => setPixelsPerSec(Number(e.target.value))}
              className="w-20 h-1 cursor-pointer"
              aria-label="Timeline zoom"
            />
            <button
              type="button"
              onClick={() => setPixelsPerSec((p) => Math.min(140, p + 10))}
              className="p-1 text-slate-400 hover:text-white"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Scrollable Multi-Track Grid */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Track Header Column */}
        <div className="w-48 shrink-0 bg-[#12161F] border-r border-white/[0.08] flex flex-col">
          {/* Ruler Header Corner */}
          <div className="h-9 px-3 flex items-center justify-between border-b border-white/[0.07] text-[11px] text-slate-400 font-mono tabular-nums">
            <span>{formatTimecode(currentTime, project.settings.fps)}</span>
            <span className="text-slate-500">Target {project.settings.targetDuration}s</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {project.tracks.map((track) => (
              <div
                key={track.id}
                style={{ height: `${track.height}px` }}
                className="px-2.5 py-1.5 border-b border-white/[0.06] flex flex-col justify-between bg-[#12161F]"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-medium text-slate-200 truncate">{track.name}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleTrackProp(track.id, 'locked')}
                      className={`p-1 rounded ${track.locked ? 'text-amber-400' : 'text-slate-500 hover:text-slate-300'}`}
                      title={track.locked ? 'Unlock Track' : 'Lock Track'}
                    >
                      {track.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>
                    {track.type !== 'audio' ? (
                      <button
                        type="button"
                        onClick={() => toggleTrackProp(track.id, 'visible')}
                        className={`p-1 rounded ${!track.visible ? 'text-rose-400' : 'text-slate-400 hover:text-white'}`}
                        title={track.visible ? 'Hide Track' : 'Show Track'}
                      >
                        {track.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleTrackProp(track.id, 'muted')}
                        className={`p-1 rounded ${track.muted ? 'text-rose-400' : 'text-slate-400 hover:text-white'}`}
                        title={track.muted ? 'Unmute Track' : 'Mute Track'}
                      >
                        {track.muted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                      </button>
                    )}
                  </div>
                </div>
                {track.type === 'audio' && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-500 w-7 tabular-nums">
                      {track.volume}%
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={150}
                      value={track.volume}
                      onChange={(e) =>
                        onUpdateTracks(
                          project.tracks.map((t) =>
                            t.id === track.id ? { ...t, volume: Number(e.target.value) } : t
                          )
                        )
                      }
                      className="flex-1 h-1"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Horizontally Scrollable Tracks + Ruler */}
        <div ref={scrollContainerRef} className="flex-1 overflow-auto relative bg-[#0C0F15]">
          <div style={{ width: `${timelineWidthPx}px` }} className="relative min-h-full">
            {/* Timecode Ruler + Beat & Section Strip */}
            <div
              onPointerDown={handleRulerPointerDown}
              onDoubleClick={(e) => {
                if (e.shiftKey) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const t = Math.max(0, (e.clientX - rect.left) / pixelsPerSec);
                  onToggleBeatMarkerAtTime(t);
                }
              }}
              className="h-9 border-b border-white/[0.08] bg-[#141822] relative cursor-ew-resize sticky top-0 z-20"
            >
              {/* Audio Structure Section Bands */}
              {project.audioAnalysis?.sections.map((sec) => (
                <div
                  key={sec.id}
                  style={{
                    left: `${sec.start * pixelsPerSec}px`,
                    width: `${Math.max(12, (sec.end - sec.start) * pixelsPerSec)}px`,
                  }}
                  className="absolute top-0 h-3.5 text-[9px] px-1 truncate border-r border-white/10 text-slate-300 bg-[#3B82F6]/15"
                  title={`${sec.label} (${sec.start}s–${sec.end}s)`}
                >
                  {sec.label}
                </div>
              ))}

              {/* Second Ticks */}
              {ticks.map((sec) => (
                <div
                  key={sec}
                  style={{ left: `${sec * pixelsPerSec}px` }}
                  className="absolute bottom-0 h-4 border-l border-white/15 pl-1 text-[10px] font-mono tabular-nums text-slate-500"
                >
                  {formatShortDuration(sec)}
                </div>
              ))}

              {/* Target Duration Boundary Marker */}
              <div
                style={{ left: `${project.settings.targetDuration * pixelsPerSec}px` }}
                className="absolute top-0 bottom-0 w-0.5 bg-amber-400/70"
                title={`Target duration: ${project.settings.targetDuration}s`}
              />

              {/* Beat Markers on Ruler */}
              {project.audioAnalysis?.beats.map((b) => (
                <div
                  key={b.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (e.shiftKey) onToggleBeatMarkerAtTime(b.time);
                    else onTimeChange(b.time);
                  }}
                  style={{ left: `${b.time * pixelsPerSec}px` }}
                  className={`absolute bottom-0 w-0.5 cursor-pointer ${
                    b.isDownbeat ? 'h-3.5 bg-[#A855F7]' : 'h-2 bg-[#3B82F6]/70'
                  }`}
                  title={`${b.isDownbeat ? 'Downbeat' : 'Beat'} at ${b.time.toFixed(2)}s (Shift+Click to remove)`}
                />
              ))}

              {/* Custom Timeline Markers */}
              {project.markers.map((m) => (
                <div
                  key={m.id}
                  style={{ left: `${m.time * pixelsPerSec}px` }}
                  className="absolute top-3.5 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-amber-400 border border-black"
                  title={`${m.name} (${m.time.toFixed(2)}s)`}
                />
              ))}
            </div>

            {/* Track Lanes */}
            {project.tracks.map((track) => {
              const trackClips = project.clips.filter((c) => c.trackId === track.id);
              const trackOverlays = track.type === 'overlay' ? project.overlays : [];

              return (
                <div
                  key={track.id}
                  style={{ height: `${track.height}px` }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (track.locked) return;
                    const assetId = e.dataTransfer.getData('text/asset-id');
                    if (!assetId) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const dropSec = snapTime(Math.max(0, (e.clientX - rect.left) / pixelsPerSec));
                    onDropAssetOnTrack(assetId, track.id, dropSec);
                  }}
                  className={`relative border-b border-white/[0.06] ${
                    track.locked ? 'opacity-65 bg-[#12141B]' : 'bg-[#0D1017]'
                  }`}
                >
                  {/* Beat Grid Vertical Hairlines */}
                  {project.audioAnalysis?.beats
                    .filter((b) => b.isDownbeat)
                    .map((b) => (
                      <div
                        key={b.id}
                        style={{ left: `${b.time * pixelsPerSec}px` }}
                        className="pointer-events-none absolute top-0 bottom-0 w-px bg-[#7C3AED]/15"
                      />
                    ))}

                  {/* Video / Image / Audio Clips */}
                  {trackClips.map((clip) => {
                    const asset = assetMap.get(clip.assetId);
                    const isSelected = selectedClipId === clip.id;
                    const leftPx = clip.startTime * pixelsPerSec;
                    const widthPx = Math.max(24, clip.duration * pixelsPerSec);
                    const isAudio = clip.mediaType === 'audio';
                    const peaks =
                      isAudio && project.audioAnalysis?.assetId === clip.assetId
                        ? project.audioAnalysis.peaks
                        : asset?.waveformPeaks;

                    return (
                      <div
                        key={clip.id}
                        onPointerDown={(e) => startClipDrag(e, clip, 'move')}
                        style={{
                          left: `${leftPx}px`,
                          width: `${widthPx}px`,
                          top: '4px',
                          bottom: '4px',
                        }}
                        className={`absolute rounded overflow-hidden border transition-colors ${
                          tool === 'razor' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
                        } ${
                          isSelected
                            ? 'border-[#C4B5FD] ring-1 ring-[#7C3AED] z-10'
                            : 'border-white/15 hover:border-white/30'
                        } ${
                          clip.mediaType === 'video'
                            ? 'bg-[#2D2254]/90'
                            : clip.mediaType === 'image'
                              ? 'bg-[#173057]/90'
                              : 'bg-[#123832]/90'
                        }`}
                      >
                        {/* Thumbnail strip or Audio Waveform */}
                        {isAudio && peaks && peaks.length > 0 ? (
                          <div className="absolute inset-0 flex items-center gap-[1px] px-1 opacity-55 pointer-events-none">
                            {peaks.slice(0, Math.max(12, Math.min(180, Math.floor(widthPx / 3)))).map((pk, idx) => (
                              <div
                                key={idx}
                                className="flex-1 bg-emerald-400/80 rounded-sm"
                                style={{ height: `${Math.max(8, Math.round(pk * 82))}%` }}
                              />
                            ))}
                          </div>
                        ) : asset?.thumbnailUrl ? (
                          <img
                            src={asset.thumbnailUrl}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none"
                          />
                        ) : null}

                        {/* Transition Badge Indicator */}
                        {clip.transitionIn && (
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-[#3B82F6]/35 border-r border-[#60A5FA]/60 pointer-events-none"
                            style={{ width: `${Math.min(widthPx * 0.4, clip.transitionIn.duration * pixelsPerSec)}px` }}
                            title={`Transition: ${clip.transitionIn.name}`}
                          />
                        )}

                        {/* Clip Label */}
                        <div className="relative z-10 px-2 py-1 flex flex-col justify-between h-full pointer-events-none">
                          <div className="flex items-center justify-between gap-1 text-[11px] font-medium text-white truncate">
                            <span className="truncate">{clip.name}</span>
                            {clip.speed !== 1 && (
                              <span className="font-mono text-[10px] text-amber-300 shrink-0">
                                {clip.speed}x
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] font-mono tabular-nums text-white/70 truncate">
                            {formatShortDuration(clip.duration)} · in {clip.inPoint.toFixed(1)}s
                          </div>
                        </div>

                        {/* Left & Right Trim Handles */}
                        <div
                          onPointerDown={(e) => startClipDrag(e, clip, 'trim-left')}
                          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40 z-20"
                          title="Drag to trim clip In point"
                        />
                        <div
                          onPointerDown={(e) => startClipDrag(e, clip, 'trim-right')}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40 z-20"
                          title="Drag to trim clip Out point"
                        />
                      </div>
                    );
                  })}

                  {/* Motion Graphics & Text Overlays */}
                  {trackOverlays.map((ov) => {
                    const isSelected = selectedOverlayId === ov.id;
                    return (
                      <div
                        key={ov.id}
                        onPointerDown={(e) => startOverlayDrag(e, ov, 'move')}
                        style={{
                          left: `${ov.startTime * pixelsPerSec}px`,
                          width: `${Math.max(36, ov.duration * pixelsPerSec)}px`,
                          top: '5px',
                          bottom: '5px',
                        }}
                        className={`absolute rounded px-2 flex items-center justify-between cursor-grab border transition-colors ${
                          isSelected
                            ? 'bg-[#7C3AED]/55 border-[#C4B5FD] z-10'
                            : 'bg-[#4C1D95]/60 border-purple-400/30 hover:border-purple-300/60'
                        }`}
                      >
                        <span className="text-[11px] font-medium text-white truncate pointer-events-none">
                          {ov.text || ov.type}
                        </span>
                        <div
                          onPointerDown={(e) => startOverlayDrag(e, ov, 'trim-right')}
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/40"
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Global Vertical Playhead Line */}
            <div
              style={{ left: `${currentTime * pixelsPerSec}px` }}
              className="pointer-events-none absolute top-0 bottom-0 w-px bg-[#A855F7] z-30"
            >
              <div className="w-3 h-3 -ml-[5.5px] bg-[#A855F7] rounded-b-sm shadow" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
