import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp, refreshAllData } from '../context/AppContext';
import { colors, shared } from '../theme';

const SCREEN_W = Dimensions.get('window').width;
const CHART_H  = 140;

const METRICS = [
  { key: 'calories', label: 'Calories', color: colors.accent  },
  { key: 'protein',  label: 'Protein',  color: colors.green   },
  { key: 'carbs',    label: 'Carbs',    color: colors.yellow  },
  { key: 'fat',      label: 'Fat',      color: colors.orange  },
  { key: 'fiber',    label: 'Fiber',    color: colors.purple  },
];

function StatCard({ label, value, color, sub }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={shared.muted}>{sub}</Text> : null}
    </View>
  );
}

export default function AnalyticsScreen() {
  const { state, dispatch } = useApp();
  const [metric,      setMetric]      = useState('calories');
  const [summaryView, setSummaryView] = useState('weekly');
  const [refreshing,  setRefreshing]  = useState(false);

  const data      = state.weekData || [];
  const metricDef = METRICS.find(m => m.key === metric);
  const barColor  = metricDef?.color || colors.accent;
  const maxVal    = Math.max(...data.map(d => +d[metric] || 0), 1);

  const avgCal = data.length ? Math.round(data.reduce((a, d) => a + +d.calories, 0) / data.length) : 0;
  const avgPro = data.length ? Math.round(data.reduce((a, d) => a + +d.protein,  0) / data.length) : 0;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAllData(state.user.id, dispatch);
    setRefreshing(false);
  }, [state.user?.id]);

  const summary = summaryView === 'weekly' ? state.weeklySummary : state.monthlySummary;
  const s = summary?.stats;

  function fmtDay(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en', { weekday: 'short' });
  }

  function fmtFullDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en', {
      weekday: 'short', month: 'short', day: 'numeric',
    });
  }

  return (
    <SafeAreaView style={shared.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <Text style={styles.pageTitle}>Analytics</Text>

        {/* ── 7-Day Chart ── */}
        <View style={shared.card}>
          <Text style={shared.label}>7-Day Overview</Text>

          {/* Metric selector */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
            <View style={styles.metricRow}>
              {METRICS.map(m => (
                <TouchableOpacity
                  key={m.key}
                  style={[styles.metricBtn, metric === m.key && { backgroundColor: m.color + '28', borderColor: m.color }]}
                  onPress={() => setMetric(m.key)}
                >
                  <Text style={[styles.metricBtnTxt, metric === m.key && { color: m.color }]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {data.length === 0 ? (
            <Text style={[shared.muted, { textAlign: 'center', paddingVertical: 32 }]}>
              No data yet — start logging meals!
            </Text>
          ) : (
            <View style={styles.chartArea}>
              {data.map((d, i) => {
                const val = Math.round(+d[metric] || 0);
                const barH = Math.max(6, Math.round((val / maxVal) * CHART_H));
                return (
                  <View key={i} style={styles.barCol}>
                    <Text style={[styles.barVal, { color: barColor }]}>{val}</Text>
                    <View style={[styles.chartInner, { height: CHART_H }]}>
                      <View style={[styles.bar, { height: barH, backgroundColor: barColor }]} />
                    </View>
                    <Text style={styles.barDay}>{fmtDay(d.day)}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Quick stats ── */}
        <View style={styles.quickRow}>
          <View style={[shared.card, { flex: 1, marginRight: 6, marginHorizontal: 0 }]}>
            <Text style={shared.label}>Avg Cal / Day</Text>
            <Text style={[shared.bigNum, { color: colors.accent }]}>{avgCal}</Text>
            <Text style={shared.muted}>kcal</Text>
          </View>
          <View style={[shared.card, { flex: 1, marginLeft: 6, marginHorizontal: 0 }]}>
            <Text style={shared.label}>Avg Protein</Text>
            <Text style={[shared.bigNum, { color: colors.green }]}>{avgPro}g</Text>
            <Text style={shared.muted}>per day</Text>
          </View>
        </View>

        {/* ── Weekly / Monthly summary ── */}
        <View style={shared.card}>
          {/* Tab row */}
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryTitle}>Summary</Text>
            <View style={styles.summaryTabs}>
              {['weekly', 'monthly'].map(v => (
                <TouchableOpacity
                  key={v}
                  style={[styles.summaryTab, summaryView === v && styles.summaryTabActive]}
                  onPress={() => setSummaryView(v)}
                >
                  <Text style={[styles.summaryTabTxt, summaryView === v && styles.summaryTabTxtActive]}>
                    {v === 'weekly' ? 'This Week' : 'This Month'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {!s ? (
            <Text style={[shared.muted, { textAlign: 'center', paddingVertical: 24 }]}>
              No {summaryView} data yet. Keep logging!
            </Text>
          ) : (
            <View>
              {/* 3 key stats */}
              <View style={styles.statsRow}>
                <StatCard
                  label="Goal Hit Rate"
                  value={`${s.hit_rate}%`}
                  color={s.hit_rate >= 70 ? colors.green : s.hit_rate >= 40 ? colors.yellow : colors.red}
                  sub={`${s.hit_days} / ${s.logged_days} days`}
                />
                <StatCard
                  label="Avg Cal/Day"
                  value={s.avg_cal}
                  color={colors.accent}
                  sub={`Target: ${s.cal_target}`}
                />
                <StatCard
                  label="Trend"
                  value={s.trend}
                  color={s.trend === 'improving' ? colors.green : s.trend === 'stable' ? colors.accent : colors.yellow}
                  sub="vs first half"
                />
              </View>

              {/* Daily averages */}
              <Text style={[shared.label, { marginTop: 16 }]}>Daily Averages</Text>
              <View style={styles.avgRow}>
                {[
                  [s.avg_cal,             'kcal',    colors.accent],
                  [`${s.avg_protein}g`,   'Protein', colors.green],
                  [`${s.avg_carbs}g`,     'Carbs',   colors.yellow],
                  [`${s.avg_fat}g`,       'Fat',     colors.orange],
                  [`${s.avg_fiber}g`,     'Fiber',   colors.purple],
                ].map(([val, lbl, clr], i) => (
                  <View key={i} style={styles.avgItem}>
                    <Text style={[styles.avgVal, { color: clr }]}>{val}</Text>
                    <Text style={shared.muted}>{lbl}</Text>
                  </View>
                ))}
              </View>

              {/* Day breakdown */}
              <Text style={[shared.label, { marginTop: 16 }]}>Day Breakdown</Text>
              <View style={styles.breakdownRow}>
                {[
                  [s.hit_days,    'On Target',  colors.green],
                  [s.over_days,   'Over Limit', colors.red],
                  [s.under_days,  'Under Min',  colors.yellow],
                  [s.logged_days, 'Logged',     colors.text],
                ].map(([val, lbl, clr], i) => (
                  <View key={i} style={[styles.breakdownCard, { borderColor: clr + '44' }]}>
                    <Text style={[styles.breakdownVal, { color: clr }]}>{val}</Text>
                    <Text style={shared.muted}>{lbl}</Text>
                  </View>
                ))}
              </View>

              {/* Best / worst */}
              <Text style={[shared.label, { marginTop: 16 }]}>Highlights</Text>
              <View style={styles.highlightsRow}>
                <View style={[styles.highlightCard, { borderColor: colors.green + '44', backgroundColor: colors.green + '12' }]}>
                  <Text style={shared.muted}>🏆 Best Day</Text>
                  <Text style={styles.highlightDate}>{fmtFullDate(s.best_day?.day)}</Text>
                  <Text style={{ color: colors.green, fontWeight: '700', fontSize: 15 }}>{s.best_day?.calories} kcal</Text>
                </View>
                <View style={[styles.highlightCard, { borderColor: colors.yellow + '44', backgroundColor: colors.yellow + '12' }]}>
                  <Text style={shared.muted}>⚠️ Lowest Day</Text>
                  <Text style={styles.highlightDate}>{fmtFullDate(s.worst_day?.day)}</Text>
                  <Text style={{ color: colors.yellow, fontWeight: '700', fontSize: 15 }}>{s.worst_day?.calories} kcal</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pageTitle:       { color: colors.text, fontSize: 26, fontWeight: '800', padding: 16, paddingBottom: 8 },

  metricRow:       { flexDirection: 'row', gap: 7 },
  metricBtn:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface2 },
  metricBtnTxt:    { color: colors.muted, fontWeight: '600', fontSize: 13 },

  chartArea:       { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', marginBottom: 4 },
  barCol:          { alignItems: 'center', flex: 1 },
  barVal:          { fontSize: 10, fontWeight: '700', marginBottom: 4 },
  chartInner:      { justifyContent: 'flex-end', width: '72%' },
  bar:             { width: '100%', borderRadius: 5 },
  barDay:          { color: colors.muted, fontSize: 11, marginTop: 5 },

  quickRow:        { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12 },

  summaryHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  summaryTitle:    { color: colors.text, fontSize: 17, fontWeight: '800' },
  summaryTabs:     { flexDirection: 'row', gap: 6 },
  summaryTab:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.surface2 },
  summaryTabActive:{ backgroundColor: colors.accent + '28', borderWidth: 1, borderColor: colors.accent },
  summaryTabTxt:   { color: colors.muted, fontWeight: '600', fontSize: 12 },
  summaryTabTxtActive: { color: colors.accent },

  statsRow:        { flexDirection: 'row', gap: 8 },
  statCard:        { flex: 1, backgroundColor: colors.surface2, borderRadius: 10, padding: 12, alignItems: 'center' },
  statVal:         { fontSize: 18, fontWeight: '800', marginBottom: 3 },
  statLabel:       { color: colors.text, fontWeight: '600', fontSize: 12, marginBottom: 2, textAlign: 'center' },

  avgRow:          { flexDirection: 'row', gap: 6 },
  avgItem:         { flex: 1, backgroundColor: colors.surface2, borderRadius: 8, padding: 10, alignItems: 'center' },
  avgVal:          { fontSize: 14, fontWeight: '800', marginBottom: 3 },

  breakdownRow:    { flexDirection: 'row', gap: 6 },
  breakdownCard:   { flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  breakdownVal:    { fontSize: 20, fontWeight: '800', marginBottom: 3 },

  highlightsRow:   { flexDirection: 'row', gap: 8 },
  highlightCard:   { flex: 1, borderWidth: 1, borderRadius: 10, padding: 12 },
  highlightDate:   { color: colors.text, fontWeight: '700', marginVertical: 4, fontSize: 13 },
});
