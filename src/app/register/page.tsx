'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthNotice, AuthPageShell, authInputClass, authLabelClass } from '@/features/auth/auth-page-shell';
import { authAPI } from '@/lib/api/auth';

const REGISTER_ERROR_MESSAGE = '회원가입을 완료하지 못했습니다. 입력 내용을 확인한 뒤 다시 시도해주세요.';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    academyName: '',
    confirmPassword: '',
    email: '',
    name: '',
    password: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('비밀번호는 최소 8자 이상이어야 합니다.');
      setLoading(false);
      return;
    }

    if (!formData.academyName.trim()) {
      setError('학원명을 입력해주세요.');
      setLoading(false);
      return;
    }

    try {
      await authAPI.register({
        academyName: formData.academyName,
        email: formData.email,
        name: formData.name,
        password: formData.password,
        phone: formData.phone,
      }, { suppressErrorToast: true });

      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: unknown) {
      console.warn('회원가입에 실패했습니다.', err);
      setError(REGISTER_ERROR_MESSAGE);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthPageShell
        icon={<CheckCircle className="h-6 w-6" />}
        title="회원가입 요청 완료"
        tone="success"
        description="관리자 승인 후 로그인할 수 있어요. 승인 상태는 등록한 이메일로 안내해 드려요."
      >
        <p className="text-sm text-secondary-foreground">잠시 후 로그인 페이지로 이동해요.</p>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      icon={<Building2 className="h-6 w-6" />}
      title="P-ACA 회원가입"
      description="학원 운영 계정을 요청해요. 승인 후 운영 화면에 접속할 수 있어요."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthInput
          id="academyName"
          label="학원명"
          name="academyName"
          value={formData.academyName}
          onChange={handleChange}
          placeholder="OO체대입시학원"
          required
        />
        <AuthInput id="name" label="이름" name="name" value={formData.name} onChange={handleChange} placeholder="홍길동" required />
        <AuthInput
          id="email"
          label="이메일"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="academy@example.com"
          autoComplete="email"
          required
        />
        <AuthInput
          id="phone"
          label="전화번호"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          placeholder="010-1234-5678"
          autoComplete="tel"
        />
        <AuthInput
          id="password"
          label="비밀번호"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="최소 8자 이상"
          autoComplete="new-password"
          required
        />
        <AuthInput
          id="confirmPassword"
          label="비밀번호 확인"
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={handleChange}
          placeholder="비밀번호 재입력"
          autoComplete="new-password"
          required
        />

        {error ? (
          <AuthNotice role="alert">{error}</AuthNotice>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? '가입 중...' : '회원가입'}
        </Button>
      </form>

      <div className="mt-6 space-y-4">
        <p className="text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            로그인
          </Link>
        </p>
        <AuthNotice tone="primary">
          회원가입 후 관리자 승인이 필요해요. 학원명은 승인 기준으로 쓰이니 정확히 입력해주세요.
        </AuthNotice>
      </div>
    </AuthPageShell>
  );
}

interface AuthInputProps {
  autoComplete?: string;
  id: string;
  label: string;
  name: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder: string;
  required?: boolean;
  type?: string;
  value: string;
}

function AuthInput({ autoComplete, id, label, name, onChange, placeholder, required, type = 'text', value }: AuthInputProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className={authLabelClass}>
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      <Input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        className={authInputClass}
      />
    </div>
  );
}
