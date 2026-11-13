const fs = require('fs');
const path = require('path');

// Where an uploaded file physically goes, in one place, so the two callers
// that accept photos — posting a new issue (issueController.create) and adding
// photos to an existing one (attachmentController.upload) — can't drift apart.
//
// Two storage shapes, decided by deployment, not by caller: Google Cloud
// Storage when a bucket is configured, the local uploads/ directory when it
// isn't (Cloud Run's own disk is wiped between instances, so it can't be used
// in production — see middleware/upload.js).
const useGCS = !!process.env.GCS_BUCKET;
const gcs = useGCS ? require('./gcsService') : null;

// Removes files that were already stored — used when a later step fails and
// the whole submission is being abandoned. Best effort by definition: the
// caller is already handling a failure, and an orphaned file is a far smaller
// problem than an error raised while cleaning up after another error.
exports.discard = async (attachments = []) => {
  for (const attachment of attachments) {
    try {
      if (useGCS) {
        await gcs.deleteFile(attachment.fileName);
      } else {
        await fs.promises.unlink(path.join(__dirname, '..', 'uploads', attachment.fileName));
      }
    } catch (err) {
      console.error(`Could not discard the uploaded file ${attachment.fileName}:`, err.message);
    }
  }
};

// Throws away files multer has already accepted but that nothing will use —
// a submission rejected for a missing location, a retry recognised as a
// duplicate. In local-disk mode multer writes every file out before the
// handler runs, so a request that gives up leaves them behind in uploads/
// forever unless they're removed here. In bucket mode (production) files are
// held in memory and have no `path`, so there's nothing to do.
exports.discardUploads = async (files = []) => {
  for (const file of files) {
    if (!file || !file.path) continue;
    try {
      await fs.promises.unlink(file.path);
    } catch (err) {
      console.error(`Could not remove the unused upload ${file.path}:`, err.message);
    }
  }
};

// Stores every file and returns the records to attach to an issue. All or
// nothing: if the fourth of six photos fails, the three already stored are
// removed before the error is re-thrown, so a caller that gives up doesn't
// leave a partial upload behind.
exports.storeFiles = async (files = []) => {
  const stored = [];
  try {
    for (const file of files) {
      if (useGCS) {
        const { fileName, url } = await gcs.uploadFile(file);
        stored.push({ fileName, originalName: file.originalname, url });
      } else {
        stored.push({
          fileName: file.filename,
          originalName: file.originalname,
          url: `/uploads/${file.filename}`
        });
      }
    }
  } catch (err) {
    await exports.discard(stored);
    throw err;
  }
  return stored;
};
