import type {
  AudioAnalysisResult,
  BeatSyncMode,
  CustomColorPreset,
  EditingPaceMode,
  MediaAsset,
  MediaBinCategory,
  PremiereExportResult,
  ProductAnalysisReport,
  ProjectPreset,
  ProjectSettings,
  RenderExportConfig,
  RenderJobStatus,
  StudioProject,
  StudioServerSettings,
  TimelineClip,
} from '../types/studio';

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const errMsg =
      (data as { error?: string } | null)?.error || `Request failed (${res.status})`;
    throw new Error(errMsg);
  }
  return data as T;
}

export const studioApi = {
  getSystemStatus: () =>
    apiJson<{
      ffmpeg: { available: boolean; version: string; encoders: string[] };
      geminiConfigured: boolean;
      settings: StudioServerSettings;
    }>('/api/system/status'),

  getSettings: () => apiJson<StudioServerSettings>('/api/settings'),
  updateSettings: (settings: Partial<StudioServerSettings>) =>
    apiJson<StudioServerSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  listProjects: () => apiJson<StudioProject[]>('/api/projects'),
  getProject: (id: string) => apiJson<StudioProject>(`/api/projects/${id}`),
  createProject: (settings?: Partial<ProjectSettings>) =>
    apiJson<StudioProject>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ settings }),
    }),
  saveProject: (project: StudioProject) =>
    apiJson<StudioProject>(`/api/projects/${project.id}`, {
      method: 'PUT',
      body: JSON.stringify(project),
    }),
  duplicateProject: (id: string) =>
    apiJson<StudioProject>(`/api/projects/${id}/duplicate`, { method: 'POST' }),
  deleteProject: (id: string) =>
    apiJson<{ deleted: boolean }>(`/api/projects/${id}`, { method: 'DELETE' }),
  createSnapshot: (id: string, label: string) =>
    apiJson<StudioProject>(`/api/projects/${id}/snapshot`, {
      method: 'POST',
      body: JSON.stringify({ label }),
    }),
  restoreSnapshot: (id: string, versionId: string) =>
    apiJson<StudioProject>(`/api/projects/${id}/restore/${versionId}`, {
      method: 'POST',
    }),

  deleteAsset: (projectId: string, assetId: string) =>
    apiJson<StudioProject>(`/api/projects/${projectId}/assets/${assetId}`, {
      method: 'DELETE',
    }),

  listProjectPresets: () => apiJson<ProjectPreset[]>('/api/presets/project'),
  saveProjectPreset: (name: string, settings: ProjectSettings) =>
    apiJson<ProjectPreset[]>('/api/presets/project', {
      method: 'POST',
      body: JSON.stringify({ name, settings }),
    }),
  deleteProjectPreset: (id: string) =>
    apiJson<ProjectPreset[]>(`/api/presets/project/${id}`, { method: 'DELETE' }),

  listColorPresets: () => apiJson<CustomColorPreset[]>('/api/presets/color'),
  saveColorPreset: (name: string, settings: CustomColorPreset['settings']) =>
    apiJson<CustomColorPreset[]>('/api/presets/color', {
      method: 'POST',
      body: JSON.stringify({ name, settings }),
    }),

  analyzeAudio: (projectId: string, assetId: string, sensitivity = 55) =>
    apiJson<AudioAnalysisResult>(`/api/projects/${projectId}/audio/analyze`, {
      method: 'POST',
      body: JSON.stringify({ assetId, sensitivity }),
    }),

  analyzeProduct: (projectId: string) =>
    apiJson<ProductAnalysisReport>(`/api/projects/${projectId}/ai/analyze`, {
      method: 'POST',
    }),

  runAutoEdit: (
    projectId: string,
    params: {
      pace: EditingPaceMode;
      targetDuration: number;
      beatSyncMode: BeatSyncMode;
      useAiSequencing: boolean;
    }
  ) =>
    apiJson<{
      clips: TimelineClip[];
      achievedDuration: number;
      targetDuration: number;
      footageShortfall: boolean;
      shortfallSeconds: number;
      shortfallAlternatives: string[];
      pacingNotes: string;
      beatSynced: boolean;
    }>(`/api/projects/${projectId}/ai/auto-edit`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  generateVoiceoverTts: (
    projectId: string,
    params: {
      text: string;
      voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
      style: string;
      title: string;
    }
  ) =>
    apiJson<MediaAsset>(`/api/projects/${projectId}/voiceover/tts`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  startRender: (projectId: string, config: RenderExportConfig) =>
    apiJson<RenderJobStatus>(`/api/projects/${projectId}/render`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  listRenders: () => apiJson<RenderJobStatus[]>('/api/renders'),
  getRenderJob: (jobId: string) => apiJson<RenderJobStatus>(`/api/renders/${jobId}`),

  generatePremiereXml: (projectId: string, packageRelativePaths = false) =>
    apiJson<PremiereExportResult>(`/api/projects/${projectId}/export/premiere-xml`, {
      method: 'POST',
      body: JSON.stringify({ packageRelativePaths }),
    }),
};

export interface UploadProgressInfo {
  filename: string;
  loadedBytes: number;
  totalBytes: number;
  percent: number;
  stage: 'uploading' | 'probing' | 'done' | 'error';
  error?: string;
}

export async function uploadMediaFileChunked(params: {
  projectId: string;
  file: File;
  bin?: MediaBinCategory;
  folder?: string;
  chunkSizeMb?: number;
  onProgress?: (info: UploadProgressInfo) => void;
}): Promise<MediaAsset> {
  const { projectId, file, bin, folder, onProgress } = params;
  const chunkSizeBytes = Math.max(1, params.chunkSizeMb ?? 5) * 1024 * 1024;
  const totalChunks = Math.max(1, Math.ceil(file.size / chunkSizeBytes));

  onProgress?.({
    filename: file.name,
    loadedBytes: 0,
    totalBytes: file.size,
    percent: 0,
    stage: 'uploading',
  });

  const initRes = await apiJson<{ sessionId: string; chunkSizeBytes: number }>('/api/uploads/init', {
    method: 'POST',
    body: JSON.stringify({
      projectId,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      totalSize: file.size,
      totalChunks,
      bin,
      folder,
    }),
  });

  let loadedBytes = 0;
  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSizeBytes;
    const end = Math.min(file.size, start + chunkSizeBytes);
    const slice = file.slice(start, end);
    const buf = await slice.arrayBuffer();

    let attempt = 0;
    let uploaded = false;
    while (!uploaded && attempt < 3) {
      attempt++;
      const res = await fetch(`/api/uploads/${initRes.sessionId}/chunk?index=${i}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: buf,
      });
      if (res.ok) {
        uploaded = true;
      } else if (attempt >= 3) {
        const msg = await res.text();
        throw new Error(`Chunk ${i + 1}/${totalChunks} failed: ${msg}`);
      }
    }

    loadedBytes = end;
    onProgress?.({
      filename: file.name,
      loadedBytes,
      totalBytes: file.size,
      percent: Math.min(95, Math.round((loadedBytes / Math.max(1, file.size)) * 95)),
      stage: 'uploading',
    });
  }

  onProgress?.({
    filename: file.name,
    loadedBytes: file.size,
    totalBytes: file.size,
    percent: 97,
    stage: 'probing',
  });

  const asset = await apiJson<MediaAsset>(`/api/uploads/${initRes.sessionId}/complete`, {
    method: 'POST',
  });

  onProgress?.({
    filename: file.name,
    loadedBytes: file.size,
    totalBytes: file.size,
    percent: 100,
    stage: 'done',
  });

  return asset;
}

/**
 * Parses an Adobe/Resolve .cube 3D LUT file and extracts approximate color transform metrics
 * for live preview while storing the full .cube data for export metadata.
 */
export function parseCubeLutPreview(cubeText: string): {
  title: string;
  size: number;
  estimatedTemp: number;
  estimatedContrast: number;
  estimatedSaturation: number;
} {
  const lines = cubeText.split(/\r?\n/);
  let title = 'Imported LUT';
  let size = 0;
  const triples: Array<[number, number, number]> = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('TITLE')) {
      title = line.replace(/^TITLE\s+/, '').replace(/^"|"$/g, '');
      continue;
    }
    if (line.startsWith('LUT_3D_SIZE')) {
      size = Number(line.split(/\s+/)[1]) || 0;
      continue;
    }
    const parts = line.split(/\s+/).map(Number);
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      triples.push([parts[0], parts[1], parts[2]]);
    }
  }

  if (triples.length === 0) {
    return { title, size, estimatedTemp: 0, estimatedContrast: 0, estimatedSaturation: 0 };
  }

  // Sample midpoint and extremes to approximate warmth & contrast for live HTML5 preview
  const mid = triples[Math.floor(triples.length / 2)];
  const warmShift = Math.round((mid[0] - mid[2]) * 90);
  const low = triples[0];
  const high = triples[triples.length - 1];
  const span = (high[0] + high[1] + high[2]) / 3 - (low[0] + low[1] + low[2]) / 3;
  const contrastShift = Math.round((span - 1) * 45);

  return {
    title,
    size,
    estimatedTemp: Math.max(-40, Math.min(40, warmShift)),
    estimatedContrast: Math.max(-30, Math.min(40, contrastShift)),
    estimatedSaturation: 6,
  };
}
