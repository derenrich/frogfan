'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CornerLeftUp, Save, Download, ChevronLeft, ChevronRight, Video, Plus, X, Pencil } from 'lucide-react';
import LabelCanvas from '@/components/LabelCanvas';
import styles from './session.module.css';

interface Point { x: number; y: number; }
interface Session {
  id: string;
  title: string;
  mediaFiles: string[];
  labelNames: string[];
  annotations: {
    [mediaPath: string]: {
      [frameIndex: string]: {
        [labelName: string]: Point;
      }
    }
  };
  dltcoef?: number[][];
  currframe?: number[];
}

export default function SessionClient({ id }: { id: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [mediaMeta, setMediaMeta] = useState<{ totalFrames: number; type: string; fps?: number } | null>(null);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [zoomPan, setZoomPan] = useState({ scale: 1, offsetX: 0, offsetY: 0 });
  const [saving, setSaving] = useState(false);
  const [showAddLabelModal, setShowAddLabelModal] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [editLabelModal, setEditLabelModal] = useState<{ oldName: string; newName: string } | null>(null);

  // Generate distinct colors for labels
  const labelColors: { [key: string]: string } = {};
  if (session) {
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
    session.labelNames.forEach((l, i) => {
      labelColors[l] = colors[i % colors.length];
    });
  }

  useEffect(() => {
    fetch(`/api/sessions/${id}`)
      .then(r => r.json())
      .then(data => {
        if (!data.error) {
          if (!data.annotations) data.annotations = {};
          setSession(data);
          if (data.labelNames.length > 0) setCurrentLabel(data.labelNames[0]);
          if (data.currframe && data.currframe.length > 0) {
            setFrameIndex(data.currframe[0]);
          }
        }
      });
  }, [id]);

  useEffect(() => {
    if (!session || !session.mediaFiles[mediaIndex]) return;
    const mediaPath = session.mediaFiles[mediaIndex];
    fetch(`/api/media?action=meta&path=${encodeURIComponent(mediaPath)}`)
      .then(r => r.json())
      .then(data => setMediaMeta(data));
  }, [session, mediaIndex]);

  const saveProgress = async (newAnnotations: any) => {
    if (!session) return;
    setSaving(true);
    try {
      await fetch(`/api/sessions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...session, annotations: newAnnotations })
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePointPlaced = useCallback((label: string, point: Point) => {
    if (!session) return;
    const mediaPath = session.mediaFiles[mediaIndex];
    const newAnns = { ...session.annotations };
    if (!newAnns[mediaPath]) newAnns[mediaPath] = {};
    if (!newAnns[mediaPath][frameIndex]) newAnns[mediaPath][frameIndex] = {};
    
    newAnns[mediaPath][frameIndex] = {
      ...newAnns[mediaPath][frameIndex],
      [label]: point
    };

    setSession({ ...session, annotations: newAnns });
    saveProgress(newAnns);
  }, [session, mediaIndex, frameIndex]);

  const handlePointRemoved = useCallback(() => {
    if (!session || !currentLabel) return;
    const mediaPath = session.mediaFiles[mediaIndex];
    if (!session.annotations[mediaPath]?.[frameIndex]?.[currentLabel]) return;

    const newAnns = { ...session.annotations };
    newAnns[mediaPath] = { ...newAnns[mediaPath] };
    newAnns[mediaPath][frameIndex] = { ...newAnns[mediaPath][frameIndex] };
    delete newAnns[mediaPath][frameIndex][currentLabel];

    setSession({ ...session, annotations: newAnns });
    saveProgress(newAnns);
  }, [session, mediaIndex, frameIndex, currentLabel]);

  const handleAddLabel = () => {
    if (!session || !newLabelName.trim()) return;
    const name = newLabelName.trim();
    if (session.labelNames.includes(name)) {
      alert('Label already exists');
      return;
    }
    const updatedSession = { ...session, labelNames: [...session.labelNames, name] };
    setSession(updatedSession);
    setNewLabelName('');
    setShowAddLabelModal(false);
    
    fetch(`/api/sessions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSession)
    });
  };

  const handleRemoveLabel = (labelToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!session) return;
    if (!window.confirm(`Are you sure you want to delete the label "${labelToRemove}" and ALL its data?`)) return;

    const newLabelNames = session.labelNames.filter(l => l !== labelToRemove);
    const newAnns = { ...session.annotations };
    
    Object.keys(newAnns).forEach(mediaPath => {
      newAnns[mediaPath] = { ...newAnns[mediaPath] };
      Object.keys(newAnns[mediaPath]).forEach(frame => {
        if (newAnns[mediaPath][frame][labelToRemove]) {
          newAnns[mediaPath][frame] = { ...newAnns[mediaPath][frame] };
          delete newAnns[mediaPath][frame][labelToRemove];
        }
      });
    });

    const updatedSession = { ...session, labelNames: newLabelNames, annotations: newAnns };
    setSession(updatedSession);
    if (currentLabel === labelToRemove) {
      setCurrentLabel(newLabelNames.length > 0 ? newLabelNames[0] : null);
    }

    fetch(`/api/sessions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSession)
    });
  };

  const handleRenameLabel = () => {
    if (!session || !editLabelModal || !editLabelModal.newName.trim()) return;
    const oldName = editLabelModal.oldName;
    const newName = editLabelModal.newName.trim();
    
    if (oldName === newName) {
      setEditLabelModal(null);
      return;
    }
    
    if (session.labelNames.includes(newName)) {
      alert('A label with this name already exists');
      return;
    }

    const newLabelNames = session.labelNames.map(l => l === oldName ? newName : l);
    const newAnns = { ...session.annotations };
    
    Object.keys(newAnns).forEach(mediaPath => {
      newAnns[mediaPath] = { ...newAnns[mediaPath] };
      Object.keys(newAnns[mediaPath]).forEach(frame => {
        if (newAnns[mediaPath][frame][oldName]) {
          newAnns[mediaPath][frame] = { ...newAnns[mediaPath][frame] };
          newAnns[mediaPath][frame][newName] = newAnns[mediaPath][frame][oldName];
          delete newAnns[mediaPath][frame][oldName];
        }
      });
    });

    const updatedSession = { ...session, labelNames: newLabelNames, annotations: newAnns };
    setSession(updatedSession);
    if (currentLabel === oldName) {
      setCurrentLabel(newName);
    }
    
    setEditLabelModal(null);

    fetch(`/api/sessions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedSession)
    });
  };

  const handleNudge = useCallback((dx: number, dy: number) => {
    if (!session || !currentLabel) return;
    const mediaPath = session.mediaFiles[mediaIndex];
    const pt = session.annotations[mediaPath]?.[frameIndex]?.[currentLabel];
    if (!pt) return;

    const newAnns = { ...session.annotations };
    newAnns[mediaPath] = { ...newAnns[mediaPath] };
    newAnns[mediaPath][frameIndex] = { ...newAnns[mediaPath][frameIndex] };
    newAnns[mediaPath][frameIndex][currentLabel] = {
      x: pt.x + dx,
      y: pt.y + dy
    };

    setSession({ ...session, annotations: newAnns });
    saveProgress(newAnns);
  }, [session, mediaIndex, frameIndex, currentLabel]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      
      if (e.key === 'ArrowLeft') {
        setFrameIndex(f => Math.max(0, f - 1));
      } else if (e.key === 'ArrowRight') {
        if (mediaMeta) setFrameIndex(f => Math.min(mediaMeta.totalFrames - 1, f + 1));
      } else if (e.key === 'Delete' || e.key === 'Backspace' || e.key.toLowerCase() === 'x') {
        handlePointRemoved();
      } else if (e.key.toLowerCase() === 'w') {
        handleNudge(0, -1);
      } else if (e.key.toLowerCase() === 's') {
        handleNudge(0, 1);
      } else if (e.key.toLowerCase() === 'a') {
        handleNudge(-1, 0);
      } else if (e.key.toLowerCase() === 'd') {
        handleNudge(1, 0);
      } else {
        // Label selection 1, 2, 3...
        const num = parseInt(e.key);
        if (!isNaN(num) && session && num > 0 && num <= session.labelNames.length) {
          setCurrentLabel(session.labelNames[num - 1]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session, mediaMeta, handlePointRemoved, handleNudge]);

  const exportCSV = () => {
    if (!session) return;
    let csv = 'mediaPath,frameIndex,label,x,y\n';
    Object.entries(session.annotations).forEach(([media, frames]) => {
      Object.entries(frames).forEach(([frame, labels]) => {
        Object.entries(labels).forEach(([label, point]) => {
          csv += `"${media}",${frame},"${label}",${point.x},${point.y}\n`;
        });
      });
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.title}_export.csv`;
    a.click();
  };

  if (!session) return <div className={styles.loading}>Loading session...</div>;

  const currentMediaPath = session.mediaFiles[mediaIndex];
  const currentPoints = session.annotations[currentMediaPath]?.[frameIndex] || {};
  const fpsParam = mediaMeta?.fps ? `&fps=${mediaMeta.fps}` : '';
  const imageUrl = `/api/media?action=frame&path=${encodeURIComponent(currentMediaPath)}&frame=${frameIndex}${fpsParam}`;

  return (
    <div className={styles.layout}>
      <div className={styles.sidebar}>
        <div className={styles.header}>
          <Link href="/" className={styles.backBtn}><CornerLeftUp size={18} /></Link>
          <h2>{session.title}</h2>
        </div>

        <div className={styles.section}>
          <h3>Cameras / Media</h3>
          <div className={styles.mediaList}>
            {session.mediaFiles.map((m, i) => (
              <button 
                key={m} 
                className={`${styles.mediaBtn} ${i === mediaIndex ? styles.active : ''}`}
                onClick={() => setMediaIndex(i)}
                title={m}
              >
                <Video size={16} /> View {i + 1}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <h3>Labels (Keys 1-{session.labelNames.length})</h3>
          <div className={styles.labelList}>
            {session.labelNames.map((l, i) => (
              <div key={l} className={styles.labelItemWrapper}>
                <button
                  className={`${styles.labelBtn} ${l === currentLabel ? styles.active : ''}`}
                  onClick={() => setCurrentLabel(l)}
                  style={{ flex: 1 }}
                >
                  <span className={styles.colorDot} style={{ background: labelColors[l] }} />
                  <span className={styles.keyHint}>{i + 1}</span> {l}
                </button>
                <button 
                  className={styles.deleteLabelBtn} 
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditLabelModal({ oldName: l, newName: l });
                  }} 
                  title="Rename Label"
                >
                  <Pencil size={14} />
                </button>
                <button className={styles.deleteLabelBtn} onClick={(e) => handleRemoveLabel(l, e)} title="Delete Label">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.bottomActions}>
          <button className={styles.actionBtn} onClick={() => setShowAddLabelModal(true)}>
            <Plus size={18} /> Add New Label
          </button>
          <button className={styles.actionBtn} onClick={() => saveProgress(session.annotations)}>
            <Save size={18} /> {saving ? 'Saving...' : 'Save'}
          </button>
          <button className={styles.actionBtn} onClick={exportCSV}>
            <Download size={18} /> Export CSV
          </button>
        </div>
      </div>

      <div className={styles.main}>
        <div className={styles.toolbar}>
          <button 
            className={styles.iconBtn} 
            disabled={frameIndex <= 0} 
            onClick={() => setFrameIndex(f => Math.max(0, f - 1))}
          >
            <ChevronLeft />
          </button>
          
          <div className={styles.scrubberContainer}>
            <input 
              type="range" 
              min="0" 
              max={mediaMeta && !isNaN(mediaMeta.totalFrames) ? Math.max(0, mediaMeta.totalFrames - 1) : 0} 
              value={frameIndex}
              onChange={(e) => setFrameIndex(parseInt(e.target.value))}
              className={styles.scrubber}
            />
            <div className={styles.frameInfo}>
              Frame {frameIndex} / {mediaMeta && !isNaN(mediaMeta.totalFrames) ? mediaMeta.totalFrames - 1 : 0}
            </div>
          </div>

          <button 
            className={styles.iconBtn} 
            disabled={!mediaMeta || frameIndex >= mediaMeta.totalFrames - 1}
            onClick={() => setFrameIndex(f => Math.min((mediaMeta?.totalFrames || 1) - 1, f + 1))}
          >
            <ChevronRight />
          </button>

          <button className={styles.btnSecondary} onClick={() => setZoomPan({ scale: 1, offsetX: 0, offsetY: 0 })}>
            Reset View
          </button>
        </div>

        <div className={styles.canvasContainer}>
          <LabelCanvas
            imageUrl={imageUrl}
            points={currentPoints}
            currentLabel={currentLabel}
            onPointPlaced={handlePointPlaced}
            zoomPanState={zoomPan}
            onZoomPanChange={setZoomPan}
            labelColors={labelColors}
          />
        </div>
      </div>

      {showAddLabelModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>Add New Label</h3>
            <input
              type="text"
              autoFocus
              className={styles.modalInput}
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddLabel();
                if (e.key === 'Escape') setShowAddLabelModal(false);
              }}
              placeholder="e.g. Right Hand"
            />
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setShowAddLabelModal(false)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleAddLabel} disabled={!newLabelName.trim()}>Add</button>
            </div>
          </div>
        </div>
      )}

      {editLabelModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3>Rename Label</h3>
            <input
              type="text"
              autoFocus
              className={styles.modalInput}
              value={editLabelModal.newName}
              onChange={(e) => setEditLabelModal({ ...editLabelModal, newName: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameLabel();
                if (e.key === 'Escape') setEditLabelModal(null);
              }}
              placeholder="e.g. Right Hand"
            />
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setEditLabelModal(null)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={handleRenameLabel} disabled={!editLabelModal.newName.trim()}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
