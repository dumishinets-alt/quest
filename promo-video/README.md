# Промо-відео «AI в освіті: прості кроки — новий результат»

Kinetic typography на Remotion (React + TypeScript). Дві композиції:

| Композиція      | Формат      | Файл рендеру                 |
|-----------------|-------------|------------------------------|
| `Promo`         | 1920×1080   | `out/promo-1920x1080.mp4`    |
| `PromoVertical` | 1080×1920   | `out/promo-1080x1920.mp4`    |

## Швидкий старт

```bash
npm install
npm run voice -- "~/Downloads/audio 1.m4a" "~/Downloads/audio 2.m4a"   # ваш голос
npm run studio        # прев'ю: http://localhost:3000
npm run still         # контрольні кадри кожної сцени -> out/stills/
npm run render        # обидва MP4 (H.264 + AAC) + перевірка звуку
```

## Що де редагувати

**Усе редаговане лежить у `src/config.ts`:** тексти, кольори, таймінги сцен,
ключові кадри анімацій, розклад «перебіжки» шрифтів, друку в терміналі,
усі звукові ефекти (кадр + гучність), баланс міксу, вікна приглушення музики.
Таймінги — у кадрах (30 fps) від початку сцени. Музика 120 BPM: біт = 15 кадрів.

## Диктор (озвучення того, що на екрані)

Репліки — у `NARRATION_LINES` у `src/config.ts`:

| id                       | Що звучить                                         | Де            |
|--------------------------|----------------------------------------------------|---------------|
| `n1-schos-pochynayetsya` | Щось починається…                                  | сцена 1       |
| `n2-zapusk`              | Запуск!                                            | сцена 2       |
| `n3-novyi-kurs`          | Новий курс — «AI в освіті»                         | сцена 3       |
| `n4-kurs-dast`           | Курс дасть:                                        | сцена 5       |
| `n4-vpevnenist`          | впевненість,                                       | сцена 5       |
| `n4-viru`                | віру,                                              | сцена 5       |
| `n4-nove-bachennya`      | нове бачення.                                      | сцена 5       |
| `n5-start`               | Старт — 18 грудня. Деталі — в інстаграм.            | сцена 6       |

```bash
pip install edge-tts
npm run narration        # синтез голосом NARRATOR.voice (uk-UA Остап / Поліна)
npm run render
```

- Свій запис будь-якої репліки: `recordings/<id>.m4a` (або mp3/wav/ogg) — він
  замінить синтез. Можна змішувати: частину своїм голосом, частину синтезом.
- Текст у `say` можна писати фонетично («Ей-Ай», «вісімнадцятого»).
- Тези в сцені 5 і фінальний текст з'являються **під слово** диктора; якщо
  репліка довша — сцена подовжується (з округленням до біта).
- Під голосом музика -> 25%, ефекти -> 50%.
- Перегенерувати після зміни тексту: `npm run narration -- --force`.

## Ваші записи audio 1 / audio 2 (необов'язково)

`npm run voice` без аргументів шукає `audio 1.*` і `audio 2.*` у
`~/Downloads` / `~/Завантаження`. Скрипт:

- копіює їх у `public/voice/voice1.mp3`, `voice2.mp3`;
- обрізає тишу на початку й у кінці, вирівнює гучність (−14 LUFS, true peak −2 dB);
- записує тривалості в `src/voice-manifest.ts` — сцени 1 і 6 **подовжуються**
  під голос (з округленням до біта), голос не обрізається;
- перегенеровує синтезовану музику під новий таймлайн.

Під час голосу музика приглушується до 25%, ефекти — до 50%.

## Музика

Зараз `public/music.mp3` — синтезований трек (пульсуючий бас + пад, 120 BPM),
зібраний під сцени: бас і барабани вступають на «ЗАПУСК», у терміналі
барабани легшають, обрив — на фінальному спалаху.

Щоб поставити свій трек: покладіть його як `public/music.mp3` і видаліть
`public/.music-generated` (тоді генератор його не перезапише). Якщо BPM треку
не 120, змініть `BPM` у `config.ts` і, за потреби, ключові кадри.

## Звукові ефекти

`npm run audio` перегенеровує всі SFX у `public/sfx/` (синтез у Python,
numpy + scipy, без завантажень): whoosh, riser, impact/boom, glitch, tick,
typing (6 варіантів висоти + пробіл + Enter), shimmer, sparkle, pop, swell.

## Шрифти

- **Roboto Flex** (основний, осі `wdth` 25–151 і `wght` 100–1000) — підключений
  з `public/fonts/` як повний змінний шрифт: `@remotion/google-fonts` для
  Roboto Flex віддає лише статичну вагу 400 без осей, тож анімувати ширину
  через нього неможливо. Файли — ті самі, що на Google Fonts (кирилиця + латиниця).
- **Unbounded**, **JetBrains Mono** + для «табло» Playfair Display, Russo One,
  Press Start 2P, Lobster — через `@remotion/google-fonts` (з кирилицею).

## Структура

```
src/
  config.ts              усі тексти, кольори, таймінги сцен і звуків
  voice-manifest.ts      генерується скриптом голосу
  Promo.tsx              збирає сцени, переходи, зерно, віньєтку, звук
  scenes/                Scene1Spark … Scene6Finale
  components/            Camera(+Parallax), Spark, WidthStretch, Letters
                         (LetterWave, Twist), FontShuffle, Glitch, Typewriter,
                         DirectionalBlur, Atmosphere (Grain, Vignette, Dust…)
  transitions/           FlashCuts, CurtainWipe (шторка), MorphZoom
  audio/Soundtrack.tsx   голос, музика з приглушенням, SFX за таймлайном
scripts/
  generate_audio.py      синтез SFX і музики
  prepare_voice.sh       обробка голосу
  stills.sh              контрольні кадри
  check_audio.sh         перевірка звуку в MP4 (пік ≤ −1 dBTP)
```
