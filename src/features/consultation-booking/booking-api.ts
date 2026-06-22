import { getAvailableSlots, getConsultationPageInfo, submitConsultation } from '@/lib/api/consultations';
import type { ConsultationFormData } from '@/lib/types/consultation';

export const fetchBookingPageInfo = getConsultationPageInfo;
export const fetchBookingSlots = getAvailableSlots;

export function submitBooking(slug: string, data: ConsultationFormData) {
  return submitConsultation(slug, data);
}
