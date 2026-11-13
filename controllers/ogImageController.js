const ogImage = require('../services/ogImageService');

// One shaped 1200x630 JPEG per shareable link — see services/ogImageService
// for why the raw attachment can't be used as og:image directly.
//
// Every handler here answers with an image no matter what: an unknown id, a
// post still awaiting review, a deleted photo and a database hiccup all fall
// through to the branded card. A link-preview crawler fetches og:image once
// and caches the result for weeks, so an error response is a share that
// previews broken until the crawler happens to look again.
const send = (res, buffer) => {
  res.set({
    'Content-Type': 'image/jpeg',
    'Content-Length': buffer.length,
    // A card only changes if the post's photo does, and a replaced photo gets
    // a new file name (so a new card URL is not needed — the source key
    // changes, see cardFor). A day is short enough to pick up an edited photo
    // and long enough that repeat scrapes cost nothing.
    'Cache-Control': 'public, max-age=86400'
  });
  res.send(buffer);
};

const sendDefault = async (res) => send(res, await ogImage.defaultCard());

// GET /og/default.jpg — the site-wide card, also the fallback for everything below.
exports.defaultCard = async (req, res, next) => {
  try {
    await sendDefault(res);
  } catch (err) {
    next(err);
  }
};

// GET /og/issues/:id.jpg
exports.issueCard = async (req, res, next) => {
  try {
    const Issue = require('../models/Issue');
    const issue = await Issue.findById(req.params.id).select('attachments moderationStatus').lean();
    // Same rule as the meta injection in server.js: a Pending or Rejected post
    // is only visible to its owner and staff, and a crawler is neither — it
    // still gets a card, just the branded one instead of the photo.
    if (!issue || issue.moderationStatus !== 'Approved') return sendDefault(res);
    send(res, await ogImage.cardFor(ogImage.pickPreviewImage(issue.attachments)));
  } catch (err) {
    // Includes a malformed id, which Mongoose throws a CastError for.
    sendDefault(res).catch(next);
  }
};

// GET /og/articles/:slug.jpg
exports.articleCard = async (req, res, next) => {
  try {
    const Article = require('../models/Article');
    const article = await Article.findOne({ slug: req.params.slug, status: 'Published' })
      .select('coverImage')
      .lean();
    send(res, await ogImage.cardFor(article?.coverImage));
  } catch (err) {
    sendDefault(res).catch(next);
  }
};

// GET /og/reporters/:id.jpg
exports.reporterCard = async (req, res, next) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.params.id).select('avatar isDisabled').lean();
    if (!user || user.isDisabled) return sendDefault(res);
    send(res, await ogImage.cardFor(user.avatar, { portrait: true }));
  } catch (err) {
    sendDefault(res).catch(next);
  }
};
