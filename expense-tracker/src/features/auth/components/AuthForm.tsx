'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { useAction } from '@/hooks/useResource';
import { api } from '@/lib/api';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const params = useSearchParams();
  const { run, pending, error, fields } = useAction();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const isRegister = mode === 'register';

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = isRegister ? form : { email: form.email, password: form.password };
    const result = await run(() => api.post(`/api/auth/${mode}`, body));
    if (result) {
      router.replace(params.get('next') ?? '/dashboard');
      router.refresh();
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        {isRegister ? 'Create your account' : 'Welcome back'}
      </h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {isRegister
          ? 'One account holds your expenses, savings and investments.'
          : 'Sign in to pick up where you left off.'}
      </p>

      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        {isRegister ? (
          <Field label="Your name" error={fields.name}>
            <Input
              value={form.name}
              onChange={set('name')}
              placeholder="Your name"
              autoComplete="name"
              required
            />
          </Field>
        ) : null}

        <Field label="Email" error={fields.email}>
          <Input
            type="email"
            value={form.email}
            onChange={set('email')}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </Field>

        <Field
          label="Password"
          error={fields.password}
          hint={isRegister ? 'At least 8 characters.' : undefined}
        >
          <Input
            type="password"
            value={form.password}
            onChange={set('password')}
            placeholder="••••••••"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
          />
        </Field>

        {error ? (
          <p className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad">{error}</p>
        ) : null}

        <Button type="submit" loading={pending} className="w-full">
          {isRegister ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-[13px] text-ink-muted">
        {isRegister ? 'Already have an account? ' : 'New here? '}
        <Link
          href={isRegister ? '/login' : '/register'}
          className="font-medium text-brand hover:underline"
        >
          {isRegister ? 'Sign in' : 'Create one'}
        </Link>
      </p>
    </div>
  );
}
