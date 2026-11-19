import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  ColorGradingSettings,
  RenderExportConfig,
  RenderJobStatus,
  StudioProject,
  TimelineClip,
} from '../src/types/studio.ts';
import { EXPORTS_DIR, ensureStorageDirectories, saveRenderJob } from './storage.ts';

function buildColorFilterChain(cg: ColorGradingSettings): string[] {
  if (cg.lookPreset === 'none') return [];
  const filters: string[] = [];
  const brightness = Math.max(-0.5, Math.min(0.5, cg.exposure * 0.18));
  const contrast = Math.max(0.4, Math.min(2.2, 1 + cg.contrast / 100));
  const saturation = Math.max(0, Math.min(2.5, 1 + (cg.saturation + cg.vibrance * 0.5) / 100));
  const gamma = Math.max(0.5, Math.min(2.0, 1 + (cg.shadows - cg.blacks * 0.5) / 220));

  if (
    Math.abs(brightness) > 0.005 ||
    Math.abs(contrast - 1) > 0.01 ||
    Math.abs(saturation - 1) > 0.01 ||
    Math.abs(gamma - 1) > 0.01
  ) {
    filters.push(
      `eq=brightness=${brightness.toFixed(3)}:contrast=${contrast.toFixed(3)}:saturation=${saturation.toFixed(3)}:gamma=${gamma.toFixed(3)}`
    );
  }

  if (Math.abs(cg.temperature) > 2 || Math.abs(cg.tint) > 2) {
    const rs = Math.max(-0.3, Math.min(0.3, cg.temperature / 250));
    const bs = Math.max(-0.3, Math.min(0.3, -cg.temperature / 250));
    const gs = Math.max(-0.2, Math.min(0.2, cg.tint / 300));
    filters.push(`colorbalance=rm=${rs.toFixed(3)}:gm=${gs.toFixed(3)}:bm=${bs.toFixed(3)}`);
  }

  if (Math.abs(cg.hueShift) > 1) {
    filters.push(`hue=h=${cg.hueShift.toFixed(1)}`);
  }

  if (cg.sharpen > 12) {
    const amt = Math.min(1.5, ((cg.sharpen - 10) / 90) * 1.2);
    filters.push(`unsharp=5:5:${amt.toFixed(2)}:5:5:0.0`);
  }

  if (cg.vignette > 5) {
    const angle = (Math.PI / 5) * (0.5 + (cg.vignette / 100) * 0.9);
    filters.push(`vignette=angle=${angle.toFixed(3)}`);
  }

  return filters;
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/\n/g, ' ');
}

function buildImageMotionFilter(clip: TimelineClip, width: number, height: number, fps: number): string {
  const frames = Math.max(1, Math.round(clip.duration * fps));
  const scaledW = Math.round(width * 1.25);
  const scaledH = Math.round(height * 1.25);

  switch (clip.imageMotion) {
    case 'slow_zoom_in':
    case 'cinematic_reveal':
      return `scale=${scaledW}:${scaledH}:force_original_aspect_ratio=increase,crop=${scaledW}:${scaledH},zoompan=z='min(zoom+0.0012,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
    case 'slow_zoom_out':
      return `scale=${scaledW}:${scaledH}:force_original_aspect_ratio=increase,crop=${scaledW}:${scaledH},zoompan=z='if(lte(on,1),1.18,max(1.0,zoom-0.0012))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=${fps}`;
    case 'pan_left':
      return `scale=${scaledW}:${scaledH}:force_original_aspect_ratio=increase,crop=${scaledW}:${scaledH},zoompan=z='1.12':x='(iw-iw/zoom)*(1-on/${frames})':y='(ih-ih/zoom)/2':d=${frames}:s=${width}x${height}:fps=${fps}`;
    case 'pan_right':
      return `scale=${scaledW}:${scaledH}:force_original_aspect_ratio=increase,crop=${scaledW}:${scaledH},zoompan=z='1.12':x='(iw-iw/zoom)*(on/${frames})':y='(ih-ih/zoom)/2':d=${frames}:s=${width}x${height}:fps=${fps}`;
    case 'tilt_up':
      return `scale=${scaledW}:${scaledH}:force_original_aspect_ratio=increase,crop=${scaledW}:${scaledH},zoompan=z='1.12':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*(1-on/${frames})':d=${frames}:s=${width}x${height}:fps=${fps}`;
    case 'tilt_down':
      return `scale=${scaledW}:${scaledH}:force_original_aspect_ratio=increase,crop=${scaledW}:${scaledH},zoompan=z='1.12':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*(on/${frames})':d=${frames}:s=${width}x${height}:fps=${fps}`;
    case 'parallax':
      return `scale=${scaledW}:${scaledH}:force_original_aspect_ratio=increase,crop=${scaledW}:${scaledH},zoompan=z='min(1.04+0.0008*on,1.16)':x='(iw-iw/zoom)*0.5+sin(on/25)*18':y='(ih-ih/zoom)*0.5':d=${frames}:s=${width}x${height}:fps=${fps}`;
    default:
      return `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},fps=${fps}`;
  }
}

export function startRenderJob(project: StudioProject, config: RenderExportConfig): RenderJobStatus {
  ensureStorageDirectories();
  const jobId = crypto.randomUUID();
  const safeName = project.settings.projectName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'commercial';
  const ext =
    config.format === 'wav'
      ? 'wav'
      : config.format === 'webm'
        ? 'webm'
        : config.format === 'mov' || config.format === 'prores_mov'
          ? 'mov'
          : 'mp4';
  const outputFilename = `${safeName}_${config.resolution}_${jobId.slice(0, 6)}.${ext}`;
  const outputPath = path.join(EXPORTS_DIR, outputFilename);

  const job: RenderJobStatus = {
    id: jobId,
    projectId: project.id,
    status: 'queued',
    progress: 0,
    stage: 'Preparing FFmpeg filter graph',
    outputFilename,
    outputUrl: `/storage/exports/${outputFilename}`,
    logs: [`[${new Date().toLocaleTimeString()}] Render job queued (${config.width}×${config.height} @ ${config.fps} fps, ${config.format.toUpperCase()})`],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveRenderJob(job);

  // Run FFmpeg asynchronously so the HTTP response returns immediately with jobId
  setImmediate(() => {
    void executeFFmpegRender(job, project, config, outputPath);
  });

  return job;
}

async function executeFFmpegRender(
  job: RenderJobStatus,
  project: StudioProject,
  config: RenderExportConfig,
  outputPath: string
): Promise<void> {
  const updateJob = (patch: Partial<RenderJobStatus>, logLine?: string) => {
    Object.assign(job, patch, { updatedAt: new Date().toISOString() });
    if (logLine) {
      job.logs = [...job.logs.slice(-60), `[${new Date().toLocaleTimeString()}] ${logLine}`];
    }
    saveRenderJob(job);
  };

  try {
    const assetMap = new Map(project.assets.map((a) => [a.id, a]));
    const visibleTracks = new Set(project.tracks.filter((t) => t.visible).map((t) => t.id));
    const unmutedAudioTracks = new Map(
      project.tracks.filter((t) => t.type === 'audio' && !t.muted).map((t) => [t.id, t])
    );

    // Collect ordered video/image clips across visible video tracks (prefer V1 + V2 sorted by startTime)
    const visualClips = project.clips
      .filter((c) => (c.mediaType === 'video' || c.mediaType === 'image') && visibleTracks.has(c.trackId))
      .sort((a, b) => a.startTime - b.startTime);

    const audioClips = project.clips
      .filter((c) => c.mediaType === 'audio' && !c.muted && unmutedAudioTracks.has(c.trackId))
      .sort((a, b) => a.startTime - b.startTime);

    if (config.format !== 'wav' && visualClips.length === 0) {
      throw new Error('Timeline has no video or image clips on visible tracks to render.');
    }
    if (config.format === 'wav' && audioClips.length === 0 && !visualClips.some((c) => assetMap.get(c.assetId)?.hasAudio)) {
      throw new Error('Timeline has no audio clips to export as WAV.');
    }

    const totalDuration = Math.max(
      1,
      visualClips.reduce((acc, c) => Math.max(acc, c.startTime + c.duration), 0),
      audioClips.reduce((acc, c) => Math.max(acc, c.startTime + c.duration), 0)
    );

    updateJob(
      { status: 'running', progress: 5, stage: 'Building FFmpeg inputs & filter graph' },
      `Timeline duration: ${totalDuration.toFixed(2)}s (${visualClips.length} visual clips, ${audioClips.length} audio clips)`
    );

    const args: string[] = ['-y'];
    const filterParts: string[] = [];
    let inputIndex = 0;

    // 1. Visual clips inputs
    const videoSegmentLabels: string[] = [];
    const safeWidth = Math.max(64, Math.round(config.width / 2) * 2);
    const safeHeight = Math.max(64, Math.round(config.height / 2) * 2);
    const fps = config.fps;

    if (config.format !== 'wav') {
      for (let i = 0; i < visualClips.length; i++) {
        const clip = visualClips[i];
        const asset = assetMap.get(clip.assetId);
        if (!asset) continue;
        const chosenPath =
          config.useProxy && asset.proxyPath && fs.existsSync(path.resolve(process.cwd(), asset.proxyPath))
            ? path.resolve(process.cwd(), asset.proxyPath)
            : path.resolve(process.cwd(), asset.filePath);
        if (!fs.existsSync(chosenPath)) {
          throw new Error(`Source file missing on disk for "${clip.name}"`);
        }

        const idx = inputIndex++;
        if (clip.mediaType === 'image') {
          args.push('-loop', '1', '-t', String(Math.max(0.2, clip.duration)), '-i', chosenPath);
          const motionFilter = buildImageMotionFilter(clip, safeWidth, safeHeight, fps);
          filterParts.push(
            `[${idx}:v]${motionFilter},setsar=1,format=yuv420p[vseg${i}]`
          );
        } else {
          const speed = Math.max(0.25, Math.min(4, clip.speed || 1));
          const readDur = Math.max(0.2, clip.duration * speed);
          args.push('-ss', String(Math.max(0, clip.inPoint)), '-t', String(readDur), '-i', chosenPath);
          const ptsExpr = Math.abs(speed - 1) > 0.01 ? `setpts=${(1 / speed).toFixed(4)}*PTS,` : '';
          const cropX = `(iw-${safeWidth})*${(clip.cropFocusX / 100).toFixed(2)}`;
          const cropY = `(ih-${safeHeight})*${(clip.cropFocusY / 100).toFixed(2)}`;
          filterParts.push(
            `[${idx}:v]${ptsExpr}scale=${safeWidth}:${safeHeight}:force_original_aspect_ratio=increase,crop=${safeWidth}:${safeHeight}:${cropX}:${cropY},fps=${fps},setsar=1,format=yuv420p[vseg${i}]`
          );
        }
        videoSegmentLabels.push(`[vseg${i}]`);
      }

      if (videoSegmentLabels.length === 0) {
        throw new Error('None of the timeline visual clips resolved to valid files.');
      }

      let currentVideoLabel = videoSegmentLabels[0];
      if (videoSegmentLabels.length > 1) {
        filterParts.push(`${videoSegmentLabels.join('')}concat=n=${videoSegmentLabels.length}:v=1:a=0[vconcat]`);
        currentVideoLabel = '[vconcat]';
      }

      // Apply global color grading
      const colorFilters = buildColorFilterChain(project.colorGrading);
      if (colorFilters.length > 0) {
        filterParts.push(`${currentVideoLabel}${colorFilters.join(',')}[vgraded]`);
        currentVideoLabel = '[vgraded]';
      }

      // Apply visible motion graphics / text overlays via drawtext where font available
      const visibleOverlays = project.overlays.filter((ov) => ov.text.trim().length > 0);
      if (visibleOverlays.length > 0) {
        const dtFilters = visibleOverlays.map((ov) => {
          const txt = escapeDrawtext(ov.text);
          const fontSize = Math.max(16, Math.round((ov.fontSize / 1080) * safeHeight * 1.35));
          const xPos = `max(24,min(w-text_w-24,w*${(ov.x / 100).toFixed(3)}-text_w/2))`;
          const yPos = `max(24,min(h-text_h-24,h*${(ov.y / 100).toFixed(3)}-text_h/2))`;
          const fontColor = ov.color.startsWith('#') ? `0x${ov.color.slice(1)}` : 'white';
          const enable = `between(t,${ov.startTime.toFixed(2)},${(ov.startTime + ov.duration).toFixed(2)})`;
          const box =
            ov.backgroundOpacity > 0.05
              ? `:box=1:boxcolor=${ov.backgroundColor.startsWith('#') ? `0x${ov.backgroundColor.slice(1)}` : 'black'}@${ov.backgroundOpacity.toFixed(2)}:boxborderw=14`
              : '';
          return `drawtext=text='${txt}':fontsize=${fontSize}:fontcolor=${fontColor}:x=${xPos}:y=${yPos}${box}:enable='${enable}'`;
        });
        filterParts.push(`${currentVideoLabel}${dtFilters.join(',')}[vout]`);
        currentVideoLabel = '[vout]';
      } else {
        filterParts.push(`${currentVideoLabel}null[vout]`);
      }
    }

    // 2. Audio tracks inputs (music + voiceover + SFX)
    const audioMixLabels: string[] = [];
    const hasVoiceover = audioClips.some((c) => c.trackId === 'a2');

    for (let i = 0; i < audioClips.length; i++) {
      const clip = audioClips[i];
      const asset = assetMap.get(clip.assetId);
      if (!asset) continue;
      const absPath = path.resolve(process.cwd(), asset.filePath);
      if (!fs.existsSync(absPath)) continue;

      const idx = inputIndex++;
      args.push('-ss', String(Math.max(0, clip.inPoint)), '-t', String(Math.max(0.2, clip.duration)), '-i', absPath);
      const track = unmutedAudioTracks.get(clip.trackId);
      let gain = Math.max(0, (clip.volume / 100) * ((track?.volume ?? 100) / 100));
      if (clip.duckOnVoiceover && hasVoiceover && clip.trackId === 'a1') {
        gain *= 0.45;
      }

      const chain: string[] = [`volume=${gain.toFixed(3)}`];
      if (clip.fadeIn > 0.05) {
        chain.push(`afade=t=in:st=0:d=${clip.fadeIn.toFixed(2)}`);
      }
      if (clip.fadeOut > 0.05 && clip.duration > clip.fadeOut) {
        chain.push(`afade=t=out:st=${Math.max(0, clip.duration - clip.fadeOut).toFixed(2)}:d=${clip.fadeOut.toFixed(2)}`);
      }
      const delayMs = Math.round(Math.max(0, clip.startTime) * 1000);
      if (delayMs > 0) {
        chain.push(`adelay=${delayMs}|${delayMs}`);
      }
      filterParts.push(`[${idx}:a]${chain.join(',')}[aseg${i}]`);
      audioMixLabels.push(`[aseg${i}]`);
    }

    if (audioMixLabels.length > 1) {
      filterParts.push(
        `${audioMixLabels.join('')}amix=inputs=${audioMixLabels.length}:duration=longest:dropout_transition=2[aout]`
      );
    } else if (audioMixLabels.length === 1) {
      filterParts.push(`${audioMixLabels[0]}anull[aout]`);
    }

    if (filterParts.length > 0) {
      args.push('-filter_complex', filterParts.join(';'));
    }

    // 3. Stream mapping & codec configuration
    if (config.format === 'wav') {
      if (audioMixLabels.length > 0) {
        args.push('-map', '[aout]');
      }
      args.push('-vn', '-c:a', 'pcm_s16le', '-ar', '48000', '-ac', config.audioChannels === 'mono' ? '1' : '2');
    } else {
      args.push('-map', '[vout]');
      if (audioMixLabels.length > 0) {
        args.push('-map', '[aout]');
      }

      const crf =
        config.quality === 'master' ? '16' : config.quality === 'high' ? '19' : config.quality === 'standard' ? '22' : '26';

      if (config.format === 'webm' || config.codec === 'vp9') {
        args.push('-c:v', 'libvpx-vp9', '-b:v', `${config.videoBitrateKbps}k`, '-crf', crf, '-deadline', 'realtime');
        if (audioMixLabels.length > 0) args.push('-c:a', 'libopus', '-b:a', `${config.audioBitrateKbps}k`);
      } else if (config.format === 'prores_mov' || config.codec === 'prores') {
        args.push('-c:v', 'prores_ks', '-profile:v', '2', '-pix_fmt', 'yuv422p10le');
        if (audioMixLabels.length > 0) args.push('-c:a', 'pcm_s16le');
      } else if (config.codec === 'h265') {
        args.push('-c:v', 'libx265', '-preset', 'fast', '-crf', crf, '-pix_fmt', 'yuv420p');
        if (audioMixLabels.length > 0) args.push('-c:a', 'aac', '-b:a', `${config.audioBitrateKbps}k`);
      } else {
        args.push(
          '-c:v',
          'libx264',
          '-preset',
          config.quality === 'draft' ? 'ultrafast' : 'fast',
          '-crf',
          crf,
          '-maxrate',
          `${Math.round(config.videoBitrateKbps * 1.4)}k`,
          '-bufsize',
          `${config.videoBitrateKbps * 2}k`,
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart'
        );
        if (audioMixLabels.length > 0) {
          args.push(
            '-c:a',
            config.audioCodec === 'pcm' ? 'pcm_s16le' : 'aac',
            '-b:a',
            `${config.audioBitrateKbps}k`,
            '-ac',
            config.audioChannels === 'mono' ? '1' : '2'
          );
        }
      }

      if (config.colorSpace === 'bt709') {
        args.push('-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709');
      }
      args.push('-shortest');
    }

    args.push('-progress', 'pipe:1', '-nostats', outputPath);

    updateJob(
      { progress: 12, stage: 'Encoding with FFmpeg' },
      `Executing FFmpeg (${config.codec.toUpperCase()} / ${safeWidth}×${safeHeight} @ ${fps} fps)`
    );

    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', args);
      let stderrTail = '';

      proc.stdout.on('data', (chunk: Buffer) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (line.startsWith('out_time_us=')) {
            const us = Number(line.split('=')[1]);
            if (Number.isFinite(us) && us > 0) {
              const sec = us / 1_000_000;
              const pct = Math.min(96, Math.max(12, Math.round((sec / totalDuration) * 100)));
              if (pct > job.progress) {
                updateJob({ progress: pct, stage: `Encoding frame at ${sec.toFixed(1)}s / ${totalDuration.toFixed(1)}s` });
              }
            }
          }
        }
      });

      proc.stderr.on('data', (chunk: Buffer) => {
        stderrTail = (stderrTail + chunk.toString()).slice(-1500);
      });

      proc.on('error', (err) => reject(err));
      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}: ${stderrTail.slice(-360)}`));
        }
      });
    });

    const stat = fs.statSync(outputPath);
    updateJob(
      {
        status: 'completed',
        progress: 100,
        stage: 'Render complete',
        fileSize: stat.size,
      },
      `Render completed successfully (${(stat.size / (1024 * 1024)).toFixed(2)} MB)`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    updateJob(
      {
        status: 'failed',
        stage: 'Render failed',
        error: message,
      },
      `ERROR: ${message}`
    );
  }
}
