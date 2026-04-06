import { useState } from 'react'
import './index.css'
import FolderSetup from './components/FolderSetup'
import PreviewStep from './components/PreviewStep'
import ExecuteStep from './components/ExecuteStep'
import Done from './components/Done'

const STEPS = [
  { key: 'setup', label: 'Folders' },
  { key: 'preview', label: 'Preview' },
  { key: 'execute', label: 'Confirm' },
  { key: 'done', label: 'Done' },
]

export default function App() {
  const [step, setStep] = useState('setup')
  const [folderA, setFolderA] = useState('')
  const [foldersB, setFoldersB] = useState([''])
  const [preview, setPreview] = useState(null)
  const [filesToKeep, setFilesToKeep] = useState([])
  const [result, setResult] = useState(null)

  const currentIndex = STEPS.findIndex(s => s.key === step)

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100svh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        padding: '20px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: 'white', letterSpacing: '-0.5px' }}>
            Rekordbox Bounce
          </h1>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', letterSpacing: '0.05em' }}>
            v0.2
          </span>
        </div>

        {/* Step indicator */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {STEPS.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', borderRadius: '20px',
                fontSize: '12px', fontFamily: 'IBM Plex Sans',
                background: i === currentIndex ? 'var(--accent-dim)' : 'transparent',
                color: i < currentIndex ? 'var(--accent)' : i === currentIndex ? 'var(--accent)' : 'var(--text-dim)',
                border: i === currentIndex ? '1px solid rgba(34,211,238,0.25)' : '1px solid transparent',
                transition: 'all 0.2s',
              }}>
                <span style={{
                  width: '18px', height: '18px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px',
                  background: i < currentIndex ? 'var(--accent)' : i === currentIndex ? 'rgba(34,211,238,0.2)' : 'var(--surface-2)',
                  color: i < currentIndex ? '#000' : i === currentIndex ? 'var(--accent)' : 'var(--text-dim)',
                  fontWeight: 600,
                }}>
                  {i < currentIndex ? '✓' : i + 1}
                </span>
                {s.label}
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: '20px', height: '1px', background: i < currentIndex ? 'var(--accent)' : 'var(--border)', opacity: 0.5 }} />
              )}
            </div>
          ))}
        </nav>
      </header>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: '680px' }}>
          {step === 'setup' && (
            <FolderSetup
              folderA={folderA}
              setFolderA={setFolderA}
              foldersB={foldersB}
              setFoldersB={setFoldersB}
              onNext={(p) => { setPreview(p); setFilesToKeep([]); setStep('preview') }}
            />
          )}
          {step === 'preview' && (
            <PreviewStep
              preview={preview}
              filesToKeep={filesToKeep}
              setFilesToKeep={setFilesToKeep}
              onBack={() => setStep('setup')}
              onConfirm={() => setStep('execute')}
            />
          )}
          {step === 'execute' && (
            <ExecuteStep
              folderA={folderA}
              foldersB={foldersB}
              filesToKeep={filesToKeep}
              onResult={(r) => { setResult(r); setStep('done') }}
              onBack={() => setStep('preview')}
            />
          )}
          {step === 'done' && (
            <Done
              result={result}
              folderA={folderA}
              onReset={() => {
                setStep('setup')
                setFolderA('')
                setFoldersB([''])
                setPreview(null)
                setFilesToKeep([])
                setResult(null)
              }}
            />
          )}
        </div>
      </main>
    </div>
  )
}
