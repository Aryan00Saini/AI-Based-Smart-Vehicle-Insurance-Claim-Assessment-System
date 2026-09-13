import React, { useState } from 'react';
import { Layers, Image as ImageIcon, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { PhotoItem } from '../types';
import { getStorageFileUrl } from '../services/api';

interface CanvasAnnotatorProps {
  photos: PhotoItem[];
}

export const CanvasAnnotator: React.FC<CanvasAnnotatorProps> = ({ photos }) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);

  if (!photos || photos.length === 0) {
    return (
      <div className="bg-[#070A12] rounded-xl border border-white/[0.08] p-8 text-center text-slate-500">
        <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-40 text-slate-400" />
        <p className="text-sm font-mono">No photographs available for this claim.</p>
      </div>
    );
  }

  const currentPhoto = photos[selectedPhotoIndex];
  const overlayUrl = currentPhoto.overlay_s3_key ? getStorageFileUrl(currentPhoto.overlay_s3_key) : null;
  const rawUrl = getStorageFileUrl(currentPhoto.s3_key);
  const displayUrl = showOverlay && overlayUrl ? overlayUrl : rawUrl;

  return (
    <div className="bg-[#131929] rounded-xl border border-white/[0.08] overflow-hidden shadow-lg flex flex-col">
      {/* Controls toolbar */}
      <div className="p-3 bg-[#070A12] border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-300 font-mono">
            Photo {selectedPhotoIndex + 1} of {photos.length}
          </span>
          {photos.length > 1 && (
            <div className="flex space-x-1">
              {photos.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedPhotoIndex(idx)}
                  className={`w-5 h-5 text-xs rounded font-mono transition-all ${
                    idx === selectedPhotoIndex
                      ? 'bg-blue-600 text-white font-bold shadow-[0_0_8px_rgba(37,99,235,0.6)]'
                      : 'bg-[#161f36] text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Overlay toggle and Zoom */}
        <div className="flex items-center space-x-2">
          {overlayUrl && (
            <button
              onClick={() => setShowOverlay(!showOverlay)}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-mono font-medium border transition-all ${
                showOverlay
                  ? 'bg-blue-600/20 text-cyan-300 border-cyan-400/40 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                  : 'bg-[#161f36] text-slate-300 border-white/[0.08] hover:bg-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{showOverlay ? 'AI Mask Overlay ON' : 'Raw Photo'}</span>
            </button>
          )}

          <div className="flex items-center space-x-1 bg-[#070A12] rounded-lg p-0.5 border border-white/[0.08] text-xs">
            <button
              onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
              className="p-1 hover:bg-white/[0.1] rounded text-slate-300 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 text-[11px] font-mono text-slate-400">{(zoomLevel * 100).toFixed(0)}%</span>
            <button
              onClick={() => setZoomLevel(Math.min(2.5, zoomLevel + 0.25))}
              className="p-1 hover:bg-white/[0.1] rounded text-slate-300 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1 hover:bg-white/[0.1] rounded text-slate-300 transition-colors"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="relative bg-[#070A12] flex items-center justify-center overflow-hidden min-h-[340px] max-h-[480px]">
        <img
          src={displayUrl}
          alt="Claim damage evidence"
          style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.15s ease-out' }}
          className="max-h-[440px] object-contain rounded select-none shadow-md"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="%23070A12" width="400" height="300"/><text fill="%2394a3b8" font-family="sans-serif" font-size="14" x="50%" y="50%" text-anchor="middle">AI Annotated Photo Preview</text></svg>';
          }}
        />
      </div>

      {/* Standardized Legend Footer */}
      <div className="p-2.5 bg-[#070A12] border-t border-white/[0.08] flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono">
        <span className="flex items-center gap-1.5 text-cyan-400 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span> Silhouette
        </span>
        <span className="flex items-center gap-1.5 text-amber-400 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Minor
        </span>
        <span className="flex items-center gap-1.5 text-orange-400 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-400"></span> Moderate
        </span>
        <span className="flex items-center gap-1.5 text-red-400 font-medium">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span> Severe
        </span>
      </div>
    </div>
  );
};
