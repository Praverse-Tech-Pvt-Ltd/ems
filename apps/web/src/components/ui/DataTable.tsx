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

export function DataTable<T>({ columns, rows, isLoading, rowKey, emptyText = 'No records found' }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left">
            {columns.map((col) => (
              <th key={col.key} className={cn('px-5 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide', col.className)}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading && (
            <tr>
              <td colSpan={columns.length} className="px-5 py-8 text-center text-slate-400">
                Loading...
              </td>
            </tr>
          )}
          {!isLoading && (!rows || rows.length === 0) && (
            <tr>
              <td colSpan={columns.length} className="px-5 py-8 text-center text-slate-400">
                {emptyText}
              </td>
            </tr>
          )}
          {rows?.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-slate-50 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className={cn('px-5 py-3 text-slate-700', col.className)}>
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
