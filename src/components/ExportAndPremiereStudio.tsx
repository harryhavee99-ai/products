import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Download,
  FileArchive,
  FileJson,
  Film,
  Loader2,
  Play,
} from 'lucide-react';
import type {
  ExportCodecOption,
  ExportFormatOption,
  FrameRateOption,
  PremiereExportResult,
  RenderExportConfig,
  RenderJobStatus,
  ResolutionPreset,
  StudioProject,
} from '../types/studio';
import {
  FRAME_RATE_OPTIONS,
  RESOLUTION_MAP,
  computeDimensionsForAspect,
  formatFileSize,
} from '../data/catalogs';
import { studioApi } from '../services/api';

interface ExportAndPremiereStudioProps {
  project: StudioProject;
  initialTab?: 'render' | 'premiere';
  onRenderUpdated: (job: RenderJobStatus) => void;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const ExportAndPremiereStudio: React.FC<ExportAndPremiereStudioProps> = ({
  project,
  initialTab = 'render',
  onRenderUpdated,
}) => {
  const [tab, setTab] = useState<'render' | 'premiere'>(initialTab);

  // FFmpeg Render Settings
  const [config, setConfig] = useState<RenderExportConfig>(() => ({
    resolution: project.settings.resolution,
    width: project.settings.width,
    height: project.settings.height,
    fps: project.settings.fps,
    format: project.settings.exportFormat,
    codec: project.settings.exportFormat === 'prores_mov' ? 'prores' : project.settings.exportFormat === 'webm' ? 'vp9' : 'h264',
    audioCodec: project.settings.exportFormat === 'prores_mov' ? 'pcm' : 'aac',
    videoBitrateKbps: project.settings.resolution.includes('4K') || project.settings.resolution === '8K' ? 35000 : 12000,
    audioBitrateKbps: 256,
    quality: 'high',
    colorSpace: 'bt709',
    audioChannels: 'stereo',
    useProxy: false,
  }));

  const [activeJob, setActiveJob] = useState<RenderJobStatus | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [startingRender, setStartingRender] = useState(false);

  // Premiere XML state
  const [xmlResult, setXmlResult] = useState<PremiereExportResult | null>(null);
  const [loadingXml, setLoadingXml] = useState(false);
  const [packageRelative, setPackageRelative] = useState(true);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // Poll active render job until complete/failed
  useEffect(() => {
    if (!activeJob || activeJob.status === 'completed' || activeJob.status === 'failed') return;
    const timer = window.setInterval(async () => {
      try {
        const fresh = await studioApi.getRenderJob(activeJob.id);
        setActiveJob(fresh);
        onRenderUpdated(fresh);
      } catch {
        // Ignore transient poll errors
      }
    }, 900);
    return () => window.clearInterval(timer);
  }, [activeJob, onRenderUpdated]);

  const handleStartRender = async () => {
    setStartingRender(true);
    setRenderError(null);
    try {
      await studioApi.saveProject(project);
      const job = await studioApi.startRender(project.id, config);
      setActiveJob(job);
      onRenderUpdated(job);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : String(err));
    } finally {
      setStartingRender(false);
    }
  };

  const handleGenerateXml = async () => {
    setLoadingXml(true);
    try {
      await studioApi.saveProject(project);
      const res = await studioApi.generatePremiereXml(project.id, packageRelative);
      setXmlResult(res);
    } finally {
      setLoadingXml(false);
    }
  };

  useEffect(() => {
    if (tab === 'premiere') {
      void handleGenerateXml();
    }
  }, [tab, packageRelative]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Export Studio & Adobe Premiere Pro XML</h1>
          <p className="text-xs text-slate-400 mt-1">
            Render high-bitrate commercials directly from original source footage using FFmpeg, or export a validated FCP 7 XML (XMEML v4) project package for Adobe Premiere Pro.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#141822] border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setTab('render')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              tab === 'render' ? 'bg-[#7C3AED] text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            FFmpeg Video Render
          </button>
          <button
            type="button"
            onClick={() => setTab('premiere')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              tab === 'premiere' ? 'bg-[#3B82F6] text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Export Adobe Premiere XML
          </button>
        </div>
      </div>

      {tab === 'render' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#12161F] border border-white/[0.08] rounded-xl p-6 space-y-5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="space-y-1.5">
                <span className="text-slate-300 font-medium">Export Resolution</span>
                <select
                  value={config.resolution}
                  onChange={(e) => {
                    const res = e.target.value as ResolutionPreset;
                    const dims = computeDimensionsForAspect(res, project.settings.aspectRatio);
                    setConfig({ ...config, resolution: res, width: dims.width, height: dims.height });
                  }}
                  className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white"
                >
                  {(['720p', '1080p', '2K', '4K_UHD', '4K_DCI', '8K'] as ResolutionPreset[]).map((r) => (
                    <option key={r} value={r}>
                      {RESOLUTION_MAP[r].label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-slate-300 font-medium">Frame Rate</span>
                <select
                  value={config.fps}
                  onChange={(e) => setConfig({ ...config, fps: Number(e.target.value) as FrameRateOption })}
                  className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white font-mono"
                >
                  {FRAME_RATE_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f} FPS
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-slate-300 font-medium">Container Format</span>
                <select
                  value={config.format}
                  onChange={(e) => {
                    const fmt = e.target.value as ExportFormatOption;
                    const codec: ExportCodecOption =
                      fmt === 'prores_mov'
                        ? 'prores'
                        : fmt === 'webm'
                          ? 'vp9'
                          : fmt === 'wav'
                            ? 'pcm'
                            : 'h264';
                    setConfig({
                      ...config,
                      format: fmt,
                      codec,
                      audioCodec: fmt === 'prores_mov' || fmt === 'wav' ? 'pcm' : 'aac',
                    });
                  }}
                  className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white"
                >
                  <option value="mp4">MP4 Video</option>
                  <option value="mov">MOV QuickTime</option>
                  <option value="prores_mov">Apple ProRes 422 MOV</option>
                  <option value="webm">WebM (VP9)</option>
                  <option value="wav">WAV Audio Master Only</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/[0.07]">
              <label className="space-y-1.5">
                <span className="text-slate-300 font-medium">Video Codec</span>
                <select
                  value={config.codec}
                  onChange={(e) => setConfig({ ...config, codec: e.target.value as ExportCodecOption })}
                  disabled={config.format === 'wav'}
                  className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white disabled:opacity-40"
                >
                  <option value="h264">H.264 (libx264)</option>
                  <option value="h265">H.265 / HEVC (libx265)</option>
                  <option value="prores">Apple ProRes 422 (prores_ks)</option>
                  <option value="vp9">VP9 (libvpx-vp9)</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-slate-300 font-medium">Quality Profile</span>
                <select
                  value={config.quality}
                  onChange={(e) =>
                    setConfig({ ...config, quality: e.target.value as RenderExportConfig['quality'] })
                  }
                  className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white"
                >
                  <option value="draft">Draft (Fast Review)</option>
                  <option value="standard">Standard Web (CRF 22)</option>
                  <option value="high">High Commercial (CRF 19)</option>
                  <option value="master">Broadcast Master (CRF 16)</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-slate-300 font-medium">Color Space</span>
                <select
                  value={config.colorSpace}
                  onChange={(e) =>
                    setConfig({ ...config, colorSpace: e.target.value as RenderExportConfig['colorSpace'] })
                  }
                  className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white"
                >
                  <option value="bt709">Rec.709 (Broadcast HD / 4K)</option>
                  <option value="srgb">sRGB (Web / Social)</option>
                  <option value="bt2020">Rec.2020 (Wide Gamut)</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/[0.07]">
              <label className="space-y-1.5">
                <span className="text-slate-300 font-medium">Target Video Bitrate (kbps)</span>
                <input
                  type="number"
                  min={1500}
                  max={150000}
                  step={500}
                  value={config.videoBitrateKbps}
                  onChange={(e) => setConfig({ ...config, videoBitrateKbps: Number(e.target.value) })}
                  className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white font-mono tabular-nums"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-slate-300 font-medium">Audio Bitrate (kbps)</span>
                <select
                  value={config.audioBitrateKbps}
                  onChange={(e) => setConfig({ ...config, audioBitrateKbps: Number(e.target.value) })}
                  className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white font-mono"
                >
                  <option value={128}>128 kbps</option>
                  <option value={192}>192 kbps</option>
                  <option value={256}>256 kbps</option>
                  <option value={320}>320 kbps</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-slate-300 font-medium">Audio Channels</span>
                <select
                  value={config.audioChannels}
                  onChange={(e) =>
                    setConfig({ ...config, audioChannels: e.target.value as 'stereo' | 'mono' })
                  }
                  className="w-full bg-[#181D28] border border-white/10 rounded-lg px-3 py-2 text-white"
                >
                  <option value="stereo">Stereo (2.0)</option>
                  <option value="mono">Mono (1.0)</option>
                </select>
              </label>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-white/[0.07]">
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={config.useProxy}
                  onChange={(e) => setConfig({ ...config, useProxy: e.target.checked })}
                />
                <span>Use proxy files for rapid draft test (unchecked = Full Original Source Quality)</span>
              </label>

              <button
                type="button"
                onClick={handleStartRender}
                disabled={startingRender || activeJob?.status === 'running'}
                className="px-5 py-2.5 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-45 text-sm font-medium text-white flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                {startingRender || activeJob?.status === 'running' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                <span>Start FFmpeg Render</span>
              </button>
            </div>

            {renderError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
                {renderError}
              </div>
            )}
          </div>

          {/* Live FFmpeg Render Progress & Download Panel */}
          <aside className="bg-[#12161F] border border-white/[0.08] rounded-xl p-5 flex flex-col justify-between space-y-4 text-xs">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white font-semibold text-sm">
                <Film className="w-4 h-4 text-[#A855F7]" />
                <span>Render Output & Progress</span>
              </div>

              <div className="p-3 rounded-lg bg-[#0D1017] border border-white/[0.06] space-y-1 font-mono tabular-nums text-[11px] text-slate-300">
                <div>Output: {config.width}×{config.height} · {config.fps} fps</div>
                <div>Format: {config.format.toUpperCase()} / {config.codec.toUpperCase()}</div>
                <div>Timeline Clips: {project.clips.length} · Overlays: {project.overlays.length}</div>
              </div>

              {activeJob ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200 font-medium capitalize">{activeJob.status}</span>
                      <span className="font-mono tabular-nums text-[#C4B5FD]">{activeJob.progress}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          activeJob.status === 'failed'
                            ? 'bg-rose-500'
                            : activeJob.status === 'completed'
                              ? 'bg-emerald-500'
                              : 'bg-[#7C3AED]'
                        }`}
                        style={{ width: `${activeJob.progress}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-400">{activeJob.stage}</div>
                  </div>

                  {activeJob.status === 'completed' && activeJob.outputUrl && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-2.5">
                      <div className="flex items-center gap-1.5 text-emerald-300 font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Render Ready ({formatFileSize(activeJob.fileSize ?? 0)})</span>
                      </div>
                      <a
                        href={activeJob.outputUrl}
                        download={activeJob.outputFilename}
                        className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center justify-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download {activeJob.outputFilename}</span>
                      </a>
                    </div>
                  )}

                  {activeJob.error && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300">
                      {activeJob.error}
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="text-[11px] text-slate-400">FFmpeg Processing Log</div>
                    <pre className="p-2.5 rounded bg-[#090B10] border border-white/[0.06] text-[10px] text-slate-400 max-h-48 overflow-y-auto whitespace-pre-wrap">
                      {activeJob.logs.join('\n')}
                    </pre>
                  </div>
                </div>
              ) : (
                <p className="text-slate-500 leading-relaxed">
                  Configure your export settings and click Start FFmpeg Render to encode your finished commercial from original full-resolution media.
                </p>
              )}
            </div>
          </aside>
        </div>
      ) : (
        /* Adobe Premiere Pro FCP 7 XML (XMEML v4) Export Workspace */
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Download Actions & Schema Summary */}
            <div className="bg-[#12161F] border border-white/[0.08] rounded-xl p-6 space-y-5 text-xs">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-white">Adobe Premiere Pro Interchange XML</h2>
                <p className="text-slate-400 leading-relaxed">
                  Generates a validated Final Cut Pro 7 XML (<span className="font-mono text-slate-200">xmeml v4</span>) timeline—the official interchange schema imported natively by Adobe Premiere Pro. Note: this is an editable interchange XML, not a proprietary binary <span className="font-mono">.prproj</span> file.
                </p>
              </div>

              <label className="flex items-start gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={packageRelative}
                  onChange={(e) => setPackageRelative(e.target.checked)}
                  className="mt-0.5"
                />
                <span>Use portable relative <span className="font-mono">./media/</span> paths for ZIP Media Package relinking</span>
              </label>

              {xmlResult && (
                <div
                  className={`p-3 rounded-lg border flex items-start gap-2 ${
                    xmlResult.isValid
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  {xmlResult.isValid ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="font-medium">
                      {xmlResult.isValid
                        ? `Valid ${xmlResult.schemaVersion}`
                        : 'XML Schema Validation Issues'}
                    </div>
                    <div className="text-[11px] opacity-85 mt-0.5">
                      {xmlResult.isValid
                        ? `Timebase & frame placement verified for ${project.settings.fps} fps.`
                        : xmlResult.validationErrors.join(' ')}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  disabled={!xmlResult || loadingXml}
                  onClick={() =>
                    xmlResult &&
                    downloadTextFile(xmlResult.filename, xmlResult.xml, 'application/xml;charset=utf-8')
                  }
                  className="w-full py-2.5 px-3 rounded-lg bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-45 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Premiere XML (.xml)</span>
                </button>

                <a
                  href={`/api/projects/${project.id}/export/premiere-package.zip`}
                  download
                  className="w-full py-2.5 px-3 rounded-lg bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <FileArchive className="w-4 h-4" />
                  <span>Download Project Media Package (.zip)</span>
                </a>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={!xmlResult}
                    onClick={() =>
                      xmlResult &&
                      downloadTextFile(
                        'effect-manifest.json',
                        JSON.stringify(xmlResult.manifest, null, 2),
                        'application/json'
                      )
                    }
                    className="py-2 px-2.5 rounded-lg bg-[#181D28] hover:bg-white/[0.1] border border-white/10 text-slate-200 flex items-center justify-center gap-1.5"
                  >
                    <FileJson className="w-3.5 h-3.5" />
                    <span>Effect Manifest</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      downloadTextFile(
                        'project-settings.json',
                        JSON.stringify(project.settings, null, 2),
                        'application/json'
                      )
                    }
                    className="py-2 px-2.5 rounded-lg bg-[#181D28] hover:bg-white/[0.1] border border-white/10 text-slate-200 flex items-center justify-center gap-1.5"
                  >
                    <FileJson className="w-3.5 h-3.5" />
                    <span>Project JSON</span>
                  </button>
                </div>
              </div>

              {xmlResult && (
                <div className="pt-3 border-t border-white/[0.07] space-y-1.5">
                  <div className="font-medium text-slate-200">Media Relinking Workflow</div>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-400">
                    {xmlResult.compatibilityReport.relinkingInstructions.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            {/* Compatibility Report & Live XML Preview */}
            <div className="lg:col-span-2 space-y-5">
              {loadingXml && !xmlResult ? (
                <div className="p-10 rounded-xl bg-[#12161F] border border-white/[0.08] flex items-center justify-center gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" /> Generating FCP 7 XMEML...
                </div>
              ) : xmlResult ? (
                <>
                  {/* Transparent Premiere Compatibility Report */}
                  <div className="bg-[#12161F] border border-white/[0.08] rounded-xl p-5 space-y-4 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-white">Premiere Pro Compatibility Report</h3>
                      <div className="font-mono tabular-nums text-[11px] text-slate-300">
                        {xmlResult.compatibilityReport.nativeCount} Native ·{' '}
                        {xmlResult.compatibilityReport.approximatedCount} Approximated ·{' '}
                        {xmlResult.compatibilityReport.manifestOnlyCount} Manifest-Preserved
                      </div>
                    </div>

                    <div className="divide-y divide-white/[0.06] max-h-60 overflow-y-auto border border-white/[0.06] rounded-lg">
                      {xmlResult.compatibilityReport.items.map((item, idx) => (
                        <div key={idx} className="px-3.5 py-2.5 flex items-start justify-between gap-4">
                          <div className="space-y-0.5">
                            <div className="text-slate-100 font-medium">{item.name}</div>
                            <div className="text-[11px] text-slate-400">{item.details}</div>
                          </div>
                          <span
                            className={`text-[11px] font-medium shrink-0 ${
                              item.status === 'native'
                                ? 'text-emerald-400'
                                : item.status === 'approximated'
                                  ? 'text-amber-300'
                                  : 'text-sky-300'
                            }`}
                          >
                            {item.status === 'native'
                              ? 'Native XML'
                              : item.status === 'approximated'
                                ? 'Approximated'
                                : 'Manifest JSON'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Live Generated XMEML Code Inspector */}
                  <div className="bg-[#12161F] border border-white/[0.08] rounded-xl p-5 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-white font-semibold text-sm">
                        <Code2 className="w-4 h-4 text-[#3B82F6]" />
                        <span>Generated XMEML Preview ({xmlResult.filename})</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {xmlResult.xml.split('\n').length} lines
                      </span>
                    </div>
                    <pre className="p-3.5 rounded-lg bg-[#090B10] border border-white/[0.07] text-[11px] text-slate-300 font-mono max-h-72 overflow-auto leading-relaxed">
                      {xmlResult.xml}
                    </pre>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
