// Full-screen video viewer modal. Tapping anywhere outside the player
// dismisses. Uses expo-av's <Video> with native controls.

import React, { useMemo } from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}

const VideoViewer = ({ visible, uri, onClose }: Props) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  if (!uri) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.backdrop}>
        <TouchableOpacity
          style={styles.closeBtn}
          activeOpacity={0.7}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>

        <Video
          source={{ uri }}
          style={styles.video}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          isLooping={false}
        />
      </View>
    </Modal>
  );
};

const makeStyles = () =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: '#000',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtn: {
      position: 'absolute',
      top: 48,
      right: 20,
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    video: {
      width: '100%',
      aspectRatio: 16 / 9,
    },
  });

export default VideoViewer;
