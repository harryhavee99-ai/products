import React from 'react';
import { Sliders, Trash2, Sparkles, Film, Type as TypeIcon, Volume2 } from 'lucide-react';
import type {
  AspectRatioOption,
  EditingPaceMode,
  FrameRateOption,
  ImageMotionPreset,
  MotionOverlay,
  ProductCategoryId,
  ResolutionPreset,
  StudioProject,
  TimelineClip,
} from '../types/studio';
import {
  DURATION_PRESETS,
  FRAME_RATE_OPTIONS,
  PRODUCT_CATEGORIES,
  RESOLUTION_MAP,
  computeDimensionsForAspect,
} from '../data/catalogs';

interface InspectorPanelProps {
  project: StudioProject;
  selectedClip: TimelineClip | null;
  selectedOverlay: MotionOverlay | null;
  onUpdateClip: (clipId: string, patch: Partial<TimelineClip>) => void;
  onDeleteClip: (clipId: string) => void;
  onUpdateOverlay: (overlayId: string, patch: Partial<MotionOverlay>) => void;
  onDeleteOverlay: (overlayId: string) => void;
  onUpdateSettings: (patch: Partial<StudioProject['settings']>) => void;
}

const IMAGE_MOTIONS: Array<{ id: ImageMotionPreset; label: string }> = [
  { id: 'none', label: 'Static' },
  { id: 'slow_zoom_in', label: 'Slow Zoom In' },
  { id: 'slow_zoom_out', label: 'Slow Zoom Out' },
  { id: 'pan_left', label: 'Pan Left' },
  { id: 'pan_right', label: 'Pan Right' },
  { id: 'tilt_up', label: 'Tilt Up' },
  { id: 'tilt_down', label: 'Tilt Down' },
  { id: 'parallax', label: 'Parallax Drift' },
  { id: 'cinematic_reveal', label: 'Cinematic Reveal' },
];

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  project,
  selectedClip,
  selectedOverlay,
  onUpdateClip,
  onDeleteClip,
  onUpdateOverlay,
  onDeleteOverlay,
  onUpdateSettings,
}) => {
  if (selectedClip) {
    return (
      <div className="h-full flex flex-col bg-[#11141C] border-l border-white/[0.08] overflow-y-auto">
        <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {selectedClip.mediaType === 'audio' ? (
              <Volume2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Film className="w-4 h-4 text-[#A855F7] shrink-0" />
            )}
            <h3 className="text-sm font-semibold text-white truncate">{selectedClip.name}</h3>
          </div>
          <button
            type="button"
            onClick={() => onDeleteClip(selectedClip.id)}
            className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            title="Remove clip from timeline"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-5 text-xs">
          {/* Timing & Trim */}
          <section className="space-y-2.5">
            <h4 className="text-slate-300 font-semibold">Clip Timing & Trim</h4>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="space-y-1">
                <span className="text-slate-400">Timeline Start (s)</span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  value={selectedClip.startTime}
                  onChange={(e) => onUpdateClip(selectedClip.id, { startTime: Math.max(0, Number(e.target.value)) })}
                  className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1.5 text-white font-mono tabular-nums"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">Selected Duration (s)</span>
                <input
                  type="number"
                  step={0.1}
                  min={0.2}
                  max={selectedClip.mediaType === 'image' ? 120 : selectedClip.sourceDuration}
                  value={selectedClip.duration}
                  onChange={(e) => {
                    const dur = Math.max(0.2, Number(e.target.value));
                    onUpdateClip(selectedClip.id, {
                      duration: dur,
                      outPoint: Math.round((selectedClip.inPoint + dur) * 1000) / 1000,
                    });
                  }}
                  className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1.5 text-white font-mono tabular-nums"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">In Point (s)</span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  max={Math.max(0, selectedClip.sourceDuration - 0.2)}
                  value={selectedClip.inPoint}
                  onChange={(e) => {
                    const inP = Math.max(0, Number(e.target.value));
                    onUpdateClip(selectedClip.id, {
                      inPoint: inP,
                      outPoint: Math.round((inP + selectedClip.duration) * 1000) / 1000,
                    });
                  }}
                  className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1.5 text-white font-mono tabular-nums"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">Out Point (s)</span>
                <input
                  type="number"
                  step={0.1}
                  min={selectedClip.inPoint + 0.2}
                  value={selectedClip.outPoint}
                  onChange={(e) => {
                    const outP = Math.max(selectedClip.inPoint + 0.2, Number(e.target.value));
                    onUpdateClip(selectedClip.id, {
                      outPoint: outP,
                      duration: Math.round((outP - selectedClip.inPoint) * 1000) / 1000,
                    });
                  }}
                  className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1.5 text-white font-mono tabular-nums"
                />
              </label>
            </div>
            <div className="text-[11px] text-slate-500 font-mono tabular-nums">
              Source duration: {selectedClip.sourceDuration.toFixed(2)}s
            </div>
          </section>

          {/* Video & Image Transform + Speed */}
          {selectedClip.mediaType !== 'audio' && (
            <>
              <section className="space-y-2.5 pt-3 border-t border-white/[0.07]">
                <h4 className="text-slate-300 font-semibold">Motion & Reframe</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-slate-400">
                    <span>Scale</span>
                    <span className="font-mono tabular-nums text-slate-200">{selectedClip.scale}%</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={250}
                    value={selectedClip.scale}
                    onChange={(e) => onUpdateClip(selectedClip.id, { scale: Number(e.target.value) })}
                    className="w-full"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-slate-400">Position X (%)</span>
                      <input
                        type="number"
                        value={selectedClip.positionX}
                        onChange={(e) => onUpdateClip(selectedClip.id, { positionX: Number(e.target.value) })}
                        className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1 text-white font-mono tabular-nums"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-400">Position Y (%)</span>
                      <input
                        type="number"
                        value={selectedClip.positionY}
                        onChange={(e) => onUpdateClip(selectedClip.id, { positionY: Number(e.target.value) })}
                        className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1 text-white font-mono tabular-nums"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-slate-400">Crop Focus X (%)</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={selectedClip.cropFocusX}
                        onChange={(e) => onUpdateClip(selectedClip.id, { cropFocusX: Number(e.target.value) })}
                        className="w-full"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-slate-400">Crop Focus Y (%)</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={selectedClip.cropFocusY}
                        onChange={(e) => onUpdateClip(selectedClip.id, { cropFocusY: Number(e.target.value) })}
                        className="w-full"
                      />
                    </label>
                  </div>

                  <div className="flex justify-between text-slate-400">
                    <span>Opacity</span>
                    <span className="font-mono tabular-nums text-slate-200">{selectedClip.opacity}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={selectedClip.opacity}
                    onChange={(e) => onUpdateClip(selectedClip.id, { opacity: Number(e.target.value) })}
                    className="w-full"
                  />

                  <div className="flex justify-between text-slate-400">
                    <span>Rotation</span>
                    <span className="font-mono tabular-nums text-slate-200">{selectedClip.rotation}°</span>
                  </div>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    value={selectedClip.rotation}
                    onChange={(e) => onUpdateClip(selectedClip.id, { rotation: Number(e.target.value) })}
                    className="w-full"
                  />
                </div>
              </section>

              {selectedClip.mediaType === 'video' ? (
                <section className="space-y-2.5 pt-3 border-t border-white/[0.07]">
                  <h4 className="text-slate-300 font-semibold">Speed & Speed Ramp</h4>
                  <div className="flex justify-between text-slate-400">
                    <span>Playback Speed</span>
                    <span className="font-mono tabular-nums text-slate-200">{selectedClip.speed}x</span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={4}
                    step={0.05}
                    value={selectedClip.speed}
                    onChange={(e) => onUpdateClip(selectedClip.id, { speed: Number(e.target.value) })}
                    className="w-full"
                  />
                  <label className="block space-y-1">
                    <span className="text-slate-400">Speed Ramp Curve</span>
                    <select
                      value={selectedClip.speedRamp ?? 'none'}
                      onChange={(e) =>
                        onUpdateClip(selectedClip.id, {
                          speedRamp: e.target.value as TimelineClip['speedRamp'],
                        })
                      }
                      className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1.5 text-white"
                    >
                      <option value="none">Constant Speed</option>
                      <option value="ramp_in">Ramp In (Slow to Fast)</option>
                      <option value="ramp_out">Ramp Out (Fast to Slow)</option>
                      <option value="pulse">Beat Accent Pulse</option>
                    </select>
                  </label>
                </section>
              ) : (
                <section className="space-y-2.5 pt-3 border-t border-white/[0.07]">
                  <h4 className="text-slate-300 font-semibold">Image-to-Video Animation</h4>
                  <select
                    value={selectedClip.imageMotion}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        imageMotion: e.target.value as ImageMotionPreset,
                      })
                    }
                    className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1.5 text-white"
                  >
                    {IMAGE_MOTIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </section>
              )}

              {/* Transition Controls */}
              {selectedClip.transitionIn && (
                <section className="space-y-2.5 pt-3 border-t border-white/[0.07]">
                  <div className="flex items-center justify-between">
                    <h4 className="text-slate-300 font-semibold">
                      Transition In · {selectedClip.transitionIn.name}
                    </h4>
                    <button
                      type="button"
                      onClick={() => onUpdateClip(selectedClip.id, { transitionIn: undefined })}
                      className="text-rose-400 hover:underline text-[11px]"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Duration</span>
                    <span className="font-mono tabular-nums text-slate-200">
                      {selectedClip.transitionIn.duration.toFixed(2)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.15}
                    max={2.0}
                    step={0.05}
                    value={selectedClip.transitionIn.duration}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        transitionIn: {
                          ...selectedClip.transitionIn!,
                          duration: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full"
                  />
                  <div className="flex justify-between text-slate-400">
                    <span>Intensity</span>
                    <span className="font-mono tabular-nums text-slate-200">
                      {selectedClip.transitionIn.intensity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={selectedClip.transitionIn.intensity}
                    onChange={(e) =>
                      onUpdateClip(selectedClip.id, {
                        transitionIn: {
                          ...selectedClip.transitionIn!,
                          intensity: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full"
                  />
                </section>
              )}
            </>
          )}

          {/* Audio Controls */}
          <section className="space-y-2.5 pt-3 border-t border-white/[0.07]">
            <h4 className="text-slate-300 font-semibold">Audio & Mixing</h4>
            <div className="flex justify-between text-slate-400">
              <span>Volume</span>
              <span className="font-mono tabular-nums text-slate-200">{selectedClip.volume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={200}
              value={selectedClip.volume}
              onChange={(e) => onUpdateClip(selectedClip.id, { volume: Number(e.target.value) })}
              className="w-full"
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="text-slate-400">Fade In (s)</span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  value={selectedClip.fadeIn}
                  onChange={(e) => onUpdateClip(selectedClip.id, { fadeIn: Math.max(0, Number(e.target.value)) })}
                  className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1 text-white font-mono tabular-nums"
                />
              </label>
              <label className="space-y-1">
                <span className="text-slate-400">Fade Out (s)</span>
                <input
                  type="number"
                  step={0.1}
                  min={0}
                  value={selectedClip.fadeOut}
                  onChange={(e) => onUpdateClip(selectedClip.id, { fadeOut: Math.max(0, Number(e.target.value)) })}
                  className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1 text-white font-mono tabular-nums"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-slate-300 pt-1">
              <input
                type="checkbox"
                checked={selectedClip.muted}
                onChange={(e) => onUpdateClip(selectedClip.id, { muted: e.target.checked })}
                className="rounded"
              />
              <span>Mute clip audio</span>
            </label>
            {selectedClip.mediaType === 'audio' && (
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={selectedClip.duckOnVoiceover}
                  onChange={(e) => onUpdateClip(selectedClip.id, { duckOnVoiceover: e.target.checked })}
                  className="rounded"
                />
                <span>Auto-duck music when voiceover speaks</span>
              </label>
            )}
          </section>
        </div>
      </div>
    );
  }

  if (selectedOverlay) {
    return (
      <div className="h-full flex flex-col bg-[#11141C] border-l border-white/[0.08] overflow-y-auto">
        <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <TypeIcon className="w-4 h-4 text-[#A855F7] shrink-0" />
            <h3 className="text-sm font-semibold text-white truncate">Motion Graphic Inspector</h3>
          </div>
          <button
            type="button"
            onClick={() => onDeleteOverlay(selectedOverlay.id)}
            className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
            title="Delete overlay"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          <label className="block space-y-1">
            <span className="text-slate-400">Primary Text (user-approved copy only)</span>
            <input
              type="text"
              value={selectedOverlay.text}
              onChange={(e) => onUpdateOverlay(selectedOverlay.id, { text: e.target.value })}
              className="w-full bg-[#181C26] border border-white/10 rounded px-2.5 py-1.5 text-white"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-slate-400">Secondary Line / Subtitle</span>
            <input
              type="text"
              value={selectedOverlay.subtext ?? ''}
              onChange={(e) => onUpdateOverlay(selectedOverlay.id, { subtext: e.target.value })}
              className="w-full bg-[#181C26] border border-white/10 rounded px-2.5 py-1.5 text-white"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-slate-400">Start (s)</span>
              <input
                type="number"
                step={0.1}
                min={0}
                value={selectedOverlay.startTime}
                onChange={(e) => onUpdateOverlay(selectedOverlay.id, { startTime: Math.max(0, Number(e.target.value)) })}
                className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1.5 text-white font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-400">Duration (s)</span>
              <input
                type="number"
                step={0.1}
                min={0.3}
                value={selectedOverlay.duration}
                onChange={(e) => onUpdateOverlay(selectedOverlay.id, { duration: Math.max(0.3, Number(e.target.value)) })}
                className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1.5 text-white font-mono tabular-nums"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-slate-400">X Position (%)</span>
              <input
                type="range"
                min={5}
                max={95}
                value={selectedOverlay.x}
                onChange={(e) => onUpdateOverlay(selectedOverlay.id, { x: Number(e.target.value) })}
                className="w-full"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-400">Y Position (%)</span>
              <input
                type="range"
                min={5}
                max={95}
                value={selectedOverlay.y}
                onChange={(e) => onUpdateOverlay(selectedOverlay.id, { y: Number(e.target.value) })}
                className="w-full"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-slate-400">Font Family</span>
              <select
                value={selectedOverlay.fontFamily}
                onChange={(e) => onUpdateOverlay(selectedOverlay.id, { fontFamily: e.target.value })}
                className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1.5 text-white"
              >
                <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                <option value="DM Sans">DM Sans</option>
                <option value="JetBrains Mono">JetBrains Mono</option>
                <option value="Georgia, serif">Editorial Serif</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-slate-400">Font Size</span>
              <input
                type="number"
                min={14}
                max={140}
                value={selectedOverlay.fontSize}
                onChange={(e) => onUpdateOverlay(selectedOverlay.id, { fontSize: Number(e.target.value) })}
                className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1.5 text-white font-mono tabular-nums"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-slate-400">Text Color</span>
              <input
                type="color"
                value={selectedOverlay.color}
                onChange={(e) => onUpdateOverlay(selectedOverlay.id, { color: e.target.value })}
                className="w-full h-8 bg-[#181C26] border border-white/10 rounded cursor-pointer"
              />
            </label>
            <label className="space-y-1">
              <span className="text-slate-400">Background</span>
              <input
                type="color"
                value={selectedOverlay.backgroundColor}
                onChange={(e) => onUpdateOverlay(selectedOverlay.id, { backgroundColor: e.target.value })}
                className="w-full h-8 bg-[#181C26] border border-white/10 rounded cursor-pointer"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="text-slate-400">Animation</span>
            <select
              value={selectedOverlay.animation}
              onChange={(e) =>
                onUpdateOverlay(selectedOverlay.id, {
                  animation: e.target.value as MotionOverlay['animation'],
                })
              }
              className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1.5 text-white"
            >
              <option value="fade">Clean Fade</option>
              <option value="slide_up">Slide Up</option>
              <option value="slide_left">Slide Left</option>
              <option value="scale_pop">Scale Pop</option>
              <option value="reveal_mask">Mask Reveal</option>
              <option value="cinematic_track">Cinematic Tracking</option>
              <option value="none">None</option>
            </select>
          </label>
          <div className="space-y-1">
            <div className="flex justify-between text-slate-400">
              <span>Background Opacity</span>
              <span className="font-mono tabular-nums">{Math.round(selectedOverlay.backgroundOpacity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={selectedOverlay.backgroundOpacity}
              onChange={(e) => onUpdateOverlay(selectedOverlay.id, { backgroundOpacity: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <label className="flex items-center gap-2 text-slate-300">
            <input
              type="checkbox"
              checked={selectedOverlay.shadow}
              onChange={(e) => onUpdateOverlay(selectedOverlay.id, { shadow: e.target.checked })}
            />
            <span>Drop Shadow</span>
          </label>
        </div>
      </div>
    );
  }

  // Default: Sequence & Project Settings Inspector
  return (
    <div className="h-full flex flex-col bg-[#11141C] border-l border-white/[0.08] overflow-y-auto">
      <div className="px-4 py-3 border-b border-white/[0.07] flex items-center gap-2">
        <Sliders className="w-4 h-4 text-[#3B82F6]" />
        <h3 className="text-sm font-semibold text-white">Sequence Inspector</h3>
      </div>

      <div className="p-4 space-y-4 text-xs">
        <p className="text-slate-400 leading-relaxed">
          Select any clip or motion graphic on the timeline to edit transform, speed, trim, or transitions. Below are active sequence settings.
        </p>

        <label className="block space-y-1">
          <span className="text-slate-400">Product Category</span>
          <select
            value={project.settings.productCategory}
            onChange={(e) =>
              onUpdateSettings({ productCategory: e.target.value as ProductCategoryId })
            }
            className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1.5 text-white"
          >
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-slate-400">Resolution</span>
            <select
              value={project.settings.resolution}
              onChange={(e) => {
                const res = e.target.value as ResolutionPreset;
                const dims = computeDimensionsForAspect(res, project.settings.aspectRatio);
                onUpdateSettings({ resolution: res, width: dims.width, height: dims.height });
              }}
              className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1.5 text-white"
            >
              {Object.entries(RESOLUTION_MAP).map(([id, meta]) => (
                <option key={id} value={id}>
                  {meta.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-slate-400">Frame Rate</span>
            <select
              value={project.settings.fps}
              onChange={(e) =>
                onUpdateSettings({ fps: Number(e.target.value) as FrameRateOption })
              }
              className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1.5 text-white font-mono"
            >
              {FRAME_RATE_OPTIONS.map((fps) => (
                <option key={fps} value={fps}>
                  {fps} fps
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className="text-slate-400">Aspect Ratio</span>
            <select
              value={project.settings.aspectRatio}
              onChange={(e) => {
                const ar = e.target.value as AspectRatioOption;
                const dims = computeDimensionsForAspect(project.settings.resolution, ar);
                onUpdateSettings({ aspectRatio: ar, width: dims.width, height: dims.height });
              }}
              className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1.5 text-white"
            >
              <option value="16:9">16:9 Landscape</option>
              <option value="9:16">9:16 Vertical</option>
              <option value="1:1">1:1 Square</option>
              <option value="4:5">4:5 Portrait</option>
              <option value="4:3">4:3 Traditional</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-slate-400">Editing Pace</span>
            <select
              value={project.settings.editingStyle}
              onChange={(e) =>
                onUpdateSettings({ editingStyle: e.target.value as EditingPaceMode })
              }
              className="w-full bg-[#181C26] border border-white/10 rounded px-2 py-1.5 text-white"
            >
              <option value="fast">Fast-Paced</option>
              <option value="normal">Normal-Paced</option>
              <option value="slow">Slow-Paced Luxury</option>
              <option value="custom">Custom Pace</option>
            </select>
          </label>
        </div>

        <div className="space-y-1.5">
          <span className="text-slate-400">Target Commercial Duration</span>
          <div className="flex flex-wrap gap-1">
            {DURATION_PRESETS.slice(0, 8).map((d) => (
              <button
                key={d.seconds}
                type="button"
                onClick={() => onUpdateSettings({ targetDuration: d.seconds })}
                className={`px-2 py-1 rounded font-mono text-[11px] tabular-nums transition-colors ${
                  project.settings.targetDuration === d.seconds
                    ? 'bg-[#7C3AED] text-white'
                    : 'bg-[#181C26] text-slate-400 hover:text-white'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {project.productAnalysis && (
          <div className="pt-3 border-t border-white/[0.07] space-y-1.5">
            <div className="flex items-center gap-1.5 text-[#C4B5FD] font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AI Product Identity Summary</span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              {project.productAnalysis.productIdentity}
            </p>
            <p className="text-[11px] text-slate-500">
              {project.productAnalysis.fidelityConfirmation}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
