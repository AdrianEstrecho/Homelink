// Shared image-picking helpers. There is no upload endpoint in this app — images travel as base64
// data URLs inside ordinary JSON bodies and land in a Postgres TEXT column, the same way product,
// service and gallery images already do. (api/client.js always JSON.stringifies, so FormData
// wouldn't survive the trip, and Render's disk is ephemeral so local files wouldn't persist.)
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_IMAGE_MB = 5;

export function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('That image could not be read.'));
    reader.readAsDataURL(file);
  });
}

// Decoded byte count of a data URL, without allocating the buffer — used to keep a request under
// the server's body limit before it's sent, since a 413 surfaces as a bare "Request failed".
export function dataUrlBytes(dataUrl) {
  const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

// Staff picking a product shot can be told "use a smaller file". A customer photographing a
// broken item on their phone cannot — a modern camera produces 4-12MB and there's no way to
// shrink it from a phone browser. So we re-encode instead of rejecting: longest edge to 1280px
// as JPEG, which lands around 150-350KB and keeps three photos comfortably inside the body limit.
export async function downscaleImage(file, { maxEdge = 1280, quality = 0.8 } = {}) {
  // GIFs are usually animated and a canvas would flatten them to one frame; small ones are
  // already small enough to send as they are.
  if (file.type === 'image/gif') return readAsDataUrl(file);

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Some browsers refuse formats they can still decode in an <img>; sending the original is
    // better than failing the return outright, and the server has its own size backstop.
    return readAsDataUrl(file);
  }

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) return readAsDataUrl(file);
  return readAsDataUrl(blob);
}

// Returns an error string, or '' when the file is usable. iOS hands HEIC over as image/jpeg in
// practice, but when it does leak through by its real type a canvas produces a blank image —
// clearer to say so than to upload something black.
export function validateImageFile(file, maxMb = MAX_IMAGE_MB) {
  if (!file) return 'No file selected.';
  if (/heic|heif/i.test(file.type)) return 'HEIC photos aren’t supported. Please choose JPG or PNG.';
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Please upload a JPG, PNG, WebP, or GIF image.';
  if (file.size > maxMb * 1024 * 1024) return `Image must be smaller than ${maxMb}MB.`;
  return '';
}
