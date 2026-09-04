import React from 'react';
import { ShieldCheck, ShieldAlert, Camera, Hash, Clock, MapPin, Eye } from 'lucide-react';
import { Claim } from '../types';

interface FraudInspectionCardProps {
  claim: Claim;
}

export const FraudInspectionCard: React.FC<FraudInspectionCardProps> = ({ claim }) => {
  const photo = claim.photos && claim.photos.length > 0 ? claim.photos[0] : null;
  const blurScore = photo?.blur_score ?? 0;
  const isBlurry = blurScore < 100.0 && blurScore > 0;
  const hasFraud = claim.fraud_score > 0;
  const exif = photo?.exif_data;

  return (
    <div className="bg-slate-800/80 rounded-xl border border-slate-700 p-5 shadow-lg">
      <div className="flex items-center justify-between pb-4 border-b border-slate-700 mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-emerald-600/20 text-emerald-400 rounded-lg border border-emerald-500/30">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm">Photo Validation & Fraud Heuristics</h3>
            <p className="text-xs text-slate-400">Heuristic Forensics & Perceptual Integrity</p>
          </div>
        </div>

        <div>
          {hasFraud ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-300 border border-red-500/40">
              <ShieldAlert className="w-3.5 h-3.5 mr-1" />
              Fraud Flags: {claim.fraud_score}
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              Fraud Score: 0 (Clear)
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {/* Blur Check */}
        <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/60">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" /> Sharpness</span>
            <span className={isBlurry ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
              {blurScore > 0 ? `${blurScore.toFixed(0)}` : 'N/A'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            {isBlurry ? 'Rejected: Laplacian var < 100' : 'Sharp image (> 100 threshold)'}
          </p>
        </div>

        {/* Vehicle Presence */}
        <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/60">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Vehicle Check</span>
            <span className={claim.photo_validation_passed ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {claim.photo_validation_passed ? 'VERIFIED' : 'FAILED'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            Vehicle body recognized in frame
          </p>
        </div>

        {/* Perceptual Hash Duplicate */}
        <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/60">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> Duplicate Check</span>
            <span className={hasFraud ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
              {hasFraud ? 'MATCHED' : 'UNIQUE'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-mono truncate" title={photo?.phash || 'No pHash'}>
            pHash: {photo?.phash ? `${photo.phash.slice(0, 12)}...` : 'Generated'}
          </p>
        </div>

        {/* EXIF Metadata */}
        <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700/60">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> EXIF Metadata</span>
            <span className={exif?.suspicious_timestamp ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
              {exif?.has_exif ? 'PRESENT' : 'STRIPPED'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            {exif?.gps_soft_signal ? 'No GPS (Soft signal only)' : 'GPS coordinates matched'}
          </p>
        </div>
      </div>
    </div>
  );
};
