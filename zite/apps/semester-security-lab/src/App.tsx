import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { useAuth } from 'zitejs/auth';
import { Toaster } from '@project/components/ui/sonner';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import JwtPage from './pages/JwtPage';
import BucketPage from './pages/BucketPage';
import IsolationPage from './pages/IsolationPage';
import RlsPage from './pages/RlsPage';
import SuitesPage from './pages/SuitesPage';
import PoliciesPage from './pages/PoliciesPage';
import GatesPage from './pages/GatesPage';
import ArtifactsPage from './pages/ArtifactsPage';
import CapabilitiesPage from './pages/CapabilitiesPage';
import PortfolioPage from './pages/PortfolioPage';
import { AppSwitcher } from '../../semester/src/components/AppSwitcher';

export default function App() {
  const { isLoading, user } = useAuth();
  if (isLoading || !user) return null;
  return (
    <BrowserRouter>
      <AppSwitcher current="security" /><Toaster />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/jwt" element={<JwtPage />} />
          <Route path="/bucket" element={<BucketPage />} />
          <Route path="/isolation" element={<IsolationPage />} />
          <Route path="/rls" element={<RlsPage />} />
          <Route path="/suites" element={<SuitesPage />} />
          <Route path="/policies" element={<PoliciesPage />} />
          <Route path="/gates" element={<GatesPage />} />
          <Route path="/artifacts" element={<ArtifactsPage />} />
          <Route path="/capabilities" element={<CapabilitiesPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
