import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApp, refreshAllData } from '../context/AppContext';
import { api, getLocalDate, getLocalDateFrom, fmtDateLabel } from '../api';
import { colors, shared } from '../theme';

const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export default function LogMealScreen({ navigation }) {
  const { state, dispatch } = useApp();

  // ── Shared state ───────────────────────────────────────
  const [mode,     setMode]     = useState('search');
  const [mealType, setMealType] = useState('Breakfast');
  const [logDate,  setLogDate]  = useState(getLocalDate());
  const [showDP,   setShowDP]   = useState(false);
  const [logging,  setLogging]  = useState(false);

  // ── Search mode ────────────────────────────────────────
  const [query,    setQuery]    = useState('');
  const [results,  setResults]  = useState([]);
  const [selFood,  setSelFood]  = useState(null);
  const [grams,    setGrams]    = useState('100');
  const [searching,setSearching]= useState(false);
  const timer = useRef(null);

  // ── Manual mode ────────────────────────────────────────
  const [mName,  setMName]  = useState('');
  const [mGrams, setMGrams] = useState('');
  const [mCal,   setMCal]   = useState('');
  const [mPro,   setMPro]   = useState('');
  const [mCarbs, setMCarbs] = useState('');
  const [mFat,   setMFat]   = useState('');
  const [mFib,   setMFib]   = useState('');

  // Reset log date to today when screen focuses
  useFocusEffect(useCallback(() => {
    setLogDate(getLocalDate());
  }, []));

  // ── Search ─────────────────────────────────────────────
  function onQueryChange(val) {
    setQuery(val);
    setResults([]);
    setSelFood(null);
    clearTimeout(timer.current);
    if (val.length < 2) { setSearching(false); return; }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const foods = await api(`/foods/search?q=${encodeURIComponent(val)}`);
      setSearching(false);
      if (Array.isArray(foods)) setResults(foods);
    }, 500);
  }

  function pickFood(food) {
    setSelFood(food);
    setResults([]);
    setGrams('100');
  }

  function calcMacros(food, g) {
    if (!food) return { cal: 0, pro: '0.0', carbs: '0.0', fat: '0.0', fib: '0.0' };
    const n = +g || 0;
    return {
      cal:   Math.round(food.calories_per100 * n / 100),
      pro:   (food.protein_per100  * n / 100).toFixed(1),
      carbs: ((food.carbs_per100 || 0) * n / 100).toFixed(1),
      fat:   ((food.fat_per100   || 0) * n / 100).toFixed(1),
      fib:   (food.fiber_per100  * n / 100).toFixed(1),
    };
  }

  async function logSearch() {
    if (!selFood) { Alert.alert('No food selected'); return; }
    const g = +grams;
    if (!g || g <= 0) { Alert.alert('Invalid portion', 'Enter grams > 0.'); return; }
    setLogging(true);
    const m = calcMacros(selFood, grams);
    const res = await api('/meals', 'POST', {
      user_id:   state.user.id,
      food_name: selFood.name,
      meal_type: mealType,
      grams:     g,
      log_date:  logDate,
      calories:  m.cal,
      protein:   +m.pro,
      carbs:     +m.carbs,
      fat:       +m.fat,
      fiber:     +m.fib,
    });
    setLogging(false);
    if (res.error) { Alert.alert('Error', res.error); return; }
    await refreshAllData(state.user.id, dispatch);
    dispatch({ type: 'SET_HISTORY_DATE',  payload: logDate });
    dispatch({ type: 'SET_HISTORY_MEALS', payload: [] });
    setSelFood(null); setQuery(''); setGrams('100');
    Alert.alert('✅ Logged!', `${selFood.name} added to ${mealType}.`, [
      { text: 'Log Another' },
      { text: 'View History', onPress: () => navigation.navigate('History') },
    ]);
  }

  async function logManual() {
    if (!mName.trim()) { Alert.alert('Enter a food name'); return; }
    if (!mGrams || +mGrams <= 0) { Alert.alert('Invalid portion'); return; }
    setLogging(true);
    const res = await api('/meals', 'POST', {
      user_id:   state.user.id,
      food_name: mName.trim(),
      meal_type: mealType,
      grams:     +mGrams,
      log_date:  logDate,
      calories:  +mCal  || 0,
      protein:   +mPro  || 0,
      carbs:     +mCarbs|| 0,
      fat:       +mFat  || 0,
      fiber:     +mFib  || 0,
    });
    setLogging(false);
    if (res.error) { Alert.alert('Error', res.error); return; }
    await refreshAllData(state.user.id, dispatch);
    dispatch({ type: 'SET_HISTORY_DATE',  payload: logDate });
    dispatch({ type: 'SET_HISTORY_MEALS', payload: [] });
    const name = mName.trim();
    setMName(''); setMGrams(''); setMCal(''); setMPro(''); setMCarbs(''); setMFat(''); setMFib('');
    Alert.alert('✅ Logged!', `${name} added to ${mealType}.`, [
      { text: 'Log Another' },
      { text: 'View History', onPress: () => navigation.navigate('History') },
    ]);
  }

  // ── Date helpers ───────────────────────────────────────
  function shiftDate(delta) {
    const d = new Date(logDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const next = getLocalDateFrom(d);
    if (next > getLocalDate()) return;
    setLogDate(next);
  }

  const macros = calcMacros(selFood, grams);

  return (
    <SafeAreaView style={shared.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.pageTitle}>Log Meal</Text>

          {/* ── Date selector ── */}
          <View style={shared.card}>
            <Text style={shared.label}>Logging For</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity style={styles.arrow} onPress={() => shiftDate(-1)}>
                <Text style={styles.arrowText}>‹</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.datePill} onPress={() => setShowDP(true)}>
                <Text style={styles.datePillLabel}>{fmtDateLabel(logDate)}</Text>
                <Text style={styles.datePillSub}>{logDate}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.arrow} onPress={() => shiftDate(1)}>
                <Text style={styles.arrowText}>›</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.todayBtn, logDate === getLocalDate() && { opacity: 0.4 }]}
                onPress={() => setLogDate(getLocalDate())}
              >
                <Text style={styles.todayBtnText}>Today</Text>
              </TouchableOpacity>
            </View>

            {showDP && (
              <DateTimePicker
                value={new Date(logDate + 'T00:00:00')}
                mode="date"
                maximumDate={new Date()}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, date) => {
                  if (Platform.OS !== 'ios') setShowDP(false);
                  if (date) setLogDate(getLocalDateFrom(date));
                }}
                style={{ marginTop: 8 }}
              />
            )}
            {showDP && Platform.OS === 'ios' && (
              <TouchableOpacity style={[shared.btnPrimary, { marginTop: 8 }]} onPress={() => setShowDP(false)}>
                <Text style={shared.btnPrimaryText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Meal type ── */}
          <View style={shared.card}>
            <Text style={shared.label}>Meal Type</Text>
            <View style={styles.mealTypeRow}>
              {MEAL_TYPES.map(mt => (
                <TouchableOpacity
                  key={mt}
                  style={[styles.mealTypeBtn, mealType === mt && styles.mealTypeBtnActive]}
                  onPress={() => setMealType(mt)}
                >
                  <Text style={[styles.mealTypeTxt, mealType === mt && styles.mealTypeTxtActive]}>
                    {mt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Mode switcher ── */}
          <View style={[shared.card, { paddingVertical: 10 }]}>
            <View style={styles.modeRow}>
              {[['search', '🔍 Search Food'], ['manual', '✏️ Enter Manually']].map(([m, lbl]) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                  onPress={() => setMode(m)}
                >
                  <Text style={[styles.modeTxt, mode === m && styles.modeTxtActive]}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ── Search mode ── */}
          {mode === 'search' && (
            <View style={shared.card}>
              <Text style={shared.label}>Search Food</Text>
              <TextInput
                style={shared.input}
                value={query}
                onChangeText={onQueryChange}
                placeholder="e.g. chicken, banana, rice…"
                placeholderTextColor={colors.muted}
                autoCorrect={false}
              />

              {searching && <ActivityIndicator color={colors.accent} style={{ marginBottom: 8 }} />}

              {results.map((food, i) => (
                <TouchableOpacity key={i} style={styles.resultItem} onPress={() => pickFood(food)}>
                  <Text style={styles.resultName} numberOfLines={1}>{food.name}</Text>
                  <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>
                    {food.calories_per100}
                    <Text style={{ color: colors.muted, fontWeight: '400' }}> kcal/100g</Text>
                  </Text>
                </TouchableOpacity>
              ))}

              {selFood && (
                <View>
                  <View style={styles.selFoodRow}>
                    <Text style={styles.selFoodName} numberOfLines={1}>{selFood.name}</Text>
                    <TouchableOpacity onPress={() => { setSelFood(null); setQuery(''); }}>
                      <Text style={{ color: colors.muted }}>✕ change</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={shared.label}>Portion (grams)</Text>
                  <TextInput
                    style={shared.input}
                    value={grams}
                    onChangeText={setGrams}
                    keyboardType="numeric"
                    placeholder="100"
                    placeholderTextColor={colors.muted}
                  />

                  {/* Macro preview */}
                  <View style={styles.macroPreview}>
                    {[
                      [macros.cal,   'kcal',    colors.accent],
                      [macros.pro,   'protein', colors.green],
                      [macros.carbs, 'carbs',   colors.yellow],
                      [macros.fat,   'fat',     colors.orange],
                      [macros.fib,   'fiber',   colors.purple],
                    ].map(([val, lbl, clr], i) => (
                      <View key={i} style={styles.macroPreviewItem}>
                        <Text style={[styles.macroPreviewVal, { color: clr }]}>{val}</Text>
                        <Text style={styles.macroPreviewLbl}>{lbl}</Text>
                      </View>
                    ))}
                  </View>

                  <TouchableOpacity style={shared.btnPrimary} onPress={logSearch} disabled={logging}>
                    {logging
                      ? <ActivityIndicator color={colors.bg} />
                      : <Text style={shared.btnPrimaryText}>Add to Log ✓</Text>
                    }
                  </TouchableOpacity>
                </View>
              )}

              {!selFood && !results.length && query.length >= 2 && !searching && (
                <Text style={[shared.muted, { textAlign: 'center', marginTop: 8 }]}>
                  No results — try entering manually.
                </Text>
              )}
            </View>
          )}

          {/* ── Manual mode ── */}
          {mode === 'manual' && (
            <View style={shared.card}>
              <Text style={shared.label}>Food Details</Text>
              <TextInput style={shared.input} value={mName}  onChangeText={setMName}  placeholder="Food name"       placeholderTextColor={colors.muted} />
              <TextInput style={shared.input} value={mGrams} onChangeText={setMGrams} placeholder="Portion (grams)" placeholderTextColor={colors.muted} keyboardType="numeric" />
              <View style={styles.row2}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <TextInput style={shared.input} value={mCal}   onChangeText={setMCal}   placeholder="Calories"   placeholderTextColor={colors.muted} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <TextInput style={shared.input} value={mPro}   onChangeText={setMPro}   placeholder="Protein (g)" placeholderTextColor={colors.muted} keyboardType="numeric" />
                </View>
              </View>
              <View style={styles.row2}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <TextInput style={shared.input} value={mCarbs} onChangeText={setMCarbs} placeholder="Carbs (g)"  placeholderTextColor={colors.muted} keyboardType="numeric" />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <TextInput style={shared.input} value={mFat}   onChangeText={setMFat}   placeholder="Fat (g)"    placeholderTextColor={colors.muted} keyboardType="numeric" />
                </View>
              </View>
              <TextInput style={shared.input} value={mFib} onChangeText={setMFib} placeholder="Fiber (g)" placeholderTextColor={colors.muted} keyboardType="numeric" />

              <TouchableOpacity style={shared.btnPrimary} onPress={logManual} disabled={logging}>
                {logging
                  ? <ActivityIndicator color={colors.bg} />
                  : <Text style={shared.btnPrimaryText}>Add to Log ✓</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pageTitle:         { color: colors.text, fontSize: 26, fontWeight: '800', padding: 16, paddingBottom: 8 },

  dateRow:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow:             { width: 38, height: 38, backgroundColor: colors.surface2, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  arrowText:         { color: colors.text, fontSize: 24, fontWeight: '300' },
  datePill:          { flex: 1, backgroundColor: colors.surface2, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, alignItems: 'center' },
  datePillLabel:     { color: colors.accent, fontWeight: '700', fontSize: 15 },
  datePillSub:       { color: colors.muted, fontSize: 11, marginTop: 2 },
  todayBtn:          { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, height: 38, alignItems: 'center', justifyContent: 'center' },
  todayBtnText:      { color: colors.bg, fontWeight: '700', fontSize: 12 },

  mealTypeRow:       { flexDirection: 'row', gap: 8 },
  mealTypeBtn:       { flex: 1, paddingVertical: 10, borderRadius: 9, backgroundColor: colors.surface2, alignItems: 'center' },
  mealTypeBtnActive: { backgroundColor: colors.accent },
  mealTypeTxt:       { color: colors.muted, fontSize: 12, fontWeight: '600' },
  mealTypeTxtActive: { color: colors.bg },

  modeRow:           { flexDirection: 'row', gap: 8 },
  modeBtn:           { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.surface2, alignItems: 'center' },
  modeBtnActive:     { backgroundColor: colors.accent + '25', borderWidth: 1, borderColor: colors.accent },
  modeTxt:           { color: colors.muted, fontWeight: '600' },
  modeTxtActive:     { color: colors.accent },

  resultItem:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 10, padding: 12, marginBottom: 7 },
  resultName:        { color: colors.text, fontSize: 14, fontWeight: '500', flex: 1, marginRight: 8 },

  selFoodRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.accent + '22', borderRadius: 10, padding: 12, marginBottom: 12 },
  selFoodName:       { color: colors.accent, fontWeight: '700', flex: 1, marginRight: 8 },

  macroPreview:      { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.surface2, borderRadius: 10, padding: 12, marginBottom: 12 },
  macroPreviewItem:  { alignItems: 'center' },
  macroPreviewVal:   { fontSize: 15, fontWeight: '800' },
  macroPreviewLbl:   { color: colors.muted, fontSize: 11, marginTop: 2 },

  row2:              { flexDirection: 'row' },
});
