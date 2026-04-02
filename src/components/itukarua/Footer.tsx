import React, { useState } from 'react';
import { MapPin, Phone, Mail, Facebook, Twitter, Send } from 'lucide-react';
import type { Page } from './Header';
interface FooterProps {
  onNavigate: (page: Page) => void;
}
const Footer: React.FC<FooterProps> = ({
  onNavigate
}) => {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && /\S+@\S+\.\S+/.test(email)) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 4000);
    }
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
            <form onSubmit={handleSubscribe} className="flex w-full md:w-auto gap-2">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Enter your email" className="flex-1 md:w-72 px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-green-200 focus:ring-2 focus:ring-white/30 focus:border-transparent outline-none" />
              <button type="submit" className="px-6 py-3 bg-white text-green-700 font-semibold rounded-lg hover:bg-green-50 transition-colors flex items-center gap-2">
                <Send className="w-4 h-4" />
                {subscribed ? 'Subscribed!' : 'Subscribe'}
              </button>
            </form>
          </div>
        </div>
      </div>

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
              label: 'About Us',
              page: 'about' as Page
            }, {
              label: 'Contact Us',
              page: 'contact' as Page
            }].map(link => <li key={link.page}>
                  <button onClick={() => onNavigate(link.page)} className="text-sm text-gray-400 hover:text-green-400 transition-colors">
                    {link.label}
                  </button>
                </li>)}
            </ul>
          </div>

          {/* For Users */}
          <div>
            <h4 className="text-white font-semibold mb-4">For Users</h4>
            <ul className="space-y-2">
              {['Post a Job', 'Register as Jobseeker', 'Advertise Business', 'M-Pesa Payments', 'Terms of Service', 'Privacy Policy'].map(item => <li key={item}>
                  <button onClick={() => {}} className="text-sm text-gray-400 hover:text-green-400 transition-colors">
                    {item}
                  </button>
                </li>)}
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
                <span className="text-green-400 font-semibold">M-Pesa PayBill:</span> 247247
              </p>
              <p className="text-xs text-gray-400 mt-1">
                <span className="text-green-400 font-semibold">Business Name:</span> ITUKARUA Solutions
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500" data-mixed-content="true" data-mixed-content="true">
            &copy; {new Date().getFullYear()} ITUKARUA Solutions. All rights reserved. | www.itukarua.co.ke
          </p>
          <div className="flex gap-4">
            <button onClick={() => {}} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Terms</button>
            <button onClick={() => {}} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Privacy</button>
            <button onClick={() => {}} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">Cookies</button>
          </div>
        </div>
      </div>
    </footer>;
};
export default Footer;