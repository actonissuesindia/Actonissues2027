import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import TopNav from '../../components/layout/TopNav';
import Footer from '../../components/layout/Footer';
import Reveal from '../../components/common/Reveal';
import TiltCard from '../../components/common/TiltCard';
import BlobAvatar from '../../components/common/BlobAvatar';
import PostIssueModal from '../../components/create/PostIssueModal';
import api from '../../services/api';
import usePageBlocks from '../../hooks/usePageBlocks';
import useSectionPreview from '../../hooks/useSectionPreview';
import { renderBlockList } from '../../components/pageBuilder/BlockRenderer';
import SectionPreviewBadge from '../../components/pageBuilder/SectionPreviewBadge';
import usePageTitle from '../../hooks/usePageTitle';

const WHAT_WE_DO = [
  'Report public and civic issues you encounter',
  'Share the location, photographs, and a clear description',
  'Track the status of a reported issue over time',
  'Encourage timely, responsible action from the concerned department'
];

const HOW_IT_WORKS = [
  { icon: 'bi-pencil-square', title: 'Report an issue', text: 'Submit a public issue with a description, photos, and location — takes under a minute.' },
  { icon: 'bi-search', title: 'Review & organize', text: "Each report is checked for clarity and relevance before it's published for everyone to see." },
  { icon: 'bi-signpost-split-fill', title: 'Reach the right people', text: "It's visible to Authority accounts for the relevant department — no guesswork about who should see it." },
  { icon: 'bi-graph-up-arrow', title: 'Track progress', text: 'Status updates — Open, In Progress, Resolved — are shown publicly as the issue moves forward.' },
  { icon: 'bi-check-circle-fill', title: 'Resolution & closure', text: "Once addressed, it's marked resolved and stays visible — nothing quietly disappears." }
];

const VALUES = [
  { icon: 'bi-people-fill', title: 'Citizens First', text: 'Public welfare above all else.' },
  { icon: 'bi-shield-check', title: 'Integrity', text: 'Honest reporting and ethical action.' },
  { icon: 'bi-eye-fill', title: 'Transparency', text: 'Open visibility of issues and outcomes.' },
  { icon: 'bi-lightning-charge-fill', title: 'Youth Leadership', text: 'Energy, responsibility, and fresh thinking.' },
  { icon: 'bi-hand-thumbs-up-fill', title: 'Collaboration', text: 'Stronger solutions through collective effort.' },
  { icon: 'bi-bullseye', title: 'Action-Oriented', text: 'Awareness paired with measurable results.' }
];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export default function About() {
  usePageTitle('About');
  const { user } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // Both staff tiers can manage the founder photo — stored 'Admin' (shown as
  // "Super Admin") and stored 'Authority' (shown as "Admin") — see utils/roleLabel.js.
  const canEditFounderPhoto = user?.role === 'Admin' || user?.role === 'Authority';
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);

  // Page Builder overrides — each falls back to this file's original
  // hardcoded content (below) when null (still loading) or empty (nothing
  // seeded/admin removed everything), so a fetch hiccup never leaves a
  // blank section. See scripts/seedPageBlocks/seedAbout.js. founderBlocks
  // reuses the 'founder-message-body' page key from the old standalone
  // Founder's Message page (now merged into this page, see the section
  // below) — the mission/vision half of that old page isn't reused here
  // since About already has its own equivalent Mission & Vision section.
  const heroBlocks = usePageBlocks('about-hero');
  const whatWeDoBlocks = usePageBlocks('about-what-we-do');
  const howItWorksBlocks = usePageBlocks('about-how-it-works');
  const valuesBlocks = usePageBlocks('about-values');
  const missionVisionBlocks = usePageBlocks('about-mission-vision');
  const founderBlocks = usePageBlocks('founder-message-body');
  const { previewTargetKey } = useSectionPreview([heroBlocks, whatWeDoBlocks, howItWorksBlocks, valuesBlocks, missionVisionBlocks, founderBlocks]);

  useEffect(() => {
    api.get('/issues/stats').then(res => setStats(res.data.stats)).catch(() => {});
    api.get('/issues/category-counts').then(res => setCategories(res.data.categories)).catch(() => {});
    api.get('/founder-image').then(res => setPhotoUrl(res.data.url || '')).catch(() => {});
  }, []);

  const handleFounderPhotoSelected = async (file) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast(`"${file.name}" is over the 5MB limit.`, 'error');
      return;
    }
    setPhotoBusy(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post('/founder-image', fd);
      setPhotoUrl(res.data.url || '');
      toast('Founder photo updated');
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to upload photo', 'error');
    } finally {
      setPhotoBusy(false);
    }
  };

  const removeFounderPhoto = async () => {
    setPhotoBusy(true);
    try {
      await api.delete('/founder-image');
      setPhotoUrl('');
      toast('Founder photo removed');
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to remove photo', 'error');
    } finally {
      setPhotoBusy(false);
    }
  };

  const resolutionRate = stats && stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
  const topCategories = [...categories].sort((a, b) => b.count - a.count).slice(0, 8);

  return (
    <div>
      <TopNav onPostIssue={user ? () => setShowModal(true) : undefined} />

      {/* Hero */}
      <section className={`hero-section${previewTargetKey === 'about-hero' ? ' section-preview-outline' : ''}`} id="section-about-hero">
        <SectionPreviewBadge active={previewTargetKey === 'about-hero'} />
        <div className="container-fluid px-4 px-lg-5">
          <div className="mx-auto text-center" style={{ maxWidth: 780 }}>
            {heroBlocks === null || heroBlocks.length === 0 ? (
              <>
                <div className="eyebrow mb-3">About Act On Issues</div>
                <h1 className="display-heading display-3 mb-4">
                  Turning public problems<br />into <span className="gradient-text">public action.</span>
                </h1>
                <p className="text-muted mb-4">
                  Across India's cities, towns, and villages, citizens face the same frustrations every
                  day — leaking pipelines, damaged roads, faulty streetlights, unsafe electrical wiring,
                  land encroachment, civic neglect, and gaps in public services. Most of these problems
                  are visible to everyone. They persist not because solutions don't exist, but because
                  they go unreported, unheard, and unresolved — with no clear channel to raise them, no
                  way to follow up, and no accountability for action.
                </p>
                <p className="text-muted mb-4">
                  We're a social startup built to change that — a bridge between citizens and the
                  institutions responsible for addressing their concerns, so that no issue quietly
                  disappears.
                </p>
                <div className="d-flex flex-wrap justify-content-center gap-3">
                  <Link to="/feed" className="btn btn-gradient">Browse Issues</Link>
                  <Link to="/register" className="btn btn-pill-outline">Join the Movement</Link>
                </div>
              </>
            ) : renderBlockList(heroBlocks)}
          </div>
        </div>
      </section>

      {/* What we do */}
      <Reveal id="section-about-what-we-do" className={previewTargetKey === 'about-what-we-do' ? 'section-preview-outline' : ''}>
        <SectionPreviewBadge active={previewTargetKey === 'about-what-we-do'} />
        <section className="py-4 py-lg-5">
          <div className="container-fluid px-4 px-lg-5">
            <div className="row g-5">
              <div className="col-lg-6">
                {whatWeDoBlocks === null || whatWeDoBlocks.length === 0 ? (
                  <>
                    <div className="eyebrow mb-2">What We Do</div>
                    <h2 className="display-heading fs-2 mb-3">A citizen-driven platform, built for real outcomes</h2>
                    <p className="text-muted mb-3">
                      We provide a channel where anyone can report a public or civic issue, make it
                      visible, and ensure it reaches the right authority — transparently and
                      responsibly.
                    </p>
                    <ul className="list-unstyled d-flex flex-column gap-2">
                      {WHAT_WE_DO.map(item => (
                        <li key={item} className="d-flex align-items-start gap-2">
                          <i className="bi bi-check-circle-fill text-success mt-1"></i>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : renderBlockList(whatWeDoBlocks)}
              </div>
            </div>
            {/* A separate row (not a second column in the row above) so this
                block always starts below "What We Do" in normal document
                flow — guaranteed no overlap regardless of window width or
                how much the left column's text wraps. */}
            <div className="row g-5 mt-1 mt-lg-4">
              <div className="col-lg-6 offset-lg-6">
                <div className="eyebrow mb-2">Focus areas, right now</div>
                <div className="d-flex flex-wrap gap-2">
                  {(topCategories.length > 0 ? topCategories : [
                    { category: 'Water Supply' }, { category: 'Roads & Infrastructure' }, { category: 'Electricity' },
                    { category: 'Garbage & Sanitation' }, { category: 'Street Lighting' }, { category: 'Public Health' },
                    { category: 'Environment' }, { category: "Women, Children & Social Welfare" }
                  ]).map(c => (
                    <span key={c.category} className="chip chip-embossed">
                      #{c.category}{c.count != null && <span className="count">{c.count}</span>}
                    </span>
                  ))}
                </div>
                <p className="text-muted small mt-3 mb-0">
                  These are drawn from real reports on the platform — Land &amp; Governance, Education
                  &amp; Healthcare, and Transparency &amp; Accountability are tracked too, alongside every
                  other everyday civic issue.
                </p>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Live stats */}
      {stats && (
        <Reveal>
          <section className="py-4 py-lg-5">
            <div className="container-fluid px-4 px-lg-5">
              <h2 className="display-heading fs-2 text-center mb-4">As on Today</h2>
              <div className="row g-3">
                {[
                  { label: 'Issues reported', value: stats.total, icon: 'bi-collection', color: 'text-primary' },
                  { label: 'Resolved', value: stats.resolved, icon: 'bi-check-circle', color: 'text-success' },
                  { label: 'Resolution rate', value: `${resolutionRate}%`, icon: 'bi-graph-up-arrow', color: 'text-info' },
                  { label: 'Categories tracked', value: categories.length, icon: 'bi-tags-fill', color: 'text-secondary' }
                ].map(s => (
                  <div className="col-6 col-lg-3" key={s.label}>
                    <TiltCard className="card stat-card p-3 h-100">
                      <div className="d-flex align-items-center justify-content-between">
                        <div>
                          <div className="text-muted small">{s.label}</div>
                          <div className="fs-3 fw-bold">{s.value}</div>
                        </div>
                        <i className={`bi ${s.icon} fs-2 ${s.color}`}></i>
                      </div>
                    </TiltCard>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>
      )}

      {/* How it works */}
      <Reveal id="section-about-how-it-works" className={previewTargetKey === 'about-how-it-works' ? 'section-preview-outline' : ''}>
        <SectionPreviewBadge active={previewTargetKey === 'about-how-it-works'} />
        <section className="py-4 py-lg-5 border-top">
          <div className="container-fluid px-4 px-lg-5">
            {howItWorksBlocks === null || howItWorksBlocks.length === 0 ? (
              <>
                <div className="eyebrow mb-2">How It Works</div>
                <h2 className="display-heading fs-2 mb-4">Simple, transparent, built for real outcomes</h2>
                <div className="row g-3">
                  {HOW_IT_WORKS.map(s => (
                    <div className="col-md-4 col-lg" key={s.title}>
                      <TiltCard className="card card-embossed rotating-glow p-3 h-100">
                        <span className="step-icon mb-3"><i className={`bi ${s.icon}`}></i></span>
                        <div className="fw-bold mb-1">{s.title}</div>
                        <div className="text-muted small">{s.text}</div>
                      </TiltCard>
                    </div>
                  ))}
                </div>
                <p className="text-muted small mt-3 mb-0">
                  A report left unreviewed doesn't get lost — if no one actions it within the
                  admin-configured review window, it's automatically published so it stays visible
                  either way.
                </p>
              </>
            ) : renderBlockList(howItWorksBlocks)}
          </div>
        </section>
      </Reveal>

      {/* Why it matters */}
      <Reveal>
        <section className="py-4 py-lg-5 border-top">
          <div className="container-fluid px-4 px-lg-5">
            <div className="row justify-content-center text-center">
              <div className="col-lg-8">
                <div className="eyebrow mb-2">Why This Matters</div>
                <h2 className="display-heading fs-2 mb-3">India's progress depends on active citizen participation</h2>
                <p className="text-muted">
                  When people have the right platform, problems surface faster, authorities respond
                  more effectively, communities grow more engaged, and public trust in civic systems
                  improves. We believe constructive civic engagement is the foundation of a stronger,
                  more responsive democracy.
                </p>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Mission & Vision */}
      <Reveal id="section-about-mission-vision" className={previewTargetKey === 'about-mission-vision' ? 'section-preview-outline' : ''}>
        <SectionPreviewBadge active={previewTargetKey === 'about-mission-vision'} />
        <section className="py-4 py-lg-5 border-top">
          <div className="container-fluid px-4 px-lg-5">
            {missionVisionBlocks === null || missionVisionBlocks.length === 0 ? (
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="card card-embossed p-4 h-100">
                    <div className="eyebrow mb-2"><i className="bi bi-bullseye me-1"></i>Our Mission</div>
                    <p className="mb-2">
                      To empower citizens to identify, report, and resolve everyday public and civic
                      issues through a transparent, technology-driven platform that promotes
                      accountability, community participation, and real-world action.
                    </p>
                    <p className="text-muted small fst-italic mb-0">
                      Empowering citizens to turn everyday public problems into real solutions.
                    </p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card card-embossed p-4 h-100">
                    <div className="eyebrow mb-2"><i className="bi bi-eye me-1"></i>Our Vision</div>
                    <p className="mb-2">
                      A society where no public issue is ignored, citizens are active participants
                      in governance, and everyday civic problems are addressed efficiently,
                      ethically, and collaboratively — creating safer, smarter, and more livable
                      communities for all.
                    </p>
                    <p className="text-muted small fst-italic mb-0">
                      A society where public issues are seen, heard, and solved.
                    </p>
                  </div>
                </div>
              </div>
            ) : renderBlockList(missionVisionBlocks)}
            <p className="text-center text-muted small mt-3 mb-0">
              Read the story behind why we built this in our <a href="#section-founder-message-body">founder's personal note</a> below.
            </p>
          </div>
        </section>
      </Reveal>

      {/* Founder's Message — merged in from the old standalone /founders-message
          page (see scripts/seedPageBlocks/seedFounder.js for the Page Builder
          content this falls back from). The photo keeps its own independent
          staff-editable upload flow (GET/POST/DELETE /api/founder-image),
          unrelated to the Page Builder blocks. */}
      <Reveal id="section-founder-message-body" className={previewTargetKey === 'founder-message-body' ? 'section-preview-outline' : ''}>
        <SectionPreviewBadge active={previewTargetKey === 'founder-message-body'} />
        <section className="py-4 py-lg-5 border-top">
          <div className="container-fluid px-4 px-lg-5">
            <div className="d-flex flex-column flex-lg-row align-items-center gap-4 gap-lg-5">
              <div className="flex-shrink-0 text-center">
                <BlobAvatar
                  src={photoUrl}
                  busy={photoBusy}
                  size={220}
                  shape="round"
                  editable={canEditFounderPhoto}
                  placeholderIcon="bi-person-fill"
                  onFileSelected={handleFounderPhotoSelected}
                  onRemove={removeFounderPhoto}
                />
              </div>
              <div className="flex-grow-1 text-center text-lg-start" style={{ minWidth: 0 }}>
                {founderBlocks === null || founderBlocks.length === 0 ? (
                  <>
                    <div className="eyebrow mb-2">Reformers Voice</div>
                    <h2 className="display-heading fs-2 mb-3">A message to fellow reformers.</h2>
                    <div className="card p-4 p-md-5 text-start">
                      <p>
                        Every day, we see problems around us that quietly chip away at our quality of
                        life — leaking water pipelines, unsafe electricity poles, poor street lighting,
                        civic neglect, environmental damage, and gaps in education, healthcare, and
                        women's safety. These aren't rare occurrences. For millions of people, they're
                        daily realities.
                      </p>
                      <p>
                        What troubled me most was never just the presence of these issues — it was how
                        often they were ignored, delayed, or left unresolved simply because there was no
                        awareness, no coordination, and no accountability.
                      </p>
                      <p>
                        Act On Issues was founded on a simple belief: when citizens are empowered with the
                        right platform and support, real change is possible.
                      </p>
                      <p>
                        Our goal is to give people a responsible, transparent, and constructive way to
                        raise public issues — and to ensure those issues receive the attention they
                        deserve. We're not here to criticize systems; we're here to strengthen them, by
                        connecting people, data, and action.
                      </p>
                      <p>
                        I believe today's youth carry both the responsibility and the ability to shape a
                        better future. Through collaboration, integrity, and persistence, we can turn
                        everyday problems into opportunities for meaningful impact.
                      </p>
                      <p className="mb-0">
                        This is not just a platform. It's a movement for a more aware, accountable, and
                        inclusive society.
                      </p>
                      <p className="text-muted fw-semibold mt-4 mb-0">— Founder, Act On Issues</p>
                    </div>
                  </>
                ) : (
                  <>
                    {renderBlockList(founderBlocks.filter(b => b.type === 'heading'))}
                    <div className="card p-4 p-md-5 text-start">
                      {renderBlockList(founderBlocks.filter(b => b.type !== 'heading'))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* Values */}
      <Reveal id="section-about-values" className={previewTargetKey === 'about-values' ? 'section-preview-outline' : ''}>
        <SectionPreviewBadge active={previewTargetKey === 'about-values'} />
        <section className="py-4 py-lg-5 border-top">
          <div className="container-fluid px-4 px-lg-5">
            {valuesBlocks === null || valuesBlocks.length === 0 ? (
              <>
                <div className="eyebrow mb-2">Our Values</div>
                <h2 className="display-heading fs-2 mb-4">What guides how we build this</h2>
                <div className="row g-3">
                  {VALUES.map(v => (
                    <div className="col-6 col-md-4 col-lg-2" key={v.title}>
                      <TiltCard className="card card-embossed rotating-glow p-3 text-center h-100">
                        <span className="step-icon mb-2"><i className={`bi ${v.icon}`}></i></span>
                        <div className="fw-semibold small">{v.title}</div>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>{v.text}</div>
                      </TiltCard>
                    </div>
                  ))}
                </div>
              </>
            ) : renderBlockList(valuesBlocks)}
          </div>
        </section>
      </Reveal>

      {/* Neutrality & legal — short form, full text lives at /legal */}
      <Reveal>
        <section className="py-4 py-lg-5 border-top">
          <div className="container-fluid px-4 px-lg-5">
            <div className="row g-3">
              <div className="col-md-6">
                <div className="card p-4 h-100">
                  <h6 className="fw-semibold mb-2"><i className="bi bi-shield-fill-check me-2"></i>Neutrality Statement</h6>
                  <p className="text-muted small mb-0">
                    This platform is strictly non-political and non-partisan. We do not support,
                    oppose, or affiliate with any political party, ideology, or government authority
                    — our focus is limited to everyday civic issues that affect quality of life.
                    Visibility on the platform does not imply fault or misconduct by any authority;
                    responsibility for investigation and resolution lies solely with the concerned
                    authorities. Full statement in our{' '}
                    <Link to="/legal">Legal Disclaimer &amp; Neutrality Statement</Link>.
                  </p>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card p-4 h-100">
                  <h6 className="fw-semibold mb-2"><i className="bi bi-info-circle-fill me-2"></i>Legal Disclaimer</h6>
                  <p className="text-muted small mb-0">
                    Reports on this platform are user-generated content based on individual citizens'
                    own observations. While we review submissions for clarity and relevance, we do
                    not independently verify their accuracy, and the platform makes no legal
                    judgment or accusation against any individual or authority. See our full{' '}
                    <Link to="/legal">Legal Disclaimer &amp; Neutrality Statement</Link>,{' '}
                    <Link to="/terms">Terms of Use</Link>, and{' '}
                    <Link to="/privacy">Privacy Policy</Link> for details.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* CTA */}
      <Reveal>
        <section className="container-fluid px-4 px-lg-5 py-4 py-lg-5">
          <div className="cta-banner text-center">
            <h2 className="display-heading fs-1 mb-3">Join the Movement</h2>
            <p className="mb-4" style={{ opacity: 0.9 }}>
              Change doesn't start in offices — it starts on the streets, in neighbourhoods, and
              with people who care. Whether you're a student, a working professional, or simply a
              concerned citizen: report, participate, make a difference.
            </p>
            {user ? (
              <Link to="/feed" className="btn btn-light fw-bold rounded-pill px-4 py-2" style={{ color: 'var(--grad-a)' }}>Go to Issues</Link>
            ) : (
              <Link to="/register" className="btn btn-light fw-bold rounded-pill px-4 py-2" style={{ color: 'var(--grad-a)' }}>Create your account</Link>
            )}
          </div>
        </section>
      </Reveal>

      <Footer />

      <PostIssueModal show={showModal} onClose={() => setShowModal(false)} onCreated={() => setShowModal(false)} />
    </div>
  );
}
