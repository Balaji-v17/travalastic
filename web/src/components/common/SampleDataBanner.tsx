export default function SampleDataBanner() {
  return (
    <div
      role="status"
      aria-label="Sample data notice"
      className="bg-amber-50 border-b border-amber-200/80 text-amber-900 px-4 py-2.5 text-xs font-medium flex items-center justify-center gap-2 sticky top-[60px] z-30 shadow-xs"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
      <span>Sample data. This page isn't connected to your real trips or bookings yet.</span>
    </div>
  );
}

