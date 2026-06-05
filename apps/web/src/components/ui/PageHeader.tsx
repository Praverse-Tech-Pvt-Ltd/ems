interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action, actions }: PageHeaderProps) {
  const rightSlot = actions ?? action;
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">{subtitle}</p>
        )}
      </div>
      {rightSlot && <div className="flex items-center gap-2 flex-shrink-0 ml-4">{rightSlot}</div>}
    </div>
  );
}
