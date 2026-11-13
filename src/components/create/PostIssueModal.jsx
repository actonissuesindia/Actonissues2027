import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import AddressAutocomplete, { reverseGeocode } from './AddressAutocomplete';
import LocationPickerMap from './LocationPickerMap';
import SearchableSelect from '../common/SearchableSelect';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
// Six 10MB files are legal individually but 60MB together, and the whole
// report now travels as one request — which the hosting platform caps at 32MB
// and rejects before any of this app's code runs, producing an error nobody
// can explain. Checked here so the reporter is told the real problem, in terms
// of the thing they can change.
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;
const MAX_FILES = 6;
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.mp4', '.mov'];

// India's local-body structure isn't one-size-fits-all: rural areas sit
// under a Gram Panchayat with a Mandal/Taluk/Tehsil in between, while urban
// areas skip straight from District to a Municipal Corporation/Municipality
// (no Mandal), and a handful of planned areas (Chandigarh, NOIDA, Dwarka,
// Gandhinagar) address by Sector instead of Ward. Picking a type here only
// relabels the fields below to match — it doesn't change what's actually
// stored (still the same city/ward/mandal strings on the issue), so leaving
// it unset just keeps today's generic labels.
const AREA_TYPES = [
  { value: 'gp', label: 'Gram Panchayat (rural)', showMandal: true, cityLabel: 'Village / Town', wardLabel: 'Ward (optional)' },
  { value: 'np', label: 'Nagar Panchayat', showMandal: false, cityLabel: 'Town', wardLabel: 'Ward (optional)' },
  { value: 'municipality', label: 'Municipality (Nagar Palika)', showMandal: false, cityLabel: 'Town / City', wardLabel: 'Ward (optional)' },
  { value: 'corporation', label: 'Municipal Corporation', showMandal: false, cityLabel: 'City', wardLabel: 'Ward / Zone (optional)' },
  { value: 'cantonment', label: 'Cantonment Board', showMandal: false, cityLabel: 'City', wardLabel: 'Ward (optional)' },
  { value: 'sector', label: 'Planned Sector Area (Chandigarh, NOIDA, Dwarka, etc.)', showMandal: false, cityLabel: 'City / Township', wardLabel: 'Sector (optional)' }
];

export default function PostIssueModal({ show, onClose, onCreated }) {
  const toast = useToast();
  const [topicHierarchy, setTopicHierarchy] = useState({});
  const [topic, setTopic] = useState('');
  const [subTopic, setSubTopic] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [ward, setWard] = useState('');
  const [district, setDistrict] = useState('');
  const [mandal, setMandal] = useState('');
  const [state, setState] = useState('');
  const [areaType, setAreaType] = useState('');
  const [states, setStates] = useState([]);
  const [coordinates, setCoordinates] = useState(null);
  const [locationStatus, setLocationStatus] = useState('');
  const [showMap, setShowMap] = useState(false);
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [fileNotice, setFileNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [autoApprovalLabel, setAutoApprovalLabel] = useState('24 hours');

  useEffect(() => {
    if (!show) return;
    api.get('/issues/meta').then(res => {
      const hierarchy = res.data.topicHierarchy || {};
      const firstTopic = Object.keys(hierarchy)[0] || '';
      setTopicHierarchy(hierarchy);
      setTopic(current => current || firstTopic);
      setSubTopic(current => current || hierarchy[firstTopic]?.[0] || '');
      setStates(res.data.states || []);
      if (res.data.autoApprovalLabel) setAutoApprovalLabel(res.data.autoApprovalLabel);
    }).catch(() => {});
  }, [show]);

  const reset = () => {
    setDescription(''); setAddress(''); setCity(''); setWard('');
    setDistrict(''); setMandal(''); setState(''); setAreaType('');
    setCoordinates(null); setLocationStatus(''); setShowMap(false); setFiles([]); setCustomCategory(''); setError(''); setFileNotice('');
  };

  const close = () => { if (!busy) { reset(); onClose(); } };

  const addFiles = (list) => {
    const incoming = Array.from(list || []);
    const badType = incoming.filter(f => !ALLOWED_EXTENSIONS.some(ext => f.name.toLowerCase().endsWith(ext)));
    const tooLarge = incoming.filter(f => f.size > MAX_FILE_BYTES && !badType.includes(f));
    const ok = incoming.filter(f => f.size <= MAX_FILE_BYTES && !badType.includes(f));

    const room = Math.max(0, MAX_FILES - files.length);
    const accepted = ok.slice(0, room);
    const overflow = ok.slice(room);

    const problems = [];
    if (badType.length > 0) {
      problems.push(`${badType.length > 1 ? 'Some files are' : `"${badType[0].name}" is`} not a supported type (JPG, PNG, MP4, MOV only) and ${badType.length > 1 ? "weren't" : "wasn't"} added.`);
    }
    if (tooLarge.length > 0) {
      problems.push(`${tooLarge.length > 1 ? 'Some files are' : `"${tooLarge[0].name}" is`} over the 10MB limit and ${tooLarge.length > 1 ? "weren't" : "wasn't"} added.`);
    }
    if (overflow.length > 0) {
      problems.push(`Only up to ${MAX_FILES} files are allowed, so ${overflow.length > 1 ? `${overflow.length} files weren't` : "1 file wasn't"} added.`);
    }
    setError(problems.join(' '));

    if (accepted.length > 0) {
      setFileNotice(`${accepted.length > 1 ? `${accepted.length} files` : `"${accepted[0].name}"`} added.`);
      setTimeout(() => setFileNotice(''), 4000);
    }
    setFiles(prev => [...prev, ...accepted]);
  };

  const applyLocation = (picked) => {
    setAddress(picked.address);
    if (picked.city) setCity(picked.city);
    if (picked.district) setDistrict(picked.district);
    if (picked.mandal) setMandal(picked.mandal);
    if (picked.state) setState(picked.state);
    if (picked.lat && picked.lng) setCoordinates({ lat: picked.lat, lng: picked.lng });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) { setLocationStatus('Location services are not available in this browser.'); return; }
    setLocationStatus('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const next = { lat: Number(coords.latitude.toFixed(6)), lng: Number(coords.longitude.toFixed(6)) };
        setCoordinates(next);
        setLocationStatus('Current location selected. Looking up the address…');
        const picked = await reverseGeocode(next.lat, next.lng).catch(() => null);
        if (picked) {
          applyLocation(picked);
          setLocationStatus('Current location selected.');
        } else {
          if (!address) setAddress(`Location: ${next.lat}, ${next.lng}`);
          setLocationStatus("Current location selected (couldn't look up the address automatically — fill it in below).");
        }
      },
      () => setLocationStatus('Could not access your location. Pick a point on the map instead.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const pickOnMap = async (lat, lng) => {
    lat = Number(lat.toFixed(6));
    lng = Number(lng.toFixed(6));
    setCoordinates({ lat, lng });
    setLocationStatus('Map location selected. Looking up the address…');
    const picked = await reverseGeocode(lat, lng).catch(() => null);
    if (picked) {
      applyLocation(picked);
      setLocationStatus('Map location selected.');
    } else {
      if (!address) setAddress(`Map pin: ${lat}, ${lng}`);
      setLocationStatus('Map location selected. You can refine the address below.');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!topic || !subTopic) { setError('Select a topic and sub topic.'); return; }
    if (!description.trim()) { setError('Describe the issue in a line or two.'); return; }
    const hasAddress = !!address.trim();
    const hasStructuredLocation = !!(state.trim() && district.trim() && city.trim());
    if (!hasAddress && !hasStructuredLocation) {
      setError('Location is required — either search/pick an address above, or fill in State, District and City below.');
      return;
    }
    if ((topic === 'Other' || subTopic === 'Other') && !/^[A-Za-z0-9 &-]{4,30}$/.test(customCategory)) {
      setError('Specify your category using 4–30 letters, numbers, spaces, hyphens, or ampersands.'); return;
    }
    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;
      setError(`Those ${files.length} files come to ${mb(totalBytes)} together, and a report can carry up to ${mb(MAX_TOTAL_BYTES)}. Remove one or two and post again — you can add more photos to the report afterwards.`);
      return;
    }
    setError('');
    setBusy(true);
    try {
      const title = description.trim().slice(0, 80);
      // Report and photos go up together, in one request. They used to be two
      // — the report first, the photos after — so a failed photo upload left a
      // report already filed while telling the reporter it had failed, and
      // pressing the button again filed it a second time. One request means
      // the whole submission either happens or doesn't.
      const form = new FormData();
      form.append('title', title);
      form.append('description', description);
      form.append('topic', topic);
      form.append('subTopic', subTopic);
      form.append('priority', 'Medium');
      if (customCategory) form.append('customCategory', customCategory);
      // Every multipart field is text, so the nested object goes as JSON and
      // the server parses it back (see issueController.create).
      form.append('location', JSON.stringify({
        address, city, ward, district, mandal, state, lat: coordinates?.lat, lng: coordinates?.lng
      }));
      form.append('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);
      files.forEach(f => form.append('attachments', f));

      const { data } = await api.post('/issues', form);
      onCreated && onCreated(data.issue);
      toast(data.alreadyFiled
        ? 'This report was already posted — you were seeing an error from a submission that had actually gone through.'
        : `Issue posted successfully — it'll go live within about 15 minutes once approved (or automatically within ${autoApprovalLabel}).`,
      { duration: 5000 });
      reset();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message
        || (err.code === 'ERR_NETWORK'
          ? 'Could not reach Act On Issues — check your internet connection and try again. Nothing was posted.'
          : 'The report could not be posted. Nothing was saved, so it is safe to try again.'));
    } finally {
      setBusy(false);
    }
  };

  const areaTypeInfo = AREA_TYPES.find(t => t.value === areaType);

  if (!show) return null;

  return (
    <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(15, 23, 42, 0.45)' }}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content">
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold">Raise a civic issue</h5>
            <button type="button" className="btn-close" onClick={close} disabled={busy}></button>
          </div>
          <form onSubmit={submit} className="modal-form-flex">
            <div className="modal-body">
              {error && <div className="alert alert-danger py-2">{error}</div>}

              <label className="form-label small fw-semibold">Topic</label>
              <div className="mb-3">
                <SearchableSelect
                  clearable={false}
                  value={topic}
                  onChange={nextTopic => {
                    setTopic(nextTopic);
                    setSubTopic(topicHierarchy[nextTopic]?.[0] || '');
                    setCustomCategory('');
                  }}
                  options={Object.keys(topicHierarchy)}
                  allLabel="Select a topic"
                  className="w-100"
                />
              </div>

              <label className="form-label small fw-semibold">Sub Topic</label>
              <div className="mb-3">
                <SearchableSelect
                  clearable={false}
                  value={subTopic}
                  onChange={next => { setSubTopic(next); setCustomCategory(''); }}
                  options={topicHierarchy[topic] || []}
                  allLabel="Select a sub topic"
                  className="w-100"
                />
              </div>

              {(topic === 'Other' || subTopic === 'Other') && <>
                <label className="form-label small fw-semibold">Specify your category</label>
                <input
                  className="form-control mb-3"
                  placeholder="Enter your category (4–30 characters)"
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  minLength="4"
                  maxLength="30"
                  pattern="[A-Za-z0-9 &-]+"
                  required
                />
              </>}

              <label className="form-label small fw-semibold">What's wrong?</label>
              <textarea
                className="form-control mb-3"
                rows="3"
                placeholder="Describe the issue in a line or two…"
                value={description}
                onChange={e => setDescription(e.target.value)}
                required
              />

              <label className="form-label small fw-semibold">Location</label>
              <div className="d-flex gap-2 flex-wrap mb-2 align-items-center">
                <button type="button" className="btn btn-sm btn-pill-outline" onClick={useCurrentLocation}>
                  <i className="bi bi-crosshair me-1"></i>Use my location
                </button>
                <button type="button" className={`btn btn-sm ${showMap ? 'btn-gradient' : 'btn-pill-outline'}`}
                  onClick={() => setShowMap(s => !s)} title="Pick a point on the map" aria-expanded={showMap}>
                  <i className="bi bi-map me-1"></i>Pick on map
                </button>
                {coordinates && <span className="small text-muted align-self-center">{coordinates.lat}, {coordinates.lng}</span>}
              </div>
              {showMap && (
                <div className="mb-2">
                  <div className="map-picker-label-bar"><i className="bi bi-pin-map-fill me-1"></i>Tap the map to drop a pin, or drag it to fine-tune</div>
                  <LocationPickerMap lat={coordinates?.lat} lng={coordinates?.lng} onPick={pickOnMap} />
                </div>
              )}
              {locationStatus && <div className="small text-muted mb-2">{locationStatus}</div>}
              <div className="mb-3">
                <AddressAutocomplete
                  value={address}
                  onChange={setAddress}
                  onSelect={(picked) => {
                    applyLocation(picked);
                    setLocationStatus('Location selected from address search.');
                  }}
                />
              </div>
              <div className="small text-muted mb-2">
                No address above? Fill in State, District and City below instead.
              </div>

              <div className="row g-3 mb-3">
                <div className="col-6">
                  <label className="form-label small fw-semibold">State</label>
                  <SearchableSelect value={state} onChange={setState} options={states} allLabel="Select a state" className="w-100" />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-semibold">District</label>
                  <input className="form-control" placeholder="District" value={district} onChange={e => setDistrict(e.target.value)} />
                </div>
                <div className="col-12">
                  <label className="form-label small fw-semibold">Area Type (optional)</label>
                  <select className="form-select" value={areaType} onChange={e => setAreaType(e.target.value)}>
                    <option value="">Not sure / doesn't matter</option>
                    {AREA_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <div className="form-text">India's local bodies aren't all the same — picking one just relabels the fields below to match.</div>
                </div>
                {(areaTypeInfo?.showMandal ?? true) && (
                  <div className="col-6">
                    <label className="form-label small fw-semibold">Mandal (optional)</label>
                    <input className="form-control" placeholder="Mandal / Taluk / Tehsil" value={mandal} onChange={e => setMandal(e.target.value)} />
                  </div>
                )}
                <div className="col-6">
                  <label className="form-label small fw-semibold">{areaTypeInfo?.cityLabel || 'City'}</label>
                  <input className="form-control" placeholder="Nellore" value={city} onChange={e => setCity(e.target.value)} />
                </div>
                <div className="col-6">
                  <label className="form-label small fw-semibold">{areaTypeInfo?.wardLabel || 'Ward (optional)'}</label>
                  <input className="form-control" placeholder={areaTypeInfo?.wardLabel?.startsWith('Sector') ? 'Sector 62' : 'Ward 12'} value={ward} onChange={e => setWard(e.target.value)} />
                </div>
              </div>

              <label className="form-label small fw-semibold">Photos / Video <span className="text-muted fw-normal">up to 6</span></label>
              <label
                className="upload-dropzone d-block mb-2"
                style={dragOver ? { borderColor: '#7c9cc4', background: '#eaf0f8' } : undefined}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              >
                <i className="bi bi-cloud-arrow-up fs-3 d-block mb-2"></i>
                <div className="fw-semibold text-dark">Click or drag photos/videos here</div>
                <div className="small">JPG · PNG · MP4 · MOV · up to 6 files, 10MB each</div>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.mp4,.mov"
                  multiple
                  hidden
                  onChange={e => addFiles(e.target.files)}
                />
              </label>
              {fileNotice && (
                <div className="small text-success d-flex align-items-center gap-1 mb-2">
                  <i className="bi bi-check-circle-fill"></i>{fileNotice}
                </div>
              )}
              {files.length > 0 && (
                <div className="d-flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <span key={i} className="badge text-bg-light border d-inline-flex align-items-center gap-1">
                      <i className="bi bi-check-circle-fill text-success"></i>
                      {f.name}
                      <button type="button" className="btn-close btn-close-sm" style={{ fontSize: '0.55rem' }}
                        onClick={() => setFiles(files.filter((_, idx) => idx !== i))}></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <p className="text-muted mb-0 px-3" style={{ fontSize: '0.75rem' }}>
              Reports are submitted by citizens based on personal observation and are shared for
              public awareness only. This platform does not verify claims independently and does
              not accuse any individual or authority of wrongdoing. By submitting, you confirm
              your report is truthful and lawful, and agree to our full{' '}
              <Link to="/legal">Legal Disclaimer</Link>.
            </p>
            <div className="modal-footer border-0 pt-0">
              <button type="button" className="btn btn-pill-outline" onClick={close} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-gradient" disabled={busy}>
                {busy ? 'Submitting…' : 'Raise an Issue'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
