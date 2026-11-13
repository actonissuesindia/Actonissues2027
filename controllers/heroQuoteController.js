const HeroQuote = require('../models/HeroQuote');
const SystemSetting = require('../models/SystemSetting');

// GET /api/hero-quotes (public — cycled through as the Home hero headline).
// Also carries the optional eyebrow/description overrides (set from the
// Settings tab, HERO_EYEBROW_TEXT / HERO_DESCRIPTION_TEXT) in the same
// response so the Home hero only needs one fetch — empty string means
// "Super Admin hasn't set one, use the default copy".
exports.list = async (req, res, next) => {
  try {
    const [quotes, eyebrow, description] = await Promise.all([
      HeroQuote.find().sort({ createdAt: 1 }),
      SystemSetting.findOne({ key: 'HERO_EYEBROW_TEXT' }),
      SystemSetting.findOne({ key: 'HERO_DESCRIPTION_TEXT' })
    ]);
    res.json({
      success: true,
      quotes,
      eyebrowText: eyebrow?.value || '',
      descriptionText: description?.value || ''
    });
  } catch (err) {
    next(err);
  }
};

function validateText(text, res) {
  if (!text) {
    res.status(400).json({ success: false, message: 'Quote text is required' });
    return null;
  }
  if (text.length > 120) {
    res.status(400).json({ success: false, message: 'Keep it under 120 characters' });
    return null;
  }
  return text;
}

// POST /api/admin/hero-quotes (Super Admin only)
exports.create = async (req, res, next) => {
  try {
    const text = validateText((req.body.text || '').trim(), res);
    if (!text) return;
    const quote = await HeroQuote.create({ text, postedBy: req.user._id });
    res.status(201).json({ success: true, quote });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/admin/hero-quotes/:id
exports.update = async (req, res, next) => {
  try {
    const text = validateText((req.body.text || '').trim(), res);
    if (!text) return;
    const quote = await HeroQuote.findByIdAndUpdate(req.params.id, { text }, { new: true });
    if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });
    res.json({ success: true, quote });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/admin/hero-quotes/:id
exports.remove = async (req, res, next) => {
  try {
    const quote = await HeroQuote.findByIdAndDelete(req.params.id);
    if (!quote) return res.status(404).json({ success: false, message: 'Quote not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
