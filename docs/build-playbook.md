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

### Adım 0 — ŞİMDİ (paralel iki iş)

**🤖 Ben:** `/implement` ile **#2 (backend stack)** başlar. Tasarım beklemez.
→ Sen bana: `/implement` yaz (frontier: #2).

**🧑 Sen (aynı anda):** Claude Design'da **tasarım sistemini** hazırla:
- Renkler (light + dark), spacing (8-pt), tipografi, radius
- Çekirdek component'lar: Task satırı, checkbox, sub-task, tab bar, "+ ekle" butonu, AI girişi
- Brief şablonunu (`docs/product/claude-design-brief.md`) yapıştır
- Export: HTML + screenshot + token isimleri → **bana ver**

Bu ikisi zaman çakışmaz: ben backend'i yazarken sen tasarım sistemini yetiştirirsin.

### Adım 1 — Altyapı (tasarımsız)

Sırayla, her biri için `/implement` + arada `/clear`:
- **#2 → #3** (T01 backend, T02 app skeleton). UI yok, tasarım gerekmez.

⚠️ **#4'e (T03) geçmeden ÖNCE:** Adım 0'daki **token export'unu bana vermiş ol.** T03 theme
pipeline'ı gerçek token değerleriyle kuracak.

### Adım 2 — UI temeli

- **#4 (T03 — theming + i18n + nav shell).** Ben senin token'larından light/dark + Restyle
  pipeline kurarım. Buradan sonra tüm ekranlar temalı/lokalize.
  → Gerekli girdi: 🧑 tasarım sistemi token'ları (Adım 0).

### Adım 3 — Task çekirdeği ve özellikler

Her UI ticket'ında **önce o ekranı Claude Design'da tasarla → bana ver → `/implement`**.
`#5` bitince `#6/#7/#8/#14` paralel açılır (istediğin sırada yapabilirsin).

| Sıra | Ticket | Önce tasarla (🧑) | Blocker |
|---|---|---|---|
| 1 | #5 (T04 walking-skeleton Task) | Task listesi | #4 |
| 2 | #6 (T05 desc + priority) | Task detay | #5 |
| 3 | #7 (T06 Schedule) | Schedule seçici | #5 |
| 4 | #8 (T07 Deadline + Defer) | Deadline/defer seçici | #5 |
| 5 | #9 (T08 Sub-task + sıralama) | Checklist ekranı | #5 |
| 6 | #14 (T13 Preferences/toggle) | Ayarlar ekranı | #5 |
| 7 | #10 (T09 Recurrence) | Recurrence editor + "this/following/all" | #7 |
| 8 | #11 (T10 Reminder + bildirim) | Reminder UI | #7, #8, #10 |
| 9 | #12 (T11 Takvim) | Takvim görünümü | #7, #10 |
| 10 | #13 (T12 Tema import) | Tema import ekranı | #4 |
| 11 | #15 (T14 AI capture) | AI capture girişi | #7, #8, #10, #14 |

(#13 tema import erken de yapılabilir — sadece #4'e bağlı.)

---

## Tasarım devri — her UI ticket'ında tekrar

1. Claude Design'da ekranı tasarla (repo + mevcut token'ları bağla ki tutarlı olsun).
2. `docs/product/claude-design-brief.md` şablonunu session başında yapıştır.
3. Export al: **HTML/CSS + screenshot (light ve dark)** + kısa layout notu.
4. Bana ver: "Şu ekranın tasarımı, şu ticket için" de.
5. Ben: HTML'den DTCG token'ı günceller, Restyle ile ekranı yazar, screenshot'la parite kontrol
   eder, test + commit ederim.

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
