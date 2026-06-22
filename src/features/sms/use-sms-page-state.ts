import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import { smsAPI } from '@/lib/api/sms';
import type {
  GradeFilter,
  RecipientType,
  SendMode,
  SmsImageFile,
  SmsLog,
  SmsRecipientsCount,
  SmsSenderNumber,
  SmsStudent,
  StatusFilter,
} from './sms-types';
import {
  buildSmsPayload,
  createSendConfirmMessage,
  formatPhoneNumber,
  getContentBytes,
  getIndividualTargetPhone,
  getMessageType,
  getRecipientCount,
} from './sms-utils';

const SILENT_CONFIG: APIRequestConfig = { suppressErrorToast: true };
const MAX_IMAGE_COUNT = 3;
const MAX_IMAGE_SIZE = 300 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

export function useSmsPageState() {
  const [sendMode, setSendMode] = useState<SendMode>('all');
  const [recipientType, setRecipientType] = useState<RecipientType>('parent');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>('all');
  const [content, setContent] = useState('');
  const [customPhones, setCustomPhones] = useState<string[]>(['']);
  const [sending, setSending] = useState(false);
  const [recipientsCount, setRecipientsCount] = useState<SmsRecipientsCount>({ all: 0, students: 0, parents: 0 });
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [images, setImages] = useState<SmsImageFile[]>([]);
  const imagesRef = useRef<SmsImageFile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SmsStudent[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<SmsStudent | null>(null);
  const [senderNumbers, setSenderNumbers] = useState<SmsSenderNumber[]>([]);
  const [selectedSenderId, setSelectedSenderId] = useState<number | null>(null);

  const contentBytes = useMemo(() => getContentBytes(content), [content]);
  const messageType = useMemo(() => getMessageType(contentBytes, images.length), [contentBytes, images.length]);
  const isMMS = messageType === 'MMS';
  const isLMS = messageType === 'LMS';

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.preview));
    };
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await smsAPI.getLogs({ limit: 20 }, SILENT_CONFIG);
      setLogs(data.logs);
    } catch {
      console.error('SMS logs load failed');
      toast.error('문자 발송 내역을 불러오지 못했습니다.');
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const loadRecipientsCount = useCallback(async () => {
    try {
      const data = await smsAPI.getRecipientsCount(statusFilter, gradeFilter, SILENT_CONFIG);
      setRecipientsCount(data);
    } catch {
      console.error('SMS recipient count load failed');
      toast.error('문자 수신자 수를 불러오지 못했습니다.');
    }
  }, [gradeFilter, statusFilter]);

  const loadSenderNumbers = useCallback(async () => {
    try {
      const settingsResponse = await apiClient.get<{ settings: { service_type?: string } }>(
        '/notifications/settings',
        SILENT_CONFIG
      );
      const serviceType = (settingsResponse.settings?.service_type || 'sens') as 'solapi' | 'sens';
      const { senderNumbers: numbers } = await smsAPI.getSenderNumbers(serviceType, SILENT_CONFIG);
      setSenderNumbers(numbers);

      const defaultSender = numbers.find((sender) => sender.is_default === 1);
      setSelectedSenderId(defaultSender?.id || numbers[0]?.id || null);
    } catch {
      console.error('SMS sender numbers load failed');
      toast.error('발신번호 정보를 불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    void loadLogs();
    void loadSenderNumbers();
  }, [loadLogs, loadSenderNumbers]);

  useEffect(() => {
    if (sendMode === 'all') {
      void loadRecipientsCount();
    }
  }, [loadRecipientsCount, sendMode]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const response = await apiClient.get<{ students: SmsStudent[] }>('/students', {
          ...SILENT_CONFIG,
          params: { search: query, limit: 10, status: 'active' },
        });
        setSearchResults(response.students || []);
      } catch {
        console.error('SMS student search failed');
        toast.error('학생 검색을 완료하지 못했습니다. 이름을 다시 확인해주세요.');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const handleModeChange = (mode: SendMode) => {
    setSendMode(mode);
    setSelectedStudent(null);
    setSearchQuery('');
    setSearchResults([]);
    if (mode !== 'all') setGradeFilter('all');
  };

  const handlePhoneChange = (index: number, value: string) => {
    setCustomPhones((prev) => {
      const next = [...prev];
      next[index] = formatPhoneNumber(value);
      return next;
    });
  };

  const addPhoneField = () => setCustomPhones((prev) => [...prev, '']);

  const removePhoneField = (index: number) => {
    setCustomPhones((prev) => (prev.length > 1 ? prev.filter((_, itemIndex) => itemIndex !== index) : prev));
  };

  const handleImageSelect = (files: FileList | null) => {
    if (!files) return;

    const availableSlots = MAX_IMAGE_COUNT - images.length;
    if (availableSlots <= 0) {
      toast.error('이미지는 최대 3장까지 첨부 가능합니다.');
      return;
    }

    Array.from(files).slice(0, availableSlots).forEach((file) => {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error('JPG, PNG 이미지만 첨부 가능합니다.');
        return;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        toast.error('이미지 크기는 300KB 이하여야 합니다.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const base64 = result.split(',')[1] || '';
        setImages((prev) => [...prev, { name: file.name, data: base64, preview: URL.createObjectURL(file) }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  };

  const validateBeforeSend = (): number | null => {
    if (!content.trim()) {
      toast.error('문자 내용을 입력해주세요.');
      return null;
    }

    if (sendMode === 'custom') {
      const validPhones = customPhones.filter((phone) => phone.trim());
      if (validPhones.length === 0) {
        toast.error('전화번호를 입력해주세요.');
        return null;
      }
      if (validPhones.some((phone) => !/^\d{3}-\d{3,4}-\d{4}$/.test(phone.trim()))) {
        toast.error('전화번호는 하이픈(-)을 포함한 형식으로 입력해주세요. 예: 010-1234-5678');
        return null;
      }
    }

    if (sendMode === 'individual') {
      if (!selectedStudent) {
        toast.error('학생을 선택해주세요.');
        return null;
      }
      const targetPhone = getIndividualTargetPhone(selectedStudent, recipientType);
      if (!targetPhone) {
        toast.error(`${recipientType === 'student' ? '학생' : '학부모'} 전화번호가 등록되어 있지 않습니다.`);
        return null;
      }
    }

    const recipientCount = getRecipientCount(sendMode, recipientType, customPhones, recipientsCount);
    if (recipientCount === 0) {
      toast.error('발송할 수신자가 없습니다.');
      return null;
    }
    return recipientCount;
  };

  const handleSend = async () => {
    const recipientCount = validateBeforeSend();
    if (recipientCount === null) return;

    if (!window.confirm(createSendConfirmMessage(recipientCount, messageType, images.length))) return;

    setSending(true);
    try {
      const payload = buildSmsPayload({
        sendMode,
        recipientType,
        content,
        customPhones,
        selectedStudent,
        images,
        statusFilter,
        gradeFilter,
        senderNumberId: selectedSenderId,
      });
      const result = await smsAPI.send(payload, SILENT_CONFIG);
      toast.success(result.message || '문자를 발송했습니다.');
      void loadLogs();
    } catch {
      console.error('SMS send failed');
      toast.error('문자 발송에 실패했습니다. 수신자와 발신번호를 확인한 뒤 다시 시도해주세요.');
    } finally {
      setSending(false);
    }
  };

  return {
    sendMode,
    recipientType,
    statusFilter,
    gradeFilter,
    content,
    customPhones,
    sending,
    recipientsCount,
    logs,
    logsLoading,
    images,
    searchQuery,
    searchResults,
    searching,
    selectedStudent,
    senderNumbers,
    selectedSenderId,
    contentBytes,
    isMMS,
    isLMS,
    messageType,
    setRecipientType,
    setStatusFilter,
    setGradeFilter,
    setContent,
    setSearchQuery,
    setSelectedStudent,
    setSelectedSenderId,
    handleModeChange,
    handlePhoneChange,
    addPhoneField,
    removePhoneField,
    handleImageSelect,
    removeImage,
    handleSend,
    reloadLogs: loadLogs,
  };
}

export type UseSmsPageState = ReturnType<typeof useSmsPageState>;
