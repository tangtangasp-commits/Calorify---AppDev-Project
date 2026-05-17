import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp, refreshAllData } from '../context/AppContext';
import { api } from '../api';
import { colors, shared } from '../theme';

const ACTIVITY_OPTIONS = ['sedentary', 'light', 'moderate', 'active'];
const GOAL_OPTIONS = [
  { val: 'loss',     label: 'Weight Loss' },
  { val: 'maintain', label: 'Maintain' },
  { val: 'gain',     label: 'Muscle Gain' },
];

function SegButton({ label, active, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.segBtn, active && styles.segBtnActive]}
      onPress={onPress}
    >
      <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function AuthScreen() {
  const [tab, setTab] = useState('login');
  const { dispatch } = useApp();

  // ── Login ──────────────────────────────────────────────
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');

  // ── Register ───────────────────────────────────────────
  const [rName,     setRName]     = useState('');
  const [rEmail,    setREmail]    = useState('');
  const [rPass,     setRPass]     = useState('');
  const [rAge,      setRAge]      = useState('');
  const [rWeight,   setRWeight]   = useState('');
  const [rHeight,   setRHeight]   = useState('');
  const [rSex,      setRSex]      = useState('male');
  const [rActivity, setRActivity] = useState('moderate');
  const [rGoal,     setRGoal]     = useState('maintain');
  const [busy,      setBusy]      = useState(false);

  async function doLogin() {
    if (!email || !password) { Alert.alert('Missing Fields', 'Enter email and password.'); return; }
    setBusy(true);
    const data = await api('/login', 'POST', { email, password });
    setBusy(false);
    if (data.error) { Alert.alert('Login Failed', data.error); return; }
    const t = await api(`/targets/${data.user.id}`);
    await AsyncStorage.setItem('calorify_user', JSON.stringify(data.user));
    dispatch({ type: 'SET_USER',    payload: data.user });
    if (t && !t.error) dispatch({ type: 'SET_TARGETS', payload: t });
    refreshAllData(data.user.id, dispatch);
  }

  async function doRegister() {
    if (!rName || !rEmail || !rPass || !rAge || !rWeight || !rHeight) {
      Alert.alert('Missing Fields', 'Please fill in all fields.'); return;
    }
    setBusy(true);
    const payload = {
      name: rName, email: rEmail, password: rPass,
      age: +rAge, weight_kg: +rWeight, height_cm: +rHeight,
      sex: rSex, activity: rActivity, goal: rGoal,
    };
    const reg = await api('/register', 'POST', payload);
    if (reg.error) { setBusy(false); Alert.alert('Registration Failed', reg.error); return; }
    const login = await api('/login', 'POST', { email: rEmail, password: rPass });
    setBusy(false);
    if (login.error) { Alert.alert('Login Failed', login.error); return; }
    const t = await api(`/targets/${login.user.id}`);
    await AsyncStorage.setItem('calorify_user', JSON.stringify(login.user));
    dispatch({ type: 'SET_USER',    payload: login.user });
    if (t && !t.error) dispatch({ type: 'SET_TARGETS', payload: t });
    refreshAllData(login.user.id, dispatch);
  }

  function cap(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

  return (
    <SafeAreaView style={shared.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Branding */}
          <Text style={styles.logo}>CALORIFY!</Text>
          <Text style={styles.tagline}>Fuel your body right</Text>

          {/* Tab row */}
          <View style={styles.tabRow}>
            {['login', 'register'].map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                  {t === 'login' ? 'Login' : 'Register'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Login form ── */}
          {tab === 'login' && (
            <View>
              <Text style={styles.lbl}>Email</Text>
              <TextInput style={shared.input} value={email} onChangeText={setEmail}
                placeholder="you@email.com" placeholderTextColor={colors.muted}
                keyboardType="email-address" autoCapitalize="none" />
              <Text style={styles.lbl}>Password</Text>
              <TextInput style={shared.input} value={password} onChangeText={setPassword}
                placeholder="••••••••" placeholderTextColor={colors.muted} secureTextEntry />
              <TouchableOpacity style={shared.btnPrimary} onPress={doLogin} disabled={busy}>
                <Text style={shared.btnPrimaryText}>{busy ? 'Signing in…' : 'Sign In'}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── Register form ── */}
          {tab === 'register' && (
            <View>
              <View style={styles.row2}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.lbl}>Name</Text>
                  <TextInput style={shared.input} value={rName} onChangeText={setRName}
                    placeholder="Your name" placeholderTextColor={colors.muted} />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.lbl}>Age</Text>
                  <TextInput style={shared.input} value={rAge} onChangeText={setRAge}
                    placeholder="22" placeholderTextColor={colors.muted} keyboardType="numeric" />
                </View>
              </View>

              <Text style={styles.lbl}>Email</Text>
              <TextInput style={shared.input} value={rEmail} onChangeText={setREmail}
                placeholder="you@email.com" placeholderTextColor={colors.muted}
                keyboardType="email-address" autoCapitalize="none" />
              <Text style={styles.lbl}>Password</Text>
              <TextInput style={shared.input} value={rPass} onChangeText={setRPass}
                placeholder="••••••••" placeholderTextColor={colors.muted} secureTextEntry />

              <View style={styles.row2}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.lbl}>Weight (kg)</Text>
                  <TextInput style={shared.input} value={rWeight} onChangeText={setRWeight}
                    placeholder="70" placeholderTextColor={colors.muted} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.lbl}>Height (cm)</Text>
                  <TextInput style={shared.input} value={rHeight} onChangeText={setRHeight}
                    placeholder="175" placeholderTextColor={colors.muted} keyboardType="numeric" />
                </View>
              </View>

              <Text style={styles.lbl}>Sex</Text>
              <View style={styles.segRow}>
                {['male', 'female'].map(s => (
                  <SegButton key={s} label={cap(s)} active={rSex === s} onPress={() => setRSex(s)} />
                ))}
              </View>

              <Text style={styles.lbl}>Activity Level</Text>
              <View style={styles.segRow}>
                {ACTIVITY_OPTIONS.map(a => (
                  <SegButton key={a} label={cap(a)} active={rActivity === a} onPress={() => setRActivity(a)} />
                ))}
              </View>

              <Text style={styles.lbl}>Goal</Text>
              <View style={styles.segRow}>
                {GOAL_OPTIONS.map(({ val, label }) => (
                  <SegButton key={val} label={label} active={rGoal === val} onPress={() => setRGoal(val)} />
                ))}
              </View>

              <TouchableOpacity style={[shared.btnPrimary, { marginTop: 12 }]} onPress={doRegister} disabled={busy}>
                <Text style={shared.btnPrimaryText}>{busy ? 'Creating…' : 'Create Account →'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll:          { padding: 24, paddingTop: 48 },
  logo:            { fontSize: 32, fontWeight: '900', color: colors.accent, letterSpacing: 2, textAlign: 'center', marginBottom: 6 },
  tagline:         { color: colors.muted, textAlign: 'center', marginBottom: 28, fontSize: 14 },
  tabRow:          { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 12, padding: 4, marginBottom: 22 },
  tabBtn:          { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabBtnActive:    { backgroundColor: colors.accent },
  tabText:         { color: colors.muted, fontWeight: '700' },
  tabTextActive:   { color: colors.bg },
  lbl:             { color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
  row2:            { flexDirection: 'row' },
  segRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  segBtn:          { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  segBtnActive:    { backgroundColor: colors.accent, borderColor: colors.accent },
  segText:         { color: colors.muted, fontSize: 13, fontWeight: '600' },
  segTextActive:   { color: colors.bg },
});
