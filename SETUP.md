# Meri Assistant: setup (sirf phone se, sab free)

Kul 3 hissay hain: **app** (GitHub), **server** (Cloudflare Worker) aur **AI** (Google Gemini ki free key).
Aap ke paas files hain: `index.html`, `sw.js`, `manifest.webmanifest`, `icon.svg` (app) aur `worker.js` (server).

Cloudflare/GitHub/Google ki screens ke naam kabhi kabhi thore badal jate hain. Agar koi button ka naam alag ho to us se milta julta dhoondein.

---

## Qadam 1: App GitHub par rakhein (5 minute)

1. GitHub mein **naya repo** banayein: naam `meri-assistant`, **Public**.
2. **Add file > Upload files** se ye 5 files upload karein: `index.html`, `sw.js`, `manifest.webmanifest`, `icon.svg`, `worker.js`. **Commit changes** dabayein.
   (`worker.js` mein koi raaz nahi hai, is liye public hone mein masla nahi.)
3. Repo ki **Settings > Pages** mein: Source = *Deploy from a branch*, Branch = `main`, folder = `/ (root)`, **Save**.
4. 1 se 2 minute baad aap ki app ka address ye hoga: `https://AAPKA-GITHUB-NAAM.github.io/meri-assistant/`

## Qadam 2: Gemini ki free key (2 minute)

1. Chrome mein `aistudio.google.com` kholein, apne Google account se login karein.
2. **Get API key > Create API key**. Jo lambi key bane usay copy kar ke kisi mehfooz jagah (Notes) mein rakh lein.

## Qadam 3: Cloudflare Worker (server)

1. `dash.cloudflare.com` par free account banayein (email se).
2. **Workers & Pages > Create > Create Worker**. Naam `meri-assistant`, **Deploy** dabayein.
3. **Edit code** dabayein. Jo code likha hai wo poora mita dein.
4. GitHub mein apni repo ki `worker.js` kholein, **Raw** ya "Copy raw file" se poora code copy karein, aur Cloudflare ke editor mein paste kar ke **Deploy** dabayein.

### KV (yaadasht ki jagah)
5. Cloudflare mein **Storage & databases > KV > Create namespace**, naam `ASSISTANT_KV`.
6. Apne Worker mein wapas jayein: **Settings > Bindings > Add > KV namespace**. **Variable name** bilkul `KV` likhein (capital), namespace `ASSISTANT_KV` chunein, **Save/Deploy**.

### Raaz (secrets)
7. Worker ki **Settings > Variables and Secrets > Add**. Do cheezein **Type: Secret** ke saath:
   - `GEMINI_API_KEY` = Qadam 2 wali key
   - `APP_KEY` = apna khud ka lamba password (kam az kam 20 harf/hindse, jaise `ayesha-gul-2026-meri-app-7x91`). Ye aap ki app ka taala hai, kisi ko na batayein.
   Phir **Deploy** dabayein.

### Har 10 minute ka check (alert ke liye zaroori)
8. Worker ki **Settings > Triggers > Cron Triggers > Add**, aur likhein: `*/10 * * * *` . Save.

9. Worker ka address (jaise `https://meri-assistant.AAPKA-NAAM.workers.dev`) Chrome mein kholein. "Meri Assistant chal rahi hai ✓" likha aana chahiye.

## Qadam 4: Phone par app jodein

1. Chrome mein Qadam 1 wala app address kholein.
2. **Worker address** (Qadam 3 wala) aur **App key** (`APP_KEY` wala password) likh kar **Jodein** dabayein.
3. Chrome menu (⋮) > **Add to Home screen / Install app**. Ab app ko Home screen wale icon se kholein.
4. App mein **Settings > Alert on karein** dabayein, ijazat ko **Allow** karein, phir **Test alert bhejein**. Notification aa gaya to sab theek hai.

## Qadam 5: Battery settings (Oppo / Vivo / Realme / Xiaomi / Infinix wale zaroor karein)

Phone ki **Settings > Apps > Chrome** (ya installed "Meri Assistant") mein:
- Notifications: **On**
- Battery: **Unrestricted / No restrictions**
- "Auto-start / Background activity" ho to **On**

Warna phone background mein alert rok deta hai.

---

## Istemaal

- "Baat" mein likhein: *"Jumme ko 3 baje Urdu ki assignment jama karani hai"*. Wo kaam save karti hai.
- Alert aise aate hain: ek din pehle shaam 6 baje, 1 ghanta pehle, aur theek waqt par. Har subah (Settings mein waqt chun sakti hain, default 8 baje) aaj ke kaam ka khulasa.
- "Kaam" tab mein sab tareekhein, "Yaad" tab mein aap ki yaad ki hui baatein hain. Dono mein khud bhi shaamil/delete kar sakti hain.
- Assignment ya likhne ke kaam ka jawab **Copy** ya **Download** (Word file) kar sakti hain.

## Zaroori baatein

- Free Gemini mein Google aap ki baat-cheet apne products behtar banane ke liye istemal kar sakta hai (unki shartein dekh lein). Is liye password, CNIC, bank ya bohat zaati cheezein na likhein.
- Ye aap ke WhatsApp, calls ya SMS nahi dekh sakti. Aap message copy kar ke yahan paste karein to jawab ka draft bana degi.
- Free limit khatam ho jaye to AI kabhi kabhi jawab nahi dega ("Maazrat…" likha aayega), kuch der baad dobara try karein.
- Alert ke liye phone par internet chahiye. Bina internet ke notification nahi aayega.
- Kaam aur yaadasht aap ke apne Cloudflare account mein hain. Baat-cheet sirf aap ke phone ke browser mein. Kisi aur phone par app kholein to wahan purani chat nahi hogi, magar kaam/yaad wahi aayenge.

## Agar masla aaye

| Masla | Hal |
|---|---|
| "Galat ya missing app key" | `APP_KEY` aur app mein likhi key bilkul ek jaisi hon, phir Deploy |
| "KV namespace bind nahi hua" | Qadam 3 ka 6 number: variable name sirf `KV` ho |
| "GEMINI_API_KEY set nahi hai" | Qadam 3 ka 7 number dobara karein |
| AI error / 404 / 429 | Thori der baad try karein. Ya Worker mein variable `GEMINI_MODEL` daal kar AI Studio mein dikhne wale koi aur free model ka naam likhein |
| Test alert nahi aaya | Chrome mein Notifications allow hon, Qadam 5 ki battery settings karein, app install karein, Alert dobara on karein |
| Cloudflare "Error 1102" | Free plan ki CPU hadd; dobara try karein, aur batayein |
