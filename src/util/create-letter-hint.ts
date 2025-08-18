export function createLetterHint(
  correctWord: string,
  revealedPositions: number[],
) {
  return correctWord
    .split("")
    .map((char, index) => (revealedPositions.includes(index) ? char : "_"))
    .join(" ");
}
