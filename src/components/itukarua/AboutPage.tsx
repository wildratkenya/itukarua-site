import React from 'react';
import { MapPin, Users, Briefcase, Shield, Target, Heart, TrendingUp, Award } from 'lucide-react';
import { IMAGES } from '@/data/siteData';

const STATS = { activeJobs: 156, registeredWorkers: 432, completedJobs: 1847, counties: 5 };


const AboutPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative">
        <img src={IMAGES.community[1]} alt="Community" className="w-full h-64 lg:h-80 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 to-gray-900/30" />
        <div className="absolute bottom-0 left-0 right-0 p-8 lg:p-12">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">About ITUKARUA Solutions</h1>
            <p className="text-gray-200 max-w-2xl">Connecting local communities across Kenya since 2024</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mission */}
        <section className="py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-4">
                <Target className="w-4 h-4" /> Our Mission
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Empowering Communities Through Digital Connection</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                ITUKARUA Solutions was born from a simple observation: talented workers and willing employers in our communities often struggle to find each other. We bridge that gap using technology that everyone can access.
              </p>
              <p className="text-gray-600 leading-relaxed mb-4">
                Based in Itukarua Town, Nyeri County, we serve communities across Central Kenya and beyond. Our platform enables local people to post jobs, find skilled workers, advertise businesses, and transact securely using M-Pesa.
              </p>
              <p className="text-gray-600 leading-relaxed">
                We believe that economic empowerment starts at the community level. By connecting talent with opportunity, we're building stronger local economies, one job at a time.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Briefcase, label: 'Active Jobs', value: `${STATS.activeJobs}+`, color: 'bg-green-100 text-green-600' },
                { icon: Users, label: 'Registered Workers', value: `${STATS.registeredWorkers}+`, color: 'bg-blue-100 text-blue-600' },
                { icon: TrendingUp, label: 'Jobs Completed', value: `${STATS.completedJobs}+`, color: 'bg-amber-100 text-amber-600' },
                { icon: MapPin, label: 'Counties Served', value: `${STATS.counties}`, color: 'bg-purple-100 text-purple-600' },
              ].map((stat, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-6 text-center">
                  <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-16 border-t border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">Our Core Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Heart, title: 'Community First', desc: 'Everything we do is designed to serve and uplift our local communities.', color: 'bg-red-100 text-red-600' },
              { icon: Shield, title: 'Trust & Safety', desc: 'Verified workers, secure M-Pesa payments, and transparent processes.', color: 'bg-green-100 text-green-600' },
              { icon: Award, title: 'Quality Work', desc: 'We promote excellence through ratings, reviews, and accountability.', color: 'bg-amber-100 text-amber-600' },
              { icon: TrendingUp, title: 'Economic Growth', desc: 'Creating sustainable income opportunities for local talent.', color: 'bg-blue-100 text-blue-600' },
            ].map((value, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-6 hover:bg-white hover:shadow-md transition-all">
                <div className={`w-12 h-12 ${value.color} rounded-xl flex items-center justify-center mb-4`}>
                  <value.icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{value.title}</h3>
                <p className="text-sm text-gray-500">{value.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How We Help */}
        <section className="py-16 border-t border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-4">How We Help</h2>
          <p className="text-gray-500 text-center max-w-2xl mx-auto mb-10">Our platform serves three key groups in the community</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                title: 'For Employers',
                items: ['Post jobs for free or with a small fee', 'Receive bids from verified workers', 'Compare by rating, price & qualifications', 'Pay securely via M-Pesa'],
                color: 'border-green-500',
              },
              {
                title: 'For Jobseekers',
                items: ['Create a professional profile', 'Bid on local jobs', 'Build reputation through ratings', 'Get paid after job completion'],
                color: 'border-blue-500',
              },
              {
                title: 'For Businesses',
                items: ['Advertise to the local community', 'Choose flexible ad durations', 'Get featured placement', 'Track ad performance'],
                color: 'border-amber-500',
              },
            ].map((group, i) => (
              <div key={i} className={`bg-white rounded-xl p-6 border-t-4 ${group.color} shadow-sm`}>
                <h3 className="font-bold text-gray-900 text-lg mb-4">{group.title}</h3>
                <ul className="space-y-3">
                  {group.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-1.5 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AboutPage;
