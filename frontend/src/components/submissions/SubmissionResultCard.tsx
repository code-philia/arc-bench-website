import { Empty, Progress, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";

import type { SubmissionDetail } from "../../lib/types";

const columns: ColumnsType<SubmissionDetail["tests"][number]> = [
  {
    title: "Status",
    dataIndex: "status",
    width: 110,
    render: (value: string) => (
      <Tag color={value === "passed" ? "success" : "error"}>{value.toUpperCase()}</Tag>
    ),
  },
  {
    title: "Test",
    dataIndex: "name",
    ellipsis: true,
  },
  {
    title: "Duration",
    dataIndex: "duration_ms",
    width: 120,
    render: (value: number) => `${Math.round(value)} ms`,
  },
];

export default function SubmissionResultCard({ submission }: { submission: SubmissionDetail }) {
  const total = submission.passed_count + submission.failed_count;
  if (total === 0) {
    return (
      <div className="results-empty">
        <Empty description="Results will appear after the runner completes." />
      </div>
    );
  }

  return (
    <div className="results-panel">
      <div className="results-summary">
        <div className="results-count">
          <span className="pass-num">{submission.passed_count}</span>
          <span className="total-num">/{total}</span>
        </div>
        <Progress
          percent={submission.score ?? 0}
          strokeColor="#00d4aa"
          trailColor="rgba(255,255,255,0.08)"
          showInfo={false}
        />
      </div>
      <Table
        rowKey={(record) => `${record.name}-${record.duration_ms}`}
        columns={columns}
        dataSource={submission.tests}
        pagination={{ pageSize: 8 }}
      />
    </div>
  );
}
