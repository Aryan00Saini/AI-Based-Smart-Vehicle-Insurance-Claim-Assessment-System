/**
 * Plain-English Translations for Decision Engine Escalation Reasons
 * Translates technical error/escalation codes (E1–E9) into clear sentences
 * for policyholders and clean labels for surveyors.
 */

export interface TranslatedReason {
  sentence: string;
  code?: string;
  isEscalation: boolean;
}

export const ESCALATION_DICTIONARY: Record<string, { sentence: string; description: string }> = {
  E1: {
    sentence: 'Damage detected outside recognized vehicle body panels',
    description: 'A damage contour was identified that does not map to a cataloged vehicle part.',
  },
  E2: {
    sentence: 'Damage affects structural or safety-critical components (e.g. Hood/Frame)',
    description: 'Damage to frame-adjacent components requires manual physical safety verification.',
  },
  E3: {
    sentence: 'AI detection confidence is below required automated threshold (80%)',
    description: 'Visual ambiguity or low lighting warrants human surveyor assessment.',
  },
  E4: {
    sentence: 'Damage extends across more than two distinct vehicle panels',
    description: 'Multi-panel collision impact exceeds cosmetic auto-approval criteria.',
  },
  E5: {
    sentence: 'Severe damage level detected requiring full component replacement',
    description: 'Damage area or depth requires structural replacement inspection.',
  },
  E6: {
    sentence: 'Estimated repair cost exceeds the auto-approval ceiling of ₹25,000',
    description: 'Total payable calculation exceeds automated mandate limits.',
  },
  E7: {
    sentence: 'Image flagged during fraud screening for manual review',
    description: 'Perceptual photo match or anomalous metadata triggered manual fraud audit.',
  },
  E8: {
    sentence: 'Part or damage combination requires custom workshop estimate',
    description: 'Rate matrix row is unseeded or missing for this specific vehicle model tier.',
  },
  E9: {
    sentence: 'Photo quality check flagged an issue (blur or vehicle framing)',
    description: 'Image sharpness or vehicle presence score fell below acceptable tolerance.',
  },
};

/**
 * Translates a raw decision reason string from the backend into a plain-English explanation.
 * Example inputs:
 *  "E2: structural-adjacent part damaged" -> { sentence: "Damage affects structural or safety-critical components...", code: "E2" }
 *  "Non-cosmetic severity level (SEVERE)" -> { sentence: "Severe damage level detected requiring inspection", code: "E5" }
 */
export function translateDecisionReason(rawReason: string): TranslatedReason {
  if (!rawReason) {
    return { sentence: 'Review required by surveyor', isEscalation: true };
  }

  const trimmed = rawReason.trim();

  // Check for E1-E9 code match
  const match = trimmed.match(/\b(E[1-9])\b/i);
  if (match) {
    const code = match[1].toUpperCase();
    if (ESCALATION_DICTIONARY[code]) {
      return {
        sentence: ESCALATION_DICTIONARY[code].sentence,
        code: code,
        isEscalation: true,
      };
    }
  }

  // Handle common non-E prefixed phrases
  if (/non-cosmetic/i.test(trimmed) || /severe/i.test(trimmed)) {
    return {
      sentence: 'Severe damage level detected requiring hands-on inspection',
      code: 'E5',
      isEscalation: true,
    };
  }

  if (/no damage/i.test(trimmed)) {
    return {
      sentence: 'No visible exterior vehicle damage could be identified in the uploaded photos',
      isEscalation: true,
    };
  }

  if (/unattributed/i.test(trimmed)) {
    return {
      sentence: 'Damage region could not be clearly attributed to a specific vehicle panel',
      code: 'E1',
      isEscalation: true,
    };
  }

  // Fallback cleanly formatted
  return {
    sentence: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
    isEscalation: true,
  };
}
