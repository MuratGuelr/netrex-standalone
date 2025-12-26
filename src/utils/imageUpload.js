import imageCompression from 'browser-image-compression';

export const uploadImageToCloudinary = async (file) => {
  if (!file) throw new Error("Dosya seçilmedi.");

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    console.error("Cloudinary yapılandırması eksik:", { cloudName, uploadPreset });
    throw new Error("Resim yükleme servisi yapılandırılmamış.");
  }

  try {
    // 1. Sıkıştırma (Aggressive Compression)
    const options = {
      maxSizeMB: 0.05, // Hedef: ~50KB
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: "image/webp",
      initialQuality: 0.7
    };
    
    // Sıkıştırma işlemi
    let compressedFile;
    try {
        compressedFile = await imageCompression(file, options);
    } catch (compError) {
        console.warn("Compression failed, using original file:", compError);
        compressedFile = file;
    }
    
    // 2. Upload
    const formData = new FormData();
    formData.append("file", compressedFile);
    formData.append("upload_preset", uploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || "Yükleme sunucusu hatası.");
    }

    const data = await res.json();
    return data.secure_url;
  } catch (error) {
    console.error("Image upload failed:", error);
    throw error;
  }
};

/**
 * 🖼️ Sunucu İkonu için Ultra-Agresif Sıkıştırma ile Yükleme
 * Sunucu ikonları küçük gösterildiğinden (48-96px), çok daha agresif sıkıştırma yapılabilir.
 * Hedef: 128x128 piksel, ~15KB dosya boyutu
 */
export const uploadServerIconToCloudinary = async (file) => {
  if (!file) throw new Error("Dosya seçilmedi.");

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    console.error("Cloudinary yapılandırması eksik:", { cloudName, uploadPreset });
    throw new Error("Resim yükleme servisi yapılandırılmamış.");
  }

  try {
    // 1. Ultra-Agresif Sıkıştırma (Sunucu İkonu İçin)
    const options = {
      maxSizeMB: 0.015, // Hedef: ~15KB (çok küçük ikon için yeterli)
      maxWidthOrHeight: 128, // 128x128 piksel (sunucu ikonu için ideal)
      useWebWorker: true,
      fileType: "image/webp", // WebP en iyi sıkıştırma oranını sağlar
      initialQuality: 0.8 // Kaliteyi biraz yüksek tutarak netliği koruyoruz
    };
    
    console.log("🖼️ Sunucu ikonu sıkıştırılıyor...");
    console.log("   Orijinal boyut:", (file.size / 1024).toFixed(2), "KB");
    
    // Sıkıştırma işlemi
    let compressedFile;
    try {
        compressedFile = await imageCompression(file, options);
        console.log("   Sıkıştırılmış boyut:", (compressedFile.size / 1024).toFixed(2), "KB");
        console.log("   Sıkıştırma oranı:", ((1 - compressedFile.size / file.size) * 100).toFixed(1) + "%");
    } catch (compError) {
        console.warn("Compression failed, using original file:", compError);
        compressedFile = file;
    }
    
    // 2. Upload
    const formData = new FormData();
    formData.append("file", compressedFile);
    formData.append("upload_preset", uploadPreset);
    // İkon için özel folder (isteğe bağlı - organize etmek için)
    formData.append("folder", "server_icons");

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData
    });

    if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || "Yükleme sunucusu hatası.");
    }

    const data = await res.json();
    console.log("✅ Sunucu ikonu yüklendi:", data.secure_url);
    return data.secure_url;
  } catch (error) {
    console.error("Server icon upload failed:", error);
    throw error;
  }
};

export const deleteImageFromCloudinary = async (imageUrl) => {
    if (!imageUrl || !imageUrl.includes('cloudinary.com')) return;

    try {
        // Extract Public ID
        // URL format: https://res.cloudinary.com/<cloud_name>/image/upload/v<version>/<public_id>.<extension>
        
        const uploadIndex = imageUrl.indexOf('/upload/');
        if (uploadIndex === -1) return;
        
        const afterUpload = imageUrl.substring(uploadIndex + 8);
        const parts = afterUpload.split('/');
        
        // Versiyonu daha güvenli kontrol et (v12345678 gibi sadece rakam içeren versiyonlar)
        if (parts.length > 1 && /^v\d+$/.test(parts[0])) {
            parts.shift();
        }
        
        const pathWithExt = parts.join('/');
        const lastDotIndex = pathWithExt.lastIndexOf('.');
        const public_id = lastDotIndex !== -1 ? pathWithExt.substring(0, lastDotIndex) : pathWithExt;

        console.log("🗑️ Cloudinary'den resim siliniyor. Public ID:", public_id);

        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        const response = await fetch(`${baseUrl}/api/cloudinary-delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ public_id })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("❌ Cloudinary silme hatası (API):", errorData);
            // toast.error("Resim sunucudan tamamen silinemedi. (API Hatası)");
            throw new Error(errorData.error || "Sunucu silme işlemini reddetti");
        }

        const result = await response.json();
        if (result.result?.result !== 'ok') {
             console.warn("⚠️ Cloudinary uyarısı:", result.result);
             // toast.warning("Resim chatten silindi ancak sunucuda bulunamadı.");
        } else {
             console.log("✅ Cloudinary silme başarılı:", result);
        }
    } catch (e) {
        console.error("❌ Cloudinary'den resim silinemedi:", e.message);
        // toast.error("Resim sunucudan silinemedi: " + e.message);
    }
};
