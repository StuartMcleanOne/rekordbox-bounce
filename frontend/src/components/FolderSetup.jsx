import { useState, useCallback } from 'react'

export default function FolderSetup({ folderA, setFolderA, foldersB, setFoldersB, onNext }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const canSubmit = folderA.trim() && foldersB.length > 0 && foldersB.every(f => f.trim())

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_a: folderA, folders_b: foldersB }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to scan folders')
      }
      onNext(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const updateB = (i, val) =>
    setFoldersB(prev => prev.map((f, idx) => idx === i ? val : f))

  const addB = () => setFoldersB(prev => [...prev, ''])

  const removeB = (i) => setFoldersB(prev => prev.filter((_, idx) => idx !== i))

  return (
    <div>
      <div style={{ marginBottom: '36px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          Select your folders
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.6' }}>
          Library is your live Rekordbox folder. Sources are your new downloads. Nothing changes until you confirm.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <FolderZone
          label="Library"
          description="Your existing library with cue points"
          tag="PROTECTED"
          tagColor="var(--success)"
          value={folderA}
          onChange={setFolderA}
        />

        {foldersB.map((val, i) => (
          <FolderZone
            key={i}
            label={`Source ${i + 1}`}
            description="Fresh tracks to merge in"
            tag="SOURCE"
            tagColor="var(--accent)"
            value={val}
            onChange={(v) => updateB(i, v)}
            onRemove={foldersB.length > 1 ? () => removeB(i) : null}
          />
        ))}

        <button
          onClick={addB}
          style={{
            padding: '12px', borderRadius: '10px',
            background: 'transparent', border: '1px dashed var(--border-bright)',
            color: 'var(--text-muted)', cursor: 'pointer',
            fontSize: '13px', fontFamily: 'IBM Plex Sans',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          + Add another source folder
        </button>
      </div>

      {error && (
        <div style={{
          marginTop: '16px', padding: '14px 16px',
          background: 'var(--danger-dim)', border: '1px solid rgba(244,63,94,0.2)',
          borderRadius: '8px', color: 'var(--danger)', fontSize: '13px',
          fontFamily: 'IBM Plex Mono',
        }}>
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || !canSubmit}
        style={{
          marginTop: '24px', width: '100%',
          padding: '16px', borderRadius: '10px',
          background: loading || !canSubmit ? 'var(--surface-2)' : 'var(--accent)',
          color: loading || !canSubmit ? 'var(--text-dim)' : '#000',
          border: 'none', cursor: loading || !canSubmit ? 'not-allowed' : 'pointer',
          fontSize: '14px', fontWeight: 600, fontFamily: 'IBM Plex Sans',
          letterSpacing: '0.02em', transition: 'all 0.15s',
        }}
      >
        {loading ? 'Scanning...' : 'Scan & Preview →'}
      </button>
    </div>
  )
}

function FolderZone({ label, description, tag, tagColor, value, onChange, onRemove }) {
  const [dragging, setDragging] = useState(false)

  const pickFolder = async () => {
    try {
      const res = await fetch('/api/pick-folder')
      const data = await res.json()
      if (data.path) onChange(data.path)
    } catch {
      // fallback — user can type manually
    }
  }

  const onDragOver = useCallback((e) => { e.preventDefault(); setDragging(true) }, [])
  const onDragLeave = useCallback(() => setDragging(false), [])
  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    pickFolder()
  }, [])

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        border: `1px solid ${dragging ? tagColor : value ? 'var(--border-bright)' : 'var(--border)'}`,
        borderRadius: '12px',
        background: dragging ? `rgba(34,211,238,0.04)` : 'var(--surface)',
        transition: 'all 0.15s',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'white', fontFamily: 'Syne' }}>{label}</span>
            <span style={{
              fontSize: '9px', fontFamily: 'IBM Plex Mono', fontWeight: 500,
              color: tagColor, padding: '2px 6px',
              border: `1px solid ${tagColor}40`, borderRadius: '4px', letterSpacing: '0.08em',
            }}>{tag}</span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{description}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onRemove && (
            <button
              onClick={onRemove}
              style={{
                padding: '8px 14px', borderRadius: '7px',
                background: 'var(--surface-2)', border: '1px solid var(--border)',
                color: 'var(--danger)', fontSize: '12px', cursor: 'pointer',
                fontFamily: 'IBM Plex Sans', fontWeight: 500,
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              Remove
            </button>
          )}
          <button
            onClick={pickFolder}
            style={{
              padding: '8px 14px', borderRadius: '7px',
              background: 'var(--surface-2)', border: '1px solid var(--border-bright)',
              color: 'var(--text)', fontSize: '12px', cursor: 'pointer',
              fontFamily: 'IBM Plex Sans', fontWeight: 500,
              transition: 'all 0.15s', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = tagColor; e.currentTarget.style.color = tagColor }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text)' }}
          >
            Browse
          </button>
        </div>
      </div>

      <div
        onClick={pickFolder}
        style={{
          margin: '12px 20px 20px', padding: '20px', borderRadius: '8px',
          border: `1px dashed ${dragging ? tagColor : 'var(--border-bright)'}`,
          background: dragging ? `${tagColor}08` : 'var(--surface-2)',
          cursor: 'pointer', transition: 'all 0.15s', minHeight: '70px',
          display: 'flex', alignItems: 'center', gap: '12px',
        }}
      >
        {value ? (
          <>
            <FolderIcon color={tagColor} />
            <span style={{ fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--text)', wordBreak: 'break-all', lineHeight: '1.5' }}>
              {value}
            </span>
          </>
        ) : (
          <div style={{ textAlign: 'center', width: '100%' }}>
            <div style={{ fontSize: '22px', marginBottom: '6px', opacity: 0.4 }}>⌘</div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Click to browse
            </p>
          </div>
        )}
      </div>

      {value && (
        <div style={{ padding: '0 20px 16px' }}>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Or type path manually"
            style={{
              width: '100%', padding: '8px 12px',
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: '6px', color: 'var(--text-muted)',
              fontSize: '11px', fontFamily: 'IBM Plex Mono', outline: 'none',
            }}
          />
        </div>
      )}
    </div>
  )
}

function FolderIcon({ color }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3 7C3 5.9 3.9 5 5 5H10L12 7H19C20.1 7 21 7.9 21 9V17C21 18.1 20.1 19 19 19H5C3.9 19 3 18.1 3 17V7Z"
        fill={`${color}20`} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
