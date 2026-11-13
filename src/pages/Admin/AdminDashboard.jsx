import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ColumnToggle, { loadColumnPrefs } from '../../components/common/ColumnToggle';
import roleLabel from '../../utils/roleLabel';
import burstConfetti from '../../utils/confetti';
import BarChart from '../../components/common/BarChart';
import TiltCard from '../../components/common/TiltCard';
import SearchableSelect from '../../components/common/SearchableSelect';
import EmojiPicker from '../../components/common/EmojiPicker';
import Pagination from '../../components/common/Pagination';
import { isValidPassword, PASSWORD_RULES_TEXT } from '../../utils/passwordPolicy';
import { ANNOUNCEMENT_MOODS, moodEmoji } from '../../utils/announcementMoods';
import PageBuilderPanel from './PageBuilderPanel';
import ArticlesPanel from './ArticlesPanel';
import RTIRequestsPanel from './RTIRequestsPanel';
import EscalationsPanel from './EscalationsPanel';
import MaintenancePanel from './MaintenancePanel';
import DepartmentsPanel from './DepartmentsPanel';
import LawyerProfile from '../Lawyer/LawyerProfile';
import GroupedTableRows, { GroupBySelect } from '../../components/admin/GroupedTableRows';
import RichTextEditor from '../../components/common/RichTextEditor';

const ISSUE_COLUMNS = [
  { key: 'reporter', label: 'Reporter' },
  { key: 'category', label: 'Category' },
  { key: 'city', label: 'City / Area' },
  { key: 'priority', label: 'Priority' },
  { key: 'review', label: 'Review' },
  { key: 'status', label: 'Status' },
  { key: 'hot', label: 'Trending' },
  { key: 'comments', label: 'Comments' },
  { key: 'created', label: 'Created' },
  { key: 'updated', label: 'Updated' },
  { key: 'updatedBy', label: 'Updated By' }
];
const USER_COLUMNS = [
  { key: 'userId', label: 'User ID' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'role', label: 'Role' },
  { key: 'createCitizens', label: 'Create Member' },
  { key: 'homeFeedAccess', label: 'Create Feed' },
  { key: 'status', label: 'Status' },
  { key: 'joined', label: 'Joined' }
];

const formatDateTime = (d) => d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function AdminDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'Admin';
  const isAuthority = user?.role === 'Authority';

  const [summary, setSummary] = useState(null);
  const [byCategory, setByCategory] = useState([]);
  const [users, setUsers] = useState([]);
  const [issues, setIssues] = useState([]);
  const [backfillingTranslations, setBackfillingTranslations] = useState(false);
  const [meta, setMeta] = useState({ statuses: [] });
  const [settings, setSettings] = useState([]);
  const [audit, setAudit] = useState([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [issueStatusFilter, setIssueStatusFilter] = useState('');
  const [moderationFilter, setModerationFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [reporterSearch, setReporterSearch] = useState('');
  const [reporterFilter, setReporterFilter] = useState(null);
  const [selectedIssueIds, setSelectedIssueIds] = useState(new Set());
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [issueCols, setIssueCols] = useState(() => loadColumnPrefs('aoi-admin-issue-cols', {
    reporter: true, category: true, city: false, priority: false, review: true, status: true, hot: true, comments: true, created: false, updated: false, updatedBy: false
  }));
  const [userCols, setUserCols] = useState(() => loadColumnPrefs('aoi-admin-user-cols', { userId: true, email: true, phone: true, role: true, createCitizens: true, homeFeedAccess: true, status: false, joined: false }));
  const [issuePage, setIssuePage] = useState(1);
  const [issuePageSize, setIssuePageSize] = useState(20);
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(20);
  // Grouping clusters ALL matching rows under collapsible headers instead of
  // paginating — the two don't mix (seeing every "Escalated" issue at a
  // glance is the point, not just the ones on the current page), so
  // Pagination is hidden while a groupBy is active (see GroupedTableRows).
  const [issueGroupBy, setIssueGroupBy] = useState('');
  const [userGroupBy, setUserGroupBy] = useState('');

  const [activeTab, setActiveTab] = useState('feed');

  const [resetTarget, setResetTarget] = useState(null);
  const [resetValue, setResetValue] = useState('');
  const [resetResult, setResetResult] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetBusy, setResetBusy] = useState(false);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailResult, setEmailResult] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);

  const [emailLogs, setEmailLogs] = useState([]);
  const [emailLogLoading, setEmailLogLoading] = useState(false);
  const [expandedEmailLogId, setExpandedEmailLogId] = useState(null);
  const [emailLogUserFilter, setEmailLogUserFilter] = useState('');

  const loadEmailLog = () => {
    setEmailLogLoading(true);
    api.get('/admin/users/email-log')
      .then(res => setEmailLogs(res.data.logs || []))
      .catch(() => toast('Failed to load email log', 'error'))
      .finally(() => setEmailLogLoading(false));
  };

  // Global by default (every log, regardless of who it went to) — typing a
  // name or email narrows it down to just the sends that included that
  // specific user, without needing a separate "per-user" backend endpoint.
  const filteredEmailLogs = emailLogUserFilter.trim()
    ? emailLogs.filter(log => (log.recipients || []).some(r =>
        r.name?.toLowerCase().includes(emailLogUserFilter.trim().toLowerCase()) ||
        r.email?.toLowerCase().includes(emailLogUserFilter.trim().toLowerCase())
      ))
    : emailLogs;

  const [userSearch, setUserSearch] = useState('');
  const [profileUser, setProfileUser] = useState(null);
  // Inline User ID / phone editing inside the profile detail modal below.
  const [editingField, setEditingField] = useState(null); // 'userId' | 'phone' | null
  const [editValue, setEditValue] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', email: '', phone: '', role: 'Citizen' });
  const [createResult, setCreateResult] = useState(null);
  const [createError, setCreateError] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  const [announcements, setAnnouncements] = useState([]);
  const [announcementText, setAnnouncementText] = useState('');
  const [announcementMood, setAnnouncementMood] = useState('announce');
  // datetime-local input values ('' = no bound — visible immediately /
  // visible until deleted, respectively).
  const [announcementStartAt, setAnnouncementStartAt] = useState('');
  const [announcementEndAt, setAnnouncementEndAt] = useState('');
  const [editingAnnouncementId, setEditingAnnouncementId] = useState(null);
  const [announcementBusy, setAnnouncementBusy] = useState(false);

  // The admin-only list (unlike the public GET /api/announcements the Home
  // banner uses) includes scheduled-for-later and already-expired ones too,
  // so they can still be found and edited/deleted here.
  const loadAnnouncements = () => api.get('/admin/announcements').then(res => setAnnouncements(res.data.announcements || [])).catch(() => {});

  const [heroQuotes, setHeroQuotes] = useState([]);
  const [heroQuoteText, setHeroQuoteText] = useState('');
  const [editingHeroQuoteId, setEditingHeroQuoteId] = useState(null);
  const [heroQuoteBusy, setHeroQuoteBusy] = useState(false);
  const loadHeroQuotes = () => api.get('/admin/hero-quotes').then(res => setHeroQuotes(res.data.quotes || [])).catch(() => {});

  // Header/footer logo overrides — Super Admin only (stored role 'Admin');
  // see routes/logoRoutes.js. logoBusy tracks per-slot ('header'/'footer')
  // upload/remove requests so only the button actually in flight disables.
  const [logos, setLogos] = useState({ header: '', footer: '' });
  const [logoBusy, setLogoBusy] = useState(null);
  const logoInputRefs = useRef({});
  const loadLogos = () => api.get('/logo').then(res => setLogos({ header: res.data.header || '', footer: res.data.footer || '' })).catch(() => {});
  const uploadLogo = async (target, file) => {
    setLogoBusy(target);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await api.post(`/logo/${target}`, fd);
      setLogos(l => ({ ...l, [target]: res.data.url || '' }));
      toast(`${target === 'header' ? 'Header' : 'Footer'} logo updated`);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to upload logo', 'error');
    } finally {
      setLogoBusy(null);
    }
  };
  const removeLogo = async (target) => {
    setLogoBusy(target);
    try {
      await api.delete(`/logo/${target}`);
      setLogos(l => ({ ...l, [target]: '' }));
      toast(`${target === 'header' ? 'Header' : 'Footer'} logo reset to default`);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to reset logo', 'error');
    } finally {
      setLogoBusy(null);
    }
  };

  useEffect(() => {
    api.get('/admin/reports').then(res => {
      setSummary(res.data.summary);
      setByCategory(res.data.byCategory || []);
    }).catch(() => {});
    api.get('/admin/users').then(res => setUsers(res.data.users)).catch(() => {});
    api.get('/issues', { params: { moderation: 'all' } }).then(res => setIssues(res.data.issues)).catch(() => {});
    api.get('/issues/meta').then(res => setMeta(res.data)).catch(() => {});
    loadAnnouncements();
    loadEmailLog();
    if (isAdmin) {
      api.get('/admin/settings').then(res => setSettings(res.data.settings)).catch(() => {});
      api.get('/admin/audit').then(res => setAudit(res.data.logs)).catch(() => {});
      loadHeroQuotes();
      loadLogos();
    }
  }, [isAdmin]);

  // Jump back to page 1 whenever a filter (or the page size itself)
  // changes — otherwise narrowing a filter can strand the view on a page
  // number that no longer exists for the new, smaller result set.
  useEffect(() => {
    setIssuePage(1);
  }, [issueStatusFilter, moderationFilter, categoryFilter, cityFilter, priorityFilter, reporterFilter, reporterSearch, issuePageSize]);

  useEffect(() => {
    setUserPage(1);
  }, [userSearch, userPageSize]);

  const changeRole = async (id, role) => {
    const res = await api.patch(`/admin/users/${id}`, { role });
    setUsers(list => list.map(u => u._id === id ? res.data.user : u));
    setProfileUser(pu => (pu && pu._id === id ? res.data.user : pu));
    toast(`${res.data.user.name}'s role updated to ${roleLabel(role)}`);
  };

  const canManageTarget = (target) => isAdmin || (isAuthority && target.role === 'Citizen');

  const startEditField = (field, currentValue) => {
    setEditingField(field);
    setEditValue(currentValue || '');
    setEditError('');
  };

  const saveEditField = async (u) => {
    setEditBusy(true); setEditError('');
    try {
      const res = await api.patch(`/admin/users/${u._id}`, { [editingField]: editValue.trim() });
      setUsers(list => list.map(x => x._id === u._id ? res.data.user : x));
      setProfileUser(pu => (pu && pu._id === u._id ? res.data.user : pu));
      setEditingField(null);
      toast(`${res.data.user.name}'s ${editingField === 'userId' ? 'User ID' : 'phone number'} updated`);
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update');
    } finally {
      setEditBusy(false);
    }
  };

  const toggleCanCreateCitizens = async (u) => {
    const res = await api.patch(`/admin/users/${u._id}`, { canCreateCitizens: !u.canCreateCitizens });
    setUsers(list => list.map(x => x._id === u._id ? res.data.user : x));
    setProfileUser(pu => (pu && pu._id === u._id ? res.data.user : pu));
    toast(`${res.data.user.name} can ${res.data.user.canCreateCitizens ? 'now' : 'no longer'} create ${roleLabel('Citizen')} profiles`);
  };

  const toggleCanAccessHomeFeed = async (u) => {
    const res = await api.patch(`/admin/users/${u._id}`, { canAccessHomeFeed: !u.canAccessHomeFeed });
    setUsers(list => list.map(x => x._id === u._id ? res.data.user : x));
    setProfileUser(pu => (pu && pu._id === u._id ? res.data.user : pu));
    toast(`${res.data.user.name} can ${res.data.user.canAccessHomeFeed ? 'now' : 'no longer'} view the Home and Issues feed pages`);
  };

  const announcementTextRef = useRef(null);

  // Inserts at the field's current cursor position rather than always
  // appending to the end, so picking an emoji mid-sentence lands where the
  // cursor actually is.
  const insertEmojiInAnnouncement = (emoji) => {
    const el = announcementTextRef.current;
    const start = el ? el.selectionStart ?? announcementText.length : announcementText.length;
    const end = el ? el.selectionEnd ?? announcementText.length : announcementText.length;
    const next = announcementText.slice(0, start) + emoji + announcementText.slice(end);
    setAnnouncementText(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  // <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local wall-clock
  // time, not the UTC ISO string the API returns — shift by the timezone
  // offset before slicing, or the pre-filled edit form would show the wrong
  // time in any timezone other than UTC.
  const toDatetimeLocal = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const formatAnnouncementSchedule = (a) => {
    if (a.startAt && a.endAt) return `Visible ${formatDateTime(a.startAt)} – ${formatDateTime(a.endAt)}`;
    if (a.startAt) return `Visible from ${formatDateTime(a.startAt)}`;
    if (a.endAt) return `Visible until ${formatDateTime(a.endAt)}`;
    return '';
  };

  const startNewAnnouncement = () => {
    setEditingAnnouncementId('new');
    setAnnouncementText('');
    setAnnouncementMood('announce');
    setAnnouncementStartAt('');
    setAnnouncementEndAt('');
  };

  const startEditAnnouncement = (a) => {
    setEditingAnnouncementId(a._id);
    setAnnouncementText(a.text);
    setAnnouncementMood(a.mood || 'announce');
    setAnnouncementStartAt(toDatetimeLocal(a.startAt));
    setAnnouncementEndAt(toDatetimeLocal(a.endAt));
  };

  const cancelAnnouncementEdit = () => {
    setEditingAnnouncementId(null);
    setAnnouncementText('');
    setAnnouncementMood('announce');
    setAnnouncementStartAt('');
    setAnnouncementEndAt('');
  };

  const saveAnnouncement = async (e) => {
    e.preventDefault();
    setAnnouncementBusy(true);
    const payload = {
      text: announcementText.trim(),
      mood: announcementMood,
      startAt: announcementStartAt || null,
      endAt: announcementEndAt || null
    };
    try {
      if (editingAnnouncementId === 'new') {
        await api.post('/admin/announcements', payload);
        toast('Announcement posted');
      } else {
        await api.patch(`/admin/announcements/${editingAnnouncementId}`, payload);
        toast('Announcement updated');
      }
      await loadAnnouncements();
      cancelAnnouncementEdit();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save announcement', 'error');
    } finally {
      setAnnouncementBusy(false);
    }
  };

  const deleteAnnouncement = async (a) => {
    if (!confirm('Delete this announcement? It will disappear from the Home page immediately.')) return;
    await api.delete(`/admin/announcements/${a._id}`);
    setAnnouncements(list => list.filter(x => x._id !== a._id));
    toast('Announcement deleted', 'info');
  };

  const startNewHeroQuote = () => {
    setEditingHeroQuoteId('new');
    setHeroQuoteText('');
  };

  const startEditHeroQuote = (q) => {
    setEditingHeroQuoteId(q._id);
    setHeroQuoteText(q.text);
  };

  const cancelHeroQuoteEdit = () => {
    setEditingHeroQuoteId(null);
    setHeroQuoteText('');
  };

  const saveHeroQuote = async (e) => {
    e.preventDefault();
    setHeroQuoteBusy(true);
    try {
      if (editingHeroQuoteId === 'new') {
        await api.post('/admin/hero-quotes', { text: heroQuoteText.trim() });
        toast('Hero quote added');
      } else {
        await api.patch(`/admin/hero-quotes/${editingHeroQuoteId}`, { text: heroQuoteText.trim() });
        toast('Hero quote updated');
      }
      await loadHeroQuotes();
      cancelHeroQuoteEdit();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save quote', 'error');
    } finally {
      setHeroQuoteBusy(false);
    }
  };

  const deleteHeroQuote = async (q) => {
    if (!confirm('Delete this hero quote?')) return;
    await api.delete(`/admin/hero-quotes/${q._id}`);
    setHeroQuotes(list => list.filter(x => x._id !== q._id));
    toast('Hero quote deleted', 'info');
  };

  const toggleUserStatus = async (u) => {
    const res = await api.patch(`/admin/users/${u._id}/status`, { isDisabled: !u.isDisabled });
    setUsers(list => list.map(x => x._id === u._id ? res.data.user : x));
    toast(`${u.name} ${res.data.user.isDisabled ? 'disabled' : 'enabled'}`);
  };

  const deleteUser = async (u) => {
    if (!confirm(`Permanently delete ${u.name}'s account? This cannot be undone.`)) return;
    await api.delete(`/admin/users/${u._id}`);
    setUsers(list => list.filter(x => x._id !== u._id));
    toast(`${u.name}'s account deleted`, 'info');
  };

  const toggleUserSelected = (id) => {
    setSelectedUserIds(sel => {
      const next = new Set(sel);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Uses allSettled rather than all — a mixed selection can include one
  // account a delete legitimately fails for (e.g. added to the selection,
  // then someone else's action changes its state) without that blocking the
  // rest, and the toast at the end reports exactly how many actually went
  // through vs. failed instead of an all-or-nothing throw.
  const deleteSelectedUsers = async () => {
    const ids = [...selectedUserIds];
    if (ids.length === 0) return;
    if (!confirm(`Permanently delete ${ids.length} selected account${ids.length === 1 ? '' : 's'}? This cannot be undone.`)) return;
    const results = await Promise.allSettled(ids.map(id => api.delete(`/admin/users/${id}`)));
    const deletedIds = ids.filter((id, i) => results[i].status === 'fulfilled');
    const failedCount = ids.length - deletedIds.length;
    setUsers(list => list.filter(x => !deletedIds.includes(x._id)));
    setSelectedUserIds(new Set());
    if (failedCount === 0) {
      toast(`${deletedIds.length} account${deletedIds.length === 1 ? '' : 's'} deleted`, 'info');
    } else {
      toast(`${deletedIds.length} deleted, ${failedCount} failed`, deletedIds.length ? 'info' : 'error');
    }
  };

  const openEmailModal = () => {
    setEmailSubject('');
    setEmailBody('');
    setEmailResult('');
    setEmailError('');
    setShowEmailModal(true);
  };

  const closeEmailModal = () => {
    if (emailBusy) return;
    setShowEmailModal(false);
  };

  const sendSelectedUsersEmail = async (e) => {
    e.preventDefault();
    // contentEditable has no native `required` validation the way a
    // <textarea> does — an "empty" rich-text editor can still contain
    // whitespace-only markup like "<br>", so check actual visible text.
    const plainText = emailBody.replace(/<[^>]*>/g, '').trim();
    if (!plainText) {
      setEmailError('Message is required');
      return;
    }
    setEmailBusy(true);
    setEmailError('');
    try {
      const res = await api.post('/admin/users/email', {
        userIds: [...selectedUserIds],
        subject: emailSubject.trim(),
        message: emailBody
      });
      const { sentCount, failedCount, skippedCount } = res.data;
      let summary = `Sent to ${sentCount} user${sentCount === 1 ? '' : 's'}`;
      if (failedCount) summary += `, ${failedCount} failed`;
      if (skippedCount) summary += `, ${skippedCount} skipped (no email or not manageable)`;
      setEmailResult(summary);
      toast(summary, failedCount || skippedCount ? 'info' : 'success');
      loadEmailLog();
    } catch (err) {
      setEmailError(err.response?.data?.message || 'Failed to send email');
    } finally {
      setEmailBusy(false);
    }
  };

  const changeIssueStatus = async (id, status) => {
    const res = await api.patch(`/issues/${id}`, { status });
    setIssues(list => list.map(i => i._id === id ? res.data.issue : i));
    toast(`Issue marked ${status}`);
    if (status === 'Resolved') burstConfetti(window.innerWidth / 2, 200);
  };

  const toggleFeatured = async (issue) => {
    const res = await api.patch(`/issues/${issue._id}`, { featured: !issue.featured });
    setIssues(list => list.map(i => i._id === issue._id ? res.data.issue : i));
    toast(res.data.issue.featured ? 'Marked as Trending' : 'Removed from Trending topics');
  };

  const toggleCommentsLocked = async (issue) => {
    const res = await api.patch(`/issues/${issue._id}`, { commentsLocked: !issue.commentsLocked });
    setIssues(list => list.map(i => i._id === issue._id ? res.data.issue : i));
    toast(res.data.issue.commentsLocked ? 'Comments locked' : 'Comments unlocked');
  };

  const moderateIssue = async (id, decision) => {
    const res = await api.patch(`/issues/${id}`, { moderationStatus: decision });
    setIssues(list => list.map(i => i._id === id ? res.data.issue : i));
    toast(`Issue ${decision.toLowerCase()}`, decision === 'Rejected' ? 'info' : 'success');
  };

  const deleteIssue = async (id) => {
    if (!confirm('Delete this issue permanently?')) return;
    await api.delete(`/issues/${id}`);
    setIssues(list => list.filter(i => i._id !== id));
    setSelectedIssueIds(sel => { const next = new Set(sel); next.delete(id); return next; });
    toast('Issue deleted', 'info');
  };

  const toggleIssueSelected = (id) => {
    setSelectedIssueIds(sel => {
      const next = new Set(sel);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const backfillIssueTranslations = async () => {
    if (backfillingTranslations) return;
    if (!confirm('Translate every existing issue now? This can take a couple of minutes for a large number of issues.')) return;
    setBackfillingTranslations(true);
    try {
      const res = await api.post('/admin/issues/backfill-translations');
      toast(`Translated ${res.data.count} issue(s)`);
      const refreshed = await api.get('/issues', { params: { moderation: 'all' } });
      setIssues(refreshed.data.issues);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to translate issues', 'error');
    } finally {
      setBackfillingTranslations(false);
    }
  };

  const deleteSelectedIssues = async () => {
    const ids = [...selectedIssueIds];
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected issue${ids.length === 1 ? '' : 's'} permanently?`)) return;
    await Promise.all(ids.map(id => api.delete(`/issues/${id}`)));
    setIssues(list => list.filter(i => !selectedIssueIds.has(i._id)));
    setSelectedIssueIds(new Set());
    toast(`${ids.length} issue${ids.length === 1 ? '' : 's'} deleted`, 'info');
  };

  const updateSetting = (key, value) =>
    setSettings(list => list.map(s => s.key === key ? { ...s, value } : s));

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await api.put('/admin/settings', { settings });
      setSettings(res.data.settings);
      toast('Settings saved');
    } finally {
      setSavingSettings(false);
    }
  };

  // Saves just one setting key rather than the whole `settings` array — used
  // where each field in a small group (e.g. hero eyebrow/description) gets
  // its own independent Save button instead of one shared one.
  const [savingSettingKey, setSavingSettingKey] = useState(null);
  const saveOneSetting = async (key, label) => {
    setSavingSettingKey(key);
    try {
      const value = settings.find(s => s.key === key)?.value ?? '';
      const res = await api.put('/admin/settings', { settings: [{ key, value }] });
      setSettings(res.data.settings);
      toast(`${label} saved`);
    } finally {
      setSavingSettingKey(null);
    }
  };

  const openReset = (u) => {
    setResetTarget(u);
    setResetValue('');
    setResetResult('');
    setResetError('');
  };

  const closeReset = () => { if (!resetBusy) setResetTarget(null); };

  const submitReset = async (e) => {
    e.preventDefault();
    setResetError('');
    if (resetValue && !isValidPassword(resetValue)) {
      setResetError(`Password must be ${PASSWORD_RULES_TEXT}`);
      return;
    }
    setResetResult(''); setResetBusy(true);
    try {
      const res = await api.post(`/admin/users/${resetTarget._id}/reset-password`, resetValue ? { newPassword: resetValue } : {});
      setResetResult(res.data.generatedPassword ? res.data.generatedPassword : 'Password updated.');
    } catch (err) {
      setResetError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetBusy(false);
    }
  };

  const openCreateUser = () => {
    setCreateForm({ name: '', email: '', phone: '', role: 'Citizen' });
    setCreateResult(null);
    setCreateError('');
    setShowCreateUser(true);
  };

  const closeCreateUser = () => { if (!createBusy) setShowCreateUser(false); };

  const submitCreateUser = async (e) => {
    e.preventDefault();
    setCreateError(''); setCreateBusy(true);
    try {
      const res = await api.post('/admin/users', createForm);
      setUsers(list => [res.data.user, ...list]);
      setCreateResult(res.data.generatedPassword);
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Failed to create user');
    } finally {
      setCreateBusy(false);
    }
  };

  const cards = summary ? [
    { label: 'Total Issues', value: summary.totalIssues, icon: 'bi-collection', color: 'text-primary', onClick: () => { setIssueStatusFilter(''); setModerationFilter(''); setActiveTab('feed'); } },
    { label: 'Pending Review', value: summary.pendingReview, icon: 'bi-hourglass-split', color: 'text-warning', onClick: () => { setIssueStatusFilter(''); setModerationFilter('Pending'); setActiveTab('feed'); } },
    { label: 'Open', value: summary.openIssues, icon: 'bi-exclamation-circle', color: 'text-warning', onClick: () => { setIssueStatusFilter('Open'); setModerationFilter(''); setActiveTab('feed'); } },
    { label: 'Resolved', value: summary.resolvedIssues, icon: 'bi-check-circle', color: 'text-success', onClick: () => { setIssueStatusFilter('Resolved'); setModerationFilter(''); setActiveTab('feed'); } },
    { label: 'Users', value: summary.users, icon: 'bi-people', color: 'text-info', onClick: () => setActiveTab('users') }
  ] : [];

  const distinctCities = [...new Set(issues.map(i => i.location?.city).filter(Boolean))].sort();

  const filteredIssues = issues
    .filter(i => !issueStatusFilter || i.status === issueStatusFilter)
    .filter(i => !moderationFilter || i.moderationStatus === moderationFilter)
    .filter(i => !categoryFilter || i.category === categoryFilter)
    .filter(i => !cityFilter || i.location?.city === cityFilter)
    .filter(i => !priorityFilter || i.priority === priorityFilter)
    .filter(i => !reporterFilter || String(i.reporter?._id) === String(reporterFilter.id))
    // No reporter matches searching "unknown" or "unassigned" — same fallback
    // concept as the Group by Reporter label (issueGroupBy === 'reporter'
    // below), just covering both words since either is a fair guess.
    .filter(i => !reporterSearch || (i.reporter?.name || 'Unknown Unassigned').toLowerCase().includes(reporterSearch.trim().toLowerCase()));

  const allFilteredSelected = filteredIssues.length > 0 && filteredIssues.every(i => selectedIssueIds.has(i._id));
  const toggleSelectAllFiltered = () => {
    setSelectedIssueIds(sel => {
      const next = new Set(sel);
      filteredIssues.forEach(i => allFilteredSelected ? next.delete(i._id) : next.add(i._id));
      return next;
    });
  };

  // Handed to the issue detail page (via router state) so it can offer
  // prev/next arrows through whatever this table is currently showing,
  // instead of the admin bouncing back to this list after every review.
  // Includes moderationStatus/status (not just _id) so the detail page can
  // apply its own review-state/status filter to the same pool without an
  // extra API round trip, and the two active filters here so it starts
  // pre-set to the same filter the admin was already using.
  const reviewQueueState = {
    queue: filteredIssues.map(i => ({ _id: i._id, moderationStatus: i.moderationStatus, status: i.status })),
    moderationFilter,
    issueStatusFilter
  };

  // The table only ever renders one page's worth — filteredIssues/filteredUsers
  // (the full filtered list) still back the count display, select-all, and
  // the review queue above, which all need every match, not just this page.
  const paginatedIssues = filteredIssues.slice((issuePage - 1) * issuePageSize, issuePage * issuePageSize);

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(userSearch.trim().toLowerCase()));
  const paginatedUsers = filteredUsers.slice((userPage - 1) * userPageSize, userPage * userPageSize);

  // Excludes the current admin's own account from "select all" — it can
  // never actually be deleted (see deleteUser/deleteSelectedUsers), so
  // including it would make "select all" silently fail to select 100%.
  const selectableUsers = filteredUsers.filter(u => String(u._id) !== String(user._id));
  const allFilteredUsersSelected = selectableUsers.length > 0 && selectableUsers.every(u => selectedUserIds.has(u._id));
  const toggleSelectAllFilteredUsers = () => {
    setSelectedUserIds(sel => {
      const next = new Set(sel);
      selectableUsers.forEach(u => allFilteredUsersSelected ? next.delete(u._id) : next.add(u._id));
      return next;
    });
  };

  // Posting stats for the profile view — computed from the issues already
  // loaded for this dashboard rather than a separate API round trip.
  const goToReporterFeed = (u, moderation = '', status = '') => {
    setReporterFilter({ id: u._id, name: u.name });
    setModerationFilter(moderation);
    setIssueStatusFilter(status);
    setCategoryFilter(''); setCityFilter(''); setPriorityFilter(''); setReporterSearch('');
    setActiveTab('feed');
    setProfileUser(null);
  };

  const statsFor = (u) => {
    const mine = issues.filter(i => String(i.reporter?._id || i.reporter) === String(u._id));
    return {
      total: mine.length,
      approved: mine.filter(i => i.moderationStatus === 'Approved').length,
      rejected: mine.filter(i => i.moderationStatus === 'Rejected').length,
      pending: mine.filter(i => i.moderationStatus === 'Pending').length,
      resolved: mine.filter(i => i.status === 'Resolved').length
    };
  };

  return (
    <div className="container-fluid px-4 py-4 admin-shell">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h3 className="fw-bold mb-0">Control Panel</h3>
        <span className="badge-solid-gradient">{roleLabel(user?.role)}</span>
      </div>

      <div className="row g-3 mb-4">
        {cards.map(c => (
          <div className="col-6 col-lg" key={c.label}>
            <TiltCard as="button" type="button" onClick={c.onClick} className="card stat-card p-3 h-100 w-100 border-0 text-start bg-white">
              <div className="d-flex align-items-center justify-content-between">
                <div>
                  <div className="text-muted small">{c.label}</div>
                  <div className="fs-3 fw-bold">{c.value}</div>
                </div>
                <span className={`admin-stat-icon ${c.color}`}>
                  <i className={`bi ${c.icon}`}></i>
                </span>
              </div>
            </TiltCard>
          </div>
        ))}
      </div>

      <div className="d-flex flex-column flex-md-row gap-3 gap-md-4">
        <ul className="nav nav-pills flex-row flex-md-column gap-1 flex-shrink-0 admin-tab-nav" style={{ minWidth: 160 }}>
          <li className="nav-item">
            <button type="button" className={`nav-link border-0 text-start w-100 ${activeTab === 'feed' ? 'active' : 'bg-transparent'}`} onClick={() => setActiveTab('feed')}>
              <i className="bi bi-collection me-2"></i>Issues
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link border-0 text-start w-100 ${activeTab === 'users' ? 'active' : 'bg-transparent'}`} onClick={() => setActiveTab('users')}>
              <i className="bi bi-people me-2"></i>Users
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link border-0 text-start w-100 ${activeTab === 'emailLog' ? 'active' : 'bg-transparent'}`} onClick={() => setActiveTab('emailLog')}>
              <i className="bi bi-envelope-paper me-2"></i>Email Log
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link border-0 text-start w-100 ${activeTab === 'escalations' ? 'active' : 'bg-transparent'}`} onClick={() => setActiveTab('escalations')}>
              <i className="bi bi-send-check me-2"></i>Escalations
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link border-0 text-start w-100 ${activeTab === 'announcements' ? 'active' : 'bg-transparent'}`} onClick={() => setActiveTab('announcements')}>
              <i className="bi bi-megaphone me-2"></i>Announcements
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link border-0 text-start w-100 ${activeTab === 'departments' ? 'active' : 'bg-transparent'}`} onClick={() => setActiveTab('departments')}>
              <i className="bi bi-diagram-3 me-2"></i>Departments
            </button>
          </li>
          <li className="nav-item">
            <button type="button" className={`nav-link border-0 text-start w-100 ${activeTab === 'rti' ? 'active' : 'bg-transparent'}`} onClick={() => setActiveTab('rti')}>
              <i className="bi bi-file-earmark-text me-2"></i>Legal Advice
            </button>
          </li>
          {isAdmin && (
            <li className="nav-item">
              <button type="button" className={`nav-link border-0 text-start w-100 ${activeTab === 'lawyerProfile' ? 'active' : 'bg-transparent'}`} onClick={() => setActiveTab('lawyerProfile')}>
                <i className="bi bi-briefcase me-2"></i>Lawyer Profile
              </button>
            </li>
          )}
          {isAdmin && (
            <li className="nav-item">
              <button type="button" className={`nav-link border-0 text-start w-100 ${activeTab === 'heroQuotes' ? 'active' : 'bg-transparent'}`} onClick={() => setActiveTab('heroQuotes')}>
                <i className="bi bi-quote me-2"></i>Hero Quotes
              </button>
            </li>
          )}
          {isAdmin && (
            <li className="nav-item">
              <button type="button" className={`nav-link border-0 text-start w-100 ${activeTab === 'settings' ? 'active' : 'bg-transparent'}`} onClick={() => setActiveTab('settings')}>
                <i className="bi bi-gear me-2"></i>Settings
              </button>
            </li>
          )}
          {/* Super Admin only — these jobs change stored data across every
              account, which is not something to reach by clicking around. */}
          {isAdmin && (
            <li className="nav-item">
              <button type="button" className={`nav-link border-0 text-start w-100 ${activeTab === 'maintenance' ? 'active' : 'bg-transparent'}`} onClick={() => setActiveTab('maintenance')}>
                <i className="bi bi-tools me-2"></i>Maintenance
              </button>
            </li>
          )}
          {isAdmin && (
            <li className="nav-item">
              <button type="button" className={`nav-link border-0 text-start w-100 ${activeTab === 'pageBuilder' ? 'active' : 'bg-transparent'}`} onClick={() => setActiveTab('pageBuilder')}>
                <i className="bi bi-layout-text-window-reverse me-2"></i>Page Builder
              </button>
            </li>
          )}
          {isAdmin && (
            <li className="nav-item">
              <button type="button" className={`nav-link border-0 text-start w-100 ${activeTab === 'articles' ? 'active' : 'bg-transparent'}`} onClick={() => setActiveTab('articles')}>
                <i className="bi bi-file-earmark-text me-2"></i>Articles
              </button>
            </li>
          )}
        </ul>

        <div className="flex-grow-1" style={{ minWidth: 0 }}>
          {activeTab === 'feed' && (
            <>
      <div className="card p-3 mb-3">
        <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
          <h6 className="fw-semibold mb-0">Moderate Issues</h6>
          <span className="text-muted small">{filteredIssues.length} issue{filteredIssues.length === 1 ? '' : 's'}</span>
          {selectedIssueIds.size > 0 && (
            <>
              <span className="chip active">{selectedIssueIds.size} selected</span>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={deleteSelectedIssues}>
                <i className="bi bi-trash me-1"></i>Delete Selected
              </button>
              <button type="button" className="btn btn-sm btn-link text-decoration-none" onClick={() => setSelectedIssueIds(new Set())}>
                Clear selection
              </button>
            </>
          )}
          <div className="ms-auto d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={backfillIssueTranslations}
              disabled={backfillingTranslations}
              title="Translates every issue that was posted before auto-translation was set up, so they show up correctly for other viewers instead of only in the language they were originally posted in."
            >
              <i className={`bi ${backfillingTranslations ? 'bi-arrow-repeat' : 'bi-translate'} me-1`}></i>
              {backfillingTranslations ? 'Translating…' : 'Translate existing issues'}
            </button>
            <ColumnToggle label="Columns" columns={ISSUE_COLUMNS} visible={issueCols} onChange={setIssueCols} storageKey="aoi-admin-issue-cols" />
          </div>
        </div>

        <div className="d-flex align-items-center flex-wrap gap-2 mb-3 admin-filter-bar">
          <input
            type="text"
            className="form-control form-control-sm"
            style={{ width: 170 }}
            placeholder="Search by reporter…"
            value={reporterSearch}
            onChange={e => setReporterSearch(e.target.value)}
          />
          <SearchableSelect value={moderationFilter} onChange={setModerationFilter}
            options={meta.moderationStatuses || []} labels={{ Rejected: 'Refused' }} allLabel="All review states" style={{ width: 160 }} />
          <SearchableSelect value={issueStatusFilter} onChange={setIssueStatusFilter}
            options={meta.statuses || []} labels={{ Escalated: 'Acknowledged' }} allLabel="All statuses" style={{ width: 150 }} />
          <SearchableSelect value={categoryFilter} onChange={setCategoryFilter}
            options={meta.categories || []} allLabel="All categories" style={{ width: 170 }} />
          <SearchableSelect value={cityFilter} onChange={setCityFilter}
            options={distinctCities} allLabel="All areas" style={{ width: 150 }} />
          <SearchableSelect value={priorityFilter} onChange={setPriorityFilter}
            options={meta.priorities || []} allLabel="All priorities" style={{ width: 150 }} />
          {reporterFilter && (
            <span className="chip active">
              Reporter: {reporterFilter.name}
              <button type="button" className="btn btn-link p-0 ms-1 text-decoration-none" style={{ lineHeight: 1, color: 'inherit' }}
                onClick={() => setReporterFilter(null)} title="Clear reporter filter">
                <i className="bi bi-x-lg small"></i>
              </button>
            </span>
          )}
          {issueStatusFilter && (
            <span className="chip active">
              Status: {issueStatusFilter === 'Escalated' ? 'Acknowledged' : issueStatusFilter}
              <button type="button" className="btn btn-link p-0 ms-1 text-decoration-none" style={{ lineHeight: 1, color: 'inherit' }}
                onClick={() => setIssueStatusFilter('')} title="Clear status filter">
                <i className="bi bi-x-lg small"></i>
              </button>
            </span>
          )}
          {moderationFilter && (
            <span className="chip active">
              Review: {moderationFilter === 'Rejected' ? 'Refused' : moderationFilter}
              <button type="button" className="btn btn-link p-0 ms-1 text-decoration-none" style={{ lineHeight: 1, color: 'inherit' }}
                onClick={() => setModerationFilter('')} title="Clear review filter">
                <i className="bi bi-x-lg small"></i>
              </button>
            </span>
          )}
          {(categoryFilter || cityFilter || priorityFilter || reporterSearch) && (
            <button type="button" className="btn btn-sm btn-link text-decoration-none px-0"
              onClick={() => { setCategoryFilter(''); setCityFilter(''); setPriorityFilter(''); setReporterSearch(''); }}>
              Clear filters
            </button>
          )}
          <GroupBySelect
            value={issueGroupBy}
            onChange={setIssueGroupBy}
            options={[
              { value: 'status', label: 'Status' },
              { value: 'category', label: 'Category' },
              { value: 'moderationStatus', label: 'Review state' },
              { value: 'priority', label: 'Priority' },
              { value: 'city', label: 'City / Area' },
              { value: 'reporter', label: 'Reporter' }
            ]}
          />
        </div>
        <div className="table-responsive">
          <table className="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th style={{ width: '2rem' }}>
                  <input type="checkbox" className="form-check-input" checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered} title="Select all" />
                </th>
                <th>Issue</th>
                {issueCols.reporter && <th>Reporter</th>}
                {issueCols.category && <th>Category</th>}
                {issueCols.city && <th>City / Area</th>}
                {issueCols.priority && <th>Priority</th>}
                {issueCols.review && <th>Review</th>}
                {issueCols.status && <th>Status</th>}
                {issueCols.hot && <th>Trending</th>}
                {issueCols.comments && <th>Comments</th>}
                {issueCols.created && <th>Created</th>}
                {issueCols.updated && <th>Updated</th>}
                {issueCols.updatedBy && <th>Updated By</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              <GroupedTableRows
                rows={issueGroupBy ? filteredIssues : paginatedIssues}
                groupBy={issueGroupBy}
                groupKeyFn={issue => {
                  if (issueGroupBy === 'city') return issue.location?.city || 'Unassigned';
                  if (issueGroupBy === 'reporter') return issue.reporter?.name || 'Unknown';
                  return issue[issueGroupBy];
                }}
                colSpan={3 + Object.values(issueCols).filter(Boolean).length}
                renderRow={issue => (
                <tr key={issue._id}>
                  <td>
                    <input type="checkbox" className="form-check-input" checked={selectedIssueIds.has(issue._id)}
                      onChange={() => toggleIssueSelected(issue._id)} />
                  </td>
                  <td>
                    <Link to={`/issues/${issue._id}`} state={reviewQueueState} className="text-decoration-none fw-semibold">{issue.title}</Link>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>{issue.issueNumber}</div>
                  </td>
                  {issueCols.reporter && <td className="small">{issue.reporter?.name}</td>}
                  {issueCols.category && <td className="small">{issue.category}</td>}
                  {issueCols.city && <td className="small">{issue.location?.city || '—'}</td>}
                  {issueCols.priority && <td className="small">{issue.priority}</td>}
                  {issueCols.review && (
                    <td>
                      {issue.moderationStatus === 'Pending' ? (
                        <div className="d-flex align-items-center gap-1">
                          <button className="btn btn-sm btn-gradient" onClick={() => moderateIssue(issue._id, 'Approved')} title="Approve">
                            <i className="bi bi-check-lg"></i>
                          </button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => moderateIssue(issue._id, 'Rejected')} title="Reject">
                            <i className="bi bi-x-lg"></i>
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn btn-sm btn-link p-0 text-decoration-none"
                          onClick={() => moderateIssue(issue._id, issue.moderationStatus === 'Approved' ? 'Rejected' : 'Approved')}
                          title={`Click to ${issue.moderationStatus === 'Approved' ? 'reject' : 're-approve'}`}
                        >
                          <span className={`badge-pill ${issue.moderationStatus === 'Approved' ? 'badge-status-resolved' : 'badge-status-rejected'}`}>
                            {issue.moderationStatus === 'Rejected' ? 'Refused' : issue.moderationStatus}
                          </span>
                        </button>
                      )}
                    </td>
                  )}
                  {issueCols.status && (
                    <td>
                      <select className="form-select form-select-sm" style={{ width: 'auto' }}
                        value={issue.status} onChange={e => changeIssueStatus(issue._id, e.target.value)}>
                        {meta.statuses.map(s => <option key={s} value={s}>{s === 'Escalated' ? 'Acknowledged' : s}</option>)}
                      </select>
                    </td>
                  )}
                  {issueCols.hot && (
                    <td>
                      {issue.status === 'Resolved' || issue.status === 'Rejected' || issue.moderationStatus !== 'Approved' ? (
                        <span className="text-muted small" title={issue.moderationStatus !== 'Approved' ? 'Approve this post before it can be a hot topic' : undefined}>—</span>
                      ) : (
                        <button className={`btn btn-sm ${issue.featured ? 'btn-gradient' : 'btn-pill-outline'}`} onClick={() => toggleFeatured(issue)} title="Toggle hot topic">
                          <i className="bi bi-fire"></i>
                        </button>
                      )}
                    </td>
                  )}
                  {issueCols.comments && (
                    <td>
                      <button className="btn btn-sm btn-pill-outline" onClick={() => toggleCommentsLocked(issue)} title="Toggle comments lock">
                        <i className={`bi ${issue.commentsLocked ? 'bi-lock-fill' : 'bi-unlock'}`}></i>
                      </button>
                    </td>
                  )}
                  {issueCols.created && <td className="small text-muted text-nowrap">{formatDateTime(issue.createdAt)}</td>}
                  {issueCols.updated && <td className="small text-muted text-nowrap">{formatDateTime(issue.updatedAt)}</td>}
                  {issueCols.updatedBy && <td className="small">{issue.lastUpdatedBy?.name || '—'}</td>}
                  <td>
                    <div className="d-flex gap-1">
                      <Link to={`/issues/${issue._id}`} state={reviewQueueState} className="btn btn-sm btn-pill-outline" title="View post">
                        <i className="bi bi-eye"></i>
                      </Link>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => deleteIssue(issue._id)} title="Delete issue">
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
                )}
              />
              {filteredIssues.length === 0 && (
                <tr><td colSpan={3 + Object.values(issueCols).filter(Boolean).length} className="text-muted small">No issues match this filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {!issueGroupBy && (
          <Pagination
            page={issuePage} pageSize={issuePageSize} total={filteredIssues.length}
            onPageChange={setIssuePage} onPageSizeChange={setIssuePageSize}
          />
        )}
      </div>

      <div className="card p-3 mb-3">
        <h6 className="fw-semibold mb-3">Issues by Category</h6>
        {byCategory.length === 0
          ? <p className="text-muted small mb-0">No data.</p>
          : <BarChart data={byCategory.map(row => ({ label: row._id, count: row.count }))} />}
      </div>
            </>
          )}

          {activeTab === 'users' && (
          <div className="card p-3 mb-3">
            <div className="d-flex align-items-center gap-2 mb-3">
              <h6 className="fw-semibold mb-0">Users</h6>
              {isAuthority && <span className="text-muted small">({roleLabel('Citizen')}s only)</span>}
              {(isAdmin || (isAuthority && summary?.canCreateCitizens)) && (
                <button className="btn btn-sm btn-gradient" onClick={openCreateUser}>
                  <i className="bi bi-person-plus me-1"></i>Create User
                </button>
              )}
              {(isAdmin || isAuthority) && selectedUserIds.size > 0 && (
                <>
                  <span className="chip active">{selectedUserIds.size} selected</span>
                  <button type="button" className="btn btn-sm btn-gradient" onClick={openEmailModal}>
                    <i className="bi bi-envelope me-1"></i>Send Email
                  </button>
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={deleteSelectedUsers}>
                    <i className="bi bi-trash me-1"></i>Delete Selected
                  </button>
                  <button type="button" className="btn btn-sm btn-link text-decoration-none" onClick={() => setSelectedUserIds(new Set())}>
                    Clear selection
                  </button>
                </>
              )}
              <div className="ms-auto">
                <ColumnToggle label="Columns" columns={USER_COLUMNS} visible={userCols} onChange={setUserCols} storageKey="aoi-admin-user-cols" />
              </div>
            </div>
            <div className="mb-3 d-flex align-items-center gap-3 flex-wrap">
              <input
                type="text"
                className="form-control form-control-sm"
                style={{ maxWidth: 260 }}
                placeholder="Search by name…"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
              />
              <GroupBySelect
                value={userGroupBy}
                onChange={setUserGroupBy}
                options={[
                  { value: 'role', label: 'Role' },
                  { value: 'status', label: 'Status' }
                ]}
              />
            </div>
            <div className="table-responsive">
              <table className="table table-sm align-middle mb-0">
                <thead>
                  <tr>
                    {(isAdmin || isAuthority) && (
                      <th style={{ width: '2rem' }}>
                        <input type="checkbox" className="form-check-input" checked={allFilteredUsersSelected}
                          onChange={toggleSelectAllFilteredUsers} title="Select all" />
                      </th>
                    )}
                    <th>Name</th>
                    {userCols.userId && <th>User ID</th>}
                    {userCols.email && <th>Email</th>}
                    {userCols.phone && <th>Phone</th>}
                    {userCols.role && <th>Role</th>}
                    {userCols.createCitizens && isAdmin && <th className="text-center">Create Member</th>}
                    {userCols.homeFeedAccess && isAdmin && <th className="text-center">Create Feed</th>}
                    {userCols.status && <th>Status</th>}
                    {userCols.joined && <th>Joined</th>}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <GroupedTableRows
                    rows={userGroupBy ? filteredUsers : paginatedUsers}
                    groupBy={userGroupBy}
                    groupKeyFn={u => userGroupBy === 'status' ? (u.isDisabled ? 'Disabled' : 'Active') : roleLabel(u.role)}
                    colSpan={2 + (isAdmin || isAuthority ? 1 : 0) + Object.entries(userCols).filter(([k, v]) => v && ((k !== 'createCitizens' && k !== 'homeFeedAccess') || isAdmin)).length}
                    renderRow={u => {
                    const isSelf = String(u._id) === String(user._id);
                    return (
                    <tr key={u._id}>
                      {(isAdmin || isAuthority) && (
                        <td>
                          {!isSelf && (
                            <input type="checkbox" className="form-check-input" checked={selectedUserIds.has(u._id)}
                              onChange={() => toggleUserSelected(u._id)} />
                          )}
                        </td>
                      )}
                      <td>
                        <button type="button" className="btn btn-link p-0 text-decoration-none fw-semibold" onClick={() => { setProfileUser(u); setEditingField(null); }}>
                          {u.name}
                        </button>
                        {u.isDisabled && <span className="badge text-bg-secondary ms-2">Disabled</span>}
                      </td>
                      {userCols.userId && <td className="small text-muted">{u.userId || '—'}</td>}
                      {userCols.email && <td className="small text-muted">{u.email || '—'}</td>}
                      {userCols.phone && <td className="small text-muted">{u.phone || '—'}</td>}
                      {userCols.role && (
                        <td>
                          <select className="form-select form-select-sm" style={{ width: 'auto' }}
                            value={u.role} disabled={!isAdmin}
                            onChange={e => changeRole(u._id, e.target.value)}>
                            <option value="Citizen">{roleLabel('Citizen')}</option>
                            <option value="Admin">{roleLabel('Admin')}</option>
                            <option value="Authority">{roleLabel('Authority')}</option>
                            <option value="Lawyer">{roleLabel('Lawyer')}</option>
                          </select>
                        </td>
                      )}
                      {userCols.createCitizens && isAdmin && (
                        <td className="text-center">
                          {u.role === 'Authority' && (
                            <input className="form-check-input" type="checkbox" title={`Can create ${roleLabel('Citizen')}s`}
                              checked={!!u.canCreateCitizens} onChange={() => toggleCanCreateCitizens(u)} />
                          )}
                        </td>
                      )}
                      {userCols.homeFeedAccess && isAdmin && (
                        <td className="text-center">
                          {u.role === 'Authority' && (
                            <input className="form-check-input" type="checkbox" title="Can view Home/Feed"
                              checked={!!u.canAccessHomeFeed} onChange={() => toggleCanAccessHomeFeed(u)} />
                          )}
                        </td>
                      )}
                      {userCols.status && (
                        <td>
                          {u.isDisabled
                            ? <span className="badge text-bg-secondary">Disabled</span>
                            : <span className="badge text-bg-success-subtle text-success">Active</span>}
                        </td>
                      )}
                      {userCols.joined && <td className="small text-muted text-nowrap">{formatDateTime(u.createdAt)}</td>}
                      <td>
                        {(isAdmin || isAuthority) && (
                          <div className="d-flex gap-1">
                            <button className="btn btn-sm btn-pill-outline" onClick={() => openReset(u)} title="Reset password">
                              <i className="bi bi-key"></i>
                            </button>
                            {!isSelf && (
                              <>
                                <button className="btn btn-sm btn-pill-outline" onClick={() => toggleUserStatus(u)}
                                  title={u.isDisabled ? 'Enable account' : 'Disable account'}>
                                  <i className={`bi ${u.isDisabled ? 'bi-unlock' : 'bi-lock'}`}></i>
                                </button>
                                <button className="btn btn-sm btn-outline-danger" onClick={() => deleteUser(u)} title="Delete account">
                                  <i className="bi bi-trash"></i>
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                    );
                  }}
                  />
                  {filteredUsers.length === 0 && (
                    <tr><td colSpan={2 + (isAdmin || isAuthority ? 1 : 0) + Object.entries(userCols).filter(([k, v]) => v && ((k !== 'createCitizens' && k !== 'homeFeedAccess') || isAdmin)).length} className="text-muted small">No users match this search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {!userGroupBy && (
              <Pagination
                page={userPage} pageSize={userPageSize} total={filteredUsers.length}
                onPageChange={setUserPage} onPageSizeChange={setUserPageSize}
              />
            )}
            {isAuthority && <p className="text-muted small mb-0 mt-2">Showing {roleLabel('Citizen')} accounts only. Role assignment, and managing {roleLabel('Authority')}/{roleLabel('Admin')} accounts, rest with {roleLabel('Authority')} only.</p>}
          </div>
          )}

          {activeTab === 'emailLog' && (
            <div className="card p-3">
              <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                <h6 className="fw-semibold mb-0">
                  <i className="bi bi-envelope-paper me-2 text-primary"></i>Email Log
                </h6>
                <input
                  type="text" className="form-control form-control-sm" style={{ maxWidth: 260 }}
                  placeholder="Filter by user (name or email)…"
                  value={emailLogUserFilter} onChange={e => setEmailLogUserFilter(e.target.value)}
                />
              </div>
              {emailLogLoading && <p className="text-muted small mb-0">Loading…</p>}
              {!emailLogLoading && filteredEmailLogs.length === 0 && (
                <p className="text-muted small mb-0">
                  {emailLogUserFilter.trim() ? 'No emails found for that user.' : 'No emails sent yet.'}
                </p>
              )}
              {!emailLogLoading && filteredEmailLogs.map(log => (
                <div key={log._id} className="border rounded-4 p-3 mb-2">
                  <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap">
                    <div>
                      <div className="fw-semibold">{log.subject}</div>
                      <div className="text-muted small">
                        By {log.sentBy?.name || 'Unknown'} · {new Date(log.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-shrink-0">
                      <span className="badge bg-success-subtle text-success-emphasis">{log.sentCount} sent</span>
                      {log.failedCount > 0 && <span className="badge bg-danger-subtle text-danger-emphasis">{log.failedCount} failed</span>}
                      {log.skippedCount > 0 && <span className="badge bg-secondary-subtle text-secondary-emphasis">{log.skippedCount} skipped</span>}
                      <button
                        type="button" className="btn btn-sm btn-outline-secondary"
                        onClick={() => setExpandedEmailLogId(id => id === log._id ? null : log._id)}
                      >
                        {expandedEmailLogId === log._id ? 'Hide' : 'Details'}
                      </button>
                    </div>
                  </div>
                  {expandedEmailLogId === log._id && (
                    <div className="mt-3 border-top pt-2">
                      {(log.recipients || []).map((r, i) => (
                        <div key={i} className="d-flex align-items-center justify-content-between gap-2 small py-1 border-bottom">
                          <span>{r.name || '—'} <span className="text-muted">({r.email})</span></span>
                          {r.status === 'sent' ? (
                            <span className="badge bg-success-subtle text-success-emphasis">Sent</span>
                          ) : (
                            <span className="badge bg-danger-subtle text-danger-emphasis" title={r.error || ''}>Failed{r.error ? `: ${r.error}` : ''}</span>
                          )}
                        </div>
                      ))}
                      {(!log.recipients || log.recipients.length === 0) && (
                        <p className="text-muted small mb-0">No recipient details recorded.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'escalations' && <EscalationsPanel />}
          {activeTab === 'maintenance' && <MaintenancePanel />}

          {activeTab === 'announcements' && (
            <div className="card p-3">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h6 className="fw-semibold mb-0">
                  <i className="bi bi-megaphone-fill me-2 text-primary"></i>Announcements
                </h6>
                {editingAnnouncementId === null && (
                  <button type="button" className="btn btn-sm btn-gradient" onClick={startNewAnnouncement}>
                    <i className="bi bi-plus-lg me-1"></i>New Announcement
                  </button>
                )}
              </div>
              <p className="text-muted small">
                Shown as a scrolling banner at the top of the Home page. Post as many as you like — each one shows
                until you edit or delete it.
              </p>

              {editingAnnouncementId === 'new' && (
                <form onSubmit={saveAnnouncement} className="mb-3 p-3 border rounded-4">
                  <div className="d-flex gap-1 mb-2">
                    {ANNOUNCEMENT_MOODS.map(m => (
                      <button
                        key={m.key} type="button" title={m.label}
                        className={`btn btn-sm ${announcementMood === m.key ? 'btn-gradient' : 'btn-pill-outline'}`}
                        onClick={() => setAnnouncementMood(m.key)}
                      >
                        {m.emoji}
                      </button>
                    ))}
                  </div>
                  <div className="d-flex gap-2 flex-wrap">
                    <input
                      ref={announcementTextRef}
                      className="form-control" style={{ minWidth: 260, flex: 1 }}
                      value={announcementText} onChange={e => setAnnouncementText(e.target.value)}
                      maxLength={280} required autoFocus
                      placeholder="e.g. Scheduled maintenance tonight 11pm-12am — the site may be briefly unavailable."
                    />
                    <EmojiPicker onSelect={insertEmojiInAnnouncement} />
                  </div>
                  <div className="d-flex gap-2 flex-wrap mt-2">
                    <div>
                      <label className="form-label small text-muted mb-1">Visible from (optional)</label>
                      <input
                        type="datetime-local" className="form-control form-control-sm"
                        value={announcementStartAt} onChange={e => setAnnouncementStartAt(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label small text-muted mb-1">Visible until (optional)</label>
                      <input
                        type="datetime-local" className="form-control form-control-sm"
                        value={announcementEndAt} onChange={e => setAnnouncementEndAt(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="d-flex gap-2 mt-2">
                    <button type="submit" className="btn btn-gradient" disabled={announcementBusy}>
                      {announcementBusy ? 'Posting…' : 'Post'}
                    </button>
                    <button type="button" className="btn btn-outline-secondary" onClick={cancelAnnouncementEdit}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {announcements.length === 0 && editingAnnouncementId !== 'new' && (
                <p className="text-muted small text-center py-4 mb-0">No announcements posted yet.</p>
              )}

              <div className="d-flex flex-column gap-2">
                {announcements.map(a => (
                  <div key={a._id} className="p-3 border rounded-4">
                    {editingAnnouncementId === a._id ? (
                      <form onSubmit={saveAnnouncement}>
                        <div className="d-flex gap-1 mb-2">
                          {ANNOUNCEMENT_MOODS.map(m => (
                            <button
                              key={m.key} type="button" title={m.label}
                              className={`btn btn-sm ${announcementMood === m.key ? 'btn-gradient' : 'btn-pill-outline'}`}
                              onClick={() => setAnnouncementMood(m.key)}
                            >
                              {m.emoji}
                            </button>
                          ))}
                        </div>
                        <div className="d-flex gap-2 flex-wrap">
                          <input
                            ref={announcementTextRef}
                            className="form-control" style={{ minWidth: 260, flex: 1 }}
                            value={announcementText} onChange={e => setAnnouncementText(e.target.value)}
                            maxLength={280} required autoFocus
                          />
                          <EmojiPicker onSelect={insertEmojiInAnnouncement} />
                        </div>
                        <div className="d-flex gap-2 flex-wrap mt-2">
                          <div>
                            <label className="form-label small text-muted mb-1">Visible from (optional)</label>
                            <input
                              type="datetime-local" className="form-control form-control-sm"
                              value={announcementStartAt} onChange={e => setAnnouncementStartAt(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="form-label small text-muted mb-1">Visible until (optional)</label>
                            <input
                              type="datetime-local" className="form-control form-control-sm"
                              value={announcementEndAt} onChange={e => setAnnouncementEndAt(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="d-flex gap-2 mt-2">
                          <button type="submit" className="btn btn-gradient" disabled={announcementBusy}>
                            {announcementBusy ? 'Saving…' : 'Save'}
                          </button>
                          <button type="button" className="btn btn-outline-secondary" onClick={cancelAnnouncementEdit}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                        <div className="d-flex align-items-start gap-2">
                          <span style={{ fontSize: '1.1rem' }}>{moodEmoji(a.mood)}</span>
                          <div>
                            <div className="fw-semibold">{a.text}</div>
                            <div className="text-muted small">
                              Posted by {a.postedBy?.name || 'Staff'} · {formatDateTime(a.createdAt)}
                            </div>
                            {(a.startAt || a.endAt) && (
                              <div className="text-muted small">
                                <i className="bi bi-clock-history me-1"></i>{formatAnnouncementSchedule(a)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="d-flex gap-1 flex-shrink-0">
                          <button type="button" className="btn btn-sm btn-pill-outline" onClick={() => startEditAnnouncement(a)}>
                            Edit
                          </button>
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteAnnouncement(a)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'departments' && <DepartmentsPanel />}

          {activeTab === 'heroQuotes' && isAdmin && (
            <>
            <div className="card p-3">
              <div className="d-flex align-items-center justify-content-between mb-3">
                <h6 className="fw-semibold mb-0">
                  <i className="bi bi-quote me-2 text-primary"></i>Hero Quotes
                </h6>
                {editingHeroQuoteId === null && (
                  <button type="button" className="btn btn-sm btn-gradient" onClick={startNewHeroQuote}>
                    <i className="bi bi-plus-lg me-1"></i>New Quote
                  </button>
                )}
              </div>
              <p className="text-muted small">
                Replaces the "Your city. Your voice. Out loud." headline on the Home page. Add one or more —
                with more than one, they cycle automatically. With none, the original headline shows.
              </p>

              {editingHeroQuoteId === 'new' && (
                <form onSubmit={saveHeroQuote} className="mb-3 p-3 border rounded-4">
                  <div className="d-flex gap-2 flex-wrap">
                    <input
                      className="form-control" style={{ minWidth: 260, flex: 1 }}
                      value={heroQuoteText} onChange={e => setHeroQuoteText(e.target.value)}
                      maxLength={120} required autoFocus
                      placeholder="e.g. Your city. Your voice. Out loud."
                    />
                    <button type="submit" className="btn btn-gradient" disabled={heroQuoteBusy}>
                      {heroQuoteBusy ? 'Posting…' : 'Post'}
                    </button>
                    <button type="button" className="btn btn-outline-secondary" onClick={cancelHeroQuoteEdit}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {heroQuotes.length === 0 && editingHeroQuoteId !== 'new' && (
                <p className="text-muted small text-center py-4 mb-0">No custom quotes yet — the original headline is showing.</p>
              )}

              <div className="d-flex flex-column gap-2">
                {heroQuotes.map(q => (
                  <div key={q._id} className="p-3 border rounded-4">
                    {editingHeroQuoteId === q._id ? (
                      <form onSubmit={saveHeroQuote}>
                        <div className="d-flex gap-2 flex-wrap">
                          <input
                            className="form-control" style={{ minWidth: 260, flex: 1 }}
                            value={heroQuoteText} onChange={e => setHeroQuoteText(e.target.value)}
                            maxLength={120} required autoFocus
                          />
                          <button type="submit" className="btn btn-gradient" disabled={heroQuoteBusy}>
                            {heroQuoteBusy ? 'Saving…' : 'Save'}
                          </button>
                          <button type="button" className="btn btn-outline-secondary" onClick={cancelHeroQuoteEdit}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                        <div className="fw-semibold">{q.text}</div>
                        <div className="d-flex gap-1 flex-shrink-0">
                          <button type="button" className="btn btn-sm btn-pill-outline" onClick={() => startEditHeroQuote(q)}>
                            Edit
                          </button>
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteHeroQuote(q)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-3 mt-3">
              <h6 className="fw-semibold mb-1">Eyebrow &amp; description (optional)</h6>
              <p className="text-muted small">
                Overrides the small line and paragraph around the headline above. Leave blank to keep the
                site's default wording — it's entirely your choice whether to set either one.
              </p>
              <div className="mb-3">
                <label className="form-label small mb-1">Eyebrow line</label>
                <div className="d-flex gap-2">
                  <input
                    className="form-control form-control-sm"
                    value={settings.find(s => s.key === 'HERO_EYEBROW_TEXT')?.value ?? ''}
                    onChange={e => updateSetting('HERO_EYEBROW_TEXT', e.target.value)}
                    placeholder="A social network for getting things fixed"
                  />
                  <button
                    type="button" className="btn btn-sm btn-gradient flex-shrink-0"
                    onClick={() => saveOneSetting('HERO_EYEBROW_TEXT', 'Eyebrow line')}
                    disabled={savingSettingKey === 'HERO_EYEBROW_TEXT'}
                  >
                    {savingSettingKey === 'HERO_EYEBROW_TEXT' ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
              <div className="mb-1">
                <label className="form-label small mb-1">Description paragraph</label>
                <textarea
                  className="form-control form-control-sm mb-2" rows={2}
                  value={settings.find(s => s.key === 'HERO_DESCRIPTION_TEXT')?.value ?? ''}
                  onChange={e => updateSetting('HERO_DESCRIPTION_TEXT', e.target.value)}
                  placeholder="Post a pothole, a blocked drain, a dead streetlight — like you'd post anything else. Get upvoted, get noticed, get it fixed. Every post stays public until it's resolved."
                />
                <button
                  type="button" className="btn btn-sm btn-gradient"
                  onClick={() => saveOneSetting('HERO_DESCRIPTION_TEXT', 'Description paragraph')}
                  disabled={savingSettingKey === 'HERO_DESCRIPTION_TEXT'}
                >
                  {savingSettingKey === 'HERO_DESCRIPTION_TEXT' ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
            </>
          )}

          {activeTab === 'settings' && isAdmin && (
            <>
            <div className="card p-3 mb-3">
              <h6 className="fw-semibold mb-3">System Settings</h6>

              {settings.some(s => s.key === 'AUTO_APPROVAL_DAYS') && (
                <div className="mb-3">
                  <label className="form-label small mb-1 fw-semibold">Auto-approve unreviewed posts after</label>
                  <div className="d-flex align-items-end gap-2">
                    {[
                      { key: 'AUTO_APPROVAL_DAYS', label: 'Days' },
                      { key: 'AUTO_APPROVAL_HOURS', label: 'Hours' },
                      { key: 'AUTO_APPROVAL_MINUTES', label: 'Minutes' }
                    ].map(f => (
                      <div key={f.key}>
                        <label className="form-label small text-muted mb-1">{f.label}</label>
                        <input
                          className="form-control form-control-sm" type="number" min={0} style={{ width: 80 }}
                          value={settings.find(s => s.key === f.key)?.value ?? ''}
                          onChange={e => updateSetting(f.key, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="form-text">Combine as needed — e.g. 1 day + 2 hours + 15 minutes. A post still awaiting review is automatically published once this much time passes.</div>
                </div>
              )}

              {settings.filter(s => !['AUTO_APPROVAL_DAYS', 'AUTO_APPROVAL_HOURS', 'AUTO_APPROVAL_MINUTES', 'HERO_EYEBROW_TEXT', 'HERO_DESCRIPTION_TEXT', 'GAMES_ENABLED'].includes(s.key)).map(s => {
                const isBoolean = s.value === 'true' || s.value === 'false';
                return (
                  <div key={s.key} className="mb-2">
                    {isBoolean ? (
                      <div className="form-check form-switch">
                        <input className="form-check-input" type="checkbox" role="switch" id={`setting-${s.key}`}
                          checked={s.value === 'true'} onChange={e => updateSetting(s.key, e.target.checked ? 'true' : 'false')} />
                        <label className="form-check-label small" htmlFor={`setting-${s.key}`}>{s.key}</label>
                      </div>
                    ) : (
                      <>
                        <label className="form-label small mb-1">{s.key}</label>
                        <input
                          className="form-control form-control-sm"
                          value={s.value || ''}
                          onChange={e => updateSetting(s.key, e.target.value)}
                        />
                      </>
                    )}
                    {s.description && <div className="form-text">{s.description}</div>}
                  </div>
                );
              })}
              <button className="btn btn-sm btn-gradient mt-2" onClick={saveSettings} disabled={savingSettings}>
                {savingSettings ? 'Saving…' : 'Save Settings'}
              </button>
            </div>

            <div className="card p-3 mb-3">
              <h6 className="fw-semibold mb-1">Branding — Header &amp; Footer Logo</h6>
              <p className="text-muted small mb-3">
                Override the logo shown in the site's top navigation bar and the one shown in the
                footer — each is independent, so they don't have to match. Leave either one unset
                to keep the platform's default logo.
              </p>
              <div className="row g-3">
                {[
                  { target: 'header', label: 'Header logo', hint: "Shown in the top navigation bar on every page." },
                  { target: 'footer', label: 'Footer logo', hint: 'Shown in the footer on every page.' }
                ].map(({ target, label, hint }) => (
                  <div className="col-md-6" key={target}>
                    <label className="form-label small fw-semibold mb-1">{label}</label>
                    <div className="d-flex align-items-center gap-3 p-2 border rounded-4">
                      <div
                        className="d-flex align-items-center justify-content-center bg-body-tertiary rounded-3 flex-shrink-0"
                        style={{ width: 96, height: 64, overflow: 'hidden' }}
                      >
                        {logos[target]
                          ? <img src={logos[target]} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                          : <span className="text-muted small">Default</span>}
                      </div>
                      <div className="d-flex flex-column gap-1">
                        <button
                          type="button" className="btn btn-sm btn-gradient"
                          disabled={logoBusy === target}
                          onClick={() => logoInputRefs.current[target]?.click()}
                        >
                          {logoBusy === target ? 'Saving…' : 'Change'}
                        </button>
                        {logos[target] && (
                          <button
                            type="button" className="btn btn-sm btn-outline-secondary"
                            disabled={logoBusy === target}
                            onClick={() => removeLogo(target)}
                          >
                            Reset to default
                          </button>
                        )}
                      </div>
                      <input
                        type="file" accept=".jpg,.jpeg,.png" hidden
                        ref={el => { logoInputRefs.current[target] = el; }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          e.target.value = '';
                          if (file) uploadLogo(target, file);
                        }}
                      />
                    </div>
                    <div className="form-text">{hint}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-3">
              <h6 className="fw-semibold mb-3">Audit Log</h6>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {audit.map(log => (
                  <div key={log._id} className="small border-bottom py-1">
                    <span className="fw-semibold">{log.user?.name || 'System'}</span> {log.action} {log.entity}
                    <div className="text-muted" style={{ fontSize: '0.7rem' }}>{new Date(log.createdAt).toLocaleString()}</div>
                  </div>
                ))}
                {audit.length === 0 && <p className="text-muted small mb-0">No audit entries yet.</p>}
              </div>
            </div>
            </>
          )}

          {activeTab === 'pageBuilder' && isAdmin && <PageBuilderPanel />}
          {activeTab === 'articles' && isAdmin && <ArticlesPanel />}
          {activeTab === 'rti' && (isAdmin || isAuthority) && <RTIRequestsPanel />}
          {activeTab === 'lawyerProfile' && isAdmin && <LawyerProfile />}
        </div>
      </div>

      {resetTarget && (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(15, 23, 42, 0.45)' }} onMouseDown={(e) => e.target === e.currentTarget && closeReset()}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Reset password</h5>
                <button type="button" className="btn-close" onClick={closeReset} disabled={resetBusy}></button>
              </div>
              <form onSubmit={submitReset}>
                <div className="modal-body">
                  <p className="text-muted small">
                    Setting a new password for <strong>{resetTarget.name}</strong> ({resetTarget.email || resetTarget.phone}).
                  </p>
                  {resetError && <div className="alert alert-danger py-2">{resetError}</div>}
                  {resetResult ? (
                    <div className="alert alert-success py-2">
                      <div className="fw-semibold mb-1">Done — share this with the user:</div>
                      <code className="user-select-all">{resetResult}</code>
                    </div>
                  ) : (
                    <>
                      <label className="form-label small fw-semibold">New password</label>
                      <input className="form-control" value={resetValue} onChange={e => setResetValue(e.target.value)}
                        minLength={6} maxLength={16} placeholder="Leave blank to auto-generate one" />
                      <div className="form-text">Leave blank and a secure temporary password will be generated for you. If you set one yourself: {PASSWORD_RULES_TEXT}</div>
                    </>
                  )}
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-pill-outline" onClick={closeReset} disabled={resetBusy}>
                    {resetResult ? 'Close' : 'Cancel'}
                  </button>
                  {!resetResult && (
                    <button type="submit" className="btn btn-gradient" disabled={resetBusy}>
                      {resetBusy ? 'Resetting…' : 'Reset Password'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEmailModal && (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(15, 23, 42, 0.45)' }} onMouseDown={(e) => e.target === e.currentTarget && closeEmailModal()}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Email selected users</h5>
                <button type="button" className="btn-close" onClick={closeEmailModal} disabled={emailBusy}></button>
              </div>
              <form onSubmit={sendSelectedUsersEmail}>
                <div className="modal-body">
                  <p className="text-muted small">
                    Sending to <strong>{selectedUserIds.size}</strong> selected user{selectedUserIds.size === 1 ? '' : 's'}.
                  </p>
                  {emailError && <div className="alert alert-danger py-2">{emailError}</div>}
                  {emailResult ? (
                    <div className="alert alert-success py-2 mb-0">{emailResult}</div>
                  ) : (
                    <>
                      <label className="form-label small fw-semibold">Subject</label>
                      <input className="form-control mb-3" value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                        maxLength={150} required autoFocus placeholder="e.g. Important update about your account" />
                      <label className="form-label small fw-semibold">Message</label>
                      <RichTextEditor value={emailBody} onChange={setEmailBody} placeholder="Write your message here…" />
                      <div className="form-text">Users with no email on file, or outside your management scope, are skipped automatically.</div>
                    </>
                  )}
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-pill-outline" onClick={closeEmailModal} disabled={emailBusy}>
                    {emailResult ? 'Close' : 'Cancel'}
                  </button>
                  {!emailResult && (
                    <button type="submit" className="btn btn-gradient" disabled={emailBusy}>
                      {emailBusy ? 'Sending…' : 'Send Email'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showCreateUser && (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(15, 23, 42, 0.45)' }} onMouseDown={(e) => e.target === e.currentTarget && closeCreateUser()}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Create user</h5>
                <button type="button" className="btn-close" onClick={closeCreateUser} disabled={createBusy}></button>
              </div>
              <form onSubmit={submitCreateUser}>
                <div className="modal-body">
                  {createError && <div className="alert alert-danger py-2">{createError}</div>}
                  {createResult ? (
                    <div className="alert alert-success py-2">
                      <div className="fw-semibold mb-1">Account created — share this password with them:</div>
                      <code className="user-select-all">{createResult}</code>
                    </div>
                  ) : (
                    <>
                      <label className="form-label small fw-semibold">Name</label>
                      <input className="form-control mb-3" value={createForm.name}
                        onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} required />

                      <label className="form-label small fw-semibold">Email</label>
                      <input type="email" className="form-control mb-3" value={createForm.email}
                        onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} placeholder="Leave blank if using phone instead" />

                      <label className="form-label small fw-semibold">Phone</label>
                      <input className="form-control mb-3" value={createForm.phone}
                        onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} placeholder="Leave blank if using email instead" />

                      <label className="form-label small fw-semibold">Role</label>
                      <select className="form-select" value={createForm.role} disabled={isAuthority}
                        onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}>
                        <option value="Citizen">{roleLabel('Citizen')}</option>
                        {isAdmin && <option value="Admin">{roleLabel('Admin')}</option>}
                        {isAdmin && <option value="Authority">{roleLabel('Authority')}</option>}
                        {isAdmin && <option value="Lawyer">{roleLabel('Lawyer')}</option>}
                      </select>
                      {isAuthority && <div className="form-text">{roleLabel('Authority')} accounts can only create {roleLabel('Citizen')} accounts.</div>}
                      <div className="form-text">A secure temporary password will be generated for you to share with them.</div>
                    </>
                  )}
                </div>
                <div className="modal-footer border-0 pt-0">
                  <button type="button" className="btn btn-pill-outline" onClick={closeCreateUser} disabled={createBusy}>
                    {createResult ? 'Close' : 'Cancel'}
                  </button>
                  {!createResult && (
                    <button type="submit" className="btn btn-gradient" disabled={createBusy}>
                      {createBusy ? 'Creating…' : 'Create User'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {profileUser && (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(15, 23, 42, 0.45)' }} onMouseDown={(e) => e.target === e.currentTarget && setProfileUser(null)}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">{profileUser.name}</h5>
                <button type="button" className="btn-close" onClick={() => setProfileUser(null)}></button>
              </div>
              <div className="modal-body">
                <div className="d-flex align-items-center gap-2 mb-3">
                  {isAdmin ? (
                    <select className="form-select form-select-sm" style={{ width: 'auto' }}
                      value={profileUser.role} onChange={e => changeRole(profileUser._id, e.target.value)}>
                      <option value="Citizen">{roleLabel('Citizen')}</option>
                      <option value="Admin">{roleLabel('Admin')}</option>
                      <option value="Authority">{roleLabel('Authority')}</option>
                      <option value="Lawyer">{roleLabel('Lawyer')}</option>
                    </select>
                  ) : (
                    <span className="badge-solid-gradient">{roleLabel(profileUser.role)}</span>
                  )}
                  {profileUser.isDisabled && <span className="badge text-bg-secondary">Disabled</span>}
                </div>
                {isAdmin && profileUser.role === 'Authority' && (
                  <div className="form-check mb-2">
                    <input className="form-check-input" type="checkbox" id="profile-create-citizens"
                      checked={!!profileUser.canCreateCitizens} onChange={() => toggleCanCreateCitizens(profileUser)} />
                    <label className="form-check-label small" htmlFor="profile-create-citizens">
                      Can create {roleLabel('Citizen')} profiles
                    </label>
                  </div>
                )}
                {isAdmin && profileUser.role === 'Authority' && (
                  <div className="form-check mb-3">
                    <input className="form-check-input" type="checkbox" id="profile-home-feed-access"
                      checked={!!profileUser.canAccessHomeFeed} onChange={() => toggleCanAccessHomeFeed(profileUser)} />
                    <label className="form-check-label small" htmlFor="profile-home-feed-access">
                      Can view Home/Feed pages
                    </label>
                  </div>
                )}
                {editError && <div className="alert alert-danger py-1 px-2 small">{editError}</div>}
                <dl className="row small mb-4">
                  <dt className="col-4 text-muted fw-normal">User ID</dt>
                  <dd className="col-8">
                    {editingField === 'userId' ? (
                      <div className="d-flex gap-1">
                        <input className="form-control form-control-sm" value={editValue}
                          onChange={e => setEditValue(e.target.value)} disabled={editBusy} autoFocus />
                        <button type="button" className="btn btn-sm btn-gradient" onClick={() => saveEditField(profileUser)} disabled={editBusy}>
                          {editBusy ? '…' : 'Save'}
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditingField(null)} disabled={editBusy}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className="d-flex align-items-center gap-2">
                        {profileUser.userId || '—'}
                        {canManageTarget(profileUser) && (
                          <button type="button" className="btn btn-link btn-sm p-0" title="Edit User ID"
                            onClick={() => startEditField('userId', profileUser.userId)}>
                            <i className="bi bi-pencil"></i>
                          </button>
                        )}
                      </span>
                    )}
                  </dd>
                  {profileUser.email && (
                    <>
                      <dt className="col-4 text-muted fw-normal">Email</dt>
                      <dd className="col-8">{profileUser.email}</dd>
                    </>
                  )}
                  <dt className="col-4 text-muted fw-normal">Phone</dt>
                  <dd className="col-8">
                    {editingField === 'phone' ? (
                      <div className="d-flex gap-1">
                        <input className="form-control form-control-sm" value={editValue} placeholder="+91XXXXXXXXXX"
                          onChange={e => setEditValue(e.target.value)} disabled={editBusy} autoFocus />
                        <button type="button" className="btn btn-sm btn-gradient" onClick={() => saveEditField(profileUser)} disabled={editBusy}>
                          {editBusy ? '…' : 'Save'}
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditingField(null)} disabled={editBusy}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <span className="d-flex align-items-center gap-2">
                        {profileUser.phone || '—'}
                        {canManageTarget(profileUser) && (
                          <button type="button" className="btn btn-link btn-sm p-0" title="Edit phone number"
                            onClick={() => startEditField('phone', profileUser.phone)}>
                            <i className="bi bi-pencil"></i>
                          </button>
                        )}
                      </span>
                    )}
                  </dd>
                  <dt className="col-4 text-muted fw-normal">Joined</dt>
                  <dd className="col-8">{formatDateTime(profileUser.createdAt)}</dd>
                </dl>
                <h6 className="fw-semibold mb-2">Submissions</h6>
                {(() => {
                  const s = statsFor(profileUser);
                  return (
                    <div className="row g-2 text-center">
                      <div className="col-4">
                        <button type="button" className="card p-2 w-100 border-0 bg-white" onClick={() => goToReporterFeed(profileUser)}>
                          <div className="fs-4 fw-bold">{s.total}</div><div className="text-muted small">Posted</div>
                        </button>
                      </div>
                      <div className="col-4">
                        <button type="button" className="card p-2 w-100 border-0 bg-white" onClick={() => goToReporterFeed(profileUser, 'Approved')}>
                          <div className="fs-4 fw-bold text-success">{s.approved}</div><div className="text-muted small">Approved</div>
                        </button>
                      </div>
                      <div className="col-4">
                        <button type="button" className="card p-2 w-100 border-0 bg-white" onClick={() => goToReporterFeed(profileUser, 'Rejected')}>
                          <div className="fs-4 fw-bold text-danger">{s.rejected}</div><div className="text-muted small">Rejected</div>
                        </button>
                      </div>
                      <div className="col-4">
                        <button type="button" className="card p-2 w-100 border-0 bg-white" onClick={() => goToReporterFeed(profileUser, 'Pending')}>
                          <div className="fs-4 fw-bold text-warning">{s.pending}</div><div className="text-muted small">Pending</div>
                        </button>
                      </div>
                      <div className="col-4">
                        <button type="button" className="card p-2 w-100 border-0 bg-white" onClick={() => goToReporterFeed(profileUser, '', 'Resolved')}>
                          <div className="fs-4 fw-bold">{s.resolved}</div><div className="text-muted small">Resolved</div>
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="modal-footer border-0 pt-0">
                <button type="button" className="btn btn-pill-outline" onClick={() => setProfileUser(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
