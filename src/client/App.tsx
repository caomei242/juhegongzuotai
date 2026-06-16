import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import { defaultHealthRecords, defaultWorkbench } from "../shared/defaultData.js";
import type { BusinessStatus, ExportPayload, HealthStatus, WorkbenchLink } from "../shared/schema.js";
import { GroupRail } from "./components/GroupRail.js";
import { ImportExportDialog } from "./components/ImportExportDialog.js";
import { Layout } from "./components/Layout.js";
import { RightPanel } from "./components/RightPanel.js";
import { TopToolbar } from "./components/TopToolbar.js";
import { WorkbenchBoard } from "./components/WorkbenchBoard.js";
import "./styles.css";

const fallbackState: ExportPayload = {
  workbench: defaultWorkbench,
  healthRecords: defaultHealthRecords
};

export default function App() {
  const [state, setState] = useState<ExportPayload>(fallbackState);
  const [selectedGroupId, setSelectedGroupId] = useState(defaultWorkbench.links[0]?.groupId ?? defaultWorkbench.groups[0]?.id ?? "");
  const [selectedLinkId, setSelectedLinkId] = useState(defaultWorkbench.links[0]?.id ?? "");
  const [searchText, setSearchText] = useState("");
  const [healthFilter, setHealthFilter] = useState<HealthStatus | "全部">("全部");
  const [statusFilter, setStatusFilter] = useState<BusinessStatus | "全部">("全部");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState("正在连接本地服务。");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    api
      .getState()
      .then((payload) => {
        if (!mounted) {
          return;
        }

        setState(payload);
        setSelectedGroupId(payload.workbench.links[0]?.groupId ?? payload.workbench.groups[0]?.id ?? "");
        setSelectedLinkId(payload.workbench.links[0]?.id ?? "");
        setMessage("已连接本地数据。");
      })
      .catch(() => {
        if (mounted) {
          setMessage("使用内置示例数据。");
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const selectedLink = useMemo(
    () => state.workbench.links.find((link) => link.id === selectedLinkId) ?? state.workbench.links[0],
    [selectedLinkId, state.workbench.links]
  );

  function applyState(payload: ExportPayload) {
    const nextSelectedLink = resolveSelectedLink(payload, selectedLinkId, selectedGroupId);
    const nextSelectedGroupId =
      nextSelectedLink?.groupId ??
      (payload.workbench.groups.some((group) => group.id === selectedGroupId)
        ? selectedGroupId
        : payload.workbench.groups[0]?.id ?? "");

    setState(payload);
    setSelectedLinkId(nextSelectedLink?.id ?? "");
    setSelectedGroupId(nextSelectedGroupId);
  }

  function selectLink(linkId: string) {
    const link = state.workbench.links.find((candidate) => candidate.id === linkId);
    setSelectedLinkId(linkId);

    if (link) {
      setSelectedGroupId(link.groupId);
    }
  }

  async function runAction(action: () => Promise<ExportPayload>, successMessage: string) {
    setBusy(true);

    try {
      const payload = await action();
      applyState(payload);
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败。");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddLink() {
    const groupId = selectedGroupId || state.workbench.groups[0]?.id;

    if (!groupId) {
      setMessage("请先创建分组。");
      return;
    }

    setBusy(true);

    try {
      const response = await api.createLink({
        groupId,
        title: "新链接",
        url: "https://example.com",
        businessStatus: "待处理",
        note: "",
        todayAction: "补充今日动作"
      });
      setState(response.state);
      setSelectedGroupId(response.link.groupId);
      setSelectedLinkId(response.link.id);
      setMessage("已添加链接。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "添加失败。");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateLink(id: string, payload: Partial<Omit<WorkbenchLink, "id" | "domain">>) {
    await runAction(async () => (await api.updateLink(id, payload)).state, "已保存链接。");
  }

  async function handleDeleteLink(id: string) {
    await runAction(async () => (await api.deleteLink(id)).state, "已删除链接。");
  }

  async function handleReorder(groupId: string, linkIds: string[]) {
    await runAction(async () => (await api.reorderLinks({ groupId, linkIds })).state, "已保存排序。");
  }

  async function handleCheckLink(id: string) {
    await runAction(async () => (await api.checkLink(id)).state, "已完成链接检查。");
  }

  async function handleCheckAll() {
    await runAction(async () => (await api.checkAll()).state, "已完成全部检查。");
  }

  async function handleImport(payload: ExportPayload) {
    await runAction(async () => await api.importState(payload), "已导入配置。");
  }

  return (
    <>
      <Layout
        top={
          <TopToolbar
            busy={busy}
            searchText={searchText}
            healthFilter={healthFilter}
            statusFilter={statusFilter}
            statuses={state.workbench.settings.statuses}
            onSearchChange={setSearchText}
            onHealthFilterChange={setHealthFilter}
            onStatusFilterChange={setStatusFilter}
            onAddLink={handleAddLink}
            onCheckAll={handleCheckAll}
            onImportExport={() => setDialogOpen(true)}
          />
        }
        left={
          <GroupRail
            groups={state.workbench.groups}
            links={state.workbench.links}
            selectedGroupId={selectedGroupId}
            onSelectGroup={setSelectedGroupId}
          />
        }
        main={
          <WorkbenchBoard
            groups={state.workbench.groups}
            links={state.workbench.links}
            healthRecords={state.healthRecords}
            selectedGroupId={selectedGroupId}
            selectedLinkId={selectedLink?.id ?? ""}
            searchText={searchText}
            healthFilter={healthFilter}
            statusFilter={statusFilter}
            onSelectLink={selectLink}
            onReorder={handleReorder}
          />
        }
        right={
          <RightPanel
            groups={state.workbench.groups}
            links={state.workbench.links}
            healthRecords={state.healthRecords}
            selectedLink={selectedLink}
            statuses={state.workbench.settings.statuses}
            busy={busy}
            onSelectLink={selectLink}
            onUpdateLink={handleUpdateLink}
            onDeleteLink={handleDeleteLink}
            onCheckLink={handleCheckLink}
          />
        }
        message={message}
      />
      {dialogOpen ? (
        <ImportExportDialog
          currentState={state}
          onClose={() => setDialogOpen(false)}
          onExport={api.exportState}
          onImport={handleImport}
        />
      ) : null}
    </>
  );
}

function resolveSelectedLink(
  payload: ExportPayload,
  selectedLinkId: string,
  selectedGroupId: string
): WorkbenchLink | undefined {
  const existingSelectedLink = payload.workbench.links.find((link) => link.id === selectedLinkId);

  if (existingSelectedLink) {
    return existingSelectedLink;
  }

  return (
    payload.workbench.links
      .slice()
      .sort((left, right) => left.order - right.order)
      .find((link) => link.groupId === selectedGroupId) ?? payload.workbench.links[0]
  );
}
