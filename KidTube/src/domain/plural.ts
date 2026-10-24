/** Polish plural labels shared by both worlds. */

/** `1 film`, `2 filmy`, `5 filmów`, `22 filmy`, `12 filmów`. */
export function filmsLabel(count: number): string {
  if (count === 1) {
    return '1 film';
  }
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} filmy`;
  }
  return `${count} filmów`;
}
