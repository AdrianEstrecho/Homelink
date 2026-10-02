// The assistant's face: a friendly handyman in a HomeLink-orange hard hat. Drawn inline rather
// than as an emoji so it looks the same on every device and stays on brand.
export default function HandymanAvatar({ className = 'w-8 h-8' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" focusable="false">
      {/* ears + face */}
      <circle cx="15.5" cy="38" r="4" fill="#E9A57A" />
      <circle cx="48.5" cy="38" r="4" fill="#E9A57A" />
      <circle cx="32" cy="38.5" r="17" fill="#F6C29C" />
      {/* hard hat: dome, raised centre ridge, brim, and a glint of light */}
      <path d="M13 31a19 19 0 0 1 38 0z" fill="#FF6B35" />
      <path d="M28.5 31V13.2a19 19 0 0 1 7 0V31z" fill="#E5531C" />
      <rect x="8.5" y="28.5" width="47" height="5.5" rx="2.75" fill="#D9481A" />
      <path d="M18.5 24.5a14 14 0 0 1 6.5-7.5" stroke="#fff" strokeOpacity=".55" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* eyes, cheeks, smile */}
      <circle cx="25.5" cy="40.5" r="2.3" fill="#14181F" />
      <circle cx="38.5" cy="40.5" r="2.3" fill="#14181F" />
      <circle cx="21" cy="45.5" r="2.4" fill="#F0805E" opacity=".45" />
      <circle cx="43" cy="45.5" r="2.4" fill="#F0805E" opacity=".45" />
      <path d="M26.5 46.5q5.5 5 11 0" stroke="#14181F" strokeWidth="2.3" strokeLinecap="round" fill="none" />
    </svg>
  );
}
