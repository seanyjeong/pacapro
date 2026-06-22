'use client';

import { ImageIcon } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  focusClassName: string;
  hint?: string;
}

export default function TemplateImageField({ value, onChange, focusClassName, hint }: Props) {
  return (
    <div className="md:col-span-2 border-t border-border pt-4 mt-2">
      <div className="flex items-center gap-2 mb-3">
        <ImageIcon className="w-4 h-4 text-muted-foreground" />
        <h4 className="font-medium text-foreground">이미지 설정 (선택)</h4>
      </div>
      <input
        type="url"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 ${focusClassName}`}
        placeholder="https://example.com/image.jpg"
      />
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
