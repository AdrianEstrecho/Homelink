import { useRef } from 'react';

const APPLE_SDK_SRC = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
const CLIENT_ID = import.meta.env.VITE_APPLE_CLIENT_ID || '';
const REDIRECT_URI = import.meta.env.VITE_APPLE_REDIRECT_URI || window.location.origin;

let sdkLoadPromise = null;
function loadAppleSdk() {
  if (window.AppleID) return Promise.resolve();
  if (!sdkLoadPromise) {
    sdkLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = APPLE_SDK_SRC;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load Apple sign-in'));
      document.head.appendChild(script);
    });
  }
  return sdkLoadPromise;
}

export function isAppleSignInConfigured() {
  return Boolean(CLIENT_ID);
}

export default function AppleSignInButton({ onSuccess, onError, label = 'Continue with Apple' }) {
  const initialized = useRef(false);

  const handleClick = async () => {
    try {
      await loadAppleSdk();
      if (!initialized.current) {
        window.AppleID.auth.init({ clientId: CLIENT_ID, scope: 'name email', redirectURI: REDIRECT_URI, usePopup: true });
        initialized.current = true;
      }
      const response = await window.AppleID.auth.signIn();
      onSuccess?.(response);
    } catch (err) {
      onError?.(err?.error || err?.message || 'Apple sign-in failed');
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-lg py-2.5 font-medium text-sm text-gray-800 hover:bg-gray-50 transition"
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
        <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.336-1.31-3.4-2.86C3.874 17.5 2.99 13.85 4.13 11.16c.57-1.35 1.612-2.28 2.836-2.35 1.297-.07 2.088.86 3.66.86 1.532 0 2.31-.86 3.66-.86 1.09 0 2.27.6 3.09 1.64-2.72 1.49-2.28 5.37.554 6.7z" />
      </svg>
      {label}
    </button>
  );
}
