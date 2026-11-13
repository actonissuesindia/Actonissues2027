// Shared "I agree to the Terms" checkbox for every account-creation entry
// point (password/OTP forms, and gating the Google button). Opens /terms in
// a new tab so an in-progress signup form isn't lost by navigating away.
export default function TermsCheckbox({ checked, onChange, id = 'accept-terms' }) {
  return (
    <div className="form-check mt-3 mb-3">
      <input
        type="checkbox"
        className="form-check-input"
        id={id}
        checked={checked}
        onChange={e => onChange(e.target.checked)}
      />
      <label className="form-check-label small" htmlFor={id}>
        I have read and agree to the{' '}
        <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Use &amp; Disclaimer</a>
        {' '}and{' '}
        <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>,
        including that I am solely responsible for content I post.
      </label>
    </div>
  );
}
