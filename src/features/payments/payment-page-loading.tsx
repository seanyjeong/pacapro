import { Card, CardContent } from '@/components/ui/card';

export function PaymentPageLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <div className="space-y-2 border-b border-border/70 pb-4">
        <div className="h-8 w-36 rounded-md bg-muted" />
        <div className="h-4 w-64 rounded-md bg-muted" />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="rounded-lg border-border/70 shadow-none">
            <CardContent className="space-y-3 p-5">
              <div className="h-4 w-20 rounded-md bg-muted" />
              <div className="h-7 w-28 rounded-md bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="rounded-lg border-border/70 shadow-none">
        <CardContent className="space-y-3 p-5">
          <div className="h-10 w-full rounded-md bg-muted" />
          <div className="h-10 w-full rounded-md bg-muted/70" />
          <div className="h-10 w-full rounded-md bg-muted/50" />
        </CardContent>
      </Card>
    </div>
  );
}
