import React from 'react';

const FAQ: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Frequently Asked Questions</h1>
      <div className="prose max-w-none space-y-6">
        <div>
          <h2>How fast are data and airtime purchases?</h2>
          <p>Most transactions complete instantly. In rare cases due to network congestion, it may take a few minutes.</p>
        </div>
        <div>
          <h2>What networks do you support?</h2>
          <p>We support MTN, Airtel, Glo, and 9Mobile for data and airtime purchases.</p>
        </div>
        <div>
          <h2>How do I fund my wallet?</h2>
          <p>You can fund your wallet via bank transfer to your virtual account or with supported payment methods in the app.</p>
        </div>
        <div>
          <h2>What if my transaction is pending?</h2>
          <p>Pending transactions usually resolve within minutes. If it persists, contact support with your transaction reference.</p>
        </div>
        <div>
          <h2>Can I get a refund?</h2>
          <p>Refunds are available for failed or duplicate transactions after verification. Reach out to support with details.</p>
        </div>
      </div>
    </div>
  );
};

export default FAQ;