const MODES = [
  {
    key: 'sort',
    label: 'SORT',
    description: "Separates what's new from what's old. So you don't waste time re-analysing tracks you already have. A playlist of new tracks is created for each source folder.",
    color: 'var(--accent)',
    dimColor: 'var(--accent-dim)',
    borderColor: 'var(--accent-glow)',
  },
  {
    key: 'merge',
    label: 'MERGE',
    description: "Brings new and old together. Your existing Library is protected. New tracks are added. Nothing is removed. A playlist is automatically created for each source folder.",
    color: 'var(--accent)',
    dimColor: 'var(--accent-dim)',
    borderColor: 'var(--accent-glow)',
  },
  {
    key: 'bounce',
    label: 'BOUNCE',
    description: "Spring clean. Replaces your old Library with your new one — without overwriting anything. New tracks come in, unmatched tracks go to quarantine. A playlist is automatically created for each source folder.",
    color: 'var(--danger)',
    dimColor: 'var(--danger-dim)',
    borderColor: 'rgba(204,112,81,0.25)',
  },
]

export default function ModeStep({ mode, setMode, onNext }) {
  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          Choose a mode
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Select how you want to work with your folders.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
        {MODES.map(m => {
          const selected = mode === m.key
          return (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              style={{
                padding: '20px 24px',
                borderRadius: '10px',
                background: selected ? m.dimColor : 'var(--surface)',
                border: `1px solid ${selected ? m.borderColor : 'var(--border)'}`,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                <span style={{
                  fontFamily: 'IBM Plex Mono', fontSize: '13px', fontWeight: 700,
                  color: selected ? m.color : 'var(--text-muted)',
                  letterSpacing: '0.1em',
                }}>
                  {m.label}
                </span>
                {selected && (
                  <span style={{
                    width: '7px', height: '7px', borderRadius: '50%',
                    background: m.color, flexShrink: 0,
                  }} />
                )}
              </div>
              <p style={{
                fontSize: '13px', lineHeight: 1.55, margin: 0,
                color: selected ? 'var(--text)' : 'var(--text-muted)',
              }}>
                {m.description}
              </p>
            </button>
          )
        })}
      </div>

      <button
        onClick={onNext}
        style={{
          width: '100%', padding: '14px', borderRadius: '8px',
          background: 'var(--accent)', color: '#000',
          border: 'none', cursor: 'pointer',
          fontSize: '14px', fontWeight: 600, fontFamily: 'IBM Plex Sans',
        }}
      >
        Continue →
      </button>
    </div>
  )
}
