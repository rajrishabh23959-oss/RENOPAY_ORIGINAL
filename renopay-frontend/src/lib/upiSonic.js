/**
 * UPI Sonic Audio Synthesizer (Web Audio API).
 *
 * Generates the official multi-frequency melodic confirmation chime
 * without requiring external heavy MP3/WAV audio assets.
 * 
 * - 1-second chime: Played on successful payment completion.
 * - 3-second chime: Played on successful UPI ID onboarding / registration.
 */

export function playUpiSonic(durationSeconds = 1) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const ctx = new AudioContext();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Harmonic chord notes (C Major rising celebratory sequence)
    // C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz), C6 (1046.50Hz)
    const notes = durationSeconds >= 2.5
      ? [
          { freq: 440.00, start: 0.00, dur: 0.50 }, // A4
          { freq: 523.25, start: 0.40, dur: 0.60 }, // C5
          { freq: 659.25, start: 0.90, dur: 0.70 }, // E5
          { freq: 783.99, start: 1.50, dur: 0.80 }, // G5
          { freq: 1046.50, start: 2.10, dur: 0.90 }, // C6
        ]
      : [
          { freq: 523.25, start: 0.00, dur: 0.25 }, // C5
          { freq: 659.25, start: 0.20, dur: 0.25 }, // E5
          { freq: 783.99, start: 0.40, dur: 0.30 }, // G5
          { freq: 1046.50, start: 0.60, dur: 0.40 }, // C6
        ];

    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + start);

      // Smooth attack and exponential decay for chime/bell quality
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.22, now + start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + start);
      osc.stop(now + start + dur + 0.05);
    });

    // Auto-close audio context after completion to free memory
    setTimeout(() => {
      try {
        ctx.close();
      } catch {}
    }, (durationSeconds + 0.5) * 1000);
  } catch (err) {
    // Graceful fallback: audio autoplay restriction or audio context unsupported
    console.debug("UPI Sonic playback bypassed:", err);
  }
}
