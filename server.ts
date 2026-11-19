import 'dotenv/config';
import * as archiverPkg from 'archiver';
import crypto from 'node:crypto';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import type {
  BeatSyncMode,
  CustomColorPreset,
  EditingPaceMode,
  MediaBinCategory,
  ProjectPreset,
  ProjectSettings,
  RenderExportConfig,
  StudioProject,
} from './src/types/studio.ts';
import {
  createDefaultProjectSettings,
  createDefaultTracks,
  resolveColorGradingForLook,
} from './src/data/catalogs.ts';
import {
  MEDIA_DIR,
  STORAGE_ROOT,
  deleteProject,
  deleteProjectPreset,
  ensureStorageDirectories,
  getProject,
  getRenderJob,
  getStudioSettings,
  listColorPresets,
  listProjectPresets,
  listProjects,
  listRenderJobs,
  saveColorPreset,
  saveProject,
  saveProjectPreset,
  saveStudioSettings,
} from './server/storage.ts';
import {
  finalizeChunkedUpload,
  getFFmpegCapabilities,
  ingestMediaFile,
  initChunkedUpload,
  writeUploadChunk,
} from './server/mediaService.ts';
import { analyzeAudioFile } from './server/audioAnalysisService.ts';
import {
  analyzeProductMediaWithGemini,
  generateAutoEditTimeline,
  generateVoiceoverTts,
  isGeminiConfigured,
} from './server/aiService.ts';
import { startRenderJob } from './server/renderService.ts';
import { generatePremiereXmlExport } from './server/premiereXml.ts';

ensureStorageDirectories();

const app = express();
app.use(express.json({ limit: '25mb' }));

// Serve stored media, proxies, thumbnails, and exports with HTTP Range support for video scrubbing
app.use('/storage', (req, res, next) => {
  res.setHeader('Accept-Ranges', 'bytes');
  next();
}, express.static(STORAGE_ROOT));

// --- System & Capabilities ---
app.get('/api/system/status', async (_req, res) => {
  const ffmpeg = await getFFmpegCapabilities();
  res.json({
    ffmpeg,
    geminiConfigured: isGeminiConfigured(),
    settings: getStudioSettings(),
  });
});

app.get('/api/settings', (_req, res) => {
  res.json(getStudioSettings());
});

app.put('/api/settings', (req, res) => {
  const updated = saveStudioSettings(req.body ?? {});
  res.json(updated);
});

// --- Projects CRUD & Version History ---
app.get('/api/projects', (_req, res) => {
  res.json(listProjects());
});

app.post('/api/projects', (req, res) => {
  const body = (req.body ?? {}) as { settings?: Partial<ProjectSettings> };
  const now = new Date().toISOString();
  const settings = createDefaultProjectSettings(body.settings);
  const project: StudioProject = {
    id: crypto.randomUUID(),
    settings,
    assets: [],
    tracks: createDefaultTracks(),
    clips: [],
    overlays: [],
    markers: [],
    colorGrading: resolveColorGradingForLook(settings.colorGradingPreference),
    beatSyncMode: 'intelligent',
    versions: [],
    createdAt: now,
    updatedAt: now,
  };
  saveProject(project);
  res.status(201).json(project);
});

app.get('/api/projects/:id', (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  res.json(project);
});

app.put('/api/projects/:id', (req, res) => {
  const existing = getProject(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  const incoming = req.body as Partial<StudioProject>;
  const merged: StudioProject = {
    ...existing,
    ...incoming,
    id: existing.id,
    createdAt: existing.createdAt,
  };
  const saved = saveProject(merged);
  res.json(saved);
});

app.post('/api/projects/:id/duplicate', (req, res) => {
  const existing = getProject(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  const now = new Date().toISOString();
  const copy: StudioProject = {
    ...JSON.parse(JSON.stringify(existing)),
    id: crypto.randomUUID(),
    settings: {
      ...existing.settings,
      projectName: `${existing.settings.projectName} (Copy)`,
    },
    createdAt: now,
    updatedAt: now,
  };
  saveProject(copy);
  res.status(201).json(copy);
});

app.post('/api/projects/:id/snapshot', (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  const label = (req.body as { label?: string })?.label || `Snapshot ${project.versions.length + 1}`;
  const duration = project.clips.reduce((acc, c) => Math.max(acc, c.startTime + c.duration), 0);
  const snapshotData = JSON.stringify({
    settings: project.settings,
    tracks: project.tracks,
    clips: project.clips,
    overlays: project.overlays,
    markers: project.markers,
    colorGrading: project.colorGrading,
    beatSyncMode: project.beatSyncMode,
  });
  project.versions = [
    {
      id: crypto.randomUUID(),
      label,
      createdAt: new Date().toISOString(),
      clipCount: project.clips.length,
      duration: Math.round(duration * 100) / 100,
      snapshotData,
    },
    ...project.versions,
  ].slice(0, 25);
  const saved = saveProject(project);
  res.json(saved);
});

app.post('/api/projects/:id/restore/:versionId', (req, res) => {
  const project = getProject(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  const version = project.versions.find((v) => v.id === req.params.versionId);
  if (!version) {
    res.status(404).json({ error: 'Version snapshot not found.' });
    return;
  }
  const parsed = JSON.parse(version.snapshotData) as Partial<StudioProject>;
  const restored = saveProject({
    ...project,
    ...parsed,
    id: project.id,
    assets: project.assets,
    versions: project.versions,
  });
  res.json(restored);
});

app.delete('/api/projects/:id', (req, res) => {
  const ok = deleteProject(req.params.id);
  if (!ok) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  res.json({ deleted: true });
});

// --- Presets ---
app.get('/api/presets/project', (_req, res) => res.json(listProjectPresets()));
app.post('/api/presets/project', (req, res) => {
  const { name, settings } = req.body as { name: string; settings: ProjectSettings };
  const preset: ProjectPreset = {
    id: crypto.randomUUID(),
    name: name || 'Custom Project Preset',
    settings,
    createdAt: new Date().toISOString(),
  };
  res.status(201).json(saveProjectPreset(preset));
});
app.delete('/api/presets/project/:id', (req, res) => {
  res.json(deleteProjectPreset(req.params.id));
});

app.get('/api/presets/color', (_req, res) => res.json(listColorPresets()));
app.post('/api/presets/color', (req, res) => {
  const { name, settings } = req.body as CustomColorPreset;
  const preset: CustomColorPreset = {
    id: crypto.randomUUID(),
    name: name || 'Custom Grade',
    settings,
    createdAt: new Date().toISOString(),
  };
  res.status(201).json(saveColorPreset(preset));
});

// --- Resumable Chunked Media Upload ---
app.post('/api/uploads/init', (req, res) => {
  try {
    const { projectId, filename, mimeType, totalSize, totalChunks, bin, folder } = req.body as {
      projectId: string;
      filename: string;
      mimeType: string;
      totalSize: number;
      totalChunks: number;
      bin?: MediaBinCategory;
      folder?: string;
    };
    const session = initChunkedUpload({ projectId, filename, mimeType, totalSize, totalChunks, bin, folder });
    res.json(session);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.put(
  '/api/uploads/:sessionId/chunk',
  express.raw({ type: 'application/octet-stream', limit: '60mb' }),
  (req, res) => {
    try {
      const chunkIndex = Number(req.query.index ?? 0);
      const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
      const status = writeUploadChunk(req.params.sessionId, chunkIndex, buf);
      res.json(status);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  }
);

app.post('/api/uploads/:sessionId/complete', async (req, res) => {
  try {
    const asset = await finalizeChunkedUpload(req.params.sessionId);
    res.status(201).json(asset);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// Delete media asset from project
app.delete('/api/projects/:projectId/assets/:assetId', (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  project.assets = project.assets.filter((a) => a.id !== req.params.assetId);
  project.clips = project.clips.filter((c) => c.assetId !== req.params.assetId);
  saveProject(project);
  res.json(project);
});

// --- Audio Beat & Structure Analysis ---
app.post('/api/projects/:projectId/audio/analyze', async (req, res) => {
  try {
    const project = getProject(req.params.projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    const { assetId, sensitivity } = req.body as { assetId: string; sensitivity?: number };
    const asset = project.assets.find((a) => a.id === assetId);
    if (!asset) {
      res.status(404).json({ error: 'Audio asset not found in project.' });
      return;
    }
    const absPath = path.resolve(process.cwd(), asset.filePath);
    const analysis = await analyzeAudioFile(absPath, asset.id, sensitivity ?? 55);
    project.audioAnalysis = analysis;
    saveProject(project);
    res.json(analysis);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- AI Product Understanding & Auto Edit (Gemini Server-Side) ---
app.post('/api/projects/:projectId/ai/analyze', async (req, res) => {
  try {
    const project = getProject(req.params.projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    const report = await analyzeProductMediaWithGemini(project);
    project.productAnalysis = report;
    saveProject(project);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/projects/:projectId/ai/auto-edit', async (req, res) => {
  try {
    const project = getProject(req.params.projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    const { pace, targetDuration, beatSyncMode, useAiSequencing } = req.body as {
      pace: EditingPaceMode;
      targetDuration: number;
      beatSyncMode: BeatSyncMode;
      useAiSequencing?: boolean;
    };
    const result = await generateAutoEditTimeline({
      project,
      pace: pace ?? project.settings.editingStyle,
      targetDuration: targetDuration ?? project.settings.targetDuration,
      beatSyncMode: beatSyncMode ?? project.beatSyncMode,
      useAiSequencing: useAiSequencing ?? true,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- Voiceover TTS (Gemini 3.8 Flash Lite TTS) ---
app.post('/api/projects/:projectId/voiceover/tts', async (req, res) => {
  try {
    const project = getProject(req.params.projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    const { text, voiceName, style, title } = req.body as {
      text: string;
      voiceName?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
      style?: string;
      title?: string;
    };
    if (!text?.trim()) {
      res.status(400).json({ error: 'Enter narration script text before generating voiceover.' });
      return;
    }
    const wavBuffer = await generateVoiceoverTts({
      text: text.trim(),
      voiceName: voiceName ?? 'Kore',
      style: style ?? 'Clear, warm commercial narrator',
    });

    const assetId = crypto.randomUUID();
    const projectMediaDir = path.join(MEDIA_DIR, project.id);
    fs.mkdirSync(projectMediaDir, { recursive: true });
    const safeTitle = (title || 'Voiceover').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const filename = `${safeTitle}_${assetId.slice(0, 6)}.wav`;
    const absPath = path.join(projectMediaDir, filename);
    fs.writeFileSync(absPath, wavBuffer);

    const asset = await ingestMediaFile({
      projectId: project.id,
      assetId,
      absoluteFilePath: absPath,
      originalFilename: filename,
      mimeType: 'audio/wav',
      bin: 'audio',
      folder: 'Voiceovers',
      isAiGenerated: true,
      aiOriginNote: `AI Voiceover (${voiceName ?? 'Kore'}) generated via Gemini TTS`,
    });
    res.status(201).json(asset);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// --- Real FFmpeg Render & Export ---
app.post('/api/projects/:projectId/render', (req, res) => {
  try {
    const project = getProject(req.params.projectId);
    if (!project) {
      res.status(404).json({ error: 'Project not found.' });
      return;
    }
    const config = req.body as RenderExportConfig;
    const job = startRenderJob(project, config);
    res.status(202).json(job);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/renders', (_req, res) => {
  res.json(listRenderJobs());
});

app.get('/api/renders/:jobId', (req, res) => {
  const job = getRenderJob(req.params.jobId);
  if (!job) {
    res.status(404).json({ error: 'Render job not found.' });
    return;
  }
  res.json(job);
});

// --- Adobe Premiere Pro FCP 7 XML (XMEML v4) Export & Media Package ZIP ---
app.post('/api/projects/:projectId/export/premiere-xml', (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  const packageRelativePaths = Boolean((req.body as { packageRelativePaths?: boolean })?.packageRelativePaths);
  const result = generatePremiereXmlExport(project, { packageRelativePaths });
  res.json(result);
});

app.get('/api/projects/:projectId/export/premiere-package.zip', (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  const result = generatePremiereXmlExport(project, { packageRelativePaths: true });
  const safeName = project.settings.projectName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Commercial_Project';

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}_PremierePro_Package.zip"`);

  const createArchiver = (
    (archiverPkg as unknown as { default?: (format: 'zip', options?: { zlib?: { level?: number } }) => archiverPkg.Archiver }).default ??
    (archiverPkg as unknown as (format: 'zip', options?: { zlib?: { level?: number } }) => archiverPkg.Archiver)
  );
  const archive = createArchiver('zip', { zlib: { level: 6 } });
  archive.on('error', (err: Error) => {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  });
  archive.pipe(res);

  archive.append(result.xml, { name: result.filename });
  archive.append(JSON.stringify(result.compatibilityReport, null, 2), { name: 'premiere-compatibility-report.json' });
  archive.append(JSON.stringify(result.manifest, null, 2), { name: 'effect-manifest.json' });
  archive.append(JSON.stringify(project.settings, null, 2), { name: 'project-settings.json' });

  // Collect all referenced source media files into /media/ for clean Premiere relinking
  const referencedIds = new Set(project.clips.map((c) => c.assetId));
  for (const asset of project.assets) {
    if (!referencedIds.has(asset.id)) continue;
    const absPath = path.resolve(process.cwd(), asset.filePath);
    if (fs.existsSync(absPath)) {
      archive.file(absPath, { name: `media/${path.basename(asset.filePath)}` });
    }
  }

  void archive.finalize();
});

// --- Frontend Serving (Vite Dev Middleware or Built Static Dist) ---
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pro Product Studio AI server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
