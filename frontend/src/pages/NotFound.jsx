import { Link } from 'react-router-dom';
import { MapTrifold } from '@phosphor-icons/react';
import { PublicLayout } from '../components/layouts/PublicLayout';
import { Button } from '../components/ui/Button';
import usePageMeta from '../hooks/usePageMeta';

export default function NotFound() {
  // SEO fase 09
  usePageMeta({
    title: 'Halaman tidak ditemukan — resufy',
    description: 'Halaman yang kamu cari tidak ada di resufy.',
  });
  return (
    <PublicLayout>
      <div className="relative flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="blob left-1/2 top-8 h-64 w-64 -translate-x-1/2 bg-primary/15" aria-hidden />
        <span className="relative grid h-20 w-20 place-items-center rounded-2xl bg-cta-gradient text-white shadow-glow-primary">
          <MapTrifold size={36} weight="bold" aria-hidden />
        </span>
        <h1 className="relative text-4xl font-extrabold text-foreground">Halaman tidak ditemukan</h1>
        <p className="relative max-w-sm text-sm text-muted-fg">
          Alamat ini tidak ada, atau mungkin sudah dipindahkan. Yuk kembali ke beranda.
        </p>
        <div className="relative">
          <Link to="/">
            <Button variant="primary" size="lg">
              Ke Beranda
            </Button>
          </Link>
        </div>
      </div>
    </PublicLayout>
  );
}
