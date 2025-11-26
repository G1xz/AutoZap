export default function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[9998] flex h-screen w-screen items-center justify-center bg-background/50 backdrop-blur-sm" data-page-loading>
      <video
        src="/loadingnew.webm"
        autoPlay
        loop
        muted
        playsInline
        className="h-full w-full object-cover"
      />
    </div>
  );
}
