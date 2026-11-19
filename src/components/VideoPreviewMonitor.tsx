import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Maximize2,
  Pause,
  Play,
  Repeat,
  SkipBack,
  SkipForward,
  StepBack,
  StepForward,
  Volume2,
  VolumeX,
  Grid3X3,
} from 'lucide-react';
import type {
  AspectRatioOption,
  ColorGradingSettings,
  MediaAsset,
  MotionOverlay,
  StudioProject,
  TimelineClip,
} from '../types/studio';
import { PLATFORM_PRESETS, formatTimecode } from '../data/catalogs';

interface VideoPreviewMonitorProps {
  project: StudioProject;
  currentTime: number;
  isPlaying: boolean;
  totalDuration: number;
  onTimeChange: (time: number) => void;
  onTogglePlay: () => void;
  onAspectChange: (aspect: AspectRatioOption, platformId: string) => void;
  selectedOverlayId: string | null;
  onSelectOverlay: (id: string | null) => void;
}

function buildCssFilter(cg: ColorGradingSettings): string {
  if (cg.lookPreset === 'none') return 'none';
  const brightness = Math.max(0.25, 1 + cg.exposure * 0.35 + cg.whites * 0.002 - cg.blacks * 0.0015);
  const contrast = Math.max(0.3, 1 + cg.contrast / 100);
  const saturate = Math.max(0, 1 + (cg.saturation + cg.vibrance * 0.5) / 100);
  const sepia = cg.temperature > 0 ? Math.min(0.45, cg.temperature / 240) : 0;
  const hue = cg.hueShift + (cg.temperature < 0 ? cg.temperature * 0.25 : 0) + cg.tint * 0.15;
  return `brightness(${brightness.toFixed(3)}) contrast(${contrast.toFixed(3)}) saturate(${saturate.toFixed(3)}) sepia(${sepia.toFixed(3)}) hue-rotate(${hue.toFixed(1)}deg)`;
}

function computeImageMotionTransform(clip: TimelineClip, localTime: number): string {
  const progress = Math.max(0, Math.min(1, localTime / Math.max(0.1, clip.duration)));
  let scale = clip.scale / 100;
  let tx = clip.positionX;
  let ty = clip.positionY;

  switch (clip.imageMotion) {
    case 'slow_zoom_in':
      scale *= 1 + 0.16 * progress;
      break;
    case 'slow_zoom_out':
      scale *= 1.16 - 0.16 * progress;
      break;
    case 'pan_left':
      scale *= 1.12;
      tx += 5 - 10 * progress;
      break;
    case 'pan_right':
      scale *= 1.12;
      tx += -5 + 10 * progress;
      break;
    case 'tilt_up':
      scale *= 1.12;
      ty += 5 - 10 * progress;
      break;
    case 'tilt_down':
      scale *= 1.12;
      ty += -5 + 10 * progress;
      break;
    case 'parallax':
      scale *= 1.08 + 0.08 * progress;
      tx += Math.sin(progress * Math.PI) * 4;
      break;
    case 'cinematic_reveal':
      scale *= 1.14 - 0.1 * progress;
      ty += (1 - progress) * 2;
      break;
    default:
      break;
  }

  return `translate(${tx.toFixed(2)}%, ${ty.toFixed(2)}%) scale(${scale.toFixed(3)}) rotate(${clip.rotation}deg)`;
}

function computeTransitionStyle(clip: TimelineClip, localTime: number): React.CSSProperties {
  const tr = clip.transitionIn;
  if (!tr || localTime > tr.duration || tr.duration <= 0) return {};
  const p = Math.max(0, Math.min(1, localTime / tr.duration));
  const eased = p * p * (3 - 2 * p);

  switch (tr.id) {
    case 'whip_pan':
    case 'slide':
    case 'push':
      return { transform: `translateX(${((1 - eased) * 18).toFixed(1)}%)`, opacity: Math.min(1, eased * 1.4) };
    case 'zoom_transition':
    case 'cinematic_zoom':
      return { transform: `scale(${(1.22 - 0.22 * eased).toFixed(3)})`, opacity: eased };
    case 'smooth_blur':
    case 'soft_focus_reveal':
      return { filter: `blur(${((1 - eased) * 14).toFixed(1)}px)`, opacity: eased };
    case 'spin':
      return { transform: `rotate(${((1 - eased) * 14).toFixed(1)}deg) scale(${(1.12 - 0.12 * eased).toFixed(3)})`, opacity: eased };
    case 'swipe':
    case 'mask_reveal':
      return { clipPath: `inset(0 ${((1 - eased) * 100).toFixed(1)}% 0 0)` };
    case 'flash':
    case 'light_fade':
    case 'dip_to_white':
      return { filter: `brightness(${(1 + (1 - eased) * 2.2).toFixed(2)})`, opacity: Math.min(1, eased * 1.2) };
    case 'glitch':
    case 'rgb_split':
      return { transform: `translateX(${Math.sin(p * 28) * (1 - eased) * 10}px)`, opacity: Math.min(1, eased * 1.3) };
    default:
      return { opacity: eased };
  }
}

function computeOverlayAnimationStyle(ov: MotionOverlay, localTime: number): React.CSSProperties {
  const enterDur = Math.min(0.45, ov.duration * 0.3);
  const exitDur = Math.min(0.35, ov.duration * 0.25);
  let alpha = ov.opacity / 100;
  let tx = 0;
  let ty = 0;
  let sc = 1;

  if (localTime < enterDur && enterDur > 0) {
    const p = localTime / enterDur;
    const e = 1 - Math.pow(1 - p, 3);
    if (ov.animation === 'fade' || ov.animation === 'cinematic_track') alpha *= e;
    if (ov.animation === 'slide_up') {
      alpha *= e;
      ty = (1 - e) * 22;
    }
    if (ov.animation === 'slide_left') {
      alpha *= e;
      tx = (1 - e) * 28;
    }
    if (ov.animation === 'scale_pop') {
      alpha *= e;
      sc = 0.82 + 0.18 * e;
    }
    if (ov.animation === 'reveal_mask') {
      alpha *= e;
    }
  } else if (ov.duration - localTime < exitDur && exitDur > 0) {
    const p = Math.max(0, (ov.duration - localTime) / exitDur);
    alpha *= p;
  }

  return {
    opacity: alpha,
    transform: `translate(-50%, -50%) translate(${tx}px, ${ty}px) scale(${sc})`,
    letterSpacing: ov.animation === 'cinematic_track' ? '0.12em' : undefined,
  };
}

export const VideoPreviewMonitor: React.FC<VideoPreviewMonitorProps> = ({
  project,
  currentTime,
  isPlaying,
  totalDuration,
  onTimeChange,
  onTogglePlay,
  onAspectChange,
  selectedOverlayId,
  onSelectOverlay,
}) => {
  const [loop, setLoop] = useState(true);
  const [muted, setMuted] = useState(false);
  const [useProxy, setUseProxy] = useState(true);
  const [showSafeGuides, setShowSafeGuides] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  const assetMap = useMemo(() => {
    const m = new Map<string, MediaAsset>();
    for (const a of project.assets) m.set(a.id, a);
    return m;
  }, [project.assets]);

  const visibleVideoTracks = useMemo(
    () => project.tracks.filter((t) => t.type === 'video' && t.visible),
    [project.tracks]
  );

  // Pick top-most active visual clip at currentTime
  const activeVisual = useMemo(() => {
    for (const track of visibleVideoTracks) {
      const clip = project.clips.find(
        (c) =>
          c.trackId === track.id &&
          (c.mediaType === 'video' || c.mediaType === 'image') &&
          currentTime >= c.startTime &&
          currentTime < c.startTime + c.duration
      );
      if (clip) {
        const asset = assetMap.get(clip.assetId);
        if (asset) return { clip, asset };
      }
    }
    return null;
  }, [visibleVideoTracks, project.clips, currentTime, assetMap]);

  // Active overlays at currentTime
  const activeOverlays = useMemo(() => {
    const visibleGfx = new Set(project.tracks.filter((t) => t.type === 'overlay' && t.visible).map((t) => t.id));
    return project.overlays.filter(
      (o) =>
        (visibleGfx.size === 0 || visibleGfx.has(o.trackId)) &&
        currentTime >= o.startTime &&
        currentTime <= o.startTime + o.duration
    );
  }, [project.overlays, project.tracks, currentTime]);

  // Active audio clips for synchronized playback
  const activeAudioClips = useMemo(() => {
    const trackMap = new Map(project.tracks.filter((t) => t.type === 'audio').map((t) => [t.id, t]));
    return project.clips
      .filter((c) => c.mediaType === 'audio')
      .map((clip) => ({
        clip,
        track: trackMap.get(clip.trackId),
        asset: assetMap.get(clip.assetId),
      }))
      .filter((item): item is { clip: TimelineClip; track: NonNullable<typeof item.track>; asset: MediaAsset } =>
        Boolean(item.track && item.asset)
      );
  }, [project.clips, project.tracks, assetMap]);

  // Advance playhead smoothly using requestAnimationFrame when playing
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    let lastTs = performance.now();
    let localCursor = currentTime;

    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      localCursor += dt;
      if (localCursor >= totalDuration) {
        if (loop && totalDuration > 0.1) {
          localCursor = 0;
        } else {
          onTimeChange(totalDuration);
          onTogglePlay();
          return;
        }
      }
      onTimeChange(localCursor);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, loop, totalDuration]);

  // Sync HTML5 video element to active clip & playhead
  const activeVideoSrc =
    activeVisual?.clip.mediaType === 'video'
      ? useProxy && activeVisual.asset.proxyStatus === 'ready' && activeVisual.asset.proxyUrl
        ? activeVisual.asset.proxyUrl
        : activeVisual.asset.url
      : null;

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !activeVisual || activeVisual.clip.mediaType !== 'video') return;
    const clip = activeVisual.clip;
    const speed = Math.max(0.25, Math.min(4, clip.speed || 1));
    const targetSrcTime = Math.min(
      clip.sourceDuration || 9999,
      clip.inPoint + (currentTime - clip.startTime) * speed
    );

    if (videoEl.playbackRate !== speed) {
      videoEl.playbackRate = speed;
    }
    videoEl.muted = muted || clip.muted;
    videoEl.volume = Math.max(0, Math.min(1, clip.volume / 100));

    if (Math.abs(videoEl.currentTime - targetSrcTime) > (isPlaying ? 0.35 : 0.06)) {
      try {
        videoEl.currentTime = Math.max(0, targetSrcTime);
      } catch {
        // Video metadata not yet loaded
      }
    }

    if (isPlaying && videoEl.paused) {
      void videoEl.play().catch(() => {});
    } else if (!isPlaying && !videoEl.paused) {
      videoEl.pause();
    }
  }, [activeVisual, activeVideoSrc, currentTime, isPlaying, muted]);

  // Sync audio clips (music + voiceover) with fade-in/out & ducking
  useEffect(() => {
    const hasActiveVoiceover = activeAudioClips.some(
      ({ clip, track }) =>
        clip.trackId === 'a2' &&
        !track.muted &&
        !clip.muted &&
        currentTime >= clip.startTime &&
        currentTime < clip.startTime + clip.duration
    );

    const activeIds = new Set<string>();
    for (const { clip, track, asset } of activeAudioClips) {
      activeIds.add(clip.id);
      let el = audioRefs.current.get(clip.id);
      if (!el) {
        el = new Audio(asset.url);
        el.preload = 'auto';
        audioRefs.current.set(clip.id, el);
      }
      const inRange = currentTime >= clip.startTime && currentTime < clip.startTime + clip.duration;
      if (isPlaying && inRange && !muted && !track.muted && !clip.muted) {
        const localT = currentTime - clip.startTime;
        const targetT = clip.inPoint + localT;
        if (Math.abs(el.currentTime - targetT) > 0.35) {
          el.currentTime = Math.max(0, targetT);
        }
        let vol = (clip.volume / 100) * (track.volume / 100);
        if (clip.fadeIn > 0 && localT < clip.fadeIn) {
          vol *= localT / clip.fadeIn;
        }
        if (clip.fadeOut > 0 && clip.duration - localT < clip.fadeOut) {
          vol *= Math.max(0, (clip.duration - localT) / clip.fadeOut);
        }
        if (clip.duckOnVoiceover && hasActiveVoiceover && clip.trackId === 'a1') {
          vol *= 0.4;
        }
        el.volume = Math.max(0, Math.min(1, vol));
        if (el.paused) void el.play().catch(() => {});
      } else if (!el.paused) {
        el.pause();
      }
    }

    for (const [id, el] of audioRefs.current.entries()) {
      if (!activeIds.has(id)) {
        el.pause();
        audioRefs.current.delete(id);
      }
    }
  }, [activeAudioClips, currentTime, isPlaying, muted]);

  // Cleanup audio elements on unmount
  useEffect(() => {
    return () => {
      for (const el of audioRefs.current.values()) el.pause();
      audioRefs.current.clear();
    };
  }, []);

  const aspectRatioCss = useMemo(() => {
    const { width, height } = project.settings;
    return `${width} / ${height}`;
  }, [project.settings.width, project.settings.height]);

  const cssFilter = useMemo(() => buildCssFilter(project.colorGrading), [project.colorGrading]);
  const frameStep = 1 / Math.max(1, project.settings.fps);

  const localClipTime = activeVisual ? Math.max(0, currentTime - activeVisual.clip.startTime) : 0;
  const transitionStyle = activeVisual ? computeTransitionStyle(activeVisual.clip, localClipTime) : {};

  return (
    <div className="flex flex-col h-full bg-[#0A0C10] select-none">
      {/* Monitor Top Utility Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.07] bg-[#10131A]">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-medium text-slate-200">Program Monitor</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            {project.settings.width}×{project.settings.height}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">{project.settings.fps} fps</span>
          <span aria-hidden="true">·</span>
          <span>{project.settings.aspectRatio}</span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={project.settings.platformPreset}
            onChange={(e) => {
              const preset = PLATFORM_PRESETS.find((p) => p.id === e.target.value);
              if (preset) onAspectChange(preset.aspectRatio, preset.id);
            }}
            className="bg-[#181C26] text-xs text-slate-200 border border-white/10 rounded px-2 py-1 focus:outline-none focus:border-[#7C3AED]"
            title="Switch target platform aspect ratio"
          >
            {PLATFORM_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setUseProxy((v) => !v)}
            className={`px-2 py-1 text-xs rounded border transition-colors whitespace-nowrap shrink-0 ${
              useProxy
                ? 'bg-[#3B82F6]/15 text-[#93C5FD] border-[#3B82F6]/40'
                : 'bg-[#181C26] text-slate-400 border-white/10 hover:text-slate-200'
            }`}
            title="Toggle lightweight 720p proxy playback while keeping original source for export"
          >
            {useProxy ? 'Proxy' : 'Source'}
          </button>

          <button
            type="button"
            onClick={() => setShowSafeGuides((v) => !v)}
            className={`p-1.5 rounded border transition-colors ${
              showSafeGuides
                ? 'bg-[#7C3AED]/20 text-[#C4B5FD] border-[#7C3AED]/50'
                : 'bg-[#181C26] text-slate-400 border-white/10 hover:text-slate-200'
            }`}
            title="Toggle Action & Title Safe Area Guides"
          >
            <Grid3X3 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Composited Canvas Viewport */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden min-h-0 relative">
        <div
          className="relative bg-black overflow-hidden shadow-2xl border border-white/10 max-h-full max-w-full flex items-center justify-center"
          style={{
            aspectRatio: aspectRatioCss,
            height: project.settings.height > project.settings.width ? '100%' : undefined,
            width: project.settings.width >= project.settings.height ? '100%' : undefined,
          }}
        >
          {activeVisual ? (
            <div
              className="w-full h-full relative overflow-hidden"
              style={{
                filter: cssFilter,
                opacity: activeVisual.clip.opacity / 100,
              }}
            >
              <div className="w-full h-full" style={transitionStyle}>
                {activeVisual.clip.mediaType === 'video' ? (
                  <video
                    ref={videoRef}
                    src={activeVideoSrc ?? undefined}
                    playsInline
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: `${activeVisual.clip.cropFocusX}% ${activeVisual.clip.cropFocusY}%`,
                      transform: `translate(${activeVisual.clip.positionX}%, ${activeVisual.clip.positionY}%) scale(${(activeVisual.clip.scale / 100).toFixed(3)}) rotate(${activeVisual.clip.rotation}deg)`,
                    }}
                  />
                ) : (
                  <img
                    src={activeVisual.asset.url}
                    alt={activeVisual.clip.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: `${activeVisual.clip.cropFocusX}% ${activeVisual.clip.cropFocusY}%`,
                      transform: computeImageMotionTransform(activeVisual.clip, localClipTime),
                    }}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center px-6 py-8 text-slate-500">
              <Maximize2 className="w-8 h-8 mb-3 text-slate-600" />
              <p className="text-sm font-medium text-slate-300">
                {project.clips.length === 0
                  ? 'Timeline is empty'
                  : 'Playhead is outside active visual clips'}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                {project.clips.length === 0
                  ? 'Import product videos, stills, or audio from the left panel and drag them onto the timeline, or run AI Auto Edit.'
                  : 'Move the playhead over a clip on V1 or V2 to preview.'}
              </p>
            </div>
          )}

          {/* Live Vignette Overlay */}
          {project.colorGrading.lookPreset !== 'none' && project.colorGrading.vignette > 0 && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(circle, transparent 48%, rgba(0,0,0,${(
                  project.colorGrading.vignette / 130
                ).toFixed(2)}) 100%)`,
              }}
            />
          )}

          {/* Live Motion Graphics, Text & Brand Logo Overlays */}
          {activeOverlays.map((ov) => {
            const localOvTime = Math.max(0, currentTime - ov.startTime);
            const animStyle = computeOverlayAnimationStyle(ov, localOvTime);
            const logoAsset = ov.logoAssetId ? assetMap.get(ov.logoAssetId) : undefined;
            const isSelected = selectedOverlayId === ov.id;

            return (
              <div
                key={ov.id}
                onClick={() => onSelectOverlay(ov.id)}
                className={`absolute cursor-pointer transition-shadow ${
                  isSelected ? 'ring-1 ring-[#7C3AED] ring-offset-2 ring-offset-transparent' : ''
                }`}
                style={{
                  left: `${ov.x}%`,
                  top: `${ov.y}%`,
                  ...animStyle,
                }}
              >
                {ov.type === 'brand_logo' && logoAsset ? (
                  <img
                    src={logoAsset.url}
                    alt={ov.text || 'Brand logo'}
                    referrerPolicy="no-referrer"
                    style={{ maxHeight: `${ov.fontSize * 2.2}px` }}
                    className="object-contain drop-shadow-lg"
                  />
                ) : ov.type === 'animated_line' ? (
                  <div
                    style={{
                      width: `${ov.fontSize * 5}px`,
                      height: `${Math.max(2, ov.strokeWidth || 3)}px`,
                      backgroundColor: ov.color,
                    }}
                  />
                ) : (
                  <div
                    className="px-3 py-1.5 rounded"
                    style={{
                      backgroundColor:
                        ov.backgroundOpacity > 0
                          ? `${ov.backgroundColor}${Math.round(ov.backgroundOpacity * 255)
                              .toString(16)
                              .padStart(2, '0')}`
                          : 'transparent',
                      fontFamily: ov.fontFamily,
                      fontSize: `${Math.max(12, Math.round(ov.fontSize * 0.55))}px`,
                      color: ov.color,
                      WebkitTextStroke:
                        ov.strokeWidth > 0 ? `${ov.strokeWidth}px ${ov.strokeColor}` : undefined,
                      textShadow: ov.shadow ? '0 2px 12px rgba(0,0,0,0.75)' : undefined,
                    }}
                  >
                    <div className="font-semibold leading-tight whitespace-nowrap">{ov.text}</div>
                    {ov.subtext && (
                      <div className="text-[0.65em] opacity-85 mt-0.5 whitespace-nowrap">
                        {ov.subtext}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Title & Action Safe Area Guides */}
          {showSafeGuides && (
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-[5%] border border-dashed border-cyan-400/40" />
              <div className="absolute inset-[10%] border border-dashed border-purple-400/40" />
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/15" />
              <div className="absolute top-1/2 left-0 right-0 h-px bg-white/15" />
            </div>
          )}

          {/* AI-Generated Content Transparency Indicator (only when active clip is AI generated) */}
          {activeVisual?.clip.isAiGenerated && (
            <div className="pointer-events-none absolute top-2.5 left-2.5 px-2 py-0.5 bg-black/75 border border-amber-500/40 text-[11px] text-amber-300 rounded">
              AI-Generated Supporting Asset
            </div>
          )}
        </div>
      </div>

      {/* Transport Controls Footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.07] bg-[#10131A]">
        <div className="font-mono text-xs tabular-nums text-[#C4B5FD] min-w-[110px]">
          {formatTimecode(currentTime, project.settings.fps)}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onTimeChange(0)}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Go to Start (Home)"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onTimeChange(Math.max(0, currentTime - frameStep))}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Previous Frame (Left Arrow)"
          >
            <StepBack className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            className="px-3 py-1.5 rounded bg-[#7C3AED] hover:bg-[#6D28D9] text-white flex items-center gap-1.5 text-xs font-medium transition-colors"
            title="Play / Pause (Space)"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            type="button"
            onClick={() => onTimeChange(Math.min(totalDuration, currentTime + frameStep))}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Next Frame (Right Arrow)"
          >
            <StepForward className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onTimeChange(totalDuration)}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Go to End (End)"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 min-w-[140px] justify-end">
          <button
            type="button"
            onClick={() => setLoop((v) => !v)}
            className={`p-1.5 rounded transition-colors ${
              loop ? 'text-[#93C5FD] bg-[#3B82F6]/15' : 'text-slate-500 hover:text-slate-200'
            }`}
            title="Loop Playback"
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMuted((v) => !v)}
            className={`p-1.5 rounded transition-colors ${
              muted ? 'text-rose-400 bg-rose-500/15' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Mute Monitor"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <span className="font-mono text-xs tabular-nums text-slate-400">
            {formatTimecode(totalDuration, project.settings.fps)}
          </span>
        </div>
      </div>
    </div>
  );
};
