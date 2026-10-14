import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useParams } from 'react-router-dom';
import { DigitalStorefrontPage } from './pages/DigitalStorefrontPage';
import { useTheme } from '@orderup/ui';
import type { ClubBranding } from '@orderup/ui';

// ─── Mock Club Registry ──────────────────────────────────────────────────────
// In production this would come from GET /api/v1/clubs/:slug/branding
const CLUB_REGISTRY: Record<string, ClubBranding> = {
  'quiver-kilimani': {
    primaryColor:    '#DC2626',
    secondaryColor:  '#991B1B',
    accentColor:     '#FCA5A5',
    name:            'Quiver Lounge Kilimani',
    welcomeMessage:  'Enjoy our premium drinks.',
    logoUrl:         '',
    bannerUrl:       '',
  },
  'club-hypnotiq': {
    primaryColor:    '#7C3AED',
    secondaryColor:  '#5B21B6',
    accentColor:     '#DDD6FE',
    name:            'Club Hypnotiq',
    welcomeMessage:  'Where the night comes alive.',
    logoUrl:         '',
    bannerUrl:       '',
  },
  'skylounge': {
    primaryColor:    '#0EA5E9',
    secondaryColor:  '#0369A1',
    accentColor:     '#BAE6FD',
    name:            'Sky Lounge Westlands',
    welcomeMessage:  'Sip above the city.',
    logoUrl:         '',
    bannerUrl:       '',
  },
  'eden': {
    primaryColor:    '#10B981',
    secondaryColor:  '#047857',
    accentColor:     '#A7F3D0',
    name:            'Eden Bar & Grill',
    welcomeMessage:  'Fresh vibes. Fresh drinks.',
    logoUrl:         '',
    bannerUrl:       '',
  },
};

const DEFAULT_BRANDING: ClubBranding = CLUB_REGISTRY['quiver-kilimani'];

// ─── Branding Engine ─────────────────────────────────────────────────────────
/**
 * Reads the :venueSlug from the URL and applies the club's CSS variables.
 * Falls back to the default Quiver Lounge branding.
 */

const ClubBrandingEngine: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { venueSlug } = useParams<{ venueSlug?: string }>();
  const { applyClubBranding } = useTheme();

  useEffect(() => {
    // Apply branding immediately from the static registry (instant — no network request).
    // DigitalStorefrontPage fetches the full tenant data and applies live branding from the
    // API response, so a duplicate fetch here is unnecessary and wastes a network request.
    const branding = (venueSlug && CLUB_REGISTRY[venueSlug]) || DEFAULT_BRANDING;
    applyClubBranding(branding);
  }, [venueSlug, applyClubBranding]);

  return <>{children}</>;
};

// ─── App ─────────────────────────────────────────────────────────────────────
export const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Default: apply Quiver Kilimani branding */}
        <Route
          path="/"
          element={
            <ClubBrandingEngine>
              <DigitalStorefrontPage />
            </ClubBrandingEngine>
          }
        />
        {/* Club-specific: branding loaded from slug */}
        <Route
          path="/v/:venueSlug"
          element={
            <ClubBrandingEngine>
              <DigitalStorefrontPage />
            </ClubBrandingEngine>
          }
        />
        <Route
          path="/v/:venueSlug/t/:tableNum"
          element={
            <ClubBrandingEngine>
              <DigitalStorefrontPage />
            </ClubBrandingEngine>
          }
        />
        {/* Legacy short URL: /quiver-kilimani/table/12 */}
        <Route
          path="/:venueSlug/table/:tableNum"
          element={
            <ClubBrandingEngine>
              <DigitalStorefrontPage />
            </ClubBrandingEngine>
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
