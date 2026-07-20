interface StudentMemoDetailProps {
  memo: string | null;
}

export function StudentMemoDetail({ memo }: StudentMemoDetailProps) {
  const value = memo?.trim();

  return (
    <div className="min-w-0 md:col-span-2" data-testid="student-detail-memo">
      <div className="text-xs font-medium text-muted-foreground">학생 메모</div>
      {value ? (
        <p className="mt-1 whitespace-pre-wrap break-words text-sm font-medium leading-6 text-foreground">
          {value}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">등록된 학생 메모가 없습니다.</p>
      )}
    </div>
  );
}
