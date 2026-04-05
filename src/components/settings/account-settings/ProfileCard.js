"use client";

import { memo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { User, Mail, Camera } from "lucide-react";
import Avatar from "@/src/components/ui/Avatar";
import { toast } from "@/src/utils/toast";
import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
} from "@/src/utils/imageUpload";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "@/src/lib/firebase";
import { updateProfile } from "firebase/auth";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import ImageCropModal from "@/src/components/ui/ImageCropModal";
import { useSettingsStore } from "@/src/store/settingsStore";
import { extractDominantGradient } from "@/src/utils/extractDominantGradient";

/**
 * ✅ ProfileCard — Optimized account profile header
 * Avatar tıklandığında dosya seçilir → ImageCropModal açılır →
 * Onaylanınca Cloudinary'ye yüklenir.
 */
const ProfileCard = memo(function ProfileCard({ user, profileColor, bgImage }) {
  if (!user) return null;

  const fileInputRef = useRef(null);
  const [bannerColor, setBannerColor] = useState(profileColor);
  const [cropFile, setCropFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const setProfileColor = useSettingsStore((s) => s.setProfileColor);
  const autoThemeFromImage = useSettingsStore((s) => s.autoThemeFromImage);

  // ── Dosya seç → doğrula → kırpma modalını aç ────────────────────────────────
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen bir resim dosyası seçin.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Resim boyutu maksimum 5MB olmalıdır.");
      return;
    }

    setCropFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Kırpma onaylandı → Cloudinary + opsiyonel tema güncelle ─────────────────
  const handleCropSave = async (croppedFile) => {
    const { servers } = useServerStore.getState();
    setIsUploading(true);
    setCropFile(null);

    try {
      // Eski Cloudinary görselini sil
      if (user.photoURL && user.photoURL.includes("cloudinary.com")) {
        await deleteImageFromCloudinary(user.photoURL);
      }

      // Cloudinary yüklemesi ve opsiyonel tema çıkarımı paralel çalışsın
      const [imageUrl, gradient] = await Promise.all([
        uploadImageToCloudinary(croppedFile),
        autoThemeFromImage
          ? extractDominantGradient(croppedFile).catch(() => null)
          : Promise.resolve(null),
      ]);

      // users koleksiyonunda güncelle
      await updateDoc(doc(db, "users", user.uid), {
        photoURL: imageUrl,
        updatedAt: serverTimestamp(),
      });

      // Firebase Auth currentUser'ı güncelle — onAuthStateChanged ezmesin
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: imageUrl }).catch(
          () => {},
        );
      }

      // Sunucu üyeliklerinde güncelle
      if (Array.isArray(servers) && servers.length > 0) {
        const tasks = servers.map((s) =>
          updateDoc(doc(db, "servers", s.id, "members", user.uid), {
            photoURL: imageUrl,
          }).catch(() => {}),
        );
        await Promise.all(tasks);
      }

      // authStore'daki user'ı güncelle
      useAuthStore.setState((prev) => ({
        ...prev,
        user: { ...prev.user, photoURL: imageUrl },
      }));

      // Resmin dominant renklerinden profil temasını güncelle
      if (gradient) {
        setProfileColor(gradient);
        setBannerColor(gradient);
        toast.success("Profil resmin ve tema güncellendi!");
      } else {
        toast.success("Profil resmin güncellendi!");
      }
    } catch (error) {
      console.error("Error updating avatar from ProfileCard:", error);
      toast.error("Profil resmi güncellenemedi: " + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  // ── Banner rengi: mevcut arka plan veya avatar yüklendiğinde güncelle ─────────
  const handleImageLoaded = async (event) => {
    try {
      const imgEl = event.target;
      // Banner için hızlı ortalama renk (canvas, mevcut img elementinden)
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = 32;
      canvas.height = 32;
      ctx.drawImage(imgEl, 0, 0, 32, 32);
      const data = ctx.getImageData(0, 0, 32, 32).data;
      let r = 0,
        g = 0,
        b = 0,
        count = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 128) continue;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
      if (count > 0) {
        setBannerColor(
          `rgba(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}, 0.9)`,
        );
      }
    } catch {
      // sessiz geç
    }
  };

  return (
    <>
      <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg mb-8 relative group/card hover:shadow-xl transition-all duration-300">
        {/* Hover glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none" />

        {/* Banner — Arka plan resmi varsa onu göster, yoksa dominant renk */}
        <div
          className="h-28 w-full transition-all duration-300 relative overflow-hidden"
          style={{ background: bannerColor || profileColor }}
        >
          {bgImage ? (
            <>
              <img
                src={bgImage}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                crossOrigin="anonymous"
                onLoad={handleImageLoaded}
              />
              <div className="absolute inset-0 bg-black/20" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20" />
          )}
        </div>

        {/* Content */}
        <div className="px-5 pb-5 relative">
          <div className="flex justify-between items-end -mt-10 mb-4">
            <div className="flex items-end gap-3">
              {/* Avatar — tıkla ve kırpma modalı açılır */}
              <div className="p-1.5 bg-[#1e1f22] rounded-xl">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="relative w-24 h-24 rounded-xl overflow-hidden shadow-sm group/avatar focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed"
                >
                  <div className="w-full h-full flex items-center justify-center text-white text-4xl font-bold">
                    <Avatar
                      size="2xl"
                      src={user.photoURL || null}
                      name={user.displayName || "Kullanıcı"}
                      color={profileColor}
                      borderColor={profileColor}
                      onImageLoad={!bgImage ? handleImageLoaded : undefined}
                    />
                  </div>

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                    {isUploading ? (
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Camera size={22} className="text-white/90" />
                        <span className="text-[11px] text-white/80 font-medium">
                          Düzenle
                        </span>
                      </>
                    )}
                  </div>
                </button>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {/* Kullanıcı bilgisi */}
              <div className="mb-1">
                <h2 className="text-xl font-bold text-white leading-none">
                  {user.displayName || "Misafir Kullanıcı"}
                </h2>
                <span className="text-sm text-[#949ba4] font-medium">
                  #{user.uid?.substring(0, 4)}
                </span>
              </div>
            </div>
          </div>

          {/* Bilgi kartları */}
          <div className="glass-strong rounded-xl p-5 space-y-4 border border-white/10 relative z-10">
            <div className="flex justify-between items-center group">
              <div>
                <label className="text-[11px] font-bold text-[#949ba4] uppercase mb-1.5 flex items-center gap-1.5">
                  <User size={12} className="text-indigo-400" /> Görünen Ad
                </label>
                <div className="text-white text-sm font-medium">
                  {user.displayName || "Belirtilmemiş"}
                </div>
              </div>
            </div>
            <div className="h-px bg-white/10" />
            <div className="flex justify-between items-center group">
              <div>
                <label className="text-[11px] font-bold text-[#949ba4] uppercase mb-1.5 flex items-center gap-1.5">
                  <Mail size={12} className="text-indigo-400" /> E-Posta
                </label>
                <div className="text-white text-sm font-medium">
                  {user.email || (
                    <span className="text-[#949ba4] italic">Anonim Hesap</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Kırpma Modalı — 1:1 daire */}
      {cropFile && (
        <ImageCropModal
          file={cropFile}
          aspectRatio={1}
          shape="rect"
          title="Profil Resmini Düzenle"
          onSave={handleCropSave}
          onClose={() => setCropFile(null)}
        />
      )}
    </>
  );
});

export default ProfileCard;
