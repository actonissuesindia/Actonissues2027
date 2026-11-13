import { Link } from 'react-router-dom';
import logoIcon from '../../assets/logo/aoi-logo.png';

// Standalone, public, unauthenticated legal page — the IT Act-specific
// intermediary/neutrality disclaimer, kept separate from /terms (which
// covers the account/content agreement) so there's one authoritative
// place for this specific statement rather than it being restated
// slightly differently in two documents.
export const LEGAL_VERSION = '2026-07-24';

export default function Legal() {
  return (
    <div className="container-fluid px-4 py-4">
      <div className="mx-auto" style={{ maxWidth: 820 }}>
        <Link to="/" className="d-inline-flex align-items-center gap-1 fw-semibold text-decoration-none text-dark mb-3">
          <i className="bi bi-arrow-left"></i>Back to home
        </Link>
        <div className="card p-4 p-md-5">
          <div className="d-flex align-items-center gap-2 mb-4">
            <img src={logoIcon} alt="Act On Issues" style={{ height: 36 }} />
            <h3 className="fw-bold mb-0">Legal Disclaimer &amp; Neutrality Statement</h3>
          </div>

          <p className="text-muted small">
            Last updated: {LEGAL_VERSION}. This page explains what this platform is (and isn't) in
            the eyes of Indian law, and sets out its neutral, non-political stance. It's a
            companion to, not a replacement for, our{' '}
            <Link to="/terms">Terms of Use &amp; Liability Disclaimer</Link>.
          </p>

          <h5 className="fw-semibold mt-4">1. Nature of this platform</h5>
          <p>
            This platform is a citizen-driven social initiative that facilitates the reporting and
            visibility of public and civic issues, for the purpose of awareness and constructive
            resolution. It functions as an "intermediary" under Section 2(1)(w) of the Information
            Technology Act, 2000, and operates in accordance with the Information Technology
            (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.
          </p>

          <h5 className="fw-semibold mt-4">2. User-generated content</h5>
          <p>
            All information, reports, images, and descriptions submitted on this website are
            user-generated content, provided by individual citizens based on their personal
            observations. While reasonable efforts are made to review submissions for relevance
            and clarity, we do not independently verify, guarantee, or warrant the accuracy,
            completeness, or authenticity of any reported issue.
          </p>

          <h5 className="fw-semibold mt-4">3. No accusation or legal determination</h5>
          <p>
            This platform does not make legal judgments, accusations, or determinations of
            wrongdoing against any individual, organization, authority, or government body.
            Reports are shared solely for informational and public-interest purposes, to encourage
            responsible attention and action from relevant stakeholders — in keeping with our
            mission to strengthen public systems, not criticize them.
          </p>

          <h5 className="fw-semibold mt-4">4. Role as an intermediary</h5>
          <p>
            As an intermediary, this platform does not host, endorse, or take responsibility for
            user-generated content beyond its role in facilitating reporting and visibility. We
            reserve the right to remove, restrict, or moderate any content that violates
            applicable law, either on our own initiative or upon receiving an actionable notice,
            complaint, or lawful government/court order — consistent with our obligations under
            the IT Rules, 2021.
          </p>

          <h5 className="fw-semibold mt-4">5. Limitation of liability</h5>
          <p>
            This platform shall not be held liable for any loss, damage, or legal consequences
            arising from the use of information published here, including actions taken or not
            taken by any authority or third party in response to a report.
          </p>

          <h5 className="fw-semibold mt-4">6. Neutrality</h5>
          <p>
            This platform is strictly non-political, non-partisan, and neutral in its operations
            and intent. We do not support, oppose, endorse, or affiliate with any political party,
            ideology, elected representative, or government authority. Our focus remains limited to
            everyday public and civic issues that affect citizens' quality of life, irrespective of
            political or administrative boundaries.
          </p>
          <p>
            We do not aim to criticize, defame, or target any individual or institution. Our
            objective is to promote transparency, constructive dialogue, and solution-oriented
            civic participation. All issues are presented without bias, and visibility of a report
            on this platform does not imply fault, negligence, or misconduct by any authority or
            party. Responsibility for investigation, decision-making, and resolution lies solely
            with the concerned authorities.
          </p>

          <h5 className="fw-semibold mt-4">7. User responsibility</h5>
          <p>By using this platform, users agree to:</p>
          <ul>
            <li>submit issues based on first-hand observation;</li>
            <li>avoid false, misleading, or malicious reporting;</li>
            <li>refrain from naming individuals without verifiable public relevance;</li>
            <li>respect the privacy, dignity, and legal rights of others; and</li>
            <li>ensure their submissions are truthful, non-defamatory, and lawful.</li>
          </ul>
          <p>
            The platform reserves the right to moderate, edit, or remove any content that violates
            these principles or applicable laws of India, and to suspend or restrict access for
            repeated or serious violations.
          </p>

          <h5 className="fw-semibold mt-4">8. Grievance redressal</h5>
          <p>
            In compliance with the IT Rules, 2021, complaints regarding content published on this
            platform may be addressed to our Grievance Officer:
          </p>
          <p>
            <strong>Grievance Officer:</strong> <em>[insert name]</em><br />
            <strong>Email:</strong> <em>[insert grievance contact email]</em><br />
            <strong>Address:</strong> <em>[insert registered/postal address]</em>
          </p>

          <p className="text-muted small mt-4 border-top pt-3">
            This document is a general-purpose template and has not been reviewed by a lawyer. The
            bracketed placeholders above should be filled in with real details before this page is
            relied upon, and it should be reviewed by qualified legal counsel — particularly for
            compliance with Indian IT and intermediary law.
          </p>
        </div>
      </div>
    </div>
  );
}
