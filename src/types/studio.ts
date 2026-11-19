export type ProductCategoryId =
  | 'clothing_fashion'
  | 'shoes_sneakers'
  | 'beauty_cosmetics'
  | 'skincare'
  | 'perfumes_fragrances'
  | 'grocery'
  | 'food_beverages'
  | 'electronics'
  | 'mobile_accessories'
  | 'jewellery_watches'
  | 'bags_accessories'
  | 'home_kitchen'
  | 'toys_children'
  | 'fitness'
  | 'automotive_accessories'
  | 'other_physical';

export type ResolutionPreset =
  | '480p'
  | '720p'
  | '1080p'
  | '2K'
  | '4K_UHD'
  | '4K_DCI'
  | '8K';

export type FrameRateOption = 23.976 | 24 | 25 | 29.97 | 30 | 50 | 59.94 | 60;

export type AspectRatioOption = '16:9' | '9:16' | '1:1' | '4:5' | '4:3' | 'custom';

export type EditingPaceMode = 'fast' | 'normal' | 'slow' | 'custom';

export type BeatSyncMode = 'strict' | 'intelligent' | 'cinematic';

export type ExportFormatOption = 'mp4' | 'mov' | 'webm' | 'prores_mov' | 'wav';

export type ExportCodecOption = 'h264' | 'h265' | 'prores' | 'vp9' | 'pcm';

export type MediaBinCategory =
  | 'video'
  | 'image'
  | 'audio'
  | 'music'
  | 'sfx'
  | 'logo'
  | 'product'
  | 'generated';

export type TransitionCategory = 'smooth' | 'dynamic' | 'creative' | 'premium';

export type ImageMotionPreset =
  | 'none'
  | 'slow_zoom_in'
  | 'slow_zoom_out'
  | 'pan_left'
  | 'pan_right'
  | 'tilt_up'
  | 'tilt_down'
  | 'parallax'
  | 'cinematic_reveal';

export interface CustomPaceSettings {
  avgShotDuration: number;
  minShotDuration: number;
  maxShotDuration: number;
  cutFrequency: number; // 0-100
  transitionFrequency: number; // 0-100
  motionIntensity: number; // 0-100
  speedRampIntensity: number; // 0-100
  zoomIntensity: number; // 0-100
  musicSyncEnabled: boolean;
  visualEffectIntensity: number; // 0-100
}

export interface ProjectSettings {
  projectName: string;
  productName: string;
  productCategory: ProductCategoryId;
  brandName: string;
  resolution: ResolutionPreset;
  width: number;
  height: number;
  fps: FrameRateOption;
  aspectRatio: AspectRatioOption;
  platformPreset: string;
  editingStyle: EditingPaceMode;
  customPace: CustomPaceSettings;
  targetDuration: number; // seconds
  musicPreference: string;
  colorGradingPreference: string;
  exportFormat: ExportFormatOption;
}

export interface MediaMarker {
  id: string;
  time: number;
  label: string;
  color: string;
}

export interface MediaAsset {
  id: string;
  projectId: string;
  name: string;
  originalFilename: string;
  bin: MediaBinCategory;
  folder: string;
  mediaType: 'video' | 'image' | 'audio';
  mimeType: string;
  fileSize: number;
  filePath: string; // relative server storage path
  url: string;
  proxyUrl?: string;
  proxyPath?: string;
  proxyStatus: 'none' | 'processing' | 'ready' | 'failed';
  thumbnailUrl?: string;
  keyframes?: string[]; // server URLs of extracted frames for AI analysis
  waveformPeaks?: number[]; // normalized 0..1 array for audio waveform rendering
  duration: number; // seconds
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  audioChannels?: number;
  sampleRate?: number;
  bitrate?: number;
  hasAudio?: boolean;
  labelColor: string;
  markers: MediaMarker[];
  isAiGenerated?: boolean;
  aiOriginNote?: string;
  createdAt: string;
}

export interface BeatMarker {
  id: string;
  time: number;
  strength: number; // 0-1
  isDownbeat: boolean;
  barIndex: number;
  manual?: boolean;
}

export interface AudioSection {
  id: string;
  label: 'Intro' | 'Verse' | 'Build-up' | 'Drop' | 'Chorus' | 'Breakdown' | 'Outro';
  start: number;
  end: number;
  energy: number; // 0-1
}

export interface AudioAnalysisResult {
  assetId: string;
  bpm: number;
  duration: number;
  beats: BeatMarker[];
  sections: AudioSection[];
  peaks: number[]; // waveform peaks
  energyCurve: number[];
  silenceRanges: Array<{ start: number; end: number }>;
  peakDb: number;
  sensitivity: number;
  analyzedAt: string;
}

export interface ClipTransition {
  id: string;
  name: string;
  category: TransitionCategory;
  duration: number; // seconds
  direction: 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | 'center';
  intensity: number; // 0-100
  timing: 'ease-in-out' | 'ease-in' | 'ease-out' | 'linear';
}

export interface ColorGradingSettings {
  lookPreset: string;
  exposure: number; // -2 to 2
  contrast: number; // -100 to 100
  highlights: number; // -100 to 100
  shadows: number; // -100 to 100
  whites: number; // -100 to 100
  blacks: number; // -100 to 100
  temperature: number; // -100 to 100
  tint: number; // -100 to 100
  saturation: number; // -100 to 100
  vibrance: number; // -100 to 100
  lift: { r: number; g: number; b: number };
  gamma: { r: number; g: number; b: number };
  gain: { r: number; g: number; b: number };
  rgbCurves: {
    r: number[];
    g: number[];
    b: number[];
  };
  hueShift: number; // -180 to 180
  vignette: number; // 0 to 100
  sharpen: number; // 0 to 100
  lutName?: string;
  lutCubeData?: string;
}

export interface TimelineClip {
  id: string;
  trackId: string;
  assetId: string;
  name: string;
  mediaType: 'video' | 'image' | 'audio';
  startTime: number; // timeline position in seconds
  duration: number; // selected duration on timeline in seconds
  inPoint: number; // source trim in seconds
  outPoint: number; // source trim out seconds
  sourceDuration: number;
  speed: number; // 0.25 to 4.0
  speedRamp?: 'none' | 'ramp_in' | 'ramp_out' | 'pulse';
  opacity: number; // 0-100
  scale: number; // 10-300 (%)
  positionX: number; // -100 to 100 (%)
  positionY: number; // -100 to 100 (%)
  rotation: number; // -180 to 180 deg
  cropFocusX: number; // 0-100
  cropFocusY: number; // 0-100
  volume: number; // 0-200 (%)
  fadeIn: number; // seconds
  fadeOut: number; // seconds
  muted: boolean;
  duckOnVoiceover: boolean;
  imageMotion: ImageMotionPreset;
  transitionIn?: ClipTransition;
  transitionOut?: ClipTransition;
  colorOverride?: Partial<ColorGradingSettings>;
  isAiGenerated?: boolean;
}

export type OverlayElementType =
  | 'product_title'
  | 'price_tag'
  | 'discount_label'
  | 'sale_badge'
  | 'new_arrival'
  | 'feature_callout'
  | 'product_spec'
  | 'brand_logo'
  | 'lower_third'
  | 'animated_line'
  | 'animated_shape'
  | 'cta_banner'
  | 'social_handle';

export interface MotionOverlay {
  id: string;
  trackId: string;
  type: OverlayElementType;
  text: string;
  subtext?: string;
  logoAssetId?: string;
  startTime: number;
  duration: number;
  x: number; // 0-100 (%)
  y: number; // 0-100 (%)
  fontFamily: string;
  fontSize: number;
  color: string;
  backgroundColor: string;
  backgroundOpacity: number;
  strokeColor: string;
  strokeWidth: number;
  shadow: boolean;
  opacity: number; // 0-100
  animation: 'fade' | 'slide_up' | 'slide_left' | 'scale_pop' | 'reveal_mask' | 'cinematic_track' | 'none';
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: 'video' | 'overlay' | 'audio';
  locked: boolean;
  visible: boolean;
  muted: boolean;
  solo: boolean;
  volume: number; // 0-100
  height: number;
}

export interface TimelineMarker {
  id: string;
  time: number;
  name: string;
  comment: string;
  color: string;
}

export interface ProductAnalysisReport {
  analyzedAt: string;
  modelUsed: string;
  productIdentity: string;
  productAppearance: string;
  dominantColors: string[];
  packagingDetails: string;
  materials: string[];
  brandLogoDetected: string;
  cameraAnglesDetected: string[];
  visualQualityAssessment: string;
  audioContentNotes: string;
  fidelityConfirmation: string;
  recommendations: {
    bestOpeningShotAssetId?: string;
    bestOpeningShotReason: string;
    bestProductRevealAssetId?: string;
    bestProductRevealReason: string;
    bestDetailShotAssetIds: string[];
    bestClosingShotAssetId?: string;
    bestClosingShotReason: string;
    transitionOpportunities: string[];
    suitableTextOverlays: string[];
    recommendedColorGrade: string;
    recommendedMusicStyle: string;
    recommendedPace: EditingPaceMode;
    idealDurationSeconds: number;
  };
  shotBreakdown: Array<{
    assetId: string;
    assetName: string;
    role: 'opening' | 'reveal' | 'detail' | 'lifestyle' | 'closing' | 'supporting';
    cameraAngle: string;
    recommendedIn: number;
    recommendedOut: number;
    notes: string;
  }>;
}

export interface ProjectVersionSnapshot {
  id: string;
  label: string;
  createdAt: string;
  clipCount: number;
  duration: number;
  snapshotData: string; // serialized state
}

export interface StudioProject {
  id: string;
  settings: ProjectSettings;
  assets: MediaAsset[];
  tracks: TimelineTrack[];
  clips: TimelineClip[];
  overlays: MotionOverlay[];
  markers: TimelineMarker[];
  colorGrading: ColorGradingSettings;
  audioAnalysis?: AudioAnalysisResult;
  beatSyncMode: BeatSyncMode;
  productAnalysis?: ProductAnalysisReport;
  versions: ProjectVersionSnapshot[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectPreset {
  id: string;
  name: string;
  settings: ProjectSettings;
  createdAt: string;
}

export interface CustomColorPreset {
  id: string;
  name: string;
  settings: ColorGradingSettings;
  createdAt: string;
}

export interface StudioServerSettings {
  maxUploadSizeMb: number;
  maxVideoDurationSec: number;
  chunkSizeMb: number;
  proxyEnabled: boolean;
  proxyHeight: number;
  defaultExportCodec: ExportCodecOption;
  hardwareAccel: 'auto' | 'none';
}

export interface RenderExportConfig {
  resolution: ResolutionPreset;
  width: number;
  height: number;
  fps: FrameRateOption;
  format: ExportFormatOption;
  codec: ExportCodecOption;
  audioCodec: 'aac' | 'pcm' | 'wav';
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  quality: 'draft' | 'standard' | 'high' | 'master';
  colorSpace: 'bt709' | 'bt2020' | 'srgb';
  audioChannels: 'stereo' | 'mono';
  useProxy: boolean;
}

export interface RenderJobStatus {
  id: string;
  projectId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  stage: string;
  outputUrl?: string;
  outputFilename?: string;
  fileSize?: number;
  logs: string[];
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PremiereCompatibilityItem {
  category: 'sequence' | 'clip' | 'transition' | 'effect' | 'color' | 'audio' | 'overlay' | 'marker';
  name: string;
  status: 'native' | 'approximated' | 'manifest_only';
  details: string;
}

export interface PremiereExportResult {
  xml: string;
  filename: string;
  schemaVersion: string;
  isValid: boolean;
  validationErrors: string[];
  compatibilityReport: {
    generatedAt: string;
    totalItems: number;
    nativeCount: number;
    approximatedCount: number;
    manifestOnlyCount: number;
    items: PremiereCompatibilityItem[];
    relinkingInstructions: string[];
  };
  manifest: Record<string, unknown>;
}
