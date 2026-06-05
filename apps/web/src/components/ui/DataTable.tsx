import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  label: string;
  className?: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  isLoading?: boolean;
  rowKey: (row: T) => string;
  emptyText?: string;
}

export function DataTable<T>({
  columns,
  rows,
  isLoading,
  rowKey,
  emptyText = 'No records found',
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-outline-variant">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-container-low border-b border-outline-variant text-left">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'px-5 py-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider',
                  col.className,
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/40 bg-surface-container-lowest">
          {isLoading && (
            <tr>
              <td colSpan={columns.length} className="px-5 py-10 text-center">
                <div className="inline-flex items-center gap-2 text-on-surface-variant text-sm">
                  <span className="w-4 h-4 border-2 border-primary-container border-t-transparent rounded-full animate-spin" />
                  Loading…
                </div>
              </td>
            </tr>
          )}
          {!isLoading && (!rows || rows.length === 0) && (
            <tr>
              <td colSpan={columns.length} className="px-5 py-10 text-center text-on-surface-variant text-sm">
                {emptyText}
              </td>
            </tr>
          )}
          {rows?.map((row) => (
            <tr
              key={rowKey(row)}
              className="hover:bg-surface-container-low transition-colors duration-150"
            >
              {columns.map((col) => (
                <td key={col.key} className={cn('px-5 py-3.5 text-on-surface', col.className)}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
