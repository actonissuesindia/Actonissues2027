import { Link } from 'react-router-dom';
import logoIcon from '../../assets/logo/aoi-logo.png';

// Standalone, public, unauthenticated legal page — required as a separate
// document from /terms under India's Digital Personal Data Protection Act,
// 2023 (a liability disclaimer is not a privacy policy).
export const PRIVACY_VERSION = '2026-07-22';

export default function Privacy() {
  return (
    <div className="container-fluid px-4 py-4">
      <div className="mx-auto" style={{ maxWidth: 820 }}>
        <Link to="/" className="d-inline-flex align-items-center gap-1 fw-semibold text-decoration-none text-dark mb-3">
          <i className="bi bi-arrow-left"></i>Back to home
        </Link>
        <div className="card p-4 p-md-5">
          <div className="d-flex align-items-center gap-2 mb-4">
            <img src={logoIcon} alt="Act On Issues" style={{ height: 36 }} />
            <h3 className="fw-bold mb-0">Privacy Policy</h3>
          </div>

          <p className="text-muted small">
            Last updated: {PRIVACY_VERSION}. This describes what personal data Act On Issues
            ("the Platform", "we", "us") collects, why, and the rights you have over it under the
            Digital Personal Data Protection Act, 2023 ("DPDP Act"). It should be read alongside our{' '}
            <Link to="/terms">Terms of Use &amp; Disclaimer</Link>.
          </p>

          <h5 className="fw-semibold mt-4">1. What we collect</h5>
          <ul>
            <li><strong>Account details</strong> — name, and an email address and/or phone number, and a password (stored only as an irreversible hash, never in plain text). If you sign in with Google, we receive your name, email, and profile photo from Google.</li>
            <li><strong>Content you post</strong> — issue reports (title, description, category, location, photos/videos you attach), comments, and which issues you've supported.</li>
            <li><strong>Location data</strong> — the address, city/ward/district/state, and map coordinates you provide or select when reporting an issue.</li>
            <li><strong>Profile media</strong> — a profile photo and banner image, if you choose to upload one.</li>
            <li><strong>Technical data</strong> — your IP address and timestamps are recorded in security/audit logs (e.g. moderation actions), and a session cookie keeps you signed in.</li>
          </ul>
          <p>We do not knowingly collect payment information — the Platform does not process payments.</p>

          <h5 className="fw-semibold mt-4">2. Why we collect it</h5>
          <ul>
            <li>to create and secure your account, and let you sign in;</li>
            <li>to publish and display the civic issues, comments, and support you post, and attribute them to your name/profile;</li>
            <li>to notify you (by email/SMS) about activity on your account or reports, including one-time verification codes;</li>
            <li>to let Admin/Authority accounts review, moderate, and act on reported issues;</li>
            <li>to maintain security and audit logs of account and moderation activity; and</li>
            <li>to comply with legal obligations, including responding to lawful requests from authorities.</li>
          </ul>

          <h5 className="fw-semibold mt-4">3. Who we share it with</h5>
          <p>We do not sell your personal data. It is shared only with:</p>
          <ul>
            <li>other Users and the public, for content that's approved and visible on the Platform by design (e.g. your name on a report, your comments) — Pending/Rejected reports stay visible only to you and staff;</li>
            <li>Admin and Authority accounts, who can see all reports (including Pending ones) as part of moderating the Platform;</li>
            <li>service providers who process data on our behalf to run the Platform — e.g. our email/SMS provider (to deliver verification codes), Google (for "Sign in with Google"), and our cloud hosting/storage provider (to store uploaded photos); and</li>
            <li>law enforcement or regulators, where required by law or a valid legal process.</li>
          </ul>

          <h5 className="fw-semibold mt-4">4. How long we keep it</h5>
          <p>
            We retain account and content data for as long as your account is active, and for a
            reasonable period afterward to comply with legal, audit, and dispute-resolution needs.
            You can request deletion of your account at any time (see Section 6) — reported issues
            you've posted may be retained in an anonymised or redacted form where needed for the
            public record of civic issues, unless you specifically ask for the content itself to be
            removed.
          </p>

          <h5 className="fw-semibold mt-4">5. Security</h5>
          <p>
            Passwords are stored as salted hashes, not plain text. Access to moderation and admin
            functions is restricted by account role. We use industry-standard measures (encrypted
            connections, rate-limiting, access controls) to protect your data, but no online service
            can guarantee absolute security.
          </p>

          <h5 className="fw-semibold mt-4">6. Your rights</h5>
          <p>Under the DPDP Act, you have the right to:</p>
          <ul>
            <li><strong>access</strong> a summary of the personal data we hold about you;</li>
            <li><strong>correct or update</strong> inaccurate or incomplete data (you can update your name/profile directly; contact us for anything else);</li>
            <li><strong>erase</strong> your personal data, including by deleting your account;</li>
            <li><strong>withdraw consent</strong> at any time (which may mean we can no longer provide you the account/service); and</li>
            <li><strong>register a grievance</strong> about how your data has been handled.</li>
          </ul>
          <p>To exercise any of these rights, contact us using the details in Section 8 below.</p>

          <h5 className="fw-semibold mt-4">7. Children's data</h5>
          <p>
            The Platform is not directed at children, and we do not knowingly collect personal data
            from anyone below the age required to consent under the DPDP Act. If you believe a
            child has created an account, please contact us so we can review and, if appropriate,
            remove it.
          </p>

          <h5 className="fw-semibold mt-4">8. Grievance / contact</h5>
          <p>
            For any question about this Privacy Policy, or to exercise the rights in Section 6,
            contact:
          </p>
          <p>
            <strong>Grievance Officer:</strong> <em>[insert name]</em><br />
            <strong>Email:</strong> <em>[insert grievance contact email]</em><br />
            <strong>Address:</strong> <em>[insert registered/postal address]</em>
          </p>

          <h5 className="fw-semibold mt-4">9. Changes to this policy</h5>
          <p>
            This policy may be updated from time to time; the "Last updated" date above will
            change accordingly. Material changes will be highlighted at your next login.
          </p>

          <p className="text-muted small mt-4 border-top pt-3">
            This document is a general-purpose template and has not been reviewed by a lawyer. The
            bracketed placeholders above should be filled in with real details before this page is
            relied upon, and it should be reviewed by qualified legal counsel for compliance with
            the DPDP Act, 2023 and its rules.
          </p>
        </div>
      </div>
    </div>
  );
}
