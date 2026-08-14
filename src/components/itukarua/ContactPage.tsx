import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { MapPin, Phone, Mail, Clock, Send, CheckCircle, Bell } from 'lucide-react';
import { createMessage } from '@/lib/database';
import { supabaseUrl, supabaseKey } from '@/lib/supabase';

const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [honeypot, setHoneypot] = useState('');


  const formStartTime = useRef(Date.now());
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formStartTime.current = Date.now();
  }, []);

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = 'Name is required';
    if (!formData.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = 'Invalid email';
    if (!formData.message.trim()) errs.message = 'Message is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const isBot = () => {
    if (honeypot) return true;
    const elapsed = Date.now() - formStartTime.current;
    if (elapsed < 3000) return true;
    const lastSubmit = localStorage.getItem('contact_last_submit');
    if (lastSubmit) {
      const diff = Date.now() - parseInt(lastSubmit);
      if (diff < 60000) return true;
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const bot = isBot();
    if (bot) {
      setSubmitted(true);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
      return;
    }

    setLoading(true);
    try {
      await createMessage({
        sender_name: formData.name,
        sender_email: formData.email,
        subject: formData.subject || 'General Inquiry',
        message: `Phone: ${formData.phone || 'N/A'}\n\n${formData.message}`,
        type: 'support',
      });
      fetch(`${supabaseUrl}/functions/v1/send-contact-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseKey}` },
        body: JSON.stringify(formData),
      }).catch(() => {});
      localStorage.setItem('contact_last_submit', String(Date.now()));
      setSubmitted(true);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
    } catch (err: any) {
      alert(err.message || 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>Contact Us - Itukarua</title>
        <meta name="description" content="Get in touch with the Itukarua team. Send us a message and we'll respond as soon as possible." />
        <link rel="canonical" href="https://www.itukarua.co.ke/contact" />
        <meta property="og:title" content="Contact Us - Itukarua" />
        <meta property="og:description" content="Get in touch with the Itukarua team. Send us a message and we'll respond as soon as possible." />
        <meta property="og:site_name" content="Itukarua" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Contact Us - Itukarua" />
        <meta name="twitter:description" content="Get in touch with the Itukarua team. Send us a message and we'll respond as soon as possible." />
        <meta name="twitter:image" content="https://www.itukarua.co.ke/og.jpg" />
      </Helmet>
      <div className="relative py-14 lg:py-20 overflow-hidden">
        <img src="/images/contact.png" alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl lg:text-4xl font-bold text-white mb-3">Contact Us</h1>
          <p className="text-green-100 max-w-2xl mx-auto">Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">Get In Touch</h3>
              <div className="space-y-4">
                {[
                  { icon: MapPin, label: 'Address', value: 'Kikuyu Town, Kiambu County, Kenya', color: 'bg-green-100 text-green-600' },
                  { icon: Phone, label: 'Phone', value: '+254 721 219 359', color: 'bg-blue-100 text-blue-600' },
                  { icon: Mail, label: 'Email', value: 'info@itukarua.co.ke', color: 'bg-purple-100 text-purple-600' },
                  { icon: Clock, label: 'Hours', value: 'Mon - Sat: 8:00 AM - 6:00 PM', color: 'bg-amber-100 text-amber-600' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className={`w-10 h-10 ${item.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-medium">{item.label}</p>
                      <p className="text-sm text-gray-700">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-green-50 rounded-xl p-6 border border-green-100">
              <h4 className="font-semibold text-green-800 mb-2">Payment Support</h4>
              <p className="text-sm text-green-700 mb-3">Having issues with M-Pesa payments? Contact our support team for immediate assistance.</p>
              <div className="bg-white rounded-lg p-3 text-sm space-y-1">
                <p className="text-gray-600"><span className="font-semibold">M-Pesa Till No:</span> 1600149</p>
                <p className="text-gray-600"><span className="font-semibold">Business Name:</span> ITUKARUA Solutions</p>
                <p className="text-gray-600"><span className="font-semibold">Support:</span> +254 721 219 359</p>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl p-6 lg:p-8 border border-gray-100">
              {submitted ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Message Sent!</h3>
                  <p className="text-gray-500 mb-6">Thank you for reaching out. We'll get back to you within 24 hours.</p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-gray-900 mb-6">Send Us a Message</h3>
                  <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">
                    <div style={{ position: 'absolute', left: '-9999px' }} aria-hidden="true">
                      <input
                        type="text"
                        name="website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={e => setHoneypot(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={e => setFormData({ ...formData, name: e.target.value })}
                          className={`w-full px-4 py-2.5 rounded-lg border ${errors.name ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none`}
                          placeholder="John Kamau"
                        />
                        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                        <input
                          type="email"
                          value={formData.email}
                          onChange={e => setFormData({ ...formData, email: e.target.value })}
                          className={`w-full px-4 py-2.5 rounded-lg border ${errors.email ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none`}
                          placeholder="you@example.com"
                        />
                        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={e => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                          placeholder="+254 7XX XXX XXX"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                        <select
                          value={formData.subject}
                          onChange={e => setFormData({ ...formData, subject: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        >
                          <option value="">Select a subject</option>
                          <option value="general">General Inquiry</option>
                          <option value="payment">Payment Issue</option>
                          <option value="account">Account Support</option>
                          <option value="job">Job Posting Help</option>
                          <option value="advert">Advertising Help</option>
                          <option value="feedback">Feedback</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                      <textarea
                        value={formData.message}
                        onChange={e => setFormData({ ...formData, message: e.target.value })}
                        rows={5}
                        className={`w-full px-4 py-2.5 rounded-lg border ${errors.message ? 'border-red-400' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none`}
                        placeholder="How can we help you?"
                      />
                      {errors.message && <p className="text-red-500 text-xs mt-1">{errors.message}</p>}
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Send Message
                        </>
                      )}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>


      </div>
    </div>
  );
};

export default ContactPage;

