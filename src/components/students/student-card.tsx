/**
 * Student Card Component
 * 학생 기본 정보 카드
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Phone, Mail, MapPin, Calendar, Banknote, GraduationCap, UserMinus, RotateCcw } from 'lucide-react';
import type { StudentDetail } from '@/lib/types/student';
import {
  formatStudentNumber,
  formatPhoneNumber,
  getStudentDisplayInfo,
  formatClassDays,
  formatCurrency,
  formatDate,
  getStatusColor,
  calculateDiscountedTuition,
} from '@/lib/utils/student-helpers';
import {
  ADMISSION_TYPE_LABELS,
  STATUS_LABELS,
  STUDENT_TYPE_LABELS,
  GENDER_LABELS,
} from '@/lib/types/student';

interface StudentCardProps {
  student: StudentDetail;
  onEdit: () => void;
  onDelete: () => void;
  onGraduate?: () => void;
  onWithdraw?: () => void;
  onResume?: () => void;
}

export function StudentCard({ student, onEdit, onDelete, onGraduate, onWithdraw, onResume }: StudentCardProps) {
  const discountedTuition = calculateDiscountedTuition(student.monthly_tuition, student.discount_rate);
  const canGraduate = (student.grade === '고3' || student.grade === 'N수') && student.status === 'active';
  const canWithdraw = student.status === 'active' || student.status === 'paused';
  const canResume = student.status === 'paused';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>학생 정보</CardTitle>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="w-4 h-4 mr-1" />
              수정
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-red-600 border-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              삭제
            </Button>
            {canGraduate && onGraduate && (
              <Button
                variant="outline"
                size="sm"
                onClick={onGraduate}
                className="text-purple-600 border-purple-600 hover:bg-purple-50"
              >
                <GraduationCap className="w-4 h-4 mr-1" />
                졸업 처리
              </Button>
            )}
            {canWithdraw && onWithdraw && (
              <Button
                variant="outline"
                size="sm"
                onClick={onWithdraw}
                className="text-orange-600 border-orange-600 hover:bg-orange-50"
              >
                <UserMinus className="w-4 h-4 mr-1" />
                퇴원 처리
              </Button>
            )}
            {canResume && onResume && (
              <Button
                variant="outline"
                size="sm"
                onClick={onResume}
                className="text-emerald-600 border-emerald-600 hover:bg-emerald-50"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                복귀 처리
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* 프로필 */}
          <div className="flex items-start space-x-4">
            <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-3xl">{student.name.charAt(0)}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-2">
                <h2 className="text-2xl font-bold text-foreground">{student.name}</h2>
                <span
                  className={`inline-flex px-3 py-1 text-sm font-medium rounded-full border ${getStatusColor(
                    student.status
                  )}`}
                >
                  {STATUS_LABELS[student.status]}
                </span>
              </div>
              <div className="text-muted-foreground space-y-1">
                <p className="text-lg">학번: {formatStudentNumber(student.student_number)}</p>
                <p>
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full mr-2 ${
                    student.student_type === 'exam' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                  }`}>
                    {STUDENT_TYPE_LABELS[student.student_type]}
                  </span>
                  {student.gender && (
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full mr-2 ${
                      student.gender === 'male' ? 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200' : 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'
                    }`}>
                      {GENDER_LABELS[student.gender]}
                    </span>
                  )}
                  {getStudentDisplayInfo(student)} • {ADMISSION_TYPE_LABELS[student.admission_type]}
                </p>
                {student.school && <p>학교: {student.school}</p>}
              </div>
            </div>
          </div>

          {/* 연락처 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <div className="text-sm text-muted-foreground mb-1">학생 연락처</div>
              <div className="flex items-center text-foreground">
                <Phone className="w-4 h-4 mr-2 text-muted-foreground" />
                {formatPhoneNumber(student.phone)}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">학부모 연락처</div>
              <div className="flex items-center text-foreground">
                <Phone className="w-4 h-4 mr-2 text-muted-foreground" />
                {formatPhoneNumber(student.parent_phone)}
              </div>
            </div>
          </div>

          {/* 수업 정보 */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">수업 정보</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start">
                <Calendar className="w-5 h-5 mr-3 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">수업 요일</div>
                  <div className="text-foreground font-medium">
                    {formatClassDays(student.class_days)} (주 {student.weekly_count}회)
                  </div>
                  {student.class_days_next && student.class_days_effective_from && (
                    <div className="text-xs text-orange-600 mt-1">
                      변경 예정: {formatClassDays(student.class_days_next)} ({student.class_days_effective_from.slice(0, 7)}~)
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-start">
                <Banknote className="w-5 h-5 mr-3 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">월 학원비</div>
                  <div className="text-foreground font-medium">
                    {formatCurrency(student.monthly_tuition)}
                    {parseFloat(student.discount_rate) > 0 && (
                      <>
                        <span className="text-red-500 text-sm ml-2">({student.discount_rate}% 할인)</span>
                        <div className="text-sm text-primary-600 font-semibold">
                          실납부: {formatCurrency(discountedTuition)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 기타 정보 */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">기타 정보</h3>
            <div className="space-y-3">
              {student.address && (
                <div className="flex items-start">
                  <MapPin className="w-5 h-5 mr-3 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm text-muted-foreground">주소</div>
                    <div className="text-foreground">{student.address}</div>
                  </div>
                </div>
              )}
              <div className="flex items-start">
                <Calendar className="w-5 h-5 mr-3 text-muted-foreground mt-0.5" />
                <div>
                  <div className="text-sm text-muted-foreground">등록일</div>
                  <div className="text-foreground">{formatDate(student.enrollment_date)}</div>
                </div>
              </div>
              {student.notes && (
                <div className="flex items-start">
                  <Mail className="w-5 h-5 mr-3 text-muted-foreground mt-0.5" />
                  <div>
                    <div className="text-sm text-muted-foreground">메모</div>
                    <div className="text-foreground whitespace-pre-wrap">{student.notes}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
