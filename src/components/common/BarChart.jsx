import { hueFor } from './IssuePlaceholder';

// A lightweight horizontal bar chart — no charting library, just divs. Bar
// color is derived from the label's own hue (matching the category
// placeholder images and chips elsewhere) for a cohesive look.
export default function BarChart({ data, valueKey = 'count', labelKey = 'label' }) {
  const max = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
  return (
    <div className="bar-chart">
      {data.map((d, i) => (
        <div key={i} className="bar-chart-row">
          <div className="bar-chart-label" title={d[labelKey]}>{d[labelKey] || 'Uncategorized'}</div>
          <div className="bar-chart-track">
            <div
              className="bar-chart-fill"
              style={{ width: `${(Number(d[valueKey]) / max) * 100}%`, '--bar-hue': hueFor(d[labelKey] || 'Other') }}
            ></div>
          </div>
          <div className="bar-chart-value">{d[valueKey]}</div>
        </div>
      ))}
    </div>
  );
}
