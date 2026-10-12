#!/bin/bash
# Netrex macOS düzeltme betiği
# Kullanım: Netrex.app'i Applications'a taşıyın, bu dosyaya çift tıklayın.
# (İlk seferde engellenirse: sağ tık > Aç, ya da Terminal'de: bash mac-fix.command)

APP="/Applications/Netrex.app"
ID="com.netrex.app"

if [ ! -d "$APP" ]; then
  echo "Netrex.app /Applications içinde bulunamadı. Önce uygulamayı oraya taşıyın."
  read -n 1 -s -r -p "Çıkmak için bir tuşa basın..."
  exit 1
fi

echo "Netrex kapatılıyor..."
pkill -x Netrex 2>/dev/null

echo "'Zarar görmüş' uyarısı kaldırılıyor..."
xattr -cr "$APP"

echo "Eski izin kayıtları sıfırlanıyor..."
for svc in ScreenCapture Camera Microphone Accessibility; do
  tccutil reset "$svc" "$ID" >/dev/null 2>&1
done

echo
echo "Tamamlandı. Netrex'i açın, istenen izinleri verin,"
echo "ardından Netrex'i bir kez kapatıp tekrar açın (ekran paylaşımı için gerekli)."
open "$APP"
read -n 1 -s -r -p "Çıkmak için bir tuşa basın..."
