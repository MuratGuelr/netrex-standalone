export const applyVoiceCustomization = (utterance, userId = "", ttsVoiceURI = "auto") => {
  // Deterministic id string
  const strId = String(userId || "default");
  
  // Basit bir hash algoritmasi (her id icin ayni numarayi uretir)
  let hash = 0;
  for (let i = 0; i < strId.length; i++) {
    hash = strId.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // 1. Ses secimi (Bilgisayarin destekledigi Turkce sesler arasindan deterministik secim)
  const voices = window.speechSynthesis.getVoices();
  const trVoices = voices.filter(v => v.lang.includes('tr') || v.lang.includes('TR'));
  
  if (trVoices.length > 0) {
    if (ttsVoiceURI !== "auto") {
      const selectedVoice = trVoices.find(v => v.voiceURI === ttsVoiceURI);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      } else {
        // Cihaz degistiginde veya o ses silindiginde fallback olarak calisir
        const voiceIndex = Math.abs(hash) % trVoices.length;
        utterance.voice = trVoices[voiceIndex];
      }
    } else {
      const voiceIndex = Math.abs(hash) % trVoices.length;
      utterance.voice = trVoices[voiceIndex];
    }
  }
  
  // 2. DAHA DOĞAL PITCH: Uçuk değerlere gitmesini engelledik.
  // 0.95 ile 1.10 arasında çok hafif ton farkıyla kişisel ama distorsiyonsuz ses.
  const pitchVariation = 0.95 + ((Math.abs(hash * 31) % 15) / 100); 
  utterance.pitch = pitchVariation;
  
  // 3. DAHA TUTARLI RATE: Robotik hecelemeyi engellemek için standarda (1.0) çok yakın.
  const rateVariation = 1.0 + ((Math.abs(hash * 17) % 5) / 100);
  utterance.rate = rateVariation;
};

export const sanitizeForTTS = (text) => {
  if (!text) return { text: "", isSpam: false };

  let cleanText = text;

  // 1. Yazılı Emoji ve Argo (Slang) / Kısaltma Çevirileri
  // ÖNEMLİ: Çoğul ve ekli formlar da dahil edilmeli (knklar, slmlar vb.)
  const replacements = {
    // Emojiler
    ":d": " kahkaha atıyor ",
    ":)": " gülümsüyor ",
    ":(": " somurtuyor ",
    "=(": " somurtuyor ",
    ":/": " düşünüyor ",
    ":p": " dil çıkarıyor ",
    "<3": " kalp ",
    "xd": " bayağı gülüyor ",
    // Oyun terimleri
    "lol": " sesli gülüyor ",
    "lmao": " kahkahayla gülüyor ",
    "gg": " iyi oyundu ",
    "wp": " iyi oynadı ",
    "afk": " klavye başında değil ",
    "ez": " kolaydı ",
    "dc": " bağlantı koptu ",
    "nt": " güzel deneme ",
    "brb": " hemen döneceğim ",
    // Selamlaşma
    "knk": " kanka ",
    "knklar": " kankalar ",
    "knklr": " kankalar ",
    "nbr": " naber ",
    "naber": " naber ",
    "nbrs": " nabersin ",
    "nbrsnz": " nabersiniz ",
    "slm": " selam ",
    "slmlar": " selamlar ",
    "slmlr": " selamlar ",
    "mrb": " merhaba ",
    "mrblar": " merhabalar ",
    "mrblr": " merhabalar ",
    "hg": " hoş geldin ",
    "hb": " hoş bulduk ",
    "s.a": " selamün aleyküm ",
    "sa": " selamün aleyküm ",
    "as": " aleyküm selam ",
    // Teşekkür / Özür
    "tşk": " teşekkürler ",
    "tşklr": " teşekkürler ",
    "tskr": " teşekkürler ",
    "tskrlr": " teşekkürler ",
    "eyv": " eyvallah ",
    "eyw": " eyvallah ",
    "eyvlh": " eyvallah ",
    "k.b": " kusura bakma ",
    "kb": " kusura bakma ",
    "özr": " özür ",
    "prdn": " pardon ",
    // Kısaltmalar
    "nys": " neyse ",
    "bşv": " boşver ",
    "tmm": " tamam ",
    "tm": " tamam ",
    "ok": " tamam ",
    "glb": " galiba ",
    "bnc": " bence ",
    "snc": " sence ",
    "hrhld": " heralde ",
    "hrl": " heralde ",
    "bi": " bir ",
    "dk": " dakika ",
    "sn": " saniye ",
    "ab": " abi ",
    "abl": " abla ",
    "grp": " grup ",
    "srn": " sorun ",
    "ztn": " zaten ",
    "şmdi": " şimdi ",
    "şmd": " şimdi ",
    "nrdsin": " nerdesin ",
    "nrdsn": " nerdesin ",
    "nrdn": " nereden ",
    "dğr": " doğru ",
    "bgy": " bunu gördün yandın ",
    "fln": " falan ",
    "dmk": " demek ",
    "yaa": " ya ",
    "sjsj": " gülüyor ",
    "hmm": " düşünüyor ",
    "idk": " bilmiyorum ",
    "btw": " bu arada ",
    "omg": " aman tanrım ",
    "thx": " teşekkürler ",
    "pls": " lütfen ",
    "plz": " lütfen ",
    "abv": " abov ",
    "agam": " ağam ",
    "reis": " reis ",
    "kral": " kral ",
    "hocm": " hocam ",
    "hocam": " hocam ",
    "bro": " kardeşim ",
    "lan": " lan ",
    "amk": " ",
    "mk": " ",
    "yav": " yav ",
  };

  // Uzun key'ler önce gelsin ki "knklar" -> "knk" + "lar" yerine doğrudan yakalansın
  const sortedKeys = Object.keys(replacements).sort((a, b) => b.length - a.length);
  sortedKeys.forEach(key => {
    const escapedKey = key.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    // Kelimenin başında veya sonunda ise VEYA nokta, virgül gibi işaretlere yapışmışsa algıla (gi => case insensitive)
    const regex = new RegExp(`(^|[\\s\\(])(${escapedKey})(?=[\\s.,!?\\)]|$)`, 'gi');
    cleanText = cleanText.replace(regex, `$1${replacements[key]}`);
  });

  // 2. Random Gülüş (Klavye Spam'ı veya asdf, haha vb.) yakalama
  const words = cleanText.split(' ');
  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase().trim();
    if (!word) continue;
    
    // 'haha', 'hehe', 'hihi', 'xddd' türevleri
    if (/^(ha)+h*a*$/.test(word) || /^(he)+h*e*$/.test(word) || /^(hi)+h*i*$/.test(word) || /^x[dx]+$/.test(word)) {
      words[i] = " gülüyor ";
      continue;
    }
    
    // Random atma durumları (en az 6 harfli kelimeler — kısa kelimeler Türkçe kısaltma olabilir)
    if (word.length >= 6) {
      // Türkçe ek kalıplarını içeren kelimeleri atla — bunlar büyük ihtimalle gerçek kelimeler
      const hasTurkishSuffix = /(?:lar|ler|ım|im|ın|in|ız|iz|dan|den|tan|ten|ya|ye|da|de|dır|dir|yor|ken|mak|mek|dım|dim|sın|sin|nız|niz|lık|lik|cık|cik|sız|siz)$/i.test(word);
      if (hasTurkishSuffix) continue;
      
      // 1. Yan yana 5 veya daha fazla sessiz harf (Örn: dhsgf, fdgjk) — 4'ten 5'e çıkarıldı
      //    (knkl = 4 sessiz → artık yakalanmaz, dhsgf = 5 sessiz → yakalanır)
      const hasFiveConsonants = /[bcçdfgğhjklmnprsştvyzxwq]{5,}/.test(word);
      
      // 2. Klasik klavye kaydırmaları (4+ tuş sırası)
      const hasKeyboardSmash = /(asdf|qwer|zxcv|fdsa|rewq|vcxz|jklş)/.test(word);
      
      // 3. Hiç sesli harf olmayan garip uzun dizelimler (en az 6 harf)
      const noVowels = word.length >= 6 && !/[aeıioöuüAEIİOÖUÜ]/.test(word);

      // 4. Aşırı sessiz harf yoğunluğu (%80+ ve 8+ harf)
      const consonantCount = (word.match(/[bcçdfgğhjklmnprsştvyzxwq]/g) || []).length;
      const intenseConsonants = word.length > 8 && (consonantCount / word.length) > 0.80;

      if (hasFiveConsonants || noVowels || (hasKeyboardSmash && word.length >= 7) || intenseConsonants) {
        words[i] = " rastgele yazıyor ";
      }
    }
  }
  cleanText = words.join(' ');

  // 3. Sürekli tekrar eden karakter kontrolü (Aynı harf 8+ tekrar)
  const repeatingRegex = /(.)\1{7,}/; 
  if (repeatingRegex.test(cleanText)) {
    return { text: "spam içeren bir mesaj", isSpam: true };
  }

  // 4. Çok uzun mesaj koruması (Max 200 karakter)
  if (cleanText.length > 200) {
    cleanText = cleanText.substring(0, 150) + "... ve devamı.";
  }

  // 5. Nokta bekleme süresini kısma
  cleanText = cleanText.replace(/\.+/g, ",");

  // 6. Fazla boşlukları temizle
  cleanText = cleanText.replace(/\s{2,}/g, ' ');

  return { text: cleanText.trim(), isSpam: false };
};
