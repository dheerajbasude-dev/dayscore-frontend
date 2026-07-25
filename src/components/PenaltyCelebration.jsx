import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';

export default function PenaltyCelebration({ trigger }) {
  useEffect(() => {
    if (trigger) {
      const duration = 2500;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#ef4444', '#dc2626', '#b91c1c', '#f87171', '#991b1b', '#fca5a5']
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#ef4444', '#dc2626', '#b91c1c', '#f87171', '#991b1b', '#fca5a5']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };

      confetti({
        particleCount: 120,
        spread: 75,
        origin: { y: 0.6 },
        colors: ['#ef4444', '#dc2626', '#b91c1c', '#f87171', '#991b1b', '#fca5a5']
      });

      frame();
    }
  }, [trigger]);

  return null;
}
