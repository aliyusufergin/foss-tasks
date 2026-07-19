# Build Playbook — sen ne yapacaksın, ne zaman, hangi sırayla

Bu dosya **senin** rehberin. Kod yazmıyorsun; sen tasarımı hazırlıyor, ticket'ları başlatıyor ve
tasarımı Claude Code'a (bana) devrediyorsun. Aşağıdaki sıra bu kadar.

## Roller

- 🧑 **Sen** — Claude Design'da tasarlarsın, export'u bana verirsin, `/implement` çalıştırırsın,
  self-host'u test edersin.
- 🤖 **Claude Code (ben)** — ticket'ları implement ederim (test-first), tasarım export'undan RN kodu
  ve DTCG token'ları çıkarırım, review + commit yaparım.

## Altın kurallar

1. **Her `/implement` arası context temizle** (`/clear`). Her ticket taze başlamalı.
2. **Frontier'dan git** — sadece blocker'ı kalmamış ticket'a başla (aşağıda "sıradaki ticket nasıl
   bulunur").
3. **UI ticket'ına başlamadan önce o ekranın tasarımı hazır olmalı.** Backend/altyapı ticket'ları
   tasarım beklemez.
4. Tasarım devri her seferinde aynı: `docs/product/claude-design-brief.md` şablonunu yapıştır →
   export HTML + screenshot (light+dark) → bana ver.

---

## Sıra

### Adım 0 — ŞİMDİ

**🤖 Ben:** `/implement` ile **#2 (backend stack)** başlar. Tasarım beklemez.
→ Sen bana: `/implement` yaz (frontier: #2).

> ✅ **Tasarım sistemi zaten hazır ve commit'li** (`design/exports/`, 14 ekran, light+dark, DTCG
> token JSON). Adım 0'da eskiden paralel yaptığın Claude Design işi **bitti** — artık sadece implement
> tarafı kaldı.

### Adım 1 — Altyapı (tasarımsız)

Sırayla, her biri için `/implement` + arada `/clear`:
- **#2 → #3** (T01 backend, T02 app skeleton). UI yok, tasarım gerekmez.

> ✅ **v1 tasarımı bitti ve commit'li** — `design/exports/` (tema "Ink & Signal", `themeVersion` 1,
> font IBM Plex Sans). Artık her UI ticket'ında Claude Design'a gitmene gerek yok; ilgili klasörü
> göstermen yeter. Token kaynağı: `design/exports/pass-01-system/html/tokens.ink-signal.dtcg.json`.
> Klasör haritası: `design/exports/README_cdesign.md`.

⚠️ **#4'e (T03) geçmeden ÖNCE:** token export'u zaten commit'li
(`design/exports/pass-01-system/html/tokens.ink-signal.dtcg.json`). T03 theme pipeline'ı bu gerçek
değerlerle kuracak — ekstra bir şey yapmana gerek yok.

### Adım 2 — UI temeli

- **#4 (T03 — theming + i18n + nav shell).** Ben `design/exports/pass-01-system/`'daki token'lardan
  light/dark + Restyle pipeline kurarım. Buradan sonra tüm ekranlar temalı/lokalize.
  → Girdi: `pass-01-system/html/tokens.ink-signal.dtcg.json` (commit'li).

### Adım 3 — Task çekirdeği ve özellikler

Her UI ticket'ında **ilgili `design/exports/` klasörünü göster → `/implement`**. Tasarım hazır,
yeniden çizmene gerek yok. `#5` bitince `#6/#7/#8/#14` paralel açılır (istediğin sırada).

| Sıra | Ticket | Ekran | Design export klasörü | Blocker |
|---|---|---|---|---|
| 1 | #5 (T04 walking-skeleton Task) | Task listesi | `pass-02-today/` + `pass-02-all/` (satır: `pass-01-system/`) | #4 |
| 2 | #6 (T05 desc + priority) | Task detay | `pass-03-task-form/` | #5 |
| 3 | #7 (T06 Schedule) | Schedule seçici | `pass-03-pickers/` (`schedule-picker-*`) | #5 |
| 4 | #8 (T07 Deadline + Defer) | Deadline/defer seçici | `pass-03-pickers/` (`deadline-defer-*`) | #5 |
| 5 | #9 (T08 Sub-task + sıralama) | Checklist ekranı | `pass-03-pickers/` (`checklist-*`) | #5 |
| 6 | #14 (T13 Preferences/toggle) | Ayarlar ekranı | `pass-04-settings/` | #5 |
| 7 | #10 (T09 Recurrence) | Recurrence editor + "this/following/all" | `pass-03-pickers/` (`recurrence-*`, `edit-scope-*`) | #7 |
| 8 | #11 (T10 Reminder + bildirim) | Reminder UI | `pass-03-pickers/` (`reminders-*`) | #7, #8, #10 |
| 9 | #12 (T11 Takvim) | Takvim görünümü | `pass-02-calendar/` | #7, #10 |
| 10 | #13 (T12 Tema import) | Tema import ekranı | `pass-04-settings/` (`theme-*`) | #4 |
| 11 | #15 (T14 AI capture) | AI capture girişi | `pass-03-quick-add/` | #7, #8, #10, #14 |

(#13 tema import erken de yapılabilir — sadece #4'e bağlı. Auth ekranları `pass-04-auth/`'ta —
backend auth ticket'larıyla eşleşir.)

---

## Tasarım devri — her UI ticket'ında (v1: tasarım hazır)

v1 için Claude Design turu **bitti**. Her UI ticket'ında yeni tasarım çizmek yerine:

1. `/implement #N` de (temiz session).
2. İlgili `design/exports/` klasörünü söyle (yukarıdaki tablo). Ben zaten CONTEXT.md'den yeri
   biliyorum ama teyit iyi olur.
3. Ben: o klasördeki HTML'den DTCG token'ı çıkarır/doğrular, Restyle ile ekranı yazar,
   screenshot'la (light+dark) parite kontrol eder, test + commit ederim.

> Yeni bir v2 ekranı gerekince eski akış geçerli: Claude Design'da çiz, `claude-design-brief.md`
> şablonunu yapıştır, export'u `design/exports/`'a koy, bana söyle.

---

## Sıradaki ticket nasıl bulunur (frontier)

Blocker'ı kalmamış açık ticket'lar başlanabilir. Görmek için:

```bash
gh issue list --state open --label ready-for-agent \
  --json number,title --jq '.[] | "\(.number)\t\(.title)"'
```

Bir ticket'ın blocker'ı kapandı mı diye bakmak için ticket'ı aç (`gh issue view <n>`), "Blocked by"
kısmındaki issue'lar kapalıysa hazırdır. Ben `/implement`'ta bunu zaten kontrol ederim.

---

## Sonra (v1 bitince)

- **Self-host testi:** `docker-compose up` ile sunucuyu kur (adımlar `docs/product/self-hosting.md`,
  #2 ile yazılacak), iki cihazda giriş yap, offline değişiklik + sync'i dene.
- **v2 özellikleri** (grup UI, attachment, dependency, stats, API/MCP, voice, archive) — ayrı grill
  turu, spec'te "Out of Scope".

---

## Tek cümlelik özet

**Şimdi:** bana `/implement` (#2) de + Claude Design'da tasarım sistemini hazırla. Sonra sırayla
frontier ticket'ları — UI olanların ekranını önce tasarla, bana ver, `/implement`, `/clear`, tekrar.
