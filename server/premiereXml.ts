import path from 'node:path';
import type {
  PremiereCompatibilityItem,
  PremiereExportResult,
  StudioProject,
  TimelineClip,
} from '../src/types/studio.ts';
import { TRANSITIONS_CATALOG } from '../src/data/catalogs.ts';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function getTimebaseAndNtsc(fps: number): { timebase: number; ntsc: boolean } {
  const ntscRates = [23.976, 29.97, 59.94];
  const isNtsc = ntscRates.some((r) => Math.abs(fps - r) < 0.05);
  const timebase = Math.round(fps);
  return { timebase: Math.max(1, timebase), ntsc: isNtsc };
}

export function secondsToFrames(seconds: number, fps: number): number {
  const { timebase, ntsc } = getTimebaseAndNtsc(fps);
  const effectiveRate = ntsc ? (timebase * 1000) / 1001 : timebase;
  return Math.max(0, Math.round(seconds * effectiveRate));
}

function toPremiereFileUrl(relPath: string, useRelativePackagePath: boolean): string {
  const normalized = useRelativePackagePath
    ? `media/${path.basename(relPath)}`
    : path.resolve(process.cwd(), relPath);
  const forward = normalized.split(path.sep).join('/');
  const encoded = forward
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return useRelativePackagePath ? `file://localhost/./${encoded}` : `file://localhost/${encoded.replace(/^\/+/, '')}`;
}

export function validatePremiereXmeml(xml: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!xml.includes('<?xml version="1.0" encoding="UTF-8"?>')) {
    errors.push('Missing XML 1.0 UTF-8 declaration.');
  }
  if (!xml.includes('<!DOCTYPE xmeml>')) {
    errors.push('Missing Final Cut Pro 7 XMEML DOCTYPE.');
  }
  if (!xml.includes('<xmeml version="4">') || !xml.includes('</xmeml>')) {
    errors.push('Missing root <xmeml version="4"> container.');
  }
  if (!xml.includes('<sequence') || !xml.includes('</sequence>')) {
    errors.push('Missing <sequence> element.');
  }
  if (!xml.includes('<rate>') || !xml.includes('<timebase>')) {
    errors.push('Missing sequence <rate><timebase> definition.');
  }
  if (!xml.includes('<video>') || !xml.includes('<audio>')) {
    errors.push('Missing <video> or <audio> media track groups.');
  }
  // Verify balanced major tags
  const requiredBalanced = ['xmeml', 'sequence', 'media', 'video', 'audio'];
  for (const tag of requiredBalanced) {
    const openCount = (xml.match(new RegExp(`<${tag}(\\s|>)`, 'g')) ?? []).length;
    const closeCount = (xml.match(new RegExp(`</${tag}>`, 'g')) ?? []).length;
    if (openCount === 0 || openCount !== closeCount) {
      errors.push(`Unbalanced <${tag}> tags (open: ${openCount}, close: ${closeCount}).`);
    }
  }
  return { isValid: errors.length === 0, errors };
}

export function generatePremiereXmlExport(
  project: StudioProject,
  options?: { packageRelativePaths?: boolean }
): PremiereExportResult {
  const packageRelative = options?.packageRelativePaths ?? false;
  const { width, height, fps, projectName } = project.settings;
  const { timebase, ntsc } = getTimebaseAndNtsc(fps);
  const ntscTag = ntsc ? 'TRUE' : 'FALSE';

  const compatibilityItems: PremiereCompatibilityItem[] = [];
  const assetMap = new Map(project.assets.map((a) => [a.id, a]));
  const emittedFileIds = new Set<string>();

  const maxClipEnd = project.clips.reduce((acc, c) => Math.max(acc, c.startTime + c.duration), 0);
  const maxOverlayEnd = project.overlays.reduce((acc, o) => Math.max(acc, o.startTime + o.duration), 0);
  const totalDurationSec = Math.max(project.settings.targetDuration, maxClipEnd, maxOverlayEnd, 1);
  const totalFrames = secondsToFrames(totalDurationSec, fps);

  compatibilityItems.push({
    category: 'sequence',
    name: `${projectName} (${width}×${height} @ ${fps} fps)`,
    status: 'native',
    details: `Mapped to FCP7 XMEML v4 sequence with timebase ${timebase} and NTSC=${ntscTag}.`,
  });

  const videoTracks = project.tracks.filter((t) => t.type === 'video');
  const audioTracks = project.tracks.filter((t) => t.type === 'audio');

  const buildFileBlock = (assetId: string, isAudioOnly: boolean): string => {
    const fileXmlId = `file-${assetId}`;
    if (emittedFileIds.has(fileXmlId)) {
      return `            <file id="${escapeXml(fileXmlId)}"/>`;
    }
    emittedFileIds.add(fileXmlId);
    const asset = assetMap.get(assetId);
    if (!asset) {
      return `            <file id="${escapeXml(fileXmlId)}"/>`;
    }
    const fileFps = asset.fps ?? fps;
    const fileRate = getTimebaseAndNtsc(fileFps);
    const fileFrames = Math.max(1, secondsToFrames(asset.duration || 5, fileFps));
    const pathUrl = toPremiereFileUrl(asset.filePath, packageRelative);

    return `            <file id="${escapeXml(fileXmlId)}">
              <name>${escapeXml(asset.originalFilename)}</name>
              <pathurl>${escapeXml(pathUrl)}</pathurl>
              <rate>
                <timebase>${fileRate.timebase}</timebase>
                <ntsc>${fileRate.ntsc ? 'TRUE' : 'FALSE'}</ntsc>
              </rate>
              <duration>${fileFrames}</duration>
              <media>${
                !isAudioOnly
                  ? `
                <video>
                  <samplecharacteristics>
                    <width>${asset.width ?? width}</width>
                    <height>${asset.height ?? height}</height>
                  </samplecharacteristics>
                </video>`
                  : ''
              }${
                asset.hasAudio || asset.mediaType === 'audio'
                  ? `
                <audio>
                  <samplecharacteristics>
                    <depth>16</depth>
                    <samplerate>${asset.sampleRate ?? 48000}</samplerate>
                  </samplecharacteristics>
                  <channelcount>${asset.audioChannels ?? 2}</channelcount>
                </audio>`
                  : ''
              }
              </media>
            </file>`;
  };

  const buildVideoFilters = (clip: TimelineClip): string => {
    const filters: string[] = [];

    // Native Basic Motion (scale, center, rotation)
    if (clip.scale !== 100 || clip.positionX !== 0 || clip.positionY !== 0 || clip.rotation !== 0) {
      filters.push(`            <filter>
              <effect>
                <name>Basic Motion</name>
                <effectid>basic</effectid>
                <effectcategory>motion</effectcategory>
                <effecttype>motion</effecttype>
                <mediatype>video</mediatype>
                <parameter>
                  <parameterid>scale</parameterid>
                  <name>Scale</name>
                  <valuemin>0</valuemin>
                  <valuemax>1000</valuemax>
                  <value>${clip.scale.toFixed(2)}</value>
                </parameter>
                <parameter>
                  <parameterid>rotation</parameterid>
                  <name>Rotation</name>
                  <valuemin>-8640</valuemin>
                  <valuemax>8640</valuemax>
                  <value>${clip.rotation.toFixed(2)}</value>
                </parameter>
                <parameter>
                  <parameterid>center</parameterid>
                  <name>Center</name>
                  <value>
                    <horiz>${(clip.positionX / 100).toFixed(4)}</horiz>
                    <vert>${(clip.positionY / 100).toFixed(4)}</vert>
                  </value>
                </parameter>
              </effect>
            </filter>`);
      compatibilityItems.push({
        category: 'effect',
        name: `Basic Motion on "${clip.name}"`,
        status: 'native',
        details: `Scale ${clip.scale}%, Position (${clip.positionX}%, ${clip.positionY}%), Rotation ${clip.rotation}° exported natively.`,
      });
    }

    // Native Opacity
    if (clip.opacity < 100) {
      filters.push(`            <filter>
              <effect>
                <name>Opacity</name>
                <effectid>opacity</effectid>
                <effectcategory>motion</effectcategory>
                <effecttype>motion</effecttype>
                <mediatype>video</mediatype>
                <parameter>
                  <parameterid>opacity</parameterid>
                  <name>opacity</name>
                  <valuemin>0</valuemin>
                  <valuemax>100</valuemax>
                  <value>${clip.opacity.toFixed(2)}</value>
                </parameter>
              </effect>
            </filter>`);
      compatibilityItems.push({
        category: 'effect',
        name: `Opacity (${clip.opacity}%) on "${clip.name}"`,
        status: 'native',
        details: 'Exported as native Premiere Opacity motion filter.',
      });
    }

    // Native Time Remap / Speed
    if (Math.abs(clip.speed - 1) > 0.01) {
      filters.push(`            <filter>
              <effect>
                <name>Time Remap</name>
                <effectid>timeremap</effectid>
                <effectcategory>motion</effectcategory>
                <effecttype>motion</effecttype>
                <mediatype>video</mediatype>
                <parameter>
                  <parameterid>speed</parameterid>
                  <name>speed</name>
                  <value>${Math.round(clip.speed * 100)}</value>
                </parameter>
              </effect>
            </filter>`);
      compatibilityItems.push({
        category: 'effect',
        name: `Speed ${clip.speed}x on "${clip.name}"`,
        status: clip.speedRamp && clip.speedRamp !== 'none' ? 'approximated' : 'native',
        details:
          clip.speedRamp && clip.speedRamp !== 'none'
            ? `Constant speed (${Math.round(clip.speed * 100)}%) mapped to Time Remap; custom speed ramp curve "${clip.speedRamp}" preserved in effect manifest.`
            : `Mapped natively to Premiere Time Remap (${Math.round(clip.speed * 100)}%).`,
      });
    }

    // Image motion keyframes (Ken Burns / Pan / Zoom)
    if (clip.mediaType === 'image' && clip.imageMotion !== 'none') {
      const startFrame = secondsToFrames(clip.inPoint, fps);
      const endFrame = secondsToFrames(clip.inPoint + clip.duration, fps);
      const startScale = clip.imageMotion === 'slow_zoom_out' ? 116 : 100;
      const endScale = clip.imageMotion === 'slow_zoom_in' || clip.imageMotion === 'cinematic_reveal' ? 116 : 100;
      const startHoriz = clip.imageMotion === 'pan_left' ? 0.05 : clip.imageMotion === 'pan_right' ? -0.05 : 0;
      const endHoriz = clip.imageMotion === 'pan_left' ? -0.05 : clip.imageMotion === 'pan_right' ? 0.05 : 0;
      filters.push(`            <filter>
              <effect>
                <name>Basic Motion</name>
                <effectid>basic</effectid>
                <effectcategory>motion</effectcategory>
                <effecttype>motion</effecttype>
                <mediatype>video</mediatype>
                <parameter>
                  <parameterid>scale</parameterid>
                  <name>Scale</name>
                  <keyframe>
                    <when>${startFrame}</when>
                    <value>${startScale}</value>
                  </keyframe>
                  <keyframe>
                    <when>${endFrame}</when>
                    <value>${endScale}</value>
                  </keyframe>
                </parameter>
                <parameter>
                  <parameterid>center</parameterid>
                  <name>Center</name>
                  <keyframe>
                    <when>${startFrame}</when>
                    <value><horiz>${startHoriz}</horiz><vert>0</vert></value>
                  </keyframe>
                  <keyframe>
                    <when>${endFrame}</when>
                    <value><horiz>${endHoriz}</horiz><vert>0</vert></value>
                  </keyframe>
                </parameter>
              </effect>
            </filter>`);
      compatibilityItems.push({
        category: 'effect',
        name: `Image Motion (${clip.imageMotion}) on "${clip.name}"`,
        status: 'native',
        details: 'Converted to Basic Motion scale/center keyframes in Premiere XML.',
      });
    }

    return filters.join('\n');
  };

  const buildVideoTracksXml = (): string => {
    return videoTracks
      .map((track) => {
        const trackClips = project.clips
          .filter((c) => c.trackId === track.id)
          .sort((a, b) => a.startTime - b.startTime);

        const itemsXml: string[] = [];
        for (const clip of trackClips) {
          const startFrame = secondsToFrames(clip.startTime, fps);
          const endFrame = secondsToFrames(clip.startTime + clip.duration, fps);
          const inFrame = secondsToFrames(clip.inPoint, fps);
          const outFrame = secondsToFrames(clip.outPoint, fps);
          const clipDurationFrames = Math.max(1, endFrame - startFrame);

          if (clip.transitionIn) {
            const catItem = TRANSITIONS_CATALOG.find((t) => t.id === clip.transitionIn?.id);
            const transHalf = Math.max(1, Math.round(secondsToFrames(clip.transitionIn.duration, fps) / 2));
            const tStart = Math.max(0, startFrame - transHalf);
            const tEnd = startFrame + transHalf;
            const isNative = catItem?.premiereNative ?? false;
            const effectName =
              clip.transitionIn.id === 'dip_to_black'
                ? 'Dip to Color Dissolve'
                : clip.transitionIn.id === 'swipe'
                  ? 'Wipe'
                  : 'Cross Dissolve';
            const effectId =
              clip.transitionIn.id === 'dip_to_black'
                ? 'Dip to Color Dissolve'
                : clip.transitionIn.id === 'swipe'
                  ? 'Wipe'
                  : 'Cross Dissolve';

            itemsXml.push(`          <transitionitem>
            <start>${tStart}</start>
            <end>${tEnd}</end>
            <alignment>center</alignment>
            <rate>
              <timebase>${timebase}</timebase>
              <ntsc>${ntscTag}</ntsc>
            </rate>
            <effect>
              <name>${escapeXml(effectName)}</name>
              <effectid>${escapeXml(effectId)}</effectid>
              <effectcategory>Dissolve</effectcategory>
              <effecttype>transition</effecttype>
              <mediatype>video</mediatype>
            </effect>
          </transitionitem>`);

            compatibilityItems.push({
              category: 'transition',
              name: `${clip.transitionIn.name} before "${clip.name}"`,
              status: isNative ? 'native' : 'approximated',
              details: isNative
                ? `Exported as native Premiere "${effectName}" transition (${clip.transitionIn.duration}s).`
                : `Premiere XMEML does not natively store custom "${clip.transitionIn.name}"; exported as "${effectName}" placeholder with full parameters preserved in effect-manifest.json.`,
            });
          }

          const filtersXml = buildVideoFilters(clip);
          itemsXml.push(`          <clipitem id="clipitem-${escapeXml(clip.id)}">
            <name>${escapeXml(clip.name)}</name>
            <enabled>${track.visible ? 'TRUE' : 'FALSE'}</enabled>
            <duration>${clipDurationFrames}</duration>
            <rate>
              <timebase>${timebase}</timebase>
              <ntsc>${ntscTag}</ntsc>
            </rate>
            <start>${startFrame}</start>
            <end>${endFrame}</end>
            <in>${inFrame}</in>
            <out>${outFrame}</out>
${buildFileBlock(clip.assetId, false)}${filtersXml ? '\n' + filtersXml : ''}
          </clipitem>`);

          compatibilityItems.push({
            category: 'clip',
            name: clip.name,
            status: 'native',
            details: `Frame-accurate video placement [${startFrame}..${endFrame}] (in ${inFrame}, out ${outFrame}).`,
          });
        }

        return `        <track>
          <enabled>${track.visible ? 'TRUE' : 'FALSE'}</enabled>
          <locked>${track.locked ? 'TRUE' : 'FALSE'}</locked>
${itemsXml.join('\n')}
        </track>`;
      })
      .join('\n');
  };

  const buildAudioTracksXml = (): string => {
    return audioTracks
      .map((track) => {
        const trackClips = project.clips
          .filter((c) => c.trackId === track.id)
          .sort((a, b) => a.startTime - b.startTime);

        const itemsXml = trackClips.map((clip) => {
          const startFrame = secondsToFrames(clip.startTime, fps);
          const endFrame = secondsToFrames(clip.startTime + clip.duration, fps);
          const inFrame = secondsToFrames(clip.inPoint, fps);
          const outFrame = secondsToFrames(clip.outPoint, fps);
          const clipDurationFrames = Math.max(1, endFrame - startFrame);
          const gainLinear = Math.max(0, (clip.volume / 100) * (track.volume / 100));

          const fadeKeyframes: string[] = [];
          if (clip.fadeIn > 0) {
            const fadeEnd = inFrame + secondsToFrames(clip.fadeIn, fps);
            fadeKeyframes.push(
              `                  <keyframe><when>${inFrame}</when><value>0</value></keyframe>`,
              `                  <keyframe><when>${fadeEnd}</when><value>${gainLinear.toFixed(3)}</value></keyframe>`
            );
          }
          if (clip.fadeOut > 0) {
            const fadeStart = Math.max(inFrame, outFrame - secondsToFrames(clip.fadeOut, fps));
            fadeKeyframes.push(
              `                  <keyframe><when>${fadeStart}</when><value>${gainLinear.toFixed(3)}</value></keyframe>`,
              `                  <keyframe><when>${outFrame}</when><value>0</value></keyframe>`
            );
          }

          compatibilityItems.push({
            category: 'audio',
            name: `${clip.name} (${track.name})`,
            status: clip.duckOnVoiceover ? 'approximated' : 'native',
            details: clip.duckOnVoiceover
              ? `Audio clip & fade keyframes exported natively; automatic voiceover ducking parameters saved in manifest.`
              : `Audio clip, level (${clip.volume}%), and fade keyframes exported natively.`,
          });

          return `          <clipitem id="clipitem-${escapeXml(clip.id)}">
            <name>${escapeXml(clip.name)}</name>
            <enabled>${!track.muted && !clip.muted ? 'TRUE' : 'FALSE'}</enabled>
            <duration>${clipDurationFrames}</duration>
            <rate>
              <timebase>${timebase}</timebase>
              <ntsc>${ntscTag}</ntsc>
            </rate>
            <start>${startFrame}</start>
            <end>${endFrame}</end>
            <in>${inFrame}</in>
            <out>${outFrame}</out>
${buildFileBlock(clip.assetId, true)}
            <filter>
              <effect>
                <name>Audio Levels</name>
                <effectid>audiolevels</effectid>
                <effectcategory>audiolevels</effectcategory>
                <effecttype>audiolevels</effecttype>
                <mediatype>audio</mediatype>
                <parameter>
                  <parameterid>level</parameterid>
                  <name>Level</name>
                  <value>${gainLinear.toFixed(3)}</value>
${fadeKeyframes.join('\n')}
                </parameter>
              </effect>
            </filter>
          </clipitem>`;
        });

        return `        <track>
          <enabled>${!track.muted ? 'TRUE' : 'FALSE'}</enabled>
          <locked>${track.locked ? 'TRUE' : 'FALSE'}</locked>
${itemsXml.join('\n')}
        </track>`;
      })
      .join('\n');
  };

  // Sequence markers (manual timeline markers + strong music beat markers)
  const markersXmlParts: string[] = [];
  for (const m of project.markers) {
    const f = secondsToFrames(m.time, fps);
    markersXmlParts.push(`      <marker>
        <name>${escapeXml(m.name)}</name>
        <comment>${escapeXml(m.comment)}</comment>
        <in>${f}</in>
        <out>-1</out>
      </marker>`);
  }
  if (project.audioAnalysis?.beats?.length) {
    const downbeats = project.audioAnalysis.beats.filter((b) => b.isDownbeat || b.manual).slice(0, 120);
    for (const b of downbeats) {
      const f = secondsToFrames(b.time, fps);
      markersXmlParts.push(`      <marker>
        <name>${b.manual ? 'Manual Beat' : `Bar ${b.barIndex + 1} Downbeat`}</name>
        <comment>BPM ${project.audioAnalysis.bpm} · Strength ${Math.round(b.strength * 100)}%</comment>
        <in>${f}</in>
        <out>-1</out>
      </marker>`);
    }
    compatibilityItems.push({
      category: 'marker',
      name: `${downbeats.length} Music Downbeat Markers`,
      status: 'native',
      details: 'Exported as native Premiere Sequence Markers for beat-aligned editing.',
    });
  }

  // Document color grading and motion overlays honestly in compatibility report
  const cg = project.colorGrading;
  const hasGrading =
    cg.lookPreset !== 'none' &&
    (cg.exposure !== 0 ||
      cg.contrast !== 0 ||
      cg.saturation !== 0 ||
      cg.temperature !== 0 ||
      cg.vignette > 0 ||
      Boolean(cg.lutName));
  if (hasGrading) {
    compatibilityItems.push({
      category: 'color',
      name: `Color Grade (${cg.lookPreset}${cg.lutName ? ` + LUT ${cg.lutName}` : ''})`,
      status: 'manifest_only',
      details:
        'FCP7 XMEML v4 does not natively encode Lumetri Color wheels/curves/LUTs. Exact exposure, contrast, temperature, saturation, Lift/Gamma/Gain, RGB curves, and LUT metadata are preserved in effect-manifest.json for Lumetri application in Premiere Pro.',
    });
  }

  for (const ov of project.overlays) {
    compatibilityItems.push({
      category: 'overlay',
      name: `Motion Graphic: "${ov.text}" (${ov.type})`,
      status: 'manifest_only',
      details: `Premiere Essential Graphics / MOGRT animations cannot be encoded in FCP7 XMEML. Timing (${ov.startTime.toFixed(2)}s–${(ov.startTime + ov.duration).toFixed(2)}s), typography (${ov.fontFamily} ${ov.fontSize}px), position, and animation ("${ov.animation}") are preserved in effect-manifest.json.`,
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <project>
    <name>${escapeXml(projectName)}</name>
    <children>
      <sequence id="sequence-${escapeXml(project.id)}">
        <name>${escapeXml(projectName)}</name>
        <duration>${totalFrames}</duration>
        <rate>
          <timebase>${timebase}</timebase>
          <ntsc>${ntscTag}</ntsc>
        </rate>
        <timecode>
          <rate>
            <timebase>${timebase}</timebase>
            <ntsc>${ntscTag}</ntsc>
          </rate>
          <string>00:00:00:00</string>
          <frame>0</frame>
          <displayformat>${ntsc ? 'DF' : 'NDF'}</displayformat>
        </timecode>
        <media>
          <video>
            <format>
              <samplecharacteristics>
                <rate>
                  <timebase>${timebase}</timebase>
                  <ntsc>${ntscTag}</ntsc>
                </rate>
                <width>${width}</width>
                <height>${height}</height>
                <anamorphic>FALSE</anamorphic>
                <pixelaspectratio>square</pixelaspectratio>
                <fielddominance>none</fielddominance>
              </samplecharacteristics>
            </format>
${buildVideoTracksXml()}
          </video>
          <audio>
            <numOutputChannels>2</numOutputChannels>
            <format>
              <samplecharacteristics>
                <depth>16</depth>
                <samplerate>48000</samplerate>
              </samplecharacteristics>
            </format>
${buildAudioTracksXml()}
          </audio>
        </media>
${markersXmlParts.join('\n')}
      </sequence>
    </children>
  </project>
</xmeml>
`;

  const validation = validatePremiereXmeml(xml);
  const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Commercial_Project';

  const nativeCount = compatibilityItems.filter((i) => i.status === 'native').length;
  const approximatedCount = compatibilityItems.filter((i) => i.status === 'approximated').length;
  const manifestOnlyCount = compatibilityItems.filter((i) => i.status === 'manifest_only').length;

  return {
    xml,
    filename: `${safeName}_PremierePro_FCP7.xml`,
    schemaVersion: 'FCP 7 XML (XMEML v4)',
    isValid: validation.isValid,
    validationErrors: validation.errors,
    compatibilityReport: {
      generatedAt: new Date().toISOString(),
      totalItems: compatibilityItems.length,
      nativeCount,
      approximatedCount,
      manifestOnlyCount,
      items: compatibilityItems,
      relinkingInstructions: [
        'Download the Project Media Package ZIP to keep the XML and source media together in one portable folder.',
        'Unzip the archive to your local workstation before importing into Adobe Premiere Pro.',
        'In Adobe Premiere Pro, choose File > Import and select the .xml file (FCP 7 XML / XMEML format).',
        'If Premiere prompts "Link Media", click Locate, select the unzipped /media folder, and enable "Relink others automatically".',
        'Review effect-manifest.json for Lumetri Color parameters, custom transitions, and Essential Graphics title timings.',
      ],
    },
    manifest: {
      generator: 'Pro Product Studio AI',
      xmlSchema: 'FCP 7 XML (XMEML v4) — Interchange XML (not a binary .prproj file)',
      exportedAt: new Date().toISOString(),
      projectSettings: project.settings,
      colorGrading: project.colorGrading,
      motionOverlays: project.overlays,
      audioAnalysisSummary: project.audioAnalysis
        ? {
            bpm: project.audioAnalysis.bpm,
            beatCount: project.audioAnalysis.beats.length,
            sections: project.audioAnalysis.sections,
          }
        : null,
      clipEffects: project.clips.map((c) => ({
        clipId: c.id,
        name: c.name,
        speed: c.speed,
        speedRamp: c.speedRamp ?? 'none',
        imageMotion: c.imageMotion,
        transitionIn: c.transitionIn ?? null,
        transitionOut: c.transitionOut ?? null,
        duckOnVoiceover: c.duckOnVoiceover,
      })),
    },
  };
}
