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
    primary: "bg-[#B8837E]/10 text-[#B8837E]",
    green: "bg-[#86C7A3]/10 text-[#86C7A3]",
    amber: "bg-[#E8C87A]/10 text-[#E8C87A]",
    rose: "bg-[#D4A0A0]/10 text-[#D4A0A0]",
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E0D8] hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-[#9C8A82]">{title}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
          <Icon size={20} />
        </div>
      </div>
      <p className="text-2xl font-bold text-[#5C3E35]">{value}</p>
    </div>
  );
}
