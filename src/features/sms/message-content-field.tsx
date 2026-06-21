import { AlertCircle, Image as ImageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import type { MessageType } from './sms-types';

interface MessageContentFieldProps {
  content: string;
  contentBytes: number;
  isLMS: boolean;
  isMMS: boolean;
  messageType: MessageType;
  onContentChange: (value: string) => void;
}

export function MessageContentField({
  content,
  contentBytes,
  isLMS,
  isMMS,
  messageType,
  onContentChange,
}: MessageContentFieldProps) {
  const maxBytes = isMMS || isLMS ? 2000 : 80;

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">문자 내용</h3>
        <div className="flex items-center gap-2">
          {isMMS && (
            <Badge variant="outline" className="gap-1 border-violet-200 bg-violet-50 text-violet-700">
              <ImageIcon className="h-3 w-3" />
              MMS
            </Badge>
          )}
          {isLMS && !isMMS && (
            <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-700">
              <AlertCircle className="h-3 w-3" />
              LMS
            </Badge>
          )}
          <span className="text-xs font-medium text-muted-foreground">
            {contentBytes} / {maxBytes} byte
          </span>
        </div>
      </div>
      <Textarea
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        rows={8}
        placeholder={'안녕하세요, OO학원입니다.\n\n내용을 입력해주세요.'}
        className="min-h-[210px] resize-y bg-background leading-6"
      />
      <p className="text-xs text-muted-foreground">
        현재 발송 유형은 {messageType}입니다. 이미지가 있으면 MMS로 전환됩니다.
      </p>
    </section>
  );
}
