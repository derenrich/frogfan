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
  const [saving, setSaving] = useState(false);

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
          mediaFiles: mediaPaths
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

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1>Create Labeling Session</h1>
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
            <button type="button" className={styles.btnSecondary} onClick={() => setShowPicker(true)}>
              Browse Server Files...
            </button>
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
    </div>
  );
}
