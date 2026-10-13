import React, { useState } from 'react';
import { ShieldCheck, FileText, CheckCircle2, X, ExternalLink } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────
   PLATFORM PRIVACY POLICY MODAL (Kenya DPA 2019)
───────────────────────────────────────────────────────────── */
export const PrivacyPolicyModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={{ background: 'var(--bg-card, #ffffff)', borderColor: 'var(--border, #e2e8f0)' }}
      >
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--border, #e2e8f0)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Platform Privacy Policy</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">OrderUp Kenya • Business Admin & Merchant Data Governance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <div className="rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-3.5 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900 dark:text-white">Kenya Data Protection Act, 2019 Compliance</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                This policy governs data collection, lawful processing, and merchant fiduciary obligations for establishments operating on OrderUp (OrderUp Kenya).
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">1. Scope & Applicability</h4>
            <p>
              This Privacy Policy applies specifically to Business Administrators, venue operators, and staff accounts onboarded to the OrderUp multi-tenant platform. By accepting these terms during business admin onboarding, the establishment agrees to lawful processing of institutional and customer order data.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">2. Information Collected</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Business Entity Information:</strong> Business name, premises address, county, licensing details, logo, and brand parameters.</li>
              <li><strong>Business Admin & Staff Data:</strong> Full names, official email addresses, 9-digit Kenyan mobile phone numbers (+254), and role permissions.</li>
              <li><strong>Order & Transaction Records:</strong> Table assignments, items ordered, order fulfillment timestamps, and M-Pesa STK push receipt references. (Note: Customer M-Pesa PINs are strictly handled by Safaricom and never recorded on this platform).</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">3. Purpose of Processing</h4>
            <p>Data processed within the platform is strictly utilized for:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Operating digital menus, QR ordering, and table management workflows.</li>
              <li>Facilitating automated Lipa Na M-Pesa STK push and payment reconciliation.</li>
              <li>Maintaining tenant audit trails, revenue reporting, and operational analytics.</li>
              <li>Preventing fraudulent access and enforcing multi-tenant data boundaries.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">4. Data Isolation & Security Measures</h4>
            <p>
              All establishment records are partitioned using row-level tenant security and cryptographic authentication tokens. Passwords utilize one-way cryptographic salting and hashing. Transmission of data across public networks is secured using TLS 1.3 encryption.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">5. Merchant Responsibilities</h4>
            <p>
              The Business Administrator is responsible for ensuring that all staff accounts (Managers and Waiters) created under their establishment adhere to data confidentiality standards and do not disclose customer order history or phone numbers to unauthorized third parties.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">6. Contact & Data Protection Officer</h4>
            <p>
              For privacy queries, data subject access requests, or regulatory compliance verification, contact the Data Protection Office via <strong>compliance@orderup.co.ke</strong> or <strong>+254 700 000 000</strong>.
            </p>
          </div>
        </div>

        <div className="border-t px-6 py-3.5 flex justify-end" style={{ borderColor: 'var(--border, #e2e8f0)' }}>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 text-xs transition shadow-sm"
          >
            I Understand & Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   TERMS AND CONDITIONS OF SERVICE MODAL
───────────────────────────────────────────────────────────── */
export const TermsAndConditionsModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        style={{ background: 'var(--bg-card, #ffffff)', borderColor: 'var(--border, #e2e8f0)' }}
      >
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'var(--border, #e2e8f0)' }}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Terms and Conditions of Service</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Master Service Agreement for Business Administrators</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 flex items-start gap-3">
            <FileText className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900 dark:text-white">Master Service Agreement for Business Administrators</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                These terms must be reviewed and accepted by the Business Administrator prior to business onboarding.
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">1. Acceptance of Terms</h4>
            <p>
              By onboarding an establishment to OrderUp (OrderUp Kenya), the Business Administrator confirms they possess full legal authority to bind the establishment to these Terms and Conditions. This agreement takes effect immediately upon account creation.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">2. Multi-Tenant Platform Licensing</h4>
            <p>
              OrderUp provides a cloud-based software-as-a-service (SaaS) solution granting the merchant non-exclusive access to table ordering, waiter notifications, kitchen display, catalog management, and payment reconciliation modules.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">3. Business Administrator Fiduciary Duties</h4>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Credential Confidentiality:</strong> The Business Administrator must safeguard administrative login credentials and ensure initial temporary passwords are reset immediately.</li>
              <li><strong>Staff Management:</strong> The administrator is responsible for provisioning and revoking staff access (Managers, Waiters) in compliance with internal operational protocols.</li>
              <li><strong>Catalogue & Pricing Integrity:</strong> The business is solely responsible for maintaining accurate product availability, pricing, alcohol licensing compliance, and opening hours.</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">4. Payment Processing & M-Pesa Integration</h4>
            <p>
              All electronic payments initiated via Safaricom Lipa Na M-Pesa STK push are subject to standard telecommunication network availability and Daraja API settlement policies. The establishment agrees to promptly fulfill orders once automated confirmation is received on the platform.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">5. Service Uptime & Maintenance</h4>
            <p>
              OrderUp strives for 99.9% platform availability. Routine maintenance windows will be communicated in advance. The platform is not liable for indirect losses arising from third-party cellular network failures or local power disruptions.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">6. Subscription, Trials & Billing</h4>
            <p>
              Accounts provisioned under promotional or trial periods will transition to standard monthly subscription fees upon trial expiration. Failure to remit subscription dues may result in automated storefront restriction until accounts are normalized.
            </p>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-1 text-sm">7. Termination & Suspension</h4>
            <p>
              OrderUp reserves the right to suspend or terminate accounts that violate alcohol beverage control regulations, engage in fraudulent transactions, or compromise platform integrity.
            </p>
          </div>
        </div>

        <div className="border-t px-6 py-3.5 flex justify-end" style={{ borderColor: 'var(--border, #e2e8f0)' }}>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 text-xs transition shadow-sm"
          >
            I Understand & Close
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   BUSINESS ADMIN ONBOARDING COMPLIANCE MODAL
───────────────────────────────────────────────────────────── */
export const BusinessAdminOnboardingModal: React.FC<{
  open: boolean;
  businessName?: string;
  subtitle?: string;
  onAccept: () => void;
}> = ({ open, businessName, subtitle, onAccept }) => {
  const [accepted, setAccepted] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
        <div
          className="w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden p-6 space-y-5"
          style={{ background: 'var(--bg-card, #ffffff)', borderColor: 'var(--border, #e2e8f0)' }}
        >
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 shadow-inner">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              Business Admin Onboarding
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {subtitle || `Welcome${businessName ? ` to ${businessName}` : ''}! Before accessing your Business Admin portal, statutory compliance requires your formal review and acceptance of our service agreements.`}
            </p>
          </div>

          {/* Compliance Notice Card */}
          <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Statutory Requirements
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full">
                Kenya DPA 2019
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              As the designated Business Administrator, you are responsible for administrative operations, staff credential management, customer data confidentiality, and payment reconciliation for this establishment.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-blue-200/50 dark:border-blue-900/50">
              <button
                type="button"
                onClick={() => setShowPrivacy(true)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 p-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition"
              >
                <span>Privacy Policy</span>
                <ExternalLink className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => setShowTerms(true)}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-900 p-2 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 transition"
              >
                <span>Terms of Service</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Interactive Checkbox */}
          <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 cursor-pointer hover:border-blue-400 transition">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-800 dark:text-slate-200 select-none leading-relaxed">
              I confirm that I am the authorized <strong>Business Administrator</strong> and I review, acknowledge, and accept the <strong>Terms & Conditions</strong> and <strong>Privacy Policy</strong> for this business onboarding.
            </span>
          </label>

          {/* Submit Button */}
          <button
            type="button"
            disabled={!accepted}
            onClick={onAccept}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition-all shadow-lg shadow-blue-600/20 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: '#2563EB' }}
          >
            <CheckCircle2 className="h-4 w-4" />
            Accept Agreements & Enter Dashboard
          </button>
        </div>
      </div>

      <PrivacyPolicyModal open={showPrivacy} onClose={() => setShowPrivacy(false)} />
      <TermsAndConditionsModal open={showTerms} onClose={() => setShowTerms(false)} />
    </>
  );
};
