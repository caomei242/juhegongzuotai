import { CSS } from "@dnd-kit/utilities";
import { useSortable } from "@dnd-kit/sortable";
import { ExternalLink, GripVertical, Pencil } from "lucide-react";
import type { HealthRecord, WorkbenchLink } from "../../shared/schema.js";

type LinkCardProps = {
  link: WorkbenchLink;
  healthRecord: HealthRecord | undefined;
  selected: boolean;
  draggingDisabled: boolean;
  onSelect: (linkId: string) => void;
};

const healthLabels: Record<HealthRecord["status"], string> = {
  normal: "正常",
  degraded: "异常",
  down: "不可用",
  unchecked: "未检查"
};

export function LinkCard({ link, healthRecord, selected, draggingDisabled, onSelect }: LinkCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
    disabled: draggingDisabled
  });
  const status = healthRecord?.status ?? "unchecked";
  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`link-card ${selected ? "selected" : ""} ${isDragging ? "dragging" : ""}`}
      onClick={() => onSelect(link.id)}
    >
      <button
        type="button"
        className="drag-handle"
        aria-label="拖拽排序"
        disabled={draggingDisabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={18} />
      </button>
      <div className="link-card-body">
        <div className="link-title-row">
          <h2>{link.title}</h2>
          {link.pinned ? <span className="pin-badge">置顶</span> : null}
        </div>
        <div className="link-meta-row">
          <span className={`health-dot health-${status}`} />
          <span>{healthLabels[status]}</span>
          <span>{link.domain}</span>
          <span>{healthRecord?.checkedAt ? formatCheckedAt(healthRecord.checkedAt) : "未检查"}</span>
        </div>
        <div className="link-status-row">
          <span className="status-pill">{link.businessStatus}</span>
          {link.todayAction ? <span>今日动作：{link.todayAction}</span> : null}
        </div>
        {link.note ? <p>{link.note}</p> : null}
      </div>
      <div className="card-actions">
        <a className="square-action" title="打开链接" href={link.url} target="_blank" rel="noreferrer">
          <ExternalLink size={17} />
        </a>
        <button type="button" className="square-action" title="编辑链接" onClick={() => onSelect(link.id)}>
          <Pencil size={17} />
        </button>
      </div>
    </article>
  );
}

function formatCheckedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "未检查";
  }

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
