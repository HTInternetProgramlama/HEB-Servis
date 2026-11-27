/** Only these application-owned diagnostics may leave the provider boundary.
 * Never return, serialize or persist provider messages, stacks, URLs or recipients.
 */
const diagnostics = {
  email_address_not_authorized: {
    status: 502,
    message: 'Hesap hazır; varsayılan e-posta sağlayıcısı bu alıcıya gönderime izin vermiyor. Yönetici Supabase Auth için özel SMTP yapılandırmasını kontrol etmeli.',
  },
  over_email_send_rate_limit: {
    status: 429,
    message: 'Hesap hazır; e-posta sağlayıcısının gönderim sınırına ulaşıldı. Bir süre bekleyin; yönetici Supabase e-posta limitlerini kontrol edebilir.',
  },
  over_request_rate_limit: {
    status: 429,
    message: 'Hesap hazır; e-posta sağlayıcısının istek sınırına ulaşıldı. Yeni bir gönderim denemeden önce bir süre bekleyin.',
  },
  email_address_invalid: {
    status: 422,
    message: 'Hesap hazır; e-posta sağlayıcısı alıcı adresini geçersiz buldu. Müşteri kartındaki gerçek e-posta adresini kontrol edin; hesap adresi farklıysa yönetici Ayarlar bölümünden eşitlemeli.',
  },
  smtp_send_failed: {
    status: 502,
    message: 'Hesap hazır; Auth e-posta gönderimi tamamlanamadı. Yönetici SMTP bağlantısını, gönderici doğrulamasını ve sağlayıcı durumunu kontrol etmeli. E-posta teslimi doğrulanmadı.',
  },
  email_delivery_unknown: {
    status: 502,
    message: 'Hesap hazır; e-posta gönderimi doğrulanamadı. Sağlayıcıdan güvenli bir hata nedeni alınamadı. Yönetici e-posta ayarlarını kontrol etmeli.',
  },
  test_address_not_deliverable: {
    status: 422,
    message: 'Hesap hazır; .test uzantısı kurgusal adresler içindir. Gerçek e-posta gönderimi yapılmadı. Yönetici Ayarlar bölümünden hesabın parolasını elle belirleyebilir veya gerçek e-posta adresini eşitleyebilir.',
  },
} as const;

export type CustomerEmailErrorCode = keyof typeof diagnostics;

export function customerEmailDiagnostic(code: CustomerEmailErrorCode): { code: string; message: string; status: number } {
  return { code, ...diagnostics[code] };
}

export function isTestCustomerEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@').at(-1)?.replace(/\.$/, '') ?? '';
  return domain.endsWith('.test');
}

/** Local Mailpit/Supabase testing is permitted; arbitrary remote hosts are not. */
export function isLocalCustomerEmailProvider(value: string | undefined): boolean {
  try {
    const url = new URL(value ?? '');
    return ['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}

/** Synchronous and deliberately independent of Supabase SDK error prototypes. */
export function classifyCustomerEmailError(error: unknown): { code: string; message: string; status: number } {
  let code: unknown;
  let status: unknown;
  try {
    if (error !== null && typeof error === 'object') {
      code = (error as { code?: unknown }).code;
      status = (error as { status?: unknown }).status;
    }
  } catch {
    // An unknown object may expose throwing getters. It is still an unknown error.
    return customerEmailDiagnostic('email_delivery_unknown');
  }
  // Code takes precedence over coarse HTTP status. No provider message matching.
  if (code === 'email_address_not_authorized') return customerEmailDiagnostic(code);
  if (code === 'over_email_send_rate_limit') return customerEmailDiagnostic(code);
  if (code === 'over_request_rate_limit') return customerEmailDiagnostic(code);
  if (code === 'email_address_invalid') return customerEmailDiagnostic(code);
  if (status === 429) return customerEmailDiagnostic('over_request_rate_limit');
  // This classifier is used exclusively at the resetPasswordForEmail boundary.
  // A 5xx / unexpected_failure identifies a failed send, not proof of its cause.
  if (code === 'unexpected_failure' || (typeof status === 'number' && status >= 500 && status <= 599)) return customerEmailDiagnostic('smtp_send_failed');
  return customerEmailDiagnostic('email_delivery_unknown');
}
