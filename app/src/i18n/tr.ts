import type { Translations } from "./en";

/** Turkish UI strings. Same key set as `en.ts` (enforced by test + the type). */
export const tr: Translations = {
  common: {
    appName: "foss-tasks",
    signOut: "Çıkış yap",
    bootError: "Başlatılamadı",
  },
  auth: {
    emailLabel: "E-posta",
    emailPlaceholder: "siz@ornek.com",
    passwordLabel: "Parola",
    passwordPlaceholder: "••••••••",
    signIn: "Giriş yap",
    register: "Hesap oluştur",
    switchToRegister: "Yeni misiniz? Hesap oluşturun",
    switchToSignIn: "Hesabınız var mı? Giriş yapın",
  },
  tasks: {
    title: "Bugün",
    empty: "Her şey tamam",
    emptyHint: "Görevler Sunucunuzdan akıyor.",
    readOnlyNote: "Yazma yolu gelene kadar salt okunur.",
    statusLive: "Canlı",
    statusOffline: "Çevrimdışı",
    statusStopped: "Eşitleme durdu",
    syncError: "Eşitleme hatası: {{message}}",
  },
  settings: {
    title: "Ayarlar",
    theme: "Tema",
    themeSystem: "Sistem",
    themeLight: "Açık",
    themeDark: "Koyu",
    language: "Dil",
    languageSystem: "Sistem",
    languageEnglish: "English",
    languageTurkish: "Türkçe",
  },
  tabs: {
    today: "Bugün",
    settings: "Ayarlar",
  },
};
