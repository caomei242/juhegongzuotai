import { useEffect, useState } from "react";
import { Trash2, Save, Activity } from "lucide-react";
import type { BusinessStatus, Group, WorkbenchLink } from "../../shared/schema.js";

type LinkEditorProps = {
  link: WorkbenchLink;
  groups: Group[];
  statuses: BusinessStatus[];
  busy: boolean;
  onSave: (payload: Partial<Omit<WorkbenchLink, "id" | "domain">>) => void;
  onDelete: () => void;
  onCheck: () => void;
};

export function LinkEditor({ link, groups, statuses, busy, onSave, onDelete, onCheck }: LinkEditorProps) {
  const [title, setTitle] = useState(link.title);
  const [url, setUrl] = useState(link.url);
  const [groupId, setGroupId] = useState(link.groupId);
  const [businessStatus, setBusinessStatus] = useState<BusinessStatus>(link.businessStatus);
  const [note, setNote] = useState(link.note);
  const [todayAction, setTodayAction] = useState(link.todayAction);
  const [pinned, setPinned] = useState(link.pinned);
  const [checkIntervalMinutes, setCheckIntervalMinutes] = useState(String(link.checkIntervalMinutes));

  useEffect(() => {
    setTitle(link.title);
    setUrl(link.url);
    setGroupId(link.groupId);
    setBusinessStatus(link.businessStatus);
    setNote(link.note);
    setTodayAction(link.todayAction);
    setPinned(link.pinned);
    setCheckIntervalMinutes(String(link.checkIntervalMinutes));
  }, [link]);

  return (
    <form
      className="link-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          title,
          url,
          groupId,
          businessStatus,
          note,
          todayAction,
          pinned,
          checkIntervalMinutes: Math.max(1, Number(checkIntervalMinutes) || link.checkIntervalMinutes)
        });
      }}
    >
      <label>
        标题
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label>
        网址
        <input value={url} onChange={(event) => setUrl(event.target.value)} />
      </label>
      <div className="editor-two-column">
        <label>
          分组
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          业务状态
          <select value={businessStatus} onChange={(event) => setBusinessStatus(event.target.value as BusinessStatus)}>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        备注
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} />
      </label>
      <label>
        今日动作
        <textarea value={todayAction} onChange={(event) => setTodayAction(event.target.value)} rows={2} />
      </label>
      <div className="editor-inline">
        <label>
          检查间隔
          <input
            type="number"
            min="1"
            value={checkIntervalMinutes}
            onChange={(event) => setCheckIntervalMinutes(event.target.value)}
          />
        </label>
        <label className="checkbox-line">
          <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
          置顶
        </label>
      </div>
      <div className="editor-actions">
        <button type="button" className="icon-button" onClick={onCheck} disabled={busy}>
          <Activity size={17} />
          <span>检查</span>
        </button>
        <button type="button" className="danger-button" onClick={onDelete} disabled={busy}>
          <Trash2 size={17} />
          <span>删除</span>
        </button>
        <button type="submit" className="primary-button" disabled={busy}>
          <Save size={17} />
          <span>保存</span>
        </button>
      </div>
    </form>
  );
}
