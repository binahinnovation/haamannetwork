import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Card from '../components/ui/Card';

const AboutPage: React.FC = () => {
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
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white ml-4">About Us</h1>
      </div>

      <div className="p-4 space-y-6">
        <Card className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Our Story</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            Haaman Network is a leading digital services and e-commerce platform dedicated to simplifying your daily transactions and online shopping experience. Founded with the vision of providing a secure, fast, and convenient platform, we aim to be your go-to solution for all digital needs.
          </p>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            We believe in empowering our users by offering a wide range of services, from seamless bill payments to a diverse e-commerce store, all accessible from one intuitive platform. Our commitment to innovation, security, and customer satisfaction drives everything we do.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Our Mission</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            To provide a reliable and user-friendly platform that integrates essential digital services and e-commerce, making everyday transactions effortless and secure for everyone.
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Our Vision</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
            To be the most trusted and preferred digital services and e-commerce platform, continuously innovating to meet the evolving needs of our community.
          </p>
        </Card>
      </div>
    </div>
  );
};

export default AboutPage;