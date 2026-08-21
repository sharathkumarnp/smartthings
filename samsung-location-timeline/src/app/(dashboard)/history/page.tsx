import { HistoryView } from "@/components/HistoryView";
import { format } from "date-fns";

export default function HistoryPage() {
  return <HistoryView initialDate={format(new Date(), "yyyy-MM-dd")} />;
}
