import React from 'react';
import { useAppSettingsStore } from '../store/appSettingsStore';

const About: React.FC = () => {
  const { siteName, footerCompanyName, footerAddress } = useAppSettingsStore();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">About {siteName}</h1>
      <div className="prose max-w-none">
        <p>
          {footerCompanyName} is a modern digital platform that helps you buy data, airtime, and
          other telecom services quickly and securely. Our mission is to make everyday digital
          utilities seamless, affordable, and reliable for everyone.
        </p>

        <h2>What We Do</h2>
        <ul>
          <li>Instant data and airtime purchases across major networks in Nigeria</li>
          <li>Secure wallet funding and virtual account for easy top-ups</li>
          <li>Transparent pricing with clear profit margins and discounts when available</li>
          <li>Responsive support and a clean, mobile-friendly experience</li>
        </ul>

        <h2>Why {siteName}?</h2>
        <ul>
          <li>Fast transactions with real-time status updates</li>
          <li>Reliable integrations with trusted providers</li>
          <li>Simple, intuitive interface designed for speed</li>
        </ul>

        <h2>Our Location</h2>
        <p>{footerAddress}</p>
      </div>
    </div>
  );
};

export default About;