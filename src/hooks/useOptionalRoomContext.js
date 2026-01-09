"use client";

import { useMaybeRoomContext } from "@livekit/components-react";

/**
 * Safely get room context - returns null if not inside a LiveKitRoom
 * Uses LiveKit's built-in useMaybeRoomContext which doesn't throw errors
 */
export function useOptionalRoomContext() {
  try {
    return useMaybeRoomContext() || null;
  } catch (e) {
    return null;
  }
}
