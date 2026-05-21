// Audio player for voice/audio messages inside chat bubbles.
// Shows play/pause, a progress bar, and duration.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../utils/theme';
import { useMediaUrl } from '../../hooks/useMediaUrl';

interface Props {
  url: string;
  isOwn: boolean;
}

const formatDuration = (ms: number): string => {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

const AudioPlayer = ({ url, isOwn }: Props) => {
  const { uri } = useMediaUrl(url);
  const [isPlaying, setIsPlaying] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [positionMs, setPositionMs] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  // Clean up sound on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setPositionMs(status.positionMillis);
    setDurationMs(status.durationMillis || 0);
    setIsPlaying(status.isPlaying);

    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMs(0);
      // Reset to beginning
      soundRef.current?.setPositionAsync(0).catch(() => {});
    }
  }, []);

  const handlePlayPause = async () => {
    if (!uri) return;

    try {
      // Set audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (!soundRef.current) {
        // Load the sound for the first time
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        soundRef.current = sound;
        return;
      }

      const status = await soundRef.current.getStatusAsync();
      if (!status.isLoaded) {
        // Reload if unloaded
        await soundRef.current.loadAsync({ uri }, { shouldPlay: true });
        return;
      }

      if (status.isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        await soundRef.current.playAsync();
      }
    } catch (err) {
      console.warn('[AudioPlayer] playback error:', err);
    }
  };

  const progress = durationMs > 0 ? positionMs / durationMs : 0;
  const displayDuration = durationMs > 0 ? formatDuration(durationMs) : '0:00';
  const displayPosition = positionMs > 0 ? formatDuration(positionMs) : '0:00';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.playBtn, isOwn ? styles.playBtnOwn : styles.playBtnOther]}
        onPress={handlePlayPause}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isPlaying ? 'pause' : 'play'}
          size={20}
          color={isOwn ? colors.bubbleSent : colors.textPrimary}
        />
      </TouchableOpacity>

      <View style={styles.waveArea}>
        {/* Progress track */}
        <View style={[styles.track, isOwn ? styles.trackOwn : styles.trackOther]}>
          <View
            style={[
              styles.trackFill,
              isOwn ? styles.trackFillOwn : styles.trackFillOther,
              { width: `${Math.round(progress * 100)}%` },
            ]}
          />
        </View>

        {/* Time display */}
        <Text style={styles.time}>
          {isPlaying ? displayPosition : displayDuration}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 180,
    paddingVertical: spacing.xs,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnOwn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  playBtnOther: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  waveArea: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  trackOwn: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  trackOther: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  trackFill: {
    height: '100%',
    borderRadius: 2,
  },
  trackFillOwn: {
    backgroundColor: '#ffffff',
  },
  trackFillOther: {
    backgroundColor: colors.primary,
  },
  time: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.6)',
  },
});

export default AudioPlayer;
