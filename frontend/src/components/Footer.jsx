import { Link } from 'react-router-dom';
import { Home, Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-brand-navy text-white mt-auto border-t-2 border-brand-orange/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-brand-orange rounded-lg flex items-center justify-center"><Home className="w-4 h-4" /></div>
              <span className="font-display font-bold text-lg">Home<span className="text-brand-orange">Link</span></span>
            </div>
            <p className="text-gray-300 text-sm leading-relaxed">Your one-stop platform for home improvement products and professional installation services.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm tracking-wide uppercase text-gray-400">Shop</h4>
            <ul className="space-y-2.5 text-sm text-gray-300">
              <li><Link to="/products?category=air-conditioners" className="hover:text-brand-orange transition">Air Conditioners</Link></li>
              <li><Link to="/products?category=solar-panels" className="hover:text-brand-orange transition">Solar Panels</Link></li>
              <li><Link to="/products?category=cctv-security" className="hover:text-brand-orange transition">CCTV & Security</Link></li>
              <li><Link to="/products?category=smart-home" className="hover:text-brand-orange transition">Smart Home</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm tracking-wide uppercase text-gray-400">Services</h4>
            <ul className="space-y-2.5 text-sm text-gray-300">
              <li><Link to="/services" className="hover:text-brand-orange transition">AC Installation</Link></li>
              <li><Link to="/services" className="hover:text-brand-orange transition">Solar Installation</Link></li>
              <li><Link to="/services" className="hover:text-brand-orange transition">CCTV Setup</Link></li>
              <li><Link to="/services" className="hover:text-brand-orange transition">Plumbing & Electrical</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3 text-sm tracking-wide uppercase text-gray-400">Contact</h4>
            <ul className="space-y-2.5 text-sm text-gray-300">
              <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-brand-orange shrink-0" /> (02) 8123-4567</li>
              <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-brand-orange shrink-0" /> support@homelink.com</li>
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-brand-orange shrink-0" /> Metro Manila, PH</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 mt-8 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-400">
          <p>&copy; {new Date().getFullYear()} HomeLink. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/policies" className="hover:text-white transition">Policies</Link>
            <Link to="/location" className="hover:text-white transition">Find Us</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
