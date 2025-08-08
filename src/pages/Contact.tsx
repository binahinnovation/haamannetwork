import React from 'react';
import { useAppSettingsStore } from '../store/appSettingsStore';

const Contact: React.FC = () => {
  const { footerEmail, footerPhone, footerAddress, footerCompanyName } = useAppSettingsStore();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Contact Us</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="prose max-w-none">
          <p>
            We’d love to hear from you. If you have questions about your transactions, wallet,
            or our services, contact the {footerCompanyName} support team.
          </p>
          <h2>Contact Details</h2>
          <ul>
            <li><strong>Email:</strong> {footerEmail}</li>
            <li><strong>Phone:</strong> {footerPhone}</li>
            <li><strong>Address:</strong> {footerAddress}</li>
          </ul>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold mb-4">Send us a message</h2>
          <div className="space-y-4">
            <input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" placeholder="Your name" />
            <input className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" placeholder="Your email" />
            <textarea className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700" rows={4} placeholder="Your message" />
            <button className="px-4 py-2 bg-[#0F9D58] text-white rounded-lg">Send</button>
            <p className="text-xs text-gray-500">This form is a placeholder. Please use the email or phone above for urgent issues.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;