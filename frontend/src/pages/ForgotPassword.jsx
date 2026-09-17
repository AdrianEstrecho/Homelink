import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { api } from '../api/client';
import AuthLayout from '../components/AuthLayout';
import { AuthField } from '../components/auth/AuthField';
import FormAlert from '../components/auth/FormAlert';
import SubmitButton from '../components/auth/SubmitButton';
import { isEmailValid } from '../utils/validation';
import { RESET_CAPTION } from '../data/authCaptions';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  const [loading, setLoading] = useState(false);

  const emailValid = isEmailValid(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!emailValid) {
      setFieldError(email.trim() ? 'Enter a valid email, like name@example.com.' : 'Enter your email.');
      setErrorKey(k => k + 1);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      navigate('/verify-reset-code', { state: { email, sentAt: Date.now() } });
    } catch (err) {
      setError(err.message);
      setErrorKey(k => k + 1);
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter the email on your HomeLink account and we'll send you a reset code."
      backTo="/login"
      scene={{ level: (emailValid ? 2 : email.includes('@') ? 1 : 0) / 6, flickerKey: errorKey }}
      caption={RESET_CAPTION}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <AuthField
          id="forgot-email"
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoFocus
          value={email}
          onChange={(e) => { setEmail(e.target.value); setFieldError(''); }}
          valid={emailValid}
          error={fieldError}
        />
        <FormAlert key={errorKey}>{error}</FormAlert>
        <SubmitButton loading={loading} icon={ArrowRight} loadingLabel="Sending code…">
          Send reset code
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
