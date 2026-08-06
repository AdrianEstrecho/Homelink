import { Link } from 'react-router-dom';
import { Home, Mail, Phone, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-gradient-to-b from-brand-navy to-[#0a1d42] text-white mt-auto border-t border-white/10">
      <div className="absolute inset-0 opacity-[0.15] pointer-events-none" aria-hidden="true">
        <div className="float-blob absolute -top-24 left-1/4 w-96 h-96 bg-brand-orange rounded-full blur-3xl" />
        <div className="float-blob-delayed absolute -bottom-32 right-1/4 w-96 h-96 bg-brand-teal rounded-full blur-3xl" />
      </div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-brand-orange rounded-lg flex items-center justify-center"><Home className="w-4 h-4" /></div>
              <span className="font-display font-extrabold text-lg">Home<span className="text-brand-orange">Link</span></span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">Your one-stop platform for home improvement products and professional installation services.</p>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-xs tracking-[0.14em] uppercase text-gray-500">Shop</h4>
            <ul className="space-y-2.5 text-sm text-gray-300">
              <li><Link to="/products?category=air-conditioners" className="hover:text-brand-orange transition">Air Conditioners</Link></li>
              <li><Link to="/products?category=solar-panels" className="hover:text-brand-orange transition">Solar Panels</Link></li>
              <li><Link to="/products?category=cctv-security" className="hover:text-brand-orange transition">CCTV & Security</Link></li>
              <li><Link to="/products?category=smart-home" className="hover:text-brand-orange transition">Smart Home</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-xs tracking-[0.14em] uppercase text-gray-500">Services</h4>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li><Link to="/services" className="hover:text-white transition">AC Installation</Link></li>
              <li><Link to="/services" className="hover:text-white transition">Solar Installation</Link></li>
              <li><Link to="/services" className="hover:text-white transition">CCTV Setup</Link></li>
              <li><Link to="/services" className="hover:text-white transition">Plumbing & Electrical</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-xs tracking-[0.14em] uppercase text-gray-500">Contact</h4>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li className="flex items-center gap-2"><Phone className="w-4 h-4 text-brand-orange shrink-0" /> (02) 8123-4567</li>
              <li className="flex items-center gap-2"><Mail className="w-4 h-4 text-brand-orange shrink-0" /> support@homelink.com</li>
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4 text-brand-orange shrink-0" /> Metro Manila, PH</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} HomeLink. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link to="/policies" className="hover:text-white transition">Policies</Link>
            <Link to="/location" className="hover:text-white transition">Find Us</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
