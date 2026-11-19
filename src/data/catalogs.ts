import type {
  AspectRatioOption,
  ColorGradingSettings,
  CustomPaceSettings,
  EditingPaceMode,
  FrameRateOption,
  ProductCategoryId,
  ProjectSettings,
  ResolutionPreset,
  TimelineTrack,
  TransitionCategory,
} from '../types/studio';

export interface ProductCategoryMeta {
  id: ProductCategoryId;
  label: string;
  group: 'Fashion' | 'Beauty' | 'Food & Grocery' | 'Tech' | 'Luxury' | 'Home & Lifestyle';
  recommendedPace: EditingPaceMode;
  recommendedColorLook: string;
  recommendedMusicStyle: string;
  recommendedTransitions: string[];
  recommendedDuration: number;
  cinematographyGuidance: string;
  keyShotTypes: string[];
}

export const PRODUCT_CATEGORIES: ProductCategoryMeta[] = [
  {
    id: 'clothing_fashion',
    label: 'Clothing & Fashion',
    group: 'Fashion',
    recommendedPace: 'fast',
    recommendedColorLook: 'fashion_editorial',
    recommendedMusicStyle: 'Runway House / Electronic Editorial',
    recommendedTransitions: ['whip_pan', 'swipe', 'cross_dissolve'],
    recommendedDuration: 20,
    cinematographyGuidance: 'Fashion transitions, model-focused framing, fabric texture close-ups, editorial typography, and rhythmic cuts on downbeats.',
    keyShotTypes: ['Full-body silhouette', 'Fabric weave macro', 'Movement drape', 'Logo tag reveal'],
  },
  {
    id: 'shoes_sneakers',
    label: 'Shoes & Sneakers',
    group: 'Fashion',
    recommendedPace: 'fast',
    recommendedColorLook: 'high_contrast',
    recommendedMusicStyle: 'Trap / Bass-Heavy Streetwear Beat',
    recommendedTransitions: ['zoom_transition', 'whip_pan', 'flash'],
    recommendedDuration: 15,
    cinematographyGuidance: 'Low-angle hero reveals, sole & stitching macro cuts, speed ramps on drops, punchy zoom transitions.',
    keyShotTypes: ['Profile silhouette', 'Tread & midsole macro', 'Lace-up action', 'Drop impact hero'],
  },
  {
    id: 'beauty_cosmetics',
    label: 'Beauty & Cosmetics',
    group: 'Beauty',
    recommendedPace: 'normal',
    recommendedColorLook: 'soft_beauty',
    recommendedMusicStyle: 'Modern Glossy Pop / Ambient Groove',
    recommendedTransitions: ['soft_focus_reveal', 'light_fade', 'smooth_blur'],
    recommendedDuration: 20,
    cinematographyGuidance: 'Macro pigment/applicator shots, clean high-key lighting, soft motion graphics, silk-smooth transitions, luminous skin tones.',
    keyShotTypes: ['Texture swatch macro', 'Packaging hero', 'Application close-up', 'End-card line-up'],
  },
  {
    id: 'skincare',
    label: 'Skincare Products',
    group: 'Beauty',
    recommendedPace: 'slow',
    recommendedColorLook: 'soft_beauty',
    recommendedMusicStyle: 'Minimal Acoustic / Organic Electronic',
    recommendedTransitions: ['elegant_reveal', 'cross_dissolve', 'light_fade'],
    recommendedDuration: 30,
    cinematographyGuidance: 'Dewy droplet macro shots, natural daylight clarity, calm unhurried pacing, clean ingredient callouts.',
    keyShotTypes: ['Serum drop macro', 'Glass bottle rim light', 'Skin absorption', 'Clean packshot'],
  },
  {
    id: 'perfumes_fragrances',
    label: 'Perfumes & Fragrances',
    group: 'Luxury',
    recommendedPace: 'slow',
    recommendedColorLook: 'luxury_cinematic',
    recommendedMusicStyle: 'Cinematic Strings / Deep Atmospheric Synth',
    recommendedTransitions: ['luxury_fade', 'cinematic_zoom', 'dip_to_black'],
    recommendedDuration: 30,
    cinematographyGuidance: 'Dramatic chiaroscuro lighting, slow-motion mist & glass reflections, sculptural camera glides, refined serif titles.',
    keyShotTypes: ['Mist spray slow-motion', 'Glass caustic reflection', 'Cap & engraving detail', 'Hero silhouette'],
  },
  {
    id: 'grocery',
    label: 'Grocery Products',
    group: 'Food & Grocery',
    recommendedPace: 'fast',
    recommendedColorLook: 'vibrant_grocery',
    recommendedMusicStyle: 'Upbeat Indie Pop / Crisp Percussion',
    recommendedTransitions: ['swipe', 'push', 'zoom_transition'],
    recommendedDuration: 15,
    cinematographyGuidance: 'Fresh vibrant color balance, energetic beat cuts, clear packaging legibility, crisp product highlights.',
    keyShotTypes: ['Fresh ingredients splash', 'Pack front hero', 'Pour / serve motion', 'Shelf callout'],
  },
  {
    id: 'food_beverages',
    label: 'Food & Beverages',
    group: 'Food & Grocery',
    recommendedPace: 'normal',
    recommendedColorLook: 'warm_lifestyle',
    recommendedMusicStyle: 'Funky Soul / Energetic Acoustic',
    recommendedTransitions: ['zoom_transition', 'smooth_product_showcase', 'cross_dissolve'],
    recommendedDuration: 20,
    cinematographyGuidance: 'Appetizing macro texture shots, steam/condensation close-ups, speed ramps on pours, fluid camera motion.',
    keyShotTypes: ['Pour / fizz macro', 'Condensation close-up', 'Bite / garnish hero', 'Chilled bottle reveal'],
  },
  {
    id: 'electronics',
    label: 'Electronics',
    group: 'Tech',
    recommendedPace: 'fast',
    recommendedColorLook: 'cool_modern',
    recommendedMusicStyle: 'Futuristic Tech Pulse / Minimal Bass',
    recommendedTransitions: ['mask_reveal', 'zoom_transition', 'motion_blur'],
    recommendedDuration: 30,
    cinematographyGuidance: 'Precision razor cuts, industrial bevel macro shots, sleek geometric callouts, metallic specular contrast.',
    keyShotTypes: ['Edge & chamfer macro', 'Screen / LED wake', '360 turntable orbit', 'Spec callout hero'],
  },
  {
    id: 'mobile_accessories',
    label: 'Mobile Accessories',
    group: 'Tech',
    recommendedPace: 'fast',
    recommendedColorLook: 'clean_commercial',
    recommendedMusicStyle: 'Crisp Modern Electronic',
    recommendedTransitions: ['whip_pan', 'slide', 'zoom_transition'],
    recommendedDuration: 15,
    cinematographyGuidance: 'Snap-on magnetic action cuts, port/fit precision close-ups, bold clean feature callouts.',
    keyShotTypes: ['Snap-fit demonstration', 'Material grip close-up', 'Everyday carry shot', 'Colorway lineup'],
  },
  {
    id: 'jewellery_watches',
    label: 'Jewellery & Watches',
    group: 'Luxury',
    recommendedPace: 'slow',
    recommendedColorLook: 'luxury_cinematic',
    recommendedMusicStyle: 'Orchestral Minimal / Luxury Ambient',
    recommendedTransitions: ['luxury_fade', 'soft_focus_reveal', 'cinematic_zoom'],
    recommendedDuration: 30,
    cinematographyGuidance: 'Slow macro camera arcs, controlled facet glints, dramatic dark studio contrast, understated luxury titles.',
    keyShotTypes: ['Dial / gemstone macro', 'Clasp & bracelet detail', 'Wrist editorial glide', 'Hero dark-key reveal'],
  },
  {
    id: 'bags_accessories',
    label: 'Bags & Accessories',
    group: 'Fashion',
    recommendedPace: 'normal',
    recommendedColorLook: 'fashion_editorial',
    recommendedMusicStyle: 'Chic Downtempo / Editorial Lounge',
    recommendedTransitions: ['elegant_reveal', 'slide', 'cross_dissolve'],
    recommendedDuration: 20,
    cinematographyGuidance: 'Leather grain & hardware close-ups, interior capacity glide, styled carry shots, structured framing.',
    keyShotTypes: ['Hardware & zipper macro', 'Leather stitching detail', 'Styled carry motion', 'Structured hero'],
  },
  {
    id: 'home_kitchen',
    label: 'Home & Kitchen Products',
    group: 'Home & Lifestyle',
    recommendedPace: 'normal',
    recommendedColorLook: 'warm_lifestyle',
    recommendedMusicStyle: 'Warm Acoustic / Modern Lifestyle',
    recommendedTransitions: ['smooth_product_showcase', 'cross_dissolve', 'fade'],
    recommendedDuration: 30,
    cinematographyGuidance: 'Natural architectural light, tactile demonstration shots, calm lifestyle context, clean utility callouts.',
    keyShotTypes: ['In-use countertop demo', 'Finish & ergonomic macro', 'Wide architectural context', 'Clean packshot'],
  },
  {
    id: 'toys_children',
    label: 'Toys & Children\'s Products',
    group: 'Home & Lifestyle',
    recommendedPace: 'fast',
    recommendedColorLook: 'vibrant_grocery',
    recommendedMusicStyle: 'Playful Upbeat Pop / Bright Marimba',
    recommendedTransitions: ['swipe', 'spin', 'push'],
    recommendedDuration: 20,
    cinematographyGuidance: 'Bright clean lighting, joyful motion cuts, clear product durability & play demonstration, friendly bold typography.',
    keyShotTypes: ['Play-in-action', 'Feature mechanism close-up', 'Box contents layout', 'Hero product frame'],
  },
  {
    id: 'fitness',
    label: 'Fitness Products',
    group: 'Home & Lifestyle',
    recommendedPace: 'fast',
    recommendedColorLook: 'high_contrast',
    recommendedMusicStyle: 'High-Energy Driving Percussion / Electronic',
    recommendedTransitions: ['whip_pan', 'motion_blur', 'flash'],
    recommendedDuration: 20,
    cinematographyGuidance: 'Punchy beat-locked cuts, high-contrast sweat/grip details, speed ramps on exertion peaks, bold kinetic type.',
    keyShotTypes: ['Dynamic action peak', 'Grip & texture detail', 'Speed ramp reveal', 'Hero silhouette'],
  },
  {
    id: 'automotive_accessories',
    label: 'Automotive Accessories',
    group: 'Tech',
    recommendedPace: 'fast',
    recommendedColorLook: 'cool_modern',
    recommendedMusicStyle: 'Industrial Bass / Cinematic Electronic',
    recommendedTransitions: ['motion_blur', 'whip_pan', 'zoom_transition'],
    recommendedDuration: 20,
    cinematographyGuidance: 'Low tracking shots, metallic & carbon reflections, crisp install/fit demo, dramatic rim lighting.',
    keyShotTypes: ['Fitment installation', 'Finish & material macro', 'Cabin/exterior context', 'Hero reveal'],
  },
  {
    id: 'other_physical',
    label: 'Other Physical Product',
    group: 'Home & Lifestyle',
    recommendedPace: 'normal',
    recommendedColorLook: 'premium_product',
    recommendedMusicStyle: 'Clean Commercial Groove',
    recommendedTransitions: ['smooth_product_showcase', 'cross_dissolve', 'elegant_reveal'],
    recommendedDuration: 30,
    cinematographyGuidance: 'Balanced commercial storytelling: establishing hero, tactile detail shots, functional demonstration, and clean closing packshot.',
    keyShotTypes: ['Hero wide', 'Detail macro', 'Functional demo', 'Closing brand lockup'],
  },
];

export const RESOLUTION_MAP: Record<ResolutionPreset, { label: string; width: number; height: number }> = {
  '480p': { label: '480p SD (854×480)', width: 854, height: 480 },
  '720p': { label: '720p HD (1280×720)', width: 1280, height: 720 },
  '1080p': { label: '1080p Full HD (1920×1080)', width: 1920, height: 1080 },
  '2K': { label: '2K QHD (2560×1440)', width: 2560, height: 1440 },
  '4K_UHD': { label: '4K UHD (3840×2160)', width: 3840, height: 2160 },
  '4K_DCI': { label: '4K DCI Cinema (4096×2160)', width: 4096, height: 2160 },
  '8K': { label: '8K UHD (7680×4320)', width: 7680, height: 4320 },
};

export const FRAME_RATE_OPTIONS: FrameRateOption[] = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];

export const DURATION_PRESETS: Array<{ label: string; seconds: number }> = [
  { label: '5s', seconds: 5 },
  { label: '10s', seconds: 10 },
  { label: '15s', seconds: 15 },
  { label: '20s', seconds: 20 },
  { label: '30s', seconds: 30 },
  { label: '45s', seconds: 45 },
  { label: '60s', seconds: 60 },
  { label: '90s', seconds: 90 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 },
  { label: '5m', seconds: 300 },
];

export interface PlatformAspectPreset {
  id: string;
  label: string;
  aspectRatio: AspectRatioOption;
  ratioValue: number;
  recommendedWidth: number;
  recommendedHeight: number;
  note: string;
}

export const PLATFORM_PRESETS: PlatformAspectPreset[] = [
  { id: 'youtube', label: 'YouTube Commercial (16:9)', aspectRatio: '16:9', ratioValue: 16 / 9, recommendedWidth: 1920, recommendedHeight: 1080, note: 'Standard landscape cinema & broadcast' },
  { id: 'youtube_shorts', label: 'YouTube Shorts (9:16)', aspectRatio: '9:16', ratioValue: 9 / 16, recommendedWidth: 1080, recommendedHeight: 1920, note: 'Full-screen vertical commercial' },
  { id: 'instagram_reels', label: 'Instagram Reels (9:16)', aspectRatio: '9:16', ratioValue: 9 / 16, recommendedWidth: 1080, recommendedHeight: 1920, note: 'Vertical social with safe top/bottom zones' },
  { id: 'tiktok', label: 'TikTok Commercial (9:16)', aspectRatio: '9:16', ratioValue: 9 / 16, recommendedWidth: 1080, recommendedHeight: 1920, note: 'High-impact vertical beat-synced cut' },
  { id: 'facebook_reels', label: 'Facebook Reels (9:16)', aspectRatio: '9:16', ratioValue: 9 / 16, recommendedWidth: 1080, recommendedHeight: 1920, note: 'Vertical mobile feed placement' },
  { id: 'instagram_feed', label: 'Instagram Feed (4:5)', aspectRatio: '4:5', ratioValue: 4 / 5, recommendedWidth: 1080, recommendedHeight: 1350, note: 'Tall portrait feed presence' },
  { id: 'facebook_feed', label: 'Facebook Feed (1:1)', aspectRatio: '1:1', ratioValue: 1, recommendedWidth: 1080, recommendedHeight: 1080, note: 'Square product showcase' },
  { id: 'website_hero', label: 'Website Product Video (16:9)', aspectRatio: '16:9', ratioValue: 16 / 9, recommendedWidth: 1920, recommendedHeight: 1080, note: 'Crisp widescreen hero embed' },
  { id: 'ecommerce_listing', label: 'E-Commerce Listing (1:1)', aspectRatio: '1:1', ratioValue: 1, recommendedWidth: 1080, recommendedHeight: 1080, note: 'Marketplace square product reel' },
  { id: 'traditional_4_3', label: 'Traditional Editorial (4:3)', aspectRatio: '4:3', ratioValue: 4 / 3, recommendedWidth: 1440, recommendedHeight: 1080, note: 'Classic editorial 4:3 frame' },
];

export function computeDimensionsForAspect(
  resolution: ResolutionPreset,
  aspectRatio: AspectRatioOption,
  customW?: number,
  customH?: number
): { width: number; height: number } {
  const base = RESOLUTION_MAP[resolution] ?? RESOLUTION_MAP['1080p'];
  if (aspectRatio === 'custom' && customW && customH) {
    return { width: Math.round(customW / 2) * 2, height: Math.round(customH / 2) * 2 };
  }
  const longEdge = base.width;
  const shortEdge = base.height;
  switch (aspectRatio) {
    case '9:16':
      return { width: shortEdge, height: longEdge };
    case '1:1':
      return { width: shortEdge, height: shortEdge };
    case '4:5':
      return { width: Math.round((shortEdge * 0.8) / 2) * 2, height: shortEdge };
    case '4:3':
      return { width: Math.round(((shortEdge * 4) / 3) / 2) * 2, height: shortEdge };
    case '16:9':
    default:
      return { width: longEdge, height: shortEdge };
  }
}

export interface TransitionCatalogItem {
  id: string;
  name: string;
  category: TransitionCategory;
  defaultDuration: number;
  description: string;
  premiereNative: boolean;
  ffmpegXfade: string;
}

export const TRANSITIONS_CATALOG: TransitionCatalogItem[] = [
  // Smooth
  { id: 'cross_dissolve', name: 'Cross Dissolve', category: 'smooth', defaultDuration: 0.6, description: 'Seamless opacity blend between shots', premiereNative: true, ffmpegXfade: 'fade' },
  { id: 'fade', name: 'Fade', category: 'smooth', defaultDuration: 0.5, description: 'Clean gradual luminance fade', premiereNative: true, ffmpegXfade: 'fade' },
  { id: 'dip_to_black', name: 'Dip to Black', category: 'smooth', defaultDuration: 0.7, description: 'Commercial chapter break through black', premiereNative: true, ffmpegXfade: 'fadeblack' },
  { id: 'dip_to_white', name: 'Dip to White', category: 'smooth', defaultDuration: 0.6, description: 'Bright studio flash dip through white', premiereNative: true, ffmpegXfade: 'fadewhite' },
  { id: 'smooth_blur', name: 'Smooth Blur', category: 'smooth', defaultDuration: 0.5, description: 'Optical rack-focus blur crossfade', premiereNative: false, ffmpegXfade: 'smoothleft' },
  { id: 'light_fade', name: 'Light Fade', category: 'smooth', defaultDuration: 0.6, description: 'Warm exposure bloom dissolve', premiereNative: false, ffmpegXfade: 'fadewhite' },
  // Dynamic
  { id: 'whip_pan', name: 'Whip Pan', category: 'dynamic', defaultDuration: 0.35, description: 'High-velocity directional camera whip', premiereNative: false, ffmpegXfade: 'slideleft' },
  { id: 'zoom_transition', name: 'Zoom Transition', category: 'dynamic', defaultDuration: 0.4, description: 'Punch-in optical focal push on beat', premiereNative: false, ffmpegXfade: 'zoomin' },
  { id: 'spin', name: 'Spin Transition', category: 'dynamic', defaultDuration: 0.4, description: 'Rotational momentum cut', premiereNative: false, ffmpegXfade: 'radial' },
  { id: 'swipe', name: 'Swipe', category: 'dynamic', defaultDuration: 0.4, description: 'Directional crisp edge wipe', premiereNative: true, ffmpegXfade: 'wipeleft' },
  { id: 'motion_blur', name: 'Motion Blur', category: 'dynamic', defaultDuration: 0.35, description: 'Directional kinetic streak cut', premiereNative: false, ffmpegXfade: 'smoothright' },
  { id: 'push', name: 'Push Transition', category: 'dynamic', defaultDuration: 0.45, description: 'Incoming shot pushes outgoing frame', premiereNative: true, ffmpegXfade: 'slideleft' },
  { id: 'slide', name: 'Slide Transition', category: 'dynamic', defaultDuration: 0.45, description: 'Incoming frame glides over outgoing', premiereNative: true, ffmpegXfade: 'slideright' },
  // Creative
  { id: 'glitch', name: 'Glitch', category: 'creative', defaultDuration: 0.3, description: 'Digital signal shear for tech drops', premiereNative: false, ffmpegXfade: 'pixelize' },
  { id: 'flash', name: 'Flash', category: 'creative', defaultDuration: 0.25, description: 'Strobe studio flash accent cut', premiereNative: false, ffmpegXfade: 'fadewhite' },
  { id: 'rgb_split', name: 'RGB Split', category: 'creative', defaultDuration: 0.35, description: 'Chromatic prism channel separation', premiereNative: false, ffmpegXfade: 'pixelize' },
  { id: 'light_leak', name: 'Light Leak', category: 'creative', defaultDuration: 0.6, description: 'Anamorphic amber optical flare wash', premiereNative: false, ffmpegXfade: 'fadewhite' },
  { id: 'film_burn', name: 'Film Burn', category: 'creative', defaultDuration: 0.55, description: 'Analog 35mm emulsion burn flash', premiereNative: false, ffmpegXfade: 'fadeblack' },
  { id: 'mask_reveal', name: 'Mask Reveal', category: 'creative', defaultDuration: 0.5, description: 'Geometric architectural wipe reveal', premiereNative: true, ffmpegXfade: 'rectcrop' },
  // Premium Product
  { id: 'elegant_reveal', name: 'Elegant Reveal', category: 'premium', defaultDuration: 0.8, description: 'Gradual silk unveil for luxury objects', premiereNative: true, ffmpegXfade: 'dissolve' },
  { id: 'soft_focus_reveal', name: 'Soft Focus Reveal', category: 'premium', defaultDuration: 0.75, description: 'Shallow DOF focus pull onto hero', premiereNative: false, ffmpegXfade: 'dissolve' },
  { id: 'luxury_fade', name: 'Luxury Fade', category: 'premium', defaultDuration: 0.9, description: 'Extended shadow-rich cinema dissolve', premiereNative: true, ffmpegXfade: 'fadeblack' },
  { id: 'cinematic_zoom', name: 'Cinematic Zoom', category: 'premium', defaultDuration: 0.7, description: 'Controlled push-in transition', premiereNative: false, ffmpegXfade: 'zoomin' },
  { id: 'smooth_product_showcase', name: 'Smooth Product Showcase', category: 'premium', defaultDuration: 0.65, description: 'Clean commercial slide-dissolve hybrid', premiereNative: true, ffmpegXfade: 'smoothleft' },
];

export const DEFAULT_COLOR_GRADING: ColorGradingSettings = {
  lookPreset: 'none',
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  saturation: 0,
  vibrance: 0,
  lift: { r: 0, g: 0, b: 0 },
  gamma: { r: 0, g: 0, b: 0 },
  gain: { r: 0, g: 0, b: 0 },
  rgbCurves: {
    r: [0, 25, 50, 75, 100],
    g: [0, 25, 50, 75, 100],
    b: [0, 25, 50, 75, 100],
  },
  hueShift: 0,
  vignette: 0,
  sharpen: 0,
};

export interface ColorLookPreset {
  id: string;
  name: string;
  description: string;
  values: Partial<ColorGradingSettings>;
}

export const COLOR_LOOK_PRESETS: ColorLookPreset[] = [
  { id: 'none', name: 'Without Color Grading', description: 'Original untouched source colors with zero filters, sharpening, or LUTs', values: { exposure: 0, contrast: 0, highlights: 0, shadows: 0, whites: 0, blacks: 0, temperature: 0, tint: 0, saturation: 0, vibrance: 0, hueShift: 0, vignette: 0, sharpen: 0, lutName: undefined, lutCubeData: undefined } },
  { id: 'clean_commercial', name: 'Clean Commercial', description: 'Neutral broadcast clarity with crisp micro-contrast', values: { exposure: 0.08, contrast: 8, highlights: 4, shadows: 6, temperature: 0, saturation: 6, vibrance: 10, vignette: 6, sharpen: 18 } },
  { id: 'luxury_cinematic', name: 'Luxury Cinematic', description: 'Deep obsidian blacks, warm amber highlights, refined contrast', values: { exposure: -0.05, contrast: 22, highlights: -8, shadows: -16, blacks: -12, temperature: 12, tint: -2, saturation: -8, vibrance: 8, vignette: 28, sharpen: 14 } },
  { id: 'warm_lifestyle', name: 'Warm Lifestyle', description: 'Golden daylight warmth and natural organic tones', values: { exposure: 0.12, contrast: 6, highlights: -4, shadows: 12, temperature: 18, tint: 4, saturation: 10, vibrance: 14, vignette: 10, sharpen: 10 } },
  { id: 'cool_modern', name: 'Cool Modern', description: 'Crisp studio slate blues and anodized metallic precision', values: { exposure: 0.05, contrast: 18, highlights: 8, shadows: -6, temperature: -16, tint: 3, saturation: -4, vibrance: 12, vignette: 16, sharpen: 24 } },
  { id: 'vibrant_grocery', name: 'Vibrant Grocery', description: 'Punchy appetizing produce saturation and bright whites', values: { exposure: 0.15, contrast: 14, highlights: 10, shadows: 10, whites: 8, temperature: 6, saturation: 24, vibrance: 22, vignette: 4, sharpen: 20 } },
  { id: 'soft_beauty', name: 'Soft Beauty', description: 'Luminous lifted shadows, gentle contrast, flattering warmth', values: { exposure: 0.16, contrast: -6, highlights: -6, shadows: 18, temperature: 8, tint: 6, saturation: 4, vibrance: 8, vignette: 8, sharpen: 4 } },
  { id: 'fashion_editorial', name: 'Fashion Editorial', description: 'High-fashion tonal separation with architectural contrast', values: { exposure: 0.02, contrast: 26, highlights: 6, shadows: -14, blacks: -10, temperature: -4, saturation: -14, vibrance: 6, vignette: 20, sharpen: 22 } },
  { id: 'premium_product', name: 'Premium Product', description: 'Balanced studio hero grade preserving exact packaging color', values: { exposure: 0.06, contrast: 12, highlights: 4, shadows: 4, temperature: 2, saturation: 8, vibrance: 10, vignette: 12, sharpen: 22 } },
  { id: 'natural_realistic', name: 'Natural Realistic', description: 'Zero-shift color-true baseline for strict product fidelity', values: { exposure: 0, contrast: 2, highlights: 0, shadows: 0, temperature: 0, tint: 0, saturation: 0, vibrance: 0, vignette: 0, sharpen: 8 } },
  { id: 'high_contrast', name: 'High Contrast', description: 'Bold commercial punch for athletic, streetwear, and drops', values: { exposure: 0.04, contrast: 34, highlights: 12, shadows: -20, blacks: -14, temperature: -6, saturation: 10, vibrance: 16, vignette: 24, sharpen: 28 } },
];

export function resolveColorGradingForLook(lookId?: string): ColorGradingSettings {
  const preset = COLOR_LOOK_PRESETS.find((l) => l.id === lookId);
  if (!preset || preset.id === 'none') {
    return { ...DEFAULT_COLOR_GRADING, lookPreset: 'none' };
  }
  return {
    ...DEFAULT_COLOR_GRADING,
    ...preset.values,
    lookPreset: preset.id,
  };
}

export interface CommercialTemplate {
  id: string;
  name: string;
  group: 'Fashion' | 'Beauty' | 'Grocery' | 'Electronics' | 'Jewellery' | 'General';
  category: ProductCategoryId;
  pace: EditingPaceMode;
  duration: number;
  aspectRatio: AspectRatioOption;
  colorLook: string;
  transitionId: string;
  previewImage: string;
  description: string;
  recommendedShotCount: number;
  overlayStyle: {
    fontFamily: string;
    accentColor: string;
    animation: 'fade' | 'slide_up' | 'scale_pop' | 'reveal_mask' | 'cinematic_track';
  };
}

const IMG_PERFUME = '/src/assets/images/template_luxury_perfume_1795070066750.jpg';
const IMG_TECH = '/src/assets/images/template_tech_electronics_1795070082562.jpg';
const IMG_FASHION = '/src/assets/images/template_fashion_sneaker_1795070079547.jpg';
const IMG_BEVERAGE = '/src/assets/images/template_fresh_beverage_1795070066510.jpg';

export const COMMERCIAL_TEMPLATES: CommercialTemplate[] = [
  // Fashion
  { id: 'fashion_lookbook', name: 'Fashion Lookbook', group: 'Fashion', category: 'clothing_fashion', pace: 'normal', duration: 30, aspectRatio: '9:16', colorLook: 'fashion_editorial', transitionId: 'elegant_reveal', previewImage: IMG_FASHION, description: 'Editorial full-frame silhouettes paired with clean serif lower thirds.', recommendedShotCount: 6, overlayStyle: { fontFamily: 'Plus Jakarta Sans', accentColor: '#EEF0F6', animation: 'cinematic_track' } },
  { id: 'streetwear_commercial', name: 'Streetwear Commercial', group: 'Fashion', category: 'clothing_fashion', pace: 'fast', duration: 15, aspectRatio: '9:16', colorLook: 'high_contrast', transitionId: 'whip_pan', previewImage: IMG_FASHION, description: 'Beat-locked rapid cuts, whip pans, and kinetic streetwear callouts.', recommendedShotCount: 8, overlayStyle: { fontFamily: 'Plus Jakarta Sans', accentColor: '#7C3AED', animation: 'scale_pop' } },
  { id: 'luxury_clothing_ad', name: 'Luxury Clothing Advertisement', group: 'Fashion', category: 'clothing_fashion', pace: 'slow', duration: 30, aspectRatio: '16:9', colorLook: 'luxury_cinematic', transitionId: 'luxury_fade', previewImage: IMG_FASHION, description: 'Unhurried fabric glides, architectural contrast, refined typography.', recommendedShotCount: 5, overlayStyle: { fontFamily: 'Plus Jakarta Sans', accentColor: '#E5E7EB', animation: 'fade' } },
  { id: 'clothing_showcase', name: 'Clothing Product Showcase', group: 'Fashion', category: 'clothing_fashion', pace: 'normal', duration: 20, aspectRatio: '4:5', colorLook: 'clean_commercial', transitionId: 'smooth_product_showcase', previewImage: IMG_FASHION, description: 'Multi-angle garment tour tailored for e-commerce and Instagram Feed.', recommendedShotCount: 5, overlayStyle: { fontFamily: 'DM Sans', accentColor: '#3B82F6', animation: 'slide_up' } },
  { id: 'shoe_commercial', name: 'Shoe & Sneaker Commercial', group: 'Fashion', category: 'shoes_sneakers', pace: 'fast', duration: 15, aspectRatio: '9:16', colorLook: 'high_contrast', transitionId: 'zoom_transition', previewImage: IMG_FASHION, description: 'Punchy drop reveals, macro midsole details, and speed-ramped hero shots.', recommendedShotCount: 7, overlayStyle: { fontFamily: 'Plus Jakarta Sans', accentColor: '#3B82F6', animation: 'scale_pop' } },
  // Beauty
  { id: 'skincare_commercial', name: 'Skincare Commercial', group: 'Beauty', category: 'skincare', pace: 'slow', duration: 30, aspectRatio: '9:16', colorLook: 'soft_beauty', transitionId: 'soft_focus_reveal', previewImage: IMG_PERFUME, description: 'Luminous clean beauty pacing highlighting formulation texture and packaging.', recommendedShotCount: 5, overlayStyle: { fontFamily: 'Plus Jakarta Sans', accentColor: '#F3F4F6', animation: 'fade' } },
  { id: 'makeup_reveal', name: 'Makeup Product Reveal', group: 'Beauty', category: 'beauty_cosmetics', pace: 'normal', duration: 20, aspectRatio: '9:16', colorLook: 'soft_beauty', transitionId: 'light_fade', previewImage: IMG_PERFUME, description: 'Macro pigment reveals and smooth optical transitions for cosmetics launches.', recommendedShotCount: 6, overlayStyle: { fontFamily: 'Plus Jakarta Sans', accentColor: '#C084FC', animation: 'reveal_mask' } },
  { id: 'cosmetic_ad', name: 'Cosmetic Advertisement', group: 'Beauty', category: 'beauty_cosmetics', pace: 'normal', duration: 30, aspectRatio: '16:9', colorLook: 'clean_commercial', transitionId: 'cross_dissolve', previewImage: IMG_PERFUME, description: 'Broadcast-ready beauty commercial balancing macro texture and packshot.', recommendedShotCount: 6, overlayStyle: { fontFamily: 'DM Sans', accentColor: '#F8FAFC', animation: 'slide_up' } },
  { id: 'perfume_luxury', name: 'Perfume Luxury Commercial', group: 'Beauty', category: 'perfumes_fragrances', pace: 'slow', duration: 30, aspectRatio: '16:9', colorLook: 'luxury_cinematic', transitionId: 'luxury_fade', previewImage: IMG_PERFUME, description: 'Chiaroscuro obsidian lighting, slow-motion reveals, and cinema dissolves.', recommendedShotCount: 5, overlayStyle: { fontFamily: 'Plus Jakarta Sans', accentColor: '#F59E0B', animation: 'cinematic_track' } },
  // Grocery
  { id: 'fresh_food_commercial', name: 'Fresh Food Commercial', group: 'Grocery', category: 'food_beverages', pace: 'fast', duration: 20, aspectRatio: '16:9', colorLook: 'vibrant_grocery', transitionId: 'zoom_transition', previewImage: IMG_BEVERAGE, description: 'Appetizing macro textures, crisp energetic pacing, and vivid natural color.', recommendedShotCount: 7, overlayStyle: { fontFamily: 'Plus Jakarta Sans', accentColor: '#22C55E', animation: 'scale_pop' } },
  { id: 'grocery_showcase', name: 'Grocery Product Showcase', group: 'Grocery', category: 'grocery', pace: 'normal', duration: 15, aspectRatio: '1:1', colorLook: 'vibrant_grocery', transitionId: 'swipe', previewImage: IMG_BEVERAGE, description: 'Clear packaging legibility and crisp feature highlights for retail ads.', recommendedShotCount: 5, overlayStyle: { fontFamily: 'DM Sans', accentColor: '#F59E0B', animation: 'slide_up' } },
  { id: 'beverage_ad', name: 'Beverage Advertisement', group: 'Grocery', category: 'food_beverages', pace: 'fast', duration: 15, aspectRatio: '9:16', colorLook: 'warm_lifestyle', transitionId: 'flash', previewImage: IMG_BEVERAGE, description: 'Condensation close-ups, pour speed-ramps, and beat-locked refreshment cuts.', recommendedShotCount: 7, overlayStyle: { fontFamily: 'Plus Jakarta Sans', accentColor: '#38BDF8', animation: 'scale_pop' } },
  { id: 'packaging_showcase', name: 'Packaging Showcase', group: 'Grocery', category: 'grocery', pace: 'normal', duration: 20, aspectRatio: '16:9', colorLook: 'clean_commercial', transitionId: 'smooth_product_showcase', previewImage: IMG_BEVERAGE, description: 'Color-accurate 360 packaging reveal preserving every label detail.', recommendedShotCount: 5, overlayStyle: { fontFamily: 'DM Sans', accentColor: '#EEF0F6', animation: 'reveal_mask' } },
  // Electronics
  { id: 'tech_product_launch', name: 'Tech Product Launch', group: 'Electronics', category: 'electronics', pace: 'fast', duration: 30, aspectRatio: '16:9', colorLook: 'cool_modern', transitionId: 'mask_reveal', previewImage: IMG_TECH, description: 'Keynote-grade industrial macro cuts, precision spec callouts, and drop sync.', recommendedShotCount: 8, overlayStyle: { fontFamily: 'Plus Jakarta Sans', accentColor: '#3B82F6', animation: 'reveal_mask' } },
  { id: 'gadget_commercial', name: 'Gadget Commercial', group: 'Electronics', category: 'mobile_accessories', pace: 'fast', duration: 15, aspectRatio: '9:16', colorLook: 'cool_modern', transitionId: 'whip_pan', previewImage: IMG_TECH, description: 'Snappy problem-to-solution showcase built for Reels, Shorts, and TikTok.', recommendedShotCount: 7, overlayStyle: { fontFamily: 'DM Sans', accentColor: '#7C3AED', animation: 'scale_pop' } },
  { id: 'feature_showcase', name: 'Product Feature Showcase', group: 'Electronics', category: 'electronics', pace: 'normal', duration: 45, aspectRatio: '16:9', colorLook: 'clean_commercial', transitionId: 'slide', previewImage: IMG_TECH, description: 'Structured multi-feature walk-through with synchronized specification cards.', recommendedShotCount: 7, overlayStyle: { fontFamily: 'Plus Jakarta Sans', accentColor: '#3B82F6', animation: 'slide_up' } },
  // Jewellery
  { id: 'luxury_jewellery', name: 'Luxury Jewellery Commercial', group: 'Jewellery', category: 'jewellery_watches', pace: 'slow', duration: 30, aspectRatio: '16:9', colorLook: 'luxury_cinematic', transitionId: 'luxury_fade', previewImage: IMG_PERFUME, description: 'Slow macro facet glides, deep studio contrast, timeless elegance.', recommendedShotCount: 5, overlayStyle: { fontFamily: 'Plus Jakarta Sans', accentColor: '#FDE68A', animation: 'cinematic_track' } },
  { id: 'watch_advertisement', name: 'Watch Advertisement', group: 'Jewellery', category: 'jewellery_watches', pace: 'slow', duration: 30, aspectRatio: '16:9', colorLook: 'luxury_cinematic', transitionId: 'cinematic_zoom', previewImage: IMG_TECH, description: 'Horological dial macro study with dramatic shadow reveal and slow tempo.', recommendedShotCount: 6, overlayStyle: { fontFamily: 'Plus Jakarta Sans', accentColor: '#E2E8F0', animation: 'fade' } },
  { id: 'premium_accessories', name: 'Premium Accessories Showcase', group: 'Jewellery', category: 'bags_accessories', pace: 'normal', duration: 20, aspectRatio: '4:5', colorLook: 'fashion_editorial', transitionId: 'elegant_reveal', previewImage: IMG_FASHION, description: 'Tactile craftsmanship close-ups for luxury bags, eyewear, and leather goods.', recommendedShotCount: 5, overlayStyle: { fontFamily: 'DM Sans', accentColor: '#F8FAFC', animation: 'slide_up' } },
  // General
  { id: 'minimal_showcase', name: 'Minimal Product Showcase', group: 'General', category: 'other_physical', pace: 'normal', duration: 20, aspectRatio: '16:9', colorLook: 'natural_realistic', transitionId: 'cross_dissolve', previewImage: IMG_TECH, description: 'Distraction-free studio framing focused purely on product silhouette.', recommendedShotCount: 4, overlayStyle: { fontFamily: 'Plus Jakarta Sans', accentColor: '#EEF0F6', animation: 'fade' } },
  { id: 'cinematic_reveal', name: 'Cinematic Product Reveal', group: 'General', category: 'other_physical', pace: 'slow', duration: 30, aspectRatio: '16:9', colorLook: 'luxury_cinematic', transitionId: 'dip_to_black', previewImage: IMG_PERFUME, description: 'Build-up shadow teasers leading to a dramatic drop reveal.', recommendedShotCount: 6, overlayStyle: { fontFamily: 'Plus Jakarta Sans', accentColor: '#7C3AED', animation: 'cinematic_track' } },
  { id: 'fast_social_ad', name: 'Fast-Paced Social Media Ad', group: 'General', category: 'other_physical', pace: 'fast', duration: 15, aspectRatio: '9:16', colorLook: 'high_contrast', transitionId: 'zoom_transition', previewImage: IMG_BEVERAGE, description: 'Scroll-stopping 15s vertical ad locked strictly to music transients.', recommendedShotCount: 8, overlayStyle: { fontFamily: 'Plus Jakarta Sans', accentColor: '#3B82F6', animation: 'scale_pop' } },
  { id: 'ecommerce_video', name: 'E-Commerce Product Video', group: 'General', category: 'other_physical', pace: 'normal', duration: 30, aspectRatio: '1:1', colorLook: 'premium_product', transitionId: 'smooth_product_showcase', previewImage: IMG_FASHION, description: 'Conversion-focused square product tour with clean user-verified callouts.', recommendedShotCount: 6, overlayStyle: { fontFamily: 'DM Sans', accentColor: '#3B82F6', animation: 'slide_up' } },
  { id: 'sale_promo_ad', name: 'Sale Promotion Advertisement', group: 'General', category: 'other_physical', pace: 'fast', duration: 15, aspectRatio: '9:16', colorLook: 'vibrant_grocery', transitionId: 'flash', previewImage: IMG_BEVERAGE, description: 'High-urgency promotional structure with customizable offer and CTA end-card.', recommendedShotCount: 6, overlayStyle: { fontFamily: 'Plus Jakarta Sans', accentColor: '#A855F7', animation: 'scale_pop' } },
];

export const DEFAULT_CUSTOM_PACE: CustomPaceSettings = {
  avgShotDuration: 2.2,
  minShotDuration: 0.8,
  maxShotDuration: 4.5,
  cutFrequency: 60,
  transitionFrequency: 55,
  motionIntensity: 55,
  speedRampIntensity: 35,
  zoomIntensity: 40,
  musicSyncEnabled: true,
  visualEffectIntensity: 40,
};

export function createDefaultTracks(): TimelineTrack[] {
  return [
    { id: 'v2', name: 'V2 · B-Roll / Images', type: 'video', locked: false, visible: true, muted: false, solo: false, volume: 100, height: 64 },
    { id: 'v1', name: 'V1 · Main Commercial', type: 'video', locked: false, visible: true, muted: false, solo: false, volume: 100, height: 74 },
    { id: 'gfx1', name: 'GFX · Motion & Text', type: 'overlay', locked: false, visible: true, muted: false, solo: false, volume: 100, height: 48 },
    { id: 'a1', name: 'A1 · Music & Beats', type: 'audio', locked: false, visible: true, muted: false, solo: false, volume: 85, height: 72 },
    { id: 'a2', name: 'A2 · Voiceover / SFX', type: 'audio', locked: false, visible: true, muted: false, solo: false, volume: 100, height: 56 },
  ];
}

export function createDefaultProjectSettings(partial?: Partial<ProjectSettings>): ProjectSettings {
  const resolution = partial?.resolution ?? '1080p';
  const aspectRatio = partial?.aspectRatio ?? '16:9';
  const dims = computeDimensionsForAspect(resolution, aspectRatio, partial?.width, partial?.height);
  return {
    projectName: partial?.projectName ?? 'Untitled Product Commercial',
    productName: partial?.productName ?? '',
    productCategory: partial?.productCategory ?? 'electronics',
    brandName: partial?.brandName ?? '',
    resolution,
    width: dims.width,
    height: dims.height,
    fps: partial?.fps ?? 30,
    aspectRatio,
    platformPreset: partial?.platformPreset ?? 'youtube',
    editingStyle: partial?.editingStyle ?? 'normal',
    customPace: partial?.customPace ?? { ...DEFAULT_CUSTOM_PACE },
    targetDuration: partial?.targetDuration ?? 30,
    musicPreference: partial?.musicPreference ?? 'Upbeat Modern Commercial',
    colorGradingPreference: partial?.colorGradingPreference ?? 'clean_commercial',
    exportFormat: partial?.exportFormat ?? 'mp4',
  };
}

export function getCategoryMeta(id: ProductCategoryId): ProductCategoryMeta {
  return PRODUCT_CATEGORIES.find((c) => c.id === id) ?? PRODUCT_CATEGORIES[PRODUCT_CATEGORIES.length - 1];
}

export function formatTimecode(seconds: number, fps = 30): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const roundedFps = Math.max(1, Math.round(fps));
  const totalFrames = Math.floor(safe * roundedFps);
  const frames = totalFrames % roundedFps;
  const totalSec = Math.floor(totalFrames / roundedFps);
  const s = totalSec % 60;
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(frames)}`;
}

export function formatShortDuration(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (mins === 0) return `${secs.toFixed(1)}s`;
  return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(val >= 100 ? 0 : 1)} ${units[idx]}`;
}
