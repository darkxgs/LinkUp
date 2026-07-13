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
      { 
        to: adminPath('/call-usage'), 
        routePath: 'call-usage', 
        label: 'استهلاك دقائق المزوّد', 
        icon: Clock,
        subPermissions: [
          { key: 'call-usage:view', labelAr: 'عرض إحصائيات استهلاك الدقائق', labelEn: 'View call usage statistics' },
        ],
      },
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
      { 
        to: adminPath('/staff'), 
        routePath: 'staff', 
        label: 'موظفو التطبيق', 
        icon: UserCog,
        subPermissions: [
          { key: 'staff:view', labelAr: 'عرض قائمة الموظفين', labelEn: 'View staff list' },
          { key: 'staff:manage', labelAr: 'إضافة وتعديل صلاحيات الموظفين', labelEn: 'Manage staff roles and permissions' },
        ],
      },
      { 
        to: adminPath('/kyc-requests'), 
        routePath: 'kyc-requests', 
        label: 'طلبات التحقق من الهوية', 
        icon: ShieldCheck,
        subPermissions: [
          { key: 'kyc:view', labelAr: 'عرض طلبات التوثيق', labelEn: 'View KYC requests' },
          { key: 'kyc:approve', labelAr: 'الموافقة على طلبات التوثيق', labelEn: 'Approve KYC requests' },
          { key: 'kyc:reject', labelAr: 'رفض طلبات التوثيق', labelEn: 'Reject KYC requests' },
        ],
      },
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
      { 
        to: adminPath('/room-decor'), 
        routePath: 'room-decor', 
        label: 'تخصيص الروم (إطارات/خلفيات)', 
        icon: Frame,
        subPermissions: [
          { key: 'decor:view', labelAr: 'عرض عناصر تزيين الغرف', labelEn: 'View room decorations' },
          { key: 'decor:manage', labelAr: 'إضافة أو تعديل عناصر التزيين', labelEn: 'Manage room decorations' },
        ],
      },
      { 
        to: adminPath('/room-reactions'), 
        routePath: 'room-reactions', 
        label: 'الملصقات والتعبيرات (Stickers & Reactions)', 
        icon: Smile,
        subPermissions: [
          { key: 'reactions:view', labelAr: 'عرض قائمة التعبيرات', labelEn: 'View stickers and reactions' },
          { key: 'reactions:manage', labelAr: 'إضافة أو حذف التعبيرات', labelEn: 'Manage stickers and reactions' },
        ],
      },
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
      { 
        to: adminPath('/agency-levels'), 
        routePath: 'agency-levels', 
        label: 'مستويات الوكالة', 
        icon: TrendingUp,
        subPermissions: [
          { key: 'agency-levels:view', labelAr: 'عرض مستويات الوكالات', labelEn: 'View agency levels' },
          { key: 'agency-levels:edit', labelAr: 'تعديل متطلبات ومكافآت المستويات', labelEn: 'Edit levels requirements and rewards' },
        ],
      },
      { 
        to: adminPath('/agency-prince'), 
        routePath: 'agency-prince', 
        label: 'أمير الوكلاء', 
        icon: Crown,
        subPermissions: [
          { key: 'agency-prince:view', labelAr: 'عرض تفاصيل أمير الوكلاء', labelEn: 'View agency prince details' },
          { key: 'agency-prince:edit', labelAr: 'تعديل إعدادات أمير الوكلاء', labelEn: 'Edit agency prince settings' },
        ],
      },
      { 
        to: adminPath('/agency-applications'), 
        routePath: 'agency-applications', 
        label: 'طلبات فتح الوكالة', 
        icon: FileText,
        subPermissions: [
          { key: 'agency-apps:view', labelAr: 'عرض طلبات فتح الوكالات', labelEn: 'View agency applications' },
          { key: 'agency-apps:process', labelAr: 'معالجة طلبات الوكالات', labelEn: 'Process agency applications' },
        ],
      },
    ],
  },
  {
    title: 'المالية',
    items: [
      { 
        to: adminPath('/wallet'), 
        routePath: 'wallet', 
        label: 'الشحن والسحب', 
        icon: Wallet, 
        badge: '!',
        subPermissions: [
          { key: 'wallet:view', labelAr: 'عرض حركة المحفظة', labelEn: 'View wallet movements' },
          { key: 'wallet:adjust', labelAr: 'تعديل رصيد المستخدم يدوياً', labelEn: 'Manually adjust user balance' },
        ],
      },
      { 
        to: adminPath('/withdrawals'), 
        routePath: 'withdrawals', 
        label: 'طلبات السحب', 
        icon: ArrowUpFromLine,
        subPermissions: [
          { key: 'withdraw:view', labelAr: 'عرض طلبات السحب', labelEn: 'View withdrawal requests' },
          { key: 'withdraw:approve', labelAr: 'الموافقة على السحب', labelEn: 'Approve withdrawal' },
          { key: 'withdraw:reject', labelAr: 'رفض السحب', labelEn: 'Reject withdrawal' },
        ],
      },
      { 
        to: adminPath('/bot'), 
        routePath: 'bot', 
        label: 'بوت تيليغرام (شحن)', 
        icon: Bot,
        subPermissions: [
          { key: 'bot:view', labelAr: 'عرض إحصائيات البوت', labelEn: 'View bot stats' },
          { key: 'bot:config', labelAr: 'إعدادات البوت والعملات', labelEn: 'Configure bot settings' },
        ],
      },
      { 
        to: adminPath('/packages'), 
        routePath: 'packages', 
        label: 'باقات الشحن', 
        icon: Coins,
        subPermissions: [
          { key: 'packages:view', labelAr: 'عرض باقات الشحن', labelEn: 'View recharge packages' },
          { key: 'packages:manage', labelAr: 'تعديل أو حذف الباقات', labelEn: 'Manage recharge packages' },
        ],
      },
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
      { 
        to: adminPath('/lucky-bag'), 
        routePath: 'lucky-bag', 
        label: 'حقيبة الحظ', 
        icon: Package,
        subPermissions: [
          { key: 'lucky-bag:view', labelAr: 'عرض إعدادات حقيبة الحظ', labelEn: 'View lucky bag settings' },
          { key: 'lucky-bag:edit', labelAr: 'تعديل احتمالات وجوائز الحقيبة', labelEn: 'Edit bag rewards and probability' },
        ],
      },
      { 
        to: adminPath('/room-throne'), 
        routePath: 'room-throne', 
        label: 'عرش الغرفة', 
        icon: Crown,
        subPermissions: [
          { key: 'throne:view', labelAr: 'عرض إعدادات العرش', labelEn: 'View room throne settings' },
          { key: 'throne:edit', labelAr: 'تعديل إعدادات وتكلفة العرش', labelEn: 'Edit throne configuration' },
        ],
      },
      { 
        to: adminPath('/vip'), 
        routePath: 'vip', 
        label: 'العضويات VIP', 
        icon: Crown,
        subPermissions: [
          { key: 'vip:view', labelAr: 'عرض مستويات VIP', labelEn: 'View VIP levels' },
          { key: 'vip:edit', labelAr: 'تعديل مزايا وأسعار VIP', labelEn: 'Edit VIP benefits and prices' },
        ],
      },
      { 
        to: adminPath('/aristocracy'), 
        routePath: 'aristocracy', 
        label: 'الأرستقراطية', 
        icon: Crown,
        subPermissions: [
          { key: 'aristocracy:view', labelAr: 'عرض مستويات الأرستقراطية', labelEn: 'View aristocracy levels' },
          { key: 'aristocracy:edit', labelAr: 'تعديل إعدادات الأرستقراطية', labelEn: 'Edit aristocracy configuration' },
        ],
      },
      { 
        to: adminPath('/rewards-center'), 
        routePath: 'rewards-center', 
        label: 'مركز المكافآت', 
        icon: Gift,
        subPermissions: [
          { key: 'rewards:view', labelAr: 'عرض المكافآت', labelEn: 'View rewards' },
          { key: 'rewards:edit', labelAr: 'إدارة المكافآت المتاحة', labelEn: 'Manage rewards' },
        ],
      },
      { 
        to: adminPath('/host-tasks'), 
        routePath: 'host-tasks', 
        label: 'مهام المضيفة', 
        icon: Award,
        subPermissions: [
          { key: 'tasks:view', labelAr: 'عرض مهام المضيفات', labelEn: 'View host tasks' },
          { key: 'tasks:edit', labelAr: 'تعديل المهام والرواتب', labelEn: 'Edit tasks and salaries' },
        ],
      },
      { 
        to: adminPath('/titles'), 
        routePath: 'titles', 
        label: 'الألقاب (لقبي)', 
        icon: Award,
        subPermissions: [
          { key: 'titles:view', labelAr: 'عرض قائمة الألقاب', labelEn: 'View titles list' },
          { key: 'titles:manage', labelAr: 'إضافة أو حذف ألقاب', labelEn: 'Manage titles' },
        ],
      },
      { 
        to: adminPath('/gift-privileges'), 
        routePath: 'gift-privileges', 
        label: 'منح الامتيازات', 
        icon: Sparkles,
        subPermissions: [
          { key: 'privileges:view', labelAr: 'عرض الامتيازات الممنوحة', labelEn: 'View granted privileges' },
          { key: 'privileges:manage', labelAr: 'منح أو سحب امتيازات', labelEn: 'Grant/revoke privileges' },
        ],
      },
      { 
        to: adminPath('/privacy'), 
        routePath: 'privacy', 
        label: 'الخصوصية', 
        icon: ShieldCheck,
        subPermissions: [
          { key: 'privacy:view', labelAr: 'عرض إعدادات الخصوصية', labelEn: 'View privacy settings' },
          { key: 'privacy:edit', labelAr: 'تعديل قواعد الخصوصية', labelEn: 'Edit privacy rules' },
        ],
      },
      { 
        to: adminPath('/call-pricing'), 
        routePath: 'call-pricing', 
        label: 'تسعير المكالمات والمطابقة', 
        icon: Phone,
        subPermissions: [
          { key: 'call-price:view', labelAr: 'عرض تسعير المكالمات', labelEn: 'View call pricing' },
          { key: 'call-price:edit', labelAr: 'تعديل أسعار المكالمات', labelEn: 'Edit call pricing' },
        ],
      },
    ],
  },
  {
    title: 'المحتوى',
    items: [
      { 
        to: adminPath('/posts'), 
        routePath: 'posts', 
        label: 'المنشورات / اللحظات', 
        icon: FileText,
        subPermissions: [
          { key: 'posts:view', labelAr: 'عرض المنشورات', labelEn: 'View posts' },
          { key: 'posts:delete', labelAr: 'حذف المنشورات المخالفة', labelEn: 'Delete inappropriate posts' },
        ],
      },
      { 
        to: adminPath('/games'), 
        routePath: 'games', 
        label: 'الألعاب', 
        icon: Gamepad2,
        subPermissions: [
          { key: 'games:view', labelAr: 'عرض قائمة الألعاب', labelEn: 'View games list' },
          { key: 'games:manage', labelAr: 'تفعيل أو إيقاف الألعاب', labelEn: 'Enable/disable games' },
        ],
      },
      { 
        to: adminPath('/relationships'), 
        routePath: 'relationships', 
        label: 'العلاقات', 
        icon: Heart,
        subPermissions: [
          { key: 'relations:view', labelAr: 'عرض العلاقات', labelEn: 'View relationships' },
          { key: 'relations:manage', labelAr: 'إدارة وتعديل العلاقات', labelEn: 'Manage relationships' },
        ],
      },
      { 
        to: adminPath('/chat-backgrounds'), 
        routePath: 'chat-backgrounds', 
        label: 'خلفيات المحادثة', 
        icon: Layers,
        subPermissions: [
          { key: 'chat-bg:view', labelAr: 'عرض خلفيات المحادثة', labelEn: 'View chat backgrounds' },
          { key: 'chat-bg:manage', labelAr: 'إضافة أو تعديل الخلفيات', labelEn: 'Manage chat backgrounds' },
        ],
      },
      { 
        to: adminPath('/notifications'), 
        routePath: 'notifications', 
        label: 'إشعارات المستخدمين', 
        icon: Bell,
        subPermissions: [
          { key: 'notify:send', labelAr: 'إرسال إشعار عام', labelEn: 'Send global notification' },
        ],
      },
      { 
        to: adminPath('/about-pages'), 
        routePath: 'about-pages', 
        label: 'حول التطبيق', 
        icon: FileText,
        subPermissions: [
          { key: 'about:edit', labelAr: 'تعديل صفحات حول التطبيق', labelEn: 'Edit about pages' },
        ],
      },
      { 
        to: adminPath('/support'), 
        routePath: 'support', 
        label: 'مركز الدعم', 
        icon: Headphones,
        subPermissions: [
          { key: 'support:view', labelAr: 'عرض رسائل الدعم', labelEn: 'View support messages' },
          { key: 'support:reply', labelAr: 'الرد على رسائل الدعم', labelEn: 'Reply to support messages' },
        ],
      },
      { 
        to: adminPath('/reports'), 
        routePath: 'reports', 
        label: 'البلاغات', 
        icon: Flag,
        subPermissions: [
          { key: 'reports:view', labelAr: 'عرض البلاغات', labelEn: 'View reports' },
          { key: 'reports:process', labelAr: 'معالجة واتخاذ إجراء بشأن البلاغات', labelEn: 'Process and take action on reports' },
        ],
      },
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
