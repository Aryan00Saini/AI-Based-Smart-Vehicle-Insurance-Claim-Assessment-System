import React, { useState } from 'react';
import { Layers, Eye, Image as ImageIcon, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
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
      <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-8 text-center text-slate-500">
        <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No photographs available for this claim.</p>
      </div>
    );
  }

  const currentPhoto = photos[selectedPhotoIndex];
  const overlayUrl = currentPhoto.overlay_s3_key ? getStorageFileUrl(currentPhoto.overlay_s3_key) : null;
  const rawUrl = getStorageFileUrl(currentPhoto.s3_key);

  const displayUrl = showOverlay && overlayUrl ? overlayUrl : rawUrl;

  return (
    <div className="bg-slate-800/80 rounded-xl border border-slate-700 overflow-hidden shadow-lg flex flex-col">
      {/* Controls toolbar */}
      <div className="p-3 bg-slate-900/90 border-b border-slate-700 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-300">Photo {selectedPhotoIndex + 1} of {photos.length}</span>
          {photos.length > 1 && (
            <div className="flex space-x-1">
              {photos.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedPhotoIndex(idx)}
                  className={`w-5 h-5 text-xs rounded font-mono ${
                    idx === selectedPhotoIndex ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
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
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                showOverlay
                  ? 'bg-blue-600/20 text-blue-400 border-blue-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{showOverlay ? 'AI Mask Overlay ON' : 'Raw Photo'}</span>
            </button>
          )}

          <div className="flex items-center space-x-1 bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
            <button
              onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
              className="p-1 hover:bg-slate-700 rounded text-slate-300"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1 text-[11px] font-mono text-slate-400">{(zoomLevel * 100).toFixed(0)}%</span>
            <button
              onClick={() => setZoomLevel(Math.min(2.5, zoomLevel + 0.25))}
              className="p-1 hover:bg-slate-700 rounded text-slate-300"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="p-1 hover:bg-slate-700 rounded text-slate-300"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="relative bg-slate-950 flex items-center justify-center overflow-hidden min-h-[360px] max-h-[500px]">
        <img
          src={displayUrl}
          alt="Claim damage evidence"
          style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.15s ease-out' }}
          className="max-h-[460px] object-contain rounded select-none shadow-md"
          onError={(e) => {
            // Fallback placeholder if storage server not ready
            (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="%231e293b" width="400" height="300"/><text fill="%2394a3b8" font-family="sans-serif" font-size="14" x="50%" y="50%" text-anchor="middle">AI Annotated Photo Preview</text></svg>';
          }}
        />
      </div>

      {/* Legend Footer */}
      <div className="p-2.5 bg-slate-900/90 border-t border-slate-700 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span> Part Silhouette
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Minor Severity
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span> Moderate Severity
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Severe / Replace
        </span>
      </div>
    </div>
  );
};
