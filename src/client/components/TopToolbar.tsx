import { Download, Plus, RefreshCw, Search } from "lucide-react";
import type { BusinessStatus, HealthStatus } from "../../shared/schema.js";

type TopToolbarProps = {
  busy: boolean;
  searchText: string;
  healthFilter: HealthStatus | "全部";
  statusFilter: BusinessStatus | "全部";
  statuses: BusinessStatus[];
  onSearchChange: (value: string) => void;
  onHealthFilterChange: (value: HealthStatus | "全部") => void;
  onStatusFilterChange: (value: BusinessStatus | "全部") => void;
  onAddLink: () => void;
  onCheckAll: () => void;
  onImportExport: () => void;
};

const healthOptions: Array<{ value: HealthStatus | "全部"; label: string }> = [
  { value: "全部", label: "全部健康" },
  { value: "normal", label: "正常" },
  { value: "degraded", label: "异常" },
  { value: "down", label: "不可用" },
  { value: "unchecked", label: "未检查" }
];

export function TopToolbar({
  busy,
  searchText,
  healthFilter,
  statusFilter,
  statuses,
  onSearchChange,
  onHealthFilterChange,
  onStatusFilterChange,
  onAddLink,
  onCheckAll,
  onImportExport
}: TopToolbarProps) {
  return (
    <div className="top-toolbar">
      <label className="search-box">
        <Search size={18} aria-hidden="true" />
        <input
          placeholder="搜索系统、链接或备注"
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>
      <select
        aria-label="健康筛选"
        value={healthFilter}
        onChange={(event) => onHealthFilterChange(event.target.value as HealthStatus | "全部")}
      >
        {healthOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select
        aria-label="业务状态筛选"
        value={statusFilter}
        onChange={(event) => onStatusFilterChange(event.target.value as BusinessStatus | "全部")}
      >
        <option value="全部">全部状态</option>
        {statuses.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <button type="button" className="icon-button" title="检查全部链接" onClick={onCheckAll} disabled={busy}>
        <RefreshCw size={18} />
        <span>检查全部</span>
      </button>
      <button type="button" className="icon-button" title="导入导出" onClick={onImportExport}>
        <Download size={18} />
        <span>导入导出</span>
      </button>
      <button type="button" className="primary-button" onClick={onAddLink} disabled={busy}>
        <Plus size={18} />
        <span>添加链接</span>
      </button>
    </div>
  );
}
