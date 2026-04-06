import { useState } from 'react'

export default function ExecuteStep({ folderA, foldersB, filesToKeep, onResult, onBack }) {
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleExecute = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_a: folderA, folders_b: foldersB, files_to_keep: filesToKeep }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Operation failed')
      }
      onResult(await res.json())
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          Confirm & run
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Last chance to back out.
        </p>
      </div>

      <div style={{
        padding: '20px', borderRadius: '10px',
        background: 'var(--amber-dim)', border: '1px solid rgba(245,158,11,0.2)',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <span style={{ fontSize: '18px' }}>⚠</span>
          <div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--amber)', marginBottom: '10px' }}>
              This will modify your files
            </p>
            <ul style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.8', paddingLeft: '16px' }}>
              <li>Removed files go to <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--text)' }}>RekordboxBounce/</span> in the parent of A — not permanently deleted</li>
              <li>New files move from {foldersB.length > 1 ? `${foldersB.length} B folders` : 'B'} into A with their original filenames</li>
              <li>A playlist (.m3u) will be saved in A for each B folder</li>
              {filesToKeep.length > 0 && (
                <li style={{ color: 'var(--accent)' }}>
                  {filesToKeep.length} file{filesToKeep.length > 1 ? 's' : ''} you marked to keep will stay in A
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <label style={{
        display: 'flex', alignItems: 'flex-start', gap: '14px',
        cursor: 'pointer', padding: '16px',
        border: `1px solid ${confirmed ? 'rgba(34,211,238,0.3)' : 'var(--border)'}`,
        borderRadius: '10px', background: confirmed ? 'var(--accent-dim)' : 'var(--surface)',
        transition: 'all 0.15s', marginBottom: '24px',
      }}>
        <div
          onClick={() => setConfirmed(c => !c)}
          style={{
            width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0, marginTop: '1px',
            border: `2px solid ${confirmed ? 'var(--accent)' : 'var(--border-bright)'}`,
            background: confirmed ? 'var(--accent)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s', cursor: 'pointer',
          }}
        >
          {confirmed && <span style={{ color: '#000', fontSize: '12px', fontWeight: 700 }}>✓</span>}
        </div>
        <span style={{ fontSize: '14px', color: 'var(--text)', lineHeight: '1.5' }}
          onClick={() => setConfirmed(c => !c)}>
          I understand this will move files. Quarantined files can be restored with Undo on the next screen.
        </span>
      </label>

      {error && (
        <div style={{
          marginBottom: '16px', padding: '14px 16px',
          background: 'var(--danger-dim)', border: '1px solid rgba(244,63,94,0.2)',
          borderRadius: '8px', color: 'var(--danger)', fontSize: '13px', fontFamily: 'IBM Plex Mono',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onBack} disabled={loading} style={secondaryBtn}>← Back</button>
        <button
          onClick={handleExecute}
          disabled={!confirmed || loading}
          style={{
            flex: 1, padding: '14px', borderRadius: '8px',
            background: !confirmed || loading ? 'var(--surface-2)' : 'var(--danger)',
            color: !confirmed || loading ? 'var(--text-dim)' : 'white',
            border: 'none', cursor: !confirmed || loading ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontWeight: 600, fontFamily: 'IBM Plex Sans',
            transition: 'all 0.15s',
          }}
        >
          {loading ? 'Running...' : 'Run Sync'}
        </button>
      </div>
    </div>
  )
}

const secondaryBtn = {
  padding: '14px 20px', borderRadius: '8px',
  background: 'transparent', color: 'var(--text-muted)',
  border: '1px solid var(--border-bright)', cursor: 'pointer',
  fontSize: '14px', fontFamily: 'IBM Plex Sans',
}
