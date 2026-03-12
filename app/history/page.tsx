import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// TODO: Replace with real data from Supabase
export default function HistoryPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Report History</h1>
        <p className="text-muted-foreground mt-1">
          All reports ordered by date
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">No reports yet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Reports will appear here once you start generating them.
          </p>
          <Badge variant="secondary" className="mt-2">
            Coming soon: group by URL, trend charts
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
