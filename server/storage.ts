import fs from 'node:fs';
import path from 'node:path';
import type {
  CustomColorPreset,
  ProjectPreset,
  RenderJobStatus,
  StudioProject,
  StudioServerSettings,
} from '../src/types/studio.ts';

export const STORAGE_ROOT = path.resolve(process.cwd(), 'storage');
export const PROJECTS_DIR = path.join(STORAGE_ROOT, 'projects');
export const MEDIA_DIR = path.join(STORAGE_ROOT, 'media');
export const PROXIES_DIR = path.join(STORAGE_ROOT, 'proxies');
export const THUMBS_DIR = path.join(STORAGE_ROOT, 'thumbs');
export const EXPORTS_DIR = path.join(STORAGE_ROOT, 'exports');
export const CHUNKS_DIR = path.join(STORAGE_ROOT, 'chunks');

const PRESETS_FILE = path.join(STORAGE_ROOT, 'project-presets.json');
const COLOR_PRESETS_FILE = path.join(STORAGE_ROOT, 'color-presets.json');
const SETTINGS_FILE = path.join(STORAGE_ROOT, 'studio-settings.json');
const JOBS_FILE = path.join(STORAGE_ROOT, 'render-jobs.json');

export const DEFAULT_STUDIO_SETTINGS: StudioServerSettings = {
  maxUploadSizeMb: 4096,
  maxVideoDurationSec: 3600,
  chunkSizeMb: 5,
  proxyEnabled: true,
  proxyHeight: 720,
  defaultExportCodec: 'h264',
  hardwareAccel: 'auto',
};

export function ensureStorageDirectories(): void {
  for (const dir of [
    STORAGE_ROOT,
    PROJECTS_DIR,
    MEDIA_DIR,
    PROXIES_DIR,
    THUMBS_DIR,
    EXPORTS_DIR,
    CHUNKS_DIR,
  ]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJsonFileAtomic(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

export function listProjects(): StudioProject[] {
  ensureStorageDirectories();
  const files = fs.readdirSync(PROJECTS_DIR).filter((f) => f.endsWith('.json'));
  const projects: StudioProject[] = [];
  for (const file of files) {
    const project = readJsonFile<StudioProject | null>(path.join(PROJECTS_DIR, file), null);
    if (project && project.id) {
      projects.push(project);
    }
  }
  return projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getProject(projectId: string): StudioProject | null {
  ensureStorageDirectories();
  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.join(PROJECTS_DIR, `${safeId}.json`);
  return readJsonFile<StudioProject | null>(filePath, null);
}

export function saveProject(project: StudioProject): StudioProject {
  ensureStorageDirectories();
  const safeId = project.id.replace(/[^a-zA-Z0-9_-]/g, '');
  const updated: StudioProject = {
    ...project,
    id: safeId,
    updatedAt: new Date().toISOString(),
  };
  writeJsonFileAtomic(path.join(PROJECTS_DIR, `${safeId}.json`), updated);
  return updated;
}

export function deleteProject(projectId: string): boolean {
  ensureStorageDirectories();
  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.join(PROJECTS_DIR, `${safeId}.json`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

export function getStudioSettings(): StudioServerSettings {
  ensureStorageDirectories();
  return {
    ...DEFAULT_STUDIO_SETTINGS,
    ...readJsonFile<Partial<StudioServerSettings>>(SETTINGS_FILE, {}),
  };
}

export function saveStudioSettings(next: Partial<StudioServerSettings>): StudioServerSettings {
  ensureStorageDirectories();
  const merged = { ...getStudioSettings(), ...next };
  writeJsonFileAtomic(SETTINGS_FILE, merged);
  return merged;
}

export function listProjectPresets(): ProjectPreset[] {
  ensureStorageDirectories();
  return readJsonFile<ProjectPreset[]>(PRESETS_FILE, []);
}

export function saveProjectPreset(preset: ProjectPreset): ProjectPreset[] {
  const existing = listProjectPresets().filter((p) => p.id !== preset.id);
  const next = [preset, ...existing];
  writeJsonFileAtomic(PRESETS_FILE, next);
  return next;
}

export function deleteProjectPreset(id: string): ProjectPreset[] {
  const next = listProjectPresets().filter((p) => p.id !== id);
  writeJsonFileAtomic(PRESETS_FILE, next);
  return next;
}

export function listColorPresets(): CustomColorPreset[] {
  ensureStorageDirectories();
  return readJsonFile<CustomColorPreset[]>(COLOR_PRESETS_FILE, []);
}

export function saveColorPreset(preset: CustomColorPreset): CustomColorPreset[] {
  const existing = listColorPresets().filter((p) => p.id !== preset.id);
  const next = [preset, ...existing];
  writeJsonFileAtomic(COLOR_PRESETS_FILE, next);
  return next;
}

export function listRenderJobs(): RenderJobStatus[] {
  ensureStorageDirectories();
  return readJsonFile<RenderJobStatus[]>(JOBS_FILE, []);
}

export function saveRenderJob(job: RenderJobStatus): void {
  const existing = listRenderJobs().filter((j) => j.id !== job.id);
  const next = [job, ...existing].slice(0, 50);
  writeJsonFileAtomic(JOBS_FILE, next);
}

export function getRenderJob(jobId: string): RenderJobStatus | null {
  return listRenderJobs().find((j) => j.id === jobId) ?? null;
}
