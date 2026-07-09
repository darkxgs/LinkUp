import { useEffect, useState } from 'react';
import { Heart, Users, TrendingUp } from 'lucide-react';
import { Loading, Empty, Badge } from '@/components/Common';
import { formatNumber, timeAgo, getRelationships, type AdminRelationship } from '@/services/admin';

const LEVEL_TITLES: Record<number, string> = {
  1: 'تعارف', 2: 'معرفة', 3: 'صديق', 4: 'صديق مقرب', 5: 'صداقة قوية',
  6: 'علاقة وثيقة', 7: 'علاقة مميزة', 8: 'صديق العمر', 9: 'صديق روحي',
  10: 'رفيق الدرب', 11: 'حبيب القلب', 12: 'أصدقاء مقربون', 13: 'علاقة أبدية',
  14: 'توأم الروح', 15: 'علاقة الأسطورة',
};

export default function RelationshipsPage() {
  const [rels, setRels] = useState<AdminRelationship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRelationships(100)
      .then(setRels)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-container">
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(210,30,42,0.12)' }}>
            <Heart size={26} color="#d21e2a" />
          </div>
          <div className="stat-card-value">{rels.length}</div>
          <div className="stat-card-label">إجمالي العلاقات</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(225,18,18,0.12)' }}>
            <TrendingUp size={26} color="#e11212" />
          </div>
          <div className="stat-card-value">{rels.filter((r) => r.level >= 10).length}</div>
          <div className="stat-card-label">علاقات متقدمة (LV10+)</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon" style={{ background: 'rgba(252,211,77,0.18)' }}>
            <Users size={26} color="#F59E0B" />
          </div>
          <div className="stat-card-value">{formatNumber(rels.reduce((s, r) => s + (r.intimacyPoints ?? 0), 0))}</div>
          <div className="stat-card-label">إجمالي نقاط الألفة</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>أقوى العلاقات</h3><Badge variant="red"><Heart size={12} /> Top 100</Badge></div>
        {loading ? <Loading /> : rels.length === 0 ? <Empty text="لا توجد علاقات بعد" /> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>الطرفان</th><th>المستوى</th><th>اللقب</th><th>النقاط</th><th>الهدايا</th><th>آخر تفاعل</th></tr>
              </thead>
              <tbody>
                {rels.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ display: 'flex' }}>
                          <img src={r.user1Avatar || `https://i.pravatar.cc/60?u=${r.id}1`} alt="" style={{ width: 34, height: 34, borderRadius: '50%', border: '2px solid #fff' }} />
                          <img src={r.user2Avatar || `https://i.pravatar.cc/60?u=${r.id}2`} alt="" style={{ width: 34, height: 34, borderRadius: '50%', border: '2px solid #fff', marginRight: -10 }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{r.user1Name} ❤ {r.user2Name}</span>
                      </div>
                    </td>
                    <td><Badge variant="red">LV{r.level}</Badge></td>
                    <td style={{ fontSize: 13 }}>{LEVEL_TITLES[r.level] ?? '-'}</td>
                    <td style={{ fontWeight: 700 }}>{formatNumber(r.intimacyPoints ?? 0)}</td>
                    <td>{formatNumber(r.giftsExchanged ?? 0)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{timeAgo(r.updatedAt)}</td>
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
