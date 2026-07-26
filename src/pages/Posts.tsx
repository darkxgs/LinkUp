import { useEffect, useState } from 'react';
import { Search, FileText, Eye, EyeOff, Trash2, Heart, MessageCircle } from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import {
  getPosts,
  hidePost,
  restorePost,
  deletePostAdmin,
  backfillPostStatuses,
  logAdminAction,
  formatNumber,
  timeAgo,
  type AdminPost,
} from '@/services/admin';
import { AVATAR_FALLBACK } from '@/utils/avatarFallback';

export default function PostsPage() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'hidden'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getPosts(150).then((p) => { setPosts(p); setLoading(false); }).catch((e) => {
      console.error('load posts', e);
      setError(e instanceof Error ? e.message : 'تعذّر تحميل المنشورات');
      setLoading(false);
    });
  };

  useEffect(load, []);

  const filtered = posts.filter((p) => {
    if (filter === 'active' && p.status !== 'active') return false;
    if (filter === 'hidden' && p.status !== 'hidden') return false;
    const q = search.toLowerCase();
    return (
      p.text.toLowerCase().includes(q) ||
      p.authorName.toLowerCase().includes(q) ||
      p.id.includes(q)
    );
  });

  const handleHide = async (post: AdminPost) => {
    if (!confirm(`إخفاء منشور "${post.authorName}"؟`)) return;
    setBusy(post.id);
    try {
      await hidePost(post.id);
      await logAdminAction('إخفاء منشور', post.authorName, post.id);
      load();
    } catch (e: any) {
      alert('فشل: ' + (e?.message ?? 'خطأ'));
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async (post: AdminPost) => {
    setBusy(post.id);
    try {
      await restorePost(post.id);
      await logAdminAction('استعادة منشور', post.authorName, post.id);
      load();
    } catch (e: any) {
      alert('فشل: ' + (e?.message ?? 'خطأ'));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (post: AdminPost) => {
    if (!confirm('حذف المنشور نهائياً؟ لا يمكن التراجع.')) return;
    setBusy(post.id);
    try {
      await deletePostAdmin(post.id);
      await logAdminAction('حذف منشور', post.authorName, post.id);
      load();
    } catch (e: any) {
      alert('فشل: ' + (e?.message ?? 'خطأ'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="page-container">
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(123,40,200,0.12)' }}>
            <FileText size={26} color="#c21520" />
          </div>
          <div className="stat-card-value">{posts.length}</div>
          <div className="stat-card-label">إجمالي المنشورات</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(16,185,129,0.12)' }}>
            <Eye size={26} color="#10B981" />
          </div>
          <div className="stat-card-value">{posts.filter((p) => p.status === 'active').length}</div>
          <div className="stat-card-label">منشورات نشطة</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(210,30,42,0.12)' }}>
            <Heart size={26} color="#d21e2a" />
          </div>
          <div className="stat-card-value">
            {formatNumber(posts.reduce((s, p) => s + p.likes, 0))}
          </div>
          <div className="stat-card-label">إجمالي الإعجابات</div>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <Search size={18} color="var(--text-muted)" />
          <input
            placeholder="ابحث في المنشورات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)' }}
        >
          <option value="all">الكل</option>
          <option value="active">نشطة</option>
          <option value="hidden">مخفية</option>
        </select>
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            const n = await backfillPostStatuses();
            alert(n > 0 ? `تم تحديث ${n} منشوراً` : 'كل المنشورات محدّثة مسبقاً');
            load();
          }}
        >
          إصلاح الصلاحيات (status)
        </button>

        <span style={{ marginRight: 'auto', color: 'var(--text-muted)', fontWeight: 600 }}>
          {filtered.length} منشور
        </span>
      </div>

      {error && (
        <div className="card" style={{ padding: 14, marginBottom: 12, color: 'var(--danger, #EF4444)', fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div className="card">
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <Empty text="لا توجد منشورات" />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الكاتب</th>
                  <th>المحتوى</th>
                  <th>تفاعل</th>
                  <th>الحالة</th>
                  <th>التاريخ</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="table-user">
                        <img
                          src={p.authorAvatar || AVATAR_FALLBACK}
                          alt=""
                          loading="lazy"
                        />
                        <div className="table-user-info">
                          <p>{p.authorName}</p>
                          <span>{p.uid.slice(0, 12)}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ maxWidth: 280 }}>
                      <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
                        {p.text.slice(0, 120)}
                        {p.text.length > 120 ? '…' : ''}
                      </p>
                      {p.images && p.images.length > 0 && (
                        <Badge variant="purple">{p.images.length} صورة</Badge>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: 12, display: 'flex', gap: 10 }}>
                        <span><Heart size={12} /> {p.likes}</span>
                        <span><MessageCircle size={12} /> {p.comments}</span>
                      </div>
                    </td>
                    <td>
                      {p.status === 'active' ? (
                        <Badge variant="green">نشط</Badge>
                      ) : p.status === 'hidden' ? (
                        <Badge variant="gray">مخفي</Badge>
                      ) : (
                        <Badge variant="red">محذوف</Badge>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>{timeAgo(p.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {p.status === 'active' ? (
                          <button
                            className="action-icon"
                            onClick={() => handleHide(p)}
                            disabled={busy === p.id}
                            title="إخفاء"
                            style={{ color: '#F59E0B' }}
                          >
                            <EyeOff size={16} />
                          </button>
                        ) : (
                          <button
                            className="action-icon"
                            onClick={() => handleRestore(p)}
                            disabled={busy === p.id}
                            title="استعادة"
                            style={{ color: '#10B981' }}
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        <button
                          className="action-icon"
                          onClick={() => handleDelete(p)}
                          disabled={busy === p.id}
                          title="حذف نهائي"
                          style={{ color: '#EF4444' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
