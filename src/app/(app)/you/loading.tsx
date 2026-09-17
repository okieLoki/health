import { PageSkeleton } from "@/components/skeleton";

export default function Loading() {
  return <PageSkeleton tiles={3} cols={3} rows={3} />;
}
