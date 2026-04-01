export default function Done({ result, onReset }) {
  const { quarantined, quarantine_path, moved, errors, summary } = result

  return (
    <div>
      <div style={{ marginBottom: '28px', textAlign: 'center' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'var(--success-dim)', border: '1px solid rgba(16,185,129,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: '22px',
        }}>✓</div>
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          Sync complete
        </h2>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1px', background: 'var(--border)',
        borderRadius: '10px', overflow: 'hidden',
        border: '1px solid var(--border)', marginBottom: '20px',
      }}>
        {[
          { value: summary.quarantined_count, label: 'Quarantined', color: 'var(--danger)' },
          { value: summary.kept_count, label: 'Kept in A', color: 'var(--accent)' },
          { value: summary.moved_count, label: 'Added to A', color: 'var(--success)' },
          { value: summary.error_count, label: 'Errors', color: summary.error_count > 0 ? 'var(--amber)' : 'var(--text-dim)' },
        ].map(s => (
          <div key={s.label} style={{ padding: '18px 16px', background: 'var(--surface)', textAlign: 'center' }}>
            <div style={{ fontSize: '26px', fontFamily: 'Syne', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px', fontFamily: 'IBM Plex Mono' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {summary.quarantined_count > 0 && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          marginBottom: '12px',
          fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono',
        }}>
          Quarantine: <span style={{ color: 'var(--text)' }}>{quarantine_path}</span>
        </div>
      )}

      {moved.length > 0 && (
        <CollapsibleList title={`${moved.length} file${moved.length > 1 ? 's' : ''} added`} color="var(--accent)" borderColor="rgba(34,211,238,0.2)" dimColor="var(--accent-dim)">
          {moved.map((m, i) => (
            <div key={i} style={{ padding: '9px 20px', borderTop: '1px solid var(--border)', fontFamily: 'IBM Plex Mono', fontSize: '12px' }}>
              {m.original !== m.renamed_to ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-dim)', textDecoration: 'line-through' }}>{m.original}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>→</span>
                  <span style={{ color: 'var(--accent)' }}>{m.renamed_to}</span>
                </div>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>{m.original}</span>
              )}
            </div>
          ))}
        </CollapsibleList>
      )}

      {errors.length > 0 && (
        <CollapsibleList title={`${errors.length} error${errors.length > 1 ? 's' : ''}`} color="var(--amber)" borderColor="rgba(245,158,11,0.2)" dimColor="var(--amber-dim)">
          {errors.map((e, i) => (
            <div key={i} style={{ padding: '9px 20px', borderTop: '1px solid var(--border)', fontFamily: 'IBM Plex Mono', fontSize: '12px' }}>
              <span style={{ color: 'var(--text)' }}>{e.file}</span>
              <span style={{ color: 'var(--text-muted)' }}>: {e.error}</span>
            </div>
          ))}
        </CollapsibleList>
      )}

      <button
        onClick={onReset}
        style={{
          marginTop: '16px', width: '100%', padding: '14px', borderRadius: '8px',
          background: 'transparent', color: 'var(--text-muted)',
          border: '1px solid var(--border-bright)', cursor: 'pointer',
          fontSize: '14px', fontFamily: 'IBM Plex Sans',
        }}
      >
        Start over
      </button>
    </div>
  )
}

function CollapsibleList({ title, color, borderColor, dimColor, children }) {
  return (
    <details style={{ border: `1px solid ${borderColor}`, borderRadius: '10px', background: dimColor, overflow: 'hidden', marginBottom: '12px' }}>
      <summary style={{
        padding: '14px 20px', cursor: 'pointer', listStyle: 'none',
        fontSize: '14px', fontWeight: 600, color: 'white', fontFamily: 'Syne',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }} />
        {title}
      </summary>
      <div style={{ maxHeight: '240px', overflowY: 'auto' }}>{children}</div>
    </details>
  )
}
