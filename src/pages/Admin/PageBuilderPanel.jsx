import { useEffect, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { PAGE_GROUPS, TYPE_LABELS, allowedTypesFor } from '../../components/pageBuilder/PAGE_REGIONS';
import CustomPagesPanel from './CustomPagesPanel';
import BlockRenderer from '../../components/pageBuilder/BlockRenderer';
import HeadingForm from '../../components/pageBuilder/blockForms/HeadingForm';
import RichTextForm from '../../components/pageBuilder/blockForms/RichTextForm';
import ImageForm from '../../components/pageBuilder/blockForms/ImageForm';
import ButtonForm from '../../components/pageBuilder/blockForms/ButtonForm';
import CardGridForm from '../../components/pageBuilder/blockForms/CardGridForm';
import SpacerForm from '../../components/pageBuilder/blockForms/SpacerForm';
import LinkForm from '../../components/pageBuilder/blockForms/LinkForm';
import ToggleForm from '../../components/pageBuilder/blockForms/ToggleForm';

const BLOCK_FORMS = {
  heading: HeadingForm, richtext: RichTextForm, image: ImageForm, button: ButtonForm,
  cardgrid: CardGridForm, spacer: SpacerForm, link: LinkForm, toggle: ToggleForm
};

const DEFAULT_CONFIG = {
  heading: { eyebrow: '', text: '', level: 'h2' },
  richtext: { paragraphs: [''] },
  image: { url: '', alt: '', shape: 'square', size: 200 },
  button: { text: '', href: '', style: 'gradient', external: false },
  cardgrid: { heading: '', colClass: 'col-md-3', items: [{ icon: '', title: '', text: '' }] },
  spacer: { height: 40 },
  link: { label: '', href: '', requiresAuth: false },
  toggle: { key: 'search', label: '' }
};

function previewFor(block) {
  const c = block.config || {};
  switch (block.type) {
    case 'heading': return c.text;
    case 'richtext': return (c.paragraphs?.[0] || '').slice(0, 70);
    case 'image': return c.alt || '(no alt text)';
    case 'button': return `"${c.text}" → ${c.href}`;
    case 'cardgrid': return `${c.items?.length || 0} card${c.items?.length === 1 ? '' : 's'}${c.heading ? ` — ${c.heading}` : ''}`;
    case 'spacer': return `${c.height}px`;
    case 'link': return `"${c.label}" → ${c.href}`;
    case 'toggle': return c.label;
    default: return '';
  }
}

// Compact "edit mode" row — type badge + short text preview + controls.
// Every block gets its own lock toggle (not just the ones seeded locked,
// e.g. Footer's Legal links) — locked hides the delete button until
// unlocked again; deleting an unlocked block still asks for confirmation.
function SortableBlockRow({ block, page, editing, onEdit, onCancelEdit, onSave, onToggleVisible, onToggleLocked, onDelete, onPreview, saving }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const Form = BLOCK_FORMS[block.type];
  // Home's layout toggles represent live-data sections (Real impact, Latest
  // Issues, etc.) that this panel has no form for — there's nothing to edit,
  // just an order/visibility switch — so "how does it look" can only be
  // answered by the actual live page.
  const canPreview = page === 'home-layout' && block.type === 'toggle';

  return (
    <div ref={setNodeRef} style={style} className="border rounded-4 p-2 mb-2 bg-body">
      <div className="d-flex align-items-center gap-2">
        <button type="button" className="btn btn-sm btn-light border-0" {...attributes} {...listeners} title="Drag to reorder">
          <i className="bi bi-grip-vertical"></i>
        </button>
        <span className="badge bg-secondary-subtle text-secondary-emphasis flex-shrink-0">{TYPE_LABELS[block.type]}</span>
        <span className="small text-truncate flex-grow-1">{previewFor(block)}</span>
        <div className="form-check form-switch mb-0 flex-shrink-0">
          <input
            className="form-check-input" type="checkbox" role="switch"
            checked={block.visible} onChange={() => onToggleVisible(block)}
            title={block.visible ? 'Visible on the live site' : 'Hidden from visitors'}
          />
        </div>
        {canPreview && (
          <button type="button" className="btn btn-sm btn-outline-secondary flex-shrink-0" onClick={() => onPreview(block)} title="Preview how this section looks on the live site">
            <i className="bi bi-eye"></i>
          </button>
        )}
        <button type="button" className="btn btn-sm btn-outline-secondary flex-shrink-0" onClick={() => onEdit(block)}>Edit</button>
        <button
          type="button"
          className={`btn btn-sm flex-shrink-0 ${block.locked ? 'btn-warning' : 'btn-outline-secondary'}`}
          onClick={() => onToggleLocked(block)}
          title={block.locked ? 'Locked — click to unlock so it can be deleted' : 'Lock this block so it can\'t be deleted'}
        >
          <i className={`bi ${block.locked ? 'bi-lock-fill' : 'bi-unlock'}`}></i>
        </button>
        {!block.locked && (
          <button type="button" className="btn btn-sm btn-outline-danger flex-shrink-0" onClick={() => onDelete(block)}>
            <i className="bi bi-trash3"></i>
          </button>
        )}
      </div>
      {editing && Form && (
        <div className="mt-2 border-top pt-2">
          <Form config={block.config} saving={saving} onCancel={onCancelEdit} onSave={(config) => onSave(block, config)} />
        </div>
      )}
    </div>
  );
}

// "Preview mode" row — shows the block rendered the way it actually looks on
// the live site (same BlockRenderer used there), with just a floating drag
// handle and visibility switch overlaid — no edit/delete controls, so it
// reads as a WYSIWYG view you can rearrange rather than an edit form. A
// hidden block still shows here (dimmed, with a "Hidden" tag) so it can
// still be dragged back into place, matching what the edit-mode list shows.
function SortablePreviewRow({ block, onToggleVisible, isLinkType }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : (block.visible ? 1 : 0.4) };

  return (
    <div ref={setNodeRef} style={style} className="position-relative border rounded-4 p-3 mb-2 bg-body">
      <div className="position-absolute top-0 end-0 d-flex align-items-center gap-2 p-2" style={{ zIndex: 1 }}>
        {!block.visible && <span className="badge bg-secondary">Hidden</span>}
        <div className="form-check form-switch mb-0">
          <input
            className="form-check-input" type="checkbox" role="switch"
            checked={block.visible} onChange={() => onToggleVisible(block)}
            title={block.visible ? 'Visible on the live site' : 'Hidden from visitors'}
          />
        </div>
        <button type="button" className="btn btn-sm btn-light border" {...attributes} {...listeners} title="Drag to reorder">
          <i className="bi bi-grip-vertical"></i>
        </button>
      </div>
      <div style={{ pointerEvents: 'none' }}>
        {isLinkType
          ? <div className="small"><i className="bi bi-link-45deg me-1 text-muted"></i>{block.config.label} <span className="text-muted">→ {block.config.href}</span></div>
          : block.type === 'toggle'
            ? <div className="small text-muted fst-italic">{block.config.label} — live content, position only</div>
            : <BlockRenderer block={block} />}
      </div>
    </div>
  );
}

// Feed's chrome toggles are seeded once and never added/removed here — just
// a flat list of switches, no drag handle, no add/delete.
function FeedToggleList({ blocks, onToggleVisible }) {
  return (
    <div>
      {blocks.length === 0 && <p className="text-muted small">No toggles seeded yet for the Feed page.</p>}
      {blocks.map(b => (
        <div className="form-check form-switch mb-2" key={b._id}>
          <input
            className="form-check-input" type="checkbox" role="switch" id={`toggle-${b._id}`}
            checked={b.visible} onChange={() => onToggleVisible(b)}
          />
          <label className="form-check-label small" htmlFor={`toggle-${b._id}`}>{b.config.label}</label>
        </div>
      ))}
    </div>
  );
}

// Sits above the 'topnav-links' block list — a dedicated switch (backed by
// the GAMES_ENABLED system setting, not a PageBlock) because "hide the
// Games link" via a block's own visible switch only affects this desktop
// nav-pill row (see the file-level comment on scripts/seedPageBlocks/
// seedTopNav.js), leaving the mobile menu link and the /games page itself
// reachable. This one switch is read directly by TopNav.jsx (both desktop
// and mobile) and by the Games page/backend, so switching it off actually
// takes the whole feature down, not just this one link.
function GamesTabToggle() {
  const toast = useToast();
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/settings')
      .then(res => {
        const row = (res.data.settings || []).find(s => s.key === 'GAMES_ENABLED');
        setEnabled(row ? row.value !== 'false' : true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next); // optimistic
    setSaving(true);
    try {
      await api.put('/admin/settings', { settings: [{ key: 'GAMES_ENABLED', value: next ? 'true' : 'false' }] });
      toast(next ? 'Games tab enabled' : 'Games tab disabled');
    } catch {
      setEnabled(!next); // roll back
      toast('Failed to update', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="d-flex align-items-center justify-content-between border rounded-4 p-3 mb-3">
      <div className="pe-3">
        <div className="fw-semibold small">Games tab</div>
        <div className="text-muted small">
          Turns off the Games nav link (desktop and mobile) and blocks the Games page and Ludo
          entirely — stays off even for a direct link or bookmark, not just this list below.
        </div>
      </div>
      <div className="form-check form-switch mb-0 flex-shrink-0">
        <input
          className="form-check-input" type="checkbox" role="switch"
          checked={enabled} disabled={saving} onChange={toggle}
          title={enabled ? 'Games tab is on' : 'Games tab is off'}
        />
      </div>
    </div>
  );
}

// One self-contained section per region (e.g. "About → How It Works") —
// PageBuilderPanel renders one of these per region belonging to whichever
// page the Super Admin has selected, so every section of that page shows up
// together instead of picking one region at a time from a flat dropdown.
// `previewMode` swaps the compact edit-list rows for a WYSIWYG view (same
// drag-to-reorder underneath, just rendered as the real block would look).
// Named export so CustomPagesPanel.jsx can reuse the exact same block editor
// for a custom page's content (page: `custom-<CustomPage _id>`) instead of
// duplicating the whole drag/edit/add/delete implementation.
export function RegionEditor({ page, label, isToggles, previewMode, hideAdd, regionPreview }) {
  const toast = useToast();
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [addingType, setAddingType] = useState('');
  const [preview, setPreview] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/admin/page-blocks', { params: { page } })
      .then(res => setBlocks(res.data.blocks || []))
      .catch(() => toast('Failed to load blocks', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = blocks.findIndex(b => b._id === active.id);
    const newIndex = blocks.findIndex(b => b._id === over.id);
    const reordered = arrayMove(blocks, oldIndex, newIndex);
    setBlocks(reordered); // optimistic
    try {
      await api.patch('/admin/page-blocks/reorder', { page, orderedIds: reordered.map(b => b._id) });
    } catch {
      toast('Failed to save new order', 'error');
      load(); // roll back to server state
    }
  };

  const handleToggleVisible = async (block) => {
    setBlocks(list => list.map(b => b._id === block._id ? { ...b, visible: !b.visible } : b)); // optimistic
    try {
      await api.patch(`/admin/page-blocks/${block._id}`, { visible: !block.visible });
    } catch {
      toast('Failed to update visibility', 'error');
      load();
    }
  };

  const handleToggleLocked = async (block) => {
    setBlocks(list => list.map(b => b._id === block._id ? { ...b, locked: !b.locked } : b)); // optimistic
    try {
      await api.patch(`/admin/page-blocks/${block._id}`, { locked: !block.locked });
      toast(block.locked ? 'Unlocked — it can be deleted again' : 'Locked — it can\'t be deleted until unlocked');
    } catch {
      toast('Failed to update lock', 'error');
      load();
    }
  };

  const handleSaveEdit = async (block, config) => {
    setSaving(true);
    try {
      const res = await api.patch(`/admin/page-blocks/${block._id}`, { config });
      setBlocks(list => list.map(b => b._id === block._id ? res.data.block : b));
      setEditingId(null);
      toast('Block saved');
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save block', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (block) => {
    if (!confirm('Delete this block? This can\'t be undone.')) return;
    try {
      await api.delete(`/admin/page-blocks/${block._id}`);
      setBlocks(list => list.filter(b => b._id !== block._id));
      toast('Block deleted');
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to delete block', 'error');
    }
  };

  const handleAdd = async (config) => {
    setSaving(true);
    try {
      const res = await api.post('/admin/page-blocks', { page, type: addingType, config, visible: true });
      setBlocks(list => [...list, res.data.block]);
      setAddingType('');
      toast('Block added');
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to add block', 'error');
    } finally {
      setSaving(false);
    }
  };

  const AddForm = BLOCK_FORMS[addingType];
  const isLinkType = allowedTypesFor(page)?.includes('link');

  return (
    <div className="border rounded-4 p-3 mb-3">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h6 className="fw-semibold mb-0">{label}</h6>
        {regionPreview && (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setPreview({ label, src: `${regionPreview.path}?preview=1#${regionPreview.anchor}` })}
            title="Preview how this section looks on the live site"
          >
            <i className="bi bi-eye me-1"></i>Preview
          </button>
        )}
      </div>

      {page === 'topnav-links' && <GamesTabToggle />}

      {loading && <p className="text-muted small mb-0">Loading…</p>}

      {!loading && isToggles && (
        <FeedToggleList blocks={blocks} onToggleVisible={handleToggleVisible} />
      )}

      {!loading && !isToggles && (
        <>
          {blocks.length === 0 && <p className="text-muted small">No blocks yet — add one below.</p>}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={blocks.map(b => b._id)} strategy={verticalListSortingStrategy}>
              {blocks.map(block => previewMode ? (
                <SortablePreviewRow
                  key={block._id}
                  block={block}
                  isLinkType={isLinkType}
                  onToggleVisible={handleToggleVisible}
                />
              ) : (
                <SortableBlockRow
                  key={block._id}
                  block={block}
                  page={page}
                  editing={editingId === block._id}
                  saving={saving}
                  onEdit={(b) => setEditingId(b._id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSave={handleSaveEdit}
                  onToggleVisible={handleToggleVisible}
                  onToggleLocked={handleToggleLocked}
                  onDelete={handleDelete}
                  onPreview={(block) => setPreview({ label: block.config.label, src: `/?preview=1#section-${block.config.key}` })}
                />
              ))}
            </SortableContext>
          </DndContext>

          {!previewMode && !hideAdd && (
            <div className="mt-2 border-top pt-2">
              {!addingType ? (
                <div className="d-flex gap-2 flex-wrap">
                  {(allowedTypesFor(page) || []).map(type => (
                    <button key={type} type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setAddingType(type)}>
                      + {TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
              ) : AddForm && (
                <div className="border rounded-4 p-2">
                  <div className="small fw-semibold mb-2">New {TYPE_LABELS[addingType]} block</div>
                  <AddForm config={DEFAULT_CONFIG[addingType]} saving={saving} onCancel={() => setAddingType('')} onSave={handleAdd} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      {preview && (
        <SectionPreviewModal label={preview.label} src={preview.src} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}

// Embeds the live page in an iframe, scrolled straight to the section being
// previewed — same tab, no new window to lose track of. `?preview=1` tells
// Home.jsx to skip its usual Admin/Authority redirect and to render the
// section as a citizen would see it (see effectiveIsStaff in Home.jsx); the
// section itself gets an embossed outline + badge for as long as the iframe
// is open (src/hooks/useSectionPreview.js), so it's obvious which one this
// is even when several sections share a similar layout.
function SectionPreviewModal({ label, src, onClose }) {
  return (
    <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(15, 23, 42, 0.45)' }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header border-0 pb-0">
            <h5 className="fw-bold mb-0"><i className="bi bi-eye me-2"></i>Preview — {label}</h5>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>
          <div className="modal-body pt-2">
            <iframe
              title={`Preview: ${label}`}
              src={src}
              style={{ width: '100%', height: '75vh', border: '1px solid #E2E8F0', borderRadius: '10px' }}
            />
          </div>
          <div className="modal-footer border-0 pt-0">
            <button type="button" className="btn btn-pill-outline" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// One page's regions, rendered together under a collapsible <summary> — used
// by the "group by page" view so every page's sections can be seen (and
// expanded) at once instead of switching tabs one page at a time. Native
// <details> rather than custom open/close state: free keyboard/ARIA support,
// and each page's RegionEditors only fetch their blocks once actually
// expanded (open groups start expanded on first render, matching whichever
// page was last selected in tab view, so nothing is lost switching modes).
function PageGroup({ group, defaultOpen, previewMode }) {
  return (
    <details className="border rounded-4 mb-3" open={defaultOpen}>
      <summary className="fw-semibold p-3" style={{ cursor: 'pointer' }}>{group.label}</summary>
      <div className="px-3 pb-3">
        {group.special === 'custom-pages' ? <CustomPagesPanel /> : group.regions.map(region => (
          <RegionEditor
            key={region.value}
            page={region.value}
            label={region.label}
            isToggles={!!region.isToggles}
            hideAdd={!!region.hideAdd}
            previewMode={previewMode}
            regionPreview={region.preview}
          />
        ))}
      </div>
    </details>
  );
}

export default function PageBuilderPanel() {
  const [groupLabel, setGroupLabel] = useState(PAGE_GROUPS[0].label);
  const [previewMode, setPreviewMode] = useState(false);
  // Tab view (default) fetches one page's regions at a time — cheapest,
  // fine for focused editing. Grouped view trades that for seeing every
  // page's sections together, each collapsible so the whole panel doesn't
  // turn into one giant scroll of every region on the site at once.
  const [groupedView, setGroupedView] = useState(false);
  const currentGroup = PAGE_GROUPS.find(g => g.label === groupLabel) || PAGE_GROUPS[0];

  return (
    <div className="card p-3">
      <h6 className="fw-semibold mb-1">Page Builder</h6>
      <p className="text-muted small mb-3">
        Pick a page below to see every section of it together, or switch to <strong>Group by page</strong> to
        see and expand every page at once. Use <strong>Preview</strong> to see and drag things around as
        they actually look on the site; switch back to add, edit, or delete blocks.
      </p>

      <div className="d-flex gap-2 flex-wrap align-items-center mb-3">
        {!groupedView && PAGE_GROUPS.map(group => (
          <button
            key={group.label}
            type="button"
            className={`btn btn-sm ${groupLabel === group.label ? 'btn-gradient' : 'btn-outline-secondary'}`}
            onClick={() => setGroupLabel(group.label)}
          >
            {group.label}
          </button>
        ))}
        <button
          type="button"
          className={`btn btn-sm ${groupedView ? 'btn-gradient' : 'btn-outline-secondary'}`}
          onClick={() => setGroupedView(v => !v)}
          title={groupedView ? 'Switch back to one page at a time' : 'See every page\'s sections at once, grouped and collapsible'}
        >
          <i className="bi bi-collection me-1"></i>
          {groupedView ? 'Grouped — click for tabs' : 'Group by page'}
        </button>
        <button
          type="button"
          className={`btn btn-sm ms-auto flex-shrink-0 ${previewMode ? 'btn-gradient' : 'btn-outline-secondary'}`}
          onClick={() => setPreviewMode(m => !m)}
          title={previewMode ? 'Switch back to editing' : 'Preview and drag as it looks live'}
        >
          <i className={`bi ${previewMode ? 'bi-eye-fill' : 'bi-eye'} me-1`}></i>
          {previewMode ? 'Previewing — click to edit' : 'Preview'}
        </button>
      </div>

      {groupedView ? (
        PAGE_GROUPS.map(group => (
          <PageGroup key={group.label} group={group} defaultOpen={group.label === groupLabel} previewMode={previewMode} />
        ))
      ) : currentGroup.special === 'custom-pages' ? (
        <CustomPagesPanel />
      ) : (
        currentGroup.regions.map(region => (
          <RegionEditor
            key={region.value}
            page={region.value}
            label={region.label}
            isToggles={!!region.isToggles}
            hideAdd={!!region.hideAdd}
            previewMode={previewMode}
            regionPreview={region.preview}
          />
        ))
      )}
    </div>
  );
}
