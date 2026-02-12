import { Mic } from "lucide-react";

export default function HeaderBanner() {
  return (
    <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg hover:shadow-xl transition-all duration-300 mb-6 relative group/card">
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>
      
      <div className="h-20 w-full bg-gradient-to-r from-cyan-600 via-blue-600 to-cyan-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30"></div>
        <div className="absolute inset-0 flex items-center px-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
              <Mic size={24} className="text-white" />
            </div>
            <div>
              <h4 className="text-white font-bold text-lg">Ses ve Görüntü</h4>
              <p className="text-white/70 text-sm">Mikrofon, hoparlör ve kamera ayarları</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
