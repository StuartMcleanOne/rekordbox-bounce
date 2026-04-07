import { useState } from 'react'

export default function Done({ result, folderA, onReset }) {
  const { quarantined, quarantine_path, per_folder, summary } = result
  const [undoState, setUndoState] = useState('idle') // idle | loading | done | error
  const [undoError, setUndoError] = useState(null)

  const handleUndo = async () => {
    setUndoState('loading')
    setUndoError(null)
    try {
      const res = await fetch('/api/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder_a: folderA,
          quarantine_path,
          quarantined,
          per_folder: per_folder.map(pf => ({
            folder_b: pf.folder_b,
            moved: pf.moved,
            playlist_path: pf.playlist_path,
          })),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Undo failed')
      }
      setUndoState('done')
    } catch (err) {
      setUndoError(err.message)
      setUndoState('error')
    }
  }

  if (undoState === 'done') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'var(--danger-dim)', border: '1px solid rgba(244,63,94,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: '22px',
        }}>↩</div>
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          Undo complete
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>
          Files have been moved back. Your library is as it was.
        </p>
        <button onClick={onReset} style={resetBtn}>Start over</button>
      </div>
    )
  }

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
          { value: summary.total_moved_count, label: 'Added to A', color: 'var(--success)' },
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
          marginBottom: '12px', fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono',
        }}>
          Quarantine: <span style={{ color: 'var(--text)' }}>{quarantine_path}</span>
        </div>
      )}

      {/* Per-folder results */}
      {per_folder.map((pf, i) => (
        <div key={i}>
          {pf.moved.length > 0 && (
            <CollapsibleList
              title={`${pf.moved.length} file${pf.moved.length > 1 ? 's' : ''} added from ${pf.folder_b_name}`}
              color="var(--accent)" borderColor="rgba(34,211,238,0.2)" dimColor="var(--accent-dim)"
            >
              {pf.playlist_path && (
                <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                  Playlist: <span style={{ color: 'var(--accent)' }}>{pf.playlist_path}</span>
                </div>
              )}
              {pf.moved.map((f, j) => (
                <div key={j} style={{ padding: '9px 20px', borderTop: '1px solid var(--border)', fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {f}
                </div>
              ))}
            </CollapsibleList>
          )}

          {pf.errors.length > 0 && (
            <CollapsibleList
              title={`${pf.errors.length} error${pf.errors.length > 1 ? 's' : ''} in ${pf.folder_b_name}`}
              color="var(--amber)" borderColor="rgba(245,158,11,0.2)" dimColor="var(--amber-dim)"
            >
              {pf.errors.map((e, j) => (
                <div key={j} style={{ padding: '9px 20px', borderTop: '1px solid var(--border)', fontFamily: 'IBM Plex Mono', fontSize: '12px' }}>
                  <span style={{ color: 'var(--text)' }}>{e.file}</span>
                  <span style={{ color: 'var(--text-muted)' }}>: {e.error}</span>
                </div>
              ))}
            </CollapsibleList>
          )}
        </div>
      ))}

      {undoError && (
        <div style={{
          marginBottom: '12px', padding: '14px 16px',
          background: 'var(--danger-dim)', border: '1px solid rgba(244,63,94,0.2)',
          borderRadius: '8px', color: 'var(--danger)', fontSize: '13px', fontFamily: 'IBM Plex Mono',
        }}>
          {undoError}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button
          onClick={handleUndo}
          disabled={undoState === 'loading'}
          style={{
            padding: '14px 20px', borderRadius: '8px',
            background: 'transparent',
            color: undoState === 'loading' ? 'var(--text-dim)' : 'var(--danger)',
            border: `1px solid ${undoState === 'loading' ? 'var(--border)' : 'rgba(244,63,94,0.4)'}`,
            cursor: undoState === 'loading' ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontFamily: 'IBM Plex Sans',
            transition: 'all 0.15s',
          }}
        >
          {undoState === 'loading' ? 'Undoing...' : '↩ Undo'}
        </button>
        <button onClick={onReset} style={{ ...resetBtn, flex: 1 }}>
          Start over
        </button>
      </div>
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

const resetBtn = {
  padding: '14px', borderRadius: '8px',
  background: 'transparent', color: 'var(--text-muted)',
  border: '1px solid var(--border-bright)', cursor: 'pointer',
  fontSize: '14px', fontFamily: 'IBM Plex Sans',
}
