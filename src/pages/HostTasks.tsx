import { useEffect, useState } from 'react';
import { Award, Save, Cloud } from 'lucide-react';
import { Loading } from '@/components/Common';
import {
  getHostTasksConfig,
  saveHostTasksConfig,
  DEFAULT_HOST_TASKS,
  logAdminAction,
  formatNumber,
  type ConfigHostTasks,
  type ConfigHostTaskItem,
} from '@/services/admin';

type TaskKey = keyof ConfigHostTasks['tasks'];

const TASK_LABELS: Record<TaskKey, string> = {
  messages: 'الرسائل الواردة',
  voiceCalls: 'محادثة صوتية',
  videoCalls: 'محادثة فيديو',
  voiceCompetition: 'مطابقات صوت',
  videoCompetition: 'مطابقات فيديو',
  dailyOnline: 'التسجيل اليومي (+8 ساعات)',
};

export default function HostTasksPage() {
  const [config, setConfig] = useState<ConfigHostTasks>(DEFAULT_HOST_TASKS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    let data = await getHostTasksConfig();
    if (!data) {
      data = DEFAULT_HOST_TASKS;
      await saveHostTasksConfig(data);
    }
    setConfig(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const patch = (p: Partial<ConfigHostTasks>) => setConfig((c) => ({ ...c, ...p }));

  const updateTask = (key: TaskKey, p: Partial<ConfigHostTaskItem>) => {
    setConfig((c) => ({
      ...c,
      tasks: { ...c.tasks, [key]: { ...c.tasks[key], ...p } },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await saveHostTasksConfig(config);
    await logAdminAction('حفظ مهام المضيفة', config.titleAr);
    setSaving(false);
    alert('تم الحفظ — التطبيق يتحدّث فوراً');
  };

  if (loading) return <Loading />;

  return (
    <div className="page-container">
      <div className="filters-bar">
        <div className="config-sync-badge">
          <Cloud size={16} />
          مرتبط بالتطبيق — إعدادات hostTasks
        </div>
        <button className="btn btn-primary" style={{ marginRight: 'auto' }} onClick={handleSave} disabled={saving}>
          <Save size={16} />
          {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>

      <div className="page-header">
        <Award size={28} />
        <div>
          <h1>مهام المضيفة</h1>
          <p>تحكم بالأسعار والدقائق والحدود — المضيفة تضغط «تحصيل» لإضافة المكافآت</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3>إعدادات عامة</h3>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <label className="form-field form-field--toggle">
              <span>تفعيل النظام</span>
              <input type="checkbox" checked={config.enabled} onChange={(e) => patch({ enabled: e.target.checked })} />
            </label>
            <label className="form-field">
              <span>العنوان (عربي)</span>
              <input value={config.titleAr} onChange={(e) => patch({ titleAr: e.target.value })} />
            </label>
            <label className="form-field">
              <span>العنوان (إنجليزي)</span>
              <input value={config.titleEn} onChange={(e) => patch({ titleEn: e.target.value })} />
            </label>
            <label className="form-field">
              <span>ساعة إعادة التعيين (0 = منتصف الليل)</span>
              <input
                type="number"
                min={0}
                max={23}
                value={config.resetHour}
                onChange={(e) => patch({ resetHour: Number(e.target.value) })}
              />
            </label>
          </div>
        </div>
      </div>

      {(Object.keys(TASK_LABELS) as TaskKey[]).map((key) => {
        const task = config.tasks[key];
        const targetLabel =
          key === 'messages' ? 'عدد الرسائل' :
          key === 'videoCompetition' ? 'عدد المسابقات' :
          'الدقائق / الساعات';
        return (
          <div className="card" key={key} style={{ marginBottom: 16 }}>
            <div className="card-header task-card-header">
              <h3>{TASK_LABELS[key]}</h3>
              <label className="task-card-toggle">
                <input type="checkbox" checked={task.enabled} onChange={(e) => updateTask(key, { enabled: e.target.checked })} />
                مفعّلة
              </label>
            </div>
            <div className="card-body">
              <div className="form-grid">
                <label className="form-field">
                  <span>العنوان عربي</span>
                  <input value={task.titleAr} onChange={(e) => updateTask(key, { titleAr: e.target.value })} />
                </label>
                <label className="form-field">
                  <span>{targetLabel}</span>
                  <input
                    type="number"
                    min={1}
                    value={task.target}
                    onChange={(e) => updateTask(key, { target: Number(e.target.value) })}
                  />
                </label>
                <label className="form-field">
                  <span>مكافأة الكوينز</span>
                  <input
                    type="number"
                    min={0}
                    value={task.rewardCoins}
                    onChange={(e) => updateTask(key, { rewardCoins: Number(e.target.value) })}
                  />
                  <small>{formatNumber(task.rewardCoins)} كوين</small>
                </label>
                <label className="form-field form-field--toggle">
                  <span>تتكرر يومياً</span>
                  <input
                    type="checkbox"
                    checked={task.repeatable}
                    onChange={(e) => updateTask(key, { repeatable: e.target.checked })}
                  />
                </label>
                <label className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <span>الوصف عربي</span>
                  <input value={task.descAr} onChange={(e) => updateTask(key, { descAr: e.target.value })} />
                </label>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
