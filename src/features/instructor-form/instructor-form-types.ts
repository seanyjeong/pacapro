import type { Instructor, InstructorFormData } from '@/lib/types/instructor';

export interface InstructorFormProps {
  mode: 'create' | 'edit';
  initialData?: Instructor;
  onSubmit: (data: InstructorFormData) => Promise<void>;
  onCancel: () => void;
}

export type InstructorFormErrors = Record<string, string>;

export type InstructorFormChangeHandler = <K extends keyof InstructorFormData>(
  field: K,
  value: InstructorFormData[K]
) => void;
