import { useState } from 'react';
import { CheckCircle, Sparkle, Warning, WarningCircle } from '@phosphor-icons/react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { StatCard } from './StatCard';
import { atsTone } from '../utils/format';

const SEVERITY_ICON = {
  error: { Icon: WarningCircle, className: 'text-destructive' },
  warning: { Icon: Warning, className: 'text-warning' },
  info: { Icon: CheckCircle, className: 'text-primary' },
};

/**
 * AtsPanel — skor ATS + feedback severity + keyword match vs deskripsi lowongan.
 * GRATIS (tidak terkait pembayaran). Wireframe 4.4 sidebar.
 */
export function AtsPanel({ score, feedback = [], keywordMatch, onRun, running = false }) {
  const [jobDescription, setJobDescription] = useState('');
  const [showJd, setShowJd] = useState(false);
  const tone = atsTone(score);

  const hasJdResult = Boolean(keywordMatch && keywordMatch.matchedKeywords?.length + keywordMatch.missingKeywords?.length > 0);

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkle size={18} className="text-primary" weight="bold" aria-hidden />
        <h3 className="text-base font-bold text-foreground">ATS Score</h3>
      </div>

      <div className="flex justify-center">
        <StatCard score={score} tone={tone.tone} label={tone.label} suffix="/100" />
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        onClick={() => setShowJd((v) => !v)}
        aria-expanded={showJd}
      >
        {showJd ? 'Sembunyikan pencocokan lowongan' : 'Paste deskripsi lowongan (opsional)'}
      </Button>

      {showJd && (
        <div className="space-y-2">
          <textarea
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
            rows={4}
            placeholder="Tempel deskripsi lowongan di sini untuk melihat keyword yang cocok…"
            className="min-h-20 w-full rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            aria-label="Deskripsi lowongan"
          />
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            loading={running}
            onClick={() => onRun(jobDescription)}
          >
            Jalankan ATS Check
          </Button>
        </div>
      )}

      {!showJd && (
        <Button
          variant="primary"
          size="sm"
          className="w-full"
          loading={running}
          onClick={() => onRun('')}
        >
          {score === null || score === undefined ? 'Cek ATS Sekarang' : 'Perbarui ATS Check'}
        </Button>
      )}

      {/* Feedback */}
      {feedback.length > 0 && (
        <ul className="space-y-2">
          {feedback.map((item, i) => {
            const sev = SEVERITY_ICON[item.severity] || SEVERITY_ICON.info;
            const Icon = sev.Icon;
            return (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Icon size={16} className={`mt-0.5 shrink-0 ${sev.className}`} weight="bold" aria-hidden />
                <span className="text-foreground">{item.message}</span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Keyword match */}
      {hasJdResult && (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-fg">
              Keyword Match
            </p>
            <span className="text-sm font-extrabold tabular-nums text-primary">
              {keywordMatch.score ?? 0}%
            </span>
          </div>
          {keywordMatch.matchedKeywords?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {keywordMatch.matchedKeywords.map((kw) => (
                <span key={kw} className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                  {kw}
                </span>
              ))}
            </div>
          )}
          {keywordMatch.missingKeywords?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {keywordMatch.missingKeywords.map((kw) => (
                <span key={kw} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-fg">
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {feedback.length === 0 && !hasJdResult && (
        <p className="text-xs text-muted-fg">
          Jalankan ATS Check untuk melihat skor & rekomendasi perbaikan CV kamu.
        </p>
      )}
    </Card>
  );
}
