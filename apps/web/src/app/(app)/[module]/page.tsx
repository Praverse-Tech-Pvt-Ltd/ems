import { notFound } from 'next/navigation';
import { StitchPage } from '@/components/command-center/StitchPage';
import { routeAliases, stitchPages } from '@/lib/stitch-pages';

export default function ModulePage({ params }: { params: { module: string } }) {
  const key = (stitchPages[params.module] ? params.module : routeAliases[params.module]) as keyof typeof stitchPages | undefined;
  const config = key ? stitchPages[key] : undefined;

  if (!config) {
    notFound();
  }

  return <StitchPage config={config} />;
}
