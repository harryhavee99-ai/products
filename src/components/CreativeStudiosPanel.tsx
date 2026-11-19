import React, { useRef, useState } from 'react';
import { Palette, Plus, RotateCcw, Save, Sparkles, Type as TypeIcon, Upload } from 'lucide-react';
import type {
  ClipTransition,
  ColorGradingSettings,
  CustomColorPreset,
  MotionOverlay,
  OverlayElementType,
  StudioProject,
  TransitionCategory,
} from '../types/studio';
import {
  COLOR_LOOK_PRESETS,
  DEFAULT_COLOR_GRADING,
  TRANSITIONS_CATALOG,
} from '../data/catalogs';
import { parseCubeLutPreview, studioApi } from '../services/api';

interface CreativeStudiosPanelProps {
  mode: 'transitions' | 'motion' | 'color';
  project: StudioProject;
  currentTime: number;
  selectedClipId: string | null;
  colorPresets: CustomColorPreset[];
  onApplyTransitionToSelected: (transition: ClipTransition) => void;
  onApplyTransitionToAllCuts: (transition: ClipTransition) => void;
  onAddOverlay: (overlay: MotionOverlay) => void;
  onUpdateColorGrading: (next: ColorGradingSettings) => void;
  onColorPresetsUpdated: (presets: CustomColorPreset[]) => void;
}

const OVERLAY_TEMPLATES: Array<{
  type: OverlayElementType;
  label: string;
  defaultText: string;
  defaultSubtext?: string;
  y: number;
  fontSize: number;
  bgOpacity: number;
  bgColor: string;
}> = [
  { type: 'product_title', label: 'Product Title', defaultText: '', y: 78, fontSize: 52, bgOpacity: 0, bgColor: '#000000' },
  { type: 'price_tag', label: 'Price Tag', defaultText: '$0.00', defaultSubtext: 'Enter verified price', y: 20, fontSize: 34, bgOpacity: 0.8, bgColor: '#111827' },
  { type: 'discount_label', label: 'Discount Label', defaultText: 'Enter Offer', y: 18, fontSize: 28, bgOpacity: 0.9, bgColor: '#7C3AED' },
  { type: 'sale_badge', label: 'Sale Badge', defaultText: 'Limited Offer', y: 18, fontSize: 26, bgOpacity: 0.9, bgColor: '#2563EB' },
  { type: 'new_arrival', label: 'New Arrival', defaultText: 'New Collection', y: 16, fontSize: 26, bgOpacity: 0.75, bgColor: '#0F172A' },
  { type: 'feature_callout', label: 'Feature Callout', defaultText: 'Enter verified product feature', y: 65, fontSize: 30, bgOpacity: 0.7, bgColor: '#090D16' },
  { type: 'product_spec', label: 'Product Spec', defaultText: 'Material / Spec', defaultSubtext: 'User-verified detail', y: 72, fontSize: 28, bgOpacity: 0.75, bgColor: '#11141C' },
  { type: 'lower_third', label: 'Lower Third', defaultText: '', defaultSubtext: '', y: 84, fontSize: 32, bgOpacity: 0.78, bgColor: '#0C0F16' },
  { type: 'cta_banner', label: 'CTA End Card', defaultText: 'Shop Now', defaultSubtext: 'yourbrand.com', y: 50, fontSize: 44, bgOpacity: 0.85, bgColor: '#7C3AED' },
  { type: 'social_handle', label: 'Social Handle', defaultText: '@yourbrand', y: 90, fontSize: 24, bgOpacity: 0.5, bgColor: '#000000' },
  { type: 'brand_logo', label: 'Brand Logo', defaultText: 'Brand Logo', y: 14, fontSize: 32, bgOpacity: 0, bgColor: '#000000' },
  { type: 'animated_line', label: 'Accent Divider Line', defaultText: 'Divider', y: 82, fontSize: 24, bgOpacity: 0, bgColor: '#000000' },
];

export const CreativeStudiosPanel: React.FC<CreativeStudiosPanelProps> = ({
  mode,
  project,
  currentTime,
  selectedClipId,
  colorPresets,
  onApplyTransitionToSelected,
  onApplyTransitionToAllCuts,
  onAddOverlay,
  onUpdateColorGrading,
  onColorPresetsUpdated,
}) => {
  // Transitions state
  const [transCategory, setTransCategory] = useState<TransitionCategory | 'all'>('all');
  const [transDuration, setTransDuration] = useState(0.5);
  const [transIntensity, setTransIntensity] = useState(70);
  const [previewingTransId, setPreviewingTransId] = useState<string | null>(null);

  // Motion Graphics state
  const [selectedOvType, setSelectedOvType] = useState<OverlayElementType>('product_title');
  const [ovText, setOvText] = useState(project.settings.productName || project.settings.projectName || '');
  const [ovSubtext, setOvSubtext] = useState(project.settings.brandName || '');
  const [ovAnimation, setOvAnimation] = useState<MotionOverlay['animation']>('slide_up');
  const [ovColor, setOvColor] = useState('#FFFFFF');
  const [ovLogoId, setOvLogoId] = useState<string>('');

  // Color Grading state
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);
  const lutInputRef = useRef<HTMLInputElement | null>(null);

  if (mode === 'transitions') {
    const filtered = TRANSITIONS_CATALOG.filter((t) =>
      transCategory === 'all' ? true : t.category === transCategory
    );

    const makeTransition = (item: (typeof TRANSITIONS_CATALOG)[number]): ClipTransition => ({
      id: item.id,
      name: item.name,
      category: item.category,
      duration: transDuration,
      direction: 'left',
      intensity: transIntensity,
      timing: 'ease-in-out',
    });

    return (
      <div className="h-full overflow-y-auto p-3.5 space-y-3.5 text-xs">
        <div>
          <h3 className="text-sm font-semibold text-white">Transitions Library</h3>
          <p className="text-slate-400 mt-0.5">
            Preview transitions and apply them to your selected clip or across all timeline cuts.
          </p>
        </div>

        <div className="flex flex-wrap gap-1">
          {(['all', 'smooth', 'dynamic', 'creative', 'premium'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setTransCategory(cat)}
              className={`px-2 py-1 rounded text-[11px] capitalize transition-colors ${
                transCategory === cat
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-[#181C26] text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-[#151923] border border-white/[0.07]">
          <label className="space-y-1">
            <span className="text-[11px] text-slate-400">Duration: {transDuration.toFixed(2)}s</span>
            <input
              type="range"
              min={0.15}
              max={1.5}
              step={0.05}
              value={transDuration}
              onChange={(e) => setTransDuration(Number(e.target.value))}
              className="w-full"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-slate-400">Intensity: {transIntensity}%</span>
            <input
              type="range"
              min={20}
              max={100}
              value={transIntensity}
              onChange={(e) => setTransIntensity(Number(e.target.value))}
              className="w-full"
            />
          </label>
        </div>

        <div className="space-y-2">
          {filtered.map((item) => {
            const isPrev = previewingTransId === item.id;
            return (
              <div
                key={item.id}
                onMouseEnter={() => setPreviewingTransId(item.id)}
                onMouseLeave={() => setPreviewingTransId(null)}
                className="p-2.5 rounded-lg bg-[#151923] border border-white/[0.07] hover:border-white/20 space-y-2 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-slate-100 font-medium">{item.name}</div>
                    <div className="text-[11px] text-slate-400">{item.description}</div>
                  </div>
                  <div className="w-14 h-8 rounded bg-[#0C0F16] border border-white/10 overflow-hidden relative shrink-0">
                    <div
                      className="absolute inset-0 bg-gradient-to-r from-[#7C3AED]/70 to-[#3B82F6]/70 transition-all duration-500"
                      style={{
                        opacity: isPrev ? 0.95 : 0.35,
                        transform: isPrev
                          ? item.category === 'dynamic'
                            ? 'translateX(0%) scale(1.12)'
                            : 'scale(1.04)'
                          : 'translateX(-45%) scale(1)',
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[10px] text-slate-500">
                    {item.premiereNative ? 'Premiere XML native' : 'XML + Manifest'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!selectedClipId}
                      onClick={() => onApplyTransitionToSelected(makeTransition(item))}
                      className="px-2 py-1 rounded bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 text-white text-[11px]"
                    >
                      Apply Selected
                    </button>
                    <button
                      type="button"
                      onClick={() => onApplyTransitionToAllCuts(makeTransition(item))}
                      className="px-2 py-1 rounded bg-white/[0.07] hover:bg-white/[0.14] text-slate-200 text-[11px]"
                    >
                      All Cuts
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (mode === 'motion') {
    const logoAssets = project.assets.filter((a) => a.mediaType === 'image');
    const chosenTpl = OVERLAY_TEMPLATES.find((t) => t.type === selectedOvType) ?? OVERLAY_TEMPLATES[0];

    const handleAddGraphic = () => {
      const textVal =
        selectedOvType === 'brand_logo'
          ? project.settings.brandName || 'Brand Logo'
          : ovText.trim() || chosenTpl.defaultText || project.settings.productName || 'Product Title';
      const newOv: MotionOverlay = {
        id: `ov_${Date.now()}`,
        trackId: 'gfx1',
        type: selectedOvType,
        text: textVal,
        subtext: ovSubtext.trim() || undefined,
        logoAssetId: selectedOvType === 'brand_logo' ? ovLogoId || logoAssets[0]?.id : undefined,
        startTime: Math.round(currentTime * 100) / 100,
        duration: 3.5,
        x: 50,
        y: chosenTpl.y,
        fontFamily: 'Plus Jakarta Sans',
        fontSize: chosenTpl.fontSize,
        color: ovColor,
        backgroundColor: chosenTpl.bgColor,
        backgroundOpacity: chosenTpl.bgOpacity,
        strokeColor: '#000000',
        strokeWidth: selectedOvType === 'animated_line' ? 3 : 0,
        shadow: true,
        opacity: 100,
        animation: ovAnimation,
      };
      onAddOverlay(newOv);
    };

    return (
      <div className="h-full overflow-y-auto p-3.5 space-y-4 text-xs">
        <div>
          <h3 className="text-sm font-semibold text-white">Motion Graphics & Advertising Elements</h3>
          <p className="text-slate-400 mt-0.5 leading-relaxed">
            Add animated titles, user-verified price tags, feature callouts, brand logos, and CTAs. Only displays exact copy you approve.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {OVERLAY_TEMPLATES.map((tpl) => (
            <button
              key={tpl.type}
              type="button"
              onClick={() => {
                setSelectedOvType(tpl.type);
                if (tpl.defaultText) setOvText(tpl.defaultText);
                else if (project.settings.productName) setOvText(project.settings.productName);
                if (tpl.defaultSubtext !== undefined) setOvSubtext(tpl.defaultSubtext);
              }}
              className={`px-2.5 py-2 rounded-lg border text-left transition-colors ${
                selectedOvType === tpl.type
                  ? 'bg-[#7C3AED]/20 border-[#7C3AED] text-white'
                  : 'bg-[#151923] border-white/[0.07] text-slate-300 hover:border-white/20'
              }`}
            >
              <div className="font-medium truncate">{tpl.label}</div>
            </button>
          ))}
        </div>

        <div className="p-3 rounded-lg bg-[#151923] border border-white/[0.08] space-y-2.5">
          {selectedOvType === 'brand_logo' ? (
            <label className="block space-y-1">
              <span className="text-slate-400">Select Imported Logo / Image Asset</span>
              <select
                value={ovLogoId || logoAssets[0]?.id || ''}
                onChange={(e) => setOvLogoId(e.target.value)}
                className="w-full bg-[#1C212E] border border-white/10 rounded px-2 py-1.5 text-white"
              >
                {logoAssets.length === 0 ? (
                  <option value="">Import a PNG/SVG logo first</option>
                ) : (
                  logoAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : (
            <>
              <label className="block space-y-1">
                <span className="text-slate-400">Display Text</span>
                <input
                  type="text"
                  value={ovText}
                  onChange={(e) => setOvText(e.target.value)}
                  placeholder="Enter exact product name, offer, or CTA"
                  className="w-full bg-[#1C212E] border border-white/10 rounded px-2.5 py-1.5 text-white"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-slate-400">Subtext (optional)</span>
                <input
                  type="text"
                  value={ovSubtext}
                  onChange={(e) => setOvSubtext(e.target.value)}
                  placeholder="Optional brand tagline or URL"
                  className="w-full bg-[#1C212E] border border-white/10 rounded px-2.5 py-1.5 text-white"
                />
              </label>
            </>
          )}

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-slate-400">Animation</span>
              <select
                value={ovAnimation}
                onChange={(e) => setOvAnimation(e.target.value as MotionOverlay['animation'])}
                className="w-full bg-[#1C212E] border border-white/10 rounded px-2 py-1.5 text-white"
              >
                <option value="slide_up">Slide Up</option>
                <option value="fade">Smooth Fade</option>
                <option value="scale_pop">Scale Pop</option>
                <option value="slide_left">Slide Left</option>
                <option value="reveal_mask">Mask Reveal</option>
                <option value="cinematic_track">Cinematic Track</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-slate-400">Color</span>
              <input
                type="color"
                value={ovColor}
                onChange={(e) => setOvColor(e.target.value)}
                className="w-full h-8 bg-[#1C212E] border border-white/10 rounded cursor-pointer"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={handleAddGraphic}
            className="w-full py-2 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add at Playhead ({currentTime.toFixed(1)}s)</span>
          </button>
        </div>
      </div>
    );
  }

  // Color Grading Studio
  const cg = project.colorGrading;

  const updateCg = (patch: Partial<ColorGradingSettings>) => {
    const nextLook =
      patch.lookPreset !== undefined
        ? patch.lookPreset
        : cg.lookPreset === 'none'
          ? 'custom'
          : cg.lookPreset;
    onUpdateColorGrading({ ...cg, ...patch, lookPreset: nextLook });
  };

  const handleCubeUpload = async (file: File) => {
    const text = await file.text();
    const parsed = parseCubeLutPreview(text);
    onUpdateColorGrading({
      ...cg,
      lookPreset: 'custom',
      lutName: `${parsed.title} (${file.name})`,
      lutCubeData: text.slice(0, 65000),
      temperature: parsed.estimatedTemp,
      contrast: parsed.estimatedContrast,
      saturation: parsed.estimatedSaturation,
    });
  };

  const handleSaveCustomPreset = async () => {
    if (!presetName.trim()) return;
    setSavingPreset(true);
    try {
      const updated = await studioApi.saveColorPreset(presetName.trim(), cg);
      onColorPresetsUpdated(updated);
      setPresetName('');
    } finally {
      setSavingPreset(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto p-3.5 space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Color Grading Studio</h3>
          <p className="text-slate-400 text-[11px]">
            {cg.lookPreset === 'none'
              ? 'Bypassed — original untouched source colors'
              : 'Live preview + FFmpeg render & Premiere manifest'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onUpdateColorGrading({ ...DEFAULT_COLOR_GRADING, lookPreset: 'none' })}
          className="px-2 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 flex items-center gap-1"
          title="Remove color grading and restore original footage"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Professional Commercial Looks */}
      <div className="space-y-1.5">
        <div className="text-slate-300 font-medium">Commercial Color Looks</div>
        <div className="grid grid-cols-2 gap-1.5">
          {COLOR_LOOK_PRESETS.map((look) => (
            <button
              key={look.id}
              type="button"
              onClick={() =>
                onUpdateColorGrading({
                  ...DEFAULT_COLOR_GRADING,
                  ...look.values,
                  lookPreset: look.id,
                })
              }
              className={`p-2 rounded-lg border text-left transition-colors ${
                cg.lookPreset === look.id
                  ? 'bg-[#7C3AED]/20 border-[#7C3AED] text-white'
                  : 'bg-[#151923] border-white/[0.07] text-slate-300 hover:border-white/20'
              }`}
            >
              <div className="font-medium truncate">{look.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* .cube 3D LUT Import */}
      <div className="p-2.5 rounded-lg bg-[#151923] border border-white/[0.07] space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-slate-200 font-medium">3D LUT (.cube)</span>
          <button
            type="button"
            onClick={() => lutInputRef.current?.click()}
            className="px-2 py-1 rounded bg-[#3B82F6]/20 hover:bg-[#3B82F6]/30 text-[#93C5FD] flex items-center gap-1"
          >
            <Upload className="w-3 h-3" />
            <span>Import .cube</span>
          </button>
          <input
            ref={lutInputRef}
            type="file"
            accept=".cube"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleCubeUpload(f);
              e.target.value = '';
            }}
            className="hidden"
          />
        </div>
        {cg.lutName && (
          <div className="flex items-center justify-between text-[11px] text-emerald-300">
            <span className="truncate">Active: {cg.lutName}</span>
            <button
              type="button"
              onClick={() => updateCg({ lutName: undefined, lutCubeData: undefined })}
              className="text-rose-400 hover:underline ml-2"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Basic Correction Sliders */}
      <div className="space-y-2 pt-2 border-t border-white/[0.07]">
        <div className="text-slate-200 font-medium">Basic Correction</div>
        {(
          [
            ['exposure', 'Exposure', -2, 2, 0.05],
            ['contrast', 'Contrast', -100, 100, 1],
            ['highlights', 'Highlights', -100, 100, 1],
            ['shadows', 'Shadows', -100, 100, 1],
            ['whites', 'Whites', -100, 100, 1],
            ['blacks', 'Blacks', -100, 100, 1],
            ['temperature', 'Temperature', -100, 100, 1],
            ['tint', 'Tint', -100, 100, 1],
            ['saturation', 'Saturation', -100, 100, 1],
            ['vibrance', 'Vibrance', -100, 100, 1],
          ] as const
        ).map(([key, label, min, max, step]) => (
          <div key={key} className="space-y-0.5">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>{label}</span>
              <span className="font-mono tabular-nums text-slate-200">{cg[key]}</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={cg[key]}
              onChange={(e) => updateCg({ [key]: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        ))}
      </div>

      {/* Advanced Finishing: Hue, Vignette, Sharpen, Lift/Gamma/Gain */}
      <div className="space-y-2 pt-2 border-t border-white/[0.07]">
        <div className="text-slate-200 font-medium">Advanced Grading & Finishing</div>
        {(
          [
            ['hueShift', 'Hue Shift (°)', -180, 180, 1],
            ['vignette', 'Vignette', 0, 100, 1],
            ['sharpen', 'Sharpening', 0, 100, 1],
          ] as const
        ).map(([key, label, min, max, step]) => (
          <div key={key} className="space-y-0.5">
            <div className="flex justify-between text-[11px] text-slate-400">
              <span>{label}</span>
              <span className="font-mono tabular-nums text-slate-200">{cg[key]}</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={cg[key]}
              onChange={(e) => updateCg({ [key]: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        ))}

        {/* Lift / Gamma / Gain Red-Blue Balance */}
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {(['lift', 'gamma', 'gain'] as const).map((wheel) => (
            <div key={wheel} className="p-2 rounded bg-[#151923] border border-white/[0.06] space-y-1">
              <div className="text-[10px] capitalize text-slate-300 font-medium">{wheel}</div>
              {(['r', 'g', 'b'] as const).map((ch) => (
                <div key={ch} className="flex items-center gap-1">
                  <span className="text-[9px] font-mono uppercase text-slate-500 w-3">{ch}</span>
                  <input
                    type="range"
                    min={-50}
                    max={50}
                    value={cg[wheel][ch]}
                    onChange={(e) =>
                      updateCg({
                        [wheel]: { ...cg[wheel], [ch]: Number(e.target.value) },
                      })
                    }
                    className="flex-1 h-1"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Save & Load Custom Color Presets */}
      <div className="space-y-2 pt-2 border-t border-white/[0.07]">
        <div className="text-slate-200 font-medium">Custom Color Presets</div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Preset name..."
            className="flex-1 bg-[#181C26] border border-white/10 rounded px-2 py-1 text-white"
          />
          <button
            type="button"
            disabled={savingPreset || !presetName.trim()}
            onClick={handleSaveCustomPreset}
            className="px-2.5 py-1 rounded bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-40 text-white flex items-center gap-1"
          >
            <Save className="w-3 h-3" />
            <span>Save</span>
          </button>
        </div>
        {colorPresets.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {colorPresets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onUpdateColorGrading({ ...p.settings })}
                className="px-2 py-1 rounded bg-[#181C26] hover:bg-white/[0.1] border border-white/10 text-slate-200 text-[11px]"
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
