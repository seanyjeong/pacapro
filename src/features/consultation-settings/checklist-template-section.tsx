import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ChecklistTemplate } from '@/lib/types/consultation';

interface ChecklistTemplateSectionProps {
  checklistTemplate: ChecklistTemplate[];
  checklistCategories: string[];
  savingChecklist: boolean;
  onOpenAddDialog: () => void;
  onResetDefault: () => void;
  onSave: () => void;
  onRemoveItem: (id: number) => void;
}

export function ChecklistTemplateSection({
  checklistTemplate,
  checklistCategories,
  savingChecklist,
  onOpenAddDialog,
  onResetDefault,
  onSave,
  onRemoveItem,
}: ChecklistTemplateSectionProps) {
  return (
    <Card className="rounded-md shadow-none">
      <CardHeader className="space-y-1">
        <CardTitle>상담 체크리스트 템플릿</CardTitle>
        <CardDescription>상담 진행 시 체크할 항목들을 관리합니다. 상담 진행 페이지에서 사용됩니다.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {checklistCategories.map((category) => (
          <div key={category} className="rounded-md border border-border p-4">
            <h4 className="mb-3 font-medium text-foreground">{category}</h4>
            <div className="space-y-2">
              {checklistTemplate
                .filter((item) => item.category === category)
                .map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-muted/60 p-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm">{item.text}</span>
                      {item.input && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({item.input.type === 'text' ? '텍스트 입력' : `선택: ${item.input.options?.join(', ')}`})
                        </span>
                      )}
                      {item.inputs && <span className="ml-2 text-xs text-muted-foreground">(다중 입력)</span>}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => onRemoveItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" onClick={onOpenAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            항목 추가
          </Button>
          <Button variant="outline" onClick={onResetDefault}>기본값으로 초기화</Button>
          <Button onClick={onSave} disabled={savingChecklist}>
            {savingChecklist ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            체크리스트 저장
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
