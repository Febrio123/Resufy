import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { CircleNotch } from '@phosphor-icons/react';

const VARIANTS = {
  primary: 'bg-cta-gradient text-white shadow-glow-primary hover:brightness-110',
  accent: 'bg-gradient-to-b from-accent to-accent-600 text-white shadow-glow-accent hover:brightness-110',
  secondary:
    'bg-white text-foreground border border-border shadow-sm hover:border-primary/30 hover:bg-primary-50 hover:text-primary',
  ghost: 'text-primary hover:bg-primary-100/70',
  danger: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
  'danger-solid': 'bg-destructive text-white hover:bg-red-700',
};

const SIZES = {
  md: 'h-12 px-6 text-sm', // ≥44px touch target (a11y)
  sm: 'h-11 px-4 text-sm',
  lg: 'h-14 px-8 text-base',
  icon: 'h-11 w-11 p-0',
};

/**
 * Button — spesifikasi 03-ui-ux-design.md §5.6 + overhaul Soft UI:
 * gradient halus + glow shadow pada CTA utama, hover lift, active scale,
 * transisi 200ms. Loading state (spinner + disabled).
 */
export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, icon: Icon, className = '', type = 'button', children, disabled, ...props },
  ref
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      whileHover={disabled || loading ? undefined : { y: -1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`inline-flex min-w-[44px] items-center justify-center gap-2 rounded-xl font-semibold text-sm transition-[box-shadow,background-color,color,filter] duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant] || VARIANTS.primary} ${SIZES[size] || SIZES.md} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <CircleNotch size={18} className="animate-spin" weight="bold" aria-hidden />
      ) : Icon ? (
        <Icon size={18} weight="bold" aria-hidden />
      ) : null}
      {children}
    </motion.button>
  );
});
