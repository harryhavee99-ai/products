import { execFile, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { MediaAsset, MediaBinCategory } from '../src/types/studio.ts';
import {
  CHUNKS_DIR,
  MEDIA_DIR,
  PROXIES_DIR,
  THUMBS_DIR,
  ensureStorageDirectories,
  getProject,
  getStudioSettings,
  saveProject,
} from './storage.ts';

const execFileAsync = promisify(execFile);

const VIDEO_EXTS = new Set(['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v', '.mpeg', '.mpg', '.mts', '.mxf']);
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.tiff', '.tif', '.bmp', '.svg']);
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.aac', '.m4a', '.flac', '.ogg', '.aiff', '.aif']);

export interface UploadSession {
  id: string;
  projectId: string;
  filename: string;
  mimeType: string;
  totalSize: number;
  totalChunks: number;
  bin: MediaBinCategory;
  folder: string;
  receivedChunks: Set<number>;
  createdAt: number;
}

const uploadSessions = new Map<string, UploadSession>();

export function detectMediaType(filename: string, mimeType: string): 'video' | 'image' | 'audio' | null {
  const ext = path.extname(filename).toLowerCase();
  if (VIDEO_EXTS.has(ext) || mimeType.startsWith('video/')) return 'video';
  if (IMAGE_EXTS.has(ext) || mimeType.startsWith('image/')) return 'image';
  if (AUDIO_EXTS.has(ext) || mimeType.startsWith('audio/')) return 'audio';
  return null;
}

export function defaultBinForType(mediaType: 'video' | 'image' | 'audio'): MediaBinCategory {
  if (mediaType === 'video') return 'video';
  if (mediaType === 'image') return 'image';
  return 'music';
}

export function initChunkedUpload(params: {
  projectId: string;
  filename: string;
  mimeType: string;
  totalSize: number;
  totalChunks: number;
  bin?: MediaBinCategory;
  folder?: string;
}): { sessionId: string; chunkSizeBytes: number } {
  ensureStorageDirectories();
  const settings = getStudioSettings();
  const maxBytes = settings.maxUploadSizeMb * 1024 * 1024;
  if (params.totalSize > maxBytes) {
    throw new Error(
      `File exceeds configured upload limit (${settings.maxUploadSizeMb} MB). Adjust limit in Settings.`
    );
  }
  const mediaType = detectMediaType(params.filename, params.mimeType);
  if (!mediaType) {
    throw new Error(`Unsupported file format for "${params.filename}".`);
  }

  const id = crypto.randomUUID();
  const sessionDir = path.join(CHUNKS_DIR, id);
  fs.mkdirSync(sessionDir, { recursive: true });

  uploadSessions.set(id, {
    id,
    projectId: params.projectId,
    filename: params.filename,
    mimeType: params.mimeType || 'application/octet-stream',
    totalSize: params.totalSize,
    totalChunks: Math.max(1, params.totalChunks),
    bin: params.bin ?? defaultBinForType(mediaType),
    folder: params.folder ?? 'Root',
    receivedChunks: new Set<number>(),
    createdAt: Date.now(),
  });

  return {
    sessionId: id,
    chunkSizeBytes: settings.chunkSizeMb * 1024 * 1024,
  };
}

export function writeUploadChunk(sessionId: string, chunkIndex: number, buffer: Buffer): { received: number; total: number } {
  const session = uploadSessions.get(sessionId);
  if (!session) throw new Error('Upload session not found or expired.');
  const chunkPath = path.join(CHUNKS_DIR, sessionId, `chunk_${String(chunkIndex).padStart(6, '0')}`);
  fs.writeFileSync(chunkPath, buffer);
  session.receivedChunks.add(chunkIndex);
  return { received: session.receivedChunks.size, total: session.totalChunks };
}

export async function finalizeChunkedUpload(sessionId: string): Promise<MediaAsset> {
  const session = uploadSessions.get(sessionId);
  if (!session) throw new Error('Upload session not found.');
  if (session.receivedChunks.size < session.totalChunks) {
    throw new Error(
      `Incomplete upload: received ${session.receivedChunks.size} of ${session.totalChunks} chunks.`
    );
  }

  const ext = path.extname(session.filename).toLowerCase() || '.bin';
  const assetId = crypto.randomUUID();
  const safeBase = path
    .basename(session.filename, ext)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 64);
  const storedFilename = `${assetId}_${safeBase}${ext}`;
  const projectMediaDir = path.join(MEDIA_DIR, session.projectId);
  fs.mkdirSync(projectMediaDir, { recursive: true });
  const finalPath = path.join(projectMediaDir, storedFilename);

  const writeStream = fs.createWriteStream(finalPath);
  for (let i = 0; i < session.totalChunks; i++) {
    const chunkPath = path.join(CHUNKS_DIR, sessionId, `chunk_${String(i).padStart(6, '0')}`);
    const chunkBuf = fs.readFileSync(chunkPath);
    writeStream.write(chunkBuf);
  }
  await new Promise<void>((resolve, reject) => {
    writeStream.end(() => resolve());
    writeStream.on('error', reject);
  });

  // Clean up chunks directory
  fs.rmSync(path.join(CHUNKS_DIR, sessionId), { recursive: true, force: true });
  uploadSessions.delete(sessionId);

  return ingestMediaFile({
    projectId: session.projectId,
    assetId,
    absoluteFilePath: finalPath,
    originalFilename: session.filename,
    mimeType: session.mimeType,
    bin: session.bin,
    folder: session.folder,
  });
}

export interface ProbeMetadata {
  duration: number;
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  audioChannels?: number;
  sampleRate?: number;
  bitrate?: number;
  hasAudio: boolean;
}

function parseFrameRate(raw?: string): number | undefined {
  if (!raw || raw === '0/0') return undefined;
  const parts = raw.split('/');
  if (parts.length === 2) {
    const num = Number(parts[0]);
    const den = Number(parts[1]);
    if (Number.isFinite(num) && Number.isFinite(den) && den > 0) {
      return Math.round((num / den) * 1000) / 1000;
    }
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export async function probeMediaFile(absolutePath: string): Promise<ProbeMetadata> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      absolutePath,
    ]);
    const data = JSON.parse(stdout) as {
      format?: { duration?: string; bit_rate?: string };
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
        r_frame_rate?: string;
        avg_frame_rate?: string;
        channels?: number;
        sample_rate?: string;
        duration?: string;
      }>;
    };
    const streams = data.streams ?? [];
    const videoStream = streams.find((s) => s.codec_type === 'video');
    const audioStream = streams.find((s) => s.codec_type === 'audio');
    const durationNum =
      Number(data.format?.duration) ||
      Number(videoStream?.duration) ||
      Number(audioStream?.duration) ||
      0;

    return {
      duration: Number.isFinite(durationNum) && durationNum > 0 ? Math.round(durationNum * 1000) / 1000 : 0,
      width: videoStream?.width,
      height: videoStream?.height,
      fps: parseFrameRate(videoStream?.avg_frame_rate) ?? parseFrameRate(videoStream?.r_frame_rate),
      videoCodec: videoStream?.codec_name,
      audioCodec: audioStream?.codec_name,
      audioChannels: audioStream?.channels,
      sampleRate: audioStream?.sample_rate ? Number(audioStream.sample_rate) : undefined,
      bitrate: data.format?.bit_rate ? Math.round(Number(data.format.bit_rate) / 1000) : undefined,
      hasAudio: Boolean(audioStream),
    };
  } catch {
    return { duration: 0, hasAudio: false };
  }
}

async function extractVideoThumbnailAndKeyframes(
  assetId: string,
  absolutePath: string,
  duration: number
): Promise<{ thumbnailUrl?: string; keyframes: string[] }> {
  ensureStorageDirectories();
  const thumbFile = `${assetId}_thumb.jpg`;
  const thumbPath = path.join(THUMBS_DIR, thumbFile);
  const keyframes: string[] = [];

  try {
    const seekSec = duration > 1 ? Math.min(1, duration * 0.15) : 0;
    await execFileAsync('ffmpeg', [
      '-y',
      '-ss',
      String(seekSec),
      '-i',
      absolutePath,
      '-vframes',
      '1',
      '-vf',
      'scale=480:-2',
      '-q:v',
      '4',
      thumbPath,
    ]);
  } catch {
    // Ignore thumbnail error
  }

  // Extract up to 3 representative frames for Gemini Vision product analysis
  const samplePoints =
    duration > 2
      ? [duration * 0.12, duration * 0.5, duration * 0.85]
      : [0];

  for (let i = 0; i < samplePoints.length; i++) {
    const kfFile = `${assetId}_kf_${i}.jpg`;
    const kfPath = path.join(THUMBS_DIR, kfFile);
    try {
      await execFileAsync('ffmpeg', [
        '-y',
        '-ss',
        String(Math.max(0, samplePoints[i])),
        '-i',
        absolutePath,
        '-vframes',
        '1',
        '-vf',
        'scale=640:-2',
        '-q:v',
        '5',
        kfPath,
      ]);
      if (fs.existsSync(kfPath)) {
        keyframes.push(`/storage/thumbs/${kfFile}`);
      }
    } catch {
      // Continue if frame seek fails
    }
  }

  return {
    thumbnailUrl: fs.existsSync(thumbPath) ? `/storage/thumbs/${thumbFile}` : keyframes[0],
    keyframes,
  };
}

export async function extractAudioPeaks(absolutePath: string, buckets = 160): Promise<number[]> {
  return new Promise((resolve) => {
    const proc = spawn('ffmpeg', [
      '-i',
      absolutePath,
      '-ac',
      '1',
      '-ar',
      '8000',
      '-f',
      's16le',
      '-vn',
      'pipe:1',
    ]);
    const chunks: Buffer[] = [];
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.on('error', () => resolve([]));
    proc.on('close', () => {
      const pcm = Buffer.concat(chunks);
      const totalSamples = Math.floor(pcm.length / 2);
      if (totalSamples === 0) {
        resolve([]);
        return;
      }
      const samplesPerBucket = Math.max(1, Math.floor(totalSamples / buckets));
      const peaks: number[] = [];
      let maxVal = 0.001;
      for (let b = 0; b < buckets; b++) {
        const start = b * samplesPerBucket;
        const end = Math.min(totalSamples, start + samplesPerBucket);
        let peak = 0;
        for (let i = start; i < end; i += Math.max(1, Math.floor(samplesPerBucket / 64))) {
          const val = Math.abs(pcm.readInt16LE(i * 2)) / 32768;
          if (val > peak) peak = val;
        }
        if (peak > maxVal) maxVal = peak;
        peaks.push(peak);
      }
      resolve(peaks.map((p) => Math.round((p / maxVal) * 1000) / 1000));
    });
  });
}

function generateProxyInBackground(projectId: string, assetId: string, absolutePath: string, proxyHeight: number): void {
  const proxyFile = `${assetId}_proxy.mp4`;
  const proxyPath = path.join(PROXIES_DIR, proxyFile);
  const proc = spawn('ffmpeg', [
    '-y',
    '-i',
    absolutePath,
    '-vf',
    `scale=-2:'min(${proxyHeight},ih)'`,
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '24',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    proxyPath,
  ]);

  proc.on('close', (code) => {
    const project = getProject(projectId);
    if (!project) return;
    const idx = project.assets.findIndex((a) => a.id === assetId);
    if (idx === -1) return;
    if (code === 0 && fs.existsSync(proxyPath)) {
      project.assets[idx] = {
        ...project.assets[idx],
        proxyStatus: 'ready',
        proxyUrl: `/storage/proxies/${proxyFile}`,
        proxyPath: path.relative(process.cwd(), proxyPath),
      };
    } else {
      project.assets[idx] = {
        ...project.assets[idx],
        proxyStatus: 'failed',
      };
    }
    saveProject(project);
  });
}

export async function ingestMediaFile(params: {
  projectId: string;
  assetId?: string;
  absoluteFilePath: string;
  originalFilename: string;
  mimeType: string;
  bin?: MediaBinCategory;
  folder?: string;
  isAiGenerated?: boolean;
  aiOriginNote?: string;
}): Promise<MediaAsset> {
  ensureStorageDirectories();
  const assetId = params.assetId ?? crypto.randomUUID();
  const mediaType = detectMediaType(params.originalFilename, params.mimeType) ?? 'video';
  const stat = fs.statSync(params.absoluteFilePath);
  const probe = await probeMediaFile(params.absoluteFilePath);
  const settings = getStudioSettings();

  if (mediaType === 'video' && probe.duration > settings.maxVideoDurationSec) {
    throw new Error(
      `Video duration (${Math.round(probe.duration)}s) exceeds configured maximum (${settings.maxVideoDurationSec}s).`
    );
  }

  const relativePath = path.relative(process.cwd(), params.absoluteFilePath);
  const urlPath = '/' + relativePath.split(path.sep).join('/');

  let thumbnailUrl: string | undefined;
  let keyframes: string[] = [];
  let waveformPeaks: number[] | undefined;

  if (mediaType === 'video') {
    const visual = await extractVideoThumbnailAndKeyframes(assetId, params.absoluteFilePath, probe.duration);
    thumbnailUrl = visual.thumbnailUrl;
    keyframes = visual.keyframes;
    if (probe.hasAudio) {
      waveformPeaks = await extractAudioPeaks(params.absoluteFilePath, 120);
    }
  } else if (mediaType === 'image') {
    thumbnailUrl = urlPath;
    keyframes = [urlPath];
  } else if (mediaType === 'audio') {
    waveformPeaks = await extractAudioPeaks(params.absoluteFilePath, 220);
  }

  const shouldGenerateProxy =
    mediaType === 'video' &&
    settings.proxyEnabled &&
    ((probe.height ?? 0) > settings.proxyHeight ||
      !['.mp4', '.webm'].includes(path.extname(params.originalFilename).toLowerCase()));

  const asset: MediaAsset = {
    id: assetId,
    projectId: params.projectId,
    name: path.basename(params.originalFilename, path.extname(params.originalFilename)),
    originalFilename: params.originalFilename,
    bin: params.bin ?? defaultBinForType(mediaType),
    folder: params.folder ?? 'Root',
    mediaType,
    mimeType: params.mimeType,
    fileSize: stat.size,
    filePath: relativePath,
    url: urlPath,
    proxyStatus: shouldGenerateProxy ? 'processing' : 'none',
    thumbnailUrl,
    keyframes,
    waveformPeaks,
    duration: mediaType === 'image' ? 5 : Math.max(0.5, probe.duration),
    width: probe.width,
    height: probe.height,
    fps: probe.fps,
    videoCodec: probe.videoCodec,
    audioCodec: probe.audioCodec,
    audioChannels: probe.audioChannels,
    sampleRate: probe.sampleRate,
    bitrate: probe.bitrate,
    hasAudio: probe.hasAudio,
    labelColor: mediaType === 'video' ? '#7C3AED' : mediaType === 'image' ? '#3B82F6' : '#10B981',
    markers: [],
    isAiGenerated: params.isAiGenerated,
    aiOriginNote: params.aiOriginNote,
    createdAt: new Date().toISOString(),
  };

  const project = getProject(params.projectId);
  if (project) {
    project.assets = [asset, ...project.assets];
    saveProject(project);
  }

  if (shouldGenerateProxy) {
    generateProxyInBackground(params.projectId, assetId, params.absoluteFilePath, settings.proxyHeight);
  }

  return asset;
}

export async function getFFmpegCapabilities(): Promise<{
  available: boolean;
  version: string;
  encoders: string[];
}> {
  try {
    const { stdout: verOut } = await execFileAsync('ffmpeg', ['-version']);
    const firstLine = verOut.split('\n')[0] ?? 'ffmpeg';
    const { stdout: encOut } = await execFileAsync('ffmpeg', ['-encoders']);
    const wanted = ['libx264', 'libx265', 'prores_ks', 'libvpx-vp9', 'aac', 'pcm_s16le', 'h264_nvenc', 'h264_vaapi'];
    const detected = wanted.filter((e) => encOut.includes(e));
    return {
      available: true,
      version: firstLine.trim(),
      encoders: detected,
    };
  } catch {
    return { available: false, version: 'Unavailable', encoders: [] };
  }
}
