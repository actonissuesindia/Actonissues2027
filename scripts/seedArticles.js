// One-off, non-destructive seed for the first few SEO articles (see the
// content plan from the SEO growth pass) — unlike scripts/seed.js, this
// never deletes anything and skips any article whose slug already exists,
// so re-running it (or running it after someone's already edited a post in
// the Articles admin tab) is always safe.
// Usage: node scripts/seedArticles.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Article = require('../models/Article');
const { sanitizeHtml } = require('../services/emailTemplate');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/actonissue';

const ARTICLES = [
  {
    title: 'How Act On Issues Works: From Report to Resolution',
    slug: 'how-act-on-issues-works',
    excerpt: 'From reporting a pothole to getting a government authority to act on it — here’s exactly what happens to every issue posted on Act On Issues, step by step.',
    tags: ['how-it-works', 'guide'],
    body: `
      <p>Every civic problem posted on Act On Issues moves through the same four stages, and knowing what to expect at each one helps you get a faster result.</p>
      <p><b>1. You report it.</b> Add a title, a description, a category, and — ideally — a photo and location. This takes under a minute and goes live on the public feed once it's reviewed (usually within about 15 minutes, and automatically within a set window even if nobody reviews it sooner).</p>
      <p><b>2. Your community backs it up.</b> Other residents who've seen the same problem can add their support to your report. This isn't just a "like" — it's how Act On Issues tells a genuinely widespread problem apart from an isolated complaint, and it directly decides whether a report is ready to escalate.</p>
      <p><b>3. It gets escalated to the right authority.</b> Once a report has enough community backing, staff email it — with the full details and any photos — directly to the concerned government office. Any reply that office sends back is captured automatically and shown right on the issue's page, so you can see exactly what they said, not just that "something was sent."</p>
      <p><b>4. Status updates happen in the open.</b> Every issue carries a visible status — Open, In Progress, Escalated, Resolved, or Rejected — and you're notified the moment yours changes, by whichever combination of bell notification, push alert, email, and WhatsApp you have turned on.</p>
      <p>Nothing about this process is hidden from you. You can always see who reported an issue, how much support it has, whether it's been escalated, and what — if anything — the authority said back. That transparency is the whole point: a platform where citizens can actually see accountability happening, not just submit a complaint into a void.</p>
      <p>If you haven't reported an issue yet, the fastest way to understand this is to just try it — pick something in your neighbourhood that's been bothering you, and post it.</p>
    `
  },
  {
    title: 'Why Community Support Matters Before an Issue Gets Escalated',
    slug: 'why-community-support-matters',
    excerpt: 'A single complaint is easy to ignore. A hundred residents confirming the same problem is not. Here’s why Act On Issues asks for public support before escalating a report.',
    tags: ['community', 'escalation', 'guide'],
    body: `
      <p>Anyone can complain about a pothole. What makes a government office actually act on it is knowing the complaint reflects a real, shared problem — not one person's frustration on one bad day.</p>
      <p>That's the reasoning behind the support button on every issue. When you support a report, you're telling Act On Issues — and eventually the authority it gets escalated to — "I've seen this too, and it's genuinely a problem." The more residents who do that, the stronger the case becomes.</p>
      <p><b>Why not escalate every report immediately?</b> Because a flood of unverified, one-off complaints is exactly what causes authorities to stop taking a channel seriously. Requiring real community backing first means that by the time a report lands in an official inbox, it already carries proof that it matters to more than one person.</p>
      <p><b>What this means for you as a reporter.</b> The single most useful thing you can do after posting an issue isn't to post it again — it's to bring in the people who already know about it. Share the link with neighbours, your building's WhatsApp group, or anyone else affected, and ask them to sign in and add their support. A report with genuine local backing gets escalated faster than one sitting alone.</p>
      <p><b>What this means for everyone else.</b> If you see a report about a problem you recognize — even if you didn't report it yourself — adding your support takes a few seconds and directly helps get it fixed. You don't need to write a comment or provide evidence; the support itself is the signal.</p>
      <p>Civic accountability doesn't happen because one person shouts the loudest. It happens because a community shows, collectively, that a problem is real. That's what the support feature on Act On Issues is built to capture.</p>
    `
  },
  {
    title: 'How to Escalate a Civic Complaint to the Right Authority',
    slug: 'how-to-escalate-a-civic-complaint',
    excerpt: 'Once a reported issue has enough community support, here’s exactly how Act On Issues gets it in front of the concerned government office — and how you’ll know when they’ve replied.',
    tags: ['escalation', 'guide', 'authorities'],
    body: `
      <p>Getting a civic problem in front of the right government office is usually the hardest part — most people don't know which department to write to, what to include, or how to make sure it doesn't just get ignored. Here's how Act On Issues handles that.</p>
      <p><b>Who does the escalating.</b> Once a report has enough community support behind it, staff review it and send it directly to the concerned authority's email — the municipal office, the electricity board, the water department, or whichever office is relevant to the category of the problem.</p>
      <p><b>What actually gets sent.</b> The email includes the full report: the issue number, category, exact location, description, and any photos attached — either the ones from the original report or extra photos added specifically for the escalation. The authority gets everything they need to act without having to ask a follow-up question.</p>
      <p><b>How replies are handled.</b> This is the part most complaint channels get wrong: once you send an email to a government office, you're usually on your own waiting for a reply that may never visibly arrive. Act On Issues sets up every escalation so a reply from the authority is captured automatically and shown right on the issue's own page — visible to the reporter, not just staff. If they ask a follow-up question or confirm action has been taken, you'll see it there.</p>
      <p><b>What you can do to help.</b> The best thing a reporter can do before escalation is exactly what community support is for — get enough real backing that the report is clearly a shared concern, not an isolated one. After escalation, keeping the issue's page open and checking back is the only thing left to do; you don't need to separately follow up with the authority yourself.</p>
      <p>Escalation is where Act On Issues moves from "recording a complaint" to "getting a real answer from the people responsible." If you've reported an issue and it hasn't been escalated yet, the fastest way to speed that up is simple: get your neighbours to add their support.</p>
    `
  },
  {
    title: 'How to Report a Water Supply Issue Online (and Actually Get It Fixed)',
    slug: 'how-to-report-water-supply-issue-online',
    excerpt: 'No water, low pressure, a leak, or a contaminated supply — here’s exactly what to include in a water supply report so it gets taken seriously and acted on.',
    tags: ['water-supply', 'guide', 'how-to'],
    body: `
      <p>Water supply complaints are some of the most common civic issues reported — and some of the easiest to get dismissed, if the report is too vague to act on. Here's how to report one properly.</p>
      <p><b>Pick the right sub-category.</b> Act On Issues splits Water Supply into specific types: No Water Supply, Low Water Pressure, Water Leakage, Contaminated Water, Water Tanker Issues, and Water Conservation. Choosing the exact one that matches your problem — instead of a generic "water issue" — is what lets it reach the right desk at the water department without a back-and-forth first.</p>
      <p><b>Be specific about location.</b> "No water in my area" is much weaker than a precise address, ward, or landmark. Water infrastructure problems are almost always hyper-local — one street can have a burst pipe while the next one over is fine — so the more exact the location, the faster it can actually be traced to a specific pipeline or connection.</p>
      <p><b>Photograph the evidence, not just the inconvenience.</b> A photo of a visible leak, a dry tap, a tanker that didn't show up, or discoloured water is worth far more than a description alone. If the problem is intermittent (like low pressure at certain hours), mention the pattern and timing in the description — that detail often matters more for a fix than anything else.</p>
      <p><b>Then let the community process work.</b> Once it's posted, the same rules apply as <a href="/articles/how-act-on-issues-works">every other report</a>: neighbours who've noticed the same problem can add their support, and once there's enough backing, it gets <a href="/articles/how-to-escalate-a-civic-complaint">escalated to the concerned water authority</a>. A water supply problem affecting a whole street or colony almost always gets support fast, since everyone nearby has usually noticed it too.</p>
      <p>Water problems rarely fix themselves, and an authority can't act on a complaint that's too vague to locate. A precise report is the single biggest thing you control.</p>
    `
  },
  {
    title: 'How to Track the Status of Your Civic Complaint',
    slug: 'how-to-track-civic-complaint-status',
    excerpt: 'Open, In Progress, Escalated, Resolved, or Rejected — here’s what each status on Act On Issues actually means, and how long you should expect to wait.',
    tags: ['guide', 'status', 'tracking'],
    body: `
      <p>Every issue reported on Act On Issues carries one of five statuses, visible right on its page. Knowing what each one actually means — and doesn't mean — helps you understand where your report really stands.</p>
      <p><b>Open.</b> The default state for a newly approved report. It's live, visible to the public, and can gather community support. Nothing has been escalated yet — this is the "gathering evidence that it's a real, shared problem" stage.</p>
      <p><b>In Progress.</b> Staff or the responsible party have acknowledged the issue is being worked on. This is set manually once there's a real update to share, not automatically on a timer.</p>
      <p><b>Escalated.</b> The report has been formally emailed to the concerned government authority, and it's now waiting on a response. See <a href="/articles/how-to-escalate-a-civic-complaint">how escalation actually works</a> for what gets sent and how a reply gets back to you.</p>
      <p><b>Resolved.</b> The problem has been fixed. Once an issue reaches this status, comments close automatically and it can no longer be marked as a hot topic — it's considered closed out.</p>
      <p><b>Rejected.</b> Either the moderation review didn't approve the original post (meaning it never became public), or a status review determined the report doesn't hold up. This isn't a punishment — reports get rejected for reasons like duplicate content, insufficient detail, or being outside what the platform covers.</p>
      <p><b>Before any of these: Pending review.</b> A freshly submitted report is reviewed before it goes live — usually within about 15 minutes, and automatically within a set window even if no one reviews it manually sooner. This is separate from the five statuses above; it's a moderation gate, not a resolution stage.</p>
      <p>The most useful habit as a reporter is simply this: check back on your own issue's page rather than assuming no news means no progress. Status changes, and any authority reply, show up right there — and if you have notifications turned on, you'll be told the moment anything changes.</p>
    `
  },
  {
    title: "Civic Complaint App vs. Government Grievance Portal: What's the Difference?",
    slug: 'civic-complaint-app-vs-government-portal',
    excerpt: 'Official portals exist for a reason, and so does Act On Issues — here’s an honest look at what each one is actually good for.',
    tags: ['comparison', 'guide'],
    body: `
      <p>If you've ever tried to report a civic problem in India, you've probably run into both options: an official government grievance portal, and a citizen-run platform like Act On Issues. They're not competing for the same job — here's the honest difference.</p>
      <p><b>What government portals are good at.</b> Official channels are the direct, authoritative line to a specific department, and for a narrow, individual issue — a personal document, a specific application status, a formal legal grievance — that direct line is exactly what you need. They exist for accountability at the level of process and paperwork.</p>
      <p><b>What they're not built for.</b> A single complaint dropped into a large official queue has no way to show that it's a shared, community-wide problem rather than one person's isolated report. There's usually no visible public status, no way for neighbours to add their voice, and no easy way to know whether anyone has even seen it.</p>
      <p><b>What Act On Issues adds.</b> The platform is built around exactly what official portals don't do well: public visibility, and a real mechanism — <a href="/articles/why-community-support-matters">community support</a> — for turning an individual complaint into visible proof of a shared problem before it gets <a href="/articles/how-to-escalate-a-civic-complaint">escalated to the actual authority</a>. Everything stays public and trackable, including any reply the authority sends back.</p>
      <p><b>The honest answer: use both.</b> Act On Issues doesn't replace a government portal for things that genuinely need a formal, individual process. What it's for is the much more common case — a pothole, a broken streetlight, an overflowing drain — where the real obstacle isn't paperwork, it's proving that enough people care about it to make it worth fixing. That's a problem visibility solves, not bureaucracy.</p>
      <p>If you're unsure which to use for a specific problem: if it's personal and procedural, use the official portal. If it's a shared civic problem in your neighbourhood, Act On Issues is built exactly for that.</p>
    `
  },
  {
    title: '5 Ways Citizens Can Hold Local Authorities Accountable',
    slug: 'ways-to-hold-local-authorities-accountable',
    excerpt: 'Reporting an issue online is one tool, not the only one. Here are five practical ways residents can push for real civic accountability.',
    tags: ['civic-engagement', 'guide'],
    body: `
      <p>Getting a civic problem fixed rarely comes down to one action — it's usually a combination of visibility, persistence, and knowing which lever to pull. Here are five that actually work together.</p>
      <p><b>1. Report it publicly, not just privately.</b> A complaint sent quietly to one office is easy to lose track of. A report that's publicly visible — like on <a href="/articles/how-act-on-issues-works">Act On Issues</a> — creates a record that others can see, confirm, and build on, which is harder to simply let go stale.</p>
      <p><b>2. Get your neighbours to back it up.</b> Authorities respond to scale. A single voice is easy to deprioritize; a report with dozens of residents confirming it is not. See <a href="/articles/why-community-support-matters">why community support matters</a> for how this works in practice.</p>
      <p><b>3. Escalate through a real, traceable channel.</b> Sending a complaint into a void doesn't create pressure. Escalating it directly to the concerned office — with a way to actually see whether they responded — does. That accountability only works if you can see the reply, not just confirmation that something was "sent."</p>
      <p><b>4. Attend local ward or municipal meetings, if they're open to the public.</b> Online tools build the record and the evidence; showing up in person, even occasionally, reinforces that the people behind a report are real, engaged residents — not just a notification in an inbox.</p>
      <p><b>5. Follow up, and keep the record public.</b> Accountability rarely happens on the first attempt. Keeping a report open, visible, and updated — rather than letting it quietly disappear — is often what eventually gets a slow-moving issue resolved.</p>
      <p>None of these five replace each other. Visibility without follow-up fades; follow-up without evidence of shared concern is easy to ignore. Used together, they're how individual complaints turn into real civic accountability.</p>
    `
  },
  {
    title: 'Report Any Civic Issue by Category: A Complete Guide',
    slug: 'report-civic-issue-by-category',
    excerpt: 'From potholes to power outages to public safety — a complete map of every category of civic issue you can report on Act On Issues.',
    tags: ['categories', 'guide', 'hub'],
    body: `
      <p>Act On Issues organizes every report into one of 22 categories, each with its own set of specific sub-types — choosing the right one is what gets a report in front of the correct authority without delay. Here's the full map.</p>
      <p><b>Everyday infrastructure:</b> Roads &amp; Infrastructure (potholes, damaged roads, footpaths, bridges), <a href="/articles/how-to-report-water-supply-issue-online">Water Supply</a>, Drainage &amp; Sewage, Electricity, and Street Lighting.</p>
      <p><b>Cleanliness and environment:</b> Garbage &amp; Sanitation, Environment (air/noise/water pollution, tree cutting, plastic waste), and Disaster &amp; Emergency (flooding, fire hazards, cyclone or earthquake damage).</p>
      <p><b>Getting around:</b> Traffic &amp; Transportation (congestion, illegal parking, signals, public transport complaints) and Digital &amp; Telecom (internet issues, mobile network problems, public Wi-Fi).</p>
      <p><b>Public services:</b> Public Health (government hospital issues, mosquito breeding, food safety), Education (government school issues, infrastructure, teacher shortage), Government Services (municipality, revenue department, Aadhaar, ration card, pension, certificates), and Finance &amp; Banking (banking services, ATM issues, government subsidies).</p>
      <p><b>Safety and rights:</b> Law &amp; Order (corruption, police complaints, public safety, theft, vandalism), Housing &amp; Land (illegal construction, land encroachment, building safety), and Women, Children &amp; Social Welfare (safety, child welfare, elderly care, accessibility, discrimination).</p>
      <p><b>Community and commerce:</b> Markets &amp; Consumer Issues (shop complaints, street vendors, overpricing, adulteration), Employment &amp; Labour, Agriculture &amp; Rural Development, Animals (street dogs, stray cattle, animal cruelty), and Public Places &amp; Recreation (parks, playgrounds, libraries, community halls, sports facilities).</p>
      <p><b>Everything else:</b> Public Awareness &amp; Suggestions covers campaigns, community programs, and general suggestions that don't fit neatly elsewhere — and a genuine "Other" option exists for anything that still doesn't match, so no real problem goes unreported for lack of a category.</p>
      <p>Picking the closest matching category and sub-category — rather than the broadest one available — is what makes the difference between a report that reaches the right desk quickly and one that sits waiting for someone to re-route it manually. If you're reporting for the first time, see <a href="/articles/how-act-on-issues-works">how the whole process works</a> end to end.</p>
    `
  },
  {
    title: 'How to Get Notified the Moment Your Issue Status Changes',
    slug: 'how-to-get-notified-issue-status-changes',
    excerpt: 'A comment, a status update, an escalation, a reply from an authority — here’s every way Act On Issues can tell you the moment something happens on your report.',
    tags: ['notifications', 'guide'],
    body: `
      <p>Posting a report and then having to remember to check back on it is the easiest way to miss real progress. Act On Issues can tell you directly, through whichever combination of channels you actually use.</p>
      <p><b>The bell icon.</b> Every account gets in-app notifications by default — no setup needed. Click the bell in the top navigation any time you're signed in to see the full history: comments, replies, status changes, and escalation updates.</p>
      <p><b>Push notifications.</b> Turning these on (from the notifications dropdown) means an alert can reach your phone or computer's lock screen even when the site itself isn't open. On iPhone/iPad, this only works once the site has been added to your home screen first — a one-time Apple restriction on all websites, not specific to this platform.</p>
      <p><b>Email.</b> The same events also go out by email automatically — no separate opt-in needed, since it uses whatever address is on your account.</p>
      <p><b>WhatsApp.</b> Where enabled, the same updates can also reach you on WhatsApp, for anyone who prefers a single inbox they already check constantly.</p>
      <p><b>What actually triggers a notification.</b> Your issue being submitted, its status changing, someone commenting on it, someone replying to your specific comment (not just any comment), and it being escalated to an authority — all of these fire through the same system, so you don't need to separately track any of them.</p>
      <p>If you've reported an issue and want to know the instant anything happens to it — including a reply from the authority it was <a href="/articles/how-to-escalate-a-civic-complaint">escalated to</a> — turning on push notifications once is the single most useful five-second setup step available.</p>
    `
  },
  {
    title: 'How to Share a Civic Issue and Rally Your Neighbours',
    slug: 'how-to-share-civic-issue-rally-neighbours',
    excerpt: 'A report with real community backing moves faster. Here’s how to actually get the word out — QR codes, WhatsApp, and one-tap links included.',
    tags: ['sharing', 'community', 'guide'],
    body: `
      <p>An issue sitting alone on the feed, with no one else aware it exists, rarely gathers the support it needs. Sharing it is the fastest way to change that — and it takes seconds.</p>
      <p><b>The Share button.</b> Every issue page has a share option that opens a small panel with several ways to spread it: a downloadable QR code (useful for printing onto a flyer or showing someone in person), and one-tap links to WhatsApp, Facebook, X, and email.</p>
      <p><b>Why WhatsApp specifically works well.</b> For a hyper-local problem — a pothole, a broken streetlight, a garbage collection delay — a building or street WhatsApp group is often where the people who'd actually recognize and support the issue already are. A single tap drops a ready-to-send message with the link included.</p>
      <p><b>The QR code, for in-person situations.</b> Printed and put up near the actual problem — on a notice board, taped near the pothole itself — a QR code lets anyone passing by scan it, see the report, and add their support on the spot, without you having to individually message each of them.</p>
      <p><b>What to say when you share it.</b> A short, specific note works better than just the bare link — mention what the problem is and why it matters ("this pothole caused an accident last week"), since that context is often what convinces someone to actually stop and add their support. See <a href="/articles/why-community-support-matters">why that support matters</a> for what it actually does once collected.</p>
      <p>The share panel exists because getting a real answer from an authority almost always starts with more than one voice. Reporting the problem is step one; making sure your neighbours know about it is what moves it forward.</p>
    `
  },
  {
    title: 'What Makes a Strong Civic Issue Report (and What Doesn’t)',
    slug: 'what-makes-a-strong-civic-issue-report',
    excerpt: 'The difference between a report that gets fixed and one that sits ignored usually comes down to a few details. Here’s what to get right.',
    tags: ['guide', 'how-to', 'tips'],
    body: `
      <p>Not every report gets the same result, and the difference is rarely luck — it's almost always in a handful of details that are easy to get right if you know what matters.</p>
      <p><b>A specific title, not a vague one.</b> "Road problem" tells nobody anything. "Deep pothole outside House No. 14, Gandhi Nagar Main Road" tells everyone exactly what and where, and lets a neighbour recognize it instantly when deciding whether to add their support.</p>
      <p><b>A photo, whenever you can get one.</b> A real photo of the actual problem is worth more than any amount of description — it's the single fastest way for both other residents and, eventually, an authority, to understand the severity without asking a follow-up question.</p>
      <p><b>The exact location, not the general area.</b> Civic problems are usually hyper-local. A precise address, landmark, or map pin is what lets a report actually get traced to the right pipeline, transformer, or stretch of road — see <a href="/articles/report-civic-issue-by-category">the full category guide</a> for how this maps to who's actually responsible.</p>
      <p><b>The right category and sub-category.</b> Picking the closest match — not the broadest available option — is what routes a report correctly the first time instead of needing to be manually re-filed later.</p>
      <p><b>A description that explains impact, not just the problem.</b> "Water has been leaking here for two weeks and is now flooding the footpath" gives a reviewer and, later, an authority, a reason to prioritize it — over just "there is a leak."</p>
      <p>None of this is complicated, but it's the difference between a report that gets genuine community support and momentum, and one that quietly sits with none. If you haven't reported an issue yet, <a href="/articles/how-act-on-issues-works">see the full process</a> before you start.</p>
    `
  },
  {
    title: 'Understanding Your Reporter Profile and Civic Badges',
    slug: 'understanding-reporter-profile-badges',
    excerpt: 'Every citizen who reports an issue builds a public track record. Here’s what your profile shows, and what each badge actually means.',
    tags: ['profile', 'badges', 'guide'],
    body: `
      <p>Every citizen who reports civic issues on Act On Issues has a public profile page — a real, shareable track record of what they've contributed, not just a private history only they can see.</p>
      <p><b>What your profile shows.</b> Your name and photo, how long you've been a member, and three counts: how many issues you've <b>Reported</b>, how many of those have been <b>Resolved</b>, and how many other people's issues you've <b>Supported</b>. All three are drawn directly from real activity — nothing here is self-reported.</p>
      <p><b>What the badges mean.</b> Badges are earned automatically once your counts cross a threshold — there's no separate application or approval step:</p>
      <ul>
        <li><b>First Report</b> — you've reported at least one approved issue.</li>
        <li><b>Active Reporter</b> — five or more approved reports.</li>
        <li><b>Community Pillar</b> — twenty or more approved reports.</li>
        <li><b>Problem Solver</b> — at least one of your reports has been marked Resolved.</li>
        <li><b>Change Maker</b> — ten or more of your reports have been Resolved.</li>
      </ul>
      <p><b>Where your profile shows up.</b> The homepage's "Top Voices" leaderboard links directly to the profiles of the most active reporters — so a strong track record isn't just a private stat, it's genuinely visible to other residents.</p>
      <p>Building a real track record here isn't about the badges themselves — it's a natural side effect of doing the two things that actually move issues forward: <a href="/articles/what-makes-a-strong-civic-issue-report">reporting problems clearly</a> and <a href="/articles/why-community-support-matters">supporting other people's genuine reports</a>.</p>
    `
  }
];

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  const admin = await User.findOne({ role: 'Admin' });
  if (!admin) {
    console.error('No Admin user found — cannot set createdBy. Run scripts/seed.js first, or create an Admin account.');
    process.exit(1);
  }

  for (const a of ARTICLES) {
    const existing = await Article.findOne({ slug: a.slug });
    if (existing) {
      console.log(`Skipping "${a.title}" — an article with slug "${a.slug}" already exists.`);
      continue;
    }
    await Article.create({
      title: a.title,
      slug: a.slug,
      excerpt: a.excerpt,
      body: sanitizeHtml(a.body.trim()),
      tags: a.tags,
      status: 'Published',
      publishedAt: new Date(),
      authorName: 'Act On Issues Team',
      createdBy: admin._id
    });
    console.log(`Published "${a.title}" at /articles/${a.slug}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => { console.error(err); process.exit(1); });
