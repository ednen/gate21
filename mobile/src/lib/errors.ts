/** Turkish messages for the API's stable error codes. */
const MESSAGES: Record<string, string> = {
  EMAIL_TAKEN: 'Bu e-postayla zaten bir hesap var. Giriş yapmayı dene.',
  INVALID_CREDENTIALS: 'E-posta ya da şifre hatalı.',
  TOO_MANY_ATTEMPTS: 'Çok fazla deneme yaptın. Bir dakika sonra tekrar dene.',
  VALIDATION_FAILED: 'Bilgileri kontrol et.',
  INVALID_REFRESH_TOKEN: 'Oturumun sona erdi. Lütfen tekrar giriş yap.',
  REFRESH_TOKEN_REUSED: 'Güvenlik için oturumun kapatıldı. Lütfen tekrar giriş yap.',
  VOICE_CONSENT_REQUIRED: 'Sesini değerlendirebilmemiz için önce izin vermelisin.',
  SPEECH_QUOTA_EXCEEDED: 'Bugünkü konuşma hakkın doldu. Dinle ve tekrar et moduyla devam edebilirsin.',
  ROLEPLAY_QUOTA_EXCEEDED: 'Bugünkü sahne hakkın doldu. Yarın yeni sahneler seni bekliyor.',
  SPEECH_NOT_RECOGNIZED: 'Seni net duyamadık. Mikrofona biraz yaklaşıp tekrar dene.',
  SPEECH_UNAVAILABLE: 'Konuşma servisi şu an meşgul. Biraz sonra tekrar dene.',
  UNSUPPORTED_AUDIO: 'Ses kaydı okunamadı. Tekrar kaydetmeyi dene.',
  AUDIO_TOO_LARGE: 'Kayıt çok uzun. En fazla 15 saniye konuş.',
  SESSION_FINISHED: 'Bu sahne bitti.',
  TURN_CONFLICT: 'Bu cevap zaten gönderildi.',
  MEMBERSHIP_REQUIRED: 'Bu bölüm tam yolculuğun parçası. Devam etmek için bir plan seç.',
  STORE_NOT_CONNECTED: 'Mağaza ödemesi çok yakında açılacak.',
  NETWORK: 'İnternet bağlantısı yok gibi görünüyor.',
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }

  get messageTr(): string {
    return MESSAGES[this.code] ?? 'Bir şeyler ters gitti. Tekrar dene.';
  }
}

export function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    return error.messageTr;
  }
  return 'Bir şeyler ters gitti. Tekrar dene.';
}
