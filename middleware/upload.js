const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Never build the on-disk filename from the attacker-controlled
// originalname directly — a name like "../../../etc/passwd.png" or one
// containing URL-breaking characters can escape the uploads directory or
// corrupt the stored path. Keep only the extension; the real name is still
// preserved separately as `originalName` for display.
const safeFilename = (originalname) => {
  const ext = path.extname(originalname).toLowerCase();
  return `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
};

// Cloud Run's local disk is ephemeral and not shared across instances, so once
// a bucket is configured we keep uploads in memory here and let the
// controller hand the buffer straight to Google Cloud Storage instead of
// writing it to disk at all.
const useGCS = !!process.env.GCS_BUCKET;

let storage;
if (useGCS) {
  storage = multer.memoryStorage();
} else {
  const uploadDir = 'uploads/';
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  storage = multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, safeFilename(file.originalname))
  });
}

// Rejecting a file has to say which file and why. multer's own way of
// refusing one — cb(null, false) — drops it silently, so the request carried
// on with fewer files than the person picked and they were left to work out
// from a downstream "No files uploaded" what had happened to their photo.
// An Error with a `status` reaches the browser as that exact sentence (see
// middleware/errorHandler.js), naming the file it's about.
const rejectFile = (file, reason) => {
  const err = new Error(`"${file.originalname}" ${reason}`);
  err.status = 400;
  return err;
};

const ALLOWED_ATTACHMENTS = ['.png', '.jpg', '.jpeg', '.mp4', '.mov'];

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_ATTACHMENTS.includes(path.extname(file.originalname).toLowerCase())) return cb(null, true);
    cb(rejectFile(file, "isn't a file type this form accepts — attach JPG, PNG, MP4 or MOV files only. (A photo straight from an iPhone can be a .HEIC file; setting the camera to “Most Compatible” saves JPGs instead.)"));
  }
});

// Profile photos/banners: images only, smaller cap than issue attachments —
// a stray video here would break the plain <img> rendering they're used for.
const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (['.png', '.jpg', '.jpeg'].includes(path.extname(file.originalname).toLowerCase())) return cb(null, true);
    cb(rejectFile(file, "isn't an image this form accepts — choose a JPG or PNG."));
  }
});

// PRI Localbody Email IDs report exports (from lgdirectory.gov.in) for the
// Department Directory bulk import — see controllers/departmentContactController.js.
// Always memory storage regardless of GCS config: the file itself is never
// kept, only the rows parsed out of it.
const uploadSpreadsheet = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const ok = ['.xlsx', '.xls', '.csv'];
    cb(null, ok.includes(path.extname(file.originalname).toLowerCase()));
  }
});

module.exports = upload;
module.exports.uploadImage = uploadImage;
module.exports.uploadSpreadsheet = uploadSpreadsheet;
