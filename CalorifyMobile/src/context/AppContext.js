import React, { createContext, useContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, getLocalDate } from '../api';

const AppContext = createContext(null);

const initialState = {
  user:            null,
  targets:         {},
  meals:           [],
  weekData:        [],
  historyDays:     [],
  historyDate:     null,
  historyMeals:    [],
  recommendations: { tips: [], plan: [], top_foods: [] },
  weeklySummary:   null,
  monthlySummary:  null,
  loading:         true,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_USER':          return { ...state, user: action.payload, loading: false };
    case 'SET_TARGETS':       return { ...state, targets: action.payload };
    case 'SET_MEALS':         return { ...state, meals: action.payload };
    case 'SET_WEEK_DATA':     return { ...state, weekData: action.payload };
    case 'SET_HISTORY_DAYS':  return { ...state, historyDays: action.payload };
    case 'SET_HISTORY_DATE':  return { ...state, historyDate: action.payload };
    case 'SET_HISTORY_MEALS': return { ...state, historyMeals: action.payload };
    case 'SET_RECS':          return { ...state, recommendations: action.payload };
    case 'SET_WEEKLY':        return { ...state, weeklySummary: action.payload };
    case 'SET_MONTHLY':       return { ...state, monthlySummary: action.payload };
    case 'LOGOUT':            return { ...initialState, loading: false };
    default:                  return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Restore saved session on launch
  useEffect(() => {
    AsyncStorage.getItem('calorify_user').then(async raw => {
      if (raw) {
        const user = JSON.parse(raw);
        dispatch({ type: 'SET_USER', payload: user });
        const t = await api(`/targets/${user.id}`);
        if (t && !t.error) dispatch({ type: 'SET_TARGETS', payload: t });
        refreshAllData(user.id, dispatch);
      } else {
        dispatch({ type: 'SET_USER', payload: null });
      }
    }).catch(() => dispatch({ type: 'SET_USER', payload: null }));
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

export async function refreshAllData(userId, dispatch) {
  const today = getLocalDate();
  const [meals, week, hist, weekly, monthly] = await Promise.all([
    api(`/meals/user/${userId}?date=${today}`),
    api(`/analytics/${userId}`),
    api(`/history/${userId}`),
    api(`/summary/weekly/${userId}`),
    api(`/summary/monthly/${userId}`),
  ]);
  if (Array.isArray(meals))  dispatch({ type: 'SET_MEALS',        payload: meals });
  if (Array.isArray(week))   dispatch({ type: 'SET_WEEK_DATA',    payload: week });
  if (Array.isArray(hist))   dispatch({ type: 'SET_HISTORY_DAYS', payload: hist });
  if (weekly?.stats)         dispatch({ type: 'SET_WEEKLY',       payload: weekly });
  if (monthly?.stats)        dispatch({ type: 'SET_MONTHLY',      payload: monthly });
  loadRecommendations(userId, dispatch);
}

export async function loadRecommendations(userId, dispatch) {
  try {
    const recs = await api(`/recommendations/${userId}`);
    if (recs?.tips) dispatch({ type: 'SET_RECS', payload: recs });
  } catch (_) {}
}
