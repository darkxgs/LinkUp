/**
 * شكل الكارد المقوس — من Friend Profile Shape.svg
 */
export const WAISTED_SHAPE_VIEW_W = 53;
export const WAISTED_SHAPE_VIEW_H = 54;

export const WAISTED_SHAPE_PATH =
  'M10.0007 0.5H42.1003C47.6866 0.500076 52.067 5.29704 51.5613 10.8604L50.1804 26.0498C50.123 26.682 50.123 27.318 50.1804 27.9502L51.5613 43.1396C52.067 48.703 47.6866 53.4999 42.1003 53.5H10.0007C4.4145 53.4999 0.0340393 48.703 0.539795 43.1396L1.92065 27.9502C1.9781 27.318 1.9781 26.682 1.92065 26.0498L0.539795 10.8604C0.0340392 5.29704 4.4145 0.500076 10.0007 0.5Z';

/** خلفية أيقونة سداسية — Profile Icon BG.svg */
export const PROFILE_HEX_ICON_PATH =
  'M0.091 9.189C-0.707 3.869 3.869 -0.707 9.189 0.091L19.299 1.607C20.085 1.725 20.885 1.725 21.672 1.607L31.782 0.091C37.102 -0.707 41.678 3.869 40.88 9.189L39.363 19.299C39.245 20.085 39.245 20.885 39.363 21.672L40.88 31.782C41.678 37.102 37.102 41.678 31.782 40.88L21.672 39.363C20.085 39.245 20.085 39.245 19.299 39.363L9.189 40.88C3.869 41.678 -0.707 37.102 0.091 31.782L1.607 21.672C1.725 20.885 1.725 20.085 1.607 19.299L0.091 9.189Z';

/** خطوط sunburst من مركز الأيقونة */
export function buildSunburstLines(cx = 11, cy = 27, count = 10, innerR = 6, outerR = 48): string[] {
  const lines: string[] = [];
  for (let i = 0; i < count; i++) {
    const a = (-Math.PI / 2) + (i / (count - 1)) * Math.PI * 0.85 - Math.PI * 0.425;
    const x1 = cx + Math.cos(a) * innerR;
    const y1 = cy + Math.sin(a) * innerR;
    const x2 = cx + Math.cos(a) * outerR;
    const y2 = cy + Math.sin(a) * outerR;
    lines.push(`M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`);
  }
  return lines;
}
