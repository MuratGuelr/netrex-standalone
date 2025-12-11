"use client";

/**
 * 👋 WelcomeScreen - Premium Empty State Welcome Screen
 * NDS v2.0 - Netrex Design System
 * 
 * Shown when no room is active. Features:
 * - Animated background decorations
 * - Premium glassmorphism effects
 * - Staggered entrance animations
 * - Keyboard shortcuts hint
 */

import { Radio, Mic, Headphones, Sparkles, Zap, Users, MessageSquare, Settings, ArrowRight } from "lucide-react";

export default function WelcomeScreen({ 
  userName = "Kullanıcı",
  version = "1.0.0",
  shortcuts = [],
  className = "" 
}) {
  const defaultShortcuts = shortcuts.length > 0 ? shortcuts : [
    { icon: <Mic size={18} />, label: "Sustur", hint: "Kısayol Tuşu", color: "indigo" },
    { icon: <Headphones size={18} />, label: "Sağırlaştır", hint: "Kısayol Tuşu", color: "purple" },
  ];

  const features = [
    { icon: <Users size={20} />, label: "Sesli Sohbet", desc: "Kristal netliğinde ses", color: "from-indigo-500 to-blue-500" },
    { icon: <MessageSquare size={20} />, label: "Metin Kanalları", desc: "Anlık mesajlaşma", color: "from-purple-500 to-pink-500" },
    { icon: <Zap size={20} />, label: "Düşük Gecikme", desc: "Hızlı bağlantı", color: "from-amber-500 to-orange-500" },
  ];

  return (
    <div className={`
      welcome-screen
      flex-1 
      flex flex-col 
      items-center justify-center
      p-8
      relative
      overflow-hidden
      ${className}
    `}>
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient Orbs */}
        <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-1/3 left-1/3 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-2/3 right-1/3 w-[400px] h-[400px] bg-cyan-500/5 rounded-full blur-[80px] animate-pulse-slow" style={{ animationDelay: '2s' }} />
        
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_40%,transparent_100%)]" />
        
        {/* Floating particles */}
        <div className="absolute top-20 left-1/4 w-2 h-2 bg-indigo-400/30 rounded-full animate-float" />
        <div className="absolute top-40 right-1/3 w-1.5 h-1.5 bg-purple-400/30 rounded-full animate-float-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-32 left-1/3 w-2 h-2 bg-cyan-400/30 rounded-full animate-float" style={{ animationDelay: '2s' }} />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-2xl animate-page-enter">
        
        {/* Premium Icon Container */}
        <div className="relative mb-10 group">
          {/* Glow ring */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-500 scale-110" />
          
          {/* Icon box */}
          <div className="
            relative
            w-32 h-32 
            bg-gradient-to-br from-[#1e1f22] to-[#2b2d31]
            rounded-3xl 
            flex items-center justify-center 
            border border-white/10
            shadow-[0_20px_60px_rgba(0,0,0,0.4)]
            group-hover:scale-105
            group-hover:border-indigo-500/30
            transition-all duration-500
            overflow-hidden
          ">
            {/* Inner glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            
            <Radio 
              size={56} 
              className="
                text-indigo-400 
                drop-shadow-[0_0_20px_rgba(99,102,241,0.6)]
                group-hover:text-indigo-300
                transition-colors duration-300
                relative z-10
              " 
            />
          </div>
          
          {/* Sparkle decorations */}
          <Sparkles size={16} className="absolute -top-2 -right-2 text-yellow-400/60 animate-pulse" />
          <Sparkles size={12} className="absolute -bottom-1 -left-1 text-purple-400/60 animate-pulse" style={{ animationDelay: '0.5s' }} />
        </div>

        {/* Welcome Text */}
        <h2 className="text-4xl font-bold text-white mb-4 tracking-tight">
          Hoş Geldin, <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">{userName}</span>!
        </h2>

        <p className="text-[#949ba4] text-lg mb-12 leading-relaxed max-w-md">
          Arkadaşlarınla konuşmaya başlamak için sol taraftaki ses kanallarından birine tıklayabilirsin.
        </p>

        {/* Feature Highlights */}
        <div className="flex items-center gap-4 mb-10">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="
                group
                flex items-center gap-3
                px-5 py-3
                bg-gradient-to-br from-[#1e1f22]/90 to-[#25272a]/90
                backdrop-blur-xl
                rounded-2xl
                border border-white/5
                hover:border-white/20
                transition-all duration-300
                hover:scale-105
                hover:shadow-lg
              "
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg`}>
                <span className="text-white">{feature.icon}</span>
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-white">{feature.label}</div>
                <div className="text-xs text-[#949ba4]">{feature.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Shortcuts Hint */}
        <div className="
          relative
          flex items-center gap-6 
          bg-gradient-to-br from-[#1e1f22]/95 to-[#25272a]/95
          backdrop-blur-xl
          px-8 py-5 
          rounded-2xl 
          border border-white/10
          shadow-[0_20px_60px_rgba(0,0,0,0.3)]
          hover:border-indigo-500/30
          hover:shadow-[0_20px_60px_rgba(99,102,241,0.15)]
          transition-all duration-300
          group/shortcuts
        ">
          {/* Background shimmer */}
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/shortcuts:opacity-100 transition-opacity duration-500 rounded-2xl" />
          
          {defaultShortcuts.map((shortcut, index) => (
            <div key={index} className="flex items-center gap-6 relative z-10">
              {index > 0 && (
                <div className="w-px h-10 bg-gradient-to-b from-transparent via-white/20 to-transparent" />
              )}
              <ShortcutHint 
                icon={shortcut.icon} 
                label={shortcut.label} 
                hint={shortcut.hint}
                color={shortcut.color}
              />
            </div>
          ))}
        </div>

        {/* Quick Tip */}
        <div className="mt-8 flex items-center gap-2 text-xs text-[#5c5e66]">
          <Settings size={12} />
          <span>Kısayol tuşlarını Ayarlar &gt; Tuş Atamaları bölümünden değiştirebilirsin</span>
        </div>
      </div>

      {/* Version Footer */}
      <div className="
        absolute bottom-6 
        flex items-center gap-3
        z-10
      ">
        <div className="flex items-center gap-2 px-4 py-2 bg-[#1e1f22]/80 backdrop-blur-sm rounded-full border border-white/5">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
          <span className="text-xs text-[#949ba4] font-medium">Netrex Client</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20">
            v{version}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * ⌨️ ShortcutHint - Premium shortcut hint display
 */
function ShortcutHint({ icon, label, hint, color = "indigo" }) {
  const colorClasses = {
    indigo: "from-indigo-500/20 to-indigo-600/10 border-indigo-500/30 text-indigo-400",
    purple: "from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-400",
    cyan: "from-cyan-500/20 to-cyan-600/10 border-cyan-500/30 text-cyan-400",
  };

  return (
    <div className="flex items-center gap-4 group/hint">
      <div className={`
        p-3 
        bg-gradient-to-br ${colorClasses[color] || colorClasses.indigo}
        rounded-xl 
        border
        group-hover/hint:scale-110
        transition-all duration-300
        shadow-lg
      `}>
        {icon}
      </div>
      <div className="flex flex-col text-left">
        <span className="text-sm font-bold text-white uppercase tracking-wide">
          {label}
        </span>
        <span className="text-xs text-[#5c5e66]">
          {hint}
        </span>
      </div>
    </div>
  );
}
