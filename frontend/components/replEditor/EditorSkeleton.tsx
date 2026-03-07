export function EditorSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-[#0d0d0f]">
      <div className="h-11 bg-[#111114] border-b border-white/8" />
      <div className="flex flex-1">
        <div className="w-[200px] bg-[#0f0f12] border-r border-white/8" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-white/10 border-t-white/50 rounded-full animate-spin" />
        </div>
      </div>
    </div>
  );
}
