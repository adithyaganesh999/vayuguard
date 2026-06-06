'use client';

import React from 'react';
import { motion } from 'framer-motion';

export default function ContactSection() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-10" />
      
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <span className="text-emerald-400 text-sm uppercase tracking-[0.3em] mb-6 block">Get In Touch</span>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
            Let&apos;s do something
            <br />
            <span className="text-gradient">awesome together</span>
          </h2>
          <p className="text-white/40 text-lg mb-10 max-w-xl mx-auto">
            Whether you&apos;re a researcher, developer, or health-conscious individual — 
            we&apos;d love to hear from you.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:hello@vayuguard.com"
              className="px-8 py-4 rounded-full bg-emerald-500 text-black font-semibold text-lg hover:bg-emerald-400 transition-all hover:scale-105 active:scale-95"
            >
              hello@vayuguard.com
            </a>
            <a
              href="#"
              className="px-8 py-4 rounded-full glass text-white/80 font-medium text-lg hover:bg-white/10 transition-all hover:scale-105 active:scale-95"
            >
              Schedule a Demo
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
