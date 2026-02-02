import { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle, useCallback } from "react";
import { createPortal } from "react-dom";
import { User, Mail, ShieldAlert, LogOut, Check, ChevronRight, Monitor, Palette, Pipette, Image, Upload, Trash2, Zap } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useAuthStore } from "@/src/store/authStore";
import { toastOnce } from "@/src/utils/toast";
import { toast } from "@/src/utils/toast";
import { db } from "@/src/lib/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { uploadProfileBackgroundToCloudinary, deleteImageFromCloudinary } from "@/src/utils/imageUpload";
import { PRESET_GRADIENTS, SOLID_COLORS, STATUS_COLORS } from "../constants";

const AccountSettings = forwardRef(({ onClose, scrollToSection, setScrollToSection, contentRef }, ref) => {
  const { user, logout } = useAuthStore();
  const { profileColor, setProfileColor } = useSettingsStore();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Profile editing states
  const [bio, setBio] = useState("");
  const [customStatus, setCustomStatus] = useState("");
  const [customStatusColor, setCustomStatusColor] = useState("#949ba4"); // Default gray
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Section ref for scrolling
  const profileInfoRef = useRef(null);

  // Profile background image states
  const [profileBgImage, setProfileBgImage] = useState(null);
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const bgInputRef = useRef(null);

  // Scroll to section effect - Wait for profile to load first
  useEffect(() => {
    // Profil yüklenmeden scroll yapma
    if (!profileLoaded) return;
    
    if (scrollToSection === "profileInfo" && profileInfoRef.current && contentRef?.current) {
      // Biraz bekleyip render tamamlandıktan sonra scroll yap
      const timer = setTimeout(() => {
        const targetElement = profileInfoRef.current;
        const scrollContainer = contentRef.current;
        
        if (targetElement && scrollContainer) {
          const targetPosition = targetElement.offsetTop - 20; // 20px üstten padding
          
          // Smooth scroll with easing
          const startPosition = scrollContainer.scrollTop;
          const distance = targetPosition - startPosition;
          const duration = 600;
          let startTime = null;
          
          const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
          
          const animateScroll = (currentTime) => {
            if (startTime === null) startTime = currentTime;
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = easeOutQuart(progress);
            
            scrollContainer.scrollTop = startPosition + (distance * easeProgress);
            
            if (progress < 1) {
              requestAnimationFrame(animateScroll);
            } else {
              // Scroll tamamlandığında highlight efekti
              targetElement.classList.add("ring-2", "ring-indigo-500/50", "ring-offset-2", "ring-offset-[#1a1b1e]");
              setTimeout(() => {
                targetElement.classList.remove("ring-2", "ring-indigo-500/50", "ring-offset-2", "ring-offset-[#1a1b1e]");
              }, 2000);
            }
          };
          
          requestAnimationFrame(animateScroll);
        }
        
        // scrollToSection'ı temizle
        if (setScrollToSection) {
          setScrollToSection(null);
        }
      }, 400); // Daha uzun bekle, profil yüklendikten sonra
      
      return () => clearTimeout(timer);
    }
  }, [scrollToSection, setScrollToSection, contentRef, profileLoaded]);

  // Load profile from Firestore
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.uid) return;
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setBio(data.bio || "");
          setCustomStatus(data.customStatus || "");
          setCustomStatusColor(data.customStatusColor || "#949ba4");
          setProfileBgImage(data.profileBgImage || null);
        }
        setProfileLoaded(true);
      } catch (error) {
        console.error("Error loading profile:", error);
      }
      setIsLoadingProfile(false);
    };
    loadProfile();
  }, [user?.uid]);

  // Handle profile background image upload
  const handleBgImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate image type
    if (!file.type.startsWith("image/")) {
      toast.error("Lütfen bir resim dosyası seçin.");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Resim boyutu maksimum 5MB olmalıdır.");
      return;
    }

    setIsUploadingBg(true);
    try {
      // Delete old image from Cloudinary if exists
      if (profileBgImage) {
        await deleteImageFromCloudinary(profileBgImage);
      }

      // Upload new image
      const imageUrl = await uploadProfileBackgroundToCloudinary(file);
      setProfileBgImage(imageUrl);

      // Save to Firestore immediately
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
      // Reset input
      if (bgInputRef.current) {
        bgInputRef.current.value = "";
      }
    }
  };

  // Handle profile background image removal
  const handleRemoveBgImage = async () => {
    if (!profileBgImage) return;

    setIsUploadingBg(true);
    try {
      // Delete from Cloudinary
      await deleteImageFromCloudinary(profileBgImage);

      // Remove from Firestore
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

  // Save profile to Firestore
  const saveProfile = async () => {
    if (!user?.uid) {
      console.error("saveProfile: No user uid found");
      toast.error("Kullanıcı oturumu bulunamadı");
      return;
    }
    
    if (isSaving) {
      console.log("saveProfile: Already saving, skipping...");
      return;
    }
    
    console.log("saveProfile: Starting save process...", { bio: bio.trim(), customStatus: customStatus.trim(), profileColor });
    setIsSaving(true);
    
    try {
      const updateData = {
        bio: bio.trim(),
        customStatus: customStatus.trim(),
        customStatusColor: customStatusColor,
        bannerColor: profileColor,
        updatedAt: serverTimestamp()
      };
      
      console.log("saveProfile: Updating Firestore with:", updateData);
      await updateDoc(doc(db, "users", user.uid), updateData);
      console.log("saveProfile: Successfully saved!");
      toast.success("Profil güncellendi!");
    } catch (error) {
      console.error("saveProfile: Error saving profile:", error);
      toast.error("Profil güncellenemedi: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Admin kontrolü (sadece UID)
  const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID?.trim() || "";
  const isAdmin = user && ADMIN_UID && user.uid === ADMIN_UID;

  // DevTools açma
  const handleOpenDevTools = async () => {
    if (window.netrex && isAdmin) {
      try {
        const result = await window.netrex.openDevTools(user?.uid);
        if (!result.success) {
          console.error("DevTools açılamadı:", result.error);
        }
      } catch (error) {
        console.error("DevTools açma hatası:", error);
      }
    }
  };

  // profileColor'dan mevcut değerleri parse et
  const parseProfileColor = useCallback((color) => {
    if (!color)
      return {
        mode: "solid",
        solidColor: "#6366f1",
        start: "#6366f1",
        end: "#a855f7",
        angle: 135,
      };

    if (color.includes("gradient")) {
      // linear-gradient(135deg, #6366f1 0%, #a855f7 100%) formatını parse et
      const angleMatch = color.match(/(\d+)deg/);
      const colorMatches = color.match(/#[0-9a-fA-F]{6}/g);
      const angle = angleMatch ? parseInt(angleMatch[1]) : 135;
      const start =
        colorMatches && colorMatches[0] ? colorMatches[0] : "#6366f1";
      const end = colorMatches && colorMatches[1] ? colorMatches[1] : "#a855f7";
      return { mode: "gradient", solidColor: start, start, end, angle };
    } else {
      return {
        mode: "solid",
        solidColor: color,
        start: "#6366f1",
        end: "#a855f7",
        angle: 135,
      };
    }
  }, []);

  const parsed = useMemo(
    () => parseProfileColor(profileColor),
    [profileColor, parseProfileColor]
  );
  const [colorMode, setColorMode] = useState(parsed.mode);
  const [gradStart, setGradStart] = useState(parsed.start);
  const [gradEnd, setGradEnd] = useState(parsed.end);
  const [gradAngle, setGradAngle] = useState(parsed.angle);
  const [localSolidColor, setLocalSolidColor] = useState(parsed.solidColor);
  const isUpdatingFromStore = useRef(false);

  // profileColor değiştiğinde state'leri güncelle (dışarıdan değişiklik olursa)
  useEffect(() => {
    // Eğer update bizden gittiyse (store update'i biz tetikledik) local state'i ezmemek için skip edebiliriz
    // Ama debounce olduğu için, store update olana kadar local zaten ileride olabilir.
    // Basit mantık: Store'dan gelen değer ile bizim local değerimiz farklıysa store'u esas al.
    // Ancak sürükleme sırasında bu çakışma yaratabilir.
    // isUpdatingFromStore flag'i tam burada işe yarar.
    
    if (isUpdatingFromStore.current) {
      isUpdatingFromStore.current = false;
      return;
    }
    const newParsed = parseProfileColor(profileColor);
    if (newParsed.mode !== colorMode) {
      setColorMode(newParsed.mode);
    }
    if (newParsed.start !== gradStart) {
      setGradStart(newParsed.start);
    }
    if (newParsed.end !== gradEnd) {
      setGradEnd(newParsed.end);
    }
    if (newParsed.angle !== gradAngle) {
      setGradAngle(newParsed.angle);
    }
    if (newParsed.solidColor !== localSolidColor) {
      setLocalSolidColor(newParsed.solidColor);
    }
  }, [profileColor, parseProfileColor]);

  // Debounced Update for Gradient
  useEffect(() => {
    if (colorMode === "gradient") {
      const timer = setTimeout(() => {
        isUpdatingFromStore.current = true;
        setProfileColor(
          `linear-gradient(${gradAngle}deg, ${gradStart} 0%, ${gradEnd} 100%)`
        );
      }, 100); // 100ms debounce
      return () => clearTimeout(timer);
    }
  }, [gradStart, gradEnd, gradAngle, colorMode, setProfileColor]);

  // Debounced Update for Solid Color
  useEffect(() => {
    if (colorMode === "solid") {
      const timer = setTimeout(() => {
        isUpdatingFromStore.current = true;
        setProfileColor(localSolidColor);
      }, 100); // 100ms debounce
      return () => clearTimeout(timer);
    }
  }, [localSolidColor, colorMode, setProfileColor]);
  
  // ... (Logout handlers) ... 
  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    onClose();
    await logout();
  };
  /* Expose saveProfile to parent via ref */
  useImperativeHandle(ref, () => ({
    saveProfile
  }));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-2xl font-bold text-white mb-6 relative">
        <span className="relative z-10">Hesabım</span>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
      </h3>
      <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg mb-8 relative group/card hover:shadow-xl transition-all duration-300">
        {/* Hover glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>

        <div
          className="h-28 w-full transition-all duration-300 relative"
          style={{ background: colorMode === "solid" ? localSolidColor : `linear-gradient(${gradAngle}deg, ${gradStart} 0%, ${gradEnd} 100%)` }}
        >
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20"></div>
        </div>
        <div className="px-5 pb-5 relative">
          <div className="flex justify-between items-end -mt-10 mb-4">
            <div className="flex items-end gap-3">
              <div className="p-1.5 bg-[#1e1f22] rounded-full">
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-sm relative overflow-hidden"
                  style={{ background: colorMode === "solid" ? localSolidColor : `linear-gradient(${gradAngle}deg, ${gradStart} 0%, ${gradEnd} 100%)` }}
                >
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user?.displayName?.charAt(0).toUpperCase() || "?"
                  )}
                </div>
              </div>
              <div className="mb-1">
                <h2 className="text-xl font-bold text-white leading-none">
                  {user?.displayName || "Misafir Kullanıcı"}
                </h2>
                <span className="text-sm text-[#949ba4] font-medium">
                  #{user?.uid?.substring(0, 4)}
                </span>
              </div>
            </div>
          </div>
          <div className="glass-strong rounded-xl p-5 space-y-4 border border-white/10 relative z-10">
            <div className="flex justify-between items-center group">
              <div>
                <label className="text-[11px] font-bold text-[#949ba4] uppercase mb-1.5 flex items-center gap-1.5">
                  <User size={12} className="text-indigo-400" /> Görünen Ad
                </label>
                <div className="text-white text-sm font-medium">
                  {user?.displayName || "Belirtilmemiş"}
                </div>
              </div>
            </div>
            <div className="h-px bg-white/10"></div>
            <div className="flex justify-between items-center group">
              <div>
                <label className="text-[11px] font-bold text-[#949ba4] uppercase mb-1.5 flex items-center gap-1.5">
                  <Mail size={12} className="text-indigo-400" /> E-Posta
                </label>
                <div className="text-white text-sm font-medium">
                  {user?.email || (
                    <span className="text-[#949ba4] italic">Anonim Hesap</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin DevTools Button */}
      {isAdmin && window.netrex && (
        <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-6 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
          
          <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
            <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center">
              <ShieldAlert size={14} className="text-red-400" />
            </div>
            Admin Araçları
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/10 text-red-400 border border-red-500/30">
              ADMIN
            </span>
          </h4>
          <div className="relative z-10">
            <button
              onClick={handleOpenDevTools}
              onMouseDown={(e) => e.preventDefault()}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] focus:outline-none"
            >
              <Monitor size={16} />
              Developer Tools'u Aç
            </button>
            <p className="text-xs text-[#949ba4] mt-3 text-center">
              Build edilmiş uygulamada console'u açmak için
            </p>
          </div>
        </div>
      )}

      {/* Profil Teması */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-6 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
        
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <Palette size={14} className="text-purple-400" />
          </div>
          Profil Teması
        </h4>
        
        <div className="relative z-10">
          <div className="flex gap-2 mb-4 bg-[#1e1f22] p-1.5 rounded-xl w-fit border border-white/5">
            <button
              onClick={() => {
                setColorMode("solid");
                if (profileColor.includes("gradient")) {
                  const parsed = parseProfileColor(profileColor);
                  setLocalSolidColor(parsed.solidColor);
                  setProfileColor(parsed.solidColor);
                }
              }}
              onMouseDown={(e) => e.preventDefault()}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 focus:outline-none ${
                colorMode === "solid"
                  ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white shadow border border-indigo-500/30"
                  : "text-[#949ba4] hover:text-white hover:bg-white/5"
              }`}
            >
              <Pipette size={14} /> Düz Renk
            </button>
            <button
              onClick={() => {
                setColorMode("gradient");
                if (!profileColor.includes("gradient")) {
                  const parsed = parseProfileColor(profileColor);
                  setGradStart(parsed.solidColor);
                  // Immediate switch for UI
                  setProfileColor(
                    `linear-gradient(${gradAngle}deg, ${parsed.solidColor} 0%, ${gradEnd} 100%)`
                  );
                }
              }}
              onMouseDown={(e) => e.preventDefault()}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 focus:outline-none ${
                colorMode === "gradient"
                  ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white shadow border border-indigo-500/30"
                  : "text-[#949ba4] hover:text-white hover:bg-white/5"
              }`}
            >
              <Zap size={14} /> Gradient
            </button>
          </div>
          
          {colorMode === "solid" && (
            <div className="animate-in fade-in zoom-in-95 duration-200 bg-[#1e1f22] rounded-xl p-4 border border-white/5">
              <div className="flex flex-wrap gap-3">
                <label className="w-10 h-10 rounded-full bg-[#2b2d31] border-2 border-dashed border-[#4e5058] flex items-center justify-center cursor-pointer hover:border-indigo-500 transition group relative overflow-hidden">
                  <input
                    type="color"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    onChange={(e) => setLocalSolidColor(e.target.value)}
                    value={localSolidColor}
                  />
                  <Pipette
                    size={16}
                    className="text-[#949ba4] group-hover:text-indigo-400 transition-colors"
                  />
                </label>
                {SOLID_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setProfileColor(color)}
                    onMouseDown={(e) => e.preventDefault()}
                    className={`w-10 h-10 rounded-full transition-all duration-200 relative focus:outline-none ${
                      profileColor === color
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#1e1f22] scale-110"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: color }}
                  >
                    {profileColor === color && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Check
                          size={16}
                          className="text-white drop-shadow-md"
                          strokeWidth={3}
                        />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {colorMode === "gradient" && (
            <div className="animate-in fade-in zoom-in-95 duration-200 bg-[#1e1f22] p-4 rounded-xl border border-white/5">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#949ba4] uppercase">
                    Başlangıç
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={gradStart}
                      onChange={(e) => setGradStart(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="text-xs text-mono text-[#dbdee1]">
                      {gradStart}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#949ba4] uppercase">
                    Bitiş
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={gradEnd}
                      onChange={(e) => setGradEnd(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                    />
                    <span className="text-xs text-mono text-[#dbdee1]">
                      {gradEnd}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-1 ml-4">
                  <span className="text-[10px] font-bold text-[#949ba4] uppercase">
                    Açı ({gradAngle}°)
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={gradAngle}
                    onChange={(e) => setGradAngle(e.target.value)}
                    className="w-full h-2 bg-[#404249] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-[#949ba4] uppercase">
                  Hızlı Seçim
                </span>
                <div className="flex flex-wrap gap-3">
                  {PRESET_GRADIENTS.map((grad, i) => (
                    <button
                      key={i}
                      onClick={() => setProfileColor(grad)}
                      onMouseDown={(e) => e.preventDefault()}
                      className={`w-12 h-12 rounded-lg transition-all duration-200 relative shadow-sm focus:outline-none ${
                        profileColor === grad
                          ? "ring-2 ring-white ring-offset-2 ring-offset-[#1e1f22]"
                          : "hover:scale-105"
                      }`}
                      style={{ background: grad }}
                    >
                      {profileColor === grad && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check
                            size={20}
                            className="text-white drop-shadow-md"
                            strokeWidth={3}
                          />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Profil Arkaplan Resmi */}
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

      {/* Profil Bilgileri */}
      <div ref={profileInfoRef} id="profile-info-section" className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 mb-6 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
        
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <User size={14} className="text-indigo-400" />
          </div>
          Profil Bilgileri
        </h4>
        
        <div className="relative z-10 space-y-4">
          {/* Durum */}
          {/* Durum */}
          <div className="bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-indigo-500/20 transition-colors duration-300">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-bold text-[#949ba4] uppercase block">
                DURUM
              </label>
              
              {/* Renk Seçici */}
              <div className="flex items-center gap-1.5 bg-black/20 p-1 rounded-lg">
                {STATUS_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setCustomStatusColor(color)}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${
                      customStatusColor === color 
                        ? 'scale-125 ring-2 ring-white/50 shadow-[0_0_8px_rgba(255,255,255,0.3)]' 
                        : 'hover:scale-110 opacity-60 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                
                {/* Özel Renk Seçici (Color Picker) */}
                <div className="w-px h-3.5 bg-white/10 mx-0.5"></div>
                <label className="relative cursor-pointer group" title="Özel Renk Seç">
                  <input 
                    type="color" 
                    value={customStatusColor}
                    onChange={(e) => setCustomStatusColor(e.target.value)}
                    className="absolute opacity-0 inset-0 w-full h-full cursor-pointer z-10"
                  />
                  <div 
                    className={`w-3.5 h-3.5 rounded-full border border-white/20 flex items-center justify-center transition-all duration-300 ${
                      !STATUS_COLORS.includes(customStatusColor) 
                        ? 'scale-125 ring-2 ring-white/50 shadow-[0_0_8px_rgba(255,255,255,0.3)]' 
                        : 'hover:scale-110 opacity-60 hover:opacity-100 bg-gradient-to-br from-white/10 to-transparent'
                    }`}
                    style={{ 
                      backgroundColor: !STATUS_COLORS.includes(customStatusColor) ? customStatusColor : undefined 
                    }}
                  >
                    {!STATUS_COLORS.includes(customStatusColor) ? null : <Pipette size={8} className="text-white" />}
                  </div>
                </label>
              </div>
            </div>

            <input
              type="text"
              value={customStatus}
              onChange={(e) => {
                // Satır atlamalarını ve fazla boşlukları temizle
                const cleaned = e.target.value
                  .replace(/[\r\n]/g, '') // Enter'ları kaldır
                  .replace(/\s+/g, ' '); // Birden fazla boşluğu tek boşluğa çevir
                setCustomStatus(cleaned.slice(0, 50));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault(); // Enter'ı engelle
                }
              }}
              placeholder="Ne yapıyorsun?"
              maxLength={50}
              style={{ color: customStatusColor }}
              className="w-full bg-[#111214] border border-white/10 rounded-lg px-3 py-2 text-sm placeholder:text-[#5c5e66] focus:outline-none focus:border-indigo-500/50 transition-colors font-medium"
            />
            <span className="text-[10px] text-[#5c5e66] mt-1 block text-right">
              {customStatus.length}/50
            </span>
          </div>

          {/* Bio */}
          <div className="bg-[#1e1f22] rounded-xl p-4 border border-white/5 hover:border-indigo-500/20 transition-colors duration-300">
            <label className="text-[11px] font-bold text-[#949ba4] uppercase mb-2 block">
              Hakkımda
            </label>
            <textarea
              value={bio}
              onChange={(e) => {
                let value = e.target.value;
                
                // Ardışık satır atlamalarını tek satır atlamaya çevir (2'den fazla newline -> 2)
                value = value.replace(/\n{3,}/g, '\n\n');
                
                // Maksimum 3 satır kontrolü
                const lines = value.split('\n');
                if (lines.length > 3) {
                  value = lines.slice(0, 3).join('\n');
                }
                
                // Her satırda fazla boşlukları temizle
                value = value.split('\n').map(line => line.replace(/\s+/g, ' ')).join('\n');
                
                // Karakter limiti
                setBio(value.slice(0, 200));
              }}
              onKeyDown={(e) => {
                // 3 satırda Enter'ı engelle
                if (e.key === 'Enter') {
                  const currentLines = bio.split('\n').length;
                  if (currentLines >= 3) {
                    e.preventDefault();
                  }
                }
              }}
              placeholder="Kendinden biraz bahset..."
              maxLength={200}
              rows={3}
              className="w-full bg-[#111214] border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-[#5c5e66] focus:outline-none focus:border-indigo-500/50 transition-colors resize-none"
            />
            <span className="text-[10px] text-[#5c5e66] mt-1 block text-right">
              {bio.length}/200
            </span>
          </div>

          {/* Kaydet Butonu */}
          <button
            onClick={() => {
              console.log("=== Profili Kaydet BUTTON CLICKED ===");
              console.log("isSaving:", isSaving);
              console.log("user?.uid:", user?.uid);
              saveProfile();
            }}
            onMouseDown={(e) => e.preventDefault()}
            disabled={isSaving}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300 flex items-center justify-center gap-2 ${
              isSaving 
                ? "bg-indigo-500/50 text-white/70 cursor-not-allowed"
                : "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
            }`}
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <Check size={16} />
                Profili Kaydet
              </>
            )}
          </button>
        </div>
      </div>

      {/* Hesap İşlemleri */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-5 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
        
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-4 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center">
            <LogOut size={14} className="text-red-400" />
          </div>
          Hesap İşlemleri
        </h4>
        
        <button
          onClick={handleLogout}
          onMouseDown={(e) => e.preventDefault()}
          className="relative z-10 flex items-center justify-between p-4 rounded-xl bg-[#1e1f22] border-2 border-red-500/30 hover:border-red-500 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-red-600/10 group transition-all duration-300 cursor-pointer text-left w-full overflow-hidden focus:outline-none"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
              <LogOut size={18} className="text-red-400 group-hover:scale-110 transition-transform duration-300" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white group-hover:text-red-300 transition-colors">
                Çıkış Yap
              </span>
              <span className="text-xs text-[#949ba4] group-hover:text-[#b5bac1] transition-colors">
                Oturumunu kapat ve giriş ekranına dön.
              </span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center relative z-10 group-hover:bg-red-500/20 transition-colors">
            <ChevronRight size={18} className="text-red-400" />
          </div>
        </button>
      </div>
      {/* Logout Confirmation Modal */}
      {showLogoutModal && createPortal(
        <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-nds-fade-in" onClick={() => setShowLogoutModal(false)}></div>
          <div className="glass-strong bg-[#1e1f22] border border-red-500/20 rounded-2xl w-full max-w-md p-0 relative z-10 animate-nds-scale-in shadow-2xl overflow-hidden">
            <div className="p-6">
                <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                    <LogOut size={24} className="text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Çıkış Yap</h3>
                <p className="text-[#949ba4] leading-relaxed">
                  Hesabından çıkış yapmak istediğine emin misin? Tekrar giriş yapana kadar bildirim almayacaksın.
                </p>
            </div>
            <div className="p-4 bg-white/5 flex justify-end gap-3 border-t border-white/5">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2.5 rounded-xl text-[#dbdee1] hover:bg-white/5 transition-colors font-medium text-sm"
              >
                Vazgeç
              </button>
              <button
                onClick={confirmLogout}
                className="px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 active:scale-95 text-white transition-all font-medium text-sm shadow-lg shadow-red-500/20 flex items-center gap-2"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

export default AccountSettings;
