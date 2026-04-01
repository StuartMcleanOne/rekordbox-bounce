import { useState } from 'react'

export default function PreviewStep({ preview, filesToKeep, setFilesToKeep, onBack, onConfirm }) {
  const { delete_from_a, keep_in_a, move_to_a, rename_map, counts, quarantine_path } = preview
  const quarantineCount = counts.delete_from_a - filesToKeep.length

  const toggleKeep = (f) =>
    setFilesToKeep(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f])

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px', marginBottom: '8px' }}>
          Preview changes
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Review exactly what will happen. Check any file you want to keep in A.
        </p>
      </div>

      {/* Summary bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '1px', background: 'var(--border)',
        borderRadius: '10px', overflow: 'hidden',
        marginBottom: '20px', border: '1px solid var(--border)',
      }}>
        {[
          { value: counts.total_a, label: 'Files in A', color: 'var(--text)' },
          { value: counts.total_b, label: 'Files in B', color: 'var(--text)' },
          { value: quarantineCount, label: 'To quarantine', color: 'var(--danger)' },
          { value: counts.move_to_a, label: 'Adding to A', color: 'var(--accent)' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '18px 16px', background: 'var(--surface)', textAlign: 'center',
          }}>
            <div style={{ fontSize: '26px', fontFamily: 'Syne', fontWeight: 700, color: s.color, lineHeight: 1 }}>
              {s.value}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '5px', fontFamily: 'IBM Plex Mono' }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Quarantine */}
        <Section
          title={`${quarantineCount} going to quarantine`}
          meta={quarantine_path}
          color="var(--danger)"
          dimColor="var(--danger-dim)"
          borderColor="rgba(244,63,94,0.2)"
          defaultOpen
          badge={`${filesToKeep.length} kept`}
          badgeVisible={filesToKeep.length > 0}
        >
          {delete_from_a.length === 0 ? (
            <EmptyState text="Nothing to quarantine" />
          ) : (
            <ul style={{ padding: '0 0 4px' }}>
              {delete_from_a.map(f => {
                const kept = filesToKeep.includes(f)
                return (
                  <li
                    key={f}
                    onClick={() => toggleKeep(f)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 20px', cursor: 'pointer',
                      borderTop: '1px solid var(--border)',
                      background: kept ? 'rgba(34,211,238,0.04)' : 'transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <Checkbox checked={kept} color="var(--accent)" />
                    <span style={{
                      fontFamily: 'IBM Plex Mono', fontSize: '12px',
                      color: kept ? 'var(--accent)' : 'var(--text-muted)',
                      flex: 1, textDecoration: kept ? 'none' : undefined,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{f}</span>
                    {kept && (
                      <span style={{
                        fontSize: '10px', fontFamily: 'IBM Plex Mono',
                        color: 'var(--accent)', padding: '2px 8px',
                        background: 'var(--accent-dim)', borderRadius: '4px',
                        whiteSpace: 'nowrap',
                      }}>
                        KEEPING
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        {/* Keeping in A */}
        <Section
          title={`${counts.keep_in_a} staying in A`}
          meta="Matched — cue points safe, not touched"
          color="var(--success)"
          dimColor="var(--success-dim)"
          borderColor="rgba(16,185,129,0.2)"
          defaultOpen={false}
        >
          {keep_in_a.length === 0 ? (
            <EmptyState text="No matched files" />
          ) : (
            <ul style={{ padding: '0 0 4px' }}>
              {keep_in_a.map(f => (
                <li key={f} style={{
                  padding: '9px 20px', borderTop: '1px solid var(--border)',
                  fontFamily: 'IBM Plex Mono', fontSize: '12px', color: 'var(--text-muted)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{f}</li>
              ))}
            </ul>
          )}
        </Section>

        {/* Moving to A */}
        <Section
          title={`${counts.move_to_a} new files coming in`}
          meta="Renamed to match A's convention then moved"
          color="var(--accent)"
          dimColor="var(--accent-dim)"
          borderColor="rgba(34,211,238,0.2)"
          defaultOpen
        >
          {move_to_a.length === 0 ? (
            <EmptyState text="No new files to add" />
          ) : (
            <ul style={{ padding: '0 0 4px' }}>
              {move_to_a.map(f => {
                const renamed = rename_map?.[f]
                const isRenamed = renamed && renamed !== f
                return (
                  <li key={f} style={{
                    padding: '10px 20px', borderTop: '1px solid var(--border)',
                    fontFamily: 'IBM Plex Mono', fontSize: '12px',
                  }}>
                    {isRenamed ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--text-dim)', textDecoration: 'line-through' }}>{f}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>→</span>
                        <span style={{ color: 'var(--accent)' }}>{renamed}</span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>{f}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </Section>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
        <button onClick={onBack} style={secondaryBtn}>← Back</button>
        <button onClick={onConfirm} style={primaryBtn}>Continue →</button>
      </div>
    </div>
  )
}

function Section({ title, meta, color, dimColor, borderColor, defaultOpen, children, badge, badgeVisible }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ border: `1px solid ${borderColor}`, borderRadius: '10px', background: dimColor, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '16px 20px',
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'white', flex: 1, fontFamily: 'Syne' }}>{title}</span>
        {badgeVisible && (
          <span style={{
            fontSize: '10px', fontFamily: 'IBM Plex Mono', color: 'var(--accent)',
            padding: '2px 8px', background: 'var(--accent-dim)', borderRadius: '4px',
          }}>{badge}</span>
        )}
        {meta && (
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meta}</span>
        )}
        <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '4px' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && children}
    </div>
  )
}

function Checkbox({ checked, color }) {
  return (
    <div style={{
      width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
      border: `2px solid ${checked ? color : 'var(--border-bright)'}`,
      background: checked ? color : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.1s',
    }}>
      {checked && <span style={{ color: '#000', fontSize: '10px', fontWeight: 700 }}>✓</span>}
    </div>
  )
}

function EmptyState({ text }) {
  return (
    <p style={{ padding: '14px 20px', fontSize: '12px', color: 'var(--text-dim)', fontFamily: 'IBM Plex Mono', borderTop: '1px solid var(--border)' }}>
      {text}
    </p>
  )
}

const primaryBtn = {
  flex: 1, padding: '14px', borderRadius: '8px',
  background: 'var(--accent)', color: '#000',
  border: 'none', cursor: 'pointer',
  fontSize: '14px', fontWeight: 600, fontFamily: 'IBM Plex Sans',
}

const secondaryBtn = {
  padding: '14px 20px', borderRadius: '8px',
  background: 'transparent', color: 'var(--text-muted)',
  border: '1px solid var(--border-bright)', cursor: 'pointer',
  fontSize: '14px', fontFamily: 'IBM Plex Sans',
}
