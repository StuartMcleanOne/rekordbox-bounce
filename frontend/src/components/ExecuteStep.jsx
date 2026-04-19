import { useState } from 'react'

export default function ExecuteStep({ folderA, foldersB, filesToKeep, mode, onResult, onBack }) {
  const [confirmed, setConfirmed] = useState(false)
  const [bounceInput, setBounceInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const canRun =
    mode === 'sort' ? confirmed :
    mode === 'merge' ? confirmed :
    bounceInput === 'BOUNCE'

  const handleRun = async () => {
    setLoading(true)
    setError(null)
    try {
      const endpoint = mode === 'sort' ? '/api/sort' : '/api/execute'
      const body = mode === 'sort'
        ? { folder_a: folderA, folders_b: foldersB }
        : { folder_a: folderA, folders_b: foldersB, files_to_keep: filesToKeep, mode }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Something went wrong')
      }
      onResult(await res.json())
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const labels = {
    sort: {
      title: 'Ready to sort',
      subtitle: 'Files will be sorted into New/ and Duplicate/ folders inside each source folder. Your Library is not touched.',
      checkbox: 'I understand files will be sorted into subfolders',
      button: 'Run Sort',
    },
    merge: {
      title: 'Ready to merge',
      subtitle: 'New files will move into your Library. Duplicates stay where they are.',
      checkbox: 'I understand this will move files into my Library',
      button: 'Run Merge',
    },
    bounce: {
      title: 'Ready to bounce',
      subtitle: null,
      checkbox: null,
      button: 'Run Bounce',
    },
  }
  const { title, subtitle, checkbox, button } = labels[mode]

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>{subtitle}</p>
        )}
      </div>

      {mode === 'bounce' && (
        <div style={{
          padding: '16px 20px', borderRadius: '10px', marginBottom: '20px',
          background: 'var(--amber-dim)', border: '1px solid var(--amber)',
        }}>
          <p style={{ color: 'var(--amber)', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Warning
          </p>
          <p style={{ color: 'var(--text)', fontSize: '13px', lineHeight: 1.5, margin: 0 }}>
            Library files not found in any Source will be moved to the ReadySetBounce/ quarantine folder. This cannot be undone if the quarantine folder is deleted.
          </p>
        </div>
      )}

      {checkbox && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '24px' }}>
          <div
            onClick={() => setConfirmed(c => !c)}
            style={{
              width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
              border: `2px solid ${confirmed ? 'var(--accent)' : 'var(--border-bright)'}`,
              background: confirmed ? 'var(--accent)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.1s',
            }}
          >
            {confirmed && <span style={{ color: '#000', fontSize: '11px', fontWeight: 700 }}>✓</span>}
          </div>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{checkbox}</span>
        </label>
      )}

      {mode === 'bounce' && (
        <div style={{ marginBottom: '24px' }}>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Type <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--danger)' }}>BOUNCE</span> to confirm
          </p>
          <input
            type="text"
            value={bounceInput}
            onChange={e => setBounceInput(e.target.value)}
            placeholder="BOUNCE"
            style={{
              width: '100%', padding: '12px 16px', borderRadius: '8px',
              background: 'var(--surface)', border: `1px solid ${bounceInput === 'BOUNCE' ? 'var(--accent)' : 'var(--border)'}`,
              color: 'white', fontSize: '14px', fontFamily: 'IBM Plex Mono',
              outline: 'none', boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
          />
        </div>
      )}

      {error && (
        <div style={{
          marginBottom: '16px', padding: '14px 16px', borderRadius: '8px',
          background: 'var(--danger-dim)', border: '1px solid var(--danger)',
          color: 'var(--danger)', fontSize: '13px', fontFamily: 'IBM Plex Mono',
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onBack} disabled={loading} style={secondaryBtn}>← Back</button>
        <button
          onClick={handleRun}
          disabled={!canRun || loading}
          style={{
            ...primaryBtn,
            background: canRun && !loading ? 'var(--accent)' : 'var(--surface-2)',
            color: canRun && !loading ? '#000' : 'var(--text-dim)',
            cursor: canRun && !loading ? 'pointer' : 'not-allowed',
          }}
        >
          {loading ? 'Running...' : button}
        </button>
      </div>
    </div>
  )
}

const primaryBtn = {
  flex: 1, padding: '14px', borderRadius: '8px',
  border: 'none', fontSize: '14px', fontWeight: 600, fontFamily: 'IBM Plex Sans',
  transition: 'all 0.15s',
}

const secondaryBtn = {
  padding: '14px 20px', borderRadius: '8px',
  background: 'transparent', color: 'var(--text-muted)',
  border: '1px solid var(--border-bright)', cursor: 'pointer',
  fontSize: '14px', fontFamily: 'IBM Plex Sans',
}
