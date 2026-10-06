import { Link } from "react-router-dom";
export default function SeeAll({ to }: { to: string }) {
  return <Link to={to} className="text-xs text-gold hover:text-gold-light font-medium transition-colors shrink-0">See All</Link>;
}
