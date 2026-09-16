import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { weightLogs } from "@/db/schema";
import { getSessionUser, getProfile } from "@/lib/auth";
import { Onboarding } from "@/components/onboarding";

export const metadata: Metadata = { title: "Set up" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/auth/sign-in");

  const { edit } = await searchParams;
  const [profile, latest] = await Promise.all([
    getProfile(user.id),
    db.query.weightLogs.findFirst({
      where: eq(weightLogs.userId, user.id),
      orderBy: desc(weightLogs.measuredAt),
    }),
  ]);

  return (
    <Onboarding
      editing={edit === "1"}
      initial={{
        sex: profile.sex,
        birthDate: profile.birthDate,
        heightCm: profile.heightCm,
        weightKg: latest?.weightKg ?? null,
        goal: profile.goal,
        targetWeightKg: profile.targetWeightKg,
        weeklyRateKg: profile.weeklyRateKg,
        activityLevel: profile.activityLevel,
        waterTargetMl: profile.waterTargetMl,
        stepTarget: profile.stepTarget,
        fastingTargetHours: profile.fastingTargetHours,
        timezone: profile.timezone,
      }}
    />
  );
}
