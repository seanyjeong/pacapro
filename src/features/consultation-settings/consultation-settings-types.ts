import type { ChecklistTemplate, ConsultationSettings } from '@/lib/types/consultation';

export type ChecklistInputType = 'none' | 'text' | 'radio';

export interface NewChecklistItemState {
  category: string;
  text: string;
  inputType: ChecklistInputType;
  inputLabel: string;
  radioOptions: string;
}

export type ConsultationSettingsPatch = Partial<ConsultationSettings> & {
  slug?: string;
  checklist_template?: ChecklistTemplate[];
};
