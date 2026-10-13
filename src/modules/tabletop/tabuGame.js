/**
 * 🤫 Tabu — kelime anlatma oyunu (HOST durum makinesi, ağ ve arayüzden bağımsız)
 *
 * İki takım sırayla oynar. Anlatıcı, kartın üstündeki kelimeyi YASAKLI kelimeleri söylemeden takım
 * arkadaşlarına anlatır. Süre dolana kadar:
 *   Doğru  (anlatıcı basar)             +1 puan
 *   Tabu!  (rakip takım basar)          −1 puan  (yasaklı kelime söylendi)
 *   Pas    (anlatıcı, turda 3 hak)      puan yok
 * Kartı yalnızca anlatıcı ve RAKİP takım görür (rakipler yasaklıları denetler); anlatıcının takımı görmez.
 *
 * Aksiyonlar (act): join {team}, leave, start, go, ok, taboo, pass, reset.
 * Host `tick()` ile süreyi işletir. Durum yayını `emit(publicState)`, kartlar `sendCard(ids, card|null)`.
 */

// [kelime, [5 yasaklı]]
export const TABU_CARDS = [
  ["Kahve", ["Fincan", "Türk", "Fal", "Çekirdek", "Sıcak"]],
  ["Futbol", ["Top", "Gol", "Takım", "Maç", "Kale"]],
  ["Okul", ["Öğrenci", "Öğretmen", "Ders", "Sınıf", "Zil"]],
  ["Hastane", ["Doktor", "Hasta", "Ameliyat", "İlaç", "Acil"]],
  ["Pizza", ["İtalyan", "Peynir", "Dilim", "Fırın", "Hamur"]],
  ["Telefon", ["Aramak", "Mesaj", "Cep", "Ekran", "Şarj"]],
  ["Uçak", ["Havalimanı", "Pilot", "Kanat", "Uçmak", "Bilet"]],
  ["Düğün", ["Gelin", "Damat", "Nikah", "Halay", "Davul"]],
  ["Deniz", ["Plaj", "Dalga", "Tuzlu", "Yüzmek", "Mavi"]],
  ["Kitap", ["Okumak", "Sayfa", "Yazar", "Kütüphane", "Roman"]],
  ["Ayna", ["Yansıma", "Bakmak", "Cam", "Yüz", "Duvar"]],
  ["Saat", ["Zaman", "Akrep", "Yelkovan", "Kol", "Dakika"]],
  ["Bisiklet", ["Pedal", "Tekerlek", "Sürmek", "Gidon", "İki"]],
  ["Çay", ["Bardak", "Demlik", "Şeker", "Rize", "Sıcak"]],
  ["Gökkuşağı", ["Yağmur", "Renk", "Yedi", "Güneş", "Gökyüzü"]],
  ["Karpuz", ["Yaz", "Kırmızı", "Çekirdek", "Meyve", "Dilim"]],
  ["Polis", ["Suç", "Hırsız", "Karakol", "Tabanca", "Üniforma"]],
  ["Sinema", ["Film", "Bilet", "Perde", "Mısır", "Salon"]],
  ["Bulut", ["Gökyüzü", "Yağmur", "Beyaz", "Hava", "Pamuk"]],
  ["Diş", ["Fırça", "Macun", "Ağız", "Doktor", "Çürük"]],
  ["Gitar", ["Tel", "Müzik", "Çalmak", "Akor", "Telli"]],
  ["Kar", ["Kış", "Beyaz", "Kardan Adam", "Soğuk", "Yağmak"]],
  ["Pasta", ["Doğum Günü", "Mum", "Tatlı", "Krema", "Dilim"]],
  ["Araba", ["Direksiyon", "Tekerlek", "Motor", "Sürmek", "Yol"]],
  ["Muz", ["Sarı", "Meyve", "Kabuk", "Maymun", "Tropik"]],
  ["Şemsiye", ["Yağmur", "Açmak", "Islanmak", "Sap", "Korumak"]],
  ["Doktor", ["Hastane", "Hasta", "Muayene", "İğne", "Beyaz Önlük"]],
  ["Ejderha", ["Ateş", "Masal", "Kanat", "Dev", "Mağara"]],
  ["Korsan", ["Gemi", "Hazine", "Deniz", "Göz Bandı", "Bayrak"]],
  ["Astronot", ["Uzay", "Roket", "Ay", "Kıyafet", "NASA"]],
  ["Çikolata", ["Tatlı", "Kakao", "Süt", "Bar", "Kahverengi"]],
  ["Müzik", ["Şarkı", "Nota", "Çalgı", "Söylemek", "Kulaklık"]],
  ["Balon", ["Hava", "Şişirmek", "Patlamak", "Uçmak", "Doğum Günü"]],
  ["Hırsız", ["Çalmak", "Polis", "Gece", "Soygun", "Kilit"]],
  ["Tatil", ["Otel", "Deniz", "İş", "Bavul", "Dinlenmek"]],
  ["Kedi", ["Miyav", "Fare", "Pati", "Evcil", "Tüy"]],
  ["Köpek", ["Havlamak", "Kemik", "Kuyruk", "Evcil", "Tasma"]],
  ["Ağaç", ["Orman", "Yaprak", "Dal", "Kök", "Meyve"]],
  ["Yılbaşı", ["Hediye", "Çam", "Kutlama", "Aralık", "Noel"]],
  ["Bilgisayar", ["Klavye", "Fare", "Ekran", "İnternet", "Oyun"]],
  ["Matematik", ["Sayı", "Toplama", "Ders", "Problem", "Hesap"]],
  ["Çorba", ["Kaşık", "Sıcak", "Mercimek", "Tuz", "Kase"]],
  ["Berber", ["Saç", "Tıraş", "Makas", "Sakal", "Dükkan"]],
  ["Elektrik", ["Priz", "Fatura", "Kablo", "Işık", "Şok"]],
  ["Kuyumcu", ["Altın", "Yüzük", "Mücevher", "Bilezik", "Dükkan"]],
  ["Hayalet", ["Korku", "Beyaz", "Gece", "Uğursuz", "Perili"]],
  ["Futbolcu", ["Top", "Forma", "Gol", "Saha", "Transfer"]],
  ["Mutfak", ["Yemek", "Ocak", "Tencere", "Buzdolabı", "Pişirmek"]],
  ["Uyku", ["Yatak", "Rüya", "Gece", "Yorgun", "Horlamak"]],
  ["Ziyafet", ["Yemek", "Sofra", "Bayram", "Misafir", "Bol"]],
  ["Sirk", ["Palyaço", "Hayvan", "Akrobat", "Çadır", "Gösteri"]],
  ["Müze", ["Tarih", "Eser", "Gezmek", "Sergi", "Bilet"]],
  ["Tren", ["Ray", "İstasyon", "Vagon", "Bilet", "Lokomotif"]],
  ["Gemi", ["Deniz", "Kaptan", "Liman", "Yelken", "Okyanus"]],
  ["Yıldız", ["Gökyüzü", "Gece", "Parlak", "Uzay", "Güneş"]],
  ["Anahtar", ["Kilit", "Kapı", "Açmak", "Cep", "Demir"]],
  ["Profesör", ["Üniversite", "Akademisyen", "Ders", "Bilim", "Doktora"]],
  ["Halı", ["Yer", "Dokuma", "Salon", "Süpürmek", "Kilim"]],
  ["Börek", ["Peynir", "Yufka", "Fırın", "Hamur", "Su"]],
  ["Kamp", ["Çadır", "Doğa", "Ateş", "Uyku Tulumu", "Orman"]],
  ["Fotoğraf", ["Makine", "Çekmek", "Albüm", "Poz", "Kare"]],
  ["Pilot", ["Uçak", "Kokpit", "Havayolu", "Uçurmak", "Üniforma"]],
  ["Çiçek", ["Bahçe", "Gül", "Koku", "Vazo", "Bahar"]],
  ["Terzi", ["Dikmek", "Kumaş", "İğne", "Elbise", "Ölçü"]],
  ["Tatlı", ["Şeker", "Baklava", "Yemek", "Sonra", "Ekmek Kadayıfı"]],
  ["Yağmur", ["Islak", "Bulut", "Şemsiye", "Damla", "Yağmak"]],
  ["Kral", ["Tahta", "Kraliçe", "Taç", "Saray", "Hükümdar"]],
  ["Robot", ["Makine", "Yapay", "Metal", "Programlamak", "Film"]],
  ["İnternet", ["Wifi", "Site", "Bağlanmak", "Tarayıcı", "Ağ"]],
  ["Dondurma", ["Soğuk", "Külah", "Yaz", "Çilek", "Maraş"]],
  ["Maymun", ["Muz", "Ağaç", "Hayvanat Bahçesi", "Tırmanmak", "Kuyruk"]],
  ["Spor Salonu", ["Ağırlık", "Antrenman", "Kas", "Fitness", "Hoca"]],
  ["Pazar", ["Satıcı", "Sebze", "Alışveriş", "Tezgah", "Cumartesi"]],
  ["Hediye", ["Paket", "Doğum Günü", "Armağan", "Sürpriz", "Kutu"]],
  ["Komşu", ["Yan", "Kapı", "Apartman", "Bina", "Zil"]],
  ["Radyo", ["Frekans", "Müzik", "Dinlemek", "Haber", "Anten"]],
  ["Bavul", ["Seyahat", "Valiz", "Tatil", "Eşya", "Havalimanı"]],
  ["Mum", ["Alev", "Eriyen", "Işık", "Pasta", "Fitil"]],
  ["Lunapark", ["Eğlence", "Dönme Dolap", "Bilet", "Çocuk", "Hız Treni"]],
  ["Hayvanat Bahçesi", ["Aslan", "Kafes", "Maymun", "Hayvan", "Zürafa"]],
  ["Tavla", ["Zar", "Pul", "Oyun", "Kahvehane", "Şeş Beş"]],
  ["Çanta", ["Omuz", "Taşımak", "Sırt", "El", "Fermuar"]],
  ["Aşçı", ["Mutfak", "Yemek", "Restoran", "Şef", "Pişirmek"]],
];

const TEAM_MAX = 8;
export const TURN_SECS = 60;
export const PASS_LIMIT = 3;
export const TURNS_EACH = 3;

const shuffled = (n) => {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export class TabuHost {
  /**
   * @param o { now(): ms, emit(state), sendCard(ids, card|null) }
   */
  constructor({ now = () => Date.now(), emit = () => {}, sendCard = () => {} } = {}) {
    this.now = now;
    this.emit = emit;
    this.sendCard = sendCard;
    this.turnSecs = TURN_SECS;
    this.cardTargets = [];
    this.fullReset();
  }

  fullReset() {
    this.teams = [[], []];
    this.resetGame();
  }

  resetGame() {
    this.phase = "lobby"; // lobby | ready | play | over
    this.scores = [0, 0];
    this.turn = 0;
    this.rot = [0, 0];
    this.turnsPlayed = 0;
    this.totalTurns = TURNS_EACH * 2;
    this.endsAt = 0;
    this.passes = PASS_LIMIT;
    this.deck = shuffled(TABU_CARDS.length);
    this.deckPos = 0;
    this.cardNo = 0;
    this.card = null;
    this.last = "";
    this.stats = { ok: 0, taboo: 0, pass: 0 };
    this._sync();
  }

  // ───────── Durum ─────────
  get describer() {
    if (this.phase !== "ready" && this.phase !== "play") return null;
    const t = this.teams[this.turn];
    return t.length ? t[this.rot[this.turn] % t.length] : null;
  }

  teamOf(pid) {
    return this.teams[0].includes(pid) ? 0 : this.teams[1].includes(pid) ? 1 : -1;
  }

  publicState() {
    return {
      phase: this.phase,
      teams: [this.teams[0].slice(), this.teams[1].slice()],
      scores: this.scores.slice(),
      turn: this.turn,
      describer: this.describer,
      remainMs: this.phase === "play" ? Math.max(0, this.endsAt - this.now()) : this.turnSecs * 1000,
      secs: this.turnSecs,
      passes: this.passes,
      cardNo: this.cardNo,
      turnsPlayed: this.turnsPlayed,
      totalTurns: this.totalTurns,
      last: this.last,
      stats: { ...this.stats },
    };
  }

  /** Kartı kimler görür: anlatıcı + rakip takım (yalnızca tur sürerken) */
  _cardAudience() {
    if (this.phase !== "play" || !this.card) return [];
    const d = this.describer;
    const opp = this.teams[1 - this.turn];
    return [...new Set([d, ...opp].filter(Boolean))];
  }

  _publicCard() {
    return this.card ? { word: this.card[0], taboo: this.card[1].slice(), no: this.cardNo } : null;
  }

  _sync() {
    const aud = this._cardAudience();
    const card = this._publicCard();
    // Artık göremeyenlere kartı kaldır
    const lost = this.cardTargets.filter((id) => !aud.includes(id));
    if (lost.length) this.sendCard(lost, null);
    if (aud.length) this.sendCard(aud, card);
    this.cardTargets = aud;
    this.emit(this.publicState());
  }

  broadcast() {
    this._sync();
  }

  /** Yeni gelene mevcut durumu ve (hakkı varsa) kartı gönder */
  syncTo(pid) {
    this.emit(this.publicState(), pid);
    if (this._cardAudience().includes(pid)) this.sendCard([pid], this._publicCard());
  }

  _draw() {
    if (this.deckPos >= this.deck.length) {
      this.deck = shuffled(TABU_CARDS.length);
      this.deckPos = 0;
    }
    this.card = TABU_CARDS[this.deck[this.deckPos++]];
    this.cardNo++;
  }

  // ───────── Aksiyonlar ─────────
  act(pid, a) {
    if (!a || typeof a !== "object") return false;
    switch (a.t) {
      case "join": {
        if (this.phase === "play") return false;
        const team = a.team === 1 ? 1 : 0;
        for (let t = 0; t < 2; t++) this.teams[t] = this.teams[t].filter((id) => id !== pid);
        if (this.teams[team].length >= TEAM_MAX) return false;
        this.teams[team].push(pid);
        this._sync();
        return true;
      }
      case "leave":
        if (this.phase === "play" && this.describer === pid) return false;
        for (let t = 0; t < 2; t++) this.teams[t] = this.teams[t].filter((id) => id !== pid);
        this._sync();
        return true;
      case "start": {
        if (this.phase !== "lobby") return false;
        if (!this.teams[0].length || !this.teams[1].length) return false;
        this.phase = "ready";
        this.turn = 0;
        this.rot = [0, 0];
        this.turnsPlayed = 0;
        this.scores = [0, 0];
        this.last = "";
        this._sync();
        return true;
      }
      case "go": {
        if (this.phase !== "ready" || pid !== this.describer) return false;
        this.phase = "play";
        this.endsAt = this.now() + this.turnSecs * 1000;
        this.passes = PASS_LIMIT;
        this.last = "";
        this._draw();
        this._sync();
        return true;
      }
      case "ok":
        if (this.phase !== "play" || pid !== this.describer) return false;
        this.scores[this.turn] += 1;
        this.stats.ok++;
        this.last = "Doğru! +1";
        this._draw();
        this._sync();
        return true;
      case "taboo": {
        if (this.phase !== "play") return false;
        const oppHas = this.teams[1 - this.turn].length > 0;
        const allowed = this.teamOf(pid) === 1 - this.turn || (!oppHas && pid === this.describer);
        if (!allowed) return false;
        this.scores[this.turn] -= 1;
        this.stats.taboo++;
        this.last = "TABU! −1";
        this._draw();
        this._sync();
        return true;
      }
      case "pass":
        if (this.phase !== "play" || pid !== this.describer || this.passes <= 0) return false;
        this.passes--;
        this.stats.pass++;
        this.last = "Pas";
        this._draw();
        this._sync();
        return true;
      case "reset":
        // yalnızca tur arası/bitişte ya da lobide
        if (this.phase === "play") return false;
        this.resetGame();
        return true;
      default:
        return false;
    }
  }

  /** Süreyi işlet: dolduysa turu bitir. true dönerse durum değişti. */
  tick() {
    if (this.phase === "play" && this.now() >= this.endsAt) {
      this._endTurn("Süre doldu");
      return true;
    }
    return false;
  }

  _endTurn(why) {
    this.turnsPlayed++;
    this.rot[this.turn]++;
    this.card = null;
    if (this.turnsPlayed >= this.totalTurns) {
      this.phase = "over";
      this.last = why;
    } else {
      this.turn = 1 - this.turn;
      this.phase = "ready";
      this.last = why;
    }
    this._sync();
  }

  /** Oyuncu masadan ayrıldı */
  playerLeft(pid) {
    const wasDescriber = this.describer === pid;
    const had = this.teamOf(pid) >= 0;
    for (let t = 0; t < 2; t++) this.teams[t] = this.teams[t].filter((id) => id !== pid);
    if (!had) return;
    if ((this.phase === "play" || this.phase === "ready") && (!this.teams[0].length || !this.teams[1].length)) {
      this.phase = "lobby";
      this.card = null;
      this.last = "Bir takım boş kaldı";
    } else if (this.phase === "play" && wasDescriber) {
      this._endTurn("Anlatıcı ayrıldı");
      return;
    }
    this._sync();
  }

  /** Kazanan takım (berabere: -1) */
  winner() {
    if (this.phase !== "over") return null;
    return this.scores[0] === this.scores[1] ? -1 : this.scores[0] > this.scores[1] ? 0 : 1;
  }
}
