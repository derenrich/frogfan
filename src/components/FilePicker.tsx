import React, { useState, useEffect } from 'react';
import { Folder, FileVideo, FileImage, CornerLeftUp, Check } from 'lucide-react';
import styles from './FilePicker.module.css';

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  isMedia: boolean;
}

interface FilePickerProps {
  onSelect: (paths: string[]) => void;
  multiSelect?: boolean;
  directoriesOnly?: boolean;
  accept?: string;
  title?: string;
  message?: React.ReactNode;
  onClose: () => void;
}

export default function FilePicker({ onSelect, multiSelect = false, directoriesOnly = false, accept, title, message, onClose }: FilePickerProps) {
  const [currentPath, setCurrentPath] = useState('');
  const [parentPath, setParentPath] = useState('');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchDir = async (pathStr: string, isFallback = false) => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/fs?path=${encodeURIComponent(pathStr)}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCurrentPath(data.currentPath);
      setParentPath(data.parentPath);
      setFiles(data.files);
      localStorage.setItem('frogfan_last_directory', data.currentPath);
    } catch (err) {
      console.error(err);
      if (!isFallback && pathStr !== '') {
        fetchDir('', true);
      } else {
        alert('Failed to read directory');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const lastDir = localStorage.getItem('frogfan_last_directory') || '';
    fetchDir(lastDir);
  }, []);

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.isDirectory) {
      fetchDir(entry.path);
    } else {
      if (directoriesOnly) return;
      toggleSelection(entry.path);
    }
  };

  const toggleSelection = (path: string) => {
    const newSel = new Set(selected);
    if (newSel.has(path)) {
      newSel.delete(path);
    } else {
      if (!multiSelect) newSel.clear();
      newSel.add(path);
    }
    setSelected(newSel);
  };

  const confirmSelection = () => {
    if (directoriesOnly) {
      onSelect([currentPath]);
    } else {
      onSelect(Array.from(selected));
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>{title || `Select ${directoriesOnly ? 'Directory' : 'Files'}`}</h3>
          <button onClick={onClose} className={styles.closeBtn}>&times;</button>
        </div>
        {message && <div style={{ padding: '0 1.5rem', color: 'var(--text-muted)' }}>{message}</div>}
        <div className={styles.pathBar}>
          <button disabled={!parentPath} onClick={() => fetchDir(parentPath)} className={styles.iconBtn}>
            <CornerLeftUp size={18} />
          </button>
          <div className={styles.pathText}>{currentPath}</div>
        </div>
        <div className={styles.fileList}>
          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : (
            files.map(f => {
              if (directoriesOnly && !f.isDirectory) return null;
              if (!directoriesOnly && !f.isDirectory && accept) {
                if (accept === '.mat' && !f.name.toLowerCase().endsWith('.mat')) return null;
              }
              
              const isSelected = selected.has(f.path);
              return (
                <div 
                  key={f.path} 
                  className={`${styles.fileEntry} ${isSelected ? styles.selected : ''}`}
                  onClick={() => handleEntryClick(f)}
                >
                  <div className={styles.icon}>
                    {f.isDirectory ? <Folder size={18} color="var(--primary)" /> : 
                     f.name.match(/\.(mat)$/i) ? <FileVideo size={18} color="var(--primary)" /> :
                     f.name.match(/\.(mp4|mov|avi)$/i) ? <FileVideo size={18} color="var(--text-muted)" /> :
                     <FileImage size={18} color="var(--text-muted)" />}
                  </div>
                  <div className={styles.filename}>{f.name}</div>
                  {isSelected && <Check size={16} className={styles.checkIcon} color="var(--primary)" />}
                </div>
              );
            })
          )}
        </div>
        <div className={styles.footer}>
          {!directoriesOnly && <span>{selected.size} selected</span>}
          <div className={styles.actions}>
            <button className={styles.btnSecondary} onClick={onClose}>Cancel</button>
            <button className={styles.btnPrimary} onClick={confirmSelection} disabled={!directoriesOnly && selected.size === 0}>
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
