import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useApp, refreshAllData } from '../context/AppContext';
import { api, getLocalDate, fmtDateLabel } from '../api';
import { colors, shared } from '../theme';

const ICONS = { Breakfast: '🌅', Lunch: '☀️', Dinner: '🌙', Snack: '🍎' };

export default function HistoryScreen() {
  const { state, dispatch } = useApp();
  const [refreshing,   setRefreshing]   = useState(false);
  const [loadingMeals, setLoadingMeals] = useState(false);

  const today        = getLocalDate();
  const selectedDate = state.historyDate || today;
  const historyMeals = state.historyMeals || [];
  const historyDays  = state.historyDays  || [];

  // All unique dates shown in the date strip
  const allDates = [...new Set([today, ...historyDays.map(d => d.day)])].sort((a, b) => b.localeCompare(a));

  // Load meals for current date when screen is focused
  useFocusEffect(useCallback(() => {
    const date = state.historyDate || today;
    if (!state.historyDate) dispatch({ type: 'SET_HISTORY_DATE', payload: today });
    loadMealsForDate(date);
  }, [state.historyDate]));

  async function loadMealsForDate(date) {
    setLoadingMeals(true);
    const data = await api(`/meals/user/${state.user.id}?date=${date}`);
    setLoadingMeals(false);
    dispatch({ type: 'SET_HISTORY_MEALS', payload: Array.isArray(data) ? data : [] });
  }

  async function selectDate(date) {
    dispatch({ type: 'SET_HISTORY_DATE', payload: date });
    await loadMealsForDate(date);
  }

  async function deleteMeal(id) {
    Alert.alert('Delete Meal', 'Remove this meal from your log?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await api(`/meals/${id}`, 'DELETE');
          await refreshAllData(state.user.id, dispatch);
          await loadMealsForDate(selectedDate);
        },
      },
    ]);
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAllData(state.user.id, dispatch);
    await loadMealsForDate(selectedDate);
    setRefreshing(false);
  }, [state.user?.id, selectedDate]);

  // Group meals by type
  const grouped = {};
  historyMeals.forEach(m => {
    if (!grouped[m.meal_type]) grouped[m.meal_type] = [];
    grouped[m.meal_type].push(m);
  });

  const totals = historyMeals.reduce(
    (a, m) => ({
      cal:   a.cal   + +m.calories,
      pro:   a.pro   + +(m.protein_g || 0),
      carbs: a.carbs + +(m.carbs_g   || 0),
      fat:   a.fat   + +(m.fat_g     || 0),
      fib:   a.fib   + +(m.fiber_g   || 0),
    }),
    { cal: 0, pro: 0, carbs: 0, fat: 0, fib: 0 }
  );

  const isToday = selectedDate === today;

  return (
    <SafeAreaView style={shared.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <Text style={styles.pageTitle}>History</Text>

        {/* Date strip */}
        <View style={shared.card}>
          <Text style={shared.label}>Browse by Day</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.dateStrip}>
              {allDates.map(date => {
                const info       = historyDays.find(d => d.day === date);
                const isSelected = date === selectedDate;
                return (
                  <TouchableOpacity
                    key={date}
                    style={[styles.dateChip, isSelected && styles.dateChipActive]}
                    onPress={() => selectDate(date)}
                  >
                    <Text style={[styles.dateChipLabel, isSelected && styles.dateChipLabelActive]}>
                      {fmtDateLabel(date)}
                    </Text>
                    {info ? (
                      <Text style={[styles.dateChipSub, isSelected && { color: colors.bg + 'bb' }]}>
                        {Math.round(info.calories)} kcal · {info.meal_count} meals
                      </Text>
                    ) : (
                      <Text style={[styles.dateChipSub, isSelected && { color: colors.bg + 'bb' }]}>No meals</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Meal list */}
        <View style={shared.card}>
          <Text style={styles.dateHeader}>{fmtDateLabel(selectedDate)}</Text>

          {loadingMeals ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
          ) : historyMeals.length === 0 ? (
            <Text style={[shared.muted, { textAlign: 'center', paddingVertical: 24 }]}>
              No meals logged for this day.
            </Text>
          ) : (
            <>
              {Object.entries(grouped).map(([type, items]) => (
                <View key={type}>
                  <Text style={styles.typeHeader}>{ICONS[type] || '🍽'} {type}</Text>
                  {items.map(m => (
                    <View key={m.id} style={styles.mealEntry}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.mealName}>{m.food_name} ({m.grams}g)</Text>
                        <View style={styles.mealMacros}>
                          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>{Math.round(m.calories)} kcal</Text>
                          <Text style={styles.dot}>·</Text>
                          <Text style={{ color: colors.green,  fontSize: 12 }}>{m.protein_g}g pro</Text>
                          <Text style={styles.dot}>·</Text>
                          <Text style={{ color: colors.yellow, fontSize: 12 }}>{m.carbs_g || 0}g carbs</Text>
                          <Text style={styles.dot}>·</Text>
                          <Text style={{ color: colors.orange, fontSize: 12 }}>{m.fat_g || 0}g fat</Text>
                        </View>
                      </View>
                      {isToday && (
                        <TouchableOpacity onPress={() => deleteMeal(m.id)} style={styles.delBtn}>
                          <Text style={{ color: colors.red, fontSize: 20, fontWeight: '300' }}>×</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  <Text style={styles.subtotal}>
                    Subtotal: {items.reduce((a, x) => a + +x.calories, 0).toFixed(0)} kcal
                  </Text>
                </View>
              ))}

              {/* Totals bar */}
              <View style={styles.totalsBar}>
                <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 6 }}>Daily Total</Text>
                <View style={styles.totalsRow}>
                  <Text style={{ color: colors.accent,  fontWeight: '700' }}>{Math.round(totals.cal)} kcal</Text>
                  <Text style={{ color: colors.green  }}>{totals.pro.toFixed(1)}g pro</Text>
                  <Text style={{ color: colors.yellow }}>{totals.carbs.toFixed(1)}g carbs</Text>
                  <Text style={{ color: colors.orange }}>{totals.fat.toFixed(1)}g fat</Text>
                  <Text style={{ color: colors.purple }}>{totals.fib.toFixed(1)}g fiber</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pageTitle:          { color: colors.text, fontSize: 26, fontWeight: '800', padding: 16, paddingBottom: 8 },
  dateStrip:          { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  dateChip:           { backgroundColor: colors.surface2, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minWidth: 90, alignItems: 'center' },
  dateChipActive:     { backgroundColor: colors.accent },
  dateChipLabel:      { color: colors.text, fontWeight: '700', fontSize: 13 },
  dateChipLabelActive:{ color: colors.bg },
  dateChipSub:        { color: colors.muted, fontSize: 11, marginTop: 2 },
  dateHeader:         { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 14 },
  typeHeader:         { color: colors.muted, fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 12, marginBottom: 8 },
  mealEntry:          { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, borderRadius: 10, padding: 12, marginBottom: 7 },
  mealName:           { color: colors.text, fontWeight: '600', fontSize: 14, marginBottom: 5 },
  mealMacros:         { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  dot:                { color: colors.muted, fontSize: 12 },
  delBtn:             { paddingHorizontal: 6, paddingVertical: 4, marginLeft: 8 },
  subtotal:           { color: colors.muted, fontSize: 12, textAlign: 'right', marginBottom: 8 },
  totalsBar:          { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, marginTop: 4 },
  totalsRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
