import { useEffect, useState } from 'react';
import { DashboardPage } from '@/pages/DashboardPage';
import { CrewCertificatesPage } from '@/pages/CrewCertificatesPage';
import { AddCrewCertificateEvidencePage } from '@/pages/AddCrewCertificateEvidencePage';

export function App() {
  const [path, setPath] = useState(window.location.hash);

  useEffect(() => {
    const handleHashChange = () => setPath(window.location.hash);
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const addCertificateMatch = path.match(/^#\/crew\/([^/]+)\/add-certificate$/);

  if (addCertificateMatch) {
    return <AddCrewCertificateEvidencePage memberId={addCertificateMatch[1]} />;
  }

  return path === '#/crew' ? <CrewCertificatesPage /> : <DashboardPage />;
}
