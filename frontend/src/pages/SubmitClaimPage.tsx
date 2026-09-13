import React, { useState, useEffect } from 'react';
import { Upload, Car, CheckCircle2, AlertCircle, ArrowRight, ImagePlus, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { submitClaimMultipart, fetchActivePolicies } from '../services/api';
import { ActivePolicy } from '../types';
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

const PRESET_SCENARIOS = [
  {
    title: 'Front Bumper Scuff (Clean Auto-Pay)',
    reg: 'DL04XY2026',
    policy: 'POL-2026-004821',
    tier: 'SUV',
    desc: 'Front bumper scratch and minor scuff against parking lot barrier.',
  },
  {
    title: 'Quarter Panel Dent (Surveyor Review)',
    reg: 'UP16AB8890',
    policy: 'POL-2026-009912',
    tier: 'SEDAN',
    desc: 'Moderate crease and dent on rear quarter panel after parking maneuver.',
  },
  {
    title: 'Fabricated Repeat Crash (Fraud Alert)',
    reg: 'HR26BR1122',
    policy: 'POL-2026-007733',
    tier: 'SUV',
    desc: 'Front crash collision damage reported with multiple panel ruptures.',
  },
];

export const SubmitClaimPage: React.FC<SubmitClaimPageProps> = ({ onClaimSubmitted }) => {
  const [policies, setPolicies] = useState<ActivePolicy[]>([]);
  const [policiesLoading, setPoliciesLoading] = useState(true);
  const [policiesError, setPoliciesError] = useState<string | null>(null);

  const [policyId, setPolicyId] = useState('');
  const [regNo, setRegNo] = useState('');
  const [vehicleTier, setVehicleTier] = useState('SEDAN');
  const [incidentDate, setIncidentDate] = useState('2026-08-30T14:22');
  const [description, setDescription] = useState('Reversed into a pole in parking lot, minor bumper scrape.');

  useEffect(() => {
    let isMounted = true;
    async function loadPolicies() {
      setPoliciesLoading(true);
      setPoliciesError(null);
      try {
        const data = await fetchActivePolicies();
        if (!isMounted) return;
        setPolicies(data);
        if (data.length > 0) {
          // Initialize with the first active policy
          setPolicyId(data[0].policy_id);
          setRegNo(data[0].vehicle_reg_no);
          setVehicleTier(data[0].vehicle_tier);
        }
      } catch (err: any) {
        if (!isMounted) return;
        setPoliciesError(err.message || 'Failed to load active policies');
      } finally {
        if (isMounted) setPoliciesLoading(false);
      }
    }
    loadPolicies();
    return () => {
      isMounted = false;
    };
  }, []);

  const handlePolicyChange = (selectedId: string) => {
    setPolicyId(selectedId);
    const matched = policies.find((p) => p.policy_id === selectedId);
    if (matched) {
      setRegNo(matched.vehicle_reg_no);
      setVehicleTier(matched.vehicle_tier);
    }
  };

  // Guided 4-slot photo state
  const [slotFiles, setSlotFiles] = useState<(File | null)[]>([null, null, null, null]);
  const [slotPreviews, setSlotPreviews] = useState<(string | null)[]>([null, null, null, null]);

  // Soft-cap optional additional photos beyond 4
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleApplyPreset = (preset: typeof PRESET_SCENARIOS[0]) => {
    setRegNo(preset.reg);
    setPolicyId(preset.policy);
    setVehicleTier(preset.tier);
    setDescription(preset.desc);
  };

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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-[#131929] p-6 sm:p-8 rounded-2xl border border-white/[0.12] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-white/[0.08] mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-600/20 text-cyan-400 rounded-xl border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Submit New Vehicle Claim for AI Triage</h2>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Computer Vision Damage Segmentation &amp; National Fraud Hash Registry
              </p>
            </div>
          </div>
        </div>

        {submissionResult ? (
          <ClaimStatusStepper
            claimId={submissionResult.claim_id}
            onReset={handleReset}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMsg && (
              <div className="p-3.5 bg-red-950/60 border border-red-800/80 text-red-300 text-xs rounded-xl flex items-center gap-2.5 animate-in fade-in font-mono">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Quick Test Scenarios */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                Quick Test Scenarios:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {PRESET_SCENARIOS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="p-3 rounded-xl bg-[#070A12] border border-white/[0.08] hover:border-cyan-400/40 text-left transition-all group cursor-pointer"
                  >
                    <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {preset.title}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 mt-1">
                      {preset.reg} • {preset.tier}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Policy & Vehicle */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-mono font-semibold text-slate-400 block mb-1.5 uppercase flex items-center justify-between">
                  <span>Policy Number</span>
                  {policiesLoading && (
                    <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-normal">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Loading...
                    </span>
                  )}
                </label>
                <select
                  value={policyId}
                  onChange={(e) => handlePolicyChange(e.target.value)}
                  disabled={policiesLoading || policies.length === 0}
                  className="w-full bg-[#070A12] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {policiesLoading ? (
                    <option value="">Loading policies...</option>
                  ) : policiesError ? (
                    <option value="">Error: Failed to load policies</option>
                  ) : policies.length === 0 ? (
                    <option value="">No active policies found</option>
                  ) : (
                    policies.map((p) => (
                      <option key={p.policy_id} value={p.policy_id}>
                        {p.policy_id} ({p.policyholder_name})
                      </option>
                    ))
                  )}
                </select>
                {policiesError && (
                  <p className="mt-1 text-[11px] font-mono text-red-400">
                    {policiesError}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs font-mono font-semibold text-slate-400 block mb-1.5 uppercase">
                  Vehicle Registration
                </label>
                <input
                  type="text"
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value.toUpperCase())}
                  required
                  placeholder="e.g. UK07AB1234"
                  className="w-full bg-[#070A12] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 uppercase font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-mono font-semibold text-slate-400 block mb-1.5 uppercase">
                  Vehicle Category
                </label>
                <select
                  value={vehicleTier}
                  onChange={(e) => setVehicleTier(e.target.value)}
                  className="w-full bg-[#070A12] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
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
                <label className="text-xs font-mono font-semibold text-slate-400 block mb-1.5 uppercase">
                  Incident Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  className="w-full bg-[#070A12] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-mono font-semibold text-slate-400 block mb-1.5 uppercase">
                  Incident Damage Narrative
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Briefly describe what happened..."
                  className="w-full bg-[#070A12] border border-white/[0.08] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-400 font-sans"
                />
              </div>
            </div>

            {/* Guided Multi-Photo Upload Section */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-white/[0.08] pb-2.5">
                <div>
                  <label className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                    Vehicle Damage Evidence Photos <span className="text-red-400">*</span>
                  </label>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Guided multi-angle photos improve AI damage segmentation accuracy.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                      slotFiles.filter(Boolean).length + extraFiles.length >= 2
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {slotFiles.filter(Boolean).length + extraFiles.length} attached (min. 2 required)
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
                          ? 'border-cyan-400/30 bg-[#070A12] shadow-[0_0_12px_rgba(34,211,238,0.1)]'
                          : slot.required && slotFiles.filter(Boolean).length + extraFiles.length < 2 && errorMsg
                          ? 'border-red-500/60 bg-red-950/20'
                          : 'border-white/[0.08] hover:border-cyan-400/30 bg-[#070A12]'
                      }`}
                    >
                      {/* Slot Header */}
                      <div className="mb-2.5">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-white">
                            {slot.label}: {slot.title}
                          </span>
                          {slot.required ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              Required
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[#1E293B] text-slate-400 border border-white/[0.05]">
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
                        <div className="relative rounded-lg overflow-hidden border border-white/[0.08] bg-black group">
                          <img
                            src={preview}
                            alt={slot.title}
                            className="w-full h-28 object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 flex flex-col justify-between p-2">
                            <div className="flex items-center justify-between">
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-emerald-300 bg-black/80 px-1.5 py-0.5 rounded border border-emerald-500/40 backdrop-blur-sm">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Attached
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveSlotPhoto(slot.id)}
                                className="p-1.5 bg-red-600/90 hover:bg-red-500 text-white rounded-md shadow transition-colors cursor-pointer"
                                title="Remove photo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <label
                              htmlFor={inputId}
                              className="text-[10px] text-slate-300 hover:text-cyan-300 cursor-pointer underline text-center pb-0.5 font-medium transition-colors"
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
                          className="h-28 rounded-lg border border-dashed border-white/[0.15] hover:border-cyan-400/60 hover:bg-cyan-950/10 cursor-pointer flex flex-col items-center justify-center p-3 text-center transition-all group"
                        >
                          <div className="p-2 rounded-full bg-[#131929] border border-white/[0.08] text-slate-400 group-hover:text-cyan-400 group-hover:border-cyan-400/40 mb-1.5 transition-colors">
                            <Upload className="w-4 h-4" />
                          </div>
                          <span className="text-[11px] font-medium text-slate-300 group-hover:text-white">
                            Click or drag photo here
                          </span>
                          <span className="text-[10px] text-slate-500 mt-0.5 font-mono">JPEG, PNG up to 10MB</span>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Extra Photos (Soft-cap overflow) */}
              {extraPreviews.length > 0 && (
                <div className="pt-2">
                  <span className="text-[11px] text-slate-400 block mb-2 font-medium font-mono">
                    Additional Photos ({extraPreviews.length}):
                  </span>
                  <div className="flex gap-2.5 overflow-x-auto pb-1">
                    {extraPreviews.map((url, i) => (
                      <div key={i} className="relative group w-20 h-20 shrink-0">
                        <img
                          src={url}
                          alt={`Additional photo ${i + 1}`}
                          className="w-20 h-20 object-cover rounded-xl border border-white/[0.08] shadow"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveExtraPhoto(i)}
                          className="absolute -top-1.5 -right-1.5 p-1 bg-red-600 hover:bg-red-500 text-white rounded-full shadow transition-all cursor-pointer"
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
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-cyan-400 cursor-pointer transition-colors"
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
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold shadow-[0_0_16px_rgba(37,99,235,0.45)] hover:shadow-[0_0_24px_rgba(37,99,235,0.7)] active:scale-95 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <div className="flex items-center space-x-2 font-mono">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Executing AutoClaim Forensic Triage...</span>
                  </div>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
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
