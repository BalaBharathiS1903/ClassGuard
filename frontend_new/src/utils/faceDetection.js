/**
 * Face detection utility.
 * Uses the browser's FaceDetector API (Chrome/Edge) when available,
 * otherwise falls back to sending the image to the backend for OpenCV-based detection.
 */

/**
 * Check if the browser supports the FaceDetector API.
 */
export function isFaceDetectorSupported() {
  return typeof window !== 'undefined' && 'FaceDetector' in window;
}

/**
 * Detect faces in an image using the browser's FaceDetector API.
 * @param {ImageBitmap|HTMLCanvasElement|HTMLVideoElement|HTMLImageElement} image
 * @returns {Promise<{faceCount: number, faces: Array}>}
 */
export async function detectFacesBrowser(image) {
  if (!isFaceDetectorSupported()) {
    throw new Error('FaceDetector API not supported in this browser');
  }

  const detector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 10 });
  const faces = await detector.detect(image);

  return {
    faceCount: faces.length,
    faces: faces.map(face => ({
      x: face.boundingBox.x,
      y: face.boundingBox.y,
      width: face.boundingBox.width,
      height: face.boundingBox.height,
    })),
  };
}

/**
 * Detect faces by sending the image blob to the backend.
 * Falls back to this when the browser FaceDetector is unavailable.
 * @param {Blob} imageBlob - JPEG blob of the captured frame
 * @returns {Promise<{faceCount: number, faces: Array}>}
 */
export async function detectFacesBackend(imageBlob) {
  // Use dynamic import to avoid circular deps at module load time
  const { default: authFetch } = await import('./authFetch');
  const formData = new FormData();
  formData.append('image', imageBlob, 'capture.jpg');

  const res = await authFetch('/api/v1/detect-face/', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error('Face detection request failed');
  }

  return await res.json();
}

/**
 * Detect faces using the best available method.
 * @param {HTMLVideoElement} videoElement - The video element showing the webcam feed
 * @param {HTMLCanvasElement} canvasElement - A canvas element for frame capture
 * @returns {Promise<{faceCount: number, faces: Array, imageBlob: Blob}>}
 */
export async function detectFaces(videoElement, canvasElement) {
  const ctx = canvasElement.getContext('2d');
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
  ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

  // Try browser-native FaceDetector first
  if (isFaceDetectorSupported()) {
    try {
      const result = await detectFacesBrowser(canvasElement);
      // Also get the blob for upload
      const blob = await new Promise(resolve =>
        canvasElement.toBlob(resolve, 'image/jpeg', 0.9)
      );
      return { ...result, imageBlob: blob };
    } catch (err) {
      console.warn('Browser FaceDetector failed, falling back to backend:', err);
    }
  }

  // Fallback: send to backend
  const blob = await new Promise(resolve =>
    canvasElement.toBlob(resolve, 'image/jpeg', 0.9)
  );

  try {
    const result = await detectFacesBackend(blob);
    return { ...result, imageBlob: blob };
  } catch (err) {
    // If backend also fails, return the blob anyway and let the caller decide
    console.warn('Backend face detection failed:', err);
    return { faceCount: -1, faces: [], imageBlob: blob, error: 'Face detection unavailable' };
  }
}
