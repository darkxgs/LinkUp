/** الدومين الرسمي لروابط المشاركة و Deep Linking */
export const SHARE_LINK_BASE = 'https://linkuplivechat.com';

export const SHARE_LINK_EXAMPLE = `${SHARE_LINK_BASE}/r/abc1234`;

/** Cloud Function — إعادة توجيه /r/{code} من Vercel */
export const SHARE_REDIRECT_FUNCTION =
  'https://us-central1-linkup-dc45f.cloudfunctions.net/shareRedirect';
