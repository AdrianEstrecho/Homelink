// Glass card for dark sections with a soft orange glow that follows the
// pointer (.spotlight-glow in index.css). The pointer position is written
// straight to CSS variables on the element rather than React state, so
// tracking the mouse never triggers a re-render.
export default function SpotlightCard({ children, className = '' }) {
  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  };

  return (
    <div
      onMouseMove={handleMove}
      className={`spotlight-card group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.10] to-white/[0.03] transition-all duration-300 hover:-translate-y-1 hover:border-white/25 ${className}`}
    >
      <div className="spotlight-glow" aria-hidden="true" />
      <div className="relative h-full">{children}</div>
    </div>
  );
}
