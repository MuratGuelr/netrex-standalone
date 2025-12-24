import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Smile, Upload } from "lucide-react";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";
import Input from "@/src/components/ui/Input";
import Button from "@/src/components/ui/Button";
import EmojiPicker from 'emoji-picker-react';

export default function CreateServerModal({ isOpen, onClose, onJoinClick }) {
  const [serverName, setServerName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { createServer } = useServerStore();
  const { user } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!serverName.trim()) return;

    setIsLoading(true);
    // Use selectedEmoji as the iconUrl. If no emoji selected, it sends null/empty which serverStore will handle (initials)
    const result = await createServer(serverName, user?.uid, selectedEmoji);
    setIsLoading(false);

    if (result.success) {
      setServerName("");
      setSelectedEmoji("");
      setShowEmojiPicker(false);
      onClose();
    } else {
      console.error(result.error);
    }
  };

  const handleEmojiClick = (emojiData) => {
      setSelectedEmoji(emojiData.emoji);
      setShowEmojiPicker(false);
  };


  if (!isOpen) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-md animate-nds-fade-in">
       {/* Animated background gradient */}
       <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent pointer-events-none"></div>

       <div className="glass-modal w-full max-w-md flex flex-col animate-nds-scale-in rounded-3xl border border-white/10 bg-gradient-to-br from-[#1a1b1e] via-[#16171a] to-[#111214] shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
          {/* Top glow effect */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-10"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-20 bg-indigo-500/10 blur-[50px] pointer-events-none"></div>
          
          {/* Particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-10 left-10 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl animate-pulse-slow"></div>
            <div className="absolute bottom-10 right-10 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl animate-pulse-slow" style={{ animationDelay: "1s" }}></div>
          </div>

          <div className="relative z-10">
              {/* Header */}
              <div className="px-8 pt-8 pb-4 text-center">
                  <h2 className="text-2xl font-bold text-white mb-2">Sunucunu Oluştur</h2>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    Sunucun senin ve arkadaşların için bir buluşma noktasıdır. <br/>İsmini koy ve bir simge ekle.
                  </p>
                  
                  {/* Close Button */}
                  <div
                    className="absolute top-5 right-5 flex flex-col items-center group cursor-pointer z-[10000]"
                    onClick={onClose}
                  >
                    <div className="w-8 h-8 rounded-lg glass-strong border border-white/5 flex items-center justify-center text-gray-400 group-hover:bg-white/10 group-hover:text-white transition-all duration-200">
                      <X size={18} />
                    </div>
                  </div>
              </div>

              <div className="p-8 pt-2">
                  <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* Emoji Selector */}
                    <div className="flex justify-center py-4">
                      <div className="relative group/emoji">
                        {/* Ring Animation */}
                        <div className="absolute -inset-1 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full opacity-0 group-hover/emoji:opacity-100 blur transition-opacity duration-500"></div>
                        
                        <div 
                           onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                           className="w-24 h-24 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center flex-col text-gray-400 hover:border-white/30 hover:text-white transition-all cursor-pointer bg-black/20 overflow-hidden relative z-10 group-hover/emoji:scale-105 duration-300"
                        >
                          {selectedEmoji ? (
                              <span className="text-5xl drop-shadow-lg scale-110 transition-transform">{selectedEmoji}</span>
                          ) : (
                              <>
                                  <div className="mb-1 p-2 bg-indigo-500/10 rounded-full">
                                      <Upload size={20} className="text-indigo-400" />
                                  </div>
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300/80">Yükle</span>
                              </>
                          )}
                           
                           {/* Upload Overlay */}
                           <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity backdrop-blur-sm">
                             <Smile size={24} className="text-white mb-1" />
                             <span className="text-[9px] font-bold text-white uppercase tracking-wider">Değiştir</span>
                           </div>
                        </div>
                        
                        {showEmojiPicker && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowEmojiPicker(false)}>
                                <div className="relative shadow-2xl rounded-xl animate-in zoom-in-95 duration-200 scale-110" onClick={(e) => e.stopPropagation()}>
                                  <EmojiPicker 
                                      onEmojiClick={handleEmojiClick}
                                      theme="dark"
                                      lazyLoadEmojis={true}
                                  />
                                </div>
                            </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-wider pl-1 flex items-center gap-1.5">
                         <div className="w-1 h-1 bg-indigo-500 rounded-full"></div>
                         Sunucu Adı
                      </label>
                      <Input 
                        value={serverName}
                        onChange={(e) => setServerName(e.target.value)}
                        placeholder="Sunucunun adı ne olsun?"
                        maxLength={30}
                        className="bg-black/20 border-white/10 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 text-white placeholder:text-gray-600 transition-all duration-300 h-12 text-center text-lg font-medium tracking-tight rounded-xl shadow-inner"
                        autoFocus
                      />
                      <p className="text-xs text-gray-500 text-center pt-1">
                         Topluluğunu oluştururken yaratıcı ol!
                      </p>
                    </div>

                    <div className="flex justify-between items-center ">
                       <Button 
                            variant="ghost" 
                            onClick={onClose} 
                            type="button"
                            className="hover:bg-white/5 text-gray-400 hover:text-white px-6"
                       >
                         İptal
                       </Button>
                       <Button 
                            type="submit" 
                            loading={isLoading} 
                            disabled={!serverName.trim()}
                            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20 px-8 flex-1 ml-4 h-12 rounded-xl"
                       >
                         Oluştur
                       </Button>
                    </div>
                  </form>

                  {/* Footer Section */}
                  <div className="mt-8 pt-6 border-t border-white/5 text-center">
                    <h4 className="text-gray-400 text-xs font-bold uppercase mb-3 tracking-widest">Zaten bir davetin var mı?</h4>
                    <Button 
                      className="w-full !bg-gradient-to-r !from-emerald-500 !to-green-600 hover:!from-emerald-600 hover:!to-green-700 text-white !shadow-lg !shadow-emerald-500/20 transition-all h-11 border-0"
                      onClick={onJoinClick}
                    >
                      Bir Sunucuya Katıl
                    </Button>
                  </div>
              </div>
           </div>
       </div>
    </div>,
    document.body
  );
}
