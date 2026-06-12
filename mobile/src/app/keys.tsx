import { KeysSection } from '@/features/app/sections/keys-section';
import { WorkspaceScreen } from '@/features/app/screens/workspace-screen';

export default function KeysRoute() {
  return (
    <WorkspaceScreen section="keys">
      <KeysSection />
    </WorkspaceScreen>
  );
}
