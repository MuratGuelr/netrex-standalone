
import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTracks, useLocalParticipant, useParticipants, VideoTrack } from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  Monitor,
  Eye,
  EyeOff,
  StopCircle,
  Layers,
  Minimize,
  Maximize,
  VolumeX,
  Volume1,
  Volume2,
  AlertTriangle,
  Users,
  MicOff,
  Video,
  GripHorizontal,
  LayoutGrid,
  Focus,
  X,
  ArrowUpToLine,
  Signal,
  Trash2
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSettingsStore } from "@/src/store/settingsStore";
import ParticipantList from "./ParticipantList";
import ChatView from "../ChatView";

const MemoizedStageBackground = React.memo(({ disableBackgroundEffects, activeSpeakerColor }) => {
  // Extract primary hex if it's a gradient
  const getBaseColor = (color) => {
    if (!color) return null;
    if (!color.includes("gradient")) return color;
    const match = color.match(/#[0-9a-fA-F]{6}/);
    return match ? match[0] : null;
  };

  const baseColor = getBaseColor(activeSpeakerColor);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {!disableBackgroundEffects && (
        <>
          <div 
            className="absolute inset-0 transition-opacity duration-1000 ease-in-out will-change-opacity pointer-events-none"
            style={{
              opacity: baseColor ? 0.25 : 0,
              background: baseColor || 'transparent',
              filter: 'blur(80px)',
              maskImage: 'radial-gradient(circle at 50% 50%, black 0%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(circle at 50% 50%, black 0%, transparent 70%)',
              transform: 'translateZ(0)' // Direct GPU hint
            }}
          />

          <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-indigo-500/[0.08] rounded-full blur-[80px] animate-pulse-slow will-change-opacity" />
          <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-500/[0.06] rounded-full blur-[65px] animate-pulse-slow will-change-opacity" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-cyan-500/[0.05] rounded-full blur-[100px] animate-pulse-slow will-change-opacity" style={{ animationDelay: '2s' }} />
          
          <div 
            className="absolute inset-0 opacity-[0.015] will-change-opacity"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px',
              maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%)'
            }}
          />
        </>
      )}
    </div>
  );
});

function SortableTrackItem({ id, children, spotlightMode = false, disableDrag = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id, disabled: disableDrag });

  const style = {
    transform: (spotlightMode && !isDragging) ? undefined : CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : (spotlightMode ? 'none' : transition),
    zIndex: isDragging && !spotlightMode ? 50 : 'auto',
  };

  // Grid mode: item moves at original size with a glow
  // Spotlight mode: item becomes dim placeholder (DragOverlay shows preview)
  const dragClass = isDragging
    ? (spotlightMode 
        ? 'border-[#5865f2]/30 opacity-30 scale-[0.98]' 
        : 'border-[#5865f2] shadow-[0_0_20px_rgba(88,101,242,0.35)] scale-[1.02]')
    : isOver 
      ? 'border-[#5865f2] border-2 shadow-[0_0_25px_rgba(88,101,242,0.3)]' 
      : 'border-white/5 hover:border-white/10';

  return (
    <div ref={setNodeRef} style={style} className={`relative w-full h-full rounded-xl overflow-hidden shadow-2xl bg-[#111214] border group/sortable ${dragClass} transition-all duration-200`}>
      {!disableDrag && (
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] sm:w-[240px] h-[14px] bg-[#5865f2]/80 backdrop-blur-sm rounded-b-[8px] cursor-grab active:cursor-grabbing opacity-0 group-hover/sortable:opacity-100 transition-opacity duration-200 z-[60] shadow-lg flex items-center justify-center pointer-events-auto"
          style={{ touchAction: 'none' }}
          {...attributes}
          {...listeners}
        >
          <div className="w-10 h-[3px] bg-white/30 rounded-full" />
        </div>
      )}
      {children}
      {/* Drop zone indicator - only for spotlight mode */}
      {isOver && !isDragging && spotlightMode && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#5865f2]/10 backdrop-blur-[1px] border-2 border-dashed border-[#5865f2]/60 rounded-xl pointer-events-none animate-pulse">
          <div className="flex items-center gap-2 bg-[#5865f2]/90 px-4 py-2 rounded-xl shadow-lg">
            <Layers size={16} className="text-white" />
            <span className="text-white text-xs font-bold">Buraya Taşı</span>
          </div>
        </div>
      )}
      {/* Dragging placeholder indicator - only for spotlight mode */}
      {isDragging && spotlightMode && (
        <div className="absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-[#5865f2]/40 rounded-xl pointer-events-none">
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
            <GripHorizontal size={14} className="text-[#5865f2]/70" />
            <span className="text-[#5865f2]/70 text-[10px] font-semibold">Sürükleniyor...</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Drag overlay preview - rendered in a portal above everything
function DragPreview({ track, size = 'normal' }) {
  if (!track) return null;
  const participant = track.participant;
  const isScreen = track.source === Track.Source.ScreenShare;
  
  const sizes = {
    compact: { width: 220, height: 140 },
    normal: { width: 400, height: 250 },
  };
  const { width, height } = sizes[size] || sizes.normal;
  
  return (
    <div 
      className="rounded-xl overflow-hidden shadow-[0_0_40px_rgba(88,101,242,0.5)] border-2 border-[#5865f2] bg-[#111214] relative cursor-grabbing" 
      style={{ width, height }}
    >
      <VideoTrack
        trackRef={track}
        className="w-full h-full object-cover"
      />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <div className="flex items-center gap-1.5">
          {isScreen ? <Monitor size={12} className="text-[#5865f2]" /> : <Video size={12} className="text-emerald-400" />}
          <span className="text-[11px] font-semibold text-white truncate">
            {participant?.isLocal 
              ? (isScreen ? 'Senin Yayının' : 'Kameran')
              : (participant?.name || participant?.identity || 'Kullanıcı')}
          </span>
        </div>
      </div>
    </div>
  );
}

// --- STREAM CONTEXT MENU ---
function StreamContextMenu({ x, y, onClose, onRemove, onSpotlight, onMoveFirst, onFullscreen, streamName }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const items = [
    { icon: Focus, label: 'Spotlight Yap', onClick: onSpotlight, color: 'text-[#5865f2]' },
    { icon: ArrowUpToLine, label: 'Başa Taşı', onClick: onMoveFirst, color: 'text-white' },
    { icon: Maximize, label: 'Tam Ekran', onClick: onFullscreen, color: 'text-white' },
    { icon: Trash2, label: 'Kaldır', onClick: onRemove, color: 'text-red-400' },
  ];

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] min-w-[180px] bg-[#111214]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      style={{ left: x, top: y }}
    >
      <div className="px-3 py-2 border-b border-white/[0.06]">
        <span className="text-[10px] uppercase tracking-widest text-[#72767d] font-semibold">{streamName}</span>
      </div>
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose(); }}
          className={`w-full px-3 py-2 text-xs font-medium flex items-center gap-2.5 hover:bg-white/[0.06] transition-colors ${item.color}`}
        >
          <item.icon size={14} />
          {item.label}
        </button>
      ))}
    </div>
  );
}

// --- QUALITY BADGE ---
function QualityBadge({ trackRef }) {
  const [quality, setQuality] = useState(null);

  useEffect(() => {
    const track = trackRef?.publication?.track;
    if (!track) return;

    const update = () => {
      const settings = track.mediaStreamTrack?.getSettings?.();
      if (settings?.width && settings?.height) {
        const h = Math.min(settings.width, settings.height);
        const w = Math.max(settings.width, settings.height);
        if (h >= 1080) setQuality({ label: 'FHD', color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' });
        else if (h >= 720) setQuality({ label: 'HD', color: 'text-blue-400 bg-blue-500/15 border-blue-500/30' });
        else if (h >= 480) setQuality({ label: 'SD', color: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30' });
        else setQuality({ label: `${h}p`, color: 'text-red-400 bg-red-500/15 border-red-500/30' });
      }
    };

    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [trackRef]);

  if (!quality) return null;

  return (
    <div className={`absolute top-2 right-2 z-40 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${quality.color}`}>
      {quality.label}
    </div>
  );
}

function StageManager({
  showVoicePanel,
  showChatPanel,
  currentTextChannel,
  chatPosition,
  chatWidth,
  setChatWidth,
  username,
  userId,
  onUserContextMenu,
  pinnedStreamIds,
  setPinnedStreamIds,
  hideIncomingVideo,
  stopScreenShare,
}) {
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);
  const userStoppedWatchingRef = useRef(false); // Kullanıcı manuel olarak izlemeyi durdurdu mu?
  const prevScreenTracksRef = useRef([]); // Önceki screen share track'lerini takip etmek için

  // Resize handler - delay olmadan anında güncelle
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      // Performans için event işleme sırasında geciktirici (throttle vs.) kullanmıyoruz. 
      // Doğrudan state'i güncelliyoruz ki imleci geriden takip etmesin.
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const minWidth = 300; // Minimum chat genişliği
      const maxWidth = containerRect.width * 0.7; // Maksimum %70

      let newWidth;
      if (chatPosition === "right") {
        // Sağdan soldan çek
        newWidth = containerRect.right - e.clientX;
      } else {
        // Soldan sağdan çek
        newWidth = e.clientX - containerRect.left;
      }

      // Sınırları kontrol et
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setChatWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, chatPosition, setChatWidth]);

  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };
  const screenTracks = useTracks([Track.Source.ScreenShare]);
  const cameraTracks = useTracks([Track.Source.Camera]);
  
  const activeTracks = useMemo(() => {
    if (!pinnedStreamIds || pinnedStreamIds.length === 0) return [];
    
    return pinnedStreamIds.flatMap(idWithSource => {
      const tracks = [];
      if (idWithSource.includes(':')) {
        const [identity, source] = idWithSource.split(':');
        if (source === 'screen') {
          const screen = screenTracks.find((t) => t.participant.identity === identity);
          if (screen) tracks.push({ track: screen, pinnedId: idWithSource, id: `${identity}:${source}` });
        } else if (source === 'camera') {
          const camera = cameraTracks.find((t) => t.participant.identity === identity);
          if (camera) tracks.push({ track: camera, pinnedId: idWithSource, id: `${identity}:${source}` });
        }
      } else {
        // Fallback for double-clicking user card without suffix
        const screen = screenTracks.find((t) => t.participant.identity === idWithSource);
        const camera = cameraTracks.find((t) => t.participant.identity === idWithSource);
        
        // If they double clicked, prefer showing screen if they have both.
        // They can manually open camera from the top bar.
        if (screen) tracks.push({ track: screen, pinnedId: idWithSource, id: `${screen.participant.identity}:screen` });
        else if (camera) tracks.push({ track: camera, pinnedId: idWithSource, id: `${camera.participant.identity}:camera` });
      }
      return tracks;
    }).filter(Boolean);
  }, [pinnedStreamIds, screenTracks, cameraTracks]);
  const { localParticipant } = useLocalParticipant();
  const amISharing = localParticipant.isScreenShareEnabled;
  const desktopNotifications = useSettingsStore(state => state.desktopNotifications);
  const notifyOnJoin = useSettingsStore(state => state.notifyOnJoin);

  // 🌈 v5.4 Adaptive Background Logic
  const participants = useParticipants();
  const localIsSpeaking = useSettingsStore(s => s.localIsSpeaking);
  const localProfileColor = useSettingsStore(s => s.profileColor);

  const activeSpeakerColor = useMemo(() => {
    if (localIsSpeaking) return localProfileColor || "#6366f1";
    
    // Remote speaker bul
    const speaker = participants.find(p => p.isSpeaking && !p.isLocal);
    if (!speaker) return null;

    try {
      const meta = speaker.metadata ? JSON.parse(speaker.metadata) : {};
      return meta.profileColor || "#6366f1";
    } catch {
      return "#6366f1";
    }
  }, [participants, localIsSpeaking, localProfileColor]);

  // Yayın açıldığında bildirim göster
  useEffect(() => {
    if (screenTracks.length > prevScreenTracksRef.current.length) {
      // Yeni bir yayın başladı
      const newTracks = screenTracks.filter(
        (t) =>
          !prevScreenTracksRef.current.find(
            (pt) => pt.participant.sid === t.participant.sid
          )
      );

      newTracks.forEach((track) => {
        if (
          !track.participant.isLocal &&
          desktopNotifications &&
          notifyOnJoin
        ) {
          const participantName = track.participant.name || track.participant.identity || "Birisi";
          if (Notification.permission === "granted") {
            const notification = new Notification("Yayın Başladı", {
              body: `${participantName} ekran paylaşımı başlattı`,
              icon: "/favicon.ico",
              tag: `screen-share-${track.participant.sid}`,
            });

            notification.onclick = () => {
              if (window.netrex?.focusWindow) {
                window.netrex.focusWindow();
              } else {
                window.focus();
              }
              notification.close();
            };
          }
        }
      });
    }
    prevScreenTracksRef.current = screenTracks;
  }, [screenTracks, desktopNotifications, notifyOnJoin]);

  // activeStreamId'yi yönet - sadece track değiştiğinde veya track kaybolduğunda güncelle
  // Kullanıcı manuel olarak durdurduğunda (boş array yaptığında) tekrar seçme
  useEffect(() => {
    // Kullanıcı manuel olarak durdurduysa, tekrar otomatik seçme
    if (userStoppedWatchingRef.current && (!pinnedStreamIds || pinnedStreamIds.length === 0)) {
      // Kullanıcı durdurdu, track'ler değişmediyse hiçbir şey yapma
      return;
    }

    // Track kaybolduysa filterla
    if (pinnedStreamIds && pinnedStreamIds.length > 0) {
      const stillActiveIds = pinnedStreamIds.filter(idWithSource => {
        const [identity, source] = idWithSource.includes(':') ? idWithSource.split(':') : [idWithSource, 'any'];
        
        if (source === 'screen') return screenTracks.some(t => t.participant.identity === identity);
        if (source === 'camera') return cameraTracks.some(t => t.participant.identity === identity);
        
        return screenTracks.some(t => t.participant.identity === identity) || cameraTracks.some(t => t.participant.identity === identity);
      });

      // Dedup — aynı id birden fazla kez eklenmişse temizle
      const dedupedIds = [...new Set(stillActiveIds)];

      if (dedupedIds.length !== pinnedStreamIds.length || dedupedIds.some((id, i) => id !== pinnedStreamIds[i])) {
        if (dedupedIds.length === 0) {
          userStoppedWatchingRef.current = false; // Tüm track'ler kayboldu, reset
        }
        setPinnedStreamIds(dedupedIds);
        return;
      }
    }

    // YENİ: Otomatik seçim kaldırıldı - kullanıcılar manuel olarak yayına katılacak
    // Sadece kendi yayınını açan kişi için otomatik olarak kendi yayınını göster
    if (screenTracks.length > 0 && (!pinnedStreamIds || pinnedStreamIds.length === 0)) {
      const myScreenShare = screenTracks.find((t) => t.participant.isLocal);
      if (myScreenShare) {
        const myId = `${myScreenShare.participant.identity}:screen`;
        // Tekrar eklenmesini önle
        if (!pinnedStreamIds || !pinnedStreamIds.includes(myId)) {
          userStoppedWatchingRef.current = false;
          setPinnedStreamIds([myId]);
        }
      }
    }
  }, [screenTracks, cameraTracks, pinnedStreamIds, setPinnedStreamIds]);

  const isLocalSharing = activeTracks.length > 0 && activeTracks[0].track.participant.isLocal;
  const [localPreviewHidden, setLocalPreviewHidden] = useState(false);
  const [layoutMode, setLayoutMode] = useState('grid'); // 'grid' | 'spotlight'
  const [contextMenu, setContextMenu] = useState(null); // { x, y, trackId, pinnedId }
  const [activeDragId, setActiveDragId] = useState(null);
  const activeDragRef = useRef(null); // Store drag start info for modifier
  useEffect(() => {
    if (activeTracks.length === 0) setLocalPreviewHidden(false);
  }, [activeTracks]);
  useEffect(() => {
    if (activeTracks.length <= 1 && layoutMode === 'spotlight') setLayoutMode('grid');
  }, [activeTracks.length, layoutMode]);

  // Track kaybolursa stale drag state'i temizle
  useEffect(() => {
    if (activeDragId && !activeTracks.find(t => t.id === activeDragId)) {
      setActiveDragId(null);
      activeDragRef.current = null;
    }
  }, [activeTracks, activeDragId]);

  // Context menu stale data — track kaybolursa kapat
  useEffect(() => {
    if (contextMenu && !activeTracks.find(t => t.id === contextMenu.trackId)) {
      setContextMenu(null);
    }
  }, [activeTracks, contextMenu]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px hareket etmeden drag başlamasın (click ile drag karışmasın)
      },
    })
  );

  const handleDragStart = (event) => {
    setActiveDragId(event.active.id);
    // Store the original node rect for the modifier
    const node = event.active.rect.current.translated || event.active.rect.current.initial;
    if (node && event.activatorEvent) {
      activeDragRef.current = {
        offsetX: event.activatorEvent.clientX - node.left,
        offsetY: event.activatorEvent.clientY - node.top,
        origWidth: node.width,
        origHeight: node.height,
      };
    }
  };

  const handleDragEnd = (event) => {
    setActiveDragId(null);
    activeDragRef.current = null;
    const { active, over } = event;
    if (!over) return;

    if (active.id !== over.id) {
      setPinnedStreamIds((items) => {
        const activeItem = activeTracks.find(t => t.id === active.id);
        const overItem = activeTracks.find(t => t.id === over.id);
        if (!activeItem || !overItem) return items;

        const oldIndex = items.indexOf(activeItem.pinnedId);
        let newIndex = items.indexOf(overItem.pinnedId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
            return arrayMove(items, oldIndex, newIndex);
        }
        return items;
      });
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 flex overflow-hidden min-h-0 relative bg-gradient-to-br from-[#1a1b1f] via-[#141518] to-[#0e0f12]"
    >
      <MemoizedStageBackground 
        disableBackgroundEffects={useSettingsStore.getState().disableBackgroundEffects} 
        activeSpeakerColor={activeSpeakerColor}
      />
      {showVoicePanel && (
        <div
          className={`flex-1 ${activeTracks.length > 0 ? "overflow-hidden" : "overflow-y-auto custom-scrollbar"} min-w-0 flex flex-col transition-all duration-300 ease-in-out ${
            showChatPanel && currentTextChannel
              ? chatPosition === "left"
              ? "order-2"
              : "order-1"
              : ""
          }`}
          style={{
            width:
              showChatPanel && currentTextChannel
                ? `calc(100% - ${chatWidth}px - 4px)`
                : "100%",
            flexShrink: 1,
          }}
        >
          {(screenTracks.length > 0 || cameraTracks.length > 0) && activeTracks.length > 0 && (
            <div className="bg-gradient-to-r from-[#1a1b1f] via-[#1e1f23] to-[#1a1b1f] px-3 py-2 flex items-center gap-3 overflow-x-auto border-b border-white/[0.06] shrink-0 custom-scrollbar">
              {/* Yayınlar Bölümü */}
              {screenTracks.length > 0 && (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#72767d] font-semibold mr-1 select-none">
                    <Monitor size={10} className="opacity-60" />
                    Yayınlar
                  </div>
                  {screenTracks.map((t) => {
                    const targetId = `${t.participant.identity}:screen`;
                    const isPinned = pinnedStreamIds?.includes(targetId) || pinnedStreamIds?.includes(t.participant.identity);
                    return (
                      <button
                        key={`screen-${t.participant.sid}`}
                        onClick={() => {
                          setPinnedStreamIds(prev => {
                            const newArr = (prev || []).filter(id => id !== t.participant.identity && id !== targetId);
                            if (!isPinned) newArr.push(targetId);
                            return newArr;
                          });
                          setLocalPreviewHidden(false);
                        }}
                        className={`group/btn relative px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all duration-200 border ${
                          isPinned
                            ? "bg-[#5865f2]/20 text-[#8b9cff] border-[#5865f2]/40 shadow-[0_0_12px_rgba(88,101,242,0.15)]"
                            : "bg-white/[0.04] text-[#949ba4] border-white/[0.06] hover:bg-white/[0.08] hover:text-white hover:border-white/[0.12]"
                        }`}
                      >
                        <div className="relative">
                          <Monitor size={13} className={isPinned ? "text-[#5865f2]" : ""} />
                          <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${isPinned ? 'bg-red-500' : 'bg-emerald-500'} animate-pulse`} />
                        </div>
                        <span className="whitespace-nowrap">
                          {t.participant.isLocal ? "Senin Yayının" : (t.participant.name || t.participant.identity)}
                        </span>
                        {isPinned && (
                          <div className="w-4 h-4 rounded-full bg-[#5865f2]/30 flex items-center justify-center ml-0.5">
                            <Eye size={9} className="text-[#5865f2]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Ayırıcı */}
              {screenTracks.length > 0 && cameraTracks.length > 0 && (
                <div className="w-px h-5 bg-white/[0.08] shrink-0" />
              )}

              {/* Kameralar Bölümü */}
              {cameraTracks.length > 0 && (
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#72767d] font-semibold mr-1 select-none">
                    <Video size={10} className="opacity-60" />
                    Kameralar
                  </div>
                  {cameraTracks.map((t) => {
                    const targetId = `${t.participant.identity}:camera`;
                    const isPinned = pinnedStreamIds?.includes(targetId);
                    return (
                      <button
                        key={`camera-${t.participant.sid}`}
                        onClick={() => {
                          setPinnedStreamIds(prev => {
                            const newArr = (prev || []).filter(id => id !== targetId);
                            if (!isPinned) newArr.push(targetId);
                            return newArr;
                          });
                          setLocalPreviewHidden(false);
                        }}
                        className={`group/btn relative px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all duration-200 border ${
                          isPinned
                            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.12)]"
                            : "bg-white/[0.04] text-[#949ba4] border-white/[0.06] hover:bg-white/[0.08] hover:text-white hover:border-white/[0.12]"
                        }`}
                      >
                        <div className="relative">
                          <Video size={13} className={isPinned ? "text-emerald-400" : ""} />
                          <div className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ${isPinned ? 'animate-pulse' : 'opacity-60'}`} />
                        </div>
                        <span className="whitespace-nowrap">
                          {t.participant.isLocal ? "Kameran" : `${t.participant.name || t.participant.identity}`}
                        </span>
                        {isPinned && (
                          <div className="w-4 h-4 rounded-full bg-emerald-500/20 flex items-center justify-center ml-0.5">
                            <Eye size={9} className="text-emerald-400" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Tümünü Kaldır */}
              {pinnedStreamIds?.length > 1 && (
                <button
                  onClick={() => setPinnedStreamIds([])}
                  className="ml-auto shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-red-400/70 hover:text-red-400 bg-red-500/[0.06] hover:bg-red-500/[0.12] border border-red-500/[0.1] hover:border-red-500/[0.2] transition-all duration-200"
                >
                  Tümünü Kaldır
                </button>
              )}
            </div>
          )}
          {/* Layout Mode Toggle */}
          {activeTracks.length > 1 && (
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.04] bg-[#111214]/50 shrink-0">
              <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
                <button
                  onClick={() => setLayoutMode('grid')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 ${
                    layoutMode === 'grid' 
                      ? 'bg-[#5865f2] text-white shadow-lg shadow-[#5865f2]/25' 
                      : 'text-[#949ba4] hover:text-white hover:bg-white/[0.06]'
                  }`}
                  title="Grid Görünümü"
                >
                  <LayoutGrid size={13} />
                  <span>Grid</span>
                </button>
                <button
                  onClick={() => setLayoutMode('spotlight')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 ${
                    layoutMode === 'spotlight' 
                      ? 'bg-[#5865f2] text-white shadow-lg shadow-[#5865f2]/25' 
                      : 'text-[#949ba4] hover:text-white hover:bg-white/[0.06]'
                  }`}
                  title="Spotlight Görünümü"
                >
                  <Focus size={13} />
                  <span>Spotlight</span>
                </button>
              </div>
              <span className="text-[9px] text-[#4e5058] select-none hidden sm:inline">
                {activeTracks.length} yayın aktif
              </span>
            </div>
          )}
          {activeTracks.length > 0 ? (
            <div className="flex-1 min-h-0 relative bg-black/40 overflow-hidden">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                {layoutMode === 'spotlight' && activeTracks.length > 1 ? (
                  /* ===== SPOTLIGHT MODE ===== */
                  <div className="absolute inset-0 p-2" style={{ display: 'grid', gridTemplateRows: '1fr auto', gap: '8px' }}>
                    <SortableContext items={activeTracks.map(t => t.id)} strategy={rectSortingStrategy}>
                      {/* Main spotlight stream (first in the array) */}
                      {(() => {
                        const { track, id, pinnedId } = activeTracks[0];
                        const isLocal = track.participant.isLocal;
                        return (
                          <div className="relative min-h-0">
                            <SortableTrackItem key={id} id={id} spotlightMode disableDrag>
                              <QualityBadge trackRef={track} />
                              <div
                                className="absolute inset-0 z-30"
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setContextMenu({ x: e.clientX, y: e.clientY, trackId: id, pinnedId, track });
                                }}
                              />
                              {isLocal && localPreviewHidden && track.source !== Track.Source.Camera ? (
                                <LocalHiddenPlaceholder
                                  onShow={() => setLocalPreviewHidden(false)}
                                  onStopSharing={async () => { if (stopScreenShare) await stopScreenShare(); }}
                                />
                              ) : (
                                <ScreenShareStage
                                  trackRef={track}
                                  onStopWatching={() => {
                                    userStoppedWatchingRef.current = true;
                                    setPinnedStreamIds(prev => prev.filter(streamId => streamId !== `${track.participant.identity}:${track.source === Track.Source.Camera ? 'camera' : 'screen'}` && streamId !== track.participant.identity));
                                  }}
                                  onUserContextMenu={onUserContextMenu}
                                  isLocalSharing={isLocal}
                                  amISharing={amISharing}
                                  onHideLocal={() => setLocalPreviewHidden(true)}
                                  setPinnedStreamIds={setPinnedStreamIds}
                                  pinnedStreamIds={pinnedStreamIds}
                                />
                              )}
                            </SortableTrackItem>
                          </div>
                        );
                      })()}

                      {/* Thumbnail strip */}
                      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1" style={{ height: '140px', minHeight: '140px' }}>
                        {activeTracks.slice(1).map(({ track, id, pinnedId }) => {
                          const isLocal = track.participant.isLocal;
                          return (
                            <div key={id} className="relative shrink-0 h-full rounded-xl" style={{ width: '220px', minWidth: '220px' }}>
                              <SortableTrackItem id={id} spotlightMode>
                                <QualityBadge trackRef={track} />
                                <div
                                  className="absolute inset-0 z-30"
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    setContextMenu({ x: e.clientX, y: e.clientY, trackId: id, pinnedId, track });
                                  }}
                                  onDoubleClick={() => {
                                    setPinnedStreamIds(prev => {
                                      const idx = prev.indexOf(pinnedId);
                                      if (idx > 0) return [pinnedId, ...prev.filter(p => p !== pinnedId)];
                                      return prev;
                                    });
                                  }}
                                />
                                {isLocal && localPreviewHidden && track.source !== Track.Source.Camera ? (
                                  <LocalHiddenPlaceholder
                                    onShow={() => setLocalPreviewHidden(false)}
                                    onStopSharing={async () => { if (stopScreenShare) await stopScreenShare(); }}
                                  />
                                ) : (
                                  <ScreenShareStage
                                    trackRef={track}
                                    compact={true}
                                    onStopWatching={() => {
                                      userStoppedWatchingRef.current = true;
                                      setPinnedStreamIds(prev => prev.filter(streamId => streamId !== `${track.participant.identity}:${track.source === Track.Source.Camera ? 'camera' : 'screen'}` && streamId !== track.participant.identity));
                                    }}
                                    onUserContextMenu={onUserContextMenu}
                                    isLocalSharing={isLocal}
                                    amISharing={amISharing}
                                    onHideLocal={() => setLocalPreviewHidden(true)}
                                    setPinnedStreamIds={setPinnedStreamIds}
                                    pinnedStreamIds={pinnedStreamIds}
                                  />
                                )}
                              </SortableTrackItem>
                            </div>
                          );
                        })}
                      </div>
                    </SortableContext>
                  </div>
                ) : (
                  /* ===== GRID MODE ===== */
                  <div className={`absolute inset-0 p-2 grid gap-2 ${
                    activeTracks.length === 1 ? 'grid-cols-1 grid-rows-1' :
                    activeTracks.length === 2 ? 'grid-cols-1 md:grid-cols-2 grid-rows-2 md:grid-rows-1' :
                    activeTracks.length <= 4 ? 'grid-cols-2 grid-rows-2' :
                    activeTracks.length <= 6 ? 'grid-cols-2 lg:grid-cols-3 grid-rows-3 lg:grid-rows-2' :
                    'grid-cols-3 lg:grid-cols-4 grid-rows-auto'
                  } ${activeTracks.length > 4 ? 'overflow-y-auto custom-scrollbar' : 'overflow-hidden'}`}>
                    <SortableContext items={activeTracks.map(t => t.id)} strategy={rectSortingStrategy}>
                      {activeTracks.map(({ track, id, pinnedId }) => {
                        const isLocal = track.participant.isLocal;
                        return (
                          <SortableTrackItem key={id} id={id} disableDrag={activeTracks.length <= 1}>
                            <QualityBadge trackRef={track} />
                            <div
                              className="absolute inset-0 z-30"
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setContextMenu({ x: e.clientX, y: e.clientY, trackId: id, pinnedId, track });
                              }}
                            />
                            {isLocal && localPreviewHidden && track.source !== Track.Source.Camera ? (
                              <LocalHiddenPlaceholder
                                onShow={() => setLocalPreviewHidden(false)}
                                onStopSharing={async () => {
                                  if (stopScreenShare) {
                                    await stopScreenShare();
                                  }
                                }}
                              />
                            ) : (
                              <ScreenShareStage
                                trackRef={track}
                                onStopWatching={() => {
                                  userStoppedWatchingRef.current = true;
                                  setPinnedStreamIds(prev => prev.filter(streamId => streamId !== `${track.participant.identity}:${track.source === Track.Source.Camera ? 'camera' : 'screen'}` && streamId !== track.participant.identity));
                                }}
                                onUserContextMenu={onUserContextMenu}
                                isLocalSharing={isLocal}
                                amISharing={amISharing}
                                onHideLocal={() => setLocalPreviewHidden(true)}
                                setPinnedStreamIds={setPinnedStreamIds}
                                pinnedStreamIds={pinnedStreamIds}
                              />
                            )}
                          </SortableTrackItem>
                        );
                      })}
                    </SortableContext>
                  </div>
                )}

                <DragOverlay dropAnimation={null}>
                  {activeDragId && layoutMode === 'spotlight' ? (() => {
                    const draggedItem = activeTracks.find(t => t.id === activeDragId);
                    if (!draggedItem) return null;
                    return <DragPreview track={draggedItem.track} size="compact" />;
                  })() : null}
                </DragOverlay>
              </DndContext>

              {/* Context Menu */}
              {contextMenu && (
                <StreamContextMenu
                  x={contextMenu.x}
                  y={contextMenu.y}
                  streamName={
                    contextMenu.track?.participant?.isLocal
                      ? (contextMenu.trackId.includes(':camera') ? 'Kameran' : 'Senin Yayının')
                      : `${contextMenu.track?.participant?.name || contextMenu.track?.participant?.identity || 'Stream'}`
                  }
                  onClose={() => setContextMenu(null)}
                  onRemove={() => {
                    userStoppedWatchingRef.current = true;
                    setPinnedStreamIds(prev => prev.filter(id => id !== contextMenu.pinnedId));
                  }}
                  onSpotlight={() => {
                    setLayoutMode('spotlight');
                    setPinnedStreamIds(prev => {
                      const idx = prev.indexOf(contextMenu.pinnedId);
                      if (idx > 0) return [contextMenu.pinnedId, ...prev.filter(p => p !== contextMenu.pinnedId)];
                      return prev;
                    });
                  }}
                  onMoveFirst={() => {
                    setPinnedStreamIds(prev => {
                      const idx = prev.indexOf(contextMenu.pinnedId);
                      if (idx > 0) return [contextMenu.pinnedId, ...prev.filter(p => p !== contextMenu.pinnedId)];
                      return prev;
                    });
                  }}
                  onFullscreen={() => {
                    // Focus only this stream
                    setPinnedStreamIds([contextMenu.pinnedId]);
                  }}
                />
              )}
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 relative transition-all duration-300 ease-in-out" style={{ opacity: 1, transform: 'scale(1)' }}>
              <ParticipantList
                onUserContextMenu={onUserContextMenu}
                compact={false}
                hideIncomingVideo={hideIncomingVideo}
                setPinnedStreamIds={setPinnedStreamIds}
                pinnedStreamIds={pinnedStreamIds}
              />
            </div>
          )}
        </div>
      )}
      {/* Chat Panel - Always rendered, animated with transform */}
      <div
        className={`overflow-hidden border-[#26272d] bg-[#313338] flex flex-col min-w-0 shadow-xl z-10 transition-all duration-300 ease-in-out ${
          chatPosition === "left" ? "order-1 border-r" : "order-2 border-l"
        } ${
          showChatPanel && currentTextChannel
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
        }`}
        style={{
          width: showChatPanel && currentTextChannel ? `${chatWidth}px` : "0px",
          flexShrink: 0,
          transform: showChatPanel && currentTextChannel 
            ? "translateX(0)" 
            : chatPosition === "left" 
              ? "translateX(-20px)" 
              : "translateX(20px)",
        }}
      >
        {currentTextChannel && (
          <>
            {/* Resizable Divider */}
            {showVoicePanel && showChatPanel && (
              <div
                onMouseDown={handleResizeStart}
                className={`absolute ${chatPosition === "left" ? "right-0" : "left-0"} top-0 bottom-0 w-1 bg-[#26272d] hover:bg-[#5865f2] cursor-col-resize transition-colors z-20 ${
                  isResizing ? "bg-[#5865f2]" : ""
                }`}
                style={{ userSelect: "none" }}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-0.5 h-12 bg-[#5865f2] rounded-full opacity-0 hover:opacity-100 transition-opacity"></div>
                </div>
              </div>
            )}
            <ChatView
              channelId={currentTextChannel}
              username={username}
              userId={userId}
            />
          </>
        )}
      </div>
      {!showVoicePanel && (!showChatPanel || !currentTextChannel) && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-[#313338]">
          <Users size={32} className="opacity-50 mb-4" />
          <p>Görünüm gizli.</p>
        </div>
      )}
    </div>
  );
}

function LocalHiddenPlaceholder({ onShow, onStopSharing }) {
  return (
    <div className="flex flex-col h-full w-full bg-[#313338] items-center justify-center p-8 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-[#313338] to-[#313338]"></div>
      <div className="z-10 flex flex-col items-center animate-in fade-in zoom-in duration-300">
        <div className="w-28 h-28 glass-strong rounded-full flex items-center justify-center mb-6 shadow-xl border border-white/10 backdrop-blur-xl relative">
          <EyeOff size={44} className="text-[#949ba4]" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/5 to-transparent"></div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">
          Önizleme Gizlendi
        </h2>
        <p className="text-gray-400 text-sm max-w-sm mb-10 leading-relaxed">
          Yayının devam ediyor. Performansı artırmak ve ayna etkisini önlemek
          için önizlemeyi kapattın.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onShow}
            className="glass-strong hover:glass border border-white/10 hover:border-white/20 text-white px-6 py-3 rounded-xl font-semibold shadow-soft-lg transition-all duration-200 flex items-center gap-2.5 hover:scale-105 hover:shadow-glow backdrop-blur-xl group"
          >
            <Eye
              size={18}
              className="group-hover:scale-110 transition-transform"
            />
            <span>Önizlemeyi Aç</span>
          </button>
          <button
            onClick={onStopSharing}
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-3 rounded-xl font-semibold shadow-soft-lg transition-all duration-200 flex items-center gap-2.5 hover:scale-105 hover:shadow-glow-red border border-red-500/30 group"
          >
            <StopCircle
              size={18}
              className="group-hover:scale-110 transition-transform"
            />
            <span>Yayını Durdur</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// --- STAGE OVERLAY COMPONENTS ---
const StageOverlay = React.memo(({ showOverlay, showCursor, isLocalSharing, isAudioDisabled, volume, isFullscreen, viewerCount, participant, trackRef, onStopWatching, onHideLocal, toggleMuteStream, toggleFullscreen, setVolume, compact }) => {
  // COMPACT MODE: thumbnail'larda sadece küçük bir isim badge'i göster
  if (compact) {
    return (
      <>
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between z-50 pointer-events-none">
          <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md border border-white/[0.08]">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-semibold text-white/80 truncate max-w-[100px]">
              {isLocalSharing
                ? (trackRef.source === Track.Source.Camera ? 'Kameran' : 'Yayının')
                : (participant?.name || participant?.identity || 'Kullanıcı')}
            </span>
          </div>
          <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md border border-white/[0.08]">
            <Users size={9} className="text-indigo-400" />
            <span className="text-[9px] font-bold text-white/80">{viewerCount}</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Overlay Gradients - Top and Bottom only (Center remains clear) */}
      <div
        className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-500 pointer-events-none will-change-opacity ${
          showOverlay ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-500 pointer-events-none will-change-opacity ${
          showOverlay ? "opacity-100" : "opacity-60"
        }`}
      />

      {/* Top Bar - Premium Design */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-4 sm:p-6 z-50 pointer-events-none">
        <div
          className={`flex items-center gap-2 sm:gap-3 backdrop-blur-md bg-white/[0.08] px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border border-white/[0.12] shadow-xl transition-all duration-500 pointer-events-auto hover:scale-105 will-change-transform ${
            showOverlay ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-red-500 rounded-xl blur-md opacity-75 animate-pulse" />
            <div className="relative bg-red-500 px-2.5 sm:px-3 py-1 rounded-xl text-[10px] sm:text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              Canlı
            </div>
          </div>
          <span className="text-white font-bold drop-shadow-lg text-sm sm:text-base tracking-tight">
            {isLocalSharing
              ? "Senin Yayının"
              : trackRef.source === Track.Source.ScreenShare
              ? `${participant?.name || participant?.identity || "Kullanıcı"} yayını`
              : `${participant?.name || participant?.identity || "Kullanıcı"} kamerası`}
          </span>
        </div>
        <div className="flex gap-2 pointer-events-auto">
          {isLocalSharing && (
            <button
              onClick={onHideLocal}
              className={`backdrop-blur-md bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-white/70 hover:text-white p-2 sm:p-2.5 rounded-2xl transition-all duration-200 hover:scale-110 will-change-transform ${
                showOverlay ? "opacity-100" : "opacity-0"
              }`}
            >
              <EyeOff size={18} />
            </button>
          )}
          <button
            onClick={onStopWatching}
            className={`backdrop-blur-md bg-white/[0.06] hover:bg-red-500/20 border border-white/[0.12] text-white/70 hover:text-red-400 p-2 sm:p-2.5 rounded-2xl transition-all duration-200 hover:scale-110 will-change-transform ${
              showOverlay ? "opacity-100" : "opacity-0"
            }`}
          >
            <Minimize size={18} />
          </button>
        </div>
      </div>

      {/* Bottom Controls - ALWAYS VISIBLE */}
      <div
        className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6 pointer-events-none will-change-opacity"
      >
        <div className="pointer-events-auto flex justify-between items-end gap-4">
          <div className="flex items-center gap-2 bg-[#2b2d31]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 shadow-soft">
            <Users size={14} className="text-indigo-400" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#949ba4] font-medium">İzleyici</span>
              <span className="text-xs font-bold text-white">{viewerCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isLocalSharing && (
              <div className="flex items-center gap-3">
                {isAudioDisabled ? (
                  <div className="flex items-center gap-2 text-yellow-400 text-xs font-bold px-3 py-1.5 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                    <AlertTriangle size={18} />
                    <span>Ses Kapalı</span>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={toggleMuteStream}
                      className={`p-2 rounded-xl transition-all duration-200 hover:scale-110 border border-white/10 backdrop-blur-sm bg-black/30 ${
                        volume === 0 ? "text-red-400" : "text-white"
                      }`}
                    >
                      {volume === 0 ? <VolumeX size={18} /> : volume < 50 ? <Volume1 size={18} /> : <Volume2 size={18} />}
                    </button>
                    <div className="flex items-center bg-black/30 backdrop-blur-sm rounded-xl border border-white/10 px-2">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className="w-20 sm:w-28 accent-[#5865f2]"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
            <button
              onClick={toggleFullscreen}
              className="p-2.5 rounded-xl border border-white/10 text-white hover:bg-indigo-500/20 transition-all duration-200 hover:scale-110 backdrop-blur-sm"
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
});

function ScreenShareStage({
  trackRef,
  onStopWatching,
  onUserContextMenu,
  isLocalSharing,
  onHideLocal,
  amISharing,
  setPinnedStreamIds,
  pinnedStreamIds,
  compact = false,
}) {
  const disableBackgroundEffects = useSettingsStore(state => state.disableBackgroundEffects);
  const cameraMirrorEffect = useSettingsStore(state => state.cameraMirrorEffect);
  
  const [volume, setVolume] = useState(50);
  const [prevVolume, setPrevVolume] = useState(50);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const containerRef = useRef(null);
  const audioRef = useRef(null);
  const mouseMoveTimeoutRef = useRef(null);
  const cursorTimeoutRef = useRef(null);


  const participants = useParticipants();
  const participant = trackRef?.participant;
  
  // Custom logic to calculate viewerCount based on metadata watchingStreamId
  const viewerCount = useMemo(() => {
    if (!participant) return 0;
    
    return participants.filter(p => {
      // Streamer'ın kendisini sayma
      if (p.identity === participant.identity) return false;
      try {
        const meta = p.metadata ? JSON.parse(p.metadata) : {};
        return meta.watchingStreamId === participant.identity;
      } catch (e) {
        return false;
      }
    }).length;
  }, [participants, participant]);
  const audioTracks = useTracks([Track.Source.ScreenShareAudio]);
  const cameraTracks = useTracks([Track.Source.Camera]);
  const audioTrackRef = audioTracks.find(
    (t) => t.participant.sid === participant?.sid
  );
  const isAudioDisabled = amISharing && !isLocalSharing;

  useEffect(() => {
    if (audioTrackRef?.publication?.track && audioRef.current) {
      audioTrackRef.publication.track.attach(audioRef.current);
    }
    return () => {
      if (audioTrackRef?.publication?.track && audioRef.current) {
        audioTrackRef.publication.track.detach(audioRef.current);
      }
    };
  }, [audioTrackRef]);

  useEffect(() => {
    if (audioRef.current) {
      // Agresif ses kapatma: tüm yöntemleri kullan
      if (volume === 0) {
        // 1. Audio element'i mute et
        audioRef.current.muted = true;
        // 2. Volume'u 0 yap
        audioRef.current.volume = 0;
        // 3. Audio element'i devre dışı bırak (ekstra güvenlik)
        audioRef.current.pause();
        // 4. Track'in mediaStreamTrack'ini de mute et (eğer varsa)
        if (audioTrackRef?.publication?.track?.mediaStreamTrack) {
          audioTrackRef.publication.track.mediaStreamTrack.enabled = false;
        }
      } else {
        // Ses açıldığında tüm kontrolleri geri al
        audioRef.current.muted = false;
        // Logaritmik (exponential) mapping: ses algısı logaritmik olduğu için
        // Linear mapping yerine exponential kullanıyoruz
        // Formül:
        // - 0-100%: volume = (percent/100)^2.5 (daha hassas düşük ses kontrolü)
        // - 100-200%: volume = 1.0 - (200-percent)/100 * 0.2 (100%'den 200%'e yumuşak artış, max 1.0)
        // NOT: HTMLMediaElement volume 0-1 aralığında olmalı, bu yüzden 1.0 ile sınırlıyoruz
        // %100-200 arası için daha hassas kontrol sağlamak için exponential mapping kullanıyoruz
        // 100% = 1.0, 150% = 0.9, 200% = 0.8 (daha yumuşak eğri)
        const mappedVolume =
          volume === 0
            ? 0
            : volume <= 100
            ? Math.pow(volume / 100, 2.5) // 0-100% arası için exponential
            : Math.min(1.0 - ((200 - volume) / 100) * 0.2, 1.0); // 100-200% arası için yumuşak artış, ama max 1.0 (HTMLMediaElement limiti)
        audioRef.current.volume = mappedVolume;
        audioRef.current.play().catch(() => {}); // AutoPlay policy nedeniyle hata olabilir, yoksay
        // Track'i tekrar aktif et
        if (audioTrackRef?.publication?.track?.mediaStreamTrack) {
          audioTrackRef.publication.track.mediaStreamTrack.enabled = true;
        }
      }
    }
  }, [volume, audioTrackRef]);

  const toggleMuteStream = () => {
    if (isAudioDisabled) return;
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      setVolume(prevVolume > 0 ? prevVolume : 50);
    }
  };
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Mouse movement tracking - overlay ve cursor kontrolü
  // 🚀 OPTIMIZATION: Throttle eklendi
  const lastOverlayMouseMoveRef = useRef(0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = () => {
      // 🚀 THROTTLE: 200ms aralıklarla işle (CPU Optimizasyonu v5.3)
      const now = Date.now();
      if (now - lastOverlayMouseMoveRef.current < 200) return;
      lastOverlayMouseMoveRef.current = now;

      // Overlay'i göster
      setShowOverlay(true);
      setShowCursor(true);

      // Önceki timeout'ları temizle
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current);
      }
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }

      // 2 saniye hareketsizlikten sonra overlay'i gizle
      mouseMoveTimeoutRef.current = setTimeout(() => {
        setShowOverlay(false);
      }, 2000);

      // 2 saniye hareketsizlikten sonra cursor'u gizle
      cursorTimeoutRef.current = setTimeout(() => {
        setShowCursor(false);
      }, 800);
    };

    const handleMouseEnter = () => {
      setShowOverlay(true);
      setShowCursor(true);
    };

    container.addEventListener("mousemove", handleMouseMove, { passive: true });
    container.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseenter", handleMouseEnter);
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current);
      }
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={`flex flex-col h-full w-full bg-gradient-to-br from-[#1a1b1f] via-[#141518] to-[#0e0f12] relative overflow-hidden`}>
      {/* Ambient background orbs - only in non-compact mode */}
      {!compact && !disableBackgroundEffects && (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/[0.04] rounded-full blur-[60px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/[0.03] rounded-full blur-[50px] animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>
      )}

      <div
        ref={containerRef}
        onDoubleClick={onStopWatching}
        className={`flex-1 relative flex items-center justify-center overflow-hidden ${
          !showCursor ? "cursor-none" : ""
        }`}
        style={{ cursor: showCursor ? "default" : "none" }}
      >
        <VideoTrack
          key={trackRef?.participant?.identity || trackRef?.publication?.trackSid || 'video-track'}
          trackRef={trackRef}
          className="max-w-full max-h-full object-contain shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          style={{
            // Kamera track'i için ayna efekti uygula (sadece local participant ve kamera için)
            transform: trackRef.source === Track.Source.Camera && trackRef.participant?.isLocal && cameraMirrorEffect 
              ? 'scaleX(-1)' 
              : undefined,
          }}
        />
        {!isLocalSharing && trackRef.source === Track.Source.ScreenShare && <audio ref={audioRef} autoPlay />}

        <StageOverlay 
            showOverlay={showOverlay}
            showCursor={showCursor}
            isLocalSharing={isLocalSharing}
            isAudioDisabled={isAudioDisabled}
            volume={volume}
            isFullscreen={isFullscreen}
            viewerCount={viewerCount}
            participant={participant}
            trackRef={trackRef}
            onStopWatching={onStopWatching}
            onHideLocal={onHideLocal}
            toggleMuteStream={toggleMuteStream}
            toggleFullscreen={toggleFullscreen}
            setVolume={setVolume}
            compact={compact}
        />
      </div>
    </div>
  );
}

export default StageManager;
