"use client";

/**
 * 📱 MainContent - Main Content Area Wrapper
 * NDS v2.0 - Netrex Design System
 * 
 * The main content area with:
 * - Optional header
 * - Content area
 * - Optional bottom controls
 */

import { forwardRef } from "react";

const MainContent = forwardRef(function MainContent({ 
  header,
  children, 
  footer,
  showBackgroundDecoration = true,
  className = "" 
}, ref) {
  return (
    <div 
      ref={ref}
      className={`
        main-content-container
        h-full w-full
        flex flex-col
        bg-nds-bg-tertiary
        relative
        overflow-hidden
        ${className}
      `}
    >
      {/* Background Decoration */}
      {showBackgroundDecoration && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="
            decoration-circle-indigo
            w-96 h-96
            top-1/4 right-1/4
            opacity-50
          " />
          <div className="
            decoration-circle-purple
            w-96 h-96
            bottom-1/4 left-1/4
            opacity-40
          " />
        </div>
      )}

      {/* Header */}
      {header && (
        <div className="
          main-header
          h-14
          flex items-center
          px-4
          border-b border-nds-border-subtle
          bg-nds-bg-tertiary/80
          backdrop-blur-sm
          flex-shrink-0
          relative z-10
        ">
          {header}
        </div>
      )}

      {/* Content */}
      <div className="
        main-body
        flex-1
        overflow-hidden
        relative z-10
      ">
        {children}
      </div>

      {/* Footer / Bottom Controls */}
      {footer && (
        <div className="
          main-footer
          h-controls
          flex-shrink-0
          border-t border-nds-border-subtle
          bg-nds-bg-secondary/80
          backdrop-blur-sm
          relative z-10
        ">
          {footer}
        </div>
      )}
    </div>
  );
});

export default MainContent;
