import type { ManifestDiff } from '../types';

interface Props {
  diffs: ManifestDiff[];
}

export default function ManifestDiffView({ diffs }: Props) {
  if (!diffs || diffs.length === 0) {
    return <div className="text-sm text-tertiary" style={{ fontStyle: 'italic' }}>No differences detected.</div>;
  }

  return (
    <div className="manifest-diff">
      {diffs.map((diff, idx) => (
        <div key={idx} className="diff-entry" data-type={diff.type}>
          <div className="diff-path">
            <span className={`diff-badge diff-badge-${diff.type}`}>
              {diff.type === 'added' ? '+' : diff.type === 'removed' ? '−' : '~'}
            </span>
            <code>{diff.path || '(root)'}</code>
          </div>

          <div className="diff-values">
            {(diff.type === 'changed' || diff.type === 'removed') && diff.previous !== undefined && (
              <div className="diff-line diff-line-removed">
                <span className="diff-prefix">−</span>
                <span>{formatValue(diff.previous)}</span>
              </div>
            )}
            {(diff.type === 'changed' || diff.type === 'added') && diff.current !== undefined && (
              <div className="diff-line diff-line-added">
                <span className="diff-prefix">+</span>
                <span>{formatValue(diff.current)}</span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatValue(val: unknown): string {
  if (typeof val === 'string') return `"${val}"`;
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val);
}
