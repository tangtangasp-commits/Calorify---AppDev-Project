import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { colors, shared } from '../theme';

function Row({ label, value, valueColor }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowVal, valueColor && { color: valueColor }]}>{value || '—'}</Text>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={shared.card}>
      <Text style={shared.label}>{title}</Text>
      {children}
    </View>
  );
}

export default function ProfileScreen() {
  const { state, dispatch } = useApp();
  const u = state.user;
  const t = state.targets;

  function cap(str) {
    if (!str) return '—';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  const goalLabel = u?.goal === 'loss' ? 'Weight Loss 🏃' : u?.goal === 'gain' ? 'Muscle Gain 💪' : 'Maintenance ⚖️';

  function doLogout() {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('calorify_user');
          dispatch({ type: 'LOGOUT' });
        },
      },
    ]);
  }

  if (!u) return null;

  return (
    <SafeAreaView style={shared.screen}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Profile</Text>

        {/* Avatar / greeting */}
        <View style={styles.avatarCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{u.name?.[0]?.toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.avatarName}>{u.name}</Text>
            <Text style={[shared.muted, { marginTop: 2 }]}>{u.email}</Text>
            <View style={styles.goalBadge}>
              <Text style={styles.goalBadgeText}>{goalLabel}</Text>
            </View>
          </View>
        </View>

        {/* Personal info */}
        <Section title="Personal Info">
          <Row label="Age"      value={`${u.age} years`} />
          <Row label="Weight"   value={`${u.weight_kg} kg`} />
          <Row label="Height"   value={`${u.height_cm} cm`} />
          <Row label="Sex"      value={cap(u.sex)} />
          <Row label="Activity" value={cap(u.activity)} />
          <Row label="Goal"     value={goalLabel} />
        </Section>

        {/* Daily targets */}
        <Section title="Daily Target Ranges">
          <Row label="🔥 Calories" value={`${t.cal_min || '—'} – ${t.cal_max || '—'} kcal`}       valueColor={colors.accent} />
          <Row label="💪 Protein"  value={`${t.protein_min_g || '—'} – ${t.protein_max_g || '—'} g`} valueColor={colors.green} />
          <Row label="🌾 Carbs"    value={`${t.carbs_min_g   || '—'} – ${t.carbs_max_g   || '—'} g`} valueColor={colors.yellow} />
          <Row label="🥑 Fat"      value={`${t.fat_min_g     || '—'} – ${t.fat_max_g     || '—'} g`} valueColor={colors.orange} />
          <Row label="🌿 Fiber"    value={`${t.fiber_min_g   || '—'} – ${t.fiber_max_g   || '—'} g`} valueColor={colors.purple} />
        </Section>

        {/* How targets are calculated note */}
        <View style={[shared.card, { paddingVertical: 12 }]}>
          <Text style={[shared.muted, { fontSize: 12, lineHeight: 18 }]}>
            💡 Targets are calculated from your BMR using the Mifflin-St Jeor formula, adjusted for your activity level and goal. Re-register to update your targets if your stats change.
          </Text>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={doLogout}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pageTitle:     { color: colors.text, fontSize: 26, fontWeight: '800', padding: 16, paddingBottom: 8 },

  avatarCard:    { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 12 },
  avatar:        { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.accent + '30', borderWidth: 2, borderColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarLetter:  { color: colors.accent, fontSize: 26, fontWeight: '800' },
  avatarName:    { color: colors.text, fontSize: 20, fontWeight: '800' },
  goalBadge:     { marginTop: 6, backgroundColor: colors.accent + '22', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  goalBadgeText: { color: colors.accent, fontSize: 12, fontWeight: '700' },

  row:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel:      { color: colors.muted, fontSize: 14 },
  rowVal:        { color: colors.text, fontWeight: '600', fontSize: 14 },

  logoutBtn:     { marginHorizontal: 16, marginBottom: 12, borderRadius: 12, paddingVertical: 15, alignItems: 'center', backgroundColor: colors.red + '18', borderWidth: 1, borderColor: colors.red },
  logoutText:    { color: colors.red, fontWeight: '800', fontSize: 16 },
});
