import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { authErrorKey, signIn } from './auth-api';

const credentialsSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });
type Credentials = z.infer<typeof credentialsSchema>;
export function LoginForm() {
  const { t } = useTranslation();
  const [errorKey, setErrorKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, resetField, formState: { isSubmitting } } = useForm<Credentials>();
  const submit = handleSubmit(async (values) => {
    setErrorKey('');
    const parsed = credentialsSchema.safeParse(values);
    if (!parsed.success) { setErrorKey('auth.invalidForm'); return; }
    try { await signIn(parsed.data.email, parsed.data.password); resetField('password'); }
    catch (error) { setErrorKey(authErrorKey(error)); }
  });
  return <section className="auth-card" aria-labelledby="login-title">
    <p className="eyebrow">{t('auth.hostAccess')}</p>
    <h1 id="login-title">{t('auth.loginTitle')}</h1>
    <p className="auth-description">{t('auth.loginBody')}</p>
    <form onSubmit={submit} aria-busy={isSubmitting}>
      <label htmlFor="email">{t('auth.email')}</label>
      <input id="email" type="email" autoComplete="username" required {...register('email')} disabled={isSubmitting} />
      <label htmlFor="password">{t('auth.password')}</label>
      <div className="password-field">
        <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required {...register('password')} disabled={isSubmitting} />
        <button type="button" className="text-button" onClick={() => setShowPassword(v => !v)} aria-pressed={showPassword}>{t(showPassword ? 'auth.hide' : 'auth.show')}</button>
      </div>
      {errorKey && <p className="auth-error" role="alert">{t(errorKey)}</p>}
      <button className="primary-link auth-submit" type="submit" disabled={isSubmitting}>{t(isSubmitting ? 'auth.signingIn' : 'auth.signIn')}</button>
    </form>
    <p className="auth-footnote">{t('auth.existingOnly')}</p>
  </section>;
}
