import { PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <PageSkeleton tiles={4} cols={2} rows={2} />;
}
