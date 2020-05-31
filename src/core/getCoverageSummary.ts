import { createCoverageMap, CoverageSummaryData } from 'istanbul-lib-coverage';
import { TestSession } from './TestSession';
import { CoverageThresholdConfig } from './TestRunnerConfig';

export const coverageTypes: (keyof CoverageSummaryData)[] = [
  'lines',
  'statements',
  'branches',
  'functions',
];

export function getCoverageSummary(
  sessions: Iterable<TestSession>,
  coverageThreshold?: CoverageThresholdConfig
): { coverageData: CoverageSummaryData; passed: boolean } {
  const coverageMap = createCoverageMap();

  for (const session of sessions) {
    if (session.result!.testCoverage) {
      coverageMap.merge(session.result!.testCoverage);
    }
  }

  const coverageData = coverageMap.getCoverageSummary().data;

  if (coverageThreshold) {
    for (const type of coverageTypes) {
      const { pct } = coverageData[type];
      if (pct < coverageThreshold[type]) {
        return { coverageData, passed: false };
      }
    }
  }
  return { coverageData, passed: true };
}
