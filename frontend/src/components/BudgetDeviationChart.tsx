import type { PainelReflexaoData } from '@/services/relatoriosService';
import { BudgetDeviationList } from '@/components/finance/BudgetDeviationList';

type Deviation = PainelReflexaoData['desvios'][number];

export function BudgetDeviationChart({ data }: { data: Deviation[] }) {
  return <BudgetDeviationList data={data} />;
}
