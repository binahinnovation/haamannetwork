import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { supabase } from '../../lib/supabase';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [resetPasswordMode, setResetPasswordMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(formData.email, formData.password);
      navigate('/');
    } catch (error: any) {
      setError(error.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      
      setResetSuccess(true);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 bg-[#0F9D58] rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-2xl">H</span>
          </div>
        </div>

        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {resetPasswordMode ? 'Reset Password' : 'Welcome Back'}
          </h2>
          <p className="text-gray-600">
            {resetPasswordMode ? 'Enter your email to reset your password' : 'Sign in to continue'}
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <AlertCircle className="text-red-500" size={20} />
              <span className="text-red-700 text-sm">{error}</span>
            </div>
          )}

          {resetPasswordMode ? (
            <>
              {resetSuccess ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="text-green-500" size={24} />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Check your email</h3>
                  <p className="text-gray-600 mb-6">
                    We've sent a password reset link to <strong>{resetEmail}</strong>. 
                    Please check your inbox and follow the instructions.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResetPasswordMode(false);
                      setResetSuccess(false);
                    }}
                    fullWidth
                  >
                    Back to Login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-6">
                  <Input
                    label="Email Address"
                    name="email"
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    leftIcon={<Mail size={16} />}
                    required
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={resetLoading}
                    fullWidth
                  >
                    Send Reset Link
                  </Button>

                  <div className="text-center">
                    <Button
                      variant="link"
                      onClick={() => setResetPasswordMode(false)}
                    >
                      Back to Login
                    </Button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Field */}
              <Input
                label="Email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                leftIcon={<Mail size={16} />}
                placeholder="Enter your email"
              />

              {/* Password Field */}
              <div>
                <Input
                  label="Password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  leftIcon={<Lock size={16} />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                  placeholder="Enter your password"
                />
              </div>

              {/* Login Button */}
              <Button
                type="submit"
                variant="primary"
                isLoading={isLoading}
                fullWidth
              >
                {isLoading ? 'Signing in...' : 'Login'}
              </Button>

              {/* Reset Password Link */}
              <div className="text-center">
                <Button
                  variant="link"
                  onClick={() => setResetPasswordMode(true)}
                >
                  Reset Password
                </Button>
              </div>
            </form>
          )}

          {/* Sign Up Link */}
          {!resetPasswordMode && (
            <div className="mt-8 text-center">
              <p className="text-gray-600">
                Don't have an account?{' '}
                <Link
                  to="/signup"
                  className="text-[#0F9D58] hover:text-[#0d8a4f] font-semibold transition-colors duration-200"
                >
                  Sign up
                </Link>
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;