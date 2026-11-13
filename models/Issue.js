const mongoose = require('mongoose');
const Counter = require('./Counter');

const AttachmentSchema = new mongoose.Schema({
  fileName: String,
  originalName: String,
  url: String
}, { timestamps: true });

const TOPIC_HIERARCHY = {
  'Roads & Infrastructure': ['Potholes', 'Damaged Roads', 'Road Construction Delay', 'Footpath Damage', 'Bridges & Flyovers', 'Road Signs Missing', 'Speed Breakers', 'Road Encroachments', 'Other'],
  'Water Supply': ['No Water Supply', 'Low Water Pressure', 'Water Leakage', 'Contaminated Water', 'Water Tanker Issues', 'Water Conservation', 'Other'],
  'Drainage & Sewage': ['Drain Blockage', 'Sewage Overflow', 'Water Logging', 'Open Drains', 'Storm Water Drain Issues', 'Other'],
  Electricity: ['Power Outage', 'Low Voltage', 'Transformer Fault', 'Electric Pole Damage', 'Exposed Wires', 'Illegal Connections', 'Other'],
  'Street Lighting': ['Street Lights Not Working', 'Dim Lights', 'Broken Poles', 'New Street Light Request', 'Other'],
  'Garbage & Sanitation': ['Garbage Collection Delay', 'Overflowing Dustbins', 'Illegal Dumping', 'Public Toilet Issues', 'Open Waste Burning', 'Cleanliness', 'Other'],
  'Traffic & Transportation': ['Traffic Congestion', 'Illegal Parking', 'Traffic Signals', 'Bus Stop Issues', 'Public Transport Complaints', 'Auto/Taxi Issues', 'Other'],
  Environment: ['Air Pollution', 'Noise Pollution', 'Water Pollution', 'Industrial Pollution', 'Tree Cutting', 'Plastic Waste', 'Illegal Mining', 'Other'],
  'Public Health': ['Government Hospital Issues', 'Mosquito Breeding', 'Food Safety', 'Public Health Hazard', 'Medical Camp Request', 'Other'],
  Education: ['Government School Issues', 'School Infrastructure', 'Teacher Shortage', 'Mid-Day Meal Issues', 'Student Safety', 'Other'],
  'Government Services': ['Municipality Issues', 'Revenue Department', 'Panchayat Issues', 'Aadhaar', 'Ration Card', 'Voter ID', 'Pension', 'Certificates', 'Public Servant Complaint', 'Other'],
  'Law & Order': ['Corruption', 'Police Complaint', 'Public Safety', 'Theft', 'Vandalism', 'Cyber Crime', 'Drug Abuse', 'Other'],
  'Housing & Land': ['Illegal Construction', 'Land Encroachment', 'Property Dispute', 'Housing Affordability', 'Building Safety', 'Other'],
  'Women, Children & Social Welfare': ['Women Safety', 'Child Welfare', 'Domestic Violence', 'Elderly Care', 'Disability Accessibility', 'Discrimination', 'Other'],
  Animals: ['Street Dogs', 'Stray Cattle', 'Animal Cruelty', 'Dead Animal Removal', 'Wildlife Issues', 'Other'],
  'Markets & Consumer Issues': ['Complaint Against Shops', 'Street Vendors', 'Overpricing', 'Adulteration', 'Consumer Rights', 'Illegal Businesses', 'Other'],
  'Agriculture & Rural Development': ['Irrigation Issues', 'Crop Damage', 'Farmer Support', 'Rural Roads', 'Animal Husbandry', 'Other'],
  'Disaster & Emergency': ['Flooding', 'Fire Hazard', 'Cyclone Damage', 'Earthquake Damage', 'Disaster Relief', 'Other'],
  'Digital & Telecom': ['Internet Issues', 'Mobile Network Problems', 'Public Wi-Fi', 'Cybersecurity', 'Digital Government Services', 'Other'],
  'Public Places & Recreation': ['Parks Maintenance', 'Playgrounds', 'Libraries', 'Community Halls', 'Sports Facilities', 'Other'],
  'Employment & Labour': ['Unemployment', 'Labour Rights', 'Skill Development', 'Wage Issues', 'Employment Schemes', 'Other'],
  'Finance & Banking': ['Banking Services', 'ATM Issues', 'Government Subsidies', 'Financial Fraud', 'Other'],
  'Public Awareness & Suggestions': ['Awareness Campaigns', 'Community Programs', 'Suggestions', 'Volunteer Activities', 'Other'],
  Other: ['User Defined Category']
};
const CATEGORIES = Object.keys(TOPIC_HIERARCHY);
const STATUSES = ['Open', 'In Progress', 'Escalated', 'Resolved', 'Rejected'];
const PRIORITIES = ['Low', 'Medium', 'High'];
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];
// Separate from STATUSES (the issue's real-world resolution progress):
// moderationStatus gates whether a post is publicly visible at all.
const MODERATION_STATUSES = ['Pending', 'Approved', 'Rejected'];

const IssueSchema = new mongoose.Schema({
  issueNumber: { type: String, unique: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  // Auto-detected from title/description at creation time (see
  // services/translationService.js's translateIssueFields) — unlike
  // Articles/PageBlocks, which are always authored in English, an issue can
  // be posted in any supported language, so this is what "the reporter's
  // own original text" means when deciding whether to show a translation.
  originalLanguage: { type: String, default: 'en' },
  // { en: { title, description }, hi: {...}, ... } — every OTHER supported
  // language than originalLanguage. Populated asynchronously after create
  // (not awaited — see issueController.js) so posting an issue isn't slowed
  // down by translation API calls.
  translations: { type: mongoose.Schema.Types.Mixed, default: {} },
  // category remains the top-level topic for existing feeds, filters and reports.
  // Keep this unbounded so pre-taxonomy issues can still be edited.
  category: { type: String, default: 'Other' },
  topic: { type: String, enum: CATEGORIES },
  subTopic: { type: String, trim: true },
  customCategory: { type: String, trim: true, match: /^[A-Za-z0-9 &-]{4,30}$/ },
  status: { type: String, enum: STATUSES, default: 'Open' },
  priority: { type: String, enum: PRIORITIES, default: 'Medium' },
  location: {
    address: { type: String, trim: true },
    city: { type: String, trim: true },
    ward: { type: String, trim: true },
    district: { type: String, trim: true },
    mandal: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, default: 'India' },
    lat: Number,
    lng: Number,
    // Derived from lat/lng by the pre('save') hook below — kept in GeoJSON
    // form (and 2dsphere-indexed) purely so $near radius queries work;
    // lat/lng above stay the source of truth everything else reads.
    geo: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number]
    }
  },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  supporters: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Mutually exclusive with supporters — disagreeing with a report removes
  // any existing support from that user and vice versa (see toggleSupport/
  // toggleDisagree in issueController.js), the same pattern as a classic
  // like/dislike pair.
  disagrees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  attachments: [AttachmentSchema],
  featured: { type: Boolean, default: false },
  commentsLocked: { type: Boolean, default: false },
  moderationStatus: { type: String, enum: MODERATION_STATUSES, default: 'Pending' },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  moderatedAt: Date,
  // Generic "who last touched this record" — separate from moderatedBy, which
  // only tracks approve/reject decisions specifically.
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Auto-generate a human-friendly issue number like AOI-000123.
// Uses an atomic counter (not countDocuments) so concurrent submissions
// or past deletions can never collide on the same number.
IssueSchema.pre('save', async function (next) {
  if (this.location && this.location.lat != null && this.location.lng != null) {
    this.location.geo = { type: 'Point', coordinates: [this.location.lng, this.location.lat] };
  }
  if (this.issueNumber) return next();
  try {
    const seq = await Counter.getNextSequence('issueNumber', async () => {
      // Zero-padded to a fixed width, so a plain string sort gives the
      // numerically-highest issueNumber already in use.
      const last = await this.constructor.findOne({}, 'issueNumber').sort({ issueNumber: -1 });
      const match = last && /^AOI-(\d+)$/.exec(last.issueNumber || '');
      return match ? parseInt(match[1], 10) : 0;
    });
    this.issueNumber = 'AOI-' + String(seq).padStart(6, '0');
    next();
  } catch (err) {
    next(err);
  }
});

IssueSchema.virtual('supportCount').get(function () {
  return this.supporters ? this.supporters.length : 0;
});

IssueSchema.virtual('disagreeCount').get(function () {
  return this.disagrees ? this.disagrees.length : 0;
});

IssueSchema.set('toJSON', { virtuals: true });
IssueSchema.set('toObject', { virtuals: true });

// Every one of these matches an actual filter/sort combination issued
// against this collection (see issueController.js) — without them each of
// those queries was a full collection scan, which only gets slower as the
// number of issues grows.
IssueSchema.index({ moderationStatus: 1, moderatedAt: -1, createdAt: -1 }); // public feed (list)
IssueSchema.index({ moderationStatus: 1, status: 1 }); // feed status tabs (Resolved/Escalated) within the public feed
IssueSchema.index({ reporter: 1 }); // "mine" queries (Rejected tab, My Issues) and top-reporters grouping
IssueSchema.index({ featured: 1, moderationStatus: 1 }); // Home page's Hot Topics query
IssueSchema.index({ category: 1, moderationStatus: 1 }); // category-counts aggregation and the category tag filter
IssueSchema.index({ 'location.geo': '2dsphere' }); // radius search (list's lat/lng/radiusKm params)

module.exports = mongoose.model('Issue', IssueSchema);
module.exports.CATEGORIES = CATEGORIES;
module.exports.TOPIC_HIERARCHY = TOPIC_HIERARCHY;
module.exports.STATUSES = STATUSES;
module.exports.PRIORITIES = PRIORITIES;
module.exports.MODERATION_STATUSES = MODERATION_STATUSES;
module.exports.INDIAN_STATES = INDIAN_STATES;
