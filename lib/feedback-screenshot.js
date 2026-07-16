export const FEEDBACK_SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
export const FEEDBACK_SCREENSHOT_MAX_LABEL = "5 MB";
export const FEEDBACK_SCREENSHOT_TYPES = {
  "image/png": { extension: "png", label: "PNG" },
  "image/jpeg": { extension: "jpg", label: "JPG" },
  "image/webp": { extension: "webp", label: "WEBP" }
};

export function getFeedbackScreenshotType(type) {
  return FEEDBACK_SCREENSHOT_TYPES[type] || null;
}
