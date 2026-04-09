export default function AmbientGlow() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
      {/* violet — top left */}
      <div className="absolute -top-32 -left-32 w-[480px] h-[480px]
                      bg-violet-600/8 rounded-full blur-[120px]" />
      {/* cyan — bottom right */}
      <div className="absolute bottom-0 right-0 w-[360px] h-[360px]
                      bg-cyan-500/6 rounded-full blur-[100px]" />
      {/* indigo — center subtle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                      w-[600px] h-[300px] bg-indigo-700/4 rounded-full blur-[140px]" />
    </div>
  );
}
