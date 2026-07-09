/**
 * Avatar افتراضي محلي (data-URI/SVG) — بديل عن روابط خارجية (i.pravatar.cc / picsum.photos)
 * يتجنّب طلبات شبكة خارجية ويعمل بلا اتصال.
 */
export const AVATAR_FALLBACK =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">' +
      '<rect width="80" height="80" fill="#E5E7EB"/>' +
      '<circle cx="40" cy="30" r="15" fill="#9CA3AF"/>' +
      '<path d="M16 70c0-13 11-22 24-22s24 9 24 22z" fill="#9CA3AF"/>' +
    '</svg>',
  );
