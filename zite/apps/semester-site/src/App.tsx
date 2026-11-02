import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import { Updates, UpdatePost } from './Updates';
import { Home, Pilot, PilotRequest, Pricing, TrustLayout, TrustOverview, TrustSecurity, TrustPrivacy, TrustAccessibility, TrustAI, TrustStatus, Mission, Contact, NotFound } from './pages';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/pilot" element={<Pilot />} />
          <Route path="/pilot/request" element={<PilotRequest />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/trust" element={<TrustLayout />}>
            <Route index element={<TrustOverview />} />
            <Route path="security" element={<TrustSecurity />} />
            <Route path="privacy" element={<TrustPrivacy />} />
            <Route path="accessibility" element={<TrustAccessibility />} />
            <Route path="responsible-ai" element={<TrustAI />} />
            <Route path="status" element={<TrustStatus />} />
          </Route>
          <Route path="/updates" element={<Updates />} />
          <Route path="/updates/:slug" element={<UpdatePost />} />
          <Route path="/mission" element={<Mission />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
