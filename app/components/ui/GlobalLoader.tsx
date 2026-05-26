'use client';

import React from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

interface GlobalLoaderProps {
  isLoading: boolean;
}

export default function GlobalLoader({ isLoading }: GlobalLoaderProps) {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
        >
          <div className="relative flex flex-col items-center gap-6">

            {/* Main StarDust Container */}
            <div className="relative w-32 h-32 md:w-40 md:h-40">

              {/* Outer Glow Effect */}
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.6, 0.3]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 bg-blue-400 rounded-full blur-[40px]"
              />

              {/* The StarDust PNG */}
              <motion.div
                animate={{
                  rotate: 360,
                  scale: [0.95, 1.05, 0.95]
                }}
                transition={{
                  rotate: { duration: 5, repeat: Infinity, ease: "linear" },
                  scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
                }}
                className="relative w-full h-full"
              >
                <Image
                  src="/loader.png" // Replace with your actual filename in /public
                  alt="Loading..."
                  fill
                  className="object-contain"
                  priority
                />
              </motion.div>
            </div>

            {/* Subtle Brand Text */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="flex flex-col items-center gap-1"
            >
              <h2 className="text-[#0A3D62] font-bold tracking-[0.3em] text-lg uppercase">
                Auto-Mate
              </h2>
              <div className="w-12 h-1 bg-gradient-to-r from-transparent via-[#1E90FF] to-transparent rounded-full" />
            </motion.div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}