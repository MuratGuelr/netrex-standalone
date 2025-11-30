"use client";
import { useEffect, useState, useRef } from "react";
import { useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import { useChatStore } from "@/src/store/chatStore";
import {
  Send,
  Trash2,
  Copy,
  AlertTriangle,
  PlusCircle,
  Gift,
  Sticker,
  Smile,
  Hash,
} from "lucide-react";

export default function ChatView({ channelId, username, userId }) {
  const {
    messages,
    loadChannelMessages,
    sendMessage,
    addIncomingMessage,
    deleteMessage,
    currentChannel,
  } = useChatStore();

  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [linkModal, setLinkModal] = useState({ isOpen: false, url: "" });

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const room = useRoomContext();
  const containerRef = useRef(null);

  useEffect(() => {
    if (channelId) loadChannelMessages(channelId);
  }, [channelId]);

  useEffect(() => {
    if (!room) return;
    const handleDataReceived = (payload, participant, kind, topic) => {
      if (topic !== "chat") return;
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));
        if (data.type === "chat" && data.channelId === channelId) {
          if (data.message.userId !== userId) addIncomingMessage(data.message);
        }
      } catch (error) {
        console.error("Error parsing chat message:", error);
      }
    };
    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => room.off(RoomEvent.DataReceived, handleDataReceived);
  }, [room, channelId, userId, addIncomingMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [channelId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || isSending) return;

    const textToSend = messageInput;
    setMessageInput("");
    setIsSending(true);

    await sendMessage(channelId, textToSend, userId, username, room);

    setIsSending(false);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    setContextMenu({ x: e.pageX, y: e.pageY, message: msg });
  };

  const handleCopyText = () => {
    if (contextMenu?.message?.text)
      navigator.clipboard.writeText(contextMenu.message.text);
    setContextMenu(null);
  };

  const handleDeleteMsg = async () => {
    if (contextMenu?.message)
      await deleteMessage(channelId, contextMenu.message.id);
    setContextMenu(null);
  };

  const openLinkModal = (e, url) => {
    e.preventDefault();
    setLinkModal({ isOpen: true, url });
  };

  const confirmOpenLink = () => {
    if (linkModal.url) {
      if (window.netrex && window.netrex.openExternalLink) {
        window.netrex.openExternalLink(linkModal.url);
      } else {
        window.open(linkModal.url, "_blank");
      }
    }
    setLinkModal({ isOpen: false, url: "" });
  };

  const renderMessageText = (text) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        const fullUrl = part;
        const displayText =
          fullUrl.length > 50 ? fullUrl.substring(0, 50) + "..." : fullUrl;
        return (
          <a
            key={index}
            href={fullUrl}
            onClick={(e) => openLinkModal(e, fullUrl)}
            className="text-[#00a8fc] hover:underline cursor-pointer break-all font-medium"
            title={fullUrl}
          >
            {displayText}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateHeader = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="flex flex-col bg-[#313338] h-full w-full relative">
      {/* Mesaj Alanı */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0 px-4"
      >
        {messages.length === 0 ? (
          /* BOŞ KANAL KARŞILAMA EKRANI */
          <div className="flex-1 flex flex-col justify-end pb-8 select-none animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-[#41434a] rounded-full flex items-center justify-center mb-6 shadow-lg">
              <Hash size={40} className="text-white" />
            </div>
            <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">
              {currentChannel?.name || "sohbet"} kanalına hoş geldin!
            </h1>
            <p className="text-[#b5bac1] text-base max-w-md">
              Bu kanalın başlangıcı. Arkadaşlarına bir "Merhaba" diyerek sohbeti
              başlatabilirsin.
            </p>
          </div>
        ) : (
          <div className="flex flex-col justify-end min-h-0 pb-4 pt-6">
            {messages.map((message, index) => {
              const prevMessage = messages[index - 1];
              // 5 dakikadan az süre ve aynı kullanıcı ise birleşik mesaj say
              const isSequence =
                prevMessage &&
                prevMessage.userId === message.userId &&
                message.timestamp - prevMessage.timestamp < 300000;
              const showDateSeparator =
                !prevMessage ||
                new Date(message.timestamp).toDateString() !==
                  new Date(prevMessage.timestamp).toDateString();

              return (
                <div key={message.id}>
                  {/* TARİH AYIRICI */}
                  {showDateSeparator && (
                    <div className="relative flex items-center justify-center my-6 select-none group">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-[#3f4147]"></div>
                      </div>
                      <span className="relative bg-[#313338] px-2 text-[12px] font-semibold text-[#949ba4] group-hover:text-[#dbdee1] transition-colors">
                        {formatDateHeader(message.timestamp)}
                      </span>
                    </div>
                  )}

                  {/* MESAJ KARTI */}
                  <div
                    className={`
                      group flex pr-4 pl-[72px] relative w-full
                      ${!isSequence ? "mt-[17px]" : "mt-[2px]"}
                      hover:bg-[#2e3035]/60 -mx-4 px-4 py-0.5 transition-colors duration-75
                    `}
                    onContextMenu={(e) => handleContextMenu(e, message)}
                  >
                    {/* SOL TARA: AVATAR VEYA SAAT */}
                    <div className="absolute left-4 w-[50px] flex justify-start select-none">
                      {!isSequence || showDateSeparator ? (
                        <div className="w-10 h-10 rounded-full bg-indigo-500 hover:shadow-md cursor-pointer overflow-hidden mt-0.5 flex items-center justify-center text-white font-bold text-lg transition-transform hover:scale-105 active:scale-95">
                          {message.username?.charAt(0).toUpperCase()}
                        </div>
                      ) : (
                        <span className="text-[10px] text-[#949ba4] hidden group-hover:inline-block w-full text-left pl-2 mt-1.5 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                          {formatTime(message.timestamp)}
                        </span>
                      )}
                    </div>

                    {/* SAĞ TARA: İÇERİK */}
                    <div className="flex-1 min-w-0">
                      {(!isSequence || showDateSeparator) && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[16px] font-medium text-white hover:underline cursor-pointer">
                            {message.username}
                          </span>
                          <span className="text-[12px] text-[#949ba4] font-medium ml-1 select-none">
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                      )}
                      <p
                        className={`
                          text-[0.95rem] leading-[1.375rem] whitespace-pre-wrap break-words 
                          ${isSequence ? "text-[#dbdee1]" : "text-[#dcddde]"}
                        `}
                      >
                        {renderMessageText(message.text)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT ALANI */}
      <div className="px-4 pb-6 pt-2 bg-[#313338] shrink-0 z-10">
        <div className="bg-[#383a40] rounded-lg px-4 py-2.5 flex items-center gap-3 relative shadow-sm border border-transparent focus-within:border-indigo-500/50 transition-colors">
          {/* Sol İkon (Dosya Ekle) */}
          <button className="text-[#b5bac1] hover:text-[#dbdee1] transition-colors p-1 rounded-full hover:bg-[#3f4147]">
            <PlusCircle
              size={22}
              fill="currentColor"
              className="text-[#383a40] fill-[#b5bac1] hover:fill-[#dbdee1]"
            />
          </button>

          <form
            onSubmit={handleSendMessage}
            className="flex-1 flex items-center"
          >
            <input
              ref={inputRef}
              type="text"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={`#${
                currentChannel?.name || "sohbet"
              } kanalına mesaj gönder`}
              className="w-full bg-transparent text-[#dbdee1] placeholder-[#949ba4] focus:outline-none font-medium"
              autoComplete="off"
              autoFocus
            />
          </form>

          {/* Sağ İkonlar (Emoji, Hediye vb.) */}
          <div className="flex items-center gap-3 text-[#b5bac1]">
            {/* Gönder Butonu (Sadece mobilde veya yazı varken daha belirgin olabilir) */}
            {messageInput.trim() && (
              <button
                onClick={handleSendMessage}
                disabled={isSending}
                className="text-[#b5bac1] hover:text-[#5865f2] transition-colors ml-2"
              >
                <Send size={20} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* LINK GÜVENLİK MODALI */}
      {linkModal.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#313338] w-full max-w-md rounded-lg shadow-2xl border border-[#1e1f22] overflow-hidden transform scale-100 animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-full">
                  <AlertTriangle className="text-yellow-500" size={24} />
                </div>
                Dikkat et!
              </h3>
              <p className="text-[#b5bac1] text-sm mb-4 leading-relaxed">
                Netrex'ten ayrılıyorsun. Lütfen tıkladığın bağlantının güvenli
                olduğundan emin ol.
              </p>
              <div className="mb-2 text-xs font-bold text-[#949ba4] uppercase tracking-wide">
                Gidilen Bağlantı
              </div>
              <div className="bg-[#1e1f22] p-3 rounded border border-[#2b2d31] mb-6 shadow-inner">
                <a
                  href={linkModal.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#00a8fc] hover:underline text-sm break-all font-mono"
                  onClick={(e) => e.preventDefault()}
                >
                  {linkModal.url}
                </a>
              </div>
              <div className="flex justify-end gap-3 bg-[#2b2d31] -m-6 p-4 mt-2">
                <button
                  onClick={() => setLinkModal({ isOpen: false, url: "" })}
                  className="px-5 py-2.5 rounded text-sm font-medium text-white hover:underline transition-all"
                >
                  Vazgeç
                </button>
                <button
                  onClick={confirmOpenLink}
                  className="px-6 py-2.5 rounded bg-[#5865f2] hover:bg-[#4752c4] text-white text-sm font-medium transition-colors shadow-md"
                >
                  Siteye Git
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SAĞ TIK MENÜSÜ */}
      {contextMenu && (
        <div
          className="fixed bg-[#111214] border border-[#1e1f22] rounded w-52 py-2 shadow-2xl z-50 text-[#dbdee1] text-sm animate-in fade-in zoom-in-95 duration-100 origin-top-left"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="mx-2 px-2 py-1.5 hover:bg-[#5865F2] hover:text-white rounded cursor-pointer flex items-center gap-2 group select-none transition-colors"
            onClick={handleCopyText}
          >
            <Copy size={16} className="text-[#b5bac1] group-hover:text-white" />
            <span className="font-medium">Metni Kopyala</span>
          </div>
          {contextMenu.message.userId === userId && (
            <>
              <div className="h-[1px] bg-[#1e1f22] my-1 mx-2"></div>
              <div
                className="mx-2 px-2 py-1.5 hover:bg-[#da373c] hover:text-white rounded cursor-pointer flex items-center gap-2 group text-[#da373c] select-none transition-colors"
                onClick={handleDeleteMsg}
              >
                <Trash2
                  size={16}
                  className="text-[#da373c] group-hover:text-white"
                />
                <span className="font-medium">Mesajı Sil</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
