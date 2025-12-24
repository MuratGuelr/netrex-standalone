"use client";
import { useState } from "react";
import Modal from "@/src/components/ui/Modal";
import Input from "@/src/components/ui/Input";
import Button from "@/src/components/ui/Button";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import { toast } from "sonner";

export default function JoinServerModal({ isOpen, onClose, onCreateClick }) {
  const [inviteCode, setInviteCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { joinServer } = useServerStore();
  const { user } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    // Clean up invite code (remove netrex:// prefix if present)
    const cleanCode = inviteCode.trim().replace(/^netrex:\/\//, "");

    setIsLoading(true);
    const result = await joinServer(cleanCode, user?.uid);
    setIsLoading(false);

    if (result.success) {
      toast.success(result.message || "Sunucuya katıldın!");
      onClose();
      setInviteCode("");
    } else {
      toast.error(result.error || "Katılma başarısız.");
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-md animate-nds-fade-in">
       {/* Animated background gradient */}
       <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-teal-500/5 to-transparent pointer-events-none"></div>

       <div className="glass-modal w-full max-w-md flex flex-col animate-nds-scale-in rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1b1e] via-[#16171a] to-[#111214] shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
          {/* Top glow effect */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-10"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-20 bg-green-500/10 blur-[50px] pointer-events-none"></div>

          {/* Header */}
          <div className="px-8 pt-8 pb-4 text-center relative z-10">
              <h2 className="text-2xl font-bold text-white mb-2">Sunucuya Katıl</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Aşağıya bir davet kodu girerek bir sunucuya katılabilirsin.
              </p>
              
              {/* Close Button */}
              <button 
                  onClick={onClose}
                  className="absolute top-5 right-5 w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all duration-200 group"
              >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
          </div>

          <div className="p-8 pt-2 relative z-10">
              <form onSubmit={handleSubmit} className="space-y-6">
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1">
                     Davet Kodu
                  </label>
                  <Input 
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="ör. htkz2s"
                    className="bg-black/20 border-white/10 focus:border-green-500/50 focus:ring-1 focus:ring-green-500/50 text-white placeholder:text-gray-600 transition-all duration-300 h-12 text-center text-lg font-mono tracking-wider"
                    autoFocus
                  />
                  <p className="text-xs text-gray-500 text-center pt-1">
                     Davet kodları genellikle 6-8 karakter uzunluğundadır.
                  </p>
                </div>

                <div className="flex justify-between items-center ">
                   <Button 
                        variant="ghost" 
                        onClick={onCreateClick || onClose} 
                        type="button"
                        className="hover:bg-white/5 text-gray-400 hover:text-white"
                   >
                     {onCreateClick ? "Geri Dön" : "İptal"}
                   </Button>
                   <Button 
                        type="submit" 
                        variant="success"
                        loading={isLoading} 
                        disabled={!inviteCode.trim()}
                        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-500/20 px-8 flex-1 ml-4"
                   >
                     Sunucuya Katıl
                   </Button>
                </div>
              </form>
              
              {!onCreateClick && (
                  <div className="mt-6 pt-4 border-t border-white/5 text-center">
                    <h4 className="text-gray-400 text-xs font-bold uppercase mb-2">Kendi sunucunu mu kurmak istiyorsun?</h4>
                     <Button 
                      variant="ghost" 
                      onClick={() => {
                          onClose();
                          // This logic depends on parent, but typically there's a switch or seperate modal
                      }}
                      className="text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10"
                    >
                      Sunucu Oluştur
                    </Button>
                  </div>
              )}
          </div>
       </div>
    </div>
  );
}
