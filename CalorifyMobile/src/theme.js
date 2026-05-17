import { StyleSheet } from 'react-native';

export const colors = {
  bg:       '#0f172a',
  surface:  '#1e293b',
  surface2: '#263348',
  border:   '#334155',
  accent:   '#38bdf8',
  green:    '#4ade80',
  yellow:   '#facc15',
  red:      '#f87171',
  orange:   '#fb923c',
  purple:   '#a78bfa',
  text:     '#f8fafc',
  muted:    '#64748b',
  inputBg:  '#1e293b',
};

export const shared = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  input: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
    marginBottom: 10,
  },
  btnPrimary: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  btnPrimaryText: {
    color: colors.bg,
    fontWeight: '800',
    fontSize: 16,
  },
  muted: {
    color: colors.muted,
    fontSize: 13,
  },
  bigNum: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
  },
});
