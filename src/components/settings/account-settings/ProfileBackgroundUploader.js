import { useState, useRef } from "react";
import { Image, Upload, Trash2 } from "lucide-react";
import { toast } from "@/src/utils/toast";
import { uploadProfileBackgroundToCloudinary, deleteImageFromCloudinary } from "@/src/utils/imageUpload";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/src/lib/firebase";

/**
 * ✅ ProfileBackgroundUploader - Optimized image upload
 * Handles profile background image with preview
 */
export default function ProfileBackgroundUploader({ user, profileBgImage, setProfileBgImage }) {
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const bgInputRef = useRef(null);

  const handleBgImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen bir resim dosyası seçin.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Resim boyutu maksimum 5MB olmalıdır.");
      return;
    }

    setIsUploadingBg(true);
    try {
      if (profileBgImage) {
        await deleteImageFromCloudinary(profileBgImage);
      }

      const imageUrl = await uploadProfileBackgroundToCloudinary(file);
      setProfileBgImage(imageUrl);

      await updateDoc(doc(db, "users", user.uid), {
        profileBgImage: imageUrl,
        updatedAt: serverTimestamp()
      });

      toast.success("Arkaplan resmi yüklendi!");
    } catch (error) {
      console.error("Error uploading background image:", error);
      toast.error("Resim yüklenemedi: " + error.message);
    } finally {
      setIsUploadingBg(false);
      if (bgInputRef.current) {
        bgInputRef.current.value = "";
      }
    }
  };

  const handleRemoveBgImage = async () => {
    if (!profileBgImage) return;

    setIsUploadingBg(true);
    try {
      await deleteImageFromCloudinary(profileBgImage);

      await updateDoc(doc(db, "users", user.uid), {
        profileBgImage: null,
        updatedAt: serverTimestamp()
      });

      setProfileBgImage(null);
      toast.success("Arkaplan resmi kaldırıldı!");
    } catch (error) {
      console.error("Error removing background image:", error);
      toast.error("Resim kaldırılamadı: " + error.message);
    } finally {
      setIsUploadingBg(false);
    }
  };

  return (
    <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-6 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
      <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
      
      <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
        <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center">
          <Image size={14} className="text-cyan-400" />
        </div>
        Arkaplan Resmi
        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
          YENİ
        </span>
      </h4>
      
      <div className="relative z-10">
        <p className="text-xs text-[#949ba4] mb-4">
          Profil kartınızda ve sesli kanallarda diğer kullanıcılar tarafından hafif blur efektiyle görüntülenir.
        </p>
        
        {/* Preview */}
        {profileBgImage && (
          <div className="mb-4 relative rounded-xl overflow-hidden border border-white/10 group/preview">
            <div 
              className="h-24 w-full bg-cover bg-center"
              style={{ 
                backgroundImage: `url(${profileBgImage})`,
                filter: "blur(1px)",
                opacity: 0.8
              }}
            />
            <div 
              className="absolute inset-0 bg-cover bg-center opacity-40"
              style={{ 
                backgroundImage: `url(${profileBgImage})`,
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#1e1f22] via-transparent to-transparent" />
            <div className="absolute bottom-2 left-3 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                {user?.displayName?.charAt(0).toUpperCase() || "?"}
              </div>
              <span className="text-white text-sm font-semibold drop-shadow-lg">{user?.displayName || "Kullanıcı"}</span>
            </div>
          </div>
        )}
        
        <div className="flex gap-3">
          {/* Upload Button */}
          <button
            onClick={() => bgInputRef.current?.click()}
            disabled={isUploadingBg}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 border ${
              isUploadingBg
                ? "bg-cyan-500/20 text-cyan-300/70 cursor-not-allowed border-cyan-500/30"
                : "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]"
            }`}
          >
            {isUploadingBg ? (
              <>
                <div className="w-4 h-4 border-2 border-cyan-300/30 border-t-cyan-300 rounded-full animate-spin" />
                Yükleniyor...
              </>
            ) : (
              <>
                <Upload size={16} />
                {profileBgImage ? "Değiştir" : "Resim Yükle"}
              </>
            )}
          </button>
          
          {/* Remove Button */}
          {profileBgImage && (
            <button
              onClick={handleRemoveBgImage}
              disabled={isUploadingBg}
              className={`px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 border flex items-center gap-2 ${
                isUploadingBg
                  ? "bg-red-500/10 text-red-300/50 cursor-not-allowed border-red-500/20"
                  : "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30 hover:border-red-500/50"
              }`}
            >
              <Trash2 size={16} />
              Kaldır
            </button>
          )}
        </div>
        
        {/* Hidden file input */}
        <input
          ref={bgInputRef}
          type="file"
          accept="image/*"
          onChange={handleBgImageUpload}
          className="hidden"
        />
        
        <p className="text-[10px] text-[#5c5e66] mt-3 text-center">
          Önerilen: 400x400px veya üzeri, maksimum 5MB
        </p>
      </div>
    </div>
  );
}
