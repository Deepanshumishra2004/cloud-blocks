import { DashboardSection } from '@/features/app/sections/dashboard-section';
import { WorkspaceScreen } from '@/features/app/screens/workspace-screen';

export default function DashboardRoute() {
  return (
    <WorkspaceScreen section="dashboard">
      <DashboardSection />
    </WorkspaceScreen>
  );
}
