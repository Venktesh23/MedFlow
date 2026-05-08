export type ClinicalNote = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

type ClinicalNotePanelProps = {
  note: ClinicalNote;
  editable?: boolean;
  onChange?: (note: ClinicalNote) => void;
};

const fields: Array<{ key: keyof ClinicalNote; label: string; hint: string }> = [
  { key: "subjective", label: "Subjective", hint: "MedFlow template: CC and HPI blocks" },
  { key: "objective", label: "Objective", hint: "Vitals and physical exam blocks" },
  { key: "assessment", label: "Assessment", hint: "Impression" },
  { key: "plan", label: "Plan", hint: "One bullet per line (- …)" },
];

export function ClinicalNotePanel({ note, editable = false, onChange }: ClinicalNotePanelProps) {
  return (
    <div className="grid grid-cols-1 gap-4">
      {fields.map((field) => (
        <div
          key={field.key}
          className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-4"
        >
          <h3 className="text-[#1A1A2E] font-semibold mb-0.5">{field.label}</h3>
          <p className="text-xs text-[#9CA3AF] mb-2">{field.hint}</p>
          {editable ? (
            <textarea
              value={note[field.key]}
              onChange={(event) =>
                onChange?.({ ...note, [field.key]: event.target.value })
              }
              className="w-full min-h-[88px] resize-none rounded-lg border border-[#E5E7EB] p-3 text-sm text-[#1A1A2E] outline-none focus:border-[#047857]"
            />
          ) : (
            <p className="text-sm leading-6 text-[#6B7280] whitespace-pre-line">
              {note[field.key] || "No generated content yet."}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
