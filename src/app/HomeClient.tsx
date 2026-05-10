'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Video, Trash2 } from 'lucide-react';
import styles from './page.module.css';

export default function HomeClient() {
  const [sessions, setSessions] = useState<{id: string, title: string, updatedAt: number}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/sessions`)
      .then(r => r.json())
      .then(data => {
        if (!data.error) setSessions(data);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string, title: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!window.confirm(`Are you sure you want to permanently delete the session "${title}"?`)) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/sessions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSessions(sessions.filter(s => s.id !== id));
      } else {
        alert('Failed to delete session');
      }
    } catch (err) {
      console.error(err);
      alert('Error occurred while deleting');
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logo}>
          <Video color="var(--primary)" />
          <h1>Frogfan</h1>
        </div>
        <Link href="/new" className={styles.newBtn}>
          <Plus size={18} /> New Session
        </Link>
      </header>

      <main className={styles.main}>
        <h2>Recent Sessions</h2>
        {loading ? (
          <p className={styles.emptyState}>Loading sessions...</p>
        ) : sessions.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No labeling sessions found.</p>
            <Link href="/new" className={styles.newBtnLg}>Create your first session</Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {sessions.map(s => (
              <div key={s.id} className={styles.cardWrapper}>
                <Link href={`/session/${s.id}`} className={styles.card}>
                  <h3>{s.title}</h3>
                  <p>Last updated: {new Date(s.updatedAt).toLocaleDateString()}</p>
                </Link>
                <button 
                  className={styles.deleteBtn} 
                  onClick={(e) => handleDelete(s.id, s.title, e)}
                  title="Delete Session"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
