// GroupAvatar — WeChat-style composite avatar for group chats.
//
// When a group has no custom groupImage, render a tiled mosaic of up to
// 9 member avatars (2 in a row, 3 in a row, etc., matching the count).
// When a custom groupImage IS set, fall back to a regular Avatar showing
// that image.
//
// Sub-component GroupAvatarCell calls useMediaUrl per cell so each
// avatar's signed URL is resolved + cached individually.

import React, { useMemo } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { useMediaUrl } from '../../hooks/useMediaUrl';
import Avatar from './Avatar';
import { useTheme } from '../../context/ThemeContext';
import { fontSize } from '../../utils/theme';
import type { User } from '../../types';

interface Props {
  // Custom group avatar (if set on the chat record) — wins over the mosaic
  src?: string;
  // Group display name — used for the fallback initial when no avatars
  name?: string;
  // Participants to mosaic. Pass the chat's full participants list.
  members: User[];
  size: number;
}

const GroupAvatar = ({ src, name, members, size }: Props) => {
  const { colors } = useTheme();

  // Take up to 9 members for the mosaic. Sort by id so layout is
  // deterministic across sessions. NOTE: hooks must run in the same
  // order on every render, so this useMemo lives BEFORE the early
  // return below.
  const tileMembers = useMemo(
    () =>
      [...(members || [])]
        .sort((a, b) => a.id.localeCompare(b.id))
        .slice(0, 9),
    [members]
  );

  // If the group has a custom avatar set, use it directly — no mosaic.
  if (src) {
    return <Avatar src={src} name={name || 'G'} size={size} />;
  }

  const count = tileMembers.length;

  if (count === 0) {
    // Edge case: brand-new group with no members yet — show the group's
    // first initial inside a colored circle.
    return (
      <View
        style={[
          styles.fallback,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary },
        ]}
      >
        <Text style={[styles.fallbackText, { fontSize: size * 0.4 }]}>
          {(name || 'G').charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }

  // Determine the grid: 1 → 1x1, 2 → 2x1, 3 → 1+2 split, 4 → 2x2, 5-9 → 3x3
  const cellsPerRow = count <= 4 ? (count === 1 ? 1 : 2) : 3;
  const rows = Math.ceil(count / cellsPerRow);

  // Cell size: divide the canvas by cellsPerRow, minus a 1px gap on each
  // side. We use a tiny gap (1px) to mimic WeChat's subtle grid look.
  const cellSize = (size - (cellsPerRow + 1)) / cellsPerRow;

  // Build the layout. For 3 members WeChat shows 1 on top + 2 on bottom.
  // The simplest implementation: arrange in row-major order but offset
  // the top row when count === 3 so the single avatar is centered.
  return (
    <View
      style={[
        styles.gridWrap,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <View style={styles.grid}>
        {[...Array(rows)].map((_, rowIdx) => {
          const start = rowIdx * cellsPerRow;
          const rowMembers = tileMembers.slice(start, start + cellsPerRow);
          // Centre the top row when count === 3 (1 avatar on top)
          const isShortRow = count === 3 && rowIdx === 0;
          return (
            <View
              key={rowIdx}
              style={[
                styles.row,
                isShortRow && { justifyContent: 'center' },
              ]}
            >
              {rowMembers.map((m) => (
                <GroupAvatarCell key={m.id} user={m} size={cellSize} />
              ))}
            </View>
          );
        })}
      </View>
    </View>
  );
};

const GroupAvatarCell = ({ user, size }: { user: User; size: number }) => {
  const { colors } = useTheme();
  const { uri } = useMediaUrl(user.avatar);
  const initial = (user.displayName || user.username || '?').charAt(0).toUpperCase();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, backgroundColor: colors.bgInput }}
      />
    );
  }
  // Fallback: colored cell with initial — never empty, so the mosaic
  // doesn't have visual holes if a member has no avatar.
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: '#fff',
          fontWeight: '600',
          fontSize: size * 0.45,
        }}
      >
        {initial}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  fallbackText: { color: '#fff', fontWeight: '700' },
  gridWrap: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    overflow: 'hidden',
    padding: 1,
  },
  grid: {
    flex: 1,
    justifyContent: 'center',
    gap: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 1,
  },
});

export default GroupAvatar;
