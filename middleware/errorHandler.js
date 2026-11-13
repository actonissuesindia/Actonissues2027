// Controllers that want to show the user a specific message set err.status
// themselves (e.g. res.status(400).json(...) directly, or throw an Error
// with .status set) — anything that reaches here without a status is an
// unexpected failure (a dropped DB connection, a driver internal error,
// etc.) whose raw message was never meant to be user-facing and can leak
// infrastructure details (hostnames, IPs, connection strings). Those get a
// generic message instead; the real error is still logged for debugging.
// Multer's own errors (wrong file size/count/field) arrive here as a plain
// Error with a `.code` but no `.status`, so without this they'd fall into
// the generic "Something went wrong" 500 below instead of explaining what
// was actually wrong with the upload.
const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: 'One of those files is over the 10MB limit. Pick a smaller photo or video, or send it at a lower resolution.',
  LIMIT_FILE_COUNT: 'Too many files at once — up to 6 photos or videos per report.',
  LIMIT_PART_COUNT: 'Too many files at once — up to 6 photos or videos per report.',
  LIMIT_UNEXPECTED_FILE: "That file wasn't in a field this form accepts."
};

// Errors that carry a usable explanation of what the sender got wrong, as
// opposed to an infrastructure failure they can do nothing about. Mongoose
// raises these for bad input, so passing the detail through turns a blank
// "Something went wrong" into something the person can actually act on.
const describeKnownError = (err) => {
  if (err.name === 'ValidationError' && err.errors) {
    // "Path `title` is required." is Mongoose's phrasing, not a sentence to
    // show anyone — the field name is the useful half.
    const fields = Object.keys(err.errors);
    return `Some details are missing or invalid: ${fields.join(', ')}. Check those fields and try again.`;
  }
  if (err.name === 'CastError') {
    return "That link or ID isn't valid — it may have been mistyped or the item may have been deleted.";
  }
  if (err.code === 11000) {
    return 'That already exists. If you were retrying something, it may have gone through the first time — check before trying again.';
  }
  if (err.type === 'entity.too.large' || err.status === 413) {
    return 'That upload is too large to send in one go. Attach fewer or smaller files and try again.';
  }
  return null;
};

const crypto=require('crypto');
const errorPages=require('../services/errorPages');

module.exports=(err,req,res,next)=>{
 // A short code printed both here and in the message below, so a user who
 // can only see "something went wrong" can quote six characters and have the
 // exact stack trace found in the logs. Without it, a support conversation
 // about a generic error has nothing to search on.
 const reference=crypto.randomBytes(3).toString('hex');
 console.error(`[${reference}] ${req.method} ${req.originalUrl}`,err);
 // A response can already be fully sent by the time an error surfaces here
 // (e.g. a session-store error raised after the real response body was
 // written) — writing to it again throws ERR_HTTP_HEADERS_SENT and crashes
 // the request instead of just logging. Express's own docs require this
 // check before a custom error handler writes anything.
 if (res.headersSent) {
   return next(err);
 }
 // A browser loading a page (not the React app calling /api) gets the
 // friendly error page for the status, never a raw JSON blob. The page uses
 // fixed wording per status, so err.message can't leak through it.
 if (errorPages.wantsHtml(req)) {
   const status=(err.status>=400&&err.status<600)?err.status:500;
   return errorPages.sendErrorPage(res,status,status>=500?{reference}:{});
 }
 if (err.code && MULTER_MESSAGES[err.code]) {
   return res.status(400).json({ success:false, message: MULTER_MESSAGES[err.code] });
 }
 const known=describeKnownError(err);
 if (known) {
   return res.status(err.status||400).json({ success:false, message: known, reference });
 }
 const status=err.status||500;
 const message=err.status
   ? (err.message||'Internal Server Error')
   // Still deliberately vague about the cause — a raw driver message can name
   // hostnames and connection strings — but no longer a dead end: the code
   // ties it to the logged stack trace.
   : `Something went wrong at our end — your details were not lost, nothing was posted. Please try again in a moment. (Reference ${reference})`;
 res.status(status).json({
   success:false,
   message,
   reference
 });
};
