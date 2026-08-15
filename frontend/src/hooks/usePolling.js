import { useCallback, useEffect, useRef } from 'react';

/**
 * Polling halus untuk payment & plagiarism (keputusan lintas fase: 5s, tanpa WebSocket).
 * - Berhenti otomatis saat stopWhen(data) true, error non-429, atau maxAttempts.
 * - 429 → backoff (interval naik bertahap sampai 30s) — 05-security.md §7.
 * - Restart polling dengan mengubah `restartKey`.
 */
export function usePolling({
  fn,
  interval = 5000,
  stopWhen,
  maxAttempts = 60,
  enabled = true,
  restartKey = '',
  onComplete,
  onError,
}) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const stopWhenRef = useRef(stopWhen);
  stopWhenRef.current = stopWhen;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const stopRef = useRef(false);
  const attemptsRef = useRef(0);

  const stop = useCallback(() => {
    stopRef.current = true;
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    stopRef.current = false;
    attemptsRef.current = 0;
    let timer = null;
    let disposed = false;

    const schedule = (ms) => {
      timer = window.setTimeout(tick, ms);
    };

    const tick = async () => {
      if (disposed || stopRef.current) return;
      try {
        const data = await fnRef.current();
        if (disposed) return;
        attemptsRef.current += 1;

        if (stopWhenRef.current && stopWhenRef.current(data)) {
          stopRef.current = true;
          onCompleteRef.current?.(data);
          return;
        }
        if (attemptsRef.current >= maxAttempts) {
          stopRef.current = true;
          onCompleteRef.current?.(null); // timeout → caller putuskan (cek manual)
          return;
        }
        schedule(interval);
      } catch (err) {
        if (disposed) return;
        if (err?.response?.status === 429) {
          const backoff = Math.min((attemptsRef.current + 1) * interval * 2, 30000);
          schedule(backoff);
        } else {
          stopRef.current = true;
          onErrorRef.current?.(err);
        }
      }
    };

    schedule(interval);
    return () => {
      disposed = true;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, interval, maxAttempts, restartKey]);

  return { stop };
}
