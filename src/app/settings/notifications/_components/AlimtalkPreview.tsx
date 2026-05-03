'use client';

// Phase 4 #1 — 알림톡 말풍선 미리보기 재사용 sub-component
import { ConsultationButton } from '@/lib/api/notifications';

interface Props {
  academyName: string;
  templateContent: string;
  imageUrl?: string;
  buttons?: ConsultationButton[];
  replacements: Record<string, string>;
  timeLabel?: string;
}

export default function AlimtalkPreview({ academyName, templateContent, imageUrl, buttons, replacements, timeLabel = '오전 9:00' }: Props) {
  if (!templateContent) return null;

  let preview = templateContent;
  Object.entries(replacements).forEach(([key, val]) => {
    preview = preview.replace(new RegExp(key.replace(/[{}#]/g, c => `\\${c}`), 'g'), val);
  });

  return (
    <div className="md:col-span-2">
      <p className="text-sm font-medium text-foreground mb-2">미리보기</p>
      <div className="bg-[#B2C7D9] rounded-2xl p-4 max-w-sm mx-auto shadow-lg">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#9BB3C7]">
          <div className="w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-yellow-800" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.86 5.31 4.64 6.72-.22.82-.87 3.04-.92 3.28 0 0-.02.08.04.11.06.03.12.01.12.01.17-.02 3.03-1.97 3.58-2.33.83.12 1.69.18 2.54.18 5.52 0 10-3.58 10-8 0-4.42-4.48-8-10-8z"/>
            </svg>
          </div>
          <span className="font-medium text-gray-800 text-sm">알림톡</span>
        </div>
        <div className="flex gap-2">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-600 mb-1">{academyName}</p>
            <div className="bg-white rounded-lg rounded-tl-none p-3 shadow-sm">
              {imageUrl && (
                <div className="mb-2 -mx-1 -mt-1">
                  <img
                    src={imageUrl}
                    alt="알림톡 이미지"
                    className="w-full h-32 object-cover rounded-t-lg"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{preview}</p>
              {buttons && buttons.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-200 space-y-1.5">
                  {buttons.map((btn, idx) => (
                    <div key={idx} className="text-center py-2 px-3 bg-gray-100 rounded-md text-sm text-blue-600 font-medium hover:bg-gray-200 cursor-pointer">
                      {btn.buttonName || '버튼'}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">{timeLabel}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
