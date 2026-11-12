/**
 * 지점·반 목록 훅 - React Query 기반
 * 지점이 하나도 없는 학원은 지점·반 기능을 쓰지 않는 학원이다.
 */

import { useQuery } from '@tanstack/react-query';
import { branchesAPI } from '@/lib/api/branches';

export const BRANCH_TREE_QUERY_KEY = ['branches'] as const;

export function useBranchTree() {
  const query = useQuery({
    queryKey: BRANCH_TREE_QUERY_KEY,
    queryFn: () => branchesAPI.getTree({ suppressErrorToast: true }),
  });
  const branches = query.data?.branches ?? [];

  return {
    branches,
    unassigned: query.data?.unassigned ?? { student_count: 0, active_count: 0 },
    enabled: branches.length > 0,
    loading: query.isLoading,
    reload: query.refetch,
  };
}
