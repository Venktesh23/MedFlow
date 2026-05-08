import { generateSOAPNote } from "../services/claudeService.js";

const REQUIRED_FIELDS = [
  "subjective",
  "objective",
  "assessment",
  "plan",
  "tags",
  "summary",
  "followUpRequired",
  "followUpTimeframe",
  "flagged",
  "flagReason",
];

export const ALLOWED_MEDICAL_TAGS = [
  "cardiology",
  "neurology",
  "orthopedics",
  "ent",
  "dermatology",
  "pediatrics",
  "oncology",
  "endocrinology",
  "gastroenterology",
  "pulmonology",
  "psychiatry",
  "general",
  "acute",
  "chronic",
  "post-op",
  "wellness",
  "annual",
];

const PLACEHOLDER_LOWER = "not documented in this visit";

function log(action, message, metadata) {
  const suffix = metadata ? ` ${JSON.stringify(metadata)}` : "";
  console.log(`[MedFlow][NoteGenerationAgent][${action}] ${message}${suffix}`);
}

function unwrapNotePayload(raw) {
  if (!raw || typeof raw !== "object") return {};
  const nested =
    raw.soapNote ||
    raw.clinicalNote ||
    raw.note ||
    raw.data ||
    raw.result ||
    null;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...raw, ...nested };
  }
  return { ...raw };
}

function toBool(value, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1) return true;
  if (value === "false" || value === 0) return false;
  return defaultValue;
}

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === "string") {
    return tags
      .split(/[,;|]+/)
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Flattens nested shapes and coerces types so validation matches real model output.
 */
export function normalizeClinicalNote(raw) {
  const n = unwrapNotePayload(raw);
  return {
    subjective: String(n.subjective ?? "").trim(),
    objective: String(n.objective ?? "").trim(),
    assessment: String(n.assessment ?? "").trim(),
    plan: String(n.plan ?? "").trim(),
    tags: normalizeTags(n.tags),
    summary: String(n.summary ?? "").trim(),
    followUpRequired: toBool(n.followUpRequired, false),
    followUpTimeframe:
      n.followUpTimeframe === undefined || n.followUpTimeframe === null || n.followUpTimeframe === ""
        ? null
        : String(n.followUpTimeframe).trim(),
    flagged: toBool(n.flagged, false),
    flagReason:
      n.flagReason === undefined || n.flagReason === null || n.flagReason === ""
        ? null
        : String(n.flagReason).trim(),
  };
}

function validateRequiredFields(note) {
  return REQUIRED_FIELDS.filter((field) => {
    if (!Object.prototype.hasOwnProperty.call(note || {}, field)) return true;
    if (field === "tags") return !Array.isArray(note.tags);
    if (field === "followUpRequired" || field === "flagged") {
      return typeof note[field] !== "boolean";
    }
    if (field === "followUpTimeframe" || field === "flagReason") {
      const v = note[field];
      if (v === null) return false;
      return typeof v !== "string";
    }
    if (field === "summary" || field === "subjective" || field === "objective" || field === "assessment" || field === "plan") {
      return typeof note[field] !== "string";
    }
    return false;
  });
}

function normalizeTag(tag) {
  return String(tag || "")
    .trim()
    .toLowerCase()
    .replace(/^#/, "")
    .replace(/\s+/g, "-");
}

function isClearlyMedicalTerm(tag) {
  return /^[a-z][a-z-]{2,40}$/.test(tag);
}

export function normalizeMedicalTags(tags = []) {
  const normalized = [...new Set(tags.map(normalizeTag).filter(Boolean))]
    .filter((tag) => ALLOWED_MEDICAL_TAGS.includes(tag) || isClearlyMedicalTerm(tag))
    .slice(0, 4);

  return normalized.length ? normalized : ["wellness"];
}

function fallbackNote(partial = {}) {
  return {
    subjective: partial.subjective || PLACEHOLDER_LOWER,
    objective: partial.objective || PLACEHOLDER_LOWER,
    assessment: partial.assessment || PLACEHOLDER_LOWER,
    plan: partial.plan || PLACEHOLDER_LOWER,
    tags: normalizeMedicalTags(partial.tags || []),
    summary: partial.summary || "Clinical note generated from visit transcript.",
    followUpRequired: Boolean(partial.followUpRequired),
    followUpTimeframe: partial.followUpTimeframe || null,
    flagged: Boolean(partial.flagged),
    flagReason: partial.flagReason || null,
  };
}

function transcriptWordCount(transcript) {
  return transcript.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * When Claude is unavailable (quota, network, bad JSON), produce a usable structured note
 * from speaker-labeled or plain transcripts so the product remains functional.
 */
function parseSpeakerTurns(transcript) {
  const patientChunks = [];
  const doctorChunks = [];
  const t = transcript.trim();
  const turnRe =
    /(Doctor|Patient|Physician|Clinician|MD|RN)\s*:\s*([\s\S]*?)(?=\s*(?:Doctor|Patient|Physician|Clinician|MD|RN)\s*:|$)/gi;
  let m;
  while ((m = turnRe.exec(t)) !== null) {
    const role = m[1].toLowerCase();
    const text = m[2].trim().replace(/\s+/g, " ");
    if (!text) continue;
    if (role === "patient") patientChunks.push(text);
    else doctorChunks.push(text);
  }
  return { patientChunks, doctorChunks };
}

function formatPlanBullets(planText) {
  const trimmed = planText.trim();
  if (!trimmed) return "- Not documented in this visit";
  const sentences = trimmed
    .split(/\.\s+/)
    .map((s) => s.replace(/\.$/, "").trim())
    .filter(Boolean);
  if (!sentences.length) return `- ${trimmed}`;
  return sentences.map((s) => `- ${s}`).join("\n");
}

/**
 * Same MedFlow SOAP scaffolding as the LLM prompt (CC/HPI, Vitals/Exam, Impression, dashed plan).
 */
export function deriveNoteFromTranscript(transcript) {
  const t = transcript.trim();
  const { patientChunks, doctorChunks } = parseSpeakerTurns(t);

  const hpiBody =
    patientChunks.join(" ").trim() ||
    (t.length > 800 ? `${t.slice(0, 800)}…` : t) ||
    PLACEHOLDER_LOWER;

  const ccLine =
    patientChunks[0]?.trim() ||
    hpiBody.split(/[.!?]/)[0]?.trim() ||
    "See HPI.";

  const subjective = `CC:\n${ccLine}\n\nHPI:\n${hpiBody}`;

  const lastDoctorTurn = doctorChunks[doctorChunks.length - 1] || "";
  const lastSentences = lastDoctorTurn
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const examBlock =
    lastSentences
      .filter((s) =>
        /\b(lungs|exam|vitals|auscultation|physical|clear|bp\b|blood pressure|heart rate)\b/i.test(s),
      )
      .join(" ")
      .trim() ||
    doctorChunks
      .filter((line) =>
        /\b(exam|auscultation|vitals|lungs|abdomen|neuro|pe\b|physical|clear)\b/i.test(line),
      )
      .join(" ")
      .trim() ||
    "Not documented in this visit";

  const hasVitalsMention = /\b(vitals?|bp\b|blood pressure|heart rate|temp|temperature|spo2|o2|weight)\b/i.test(
    doctorChunks.join(" "),
  );
  const vitalsLine = hasVitalsMention
    ? "Documented in transcript; see audio or raw transcript for values."
    : "Not documented in this visit";

  const objective = `Vitals:\n${vitalsLine}\n\nPhysical exam:\n${examBlock}`;

  const diagnosisSentence =
    lastSentences.find((s) =>
      /\b(diagnosis|impression|likely|consistent with|rule out|assess(ed)? as)\b/i.test(s),
    ) ||
    lastSentences.find((s) => /\b(viral|bacterial|acute|chronic)\s+[\w-]+|syndrome|\w+itis\b/i.test(s)) ||
    lastSentences.find((s) => /\bbronchitis|pneumonia|infection\b/i.test(s)) ||
    "";

  let assessmentLine = diagnosisSentence;
  const planPieces = [];

  if (diagnosisSentence && /[—–]/.test(diagnosisSentence)) {
    const [left, right] = diagnosisSentence.split(/\s*[—–]\s*/);
    assessmentLine = (left || "").replace(/\.$/, "").trim();
    const rhs = (right || "").replace(/\.$/, "").trim();
    if (rhs) planPieces.push(rhs);
  } else if (!assessmentLine) {
    assessmentLine =
      lastSentences[lastSentences.length - 1] ||
      doctorChunks[doctorChunks.length - 1] ||
      "Clinical impression summarized from visit dialogue; see transcript for nuance.";
  }

  lastSentences.forEach((sentence) => {
    if (diagnosisSentence && sentence === diagnosisSentence && /[—–]/.test(diagnosisSentence)) {
      return;
    }
    if (
      /\b(return|follow|recheck|rest|fluids|medication|prescribe|order|refer|schedule|if .* worsens|honey|treat)\b/i.test(
        sentence,
      )
    ) {
      planPieces.push(sentence.replace(/\.$/, "").trim());
    }
  });

  const planFlat =
    [...new Set(planPieces.map((p) => p.replace(/\s+/g, " ").trim()))].filter(Boolean).join(". ").trim() ||
    doctorChunks.filter((_, i) => i >= Math.max(0, doctorChunks.length - 1)).join(" ").trim() ||
    "Not documented in this visit";

  const plan = formatPlanBullets(planFlat);

  const assessment = `Impression:\n${assessmentLine}`;

  const summarySentence = ccLine.length > 200 ? `${ccLine.slice(0, 197)}…` : ccLine;

  return {
    subjective: subjective.slice(0, 8000),
    objective: objective.slice(0, 8000),
    assessment: assessment.slice(0, 4000),
    plan: plan.slice(0, 8000),
    tags: ["general"],
    summary: summarySentence.slice(0, 500),
    followUpRequired: /\b(return|follow\s*up|follow-up|recheck|see (you|back) in)\b/i.test(t),
    followUpTimeframe: null,
    flagged: /\b(urgent|emergency|severe|911|chest pain|stroke|unresponsive)\b/i.test(t),
    flagReason: null,
  };
}

function isPlaceholderSoapOnly(note, transcript) {
  if (transcriptWordCount(transcript) < 12) return false;
  const blocks = [note.subjective, note.objective, note.assessment, note.plan].map((s) =>
    String(s).toLowerCase().trim(),
  );
  return blocks.every((b) => b === PLACEHOLDER_LOWER || b === "");
}

/**
 * Generates, validates, and tags a clinical note from a speaker-labeled transcript.
 *
 * @param {string} transcript Doctor-patient transcript with speaker labels.
 * @param {{ patientContext?: string }} options Optional clinical context for the LLM.
 * @returns {Promise<{ok: boolean, data?: object, error?: object}>}
 */
export async function runNoteGenerationAgent(transcript, options = {}) {
  if (!transcript?.trim()) {
    return {
      ok: false,
      error: { code: "EMPTY_TRANSCRIPT", message: "Transcript is required." },
    };
  }

  log("Claude", "Clinical note generation started", {});

  let lastError = null;
  let parsedObj = null;

  try {
    parsedObj = await generateSOAPNote(transcript, options.patientContext || "");
  } catch (err) {
    lastError = err?.message || String(err);
    log("Claude", "Request failed", { error: lastError });
  }

  if (parsedObj && typeof parsedObj === "object") {
    const normalized = normalizeClinicalNote(parsedObj);
    const missing = validateRequiredFields(normalized);

    if (!missing.length && !isPlaceholderSoapOnly(normalized, transcript)) {
      const note = fallbackNote(normalized);
      note.tags = normalizeMedicalTags(note.tags);

      log("Claude", "Clinical note generation complete", {
        tags: note.tags.join(", "),
      });

      return {
        ok: true,
        data: {
          ...note,
          incomplete: false,
          rawOutput: JSON.stringify(parsedObj),
        },
      };
    }

    lastError =
      missing.length
        ? `Missing or invalid fields: ${missing.join(", ")}`
        : "Model returned only placeholders for a substantive transcript";
    log("Claude", "Validation or quality check failed", { error: lastError });
  } else if (!lastError) {
    lastError = "Empty or unparseable model response";
  }

  const note = fallbackNote(deriveNoteFromTranscript(transcript));
  note.tags = normalizeMedicalTags(note.tags);

  log("Claude", "Using transcript-structured fallback after Claude exhaustion", {
    error: lastError,
  });

  return {
    ok: true,
    data: {
      ...note,
      incomplete: false,
      rawOutput: "",
    },
    warning: {
      code: "CLAUDE_FALLBACK_TRANSCRIPT_STRUCTURED",
      message:
        "The AI model did not return a usable JSON note after retries (quota, API error, or invalid output). A structured note was built from your transcript so documentation is still saved.",
      details: lastError,
    },
  };
}
