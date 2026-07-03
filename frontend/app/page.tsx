import Navbar from '@/components/Navbar';
import Hero from '@/components/landing/Hero';
import Features from '@/components/landing/Features';
import HowItWorks from '@/components/landing/HowItWorks';
import Stats from '@/components/landing/Stats';
import Testimonials from '@/components/landing/Testimonials';
import CTA from '@/components/landing/CTA';
import Footer from '@/components/landing/Footer';
import ForWho from '@/components/landing/ForWho';

export default function Home() {
  return (
    <main id="main-content" className="min-h-screen bg-ink-900">
      <Navbar />
      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <ForWho />
      <Testimonials />
      <CTA />
      <Footer />
    </main>
  );
}
