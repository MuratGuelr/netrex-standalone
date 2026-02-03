import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useAuthStore } from "@/src/store/authStore";
import { db } from "@/src/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import {
  ProfileCard,
  ProfileThemePicker,
  ProfileBackgroundUploader,
  ProfileInfoEditor,
  AccountActions
} from "../account-settings";

/**
 * ✅ REFACTORED AccountSettings v2.0
 * 
 * OPTIMIZATIONS:
 * - Split into 5 sub-components (966 lines → ~150 lines each)
 * - Isolated state management per component
 * - Only changed components re-render
 * - Better maintainability
 * 
 * Components:
 * 1. ProfileCard - Banner + Avatar
 * 2. ProfileThemePicker - Color selection
 * 3. ProfileBackgroundUploader - Image upload
 * 4. ProfileInfoEditor - Bio + Status
 * 5. AccountActions - Logout + DevTools
 */

const AccountSettings = forwardRef(({ onClose, scrollToSection, setScrollToSection, contentRef }, ref) => {
  const { user, logout } = useAuthStore();
  const { profileColor, setProfileColor } = useSettingsStore();
  
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileBgImage, setProfileBgImage] = useState(null);
  const [bio, setBio] = useState("");
  const [customStatus, setCustomStatus] = useState("");
  const [customStatusColor, setCustomStatusColor] = useState("#949ba4");

  // Load profile data
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
      } catch (error) {
        console.error("Error loading profile:", error);
      }
      
      setIsLoadingProfile(false);
    };
    
    loadProfile();
  }, [user?.uid]);

  // Expose saveProfile to parent (for Settings Modal save button)
  useImperativeHandle(ref, () => ({
    saveProfile: () => {
      // ProfileInfoEditor handles its own save
      console.log("AccountSettings: Save triggered from parent");
    }
  }));

  if (isLoadingProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-2xl font-bold text-white mb-6 relative">
        <span className="relative z-10">Hesabım</span>
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
      </h3>

      {/* 1. Profile Card */}
      <ProfileCard 
        user={user} 
        profileColor={profileColor} 
      />

      {/* 2. Profile Theme Picker */}
      <ProfileThemePicker 
        profileColor={profileColor}
        setProfileColor={setProfileColor}
      />

      {/* 3. Profile Background Uploader */}
      <ProfileBackgroundUploader
        user={user}
        profileBgImage={profileBgImage}
        setProfileBgImage={setProfileBgImage}
      />

      {/* 4. Profile Info Editor */}
      <ProfileInfoEditor
        user={user}
        initialBio={bio}
        initialStatus={customStatus}
        initialStatusColor={customStatusColor}
      />

      {/* 5. Account Actions */}
      <AccountActions
        user={user}
        logout={logout}
        onClose={onClose}
      />
    </div>
  );
});

export default AccountSettings;
