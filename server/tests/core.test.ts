import assert from 'node:assert/strict';
import test from 'node:test';
import type { StudioProject } from '../../src/types/studio.ts';
import {
  DEFAULT_COLOR_GRADING,
  createDefaultProjectSettings,
  createDefaultTracks,
} from '../../src/data/catalogs.ts';
import { analyzePcmSamples } from '../audioAnalysisService.ts';
import {
  generatePremiereXmlExport,
  getTimebaseAndNtsc,
  secondsToFrames,
  validatePremiereXmeml,
} from '../premiereXml.ts';
import { generateAutoEditTimeline } from '../aiService.ts';

function buildFixtureProject(): StudioProject {
  return {
    id: 'proj_test_001',
    settings: createDefaultProjectSettings({
      projectName: 'Obsidian Watch Launch',
      productName: 'Chrono One',
      productCategory: 'jewellery_watches',
      brandName: 'Atelier Horology',
      resolution: '4K_UHD',
      fps: 29.97,
      aspectRatio: '16:9',
      targetDuration: 15,
    }),
    assets: [
      {
        id: 'asset_v1',
        projectId: 'proj_test_001',
        name: 'Dial Macro Orbit',
        originalFilename: 'dial_macro.mp4',
        bin: 'video',
        folder: 'Root',
        mediaType: 'video',
        mimeType: 'video/mp4',
        fileSize: 12_000_000,
        filePath: 'storage/media/proj_test_001/dial_macro.mp4',
        url: '/storage/media/proj_test_001/dial_macro.mp4',
        proxyStatus: 'none',
        duration: 6.0,
        width: 3840,
        height: 2160,
        fps: 29.97,
        videoCodec: 'h264',
        hasAudio: false,
        labelColor: '#7C3AED',
        markers: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'asset_v2',
        projectId: 'proj_test_001',
        name: 'Clasp Close-Up',
        originalFilename: 'clasp_detail.mp4',
        bin: 'video',
        folder: 'Root',
        mediaType: 'video',
        mimeType: 'video/mp4',
        fileSize: 9_000_000,
        filePath: 'storage/media/proj_test_001/clasp_detail.mp4',
        url: '/storage/media/proj_test_001/clasp_detail.mp4',
        proxyStatus: 'none',
        duration: 4.0,
        width: 3840,
        height: 2160,
        fps: 29.97,
        videoCodec: 'h264',
        hasAudio: false,
        labelColor: '#7C3AED',
        markers: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: 'asset_a1',
        projectId: 'proj_test_001',
        name: 'Luxury Pulse Soundtrack',
        originalFilename: 'luxury_pulse.wav',
        bin: 'music',
        folder: 'Root',
        mediaType: 'audio',
        mimeType: 'audio/wav',
        fileSize: 5_000_000,
        filePath: 'storage/media/proj_test_001/luxury_pulse.wav',
        url: '/storage/media/proj_test_001/luxury_pulse.wav',
        proxyStatus: 'none',
        duration: 30.0,
        audioCodec: 'pcm_s16le',
        audioChannels: 2,
        sampleRate: 48000,
        hasAudio: true,
        labelColor: '#10B981',
        markers: [],
        createdAt: new Date().toISOString(),
      },
    ],
    tracks: createDefaultTracks(),
    clips: [
      {
        id: 'clip_1',
        trackId: 'v1',
        assetId: 'asset_v1',
        name: 'Dial Macro Orbit',
        mediaType: 'video',
        startTime: 0,
        duration: 5.0,
        inPoint: 0,
        outPoint: 5.0,
        sourceDuration: 6.0,
        speed: 1,
        opacity: 100,
        scale: 105,
        positionX: 0,
        positionY: 0,
        rotation: 0,
        cropFocusX: 50,
        cropFocusY: 50,
        volume: 100,
        fadeIn: 0,
        fadeOut: 0,
        muted: true,
        duckOnVoiceover: false,
        imageMotion: 'none',
      },
      {
        id: 'clip_2',
        trackId: 'v1',
        assetId: 'asset_v2',
        name: 'Clasp Close-Up',
        mediaType: 'video',
        startTime: 5.0,
        duration: 4.0,
        inPoint: 0,
        outPoint: 4.0,
        sourceDuration: 4.0,
        speed: 1,
        opacity: 100,
        scale: 100,
        positionX: 0,
        positionY: 0,
        rotation: 0,
        cropFocusX: 50,
        cropFocusY: 50,
        volume: 100,
        fadeIn: 0,
        fadeOut: 0,
        muted: true,
        duckOnVoiceover: false,
        imageMotion: 'none',
        transitionIn: {
          id: 'cross_dissolve',
          name: 'Cross Dissolve',
          category: 'smooth',
          duration: 0.6,
          direction: 'center',
          intensity: 60,
          timing: 'ease-in-out',
        },
      },
      {
        id: 'clip_a1',
        trackId: 'a1',
        assetId: 'asset_a1',
        name: 'Luxury Pulse Soundtrack',
        mediaType: 'audio',
        startTime: 0,
        duration: 9.0,
        inPoint: 0,
        outPoint: 9.0,
        sourceDuration: 30.0,
        speed: 1,
        opacity: 100,
        scale: 100,
        positionX: 0,
        positionY: 0,
        rotation: 0,
        cropFocusX: 50,
        cropFocusY: 50,
        volume: 85,
        fadeIn: 0.5,
        fadeOut: 1.0,
        muted: false,
        duckOnVoiceover: true,
        imageMotion: 'none',
      },
    ],
    overlays: [
      {
        id: 'ov_1',
        trackId: 'gfx1',
        type: 'product_title',
        text: 'Chrono One',
        startTime: 1.0,
        duration: 3.5,
        x: 50,
        y: 80,
        fontFamily: 'Plus Jakarta Sans',
        fontSize: 48,
        color: '#FFFFFF',
        backgroundColor: '#000000',
        backgroundOpacity: 0.4,
        strokeColor: '#000000',
        strokeWidth: 0,
        shadow: true,
        opacity: 100,
        animation: 'fade',
      },
    ],
    markers: [
      { id: 'm1', time: 5.0, name: 'Product Reveal', comment: 'Clasp cut', color: '#7C3AED' },
    ],
    colorGrading: { ...DEFAULT_COLOR_GRADING, lookPreset: 'luxury_cinematic', contrast: 20, vignette: 24 },
    beatSyncMode: 'intelligent',
    versions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test('Beat detection accurately measures 120 BPM on synthesized pulse train', () => {
  const sampleRate = 22050;
  const durationSec = 10;
  const totalSamples = sampleRate * durationSec;
  const pcm = new Float32Array(totalSamples);
  // Synthesize strong percussion impulse every 0.5s (= 120 BPM)
  const beatIntervalSamples = Math.round(sampleRate * 0.5);
  for (let pos = 0; pos < totalSamples; pos += beatIntervalSamples) {
    for (let i = 0; i < 1200 && pos + i < totalSamples; i++) {
      const env = Math.exp(-i / 220);
      pcm[pos + i] = env * Math.sin((2 * Math.PI * 110 * i) / sampleRate);
    }
  }
  const result = analyzePcmSamples(pcm, sampleRate, 'synth_120bpm', 60);
  assert.ok(result.bpm >= 115 && result.bpm <= 125, `Expected BPM near 120, got ${result.bpm}`);
  assert.ok(result.beats.length >= 14, `Expected >= 14 beats detected, got ${result.beats.length}`);
  assert.ok(result.sections.length >= 1, 'Expected structural audio sections');
  assert.ok(result.peaks.length === 240, 'Expected 240 waveform peaks');
});

test('Premiere XML timebase and NTSC frame calculations are frame-accurate', () => {
  assert.deepEqual(getTimebaseAndNtsc(29.97), { timebase: 30, ntsc: true });
  assert.deepEqual(getTimebaseAndNtsc(23.976), { timebase: 24, ntsc: true });
  assert.deepEqual(getTimebaseAndNtsc(25), { timebase: 25, ntsc: false });
  assert.deepEqual(getTimebaseAndNtsc(60), { timebase: 60, ntsc: false });

  assert.equal(secondsToFrames(2.0, 30), 60);
  assert.equal(secondsToFrames(10.0, 29.97), 300);
});

test('Premiere Pro FCP 7 XMEML export passes structural validation and reports unsupported effects honestly', () => {
  const project = buildFixtureProject();
  const result = generatePremiereXmlExport(project, { packageRelativePaths: true });
  assert.equal(result.isValid, true, `Validation errors: ${result.validationErrors.join('; ')}`);
  const recheck = validatePremiereXmeml(result.xml);
  assert.equal(recheck.isValid, true);
  assert.ok(result.xml.includes('<xmeml version="4">'));
  assert.ok(result.xml.includes('<ntsc>TRUE</ntsc>'));
  assert.ok(result.xml.includes('<transitionitem>'));
  assert.ok(result.xml.includes('<marker>'));
  assert.ok(result.compatibilityReport.nativeCount > 0);
  assert.ok(result.compatibilityReport.manifestOnlyCount >= 2, 'Color grade & motion overlay must be transparently reported as manifest_only');
});

test('Auto-edit engine never silently duplicates clips when source footage is shorter than target duration', async () => {
  const project = buildFixtureProject();
  // Available visual footage = 6.0s + 4.0s = 10.0s, target = 30s
  const auto = await generateAutoEditTimeline({
    project,
    pace: 'normal',
    targetDuration: 30,
    beatSyncMode: 'intelligent',
    useAiSequencing: false,
  });

  const visualClips = auto.clips.filter((c) => c.mediaType !== 'audio');
  const uniqueAssets = new Set(visualClips.map((c) => c.assetId));
  assert.equal(visualClips.length, uniqueAssets.size, 'Auto-edit must never silently duplicate shots');
  assert.equal(auto.footageShortfall, true, 'Must honestly flag footage shortfall');
  assert.ok(auto.shortfallSeconds > 15, 'Shortfall seconds should reflect remaining duration');
  assert.ok(auto.shortfallAlternatives.length >= 2, 'Must offer actionable alternatives to the user');
});
