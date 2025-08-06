import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  MessageCircle, 
  Plus, 
  Send, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  ChevronRight, 
  CreditCard, 
  ShoppingBag, 
  Users, 
  HelpCircle,
  Laptop
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useAppSettingsStore } from '../../store/appSettingsStore';
import { supportAPI, TicketCategory } from '../../lib/supportApi';
import { SupportTicket, TicketMessage } from '../../types';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { format } from 'date-fns';

const SupportPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { footerEmail } = useAppSettingsStore();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    category: 'general' as TicketCategory,
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchTickets();
  }, [isAuthenticated, navigate]);

  const fetchTickets = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const userTickets = await supportAPI.getTickets(user.id);
      setTickets(userTickets);
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketMessages = async (ticketId: string) => {
    try {
      const messages = await supportAPI.getTicketMessages(ticketId);
      setTicketMessages(messages);
    } catch (error) {
      console.error('Error fetching ticket messages:', error);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    if (!formData.subject.trim() || !formData.message.trim()) {
      setError('Please fill in all fields');
      return;
    }
    
    setSubmitting(true);
    setError('');
    
    try {
      const ticket = await supportAPI.createTicket(
        user.id,
        formData.subject,
        formData.category,
        formData.message
      );
      
      if (ticket) {
        // Reset form and refresh tickets
        setFormData({
          subject: '',
          category: 'general',
          message: '',
        });
        setShowNewTicketForm(false);
        fetchTickets();
      } else {
        setError('Failed to create ticket. Please try again.');
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedTicket || !newMessage.trim() || !user) return;
    
    setSendingMessage(true);
    try {
      await supportAPI.addMessage(
        selectedTicket.id,
        user.id,
        newMessage,
        false // not an admin reply
      );
      
      // Update ticket status to pending admin reply
      await supportAPI.updateTicketStatus(selectedTicket.id, 'pending_admin_reply');
      
      // Refresh messages and ticket data
      fetchTicketMessages(selectedTicket.id);
      fetchTickets();
      
      // Clear input
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSelectTicket = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    await fetchTicketMessages(ticket.id);
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    
    try {
      await supportAPI.closeTicket(selectedTicket.id);
      fetchTickets();
      setSelectedTicket(null);
    } catch (error) {
      console.error('Error closing ticket:', error);
    }
  };

  const getCategoryIcon = (category: TicketCategory) => {
    switch (category) {
      case 'transaction':
        return <CreditCard size={16} className="text-purple-500" />;
      case 'order':
        return <ShoppingBag size={16} className="text-indigo-500" />;
      case 'referral':
        return <Users size={16} className="text-green-500" />;
      case 'technical':
        return <Laptop size={16} className="text-orange-500" />;
      case 'general':
      default:
        return <HelpCircle size={16} className="text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            <Clock size={12} className="mr-1" />
            Open
          </span>
        );
      case 'pending_user_reply':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
            <Clock size={12} className="mr-1" />
            Awaiting Your Reply
          </span>
        );
      case 'pending_admin_reply':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
            <Clock size={12} className="mr-1" />
            Awaiting Support
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            <CheckCircle size={12} className="mr-1" />
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            {status.replace('_', ' ')}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F9D58]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 px-4 py-4 flex items-center border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => navigate('/')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white ml-4">Support</h1>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* New Ticket Button */}
        {!showNewTicketForm && !selectedTicket && (
          <div className="mb-6">
            <Button
              onClick={() => setShowNewTicketForm(true)}
              className="w-full bg-[#0F9D58] hover:bg-[#0d8a4f] text-white"
              icon={<Plus size={16} />}
            >
              Create New Ticket
            </Button>
          </div>
        )}

        {/* New Ticket Form */}
        {showNewTicketForm && (
          <Card className="mb-6 p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create New Ticket</h2>
              <button
                onClick={() => setShowNewTicketForm(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start">
                <AlertTriangle size={16} className="mr-2 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                  placeholder="Brief description of your issue"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value as TicketCategory})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58]"
                  required
                >
                  <option value="transaction">Transaction Issue</option>
                  <option value="order">Order Issue</option>
                  <option value="referral">Referral Bonus</option>
                  <option value="technical">Technical Support</option>
                  <option value="general">General Inquiry</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Message
                </label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58] min-h-[120px]"
                  placeholder="Please describe your issue in detail"
                  required
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  You will be responded to within 1-3 hours depending on the number of staff attending to requests.
                  For urgent matters, you can also contact us at {footerEmail}.
                </p>
              </div>

              <div className="flex space-x-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowNewTicketForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[#0F9D58] hover:bg-[#0d8a4f] text-white"
                  isLoading={submitting}
                >
                  Submit Ticket
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Ticket Conversation */}
        {selectedTicket && (
          <Card className="mb-6 p-0 overflow-hidden animate-slide-up">
            {/* Ticket Header */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center">
                    <button
                      onClick={() => setSelectedTicket(null)}
                      className="mr-2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedTicket.subject}</h2>
                  </div>
                  <div className="flex items-center mt-1 ml-7 space-x-2">
                    {getStatusBadge(selectedTicket.status)}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {format(new Date(selectedTicket.created_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
                
                {selectedTicket.status !== 'closed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCloseTicket}
                    className="text-xs"
                  >
                    Close Ticket
                  </Button>
                )}
              </div>
            </div>
            
            {/* Messages */}
            <div className="p-4 max-h-[60vh] overflow-y-auto bg-gray-50 dark:bg-gray-800">
              <div className="space-y-4">
                {ticketMessages.map((message) => (
                  <div 
                    key={message.id} 
                    className={`flex ${message.is_admin_reply ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[80%] rounded-lg p-3 ${
                      message.is_admin_reply 
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white' 
                        : 'bg-[#0F9D58] text-white'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">
                          {message.is_admin_reply ? 'Support Team' : 'You'}
                        </span>
                        <span className="text-xs opacity-75">
                          {format(new Date(message.created_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Reply Box */}
            {selectedTicket.status !== 'closed' && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex space-x-2">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message here..."
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#0F9D58] min-h-[80px]"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendingMessage}
                    className="px-4 py-2 bg-[#0F9D58] text-white rounded-lg hover:bg-[#0d8a4f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center self-end"
                  >
                    {sendingMessage ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={16} className="mr-2" />
                        Send
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Tickets List */}
        {!showNewTicketForm && !selectedTicket && (
          <>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Your Tickets</h2>
            
            {tickets.length > 0 ? (
              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <Card 
                    key={ticket.id} 
                    className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => handleSelectTicket(ticket)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-full bg-[#0F9D58]/10 flex items-center justify-center">
                          {getCategoryIcon(ticket.category as TicketCategory)}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{ticket.subject}</h3>
                          <div className="flex items-center mt-1">
                            {getStatusBadge(ticket.status)}
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                              Last updated: {format(new Date(ticket.last_message_at), 'MMM d, h:mm a')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-gray-400" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center">
                <MessageCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No tickets yet</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Create a new ticket to get help from our support team.
                </p>
                <Button
                  onClick={() => setShowNewTicketForm(true)}
                  className="bg-[#0F9D58] hover:bg-[#0d8a4f] text-white"
                  icon={<Plus size={16} />}
                >
                  Create New Ticket
                </Button>
              </Card>
            )}
          </>
        )}

        {/* Quick Help Section */}
        {!showNewTicketForm && !selectedTicket && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Quick Help</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                setShowNewTicketForm(true);
                setFormData({...formData, category: 'transaction', subject: 'Transaction Issue'});
              }}>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <CreditCard size={20} className="text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Transaction Issues</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Report problems with payments, airtime, or data purchases
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                setShowNewTicketForm(true);
                setFormData({...formData, category: 'order', subject: 'Order Issue'});
              }}>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                    <ShoppingBag size={20} className="text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Order Issues</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Get help with product orders, shipping, or delivery
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                setShowNewTicketForm(true);
                setFormData({...formData, category: 'referral', subject: 'Referral Bonus Issue'});
              }}>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <Users size={20} className="text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Referral Bonus</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Questions about referral program or missing bonuses
                    </p>
                  </div>
                </div>
              </Card>
              
              <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
                setShowNewTicketForm(true);
                setFormData({...formData, category: 'technical', subject: 'Technical Support'});
              }}>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <Laptop size={20} className="text-orange-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Technical Support</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Help with app issues, errors, or account problems
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SupportPage;