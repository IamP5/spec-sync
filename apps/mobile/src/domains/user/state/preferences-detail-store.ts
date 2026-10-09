import { useEffect } from 'react';
import { Uniwind } from 'uniwind';
import { create } from 'zustand';

import { useSession } from '../../auth/api/session';
import { DEFAULT_PREFERENCES, type Preferences } from '../data/preferences';
import {
  loadPreferences,
  savePreferences,
} from '../data/user-preferences-client';

interface PreferencesState {
  /** Whose preferences these are; `null` while signed out (defaults). */
  uid: string | null;
  preferences: Preferences;
  error: string;
}

const usePreferencesState = create<PreferencesState>(() => ({
  uid: null,
  preferences: DEFAULT_PREFERENCES,
  error: '',
}));

function applyTheme(theme: Preferences['theme']): void {
  Uniwind.setTheme(theme);
}

/**
 * The signed-in user's preferences (web `PreferencesDetailStore`): read from
 * the device when a user is established, reset to the defaults on sign-out,
 * saved on every change. The theme is applied to the design system here.
 */
export function usePreferencesDetailStore() {
  const uid = useSession().scope?.uid ?? null;
  const { preferences, error } = usePreferencesState();

  useEffect(() => {
    if (usePreferencesState.getState().uid === uid) return;
    const next = uid ? loadPreferences(uid) : DEFAULT_PREFERENCES;
    usePreferencesState.setState({ uid, preferences: next, error: '' });
    applyTheme(next.theme);
  }, [uid]);

  function update(changes: Partial<Preferences>): void {
    const state = usePreferencesState.getState();
    if (!state.uid) return;
    const next = { ...state.preferences, ...changes };
    const saved = savePreferences(state.uid, next);
    usePreferencesState.setState({
      preferences: next,
      error: saved ? '' : 'This device could not save this preference.',
    });
    if (changes.theme) applyTheme(changes.theme);
  }

  return { ...preferences, error, signedIn: uid !== null, update };
}
