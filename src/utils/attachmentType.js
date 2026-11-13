const VIDEO_EXTENSIONS = ['.mp4', '.mov'];

// Attachments only ever come from middleware/upload.js's fileFilter (jpg/
// jpeg/png/mp4/mov), so the extension alone is a reliable enough signal —
// no need to sniff MIME types for content this app itself generated.
export function isVideoAttachment(attachment) {
  const name = (attachment?.fileName || attachment?.originalName || '').toLowerCase();
  return VIDEO_EXTENSIONS.some(ext => name.endsWith(ext));
}
