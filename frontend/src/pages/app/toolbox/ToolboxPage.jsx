import { Link } from 'react-router-dom';
import {
  Brain,
  FilePdf,
  TextAa,
  Wrench,
} from '@phosphor-icons/react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import usePageMeta from '../../../hooks/usePageMeta';

export const TOOLS = [
  {
    key: 'compress',
    icon: FilePdf,
    title: 'Kompres PDF',
    desc: 'Kecilkan ukuran PDF agar mudah dikirim email — kualitas tetap terjaga.',
    badge: 'Gratis',
    grad: 'from-primary to-indigo-600',
  },
  {
    key: 'paraphrase',
    icon: TextAa,
    title: 'Parafrase AI',
    desc: 'Ubah ulang teks yang terindikasi AI menjadi lebih natural dengan AI.',
    badge: 'Gratis',
    grad: 'from-fuchsia-500 to-violet-500',
  },
  {
    key: 'ai-check',
    icon: Brain,
    title: 'AI Content Detector',
    desc: 'Cek apakah teks ditulis AI (ChatGPT/Gemini) — gratis.',
    badge: 'Gratis',
    grad: 'from-accent to-accent-600',
  },
];

export default function ToolboxPage() {
  // SEO fase 09
  usePageMeta({
    title: 'Toolbox Dokumen Gratis — resufy',
    description:
      'Kompres PDF, parafrase teks dengan AI, dan cek teks AI — gratis, tanpa perlu akun.',
  });
  return (
    <div className="space-y-6">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cta-gradient text-white shadow-glow-primary">
            <Wrench size={24} weight="bold" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground">Toolbox</h1>
            <p className="text-sm text-muted-fg">
              Utilitas dokumen gratis — tanpa perlu akun. Pilih alat di bawah.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {TOOLS.map((tool) => (
            <Link
              key={tool.key}
              to={`/app/toolbox/${tool.key}`}
              className="group transition-transform duration-200 hover:-translate-y-1"
            >
              <Card
                padded={false}
                className="p-0 h-full transition-shadow duration-200 group-hover:shadow-lg group-hover:border-primary/20"
              >
                <div className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between">
                    <span
                      className={`grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br ${tool.grad} text-white shadow-lg transition-transform duration-200 group-hover:scale-110`}
                    >
                      <tool.icon size={24} weight="bold" aria-hidden />
                    </span>
                    <Badge tone="gratis">{tool.badge}</Badge>
                  </div>
                  <h2 className="text-lg font-bold text-foreground group-hover:text-primary">
                    {tool.title}
                  </h2>
                  <p className="text-sm text-muted-fg">{tool.desc}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
  );
}
