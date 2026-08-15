import { useNavigate } from 'react-router-dom';
import { MapTrifold } from '@phosphor-icons/react';
import { Button } from '../../../components/ui/Button';
import usePageMeta from '../../../hooks/usePageMeta';

export function NotFoundPublic() {
  const navigate = useNavigate();
  // SEO fase 09
  usePageMeta({
    title: 'Alat tidak ditemukan — resufy',
    description: 'Toolbox yang kamu cari tidak ada. Lihat daftar alat resufy yang tersedia.',
  });
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 py-16 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-primary-100 text-primary">
        <MapTrifold size={32} weight="bold" aria-hidden />
      </span>
      <h1 className="text-3xl font-extrabold text-foreground">Alat tidak ditemukan</h1>
      <p className="max-w-sm text-sm text-muted-fg">
        Toolbox yang kamu cari tidak ada. Lihat daftar alat yang tersedia.
      </p>
      <Button variant="primary" onClick={() => navigate('/app/toolbox')}>
        Kembali ke Toolbox
      </Button>
    </div>
  );
}
