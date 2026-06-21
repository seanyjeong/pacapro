import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-8 w-56" />
                    <Skeleton className="h-4 w-72" />
                </div>
                <Skeleton className="h-10 w-28" />
            </div>

            <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
                <section className="rounded-lg border border-border bg-card">
                    <div className="border-b border-border px-4 py-3">
                        <Skeleton className="h-5 w-28" />
                        <Skeleton className="mt-2 h-3 w-20" />
                    </div>
                    <div className="space-y-2 p-4">
                        {[0, 1, 2, 3].map((item) => (
                            <div key={item} className="rounded-md border border-border p-3">
                                <div className="flex gap-3">
                                    <Skeleton className="h-8 w-8 rounded-md" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-3 w-full" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                <main className="space-y-5">
                    <section className="grid overflow-hidden rounded-lg border border-border lg:grid-cols-3 xl:grid-cols-6">
                        {[0, 1, 2, 3, 4, 5].map((item) => (
                            <div key={item} className="border-b border-border p-4 lg:border-r">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="mt-3 h-7 w-24" />
                                <Skeleton className="mt-2 h-3 w-16" />
                            </div>
                        ))}
                    </section>
                    <section className="rounded-lg border border-border bg-card">
                        <div className="border-b border-border px-4 py-3">
                            <Skeleton className="h-5 w-28" />
                            <Skeleton className="mt-2 h-3 w-24" />
                        </div>
                        {[0, 1, 2].map((item) => (
                            <div key={item} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
                                <Skeleton className="h-9 w-9 rounded-md" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-3 w-28" />
                                </div>
                                <Skeleton className="h-6 w-20" />
                            </div>
                        ))}
                    </section>
                </main>
            </div>
        </div>
    );
}
