const LAYOUT = {
  SEAT_W: 120,
  SEAT_H: 80,
  SEAT_BORDER_W: 2,
  COL_GAP: 16,
  ROW_GAP: 12,
  ROW_NUMBER_W: 32,
  GROUP_GAP: 40,
  LABEL_H: 47,
  PODIUM_ROW_H: 84,
  PODIUM_GAP: 18,
  PAD_L: 20,
  PAD_T: 30
}

export function useLayoutConstants() {
  return {
    LAYOUT
  }
}
