import { Building } from 'lucide-react';
import { TUITION_DUE_DAY_OPTIONS } from './settings-constants';
import { SettingsSectionCard } from './settings-section-card';
import { SettingsSelect } from './settings-select';
import { SettingsTextInput } from './settings-text-input';
import type { AcademySettings } from './settings-types';

interface AcademyBasicCardProps {
  settings: AcademySettings;
  updateSetting: <K extends keyof AcademySettings>(key: K, value: AcademySettings[K]) => void;
}

export function AcademyBasicCard({ settings, updateSetting }: AcademyBasicCardProps) {
  return (
    <SettingsSectionCard
      id="academy-basic"
      title="학원 기본 정보"
      description="청구서와 상담 기록에 공통으로 쓰이는 값"
      icon={Building}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <SettingsTextInput
          label="학원명"
          value={settings.academy_name}
          onValueChange={(value) => updateSetting('academy_name', value)}
          placeholder="예: 파카학원"
        />
        <SettingsTextInput
          label="전화번호"
          type="tel"
          value={settings.phone}
          onValueChange={(value) => updateSetting('phone', value)}
          placeholder="010-0000-0000"
        />
        <SettingsTextInput
          label="주소"
          value={settings.address}
          onValueChange={(value) => updateSetting('address', value)}
          placeholder="학원 주소"
        />
        <SettingsTextInput
          label="사업자등록번호"
          value={settings.business_number}
          onValueChange={(value) => updateSetting('business_number', value)}
          placeholder="000-00-00000"
        />
        <SettingsSelect
          label="기본 납부일"
          value={settings.tuition_due_day}
          options={TUITION_DUE_DAY_OPTIONS}
          onValueChange={(value) => updateSetting('tuition_due_day', value)}
          helperText="학생별 납부일이 없을 때 적용됩니다"
        />
      </div>
    </SettingsSectionCard>
  );
}
