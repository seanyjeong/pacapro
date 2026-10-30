import type { InputHTMLAttributes, ReactNode } from 'react';
import { ADMISSION_FIELD_CLASS } from '@/constants/ilsan-admission';
import { cn } from '@/lib/utils/cn';
interface Props extends InputHTMLAttributes<HTMLInputElement> { label: string; help?: ReactNode }
export function AdmissionInput({label,help,id,...props}:Props) {
  return <div className="min-w-0 space-y-1.5">
    <label className="block text-sm font-medium text-foreground/80" htmlFor={id}>{label}{props.required && <span className="ml-0.5 text-destructive" aria-hidden="true">*</span>}</label>
    <input id={id} className={cn(ADMISSION_FIELD_CLASS,'h-12')} aria-describedby={help ? `${id}-help` : undefined} {...props}/>
    {help && <p id={`${id}-help`} className="text-[13px] leading-5 text-muted-foreground">{help}</p>}
  </div>;
}
