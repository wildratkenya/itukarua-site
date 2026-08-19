import React, { useState } from 'react';
import { MapPin, Phone, Mail, Facebook, Twitter, Send, X } from 'lucide-react';
import type { Page } from './Header';
import { TERMS_AND_CONDITIONS, PRIVACY_POLICY } from '@/data/termsContent';
import { subscribeNewsletter } from '@/lib/database';
interface FooterProps {
  onNavigate: (page: Page) => void;
  onOpenAuth: (tab: 'login' | 'signup') => void;
}
const Footer: React.FC<FooterProps> = ({
  onNavigate,
  onOpenAuth
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [subError, setSubError] = useState('');
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubError('');
    const hp = (document.querySelector('input[name="_website"]') as HTMLInputElement)?.value;
    if (hp) return;
    if (!name.trim()) { setSubError('Name is required'); return; }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setSubError('Invalid email'); return; }
    const result = await subscribeNewsletter(email.trim(), name.trim());
    if (result.error) { setSubError(result.error); return; }
    setSubscribed(true);
    setName('');
    setEmail('');
    setTimeout(() => setSubscribed(false), 4000);
  };
  return <footer className="bg-gray-900 text-gray-300">
      {/* Newsletter Banner */}
      <div className="bg-gradient-to-r from-green-700 to-green-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-bold text-white">Stay Updated with Itukarua</h3>
              <p className="text-green-100 text-sm mt-1">Get the latest jobs, services, and community updates delivered to your inbox.</p>
            </div>
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row w-full md:w-auto gap-2 items-start sm:items-center">
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="flex-1 md:w-48 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-green-200 focus:ring-2 focus:ring-white/30 focus:border-transparent outline-none" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" className="flex-1 md:w-64 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-green-200 focus:ring-2 focus:ring-white/30 focus:border-transparent outline-none" />
              </div>
              <input type="text" name="_website" value="" onChange={() => {}} tabIndex={-1} autoComplete="off" className="absolute left-[-9999px] h-0 w-0 opacity-0" aria-hidden="true" />
              <button type="submit" className="px-6 py-3 bg-white text-green-700 font-semibold rounded-lg hover:bg-green-50 transition-colors flex items-center gap-2 shrink-0">
                <Send className="w-4 h-4" />
                {subscribed ? 'Subscribed!' : 'Subscribe'}
              </button>
              {subError && <p className="text-sm text-red-300 w-full sm:hidden">{subError}</p>}
            </form>
            {subError && <p className="text-sm text-red-300 hidden sm:block mt-1">{subError}</p>}
          </div>
        </div>
      </div>

      {/* Terms Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowTerms(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900">Terms of Service</h2>
              <button onClick={() => setShowTerms(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 text-sm text-gray-700 whitespace-pre-line leading-relaxed">{TERMS_AND_CONDITIONS}</div>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowPrivacy(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900">Privacy Policy</h2>
              <button onClick={() => setShowPrivacy(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 text-sm text-gray-700 whitespace-pre-line leading-relaxed">{PRIVACY_POLICY}</div>
          </div>
        </div>
      )}

      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">ITUKARUA</span>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Connecting local communities across Kenya. Bridging the gap between opportunity and talent, fostering economic growth in every county.
            </p>
            <div className="flex gap-3">
              <a href="#" onClick={e => e.preventDefault()} className="w-9 h-9 bg-gray-800 hover:bg-green-600 rounded-lg flex items-center justify-center transition-colors">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="#" onClick={e => e.preventDefault()} className="w-9 h-9 bg-gray-800 hover:bg-green-600 rounded-lg flex items-center justify-center transition-colors">
                <Twitter className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {[{
              label: 'Browse Jobs',
              page: 'jobs' as Page
            }, {
              label: 'Find Services',
              page: 'services' as Page
            }, {
              label: 'Pricing Plans',
              page: 'pricing' as Page
            }, {
              label: 'Contact Us',
              page: 'contact' as Page
            }].map(link => <li key={link.page}>
                  <button onClick={() => onNavigate(link.page)} className="text-sm text-gray-400 hover:text-green-400 transition-colors">
                    {link.label}
                  </button>
                </li>)}
                <li>
                  <a href="https://ikenya-ebon.vercel.app/about" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-green-400 transition-colors">
                    About Us
                  </a>
                </li>
            </ul>
          </div>

          {/* For Users */}
          <div>
            <h4 className="text-white font-semibold mb-4">For Users</h4>
            <ul className="space-y-2">
              <li><button onClick={() => onNavigate('post-job')} className="text-sm text-gray-400 hover:text-green-400 transition-colors">Post a Job</button></li>
              <li><button onClick={() => onOpenAuth('signup')} className="text-sm text-gray-400 hover:text-green-400 transition-colors">Register as Jobseeker</button></li>
              <li><button onClick={() => onNavigate('post-advert')} className="text-sm text-gray-400 hover:text-green-400 transition-colors">Advertise Business</button></li>
              <li><button onClick={() => onNavigate('pricing')} className="text-sm text-gray-400 hover:text-green-400 transition-colors">M-Pesa Payments</button></li>
              <li><button onClick={() => setShowTerms(true)} className="text-sm text-gray-400 hover:text-green-400 transition-colors">Terms of Service</button></li>
              <li><button onClick={() => setShowPrivacy(true)} className="text-sm text-gray-400 hover:text-green-400 transition-colors">Privacy Policy</button></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-4">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-400">Kikuyu Town, Kiambu County, Kenya</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-gray-400">+254 721 219359</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-gray-400">info@itukarua.co.ke</span>
              </li>
            </ul>
            <div className="mt-4 p-3 bg-gray-800 rounded-lg">
              <p className="text-xs text-gray-400">
                <span className="text-green-400 font-semibold">M-Pesa Till No:</span> 1600149
              </p>
              <p className="text-xs text-gray-400 mt-1">
                <span className="text-green-400 font-semibold">Business Name:</span> ITUKARUA KENYA
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500" data-mixed-content="true">
            &copy; {new Date().getFullYear()} ITUKARUA KENYA. All rights reserved. | www.itukarua.co.ke
          </p>
          <div className="flex gap-4">
            <button onClick={() => setShowTerms(true)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Terms</button>
            <button onClick={() => setShowPrivacy(true)} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Privacy</button>
            <button onClick={() => {}} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Cookies</button>
          </div>
        </div>
      </div>
    </footer>;
};
export default Footer;
