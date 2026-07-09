/**
 * RtlIcons — نسخ من أيقونات الاتجاه (lucide) تنقلب تلقائياً في الوضع العربي (RTL).
 *
 * المشكلة: أيقونات SVG لا تنعكس مع I18nManager.swapLeftAndRightInRTL،
 * فيظل سهم الرجوع (ChevronLeft) لليسار حتى في العربية حيث يجب أن يكون لليمين.
 *
 * الحل: نعكس الأيقونة أفقياً (scaleX: -1) عندما يكون التطبيق RTL.
 * الاستخدام كبديل مباشر — نفس اسم الأيقونة ونفس الـ props تماماً:
 *   import { ChevronLeft } from '@/components/ui/RtlIcons';
 *   <ChevronLeft size={22} color="#000" />
 *
 * الأيقونات غير الاتجاهية تبقى مستوردة من 'lucide-react-native' كالعادة.
 */

import React from 'react';
import { I18nManager, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '@/localization/i18n';
import {
  ChevronLeft as LuChevronLeft,
  ChevronRight as LuChevronRight,
  ArrowLeft as LuArrowLeft,
  ArrowRight as LuArrowRight,
  ArrowUpRight as LuArrowUpRight,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react-native';

/**
 * يلفّ أيقونة lucide ويعكسها أفقياً في RTL عبر style.transform (دون View إضافي).
 * نستخدم forwardRef لإبقاء النوع متوافقاً مع LucideIcon (ForwardRefExoticComponent)
 * حتى يمكن تمريرها كقيمة لمكوّنات تتوقّع أيقونة lucide.
 */
function rtlAware(Icon: LucideIcon): LucideIcon {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Comp = Icon as React.ComponentType<any>;
  const Wrapped = React.forwardRef<unknown, LucideProps>(({ style, ...props }, ref) => {
    useTranslation();
    const isRtl = I18nManager.isRTL || i18n.language?.startsWith('ar') === true;
    if (isRtl) {
      return (
        <View style={[{ transform: [{ scaleX: -1 }] }, style]}>
          <Comp ref={ref} {...props} />
        </View>
      );
    }
    return <Comp ref={ref} style={style} {...props} />;
  });
  Wrapped.displayName = `Rtl(${(Icon as { displayName?: string }).displayName ?? 'Icon'})`;
  return Wrapped as unknown as LucideIcon;
}

export const ChevronLeft = rtlAware(LuChevronLeft);
export const ChevronRight = rtlAware(LuChevronRight);
export const ArrowLeft = rtlAware(LuArrowLeft);
export const ArrowRight = rtlAware(LuArrowRight);
export const ArrowUpRight = rtlAware(LuArrowUpRight);
