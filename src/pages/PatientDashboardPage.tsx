import { Link, Route, Routes } from 'react-router-dom';
import { useAuthStore } from '../store/auth-store';
import { ActingForBanner } from '../features/dependents/components/ActingForBanner';
import { useProfileBootstrap } from '../features/patients/hooks/useProfileBootstrap';
import { DependentsPage } from './DependentsPage';
import { HealthProfilePage } from './HealthProfilePage';
import { MedicationSchedulePage } from './MedicationSchedulePage';

function PatientHome() {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="container">
      <ActingForBanner />
      <div className="card">
        <span className="statusPill">Phase W2 · in progress</span>
        <h1>Welcome{user ? `, ${user.email}` : ''}</h1>
        <p>Doctor search, booking, and your appointments will live here — see ROADMAP.md Phase W2.</p>
        <nav style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
          <Link to="dependents">Manage dependents</Link>
          <Link to="health">Health profile</Link>
          <Link to="medications">Medication schedule</Link>
        </nav>
      </div>
    </div>
  );
}

export function PatientDashboardPage() {
  // Profile-scoped reads (`/patients/:profileId/...`) need the caller's own
  // profile id, which the auth session does not carry.
  useProfileBootstrap();

  return (
    <Routes>
      <Route index element={<PatientHome />} />
      <Route path="dependents" element={<DependentsPage />} />
      <Route path="health" element={<HealthProfilePage />} />
      <Route path="medications" element={<MedicationSchedulePage />} />
    </Routes>
  );
}
