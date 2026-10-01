import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Upload, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ACCEPTED_IMAGE_TYPES, squareAvatar, validateImageFile } from '../../utils/imageUpload';

// The signed-in user's avatar with a camera button sitting on its bottom edge. With no photo yet
// the button opens the file picker straight away; once there is one it offers change or remove.
// `className` sets the avatar's size, shape and fallback colours, and `children` (the initials)
// show whenever there's no photo.
export default function EditableAvatar({ className = '', children }) {
  const { user, updateAvatar } = useAuth();
  const { showToast } = useToast();
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Document listeners rather than a fixed backdrop: the account header sits inside a Reveal,
  // and a transformed ancestor would pin a "fixed" backdrop to itself instead of the viewport.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e) => { if (!wrapRef.current?.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const fail = (description) => showToast({
    icon: XCircle, iconClass: 'bg-red-100 text-red-600', title: 'Photo not updated', description,
  });

  const save = async (getAvatar, title) => {
    setMenuOpen(false);
    setBusy(true);
    try {
      await updateAvatar(await getAvatar());
      showToast({ icon: CheckCircle2, iconClass: 'bg-teal-100 text-teal-700', title });
    } catch (err) {
      fail(err.message || 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be picked again after a failure
    if (!file) return;
    // The photo is cropped and shrunk before upload, so a full-size phone shot is fine here.
    const problem = validateImageFile(file, 15);
    if (problem) return fail(problem);
    save(() => squareAvatar(file), 'Profile photo updated');
  };

  const pickFile = () => {
    setMenuOpen(false);
    inputRef.current?.click();
  };

  const hasPhoto = !!user?.avatar;

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <div className={`${className} relative overflow-hidden`}>
        {hasPhoto ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : children}
        {busy && (
          <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={hasPhoto ? () => setMenuOpen(o => !o) : pickFile}
        disabled={busy}
        aria-label={hasPhoto ? 'Change profile photo' : 'Add profile photo'}
        aria-haspopup={hasPhoto ? 'menu' : undefined}
        aria-expanded={hasPhoto ? menuOpen : undefined}
        title={hasPhoto ? 'Change profile photo' : 'Add profile photo'}
        className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-brand-orange text-white ring-[3px] ring-white shadow-md flex items-center justify-center hover:bg-orange-600 hover:scale-105 transition disabled:opacity-60 disabled:hover:scale-100"
      >
        <Camera className="w-4 h-4" />
      </button>

      {menuOpen && (
        <div role="menu" className="absolute left-full top-1/2 -translate-y-1/2 ml-4 w-44 p-1.5 z-20 bg-white rounded-xl border border-gray-100 shadow-xl shadow-brand-navy/10">
          <button type="button" role="menuitem" onClick={pickFile} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            <Upload className="w-4 h-4 text-brand-navy" /> Upload new photo
          </button>
          <button type="button" role="menuitem" onClick={() => save(() => null, 'Profile photo removed')} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition">
            <Trash2 className="w-4 h-4" /> Remove photo
          </button>
        </div>
      )}

      <input ref={inputRef} type="file" accept={ACCEPTED_IMAGE_TYPES.join(',')} onChange={handleFile} className="hidden" />
    </div>
  );
}
