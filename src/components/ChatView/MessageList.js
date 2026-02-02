import { Virtuoso } from "react-virtuoso";
import { Loader2, Hash } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MessageItem from "./MessageItem";

export default function MessageList({
  messages,
  virtuosoRef,
  isLoading,
  currentChannel,
  handleLoadOlderMessages,
  hasMoreMessages,
  isLoadingOlderMessages,
  typingUsers,
  channelId,
  userId,
  editingMessageId,
  editingText,
  setEditingText,
  handleSaveEdit,
  handleCancelEdit,
  handleToggleReaction,
  handleContextMenu,
  renderMessageText,
  formatTime,
  formatDateHeader,
  isMessageInSequence,
  setSelectedImage
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col h-full py-6 overflow-hidden px-4">
        <AnimatePresence>
          {[...Array(6)].map((_, i) => (
            <motion.div 
              key={`skeleton-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex pr-4 pl-[72px] relative w-full ${i % 3 === 0 ? 'mt-[17px]' : 'mt-[2px]'}`}
            >
              {i % 3 === 0 && (
                <div className="absolute left-4 w-[50px] flex justify-start">
                  <div className="w-10 h-10 rounded-xl bg-white/5 animate-pulse" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                {i % 3 === 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-4 rounded-md bg-white/10 animate-pulse w-24" />
                  </div>
                )}
                <div className="h-4 rounded-md bg-white/[0.05] animate-pulse w-[70%]" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 flex flex-col justify-end pb-12 select-none px-4"
      >
        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-cyan-500/10 rounded-3xl flex items-center justify-center mb-6 shadow-[0_8px_32px_rgba(99,102,241,0.15)] border border-white/10 backdrop-blur-sm">
          <Hash size={44} className="text-white/90" />
        </div>
        <h1 className="text-3xl font-extrabold text-white mb-3 tracking-tight">
          {currentChannel?.name || "sohbet"} kanalına hoş geldin!
        </h1>
        <p className="text-white/60 text-base max-w-lg leading-relaxed">
          Bu kanalın başlangıcı. Arkadaşlarına bir "Merhaba" diyerek sohbeti başlatabilirsin.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full w-full"
    >
      <Virtuoso
        ref={virtuosoRef}
        style={{ height: '100%' }}
        data={messages}
        initialTopMostItemIndex={messages.length - 1}
        followOutput="smooth"
        startReached={handleLoadOlderMessages}
        atTopThreshold={50}
        className="scrollbar-thin"
        components={{
          Header: () => (
            (hasMoreMessages || isLoadingOlderMessages) ? (
              <div className="py-4 flex justify-center w-full">
                <div className="px-4 py-1.5 text-xs font-semibold text-[#949ba4] bg-white/5 rounded-full border border-white/5 flex items-center gap-2">
                  {isLoadingOlderMessages ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  {isLoadingOlderMessages ? "Yükleniyor..." : "Daha eski mesajları yüklemek için yukarı kaydır"}
                </div>
              </div>
            ) : <div className="h-4" />
          ),
          Footer: () => (
            <div className="pb-2">
              <AnimatePresence>
                {Object.keys(typingUsers[channelId] || {}).length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="px-12 py-2 flex items-center gap-2"
                  >
                    <div className="flex gap-1 bg-white/5 px-2 py-1 rounded-full border border-white/5">
                      <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                      <div className="w-1 h-1 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
                    </div>
                    <span className="text-[11px] text-[#949ba4] font-bold italic">
                      {Object.values(typingUsers[channelId]).join(", ")} yazıyor...
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
              <div id="chat-bottom-anchor" className="h-4 w-full scroll-mt-20" />
            </div>
          )
        }}
        itemContent={(index, message) => (
          <div className="px-4">
            <MessageItem
              key={message.id}
              message={{
                ...message,
                currentUserId: userId,
                isEditing: editingMessageId === message.id,
                tempText: editingText,
                onTempTextChange: setEditingText,
                onSave: handleSaveEdit,
                onCancel: handleCancelEdit,
                onToggleReaction: (emoji) => handleToggleReaction(message.id, emoji)
              }}
              prevMessage={messages[index - 1]}
              messageIndex={index}
              onContextMenu={handleContextMenu}
              renderText={renderMessageText}
              formatTime={formatTime}
              formatDateHeader={formatDateHeader}
              isInSequence={isMessageInSequence(message, index)}
              onImageClick={setSelectedImage}
            />
          </div>
        )}
      />
    </motion.div>
  );
}
