import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { Mic, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react'

/**
 * Helper to compute an organically deformed closed cubic Bezier SVG path
 * from an array of 8 radial distances around center (cx, cy).
 * Generates identical command structure (M ... C ... C ... C ... Z)
 * enabling mathematically smooth SVG path deformation / morphing.
 */
function createLiquidPath(radii, cx = 210, cy = 210) {
  const n = radii.length
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n
    const r = radii[i]
    const x = cx + Math.cos(a) * r
    const y = cy + Math.sin(a) * r
    // Tangent distance for smooth cubic Bezier continuity
    const d = r * 0.275
    const cpOutX = x - Math.sin(a) * d
    const cpOutY = y + Math.cos(a) * d
    const cpInX = x + Math.sin(a) * d
    const cpInY = y - Math.cos(a) * d
    pts.push({
      x: +x.toFixed(2),
      y: +y.toFixed(2),
      cpOutX: +cpOutX.toFixed(2),
      cpOutY: +cpOutY.toFixed(2),
      cpInX: +cpInX.toFixed(2),
      cpInY: +cpInY.toFixed(2),
    })
  }

  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < n; i++) {
    const next = (i + 1) % n
    d += ` C ${pts[i].cpOutX} ${pts[i].cpOutY}, ${pts[next].cpInX} ${pts[next].cpInY}, ${pts[next].x} ${pts[next].y}`
  }
  d += ' Z'
  return d
}

/**
 * AivanaOrb: Features SVG path deformation keyframes to simulate organic, liquid movement
 * rather than simple rigid rotation.
 * - Flowing, translucent, glass-like plasma / liquid energy ring
 * - Morphing SVG path layers (Outer gossamer veil, mid liquid stream, core light spine, and specular catchlight)
 * - Multicolor chromatic gradient (Cyan -> Royal Blue -> Violet -> Magenta -> Coral Pink -> Amber Orange -> Golden Lime)
 * - Deep navy/black circular center with subtle depth, centered glowing mic, "Hi Aivana", and "Tap to speak"
 */
export default function AivanaOrb({
  interactionState = 'idle', // 'idle' | 'listening' | 'processing' | 'clarification' | 'ready'
  onClick,
}) {
  // Precompute 4 organic liquid morph keyframe states for each layer
  const morphPaths = useMemo(() => {
    // 1. Outer Translucent Liquid Veil: broad, soft organic folds (stroke ~20px with blur)
    const veilS1 = createLiquidPath([154, 138, 158, 142, 150, 136, 156, 144])
    const veilS2 = createLiquidPath([142, 156, 140, 154, 138, 156, 142, 150])
    const veilS3 = createLiquidPath([156, 144, 138, 160, 152, 140, 148, 156])
    const veilS4 = createLiquidPath([144, 150, 158, 140, 154, 148, 140, 148])

    // 2. Mid Chromatic Liquid Stream 1 (stroke ~10px)
    const mid1S1 = createLiquidPath([140, 148, 136, 146, 138, 150, 136, 144])
    const mid1S2 = createLiquidPath([146, 138, 150, 136, 144, 140, 148, 136])
    const mid1S3 = createLiquidPath([138, 150, 138, 144, 148, 136, 146, 140])
    const mid1S4 = createLiquidPath([144, 136, 146, 140, 136, 148, 140, 148])

    // 3. Mid Chromatic Liquid Stream 2 (counter-undulation, stroke ~7px)
    const mid2S1 = createLiquidPath([134, 144, 148, 136, 146, 138, 142, 148])
    const mid2S2 = createLiquidPath([148, 136, 142, 146, 136, 146, 146, 138])
    const mid2S3 = createLiquidPath([138, 148, 136, 144, 144, 148, 136, 142])
    const mid2S4 = createLiquidPath([146, 138, 146, 138, 148, 136, 146, 144])

    // 4. Core Luminous Light Filament (stroke ~3px, high glow)
    const filS1 = createLiquidPath([136, 142, 134, 140, 134, 144, 132, 138])
    const filS2 = createLiquidPath([140, 134, 144, 132, 138, 136, 142, 134])
    const filS3 = createLiquidPath([134, 144, 134, 138, 142, 132, 140, 136])
    const filS4 = createLiquidPath([138, 132, 140, 136, 134, 142, 136, 144])

    // 5. Specular Catchlight Filament (stroke ~1.4px, fine white reflection)
    const specS1 = createLiquidPath([137, 143, 135, 141, 135, 145, 133, 139])
    const specS2 = createLiquidPath([141, 135, 145, 133, 139, 137, 143, 135])
    const specS3 = createLiquidPath([135, 145, 135, 139, 143, 133, 141, 137])
    const specS4 = createLiquidPath([139, 133, 141, 137, 135, 143, 137, 145])

    return {
      veil: [veilS1, veilS2, veilS3, veilS4, veilS1],
      mid1: [mid1S1, mid1S2, mid1S3, mid1S4, mid1S1],
      mid2: [mid2S1, mid2S2, mid2S3, mid2S4, mid2S1],
      filament: [filS1, filS2, filS3, filS4, filS1],
      specular: [specS1, specS2, specS3, specS4, specS1],
    }
  }, [])

  // Duration modifier based on interaction state
  const morphDuration =
    interactionState === 'listening'
      ? 4.5
      : interactionState === 'processing'
      ? 3.2
      : 9.0

  return (
    <div className="relative flex items-center justify-center select-none">
      {/* Outer Dotted Orbit Ring */}
      <div className="absolute w-[400px] h-[400px] md:w-[420px] md:h-[420px] rounded-full border border-dashed border-slate-300/40 pointer-events-none -z-10" />

      {/* Atmospheric Soft Nebular Bloom (Luminous multi-color dispersion) */}
      <div
        className={`absolute w-84 h-84 md:w-96 md:h-96 rounded-full blur-[75px] pointer-events-none transition-all duration-700 -z-10 ${
          interactionState === 'listening'
            ? 'bg-gradient-to-tr from-cyan-400/30 via-fuchsia-500/25 to-amber-400/25 scale-110'
            : interactionState === 'processing'
            ? 'bg-gradient-to-tr from-purple-500/30 via-cyan-400/25 to-pink-500/25 scale-105'
            : 'bg-gradient-to-tr from-cyan-400/20 via-fuchsia-500/18 to-amber-300/20'
        }`}
      />

      {/* Interactive Orb Wrapper */}
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            onClick?.()
          }
        }}
        className="relative w-[390px] h-[390px] md:w-[410px] md:h-[410px] flex items-center justify-center cursor-pointer focus:outline-none group"
      >
        {/* SVG Liquid Path Deformation / Morphing Engine */}
        <svg
          viewBox="0 0 420 420"
          className="absolute inset-0 w-full h-full pointer-events-none z-0"
          style={{ overflow: 'visible' }}
        >
          <defs>
            {/* Continuous multicolor linear gradients flowing naturally around the ring */}
            <linearGradient id="liquidGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.85" />
              <stop offset="25%" stopColor="#3b82f6" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#9333ea" stopOpacity="0.85" />
              <stop offset="75%" stopColor="#f43f5e" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.85" />
            </linearGradient>

            <linearGradient id="liquidGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#eab308" stopOpacity="0.8" />
              <stop offset="30%" stopColor="#f43f5e" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#a855f7" stopOpacity="0.8" />
              <stop offset="85%" stopColor="#06b6d4" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.8" />
            </linearGradient>

            <linearGradient id="veilGrad" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.3" />
              <stop offset="28%" stopColor="#8b5cf6" stopOpacity="0.25" />
              <stop offset="55%" stopColor="#ec4899" stopOpacity="0.28" />
              <stop offset="80%" stopColor="#f97316" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#eab308" stopOpacity="0.28" />
            </linearGradient>

            {/* Specular highlight gradient (delicate, white-tinted reflection on crests) */}
            <linearGradient id="specularGrad" x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
              <stop offset="40%" stopColor="#c084fc" stopOpacity="0.5" />
              <stop offset="70%" stopColor="#ffffff" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#67e8f9" stopOpacity="0.5" />
            </linearGradient>

            {/* Gaussian Blur Glow Filters */}
            <filter id="liquidGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="7" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="softVeilFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="12" result="veilGlow" />
              <feMerge>
                <feMergeNode in="veilGlow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* LAYER 1: Outer Translucent Liquid Veil (SVG path morphing) */}
          <motion.path
            animate={{ d: morphPaths.veil }}
            transition={{
              duration: morphDuration * 1.15,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            fill="none"
            stroke="url(#veilGrad)"
            strokeWidth="20"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#softVeilFilter)"
            style={{ mixBlendMode: 'screen' }}
          />

          {/* LAYER 2: Mid Translucent Liquid Stream 1 (SVG path morphing) */}
          <motion.path
            animate={{ d: morphPaths.mid1 }}
            transition={{
              duration: morphDuration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            fill="none"
            stroke="url(#liquidGrad1)"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#liquidGlow)"
            style={{ mixBlendMode: 'screen' }}
          />

          {/* LAYER 3: Mid Counter-Undulating Liquid Stream 2 (SVG path morphing) */}
          <motion.path
            animate={{ d: morphPaths.mid2 }}
            transition={{
              duration: morphDuration * 1.08,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            fill="none"
            stroke="url(#liquidGrad2)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#liquidGlow)"
            style={{ mixBlendMode: 'screen' }}
          />

          {/* LAYER 4: Core Luminous Light Filament (SVG path morphing) */}
          <motion.path
            animate={{ d: morphPaths.filament }}
            transition={{
              duration: morphDuration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            fill="none"
            stroke="url(#liquidGrad1)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#liquidGlow)"
            style={{ mixBlendMode: 'screen' }}
          />

          {/* LAYER 5: Hairline Specular Reflection (SVG path morphing) */}
          <motion.path
            animate={{ d: morphPaths.specular }}
            transition={{
              duration: morphDuration * 0.95,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            fill="none"
            stroke="url(#specularGrad)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="40 25 60 30"
            style={{ mixBlendMode: 'screen' }}
          />
        </svg>

        {/* Listening Soundwave Ping Ring effect */}
        {interactionState === 'listening' && (
          <>
            <div className="absolute inset-6 rounded-full border border-cyan-400/40 animate-wave-ping pointer-events-none" />
            <div className="absolute inset-2 rounded-full border border-pink-400/30 animate-wave-ping pointer-events-none [animation-delay:0.5s]" />
          </>
        )}

        {/* Dark Central Circular Core:
            Deep navy/black `#070b16`, diameter 226px, perfectly centered.
            Sits on z-10 above the SVG morphing layers so the core remains pitch dark, crystal clear,
            and beautifully framed by the surrounding liquid energy! */}
        <div className="relative w-[222px] h-[222px] md:w-[226px] md:h-[226px] rounded-full bg-[#070b16] border border-white/10 shadow-[0_0_35px_rgba(0,0,0,0.7),inset_0_2px_20px_rgba(0,0,0,0.95)] flex flex-col items-center justify-center p-6 text-center overflow-hidden z-10">
          {/* Subtle inner radial depth */}
          <div className="absolute inset-0 bg-radial from-slate-900/40 via-transparent to-black/85 pointer-events-none" />

          {/* Optical Glass Inner Rim Reflection */}
          <div className="absolute inset-0 rounded-full border border-white/5 pointer-events-none" />

          {/* STATE 1: IDLE */}
          {interactionState === 'idle' && (
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-11 h-11 md:w-13 md:h-13 rounded-full flex items-center justify-center text-white mb-2.5 transition-transform group-hover:scale-105">
                <Mic
                  size={32}
                  strokeWidth={2}
                  className="text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.75)]"
                />
              </div>
              <span className="text-[23px] md:text-[25px] font-semibold tracking-tight text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] leading-tight font-sans">
                Hi Aivana
              </span>
              <span className="text-[12px] md:text-[13px] text-slate-400 font-normal tracking-wide mt-1.5">
                Tap to speak
              </span>
            </div>
          )}

          {/* STATE 2: LISTENING */}
          {interactionState === 'listening' && (
            <div className="relative z-10 flex flex-col items-center">
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="w-12 h-12 rounded-full bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 mb-2 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
              >
                <Mic size={28} className="animate-pulse" />
              </motion.div>
              <span className="text-lg md:text-xl font-semibold tracking-tight text-cyan-300 animate-pulse">
                Listening...
              </span>
              <span className="text-xs text-slate-400 font-normal mt-1">
                Speak your query
              </span>
            </div>
          )}

          {/* STATE 3: PROCESSING */}
          {interactionState === 'processing' && (
            <div className="relative z-10 flex flex-col items-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                className="w-12 h-12 rounded-full border-2 border-fuchsia-400/40 border-t-cyan-400 flex items-center justify-center text-cyan-300 mb-2"
              >
                <Sparkles size={24} className="text-fuchsia-300" />
              </motion.div>
              <span className="text-lg md:text-xl font-semibold tracking-tight text-white">
                Understanding...
              </span>
              <span className="text-xs text-slate-400 font-normal mt-1">
                Consulting ORCA
              </span>
            </div>
          )}

          {/* STATE 4: CLARIFICATION */}
          {interactionState === 'clarification' && (
            <div className="relative z-10 flex flex-col items-center px-2">
              <AlertCircle size={28} className="text-amber-400 mb-1.5" />
              <span className="text-sm md:text-base font-semibold text-amber-300 leading-snug">
                Clarification Needed
              </span>
              <span className="text-[11px] text-slate-400 font-normal mt-1">
                Select location below
              </span>
            </div>
          )}

          {/* STATE 5: READY */}
          {interactionState === 'ready' && (
            <div className="relative z-10 flex flex-col items-center px-2">
              <CheckCircle2 size={30} className="text-emerald-400 mb-1.5" />
              <span className="text-sm md:text-base font-semibold text-emerald-300 leading-snug">
                Request Understood
              </span>
              <span className="text-[11px] text-slate-400 font-normal mt-1">
                Ready for ORCA workflow
              </span>
            </div>
          )}

          {/* STATE 6: ERROR */}
          {interactionState === 'error' && (
            <div className="relative z-10 flex flex-col items-center px-2">
              <AlertCircle size={28} className="text-rose-400 mb-1.5" />
              <span className="text-sm md:text-base font-semibold text-rose-300 leading-snug">
                Voice Error
              </span>
              <span className="text-[11px] text-slate-400 font-normal mt-1">
                Tap orb to retry
              </span>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
