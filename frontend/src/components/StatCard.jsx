import { motion, useReducedMotion } from 'framer-motion';
import { useCountUp } from '../hooks/useCountUp';

const TONE_COLORS = {
  success: { text: 'text-success', stroke: '#22C55E', track: '#E9FBF0', glow: 'rgb(34 197 94 / 0.35)' },
  warning: { text: 'text-warning', stroke: '#F59E0B', track: '#FEF6E7', glow: 'rgb(245 158 11 / 0.35)' },
  destructive: { text: 'text-destructive', stroke: '#DC2626', track: '#FDECEC', glow: 'rgb(220 38 38 / 0.35)' },
  muted: { text: 'text-muted-fg', stroke: '#94A3B8', track: '#EEF2F7', glow: 'rgb(100 116 139 / 0.30)' },
};

/**
 * StatCard — skor besar + ring progress semantik (Soft UI).
 * Ring = CSS conic-gradient (ZERO manual SVG): track + nilai + hole putih
 * agar tampak seperti donut. Angka count-up; angka + label teks (a11y).
 * `icon`: ikon opsional di atas angka (mis. CheckCircle utk hasil cek).
 */
export function StatCard({ score, tone = 'muted', label, suffix = '%', size = 140, icon: Icon }) {
  const reduced = useReducedMotion();
  const colors = TONE_COLORS[tone] || TONE_COLORS.muted;
  const animated = useCountUp(score, { duration: 0.9 });
  // Ketebalan ring ≈ 10% dari size (setara strokeWidth 10 pada 140px)
  const hole = Math.max(5, Math.round(size * 0.09));

  const conicStyle = {
    background: `conic-gradient(${colors.stroke} ${animated}%, ${colors.track} 0)`,
  };

  return (
    <div
      className="relative inline-flex flex-col items-center gap-2"
      role="img"
      aria-label={`${label}: ${score}${suffix}`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        {/* Glow lembut di belakang ring */}
        <motion.div
          className="absolute rounded-full"
          style={{ inset: size * 0.28, boxShadow: `0 0 32px 6px ${colors.glow}` }}
          initial={{ opacity: reduced ? 0.8 : 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          aria-hidden
        />
        {/* Track + nilai (conic-gradient) */}
        <div className="absolute inset-0 rounded-full" style={conicStyle} aria-hidden />
        {/* Hole dalam (surface) supaya tampak donut */}
        <div
          className="absolute rounded-full bg-surface"
          style={{ inset: hole }}
          aria-hidden
        />
        {/* Angka di tengah */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {Icon && (
            <Icon
              size={Math.max(16, Math.round(size * 0.14))}
              weight="bold"
              className={`mb-1 ${colors.text}`}
              aria-hidden
            />
          )}
          <div className={`flex items-baseline font-extrabold tabular-nums ${colors.text}`}>
            <span style={{ fontSize: Math.round(size * 0.28) }}>
              {score == null ? '—' : animated}
            </span>
            {suffix && <span style={{ fontSize: Math.round(size * 0.14) }}>{suffix}</span>}
          </div>
        </div>
      </div>
      <div className="text-xs font-bold uppercase tracking-wider text-muted-fg">{label}</div>
    </div>
  );
}
