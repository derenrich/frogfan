import Link from 'next/link';
import { Plus } from 'lucide-react';
import styles from './page.module.css';

export default async function Home() {
  // Fetch sessions on server component (needs absolute URL if using fetch, or just direct FS call)
  // For simplicity since we are on the server, let's just use fetch to absolute or use a helper
  // In Next.js app router server components, fetch requires absolute URL.
  // Instead, let's make it a Client Component so it fetches dynamically, or use the direct handler.
  // We'll make it a client component for easy refetching.
  return <HomeClient />;
}

import HomeClient from './HomeClient';
