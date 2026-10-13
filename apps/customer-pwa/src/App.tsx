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
const getApiUrl = (path: string): string => {
  const envUrl = import.meta.env?.VITE_API_URL || (import.meta as any).env?.VITE_API_URL;
  let base = envUrl ? envUrl.trim() : 'http://localhost:5000/api/v1';
  if (base.endsWith('/')) base = base.slice(0, -1);
  if (!base.includes('/api/v1')) base = `${base}/api/v1`;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

const ClubBrandingEngine: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { venueSlug } = useParams<{ venueSlug?: string }>();
  const { applyClubBranding } = useTheme();

  useEffect(() => {
    if (!venueSlug) {
      applyClubBranding(DEFAULT_BRANDING);
      return;
    }

    fetch(getApiUrl(`/tenants/${venueSlug}`))
      .then((res) => res.json())
      .then((data) => {
        const club = data.data?.club ?? data.data ?? data;
        if (club && club.name) {
          applyClubBranding({
            primaryColor: club.brandColor || club.themeColor || '#DC2626',
            secondaryColor: club.brandColor || '#991B1B',
            accentColor: '#F59E0B',
            name: club.name || 'OrderUp Venue',
            welcomeMessage: club.tagline || 'Enjoy our premium drinks.',
            logoUrl: club.logoUrl || '',
            bannerUrl: club.bannerUrl || '',
          });
        } else {
          const fallback = CLUB_REGISTRY[venueSlug] || DEFAULT_BRANDING;
          applyClubBranding(fallback);
        }
      })
      .catch(() => {
        const fallback = CLUB_REGISTRY[venueSlug] || DEFAULT_BRANDING;
        applyClubBranding(fallback);
      });
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
