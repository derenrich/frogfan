'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import FilePicker from '@/components/FilePicker';
import styles from './new.module.css';

export default function NewSession() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [labels, setLabels] = useState('Point 1, Point 2');
  const [mediaPaths, setMediaPaths] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showMatPicker, setShowMatPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState('');
  const [importedData, setImportedData] = useState<any>(null);
  const [missingResolutionState, setMissingResolutionState] = useState<{
    queue: string[];
    currentIndex: number;
    tempVideoFiles: string[];
    tempAnnotations: any;
    dataObj: any;
    matPath: string;
  } | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || mediaPaths.length === 0) return alert('Please provide title and media files.');
    
    setSaving(true);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          labelNames: labels.split(',').map(l => l.trim()).filter(Boolean),
          mediaFiles: mediaPaths,
          ...(importedData ? {
            annotations: importedData.annotations,
            currframe: importedData.currframe,
            dltcoef: importedData.dltcoef
          } : {})
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      router.push(`/session/${data.id}`);
    } catch (err) {
      console.error(err);
      alert('Failed to create session');
    } finally {
      setSaving(false);
    }
  };

  const handleMatImport = async (paths: string[]) => {
    if (paths.length === 0) return;
    const matPath = paths[0];
    setImporting(true);
    try {
      const res = await fetch('/api/import-mat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: matPath })
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      let { data, fileExistsStatus } = result;
      let updatedVideoFiles = [...data.video_files];
      let updatedAnnotations = { ...data.annotations };

      const missing = Object.keys(fileExistsStatus).filter(f => !fileExistsStatus[f]);
      if (missing.length > 0) {
        setMissingResolutionState({
          queue: missing,
          currentIndex: 0,
          tempVideoFiles: updatedVideoFiles,
          tempAnnotations: updatedAnnotations,
          dataObj: data,
          matPath
        });
        setImporting(false);
        setShowMatPicker(false);
        return;
      } else {
        finalizeImport(updatedVideoFiles, updatedAnnotations, data, matPath);
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to import MAT file: ' + err.message);
      setImporting(false);
      setShowMatPicker(false);
    }
  };

  const finalizeImport = (videoFiles: string[], annotations: any, data: any, matPath: string) => {
    setMediaPaths(videoFiles);
    setLabels(data.labelNames.join(', '));
    const filename = matPath.split('/').pop()?.replace('.mat', '') || 'Imported Session';
    if (!title) setTitle(filename);

    setImportedData({
      annotations: annotations,
      currframe: data.currframe,
      dltcoef: data.dltcoef
    });

    setImportSummary(`Successfully imported! Videos: ${videoFiles.length}, Labels: ${data.numpts}, Points Shape: [${data.xypts_shape ? data.xypts_shape.join('x') : 'N/A'}]`);
    setImporting(false);
    setShowMatPicker(false);
  };

  const handleResolveMissing = (paths: string[]) => {
    if (!missingResolutionState || paths.length === 0) return;
    const state = { ...missingResolutionState };
    const currentPath = state.queue[state.currentIndex];
    const pickedPath = paths[0].replace(/\\/g, '/');

    if (currentPath.includes('/data/')) {
      const newQueue: string[] = [];
      for (let i = state.currentIndex; i < state.queue.length; i++) {
        const qp = state.queue[i];
        if (qp.includes('/data/')) {
          const parts = qp.split('/data/');
          const cleanPicked = pickedPath.replace(/\/$/, '');
          const newPath = cleanPicked + '/data/' + parts.slice(1).join('/data/');
          
          const vidx = state.tempVideoFiles.indexOf(qp);
          if (vidx !== -1) state.tempVideoFiles[vidx] = newPath;
          
          state.tempAnnotations[newPath] = state.tempAnnotations[qp];
          delete state.tempAnnotations[qp];
        } else {
          if (i !== state.currentIndex) newQueue.push(qp);
        }
      }
      state.queue = state.queue.slice(0, state.currentIndex + 1).concat(newQueue);
    } else {
      const newPath = pickedPath;
      const vidx = state.tempVideoFiles.indexOf(currentPath);
      if (vidx !== -1) state.tempVideoFiles[vidx] = newPath;
      
      state.tempAnnotations[newPath] = state.tempAnnotations[currentPath];
      delete state.tempAnnotations[currentPath];
    }

    state.currentIndex++;
    if (state.currentIndex >= state.queue.length) {
      finalizeImport(state.tempVideoFiles, state.tempAnnotations, state.dataObj, state.matPath);
      setMissingResolutionState(null);
    } else {
      setMissingResolutionState(state);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1>Create Labeling Session</h1>
        
        {importSummary && (
          <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '4px', marginBottom: '1rem', border: '1px solid #10b981' }}>
            {importSummary}
          </div>
        )}

        <form onSubmit={handleCreate}>
          <div className={styles.formGroup}>
            <label>Session Title</label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              placeholder="e.g. Experiment 42" 
              required 
            />
          </div>

          <div className={styles.formGroup}>
            <label>Labels (comma separated)</label>
            <input 
              type="text" 
              value={labels} 
              onChange={e => setLabels(e.target.value)} 
              placeholder="Nose, Left Eye, Right Eye" 
              required 
            />
          </div>

          <div className={styles.formGroup}>
            <label>Media Files</label>
            <div className={styles.mediaList}>
              {mediaPaths.map(p => <div key={p} className={styles.mediaItem}>{p}</div>)}
              {mediaPaths.length === 0 && <div className={styles.emptyMedia}>No media selected</div>}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className={styles.btnSecondary} onClick={() => setShowPicker(true)}>
                Browse Server Files...
              </button>
              <button type="button" className={styles.btnSecondary} onClick={() => setShowMatPicker(true)}>
                {importing ? 'Importing...' : 'Import from .mat'}
              </button>
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.btnText} onClick={() => router.push('/')}>Cancel</button>
            <button type="submit" className={styles.btnPrimary} disabled={saving || mediaPaths.length === 0}>
              {saving ? 'Creating...' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>

      {showPicker && (
        <FilePicker 
          multiSelect
          onClose={() => setShowPicker(false)}
          onSelect={(paths) => {
            setMediaPaths(paths);
            setShowPicker(false);
          }}
        />
      )}

      {showMatPicker && (
        <FilePicker 
          accept=".mat"
          onClose={() => setShowMatPicker(false)}
          onSelect={handleMatImport}
        />
      )}

      {missingResolutionState && (() => {
        const currentMissing = missingResolutionState.queue[missingResolutionState.currentIndex];
        const isDataDir = currentMissing.includes('/data/');
        return (
          <FilePicker 
            title="Locate Missing File"
            message={
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.5rem 0' }}>Missing: <strong style={{color:'var(--text)'}}>{currentMissing}</strong></p>
                <p style={{ margin: 0 }}>
                  {isDataDir 
                    ? "Please pick the parent directory containing the 'data' folder. This will automatically re-link all videos that share this structure." 
                    : "Please select the correct location for this video file."}
                </p>
              </div>
            }
            directoriesOnly={isDataDir}
            accept=".mp4,.mov,.avi"
            onClose={() => setMissingResolutionState(null)}
            onSelect={handleResolveMissing}
          />
        );
      })()}
    </div>
  );
}
