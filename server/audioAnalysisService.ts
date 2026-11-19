import { spawn } from 'node:child_process';
import type { AudioAnalysisResult, AudioSection, BeatMarker } from '../src/types/studio.ts';

/**
 * Pure DSP beat & musical structure analyzer operating on mono Float32 PCM samples.
 * Exported directly so automated unit tests can verify BPM, beat accuracy, and energy curves.
 */
export function analyzePcmSamples(
  samples: Float32Array,
  sampleRate: number,
  assetId: string,
  sensitivity = 55
): AudioAnalysisResult {
  const duration = samples.length / Math.max(1, sampleRate);
  const hopSize = Math.max(128, Math.floor(sampleRate * 0.02)); // 20ms analysis frames (50 Hz)
  const frameSize = hopSize * 2;
  const frameCount = Math.max(1, Math.floor((samples.length - frameSize) / hopSize));

  // 1. Compute short-time RMS energy and peak amplitude
  const energies = new Float32Array(frameCount);
  let globalPeak = 0.00001;
  let maxEnergy = 0.00001;

  for (let f = 0; f < frameCount; f++) {
    const start = f * hopSize;
    let sumSq = 0;
    for (let i = 0; i < frameSize && start + i < samples.length; i++) {
      const s = samples[start + i];
      const abs = Math.abs(s);
      if (abs > globalPeak) globalPeak = abs;
      sumSq += s * s;
    }
    const rms = Math.sqrt(sumSq / frameSize);
    energies[f] = rms;
    if (rms > maxEnergy) maxEnergy = rms;
  }

  // Normalize energies 0..1
  for (let f = 0; f < frameCount; f++) {
    energies[f] /= maxEnergy;
  }

  // 2. Half-wave rectified energy flux (onset strength function)
  const onset = new Float32Array(frameCount);
  let maxOnset = 0.00001;
  for (let f = 1; f < frameCount; f++) {
    const diff = energies[f] - energies[f - 1];
    onset[f] = diff > 0 ? diff : 0;
    if (onset[f] > maxOnset) maxOnset = onset[f];
  }
  for (let f = 0; f < frameCount; f++) {
    onset[f] /= maxOnset;
  }

  // 3. Autocorrelation on onset curve to estimate BPM (range 68–178 BPM)
  const framesPerSec = sampleRate / hopSize;
  const minLag = Math.max(1, Math.floor((60 / 178) * framesPerSec));
  const maxLag = Math.min(frameCount - 1, Math.ceil((60 / 68) * framesPerSec));

  let bestLag = Math.round((60 / 120) * framesPerSec);
  let bestScore = -1;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    const limit = Math.min(frameCount - lag, 2500);
    for (let i = 0; i < limit; i++) {
      sum += onset[i] * onset[i + lag];
    }
    // Slight perceptual tempo prior around 95–135 BPM to avoid octave-double/half confusion
    const candidateBpm = (60 * framesPerSec) / lag;
    const prior = 1 + 0.12 * Math.exp(-Math.pow((candidateBpm - 118) / 38, 2));
    const score = (sum / Math.max(1, limit)) * prior;
    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  const bpm = Math.round(((60 * framesPerSec) / Math.max(1, bestLag)) * 10) / 10;

  // 4. Adaptive peak picking for beat positions
  const windowHalf = 8; // +/- 160ms local mean
  const thresholdFactor = 1.9 - (Math.max(10, Math.min(95, sensitivity)) / 100) * 1.1; // ~0.85..1.79
  const minBeatGapFrames = Math.max(4, Math.floor(bestLag * 0.45));

  const rawPeaks: Array<{ frame: number; strength: number }> = [];
  let lastPeakFrame = -minBeatGapFrames;

  for (let f = 2; f < frameCount - 2; f++) {
    const val = onset[f];
    if (val < 0.08) continue;
    if (val < onset[f - 1] || val < onset[f + 1]) continue;

    let localSum = 0;
    let count = 0;
    for (let k = Math.max(0, f - windowHalf); k <= Math.min(frameCount - 1, f + windowHalf); k++) {
      localSum += onset[k];
      count++;
    }
    const localMean = localSum / Math.max(1, count);
    if (val >= localMean * thresholdFactor && f - lastPeakFrame >= minBeatGapFrames) {
      rawPeaks.push({ frame: f, strength: Math.min(1, val * 0.7 + energies[f] * 0.3) });
      lastPeakFrame = f;
    }
  }

  // Build BeatMarker list with musical bar / downbeat grouping (4/4 meter)
  const beats: BeatMarker[] = rawPeaks.map((p, idx) => ({
    id: `beat_${idx}`,
    time: Math.round((p.frame / framesPerSec) * 1000) / 1000,
    strength: Math.round(p.strength * 1000) / 1000,
    isDownbeat: idx % 4 === 0,
    barIndex: Math.floor(idx / 4),
  }));

  // 5. Silence detection (contiguous segments with normalized energy < 0.05 for >= 0.4s)
  const silenceRanges: Array<{ start: number; end: number }> = [];
  let silStart: number | null = null;
  for (let f = 0; f < frameCount; f++) {
    if (energies[f] < 0.05) {
      if (silStart === null) silStart = f / framesPerSec;
    } else if (silStart !== null) {
      const endT = f / framesPerSec;
      if (endT - silStart >= 0.4) {
        silenceRanges.push({
          start: Math.round(silStart * 100) / 100,
          end: Math.round(endT * 100) / 100,
        });
      }
      silStart = null;
    }
  }

  // 6. Musical structure segmentation (Intro, Build-up, Drop, Chorus, Breakdown, Outro)
  const segmentSec = Math.max(2, Math.min(8, duration / 6));
  const numSegs = Math.max(1, Math.round(duration / segmentSec));
  const segEnergies: number[] = [];
  for (let s = 0; s < numSegs; s++) {
    const fStart = Math.floor((s / numSegs) * frameCount);
    const fEnd = Math.floor(((s + 1) / numSegs) * frameCount);
    let sum = 0;
    for (let f = fStart; f < fEnd; f++) sum += energies[f];
    segEnergies.push(sum / Math.max(1, fEnd - fStart));
  }
  const avgSegEnergy = segEnergies.reduce((a, b) => a + b, 0) / Math.max(1, segEnergies.length);

  const sections: AudioSection[] = segEnergies.map((e, idx) => {
    const start = Math.round(((idx / numSegs) * duration) * 100) / 100;
    const end = Math.round((((idx + 1) / numSegs) * duration) * 100) / 100;
    const prevE = idx > 0 ? segEnergies[idx - 1] : e;
    const nextE = idx < segEnergies.length - 1 ? segEnergies[idx + 1] : e;

    let label: AudioSection['label'] = 'Verse';
    if (idx === 0 && e < avgSegEnergy * 0.95) {
      label = 'Intro';
    } else if (idx === segEnergies.length - 1 && e < avgSegEnergy * 0.9) {
      label = 'Outro';
    } else if (e >= avgSegEnergy * 1.15 && e - prevE >= 0.14) {
      label = 'Drop';
    } else if (e >= avgSegEnergy * 1.12) {
      label = 'Chorus';
    } else if (nextE - e >= 0.12) {
      label = 'Build-up';
    } else if (e < avgSegEnergy * 0.72) {
      label = 'Breakdown';
    }

    return {
      id: `sec_${idx}`,
      label,
      start,
      end,
      energy: Math.round(e * 1000) / 1000,
    };
  });

  // 7. Downsampled waveform peaks & energy curve for timeline UI
  const peakBuckets = 240;
  const peaks: number[] = [];
  const samplesPerPeak = Math.max(1, Math.floor(samples.length / peakBuckets));
  for (let b = 0; b < peakBuckets; b++) {
    let pk = 0;
    const start = b * samplesPerPeak;
    const end = Math.min(samples.length, start + samplesPerPeak);
    const step = Math.max(1, Math.floor(samplesPerPeak / 64));
    for (let i = start; i < end; i += step) {
      const v = Math.abs(samples[i]);
      if (v > pk) pk = v;
    }
    peaks.push(Math.round((pk / globalPeak) * 1000) / 1000);
  }

  const curveBuckets = 80;
  const energyCurve: number[] = [];
  const framesPerCurve = Math.max(1, Math.floor(frameCount / curveBuckets));
  for (let c = 0; c < curveBuckets; c++) {
    let sum = 0;
    const s = c * framesPerCurve;
    const e = Math.min(frameCount, s + framesPerCurve);
    for (let f = s; f < e; f++) sum += energies[f];
    energyCurve.push(Math.round((sum / Math.max(1, e - s)) * 1000) / 1000);
  }

  const peakDb = Math.round(20 * Math.log10(Math.max(0.0001, globalPeak)) * 10) / 10;

  return {
    assetId,
    bpm,
    duration: Math.round(duration * 1000) / 1000,
    beats,
    sections,
    peaks,
    energyCurve,
    silenceRanges,
    peakDb,
    sensitivity,
    analyzedAt: new Date().toISOString(),
  };
}

export async function analyzeAudioFile(
  absolutePath: string,
  assetId: string,
  sensitivity = 55
): Promise<AudioAnalysisResult> {
  const sampleRate = 22050;
  const pcmBuffer = await new Promise<Buffer>((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-i',
      absolutePath,
      '-ac',
      '1',
      '-ar',
      String(sampleRate),
      '-f',
      'f32le',
      '-vn',
      'pipe:1',
    ]);
    const chunks: Buffer[] = [];
    let stderr = '';
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0 && chunks.length === 0) {
        reject(new Error(`FFmpeg failed to decode audio stream: ${stderr.slice(-240)}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
  });

  const sampleCount = Math.floor(pcmBuffer.byteLength / 4);
  if (sampleCount < 256) {
    throw new Error('Audio stream is empty or too short to analyze.');
  }
  const samples = new Float32Array(
    pcmBuffer.buffer,
    pcmBuffer.byteOffset,
    sampleCount
  );

  return analyzePcmSamples(samples, sampleRate, assetId, sensitivity);
}
