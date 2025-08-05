import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import Card from '../../components/ui/Card';

const faqs = [
  { question: 'Why Should I use Haaman Network?', answer: 'Haaman Network provides a secure, fast, and convenient way to pay all your bills and shop online in one place.' },
  { question: 'How Can I Pay For Utility On Haaman Network?', answer: 'You can pay for utilities by funding your wallet and selecting the utility service you want to pay for. (Note: Electricity bill payment is currently unavailable due to API changes.)' },
  { question: 'How do I Pay Or deposit on Haaman Network?', answer: 'You can deposit funds using your debit/credit card or bank transfer through our secure payment gateway. (Note: Wallet funding is currently undergoing verification with our partners.)' },
  { question: 'What Happens If my card doesn\'t work?', answer: 'If your card doesn\'t work, please contact our support team or try using a different payment method.' },
  { question: 'I was debited for a failed transaction', answer: 'If you were debited for a failed transaction, please contact our support team with your transaction reference for immediate resolution.' },
  { question: 'What is Haaman Network?', answer: 'Haaman Network is a leading digital services and e-commerce platform that enables users to easily and securely pay for various bills, subscriptions, and shop online.' },
  { question: 'Is Haaman Network safe and secure to use?', answer: 'Yes, Haaman Network uses advanced security measures to protect your personal and financial information.' },
  { question: 'How do I add money to my Haaman Network wallet?', answer: 'You can add money to your wallet using debit/credit cards or bank transfers through our secure payment system. (Note: Wallet funding is currently undergoing verification with our partners.)' },
];

const FaqPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 px-4 py-4 flex items-center border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white ml-4">Frequently Asked Questions</h1>
      </div>

      <div className="p-4 space-y-4">
        {faqs.map((faq, index) => (
          <details key={index} className="group">
            <summary className="flex justify-between items-center p-4 bg-white dark:bg-gray-800 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
              <span className="font-medium text-sm sm:text-base pr-4 text-gray-900 dark:text-white">{faq.question}</span>
              <ChevronDown className="w-5 h-5 group-open:rotate-180 transition-transform flex-shrink-0 text-gray-500 dark:text-gray-400" />
            </summary>
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-b-xl">
              <p className="text-gray-600 dark:text-gray-300 text-sm sm:text-base">{faq.answer}</p>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
};

export default FaqPage;