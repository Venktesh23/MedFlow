type RecordingButtonProps = {
  isRecording: boolean;
  onClick: () => void;
  idleLabel?: string;
  recordingLabel?: string;
  disabled?: boolean;
};

export function RecordingButton({
  isRecording,
  onClick,
  idleLabel = "Start recording",
  recordingLabel = "Stop & save note",
  disabled = false,
}: RecordingButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative h-36 w-36 rounded-full text-white font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#9CA3AF] ${
        isRecording
          ? "bg-[#047857] medflow-recording-pulse"
          : "bg-[#9CA3AF] hover:bg-[#047857]"
      }`}
    >
      {isRecording && (
        <span className="absolute inset-0 rounded-full border-8 border-[#047857]/20 medflow-recording-ring" />
      )}
      <span className="relative text-center text-sm leading-tight px-3">
        {isRecording ? recordingLabel : idleLabel}
      </span>
    </button>
  );
}
