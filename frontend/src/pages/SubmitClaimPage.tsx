import React, { useState } from 'react';
import { Upload, Car, Calendar, FileText, CheckCircle2, AlertCircle, ArrowRight, ImagePlus, Trash2 } from 'lucide-react';
import { submitClaimMultipart } from '../services/api';
import { ClaimStatusStepper } from '../components/ClaimStatusStepper';

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
    if (e.target.files && e.target.files.length > 0) {
      setErrorMsg(null);
      const files = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...files]);
      const urls = files.map((f) => URL.createObjectURL(f));
      setPreviewUrls((prev) => [...prev, ...urls]);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Strict validation: photo is required
    if (selectedFiles.length === 0) {
      setErrorMsg('Please upload at least one photo of the vehicle damage to proceed.');
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('policy_id', policyId);
      formData.append('registration_no', regNo);
      formData.append('vehicle_tier', vehicleTier);
      formData.append('incident_date_time', incidentDate);
      formData.append('incident_description', description);

      selectedFiles.forEach((file) => {
        formData.append('photos', file);
      });

      const res = await submitClaimMultipart(formData);
      setSubmissionResult(res);
      onClaimSubmitted();
    } catch (err: any) {
      setErrorMsg(err.message || 'Claim submission failed. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmissionResult(null);
    setSelectedFiles([]);
    setPreviewUrls([]);
    setErrorMsg(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-slate-800/80 p-6 sm:p-8 rounded-2xl border border-slate-700 shadow-xl">
        {/* Header */}
        <div className="flex items-center space-x-3 pb-6 border-b border-slate-700 mb-6">
          <div className="p-3 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
            <Car className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">File Motor Insurance Claim</h2>
            <p className="text-xs text-slate-400 mt-0.5">Upload photos of the vehicle damage for instant automated assessment</p>
          </div>
        </div>

        {submissionResult ? (
          <ClaimStatusStepper
            claimId={submissionResult.claim_id}
            onReset={handleReset}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMsg && (
              <div className="p-3.5 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-xl flex items-center gap-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
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
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Vehicle Category</label>
                <select
                  value={vehicleTier}
                  onChange={(e) => setVehicleTier(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="HATCHBACK">Hatchback (₹450/hr labor)</option>
                  <option value="SEDAN">Sedan (₹550/hr labor)</option>
                  <option value="SUV">SUV (₹700/hr labor)</option>
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
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Incident Description</label>
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
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Vehicle Damage Photos <span className="text-red-400">*</span>
                </label>
                {selectedFiles.length > 0 && (
                  <span className="text-[11px] text-emerald-400 font-semibold">
                    {selectedFiles.length} photo{selectedFiles.length > 1 ? 's' : ''} attached
                  </span>
                )}
              </div>

              <div className={`border-2 border-dashed rounded-2xl p-6 text-center transition-colors ${
                selectedFiles.length === 0 && errorMsg
                  ? 'border-red-500/60 bg-red-950/20'
                  : 'border-slate-700 hover:border-blue-500/60 bg-slate-900/50'
              }`}>
                <input
                  type="file"
                  id="claimPhotos"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="claimPhotos" className="cursor-pointer flex flex-col items-center">
                  <div className="p-3 bg-slate-800 text-blue-400 rounded-full mb-2 border border-slate-700">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-white">Click or drag photos of damaged area</span>
                  <span className="text-[11px] text-slate-400 mt-1">
                    Take clear, well-lit photos from 1–2 meters away. JPEG or PNG up to 10MB each.
                  </span>
                </label>
              </div>

              {/* Selected Photo Thumbnails */}
              {previewUrls.length > 0 && (
                <div className="flex gap-3 mt-3 overflow-x-auto p-1">
                  {previewUrls.map((url, i) => (
                    <div key={i} className="relative group w-20 h-20 shrink-0">
                      <img
                        src={url}
                        alt={`Vehicle damage ${i + 1}`}
                        className="w-20 h-20 object-cover rounded-xl border border-slate-700 shadow"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(i)}
                        className="absolute -top-1.5 -right-1.5 p-1 bg-red-600 hover:bg-red-500 text-white rounded-full shadow transition-all opacity-90 hover:opacity-100"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <label
                    htmlFor="claimPhotos"
                    className="w-20 h-20 shrink-0 border border-dashed border-slate-700 hover:border-blue-500/50 rounded-xl flex flex-col items-center justify-center text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
                  >
                    <ImagePlus className="w-5 h-5 mb-1" />
                    <span className="text-[10px] font-medium">Add more</span>
                  </label>
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
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Uploading photos & starting automated assessment...</span>
                  </div>
                ) : (
                  <>
                    <span>Submit Claim for Assessment</span>
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
