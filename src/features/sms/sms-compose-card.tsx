import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AllRecipientFilters } from './all-recipient-filters';
import { CustomPhoneFields } from './custom-phone-fields';
import { ImageAttachmentField } from './image-attachment-field';
import { IndividualStudentPicker } from './individual-student-picker';
import { MessageContentField } from './message-content-field';
import { RecipientTypeSelector } from './recipient-type-selector';
import { SenderNumberSelect } from './sender-number-select';
import { SendModeSelector } from './send-mode-selector';
import type { UseSmsPageState } from './use-sms-page-state';

interface SmsComposeCardProps {
  sms: UseSmsPageState;
}

export function SmsComposeCard({ sms }: SmsComposeCardProps) {
  const canSend = !sms.sending && sms.content.trim().length > 0;

  return (
    <Card className="rounded-lg border-border/80 shadow-none">
      <CardHeader className="border-b border-border/70 p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-semibold">문자 작성</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">대상 선택부터 내용 확인까지 한 화면에서 처리합니다.</p>
          </div>
          <Button onClick={sms.handleSend} disabled={!canSend} className="gap-2 sm:w-auto">
            <Send className="h-4 w-4" />
            {sms.sending ? '발송 중...' : `${sms.messageType} 발송`}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-5">
        <SendModeSelector sendMode={sms.sendMode} onChange={sms.handleModeChange} />

        <div className="grid gap-5 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-8">
            {sms.sendMode === 'all' && (
              <AllRecipientFilters
                statusFilter={sms.statusFilter}
                gradeFilter={sms.gradeFilter}
                recipientsCount={sms.recipientsCount}
                errorMessage={sms.recipientsError}
                onStatusFilterChange={sms.setStatusFilter}
                onGradeFilterChange={sms.setGradeFilter}
              />
            )}

            {sms.sendMode === 'individual' && (
              <IndividualStudentPicker
                searchQuery={sms.searchQuery}
                searchResults={sms.searchResults}
                searching={sms.searching}
                selectedStudent={sms.selectedStudent}
                onSearchQueryChange={sms.setSearchQuery}
                onSelectStudent={sms.setSelectedStudent}
                onClearStudent={() => sms.setSelectedStudent(null)}
              />
            )}

            {sms.sendMode === 'custom' && (
              <CustomPhoneFields
                phones={sms.customPhones}
                onPhoneChange={sms.handlePhoneChange}
                onAddPhone={sms.addPhoneField}
                onRemovePhone={sms.removePhoneField}
              />
            )}

            <RecipientTypeSelector
              sendMode={sms.sendMode}
              recipientType={sms.recipientType}
              recipientsCount={sms.recipientsCount}
              selectedStudent={sms.selectedStudent}
              onRecipientTypeChange={sms.setRecipientType}
            />

            <MessageContentField
              content={sms.content}
              contentBytes={sms.contentBytes}
              isLMS={sms.isLMS}
              isMMS={sms.isMMS}
              messageType={sms.messageType}
              onContentChange={sms.setContent}
            />
          </div>

          <div className="space-y-5 lg:col-span-4">
            <SenderNumberSelect
              senderNumbers={sms.senderNumbers}
              selectedSenderId={sms.selectedSenderId}
              errorMessage={sms.senderNumbersError}
              onSelectedSenderIdChange={sms.setSelectedSenderId}
            />

            <ImageAttachmentField
              images={sms.images}
              onImageSelect={sms.handleImageSelect}
              onRemoveImage={sms.removeImage}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
