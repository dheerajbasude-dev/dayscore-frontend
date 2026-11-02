import React, { useEffect, useRef, useState } from 'react';

/**
 * Synthesizes a high-energy fire ignite whoosh with subtle spark crackles
 * and an uplifting milestone chord using HTML5 Web Audio API.
 * Zero external asset dependencies, zero network latency, 100% offline & mobile-ready.
 */
function playFireStreakSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // 1. Fire Whoosh (Bandpass-filtered white noise burst)
    const bufferSize = Math.floor(ctx.sampleRate * 1.1);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(190, now);
    filter.frequency.exponentialRampToValueAtTime(880, now + 0.16);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.85);
    filter.Q.setValueAtTime(2.2, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.42, now + 0.12);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    whiteNoise.start(now);
    whiteNoise.stop(now + 1.0);

    // 2. Sub-bass combustion punch (40Hz - 110Hz body thump)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(120, now);
    subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.32);

    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.exponentialRampToValueAtTime(0.28, now + 0.04);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.42);

    // 3. Celebratory harmonic resonance (Warm ascending pentatonic chords)
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      const noteStart = now + 0.08 + idx * 0.06;
      osc.frequency.setValueAtTime(freq, noteStart);

      oscGain.gain.setValueAtTime(0.0001, noteStart);
      oscGain.gain.exponentialRampToValueAtTime(0.1 / (idx + 1), noteStart + 0.04);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.8);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(noteStart);
      osc.stop(noteStart + 0.85);
    });

    // 4. Fire crackling sparks (Tiny highpass micro-pops)
    for (let c = 0; c < 6; c++) {
      const crackleTime = now + 0.2 + Math.random() * 0.65;
      const crackleSamples = Math.floor(ctx.sampleRate * 0.025);
      const crackleBuffer = ctx.createBuffer(1, crackleSamples, ctx.sampleRate);
      const cData = crackleBuffer.getChannelData(0);
      for (let j = 0; j < crackleSamples; j++) {
        cData[j] = (Math.random() * 2 - 1) * Math.exp(-j / (ctx.sampleRate * 0.006));
      }
      const cSource = ctx.createBufferSource();
      cSource.buffer = crackleBuffer;

      const cFilter = ctx.createBiquadFilter();
      cFilter.type = 'highpass';
      cFilter.frequency.setValueAtTime(3200 + Math.random() * 1800, crackleTime);

      const cGain = ctx.createGain();
      cGain.gain.setValueAtTime(0.12 + Math.random() * 0.08, crackleTime);

      cSource.connect(cFilter);
      cFilter.connect(cGain);
      cGain.connect(ctx.destination);
      cSource.start(crackleTime);
      cSource.stop(crackleTime + 0.035);
    }
  } catch {
    // Graceful fallback if Web Audio is restricted or unavailable
  }
}

/**
 * Premium Fire Particle Class for realistic flame tongues and sparks
 */
class FireParticle {
  constructor(originX, originY, isSpark = false) {
    this.isSpark = isSpark;
    this.reset(originX, originY);
  }

  reset(originX, originY) {
    this.x = originX + (Math.random() - 0.5) * (this.isSpark ? 70 : 50);
    this.y = originY + (Math.random() - 0.5) * 20;

    if (this.isSpark) {
      // Sparks burst upward & outward with high velocity and turbulent float
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 4 + Math.random() * 8.5;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.size = 1.8 + Math.random() * 2.8;
      this.maxLife = 40 + Math.random() * 45;
    } else {
      // Core flame particles rise upward with rolling turbulence
      this.vx = (Math.random() - 0.5) * 2.2;
      this.vy = -(3.2 + Math.random() * 4.6);
      this.size = 16 + Math.random() * 24;
      this.maxLife = 28 + Math.random() * 22;
    }

    this.life = 0;
    this.opacity = 1;
  }

  update(originX, originY, isSpawning) {
    this.life++;
    this.x += this.vx;
    this.y += this.vy;

    if (this.isSpark) {
      this.vy += 0.04; // Gentle gravity
      this.vx += (Math.random() - 0.5) * 0.35; // Air flicker
      this.size *= 0.985;
    } else {
      this.vx += Math.sin(this.life * 0.18) * 0.45; // Rising tongue sway
      this.vy *= 0.98;
      this.size *= 0.96;
    }

    this.opacity = Math.max(0, 1 - this.life / this.maxLife);

    if (this.life >= this.maxLife && isSpawning) {
      this.reset(originX, originY);
    }
  }

  draw(ctx) {
    if (this.opacity <= 0.01 || this.size <= 0.2) return;

    ctx.save();
    if (this.isSpark) {
      // Vivid bright ember spark
      ctx.globalAlpha = this.opacity;
      ctx.fillStyle = this.life % 2 === 0 ? '#fff3a8' : '#ff9d00';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();

      // Spark halo
      ctx.globalAlpha = this.opacity * 0.4;
      ctx.fillStyle = '#ff5500';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Volumetric flame plume particle with multi-color radial gradient
      const grad = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, this.size
      );

      const progress = this.life / this.maxLife;
      if (progress < 0.25) {
        // Core: Intense white-gold heat
        grad.addColorStop(0, `rgba(255, 255, 240, ${this.opacity * 0.95})`);
        grad.addColorStop(0.35, `rgba(255, 220, 70, ${this.opacity * 0.85})`);
        grad.addColorStop(0.7, `rgba(255, 120, 0, ${this.opacity * 0.45})`);
        grad.addColorStop(1, 'rgba(255, 40, 0, 0)');
      } else if (progress < 0.6) {
        // Mid: Vibrant orange-amber flame
        grad.addColorStop(0, `rgba(255, 220, 60, ${this.opacity * 0.85})`);
        grad.addColorStop(0.4, `rgba(255, 130, 0, ${this.opacity * 0.65})`);
        grad.addColorStop(0.8, `rgba(230, 45, 0, ${this.opacity * 0.3})`);
        grad.addColorStop(1, 'rgba(180, 20, 0, 0)');
      } else {
        // Outer tip: Deep crimson flame & smoke transition
        grad.addColorStop(0, `rgba(255, 120, 0, ${this.opacity * 0.5})`);
        grad.addColorStop(0.5, `rgba(210, 30, 10, ${this.opacity * 0.3})`);
        grad.addColorStop(1, 'rgba(80, 10, 10, 0)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

/**
 * StreakFireCelebration Component
 * 
 * Props:
 * - trigger: boolean or number. Triggers the celebration when truthy / incremented.
 * - streakCount: number. The count to display (e.g. 3 => "3-Day Streak").
 * - onComplete: function. Callback when the animation finishes.
 */
export default function StreakFireCelebration({ trigger, streakCount = 1, onComplete }) {
  const [active, setActive] = useState(false);
  const [displayCount, setDisplayCount] = useState(streakCount);
  const [fadingOut, setFadingOut] = useState(false);
  const canvasRef = useRef(null);
  const animFrameId = useRef(null);

  useEffect(() => {
    if (trigger) {
      const validCount = Number(streakCount) > 0 ? Number(streakCount) : 1;
      setDisplayCount(validCount);
      setActive(true);
      setFadingOut(false);

      // Trigger Web Audio sound effect
      playFireStreakSound();

      // Begin fade out transition before auto-dismiss
      const fadeTimer = setTimeout(() => {
        setFadingOut(true);
      }, 2100);

      // Complete & clean up
      const endTimer = setTimeout(() => {
        setActive(false);
        setFadingOut(false);
        if (typeof onComplete === 'function') {
          onComplete();
        }
      }, 2650);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(endTimer);
      };
    }
  }, [trigger, streakCount, onComplete]);

  // Particle Engine Loop
  useEffect(() => {
    if (!active) {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    const originX = width / 2;
    // Position flame emitter just beneath the center emblem
    const originY = height * 0.52;

    const particles = [];
    const flameCount = 38;
    const sparkCount = 42;

    for (let i = 0; i < flameCount; i++) {
      particles.push(new FireParticle(originX, originY, false));
    }
    for (let i = 0; i < sparkCount; i++) {
      particles.push(new FireParticle(originX, originY, true));
    }

    let startTime = performance.now();
    let isSpawning = true;

    const render = (now) => {
      const elapsed = now - startTime;
      if (elapsed > 2000) {
        isSpawning = false; // Stop spawning new particles as animation winds down
      }

      ctx.clearRect(0, 0, width, height);

      // Use 'lighter' additive blend mode for hyper-vivid luminous fire
      ctx.globalCompositeOperation = 'lighter';

      // Soft ambient heat aura behind the flame
      const auraGrad = ctx.createRadialGradient(
        originX, originY - 30, 10,
        originX, originY - 30, Math.min(width, height) * 0.42
      );
      auraGrad.addColorStop(0, 'rgba(255, 120, 0, 0.28)');
      auraGrad.addColorStop(0.4, 'rgba(255, 70, 0, 0.12)');
      auraGrad.addColorStop(1, 'rgba(255, 20, 0, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(originX, originY - 30, Math.min(width, height) * 0.42, 0, Math.PI * 2);
      ctx.fill();

      // Update & render particles
      for (let i = 0; i < particles.length; i++) {
        particles[i].update(originX, originY, isSpawning);
        particles[i].draw(ctx);
      }

      animFrameId.current = requestAnimationFrame(render);
    };

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [active]);

  if (!active) return null;

  const isPlural = displayCount !== 1;
  const badgeSubtitle = displayCount === 1
    ? 'First spark! Streak started'
    : displayCount >= 7
    ? 'Unstoppable fire! Outstanding consistency'
    : 'Consistency on fire! Keep it burning';

  return (
    <div
      className={`streak-fire-overlay ${fadingOut ? 'streak-fire-fadeout' : ''}`}
      aria-live="polite"
      role="status"
    >
      {/* Dynamic Fullscreen Particle Canvas */}
      <canvas ref={canvasRef} className="streak-fire-canvas" />

      {/* Centered Fire Crest & Streak Counter */}
      <div className="streak-fire-modal">
        {/* Animated 3D Fire Emblem */}
        <div className="streak-fire-emblem-wrap">
          <div className="streak-fire-glow-pulse" />
          <svg
            className="streak-fire-svg-flame"
            viewBox="0 0 64 64"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <radialGradient id="flameInnerGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="40%" stopColor="#fff370" />
                <stop offset="80%" stopColor="#ff7b00" />
                <stop offset="100%" stopColor="#e62000" />
              </radialGradient>
              <linearGradient id="flameOuterGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffec3d" />
                <stop offset="45%" stopColor="#ff7700" />
                <stop offset="100%" stopColor="#d91b00" />
              </linearGradient>
            </defs>

            {/* Outer Flame Silhouette */}
            <path
              d="M32 3C32 3 39 15 39 23C39 27.2 36.5 30.6 33.5 33.2C41.2 31.8 49 37.5 49 45C49 54.4 41.4 62 32 62C22.6 62 15 54.4 15 45C15 35.8 22.1 27.8 26.5 21.2C27.9 19.1 29 16.7 29 14.2C29 8.8 32 3 32 3Z"
              fill="url(#flameOuterGrad)"
            />

            {/* Core Hot White-Yellow Flame */}
            <path
              d="M32 23C32 23 37 31 37 37C37 39.8 35.2 42.1 33.2 43.8C38.3 42.9 43.5 46.7 43.5 51.7C43.5 58 38.3 63.1 32 63.1C25.7 63.1 20.5 58 20.5 51.7C20.5 45.6 25.3 40.2 28.3 35.8C29.2 34.4 30 32.8 30 31.1C30 27.5 32 23 32 23Z"
              fill="url(#flameInnerGlow)"
            />

            {/* Blazing Center Spark */}
            <ellipse cx="32" cy="50" rx="4.5" ry="7.5" fill="#ffffff" opacity="0.92" />
          </svg>
        </div>

        {/* Floating Streak Card */}
        <div className="streak-fire-card">
          <div className="streak-fire-tag">
            <span className="streak-fire-tag-icon">🔥</span>
            <span>{displayCount === 1 ? 'STREAK IGNITED' : 'STREAK COUNTED'}</span>
            <span className="streak-fire-tag-icon">🔥</span>
          </div>

          <div className="streak-fire-number-banner">
            <span className="streak-fire-number">{displayCount}</span>
            <span className="streak-fire-unit">-Day Streak{isPlural ? '' : ''}</span>
          </div>

          <div className="streak-fire-subtitle">{badgeSubtitle}</div>
        </div>
      </div>
    </div>
  );
}

