/**
 * معاينة شاشة الأرستقراطية — مطابقة لتصميم التطبيق
 */
import {
  ARISTOCRACY_THEME_OPTIONS,
  formatNumber,
  type ConfigAristocracy,
  type ConfigAristocracyLevel,
  type ConfigAristocracyPrivilege,
  type ConfigGift,
} from '@/services/admin';

const PREVIEW_BG = '#060D18';

function resolveAccent(level: ConfigAristocracyLevel): string {
  if (level.accentColor) return level.accentColor;
  return ARISTOCRACY_THEME_OPTIONS.find((t) => t.key === level.themeKey)?.accent ?? '#FFD700';
}

function PrivilegeThumb({ p, size = 48 }: { p: ConfigAristocracyPrivilege; size?: number }) {
  if (p.imageUrl) {
    return (
      <img
        src={p.imageUrl}
        alt=""
        style={{ width: size, height: size, objectFit: 'contain' }}
      />
    );
  }
  const video = p.videoUrl || p.videoUrlMp4;
  if (video) {
    return (
      <video
        src={video}
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: 8, background: '#000' }}
        muted
        loop
        autoPlay
        playsInline
      />
    );
  }
  return <div style={{ width: size, height: size, borderRadius: 8, background: 'rgba(255,255,255,0.08)' }} />;
}

export function AristocracyPreview({
  level,
  config,
  gifts,
  active = false,
}: {
  level: ConfigAristocracyLevel;
  config: ConfigAristocracy;
  gifts: ConfigGift[];
  active?: boolean;
}) {
  const accent = resolveAccent(level);
  const privileges = [...level.privileges]
    .filter((p) => p.enabled !== false)
    .sort((a, b) => a.order - b.order);
  const previewCards = privileges.filter((p) => p.layout === 'wide' || p.layout === 'half');
  const iconPrivileges = privileges.filter((p) => p.layout === 'icon');
  const exclusiveGifts = (level.exclusiveGiftIds ?? [])
    .map((id) => gifts.find((g) => g.id === id))
    .filter((g): g is ConfigGift => Boolean(g));

  const showSectionTitle = config.showPrivilegesSectionAr ?? 'إمتيازات العرض';
  const giftShopTitle = 'متجر الهدايا الحصرية';

  return (
    <div
      style={{
        position: 'relative',
        background: `linear-gradient(180deg, ${level.bgColors?.[0] ?? PREVIEW_BG} 0%, ${level.bgColors?.[2] ?? PREVIEW_BG} 100%)`,
        borderRadius: 16,
        border: active ? `2px solid ${accent}` : '1px solid rgba(255,255,255,0.1)',
        overflow: 'hidden',
        color: '#fff',
        fontFamily: 'inherit',
        maxWidth: 390,
        margin: '0 auto',
      }}
    >
      {level.backgroundImageUrl ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${level.backgroundImageUrl})`,
            backgroundSize: 'cover',
            opacity: 0.25,
            pointerEvents: 'none',
          }}
        />
      ) : null}

      <div style={{ position: 'relative', padding: '12px 14px 16px' }}>
        {/* Header mock */}
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{config.titleAr}</div>
          <div style={{ marginTop: 8, fontWeight: 700, fontSize: 17, color: '#fff' }}>{level.nameAr}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>غير مفعل</div>
        </div>

        {/* Preview cards — 2 columns */}
        {previewCards.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              marginBottom: 14,
            }}
          >
            {previewCards.map((p) => (
              <div
                key={p.id}
                style={{
                  background: 'rgba(10,22,52,0.88)',
                  borderRadius: 12,
                  border: `1px solid ${accent}44`,
                  padding: '10px 8px 12px',
                  minHeight: 132,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 72, width: '100%' }}>
                  <PrivilegeThumb p={p} size={64} />
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    textAlign: 'center',
                    lineHeight: 1.45,
                    minHeight: 32,
                    wordBreak: 'break-word',
                    width: '100%',
                  }}
                >
                  {p.titleAr}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Gift shop — 4 columns */}
        {exclusiveGifts.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.75)', marginBottom: 8 }}>
              {giftShopTitle}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {exclusiveGifts.map((g) => (
                <div
                  key={g.id}
                  style={{
                    background: 'rgba(10,22,52,0.85)',
                    borderRadius: 10,
                    border: `1px solid ${accent}44`,
                    padding: 6,
                    textAlign: 'center',
                    minHeight: 88,
                  }}
                >
                  {g.imageUrl ? (
                    <img src={g.imageUrl} alt="" style={{ width: 40, height: 40, objectFit: 'contain' }} />
                  ) : (
                    <div style={{ width: 40, height: 40, margin: '0 auto', background: 'rgba(255,255,255,0.08)', borderRadius: 8 }} />
                  )}
                  <div style={{ fontSize: 9, marginTop: 4, lineHeight: 1.35, minHeight: 24, wordBreak: 'break-word' }}>
                    {g.name}
                  </div>
                  <div style={{ fontSize: 9, color: '#FFE082', marginTop: 2 }}>{formatNumber(g.price)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Divider + emblem */}
        {iconPrivileges.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '12px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap' }}>
                {showSectionTitle}
              </span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
            </div>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              {level.imageUrl ? (
                <img src={level.imageUrl} alt="" style={{ width: 72, height: 72, objectFit: 'contain' }} />
              ) : null}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px 8px', marginBottom: 12 }}>
              {iconPrivileges.map((p) => (
                <div key={p.id} style={{ textAlign: 'center', minHeight: 92 }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      margin: '0 auto 6px',
                      background: `linear-gradient(180deg, ${accent}33, rgba(8,20,48,0.9))`,
                      border: '1px solid rgba(90,180,255,0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PrivilegeThumb p={p} size={28} />
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      lineHeight: 1.4,
                      minHeight: 42,
                      wordBreak: 'break-word',
                      padding: '0 2px',
                    }}
                  >
                    {p.titleAr}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Footer mock */}
        {!level.comingSoon && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
            <div
              style={{
                textAlign: 'center',
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(90,180,255,0.3)',
                background: `linear-gradient(90deg, ${accent}33, rgba(8,16,40,0.95))`,
                fontSize: 13,
                fontWeight: 700,
                color: '#FFE082',
                marginBottom: 8,
              }}
            >
              {formatNumber(level.activationCoins)} / {level.validityDays} أيام
            </div>
            <div style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.45)', marginBottom: 8 }}>
              {config.identityRulesAr ?? 'قيود الهوية'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div
                style={{
                  flex: 1,
                  padding: '10px 0',
                  borderRadius: 24,
                  border: '1.5px solid rgba(90,180,255,0.55)',
                  textAlign: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                أرسل
              </div>
              <div
                style={{
                  flex: 1.2,
                  padding: '10px 0',
                  borderRadius: 24,
                  background: '#F5D0A8',
                  color: '#1A1030',
                  textAlign: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                تفعيل
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
