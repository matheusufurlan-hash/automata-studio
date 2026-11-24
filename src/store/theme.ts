/**
 * Tema claro/escuro.
 * Ordem: `?theme=dark|light` na URL (força) → escolha salva no localStorage →
 * preferência do sistema → claro.
 * Aplica em <html data-theme="...">, que troca os tokens de src/styles/index.css.
 */
import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'automatos-studio:tema';

function isTheme(v: unknown): v is Theme {
  return v === 'light' || v === 'dark';
}

function initialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  try {
    const forced = new URLSearchParams(window.location.search).get('theme');
    if (isTheme(forced)) return forced;
  } catch {
    /* URL inválida: ignora */
  }
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isTheme(saved)) return saved;
  } catch {
    /* localStorage bloqueado: ignora */
  }
  try {
    if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    /* sem matchMedia */
  }
  return 'light';
}

function apply(theme: Theme) {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme;
}

interface ThemeState {
  theme: Theme;
  setTheme(theme: Theme): void;
  toggle(): void;
}

export const useTheme = create<ThemeState>()((set, get) => ({
  theme: initialTheme(),
  setTheme(theme) {
    apply(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* localStorage bloqueado: só não lembra */
    }
    set({ theme });
  },
  toggle() {
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark');
  },
}));

apply(useTheme.getState().theme);
