import React, { useMemo, useRef, useState } from 'react';
import {
  CheckSquare,
  Film,
  FolderPlus,
  Image as ImageIcon,
  Music,
  Plus,
  Search,
  Square,
  Trash2,
  Upload,
  Edit3,
  Check,
} from 'lucide-react';
import type { MediaAsset, MediaBinCategory, StudioProject, StudioServerSettings } from '../types/studio';
import { formatFileSize, formatShortDuration } from '../data/catalogs';
import { uploadMediaFileChunked, type UploadProgressInfo } from '../services/api';

interface MediaImportAndBinProps {
  mode: 'import' | 'library';
  project: StudioProject;
  serverSettings: StudioServerSettings;
  onAssetImported: (asset: MediaAsset) => void;
  onUpdateAsset: (assetId: string, patch: Partial<MediaAsset>) => void;
  onDeleteAsset: (assetId: string) => void;
  onAddAssetsToTimeline: (assets: MediaAsset[]) => void;
}

const BIN_OPTIONS: Array<{ id: MediaBinCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All Media' },
  { id: 'video', label: 'Video Clips' },
  { id: 'image', label: 'Images' },
  { id: 'music', label: 'Music' },
  { id: 'audio', label: 'Audio' },
  { id: 'sfx', label: 'Sound Effects' },
  { id: 'logo', label: 'Logos' },
  { id: 'product', label: 'Product Assets' },
  { id: 'generated', label: 'Generated' },
];

export const MediaImportAndBin: React.FC<MediaImportAndBinProps> = ({
  mode,
  project,
  serverSettings,
  onAssetImported,
  onUpdateAsset,
  onDeleteAsset,
  onAddAssetsToTimeline,
}) => {
  const [targetBin, setTargetBin] = useState<MediaBinCategory>('video');
  const [targetFolder, setTargetFolder] = useState('Root');
  const [customFolders, setCustomFolders] = useState<string[]>(['Root', 'A-Roll', 'Product Macros', 'Music', 'Logos']);
  const [newFolderName, setNewFolderName] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [uploads, setUploads] = useState<UploadProgressInfo[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Library state
  const [binFilter, setBinFilter] = useState<MediaBinCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'duration' | 'type'>('date');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploadError(null);

    for (const file of files) {
      const autoBin: MediaBinCategory =
        file.type.startsWith('audio/')
          ? targetBin === 'sfx' || targetBin === 'audio'
            ? targetBin
            : 'music'
          : file.type.startsWith('image/')
            ? targetBin === 'logo' || targetBin === 'product'
              ? targetBin
              : 'image'
            : targetBin === 'product'
              ? 'product'
              : 'video';

      try {
        const asset = await uploadMediaFileChunked({
          projectId: project.id,
          file,
          bin: autoBin,
          folder: targetFolder,
          chunkSizeMb: serverSettings.chunkSizeMb,
          onProgress: (info) => {
            setUploads((prev) => {
              const others = prev.filter((u) => u.filename !== info.filename);
              return [info, ...others].slice(0, 8);
            });
          },
        });
        onAssetImported(asset);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setUploadError(msg);
        setUploads((prev) =>
          prev.map((u) => (u.filename === file.name ? { ...u, stage: 'error', error: msg } : u))
        );
      }
    }
  };

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return project.assets
      .filter((a) => (binFilter === 'all' ? true : a.bin === binFilter))
      .filter((a) => (!q ? true : a.name.toLowerCase().includes(q) || a.folder.toLowerCase().includes(q)))
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'duration') return b.duration - a.duration;
        if (sortBy === 'type') return a.mediaType.localeCompare(b.mediaType);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [project.assets, binFilter, search, sortBy]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelectedToTimeline = () => {
    const chosen = project.assets.filter((a) => selectedIds.has(a.id));
    if (chosen.length > 0) {
      onAddAssetsToTimeline(chosen);
      setSelectedIds(new Set());
    }
  };

  return (
    <div className="flex flex-col h-full text-xs overflow-hidden">
      {/* Drag-and-Drop Resumable Import Dropzone */}
      <div className="p-3 border-b border-white/[0.07] space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <select
            value={targetBin}
            onChange={(e) => setTargetBin(e.target.value as MediaBinCategory)}
            className="flex-1 bg-[#181C26] border border-white/10 rounded px-2 py-1 text-slate-200"
            title="Destination bin"
          >
            {BIN_OPTIONS.filter((b) => b.id !== 'all').map((b) => (
              <option key={b.id} value={b.id}>
                Bin: {b.label}
              </option>
            ))}
          </select>
          <select
            value={targetFolder}
            onChange={(e) => setTargetFolder(e.target.value)}
            className="w-28 bg-[#181C26] border border-white/10 rounded px-2 py-1 text-slate-200"
            title="Destination folder"
          >
            {customFolders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingOver(false);
            void handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border border-dashed rounded-lg p-3.5 text-center cursor-pointer transition-colors ${
            isDraggingOver
              ? 'border-[#7C3AED] bg-[#7C3AED]/15'
              : 'border-white/15 bg-[#141822] hover:border-white/30'
          }`}
        >
          <Upload className="w-5 h-5 mx-auto mb-1.5 text-[#A855F7]" />
          <p className="text-slate-200 font-medium">Drop Product Videos, Stills, Logos, or Music</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            MP4, MOV, ProRes, MKV, WebM, PNG, JPG, WAV, MP3, FLAC · Up to 8K · Chunked Resumable ({serverSettings.maxUploadSizeMb} MB max)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/*,image/*,audio/*,.mkv,.mov,.avi,.m4v,.flac,.aiff,.tiff,.webp"
            onChange={(e) => {
              if (e.target.files) void handleFiles(e.target.files);
              e.target.value = '';
            }}
            className="hidden"
          />
        </div>

        {mode === 'import' && (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="New folder name..."
              className="flex-1 bg-[#181C26] border border-white/10 rounded px-2 py-1 text-slate-200 placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => {
                const trimmed = newFolderName.trim();
                if (trimmed && !customFolders.includes(trimmed)) {
                  setCustomFolders([...customFolders, trimmed]);
                  setTargetFolder(trimmed);
                  setNewFolderName('');
                }
              }}
              className="px-2.5 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 flex items-center gap-1"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        )}

        {uploadError && (
          <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px]">
            {uploadError}
          </div>
        )}

        {uploads.length > 0 && (
          <div className="space-y-1.5 max-h-28 overflow-y-auto">
            {uploads.map((u) => (
              <div key={u.filename} className="bg-[#161A24] rounded px-2.5 py-1.5 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-200 truncate max-w-[170px]">{u.filename}</span>
                  <span className="font-mono tabular-nums text-slate-400">
                    {u.stage === 'probing'
                      ? 'Probing FFprobe...'
                      : u.stage === 'done'
                        ? 'Ready'
                        : u.stage === 'error'
                          ? 'Failed'
                          : `${u.percent}%`}
                  </span>
                </div>
                <div className="h-1 bg-white/10 rounded overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      u.stage === 'error' ? 'bg-rose-500' : u.stage === 'done' ? 'bg-emerald-500' : 'bg-[#7C3AED]'
                    }`}
                    style={{ width: `${u.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Media Bin Controls */}
      <div className="p-3 border-b border-white/[0.07] space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets..."
              className="w-full bg-[#181C26] border border-white/10 rounded pl-8 pr-2 py-1 text-slate-200 placeholder:text-slate-500"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-[#181C26] border border-white/10 rounded px-2 py-1 text-slate-300"
          >
            <option value="date">Newest</option>
            <option value="name">Name</option>
            <option value="duration">Duration</option>
            <option value="type">Type</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-1">
          {BIN_OPTIONS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBinFilter(b.id)}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors whitespace-nowrap ${
                binFilter === b.id
                  ? 'bg-[#7C3AED] text-white'
                  : 'bg-[#181C26] text-slate-400 hover:text-slate-200'
              }`}
            >
              {b.label}
            </button>
          ))}
        </div>

        {selectedIds.size > 0 && (
          <button
            type="button"
            onClick={addSelectedToTimeline}
            className="w-full py-1.5 rounded bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium flex items-center justify-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add {selectedIds.size} Selected to Timeline</span>
          </button>
        )}
      </div>

      {/* Asset List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
        {filteredAssets.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-500">
            <p className="text-slate-300 font-medium">No media assets in this bin</p>
            <p className="mt-1 text-[11px]">
              Drop real product videos, photos, logos, or audio files above to populate your Premiere-style Media Library.
            </p>
          </div>
        ) : (
          filteredAssets.map((asset) => {
            const isSel = selectedIds.has(asset.id);
            const isRenaming = renamingId === asset.id;

            return (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/asset-id', asset.id);
                }}
                className={`group rounded-lg border p-2 flex items-center gap-2.5 transition-colors ${
                  isSel
                    ? 'bg-[#7C3AED]/15 border-[#7C3AED]/50'
                    : 'bg-[#151923] border-white/[0.06] hover:border-white/20'
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSelected(asset.id)}
                  className="text-slate-400 hover:text-white shrink-0"
                  title="Select asset"
                >
                  {isSel ? (
                    <CheckSquare className="w-4 h-4 text-[#A855F7]" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>

                <div className="w-14 h-10 rounded bg-black/60 overflow-hidden shrink-0 flex items-center justify-center border border-white/10">
                  {asset.thumbnailUrl ? (
                    <img
                      src={asset.thumbnailUrl}
                      alt={asset.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : asset.mediaType === 'audio' ? (
                    <Music className="w-4 h-4 text-emerald-400" />
                  ) : asset.mediaType === 'image' ? (
                    <ImageIcon className="w-4 h-4 text-blue-400" />
                  ) : (
                    <Film className="w-4 h-4 text-purple-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {isRenaming ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && renameDraft.trim()) {
                            onUpdateAsset(asset.id, { name: renameDraft.trim() });
                            setRenamingId(null);
                          }
                        }}
                        autoFocus
                        className="w-full bg-black/50 border border-[#7C3AED] rounded px-1.5 py-0.5 text-white text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (renameDraft.trim()) onUpdateAsset(asset.id, { name: renameDraft.trim() });
                          setRenamingId(null);
                        }}
                        className="text-emerald-400 p-0.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-slate-100 font-medium truncate">{asset.name}</div>
                  )}

                  <div className="text-[11px] text-slate-400 font-mono tabular-nums truncate mt-0.5">
                    {formatShortDuration(asset.duration)}
                    {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ''}
                    {asset.fps ? ` · ${asset.fps}fps` : ''}
                    {' · '}
                    {formatFileSize(asset.fileSize)}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {asset.folder}
                    {asset.videoCodec ? ` · ${asset.videoCodec.toUpperCase()}` : ''}
                    {asset.audioCodec ? ` · ${asset.audioCodec.toUpperCase()}` : ''}
                    {asset.proxyStatus === 'ready'
                      ? ' · Proxy ready'
                      : asset.proxyStatus === 'processing'
                        ? ' · Generating proxy...'
                        : ''}
                  </div>
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onAddAssetsToTimeline([asset])}
                    className="p-1 rounded bg-[#7C3AED]/20 hover:bg-[#7C3AED] text-[#C4B5FD] hover:text-white transition-colors"
                    title="Append to timeline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(asset.id);
                        setRenameDraft(asset.name);
                      }}
                      className="p-1 rounded text-slate-500 hover:text-slate-200"
                      title="Rename asset"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAsset(asset.id)}
                      className="p-1 rounded text-slate-500 hover:text-rose-400"
                      title="Remove asset"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
