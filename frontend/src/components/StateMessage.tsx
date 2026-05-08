type StateMessageProps = {
  title: string;
  message: string;
  tone?: "neutral" | "error" | "loading";
  actionLabel?: string;
  onAction?: () => void;
};

export function StateMessage({
  title,
  message,
  tone = "neutral",
  actionLabel,
  onAction,
}: StateMessageProps) {
  const icon =
    tone === "loading" ? (
      <span className="h-5 w-5 rounded-full border-2 border-[#047857] border-t-transparent animate-spin" />
    ) : (
      <span className="h-10 w-10 rounded-full bg-[rgba(4, 120, 87,0.12)] text-[#047857] flex items-center justify-center">
        {tone === "error" ? "!" : "i"}
      </span>
    );

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-6 flex items-center gap-4 text-left">
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <h3 className="text-[#1A1A2E] font-semibold">{title}</h3>
        <p className="text-sm text-[#6B7280] mt-1">{message}</p>
        {actionLabel && onAction && tone !== "loading" && (
          <button
            type="button"
            onClick={onAction}
            className="mt-3 px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm text-[#1A1A2E] hover:bg-[#FAFAFA] transition-colors"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
