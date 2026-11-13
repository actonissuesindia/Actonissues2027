const User = require('../models/User');
const Issue = require('../models/Issue');
const roleLabel = require('../utils/roleLabel');

// Purely computed from counts already fetched — no schema, nothing stored.
// Intentionally minimal: no achievement system existed anywhere in the app
// before this, so these thresholds are a starting point, not a claim of
// completeness.
function computeBadges({ reported, resolved }) {
  const badges = [];
  if (reported >= 1) badges.push('First Report');
  if (reported >= 5) badges.push('Active Reporter');
  if (reported >= 20) badges.push('Community Pillar');
  if (resolved >= 1) badges.push('Problem Solver');
  if (resolved >= 10) badges.push('Change Maker');
  return badges;
}

// GET /api/reporters/:id — public. Returns only an explicit allowlist of
// fields (never the default toJSON, which strips just `password` — email,
// phone, userId, and googleId all still need to be kept off a public
// endpoint by hand, see models/User.js).
exports.getPublicProfile = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, isDisabled: { $ne: true } })
      .select('name avatar banner role createdAt')
      .lean();
    if (!user) return res.status(404).json({ success: false, message: 'Profile not found' });

    const [reported, resolved, supported] = await Promise.all([
      Issue.countDocuments({ reporter: user._id, moderationStatus: 'Approved' }),
      Issue.countDocuments({ reporter: user._id, moderationStatus: 'Approved', status: 'Resolved' }),
      Issue.countDocuments({ supporters: user._id, moderationStatus: 'Approved' })
    ]);

    res.json({
      success: true,
      profile: {
        name: user.name,
        avatar: user.avatar,
        banner: user.banner,
        roleLabel: roleLabel(user.role),
        memberSince: user.createdAt,
        reported,
        resolved,
        supported,
        badges: computeBadges({ reported, resolved })
      }
    });
  } catch (err) {
    next(err);
  }
};
