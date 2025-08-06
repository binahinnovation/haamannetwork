import React from 'react';
import { useAppSettingsStore } from '../store/appSettingsStore';

const Privacy: React.FC = () => {
  const { footerEmail, footerCompanyName } = useAppSettingsStore();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <div className="prose max-w-none">
        {/* Your privacy policy content here */}
        <p><strong>Effective Date:</strong> 1st June, 2025</p>

  <p>At <strong>{footerCompanyName}</strong>, your privacy is important to us. This policy explains how we collect, use, and protect your information.</p>

  <h2>1. Information We Collect</h2>
  <ul>
    <li><strong>Personal Information:</strong> Name, email, phone number</li>
    <li><strong>Payment Information:</strong> Handled securely via payment processors</li>
    <li><strong>Usage Data:</strong> Website visits, preferences</li>
  </ul>

  <h2>2. How We Use Your Information</h2>
  <ul>
    <li>To process your purchases</li>
    <li>To communicate with you</li>
    <li>To improve our services</li>
  </ul>

  <h2>3. Data Sharing</h2>
  <p>We do not sell or rent your personal data. Your data may be shared with third-party service providers (e.g., payment processors) only as needed to complete your transaction.</p>

  <h2>4. Security</h2>
  <p>We implement appropriate security measures to protect your data. However, no system is 100% secure.</p>

  <h2>5. Your Rights</h2>
  <p>You may request access, correction, or deletion of your data by contacting us at {footerEmail}.</p>
      </div>
    </div>
  );
};

export default Privacy;
