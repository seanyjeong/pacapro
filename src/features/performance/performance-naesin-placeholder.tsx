import { BookOpen } from 'lucide-react';

export function NaesinPlaceholder() {
  return (
    <section className="rounded-md border border-border bg-card px-6 py-12 text-center">
      <BookOpen className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
      <h2 className="text-lg font-semibold text-foreground">내신 성적 관리</h2>
      <p className="mt-2 text-sm text-muted-foreground">내신 성적 입력 및 관리 기능은 추후 업데이트 예정입니다.</p>
      <span className="mt-5 inline-flex rounded-md border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
        준비 중
      </span>
    </section>
  );
}
