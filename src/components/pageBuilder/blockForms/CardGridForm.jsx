import { useState } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const COL_CLASS_PRESETS = [
  { value: 'col-md-3', label: '4 per row (desktop)' },
  { value: 'col-md-4 col-lg', label: '3 per row (desktop)' },
  { value: 'col-6 col-md-4 col-lg-2', label: '6 per row (desktop), 2 on mobile' }
];

// Cards themselves have no id (they're a plain array inside one block's
// config, not their own PageBlock documents) — dnd-kit needs a stable key to
// track a dragged item across reorders, so each card gets one made up
// client-side only for this form's lifetime; stripped again before saving.
let keySeq = 0;
const withKey = (item) => ({ ...item, _key: item._key ?? `card-${++keySeq}` });

function SortableCardItem({ item, index, canRemove, onUpdate, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item._key });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="border rounded-3 p-2 mb-2 bg-body">
      <div className="d-flex gap-2 mb-2 align-items-center">
        <button type="button" className="btn btn-sm btn-light border-0 flex-shrink-0" {...attributes} {...listeners} title="Drag to reorder">
          <i className="bi bi-grip-vertical"></i>
        </button>
        <input
          className="form-control form-control-sm" placeholder="Icon (e.g. bi-geo-alt-fill, optional)"
          value={item.icon} onChange={e => onUpdate(index, 'icon', e.target.value)}
        />
        {canRemove && (
          <button type="button" className="btn btn-sm btn-outline-danger flex-shrink-0" onClick={() => onRemove(index)}>
            <i className="bi bi-trash3"></i>
          </button>
        )}
      </div>
      <input
        className="form-control form-control-sm mb-2" placeholder="Title"
        value={item.title} onChange={e => onUpdate(index, 'title', e.target.value)}
      />
      <textarea
        className="form-control form-control-sm" rows={2} placeholder="Text"
        value={item.text} onChange={e => onUpdate(index, 'text', e.target.value)}
      />
    </div>
  );
}

export default function CardGridForm({ config, onSave, onCancel, saving }) {
  const [heading, setHeading] = useState(config.heading || '');
  const [colClass, setColClass] = useState(config.colClass || COL_CLASS_PRESETS[0].value);
  const [items, setItems] = useState(
    (config.items?.length ? config.items : [{ icon: '', title: '', text: '' }]).map(withKey)
  );

  const updateItem = (i, field, value) => setItems(list => list.map((it, idx) => idx === i ? { ...it, [field]: value } : it));
  const removeItem = (i) => setItems(list => list.filter((_, idx) => idx !== i));
  const addItem = () => setItems(list => [...list, withKey({ icon: '', title: '', text: '' })]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems(list => {
      const oldIndex = list.findIndex(it => it._key === active.id);
      const newIndex = list.findIndex(it => it._key === over.id);
      return arrayMove(list, oldIndex, newIndex);
    });
  };

  const canSave = colClass.trim() && items.some(it => it.title.trim() && it.text.trim());

  return (
    <div className="p-2">
      <div className="mb-2">
        <label className="form-label small mb-1">Section heading (optional)</label>
        <input className="form-control form-control-sm" value={heading} onChange={e => setHeading(e.target.value)} />
      </div>
      <div className="mb-3">
        <label className="form-label small mb-1">Cards per row</label>
        <select className="form-select form-select-sm" value={colClass} onChange={e => setColClass(e.target.value)}>
          {COL_CLASS_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map(it => it._key)} strategy={verticalListSortingStrategy}>
          {items.map((item, i) => (
            <SortableCardItem
              key={item._key}
              item={item}
              index={i}
              canRemove={items.length > 1}
              onUpdate={updateItem}
              onRemove={removeItem}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button type="button" className="btn btn-sm btn-outline-secondary mb-3" onClick={addItem}>+ Add card</button>

      <div className="d-flex gap-2">
        <button
          type="button" className="btn btn-sm btn-gradient" disabled={saving || !canSave}
          onClick={() => onSave({
            heading, colClass,
            items: items.filter(it => it.title.trim() && it.text.trim()).map(({ _key, ...rest }) => rest)
          })}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
