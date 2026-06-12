import { ExploreSection } from '@/features/app/sections/explore-section';
import { WorkspaceScreen } from '@/features/app/screens/workspace-screen';

export default function ExploreRoute() {
  return (
    <WorkspaceScreen section="explore">
      <ExploreSection />
    </WorkspaceScreen>
  );
}
