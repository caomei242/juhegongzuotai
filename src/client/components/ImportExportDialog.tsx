import { useMemo, useState } from "react";
import { Upload, X } from "lucide-react";
import type { ExportPayload } from "../../shared/schema.js";

type ImportExportDialogProps = {
  currentState: ExportPayload;
  onClose: () => void;
  onExport: () => Promise<ExportPayload>;
  onImport: (payload: ExportPayload) => Promise<void>;
};

export function ImportExportDialog({ currentState, onClose, onExport, onImport }: ImportExportDialogProps) {
  const [jsonText, setJsonText] = useState(() => JSON.stringify(currentState, null, 2));
  const [feedback, setFeedback] = useState("准备就绪。");
  const downloadHref = useMemo(
    () => `data:application/json;charset=utf-8,${encodeURIComponent(jsonText)}`,
    [jsonText]
  );

  async function handleExport() {
    try {
      const payload = await onExport();
      setJsonText(JSON.stringify(payload, null, 2));
      setFeedback("已生成导出内容。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "导出失败。");
    }
  }

  async function handleImport() {
    try {
      await onImport(JSON.parse(jsonText) as ExportPayload);
      setFeedback("导入成功。");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "导入失败。");
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog" role="dialog" aria-modal="true" aria-label="导入导出">
        <div className="dialog-heading">
          <h2>导入导出</h2>
          <button type="button" className="square-action" title="关闭" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <textarea
          aria-label="配置 JSON"
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          rows={16}
        />
        <p className="muted-text">{feedback}</p>
        <div className="dialog-actions">
          <button type="button" className="icon-button" onClick={handleExport}>
            <Upload size={17} />
            <span>刷新导出</span>
          </button>
          <a className="icon-button" href={downloadHref} download="strawberry-workbench.json">
            下载 JSON
          </a>
          <button type="button" className="primary-button" onClick={handleImport}>
            导入配置
          </button>
        </div>
      </section>
    </div>
  );
}
