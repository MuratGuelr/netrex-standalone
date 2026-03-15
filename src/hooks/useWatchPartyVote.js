// src/hooks/useWatchPartyVote.js
import { useCallback } from 'react';
import { useAuthStore } from '@/src/store/authStore';
import { useWatchPartyStore } from '@/src/store/watchPartyStore';
import { voteTrack } from '@/src/services/watchPartyService';
import { VOTE_UP, VOTE_DOWN, VOTE_NONE } from '@/src/constants/watchPartyConstants';

export function useWatchPartyVote(serverId, channelId) {
  const currentUser    = useAuthStore((s) => s.user);
  const votes          = useWatchPartyStore((s) => s.votes);
  const getTrackScore  = useWatchPartyStore((s) => s.getTrackVoteScore);
  const getUserVote    = useWatchPartyStore((s) => s.getUserVote);

  const toggleUpvote = useCallback(async (trackId) => {
    if (!currentUser?.uid) return;
    const current = getUserVote(trackId, currentUser.uid);
    const newVote = current === VOTE_UP ? VOTE_NONE : VOTE_UP;
    await voteTrack(serverId, channelId, trackId, currentUser.uid, newVote);
  }, [currentUser?.uid, serverId, channelId, getUserVote]);

  const toggleDownvote = useCallback(async (trackId) => {
    if (!currentUser?.uid) return;
    const current = getUserVote(trackId, currentUser.uid);
    const newVote = current === VOTE_DOWN ? VOTE_NONE : VOTE_DOWN;
    await voteTrack(serverId, channelId, trackId, currentUser.uid, newVote);
  }, [currentUser?.uid, serverId, channelId, getUserVote]);

  const getScore = useCallback((trackId) => {
    return getTrackScore(trackId);
  }, [getTrackScore]);

  const getMyVote = useCallback((trackId) => {
    if (!currentUser?.uid) return 0;
    return getUserVote(trackId, currentUser.uid);
  }, [currentUser?.uid, getUserVote]);

  return { toggleUpvote, toggleDownvote, getScore, getMyVote };
}
