import { toast } from 'sonner';
import { getNotificationErrorText } from './notification-error-utils';

type SetTestingState = (value: boolean) => void;
type SendNotificationTest = () => Promise<unknown>;

interface NotificationTestRunnerOptions {
  clearMessage: () => void;
  refreshLogs: () => void;
}

export function createNotificationTestRunner({
  clearMessage,
  refreshLogs,
}: NotificationTestRunnerOptions) {
  return async function runNotificationTest(
    phone: string,
    setTestingState: SetTestingState,
    send: SendNotificationTest,
    successText: string,
    fallbackErrorText: string
  ) {
    if (!phone.trim()) {
      toast.error('테스트 전화번호를 입력해주세요.');
      return;
    }

    setTestingState(true);
    clearMessage();
    try {
      await send();
      toast.success(successText);
      refreshLogs();
    } catch (error: unknown) {
      toast.error(getNotificationErrorText(error, fallbackErrorText));
    } finally {
      setTestingState(false);
    }
  };
}
