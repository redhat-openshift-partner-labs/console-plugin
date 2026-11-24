import type { K8sResourceCommon } from '@openshift-console/dynamic-plugin-sdk';

export type RunStatus = 'running' | 'succeeded' | 'failed';

export function getRunStatus(run: K8sResourceCommon | undefined): RunStatus {
  const conditions = (
    run as { status?: { conditions?: { type: string; status: string }[] } } | undefined
  )?.status?.conditions;
  const succeeded = conditions?.find((condition) => condition.type === 'Succeeded');
  if (succeeded?.status === 'True') return 'succeeded';
  if (succeeded?.status === 'False') return 'failed';
  return 'running';
}
