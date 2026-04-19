import { useState, useEffect } from 'react'

const openPath = (path) =>
  fetch(`/api/open-path?path=${encodeURIComponent(path)}`).catch(() => {})

export default function Done({ result, folderA, mode, preview, onReset }) {
  const [undoState, setUndoState] = useState('idle')
  const [undoError, setUndoError] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => {
    fetch('/api/log').then(r => r.json()).then(setHistory).catch(() => {})
  }, [])

  const handleUndo = async () => {
    setUndoState('loading')
    setUndoError(null)
    try {
      const { quarantined, quarantine_path, per_folder } = result
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
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--danger-dim)', border: '1px solid rgba(204,112,81,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '22px' }}>↩</div>
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px', marginBottom: '8px' }}>Undo complete</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>Files have been moved back. Your library is as it was.</p>
        <button onClick={onReset} style={resetBtn}>Start over</button>
      </div>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: '28px', textAlign: 'center' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--success-dim)', border: '1px solid rgba(158,138,110,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '22px' }}>✓</div>
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          {mode === 'sort' ? 'Sort complete' : mode === 'merge' ? 'Merge complete' : 'Sync complete'}
        </h2>
      </div>

      {/* SORT results */}
      {mode === 'sort' && (
        <>
          <StatsBar stats={[
            { value: result.summary.total_new, label: 'Moved to New/', color: 'var(--accent)' },
            { value: result.summary.total_duplicate, label: 'Moved to Duplicate/', color: 'var(--text-muted)' },
            { value: result.summary.kept_in_library_count, label: 'Kept in Library', color: 'var(--success)' },
            { value: result.summary.error_count, label: 'Errors', color: result.summary.error_count > 0 ? 'var(--amber)' : 'var(--text-dim)' },
          ]} />
          {result.per_folder.map((pf, i) => (
            <div key={i}>
              {pf.moved_new.length > 0 && (
                <CollapsibleList title={`${pf.moved_new.length} files in ${pf.folder_b_name}_New/`} color="var(--accent)" borderColor="var(--accent-glow)" dimColor="var(--accent-dim)">
                  <PathRow path={pf.new_folder} onOpen={() => openPath(pf.new_folder)} />
                  {pf.playlist_path && <PlaylistRow path={pf.playlist_path} />}
                  {pf.moved_new.map((f, j) => <FileRow key={j} name={f} />)}
                </CollapsibleList>
              )}
              {pf.moved_duplicate.length > 0 && (
                <CollapsibleList title={`${pf.moved_duplicate.length} files in ${pf.folder_b_name}_Duplicate/`} color="var(--text-muted)" borderColor="var(--border)" dimColor="var(--surface)">
                  <PathRow path={pf.duplicate_folder} onOpen={() => openPath(pf.duplicate_folder)} />
                  {pf.moved_duplicate.map((f, j) => <FileRow key={j} name={f} />)}
                </CollapsibleList>
              )}
              {pf.errors.length > 0 && <ErrorList errors={pf.errors} sourceName={pf.folder_b_name} />}
            </div>
          ))}
          <LibrarySafeNotice count={result.summary.kept_in_library_count} />
        </>
      )}

      {/* MERGE results */}
      {mode === 'merge' && (
        <>
          <StatsBar stats={[
            { value: result.summary.total_moved_count, label: 'Added to Library', color: 'var(--success)' },
            { value: (preview?.per_folder || []).reduce((s, pf) => s + (pf.duplicate_files || []).length, 0), label: 'Duplicates found', color: 'var(--text-muted)' },
            { value: result.summary.error_count, label: 'Errors', color: result.summary.error_count > 0 ? 'var(--amber)' : 'var(--text-dim)' },
          ]} />
          {result.per_folder.map((pf, i) => {
            const previewPf = (preview?.per_folder || [])[i] || {}
            const duplicates = previewPf.duplicate_files || []
            return (
              <div key={i}>
                {pf.moved.length > 0 && (
                  <CollapsibleList title={`${pf.moved.length} added from ${pf.folder_b_name}`} color="var(--accent)" borderColor="var(--accent-glow)" dimColor="var(--accent-dim)">
                    {pf.playlist_path && <PlaylistRow path={pf.playlist_path} />}
                    {pf.moved.map((f, j) => <FileRow key={j} name={f} />)}
                  </CollapsibleList>
                )}
                {duplicates.length > 0 && (
                  <CollapsibleList title={`${duplicates.length} duplicates found in ${pf.folder_b_name}`} color="var(--text-muted)" borderColor="var(--border)" dimColor="var(--surface)">
                    <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>These files are already in your Library and were left in place.</div>
                    {duplicates.map((f, j) => <FileRow key={j} name={f} />)}
                  </CollapsibleList>
                )}
                {pf.errors.length > 0 && <ErrorList errors={pf.errors} sourceName={pf.folder_b_name} />}
              </div>
            )
          })}
          {result.summary.kept_in_library_count > 0 && (
            <CollapsibleList title={`${result.summary.kept_in_library_count} files kept in Library — cue points safe`} color="var(--success)" borderColor="rgba(158,138,110,0.2)" dimColor="var(--success-dim)">
              <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                These files were not moved or overwritten.
              </div>
            </CollapsibleList>
          )}
        </>
      )}

      {/* BOUNCE results */}
      {mode === 'bounce' && (
        <>
          <StatsBar stats={[
            { value: result.summary.quarantined_count, label: 'Quarantined', color: 'var(--danger)' },
            { value: result.summary.kept_count, label: 'Kept in Library', color: 'var(--accent)' },
            { value: result.summary.total_moved_count, label: 'Added to Library', color: 'var(--success)' },
            { value: result.summary.error_count, label: 'Errors', color: result.summary.error_count > 0 ? 'var(--amber)' : 'var(--text-dim)' },
          ]} />
          {result.summary.quarantined_count > 0 && (
            <CollapsibleList title={`${result.summary.quarantined_count} files quarantined`} color="var(--danger)" borderColor="rgba(204,112,81,0.25)" dimColor="var(--danger-dim)">
              <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{result.quarantine_path}</span>
                <button onClick={() => openPath(result.quarantine_path)} style={openBtnStyle}>Open Folder</button>
              </div>
              {result.quarantined.map((f, j) => <FileRow key={j} name={f} />)}
            </CollapsibleList>
          )}
          {result.summary.kept_in_library_count > 0 && (
            <CollapsibleList title={`${result.summary.kept_in_library_count} files kept in Library — cue points safe`} color="var(--success)" borderColor="rgba(158,138,110,0.2)" dimColor="var(--success-dim)">
              <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
                These files were not moved or overwritten.
              </div>
            </CollapsibleList>
          )}
          {result.per_folder.map((pf, i) => (
            <div key={i}>
              {pf.moved.length > 0 && (
                <CollapsibleList title={`${pf.moved.length} files added from ${pf.folder_b_name}`} color="var(--accent)" borderColor="var(--accent-glow)" dimColor="var(--accent-dim)">
                  {pf.playlist_path && <PlaylistRow path={pf.playlist_path} />}
                  {pf.moved.map((f, j) => <FileRow key={j} name={f} />)}
                </CollapsibleList>
              )}
              {pf.errors.length > 0 && <ErrorList errors={pf.errors} sourceName={pf.folder_b_name} />}
            </div>
          ))}
          {undoError && (
            <div style={{ marginBottom: '12px', padding: '14px 16px', background: 'var(--danger-dim)', border: '1px solid rgba(204,112,81,0.2)', borderRadius: '8px', color: 'var(--danger)', fontSize: '13px', fontFamily: 'IBM Plex Mono' }}>
              {undoError}
            </div>
          )}
        </>
      )}

      {/* Session history */}
      {history.length > 0 && (
        <details style={{ marginTop: '24px', border: '1px solid var(--border)', borderRadius: '10px', background: 'var(--surface)', overflow: 'hidden' }}>
          <summary style={{ padding: '14px 20px', cursor: 'pointer', listStyle: 'none', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'IBM Plex Sans' }}>
            Session History
          </summary>
          <div>
            {history.map((entry, i) => (
              <div key={i} style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', whiteSpace: 'nowrap' }}>
                  {new Date(entry.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{ fontSize: '10px', fontFamily: 'IBM Plex Mono', fontWeight: 700, letterSpacing: '0.08em', padding: '2px 7px', borderRadius: '4px', color: entry.mode === 'bounce' ? 'var(--danger)' : 'var(--accent)', background: entry.mode === 'bounce' ? 'var(--danger-dim)' : 'var(--accent-dim)' }}>
                  {entry.mode.toUpperCase()}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text)', fontFamily: 'IBM Plex Sans' }}>{entry.library_name}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                  {entry.mode === 'sort'
                    ? `${entry.counts.new ?? 0} new · ${entry.counts.duplicates ?? 0} duplicates`
                    : entry.mode === 'merge'
                    ? `${entry.counts.moved ?? 0} moved`
                    : `${entry.counts.moved ?? 0} moved · ${entry.counts.quarantined ?? 0} quarantined`}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        {mode === 'bounce' && (
          <button
            onClick={handleUndo}
            disabled={undoState === 'loading'}
            style={{
              padding: '14px 20px', borderRadius: '8px',
              background: 'transparent',
              color: undoState === 'loading' ? 'var(--text-dim)' : 'var(--danger)',
              border: `1px solid ${undoState === 'loading' ? 'var(--border)' : 'rgba(204,112,81,0.4)'}`,
              cursor: undoState === 'loading' ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontFamily: 'IBM Plex Sans', transition: 'all 0.15s',
            }}
          >
            {undoState === 'loading' ? 'Undoing...' : '↩ Undo'}
          </button>
        )}
        <button onClick={onReset} style={{ ...resetBtn, flex: 1 }}>Start over</button>
      </div>
    </div>
  )
}

function StatsBar({ stats }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: '1px', background: 'var(--border)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '20px' }}>
      {stats.map(s => (
        <div key={s.label} style={{ padding: '18px 16px', background: 'var(--surface)', textAlign: 'center' }}>
          <div style={{ fontSize: '26px', fontFamily: 'Syne', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px', fontFamily: 'IBM Plex Mono' }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

function CollapsibleList({ title, color, borderColor, dimColor, children }) {
  return (
    <details style={{ border: `1px solid ${borderColor}`, borderRadius: '10px', background: dimColor, overflow: 'hidden', marginBottom: '12px' }}>
      <summary style={{ padding: '14px 20px', cursor: 'pointer', listStyle: 'none', fontSize: '14px', fontWeight: 600, color: 'white', fontFamily: 'Syne', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }} />
        {title}
      </summary>
      <div style={{ maxHeight: '280px', overflowY: 'auto' }}>{children}</div>
    </details>
  )
}

function LibrarySafeNotice({ count }) {
  return (
    <div style={{ marginBottom: '12px', padding: '12px 16px', borderRadius: '8px', background: 'var(--surface)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--success)', fontFamily: 'IBM Plex Sans' }}>
      <span>✓</span>
      {count > 0 ? `${count} Library files untouched — cue points safe` : 'Library untouched — cue points safe'}
    </div>
  )
}

function PathRow({ path, label = 'Folder:', onOpen }) {
  return (
    <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', wordBreak: 'break-all', minWidth: 0 }}>
        <span style={{ color: 'var(--text-dim)' }}>{label} </span>
        <span style={{ color: 'var(--accent)' }}>{path}</span>
      </div>
      {onOpen && <button onClick={onOpen} style={openBtnStyle}>Open</button>}
    </div>
  )
}

function PlaylistRow({ path }) {
  return (
    <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <span style={{ flexShrink: 0, fontSize: '9px', fontFamily: 'IBM Plex Mono', fontWeight: 700, letterSpacing: '0.06em', padding: '2px 5px', border: '1px solid var(--accent)', borderRadius: '3px', color: 'var(--accent)', opacity: 0.8 }}>M3U</span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '11px', color: 'var(--text-muted)', wordBreak: 'break-all' }}>{path}</span>
      </div>
      <button onClick={() => openPath(path)} style={openBtnStyle}>Open</button>
    </div>
  )
}

function FileRow({ name }) {
  return (
    <div style={{ padding: '9px 20px', borderTop: '1px solid var(--border)', fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--text-muted)' }}>
      {name}
    </div>
  )
}

function ErrorList({ errors, sourceName }) {
  return (
    <CollapsibleList title={`${errors.length} error${errors.length > 1 ? 's' : ''} in ${sourceName}`} color="var(--amber)" borderColor="rgba(199,132,59,0.2)" dimColor="var(--amber-dim)">
      {errors.map((e, j) => (
        <div key={j} style={{ padding: '9px 20px', borderTop: '1px solid var(--border)', fontFamily: 'IBM Plex Mono', fontSize: '12px' }}>
          <span style={{ color: 'var(--text)' }}>{e.file}</span>
          <span style={{ color: 'var(--text-muted)' }}>: {e.error}</span>
        </div>
      ))}
    </CollapsibleList>
  )
}

const openBtnStyle = {
  flexShrink: 0, padding: '4px 10px', borderRadius: '5px',
  background: 'transparent', border: '1px solid var(--border-bright)',
  color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer',
  fontFamily: 'IBM Plex Sans', whiteSpace: 'nowrap',
}

const resetBtn = {
  padding: '14px', borderRadius: '8px',
  background: 'transparent', color: 'var(--text-muted)',
  border: '1px solid var(--border-bright)', cursor: 'pointer',
  fontSize: '14px', fontFamily: 'IBM Plex Sans',
}
