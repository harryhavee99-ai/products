import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import type {
  AudioAnalysisResult,
  BeatSyncMode,
  EditingPaceMode,
  MediaAsset,
  ProductAnalysisReport,
  StudioProject,
  TimelineClip,
} from '../src/types/studio.ts';
import { getCategoryMeta, TRANSITIONS_CATALOG } from '../src/data/catalogs.ts';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Add a valid Gemini API key in Settings > Secrets to run AI analysis and voiceover synthesis.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
}

function loadImageAsInlinePart(urlPath: string): { inlineData: { mimeType: string; data: string } } | null {
  try {
    const cleanRel = urlPath.replace(/^\/+/, '');
    const absPath = path.resolve(process.cwd(), cleanRel);
    if (!fs.existsSync(absPath)) return null;
    const ext = path.extname(absPath).toLowerCase();
    const mimeType =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : 'image/jpeg';
    const data = fs.readFileSync(absPath).toString('base64');
    return { inlineData: { mimeType, data } };
  } catch {
    return null;
  }
}

export async function analyzeProductMediaWithGemini(project: StudioProject): Promise<ProductAnalysisReport> {
  const ai = getGeminiClient();
  const category = getCategoryMeta(project.settings.productCategory);
  const visualAssets = project.assets.filter((a) => a.mediaType === 'video' || a.mediaType === 'image');
  if (visualAssets.length === 0) {
    throw new Error('Import at least one product video or image before running AI Product Analysis.');
  }

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];
  const assetInventoryLines: string[] = [];

  // Attach real extracted keyframes / product images (up to 10 frames across imported assets)
  let attachedImages = 0;
  for (const asset of visualAssets.slice(0, 8)) {
    assetInventoryLines.push(
      `- Asset ID: ${asset.id} | Name: "${asset.name}" | Type: ${asset.mediaType} | Duration: ${asset.duration.toFixed(2)}s | Resolution: ${asset.width ?? '?'}x${asset.height ?? '?'} | FPS: ${asset.fps ?? '?'} | HasAudio: ${Boolean(asset.hasAudio)}`
    );
    const frameCandidates = asset.keyframes?.length ? asset.keyframes : asset.thumbnailUrl ? [asset.thumbnailUrl] : [];
    for (const frameUrl of frameCandidates.slice(0, 2)) {
      if (attachedImages >= 10) break;
      const part = loadImageAsInlinePart(frameUrl);
      if (part) {
        parts.push({ text: `Frame from Asset ID "${asset.id}" ("${asset.name}"):` });
        parts.push(part);
        attachedImages++;
      }
    }
  }

  const audioAssets = project.assets.filter((a) => a.mediaType === 'audio');
  const audioSummary = audioAssets.length
    ? audioAssets.map((a) => `"${a.name}" (${a.duration.toFixed(1)}s)`).join(', ')
    : 'No separate audio tracks imported yet.';

  parts.push({
    text: `Analyze this commercial product footage for "${project.settings.productName || project.settings.projectName}" by brand "${project.settings.brandName || 'Unspecified'}" in category "${category.label}".

Imported Visual Assets:
${assetInventoryLines.join('\n')}

Imported Audio Assets:
${audioSummary}

Category Commercial Direction:
${category.cinematographyGuidance}

STRICT PRODUCT FIDELITY RULE:
1. Describe ONLY what is visually present in the provided frames and asset metadata.
2. NEVER invent product features, prices, discounts, ingredients, or marketing claims.
3. Recommend shot ordering, transitions, color grading look ID (choose one of: clean_commercial, luxury_cinematic, warm_lifestyle, cool_modern, vibrant_grocery, soft_beauty, fashion_editorial, premium_product, natural_realistic, high_contrast), music style, editing pace (fast, normal, or slow), and ideal duration strictly preserving the real product appearance, logo, packaging, colors, and proportions.
4. Reference ONLY valid Asset IDs from the list above.`,
  });

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: { parts },
    config: {
      systemInstruction:
        'You are a senior commercial film director, cinematographer, and colorist. Return strict JSON adhering to the schema. Never fabricate product claims or alter product identity.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          productIdentity: { type: Type.STRING },
          productAppearance: { type: Type.STRING },
          dominantColors: { type: Type.ARRAY, items: { type: Type.STRING } },
          packagingDetails: { type: Type.STRING },
          materials: { type: Type.ARRAY, items: { type: Type.STRING } },
          brandLogoDetected: { type: Type.STRING },
          cameraAnglesDetected: { type: Type.ARRAY, items: { type: Type.STRING } },
          visualQualityAssessment: { type: Type.STRING },
          audioContentNotes: { type: Type.STRING },
          fidelityConfirmation: { type: Type.STRING },
          recommendations: {
            type: Type.OBJECT,
            properties: {
              bestOpeningShotAssetId: { type: Type.STRING },
              bestOpeningShotReason: { type: Type.STRING },
              bestProductRevealAssetId: { type: Type.STRING },
              bestProductRevealReason: { type: Type.STRING },
              bestDetailShotAssetIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              bestClosingShotAssetId: { type: Type.STRING },
              bestClosingShotReason: { type: Type.STRING },
              transitionOpportunities: { type: Type.ARRAY, items: { type: Type.STRING } },
              suitableTextOverlays: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendedColorGrade: { type: Type.STRING },
              recommendedMusicStyle: { type: Type.STRING },
              recommendedPace: { type: Type.STRING },
              idealDurationSeconds: { type: Type.NUMBER },
            },
          },
          shotBreakdown: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                assetId: { type: Type.STRING },
                assetName: { type: Type.STRING },
                role: { type: Type.STRING },
                cameraAngle: { type: Type.STRING },
                recommendedIn: { type: Type.NUMBER },
                recommendedOut: { type: Type.NUMBER },
                notes: { type: Type.STRING },
              },
            },
          },
        },
      },
    },
  });

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText) as Omit<ProductAnalysisReport, 'analyzedAt' | 'modelUsed'>;
  return {
    ...parsed,
    analyzedAt: new Date().toISOString(),
    modelUsed: 'gemini-4-hydrogen',
  };
}

export interface AutoEditResult {
  clips: TimelineClip[];
  achievedDuration: number;
  targetDuration: number;
  footageShortfall: boolean;
  shortfallSeconds: number;
  shortfallAlternatives: string[];
  pacingNotes: string;
  beatSynced: boolean;
}

export async function generateAutoEditTimeline(params: {
  project: StudioProject;
  pace: EditingPaceMode;
  targetDuration: number;
  beatSyncMode: BeatSyncMode;
  useAiSequencing: boolean;
}): Promise<AutoEditResult> {
  const { project, pace, targetDuration, beatSyncMode, useAiSequencing } = params;
  const visualAssets = project.assets.filter((a) => a.mediaType === 'video' || a.mediaType === 'image');
  if (visualAssets.length === 0) {
    throw new Error('Import at least one product video or image before running AI Auto Edit.');
  }

  const category = getCategoryMeta(project.settings.productCategory);

  // Determine pace parameters
  const paceProfile =
    pace === 'fast'
      ? { minShot: 0.7, avgShot: 1.4, maxShot: 2.6, transChance: 0.7, speedRamp: 'pulse' as const }
      : pace === 'slow'
        ? { minShot: 2.5, avgShot: 4.5, maxShot: 8.0, transChance: 0.85, speedRamp: 'none' as const }
        : pace === 'custom'
          ? {
              minShot: Math.max(0.4, project.settings.customPace.minShotDuration),
              avgShot: Math.max(0.6, project.settings.customPace.avgShotDuration),
              maxShot: Math.max(1.0, project.settings.customPace.maxShotDuration),
              transChance: project.settings.customPace.transitionFrequency / 100,
              speedRamp: project.settings.customPace.speedRampIntensity > 45 ? ('ramp_in' as const) : ('none' as const),
            }
          : { minShot: 1.5, avgShot: 2.8, maxShot: 5.0, transChance: 0.65, speedRamp: 'none' as const };

  // Compute total real available footage WITHOUT duplicating or artificially stretching short clips
  const totalAvailableFootage = visualAssets.reduce((sum, a) => {
    // Still images can cleanly hold up to maxShot seconds with Ken Burns motion; videos cannot exceed source duration
    return sum + (a.mediaType === 'image' ? Math.min(paceProfile.maxShot, Math.max(3, a.duration)) : a.duration);
  }, 0);

  let orderedAssets: MediaAsset[] = [...visualAssets];
  let pacingNotes = `Arranged ${visualAssets.length} unique media assets using ${pace}-paced commercial structure for ${category.label}.`;

  // Use Gemini to intelligently rank/order shots when configured and requested
  if (useAiSequencing && isGeminiConfigured()) {
    try {
      const ai = getGeminiClient();
      const prompt = `Order these commercial product assets into the strongest advertisement sequence (Opening Hook -> Product Reveal -> Key Details -> Closing Hero) for a ${targetDuration}s ${pace}-paced ${category.label} commercial.
Never repeat or duplicate an assetId.
Assets:
${visualAssets.map((a) => `- ${a.id}: "${a.name}" (${a.mediaType}, ${a.duration.toFixed(1)}s)`).join('\n')}
${project.productAnalysis ? `\nPrevious Product Analysis Opening: ${project.productAnalysis.recommendations.bestOpeningShotAssetId}, Reveal: ${project.productAnalysis.recommendations.bestProductRevealAssetId}, Closing: ${project.productAnalysis.recommendations.bestClosingShotAssetId}` : ''}
Return JSON with orderedAssetIds (array of unique IDs) and pacingNotes (short 1-2 sentence director rationale).`;

      const resp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              orderedAssetIds: { type: Type.ARRAY, items: { type: Type.STRING } },
              pacingNotes: { type: Type.STRING },
            },
          },
        },
      });
      const data = JSON.parse((resp.text ?? '{}').trim()) as {
        orderedAssetIds?: string[];
        pacingNotes?: string;
      };
      if (Array.isArray(data.orderedAssetIds) && data.orderedAssetIds.length > 0) {
        const assetById = new Map(visualAssets.map((a) => [a.id, a]));
        const seen = new Set<string>();
        const aiOrdered: MediaAsset[] = [];
        for (const id of data.orderedAssetIds) {
          const found = assetById.get(id);
          if (found && !seen.has(id)) {
            seen.add(id);
            aiOrdered.push(found);
          }
        }
        for (const a of visualAssets) {
          if (!seen.has(a.id)) aiOrdered.push(a);
        }
        orderedAssets = aiOrdered;
        if (data.pacingNotes) pacingNotes = data.pacingNotes;
      }
    } catch {
      // Fall back to existing product analysis or import order if AI sequencing call fails
    }
  } else if (project.productAnalysis?.shotBreakdown?.length) {
    const priorityOrder = ['opening', 'reveal', 'detail', 'lifestyle', 'supporting', 'closing'];
    const breakdownMap = new Map(project.productAnalysis.shotBreakdown.map((s) => [s.assetId, s]));
    orderedAssets.sort((a, b) => {
      const ra = priorityOrder.indexOf(breakdownMap.get(a.id)?.role ?? 'supporting');
      const rb = priorityOrder.indexOf(breakdownMap.get(b.id)?.role ?? 'supporting');
      return ra - rb;
    });
  }

  // Beat snap points from analyzed audio
  const audioAnalysis: AudioAnalysisResult | undefined = project.audioAnalysis;
  const beatTimes = (audioAnalysis?.beats ?? [])
    .filter((b) => (beatSyncMode === 'strict' ? true : beatSyncMode === 'intelligent' ? b.strength >= 0.45 || b.isDownbeat : b.isDownbeat))
    .map((b) => b.time)
    .sort((a, b) => a - b);

  const snapToNearestBeat = (t: number, minT: number, maxT: number): number => {
    if (beatTimes.length === 0) return t;
    let best = t;
    let bestDist = Infinity;
    for (const bt of beatTimes) {
      if (bt < minT || bt > maxT) continue;
      const dist = Math.abs(bt - t);
      if (dist < bestDist && dist <= 0.75) {
        bestDist = dist;
        best = bt;
      }
    }
    return best;
  };

  const transitionPool = category.recommendedTransitions
    .map((id) => TRANSITIONS_CATALOG.find((t) => t.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  const fallbackTransition = TRANSITIONS_CATALOG[0];

  const clips: TimelineClip[] = [];
  let cursor = 0;

  // NEVER silently duplicate shots! Allocate duration proportionally up to each clip's true source duration.
  const desiredPerClip = targetDuration / Math.max(1, orderedAssets.length);
  const motions = ['slow_zoom_in', 'pan_right', 'slow_zoom_out', 'pan_left', 'cinematic_reveal'] as const;

  for (let i = 0; i < orderedAssets.length; i++) {
    if (cursor >= targetDuration - 0.15) break;
    const asset = orderedAssets[i];
    const remaining = targetDuration - cursor;
    const remainingAssets = orderedAssets.length - i;
    const rawTarget = Math.min(
      remaining,
      Math.max(paceProfile.minShot, Math.min(paceProfile.maxShot, remaining / remainingAssets || desiredPerClip))
    );

    const maxClipLen = asset.mediaType === 'image' ? Math.max(paceProfile.maxShot, 6) : asset.duration;
    let clipDur = Math.min(maxClipLen, rawTarget);
    if (clipDur < 0.35) continue;

    // Snap clip end to music beat if audio is analyzed
    if (beatTimes.length > 0 && i < orderedAssets.length - 1) {
      const snappedEnd = snapToNearestBeat(
        cursor + clipDur,
        cursor + Math.min(paceProfile.minShot, maxClipLen),
        cursor + Math.min(maxClipLen, remaining)
      );
      clipDur = Math.max(0.4, Math.min(maxClipLen, snappedEnd - cursor));
    }

    const useTransition = i > 0 && (transitionPool.length > 0 || fallbackTransition);
    const chosenTrans = transitionPool[i % Math.max(1, transitionPool.length)] ?? fallbackTransition;

    const clip: TimelineClip = {
      id: `clip_${Date.now()}_${i}`,
      trackId: 'v1',
      assetId: asset.id,
      name: asset.name,
      mediaType: asset.mediaType,
      startTime: Math.round(cursor * 1000) / 1000,
      duration: Math.round(clipDur * 1000) / 1000,
      inPoint: 0,
      outPoint: Math.round(clipDur * 1000) / 1000,
      sourceDuration: asset.duration,
      speed: 1,
      speedRamp: i > 0 && pace === 'fast' && i % 2 === 1 ? paceProfile.speedRamp : 'none',
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
      muted: Boolean(project.assets.some((a) => a.mediaType === 'audio')),
      duckOnVoiceover: false,
      imageMotion: asset.mediaType === 'image' ? motions[i % motions.length] : 'none',
      transitionIn: useTransition
        ? {
            id: chosenTrans.id,
            name: chosenTrans.name,
            category: chosenTrans.category,
            duration: Math.min(chosenTrans.defaultDuration, clipDur * 0.4),
            direction: 'left',
            intensity: pace === 'fast' ? 80 : 55,
            timing: 'ease-in-out',
          }
        : undefined,
      isAiGenerated: asset.isAiGenerated,
    };

    clips.push(clip);
    cursor += clipDur;
  }

  // Also place primary imported music track on A1 trimmed to match commercial duration
  const musicAsset = project.assets.find((a) => a.mediaType === 'audio' && (a.bin === 'music' || a.bin === 'audio'));
  if (musicAsset) {
    const audioDur = Math.min(musicAsset.duration, Math.max(cursor, 1));
    clips.push({
      id: `clip_audio_${Date.now()}`,
      trackId: 'a1',
      assetId: musicAsset.id,
      name: musicAsset.name,
      mediaType: 'audio',
      startTime: 0,
      duration: Math.round(audioDur * 1000) / 1000,
      inPoint: 0,
      outPoint: Math.round(audioDur * 1000) / 1000,
      sourceDuration: musicAsset.duration,
      speed: 1,
      opacity: 100,
      scale: 100,
      positionX: 0,
      positionY: 0,
      rotation: 0,
      cropFocusX: 50,
      cropFocusY: 50,
      volume: 85,
      fadeIn: 0.4,
      fadeOut: Math.min(1.5, audioDur * 0.2),
      muted: false,
      duckOnVoiceover: true,
      imageMotion: 'none',
    });
  }

  const achievedDuration = Math.round(cursor * 100) / 100;
  const shortfallSeconds = Math.max(0, Math.round((targetDuration - achievedDuration) * 100) / 100);
  const footageShortfall = shortfallSeconds > 1.0 && totalAvailableFootage < targetDuration;

  const shortfallAlternatives = footageShortfall
    ? [
        `Import at least ${Math.ceil(shortfallSeconds)}s of additional product video clips to reach ${targetDuration}s without repeating shots.`,
        'Add high-resolution product stills and animate them with Slow Zoom, Pan, or Parallax motion.',
        `Switch the target commercial duration to ${Math.max(5, Math.floor(achievedDuration))}s to match your real source footage cleanly.`,
      ]
    : [];

  return {
    clips,
    achievedDuration,
    targetDuration,
    footageShortfall,
    shortfallSeconds,
    shortfallAlternatives,
    pacingNotes,
    beatSynced: beatTimes.length > 0,
  };
}

export async function generateVoiceoverTts(params: {
  text: string;
  voiceName: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  style: string;
}): Promise<Buffer> {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash-lite-tts',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: params.text,
            speechMetadata: {
              style: params.style || 'Clear, warm commercial narrator',
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: params.voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) {
    throw new Error('Gemini TTS did not return audio data. Please try again with shorter script text.');
  }
  return Buffer.from(base64Audio, 'base64');
}
