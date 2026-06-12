import { ReplsSection } from '@/features/app/sections/repls-section';
import { WorkspaceScreen } from '@/features/app/screens/workspace-screen';

export default function ReplsRoute() {
  return (
    <WorkspaceScreen section="repls">
      <ReplsSection />
    </WorkspaceScreen>
  );
}
