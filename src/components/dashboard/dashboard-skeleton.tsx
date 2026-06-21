import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DashboardSkeleton() {
    return (
        <div className="space-y-8">
            {/* Header Skeleton */}
            <div className="space-y-2">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-5 w-64" />
            </div>

            {/* Stats Grid Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <Skeleton className="h-12 w-12 rounded-xl" />
                                <Skeleton className="h-6 w-16 rounded-full" />
                            </div>
                            <div className="mt-4 space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-8 w-32" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Content Grid Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Today's Tasks */}
                <Card>
                    <CardHeader className="pb-3">
                        <Skeleton className="h-6 w-32" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-20 w-full rounded-xl" />
                        ))}
                    </CardContent>
                </Card>

                {/* Monthly Status */}
                <Card>
                    <CardHeader className="pb-3">
                        <Skeleton className="h-6 w-32" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="flex items-center gap-4 p-3">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-3 w-32" />
                                </div>
                                <Skeleton className="h-6 w-20" />
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
