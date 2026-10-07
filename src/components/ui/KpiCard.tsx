export default function KpiCard({
  title,
  value,
  icon: Icon,
  color = "primary",
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color?: "primary" | "green" | "amber" | "rose";
}) {
  const colorMap = {
    primary: "bg-[#BA4A3A]/10 text-[#BA4A3A]",
    green: "bg-[#86C7A3]/10 text-[#86C7A3]",
    amber: "bg-[#E8C87A]/10 text-[#E8C87A]",
    rose: "bg-[#D4A0A0]/10 text-[#D4A0A0]",
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E0DAD3] hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[#4C5760]">{title}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon size={20} />
        </div>
      </div>
      <p className="text-2xl font-bold text-[#39484F]">{value}</p>
    </div>
  );
}
