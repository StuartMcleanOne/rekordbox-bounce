import { useState, useEffect } from 'react'

const openPath = (path) =>
  fetch(`/api/open-path?path=${encodeURIComponent(path)}`).catch(() => {})

const parentDir = (filePath) => {
  const sep = filePath.includes('\\') ? '\\' : '/'
  const parts = filePath.split(sep)
  parts.pop()
  return parts.join(sep)
}

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
        <HoverButton onClick={onReset} baseStyle={resetBtn} hoverStyle={{ background: 'var(--surface-2)' }}>Start over</HoverButton>
      </div>
    )
  }

  const totalDuplicates = (preview?.per_folder || []).reduce((s, pf) => s + (pf.duplicate_files || []).length, 0)
  const playlists = (result.per_folder || [])
    .filter(pf => pf.playlist_path)
    .map(pf => pf.playlist_path)

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
            { value: result.summary.total_new, label: 'Sorted to New/', color: 'var(--accent)' },
            { value: result.summary.total_duplicate, label: 'Sorted to Duplicate/', color: 'var(--text-muted)' },
            { value: result.summary.kept_in_library_count, label: 'Library Untouched', color: 'var(--success)' },
          ]} />
          {result.per_folder.map((pf, i) => (
            <div key={i}>
              {pf.moved_new.length > 0 && (
                <CollapsibleList
                  title={`${pf.moved_new.length} files in ${pf.folder_b_name}/New`}
                  color="var(--accent)" borderColor="var(--accent-glow)" dimColor="var(--accent-dim)"
                  destination={pf.new_folder}
                >
                  {pf.moved_new.map((f, j) => <FileRow key={j} name={f} />)}
                </CollapsibleList>
              )}
              {pf.moved_duplicate.length > 0 && (
                <CollapsibleList
                  title={`${pf.moved_duplicate.length} files in ${pf.folder_b_name}/Duplicate`}
                  color="var(--text-muted)" borderColor="var(--border)" dimColor="var(--surface)"
                  destination={pf.duplicate_folder}
                >
                  {pf.moved_duplicate.map((f, j) => <FileRow key={j} name={f} />)}
                </CollapsibleList>
              )}
              {pf.errors.length > 0 && <ErrorList errors={pf.errors} sourceName={pf.folder_b_name} />}
            </div>
          ))}
          {result.summary.kept_in_library_count > 0 && (
            <CollapsibleList
              title={`${result.summary.kept_in_library_count} Library files untouched`}
              color="var(--success)" borderColor="rgba(158,138,110,0.2)" dimColor="var(--success-dim)"
              destination={folderA}
            >
              <MessageRow text="No changes were made to your Library." />
            </CollapsibleList>
          )}
        </>
      )}

      {/* MERGE results */}
      {mode === 'merge' && (
        <>
          <StatsBar stats={[
            { value: result.summary.total_moved_count, label: 'Added to Library', color: 'var(--success)' },
            { value: totalDuplicates, label: 'Already Matched', color: 'var(--text-muted)' },
            { value: result.summary.kept_in_library_count, label: 'Library Untouched', color: 'var(--success)' },
          ]} />
          {result.per_folder.map((pf, i) => {
            const previewPf = (preview?.per_folder || [])[i] || {}
            const duplicates = previewPf.duplicate_files || []
            return (
              <div key={i}>
                {pf.moved.length > 0 && (
                  <CollapsibleList
                    title={`${pf.moved.length} added from ${pf.folder_b_name}`}
                    color="var(--accent)" borderColor="var(--accent-glow)" dimColor="var(--accent-dim)"
                    destination={folderA}
                  >
                    {pf.moved.map((f, j) => <FileRow key={j} name={f} />)}
                  </CollapsibleList>
                )}
                {duplicates.length > 0 && (
                  <CollapsibleList
                    title={`${duplicates.length} already in Library from ${pf.folder_b_name}`}
                    color="var(--text-muted)" borderColor="var(--border)" dimColor="var(--surface)"
                  >
                    {duplicates.map((f, j) => <FileRow key={j} name={f} />)}
                  </CollapsibleList>
                )}
                {pf.errors.length > 0 && <ErrorList errors={pf.errors} sourceName={pf.folder_b_name} />}
              </div>
            )
          })}
          {playlists.length > 0 && <PlaylistsSection playlists={playlists} />}
          {result.summary.kept_in_library_count > 0 && (
            <CollapsibleList
              title={`${result.summary.kept_in_library_count} Library files untouched`}
              color="var(--success)" borderColor="rgba(158,138,110,0.2)" dimColor="var(--success-dim)"
              destination={folderA}
            >
              <MessageRow text="No files were moved or overwritten." />
            </CollapsibleList>
          )}
        </>
      )}

      {/* BOUNCE results */}
      {mode === 'bounce' && (
        <>
          <StatsBar stats={[
            { value: result.summary.total_moved_count, label: 'Added to Library', color: 'var(--success)' },
            { value: result.summary.quarantined_count, label: 'Quarantined', color: 'var(--danger)' },
            { value: result.summary.kept_in_library_count, label: 'Library Untouched', color: 'var(--success)' },
          ]} />
          {result.per_folder.map((pf, i) => (
            <div key={i}>
              {pf.moved.length > 0 && (
                <CollapsibleList
                  title={`${pf.moved.length} files added from ${pf.folder_b_name}`}
                  color="var(--accent)" borderColor="var(--accent-glow)" dimColor="var(--accent-dim)"
                  destination={folderA}
                >
                  {pf.moved.map((f, j) => <FileRow key={j} name={f} />)}
                </CollapsibleList>
              )}
              {pf.errors.length > 0 && <ErrorList errors={pf.errors} sourceName={pf.folder_b_name} />}
            </div>
          ))}
          {result.summary.quarantined_count > 0 && (
            <CollapsibleList
              title={`${result.summary.quarantined_count} files quarantined`}
              color="var(--danger)" borderColor="rgba(204,112,81,0.25)" dimColor="var(--danger-dim)"
              destination={result.quarantine_path}
            >
              {result.quarantined.map((f, j) => <FileRow key={j} name={f} />)}
            </CollapsibleList>
          )}
          {result.summary.kept_in_library_count > 0 && (
            <CollapsibleList
              title={`${result.summary.kept_in_library_count} Library files untouched`}
              color="var(--success)" borderColor="rgba(158,138,110,0.2)" dimColor="var(--success-dim)"
              destination={folderA}
            >
              <MessageRow text="No files were moved or overwritten." />
            </CollapsibleList>
          )}
          {playlists.length > 0 && <PlaylistsSection playlists={playlists} />}
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
        <HoverButton onClick={onReset} baseStyle={{ ...resetBtn, flex: 1 }} hoverStyle={{ background: 'var(--surface-2)' }}>Start over</HoverButton>
      </div>
    </div>
  )
}

function StatsBar({ stats }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '20px' }}>
      {stats.map(s => (
        <div key={s.label} style={{ padding: '18px 16px', background: 'var(--surface)', textAlign: 'center' }}>
          <div style={{ fontSize: '26px', fontFamily: 'Syne', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px', fontFamily: 'IBM Plex Mono' }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

function CollapsibleList({ title, color, borderColor, dimColor, destination, children }) {
  const [open, setOpen] = useState(false)
  const [summaryHover, setSummaryHover] = useState(false)
  const [iconHover, setIconHover] = useState(false)
  return (
    <details
      style={{ border: `1px solid ${borderColor}`, borderRadius: '10px', background: dimColor, overflow: 'hidden', marginBottom: '12px' }}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary
        style={{
          padding: '14px 20px', cursor: 'pointer', listStyle: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: summaryHover ? 'rgba(255,255,255,0.03)' : 'transparent',
          transition: 'background 0.1s',
        }}
        onMouseEnter={() => setSummaryHover(true)}
        onMouseLeave={() => setSummaryHover(false)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'Syne', fontSize: '14px', fontWeight: 600, color: 'white' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
          {title}
          <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', color: 'var(--text-dim)', fontSize: '14px', lineHeight: 1 }}>›</span>
        </div>
        {destination && (
          <button
            onClick={(e) => { e.stopPropagation(); openPath(destination) }}
            onMouseEnter={() => setIconHover(true)}
            onMouseLeave={() => setIconHover(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', borderRadius: '4px', opacity: iconHover ? 1 : 0.6, transition: 'opacity 0.15s' }}
            title="Open folder"
          >
            <FolderIcon />
          </button>
        )}
      </summary>
      <div style={{ maxHeight: '280px', overflowY: 'auto' }}>{children}</div>
    </details>
  )
}

function PlaylistRow({ path }) {
  const [hover, setHover] = useState(false)
  const name = path.split(/[/\\]/).pop()
  const folder = parentDir(path)
  return (
    <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
        <span style={{ flexShrink: 0, fontSize: '9px', fontFamily: 'IBM Plex Mono', fontWeight: 700, letterSpacing: '0.06em', padding: '2px 5px', border: '1px solid var(--accent)', borderRadius: '3px', color: 'var(--accent)', opacity: 0.8 }}>M3U</span>
        <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--text)', wordBreak: 'break-all' }}>{name}</span>
      </div>
      <button
        onClick={() => openPath(folder)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: 'var(--text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', borderRadius: '4px', opacity: hover ? 1 : 0.6, transition: 'opacity 0.15s' }}
        title="Open folder"
      >
        <FolderIcon />
      </button>
    </div>
  )
}

function PlaylistsSection({ playlists }) {
  return (
    <CollapsibleList
      title="Playlists"
      color="var(--accent)" borderColor="var(--border)" dimColor="var(--surface)"
    >
      {playlists.map((path, i) => <PlaylistRow key={i} path={path} />)}
    </CollapsibleList>
  )
}

function MessageRow({ text }) {
  return (
    <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono' }}>
      {text}
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
    <CollapsibleList
      title={`${errors.length} error${errors.length > 1 ? 's' : ''} in ${sourceName}`}
      color="var(--amber)" borderColor="rgba(199,132,59,0.2)" dimColor="var(--amber-dim)"
    >
      {errors.map((e, j) => (
        <div key={j} style={{ padding: '9px 20px', borderTop: '1px solid var(--border)', fontFamily: 'IBM Plex Mono', fontSize: '12px' }}>
          <span style={{ color: 'var(--text)' }}>{e.file}</span>
          <span style={{ color: 'var(--text-muted)' }}>: {e.error}</span>
        </div>
      ))}
    </CollapsibleList>
  )
}

function FolderIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M3 7C3 5.9 3.9 5 5 5H10L12 7H19C20.1 7 21 7.9 21 9V17C21 18.1 20.1 19 19 19H5C3.9 19 3 18.1 3 17V7Z"
        fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function HoverButton({ onClick, baseStyle, hoverStyle, children }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ ...baseStyle, ...(hover ? hoverStyle : {}) }}
    >
      {children}
    </button>
  )
}

const resetBtn = {
  padding: '14px', borderRadius: '8px',
  background: 'transparent', color: 'var(--text-muted)',
  border: '1px solid var(--border-bright)', cursor: 'pointer',
  fontSize: '14px', fontFamily: 'IBM Plex Sans',
  transition: 'background 0.15s',
}
