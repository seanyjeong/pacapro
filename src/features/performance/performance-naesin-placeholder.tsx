import { BookOpen } from 'lucide-react';

export function NaesinPlaceholder() {
  return (
    <section className="rounded-md border border-slate-200 bg-white px-6 py-12 text-center">
      <BookOpen className="mx-auto mb-4 h-12 w-12 text-slate-300" />
      <h2 className="text-lg font-semibold text-slate-800">내신 성적 관리</h2>
      <p className="mt-2 text-sm text-slate-500">내신 성적 입력 및 관리 기능은 추후 업데이트 예정입니다.</p>
      <span className="mt-5 inline-flex rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
        준비 중
      </span>
    </section>
  );
}
