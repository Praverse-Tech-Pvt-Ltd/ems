interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action, actions }: PageHeaderProps) {
  const rightSlot = actions ?? action;
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-brand">{title}</h1>
        {subtitle && <p className="text-slate-500 text-sm mt-0.5">{subtitle}</p>}
      </div>
      {rightSlot && <div>{rightSlot}</div>}
    </div>
  );
}
