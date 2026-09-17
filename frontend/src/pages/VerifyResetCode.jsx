import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { api } from '../api/client';
import AuthLayout from '../components/AuthLayout';
import CodeInput from '../components/auth/CodeInput';
import FormAlert from '../components/auth/FormAlert';
import ResendCode from '../components/auth/ResendCode';
import SubmitButton from '../components/auth/SubmitButton';
import { RESET_CAPTION } from '../data/authCaptions';

const CODE_LENGTH = 8;

export default function VerifyResetCode() {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email;

  const [code, setCode] = useState('');
  const [codeSentAt, setCodeSentAt] = useState(() => location.state?.sentAt || Date.now());
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  const [loading, setLoading] = useState(false);

  if (!email) {
    return (
      <AuthLayout title="Enter your reset code" backTo="/login" caption={RESET_CAPTION}>
        <p className="text-sm text-gray-600">
          This reset session has expired.{' '}
          <Link to="/forgot-password" className="text-brand-orange font-semibold hover:underline">Request a new code</Link> to reset your password.
        </p>
      </AuthLayout>
    );
  }

  const fail = (message) => {
    setError(message);
    setErrorKey(k => k + 1);
  };

  const verify = async (value) => {
    if (loading) return;
    if (value.length < CODE_LENGTH) {
      fail(`Enter all ${CODE_LENGTH} characters of the code.`);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/verify-reset-code', { email, code: value });
      navigate('/reset-password', { state: { email, code: value } });
    } catch (err) {
      fail(err.message);
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setCodeSentAt(Date.now());
    } catch (err) {
      fail(err.message);
      throw err;
    }
  };

  return (
    <AuthLayout
      title="Enter your reset code"
      subtitle={<>We sent an {CODE_LENGTH}-character code to <span className="font-semibold text-brand-ink">{email}</span>.</>}
      backTo="/login"
      scene={{ level: (2 + (code.length / CODE_LENGTH) * 2) / 6, flickerKey: errorKey }}
      caption={RESET_CAPTION}
    >
      <form onSubmit={(e) => { e.preventDefault(); verify(code); }} noValidate className="space-y-5">
        <div>
          <p id="reset-code-label" className="text-sm font-medium text-brand-ink mb-2">Reset code</p>
          <CodeInput
            id="reset-code"
            labelledBy="reset-code-label"
            value={code}
            onChange={(next) => { setCode(next); if (error) setError(''); }}
            onComplete={verify}
            invalid={Boolean(error)}
            disabled={loading}
            autoFocus
          />
        </div>
        <ResendCode sentAt={codeSentAt} onResend={handleResend} />
        <FormAlert key={errorKey}>{error}</FormAlert>
        <SubmitButton loading={loading} icon={ShieldCheck} loadingLabel="Checking code…">
          Continue
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
