import { StitchPage } from '@/components/command-center/StitchPage';
import { stitchPages } from '@/lib/stitch-pages';

export default function OwnerCommandCenterPage() {
  const config = stitchPages['nexus-operational-intelligence']!;
  return <StitchPage config={config} />;
}
