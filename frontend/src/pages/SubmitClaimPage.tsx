import React, { useState } from 'react';
import { Upload, Car, Calendar, FileText, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { submitClaimMultipart } from '../services/api';

interface SubmitClaimPageProps {
  onClaimSubmitted: () => void;
}

export const SubmitClaimPage: React.FC<SubmitClaimPageProps> = ({ onClaimSubmitted }) => {
  const [policyId, setPolicyId] = useState('POL-2026-004821');
  const [regNo, setRegNo] = useState('UK07AB1234');
  const [vehicleTier, setVehicleTier] = useState('SEDAN');
  const [incidentDate, setIncidentDate] = useState('2026-08-30T14:22');
  const [description, setDescription] = useState('Reversed into a pole in parking lot, minor bumper scrape.');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles(files);
      const urls = files.map((f) => URL.createObjectURL(f));
      setPreviewUrls(urls);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('policy_id', policyId);
      formData.append('registration_no', regNo);
      formData.append('vehicle_tier', vehicleTier);
      formData.append('incident_date_time', incidentDate);
      formData.append('incident_description', description);

      if (selectedFiles.length > 0) {
        selectedFiles.forEach((file) => {
          formData.append('photos', file);
        });
      } else {
        // If no file picked, generate a sample synthetic jpeg canvas blob
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 640;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#475569';
          ctx.fillRect(0, 0, 640, 640);
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(100, 100, 320, 320);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(140, 140, 60, 40);
        }
        const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg'));
        formData.append('photos', blob, 'sample_damage.jpg');
      }

      const res = await submitClaimMultipart(formData);
      setSubmissionResult(res);
      onClaimSubmitted();
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-slate-800/80 p-6 sm:p-8 rounded-2xl border border-slate-700 shadow-xl">
        <div className="flex items-center space-x-3 pb-6 border-b border-slate-700 mb-6">
          <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">File Motor Insurance Damage Claim</h2>
            <p className="text-xs text-slate-400 mt-0.5">Automated triage with computer vision & deterministic cost matrix</p>
          </div>
        </div>

        {submissionResult ? (
          <div className="p-6 bg-emerald-950/50 border border-emerald-800 rounded-xl space-y-4 text-center">
            <div className="w-12 h-12 bg-emerald-600/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white">Claim Successfully Submitted!</h3>
            <p className="text-xs text-emerald-200">
              Claim ID: <span className="font-mono font-bold text-white">{submissionResult.claim_id}</span>
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Our AI inference pipeline is currently validating photo sharpness, localizing parts, computing cost estimates, and evaluating escalation rules.
            </p>
            <div className="pt-2">
              <button
                onClick={() => {
                  setSubmissionResult(null);
                  setSelectedFiles([]);
                  setPreviewUrls([]);
                }}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow transition-colors"
              >
                Submit Another Claim
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMsg && (
              <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Policy & Vehicle */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Policy Number</label>
                <select
                  value={policyId}
                  onChange={(e) => setPolicyId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="POL-2026-004821">POL-2026-004821 (Aarav Sharma)</option>
                  <option value="POL-2026-009912">POL-2026-009912 (Priya Patel)</option>
                  <option value="POL-2026-007733">POL-2026-007733 (Vikram Malhotra)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Vehicle Registration</label>
                <input
                  type="text"
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                  required
                  placeholder="e.g. UK07AB1234"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 uppercase font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Vehicle Tier</label>
                <select
                  value={vehicleTier}
                  onChange={(e) => setVehicleTier(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="HATCHBACK">Hatchback (₹450/hr)</option>
                  <option value="SEDAN">Sedan (₹550/hr)</option>
                  <option value="SUV">SUV (₹700/hr)</option>
                </select>
              </div>
            </div>

            {/* Incident Date & Description */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Incident Date & Time</label>
                <input
                  type="datetime-local"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Damage & Incident Details</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe what happened..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Photo Upload Box */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">Damage Photographs (Static Monocular)</label>
              <div className="border-2 border-dashed border-slate-700 hover:border-blue-500/60 rounded-2xl p-6 text-center bg-slate-900/50 transition-colors">
                <input
                  type="file"
                  id="claimPhotos"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="claimPhotos" className="cursor-pointer flex flex-col items-center">
                  <div className="p-3 bg-slate-800 text-blue-400 rounded-full mb-2">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-white">Click to upload damage photos</span>
                  <span className="text-[11px] text-slate-400 mt-1">JPEG, PNG up to 10MB per image. Leave empty to use auto-generated sample image.</span>
                </label>
              </div>

              {/* Thumbnails */}
              {previewUrls.length > 0 && (
                <div className="flex gap-3 mt-3 overflow-x-auto p-1">
                  {previewUrls.map((url, i) => (
                    <img key={i} src={url} alt="preview" className="w-16 h-16 object-cover rounded-lg border border-slate-700 shadow" />
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {submitting ? (
                  <span>Submitting claim & queueing AI inference...</span>
                ) : (
                  <>
                    <span>Submit Claim for AI Assessment</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
