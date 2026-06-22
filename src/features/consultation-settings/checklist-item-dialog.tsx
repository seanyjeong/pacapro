import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { ChecklistInputType, NewChecklistItemState } from './consultation-settings-types';

interface ChecklistItemDialogProps {
  open: boolean;
  checklistCategories: string[];
  newChecklistItem: NewChecklistItemState;
  onOpenChange: (open: boolean) => void;
  onItemChange: <K extends keyof NewChecklistItemState>(field: K, value: NewChecklistItemState[K]) => void;
  onAdd: () => void;
}

export function ChecklistItemDialog({
  open,
  checklistCategories,
  newChecklistItem,
  onOpenChange,
  onItemChange,
  onAdd,
}: ChecklistItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>체크리스트 항목 추가</DialogTitle>
          <DialogDescription>상담 진행 시 체크할 새 항목을 추가합니다.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-6">
          <div className="space-y-2">
            <Label>카테고리</Label>
            <Select value={newChecklistItem.category} onValueChange={(value) => onItemChange('category', value)}>
              <SelectTrigger>
                <span>{newChecklistItem.category || '카테고리 선택 또는 직접 입력'}</span>
              </SelectTrigger>
              <SelectContent>
                {checklistCategories.map((category) => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              aria-label="새 카테고리 입력"
              value={newChecklistItem.category}
              onChange={(event) => onItemChange('category', event.target.value)}
              placeholder="새 카테고리 입력"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="checklist-item-text">항목명</Label>
            <Input
              id="checklist-item-text"
              value={newChecklistItem.text}
              onChange={(event) => onItemChange('text', event.target.value)}
              placeholder="예: 타학원 경험 확인"
            />
          </div>

          <div className="space-y-2">
            <Label>입력 필드 타입</Label>
            <Select
              value={newChecklistItem.inputType}
              onValueChange={(value) => onItemChange('inputType', value as ChecklistInputType)}
            >
              <SelectTrigger>
                <span>{formatInputType(newChecklistItem.inputType)}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">없음 (체크만)</SelectItem>
                <SelectItem value="text">텍스트 입력</SelectItem>
                <SelectItem value="radio">라디오 선택</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {newChecklistItem.inputType !== 'none' && (
            <div className="space-y-2">
              <Label htmlFor="checklist-input-label">입력 필드 라벨</Label>
              <Input
                id="checklist-input-label"
                value={newChecklistItem.inputLabel}
                onChange={(event) => onItemChange('inputLabel', event.target.value)}
                placeholder="예: 학원명, 체력"
              />
            </div>
          )}

          {newChecklistItem.inputType === 'radio' && (
            <div className="space-y-2">
              <Label htmlFor="checklist-radio-options">선택 옵션</Label>
              <Input
                id="checklist-radio-options"
                value={newChecklistItem.radioOptions}
                onChange={(event) => onItemChange('radioOptions', event.target.value)}
                placeholder="예: 상, 중, 하"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onAdd}>추가</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatInputType(inputType: ChecklistInputType) {
  if (inputType === 'text') return '텍스트 입력';
  if (inputType === 'radio') return '라디오 선택';
  return '없음 (체크만)';
}
