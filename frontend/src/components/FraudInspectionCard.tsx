import React from 'react';
import { ShieldCheck, ShieldAlert, Camera, Hash, Clock, Eye, AlertTriangle } from 'lucide-react';
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
    <div className="p-4 rounded-xl bg-[#070A12] border border-white/[0.08] flex flex-col gap-3 shadow-lg">
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-white text-xs uppercase tracking-wider">
              Forensic Analysis Report
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">Heuristic Forensics &amp; Perceptual Integrity</p>
          </div>
        </div>

        <div>
          {hasFraud ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-red-500/20 text-red-400 border border-red-500/40 animate-fraud-pulse">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              Fraud Vector ({claim.fraud_score})
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Passed Integrity
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
        {/* Blur Check */}
        <div className="p-2.5 bg-[#131929] rounded-lg border border-white/[0.05] hover:border-cyan-400/30 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="flex items-center gap-1 text-[10px] uppercase font-medium">
              <Eye className="w-3 h-3 text-cyan-400" /> Blur Score
            </span>
            <span className={isBlurry ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
              {blurScore > 0 ? `${blurScore.toFixed(0)}` : 'N/A'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 truncate">
            {isBlurry ? 'Sub-threshold (< 100)' : 'Sharp (> 100)'}
          </p>
        </div>

        {/* Vehicle Presence */}
        <div className="p-2.5 bg-[#131929] rounded-lg border border-white/[0.05] hover:border-cyan-400/30 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="flex items-center gap-1 text-[10px] uppercase font-medium">
              <ShieldCheck className="w-3 h-3 text-emerald-400" /> Vehicle
            </span>
            <span className={claim.photo_validation_passed ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {claim.photo_validation_passed ? 'VERIFIED' : 'FAILED'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 truncate">
            {claim.photo_validation_passed ? 'Body recognized' : 'Check angle'}
          </p>
        </div>

        {/* Perceptual Hash Duplicate */}
        <div className="p-2.5 bg-[#131929] rounded-lg border border-white/[0.05] hover:border-cyan-400/30 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="flex items-center gap-1 text-[10px] uppercase font-medium">
              <Hash className="w-3 h-3 text-purple-400" /> pHash
            </span>
            <span className={hasFraud ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
              {hasFraud ? 'MATCH' : 'UNIQUE'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 truncate font-mono" title={photo?.phash || 'Generated'}>
            {photo?.phash ? `${photo.phash.slice(0, 10)}...` : 'Unique hash'}
          </p>
        </div>

        {/* EXIF Metadata */}
        <div className="p-2.5 bg-[#131929] rounded-lg border border-white/[0.05] hover:border-cyan-400/30 transition-colors">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="flex items-center gap-1 text-[10px] uppercase font-medium">
              <Clock className="w-3 h-3 text-blue-400" /> EXIF
            </span>
            <span className={exif?.suspicious_timestamp ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>
              {exif?.has_exif ? 'PRESENT' : 'CLEARED'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 truncate">
            {exif?.gps_soft_signal ? 'Soft signal GPS' : 'Metadata clean'}
          </p>
        </div>
      </div>
    </div>
  );
};
