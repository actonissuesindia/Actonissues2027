// Keep keys in sync with models/Announcement.js's MOODS list.
export const ANNOUNCEMENT_MOODS = [
  { key: 'announce', emoji: '📢', label: 'Announcement' },
  { key: 'celebrate', emoji: '🎉', label: 'Celebration' },
  { key: 'warning', emoji: '⚠️', label: 'Warning' },
  { key: 'sad', emoji: '😢', label: 'Sad' },
  { key: 'love', emoji: '❤️', label: 'Love' }
];

export function moodEmoji(key) {
  return ANNOUNCEMENT_MOODS.find(m => m.key === key)?.emoji || ANNOUNCEMENT_MOODS[0].emoji;
}
