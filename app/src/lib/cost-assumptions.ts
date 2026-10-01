import { numericAssumption } from './assumptions';
import { totals, type CostLine } from './cost-plan';
import { dollars, money, total, type Cost } from './cost';

export function costLineAssumptions(lines: CostLine[], apply: (lines: CostLine[]) => boolean | void) {
  return lines.map(line => numericAssumption({
    id: line.id, label: `${line.label} estimate`, value: line.amount, min: 0, max: 1000000,
    owner: 'student', source: line.source === 'imported' ? `Imported personal copy: ${line.from || 'Source not recorded'}; ${line.on || 'Copy date unknown'}` : 'Your cost estimate',
    outcomes: amount => {
      const result = totals(lines.map(l => l.id === line.id ? { ...l, amount } : l));
      return [`Fall or spring total: ${dollars(result.perTerm)}`, `Summer total: ${dollars(result.summer)}`, 'Aid and official bill: Unknown'];
    },
    apply: amount => apply(lines.map(l => l.id === line.id ? { ...l, amount } : l)),
  }));
}
export function outOfPocketAssumptions(costs: Cost[], apply: (id: string, cents: number) => void) {
  return costs.map(cost => numericAssumption({
    id: cost.id, label: `${cost.what} cost`, value: cost.cents / 100, min: 0, max: 100000,
    owner: 'student', source: 'Your out-of-pocket record',
    outcomes: amount => {
      const result = total(costs.map(c => c.id === cost.id ? { ...c, cents: Math.round(amount * 100) } : c));
      return [`Term spending: ${money(result.spent)}`, `Term net cost: ${money(result.net)}`];
    },
    apply: amount => apply(cost.id, Math.round(amount * 100)),
  }));
}
