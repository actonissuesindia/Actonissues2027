import { Link } from 'react-router-dom';
import logoIcon from '../../assets/logo/aoi-logo.png';

// Standalone, public, unauthenticated legal page — linked from the signup
// checkbox and reachable directly at /terms any time someone wants to
// re-read it (e.g. before a legal dispute, not just at signup).
export const TERMS_VERSION = '2026-07-23';

export default function Terms() {
  return (
    <div className="container-fluid px-4 py-4">
      <div className="mx-auto" style={{ maxWidth: 820 }}>
        <Link to="/" className="d-inline-flex align-items-center gap-1 fw-semibold text-decoration-none text-dark mb-3">
          <i className="bi bi-arrow-left"></i>Back to home
        </Link>
        <div className="card p-4 p-md-5">
          <div className="d-flex align-items-center gap-2 mb-4">
            <img src={logoIcon} alt="Act On Issues" style={{ height: 36 }} />
            <h3 className="fw-bold mb-0">Terms of Use &amp; Liability Disclaimer</h3>
          </div>

          <p className="text-muted small">
            Last updated: {TERMS_VERSION}. This page is a plain-language legal agreement between
            you and Act On Issues ("the Platform", "we", "us"). Please read it before creating an
            account — creating an account means you accept it in full.
          </p>

          <h5 className="fw-semibold mt-4">1. What this Platform is</h5>
          <p>
            Act On Issues is a community civic-issue reporting platform. Citizens ("Users") post
            reports about civic problems (e.g. roads, water, sanitation, safety) which other
            Users, and designated Authority/Admin accounts, can view, comment on, support, and
            act upon. The Platform is a neutral venue for this activity — it does not itself
            investigate, verify, or guarantee the accuracy of anything a User posts, and it is not
            a government body or emergency service.
          </p>

          <h5 className="fw-semibold mt-4">2. Political neutrality &amp; intermediary status</h5>
          <p>
            The Platform is strictly non-political, non-partisan, and neutral in its operations and
            intent, and functions as an "intermediary" under the Information Technology Act, 2000.
            The full Neutrality Statement — including what Users agree to when submitting a
            report — and our intermediary obligations under the IT Rules, 2021 are set out in full
            in our separate <Link to="/legal">Legal Disclaimer &amp; Neutrality Statement</Link>,
            which forms part of this agreement.
          </p>

          <h5 className="fw-semibold mt-4">3. Your account</h5>
          <p>
            You must provide accurate registration information and are responsible for keeping
            your login credentials confidential and for all activity that happens under your
            account. You must be legally capable of entering into a binding agreement in your
            jurisdiction to register.
          </p>

          <h5 className="fw-semibold mt-4">4. Content you post — your sole responsibility</h5>
          <p>
            Everything you submit — issue reports, titles, descriptions, photos, comments, and any
            other content ("User Content") — is created and posted entirely at your own
            discretion and is your sole legal responsibility. By posting User Content, you
            represent and warrant that:
          </p>
          <ul>
            <li>it is truthful and accurate to the best of your knowledge, and not a knowingly false, exaggerated, or fabricated report;</li>
            <li>it does not defame, harass, threaten, or invade the privacy of any person;</li>
            <li>it does not infringe anyone else's intellectual property, privacy, or other legal rights;</li>
            <li>it does not violate any applicable law, including but not limited to the Information Technology Act, 2000, the Bharatiya Nyaya Sanhita (or the Indian Penal Code, as applicable), and any other Indian central, state, or local law; and</li>
            <li>you have the right to upload any photo or file you attach, and it does not contain content that is obscene, unlawful, or otherwise objectionable.</li>
          </ul>
          <p>
            <strong>You, and only you, are legally liable for the content you post.</strong> The
            Platform, its owner, its Admin and Authority accounts, and anyone operating or
            maintaining it (collectively, the "Operators") take no responsibility for the truth,
            legality, or consequences of User Content, and bear no liability arising from it. If
            your content results in a legal claim, complaint, police report, or regulatory action
            by any third party, that liability rests with you alone — not with the Operators.
          </p>

          <h5 className="fw-semibold mt-4">5. Prohibited conduct</h5>
          <p>
            In line with Rule 3(1)(b) of the Information Technology (Intermediary Guidelines and
            Digital Media Ethics Code) Rules, 2021, you agree not to post or share content that:
          </p>
          <ul>
            <li>belongs to another person and to which you do not have a right;</li>
            <li>is defamatory, obscene, pornographic, paedophilic, invasive of another's privacy (including bodily privacy), insulting or harassing on the basis of gender, racially or ethnically objectionable, or relates to money laundering or gambling;</li>
            <li>is harmful to a child;</li>
            <li>infringes any patent, trademark, copyright, or other proprietary right;</li>
            <li>deceives or misleads the addressee about the origin of the message, or knowingly and intentionally communicates misinformation or information which is patently false or untrue;</li>
            <li>impersonates another person, or misrepresents your identity or affiliation;</li>
            <li>threatens the unity, integrity, defence, security, or sovereignty of India, friendly relations with foreign states, or public order, or incites the commission of any cognisable offence;</li>
            <li>contains any software virus, malware, or other harmful component, or attempts to breach security or interfere with the Platform's normal operation;</li>
            <li>scrapes, harvests, or misuses other Users' personal information; or</li>
            <li>is otherwise unlawful, or intended to encourage or incite unlawful activity.</li>
          </ul>
          <p>
            Violating this section may result in immediate content removal, account suspension or
            deletion, and — where the conduct is unlawful — referral to law enforcement. You alone
            bear any resulting legal, civil, or criminal liability.
          </p>

          <h5 className="fw-semibold mt-4">6. License you grant to the Platform</h5>
          <p>
            You retain ownership of the User Content you post. By posting it, you grant the
            Operators a worldwide, non-exclusive, royalty-free license to host, store, display,
            reproduce, and distribute it on the Platform (and in any of the Platform's own
            promotional or reporting materials) for as long as your content remains on the
            Platform, or as needed to comply with law or resolve disputes after removal.
          </p>

          <h5 className="fw-semibold mt-4">7. Platform's rights over the service and content</h5>
          <p>
            The Operators — including the Platform's owner and its Admin/Authority
            administrators — reserve the sole and absolute right, at their discretion and without
            prior notice, to: review, edit, reclassify, hide, lock, feature, or remove any User
            Content; suspend, disable, or delete any account; change, suspend, or discontinue the
            Platform or any feature of it; and take any other action reasonably necessary to
            operate, moderate, secure, or protect the Platform and its Users. Exercising or
            declining to exercise any of these rights does not transfer any liability for User
            Content to the Operators.
          </p>

          <h5 className="fw-semibold mt-4">8. No warranty</h5>
          <p>
            The Platform is provided "as is" and "as available," without warranties of any kind,
            express or implied — including, without limitation, any warranty that content posted
            by other Users is accurate, that any reported issue will be seen, actioned, or
            resolved by any authority, or that the service will be uninterrupted, timely, secure,
            or error-free.
          </p>

          <h5 className="fw-semibold mt-4">9. Limitation of liability</h5>
          <p>
            To the maximum extent permitted by applicable law, the Operators shall not be liable
            for any indirect, incidental, special, consequential, or exemplary damages, or any
            loss of data, goodwill, or profits, arising out of or related to your use of the
            Platform, any User Content (yours or another User's), or any action or inaction by any
            Authority/Admin account or any third party — even if advised of the possibility of
            such damages. This includes, without limitation, any harm arising from a User's
            illegal activity, misinformation, defamatory statement, or misuse of the Platform.
          </p>

          <h5 className="fw-semibold mt-4">10. Indemnification</h5>
          <p>
            You agree to defend, indemnify, and hold harmless the Operators from and against any
            claim, demand, loss, liability, damage, cost, or expense (including reasonable legal
            fees) arising out of or related to: your User Content; your violation of these Terms;
            your violation of any law or the rights of a third party; or any dispute between you
            and another User or any third party (including any Authority acting on a report you
            posted).
          </p>

          <h5 className="fw-semibold mt-4">11. Account suspension and termination</h5>
          <p>
            The Operators may suspend or terminate your account, with or without notice, for any
            violation of these Terms, suspected unlawful activity, or at their reasonable
            discretion to protect the Platform or its Users. You may stop using the Platform, and
            request account deletion, at any time.
          </p>

          <h5 className="fw-semibold mt-4">12. Changes to these Terms</h5>
          <p>
            These Terms may be updated from time to time; the "Last updated" date above will
            change accordingly. Continued use of the Platform after an update constitutes
            acceptance of the revised Terms. Material changes may require re-acceptance at your
            next login.
          </p>

          <h5 className="fw-semibold mt-4">13. Governing law</h5>
          <p>
            These Terms are governed by the laws of India. Any dispute arising out of or relating
            to these Terms or the Platform shall be subject to the exclusive jurisdiction of the
            competent courts at <em>[insert city/state]</em>, India.
          </p>

          <h5 className="fw-semibold mt-4">14. Grievance Officer &amp; content takedown requests</h5>
          <p>
            In accordance with the Information Technology Act, 2000 and the Information Technology
            (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, the details of the
            Grievance Officer are published below. Complaints will be acknowledged within 24 hours
            and resolved, wherever possible, within 15 days of receipt — sooner for specific
            categories of complaint as required by law (e.g. requests to remove content exposing
            private images, or impersonation, are addressed within 24 hours).
          </p>
          <p>
            <strong>Grievance Officer:</strong> <em>[insert name]</em><br />
            <strong>Email:</strong> <em>[insert grievance contact email]</em><br />
            <strong>Address:</strong> <em>[insert registered/postal address]</em>
          </p>
          <p>
            Anyone who believes User Content on the Platform violates these Terms, applicable law,
            or their own rights may write to the Grievance Officer above with the specific URL or
            post identifier and a description of the issue.
          </p>

          <h5 className="fw-semibold mt-4">15. Your personal data</h5>
          <p>
            How we collect, use, and protect your personal data (and your rights over it under the
            Digital Personal Data Protection Act, 2023) is described separately in our{' '}
            <Link to="/privacy">Privacy Policy</Link>, which forms part of this agreement.
          </p>

          <p className="text-muted small mt-4 border-top pt-3">
            This document is a general-purpose template and has not been reviewed by a lawyer. The
            bracketed placeholders above should be filled in with real details before this page is
            relied upon, and it should be reviewed by qualified legal counsel — particularly for
            compliance with Indian IT and data-protection law.
          </p>
        </div>
      </div>
    </div>
  );
}
