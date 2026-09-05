import React, { useState } from 'react';
import { Upload, Car, CheckCircle2, AlertCircle, ArrowRight, ImagePlus, Trash2 } from 'lucide-react';
import { submitClaimMultipart } from '../services/api';
import { ClaimStatusStepper } from '../components/ClaimStatusStepper';

interface SubmitClaimPageProps {
  onClaimSubmitted: () => void;
}

interface GuidedSlot {
  id: number;
  label: string;
  title: string;
  description: string;
  required: boolean;
}

const GUIDED_SLOTS: GuidedSlot[] = [
  {
    id: 0,
    label: 'Slot 1',
    title: 'Wide shot',
    description: 'The full damaged area from ~2 meters away',
    required: true,
  },
  {
    id: 1,
    label: 'Slot 2',
    title: 'Close-up',
    description: 'The damage itself from ~30–50cm away',
    required: true,
  },
  {
    id: 2,
    label: 'Slot 3',
    title: 'Different angle',
    description: "Helps if damage isn't fully visible in one shot",
    required: false,
  },
  {
    id: 3,
    label: 'Slot 4',
    title: 'Additional close-up',
    description: 'For a second damage area, if any',
    required: false,
  },
];

export const SubmitClaimPage: React.FC<SubmitClaimPageProps> = ({ onClaimSubmitted }) => {
  const [policyId, setPolicyId] = useState('POL-2026-004821');
  const [regNo, setRegNo] = useState('UK07AB1234');
  const [vehicleTier, setVehicleTier] = useState('SEDAN');
  const [incidentDate, setIncidentDate] = useState('2026-08-30T14:22');
  const [description, setDescription] = useState('Reversed into a pole in parking lot, minor bumper scrape.');
  
  // Guided 4-slot photo state
  const [slotFiles, setSlotFiles] = useState<(File | null)[]>([null, null, null, null]);
  const [slotPreviews, setSlotPreviews] = useState<(string | null)[]>([null, null, null, null]);
  
  // Soft-cap optional additional photos beyond 4
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
  
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSlotFileSelect = (slotIdx: number, files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;
    setErrorMsg(null);

    setSlotFiles((prevFiles) => {
      const nextFiles = [...prevFiles];
      setSlotPreviews((prevPreviews) => {
        const nextPreviews = [...prevPreviews];

        // Replace or set selected slot
        if (nextPreviews[slotIdx]) {
          URL.revokeObjectURL(nextPreviews[slotIdx]!);
        }
        nextFiles[slotIdx] = fileArray[0];
        nextPreviews[slotIdx] = URL.createObjectURL(fileArray[0]);

        // If multiple files were chosen, fill subsequent empty slots
        let filePtr = 1;
        for (let i = 0; i < 4 && filePtr < fileArray.length; i++) {
          if (i !== slotIdx && !nextFiles[i]) {
            nextFiles[i] = fileArray[filePtr];
            nextPreviews[i] = URL.createObjectURL(fileArray[filePtr]);
            filePtr++;
          }
        }

        // Soft-cap: overflow files stored in extraFiles
        if (filePtr < fileArray.length) {
          const remaining = fileArray.slice(filePtr);
          setExtraFiles((prev) => [...prev, ...remaining]);
          setExtraPreviews((prev) => [...prev, ...remaining.map((f) => URL.createObjectURL(f))]);
        }

        return nextPreviews;
      });
      return nextFiles;
    });
  };

  const handleRemoveSlotPhoto = (slotIdx: number) => {
    setSlotFiles((prev) => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
    setSlotPreviews((prev) => {
      const next = [...prev];
      if (next[slotIdx]) {
        URL.revokeObjectURL(next[slotIdx]!);
        next[slotIdx] = null;
      }
      return next;
    });
  };

  const handleAddExtraFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setErrorMsg(null);
      const files = Array.from(e.target.files);
      setExtraFiles((prev) => [...prev, ...files]);
      const urls = files.map((f) => URL.createObjectURL(f));
      setExtraPreviews((prev) => [...prev, ...urls]);
    }
  };

  const handleRemoveExtraPhoto = (index: number) => {
    setExtraFiles((prev) => prev.filter((_, i) => i !== index));
    setExtraPreviews((prev) => {
      if (prev[index]) URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const allFiles = [
      ...slotFiles.filter((f): f is File => f !== null),
      ...extraFiles,
    ];

    // Minimum requirement: at least 2 photos (wide shot + close-up)
    if (allFiles.length < 2) {
      setErrorMsg('Please upload at least a wide shot and one close-up photo of the damage for accurate assessment.');
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

      allFiles.forEach((file) => {
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
    slotPreviews.forEach((url) => {
      if (url) URL.revokeObjectURL(url);
    });
    extraPreviews.forEach((url) => URL.revokeObjectURL(url));
    setSlotFiles([null, null, null, null]);
    setSlotPreviews([null, null, null, null]);
    setExtraFiles([]);
    setExtraPreviews([]);
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

            {/* Guided Multi-Photo Upload Section */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-700/60 pb-2.5">
                <div>
                  <label className="text-xs font-semibold text-slate-200">
                    Vehicle Damage Photos <span className="text-red-400">*</span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Guided multi-angle photos improve AI detection accuracy.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      (slotFiles.filter(Boolean).length + extraFiles.length) >= 2
                        ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                        : 'bg-amber-950/60 text-amber-400 border-amber-500/30'
                    }`}
                  >
                    {slotFiles.filter(Boolean).length + extraFiles.length} photo{(slotFiles.filter(Boolean).length + extraFiles.length) !== 1 ? 's' : ''} attached (min. 2 required)
                  </span>
                </div>
              </div>

              {/* 4 Guided Slots Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {GUIDED_SLOTS.map((slot) => {
                  const preview = slotPreviews[slot.id];
                  const inputId = `guided-slot-input-${slot.id}`;

                  return (
                    <div
                      key={slot.id}
                      className={`flex flex-col justify-between rounded-xl border p-3.5 transition-all ${
                        preview
                          ? 'border-slate-700 bg-slate-900/80 shadow'
                          : slot.required && (slotFiles.filter(Boolean).length + extraFiles.length) < 2 && errorMsg
                          ? 'border-red-500/60 bg-red-950/20'
                          : 'border-slate-700/80 hover:border-slate-600 bg-slate-900/40'
                      }`}
                    >
                      {/* Slot Header */}
                      <div className="mb-2.5">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-white">
                            {slot.label}: {slot.title}
                          </span>
                          {slot.required ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              Required
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                              Optional
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight">
                          {slot.description}
                        </p>
                      </div>

                      {/* Hidden File Input */}
                      <input
                        type="file"
                        id={inputId}
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        onChange={(e) => {
                          if (e.target.files) handleSlotFileSelect(slot.id, e.target.files);
                        }}
                        className="hidden"
                      />

                      {/* Slot Dropzone / Preview */}
                      {preview ? (
                        <div className="relative rounded-lg overflow-hidden border border-slate-700/80 bg-slate-950 group">
                          <img
                            src={preview}
                            alt={slot.title}
                            className="w-full h-28 object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-black/40 flex flex-col justify-between p-2">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-300 bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-500/40 backdrop-blur-sm">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Attached
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveSlotPhoto(slot.id)}
                                className="p-1.5 bg-red-600/90 hover:bg-red-500 text-white rounded-md shadow transition-colors"
                                title="Remove photo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <label
                              htmlFor={inputId}
                              className="text-[10px] text-slate-300 hover:text-white cursor-pointer underline text-center pb-0.5 font-medium"
                            >
                              Replace photo
                            </label>
                          </div>
                        </div>
                      ) : (
                        <label
                          htmlFor={inputId}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (e.dataTransfer.files) handleSlotFileSelect(slot.id, e.dataTransfer.files);
                          }}
                          className="h-28 rounded-lg border-2 border-dashed border-slate-700/80 hover:border-blue-500/60 hover:bg-blue-950/10 cursor-pointer flex flex-col items-center justify-center p-3 text-center transition-all group"
                        >
                          <div className="p-2 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 group-hover:text-blue-400 group-hover:border-blue-500/40 mb-1.5 transition-colors">
                            <Upload className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] font-medium text-slate-300 group-hover:text-white">
                            Click or drag photo here
                          </span>
                          <span className="text-[10px] text-slate-500 mt-0.5">JPEG or PNG up to 10MB</span>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Extra Photos (Soft-cap overflow) */}
              {extraPreviews.length > 0 && (
                <div className="pt-2">
                  <span className="text-[11px] text-slate-400 block mb-2 font-medium">
                    Additional Photos ({extraPreviews.length}):
                  </span>
                  <div className="flex gap-2.5 overflow-x-auto pb-1">
                    {extraPreviews.map((url, i) => (
                      <div key={i} className="relative group w-20 h-20 shrink-0">
                        <img
                          src={url}
                          alt={`Additional photo ${i + 1}`}
                          className="w-20 h-20 object-cover rounded-xl border border-slate-700 shadow"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveExtraPhoto(i)}
                          className="absolute -top-1.5 -right-1.5 p-1 bg-red-600 hover:bg-red-500 text-white rounded-full shadow transition-all"
                          title="Remove photo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Additional Angle Link */}
              <div className="flex justify-end pt-1">
                <input
                  type="file"
                  id="extraPhotosInput"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleAddExtraFiles}
                  className="hidden"
                />
                <label
                  htmlFor="extraPhotosInput"
                  className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-blue-400 cursor-pointer transition-colors"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>Add another photo beyond 4</span>
                </label>
              </div>
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
