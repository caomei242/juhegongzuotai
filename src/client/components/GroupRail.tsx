import type { Group, WorkbenchLink } from "../../shared/schema.js";

type GroupRailProps = {
  groups: Group[];
  links: WorkbenchLink[];
  selectedGroupId: string;
  onSelectGroup: (groupId: string) => void;
};

export function GroupRail({ groups, links, selectedGroupId, onSelectGroup }: GroupRailProps) {
  return (
    <nav className="group-rail" aria-label="分组导航">
      {groups
        .slice()
        .sort((left, right) => left.order - right.order)
        .map((group) => {
          const count = links.filter((link) => link.groupId === group.id).length;
          return (
            <button
              type="button"
              key={group.id}
              className={group.id === selectedGroupId ? "group-item active" : "group-item"}
              onClick={() => onSelectGroup(group.id)}
            >
              <span className={`group-accent accent-${group.accent}`} />
              <span>{group.name}</span>
              <strong>{count}</strong>
            </button>
          );
        })}
    </nav>
  );
}
