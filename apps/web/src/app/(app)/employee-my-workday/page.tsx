import { StitchPage } from '@/components/command-center/StitchPage';
import { stitchPages } from '@/lib/stitch-pages';

export default function EmployeeMyWorkdayPage() {
  const config = stitchPages['employee-my-workday']!;
  return <StitchPage config={config} />;
}
