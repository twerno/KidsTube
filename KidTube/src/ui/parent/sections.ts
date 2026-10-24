/** Section keys of the parent index (ADR 0016). */
export type SectionKey =
  | 'pending'
  | 'library'
  | 'blocked'
  | 'add'
  | 'history'
  | 'schedule'
  | 'pin'
  | 'links'
  | 'database'
  | 'log';

export const SECTION_TITLE: Record<SectionKey, string> = {
  pending: 'Do zatwierdzenia',
  library: 'Biblioteka',
  blocked: 'Zablokowane',
  add: 'Dodaj film/kanał',
  history: 'Historia oglądania',
  schedule: 'Kontrola czasu oglądania',
  pin: 'Zmień kod rodzica',
  links: 'Powiąż z linkami YouTube',
  database: 'Baza danych',
  log: 'Log',
};
