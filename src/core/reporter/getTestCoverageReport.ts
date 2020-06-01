import { CoverageSummaryData } from 'istanbul-lib-coverage';
import { CoverageThresholdConfig } from '../TestRunnerConfig';
import { TerminalEntry } from './Terminal';
import chalk from 'chalk';
import { coverageTypes } from '../getCoverageSummary';

export function getTestCoverageReport(
  coverageData: CoverageSummaryData,
  passedCoverage: boolean,
  coverageThreshold?: CoverageThresholdConfig
) {
  const entries: TerminalEntry[] = [];

  if (passedCoverage) {
    const coverageSum = coverageTypes.reduce((all, type) => all + coverageData[type].pct, 0);
    const avgCoverage = Math.round((coverageSum * 100) / 4) / 100;

    entries.push(`Test coverage: ${chalk.green(`${avgCoverage} %`)}`);
  } else {
    entries.push('Test coverage: ');
    const totalsStrings = [];

    for (const type of coverageTypes) {
      const { pct } = coverageData[type];
      const passed = !coverageThreshold || pct >= coverageThreshold[type];
      const name = `${type[0].toUpperCase()}${type.substring(1)}`;
      totalsStrings.push(`${name}: ${chalk[passed ? 'green' : 'red'](`${pct} %`)}`);
    }

    entries.push({ text: totalsStrings.join('\n'), indent: 2 });
  }
  return entries;
}
