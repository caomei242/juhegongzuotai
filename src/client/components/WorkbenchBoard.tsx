import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import type { BusinessStatus, Group, HealthRecord, HealthStatus, WorkbenchLink } from "../../shared/schema.js";
import { LinkCard } from "./LinkCard.js";

type WorkbenchBoardProps = {
  groups: Group[];
  links: WorkbenchLink[];
  healthRecords: HealthRecord[];
  selectedGroupId: string;
  selectedLinkId: string;
  searchText: string;
  healthFilter: HealthStatus | "全部";
  statusFilter: BusinessStatus | "全部";
  onSelectLink: (linkId: string) => void;
  onReorder: (groupId: string, linkIds: string[]) => void;
};

const dragAccessibility = {
  screenReaderInstructions: {
    draggable: "按空格拾取链接，使用方向键移动，再按空格放下，按 Escape 取消。"
  }
};

export function WorkbenchBoard({
  groups,
  links,
  healthRecords,
  selectedGroupId,
  selectedLinkId,
  searchText,
  healthFilter,
  statusFilter,
  onSelectLink,
  onReorder
}: WorkbenchBoardProps) {
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0];
  const groupLinks = links
    .filter((link) => link.groupId === selectedGroup?.id)
    .slice()
    .sort((left, right) => left.order - right.order);
  const visibleLinks = groupLinks.filter((link) =>
    matchesFilters(link, healthRecords.find((record) => record.linkId === link.id), searchText, healthFilter, statusFilter)
  );
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const draggingDisabled = visibleLinks.length !== groupLinks.length || visibleLinks.length <= 1;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!selectedGroup || !over || active.id === over.id || draggingDisabled) {
      return;
    }

    const oldIndex = groupLinks.findIndex((link) => link.id === active.id);
    const newIndex = groupLinks.findIndex((link) => link.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    onReorder(
      selectedGroup.id,
      arrayMove(
        groupLinks.map((link) => link.id),
        oldIndex,
        newIndex
      )
    );
  }

  return (
    <section className="workbench-board" aria-label="链接工作区">
      <div className="board-heading">
        <div>
          <p>当前分组</p>
          <h2>{selectedGroup?.name ?? "未选择分组"}</h2>
        </div>
        <span>{visibleLinks.length} 个入口</span>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        accessibility={dragAccessibility}
      >
        <SortableContext items={visibleLinks.map((link) => link.id)} strategy={verticalListSortingStrategy}>
          <div className="link-list">
            {visibleLinks.map((link) => (
              <LinkCard
                key={link.id}
                link={link}
                healthRecord={healthRecords.find((record) => record.linkId === link.id)}
                selected={link.id === selectedLinkId}
                draggingDisabled={draggingDisabled}
                onSelect={onSelectLink}
              />
            ))}
            {visibleLinks.length === 0 ? <div className="empty-state">没有匹配的链接。</div> : null}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}

function matchesFilters(
  link: WorkbenchLink,
  healthRecord: HealthRecord | undefined,
  searchText: string,
  healthFilter: HealthStatus | "全部",
  statusFilter: BusinessStatus | "全部"
): boolean {
  const normalizedSearch = searchText.trim().toLowerCase();
  const haystack = [link.title, link.domain, link.note, link.todayAction].join(" ").toLowerCase();
  const status = healthRecord?.status ?? "unchecked";

  return (
    (normalizedSearch.length === 0 || haystack.includes(normalizedSearch)) &&
    (healthFilter === "全部" || status === healthFilter) &&
    (statusFilter === "全部" || link.businessStatus === statusFilter)
  );
}
