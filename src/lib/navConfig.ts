import {
  LayoutDashboard,
  Users,
  Radio,
  Building2,
  Wallet,
  Gift,
  Crown,
  Award,
  Coins,
  Gamepad2,
  Heart,
  FileText,
  TrendingUp,
  Settings,
  Sparkles,
  Bell,
  History,
  ArrowUpFromLine,
  Package,
  ShoppingBag,
  Headphones,
  Phone,
  ShieldCheck,
  Flag,
  Frame,
  Layers,
  Clock,
  Smartphone,
  UserCog,
  Smile,
  Bot,
  type LucideIcon,
} from 'lucide-react';
import { ADMIN_BASE, adminPath } from '@/lib/adminPaths';
import type { PermissionKey } from '@/services/admin';

export interface SubPermission {
  key: string;
  labelAr: string;
  labelEn: string;
}

export interface NavItem {
  to: string;
  routePath: string;
  label: string;
  icon: LucideIcon;
  superOnly?: boolean;
  end?: boolean;
  badge?: string;
  subPermissions?: SubPermission[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * كل صفحة (routePath) هي صلاحية مستقلة بذاتها — لا تجميع في حزم واسعة.
 * routePath == مفتاح الصلاحية (PermissionKey) لتفادي أي انحراف بين القائمة والحراسة.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'عام',
    items: [
      { to: ADMIN_BASE, routePath: '', label: 'لوحة المعلومات', icon: LayoutDashboard, end: true },
      {
        to: adminPath('/analytics'),
        routePath: 'analytics',
        label: 'الإحصائيات والأرباح',
        icon: TrendingUp,
        subPermissions: [
          { key: 'analytics:widgets', labelAr: 'عرض ملخص البطاقات (الكروت الماليّة)', labelEn: 'Show summary widgets' },
          { key: 'analytics:charts', labelAr: 'عرض الرسوم البيانية والاتجاهات', labelEn: 'Show charts and trends' },
        ],
      },
      { to: adminPath('/call-usage'), routePath: 'call-usage', label: 'استهلاك دقائق المزوّد', icon: Clock },
    ],
  },
  {
    title: 'الإدارة',
    items: [
      {
        to: adminPath('/users'),
        routePath: 'users',
        label: 'المستخدمون',
        icon: Users,
        subPermissions: [
          { key: 'users:view', labelAr: 'عرض قائمة جدول المستخدمين', labelEn: 'View users list table' },
          { key: 'users:details', labelAr: 'عرض صفحة ملف المستخدم التفصيلي', labelEn: 'View user full profile page' },
          { key: 'users:add', labelAr: 'إضافة مستخدم جديد', labelEn: 'Create new user account' },
          { key: 'users:edit', labelAr: 'تعديل بيانات المستخدم', labelEn: 'Edit user profile data' },
          { key: 'users:delete', labelAr: 'حذف مستخدم نهائياً', labelEn: 'Delete user permanently' },
          { key: 'users:ban', labelAr: 'حظر وتعليق المستخدمين', labelEn: 'Ban and suspend users' },
          { key: 'users:notify', labelAr: 'إرسال إشعار للمستخدم', labelEn: 'Send push notification to user' },
          { key: 'users:export', labelAr: 'تصدير قائمة المستخدمين بصيغة CSV', labelEn: 'Export users list to CSV' },
          { key: 'users:sync', labelAr: 'مزامنة المعرّفات القديمة للبحث', labelEn: 'Synchronize legacy account IDs' },
        ],
      },
      { to: adminPath('/staff'), routePath: 'staff', label: 'موظفو التطبيق', icon: UserCog },
      { to: adminPath('/kyc-requests'), routePath: 'kyc-requests', label: 'طلبات التحقق من الهوية', icon: ShieldCheck },
    ],
  },
  {
    title: 'الغرف الصوتية المباشرة',
    items: [
      {
        to: adminPath('/rooms'),
        routePath: 'rooms',
        label: 'الغرف الصوتية',
        icon: Radio,
        subPermissions: [
          { key: 'rooms:view', labelAr: 'عرض قائمة الغرف الصوتية', labelEn: 'View voice rooms list' },
          { key: 'rooms:lock', labelAr: 'قفل وفتح الغرفة الصوتية', labelEn: 'Lock/unlock voice rooms' },
          { key: 'rooms:close', labelAr: 'إغلاق الغرفة بالقوة من الإدارة', labelEn: 'Force close voice rooms' },
          { key: 'rooms:delete', labelAr: 'حذف الغرفة ومسح بياناتها', labelEn: 'Delete voice rooms permanently' },
          { key: 'rooms:seats', labelAr: 'تعديل عدد مقاعد المايك للغرفة', labelEn: 'Change room microphone seats count' },
        ],
      },
      { to: adminPath('/room-decor'), routePath: 'room-decor', label: 'تخصيص الروم (إطارات/خلفيات)', icon: Frame },
      { to: adminPath('/room-reactions'), routePath: 'room-reactions', label: 'الملصقات والتعبيرات (Stickers & Reactions)', icon: Smile },
    ],
  },
  {
    title: 'الوكالات',
    items: [
      {
        to: adminPath('/agencies'),
        routePath: 'agencies',
        label: 'الوكالات',
        icon: Building2,
        subPermissions: [
          { key: 'agencies:view', labelAr: 'عرض قائمة الوكالات', labelEn: 'View agencies list' },
          { key: 'agencies:edit', labelAr: 'تعديل تفاصيل الوكالة وأعضائها', labelEn: 'Edit agency details and members' },
          { key: 'agencies:delete', labelAr: 'حذف الوكالة نهائياً', labelEn: 'Delete agency permanently' },
          { key: 'agencies:approve', labelAr: 'قبول طلبات فتح الوكالات الجديدة', labelEn: 'Approve new agency applications' },
          { key: 'agencies:reject', labelAr: 'رفض طلبات فتح الوكالات الجديدة', labelEn: 'Reject new agency applications' },
        ],
      },
      { to: adminPath('/agency-levels'), routePath: 'agency-levels', label: 'مستويات الوكالة', icon: TrendingUp },
      { to: adminPath('/agency-prince'), routePath: 'agency-prince', label: 'أمير الوكلاء', icon: Crown },
      { to: adminPath('/agency-applications'), routePath: 'agency-applications', label: 'طلبات فتح الوكالة', icon: FileText },
    ],
  },
  {
    title: 'المالية',
    items: [
      { to: adminPath('/wallet'), routePath: 'wallet', label: 'الشحن والسحب', icon: Wallet, badge: '!' },
      { to: adminPath('/withdrawals'), routePath: 'withdrawals', label: 'طلبات السحب', icon: ArrowUpFromLine },
      { to: adminPath('/bot'), routePath: 'bot', label: 'بوت تيليغرام (شحن)', icon: Bot },
      { to: adminPath('/packages'), routePath: 'packages', label: 'باقات الشحن', icon: Coins },
      {
        to: adminPath('/gifts'),
        routePath: 'gifts',
        label: 'الهدايا',
        icon: Gift,
        subPermissions: [
          { key: 'gifts:view', labelAr: 'عرض قائمة الهدايا', labelEn: 'View gifts config list' },
          { key: 'gifts:add', labelAr: 'إضافة هدية جديدة للمتجر', labelEn: 'Add new gift item' },
          { key: 'gifts:edit', labelAr: 'تعديل أسعار وهياكل الهدايا', labelEn: 'Edit gift prices and configurations' },
          { key: 'gifts:delete', labelAr: 'حذف هدية من المتجر', labelEn: 'Delete gift item' },
        ],
      },
      {
        to: adminPath('/store'),
        routePath: 'store',
        label: 'متجر التطبيق',
        icon: ShoppingBag,
        subPermissions: [
          { key: 'store:view', labelAr: 'عرض تصنيفات وعناصر المتجر', labelEn: 'View store items and categories' },
          { key: 'store:add', labelAr: 'إضافة عنصر جديد لمتجر التطبيق', labelEn: 'Add new store item' },
          { key: 'store:edit', labelAr: 'تعديل تفاصيل وأسعار عناصر المتجر', labelEn: 'Edit store items details and pricing' },
          { key: 'store:delete', labelAr: 'حذف عنصر من متجر التطبيق', labelEn: 'Delete store item' },
        ],
      },
      { to: adminPath('/lucky-bag'), routePath: 'lucky-bag', label: 'حقيبة الحظ', icon: Package },
      { to: adminPath('/room-throne'), routePath: 'room-throne', label: 'عرش الغرفة', icon: Crown },
      { to: adminPath('/vip'), routePath: 'vip', label: 'العضويات VIP', icon: Crown },
      { to: adminPath('/aristocracy'), routePath: 'aristocracy', label: 'الأرستقراطية', icon: Crown },
      { to: adminPath('/rewards-center'), routePath: 'rewards-center', label: 'مركز المكافآت', icon: Gift },
      { to: adminPath('/host-tasks'), routePath: 'host-tasks', label: 'مهام المضيفة', icon: Award },
      { to: adminPath('/titles'), routePath: 'titles', label: 'الألقاب (لقبي)', icon: Award },
      { to: adminPath('/gift-privileges'), routePath: 'gift-privileges', label: 'منح الامتيازات', icon: Sparkles },
      { to: adminPath('/privacy'), routePath: 'privacy', label: 'الخصوصية', icon: ShieldCheck },
      { to: adminPath('/call-pricing'), routePath: 'call-pricing', label: 'تسعير المكالمات والمطابقة', icon: Phone },
    ],
  },
  {
    title: 'المحتوى',
    items: [
      { to: adminPath('/posts'), routePath: 'posts', label: 'المنشورات / اللحظات', icon: FileText },
      { to: adminPath('/games'), routePath: 'games', label: 'الألعاب', icon: Gamepad2 },
      { to: adminPath('/relationships'), routePath: 'relationships', label: 'العلاقات', icon: Heart },
      { to: adminPath('/chat-backgrounds'), routePath: 'chat-backgrounds', label: 'خلفيات المحادثة', icon: Layers },
      { to: adminPath('/notifications'), routePath: 'notifications', label: 'إشعارات المستخدمين', icon: Bell },
      { to: adminPath('/about-pages'), routePath: 'about-pages', label: 'حول التطبيق', icon: FileText },
      { to: adminPath('/support'), routePath: 'support', label: 'مركز الدعم', icon: Headphones },
      { to: adminPath('/reports'), routePath: 'reports', label: 'البلاغات', icon: Flag },
    ],
  },
  {
    title: 'النظام',
    items: [
      { to: adminPath('/admins'), routePath: 'admins', label: 'المشرفون والصلاحيات', icon: ShieldCheck, superOnly: true },
      { to: adminPath('/logs'), routePath: 'logs', label: 'سجل النشاط', icon: History, superOnly: true },
      {
        to: adminPath('/settings'),
        routePath: 'settings',
        label: 'الإعدادات',
        icon: Settings,
        subPermissions: [
          { key: 'settings:general', labelAr: 'تعديل الإعدادات العامة (الاقتصاد الأساسي)', labelEn: 'Edit general economy settings' },
          { key: 'settings:commissions', labelAr: 'تعديل عمولات التطبيق والتحويل', labelEn: 'Edit platform commissions' },
          { key: 'settings:exchange', labelAr: 'تعديل معدّلات تحويل العملات', labelEn: 'Edit exchange rates' },
          { key: 'settings:withdraw', labelAr: 'تعديل شروط وقواعد السحب المالي', labelEn: 'Edit withdrawal rules' },
          { key: 'settings:system', labelAr: 'التحكم بحالة الصيانة والتسجيل العام', labelEn: 'Control maintenance and registration' },
          { key: 'settings:moderation', labelAr: 'إدارة فلتر محتوى الدردشة الخاصة', labelEn: 'Manage chat content moderation filter' },
          { key: 'settings:performance', labelAr: 'تعديل مؤقّتات الأداء والمزامنة للتطبيق', labelEn: 'Configure app performance and sync timings' },
        ],
      },
      { to: adminPath('/app-release'), routePath: 'app-release', label: 'إصدار التطبيق (APK)', icon: Smartphone },
    ],
  },
];

/** كل عنصر غير superOnly وله routePath غير فارغ يحصل تلقائياً على صلاحية بنفس اسم الـroutePath. */
function permKeyFor(item: NavItem): PermissionKey | undefined {
  if (item.superOnly || !item.routePath) return undefined;
  return item.routePath as PermissionKey;
}

/** خريطة routePath -> صلاحية الوصول، تُستخدم من App.tsx لحراسة الروابط المباشرة ومن Sidebar لإخفاء الروابط. */
export const PAGE_PERMISSIONS: Record<string, { perm?: PermissionKey; superOnly?: boolean }> =
  Object.fromEntries(
    NAV_SECTIONS.flatMap((section) =>
      section.items.map((item) => [item.routePath, { perm: permKeyFor(item), superOnly: item.superOnly }]),
    ),
  );

/** يُستخدم من Sidebar لمعرفة صلاحية عنصر تنقّل مباشرةً بدون إعادة اشتقاقه. */
export function navItemPerm(item: NavItem): PermissionKey | undefined {
  return permKeyFor(item);
}
