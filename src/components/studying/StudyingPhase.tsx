import PhaseHub from './PhaseHub';
import { getPhaseConfig } from './phaseConfigs';

interface StudyingPhaseProps {
  onBack: () => void;
  userEmail: string;
}

export default function StudyingPhase({ onBack, userEmail }: StudyingPhaseProps) {
  const config = getPhaseConfig('studying');
  return <PhaseHub config={config} onBack={onBack} userEmail={userEmail} />;
}
