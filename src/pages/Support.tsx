import { useEffect, useRef, useState } from 'react';
import {
  Headphones, Search, Send, MessageCircle, User, RefreshCw, Building2, Coins,
} from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import { CopyableId } from '@/components/CopyableId';
import {
  subscribeSupportConversations,
  subscribeSupportMessages,
  sendSupportReply,
  markSupportConversationRead,
  countUnreadSupport,
  SUPPORT_UID,
  type SupportConversation,
  type SupportMessage,
} from '@/services/supportChat';
import { SupportMessageBubble } from '@/components/support/SupportMessageBubble';
import { logAdminAction, timeAgo } from '@/services/admin';

const QUICK_REPLIES = [
  'مرحباً، كيف يمكننا مساعدتك اليوم؟',
  'شكراً لتواصلك. فريقنا يراجع طلبك وسنرد قريباً.',
  'لطلب فتح وكالة: افتح مركز الوكالة ← تقديم طلب من التطبيق.',
  'تم استلام بلاغك. سنراجع الحالة خلال 24 ساعة.',
];

export default function SupportPage() {
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);
  const [filterRecharge, setFilterRecharge] = useState(false);
  const [selected, setSelected] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeSupportConversations((list) => {
      setConversations(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    void markSupportConversationRead(selected.id);
    const unsub = subscribeSupportMessages(selected.id, setMessages);
    return unsub;
  }, [selected?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const unreadTotal = countUnreadSupport(conversations);

  const filtered = conversations.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchSearch =
      !q ||
      c.userName.toLowerCase().includes(q) ||
      c.userUid.toLowerCase().includes(q) ||
      (c.userPublicAccountId ?? '').includes(q) ||
      c.lastMessage.toLowerCase().includes(q);
    const matchUnread = !filterUnread || c.unreadCount > 0;
    const matchRecharge = !filterRecharge || c.supportTopic === 'recharge';
    return matchSearch && matchUnread && matchRecharge;
  });

  const handleSend = async () => {
    if (!selected || !reply.trim() || sending) return;
    setSending(true);
    try {
      await sendSupportReply(selected.id, selected.userUid, reply);
      await logAdminAction('رد دعم', selected.userName, selected.userUid);
      setReply('');
    } catch (e: any) {
      alert(e?.message ?? 'فشل إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page-container support-page">
      <div className="agency-page-header">
        <div>
          <h1>
            <Headphones size={28} style={{ verticalAlign: 'middle', marginLeft: 8 }} />
            مركز الدعم
          </h1>
          <p>محادثات المستخدمين مع حساب الدعم الرسمي ({SUPPORT_UID})</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {unreadTotal > 0 && (
            <Badge variant="danger">{unreadTotal} غير مقروء</Badge>
          )}
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setFilterRecharge((v) => !v)}
          >
            {filterRecharge ? 'كل الطلبات' : 'طلبات الشحن فقط'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setFilterUnread((v) => !v)}
          >
            {filterUnread ? 'عرض الكل' : 'غير المقروء فقط'}
          </button>
        </div>
      </div>

      <div className="support-layout">
        <aside className="support-inbox">
          <div className="search-box" style={{ marginBottom: 12 }}>
            <Search size={18} color="var(--text-muted)" />
            <input
              placeholder="ابحث بالاسم أو المعرّف..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <Loading />
          ) : filtered.length === 0 ? (
            <Empty text="لا توجد محادثات دعم بعد" />
          ) : (
            <div className="support-conv-list">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`support-conv-item ${selected?.id === c.id ? 'active' : ''}`}
                  onClick={() => setSelected(c)}
                >
                  <div className="support-conv-avatar">
                    {c.userAvatar ? (
                      <img src={c.userAvatar} alt="" />
                    ) : (
                      <User size={20} color="var(--brand-primary)" />
                    )}
                  </div>
                  <div className="support-conv-body">
                    <div className="support-conv-top">
                      <span className="support-conv-name">
                        {c.userName}
                        {c.supportTopic === 'recharge' ? (
                          <span style={{ marginInlineStart: 6, verticalAlign: 'middle' }}>
                            <Badge variant="gold"><Coins size={11} /> شحن</Badge>
                          </span>
                        ) : null}
                      </span>
                      <span className="support-conv-time">{timeAgo(c.lastMessageAt)}</span>
                    </div>
                    <p className="support-conv-preview">{c.lastMessage || '—'}</p>
                    <span className="support-conv-uid">
                      {c.userPublicAccountId
                        ? `معرّف: ${c.userPublicAccountId}`
                        : `${c.userUid.slice(0, 12)}…`}
                    </span>
                  </div>
                  {c.unreadCount > 0 && (
                    <span className="support-unread-dot">{c.unreadCount}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className="support-thread">
          {!selected ? (
            <div className="support-empty-thread">
              <MessageCircle size={48} color="var(--brand-primary-light)" />
              <h3>اختر محادثة</h3>
              <p>اضغط على مستخدم من القائمة لعرض الرسائل والرد</p>
            </div>
          ) : (
            <>
              <header className="support-thread-header">
                <div className="support-thread-user">
                  <div className="support-conv-avatar lg">
                    {selected.userAvatar ? (
                      <img src={selected.userAvatar} alt="" />
                    ) : (
                      <User size={24} color="var(--brand-primary)" />
                    )}
                  </div>
                  <div>
                    <h3>
                      {selected.userName}
                      {selected.supportTopic === 'recharge' ? (
                        <span style={{ marginInlineStart: 8, verticalAlign: 'middle' }}>
                          <Badge variant="gold"><Coins size={12} /> طلب شحن عملات</Badge>
                        </span>
                      ) : null}
                    </h3>
                    {selected.userPublicAccountId ? (
                      <div style={{ marginTop: 6 }}>
                        <CopyableId label="معرّف الحساب" id={selected.userPublicAccountId} />
                      </div>
                    ) : (
                      <code>{selected.userUid}</code>
                    )}
                  </div>
                </div>
                <a
                  href={`/users`}
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => {
                    e.preventDefault();
                    window.location.hash = '';
                  }}
                  style={{ display: 'none' }}
                >
                  الملف
                </a>
              </header>

              <div className="support-messages">
                {messages.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                    لا رسائل بعد
                  </p>
                ) : (
                  messages.map((m) => (
                    <SupportMessageBubble key={m.id} message={m} />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="support-quick-replies">
                {QUICK_REPLIES.map((q) => (
                  <button
                    key={q}
                    type="button"
                    className="support-quick-chip"
                    onClick={() => setReply(q)}
                  >
                    {q.length > 36 ? `${q.slice(0, 36)}…` : q}
                  </button>
                ))}
              </div>

              <footer className="support-compose">
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="اكتب رد الدعم..."
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSend();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={sending || !reply.trim()}
                  onClick={() => void handleSend()}
                >
                  <Send size={18} />
                  إرسال
                </button>
              </footer>
            </>
          )}
        </main>
      </div>

      <div className="support-hint-bar">
        <Building2 size={16} />
        <span>
          طلبات الوكالة تظهر أيضاً في «طلبات فتح الوكالة». الردود هنا تصل للمستخدم في تطبيق LinkUp فوراً.
        </span>
        <RefreshCw size={14} style={{ marginRight: 'auto', opacity: 0.5 }} />
      </div>
    </div>
  );
}
