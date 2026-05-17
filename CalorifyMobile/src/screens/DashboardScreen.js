import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useApp, refreshAllData } from '../context/AppContext';
import { colors, shared } from '../theme';

// ── Calorie ring ───────────────────────────────────────────
const RADIUS       = 46;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function CalorieRing({ pct, ringColor }) {
  const clampedPct = Math.min(Math.max(pct, 0), 100);
  const offset     = CIRCUMFERENCE - (clampedPct / 100) * CIRCUMFERENCE;
  return (
    <Svg width={110} height={110} viewBox="0 0 110 110">
      <Circle cx={55} cy={55} r={RADIUS} stroke={colors.surface2} strokeWidth={9} fill="none" />
      <Circle
        cx={55} cy={55} r={RADIUS}
        stroke={ringColor}
        strokeWidth={9}
        fill="none"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        strokeLinecap="round"
        rotation="-90"
        origin="55,55"
      />
    </Svg>
  );
}

// ── Macro progress bar ─────────────────────────────────────
function MacroBar({ label, value, min, max, color }) {
  const safeMax  = max || 1;
  const pct      = Math.min(100, (value / safeMax) * 100);
  const minPct   = Math.min(100, (min  / safeMax) * 100);
  const barColor = value > max ? colors.red : (value > 0 && value < min) ? colors.yellow : color;

  return (
    <View style={{ marginBottom: 14 }}>
      <View style={styles.macroLabelRow}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={{ color, fontSize: 13, fontWeight: '700' }}>
          {Math.round(value)}
          <Text style={{ color: colors.muted, fontWeight: '400' }}> / {min}–{max}</Text>
        </Text>
      </View>
      <View style={styles.barOuter}>
        {/* Track */}
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: barColor }]} />
        </View>
        {/* Min marker overlaid outside the overflow:hidden container */}
        <View style={[styles.minMarker, { left: `${minPct}%` }]} />
      </View>
    </View>
  );
}

// ── Recommendation tip card ────────────────────────────────
function TipCard({ tip }) {
  const colorMap = { success: colors.green, warning: colors.yellow, danger: colors.red, info: colors.accent };
  const c = colorMap[tip.type] || colors.accent;
  return (
    <View style={[styles.tipCard, { backgroundColor: c + '22', borderColor: c + '55' }]}>
      <Text style={{ fontSize: 20 }}>{tip.icon}</Text>
      <Text style={[styles.tipText, { color: c }]}>{tip.text}</Text>
    </View>
  );
}

// ── Suggested meal plan card ───────────────────────────────
function PlanCard({ item }) {
  return (
    <View style={styles.planCard}>
      <Text style={styles.planTitle}>{item.meal}</Text>
      {item.items.map((line, i) => (
        <View key={i} style={styles.planItem}>
          <Text style={{ color: colors.accent, marginRight: 6, marginTop: 1 }}>▸</Text>
          <Text style={styles.planItemText}>{line}</Text>
        </View>
      ))}
      {item.note ? <Text style={styles.planNote}>{item.note}</Text> : null}
    </View>
  );
}

// ── Main screen ────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const { state, dispatch } = useApp();
  const [refreshing, setRefreshing] = useState(false);

  const totals = (state.meals || []).reduce(
    (a, m) => ({
      cal:   a.cal   + +m.calories,
      pro:   a.pro   + +(m.protein_g || 0),
      carbs: a.carbs + +(m.carbs_g   || 0),
      fat:   a.fat   + +(m.fat_g     || 0),
      fib:   a.fib   + +(m.fiber_g   || 0),
    }),
    { cal: 0, pro: 0, carbs: 0, fat: 0, fib: 0 }
  );

  const t       = state.targets;
  const calMin  = +t.cal_min  || 1800;
  const calMax  = +t.cal_max  || 2200;
  const pct     = Math.min(100, Math.round((totals.cal / calMax) * 100));
  const ringClr = totals.cal > calMax ? colors.red : totals.cal >= calMin ? colors.green : colors.yellow;

  const remainText =
    totals.cal > calMax  ? `${Math.round(totals.cal - calMax)} kcal over limit`
    : totals.cal < calMin ? `${Math.round(calMin - totals.cal)} kcal below minimum`
    : `${Math.round(calMax - totals.cal)} kcal remaining`;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAllData(state.user.id, dispatch);
    setRefreshing(false);
  }, [state.user?.id]);

  const { tips, plan, top_foods } = state.recommendations;
  const hasRecs = tips.length > 0 || plan.length > 0;

  return (
    <SafeAreaView style={shared.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Greeting */}
        <View style={styles.header}>
          <Text style={styles.headerSub}>Good day,</Text>
          <Text style={styles.headerName}>{state.user?.name}</Text>
        </View>

        {/* Progress card */}
        <View style={shared.card}>
          <Text style={shared.label}>Today's Progress</Text>

          <View style={styles.ringRow}>
            <View style={{ position: 'relative', width: 110, height: 110, alignItems: 'center', justifyContent: 'center' }}>
              <CalorieRing pct={pct} ringColor={ringClr} />
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={[styles.ringPct, { color: ringClr }]}>{pct}%</Text>
                  <Text style={styles.ringOf}>of max</Text>
                </View>
              </View>
            </View>

            <View style={styles.ringInfo}>
              <Text style={[shared.bigNum, { fontSize: 38 }]}>{Math.round(totals.cal)}</Text>
              <Text style={shared.muted}>{calMin}–{calMax} kcal target</Text>
              <Text style={[styles.remainText, { color: ringClr }]}>{remainText}</Text>
            </View>
          </View>

          {/* Macro bars */}
          <View style={{ marginTop: 16 }}>
            <MacroBar label="🔥 Calories" value={totals.cal}   min={+t.cal_min||0}         max={+t.cal_max||2200}        color={colors.accent} />
            <MacroBar label="💪 Protein"  value={totals.pro}   min={+t.protein_min_g||0}   max={+t.protein_max_g||150}   color={colors.green} />
            <MacroBar label="🌾 Carbs"    value={totals.carbs} min={+t.carbs_min_g||0}     max={+t.carbs_max_g||300}     color={colors.yellow} />
            <MacroBar label="🥑 Fat"      value={totals.fat}   min={+t.fat_min_g||0}       max={+t.fat_max_g||100}       color={colors.orange} />
            <MacroBar label="🌿 Fiber"    value={totals.fib}   min={+t.fiber_min_g||25}    max={+t.fiber_max_g||40}      color={colors.purple} />
          </View>

          <View style={styles.legendRow}>
            <View style={styles.legendMarker} />
            <Text style={shared.muted}>Minimum goal marker</Text>
          </View>
        </View>

        {/* Recommendations */}
        <View style={shared.card}>
          <Text style={shared.label}>Smart Recommendations</Text>

          {!hasRecs ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <ActivityIndicator color={colors.accent} />
              <Text style={shared.muted}>Analysing your profile…</Text>
            </View>
          ) : (
            tips.map((tip, i) => <TipCard key={i} tip={tip} />)
          )}

          {plan.length > 0 && (
            <>
              <Text style={[shared.label, { marginTop: 16 }]}>🍽️ Today's Meal Plan</Text>
              {plan.map((p, i) => <PlanCard key={i} item={p} />)}
            </>
          )}

          {top_foods.length > 0 && (
            <>
              <Text style={[shared.label, { marginTop: 16 }]}>🔁 Most Eaten This Week</Text>
              <View style={styles.chipsRow}>
                {top_foods.map((f, i) => (
                  <View key={i} style={styles.chip}>
                    <Text style={{ color: colors.text, fontSize: 13 }}>{f.food_name} </Text>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>×{f.freq}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Log meal CTA */}
        <TouchableOpacity
          style={[shared.btnPrimary, { marginHorizontal: 16, marginBottom: 24 }]}
          onPress={() => navigation.navigate('Log Meal')}
        >
          <Text style={shared.btnPrimaryText}>+ Log a Meal</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header:        { padding: 16, paddingBottom: 4 },
  headerSub:     { color: colors.muted, fontSize: 13 },
  headerName:    { color: colors.text, fontSize: 28, fontWeight: '800' },

  ringRow:       { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ringPct:       { fontSize: 20, fontWeight: '800' },
  ringOf:        { fontSize: 11, color: colors.muted, marginTop: 2 },
  ringInfo:      { flex: 1 },
  remainText:    { fontSize: 14, fontWeight: '600', marginTop: 4 },

  macroLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  macroLabel:    { color: colors.text, fontSize: 13, fontWeight: '600' },

  // Bar uses two-layer approach: track (clipped), outer (for min marker)
  barOuter:      { position: 'relative', height: 16, justifyContent: 'center' },
  barTrack:      { height: 8, backgroundColor: colors.surface2, borderRadius: 4, overflow: 'hidden' },
  barFill:       { height: 8, borderRadius: 4 },
  minMarker:     { position: 'absolute', width: 2, height: 16, backgroundColor: 'rgba(248,250,252,0.5)', borderRadius: 1 },

  legendRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  legendMarker:  { width: 2, height: 14, backgroundColor: 'rgba(248,250,252,0.5)', borderRadius: 1 },

  tipCard:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 8 },
  tipText:       { flex: 1, fontSize: 13, lineHeight: 19 },

  planCard:      { backgroundColor: colors.surface2, borderRadius: 12, padding: 14, marginBottom: 10 },
  planTitle:     { color: colors.accent, fontWeight: '700', fontSize: 14, marginBottom: 8 },
  planItem:      { flexDirection: 'row', marginBottom: 5 },
  planItemText:  { color: colors.text, fontSize: 13, flex: 1, lineHeight: 18 },
  planNote:      { color: colors.muted, fontSize: 12, marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 7 },

  chipsRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip:          { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
});
