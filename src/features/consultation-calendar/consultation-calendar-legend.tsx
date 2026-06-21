import { FileText, UserCheck } from 'lucide-react';

export function ConsultationCalendarLegend() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 border-t pt-4 text-xs">
      <div className="flex items-center gap-3 border-r pr-4">
        <span className="font-medium text-gray-500">신규상담:</span>
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-yellow-400" />대기</span>
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-blue-500" />확정</span>
      </div>
      <div className="flex items-center gap-3 border-r pr-4">
        <span className="flex items-center gap-1 font-medium text-emerald-600">
          <UserCheck className="h-3 w-3" />
          재원생:
        </span>
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-emerald-300" />대기</span>
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-emerald-500" />확정</span>
      </div>
      <span className="flex items-center gap-1 border-r pr-4 font-medium text-amber-600">
        <FileText className="h-3 w-3" />
        상담메모
      </span>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-green-500" />완료</span>
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-gray-400" />취소</span>
        <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-full bg-red-500" />노쇼</span>
      </div>
    </div>
  );
}
