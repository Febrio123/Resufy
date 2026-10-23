import { Link } from 'react-router-dom';

/**
 * Logo component — menampilkan logo resmi HireUp dari asset lokal (/hireup-logo.png).
 * @param {string} size 'sm' | 'md' | 'lg'
 * @param {string} to Opsional URL link pembungkus
 * @param {boolean} showTagline Tampilkan label 'CV ATS Maker'
 */
export function Logo({
  className = '',
  size = 'md',
  to = null,
  showTagline = false,
}) {
  const heightMap = {
    sm: 'h-7',
    md: 'h-8 sm:h-9',
    lg: 'h-10 sm:h-12',
  };

  const content = (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/hireup-logo.png"
        alt="HireUp"
        className={`${heightMap[size] || 'h-8'} w-auto object-contain select-none transition-transform duration-200 group-hover:scale-[1.02]`}
      />
      {showTagline && (
        <span className="hidden sm:inline-block border-l border-border/80 pl-2 text-[10px] font-bold tracking-wider text-muted-fg uppercase">
          CV ATS Maker
        </span>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="inline-flex items-center group shrink-0" aria-label="HireUp — Beranda">
        {content}
      </Link>
    );
  }

  return content;
}

export default Logo;
