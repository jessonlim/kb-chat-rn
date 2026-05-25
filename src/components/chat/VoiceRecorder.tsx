// Voice recorder overlay — appears when mic button is pressed.
// Shows a red pulsing dot, elapsed time, and cancel/send buttons.

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { spacing, fontSize, borderRadius } from '../../utils/theme';
import { uploadFile } from '../../services/uploadService';
import type { Attachment } from '../../types';

interface Props {
  onSend: (attachments: Attachment[]) => void;
  onCancel: () => void;
}

const formatElapsed = (seconds: number): string => {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

const VoiceRecorder = ({ onSend, onCancel }: Props) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [uploading, setUploading] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start recording on mount
  useEffect(() => {
    let cancelled = false;

    const startRecording = async () => {
      try {
        // Request microphone permission
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Microphone access is required for voice messages.');
          onCancel();
          return;
        }

        // Configure audio session for recording
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        if (cancelled) return;

        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );
        recordingRef.current = recording;

        // Start timer
        timerRef.current = setInterval(() => {
          setElapsedSec((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        console.warn('[VoiceRecorder] start error:', err);
        onCancel();
      }
    };

    startRecording();

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      // If still recording when unmounted, stop and discard
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {
        // already stopped
      }
      recordingRef.current = null;
    }
    onCancel();
  }, [onCancel]);

  const handleSend = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!recordingRef.current) return;

    setUploading(true);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        Alert.alert('Error', 'No recording found.');
        onCancel();
        return;
      }

      // Reset audio mode so playback works
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      // The Expo Audio recorder produces an MP4-container AAC file (.m4a
       // extension). The backend's multer fileFilter accepts 'audio/mp4'
       // and 'audio/x-m4a' but NOT 'audio/m4a' (non-standard variant).
       // Send the IANA-standard 'audio/mp4' which is unambiguous and on
       // the whitelist.
      const fileName = `voice_${Date.now()}.m4a`;
      const result = await uploadFile(uri, fileName, 'audio/mp4');

      // IMPORTANT: attachment.type holds the message bucket ('audio'),
      // NOT the MIME type. The backend's send_message handler uses this
      // field as the Message.type enum. Putting 'audio/mp4' here causes
      // Mongoose enum validation to fail → the message never persists.
      // Backend's POST /api/uploads already returns result.type='audio'
      // for any audio MIME, so we use that.
      const attachment: Attachment = {
        url: result.url,
        type: result.type || 'audio',
        name: fileName,
        size: result.size || 0,
      };

      onSend([attachment]);
    } catch (err: any) {
      Alert.alert('Upload failed', err.message || 'Could not upload voice message.');
      onCancel();
    } finally {
      setUploading(false);
    }
  }, [onCancel, onSend]);

  return (
    <View style={styles.container}>
      {/* Cancel button */}
      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={handleCancel}
        activeOpacity={0.7}
        disabled={uploading}
      >
        <Ionicons name="close" size={24} color={colors.danger} />
      </TouchableOpacity>

      {/* Recording indicator */}
      <View style={styles.indicator}>
        <View style={styles.redDot} />
        <Text style={styles.timer}>{formatElapsed(elapsedSec)}</Text>
      </View>

      {/* Send button */}
      <TouchableOpacity
        style={[styles.sendBtn, uploading && styles.sendBtnDisabled]}
        onPress={handleSend}
        activeOpacity={0.7}
        disabled={uploading}
      >
        <Ionicons
          name={uploading ? 'hourglass-outline' : 'send'}
          size={20}
          color="#fff"
        />
      </TouchableOpacity>
    </View>
  );
};

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgHeader,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  cancelBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
  timer: {
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
});

export default VoiceRecorder;
