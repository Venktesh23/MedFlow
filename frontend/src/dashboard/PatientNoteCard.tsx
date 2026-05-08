import { Link } from "react-router-dom";

type PatientNoteCardProps = {
  /** When set, the whole card navigates to Clinical Notes with this note opened */
  noteId?: string;
  patient: string;
  visitType: string;
  timeAgo: string;
  excerpt: string;
  tags: string[];
  highlighted?: boolean;
  hasDivider?: boolean;
};

export function PatientNoteCard({
  noteId,
  patient,
  visitType,
  timeAgo,
  excerpt,
  tags,
  highlighted,
  hasDivider,
}: PatientNoteCardProps) {
  const shellClass = [
    "block px-[24px] py-[20px] transition-colors",
    highlighted ? "bg-[rgba(238,246,238,0.30)]" : "",
    hasDivider ? "border-t border-[rgba(187,202,191,0.20)]" : "",
    noteId
      ? "cursor-pointer hover:bg-[rgba(4,120,87,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/35"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <div className="flex items-start justify-between mb-1">
        <span className="text-[#065f46] text-[12px] font-bold leading-4 tracking-[0.6px] uppercase">
          AI SUMMARY GENERATED
        </span>
        <span className="text-[#3C4A42] text-[11px] leading-[16.5px] ml-3 flex-shrink-0">
          {timeAgo}
        </span>
      </div>
      <p className="text-[#161D19] text-[16px] font-semibold leading-6 mb-1.5">
        {patient} - {visitType}
      </p>
      <p className="text-[#3C4A42] text-[14px] leading-5 mb-2.5 line-clamp-2">
        {excerpt}
      </p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="text-[#6C7A71] text-[10px] leading-[15px] px-1 py-0.5 bg-[rgba(221,228,221,0.40)] rounded-sm"
          >
            {tag}
          </span>
        ))}
      </div>
    </>
  );

  if (noteId) {
    return (
      <Link to={`/notes?note=${encodeURIComponent(noteId)}`} className={shellClass}>
        {inner}
      </Link>
    );
  }

  return <div className={shellClass}>{inner}</div>;
}
