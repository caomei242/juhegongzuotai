import type { BusinessStatus, Group, HealthRecord, WorkbenchLink } from "../../shared/schema.js";
import { LinkEditor } from "./LinkEditor.js";

type RightPanelProps = {
  groups: Group[];
  links: WorkbenchLink[];
  healthRecords: HealthRecord[];
  selectedLink: WorkbenchLink | undefined;
  statuses: BusinessStatus[];
  busy: boolean;
  onSelectLink: (linkId: string) => void;
  onUpdateLink: (id: string, payload: Partial<Omit<WorkbenchLink, "id" | "domain">>) => void;
  onDeleteLink: (id: string) => void;
  onCheckLink: (id: string) => void;
};

export function RightPanel({
  groups,
  links,
  healthRecords,
  selectedLink,
  statuses,
  busy,
  onSelectLink,
  onUpdateLink,
  onDeleteLink,
  onCheckLink
}: RightPanelProps) {
  const actionLinks = links.filter((link) => link.todayAction.trim().length > 0).slice(0, 6);
  const abnormalRecords = healthRecords.filter((record) => record.status === "degraded" || record.status === "down");

  return (
    <div className="right-panel-stack">
      <section>
        <h2>今日动作</h2>
        <div className="compact-list">
          {actionLinks.map((link) => (
            <button type="button" key={link.id} onClick={() => onSelectLink(link.id)}>
              <strong>{link.title}</strong>
              <span>{link.todayAction}</span>
            </button>
          ))}
          {actionLinks.length === 0 ? <p className="muted-text">暂无今日动作。</p> : null}
        </div>
      </section>
      <section>
        <h2>异常链接</h2>
        <div className="compact-list">
          {abnormalRecords.map((record) => {
            const link = links.find((candidate) => candidate.id === record.linkId);
            return link ? (
              <button type="button" key={record.linkId} onClick={() => onSelectLink(record.linkId)}>
                <strong>{link.title}</strong>
                <span>{record.status === "down" ? "不可用" : "异常"}：{record.error || "需要复查"}</span>
              </button>
            ) : null;
          })}
          {abnormalRecords.length === 0 ? <p className="muted-text">暂无异常链接。</p> : null}
        </div>
      </section>
      <section>
        <h2>当前链接</h2>
        {selectedLink ? (
          <LinkEditor
            key={selectedLink.id}
            link={selectedLink}
            groups={groups}
            statuses={statuses}
            busy={busy}
            onSave={(payload) => onUpdateLink(selectedLink.id, payload)}
            onDelete={() => onDeleteLink(selectedLink.id)}
            onCheck={() => onCheckLink(selectedLink.id)}
          />
        ) : (
          <p className="muted-text">请选择一个链接。</p>
        )}
      </section>
    </div>
  );
}
